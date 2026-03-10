# Canvas UI Integration for Utilities

## TL;DR

> **Quick Summary**: Create three missing UI component files. The integration layer (OneCanvasPanel.tsx, CanvasDialogs.tsx) is ALREADY DONE — only the component files are missing.
> 
> **Deliverables**:
> - `CanvasToolbar.tsx` - Toolbar with alignment, distribution, flip, wire numbering, and print buttons
> - `WireNumberingDialog.tsx` - Configuration dialog for wire numbering options
> - `PrintDialog.tsx` - Configuration dialog for print settings and title block
> - ~~Updated `OneCanvasPanel.tsx`~~ — ALREADY DONE (integration complete)
> 
> **Estimated Effort**: Short (3 parallel tasks)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Wave 1 (3 parallel component files) → F1-F2 (verification)

---

## Context

### Original Request
Create UI components to integrate three existing utilities:
1. Wire Numbering (wireNumbering.ts) - needs dialog for configuration
2. Alignment/Distribution (canvasStore.ts) - needs toolbar buttons
3. Print Support (printSupport.ts) - needs dialog for configuration

### Interview Summary
**Key Discussions**:
- Test Strategy: No unit tests - Agent-Executed QA (Playwright) only for speed
- Wire Numbering Preview: Simple form only - apply to see results on canvas
- Print Preview: No preview pane - direct to browser print dialog

**Research Findings**:
- Icon library: lucide-react (AlignLeft, AlignRight, AlignVerticalJustifyCenter, etc.)
- Dialog pattern: Fixed overlay modal with header/content/actions (CircuitLibraryPanel style)
- Toolbar pattern: Flex buttons with icon+text, neutral-700/600 hover styling
- Existing utilities fully implemented - only need UI wrappers
- Component location: `src/components/OneCanvas/` (alongside SimulationToolbar)

### Utility APIs (Verified)
```typescript
// canvasStore.ts - Already implemented
alignSelected(direction: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV')
distributeSelected(direction: 'horizontal' | 'vertical')
flipSelected(axis: 'horizontal' | 'vertical')

// wireNumbering.ts
generateWireNumbers(wires, components, options: WireNumberingOptions): WireNumberingResult
applyWireNumbers(wires, wireNumbers): Wire[]
// Options: { scheme, startNumber, prefix, includeSignalType, sortByPosition }

// printSupport.ts
createDefaultPrintLayout(titleBlock?): PrintLayoutConfig
generateTitleBlockSvg(config): string
openPrintDialog(svgContent, config): void
```

---

## Work Objectives

### Core Objective
Add a canvas toolbar with alignment/distribution/flip buttons and dialogs for wire numbering and print configuration, integrating existing utility functions.

### Concrete Deliverables
- `src/components/OneCanvas/CanvasToolbar.tsx` - New toolbar component
- `src/components/OneCanvas/dialogs/WireNumberingDialog.tsx` - New dialog
- `src/components/OneCanvas/dialogs/PrintDialog.tsx` - New dialog
- `src/components/panels/content/OneCanvasPanel.tsx` - Updated with integration

### Definition of Done
- [x] All toolbar buttons visible below SimulationToolbar
- [x] Alignment buttons align selected components correctly
- [x] Distribution buttons distribute selected components evenly
- [x] Flip buttons mirror selected components
- [x] Wire Numbering dialog opens, configures, and applies numbering
- [x] Print dialog opens, configures, and triggers browser print

### Must Have
- All 10 toolbar buttons (6 align + 2 distribute + 2 flip) working
- Wire numbering dialog with scheme/prefix/startNumber options
- Print dialog with paper size, orientation, title block fields
- Keyboard escape to close dialogs
- Proper disabled state when no/insufficient selection

### Must NOT Have (Guardrails)
- NO changes to utility logic (wireNumbering.ts, printSupport.ts, canvasStore alignment functions)
- NO unit tests (user decision - use Agent QA only)
- NO live preview in Wire Numbering dialog
- NO SVG preview pane in Print dialog
- NO over-engineered abstractions - follow existing patterns exactly
- NO new dependencies - use only lucide-react icons and existing patterns

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> Every criterion is verified by the agent using Playwright browser automation.

### Test Decision
- **Infrastructure exists**: YES (Vitest + RTL)
- **Automated tests**: NO (user chose Agent-Executed QA only)
- **Framework**: N/A

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

All verification via Playwright browser automation. The executing agent will:
1. Start dev server (`pnpm dev`)
2. Navigate to canvas panel
3. Interact with UI elements
4. Assert expected behavior
5. Capture screenshots as evidence

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately - All Independent):
├── Task 1: CanvasToolbar.tsx (toolbar with buttons)
├── Task 2: WireNumberingDialog.tsx (dialog component)
└── Task 3: PrintDialog.tsx (dialog component)

Wave 2 (After Wave 1 Complete):
└── Task 4: OneCanvasPanel Integration (wire everything together)

Critical Path: Any Wave 1 task → Task 4
Parallel Speedup: ~60% faster than sequential (3 tasks parallel)
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 4 | 2, 3 |
| 2 | None | 4 | 1, 3 |
| 3 | None | 4 | 1, 2 |
| 4 | 1, 2, 3 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Dispatch |
|------|-------|---------------------|
| 1 | 1, 2, 3 | 3 parallel agents with `load_skills=['frontend-ui-ux']` |
| 2 | 4 | 1 agent after Wave 1 completes |

---

## TODOs

### Wave 1 (Parallel)

- [x] 1. Create CanvasToolbar Component

  **What to do**:
  - Create `src/components/OneCanvas/CanvasToolbar.tsx`
  - Add 10 icon buttons in a horizontal flex container:
    - Alignment (6): AlignLeft, AlignRight, AlignStartVertical, AlignEndVertical, AlignCenterHorizontal, AlignCenterVertical
    - Distribution (2): AlignHorizontalSpaceAround, AlignVerticalSpaceAround
    - Flip (2): FlipHorizontal, FlipVertical
  - Add dividers between button groups (align | distribute | flip | actions)
  - Add "Wire Numbers" button with Hash icon
  - Add "Print" button with Printer icon
  - Props interface (MUST match `OneCanvasPanel.tsx:337-344` exactly):
    ```tsx
    interface CanvasToolbarProps {
      onAlignSelected: (direction: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => void;
      onDistributeSelected: (direction: 'horizontal' | 'vertical') => void;
      onFlipSelected: (axis: 'horizontal' | 'vertical') => void;
      onOpenWireNumbering: () => void;
      onOpenPrint: () => void;
      hasSelection: boolean;
      selectionCount: number;
    }
    ```
  - Accept `selectionCount` prop to disable buttons appropriately:
    - Align: disabled if < 2 selected
    - Distribute: disabled if < 3 selected
    - Flip: disabled if < 1 selected
  - Follow SimulationToolbar styling patterns exactly

  **Must NOT do**:
  - Don't implement dialog logic in toolbar (just fire callbacks)
  - Don't add any state management (stateless component)
  - Don't deviate from existing button styling patterns

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component with precise layout and styling requirements
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Component creation following design patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/components/OneCanvas/SimulationToolbar.tsx:1-80` - Exact button styling, icon sizing, flex layout, divider pattern
  - `src/components/OneCanvas/components/CircuitLibraryPanel.tsx:45-60` - Button hover states and transitions

  **Icon References** (lucide-react):
  - Alignment: `AlignLeft`, `AlignRight`, `AlignStartVertical`, `AlignEndVertical`, `AlignCenterHorizontal`, `AlignCenterVertical`
  - Distribution: `AlignHorizontalSpaceAround`, `AlignVerticalSpaceAround`
  - Flip: `FlipHorizontal`, `FlipVertical`
  - Actions: `Hash` (wire numbering), `Printer` (print)

  **Type References**:
  - Define props interface inline following React.FC pattern

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Toolbar renders with all buttons
    Tool: Playwright
    Preconditions: Dev server running, canvas panel open
    Steps:
      1. Navigate to: http://localhost:1420 (or dev port)
      2. Open canvas panel (if not default)
      3. Wait for: [data-testid="canvas-toolbar"] visible (timeout: 5s)
      4. Assert: 10 icon buttons visible in toolbar
      5. Assert: Dividers present between button groups
      6. Screenshot: .sisyphus/evidence/task-1-toolbar-render.png
    Expected Result: All buttons render with correct icons
    Evidence: .sisyphus/evidence/task-1-toolbar-render.png

  Scenario: Alignment buttons disabled with < 2 selections
    Tool: Playwright
    Preconditions: Canvas panel open, no components selected
    Steps:
      1. Assert: All 6 alignment buttons have disabled styling
      2. Select 1 component on canvas
      3. Assert: Alignment buttons still disabled
      4. Select 2nd component (Ctrl+click or shift-select)
      5. Assert: Alignment buttons now enabled
      6. Screenshot: .sisyphus/evidence/task-1-align-enable.png
    Expected Result: Alignment buttons enable only with 2+ selections
    Evidence: .sisyphus/evidence/task-1-align-enable.png

  Scenario: Distribution buttons disabled with < 3 selections
    Tool: Playwright
    Preconditions: Canvas panel open
    Steps:
      1. Select 2 components
      2. Assert: Distribution buttons disabled
      3. Select 3rd component
      4. Assert: Distribution buttons now enabled
      5. Screenshot: .sisyphus/evidence/task-1-distribute-enable.png
    Expected Result: Distribution buttons enable only with 3+ selections
    Evidence: .sisyphus/evidence/task-1-distribute-enable.png
  ```

  **Commit**: YES
  - Message: `feat(canvas): add CanvasToolbar component with alignment and action buttons`
  - Files: `src/components/OneCanvas/CanvasToolbar.tsx`

---

- [x] 2. Create WireNumberingDialog Component

  **What to do**:
  - Create `src/components/OneCanvas/components/WireNumberingDialog.tsx` (NOT dialogs/)
  - Create dialogs folder if it doesn't exist
  - Follow CircuitLibraryPanel dialog pattern exactly:
    - Fixed overlay with bg-black/50
    - Modal container with bg-neutral-900 border-neutral-700
    - Header with title ("Wire Numbering") and X close button
    - Content area with form fields
    - Footer with Cancel and Apply buttons
  - Form fields:
    - Scheme: Select dropdown with options: Sequential, Component Based, Zone Based
    - Prefix: Text input (optional, e.g., "W")
    - Start Number: Number input (default: 1, min: 1)
    - Include Signal Type: Checkbox (optional enhancement)
    - Sort by Position: Checkbox (default: true)
  - Props interface (MUST match `CanvasDialogs.tsx:22-24` exactly):
    - `wireNumberingOpen: boolean`
    - `onCloseWireNumbering: () => void`
    - `onApplyWireNumbering: (options: WireNumberingOptions) => void`
  - Use local state for form values, reset on open
  - Keyboard: Escape to close, Enter to apply

  **Must NOT do**:
  - Don't add preview/results table (user decision)
  - Don't call wireNumbering functions directly (just pass options to onApply)
  - Don't add complex validation beyond min/max

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Dialog UI with form layout and state management
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Form design and dialog patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/components/OneCanvas/components/CircuitLibraryPanel.tsx:1-150` - Complete dialog structure, overlay, modal, header with X button
  - `src/components/OneCanvas/components/CircuitLibraryPanel.tsx:180-230` - Save dialog form pattern with inputs and buttons
  - `src/components/LadderEditor/properties/PropertyField.tsx:1-100` - Form field patterns (text, number, select)

  **API References**:
  - `src/components/OneCanvas/utils/wireNumbering.ts:WireNumberingOptions` - Interface for options
  - `src/components/OneCanvas/utils/wireNumbering.ts:NumberingScheme` - 'sequential' | 'component_based' | 'zone_based'

  **Styling References**:
  - Input: `w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white`
  - Select: Same as input with native select element
  - Buttons: Cancel `text-neutral-400 hover:text-white`, Apply `bg-blue-600 hover:bg-blue-700 text-white rounded`

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Dialog opens and displays all form fields
    Tool: Playwright
    Preconditions: Dev server running, WireNumberingDialog integrated
    Steps:
      1. Navigate to canvas panel
      2. Click "Wire Numbers" button in toolbar
      3. Wait for: dialog overlay visible (timeout: 3s)
      4. Assert: Dialog title is "Wire Numbering"
      5. Assert: Scheme dropdown visible with 3 options
      6. Assert: Prefix input visible
      7. Assert: Start Number input visible with value "1"
      8. Assert: Cancel and Apply buttons visible
      9. Screenshot: .sisyphus/evidence/task-2-dialog-open.png
    Expected Result: Dialog displays all configuration options
    Evidence: .sisyphus/evidence/task-2-dialog-open.png

  Scenario: Dialog closes on Escape key
    Tool: Playwright
    Preconditions: Wire numbering dialog open
    Steps:
      1. Press: Escape key
      2. Wait for: dialog to disappear (timeout: 1s)
      3. Assert: Overlay no longer visible
    Expected Result: Dialog closes on Escape
    Evidence: N/A (behavior verification)

  Scenario: Dialog closes on Cancel button
    Tool: Playwright
    Preconditions: Wire numbering dialog open
    Steps:
      1. Click: Cancel button
      2. Wait for: dialog to disappear (timeout: 1s)
      3. Assert: Overlay no longer visible
    Expected Result: Dialog closes on Cancel
    Evidence: N/A (behavior verification)

  Scenario: Form values reset on reopen
    Tool: Playwright
    Preconditions: Dialog can be opened
    Steps:
      1. Open dialog
      2. Change prefix to "TEST"
      3. Change start number to 100
      4. Click Cancel
      5. Open dialog again
      6. Assert: Prefix is empty (or default)
      7. Assert: Start number is 1
    Expected Result: Form resets to defaults on each open
    Evidence: .sisyphus/evidence/task-2-form-reset.png
  ```

  **Commit**: YES
  - Message: `feat(canvas): add WireNumberingDialog for wire numbering configuration`
  - Files: `src/components/OneCanvas/dialogs/WireNumberingDialog.tsx`

---

- [x] 3. Create PrintDialog Component

  **What to do**:
  - Create `src/components/OneCanvas/components/PrintDialog.tsx` (NOT dialogs/)
  - Follow same dialog pattern as WireNumberingDialog
  - Form fields organized in sections:
    - **Paper Settings**:
      - Paper Size: Select (A4, A3, A2, A1, A0, Letter, Legal, Tabloid)
      - Orientation: Select (Portrait, Landscape)
    - **Title Block** (collapsible or always visible):
      - Company: Text input
      - Project Title: Text input (required)
      - Drawing Title: Text input (required)
      - Drawing Number: Text input (required)
      - Revision: Text input
      - Drawn By: Text input
      - Date: Text input (default: today's date)
      - Sheet Number: Number input
      - Total Sheets: Number input
    - **Options**:
      - Show Grid: Checkbox
      - Show Wire Labels: Checkbox
      - Show Designations: Checkbox
  - Props interface (MUST match `CanvasDialogs.tsx:25-28` exactly):
    - `printDialogOpen: boolean`
    - `onClosePrintDialog: () => void`
    - `onPrint: (config: PrintLayoutConfig) => void`
  - Use `createDefaultPrintLayout()` for initial values
  - Print button triggers onPrint callback

  **Must NOT do**:
  - Don't add SVG preview pane (user decision)
  - Don't call printSupport functions directly (pass config to onPrint)
  - Don't over-engineer with tabs - simple vertical form

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Complex form dialog with multiple sections
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Form layout and section organization

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/components/OneCanvas/components/CircuitLibraryPanel.tsx:1-150` - Dialog structure
  - `src/components/settings/SettingsDialog.tsx:1-100` - Multi-section form layout pattern
  - `src/components/LadderEditor/dialogs/DeviceSelectDialog.tsx:1-80` - Complex dialog with form fields

  **API References**:
  - `src/components/OneCanvas/utils/printSupport.ts:PrintLayoutConfig` - Full config interface
  - `src/components/OneCanvas/utils/printSupport.ts:TitleBlockInfo` - Title block fields
  - `src/components/OneCanvas/utils/printSupport.ts:PaperSize` - Paper size enum
  - `src/components/OneCanvas/utils/printSupport.ts:PaperOrientation` - 'portrait' | 'landscape'
  - `src/components/OneCanvas/utils/printSupport.ts:createDefaultPrintLayout` - For initial values

  **Styling References**:
  - Section headers: `text-sm font-medium text-neutral-300 mb-2`
  - Form grid: `grid grid-cols-2 gap-3` for side-by-side fields
  - Scrollable content: `max-h-[60vh] overflow-y-auto`

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Print dialog opens with all fields
    Tool: Playwright
    Preconditions: Dev server running, PrintDialog integrated
    Steps:
      1. Navigate to canvas panel
      2. Click "Print" button in toolbar
      3. Wait for: dialog overlay visible (timeout: 3s)
      4. Assert: Dialog title is "Print" or "Print Settings"
      5. Assert: Paper Size dropdown visible
      6. Assert: Orientation dropdown visible
      7. Assert: Project Title input visible
      8. Assert: Drawing Number input visible
      9. Assert: Print and Cancel buttons visible
      10. Screenshot: .sisyphus/evidence/task-3-dialog-open.png
    Expected Result: Dialog displays all print configuration options
    Evidence: .sisyphus/evidence/task-3-dialog-open.png

  Scenario: Paper size options are correct
    Tool: Playwright
    Preconditions: Print dialog open
    Steps:
      1. Click: Paper Size dropdown
      2. Assert: Options include A4, A3, Letter
      3. Select: A3
      4. Assert: Dropdown shows A3 selected
      5. Screenshot: .sisyphus/evidence/task-3-paper-size.png
    Expected Result: All paper sizes available and selectable
    Evidence: .sisyphus/evidence/task-3-paper-size.png

  Scenario: Orientation toggle works
    Tool: Playwright
    Preconditions: Print dialog open
    Steps:
      1. Assert: Default orientation is Landscape (common for schematics)
      2. Click: Portrait option
      3. Assert: Portrait is now selected
    Expected Result: Orientation can be changed
    Evidence: N/A (behavior verification)

  Scenario: Dialog closes on Escape
    Tool: Playwright
    Preconditions: Print dialog open
    Steps:
      1. Press: Escape key
      2. Assert: Dialog closed
    Expected Result: Escape closes dialog
    Evidence: N/A (behavior verification)
  ```

  **Commit**: YES
  - Message: `feat(canvas): add PrintDialog for print configuration and title block`
  - Files: `src/components/OneCanvas/dialogs/PrintDialog.tsx`

---

### Wave 2 (After Wave 1)

- [x] 4. Integrate Components in OneCanvasPanel

  **What to do**:
  - Import new components in `src/components/panels/content/OneCanvasPanel.tsx`:
    - `import { CanvasToolbar } from '@/components/OneCanvas/CanvasToolbar'`
    - `import { WireNumberingDialog } from '@/components/OneCanvas/dialogs/WireNumberingDialog'`
    - `import { PrintDialog } from '@/components/OneCanvas/dialogs/PrintDialog'`
  - Add state for dialog visibility:
    - `const [wireNumberingOpen, setWireNumberingOpen] = useState(false)`
    - `const [printOpen, setPrintOpen] = useState(false)`
  - Get store actions:
    - `const alignSelected = useCanvasStore((s) => s.alignSelected)`
    - `const distributeSelected = useCanvasStore((s) => s.distributeSelected)`
    - `const flipSelected = useCanvasStore((s) => s.flipSelected)`
    - `const wires = useCanvasStore((s) => s.wires)`
    - `const components = useCanvasStore((s) => s.components)`
    - `const selectedIds = useCanvasStore((s) => s.selectedIds)` (for selection count)
  - Implement wire numbering handler:
    ```typescript
    const handleWireNumbering = (options: WireNumberingOptions) => {
      const result = generateWireNumbers(wires, components, options);
      const updatedWires = applyWireNumbers(wires, result.wireNumbers);
      // Update store with new wires
      setWireNumberingOpen(false);
    };
    ```
  - Implement print handler:
    ```typescript
    const handlePrint = (config: PrintLayoutConfig) => {
      const svgContent = /* get current canvas SVG */;
      openPrintDialog(svgContent, config);
      setPrintOpen(false);
    };
    ```
  - Add CanvasToolbar below SimulationToolbar in JSX
  - Add dialog components at end of JSX (outside main layout)
  - Pass `selectionCount={selectedIds.size}` to toolbar

  **Must NOT do**:
  - Don't modify SimulationToolbar
  - Don't change existing canvas rendering logic
  - Don't add complex state management - simple useState

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Component integration and state wiring
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: React component composition

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential after Wave 1)
  - **Blocks**: None (final task)
  - **Blocked By**: Tasks 1, 2, 3

  **References**:

  **Pattern References**:
  - `src/components/panels/content/OneCanvasPanel.tsx:767-774` - SimulationToolbar integration pattern
  - `src/components/panels/content/OneCanvasPanel.tsx:867-875` - CircuitLibraryPanel integration pattern
  - `src/components/panels/content/OneCanvasPanel.tsx:1-50` - Import statements and store access patterns

  **API References**:
  - `src/stores/canvasStore.ts:alignSelected` - Alignment action
  - `src/stores/canvasStore.ts:distributeSelected` - Distribution action
  - `src/stores/canvasStore.ts:flipSelected` - Flip action
  - `src/components/OneCanvas/utils/wireNumbering.ts:generateWireNumbers` - Wire numbering function
  - `src/components/OneCanvas/utils/wireNumbering.ts:applyWireNumbers` - Apply wire numbers
  - `src/components/OneCanvas/utils/printSupport.ts:openPrintDialog` - Open print dialog

  **Component References**:
  - `src/components/OneCanvas/CanvasToolbar.tsx` - Created in Task 1
  - `src/components/OneCanvas/dialogs/WireNumberingDialog.tsx` - Created in Task 2
  - `src/components/OneCanvas/dialogs/PrintDialog.tsx` - Created in Task 3

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: CanvasToolbar appears below SimulationToolbar
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Navigate to: http://localhost:1420
      2. Open canvas panel
      3. Assert: SimulationToolbar visible at top
      4. Assert: CanvasToolbar visible below SimulationToolbar
      5. Assert: Both toolbars have consistent styling
      6. Screenshot: .sisyphus/evidence/task-4-toolbar-position.png
    Expected Result: Both toolbars visible in correct order
    Evidence: .sisyphus/evidence/task-4-toolbar-position.png

  Scenario: Align Left works on selected components
    Tool: Playwright
    Preconditions: Canvas with multiple components
    Steps:
      1. Add 3 components to canvas at different X positions
      2. Select all 3 components (Ctrl+A or multi-select)
      3. Note: Initial X positions differ
      4. Click: Align Left button
      5. Assert: All 3 components now have same X position (leftmost)
      6. Screenshot: .sisyphus/evidence/task-4-align-left.png
    Expected Result: Components aligned to left edge
    Evidence: .sisyphus/evidence/task-4-align-left.png

  Scenario: Distribute Horizontal works on 3+ components
    Tool: Playwright
    Preconditions: Canvas with 3+ components selected
    Steps:
      1. Add 4 components at irregular horizontal spacing
      2. Select all 4
      3. Click: Distribute Horizontal button
      4. Assert: Components now have equal horizontal spacing
      5. Screenshot: .sisyphus/evidence/task-4-distribute.png
    Expected Result: Even horizontal distribution
    Evidence: .sisyphus/evidence/task-4-distribute.png

  Scenario: Flip Horizontal mirrors selection
    Tool: Playwright
    Preconditions: Canvas with component selected
    Steps:
      1. Add asymmetric component (e.g., switch with label on one side)
      2. Select component
      3. Note: Initial orientation
      4. Click: Flip Horizontal button
      5. Assert: Component is horizontally mirrored
      6. Screenshot: .sisyphus/evidence/task-4-flip.png
    Expected Result: Component flipped horizontally
    Evidence: .sisyphus/evidence/task-4-flip.png

  Scenario: Wire Numbering end-to-end flow
    Tool: Playwright
    Preconditions: Canvas with wires connecting components
    Steps:
      1. Create simple circuit with 3+ wires
      2. Click: Wire Numbers button
      3. Wait for: WireNumberingDialog visible
      4. Set: Prefix to "W"
      5. Set: Start Number to 100
      6. Select: Sequential scheme
      7. Click: Apply button
      8. Assert: Dialog closes
      9. Assert: Wires now have labels W100, W101, W102...
      10. Screenshot: .sisyphus/evidence/task-4-wire-numbering.png
    Expected Result: Wires numbered with prefix and sequential numbers
    Evidence: .sisyphus/evidence/task-4-wire-numbering.png

  Scenario: Print end-to-end flow
    Tool: Playwright
    Preconditions: Canvas with circuit
    Steps:
      1. Click: Print button
      2. Wait for: PrintDialog visible
      3. Select: Paper Size = A3
      4. Select: Orientation = Landscape
      5. Fill: Project Title = "Test Project"
      6. Fill: Drawing Number = "DWG-001"
      7. Click: Print button
      8. Assert: Browser print dialog opens OR print preview window
      9. Screenshot: .sisyphus/evidence/task-4-print-dialog.png
    Expected Result: Print dialog triggers browser print
    Evidence: .sisyphus/evidence/task-4-print-dialog.png
  ```

  **Commit**: YES
  - Message: `feat(canvas): integrate CanvasToolbar and dialogs in OneCanvasPanel`
  - Files: `src/components/panels/content/OneCanvasPanel.tsx`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(canvas): add CanvasToolbar component` | `CanvasToolbar.tsx` | Playwright QA |
| 2 | `feat(canvas): add WireNumberingDialog` | `dialogs/WireNumberingDialog.tsx` | Playwright QA |
| 3 | `feat(canvas): add PrintDialog` | `dialogs/PrintDialog.tsx` | Playwright QA |
| 4 | `feat(canvas): integrate toolbar and dialogs` | `OneCanvasPanel.tsx` | Full E2E QA |

---

## Success Criteria

### Verification Commands
```bash
pnpm dev          # Start dev server
pnpm build        # Verify no TypeScript errors
pnpm lint         # Verify no lint errors
```

### Final Checklist
- [x] CanvasToolbar renders with all 10 action buttons + 2 dialog buttons
- [x] Alignment buttons work for 2+ selected components
- [x] Distribution buttons work for 3+ selected components
- [x] Flip buttons work for 1+ selected components
- [x] Wire Numbering dialog opens, configures, applies numbering
- [x] Print dialog opens, configures, triggers browser print
- [x] Both dialogs close on Escape and Cancel
- [x] No TypeScript errors
- [x] No console errors
- [x] Styling matches existing toolbar/dialog patterns
