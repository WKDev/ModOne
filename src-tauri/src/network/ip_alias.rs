//! IP alias (secondary address) management via OS-level commands.
//!
//! On Windows this uses `netsh interface ip add/delete address`.
//! The manager tracks which aliases it has created so they can be
//! cleaned up automatically when the simulation stops.

use std::net::Ipv4Addr;

use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::process::Command;

/// Default subnet mask when none is configured.
const DEFAULT_SUBNET_MASK: &str = "255.255.255.0";

/// IPs that must never be assigned as aliases.
const FORBIDDEN_IPS: &[&str] = &["0.0.0.0", "255.255.255.255"];

#[derive(Debug, Error)]
pub enum IpAliasError {
    #[error("invalid IP address: {0}")]
    InvalidIp(String),
    #[error("invalid subnet mask: {0}")]
    InvalidSubnetMask(String),
    #[error("interface not specified and could not be auto-detected")]
    NoInterface,
    #[error("failed to add IP alias {ip} on {interface}: {reason}")]
    AddFailed {
        ip: String,
        interface: String,
        reason: String,
    },
    #[error("failed to remove IP alias {ip} on {interface}: {reason}")]
    RemoveFailed {
        ip: String,
        interface: String,
        reason: String,
    },
    #[error("failed to list network interfaces: {0}")]
    ListFailed(String),
    #[error("elevated privileges required to manage IP aliases")]
    ElevationRequired,
    #[error("IP alias management is not supported on this platform")]
    UnsupportedPlatform,
    #[error("IP address {0} cannot be used as a PLC alias (reserved/loopback/multicast)")]
    ForbiddenIp(String),
    #[error("IP address {0} is already assigned on this system")]
    AlreadyAssigned(String),
}

/// Information about a network interface.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkInterfaceInfo {
    pub name: String,
    pub status: String,
    pub interface_type: String,
}

/// Tracks a single active IP alias created by the manager.
#[derive(Debug, Clone)]
struct ActiveAlias {
    ip: String,
    interface_name: String,
    subnet_mask: String,
}

/// Manages IP aliases for the PLC simulator.
///
/// Call [`ensure_alias`] before starting protocol servers to assign
/// the PLC IP to a local interface. Call [`cleanup`] (or [`cleanup_alias`])
/// when the simulation stops. The manager also implements [`Drop`]-based
/// best-effort cleanup, but callers should prefer explicit cleanup to
/// get error feedback.
pub struct SimulatorNetworkManager {
    active_aliases: Vec<ActiveAlias>,
}

impl Default for SimulatorNetworkManager {
    fn default() -> Self {
        Self::new()
    }
}

impl SimulatorNetworkManager {
    pub fn new() -> Self {
        Self {
            active_aliases: Vec::new(),
        }
    }

    /// Ensure the given PLC IP is assigned as an alias on the specified interface.
    ///
    /// Returns the IP address that protocol servers should bind to.
    /// If `plc_ip` is `None`, returns `None` (caller should use default binding).
    pub async fn ensure_alias(
        &mut self,
        plc_ip: Option<&str>,
        interface_name: Option<&str>,
        subnet_mask: Option<&str>,
    ) -> Result<Option<String>, IpAliasError> {
        let Some(ip) = plc_ip else {
            return Ok(None);
        };

        let ip = ip.trim();
        if ip.is_empty() {
            return Ok(None);
        }

        // Validate IP format
        let parsed_ip: Ipv4Addr = ip
            .parse()
            .map_err(|_| IpAliasError::InvalidIp(ip.to_string()))?;

        // Reject reserved/dangerous IPs
        if FORBIDDEN_IPS.contains(&ip)
            || parsed_ip.is_loopback()
            || parsed_ip.is_multicast()
            || parsed_ip.is_unspecified()
            || parsed_ip.is_broadcast()
        {
            return Err(IpAliasError::ForbiddenIp(ip.to_string()));
        }

        let subnet = subnet_mask.unwrap_or(DEFAULT_SUBNET_MASK);
        subnet
            .parse::<Ipv4Addr>()
            .map_err(|_| IpAliasError::InvalidSubnetMask(subnet.to_string()))?;

        let iface = match interface_name {
            Some(name) if !name.trim().is_empty() => name.trim().to_string(),
            _ => detect_default_interface().await?,
        };

        // Check if we already manage this alias
        if self
            .active_aliases
            .iter()
            .any(|a| a.ip == ip && a.interface_name == iface)
        {
            return Ok(Some(ip.to_string()));
        }

        // Check if the IP is already assigned on the system (e.g. leftover from crash)
        match is_ip_assigned(ip).await {
            Ok(true) => {
                log::warn!(
                    "IP {} is already assigned on this system — skipping alias add, assuming leftover",
                    ip
                );
                // Track it so we clean it up on stop
                self.active_aliases.push(ActiveAlias {
                    ip: ip.to_string(),
                    interface_name: iface,
                    subnet_mask: subnet.to_string(),
                });
                return Ok(Some(ip.to_string()));
            }
            Ok(false) => {} // Not yet assigned, proceed
            Err(e) => {
                log::debug!("Could not check if IP {} is assigned: {}", ip, e);
                // Proceed anyway — add will fail if truly conflicting
            }
        }

        add_ip_alias(ip, &iface, subnet).await?;

        self.active_aliases.push(ActiveAlias {
            ip: ip.to_string(),
            interface_name: iface,
            subnet_mask: subnet.to_string(),
        });

        log::info!("IP alias {} added for PLC simulation", ip);
        Ok(Some(ip.to_string()))
    }

    /// Remove a specific alias managed by this instance.
    pub async fn cleanup_alias(&mut self, ip: &str) -> Result<(), IpAliasError> {
        let pos = self.active_aliases.iter().position(|a| a.ip == ip);
        if let Some(idx) = pos {
            let alias = self.active_aliases.remove(idx);
            remove_ip_alias(&alias.ip, &alias.interface_name).await?;
            log::info!("IP alias {} removed", alias.ip);
        }
        Ok(())
    }

    /// Remove all active aliases. Returns warnings for any that failed.
    pub async fn cleanup(&mut self) -> Vec<String> {
        let aliases: Vec<ActiveAlias> = self.active_aliases.drain(..).collect();
        let mut warnings = Vec::new();

        for alias in aliases {
            if let Err(e) = remove_ip_alias(&alias.ip, &alias.interface_name).await {
                let msg = format!(
                    "Failed to remove IP alias {} from {}: {}. Manual cleanup: netsh interface ip delete address \"{}\" {}",
                    alias.ip, alias.interface_name, e, alias.interface_name, alias.ip
                );
                log::warn!("{}", msg);
                warnings.push(msg);
            } else {
                log::info!("IP alias {} removed from {}", alias.ip, alias.interface_name);
            }
        }

        warnings
    }

    /// Check whether any aliases are currently managed.
    pub fn has_active_aliases(&self) -> bool {
        !self.active_aliases.is_empty()
    }

    /// List currently active aliases.
    pub fn active_aliases(&self) -> Vec<(String, String)> {
        self.active_aliases
            .iter()
            .map(|a| (a.ip.clone(), a.interface_name.clone()))
            .collect()
    }
}

impl Drop for SimulatorNetworkManager {
    fn drop(&mut self) {
        if self.active_aliases.is_empty() {
            return;
        }

        // Best-effort synchronous cleanup using blocking commands.
        for alias in &self.active_aliases {
            log::info!(
                "Drop cleanup: removing IP alias {} from {}",
                alias.ip,
                alias.interface_name
            );
            let _ = remove_ip_alias_sync(&alias.ip, &alias.interface_name);
        }
    }
}

/// List available network interfaces.
pub async fn list_network_interfaces() -> Result<Vec<NetworkInterfaceInfo>, IpAliasError> {
    #[cfg(target_os = "windows")]
    {
        list_interfaces_windows().await
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err(IpAliasError::UnsupportedPlatform)
    }
}

/// Check if an IP address is currently assigned to any local interface.
pub async fn is_ip_assigned(ip: &str) -> Result<bool, IpAliasError> {
    #[cfg(target_os = "windows")]
    {
        check_ip_assigned_windows(ip).await
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = ip;
        Err(IpAliasError::UnsupportedPlatform)
    }
}

// ============================================================================
// Windows implementation
// ============================================================================

#[cfg(target_os = "windows")]
async fn add_ip_alias(ip: &str, interface_name: &str, subnet_mask: &str) -> Result<(), IpAliasError> {
    let output = Command::new("netsh")
        .args([
            "interface",
            "ip",
            "add",
            "address",
            interface_name,
            ip,
            subnet_mask,
        ])
        .output()
        .await
        .map_err(|e| IpAliasError::AddFailed {
            ip: ip.to_string(),
            interface: interface_name.to_string(),
            reason: e.to_string(),
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let combined = format!("{}{}", stdout.trim(), stderr.trim());

        if combined.contains("requires elevation")
            || combined.contains("elevated")
            || combined.contains("Access is denied")
        {
            return Err(IpAliasError::ElevationRequired);
        }

        return Err(IpAliasError::AddFailed {
            ip: ip.to_string(),
            interface: interface_name.to_string(),
            reason: combined,
        });
    }

    Ok(())
}

#[cfg(target_os = "windows")]
async fn remove_ip_alias(ip: &str, interface_name: &str) -> Result<(), IpAliasError> {
    let output = Command::new("netsh")
        .args([
            "interface",
            "ip",
            "delete",
            "address",
            interface_name,
            ip,
        ])
        .output()
        .await
        .map_err(|e| IpAliasError::RemoveFailed {
            ip: ip.to_string(),
            interface: interface_name.to_string(),
            reason: e.to_string(),
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let combined = format!("{}{}", stdout.trim(), stderr.trim());

        // If the address is already gone, that's fine
        if combined.contains("not found")
            || combined.contains("element not found")
            || combined.contains("not present")
        {
            return Ok(());
        }

        return Err(IpAliasError::RemoveFailed {
            ip: ip.to_string(),
            interface: interface_name.to_string(),
            reason: combined,
        });
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn remove_ip_alias_sync(ip: &str, interface_name: &str) {
    let _ = std::process::Command::new("netsh")
        .args([
            "interface",
            "ip",
            "delete",
            "address",
            interface_name,
            ip,
        ])
        .output();
}

#[cfg(target_os = "windows")]
async fn detect_default_interface() -> Result<String, IpAliasError> {
    let interfaces = list_interfaces_windows().await?;

    // Prefer connected interfaces, excluding loopback
    interfaces
        .into_iter()
        .find(|i| {
            i.status.to_lowercase().contains("connected")
                && !i.name.to_lowercase().contains("loopback")
        })
        .map(|i| i.name)
        .ok_or(IpAliasError::NoInterface)
}

#[cfg(target_os = "windows")]
async fn list_interfaces_windows() -> Result<Vec<NetworkInterfaceInfo>, IpAliasError> {
    let output = Command::new("netsh")
        .args(["interface", "show", "interface"])
        .output()
        .await
        .map_err(|e| IpAliasError::ListFailed(e.to_string()))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(IpAliasError::ListFailed(stderr.to_string()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut interfaces = Vec::new();

    // Parse `netsh interface show interface` output.
    // Format (column-aligned, separated by multiple spaces):
    //   Admin State    State          Type             Interface Name
    //   -------------------------------------------------------------------------
    //   Enabled        Connected      Dedicated        Ethernet
    //   Enabled        Disconnected   Dedicated        Wi-Fi
    //
    // Interface names may contain spaces (e.g. "Local Area Connection"),
    // so we split on whitespace and rejoin from field 3 onward.
    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty()
            || trimmed.starts_with('-')
            || trimmed.starts_with("Admin")
        {
            continue;
        }

        let fields: Vec<&str> = trimmed.split_whitespace().collect();
        if fields.len() >= 4 {
            interfaces.push(NetworkInterfaceInfo {
                name: fields[3..].join(" "),
                status: fields[1].to_string(),
                interface_type: fields[2].to_string(),
            });
        }
    }

    Ok(interfaces)
}

#[cfg(target_os = "windows")]
async fn check_ip_assigned_windows(ip: &str) -> Result<bool, IpAliasError> {
    let output = Command::new("netsh")
        .args(["interface", "ip", "show", "address"])
        .output()
        .await
        .map_err(|e| IpAliasError::ListFailed(e.to_string()))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Match the IP as a whole token, not as a substring.
    // This prevents "10.0.0.1" matching "10.0.0.10".
    for line in stdout.lines() {
        for token in line.split_whitespace() {
            if token == ip {
                return Ok(true);
            }
        }
    }
    Ok(false)
}

// ============================================================================
// Non-Windows stubs
// ============================================================================

#[cfg(not(target_os = "windows"))]
async fn add_ip_alias(_ip: &str, _interface_name: &str, _subnet_mask: &str) -> Result<(), IpAliasError> {
    Err(IpAliasError::UnsupportedPlatform)
}

#[cfg(not(target_os = "windows"))]
async fn remove_ip_alias(_ip: &str, _interface_name: &str) -> Result<(), IpAliasError> {
    Err(IpAliasError::UnsupportedPlatform)
}

#[cfg(not(target_os = "windows"))]
fn remove_ip_alias_sync(_ip: &str, _interface_name: &str) {}

#[cfg(not(target_os = "windows"))]
async fn detect_default_interface() -> Result<String, IpAliasError> {
    Err(IpAliasError::UnsupportedPlatform)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manager_starts_empty() {
        let mgr = SimulatorNetworkManager::new();
        assert!(!mgr.has_active_aliases());
        assert!(mgr.active_aliases().is_empty());
    }

    #[tokio::test]
    async fn ensure_alias_none_returns_none() {
        let mut mgr = SimulatorNetworkManager::new();
        let result = mgr.ensure_alias(None, None, None).await.unwrap();
        assert!(result.is_none());
        assert!(!mgr.has_active_aliases());
    }

    #[tokio::test]
    async fn ensure_alias_empty_string_returns_none() {
        let mut mgr = SimulatorNetworkManager::new();
        let result = mgr.ensure_alias(Some(""), None, None).await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn ensure_alias_invalid_ip_returns_error() {
        let mut mgr = SimulatorNetworkManager::new();
        let result = mgr.ensure_alias(Some("not-an-ip"), None, None).await;
        assert!(matches!(result, Err(IpAliasError::InvalidIp(_))));
    }

    #[tokio::test]
    async fn ensure_alias_invalid_subnet_returns_error() {
        let mut mgr = SimulatorNetworkManager::new();
        let result = mgr
            .ensure_alias(Some("192.168.1.100"), Some("eth0"), Some("bad-mask"))
            .await;
        assert!(matches!(result, Err(IpAliasError::InvalidSubnetMask(_))));
    }

    #[tokio::test]
    async fn ensure_alias_rejects_loopback() {
        let mut mgr = SimulatorNetworkManager::new();
        let result = mgr.ensure_alias(Some("127.0.0.1"), Some("eth0"), None).await;
        assert!(matches!(result, Err(IpAliasError::ForbiddenIp(_))));
    }

    #[tokio::test]
    async fn ensure_alias_rejects_unspecified() {
        let mut mgr = SimulatorNetworkManager::new();
        let result = mgr.ensure_alias(Some("0.0.0.0"), Some("eth0"), None).await;
        assert!(matches!(result, Err(IpAliasError::ForbiddenIp(_))));
    }

    #[tokio::test]
    async fn ensure_alias_rejects_multicast() {
        let mut mgr = SimulatorNetworkManager::new();
        let result = mgr.ensure_alias(Some("224.0.0.1"), Some("eth0"), None).await;
        assert!(matches!(result, Err(IpAliasError::ForbiddenIp(_))));
    }

    #[tokio::test]
    async fn ensure_alias_rejects_broadcast() {
        let mut mgr = SimulatorNetworkManager::new();
        let result = mgr
            .ensure_alias(Some("255.255.255.255"), Some("eth0"), None)
            .await;
        assert!(matches!(result, Err(IpAliasError::ForbiddenIp(_))));
    }

    #[tokio::test]
    async fn cleanup_on_empty_returns_no_warnings() {
        let mut mgr = SimulatorNetworkManager::new();
        let warnings = mgr.cleanup().await;
        assert!(warnings.is_empty());
    }
}
