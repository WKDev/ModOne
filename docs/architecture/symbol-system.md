# Symbol & Block System

How built-in symbols are defined, how a placed block derives its geometry, and
how symbols are serialized to/from XML. This reflects the consolidation work
done to make **XML the single source of truth** for built-in symbols.

> Scope note: this document describes the circuit-symbol pipeline
> (`assets/builtin-symbols`, `components/OneCanvas`, `services/symbolXmlParser`).
> Project/library symbol import-export and the IFTTT/ladder simulation engine
> are adjacent systems referenced only where they touch this one.

---

## 1. Built-in symbols: XML is the single source

Built-in symbols live as `.symbol.xml` files — the **same format as
user-authored symbols**. There is no parallel TypeScript copy.

```
src/assets/builtin-symbols/
├── index.ts          # builds BUILTIN_SYMBOLS by parsing the XML
└── xml/
    ├── relay.symbol.xml
    ├── fuse.symbol.xml
    └── … (45 files)
```

`index.ts` parses every XML at module load and exposes the registry:

```ts
const xmlModules = import.meta.glob('./xml/*.symbol.xml',
  { query: '?raw', import: 'default', eager: true });

export const BUILTIN_SYMBOLS: ReadonlyMap<string, SymbolDefinition> =
  /* parseSymbolXml(each file), keyed by symbol.id */;

// Block-type aliases (e.g. 'relay_coil' → 'builtin:relay') are kept here.
export function getBuiltinSymbolForBlockType(blockType: string): SymbolDefinition | undefined;
```

**Consumers** read through `getBuiltinSymbolForBlockType` /
`BUILTIN_SYMBOLS` — never individual files: the schematic renderer
(`symbolBridge`), block geometry (`symbolBlockDefAdapter`), `blockRegistry`,
serialization, and the simulation renderer.

The registry (`services/xmlSymbolRegistry`) is initialized once at startup via
`useXmlSymbolInit()` → `initBuiltins(BUILTIN_SYMBOLS)`. Project/user symbols are
layered on top via `loadProjectXml()` (project > builtin precedence).

### Why XML (and not the old `.ts` constants)

A symbol is not just geometry — it carries graphics, pins, properties,
behavior, **visual states** (state-driven appearance) and **animations**.
User symbols are already `.symbol.xml`. Making built-ins XML means built-in and
user symbols share **one format, one parser, one editor pipeline** — a built-in
is just a symbol. The former 45 `.ts` constants were a redundant second copy,
hand-synced to the XML by a 4-symbol parity test, and the two had silently
diverged (the XML was missing visual states for 10 interactive symbols).

---

## 2. Serialization: `symbolToXml` ↔ `parseSymbolXml`

`services/symbolXmlParser.ts` is the canonical serializer/parser pair for this
pipeline. It is a **lossless identity** for the full symbol model:

```
parseSymbolXml(symbolToXml(sym)) === sym   // modulo cosmetic object key order
```

This is locked for all 45 built-ins by `builtinXmlRoundtrip.test.ts`, and is
the guarantee that lets the XML files be regenerated from a `SymbolDefinition`
without data loss. It also fixes the editor save path (saving a symbol with
graphics-based visual states or animations previously dropped them).

Round-trip subtleties the serializer handles:

| Concern | Handling |
|---|---|
| Visual states (full-replacement `graphics` form, e.g. led `lit`) | emitted as `<ms:Graphics>` inside `<ms:VisualState>` |
| Animations (e.g. motor `running`) | emitted as `<ms:Animations>/<ms:StateAnimations>` |
| `pin.type` vs `pin.electricalType` | **not 1:1** (`power_in`→`power`, `power_out`→`output`) — stored as a distinct `type=""` attribute, not reconstructed from `electricalType` |
| `primitiveOverrides.transform` / `text` / `fontSize` | emitted (were parsed but not serialized) |
| `Layout` unit | `mm` (symbols are millimeter-native) |

> There are three other XML symbol parser/serializer modules
> (`services/xmlSymbolLoader`, `lib/symbolXmlParser`, `utils/xmlSymbolLoader`)
> used by project/library features. They are **not** unified yet; the built-in
> pipeline uses only `services/symbolXmlParser`.

---

## 3. Block geometry derives from the symbol

When a block is placed on the schematic it needs a size, default ports, and
default props. These are **derived from the built-in symbol** via
`utils/symbolBlockDefAdapter.ts` (`symbolDefToBlockDefinition`), not stored
separately.

`components/OneCanvas/blockDefinitions.ts` is now just the **override map** plus
the accessor functions:

```ts
getBlockDefinition(type)   // override map wins, else derive from the symbol, else throw
getBlockSize(type)
getDefaultPorts(type)
getDefaultBlockProps(type)
```

`BLOCK_DEFINITIONS` holds **only 11 intentional overrides** — block types with
no symbol, or whose placement geometry/props deliberately differ from their
symbol:

- `custom_symbol` — no symbol (user-instanced)
- `relay_coil`, `power_source`, `power_source_dc_2p` — simplified placement
  variants of their parent symbol
- `resistor`, `capacitor`, `inductor`, `connector`, `junction_box` — pin
  electrical types differ
- `plc_output`, `text` — default props differ

The override set was established by a **strict** comparison (size + ports incl.
type/offset/absolutePosition + property values) of every entry against its
symbol-derived definition; the other ~39 entries were byte-identical and were
deleted. Guarded by `xml-loader-integration.test.ts`. When editing the override
map, re-run that test.

> The override set was once 11; the 6 passive/connector/plc entries were removed
> after fixing the underlying symbols (connector pins → bidirectional; plc_out
> address `C:0x0000` → `DO:0x0000`), so they now derive correctly. Port `type`
> is safe to change: it doesn't gate wiring (no check in InteractionController)
> and only affects unconnected-port warning severity in ERC.

---

## 4. Editor input (shared canvas engine)

The Symbol editor and OneCanvas share input primitives from `@/canvas-core`:

- **Pointer**: `normalizePointer(viewport, coordSys, e)` → canonical
  `CanvasPointerInput` (world/snapped/screen/client + modifiers). `EventBridge`
  (OneCanvas) and `ToolInputBinding` (Symbol) both build on it but keep distinct
  dispatch (all-buttons FSM vs primary-only tool).
- **Keyboard**: `isEditableTarget(target)` is the single "is the user typing?"
  guard used by every keyboard handler. Keymaps stay distinct (Symbol = tool
  switch + per-tool `onKeyDown`; OneCanvas = command callbacks; Sheet =
  Delete/Escape). Delete-removes-selection + Escape-deselects is the shared
  convention across all three.
- **Selection chrome**: `canvas-core/selectionStyle` (`SELECTION_COLOR` =
  `0x4dabf7`, `SELECTION_HANDLE_STROKE`, `SELECTION_COLOR_CSS`) is the one source
  for selection outlines / handles / marquees — all three editors reference it,
  so selection looks identical everywhere.

Symbol editor command shortcuts (in `SymbolEditor.tsx`): `Ctrl+Z/Shift+Z/Y`
undo/redo, `Ctrl+A` select-all, `Ctrl+C/V/X/D` copy/paste(offset)/cut/duplicate.

---

## 5. Data flow summary

```
relay.symbol.xml  ──parseSymbolXml──▶  BUILTIN_SYMBOLS (Map<id, SymbolDefinition>)
                                          │
        getBuiltinSymbolForBlockType ◀────┤
                                          │
   render (symbolBridge / PIXI) ◀─────────┤
                                          │
   block geometry ◀── symbolBlockDefAdapter.symbolDefToBlockDefinition
                       (blockDefinitions getters; 11 overrides win)

editor save:  SymbolDefinition ──symbolToXml──▶ .symbol.xml   (lossless)
```

---

## 6. Change log (this consolidation effort)

| Commit | Change |
|---|---|
| `43feacc` | Migrate symbols + editor to **mm units** (single coordinate system) |
| `17585a5` | Scrap unused cross-editor `CanvasTool` (all symbols authored in Symbol editor) |
| `7b9bb85` | Extract shared `isEditableTarget` keyboard guard (4 handlers → 1 primitive) |
| `c4bdcaa` | Wire Symbol editor command shortcuts (clipboard, select-all; fix dead redo) |
| `028ed4f` | Derive block geometry from the symbol registry; `blockDefinitions` → 11 overrides |
| `e4ad3be` | `symbolToXml`: serialize visual-state graphics + animations (lossless save) |
| `08840dd` | `symbolToXml`: round-trip `pin.type` + override transform/text → lossless 45/45 |
| `6461d13` | **XML is the single source**: regenerate 45 `.symbol.xml`, build `BUILTIN_SYMBOLS` from XML, delete 45 `.ts` + stale generator |
| `c4acca2` | Drop redundant builtin-XML double-load in `useXmlSymbolInit` |

## 7. Known residuals / future work

- `useXmlSymbolInit` no longer overlays builtin XML; the registry builtin layer
  is `BUILTIN_SYMBOLS`. The override mechanism (`loadBuiltinXml`) remains on the
  registry but is unused by built-ins.
- Three other XML symbol parser/serializers (`services/xmlSymbolLoader`,
  `lib/symbolXmlParser`, `utils/xmlSymbolLoader`) are not unified.
- Latent symbol-data bugs in §3 (pin electrical types, plc_output address).
- Sheet editor migrated to the shared PIXI engine (`SheetCanvasHost`, Phase 3) —
  render / pan / zoom / grid / select / move / resize, live selection, fit-on-
  resize, and double-click inline text + table-cell editing (an HTML `<input>`
  overlay placed via the viewport world→screen transform). Resize is ported but
  not yet exercised by the QA harness.
