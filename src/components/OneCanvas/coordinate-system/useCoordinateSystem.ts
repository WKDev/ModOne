import { useRef, useEffect } from 'react';
import type { Position, ContainerPosition, CanvasPosition } from '../types';
import { screenToCanvas, canvasToScreen } from '../utils/canvasCoordinates';

export interface CoordinateSystemOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  pan: Position;
}

export interface CoordinateSystem {
  // 좌표 변환
  toCanvas(containerPos: ContainerPosition): CanvasPosition;
  toContainer(canvasPos: CanvasPosition): ContainerPosition;

  // 상태
  zoom: number;
  pan: Position;

  // 컨테이너 정보
  containerRect: DOMRect | null;
}

export function useCoordinateSystem({
  containerRef,
  zoom,
  pan,
}: CoordinateSystemOptions): CoordinateSystem {
  const containerRectRef = useRef<DOMRect | null>(null);

  // ResizeObserver로 containerRect 캐싱
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    containerRectRef.current = container.getBoundingClientRect();

    const observer = new ResizeObserver(() => {
      containerRectRef.current = container.getBoundingClientRect();
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [containerRef]);

  return {
    toCanvas: (containerPos: ContainerPosition): CanvasPosition => {
      return screenToCanvas(containerPos, pan, zoom) as CanvasPosition;
    },
    toContainer: (canvasPos: CanvasPosition): ContainerPosition => {
      return canvasToScreen(canvasPos, pan, zoom) as ContainerPosition;
    },
    zoom,
    pan,
    containerRect: containerRectRef.current,
  };
}
