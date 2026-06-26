// XML 심볼이 없는 빈 custom_symbol을 위한 최소 placeholder GraphicsContext
import { GraphicsContext } from 'pixi.js';

/** placeholder가 그려지는 심볼-로컬 px 크기 (구 SymbolLibrary.custom_symbol와 동일). */
export const PLACEHOLDER_SYMBOL_SIZE = { width: 60, height: 60 } as const;

const STROKE = 0xd0d4da;
const STROKE_WIDTH = 2;

let _cached: GraphicsContext | null = null;

/**
 * 빈/미해결 custom_symbol 블록을 위한 placeholder 컨텍스트.
 * 모든 builtin 블록 타입은 XML 심볼로 해석되므로 이 경로는 symbolId가 없는
 * custom_symbol에서만 도달한다. 단일 인스턴스를 캐시해 재사용한다.
 */
export function createPlaceholderContext(): GraphicsContext {
  if (_cached) return _cached;
  const { width, height } = PLACEHOLDER_SYMBOL_SIZE;
  const ctx = new GraphicsContext();
  ctx.rect(0, 0, width, height).stroke({ color: STROKE, width: STROKE_WIDTH });
  ctx.moveTo(22, 22).arc(30, 22, 8, Math.PI, 0).stroke({ color: STROKE, width: STROKE_WIDTH });
  ctx.moveTo(38, 22).lineTo(30, 32).stroke({ color: STROKE, width: STROKE_WIDTH });
  ctx.circle(30, 42, 2).fill({ color: STROKE });
  _cached = ctx;
  return ctx;
}
