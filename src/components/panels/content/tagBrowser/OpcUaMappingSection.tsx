import { memo, useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Radio } from 'lucide-react';
import type { TagDefinition } from '../../../../types/tags';
import { useOpcUaStore, selectRunning } from '../../../../stores/opcuaStore';

// ============================================================================
// Helpers
// ============================================================================

/** Map tag data type to OPC UA data type name */
function mapOpcUaDataType(tag: TagDefinition): string {
  const addr = tag.canonicalAddress;
  // Bit-level addresses → Boolean, word-level → UInt16
  if (addr.bitIndex !== undefined) return 'Boolean';
  const bitAreas = [
    'InputBit', 'OutputBit', 'InternalBit', 'RetentiveBit',
    'SpecialBit', 'TimerDoneBit', 'CounterDoneBit', 'SystemBit',
  ];
  if (bitAreas.includes(addr.area)) return 'Boolean';
  return 'UInt16';
}

/** Map tag access to OPC UA access level string */
function mapOpcUaAccessLevel(access: TagDefinition['access']): string {
  return access === 'readwrite' ? 'CurrentRead | CurrentWrite' : 'CurrentRead';
}

/** Build the OPC UA node ID string for a tag */
function buildNodeId(tag: TagDefinition): string {
  // Namespace index 2 is conventional for application-specific nodes
  return `ns=2;s=${tag.tagId}`;
}

/** Build the browse path in the OPC UA address space */
function buildBrowsePath(tag: TagDefinition): string {
  const root = 'Objects/';
  if (tag.folderPath) {
    return root + tag.folderPath.replace(/\./g, '/') + '/' + tag.displayName;
  }
  return root + tag.displayName;
}

// ============================================================================
// Sub-components
// ============================================================================

/** Read-only property row for OPC UA mapping info */
const MappingRow = memo(function MappingRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-xs text-[var(--color-text-muted)] w-28 shrink-0 pt-0.5">
        {label}
      </span>
      <span
        className={`text-xs text-[var(--color-text-primary)] break-all ${
          mono ? 'font-mono bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 rounded' : ''
        }`}
      >
        {value}
      </span>
    </div>
  );
});

/** Badge for status indicators */
const StatusBadge = memo(function StatusBadge({
  active,
  activeText,
  inactiveText,
}: {
  active: boolean;
  activeText: string;
  inactiveText: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
        active
          ? 'bg-green-500/20 text-green-300'
          : 'bg-gray-500/20 text-gray-300'
      }`}
    >
      {active ? activeText : inactiveText}
    </span>
  );
});

// ============================================================================
// OpcUaMappingSection
// ============================================================================

interface OpcUaMappingSectionProps {
  tag: TagDefinition;
}

/**
 * Collapsible OPC UA Mapping section for the Tag Detail Panel.
 *
 * Shows how the selected tag is exposed in the OPC UA address space:
 * - Node ID, Browse Name, Namespace
 * - Address Space browse path (derived from folderPath)
 * - Data type mapping (PLC type → OPC UA type)
 * - Access level mapping
 * - Server publishing status
 */
export const OpcUaMappingSection = memo(function OpcUaMappingSection({
  tag,
}: OpcUaMappingSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isRunning = useOpcUaStore(selectRunning);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const nodeId = buildNodeId(tag);
  const browseName = tag.displayName;
  const browsePath = buildBrowsePath(tag);
  const dataType = mapOpcUaDataType(tag);
  const accessLevel = mapOpcUaAccessLevel(tag.access);
  const namespaceIndex = '2';

  return (
    <div className="border-t border-[var(--color-border)]">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center gap-1.5 px-3 py-2 transition-colors hover:bg-[var(--color-bg-secondary)]"
      >
        {isExpanded ? (
          <ChevronDown size={12} className="text-[var(--color-text-muted)]" />
        ) : (
          <ChevronRight size={12} className="text-[var(--color-text-muted)]" />
        )}
        <Radio size={12} className="text-[var(--color-accent)]" />
        <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
          OPC UA 매핑
        </span>
        <span className="ml-auto">
          <StatusBadge
            active={isRunning}
            activeText="게시 중"
            inactiveText="미게시"
          />
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-0.5">
          {/* Node ID */}
          <MappingRow label="노드 ID" value={nodeId} mono />

          {/* Browse Name */}
          <MappingRow label="탐색 이름" value={browseName} />

          {/* Namespace Index */}
          <MappingRow label="네임스페이스" value={`ns=${namespaceIndex}`} mono />

          {/* Browse Path */}
          <MappingRow label="탐색 경로" value={browsePath} mono />

          {/* OPC UA Data Type */}
          <MappingRow label="데이터 타입" value={dataType} />

          {/* Access Level */}
          <MappingRow label="접근 레벨" value={accessLevel} />

          {/* Server status hint */}
          {!isRunning && (
            <div className="mt-2 text-[10px] text-[var(--color-text-muted)] italic bg-[var(--color-bg-tertiary)] rounded px-2 py-1.5">
              OPC UA 서버가 실행되지 않고 있습니다. 서버 시작 후 클라이언트에서 이 노드에 접근할 수 있습니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default OpcUaMappingSection;
