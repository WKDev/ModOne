//! Network management for PLC simulator.
//!
//! Provides IP alias management so that the simulated PLC can appear
//! on the network with a specific IP address, enabling HMI/SCADA
//! connections without reconfiguration.

mod ip_alias;

pub use ip_alias::{
    is_ip_assigned, list_network_interfaces, IpAliasError, NetworkInterfaceInfo,
    SimulatorNetworkManager,
};
