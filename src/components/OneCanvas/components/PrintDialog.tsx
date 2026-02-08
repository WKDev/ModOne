/**
 * Print Dialog Component
 *
 * Dialog for configuring print settings and title block.
 */

import { memo, useState, useCallback } from 'react';
import { Printer, X } from 'lucide-react';
import type { PaperSize, PaperOrientation, PrintLayoutConfig, TitleBlockInfo } from '../utils/printSupport';

// ============================================================================
// Types
// ============================================================================

interface PrintDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Close the dialog */
  onClose: () => void;
  /** Print with config */
  onPrint: (config: PrintLayoutConfig) => void;
  /** Default project title to pre-fill */
  defaultProjectTitle?: string;
}

// ============================================================================
// Constants
// ============================================================================

const PAPER_SIZES: PaperSize[] = ['A4', 'A3', 'A2', 'A1', 'A0', 'Letter', 'Legal', 'Tabloid'];

// ============================================================================
// Component
// ============================================================================

export const PrintDialog = memo(function PrintDialog({
  isOpen,
  onClose,
  onPrint,
  defaultProjectTitle = 'Project',
}: PrintDialogProps) {
  // Page setup state
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [orientation, setOrientation] = useState<PaperOrientation>('landscape');
  const [showGrid, setShowGrid] = useState(false);
  const [showWireLabels, setShowWireLabels] = useState(true);

  // Title block state
  const [company, setCompany] = useState('');
  const [projectTitle, setProjectTitle] = useState(defaultProjectTitle);
  const [drawingTitle, setDrawingTitle] = useState('Schematic');
  const [drawingNumber, setDrawingNumber] = useState('DWG-001');
  const [revision, setRevision] = useState('A');
  const [drawnBy, setDrawnBy] = useState('');
  const [checkedBy, setCheckedBy] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [sheetNumber, setSheetNumber] = useState(1);
  const [totalSheets, setTotalSheets] = useState(1);
  const [scale, setScale] = useState('1:1');

  // Validation
  const isValid = projectTitle.trim() && drawingTitle.trim() && drawingNumber.trim();

  // Handle print
  const handlePrint = useCallback(() => {
    const titleBlock: TitleBlockInfo = {
      company: company || undefined,
      projectTitle,
      drawingTitle,
      drawingNumber,
      revision: revision || undefined,
      drawnBy: drawnBy || undefined,
      checkedBy: checkedBy || undefined,
      date,
      sheetNumber,
      totalSheets,
      scale,
    };

    const config: PrintLayoutConfig = {
      paperSize,
      orientation,
      margins: { top: 10, right: 10, bottom: 25, left: 10 },
      titleBlockPosition: 'bottom-right',
      titleBlock,
      showGrid,
      showWireLabels,
      scale: 1.0,
    };

    onPrint(config);
    onClose();
  }, [
    paperSize, orientation, showGrid, showWireLabels,
    company, projectTitle, drawingTitle, drawingNumber, revision,
    drawnBy, checkedBy, date, sheetNumber, totalSheets, scale,
    onPrint, onClose
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[550px] max-h-[90vh] overflow-y-auto bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700 sticky top-0 bg-neutral-900">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Printer size={20} />
            Print Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Page Setup Section */}
          <div className="space-y-3">
            <h3 className="text-xs text-neutral-500 uppercase tracking-wider font-medium">
              Page Setup
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Paper Size */}
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Paper Size</label>
                <select
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white focus:outline-none focus:border-blue-500"
                >
                  {PAPER_SIZES.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>

              {/* Orientation */}
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Orientation</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="orientation"
                      value="portrait"
                      checked={orientation === 'portrait'}
                      onChange={() => setOrientation('portrait')}
                      className="accent-blue-500"
                    />
                    <span className="text-white text-sm">Portrait</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="orientation"
                      value="landscape"
                      checked={orientation === 'landscape'}
                      onChange={() => setOrientation('landscape')}
                      className="accent-blue-500"
                    />
                    <span className="text-white text-sm">Landscape</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="accent-blue-500"
                />
                <span className="text-white text-sm">Show Grid</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showWireLabels}
                  onChange={(e) => setShowWireLabels(e.target.checked)}
                  className="accent-blue-500"
                />
                <span className="text-white text-sm">Show Wire Labels</span>
              </label>
            </div>
          </div>

          {/* Title Block Section */}
          <div className="space-y-3">
            <h3 className="text-xs text-neutral-500 uppercase tracking-wider font-medium">
              Title Block
            </h3>

            {/* Company */}
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Company</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company name (optional)"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Project & Drawing Title */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">
                  Project Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">
                  Drawing Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={drawingTitle}
                  onChange={(e) => setDrawingTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Drawing Number & Revision */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-sm text-neutral-400 mb-1">
                  Drawing Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={drawingNumber}
                  onChange={(e) => setDrawingNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Revision</label>
                <input
                  type="text"
                  value={revision}
                  onChange={(e) => setRevision(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Drawn By & Checked By */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Drawn By</label>
                <input
                  type="text"
                  value={drawnBy}
                  onChange={(e) => setDrawnBy(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Checked By</label>
                <input
                  type="text"
                  value={checkedBy}
                  onChange={(e) => setCheckedBy(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Date, Sheet, Scale */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Sheet</label>
                <input
                  type="number"
                  min={1}
                  value={sheetNumber}
                  onChange={(e) => setSheetNumber(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">of Total</label>
                <input
                  type="number"
                  min={1}
                  value={totalSheets}
                  onChange={(e) => setTotalSheets(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Scale</label>
                <input
                  type="text"
                  value={scale}
                  onChange={(e) => setScale(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-neutral-700 sticky bottom-0 bg-neutral-900">
          <button
            onClick={onClose}
            className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePrint}
            disabled={!isValid}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded transition-colors"
          >
            <Printer size={16} />
            Print
          </button>
        </div>
      </div>
    </div>
  );
});

export default PrintDialog;
