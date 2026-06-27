// 태그의 OPC UA 매핑(데이터타입/바이트오더/접근/스케일링/데드밴드)을 편집·저장하는 폼
// 변경은 서버 재시작 시 주소공간 재빌드로 적용된다.

import { memo, useCallback, useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { tagService } from '../../../../services/tagService';
import {
  defaultDeadband,
  defaultScaling,
  isNumericDataType,
  OPCUA_DATA_TYPES,
  type ByteOrderName,
  type DeadbandKindName,
  type OpcUaDataTypeName,
  type OpcUaMappingConfig,
  type ScalingKindName,
} from '../../../../types/opcuaMapping';

const BYTE_ORDERS: ByteOrderName[] = [
  'BigEndian',
  'LittleEndian',
  'BigEndianWordSwap',
  'LittleEndianWordSwap',
];

const labelCls = 'text-xs text-[var(--color-text-muted)] w-28 shrink-0 pt-1';
const inputCls =
  'text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded px-1.5 py-1 text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]';

/** Labeled control row. */
const Row = memo(function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className={labelCls}>{label}</span>
      <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">{children}</div>
    </div>
  );
});

function wordsForType(t: OpcUaDataTypeName): number {
  return OPCUA_DATA_TYPES.find((d) => d.name === t)?.words ?? 1;
}

interface OpcUaMappingEditorProps {
  tagId: string;
}

/**
 * Editable OPC UA mapping form. Loads the stored config (or a default) on mount,
 * lets the user pick the exposed data type, byte order, access level, and
 * configure raw↔engineering scaling and publish deadband, then persists it.
 */
export const OpcUaMappingEditor = memo(function OpcUaMappingEditor({
  tagId,
}: OpcUaMappingEditorProps) {
  const [config, setConfig] = useState<OpcUaMappingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDirty(false);
    tagService
      .getTagOpcUaMapping(tagId)
      .then((cfg) => {
        if (cancelled) return;
        // Normalize optional sub-configs so the form always has values to bind.
        setConfig({
          ...cfg,
          scaling: cfg.scaling ?? defaultScaling(),
          deadband: cfg.deadband ?? defaultDeadband(),
        });
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tagId]);

  const patch = useCallback((next: Partial<OpcUaMappingConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...next } : prev));
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    try {
      await tagService.setTagOpcUaMapping(tagId, config);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [config, tagId]);

  if (loading || !config) {
    return (
      <div className="flex items-center gap-1.5 py-2 text-xs text-[var(--color-text-muted)]">
        <Loader2 size={12} className="animate-spin" /> 매핑 설정 불러오는 중…
      </div>
    );
  }

  const numeric = isNumericDataType(config.opcuaDataType);
  const multiWord = wordsForType(config.opcuaDataType) > 1;
  const scaling = config.scaling ?? defaultScaling();
  const deadband = config.deadband ?? defaultDeadband();
  const scalingOn = scaling.kind !== 'None';
  const deadbandOn = deadband.kind !== 'None';

  return (
    <div className="space-y-0.5 pt-1">
      <Row label="데이터 타입">
        <select
          className={inputCls}
          value={config.opcuaDataType}
          onChange={(e) => {
            const t = e.target.value as OpcUaDataTypeName;
            patch({ opcuaDataType: t, wordCount: wordsForType(t) });
          }}
        >
          {OPCUA_DATA_TYPES.map((d) => (
            <option key={d.name} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
        {scalingOn && numeric && (
          <span className="text-[10px] text-[var(--color-accent)]">→ Double(eng) 노출</span>
        )}
      </Row>

      <Row label="워드 수">
        <input
          type="number"
          min={1}
          className={`${inputCls} w-16`}
          value={config.wordCount}
          onChange={(e) => patch({ wordCount: Math.max(1, Number(e.target.value) || 1) })}
        />
      </Row>

      {multiWord && (
        <Row label="바이트 순서">
          <select
            className={inputCls}
            value={config.byteOrder}
            onChange={(e) => patch({ byteOrder: e.target.value as ByteOrderName })}
          >
            {BYTE_ORDERS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </Row>
      )}

      <Row label="접근 레벨">
        <select
          className={inputCls}
          value={config.accessLevel}
          onChange={(e) =>
            patch({ accessLevel: e.target.value as OpcUaMappingConfig['accessLevel'] })
          }
        >
          <option value="ReadOnly">ReadOnly</option>
          <option value="ReadWrite">ReadWrite</option>
        </select>
      </Row>

      {/* Scaling */}
      <Row label="스케일링">
        <select
          className={inputCls}
          disabled={!numeric}
          value={scaling.kind}
          onChange={(e) =>
            patch({ scaling: { ...scaling, kind: e.target.value as ScalingKindName } })
          }
        >
          <option value="None">없음</option>
          <option value="Linear">선형</option>
          <option value="SquareRoot">제곱근</option>
        </select>
        {!numeric && <span className="text-[10px] text-[var(--color-text-muted)]">숫자 타입만</span>}
      </Row>
      {scalingOn && numeric && (
        <div className="ml-[120px] grid grid-cols-2 gap-1.5 pb-1">
          <NumField label="raw 하한" value={scaling.rawLow} onChange={(v) => patch({ scaling: { ...scaling, rawLow: v } })} />
          <NumField label="raw 상한" value={scaling.rawHigh} onChange={(v) => patch({ scaling: { ...scaling, rawHigh: v } })} />
          <NumField label="eng 하한" value={scaling.engLow} onChange={(v) => patch({ scaling: { ...scaling, engLow: v } })} />
          <NumField label="eng 상한" value={scaling.engHigh} onChange={(v) => patch({ scaling: { ...scaling, engHigh: v } })} />
          <label className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-secondary)] col-span-2">
            <input
              type="checkbox"
              checked={scaling.clamp}
              onChange={(e) => patch({ scaling: { ...scaling, clamp: e.target.checked } })}
            />
            범위 밖 값 클램프
          </label>
        </div>
      )}

      {/* Deadband */}
      <Row label="데드밴드">
        <select
          className={inputCls}
          disabled={!numeric}
          value={deadband.kind}
          onChange={(e) =>
            patch({ deadband: { ...deadband, kind: e.target.value as DeadbandKindName } })
          }
        >
          <option value="None">없음</option>
          <option value="Absolute">절대값</option>
          <option value="Percent">백분율(%)</option>
        </select>
        {deadbandOn && numeric && (
          <NumField
            label={deadband.kind === 'Percent' ? '%' : '값'}
            value={deadband.value}
            onChange={(v) => patch({ deadband: { ...deadband, value: v } })}
          />
        )}
      </Row>

      <div className="flex items-center gap-2 pt-1.5">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={handleSave}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-[var(--color-accent)] text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          저장
        </button>
        <span className="text-[10px] text-[var(--color-text-muted)] italic">
          변경은 OPC UA 서버 재시작 후 적용됩니다.
        </span>
      </div>
    </div>
  );
});

/** Small inline numeric field with a caption. */
const NumField = memo(function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
      <span className="w-12 shrink-0">{label}</span>
      <input
        type="number"
        className={`${inputCls} w-full`}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  );
});

export default OpcUaMappingEditor;
