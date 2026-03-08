# XGWX Reverse Engineering Notes

## Current findings

- `.xgwx` starts with a small proprietary header containing the UTF-16 string `XG5000 WORKSPACE FILE`.
- All sampled files in `assets/ladder/education` have a GZip stream starting at offset `0x8A`.
- Decompressing that stream yields a UTF-8 XML project document.
- The ladder body is not stored as plain XML instructions.
- Ladder content lives under `POU > Programs > Program > Body > LDRoutine > ProgramData`.
- `ProgramData` is base64 text in XML, whose decoded bytes start with `BZh`, so it is a BZip2 payload.
- Function-block mnemonic strings themselves are present as plain UTF-16 text inside the payload, for example `TON,T0010,20`, `TOFF,T0011,30`, `CTU,C0000,10`, `CTD,C0000`, `CTR,C0000,0`, `MOV,C0000,D00000`.
- What remains unresolved is not the mnemonic text, but the exact binding between those plaintext instruction records and the visual/object records used by the editor.
- Decompressing `ProgramData` yields a binary blob, not CSV or XML. But the blob is not fully opaque: it contains embedded UTF-16 strings for rung comments, addresses, and mnemonic text.
- `RungTableData` exists but is empty in the sampled education files.
- `Symbols` is also base64 + BZip2 and likely contains symbol/device metadata in another binary format.

## Confirmed sample structure

1. XGWX outer header
2. GZip-compressed XML container
3. XML nodes with embedded base64 payloads
4. `ProgramData` base64 -> BZip2 -> binary ladder payload
5. `Symbols` base64 -> BZip2 -> binary symbol payload

## PRG relationship

`assets/ladder/education/NewProgram.prg` is the direct export format for an individual ladder program from XG5000.

For the `self-holding.xgwx` sample, using the user-supplied metadata:

- project name: `example-sh`
- CPU family/type: `XGB-XBCH`
- program name: `NewProgram`
- behavior: `P00000` turns on `P00020`, and `P00020` provides self-hold

The key reverse-engineering result is:

- `NewProgram.prg` contains a small wrapper header with UTF-16 strings such as `NewProgram`, `PROGRAM FILE VER 1.1`, and `LD VER 1.1`
- the actual ladder payload starts at offset `0x74`
- bytes `0x74..EOF` in `NewProgram.prg` are 4515 bytes long
- that length exactly matches the BZip2-decoded `ProgramData` payload from `self-holding.xgwx`
- the leading bytes also match: `00 00 00 00 E4 02 11 00 ...`

This means `.prg` is effectively the exported single-program wrapper around the same binary ladder payload stored inside `.xgwx`.

## Multi-program XGWX

`assets/ladder/education/parsing_example.xgwx` confirms that one workspace can contain multiple ladder programs.

Observed structure:

- project name in XML root text: `parsing_example`
- configuration name: `LSPLC`
- `Programs` contains 3 separate `Program` nodes:
  - `Interlock`
  - `TON_TOF`
  - `CTU_CTD`
- each `Program` node has its own `LDRoutine > ProgramData`
- the order of programs in XML matches the order shown by the exported `.prg` files

Decoded `ProgramData` sizes from the same workspace:

- `Interlock`: 986 bytes
- `TON_TOF`: 872 bytes
- `CTU_CTD`: 1416 bytes

These lengths exactly match the payload sizes of:

- `Interlock.prg` payload at `0x72`
- `TON_TOF.prg` payload at `0x6E`
- `CTU_CTD.prg` payload at `0x6E`

So the same rule generalizes:

- `.xgwx` stores one binary `ProgramData` blob per ladder program
- `.prg` exports that same blob with a short UTF-16 wrapper header

## Extraction status

### 1. `.xgwx` -> per-program `.prg`

This is solved for the current known sample family.

The local tool can now write extracted `.prg` files directly from an `.xgwx` workspace:

```powershell
cd C:\Users\chanh\Projects\ModOne\tools\xgwx-inspect
cargo run --offline -- extract-prg C:\Users\chanh\Projects\ModOne\assets\ladder\education\parsing_example.xgwx C:\Users\chanh\Projects\ModOne\tmp_extracted_prg
```

Verification result:

- extracted `Interlock.prg`, `TON_TOF.prg`, `CTU_CTD.prg` are byte-for-byte identical to the original exported `.prg` files
- SHA hashes match for all three files

This means the wrapper reconstruction is correct for these samples.

### 2. `.prg` -> element extraction

This is partially solved and improved by `RE_EXAMPLES.prg`.

The tool can dump UTF-16 text records from a `.prg` payload with offsets, nearby prefix bytes, and heuristic classes:

```powershell
cargo run --offline -- dump-text C:\Users\chanh\Projects\ModOne\assets\ladder\education\RE_EXAMPLES.prg
```

Currently extractable with confidence:

- rung comments / explanation text
- device/address records such as `P00000`, `M00001`, `T0011`, `C0000`, `D00000`
- function/mnemonic call strings such as `TON,T0010,20`, `TOFF,T0011,30`, `CTU,C0000,10`, `CTD,C0000,10`, `CTR,C0000,0`, `MOV,C0000,D00000`
- short mnemonic label strings such as `TON`, `TOFF`, `CTU`, `CTD`, `CTR`, `MOV`

## Inferred record-type mapping from `RE_EXAMPLES.prg`

`RE_EXAMPLES.prg` was intentionally arranged as minimal shape/type examples and gives strong evidence for several record families.

### Contact record families

From the first explanation block, the contact shape changes by rung while the coil remains fixed at `P00000`.

Observed order:

- `P00001` with prefix family `FF 06`
- `P00002` with prefix family `FF 07`
- `P00003` with prefix family `FF 08`
- `P00004` with prefix family `FF 09`

Given the author comment, the most likely mapping is:

- `FF 06` = normal A-contact (NO)
- `FF 07` = B-contact (NC)
- `FF 08` = positive-edge contact
- `FF 09` = negative-edge contact

### Coil record families

From the second explanation block, the contact is fixed at `P00000` and only coil types change.

Observed order:

- `P00001` with prefix family `FF 0E`
- `P00002` with prefix family `FF 0F`
- `P00003` with prefix family `FF 10`
- `P00004` with prefix family `FF 11`
- `P00005` with prefix family `FF 12`
- `P00006` with prefix family `FF 13`

Given the author comment, the most likely mapping is:

- `FF 0E` = normal coil
- `FF 0F` = inverted / reverse coil
- `FF 10` = `SET`
- `FF 11` = `RESET`
- `FF 12` = positive-transition detection coil
- `FF 13` = negative-transition detection coil

### Connector / wire families

The wire samples now support a much stronger interpretation.

Key differential files:

- `horizontal_only.prg`
- `horizontal_test.prg`
- `2contact_one_coil_2.prg`
- `ff01_5.prg`
- `ff01_6.prg`

Confirmed behavior:

- `FF 02` is the editor's normal auto-connector wire record.
  - It appears when the editor auto-fills the horizontal path between placed elements.
  - It can represent both short and long spans.
  - Its header carries coordinate-like data, and in longer runs its end coordinate changes with span length.
- `FF 01` is a manual single-tile horizontal wire record.
  - It appears when a short horizontal segment is explicitly inserted as a separate object.
  - It is repeatable, so a longer manual run can become a chain of multiple `FF 01` tiles.
  - It does not appear to carry the same explicit end-coordinate payload that `FF 02` does.

Observed examples:

- `horizontal_only.prg`
  - `FF 43 -> FF 02 -> FF 0E`
  - pure auto-connected rung from contact rail to coil
- `horizontal_test.prg`
  - long horizontal runs are stored as repeated `FF 02` records
  - confirms `FF 02` is the default horizontal wire family
- `ff01_5.prg`
  - same `contact -> contact -> coil` topology can be stored two ways
  - rung 1: first gap is `FF 02`
  - rung 2: first gap is `FF 01`
  - the user confirmed this difference comes from how the line was created, not from different geometry
- `ff01_6.prg`
  - rung 1: `FF 06 -> FF 01 -> FF 01 -> FF 06 -> FF 02 -> FF 0E`
  - rung 2: `FF 06 -> FF 01 -> FF 01 -> FF 01 -> FF 01 -> FF 01 -> FF 06 -> FF 02 -> FF 0E`
  - the user confirmed the middle horizontal tiles were inserted from the keyboard, while the final contact-to-coil connection was editor-generated

This gives the current working mapping:

- `FF 01` = manual single-tile horizontal wire
- `FF 02` = auto-connected horizontal wire / endpoint-aware connector

Important implication:

- `FF 01` and `FF 02` are both horizontal wire families
- the difference is not just span length
- the difference is also creation mode and whether the wire is stored as an explicit tile versus an editor-managed connector span

`comments_labels.prg` also gives the first clean text-annotation mapping:

- `FF 41` = step/rung label text record
- `FF 3F` = rung comment text record
- tags such as `[#TAG]` are plain text embedded directly in the `FF 3F` payload
- a bookmark-like row with no visible text is represented by an `FF 43` row whose leading flag byte differs (`01` instead of `00`) and has no following annotation record

So the old statement "`FF 02` is vertical-only" is rejected.
The better model is:

- `FF 02` is the default editor-generated horizontal connector family
- `FF 01` is the manual short horizontal tile family
- branch-heavy examples still need more decoding, but the dedicated `vertical_only.prg` sample now suggests that vertical connectors are not plain `FF 02` wire objects

### Vertical / branch structures

The dedicated vertical samples show that vertical linkage is encoded differently from ordinary horizontal wires.

Compared samples:

- `vertical_only.prg`
- `vertical_test.prg`
- the 9-line branch section inside `RE_EXAMPLES.prg`

Observed facts:

- `vertical_only.prg` contains only two `FF 43` row headers and no `FF 01`, `FF 02`, `FF 06`, or `FF 0E`
- `vertical_test.prg` contains:
  - upper row: `FF 43 -> FF 06(P00000) -> non-text blob -> FF 02 -> FF 0E(P00002)`
  - lower row: `FF 43 -> FF 06(P00001)`
- in `vertical_test.prg`, the blob immediately after the upper contact text is:
  - `00 00 00 00 00 02 00 03 00 00 ... 02 04 00 00 ...`
- the same structural pattern appears in the upper branch row of `RE_EXAMPLES.prg`, but with row-specific values:
  - `... 00 02 00 03 34 00 00 ... 02 38 00 00 ...`
- the lower branch row in `RE_EXAMPLES.prg` has a shorter leading blob before its first horizontal connector:
  - `01 00 00 00 00 03 34 00 00`

Current interpretation:

- a vertical connection is not serialized as a standalone `FF 01` or `FF 02` object
- the upper/source row stores a larger branch-link blob after the source object text
- that blob appears to contain at least:
  - branch column near the source row (`03` in the minimal example)
  - target row (`04` in `vertical_test.prg`, `38` in `RE_EXAMPLES.prg`)
- the lower/target row stores a shorter backlink-style blob that points back toward the source branch column and row
- the repeated `FF 02` records seen inside branch-heavy layouts are therefore horizontal bridge spans drawn on the participating rows, not the vertical line itself

The newer fan-in / fan-out samples strengthen this further:

- `1contatct_3coil.prg` (filename has a typo in the sample)
  - shows a source row with a forward-link blob to the next branch row
  - the middle row then carries both a backlink to the previous row and a forward-link to the next row
  - the last target row carries only the backlink-style trailer
- `3contact_1coil.prg`
  - shows the same row-to-row chaining pattern in the opposite logical direction
  - intermediate rows again contain both backward and forward branch metadata

This suggests the branch encoding is row-chain based rather than a single "branch object":

- top/source row: forward link
- middle row: backward + forward link
- bottom/terminal row: backward link only

Common byte motifs extracted so far:

- forward-only link blob
  - seen in `vertical_test.prg`, `1contatct_3coil.prg`, `3contact_1coil.prg`, and the upper branch row in `RE_EXAMPLES.prg`
  - core pattern looks like:
    - `00 00 00 00 00 02 00 <branch_x> <src_y> ... 00 <branch_x-1> <dst_y> ...`
  - examples:
    - `vertical_test.prg`: `00 00 00 00 00 02 00 03 00 ... 00 02 04 00 ...`
    - `1contatct_3coil.prg`: `00 00 00 00 00 02 00 06 00 ... 00 05 04 00 ...`
    - `3contact_1coil.prg`: `00 00 00 00 00 02 00 09 00 ... 00 08 04 00 ...`
- backward-only link blob
  - seen on terminal target rows
  - core pattern looks like:
    - `01 00 00 00 00 <branch_x> <prev_y> 00 00`
  - examples:
    - `RE_EXAMPLES.prg` lower row: `01 00 00 00 00 03 34 00 00`
    - `1contatct_3coil.prg` last row: `01 00 00 00 00 06 04 00 00`
- middle-row combined blob
  - begins with the backward motif, then appends a forward motif
  - examples:
    - `1contatct_3coil.prg` middle row: `01 00 00 00 00 06 00 00 ... 02 00 06 04 00 ... 05 08 00 ...`
    - `3contact_1coil.prg` middle row: `01 00 00 00 00 09 00 00 ... 02 00 09 04 00 ... 08 08 00 ...`

Working field interpretation:

- `<branch_x>` = branch column on the current/source row
- `<src_y>` / `<prev_y>` = source row Y
- `<dst_y>` = next linked row Y
- `<branch_x-1>` appears in forward-link blobs and may identify the vertical line's visual column relative to the horizontal anchor

Provisional byte layout:

- forward-only blob, length 27 bytes
  - `[0..4]` = reserved / zero padding
  - `[5..6]` = `02 00` marker
  - `[7]` = `branch_x`
  - `[8]` = `src_y`
  - `[9..16]` = reserved / zero padding
  - `[17]` = `branch_x - 1`
  - `[18]` = `dst_y`
  - `[19..26]` = reserved / zero padding
- backward-only blob, length 9 bytes
  - `[0]` = `01` marker
  - `[1..4]` = reserved / zero padding
  - `[5]` = `branch_x`
  - `[6]` = `prev_y`
  - `[7..8]` = reserved / zero padding
- middle-row blob
  - starts with the 9-byte backward-only form
  - then appends the 27-byte forward-only form
  - some samples appear to carry an additional short trailer after the combined blob, which is still unresolved

This still needs final confirmation, but the motifs are now stable across the dedicated branch samples.
`branch_variant_2.prg` adds one more important result: when the branch is extended vertically across more rows, XG5000 does not appear to stretch a single vertical-wire object. Instead, it inserts additional header-only intermediary rows (`FF 43` with no following contact/coil record), and the branch metadata is carried forward row by row. This strongly supports the row-chain model over any single-object vertical-wire model.
`branch_variant.prg` further supports the field interpretation because the same two-row branch motif repeats while the branch is shifted horizontally.
The embedded values that look like branch columns move in a regular `+3` pattern (`06`, `09`, `0C`, `0F`, ...), while the paired row `Y` values also advance predictably. This is strong evidence that the blob stores actual grid coordinates rather than opaque IDs.

So the vertical model should now be:

- horizontal wires: `FF 01` and `FF 02`
- vertical links / branch membership: non-text row/object link blobs adjacent to contacts or row headers

### Rung header family

The same differential samples also made `FF 43` more interpretable.

Observed trailing values in `FF 43` headers:

- `horizontal_only.prg`: `... 00 01 00 00 00 02 00`
- `2_contact_one_coil.prg`: `... 00 04 00 00 00 04 00`
- `2contact_one_coil_2.prg`: `... 00 07 00 00 00 05 00`

The last value tracks the number of drawable objects in the rung very closely:

- 2 objects in `horizontal_only` (`FF 02`, `FF 0E`)
- 4 objects in `2_contact_one_coil` (`FF 06`, `FF 06`, `FF 02`, `FF 0E`)
- 5 objects in `2contact_one_coil_2` (`FF 06`, `FF 01`, `FF 06`, `FF 02`, `FF 0E`)

The preceding value tracks the rightmost pre-output logic position:

- `1` in `horizontal_only`
- `4` in `2_contact_one_coil`
- `7` in `2contact_one_coil_2`

This suggests that `FF 43` is a rung header / bounds record that also stores at least:

- rung row / Y position
- rightmost logic column before the output zone
- drawable-object count in the rung

### FF43 row-role heuristics

Across `vertical_test.prg`, `branch_variant.prg`, `branch_variant_2.prg`, `1contatct_3coil.prg`, `3contact_1coil.prg`, and `comments_labels.prg`, the last 7 bytes of the visible `FF 43` header body behave consistently enough to use as a provisional signature.

Visible tail shape:

- `00 <anchor_x> <row_y> 00 00 <row_metric> 00`

Working interpretation:

- `<anchor_x>` tracks the branch/header anchor column for that row
- `<row_y>` is the row position on the ladder grid
- `<row_metric>` is not a pure role flag; it behaves like a content/complexity count that varies with row contents

Practical role heuristics currently work better when combining the `FF 43` tail with the next opcode:

- annotation row
  - next opcode is `FF 41` or `FF 3F`
  - examples: `comments_labels.prg`
- empty intermediary branch row
  - next opcode is another `FF 43`
  - no text/device records follow
  - tail commonly looks like `00 03 <row_y> 00 00 02 00`
  - examples: `branch_variant_2.prg`
- populated source/logic row
  - next opcode is `FF 06`/`FF 07`/`FF 08`/`FF 09`
  - tail metric varies with row contents (`04`, `05`, `06`, `07`, `0A`, `0B`, ...)
- connector-led target row
  - next opcode is `FF 02`
  - tail often ends with `03` or `04` depending on whether the row is terminal or still participates in a longer chain

So the current evidence suggests:

- `FF 43` tail contains both coordinate and content-count information
- row role cannot yet be read from a single byte alone
- row role is best inferred from `FF 43` tail plus the first following record family

## Remaining RE targets

The next reverse-engineering work should focus on the data that is still not explained by the confirmed wire/contact/coil/branch mapping.

1. Branch row-role formalization
   - derive explicit row-role enums for `FF 43` rows: source, middle, terminal, empty intermediary, and non-branch ordinary rows
   - confirm which `FF 43[24..30]` fields are role flags versus coordinate/count fields
2. Branch link blob completion
   - resolve the short trailer bytes that sometimes follow the combined middle-row blob
   - verify whether fan-in and fan-out use the exact same forward/backward blob layout or only the same motifs
3. Coordinate decoding
   - formalize the exact field layout of `FF 43`, `FF 01`, and `FF 02`
   - convert the current byte-level observations into explicit `(x, y)` or `(x1, y1) -> (x2, y2)` decoding rules
4. Comment, label, bookmark attachment
   - determine how `FF 3F`, `FF 41`, and bookmark-like `FF 43` rows are anchored semantically
   - verify whether bookmark state is stored only in `FF 43` flags or also reflected in another project payload
5. Symbols and metadata
   - decode `Symbols` enough to connect device metadata, aliases, and descriptions back to ladder objects
   - confirm whether symbol comments are row-bound, device-bound, or stored in a separate lookup table
6. Input-method sensitivity
   - continue checking whether XG5000 stores different record variants for keyboard insertion versus mouse insertion versus automatic completion
   - this is especially relevant for wires and branch creation

Across the current education-sample corpus, most non-function graphical families now fall into one of these buckets:

- row/header and row-role records: `FF 43`
- horizontal wires: `FF 01`, `FF 02`
- contacts/coils: `FF 06`..`FF 13`
- text annotations: `FF 3F`, `FF 40`, `FF 41`
- branch linkage: non-text row-chain blobs adjacent to rows/objects

This means the remaining unknowns in the current track are mostly field-level interpretations, not large missing object families.

## Deferred track

Function block geometry is intentionally deferred.
It should be treated as a separate RE track driven by PDF/manual correlation rather than by the current ladder sample set alone.
That includes visual/object decoding for `TON`, `TOFF`, `CTU`, `CTD`, `CTR`, and `MOV`.

## Payload-level observations

The decoded ladder payload contains repeated structured records with embedded UTF-16 strings.

Confirmed string classes inside payloads:

- rung comments like `[Rung 0] - ...`
- device addresses like `P00030`, `T0011`, `C0000`, `D00000`, `F00099`
- mnemonic text like `TON,T0010,20`, `TOFF,T0011,30`, `CTU,C0000,10`, `CTD,C0000`, `MOV,C0000,D00000`

Important counter detail from `CTU_CTD.prg`:

- the counter reset rung appears in payload as `CTR,C0000,0`
- so XG5000's internal mnemonic for the reset-style counter operation is `CTR` in this sample set

Common recurring marker pattern near strings:

- `FF FE FF <len> <UTF-16LE string bytes>`

Frequent prefix patterns now observed:

- `FF 06 ... <device>`
- `FF 07 ... <device>`
- `FF 08 ... <device>`
- `FF 09 ... <device>`
- `FF 0E ... <device>`
- `FF 0F ... <device>`
- `FF 10 ... <device>`
- `FF 11 ... <device>`
- `FF 12 ... <device>`
- `FF 13 ... <device>`
- `FF 3F ... <rung/explanation comment>`
- `FF 40 ... <output comment>`
- `FF 02 ...` repeated connector-like records

These strongly suggest typed record variants embedded inside a larger binary object model.

## Practical implication

Yes, reverse engineering is feasible.

At this point:

- workspace-level separation is reliable
- single-program payload extraction is reliable
- string-bearing element discovery is reliable
- contact and coil variant families are mostly mapped
- vertical-wire family is strongly indicated
- full graphical object reconstruction still needs one more RE pass over non-string record fields

## Local tool

A local inspection tool was added at:

- `tools/xgwx-inspect`

Supported commands:

```powershell
cd C:\Users\chanh\Projects\ModOne\tools\xgwx-inspect
cargo run --offline -- C:\Users\chanh\Projects\ModOne\assets\ladder\education\parsing_example.xgwx
cargo run --offline -- C:\Users\chanh\Projects\ModOne\assets\ladder\education\Interlock.prg
cargo run --offline -- extract-prg C:\Users\chanh\Projects\ModOne\assets\ladder\education\parsing_example.xgwx C:\Users\chanh\Projects\ModOne\tmp_extracted_prg
cargo run --offline -- dump-text C:\Users\chanh\Projects\ModOne\assets\ladder\education\RE_EXAMPLES.prg
cargo run --offline -- dump-records C:\Users\chanh\Projects\ModOne\assets\ladder\education\horizontal_only.prg C:\Users\chanh\Projects\ModOne\assets\ladder\education\2_contact_one_coil.prg C:\Users\chanh\Projects\ModOne\assets\ladder\education\2contact_one_coil_2.prg
```

## Sample observations

- `self-holding.xgwx`: ProgramData decoded to 4515 bytes
- `timer.xgwx`: ProgramData decoded to 5081 bytes
- `counter.xgwx`: ProgramData decoded to 6084 bytes
- `종합응용.xgwx`: ProgramData decoded to 9638 bytes
- `종합응용2.xgwx`: ProgramData decoded to 10458 bytes

This size progression is consistent with ladder complexity increasing across examples.

## Next reverse-engineering targets

- identify the horizontal wire record family
- verify contact/coils mappings against one more confirmation sample each
- split `ProgramData` into stable record boundaries instead of just string-bearing anchors
- map non-string geometry fields to grid coordinates
- correlate branch/interlock structure with binary offsets in `Interlock.prg`
- decode `Symbols` to recover device names/comments/address tables
- verify how XG5000 distinguishes display mnemonic text from executable instruction records

















