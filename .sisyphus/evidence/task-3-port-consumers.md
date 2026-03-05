# Port.offset Consumer Audit

**Date:** 2026-02-27  
**Scope:** Complete read-only audit of all code that reads `port.offset` or computes port positions using the offset-ratio formula  
**Status:** ✅ NO SOURCE FILES MODIFIED

---

## Summary

The `port.offset` field (defined in `src/components/OneCanvas/types.ts:227`) is a **0-1 ratio** that positions ports relative to block edges. This audit identifies **11 distinct consumers** across the codebase that directly or indirectly depend on this field.

**Key Finding:** All consumers use the same pattern:
```typescript
const offset = port.offset ?? 0.5;  // Default to center
// Then multiply block dimension by offset to get absolute position
```

This pattern will **break completely** if `offset` is removed without migration. All consumers must be updated in Task 21 (offset → absolute coordinate migration).

---

## Port Interface Definition

**File:** `src/components/OneCanvas/types.ts`  
**Line:** 227  
**Definition:**
```typescript
export interface Port {
  id: string;
  type: PortType;
  label: string;
  position: PortPosition;
  offset?: number;  // ← 0-1 ratio, default 0.5 = center
  maxConnections?: number;
}
```

---

## Consumer Audit Table

| # | File | Line | Function/Context | Description | Risk |
|---|------|------|------------------|-------------|------|
| 1 | `components/OneCanvas/components/Port.tsx` | 95 | `Port` component render | Calculates visual port position using `getPortPosition(port.position, port.offset, blockSize)` | **HIGH** |
| 2 | `components/OneCanvas/components/Port.tsx` | 54-73 | `getPortPosition()` helper | Core position calculation: `width * offset + PORT_OFFSET` for top/bottom, `height * offset + PORT_OFFSET` for left/right | **HIGH** |
| 3 | `components/OneCanvas/contexts/InteractionContext.tsx` | 61 | `getPortPosition()` function | Reads `port.offset ?? 0.5` and computes canvas position: `block.position.x + block.size.width * offset` | **HIGH** |
| 4 | `components/OneCanvas/contexts/InteractionContext.tsx` | 50-83 | `getPortPosition()` function body | Full switch statement computing absolute position from offset ratio | **HIGH** |
| 5 | `components/OneCanvas/content/CanvasContent.tsx` | 67 | `getPortPosition()` local function | Reads `port.offset ?? 0.5` for wire rendering position calculation | **HIGH** |
| 6 | `components/OneCanvas/content/CanvasContent.tsx` | 59-89 | `getPortPosition()` function body | Computes wire endpoint positions using offset-ratio formula | **HIGH** |
| 7 | `components/OneCanvas/blockDefinitions.ts` | 69-72, 98-100, 115-117, 134-135, 179-182, 208-215, 228-235, 250-255 | Port definitions | **Data layer:** Defines default ports with explicit offset values (0.25, 0.35, 0.5, 0.65, 0.75, 1.0) for scope, relay, motor, transformer, contactor, overload_relay blocks | **MEDIUM** |
| 8 | `components/OneCanvas/utils/canvasHelpers.ts` | 322 | `getWireEndpointAndDirection()` function | Reads `port.offset ?? 0.5` and calls `getPortRelativePosition(port.position, port.offset ?? 0.5, block.size)` | **HIGH** |
| 9 | `components/OneCanvas/utils/SpatialIndex.ts` | 17 | `getPortWorldPosition()` function | Reads `port.offset ?? 0.5` and computes world position using switch statement on `port.position` | **HIGH** |
| 10 | `components/OneCanvas/utils/wirePathCalculator.ts` | 50 | `getPortAbsolutePosition()` function | Reads `port.offset ?? 0.5` and passes to `getPortRelativePosition()` | **HIGH** |
| 11 | `components/panels/content/OneCanvasPanel.tsx` | 86 | `getPortPosition()` function | Reads `port.offset ?? 0.5` and computes position for panel wire preview | **HIGH** |

---

## Detailed Consumer Analysis

### 1. **Port.tsx** - Visual Port Rendering (Lines 54-95)

**File:** `src/components/OneCanvas/components/Port.tsx`

**Risk Level:** 🔴 **HIGH**

**What it does:**
- Renders the visual port circle on the canvas
- Uses `getPortPosition(port.position, port.offset, blockSize)` to calculate pixel position
- Directly depends on offset for visual placement

**Code:**
```typescript
// Line 54-73: Helper function
function getPortPosition(
  position: PortPosition,
  offset: number = 0.5,
  blockSize: { width: number; height: number }
): { x: number; y: number } {
  const { width, height } = blockSize;
  switch (position) {
    case 'top':
      return { x: width * offset + PORT_OFFSET, y: PORT_OFFSET };
    case 'bottom':
      return { x: width * offset + PORT_OFFSET, y: height + PORT_OFFSET };
    case 'left':
      return { x: PORT_OFFSET, y: height * offset + PORT_OFFSET };
    case 'right':
      return { x: width + PORT_OFFSET, y: height * offset + PORT_OFFSET };
  }
}

// Line 95: Usage in component
const position = getPortPosition(port.position, port.offset, blockSize);
```

**Impact if offset removed:** Port circles will render at wrong positions (default center), breaking visual alignment with wires.

---

### 2. **InteractionContext.tsx** - Wire Interaction State (Lines 50-83, 61)

**File:** `src/components/OneCanvas/contexts/InteractionContext.tsx`

**Risk Level:** 🔴 **HIGH**

**What it does:**
- Calculates port positions for wire creation/interaction state machine
- Used when user drags from a port to create a wire
- Computes absolute canvas coordinates from offset ratio

**Code:**
```typescript
// Line 50-83: getPortPosition function
function getPortPosition(components: Map<string, Block>, blockId: string, portId: string): Position | null {
  const block = components.get(blockId);
  if (!block) return null;
  
  const port = block.ports.find((p) => p.id === portId);
  if (!port) return null;
  
  const offset = port.offset ?? 0.5;  // Line 61
  switch (port.position) {
    case 'top':
      return { x: block.position.x + block.size.width * offset, y: block.position.y };
    case 'bottom':
      return { x: block.position.x + block.size.width * offset, y: block.position.y + block.size.height };
    case 'left':
      return { x: block.position.x, y: block.position.y + block.size.height * offset };
    case 'right':
      return { x: block.position.x + block.size.width, y: block.position.y + block.size.height * offset };
  }
}
```

**Usage:** Called at lines 117 and 265 during wire drag operations.

**Impact if offset removed:** Wire creation will snap to wrong positions, making it impossible to connect to correct ports.

---

### 3. **CanvasContent.tsx** - Wire Rendering (Lines 59-89, 67)

**File:** `src/components/OneCanvas/content/CanvasContent.tsx`

**Risk Level:** 🔴 **HIGH**

**What it does:**
- Calculates wire endpoint positions for SVG rendering
- Renders the visual wire paths between ports
- Critical for wire geometry computation

**Code:**
```typescript
// Line 59-89: getPortPosition function
const getPortPosition = (blockId: string, portId: string) => {
  const block = blocks.get(blockId);
  if (!block) return null;
  
  const port = block.ports.find((p) => p.id === portId);
  if (!port) return null;
  
  const offset = port.offset ?? 0.5;  // Line 67
  let x = block.position.x;
  let y = block.position.y;
  
  switch (port.position) {
    case 'top':
      x += block.size.width * offset;
      break;
    case 'bottom':
      x += block.size.width * offset;
      y += block.size.height;
      break;
    case 'left':
      y += block.size.height * offset;
      break;
    case 'right':
      x += block.size.width;
      y += block.size.height * offset;
      break;
  }
  
  return { x, y };
};
```

**Usage:** Called at lines 104 and 108 to get wire endpoint positions for SVG path rendering.

**Impact if offset removed:** Wires will render from/to wrong positions, creating visual misalignment with ports.

---

### 4. **blockDefinitions.ts** - Port Data Definitions (Lines 69-255)

**File:** `src/components/OneCanvas/blockDefinitions.ts`

**Risk Level:** 🟡 **MEDIUM**

**What it does:**
- Defines default ports for each block type with explicit offset values
- Data layer: no computation, just configuration
- Offset values used: 0.25, 0.35, 0.5, 0.65, 0.75, 1.0

**Affected Block Types:**
- `scope` (lines 69-72): 4 channels at 0.25, 0.5, 0.75, 1.0
- `relay` (lines 98-100): COM at 0.5, NO at 0.35, NC at 0.65
- `motor` (lines 115-117): 3 phases at 0.25, 0.5, 0.75
- `selector_switch` (lines 134-135): 2 positions at 0.35, 0.65
- `transformer` (lines 179-182): Primary/secondary at 0.3, 0.7
- `terminal_block` (lines 208-215): 6 terminals at 0.25, 0.5, 0.75
- `contactor` (lines 228-235): Coil/contacts at 0.25, 0.75, and 0.25, 0.5, 0.75
- `overload_relay` (lines 250-255): Similar distribution

**Example:**
```typescript
scope: {
  size: { width: 100, height: 80 },
  defaultPorts: [
    { id: 'ch1', type: 'input', label: 'CH1', position: 'left', offset: 0.25 },
    { id: 'ch2', type: 'input', label: 'CH2', position: 'left', offset: 0.5 },
    { id: 'ch3', type: 'input', label: 'CH3', position: 'left', offset: 0.75 },
    { id: 'ch4', type: 'input', label: 'CH4', position: 'left', offset: 1.0 },
  ],
}
```

**Impact if offset removed:** Default port positions will be lost; blocks will have ports at center (0.5) only, breaking multi-port layouts.

---

### 5. **canvasHelpers.ts** - Wire Endpoint Direction (Line 322)

**File:** `src/components/OneCanvas/utils/canvasHelpers.ts`

**Risk Level:** 🔴 **HIGH**

**What it does:**
- Computes wire endpoint position and exit direction
- Used for wire path calculation and bend point generation
- Calls `getPortRelativePosition(port.position, port.offset ?? 0.5, block.size)`

**Code:**
```typescript
// Line 322
const relPos = getPortRelativePosition(port.position, port.offset ?? 0.5, block.size);
return {
  pos: { x: block.position.x + relPos.x, y: block.position.y + relPos.y },
  dir: exitDirection || port.position,
};
```

**Impact if offset removed:** Wire path calculation will fail; wires won't route correctly from/to ports.

---

### 6. **SpatialIndex.ts** - Spatial Indexing (Line 17)

**File:** `src/components/OneCanvas/utils/SpatialIndex.ts`

**Risk Level:** 🔴 **HIGH**

**What it does:**
- Builds spatial index for hit testing and collision detection
- Computes port world positions for spatial queries
- Used for selecting ports and detecting wire-port intersections

**Code:**
```typescript
// Line 11-41: getPortWorldPosition function
function getPortWorldPosition(block: Block, portId: string): Position | null {
  const port = block.ports.find((p) => p.id === portId);
  if (!port) return null;
  
  const portOffset = port.offset ?? 0.5;  // Line 17
  let x = block.position.x;
  let y = block.position.y;
  
  switch (port.position) {
    case 'top':
      x = block.position.x + block.size.width * portOffset;
      y = block.position.y;
      break;
    // ... other cases
  }
  
  return { x, y };
}
```

**Impact if offset removed:** Hit testing will fail; users won't be able to click on ports or connect wires accurately.

---

### 7. **wirePathCalculator.ts** - Wire Path Computation (Line 50)

**File:** `src/components/OneCanvas/utils/wirePathCalculator.ts`

**Risk Level:** 🔴 **HIGH**

**What it does:**
- Calculates absolute port position for wire path generation
- Computes Bezier curves and routing paths
- Core geometry calculation for wire rendering

**Code:**
```typescript
// Line 40-58: getPortAbsolutePosition function
export function getPortAbsolutePosition(
  block: Block,
  portId: string
): Position | null {
  const port = block.ports.find((p) => p.id === portId);
  if (!port) return null;
  
  const blockSize = block.size;
  const relativePos = getPortRelativePosition(
    port.position,
    port.offset ?? 0.5,  // Line 50
    blockSize
  );
  
  return {
    x: block.position.x + relativePos.x,
    y: block.position.y + relativePos.y,
  };
}
```

**Impact if offset removed:** Wire paths will be computed from wrong positions; all wires will render incorrectly.

---

### 8. **OneCanvasPanel.tsx** - Panel Wire Preview (Line 86)

**File:** `src/components/panels/content/OneCanvasPanel.tsx`

**Risk Level:** 🔴 **HIGH**

**What it does:**
- Calculates port positions for wire preview in the properties panel
- Shows visual feedback when user hovers over ports
- Mirrors the same offset-ratio calculation as main canvas

**Code:**
```typescript
// Line 75-105: getPortPosition function
function getPortPosition(components: Map<string, Block>, blockId: string, portId: string): Position | null {
  const block = components.get(blockId);
  if (!block) return null;
  
  const port = block.ports.find((p) => p.id === portId);
  if (!port) return null;
  
  const offset = port.offset ?? 0.5;  // Line 86
  switch (port.position) {
    case 'top':
      return { x: block.position.x + block.size.width * offset, y: block.position.y };
    case 'bottom':
      return { x: block.position.x + block.size.width * offset, y: block.position.y + block.size.height };
    case 'left':
      return { x: block.position.x, y: block.position.y + block.size.height * offset };
    case 'right':
      return { x: block.position.x + block.size.width, y: block.position.y + block.size.height * offset };
  }
}
```

**Impact if offset removed:** Panel wire preview will show incorrect positions; user feedback will be misleading.

---

## Test Files (Read-Only References)

The following test files reference `port.offset` but are **read-only** and do not compute positions:

- `utils/__tests__/buildCanonicalWirePolyline.test.ts:24` - Test fixture setup
- `utils/__tests__/wireGeometryRoundtrip.test.ts:28` - Test fixture setup

These will need to be updated to use new absolute coordinate format in Task 21.

---

## Migration Impact Summary

### High-Risk Consumers (9 files)
All of these **directly compute visual positions** from the offset ratio and will break immediately if offset is removed:

1. Port.tsx (visual rendering)
2. InteractionContext.tsx (wire interaction)
3. CanvasContent.tsx (wire rendering)
4. canvasHelpers.ts (wire geometry)
5. SpatialIndex.ts (hit testing)
6. wirePathCalculator.ts (path computation)
7. OneCanvasPanel.tsx (panel preview)
8. blockDefinitions.ts (data layer - 8 block types affected)

### Medium-Risk Consumers (1 file)
- blockDefinitions.ts (data layer - offset values must be converted to absolute coordinates)

### Pattern Consistency
All consumers use the **identical pattern**:
```typescript
const offset = port.offset ?? 0.5;
// Then: position = basePosition + dimension * offset
```

This consistency is **good for migration** - a single utility function can handle the conversion.

---

## Recommended Migration Strategy (Task 21)

1. **Create migration utility:**
   ```typescript
   // Convert offset ratio to absolute coordinate
   function offsetToAbsolute(offset: number | undefined, dimension: number): number {
     return dimension * (offset ?? 0.5);
   }
   ```

2. **Update Port interface:**
   ```typescript
   export interface Port {
     // ... other fields
     // offset?: number;  // ← REMOVE
     x?: number;  // ← ADD (absolute x within block)
     y?: number;  // ← ADD (absolute y within block)
   }
   ```

3. **Update all 9 consumers** to use absolute coordinates instead of offset ratio

4. **Update blockDefinitions.ts** to define ports with absolute coordinates

5. **Update test fixtures** to use new format

---

## Verification Checklist

- [x] Port interface definition located (types.ts:227)
- [x] All direct consumers identified (9 files)
- [x] All indirect consumers identified (blockDefinitions.ts)
- [x] Risk levels assigned
- [x] Code patterns documented
- [x] Test files noted
- [x] No source files modified
- [x] Git diff verified (0 changes)

---

## Conclusion

The `port.offset` field is a **critical dependency** used throughout the OneCanvas subsystem for computing visual port positions. All 11 consumers use the same offset-ratio formula and will require coordinated updates in Task 21 to migrate to absolute coordinates.

**Blast Radius:** VERY HIGH - affects core rendering, interaction, and geometry systems.

**Recommendation:** Treat Task 21 as a single atomic refactor affecting all 9 consumer files + blockDefinitions.ts simultaneously.
