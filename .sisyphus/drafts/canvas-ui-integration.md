# Draft: Canvas UI Integration for Utilities

## Requirements (confirmed)

### From User Context:
- **Wire Numbering**: utilities exist in wireNumbering.ts with generateWireNumbers and applyWireNumbers
- **Alignment/Distribution**: already in canvasStore.ts - alignSelected, distributeSelected, flipSelected
- **Print Support**: printSupport.ts with generateTitleBlockSvg and openPrintDialog

### Components to Create:
1. **Canvas Toolbar** - new file with buttons for all actions
2. **Wire Numbering Dialog** - settings for numbering scheme, prefix, start number
3. **Print Dialog** - paper size, orientation, title block form, preview
4. **Integration** - hook up in OneCanvasPanel.tsx

## Technical Decisions
- Dialog pattern: follow CircuitLibraryPanel.tsx pattern
- Button pattern: follow SimulationToolbar.tsx pattern
- Location: below SimulationToolbar in OneCanvasPanel

## Research Findings

### Icon Library
- **lucide-react** - all icons imported directly (Play, Pause, X, Save, etc.)
- Alignment icons available: AlignLeft, AlignRight, AlignVerticalJustifyCenter, etc.

### UI Patterns
- **Dialog**: Fixed overlay `bg-black/50`, modal `bg-neutral-900 border-neutral-700 rounded-lg`
- **Toolbar buttons**: `px-2 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded transition-colors`
- **State-based buttons**: green for active actions, yellow for stop/pause

### Utility APIs
1. **wireNumbering.ts**:
   - `generateWireNumbers(wires, components, options)` → WireNumberingResult
   - `applyWireNumbers(wires, wireNumbers)` → Wire[]
   - Options: `{ scheme, startNumber, prefix, includeSignalType, sortByPosition }`
   - Schemes: 'sequential' | 'component_based' | 'zone_based'

2. **canvasStore.ts** (already implemented):
   - `alignSelected(direction)` - 'left'|'right'|'top'|'bottom'|'centerH'|'centerV'
   - `distributeSelected(direction)` - 'horizontal'|'vertical'
   - `flipSelected(axis)` - 'horizontal'|'vertical'

3. **printSupport.ts**:
   - `generateTitleBlockSvg(config)` → SVG string
   - `openPrintDialog(svgContent, config)` → opens print dialog
   - `createDefaultPrintLayout(titleBlock?)` → PrintLayoutConfig
   - Paper sizes: A4, A3, A2, A1, A0, Letter, Legal, Tabloid
   - Title block: company, projectTitle, drawingTitle, drawingNumber, revision, etc.

### Test Infrastructure
- **Framework**: Vitest (v4.0.18) + @testing-library/react (v16.3.2)
- **Test files**: `**/__tests__/*.test.tsx` pattern
- **22 existing test files** across components
- **Patterns**: vi.fn() for callbacks, cleanup(), screen queries, fireEvent
- **E2E**: Playwright available for browser testing

### Component Organization
- Dialogs go in: `src/components/[Feature]/dialogs/`
- Forms use: PropertyField component pattern
- Toolbars: `src/components/layout/` or feature-specific folders
- NEW components should go in: `src/components/OneCanvas/` (alongside existing SimulationToolbar)

## Decisions Made
- **Test strategy**: No unit tests - Agent-Executed QA (Playwright) only
- **Wire numbering preview**: Simple form only - apply to see results
- **Print preview**: No preview - direct to browser print dialog

## Open Questions
- None - all requirements clarified

## Scope Boundaries
- INCLUDE: Toolbar, two dialogs, integration
- INCLUDE: All alignment directions (6), distribution (2), flip (2)
- EXCLUDE: Changes to utility logic (already implemented)
- EXCLUDE: Any backend/API changes
