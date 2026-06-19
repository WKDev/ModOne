import { memo } from 'react';
import { PanelShell } from '../protocol/ProtocolPanelPrimitives';
import type { ProjectConfig, ProjectConfigPatch } from '../../types/project';
import type { ProjectSettingsCategory } from './types';
import {
  ManifestSection,
  NetworkSection,
  ModbusSimulationSection,
  ModbusExposureSection,
  OpcUaSection,
  CanvasSection,
  InfoSection,
} from './sections';

interface ProjectSettingsContentProps {
  /** The currently active category to render */
  activeCategory: ProjectSettingsCategory;
  /** The project configuration to display/edit */
  config: ProjectConfig;
  /** Search filter text for field filtering */
  searchFilter: string;
  /** Callback to apply a partial config patch */
  onPatch: (patch: ProjectConfigPatch) => void;
  /** Whether the project has been modified since last save */
  isModified?: boolean;
  /** Whether the OPC UA server is currently running */
  opcuaRunning?: boolean;
  /** Current project file path */
  projectPath?: string | null;
}

/**
 * Content area container for the project settings sidebar layout.
 *
 * Receives the selected category and renders the appropriate form section.
 * Follows the SettingsPanel pattern where the content area is `flex-1 overflow-auto`.
 */
export const ProjectSettingsContent = memo(function ProjectSettingsContent({
  activeCategory,
  config,
  searchFilter,
  onPatch,
  isModified,
  opcuaRunning,
  projectPath,
}: ProjectSettingsContentProps) {
  const sectionProps = {
    config,
    searchFilter,
    onPatch,
    extra: {
      projectPath,
      opcuaRunning,
      isModified,
    },
  };

  const renderSection = () => {
    switch (activeCategory) {
      case 'manifest':
        return <ManifestSection {...sectionProps} />;
      case 'network':
        return <NetworkSection {...sectionProps} />;
      case 'modbus-simulation':
        return <ModbusSimulationSection {...sectionProps} />;
      case 'modbus-exposure':
        return <ModbusExposureSection {...sectionProps} />;
      case 'opcua':
        return <OpcUaSection {...sectionProps} />;
      case 'canvas':
        return <CanvasSection {...sectionProps} />;
      case 'info':
        return <InfoSection {...sectionProps} />;
      default: {
        // Exhaustive check
        const _exhaustive: never = activeCategory;
        return _exhaustive;
      }
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4">
      <PanelShell>{renderSection()}</PanelShell>
    </div>
  );
});
