interface OverlayLayerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Overlay Layer
 *
 * CSS transform이 적용되지 않는 레이어입니다.
 * children은 반드시 Container/Screen Space 좌표를 사용해야 합니다.
 * pointer-events: none이 기본값이므로, 클릭 가능한 요소는 개별적으로 pointer-events: auto 설정 필요.
 */
export function OverlayLayer({ children, className = '' }: OverlayLayerProps) {
  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      {children}
    </div>
  );
}
