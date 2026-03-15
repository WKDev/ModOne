# OPC UA v1 Security

## Security Target

The first OPC UA release is not a production enterprise deployment target, but it is not anonymous local debug mode either.

It must implement a basic, non-trivial security posture.

## Required Defaults

- bind to localhost by default
- allow external bind only when `network.plc_ip` is explicitly configured and currently assigned
- generate and persist a server certificate locally under app data at `opcua/pki/own/cert.der`
- persist the matching private key under app data at `opcua/pki/private/private.pem`
- reject startup if only one of certificate or private key exists
- expose certificate fingerprint and validity in runtime status
- disable anonymous sessions
- require username/password authentication
- reject blank credentials and reject placeholder credentials such as `modone/modone`
- expose only `Basic256Sha256 + SignAndEncrypt` on the product surface

## Access Control

Per-node access must derive from canonical memory access class and tag metadata:

- readonly canonical bindings -> readonly UA nodes
- internal-only canonical bindings -> not writable through UA
- tag-level restrictions may further reduce write access
- write coercion must be strict: incompatible types return `BadTypeMismatch`, out-of-range integers return `BadOutOfRange`

## Explicit Deferrals

The following are out of scope for v1:

- enterprise PKI and external CA integration
- role hierarchy and advanced user groups
- alarms/events/methods
- security models that depend on full semantic asset hierarchy
- runtime namespace mutation while an OPC UA session is active

## Drift Rule

If implementation pressure appears, reduce optional comfort features first. Do not silently drop the default security baseline.

## Runtime Contracts

- the OPC UA feature must be included in default desktop build paths; a build without the feature must fail explicitly instead of pretending the server started
- `OpcUaStatus.running` means the real server is active, not that a stub object exists
- `OpcUaStatus.endpoint` must include the full endpoint path
- the application namespace index is runtime-owned and must never be hardcoded to `2`
- while the OPC UA server is running, semantic/raw tag creation and deletion are blocked with `namespace frozen during active OPC UA session`
