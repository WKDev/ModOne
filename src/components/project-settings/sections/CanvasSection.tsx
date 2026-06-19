import { memo } from 'react';
import { PanelSection } from '../../protocol/ProtocolPanelPrimitives';
import { CanvasProperties } from '../../panels/content/properties/CanvasProperties';
import type { CategorySectionProps } from '../types';

export const CanvasSection = memo(function CanvasSection({
  searchFilter,
}: CategorySectionProps) {
  const filter = searchFilter.toLowerCase();
  const isVisible = (keywords: string[]) => {
    if (!filter) return true;
    return keywords.some((kw) => kw.toLowerCase().includes(filter));
  };

  if (!isVisible(['canvas', 'grid', 'snap', 'style', 'dots', 'lines'])) {
    return null;
  }

  return (
    <PanelSection
      title="Canvas"
      description="Canvas/grid preferences persist in the same project manifest."
    >
      <CanvasProperties documentId={null} />
    </PanelSection>
  );
});
