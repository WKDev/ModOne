// 비주얼 스테이트별 애니메이션(회전/페이드/깜빡임/이동)을 편집하는 패널
import type { SymbolAnimationSpec, SymbolAnimationType } from '../../types/symbol';
import { Plus, Trash2 } from 'lucide-react';

const ANIM_TYPE_OPTIONS: Array<{ value: SymbolAnimationType; label: string }> = [
  { value: 'rotate', label: 'Rotate' },
  { value: 'fade-in', label: 'Fade in' },
  { value: 'fade-out', label: 'Fade out' },
  { value: 'blink', label: 'Blink' },
  { value: 'move', label: 'Move' },
];

interface AnimationsPanelProps {
  /** Visual state names the animation can be attached to. */
  stateNames: string[];
  /** Graphic primitive ids (with optional labels) available as rotation targets. */
  graphics: Array<{ id: string; label?: string }>;
  /** Current animations map (state → specs). */
  animations: Record<string, SymbolAnimationSpec[]>;
  onChange: (next: Record<string, SymbolAnimationSpec[]>) => void;
}

interface FlatRow {
  state: string;
  index: number;
  spec: SymbolAnimationSpec;
}

function flatten(animations: Record<string, SymbolAnimationSpec[]>): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const [state, specs] of Object.entries(animations)) {
    specs.forEach((spec, index) => rows.push({ state, index, spec }));
  }
  return rows;
}

const inputClass =
  'w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500';

export function AnimationsPanel({ stateNames, graphics, animations, onChange }: AnimationsPanelProps) {
  const rows = flatten(animations);
  const defaultState = stateNames[0];

  const updateRow = (state: string, index: number, patch: Partial<SymbolAnimationSpec>, newState?: string) => {
    const next: Record<string, SymbolAnimationSpec[]> = {};
    for (const [s, specs] of Object.entries(animations)) next[s] = [...specs];
    const moved = newState && newState !== state;
    const current = { ...next[state][index], ...patch };
    if (moved) {
      next[state].splice(index, 1);
      if (next[state].length === 0) delete next[state];
      next[newState!] = [...(next[newState!] ?? []), current];
    } else {
      next[state][index] = current;
    }
    onChange(next);
  };

  const removeRow = (state: string, index: number) => {
    const next: Record<string, SymbolAnimationSpec[]> = {};
    for (const [s, specs] of Object.entries(animations)) next[s] = [...specs];
    next[state].splice(index, 1);
    if (next[state].length === 0) delete next[state];
    onChange(next);
  };

  const addRow = () => {
    if (!defaultState || graphics.length === 0) return;
    const next: Record<string, SymbolAnimationSpec[]> = {};
    for (const [s, specs] of Object.entries(animations)) next[s] = [...specs];
    const spec: SymbolAnimationSpec = { type: 'rotate', target: graphics[0].id, speed: 120 };
    next[defaultState] = [...(next[defaultState] ?? []), spec];
    onChange(next);
  };

  if (stateNames.length === 0) {
    return (
      <p className="px-4 py-2 text-[11px] text-neutral-500">
        먼저 Visual State를 추가하면 그 상태에서 재생할 회전 애니메이션을 붙일 수 있다.
      </p>
    );
  }

  return (
    <div className="px-4 py-2 space-y-2">
      <p className="text-[10px] text-neutral-500">
        지정한 Visual State가 활성일 때 대상 도형에 애니메이션을 재생한다. Preview 모드와 배치된 캔버스의 시뮬레이션에서 모두 재생된다.
      </p>

      {rows.length === 0 && (
        <p className="text-[11px] text-neutral-500">아직 애니메이션이 없다.</p>
      )}

      {rows.map((row) => (
        <div
          key={`${row.state}-${row.index}`}
          className="flex flex-wrap items-end gap-1.5 border-b border-neutral-800/60 pb-2"
        >
          <label className="flex-1 min-w-[80px]">
            <span className="block text-[9px] uppercase tracking-wider text-neutral-500">State</span>
            <select
              value={row.state}
              onChange={(e) => updateRow(row.state, row.index, {}, e.target.value)}
              className={inputClass}
            >
              {stateNames.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex-1 min-w-[80px]">
            <span className="block text-[9px] uppercase tracking-wider text-neutral-500">Target</span>
            <select
              value={row.spec.target}
              onChange={(e) => updateRow(row.state, row.index, { target: e.target.value })}
              className={inputClass}
            >
              {graphics.map((g) => (
                <option key={g.id} value={g.id}>{g.label || g.id.slice(0, 8)}</option>
              ))}
            </select>
          </label>
          <label className="flex-1 min-w-[80px]">
            <span className="block text-[9px] uppercase tracking-wider text-neutral-500">Type</span>
            <select
              value={row.spec.type}
              onChange={(e) => updateRow(row.state, row.index, { type: e.target.value as SymbolAnimationType })}
              className={inputClass}
            >
              {ANIM_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          {row.spec.type === 'rotate' && (
            <label className="w-16">
              <span className="block text-[9px] uppercase tracking-wider text-neutral-500">°/s</span>
              <input
                type="number"
                value={row.spec.speed ?? 120}
                onChange={(e) => updateRow(row.state, row.index, { speed: Number(e.target.value) })}
                className={inputClass}
              />
            </label>
          )}

          {row.spec.type === 'move' && (
            <>
              <label className="w-14">
                <span className="block text-[9px] uppercase tracking-wider text-neutral-500">dx</span>
                <input
                  type="number"
                  value={row.spec.dx ?? 8}
                  onChange={(e) => updateRow(row.state, row.index, { dx: Number(e.target.value) })}
                  className={inputClass}
                />
              </label>
              <label className="w-14">
                <span className="block text-[9px] uppercase tracking-wider text-neutral-500">dy</span>
                <input
                  type="number"
                  value={row.spec.dy ?? 0}
                  onChange={(e) => updateRow(row.state, row.index, { dy: Number(e.target.value) })}
                  className={inputClass}
                />
              </label>
            </>
          )}

          {row.spec.type !== 'rotate' && (
            <label className="w-20">
              <span className="block text-[9px] uppercase tracking-wider text-neutral-500">ms</span>
              <input
                type="number"
                value={row.spec.duration ?? 1000}
                onChange={(e) => updateRow(row.state, row.index, { duration: Number(e.target.value) })}
                className={inputClass}
              />
            </label>
          )}

          <button
            type="button"
            onClick={() => removeRow(row.state, row.index)}
            className="p-1.5 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-700"
            title="Remove animation"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        disabled={graphics.length === 0}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-neutral-700 text-neutral-200 hover:bg-neutral-600 disabled:opacity-50"
      >
        <Plus size={12} /> Add animation
      </button>
      {graphics.length === 0 && (
        <p className="text-[10px] text-amber-400/80">회전시킬 도형이 필요하다 (도형을 먼저 그려라).</p>
      )}
    </div>
  );
}
