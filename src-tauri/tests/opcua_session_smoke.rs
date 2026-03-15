#![cfg(feature = "opcua-server")]

mod opcua_test_support;

use std::fs;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;

use opcua::client::prelude::IdentityToken;

use opcua_test_support::{
    build_client, connect_session_with_trace_and_timeout, kill_child,
    manual_secure_username_endpoint, normalize_endpoint_base, spawn_self_test_with_env,
    start_secure_test_server, trace_to, wait_for_child_success, wait_for_trace_line, TEST_PASSWORD,
    TEST_USERNAME,
};

fn trace_path_from_env(default_value: &str) -> PathBuf {
    std::env::var("MODONE_OPCUA_TRACE_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(default_value))
}

#[test]
fn secure_server_session_smoke_uses_discovery_and_activates_without_hanging() {
    let server_trace = Path::new("target/opcua_session_smoke_server.trace.log");
    let client_trace = Path::new("target/opcua_session_smoke.trace.log");
    let client_pki_dir = PathBuf::from("target/opcua_session_smoke_client_pki");

    let _ = fs::remove_file(server_trace);
    let _ = fs::remove_file(client_trace);
    let _ = fs::remove_dir_all(&client_pki_dir);
    let _ = build_client(client_pki_dir.clone());
    let trusted_client_cert_path = client_pki_dir.join("own").join("cert.der");

    let mut server = spawn_self_test_with_env(
        "secure_server_session_smoke_server_child",
        &[
            (
                "MODONE_OPCUA_TRACE_PATH",
                server_trace.display().to_string(),
            ),
            ("MODONE_OPCUA_TRUST_CLIENT_CERTS", "1".to_string()),
            (
                "MODONE_OPCUA_TRUSTED_CLIENT_CERT_PATH",
                trusted_client_cert_path.display().to_string(),
            ),
        ],
    );

    let endpoint_line =
        wait_for_trace_line(server_trace, "status endpoint ", Duration::from_secs(15));
    let endpoint = endpoint_line
        .trim_start_matches("status endpoint ")
        .trim()
        .to_string();
    let cert_path_line =
        wait_for_trace_line(server_trace, "server cert path ", Duration::from_secs(15));
    let cert_path = cert_path_line
        .trim_start_matches("server cert path ")
        .trim()
        .to_string();

    let mut client = spawn_self_test_with_env(
        "secure_server_session_smoke_client_child",
        &[
            (
                "MODONE_OPCUA_TRACE_PATH",
                client_trace.display().to_string(),
            ),
            ("MODONE_OPCUA_ENDPOINT", endpoint),
            ("MODONE_OPCUA_SERVER_CERT_PATH", cert_path),
            (
                "MODONE_OPCUA_CLIENT_PKI_DIR",
                client_pki_dir.display().to_string(),
            ),
        ],
    );

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        wait_for_child_success(
            &mut client,
            client_trace,
            Duration::from_secs(30),
            "secure smoke client",
        );
    }));
    kill_child(&mut server);
    if let Err(panic) = result {
        std::panic::resume_unwind(panic);
    }
}

#[test]
#[ignore = "child entrypoint for external server host"]
fn secure_server_session_smoke_server_child() {
    let trace_path = trace_path_from_env("target/opcua_session_smoke_server.trace.log");
    trace_to(&trace_path, "starting secure OPC UA smoke server child");
    let _fixture = start_secure_test_server(&trace_path);

    loop {
        thread::sleep(Duration::from_secs(1));
    }
}

#[test]
#[ignore = "child entrypoint for external client probe"]
fn secure_server_session_smoke_client_child() {
    let trace_path = trace_path_from_env("target/opcua_session_smoke.trace.log");
    let endpoint = std::env::var("MODONE_OPCUA_ENDPOINT")
        .expect("MODONE_OPCUA_ENDPOINT should be provided to client child");
    let server_cert_path = std::env::var("MODONE_OPCUA_SERVER_CERT_PATH")
        .expect("MODONE_OPCUA_SERVER_CERT_PATH should be provided to client child");
    let client_pki_dir = std::env::var("MODONE_OPCUA_CLIENT_PKI_DIR")
        .map(PathBuf::from)
        .expect("MODONE_OPCUA_CLIENT_PKI_DIR should be provided to client child");

    trace_to(&trace_path, "starting secure OPC UA session smoke client");
    trace_to(&trace_path, &format!("status endpoint {endpoint}"));
    trace_to(&trace_path, "constructing manual secure endpoint");

    let endpoint_description =
        manual_secure_username_endpoint(endpoint.as_str(), Path::new(&server_cert_path));
    trace_to(&trace_path, "manual secure endpoint ready");

    assert_eq!(
        normalize_endpoint_base(endpoint_description.endpoint_url.as_ref()),
        normalize_endpoint_base(&endpoint)
    );

    trace_to(&trace_path, "building client");
    let mut client = build_client(client_pki_dir);
    trace_to(&trace_path, "client built");

    let session = connect_session_with_trace_and_timeout(
        &trace_path,
        &mut client,
        endpoint_description,
        IdentityToken::UserName(TEST_USERNAME.to_string(), TEST_PASSWORD.to_string()),
    );
    trace_to(&trace_path, "authenticated session established");

    let session_guard = session.write();
    session_guard.disconnect();
    drop(session_guard);
    trace_to(&trace_path, "client disconnected");
}
