#![cfg(feature = "opcua-server")]

#![allow(dead_code)]

use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::{mpsc, Arc};
use std::thread;
use std::time::Duration;

use app_lib::modbus::ProtocolAdapter;
use app_lib::opcua::{OpcUaAdapter, OpcUaConfig, OpcUaMemory, OpcUaServer, OpcUaStatus};
use app_lib::plc_runtime::{
    resolve_vendor_profile, CanonicalAddress, CanonicalAreaKind, CanonicalMemory, CanonicalValue,
    CanonicalWriteSource,
};
use app_lib::project::{PlcHardwareTopology, PlcManufacturer, PlcSettings};
use app_lib::sim::tag_registry::TagRegistry;
use app_lib::sim::types::{RegisterTagRequest, RuntimeBinding, TagAccessLevel};
use opcua::client::prelude::{Client, ClientBuilder, IdentityToken, Session, SessionService};
use opcua::crypto::SecurityPolicy;
use opcua::types::{
    ByteString, EndpointDescription, MessageSecurityMode, UAString, UserTokenPolicy, UserTokenType,
};
use parking_lot::RwLock;
use tempfile::{tempdir, TempDir};

pub const TEST_USERNAME: &str = "secure-user";
pub const TEST_PASSWORD: &str = "secure-pass";

pub struct TestServerFixture {
    _temp: TempDir,
    _runtime: tokio::runtime::Runtime,
    pub canonical_memory: Arc<RwLock<CanonicalMemory>>,
    pub adapter: OpcUaAdapter,
    pub server: Arc<OpcUaServer>,
    pub status: OpcUaStatus,
    pub username: String,
    pub password: String,
    pub client_pki_dir: PathBuf,
    pub server_certificate_path: PathBuf,
}

enum SessionConnectEvent {
    Stage(&'static str),
    Done(Result<(), String>),
}

pub fn reset_trace(trace_path: &Path) {
    let _ = fs::remove_file(trace_path);
}

pub fn trace_to(trace_path: &Path, message: &str) {
    let mut stderr = io::stderr();
    let _ = writeln!(stderr, "{message}");
    let _ = stderr.flush();
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(trace_path)
    {
        let _ = writeln!(file, "{message}");
        let _ = file.flush();
    }
}

pub fn run_self_test_with_timeout(child_test_name: &str, trace_path: &Path, timeout: Duration) {
    reset_trace(trace_path);

    let current_exe = std::env::current_exe().expect("current test binary path should resolve");
    let mut child = Command::new(current_exe)
        .arg("--ignored")
        .arg("--exact")
        .arg(child_test_name)
        .spawn()
        .expect("child test process should spawn");

    let started = std::time::Instant::now();
    loop {
        if let Some(status) = child.try_wait().expect("child test should be waitable") {
            if status.success() {
                return;
            }

            let trace = fs::read_to_string(trace_path).unwrap_or_default();
            panic!("child test '{child_test_name}' failed.\nTrace:\n{trace}");
        }

        if started.elapsed() >= timeout {
            let _ = child.kill();
            let _ = child.wait();
            let trace = fs::read_to_string(trace_path).unwrap_or_default();
            panic!(
                "child test '{child_test_name}' timed out after {}s.\nTrace:\n{trace}",
                timeout.as_secs()
            );
        }

        thread::sleep(Duration::from_millis(200));
    }
}

pub fn spawn_self_test_with_env(child_test_name: &str, envs: &[(&str, String)]) -> Child {
    let current_exe = std::env::current_exe().expect("current test binary path should resolve");
    let mut command = Command::new(current_exe);
    command.arg("--ignored").arg("--exact").arg(child_test_name);
    for (key, value) in envs {
        command.env(key, value);
    }
    command
        .spawn()
        .unwrap_or_else(|err| panic!("child test process '{child_test_name}' should spawn: {err}"))
}

pub fn wait_for_child_success(
    child: &mut Child,
    trace_path: &Path,
    timeout: Duration,
    label: &str,
) {
    let started = std::time::Instant::now();
    loop {
        if let Some(status) = child.try_wait().expect("child test should be waitable") {
            if status.success() {
                return;
            }

            let trace = fs::read_to_string(trace_path).unwrap_or_default();
            panic!("{label} failed.\nTrace:\n{trace}");
        }

        if started.elapsed() >= timeout {
            let _ = child.kill();
            let _ = child.wait();
            let trace = fs::read_to_string(trace_path).unwrap_or_default();
            panic!(
                "{label} timed out after {}s.\nTrace:\n{trace}",
                timeout.as_secs()
            );
        }

        thread::sleep(Duration::from_millis(200));
    }
}

pub fn kill_child(child: &mut Child) {
    let _ = child.kill();
    let _ = child.wait();
}

pub fn wait_for_trace_line(trace_path: &Path, pattern: &str, timeout: Duration) -> String {
    let started = std::time::Instant::now();
    loop {
        let trace = fs::read_to_string(trace_path).unwrap_or_default();
        if let Some(line) = trace.lines().find(|line| line.starts_with(pattern)) {
            return line.to_string();
        }

        if started.elapsed() >= timeout {
            panic!("timed out waiting for trace line '{pattern}'.\nTrace:\n{trace}");
        }

        thread::sleep(Duration::from_millis(200));
    }
}

pub fn normalize_endpoint_base(endpoint: &str) -> String {
    endpoint.trim_end_matches('/').to_string()
}

pub fn discovery_endpoint_url(status: &OpcUaStatus) -> String {
    format!("{}/discovery", normalize_endpoint_base(&status.endpoint))
}

pub fn manual_secure_username_endpoint(
    endpoint_url: &str,
    server_certificate_path: &Path,
) -> EndpointDescription {
    let mut endpoint = EndpointDescription::from((
        endpoint_url,
        SecurityPolicy::Basic256Sha256.to_str(),
        MessageSecurityMode::SignAndEncrypt,
        vec![UserTokenPolicy {
            policy_id: UAString::from("userpass_rsa_oaep"),
            token_type: UserTokenType::UserName,
            issued_token_type: UAString::null(),
            issuer_endpoint_url: UAString::null(),
            security_policy_uri: UAString::null(),
        }],
    ));
    endpoint.server_certificate =
        ByteString::from(fs::read(server_certificate_path).unwrap_or_else(|err| {
            panic!(
                "failed to read server certificate at {}: {err}",
                server_certificate_path.display()
            )
        }));
    endpoint
}

pub fn build_client(pki_dir: PathBuf) -> Client {
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

pub fn discover_secure_username_endpoint(
    client_pki_dir: PathBuf,
    endpoint_url: &str,
) -> EndpointDescription {
    let endpoint_url = normalize_endpoint_base(endpoint_url);
    let endpoint_url_for_worker = endpoint_url.clone();
    let (tx, rx) = mpsc::channel();

    thread::spawn(move || {
        let client = build_client(client_pki_dir);
        let result = client
            .get_server_endpoints_from_url(endpoint_url_for_worker.clone())
            .map_err(|status| {
                format!(
                    "failed to query server discovery endpoints from {endpoint_url_for_worker}: {status}"
                )
            })
            .and_then(|endpoints| {
                endpoints
                    .into_iter()
                    .filter(|endpoint| {
                        endpoint.security_policy_uri.as_ref()
                            == SecurityPolicy::Basic256Sha256.to_str()
                            && endpoint.security_mode == MessageSecurityMode::SignAndEncrypt
                            && endpoint
                                .user_identity_tokens
                                .iter()
                                .flat_map(|policies| policies.iter())
                                .any(|policy| policy.token_type == UserTokenType::UserName)
                    })
                    .max_by_key(|endpoint| endpoint.security_level)
                    .ok_or_else(|| {
                        format!(
                            "server discovery did not advertise a Basic256Sha256 SignAndEncrypt username endpoint for {endpoint_url_for_worker}"
                        )
                    })
            });

        let _ = tx.send(result);
    });

    match rx.recv_timeout(Duration::from_secs(5)) {
        Ok(Ok(endpoint)) => endpoint,
        Ok(Err(err)) => panic!("{err}"),
        Err(mpsc::RecvTimeoutError::Timeout) => {
            panic!("secure endpoint discovery timed out for {endpoint_url}")
        }
        Err(mpsc::RecvTimeoutError::Disconnected) => {
            panic!("secure endpoint discovery worker disconnected for {endpoint_url}")
        }
    }
}

pub fn connect_session_with_trace_and_timeout(
    trace_path: &Path,
    client: &mut Client,
    endpoint: EndpointDescription,
    identity: IdentityToken,
) -> Arc<RwLock<Session>> {
    trace_to(trace_path, "creating session from discovered endpoint");
    let session = client
        .new_session_from_info((endpoint, identity))
        .unwrap_or_else(|err| panic!("failed to create session from discovered endpoint: {err}"));
    let worker_session = Arc::clone(&session);
    let worker_trace_path = trace_path.to_path_buf();
    let (tx, rx) = mpsc::channel();

    thread::spawn(move || {
        let send_stage = |stage, tx: &mpsc::Sender<SessionConnectEvent>, trace_path: &Path| {
            trace_to(trace_path, stage);
            let _ = tx.send(SessionConnectEvent::Stage(stage));
        };

        send_stage("connect:start", &tx, &worker_trace_path);
        let result = (|| -> Result<(), String> {
            let session_guard = worker_session.write();

            session_guard
                .connect()
                .map_err(|status| format!("connect failed: {status}"))?;
            send_stage("connect:ok", &tx, &worker_trace_path);

            send_stage("create_session:start", &tx, &worker_trace_path);
            session_guard
                .create_session()
                .map_err(|status| format!("create_session failed: {status}"))?;
            send_stage("create_session:ok", &tx, &worker_trace_path);

            send_stage("activate_session:start", &tx, &worker_trace_path);
            session_guard
                .activate_session()
                .map_err(|status| format!("activate_session failed: {status}"))?;
            send_stage("activate_session:ok", &tx, &worker_trace_path);

            Ok(())
        })();

        let _ = tx.send(SessionConnectEvent::Done(result));
    });

    let mut last_stage = "session worker queued";
    loop {
        match rx.recv_timeout(Duration::from_secs(5)) {
            Ok(SessionConnectEvent::Stage(stage)) => {
                last_stage = stage;
            }
            Ok(SessionConnectEvent::Done(Ok(()))) => {
                trace_to(trace_path, "session activation complete");
                return session;
            }
            Ok(SessionConnectEvent::Done(Err(err))) => {
                panic!("secure session setup failed after {last_stage}: {err}");
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                panic!("secure session setup timed out during {last_stage}");
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                panic!("secure session worker disconnected during {last_stage}");
            }
        }
    }
}

pub fn start_secure_test_server(trace_path: &Path) -> TestServerFixture {
    let settings = PlcSettings {
        manufacturer: PlcManufacturer::LS,
        model: "XGK".to_string(),
        scan_time_ms: 10,
        hardware_topology: PlcHardwareTopology::default(),
    };
    let profile = resolve_vendor_profile(&settings).expect("vendor profile should resolve");
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

    let temp = tempdir().expect("temporary directory should be created");
    let listener = TcpListener::bind("127.0.0.1:0").expect("free port should be available");
    let port = listener.local_addr().unwrap().port();
    drop(listener);

    let server_pki_dir = temp.path().join("server-pki");
    let username = TEST_USERNAME.to_string();
    let password = TEST_PASSWORD.to_string();
    let config = OpcUaConfig {
        bind_address: "127.0.0.1".to_string(),
        port,
        server_name: "ModOne OPC UA Test".to_string(),
        pki_dir: server_pki_dir.clone(),
        certificate_path: "own/cert.der".into(),
        private_key_path: "private/private.pem".into(),
        username: Some(username.clone()),
        password: Some(password.clone()),
    };

    if let Ok(trusted_client_cert_path) = std::env::var("MODONE_OPCUA_TRUSTED_CLIENT_CERT_PATH") {
        let trusted_client_cert_path = PathBuf::from(trusted_client_cert_path);
        let trusted_certs_dir = server_pki_dir.join("trusted");
        fs::create_dir_all(&trusted_certs_dir)
            .expect("trusted cert directory should be created for test server");
        let trusted_cert_target = trusted_certs_dir.join(
            trusted_client_cert_path
                .file_name()
                .expect("trusted client cert should have a file name"),
        );
        fs::copy(&trusted_client_cert_path, &trusted_cert_target).unwrap_or_else(|err| {
            panic!(
                "failed to copy trusted client cert from {} to {}: {err}",
                trusted_client_cert_path.display(),
                trusted_cert_target.display()
            )
        });
        trace_to(
            trace_path,
            &format!("trusted client cert {}", trusted_cert_target.display()),
        );
    }

    let opcua_memory = Arc::new(OpcUaMemory::new());
    let server = Arc::new(OpcUaServer::new(config, Arc::clone(&opcua_memory)));
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .worker_threads(2)
        .build()
        .expect("tokio runtime should build");

    trace_to(trace_path, "runtime building complete");
    {
        let _runtime_guard = runtime.enter();
        trace_to(trace_path, "starting server");
        server
            .start(
                &canonical_memory,
                profile.as_ref(),
                &settings,
                &tag_registry,
            )
            .expect("server should start");
        trace_to(trace_path, "server start returned");
    }

    for _ in 0..50 {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            break;
        }
        thread::sleep(Duration::from_millis(100));
    }
    trace_to(trace_path, "listener ready");

    let adapter = OpcUaAdapter::new(
        Arc::clone(&canonical_memory),
        Arc::clone(&opcua_memory),
        Arc::clone(&server),
    );
    adapter
        .publish_runtime_state()
        .expect("initial runtime publish should succeed");
    trace_to(trace_path, "initial publish complete");

    let status = server.status();
    trace_to(trace_path, &format!("status endpoint {}", status.endpoint));
    let server_certificate_path = temp.path().join("server-pki").join("own").join("cert.der");
    trace_to(
        trace_path,
        &format!("server cert path {}", server_certificate_path.display()),
    );

    TestServerFixture {
        client_pki_dir: temp.path().join("client-good"),
        canonical_memory,
        adapter,
        server,
        status,
        username,
        password,
        server_certificate_path,
        _temp: temp,
        _runtime: runtime,
    }
}
