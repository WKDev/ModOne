// Re-export unified OPC UA panel as OpcUaPanel for backward compatibility.
// The original configuration content has been moved to OpcUaConfigurationTab
// within the unified panel that now includes Configuration, Sessions, and Audit Log sub-tabs.
export { OpcUaUnifiedPanel as OpcUaPanel } from './opcua/OpcUaUnifiedPanel';
