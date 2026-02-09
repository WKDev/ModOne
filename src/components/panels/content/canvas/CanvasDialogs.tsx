import { memo } from 'react';
import { CircuitLibraryPanel } from '../../../OneCanvas/components/CircuitLibraryPanel';
import { WireNumberingDialog } from '../../../OneCanvas/components/WireNumberingDialog';
import { PrintDialog } from '../../../OneCanvas/components/PrintDialog';
import type { PrintLayoutConfig } from '../../../OneCanvas/utils/printSupport';
import type { WireNumberingOptions } from '../../../OneCanvas/utils/wireNumbering';
import type { Block, Junction, Position, Wire } from '../../../OneCanvas/types';

interface CanvasDialogsProps {
  libraryOpen: boolean;
  onCloseLibrary: () => void;
  selectedIds: Set<string>;
  components: Map<string, Block>;
  wires: Wire[];
  junctions: Map<string, Junction>;
  onLoadTemplate: (
    components: Map<string, Block>,
    wires: Wire[],
    junctions: Map<string, Junction>,
    offset: Position
  ) => void;
  wireNumberingOpen: boolean;
  onCloseWireNumbering: () => void;
  onApplyWireNumbering: (options: WireNumberingOptions) => void;
  printDialogOpen: boolean;
  onClosePrintDialog: () => void;
  onPrint: (config: PrintLayoutConfig) => void;
}

export const CanvasDialogs = memo(function CanvasDialogs({
  libraryOpen,
  onCloseLibrary,
  selectedIds,
  components,
  wires,
  junctions,
  onLoadTemplate,
  wireNumberingOpen,
  onCloseWireNumbering,
  onApplyWireNumbering,
  printDialogOpen,
  onClosePrintDialog,
  onPrint,
}: CanvasDialogsProps) {
  return (
    <>
      <CircuitLibraryPanel
        isOpen={libraryOpen}
        onClose={onCloseLibrary}
        selectedIds={selectedIds}
        components={components}
        wires={wires}
        junctions={junctions}
        onLoadTemplate={onLoadTemplate}
      />

      <WireNumberingDialog
        isOpen={wireNumberingOpen}
        onClose={onCloseWireNumbering}
        wireCount={wires.length}
        onApply={onApplyWireNumbering}
      />

      <PrintDialog
        isOpen={printDialogOpen}
        onClose={onClosePrintDialog}
        onPrint={onPrint}
        defaultProjectTitle="ModOne Project"
      />
    </>
  );
});
