import type { Position } from '../types';

interface TransformedLayerProps {
  children: React.ReactNode;
  zoom: number;
  pan: Position;
  className?: string;
}

/**
 * Transformed Layer
 *
 * CSS transform이 적용되는 레이어입니다.
 * children은 반드시 Canvas Space 좌표를 사용해야 합니다.
 */
export function TransformedLayer({
  children,
  zoom,
  pan,
  className = '',
}: TransformedLayerProps) {
  const transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;

  return (
    <div
      className={`absolute top-0 left-0 origin-top-left ${className}`}
      style={{ transform }}
    >
      {children}
    </div>
  );
}
