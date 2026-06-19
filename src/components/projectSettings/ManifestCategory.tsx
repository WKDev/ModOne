import { memo } from 'react';
import {
  PanelField,
  PanelInput,
  PanelSection,
  PanelSelect,
  StatusBadge,
} from '../protocol/ProtocolPanelPrimitives';
import type { PlcManufacturer, ProjectConfig, ProjectConfigPatch } from '../../types/project';

interface ValidationErrors {
  [key: string]: string;
}

interface ManifestCategoryProps {
  config: ProjectConfig;
  isModified: boolean;
  onPatch: (patch: ProjectConfigPatch) => void;
  errors: ValidationErrors;
  searchFilter?: string;
}

/**
 * Manifest category for the Project Settings panel.
 *
 * Renders project identity and core PLC fields that were originally
 * grouped in the "Manifest" section: Project Name, Description,
 * Manufacturer, Model, and Scan Time (ms).
 */
export const ManifestCategory = memo(function ManifestCategory({
  config,
  isModified,
  onPatch,
  errors,
  searchFilter = '',
}: ManifestCategoryProps) {
  const filter = searchFilter.toLowerCase();

  const isVisible = (keywords: string[]) => {
    if (!filter) return true;
    return keywords.some((kw) => kw.toLowerCase().includes(filter));
  };

  const fieldError = (key: string) =>
    errors[key] ? (
      <span className="text-xs text-[var(--color-error)]">{errors[key]}</span>
    ) : null;

  const patchProject = (patch: Partial<typeof config.project>) =>
    onPatch({ project: { ...config.project, ...patch } });

  const patchPlc = (patch: Partial<typeof config.plc>) =>
    onPatch({ plc: { ...config.plc, ...patch } });

  return (
    <PanelSection
      title="Manifest"
      description="`.mop` manifest is the source of truth for project identity and protocol configuration."
      actions={
        <StatusBadge tone={isModified ? 'warning' : 'success'}>
          {isModified ? 'Unsaved' : 'Synced'}
        </StatusBadge>
      }
    >
      {isVisible(['project', 'name', 'description', '이름', '설명', 'manifest']) && (
        <div className="grid gap-3 md:grid-cols-2">
          <PanelField label="Project Name">
            <PanelInput
              value={config.project.name}
              onChange={(e) => patchProject({ name: e.target.value })}
            />
            {fieldError('project.name')}
          </PanelField>
          <PanelField label="Description">
            <PanelInput
              value={config.project.description}
              onChange={(e) => patchProject({ description: e.target.value })}
            />
          </PanelField>
        </div>
      )}
      {isVisible(['manufacturer', 'model', 'scan', 'plc', '제조사', '모델', '스캔', 'manifest']) && (
        <div className="grid gap-3 md:grid-cols-3">
          <PanelField label="Manufacturer">
            <PanelSelect
              value={config.plc.manufacturer}
              onChange={(e) =>
                patchPlc({ manufacturer: e.target.value as PlcManufacturer })
              }
            >
              <option value="LS">LS Electric</option>
              <option value="Mitsubishi">Mitsubishi</option>
              <option value="Siemens">Siemens</option>
            </PanelSelect>
          </PanelField>
          <PanelField label="Model">
            <PanelInput
              value={config.plc.model}
              onChange={(e) => patchPlc({ model: e.target.value })}
            />
          </PanelField>
          <PanelField label="Scan Time (ms)">
            <PanelInput
              type="number"
              min={1}
              value={config.plc.scan_time_ms}
              onChange={(e) =>
                patchPlc({
                  scan_time_ms: Math.max(
                    1,
                    parseInt(e.target.value || '1', 10)
                  ),
                })
              }
            />
            {fieldError('plc.scan_time_ms')}
          </PanelField>
        </div>
      )}
      <div className="mt-3 text-xs text-[var(--color-text-muted)]">
        <span>Created: {new Date(config.project.created_at).toLocaleString()}</span>
        <span className="mx-2">|</span>
        <span>Updated: {new Date(config.project.updated_at).toLocaleString()}</span>
      </div>
    </PanelSection>
  );
});

export default ManifestCategory;
