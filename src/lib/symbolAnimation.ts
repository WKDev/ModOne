// 심볼 애니메이션 스펙을 표시 객체에 시간 기반으로 적용/복원하는 순수 헬퍼 — 에디터 프리뷰와 실제 캔버스가 공유
import type { SymbolAnimationSpec } from '@/types/symbol';

const DEFAULT_DURATION_MS = 1000;
const DEFAULT_ROTATE_SPEED = 120; // deg/s

/** Base transform captured when an animation begins (so it can restore on stop). */
export interface AnimationBase {
  rotation: number;
  alpha: number;
  x: number;
  y: number;
}

/**
 * Minimal target surface shared by a Pixi Container (editor) and a
 * Graphics/Text display object (canvas): rotation, alpha, and a mutable
 * position. Only the fields a given spec needs are touched.
 */
export interface AnimatableTarget {
  rotation: number;
  alpha: number;
  position: { x: number; y: number };
}

/** Capture the current transform of a target as its animation base. */
export function captureAnimationBase(target: AnimatableTarget): AnimationBase {
  return {
    rotation: target.rotation ?? 0,
    alpha: target.alpha ?? 1,
    x: target.position?.x ?? 0,
    y: target.position?.y ?? 0,
  };
}

/**
 * Apply one animation spec to a target at `elapsedMs` since it started,
 * relative to `base`. Mutates only the properties the spec drives.
 */
export function applyAnimationFrame(
  target: AnimatableTarget,
  spec: SymbolAnimationSpec,
  elapsedMs: number,
  base: AnimationBase,
): void {
  switch (spec.type) {
    case 'rotate': {
      const speed = spec.speed ?? DEFAULT_ROTATE_SPEED;
      target.rotation = base.rotation + ((speed * Math.PI) / 180) * (elapsedMs / 1000);
      break;
    }
    case 'fade-in': {
      const d = spec.duration ?? DEFAULT_DURATION_MS;
      const t = d <= 0 ? 1 : Math.min(1, elapsedMs / d);
      target.alpha = base.alpha * t;
      break;
    }
    case 'fade-out': {
      const d = spec.duration ?? DEFAULT_DURATION_MS;
      const t = d <= 0 ? 1 : Math.min(1, elapsedMs / d);
      target.alpha = base.alpha * (1 - t);
      break;
    }
    case 'blink': {
      const d = spec.duration ?? DEFAULT_DURATION_MS;
      const phase = d <= 0 ? 0 : (elapsedMs % d) / d; // 0..1
      target.alpha = base.alpha * (phase < 0.5 ? 1 : 0);
      break;
    }
    case 'move': {
      const d = spec.duration ?? DEFAULT_DURATION_MS;
      const s = d <= 0 ? 0 : Math.sin((2 * Math.PI * elapsedMs) / d);
      target.position.x = base.x + (spec.dx ?? 0) * s;
      target.position.y = base.y + (spec.dy ?? 0) * s;
      break;
    }
  }
}

/** Restore the properties a spec drove back to their base values. */
export function resetAnimationFrame(
  target: AnimatableTarget,
  spec: SymbolAnimationSpec,
  base: AnimationBase,
): void {
  switch (spec.type) {
    case 'rotate':
      target.rotation = base.rotation;
      break;
    case 'fade-in':
    case 'fade-out':
    case 'blink':
      target.alpha = base.alpha;
      break;
    case 'move':
      target.position.x = base.x;
      target.position.y = base.y;
      break;
  }
}
