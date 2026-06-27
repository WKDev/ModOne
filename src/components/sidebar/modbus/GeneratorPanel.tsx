// 레지스터/코일을 사인파·램프·랜덤 등으로 자동 변동시키는 값 제너레이터 편집 UI
import { useEffect, useState } from 'react';
import { Plus, Trash2, Activity } from 'lucide-react';
import { modbusService } from '../../../services/modbusService';
import { PanelInput, PanelSelect } from '../../protocol/ProtocolPanelPrimitives';
import type { GeneratorConfig, GeneratorTarget, Waveform } from '../../../types/modbus';

const TARGETS: { value: GeneratorTarget; label: string }[] = [
  { value: 'holding', label: 'Holding' },
  { value: 'input', label: 'Input' },
  { value: 'coil', label: 'Coil' },
  { value: 'discrete', label: 'Discrete' },
];

const WAVEFORMS: { value: Waveform; label: string }[] = [
  { value: 'sine', label: 'Sine' },
  { value: 'ramp', label: 'Ramp' },
  { value: 'square', label: 'Square' },
  { value: 'random', label: 'Random' },
  { value: 'counter', label: 'Counter' },
];

function newGenerator(): GeneratorConfig {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    target: 'holding',
    address: 0,
    waveform: 'sine',
    period_ms: 2000,
    min: 0,
    max: 100,
  };
}

function GeneratorRow({
  gen,
  onChange,
  onDelete,
}: {
  gen: GeneratorConfig;
  onChange: (patch: Partial<GeneratorConfig>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={gen.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
          />
          <Activity size={12} className={gen.enabled ? 'text-[var(--color-accent)]' : ''} />
          Enabled
        </label>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg p-1 text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-error)]"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PanelSelect
          value={gen.target}
          onChange={(e) => onChange({ target: e.target.value as GeneratorTarget })}
        >
          {TARGETS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </PanelSelect>
        <PanelInput
          type="number"
          min={0}
          max={65535}
          value={gen.address}
          placeholder="Address"
          onChange={(e) => onChange({ address: clampInt(e.target.value, 0, 65535) })}
        />
        <PanelSelect
          value={gen.waveform}
          onChange={(e) => onChange({ waveform: e.target.value as Waveform })}
        >
          {WAVEFORMS.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </PanelSelect>
        <PanelInput
          type="number"
          min={100}
          step={100}
          value={gen.period_ms}
          onChange={(e) => onChange({ period_ms: clampInt(e.target.value, 100, 600000) })}
        />
        <PanelInput
          type="number"
          value={gen.min}
          onChange={(e) => onChange({ min: Number(e.target.value) || 0 })}
        />
        <PanelInput
          type="number"
          value={gen.max}
          onChange={(e) => onChange({ max: Number(e.target.value) || 0 })}
        />
      </div>
      <div className="flex justify-between px-0.5 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
        <span>addr · period(ms)</span>
        <span>min · max</span>
      </div>
    </div>
  );
}

function clampInt(raw: string, lo: number, hi: number): number {
  const n = Number.parseInt(raw || '0', 10);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

export function GeneratorPanel() {
  const [generators, setGenerators] = useState<GeneratorConfig[]>([]);

  useEffect(() => {
    let active = true;
    modbusService
      .getGenerators()
      .then((list) => {
        if (active) setGenerators(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // 로컬 상태를 갱신하고 백엔드와 동기화한다.
  const persist = (next: GeneratorConfig[]) => {
    setGenerators(next);
    void modbusService.setGenerators(next);
  };

  const addGenerator = () => persist([...generators, newGenerator()]);
  const updateGenerator = (id: string, patch: Partial<GeneratorConfig>) =>
    persist(generators.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const deleteGenerator = (id: string) => persist(generators.filter((g) => g.id !== id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-text-muted)]">{generators.length} configured</span>
        <button
          type="button"
          onClick={addGenerator}
          className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-surface-muted)] px-2 py-1 text-xs text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-hover)]"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
      {generators.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] px-3 py-3 text-sm text-[var(--color-text-muted)]">
          No generators. Add one to animate a register with a waveform.
        </div>
      ) : (
        <div className="space-y-2">
          {generators.map((gen) => (
            <GeneratorRow
              key={gen.id}
              gen={gen}
              onChange={(patch) => updateGenerator(gen.id, patch)}
              onDelete={() => deleteGenerator(gen.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default GeneratorPanel;
