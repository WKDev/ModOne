#![cfg(feature = "opcua-server")]

use std::fs::OpenOptions;
use std::io::{self, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{mpsc, Arc};
use std::thread;
use std::time::Duration;

use app_lib::modbus::ProtocolAdapter;
use app_lib::opcua::{OpcUaAdapter, OpcUaConfig, OpcUaMemory, OpcUaServer};
use app_lib::plc_runtime::{
    resolve_vendor_profile, CanonicalAddress, CanonicalAreaKind, CanonicalMemory, CanonicalValue,
    CanonicalWriteSource,
};
use app_lib::project::{PlcHardwareTopology, PlcManufacturer, PlcSettings};
use app_lib::sim::tag_registry::TagRegistry;
use app_lib::sim::types::{RegisterTagRequest, RuntimeBinding, TagAccessLevel};
use opcua::client::prelude::{
    AttributeService, Client, ClientBuilder, DataChangeCallback, IdentityToken,
    MonitoredItemService, Session, SubscriptionService, ViewService,
};
use opcua::crypto::SecurityPolicy;
use opcua::types::{
    AttributeId, BrowseDescription, BrowseDirection, BrowseResultMask, ByteString, DataValue,
    EndpointDescription, MessageSecurityMode, NodeId, ReadValueId, ReferenceDescription,
    ReferenceTypeId, StatusCode, TimestampsToReturn, UAString, UserTokenPolicy, UserTokenType,
    Variant, WriteValue,
};
use parking_lot::RwLock;
use tempfile::tempdir;

fn ls_settings() -> PlcSettings {
    PlcSettings {
        manufacturer: PlcManufacturer::LS,
        model: "XGK".to_string(),
        scan_time_ms: 10,
        hardware_topology: PlcHardwareTopology::default(),
    }
}

fn free_port() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    listener.local_addr().unwrap().port()
}

fn trace(message: &str) {
    let mut stderr = io::stderr();
    let _ = writeln!(stderr, "{message}");
    let _ = stderr.flush();
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open("target/opcua_integration.trace.log")
    {
        let _ = writeln!(file, "{message}");
        let _ = file.flush();
    }
}

fn wait_for_listener(port: u16) {
    for _ in 0..50 {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return;
        }
        thread::sleep(Duration::from_millis(100));
    }
    panic!("OPC UA server did not start listening on port {port}");
}

fn build_client(pki_dir: std::path::PathBuf) -> Client {
    ClientBuilder::new()
        .application_name("ModOne OPC UA Test Client")
        .application_uri("urn:modone:test-client")
        .product_uri("urn:modone:test-client")
        .pki_dir(pki_dir)
        .create_sample_keypair(true)
        .trust_server_certs(true)
        .verify_server_certs(false)
        .session_retry_limit(0)
        .session_timeout(1_000)
        .client()
        .expect("valid OPC UA client config")
}

fn secure_username_policy() -> UserTokenPolicy {
    UserTokenPolicy {
        policy_id: UAString::from("MODONE_LOCAL_USER"),
        token_type: UserTokenType::UserName,
        issued_token_type: UAString::null(),
        issuer_endpoint_url: UAString::null(),
        security_policy_uri: UAString::from(SecurityPolicy::Basic256Sha256.to_str()),
    }
}

fn secure_endpoint_description(url: &str, server_certificate: Vec<u8>) -> EndpointDescription {
    let mut endpoint = EndpointDescription::from((
        url,
        SecurityPolicy::Basic256Sha256.to_str(),
        MessageSecurityMode::SignAndEncrypt,
        vec![secure_username_policy()],
    ));
    endpoint.server_certificate = ByteString::from(server_certificate);
    endpoint
}

fn connect_with_identity(
    client: &mut Client,
    endpoint: EndpointDescription,
    identity: IdentityToken,
) -> Result<Arc<RwLock<Session>>, StatusCode> {
    let session = client
        .new_session_from_info((endpoint, identity))
        .map_err(|_| StatusCode::BadUnexpectedError)?;
    {
        let mut session_guard = session.write();
        session_guard.connect_and_activate()?;
    }
    Ok(session)
}

fn browse_children(session: &Session, node_id: &NodeId) -> Vec<ReferenceDescription> {
    let results = session
        .browse(&[BrowseDescription {
            node_id: node_id.clone(),
            browse_direction: BrowseDirection::Forward,
            reference_type_id: NodeId::from(&ReferenceTypeId::HierarchicalReferences),
            include_subtypes: true,
            node_class_mask: 0,
            result_mask: BrowseResultMask::All as u32,
        }])
        .expect("browse request should succeed")
        .expect("browse results should exist");

    results[0].references.clone().unwrap_or_default()
}

fn find_child(session: &Session, parent: &NodeId, browse_name: &str) -> NodeId {
    browse_children(session, parent)
        .into_iter()
        .find(|reference| reference.browse_name.name.as_ref() == browse_name)
        .map(|reference| reference.node_id.node_id)
        .unwrap_or_else(|| panic!("missing browse child '{browse_name}'"))
}

fn browse_path(session: &Session, segments: &[&str]) -> NodeId {
    let mut current = NodeId::objects_folder_id();
    for segment in segments {
        current = find_child(session, &current, segment);
    }
    current
}

fn bool_value(data_value: &DataValue) -> bool {
    match data_value.value.as_ref() {
        Some(Variant::Boolean(value)) => *value,
        other => panic!("expected boolean variant, got {other:?}"),
    }
}

fn u16_value(data_value: &DataValue) -> u16 {
    match data_value.value.as_ref() {
        Some(Variant::UInt16(value)) => *value,
        other => panic!("expected UInt16 variant, got {other:?}"),
    }
}

fn write_value(node_id: NodeId, value: Variant) -> WriteValue {
    WriteValue {
        node_id,
        attribute_id: AttributeId::Value as u32,
        index_range: UAString::null(),
        value: DataValue::new_now(value),
    }
}

#[test]
#[ignore = "Windows secure-session client activation currently hangs in opcua crate; run manually for investigation"]
fn secure_server_supports_browse_read_write_subscription_and_security() {
    trace("starting secure OPC UA integration test");
    let settings = ls_settings();
    let profile = resolve_vendor_profile(&settings).unwrap();
    let canonical_memory = Arc::new(RwLock::new(CanonicalMemory::new()));
    {
        let mut memory = canonical_memory.write();
        memory
            .write(
                CanonicalAddress::new(CanonicalAreaKind::DataWord, 0),
                CanonicalValue::U16(1234),
                CanonicalWriteSource::Simulation,
            )
            .unwrap();
        memory
            .write(
                CanonicalAddress::new(CanonicalAreaKind::OutputBit, 3),
                CanonicalValue::Bool(false),
                CanonicalWriteSource::Simulation,
            )
            .unwrap();
        memory
            .write(
                CanonicalAddress::new(CanonicalAreaKind::OutputBit, 4),
                CanonicalValue::Bool(false),
                CanonicalWriteSource::Simulation,
            )
            .unwrap();
        memory
            .write(
                CanonicalAddress::new(CanonicalAreaKind::InternalBit, 1),
                CanonicalValue::Bool(true),
                CanonicalWriteSource::Simulation,
            )
            .unwrap();
        memory
            .write(
                CanonicalAddress::new(CanonicalAreaKind::SystemBit, 1),
                CanonicalValue::Bool(false),
                CanonicalWriteSource::Simulation,
            )
            .unwrap();
    }

    let tag_registry = Arc::new(TagRegistry::new());
    tag_registry
        .register_semantic(RegisterTagRequest {
            tag_id: Some("motor-run".to_string()),
            display_name: "Motor Run".to_string(),
            binding: Some(RuntimeBinding::canonical(CanonicalAddress::new(
                CanonicalAreaKind::OutputBit,
                3,
            ))),
            canonical_address: None,
            vendor_aliases: vec!["Y3".to_string()],
            description: Some("Writable run command".to_string()),
            engineering_unit: None,
            access: None,
        })
        .unwrap();
    tag_registry
        .register_semantic(RegisterTagRequest {
            tag_id: Some("motor-cmd-locked".to_string()),
            display_name: "Motor Command Locked".to_string(),
            binding: Some(RuntimeBinding::canonical(CanonicalAddress::new(
                CanonicalAreaKind::OutputBit,
                4,
            ))),
            canonical_address: None,
            vendor_aliases: vec!["Y4".to_string()],
            description: Some("Tag-level readonly enforcement".to_string()),
            engineering_unit: None,
            access: Some(TagAccessLevel::ReadOnly),
        })
        .unwrap();
    tag_registry
        .register_semantic(RegisterTagRequest {
            tag_id: Some("motor-status".to_string()),
            display_name: "Motor Status".to_string(),
            binding: Some(RuntimeBinding::canonical(CanonicalAddress::new(
                CanonicalAreaKind::InternalBit,
                1,
            ))),
            canonical_address: None,
            vendor_aliases: vec!["F1".to_string()],
            description: Some("Readonly status bit".to_string()),
            engineering_unit: None,
            access: None,
        })
        .unwrap();
    tag_registry.register_raw(
        CanonicalAddress::new(CanonicalAreaKind::SystemBit, 1),
        Some("System Heartbeat".to_string()),
        vec!["SB1".to_string()],
    );

    let temp = tempdir().unwrap();
    let port = free_port();
    let server_pki_dir = temp.path().join("server-pki");
    let username = "secure-user".to_string();
    let password = "secure-pass".to_string();
    let config = OpcUaConfig {
        bind_address: "127.0.0.1".to_string(),
        port,
        server_name: "ModOne OPC UA Test".to_string(),
        pki_dir: server_pki_dir,
        certificate_path: "own/cert.der".into(),
        private_key_path: "private/private.pem".into(),
        username: Some(username.clone()),
        password: Some(password.clone()),
    };
    let opcua_memory = Arc::new(OpcUaMemory::new());
    let server = Arc::new(OpcUaServer::new(config, Arc::clone(&opcua_memory)));
    trace("runtime building");
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .worker_threads(2)
        .build()
        .unwrap();
    trace("runtime built");
    {
        trace("entering runtime");
        let _runtime_guard = runtime.enter();
        trace("starting server");
        server
            .start(
                &canonical_memory,
                profile.as_ref(),
                &settings,
                &tag_registry,
            )
            .unwrap();
        trace("server start returned");
    }
    trace("server started");
    wait_for_listener(port);
    trace("listener ready");

    let adapter = OpcUaAdapter::new(
        Arc::clone(&canonical_memory),
        Arc::clone(&opcua_memory),
        Arc::clone(&server),
    );
    adapter.publish_runtime_state().unwrap();
    trace("initial publish complete");

    let status = server.status();
    assert!(status.running);
    assert!(status.feature_enabled);
    assert_eq!(status.endpoint, format!("opc.tcp://127.0.0.1:{port}/"));
    assert_eq!(status.endpoint_path, "/");
    assert!(status.certificate_fingerprint.is_some());
    assert!(status.certificate_valid_to.is_some());
    let secure_endpoint = secure_endpoint_description(
        &status.endpoint,
        std::fs::read(temp.path().join("server-pki").join("own").join("cert.der")).unwrap(),
    );

    let mut good_client = build_client(temp.path().join("client-good"));
    trace("client built");
    let session = connect_with_identity(
        &mut good_client,
        secure_endpoint,
        IdentityToken::UserName(username.clone(), password.clone()),
    )
    .unwrap();
    trace("authenticated session established");

    let (
        raw_memory_node,
        tags_node,
        semantic_tags_node,
        raw_tags_node,
        data_word_folder,
        data_word_zero_node,
        writable_tag_node,
        readonly_tag_node,
        status_tag_node,
        internal_only_tag_node,
    ) = {
        let session_guard = session.read();
        trace("browsing address space");
        let raw_memory_node = browse_path(&session_guard, &["ModOne", "RawMemory"]);
        let tags_node = browse_path(&session_guard, &["ModOne", "Tags"]);
        let semantic_tags_node = browse_path(&session_guard, &["ModOne", "Tags", "Semantic"]);
        let raw_tags_node = browse_path(&session_guard, &["ModOne", "Tags", "Raw"]);
        let data_word_folder = browse_path(&session_guard, &["ModOne", "RawMemory", "DataWord"]);
        let data_word_zero_node = find_child(&session_guard, &data_word_folder, "DataWord[0]");
        let writable_tag_node = find_child(&session_guard, &semantic_tags_node, "motor-run");
        let readonly_tag_node = find_child(&session_guard, &semantic_tags_node, "motor-cmd-locked");
        let status_tag_node = find_child(&session_guard, &semantic_tags_node, "motor-status");
        let internal_only_tag_node = find_child(&session_guard, &raw_tags_node, "raw:SystemBit:1");

        let raw_memory_children = browse_children(&session_guard, &raw_memory_node);
        assert!(raw_memory_children
            .iter()
            .any(|reference| reference.browse_name.name.as_ref() == "DataWord"));
        let tag_children = browse_children(&session_guard, &tags_node);
        assert!(tag_children
            .iter()
            .any(|reference| reference.browse_name.name.as_ref() == "Semantic"));
        assert!(tag_children
            .iter()
            .any(|reference| reference.browse_name.name.as_ref() == "Raw"));
        assert_ne!(writable_tag_node.namespace, 2);

        let values = session_guard
            .read(
                &[
                    ReadValueId::from(data_word_zero_node.clone()),
                    ReadValueId::from(writable_tag_node.clone()),
                    ReadValueId::from(status_tag_node.clone()),
                ],
                TimestampsToReturn::Both,
                0.0,
            )
            .unwrap();
        assert_eq!(u16_value(&values[0]), 1234);
        assert!(!bool_value(&values[1]));
        assert!(bool_value(&values[2]));

        (
            raw_memory_node,
            tags_node,
            semantic_tags_node,
            raw_tags_node,
            data_word_folder,
            data_word_zero_node,
            writable_tag_node,
            readonly_tag_node,
            status_tag_node,
            internal_only_tag_node,
        )
    };
    trace("browse and initial read complete");

    let (tx, rx) = mpsc::channel();
    {
        let tx = tx.clone();
        let session_guard = session.read();
        let subscription_id = session_guard
            .create_subscription(
                100.0,
                30,
                10,
                0,
                0,
                true,
                DataChangeCallback::new(move |items| {
                    for item in items {
                        if let Some(Variant::Boolean(value)) = item.last_value().value.as_ref() {
                            let _ = tx.send(*value);
                        }
                    }
                }),
            )
            .unwrap();
        let monitored = session_guard
            .create_monitored_items(
                subscription_id,
                TimestampsToReturn::Both,
                &[writable_tag_node.clone().into()],
            )
            .unwrap();
        assert_eq!(monitored.len(), 1);
    }
    trace("subscription created");

    {
        let session_guard = session.read();
        let statuses = session_guard
            .write(&[write_value(
                writable_tag_node.clone(),
                Variant::Boolean(true),
            )])
            .unwrap();
        assert_eq!(statuses[0], StatusCode::Good);
    }
    adapter.apply_external_writes().unwrap();
    trace("external write applied");
    assert_eq!(
        canonical_memory
            .read()
            .read(CanonicalAddress::new(CanonicalAreaKind::OutputBit, 3))
            .unwrap(),
        CanonicalValue::Bool(true)
    );

    {
        let session_guard = session.read();
        let statuses = session_guard
            .write(&[write_value(
                readonly_tag_node.clone(),
                Variant::Boolean(true),
            )])
            .unwrap();
        assert_eq!(statuses[0], StatusCode::BadNotWritable);
    }

    {
        let session_guard = session.read();
        let statuses = session_guard
            .write(&[write_value(
                internal_only_tag_node.clone(),
                Variant::Boolean(true),
            )])
            .unwrap();
        assert_eq!(statuses[0], StatusCode::BadNotWritable);
    }

    {
        let session_guard = session.read();
        let statuses = session_guard
            .write(&[write_value(
                data_word_zero_node.clone(),
                Variant::UInt32(70_000),
            )])
            .unwrap();
        assert_eq!(statuses[0], StatusCode::BadOutOfRange);
    }
    trace("write policy assertions complete");

    {
        let mut memory = canonical_memory.write();
        memory
            .write(
                CanonicalAddress::new(CanonicalAreaKind::OutputBit, 3),
                CanonicalValue::Bool(false),
                CanonicalWriteSource::Simulation,
            )
            .unwrap();
    }
    adapter.publish_runtime_state().unwrap();
    trace("second publish complete");

    let mut saw_false_notification = false;
    for _ in 0..5 {
        if let Ok(value) = rx.recv_timeout(Duration::from_secs(2)) {
            if !value {
                saw_false_notification = true;
                break;
            }
        }
    }
    assert!(
        saw_false_notification,
        "expected a subscription update for false"
    );
    trace("subscription notification received");

    let session_guard = session.read();
    let values = session_guard
        .read(
            &[ReadValueId::from(writable_tag_node.clone())],
            TimestampsToReturn::Both,
            0.0,
        )
        .unwrap();
    assert!(!bool_value(&values[0]));
    drop(session_guard);

    let session_guard = session.write();
    session_guard.disconnect();
    drop(session_guard);
    server.stop().unwrap();
    trace("server stopped");

    let _ = (
        raw_memory_node,
        tags_node,
        semantic_tags_node,
        raw_tags_node,
        data_word_folder,
        status_tag_node,
    );
}
