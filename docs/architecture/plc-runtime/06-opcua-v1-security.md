# OPC UA v1 Security

## Security Target

The first OPC UA release is not a production enterprise deployment target, but it is not anonymous local debug mode either.

It must implement a basic, non-trivial security posture.

## Required Defaults

- bind to localhost by default
- generate and persist a server certificate locally
- disable anonymous sessions by default
- enable username/password authentication

## Access Control

Per-node access must derive from canonical memory access class and tag metadata:

- readonly canonical bindings -> readonly UA nodes
- internal-only canonical bindings -> not writable through UA
- tag-level restrictions may further reduce write access

## Explicit Deferrals

The following are out of scope for v1:

- enterprise PKI and external CA integration
- role hierarchy and advanced user groups
- alarms/events/methods
- security models that depend on full semantic asset hierarchy

## Drift Rule

If implementation pressure appears, reduce optional comfort features first. Do not silently drop the default security baseline.
