import { memo } from 'react';
import {
  PanelField,
  PanelInput,
  PanelSection,
  PanelSelect,
  StatusBadge,
} from '../../protocol/ProtocolPanelPrimitives';
import { PlcManufacturer } from '../../../types/project';
import type { CategorySectionProps } from '../types';

export const ManifestSection = memo(function ManifestSection({
  config,
  searchFilter,
  onPatch,
  extra,
}: CategorySectionProps) {
  const filter = searchFilter.toLowerCase();
  const isVisible = (keywords: string[]) => {
    if (!filter) return true;
    return keywords.some((kw) => kw.toLowerCase().includes(filter));
  };

  const patchProject = (patch: Partial<typeof config.project>) =>
    onPatch({ project: { ...config.project, ...patch } });

  const patchPlc = (patch: Partial<typeof config.plc>) =>
    onPatch({ plc: { ...config.plc, ...patch } });

  return (
    <PanelSection
      title="Manifest"
      description="`.mop` manifest is the source of truth for project identity and protocol configuration."
      actions={
        <StatusBadge tone={extra?.isModified ? 'warning' : 'success'}>
          {extra?.isModified ? 'Unsaved' : 'Synced'}
        </StatusBadge>
      }
    >
      {isVisible(['project', 'name', 'description']) && (
        <div className="grid gap-3 md:grid-cols-2">
          <PanelField label="Project Name">
            <PanelInput
              value={config.project.name}
              onChange={(e) => patchProject({ name: e.target.value })}
            />
          </PanelField>
          <PanelField label="Description">
            <PanelInput
              value={config.project.description}
              onChange={(e) => patchProject({ description: e.target.value })}
            />
          </PanelField>
        </div>
      )}
      {isVisible(['manufacturer', 'model', 'scan', 'plc']) && (
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
                  scan_time_ms: Math.max(1, Number.parseInt(e.target.value || '1', 10)),
                })
              }
            />
          </PanelField>
        </div>
      )}
    </PanelSection>
  );
});
