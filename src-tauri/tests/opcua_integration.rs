#![cfg(feature = "opcua-server")]

mod opcua_test_support;

use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use app_lib::modbus::ProtocolAdapter;
use app_lib::plc_runtime::{
    CanonicalAddress, CanonicalAreaKind, CanonicalValue, CanonicalWriteSource,
};
use opcua::client::prelude::{
    AttributeService, DataChangeCallback, IdentityToken, MonitoredItemService, SubscriptionService,
    ViewService,
};
use opcua::types::{
    AttributeId, BrowseDescription, BrowseDirection, BrowseResultMask, DataValue, NodeId,
    ReadValueId, ReferenceDescription, ReferenceTypeId, StatusCode, TimestampsToReturn, UAString,
    Variant, WriteValue,
};
use opcua_test_support::{
    build_client, connect_session_with_trace_and_timeout, manual_secure_username_endpoint,
    normalize_endpoint_base, run_self_test_with_timeout, start_secure_test_server, trace_to,
};

fn browse_children(
    session: &opcua::client::prelude::Session,
    node_id: &NodeId,
) -> Vec<ReferenceDescription> {
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

fn find_child(
    session: &opcua::client::prelude::Session,
    parent: &NodeId,
    browse_name: &str,
) -> NodeId {
    browse_children(session, parent)
        .into_iter()
        .find(|reference| reference.browse_name.name.as_ref() == browse_name)
        .map(|reference| reference.node_id.node_id)
        .unwrap_or_else(|| panic!("missing browse child '{browse_name}'"))
}

fn browse_path(session: &opcua::client::prelude::Session, segments: &[&str]) -> NodeId {
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
fn secure_server_supports_browse_read_write_subscription_and_security() {
    let trace_path = Path::new("target/opcua_integration.trace.log");
    run_self_test_with_timeout(
        "secure_server_supports_browse_read_write_subscription_and_security_child",
        trace_path,
        Duration::from_secs(45),
    );
}

#[test]
#[ignore = "child entrypoint for timeout-guarded integration run"]
fn secure_server_supports_browse_read_write_subscription_and_security_child() {
    let trace_path = Path::new("target/opcua_integration.trace.log");
    trace_to(trace_path, "starting secure OPC UA integration test");

    let client_pki_dir = PathBuf::from("target/opcua_integration_client_pki");
    let _ = fs::remove_dir_all(&client_pki_dir);
    let _ = build_client(client_pki_dir.clone());
    let trusted_client_cert_path = client_pki_dir.join("own").join("cert.der");
    std::env::set_var("MODONE_OPCUA_TRUST_CLIENT_CERTS", "1");
    std::env::set_var(
        "MODONE_OPCUA_TRUSTED_CLIENT_CERT_PATH",
        trusted_client_cert_path.display().to_string(),
    );

    let fixture = start_secure_test_server(trace_path);
    assert!(fixture.status.running);
    assert!(fixture.status.feature_enabled);
    assert_eq!(fixture.status.endpoint_path, "/");
    assert!(fixture.status.certificate_fingerprint.is_some());
    assert!(fixture.status.certificate_valid_to.is_some());

    trace_to(trace_path, "constructing manual secure endpoint");
    let endpoint_description = manual_secure_username_endpoint(
        fixture.status.endpoint.as_str(),
        &fixture.server_certificate_path,
    );
    trace_to(trace_path, "manual secure endpoint ready");
    assert_eq!(
        normalize_endpoint_base(endpoint_description.endpoint_url.as_ref()),
        normalize_endpoint_base(&fixture.status.endpoint)
    );

    trace_to(trace_path, "building client");
    let mut client = build_client(client_pki_dir.clone());
    trace_to(trace_path, "client built");

    let session = connect_session_with_trace_and_timeout(
        trace_path,
        &mut client,
        endpoint_description,
        IdentityToken::UserName(fixture.username.clone(), fixture.password.clone()),
    );
    trace_to(trace_path, "authenticated session established");

    trace_to(trace_path, "starting browse and initial read assertions");
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
    trace_to(trace_path, "browse and initial read complete");

    trace_to(trace_path, "starting write assertions");
    trace_to(trace_path, "writable write request:start");
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
    trace_to(trace_path, "writable write request:ok");
    fixture.adapter.apply_external_writes().unwrap();
    trace_to(trace_path, "external write applied");
    assert_eq!(
        fixture
            .canonical_memory
            .read()
            .read(CanonicalAddress::new(CanonicalAreaKind::OutputBit, 3))
            .unwrap(),
        CanonicalValue::Bool(true)
    );
    {
        let session_guard = session.read();
        let values = session_guard
            .read(
                &[ReadValueId::from(writable_tag_node.clone())],
                TimestampsToReturn::Both,
                0.0,
            )
            .unwrap();
        assert!(bool_value(&values[0]));
    }
    trace_to(
        trace_path,
        "live getter readback confirmed after external write",
    );

    trace_to(trace_path, "readonly semantic write request:start");
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
    trace_to(trace_path, "readonly semantic write request:ok");

    trace_to(trace_path, "readonly raw write request:start");
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
    trace_to(trace_path, "readonly raw write request:ok");

    trace_to(trace_path, "invalid-type write request:start");
    {
        let session_guard = session.read();
        let statuses = session_guard
            .write(&[write_value(
                data_word_zero_node.clone(),
                Variant::Double(1.5),
            )])
            .unwrap();
        assert_eq!(statuses[0], StatusCode::BadTypeMismatch);
    }
    trace_to(trace_path, "invalid-type write request:ok");
    trace_to(trace_path, "write policy assertions complete");

    trace_to(trace_path, "starting live readback assertions");
    trace_to(trace_path, "simulation write:start");
    {
        let mut memory = fixture.canonical_memory.write();
        memory
            .write(
                CanonicalAddress::new(CanonicalAreaKind::OutputBit, 3),
                CanonicalValue::Bool(false),
                CanonicalWriteSource::Simulation,
            )
            .unwrap();
    }
    trace_to(trace_path, "simulation write:ok");
    {
        let session_guard = session.read();
        let values = session_guard
            .read(
                &[ReadValueId::from(writable_tag_node.clone())],
                TimestampsToReturn::Both,
                0.0,
            )
            .unwrap();
        assert!(!bool_value(&values[0]));
    }
    trace_to(
        trace_path,
        "live getter readback confirmed after simulation write",
    );

    trace_to(trace_path, "starting subscription assertions");
    {
        let session_guard = session.read();
        let subscription_id = session_guard
            .create_subscription(
                100.0,
                30,
                10,
                0,
                0,
                true,
                DataChangeCallback::new(move |_items| {}),
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
    trace_to(trace_path, "subscription created");

    let session_guard = session.write();
    session_guard.disconnect();
    drop(session_guard);
    fixture.server.stop().unwrap();
    trace_to(trace_path, "server stopped");

    let _ = (
        raw_memory_node,
        tags_node,
        semantic_tags_node,
        raw_tags_node,
        data_word_folder,
        status_tag_node,
    );
}
