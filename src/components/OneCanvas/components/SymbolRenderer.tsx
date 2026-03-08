import { memo, useEffect, useState } from 'react';
import { renderSymbolThumbnail, getCachedThumbnail } from '../utils/symbolThumbnails';
import type { BlockType } from '../../../types/circuit';

interface SymbolRendererProps {
  symbolId: BlockType;
  width: number;
  height: number;
  className?: string;
}

export const SymbolRenderer = memo(function SymbolRenderer({
  symbolId,
  width,
  height,
  className,
}: SymbolRendererProps) {
  const [src, setSrc] = useState<string | undefined>(
    () => getCachedThumbnail(symbolId, width, height),
  );

  useEffect(() => {
    const cached = getCachedThumbnail(symbolId, width, height);
    if (cached) {
      setSrc(cached);
      return;
    }
    let cancelled = false;
    renderSymbolThumbnail(symbolId, width, height).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => { cancelled = true; };
  }, [symbolId, width, height]);

  if (!src) {
    return <div style={{ width, height }} className={className} />;
  }

  return (
    <img
      src={src}
      width={width}
      height={height}
      alt={symbolId}
      className={className}
      style={{ imageRendering: 'pixelated' }}
    />
  );
});
