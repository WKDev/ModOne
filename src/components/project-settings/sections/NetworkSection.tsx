import { memo } from 'react';
import {
  PanelField,
  PanelInput,
  PanelSection,
} from '../../protocol/ProtocolPanelPrimitives';
import { DEFAULT_PROJECT_CONFIG } from '../../../types/project';
import type { CategorySectionProps } from '../types';

export const NetworkSection = memo(function NetworkSection({
  config,
  searchFilter,
  onPatch,
}: CategorySectionProps) {
  const filter = searchFilter.toLowerCase();
  const isVisible = (keywords: string[]) => {
    if (!filter) return true;
    return keywords.some((kw) => kw.toLowerCase().includes(filter));
  };

  const network = config.network ?? DEFAULT_PROJECT_CONFIG.network!;

  const patchNetwork = (patch: Partial<typeof network>) =>
    onPatch({ network: { ...network, ...patch } });

  if (!isVisible(['network', 'ip', 'interface', 'subnet', 'mask', 'bind'])) {
    return null;
  }

  return (
    <PanelSection
      title="Network"
      description="Bind simulated PLC services to a concrete IP/interface when commissioning against external clients."
    >
      <div className="grid gap-3 md:grid-cols-3">
        <PanelField label="PLC IP" hint="Leave empty to bind locally.">
          <PanelInput
            placeholder="127.0.0.1"
            value={network.plc_ip ?? ''}
            onChange={(e) =>
              patchNetwork({ plc_ip: e.target.value.trim() ? e.target.value : null })
            }
          />
        </PanelField>
        <PanelField label="Interface Name">
          <PanelInput
            placeholder="Loopback"
            value={network.interface_name ?? ''}
            onChange={(e) =>
              patchNetwork({
                interface_name: e.target.value.trim() ? e.target.value : null,
              })
            }
          />
        </PanelField>
        <PanelField label="Subnet Mask">
          <PanelInput
            placeholder="255.255.255.0"
            value={network.subnet_mask ?? ''}
            onChange={(e) =>
              patchNetwork({
                subnet_mask: e.target.value.trim() ? e.target.value : null,
              })
            }
          />
        </PanelField>
      </div>
    </PanelSection>
  );
});
