# Rockbox Designer
## Codex Desktop Execution Plan

**Repository:** `mrbarkan/RockBox-Designer`  
**Primary objective:** Build a browser-based, source-compatible WYSIWYG editor for Rockbox themes, with a Canva-like visual workflow and progressively more accurate Rockbox simulation.  
**Primary implementation language:** TypeScript  
**Current application stack:** React + Vite  
**Document purpose:** This file is the implementation contract for Codex Desktop. It defines architecture, boundaries, execution phases, commands, tests, deliverables, and acceptance criteria.

---

## 1. Instructions to Codex

Read this entire document before changing code.

Work through the phases sequentially. Do not treat this as one giant refactor. Every phase must leave the repository in a buildable, testable state and must end with:

1. A focused Git branch.
2. A small set of logically related commits.
3. Passing validation commands.
4. Updated implementation-status documentation.
5. A clear summary of what changed, what remains unsupported, and any decisions that require human review.
6. A draft pull request unless explicitly told to keep the changes local.

Do not proceed to the next phase when the current phase’s acceptance criteria are failing.

### Default working behavior

- Inspect the repository and current Git state before editing.
- Do not overwrite or discard unrelated user changes.
- Prefer incremental migration over a full rewrite.
- Do not redesign the interface during parser-foundation work.
- Do not guess Rockbox syntax or behavior.
- When documentation and implementation disagree, treat the current Rockbox source code as the reference and record the discrepancy.
- Preserve unsupported syntax exactly rather than rejecting or silently normalizing it.
- Add tests before or alongside behavior changes.
- Keep production dependencies minimal.
- Do not add AI generation to the core parsing, rendering, validation, or export pipeline.
- Never claim full Rockbox compatibility based only on synthetic examples.
- Do not represent USB, hold, quick-screen, or complete system-menu customization as standard theme capabilities unless verified in Rockbox source.
- Do not copy GPL Rockbox source directly into this repository without first documenting the licensing implications and obtaining an explicit project licensing decision.

---

## 2. How David should run this plan in Codex Desktop

### Initial setup

1. Clone or open:

   ```bash
   git clone https://github.com/mrbarkan/RockBox-Designer.git
   cd RockBox-Designer
   ```

2. Open the repository folder in Codex Desktop.

3. Confirm the current branch and working tree:

   ```bash
   git status --short --branch
   ```

4. Check whether the previously created branch exists:

   ```bash
   git branch --all | grep phase-1-parser-foundation
   ```

   A branch named `agent/phase-1-parser-foundation` may already exist and may contain no implementation changes. Codex may reuse it for Phase 0 and Phase 1A if it is clean and based on current `main`. Otherwise, create a fresh branch.

5. Give Codex this kickoff instruction:

   > Read `ROCKBOX_DESIGNER_CODEX_EXECUTION_PLAN.md` completely. Inspect the repository and execute **Phase 0 only**. Do not start Phase 1A until Phase 0 acceptance criteria pass. Preserve unrelated work, run all required checks, update the status documents, commit the result, and prepare a draft pull request.

6. After reviewing and merging each phase, use the phase-specific prompt included later in this document.

### Recommended branch strategy

Use one branch and one pull request per milestone:

```text
codex/phase-0-foundation
codex/phase-1a-lossless-syntax
codex/phase-1b-ast-editing
codex/phase-1c-theme-packages
codex/phase-1d-tag-registry
codex/phase-1e-device-profiles
codex/phase-1f-reference-validation
codex/phase-1g-real-theme-fixtures
codex/phase-2-wps-editor
...
```

Do not accumulate all phases into one long-lived branch. Later phases must start from the latest merged `main`.

---

## 3. Product definition

Rockbox Designer is intended to become a browser-based authoring environment for Rockbox themes.

The target user should be able to:

- Start from a device profile.
- Import an existing Rockbox theme ZIP.
- Edit WPS, SBS, and FMS screens visually.
- Inspect and edit the underlying Rockbox source.
- Drag, align, resize, group, lock, and organize logical or visual layers.
- Use built-in components for battery, playback, shuffle, repeat, progress, volume, album art, metadata, and other common elements.
- Convert suitable TTF or OTF fonts into Rockbox `.fnt` assets.
- Preview conditional states such as playing, paused, charging, hold, volume changes, repeat modes, USB presence, FM states, and metadata changes.
- Validate compatibility against a selected Rockbox target.
- Export a deterministic, installable theme ZIP.
- Later, preview or run a fuller Rockbox simulator.
- Eventually generate optional custom-firmware patches for screens that cannot be fully replaced through standard themes.

### 3.1 Two explicit product modes

The application must eventually distinguish between:

#### Theme Mode

Produces standard Rockbox theme files and assets:

- `.cfg`
- `.wps`
- `.sbs`
- `.fms`
- bitmap assets
- fonts
- iconsets where applicable

Theme Mode must not imply that every Rockbox screen can be redesigned arbitrarily.

#### Firmware Mode

Produces theme assets plus optional Rockbox source modifications, build instructions, or patches for behavior that is compiled into firmware.

Potential Firmware Mode targets include:

- Built-in USB fallback logo or placement beyond what SBS can theme
- Deeper quick-screen layout changes
- Hold-screen behavior beyond theme conditionals
- Complete system UI simulation or modification
- Device-specific source changes

Firmware Mode is a later phase and is not part of Phase 1.

---

## 4. Current repository assessment

Codex must verify this assessment against the actual checked-out repository before relying on it.

At the time this plan was written, the project had:

- React 19
- Vite 6
- TypeScript
- A central `App.tsx`
- A visual `EditorCanvas`
- A source editor
- Theme ZIP import/export
- An early Rockbox AST parser
- An AST serializer
- AST editing helpers
- Basic WPS, SBS, and FMS support
- A simulation-state model
- Preset assets and simple component generation
- A dependency on Gemini for generative layout features
- No mature parser test suite
- No authoritative compatibility test harness

### Known architectural problems to verify

1. **The AST parser is not lossless.**
   - It splits and reconstructs arguments.
   - It does not preserve all original delimiters, spacing, comments, escapes, or malformed source.
   - Complex nested expressions can be interpreted incorrectly.

2. **The serializer guesses syntax.**
   - It chooses delimiter style from hard-coded tag sets.
   - Untouched source can be reformatted or changed during export.
   - Editing one node may alter unrelated syntax.

3. **Conditionals are modeled too simply.**
   - A conditional test may itself contain a parameterized expression such as `%?if(...)<...>`.
   - Nested conditionals and branch separators require context-sensitive parsing.

4. **The semantic layer and syntax layer are mixed.**
   - Visual elements, AST nodes, import parsing, and render behavior overlap.
   - The application needs a strict separation between source syntax, semantic interpretation, and visual rendering.

5. **The device model is hardcoded.**
   - The target type may be restricted to `ipod_video`.
   - Device dimensions and capabilities must come from device profiles.

6. **AST interfaces may be duplicated.**
   - Consolidate types without introducing an unrelated repository-wide rewrite.

7. **Theme package handling is not binary-safe enough.**
   - Images, fonts, and other resources should be represented as binary assets, not permanently as browser data URLs.
   - Object URLs or decoded images should be derived UI state.

8. **Import/export coverage is incomplete.**
   - Verify `.cfg` parsing for WPS, SBS, and FMS.
   - Verify path handling, comments, case sensitivity, nested folders, and missing assets.
   - Verify deterministic ZIP output.

9. **The official Rockbox tag table is not the source of the app’s tag definitions.**
   - The tag registry should be generated from or checked against Rockbox source.

10. **No clear compatibility contract exists.**
    - The application needs explicit levels such as:
      - preserved
      - parsed
      - semantically interpreted
      - visually rendered
      - editable
      - validated against official parser

---

## 5. Core architectural principles

These principles are mandatory unless an Architecture Decision Record explicitly replaces one.

### 5.1 Source is authoritative

The original Rockbox source is the canonical document.

Visual editing is a projection over that document. The app must never reduce a source file to only a flat array of visual elements and then regenerate the whole file from that approximation.

### 5.2 Exact round-trip preservation

For an untouched document:

```ts
serialize(parse(source)) === source
```

This comparison must be byte-for-byte after decoding with the detected text encoding and preserving the detected newline convention.

The parser must preserve:

- Comments
- Blank lines
- Spaces and tabs
- Line endings
- Escaped characters
- Argument delimiter style
- Raw argument formatting
- Unknown tags
- Unsupported tags
- Malformed or incomplete expressions
- Conditional branch formatting
- Original tag case
- Original asset paths
- Non-ASCII text

### 5.3 Concrete syntax tree first

Use a lossless Concrete Syntax Tree, or CST, for source preservation.

A semantic AST can be derived from the CST, but it must not replace it.

Recommended relationship:

```text
Raw source
   ↓
Tokenizer / lossless parser
   ↓
Concrete Syntax Tree
   ├── exact serializer
   ├── diagnostics
   ├── source editor
   └── semantic interpreter
          ├── render operations
          ├── visual layers
          ├── compatibility checks
          └── inspector properties
```

### 5.4 Unknown does not mean invalid

If the browser parser does not understand a construct, preserve it and expose it as an unsupported or source-only node.

Do not delete it.  
Do not replace it.  
Do not silently move it.  
Do not block the whole theme from opening.

### 5.5 Separate parsing, semantics, rendering, and editing

The modules must have distinct responsibilities:

- **Syntax parser:** identifies source structure and preserves raw text.
- **Semantic interpreter:** understands known Rockbox constructs.
- **Renderer:** turns interpreted operations into pixels.
- **Editing commands:** apply narrow, source-aware updates.
- **Validator:** compares syntax and target capabilities.
- **Package importer/exporter:** handles ZIP and assets.
- **UI:** presents and manipulates these systems.

### 5.6 Immutable edits

Editing commands return new documents and must not mutate the previous document.

### 5.7 Deterministic output

Given the same project state, exports must produce identical logical contents, file names, source files, and asset paths.

If ZIP timestamps make binary equality impractical, normalize timestamps or compare the decompressed file manifest and bytes.

### 5.8 Target-specific behavior is data

Do not scatter checks such as `target === "ipod_video"` across the UI.

Use a `DeviceProfile` and capability queries.

### 5.9 Official-source verification

When uncertain, inspect current Rockbox source, especially:

```text
lib/skin_parser/tag_table.c
lib/skin_parser/tag_table.h
lib/skin_parser/skin_parser.c
lib/skin_parser/skin_scan.c
apps/gui/skin_engine/skin_parser.c
apps/gui/statusbar-skinned.c
apps/radio/radio_skin.c
apps/gui/usb_screen.c
apps/gui/quickscreen.c
tools/convttf.c
uisimulator/
utils/themeeditor/
```

Record the upstream Rockbox commit SHA used for registry generation and compatibility work.

---

## 6. Proposed module layout

Do not move every current file immediately. Build the new core alongside the old implementation and migrate callers incrementally.

Recommended structure:

```text
rockbox/
  syntax/
    types.ts
    tokenizer.ts
    parser.ts
    serializer.ts
    diagnostics.ts
    sourceText.ts
    newline.ts
    spans.ts
    index.ts

  editing/
    commands.ts
    paths.ts
    updateTag.ts
    updateText.ts
    updateViewport.ts
    updateImage.ts
    index.ts

  semantics/
    types.ts
    interpreter.ts
    conditionals.ts
    viewports.ts
    images.ts
    text.ts
    bars.ts
    albumArt.ts
    index.ts

  registry/
    types.ts
    generated/
      rockbox-tags.json
    tagRegistry.ts
    compatibility.ts
    index.ts

  devices/
    types.ts
    profiles/
      ipod-video.ts
      ipod-classic.ts
    registry.ts
    index.ts

  packages/
    types.ts
    cfgParser.ts
    themeImporter.ts
    themeExporter.ts
    assetStore.ts
    paths.ts
    manifest.ts
    index.ts

  validation/
    browserValidator.ts
    officialValidator.ts
    reports.ts
    index.ts

  render/
    types.ts
    renderList.ts
    canvasRenderer.ts
    fonts.ts
    bitmaps.ts
    index.ts

  testing/
    fixtures.ts
    assertions.ts
    snapshots.ts

scripts/
  generate-rockbox-tag-registry.mjs
  verify-rockbox-tag-registry.mjs

tests/
  fixtures/
    syntax/
    packages/
    themes/
  syntax/
  editing/
  packages/
  registry/
  devices/

docs/
  IMPLEMENTATION_STATUS.md
  ARCHITECTURE.md
  DECISIONS.md
  COMPATIBILITY_MATRIX.md
  PARSER_LIMITATIONS.md
  UPSTREAM_ROCKBOX.md
```

If the current project convention requires `src/`, place these directories under `src/`. Do not create two competing roots.

---

## 7. Repository-level `AGENTS.md`

Phase 0 must add a concise `AGENTS.md` at the repository root. Codex reads repository-level `AGENTS.md` instructions before work, so this file should contain stable engineering rules rather than the entire roadmap.

Suggested contents:

```md
# Rockbox Designer — Agent Instructions

## Product contract

Rockbox Designer is a browser-based visual editor for Rockbox themes. The original Rockbox source is authoritative. Visual state is a projection over a lossless source document.

## Required behavior

- Preserve unknown, unsupported, malformed, and future Rockbox syntax.
- Untouched source must round-trip exactly.
- Do not guess Rockbox behavior; consult current Rockbox source and record the upstream commit SHA.
- Keep syntax parsing, semantic interpretation, rendering, editing, validation, and ZIP packaging separate.
- Do not flatten imported themes into only visual elements.
- Do not represent USB or full quick-screen redesign as standard theme functionality without source verification.
- Do not vendor GPL Rockbox code without an explicit licensing decision.
- Avoid unrelated UI refactors during core-engine work.

## Validation before every pull request

Run:

```bash
npm run typecheck
npm test
npm run build
```

Run fixture, package, or visual-regression commands when the changed area provides them.

## Git and documentation

- Preserve unrelated user changes.
- Use focused branches and commits.
- Update `docs/IMPLEMENTATION_STATUS.md`.
- Add an ADR entry in `docs/DECISIONS.md` for architectural changes.
- Document unsupported behavior instead of hiding it.
```

Keep `AGENTS.md` comfortably below Codex’s project-instruction size limit. Keep this execution plan in its own file.

---

# PHASE 0 — Repository stabilization and execution scaffolding

## Goal

Create a reliable development baseline before replacing parser behavior.

## Scope

Phase 0 is infrastructure only. Do not rewrite the parser yet.

## Tasks

### 0.1 Audit the repository

Codex must inspect:

- `package.json`
- lockfile
- TypeScript configuration
- Vite configuration
- current test configuration, if any
- `types.ts`
- `services/rockboxAst.ts`
- `services/rockboxAstSerializer.ts`
- `services/rockboxAstEditor.ts`
- `services/rockboxParser.ts`
- `services/rockboxCompiler.ts`
- `components/EditorCanvas.tsx`
- project import/export flow
- current branch history and open work

Create `docs/IMPLEMENTATION_STATUS.md` with:

- Current architecture
- Known parser and package risks
- Existing features that must not regress
- Phase currently in progress
- Latest passing validation
- Known blockers

### 0.2 Add stable package scripts

At minimum:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "validate": "npm run typecheck && npm test && npm run build"
  }
}
```

Add only the dependencies required for Phase 0 and Phase 1 parser tests.

Recommended:

- `vitest`
- `@vitest/coverage-v8`
- `fast-check` for later property tests
- `jszip` as a production dependency when global JSZip replacement begins

Playwright is not required until browser interaction or visual rendering phases.

### 0.3 Establish a baseline test

Add a minimal smoke test proving that the test runner works.

Do not write tests that assert known-bad parser behavior as the desired contract.

### 0.4 Add documentation skeleton

Create:

```text
docs/ARCHITECTURE.md
docs/DECISIONS.md
docs/COMPATIBILITY_MATRIX.md
docs/PARSER_LIMITATIONS.md
docs/UPSTREAM_ROCKBOX.md
```

`docs/UPSTREAM_ROCKBOX.md` should contain:

- Upstream repository
- Current inspected commit SHA
- Date inspected
- Relevant source paths
- How to update the reference
- Licensing note

### 0.5 Record baseline behavior

Run:

```bash
npm install
npm run typecheck
npm test
npm run build
```

If the current repository fails before changes:

- Record the failure.
- Fix only failures needed to establish the baseline.
- Do not conceal pre-existing issues.
- Distinguish pre-existing failures from new failures in the PR summary.

## Phase 0 acceptance criteria

- `AGENTS.md` exists.
- Test runner executes.
- `npm run typecheck` passes.
- `npm test` passes.
- `npm run build` passes.
- Documentation skeleton exists.
- No parser behavior has been intentionally changed.
- No unrelated UI redesign is included.
- A draft pull request clearly states the baseline.

## Phase 0 prompt for Codex Desktop

> Read `ROCKBOX_DESIGNER_CODEX_EXECUTION_PLAN.md`. Execute Phase 0 only. Audit the current repository, add `AGENTS.md`, establish Vitest and package scripts, create the documentation skeleton, record the current Rockbox upstream reference, and make the existing project pass typecheck, tests, and production build. Do not begin parser replacement. Preserve unrelated changes. Commit the result and prepare a draft PR with baseline findings.

---

# PHASE 1A — Lossless Rockbox syntax engine

## Goal

Replace the current approximation parser with a lossless syntax layer that can import and re-export untouched source exactly.

## Non-goals

- Pixel rendering
- Complete semantic interpretation
- UI redesign
- Full official parser integration
- Device simulator
- Font conversion

## Required syntax model

The parser must preserve raw source slices and source spans.

A possible model:

```ts
export type SourceSpan = {
  start: number;
  end: number;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export type RockboxDocument = {
  kind: "document";
  source: string;
  newline: "\n" | "\r\n" | "\r";
  nodes: RockboxNode[];
  diagnostics: Diagnostic[];
  dirty: boolean;
};

export type RockboxNode =
  | TextNode
  | EscapeNode
  | CommentNode
  | TagNode
  | ConditionalNode
  | InvalidNode;

export type BaseNode = {
  id: string;
  span: SourceSpan;
  raw: string;
  dirty: boolean;
};

export type TagNode = BaseNode & {
  kind: "tag";
  name: string;
  invocationStyle: "none" | "parentheses" | "pipe" | "legacy";
  rawArguments: string;
  argumentTokens?: ArgumentToken[];
};

export type ConditionalNode = BaseNode & {
  kind: "conditional";
  test: TagNode | InvalidNode;
  openRaw: string;
  branches: RockboxDocument[];
  separators: string[];
  closeRaw: string;
};
```

This is illustrative, not mandatory. The contract matters more than exact names.

### Important design rule

Do not semantically split every argument during initial syntax parsing.

The syntax parser’s first responsibility is to identify and preserve the exact invocation region. Known-tag argument decoding belongs in a separate semantic helper driven by the Rockbox tag registry.

This prevents syntax corruption in constructs whose argument grammar is tag-specific.

## Tokenizer requirements

The tokenizer must correctly distinguish:

- Plain text
- Newlines
- Comments
- `%` tag introducers
- `%%` and other legal escapes
- Tags without arguments
- Parenthesis invocation
- Pipe invocation
- Conditional introducers `%?`
- Conditional branch boundaries
- Nested conditionals
- Escaped branch separators
- Delimiters inside nested tag arguments
- Unterminated constructs
- Unknown tags

Do not use a single regular expression as the full parser.

## Conditional requirements

The conditional test must be represented structurally.

Examples to support:

```text
%?mp<playing|paused|stopped>
%?if(%pv, =, -90)<muted|audible>
%?mh<hold|%?mp<playing|paused>>
```

The parser must not treat everything between `%?` and `<` as an opaque tag name.

Branch separators count only when:

- They are inside the active conditional.
- They are at the current branch depth.
- They are not escaped.
- They are not inside a nested conditional.
- They are not part of an argument region.

## Error recovery

Malformed source must still produce a document.

Examples:

- Missing `>`
- Missing closing `)`
- Missing closing `|`
- Unknown tag
- Incomplete `%`
- Empty conditional branch
- Unexpected branch separator

Diagnostics must include:

- Severity
- Code
- Message
- Source span
- Optional recovery description

The serializer must preserve malformed raw source unless an explicit editing command changes it.

## Serializer contract

For a clean node, return `node.raw`.

For a dirty known node, regenerate only that node using its preserved invocation style and formatting metadata.

For a dirty container, regenerate only the smallest necessary containing region.

Do not rebuild the entire document from normalized values.

## Required tests

Create exact round-trip fixtures covering at least:

1. Plain text
2. Comments and blank lines
3. LF and CRLF
4. UTF-8 metadata text
5. No-argument tags
6. Parenthesis arguments
7. Pipe arguments
8. Escaped legal characters
9. Unknown tags
10. Nested conditionals
11. Parameterized conditional tests
12. Empty branches
13. Multiple tags on one line
14. Image preload and image display syntax
15. Viewports
16. Progress and volume bars
17. Touch regions
18. Album art
19. Malformed but preservable input
20. Randomized source segments using property tests

Core assertion:

```ts
expect(serialize(parse(source))).toBe(source);
```

Add a property test that generates combinations of known safe fragments and confirms round-trip identity.

## Migration strategy

- Introduce the new syntax engine beside the current parser.
- Add an adapter so existing callers can begin reading the new document.
- Do not delete the old parser until Phase 1B migration tests pass.
- Mark legacy parser use clearly.
- Do not allow two sources of truth after migration is complete.

## Phase 1A acceptance criteria

- All exact round-trip fixtures pass.
- Unknown syntax is preserved.
- Malformed syntax is preserved with diagnostics.
- Conditional tests and branches are structurally represented.
- Serializer does not normalize untouched source.
- Existing application still builds.
- No major UI changes.
- `npm run validate` passes.
- `docs/PARSER_LIMITATIONS.md` reflects actual remaining limitations.

## Phase 1A prompt for Codex Desktop

> Read `ROCKBOX_DESIGNER_CODEX_EXECUTION_PLAN.md` and execute Phase 1A only. Build a new lossless Rockbox syntax engine beside the legacy parser. Untouched input must serialize byte-for-byte identically, including comments, whitespace, line endings, escapes, unknown tags, malformed constructs, parameterized conditionals, and nested branches. Add diagnostics and extensive Vitest fixtures. Do not redesign the UI or begin semantic rendering. Keep the application buildable, update the architecture and status docs, commit the result, and prepare a draft PR.

---

# PHASE 1B — Source-aware editing commands and legacy migration

## Goal

Make visual edits modify the new lossless document without rewriting unrelated source.

## Tasks

### 1B.1 Stable node identity

Node identity must survive narrow edits.

Options include:

- Persistent generated IDs retained in project state
- Source-path identity plus rebasing
- Structural fingerprints with explicit remapping

Do not expose raw array indexes as a permanent public identity.

### 1B.2 Editing command API

Create explicit commands such as:

```ts
updateTextNode(document, nodeId, newText)
updateTagArguments(document, nodeId, updates)
updateViewport(document, nodeId, rectangle)
updateImageReference(document, nodeId, path)
replaceConditionalBranch(document, nodeId, branchIndex, source)
insertNode(document, anchor, node)
deleteNode(document, nodeId)
moveNode(document, nodeId, destination)
```

Commands must:

- Return a new document.
- Mark the minimum changed nodes dirty.
- Preserve surrounding raw source.
- Preserve original invocation style where valid.
- Produce diagnostics when an edit cannot be represented safely.
- Refuse destructive edits rather than silently flattening unsupported syntax.

### 1B.3 Known-tag semantic argument helpers

Build tag-specific decoders and encoders for the subset needed by the existing UI:

- `%V`
- `%Vl`
- `%Vi`
- `%Vf`
- `%Vb`
- `%Fl`
- `%x`
- `%xl`
- `%xd`
- `%X`
- `%pb`
- `%pv`
- `%Cl`
- `%Cd`
- `%T`

Do not claim complete tag support.

### 1B.4 Migrate existing AST editor helpers

Replace or adapt:

```text
services/rockboxAstEditor.ts
services/rockboxAstSerializer.ts
services/rockboxAst.ts
```

The existing canvas interactions should call the new command layer.

### 1B.5 Narrow-edit tests

Required assertions:

- Editing viewport `x` changes only the intended source region.
- Editing one image path does not normalize other image tags.
- Editing text preserves surrounding tags and comments.
- Editing inside one conditional branch preserves sibling branches.
- Editing a parenthesis-style tag keeps parenthesis style.
- Editing a pipe-style tag keeps pipe style.
- Failed edits leave the source unchanged and return a diagnostic.

Use before/after source fixtures and verify minimal diffs.

## Phase 1B acceptance criteria

- Existing viewport, text, and image editing operates on the lossless document.
- Unrelated source remains byte-identical.
- Legacy AST is no longer the authoritative export source.
- The old serializer is removed or isolated behind a clearly deprecated adapter.
- Tests cover edits inside nested branches.
- `npm run validate` passes.

## Phase 1B prompt for Codex Desktop

> Execute Phase 1B from the merged Phase 1A foundation. Introduce immutable, source-aware editing commands and migrate existing viewport, text, and image editing to them. Preserve untouched syntax exactly and retain each tag’s original invocation style. Add minimal-diff tests, including nested conditional branches. Do not expand rendering or redesign the interface. Remove or clearly deprecate the legacy serializer only after migration tests pass. Update documentation, commit, and prepare a draft PR.

---

# PHASE 1C — Theme package, CFG, and binary asset pipeline

## Goal

Make ZIP import/export reliable, deterministic, path-safe, and binary-safe.

## Tasks

### 1C.1 Replace global JSZip assumptions

Use the installed `jszip` module through explicit imports.

Do not depend on a global script.

### 1C.2 Binary asset store

Recommended model:

```ts
export type ThemeAsset = {
  id: string;
  archivePath: string;
  basename: string;
  bytes: Uint8Array;
  mimeType?: string;
  kind: "bitmap" | "font" | "iconset" | "text" | "unknown";
  hash: string;
};
```

Browser previews may create temporary object URLs, but project state should not permanently use data URLs as the canonical asset representation.

### 1C.3 CFG parser

Create a lossless or source-preserving `.cfg` parser.

Support:

- Comments
- Blank lines
- Duplicate keys
- Unknown settings
- Values containing colons
- Leading and trailing whitespace
- Original line endings
- WPS path
- SBS path
- FMS path
- Font path
- Backdrop path
- Colors
- Iconsets
- Quick-screen assignments
- Other settings without deletion

Use a structured setting index while preserving raw lines.

### 1C.4 Path normalization

Handle:

- `/` and accidental `\`
- Leading Rockbox root paths
- ZIP-relative paths
- Case-sensitive archive entries
- Nested theme asset directories
- Duplicate basenames
- Assets referenced from multiple screens
- Missing references
- Paths with spaces

Never resolve assets by basename alone when duplicate basenames exist.

### 1C.5 Import model

A theme package should retain:

```ts
type ThemePackage = {
  cfg: SourceDocument;
  screens: {
    wps?: RockboxDocument;
    sbs?: RockboxDocument;
    fms?: RockboxDocument;
  };
  assets: AssetStore;
  manifest: ThemeManifest;
  diagnostics: Diagnostic[];
};
```

### 1C.6 Deterministic exporter

Export:

```text
.rockbox/themes/<name>.cfg
.rockbox/wps/<name>.wps
.rockbox/wps/<name>.sbs
.rockbox/wps/<name>.fms
.rockbox/wps/<name>_img/...
.rockbox/fonts/...
```

Only include files that exist or are intentionally generated.

Do not create an empty FMS file for a theme that never had one unless the user explicitly enables it.

Normalize ZIP metadata sufficiently for deterministic tests.

### 1C.7 Package tests

Tests must cover:

- WPS only
- WPS + SBS
- WPS + SBS + FMS
- Missing CFG
- Missing referenced source
- Missing asset
- Duplicate basenames in different directories
- Font asset
- Unknown binary asset
- Nested directories
- CRLF source
- Import then export without edits
- Export then import
- Manifest equality

## Phase 1C acceptance criteria

- ZIP import uses explicit `jszip`.
- Binary assets are not canonically stored as data URLs.
- CFG unknown lines survive import/export.
- WPS, SBS, and FMS are resolved correctly.
- Duplicate basenames cannot resolve to the wrong asset silently.
- Exported manifests are deterministic.
- Package fixture tests pass.
- `npm run validate` passes.

## Phase 1C prompt for Codex Desktop

> Execute Phase 1C from merged main. Replace global JSZip use with the module dependency, create a binary-safe asset store, implement a source-preserving CFG parser, and make WPS/SBS/FMS package import and deterministic export reliable. Preserve unknown settings and paths. Add ZIP fixtures for duplicate basenames, missing assets, fonts, nested directories, and import-export round trips. Do not start visual renderer work. Update documentation, commit, and prepare a draft PR.

---

# PHASE 1D — Rockbox tag registry and compatibility metadata

## Goal

Use the official Rockbox tag table as the reference for known tag names and raw parameter specifications.

## Source reference

The current generator should inspect:

```text
lib/skin_parser/tag_table.c
lib/skin_parser/tag_table.h
```

The script must record the exact upstream commit SHA.

## Licensing boundary

Do not copy the Rockbox parser implementation into the application during this phase.

A generated factual registry containing tag names and metadata may be acceptable, but Codex must:

- Document how it was generated.
- Preserve upstream attribution.
- Record the Rockbox license.
- Flag the output for human licensing review.
- Avoid copying substantial implementation code or comments.

## Tasks

### 1D.1 Generator

Create:

```text
scripts/generate-rockbox-tag-registry.mjs
```

Inputs:

- A local Rockbox checkout via `ROCKBOX_SOURCE_DIR`, or
- An explicitly downloaded source snapshot managed by a separate script

Output:

```text
rockbox/registry/generated/rockbox-tags.json
```

Record:

- Upstream repository
- Commit SHA
- Generation timestamp
- Source file paths
- Tag name
- Raw parameter specification
- Raw flags
- Token identifier where useful

### 1D.2 Registry API

Provide:

```ts
getTagDefinition(name)
isKnownTag(name)
getLongestKnownTagAt(source, offset)
listTagsByCategory(category)
getRawParameterSpec(name)
```

### 1D.3 Compatibility states

For each tag, support capability metadata:

```ts
type SupportLevel =
  | "preserved"
  | "parsed"
  | "interpreted"
  | "rendered"
  | "editable"
  | "officially-validated";
```

These levels are cumulative descriptions, not a single marketing percentage.

### 1D.4 CI verification

Add a script that fails when:

- Generated registry format is invalid.
- Duplicate tag definitions appear unexpectedly.
- Registry metadata claims a different SHA than documentation.
- Checked-in generated output does not match regeneration from the configured source.

Do not require network access for ordinary unit tests.

## Phase 1D acceptance criteria

- Tag names come from generated upstream metadata.
- Parser longest-match logic uses the registry.
- Unknown tags remain preserved.
- Upstream SHA is documented.
- Licensing note exists.
- Registry regeneration is documented and testable.
- `npm run validate` passes.

## Phase 1D prompt for Codex Desktop

> Execute Phase 1D. Build a generated Rockbox tag registry from a local upstream Rockbox checkout, using `lib/skin_parser/tag_table.c` and related definitions. Record the upstream SHA, preserve attribution, and document licensing. Use the registry for known-tag lookup and longest matching, but continue preserving unknown syntax. Add registry verification tests without requiring network access during normal test runs. Do not vendor the official parser implementation. Update docs, commit, and prepare a draft PR.

---

# PHASE 1E — Device profile foundation

## Goal

Remove hardcoded iPod assumptions from core project state and introduce capability-driven device profiles.

## Device profile model

Recommended model:

```ts
type ScreenProfile = {
  width: number;
  height: number;
  depth: number;
  dpi?: number;
};

type DeviceCapabilities = {
  touchscreen: boolean;
  fmRadio: boolean;
  recording: boolean;
  remoteLcd: boolean;
  usbHid: boolean;
  rtc: boolean;
  albumArt: boolean;
};

type DeviceProfile = {
  id: string;
  manufacturer: string;
  model: string;
  rockboxTarget: string;
  mainScreen: ScreenProfile;
  remoteScreen?: ScreenProfile;
  capabilities: DeviceCapabilities;
  supportedScreenFiles: Array<"wps" | "sbs" | "fms" | "rwps" | "rsbs" | "rfms">;
  source: {
    rockboxCommit: string;
    configPaths: string[];
  };
};
```

### Initial profiles

Implement and verify at least:

- iPod Video 5G/5.5G
- iPod Classic 6G/7G or the relevant Rockbox port profile

Do not assume that identical screen dimensions mean identical capabilities.

### Profile source

Derive values from current Rockbox target configuration where practical. Record source paths and SHA.

### Migration

Replace:

```ts
target: "ipod_video"
```

with a profile ID or target reference.

Provide migration for saved project JSON.

Do not break existing user projects.

### Feature gates

Examples:

- Hide or disable FMS authoring when the device has no FM radio.
- Hide touch-region presets when the target has no touchscreen.
- Expose remote screens only when supported.
- Use native display dimensions from the profile.
- Show compatibility diagnostics for target-specific tags.

## Phase 1E acceptance criteria

- Core state is not typed to only `ipod_video`.
- Existing saved projects migrate.
- Canvas dimensions come from the selected profile.
- At least two verified profiles exist.
- Capability gates are covered by unit tests.
- No broad UI redesign.
- `npm run validate` passes.

## Phase 1E prompt for Codex Desktop

> Execute Phase 1E. Introduce verified, source-referenced device profiles and migrate the project model away from a hardcoded `ipod_video` target. Add safe migration for existing saved projects, use profile dimensions and capabilities, and implement minimal feature gates for FM, touch, remote LCD, and screen-file support. Start with iPod Video and the appropriate iPod Classic profile after checking current Rockbox target sources. Add tests, update docs, commit, and prepare a draft PR.

---

# PHASE 1F — Official parser validation bridge

## Goal

Create a reference-validation workflow using the official Rockbox parser without yet embedding it into the browser.

## Licensing and architecture requirement

Do not vendor Rockbox C source into the application by default.

Use a separately checked-out Rockbox repository:

```bash
export ROCKBOX_SOURCE_DIR=/path/to/rockbox
```

Create tooling that can:

1. Build or invoke the relevant official parser utility.
2. Feed fixture source into it.
3. Capture success, errors, and parse output where available.
4. Compare results to the browser parser.
5. Produce a structured compatibility report.

### Possible approaches

Codex must inspect current Rockbox build utilities before selecting one:

- Build the standalone `lib/skin_parser` tooling.
- Adapt an existing theme-editor parser test executable.
- Create a tiny external harness inside an ignored build directory that links against the upstream checkout.
- Use a container or script that leaves GPL build artifacts outside the distributed web app.

Document the chosen method in an ADR.

## Required validation categories

- Accepted by both parsers
- Preserved by browser parser but rejected by official parser
- Browser diagnostic differs from official parser
- Browser parser fails to preserve
- Official parser cannot be executed for the target fixture
- Target-dependent result

## Test behavior

Ordinary unit tests must not require a local Rockbox checkout.

Provide an optional command such as:

```bash
npm run test:official
```

When `ROCKBOX_SOURCE_DIR` is absent, this command should fail with a clear setup message or skip only when an explicit skip flag is provided.

## Phase 1F acceptance criteria

- Official validation can run locally against a documented Rockbox checkout.
- Upstream SHA is recorded in reports.
- Browser parser differences are visible.
- No official-source code is bundled into the production application.
- Ordinary `npm test` remains self-contained.
- `npm run validate` passes.
- Optional official validation has been demonstrated on representative fixtures.

## Phase 1F prompt for Codex Desktop

> Execute Phase 1F. Build an optional local reference-validation bridge to the official Rockbox skin parser using a separate Rockbox checkout specified by `ROCKBOX_SOURCE_DIR`. Do not bundle GPL parser code into the web application. Add an ADR describing the chosen harness, produce structured comparison reports, and expose an optional `npm run test:official` command. Ordinary tests must remain network-free and self-contained. Update docs, commit, and prepare a draft PR.

---

# PHASE 1G — Real-theme compatibility corpus

## Goal

Prove that Phase 1 works on real Rockbox themes rather than only synthetic snippets.

## Preferred themes

Use legally obtained local copies of:

- AMusicPod
- Adwaitapod
- Additional varied themes for different syntax styles and targets

Do not download and commit third-party themes without confirming redistribution rights.

### Fixture classes

#### Public fixtures

Small, authored or permission-compatible examples committed to the repository.

#### Private local fixtures

Full third-party themes stored outside Git or under an ignored directory:

```text
tests/private-themes/
```

Provide:

```text
tests/private-themes/README.md
```

and ignore the actual ZIP files.

### Fixture runner

Create a command:

```bash
npm run test:themes
```

The runner should:

1. Discover ZIPs in the configured fixture directories.
2. Import the package.
3. Parse CFG, WPS, SBS, and FMS.
4. Re-serialize untouched source.
5. Compare source bytes.
6. Export the package.
7. Compare file manifests and asset hashes.
8. Optionally run official parser validation.
9. Produce a Markdown or JSON report.

### Report fields

- Theme name
- Target
- Source files found
- Exact round-trip status
- Unknown tags
- Parser diagnostics
- Missing assets
- Path collisions
- Official parser status
- Export manifest status
- Unsupported semantic/render features
- Failure links to fixture and source span

## Phase 1G acceptance criteria

- AMusicPod and Adwaitapod can be tested locally.
- Untouched source round-trips exactly or every difference is documented as a failing test.
- Import/export does not lose assets.
- Reports clearly distinguish syntax preservation from visual support.
- Phase 1 compatibility matrix is updated.
- `npm run validate` passes.
- `npm run test:themes` produces a human-readable report.

## Phase 1G prompt for Codex Desktop

> Execute Phase 1G. Add a real-theme fixture runner with public minimal fixtures and an ignored private-fixture directory for legally obtained themes such as AMusicPod and Adwaitapod. Test exact source round trips, package manifests, asset hashes, diagnostics, and optional official parser validation. Generate a compatibility report that separates preservation, parsing, interpretation, rendering, editing, and official validation. Do not commit third-party theme files without confirmed permission. Update docs, commit, and prepare a draft PR.

---

# PHASE 1 — Combined exit criteria

Phase 1 is complete only when all of the following are true:

## Syntax preservation

- Untouched WPS, SBS, and FMS source serializes exactly.
- Comments, whitespace, line endings, escapes, unknown tags, and malformed syntax survive.
- Nested and parameterized conditionals are represented correctly.

## Editing

- Existing visual text, image, and viewport edits use source-aware commands.
- Only intended source regions change.
- Unsupported edits fail safely.

## Packages

- CFG is source-preserving.
- ZIP import/export is deterministic.
- Binary assets are preserved without data-URL dependence.
- Duplicate basenames are resolved safely.

## Registry

- Known tags are generated from a recorded Rockbox upstream SHA.
- Unknown tags remain preserved.
- Support levels are documented.

## Devices

- Device profiles replace the hardcoded target.
- Existing projects migrate.
- Capabilities are data-driven.

## Validation

- Optional comparison with official Rockbox parser works locally.
- Real-theme fixture reports exist.
- No marketing claim says “fully compatible” without evidence.

## Engineering

- `npm run typecheck` passes.
- `npm test` passes.
- `npm run build` passes.
- `npm run test:themes` runs with available fixtures.
- Documentation is current.
- No unrelated UI redesign is mixed into Phase 1.

---

# PHASE 2 — Accurate WPS visual editor

## Goal

Build a practical, source-aware WPS editor on top of the Phase 1 foundation.

## Major deliverables

### 2.1 Semantic interpreter

Interpret a documented subset into render operations:

- Viewports
- Foreground and background colors
- Text alignment
- Metadata tags
- Images and preloaded images
- Sprite frames
- Album art
- Progress bars
- Volume bars
- Battery state
- Playback state
- Repeat and shuffle state
- Conditional branches
- Touch regions
- Scrolling text approximation

Every interpreted node retains a link to its CST source node.

### 2.2 Render list

Use a device-independent render list:

```ts
type RenderOperation =
  | SetViewport
  | DrawText
  | DrawBitmap
  | DrawRect
  | DrawProgress
  | DrawAlbumArt
  | SetClip
  | DebugOverlay;
```

### 2.3 Pixel-native canvas renderer

- Render at native target resolution.
- Use nearest-neighbor scaling for zoom.
- Use integer coordinates.
- Clip to viewports.
- Avoid CSS layout as the source of pixel positions.
- Derive DOM overlays only for editing handles.

### 2.4 Logic-aware layer panel

Represent:

- Global preloads
- Viewports
- Elements
- Conditional groups
- Conditional branches
- Source-only blocks
- Unsupported nodes

Do not present conditionals as ordinary visual layers without logic context.

### 2.5 Two-way source synchronization

- Source changes update preview.
- Visual changes update the source-aware document.
- Parser diagnostics appear inline.
- Invalid source retains the last valid render while visibly indicating stale preview.

### 2.6 Inspector

Support known properties without exposing misleading generic controls.

Examples:

- Viewport rectangle
- Font slot
- Alignment
- Color
- Metadata field
- Image path
- Sprite handle and frame
- Conditional simulation state
- Progress-bar geometry
- Touch action

## Phase 2 acceptance criteria

- A real imported WPS can be edited visually and exported.
- Source and canvas remain synchronized.
- Conditional branches can be previewed.
- Native-pixel rendering is deterministic.
- Unsupported nodes remain present.
- Golden screenshot tests exist for selected fixtures.
- Exported WPS passes official validation for the tested subset.

---

# PHASE 3 — SBS, FMS, lists, menus, and font pipeline

## Goal

Extend the editor beyond WPS while respecting Rockbox limitations.

## 3.1 SBS editor

Support:

- Skinned status bar
- UI viewports
- List-related tags
- Title and list item rendering
- Selectors
- Scrollbars
- Iconsets
- Theme colors and fonts
- Menu-state simulation

## 3.2 FMS editor

Support:

- Tuner availability
- Frequency
- Presets
- Signal strength
- Stereo state
- RDS fields
- Recording or tuner-specific capability diagnostics

## 3.3 Quick-screen preview

The quick screen should initially be a **simulation preview**, not a claim of arbitrary stock-theme layout replacement.

Use the current SBS parent viewport, theme fonts, colors, icons, and quick-setting assignments where applicable.

Clearly label hardcoded Rockbox layout behavior.

## 3.4 USB and hold previews

- USB connected presentation is an SBS activity scene selected by `%cs = 21`; themes may draw custom SBS viewports, images, text, colors, and conditionals for it.
- The compiled Rockbox USB logo is a firmware fallback drawn inside the `%VI`-selected UI viewport after the SBS. Preview it as an external-authority boundary, and let a theme hide it with a deliberately small UI viewport when the source does so.
- Hold is primarily a state for conditionals and behavior simulation.
- Do not export a fictional `.usb` theme file.

## 3.5 Font converter

Research and wrap the current Rockbox `tools/convttf.c`.

Preferred delivery sequence:

1. Native local helper prototype.
2. Server or local-worker integration.
3. WebAssembly only after licensing and build feasibility are understood.

Font workflow:

- Upload TTF or OTF.
- Select pixel size.
- Select glyph ranges.
- Preview actual Rockbox font metrics.
- Generate `.fnt`.
- Add to package.
- Warn about font licensing.
- Preserve the generated binary exactly.

## Phase 3 acceptance criteria

- SBS and FMS import, preview, edit, and export work for the supported subset.
- Menus and quick screen distinguish theme-controlled and firmware-controlled behavior.
- Font conversion produces a usable `.fnt` verified in Rockbox or simulator.
- No fictional standard-theme file types are exported.

---

# PHASE 4 — Official engine validation and render comparison

## Goal

Increase confidence by using more of Rockbox’s real skin behavior.

## Workstreams

### 4.1 Official parser WebAssembly feasibility

Assess compiling the official parser to WebAssembly.

Do not proceed without an ADR covering:

- License
- Build system
- Memory model
- Filesystem interface
- Browser bundle impact
- Upstream update workflow

### 4.2 Canonical render reference

Build a process that renders test themes with a Rockbox simulator target and captures screen output.

Compare:

- Browser renderer screenshot
- Official simulator screenshot
- Pixel diff
- Classified differences

### 4.3 Compatibility dashboard

For each tag and tested device:

- Preserved
- Parsed
- Interpreted
- Rendered
- Editable
- Officially validated
- Known visual difference

## Acceptance criteria

- The supported subset is measured against official output.
- Pixel differences are reproducible and classified.
- Compatibility claims are evidence-based.

---

# PHASE 5 — Device-state simulator

## Goal

Build a rich in-browser simulator for design states without yet claiming a complete firmware port.

## Simulation state

Include:

- Playing
- Paused
- Stopped
- Seeking
- Track changes
- Metadata
- Album art
- Elapsed time
- Duration
- Volume
- Battery percentage
- Charging
- External power
- Hold
- USB connected
- Repeat mode
- Shuffle
- RTC
- Disk activity
- FM state
- RDS
- Touch input where supported
- Remote LCD where supported

## Device shell

A device shell may visually represent the hardware and map inputs, but it must be separate from the screen renderer.

## Scenario presets

Examples:

- Normal playback
- Paused with low battery
- Charging over USB
- Volume overlay
- Missing album art
- Long scrolling title
- FM preset
- Hold active
- Right-to-left language
- Remote screen

## Acceptance criteria

- State transitions drive real conditional evaluation.
- Scenarios are deterministic and shareable.
- Target capability restrictions are honored.

---

# PHASE 6 — Preset and component ecosystem

## Goal

Provide the Canva-like library after the source and rendering core is reliable.

## Component categories

- Battery
- Charging
- Play/pause/stop/seek
- Shuffle
- Repeat
- Volume
- Progress
- Time
- Metadata
- Album art
- Codec information
- Playlist information
- Next track
- Clock
- Status bar
- Touch controls
- FM elements
- List and menu treatments

## Component contract

A preset is not just an SVG.

It should include:

```ts
type RockboxPreset = {
  id: string;
  name: string;
  category: string;
  preview: string;
  supportedTargets: string[];
  requiredCapabilities: string[];
  sourceTemplate: string;
  assets: PresetAsset[];
  editableProperties: PropertySchema[];
  validationRules: ValidationRule[];
};
```

## Insertion behavior

Preset insertion must:

- Allocate safe image handles.
- Avoid viewport-name collisions.
- Add required assets.
- Insert source at a valid location.
- Preserve existing source.
- Report conflicts.
- Support undo.

## Acceptance criteria

- Presets generate valid source and assets.
- Removing a preset does not remove shared assets still in use.
- Handle and identifier collisions are tested.
- Presets are target-aware.

---

# PHASE 7 — Full Rockbox simulator research and prototype

## Goal

Determine whether the actual Rockbox UI simulator can run in a browser.

## Required feasibility research

Investigate:

- Current `uisimulator` architecture
- SDL dependencies
- Threads and timing
- Audio backend
- Filesystem
- Input
- Target build generation
- Emscripten compatibility
- Browser persistence
- Asset mounting
- Licensing and distribution
- Build size
- Performance

## Prototype stages

1. Build one native simulator target reproducibly.
2. Automate loading a generated theme.
3. Capture screenshots.
4. Port only the display and input loop to WebAssembly.
5. Run a single target in browser.
6. Add target switching only after one target is stable.

## Do not

- Promise every device before one target works.
- Couple the editor UI directly to simulator internals.
- Block the editor on full simulator completion.

## Acceptance criteria

- One documented target runs or a documented feasibility report explains the blockers.
- The editor continues functioning independently.

---

# PHASE 8 — Firmware Mode

## Goal

Support optional custom firmware outputs for non-themeable screens and behavior.

## Potential outputs

- Patch files
- Source overlay directories
- Reproducible build scripts
- Docker build environment
- Target-specific assets
- Firmware compatibility report

## Safety and clarity

- Firmware Mode must be opt-in.
- Clearly distinguish it from ordinary theme installation.
- Warn about target risk and recovery requirements.
- Do not distribute proprietary firmware components.
- Ensure every patch is tied to an upstream Rockbox SHA.

## Candidate features

- Custom compiled USB fallback logo and placement beyond the SBS-authored scene
- Deeper quick-screen layout changes
- Alternative built-in icons
- Custom system dialogs
- Additional skin hooks, if implemented upstream or through a maintained patch set

## Acceptance criteria

- A generated patch applies cleanly to the recorded upstream SHA.
- A reproducible target build succeeds.
- Theme Mode remains unaffected.

---

## 8. Testing strategy

### 8.1 Test layers

#### Unit tests

- Tokenizer
- Parser
- Serializer
- Diagnostics
- Argument decoders
- Editing commands
- Path resolution
- CFG parser
- Device capabilities

#### Property tests

- Parse/serialize identity
- Random safe fragment combinations
- Minimal edit preservation
- Path normalization invariants

#### Fixture tests

- Synthetic WPS/SBS/FMS
- ZIP packages
- Real local themes
- Malformed source
- Duplicate assets

#### Integration tests

- Import theme
- Edit source
- Edit canvas
- Export theme
- Re-import
- Compare project state and source

#### Official reference tests

- Browser parser versus Rockbox parser
- Browser renderer versus Rockbox simulator

#### End-to-end browser tests

Add Playwright when the UI is stable enough:

- Open theme
- Select device
- Edit text
- Move viewport
- Change state
- Export ZIP
- Reopen export

#### Visual regression

- Native-resolution screenshots
- Device profile fixtures
- Fixed fonts and metadata
- Pixel-diff thresholds with classified exclusions

### 8.2 Required validation command

Eventually standardize:

```bash
npm run validate
```

It should include:

```bash
npm run typecheck
npm test
npm run build
```

Add specialized commands:

```bash
npm run test:themes
npm run test:official
npm run test:e2e
npm run test:visual
npm run registry:verify
```

Do not make ordinary validation depend on network access or a local Rockbox checkout.

---

## 9. Documentation requirements

Codex must maintain these files.

### `docs/IMPLEMENTATION_STATUS.md`

Update every phase with:

- Current phase
- Merged milestones
- Active branch
- Passing commands
- Known failures
- Next task
- Compatibility summary

### `docs/ARCHITECTURE.md`

Include:

- Data flow
- Module boundaries
- Source-of-truth rules
- Editing flow
- Package flow
- Rendering flow

### `docs/DECISIONS.md`

Use short ADR entries:

```md
## ADR-0001 — Use a lossless CST as the authoritative document

**Status:** Accepted  
**Context:** ...  
**Decision:** ...  
**Consequences:** ...
```

### `docs/COMPATIBILITY_MATRIX.md`

Track by tag and subsystem.

Do not use a single misleading compatibility percentage.

### `docs/PARSER_LIMITATIONS.md`

Every unsupported or uncertain construct must be documented with:

- Example
- Current behavior
- Preservation status
- Diagnostic
- Planned phase

### `docs/UPSTREAM_ROCKBOX.md`

Record:

- Upstream repository
- SHA
- Date
- Relevant source paths
- Tag-registry generation
- Official harness setup
- License

---

## 10. Pull request definition of done

Every Codex pull request must include:

### Summary

- What changed
- Why it changed
- User-visible impact
- Architectural impact

### Scope exclusions

State what the PR deliberately does not implement.

### Validation

List exact commands and results.

### Compatibility evidence

List fixtures or official-source checks used.

### Risk

- Data migration
- Source preservation
- Export changes
- Licensing
- Performance
- UI regressions

### Documentation

List updated docs.

### Screenshots

Only when behavior is visual.

### Checklist

```md
- [ ] Typecheck passes
- [ ] Unit tests pass
- [ ] Build passes
- [ ] New behavior is tested
- [ ] Unknown syntax remains preserved
- [ ] Existing project migration is covered
- [ ] Documentation is updated
- [ ] No unrelated changes are included
```

---

## 11. Stop conditions requiring David’s decision

Codex should stop the affected implementation path and request a decision when:

1. Vendoring or distributing GPL Rockbox code becomes necessary.
2. A dependency substantially increases client bundle size.
3. A migration would intentionally break existing saved projects.
4. A standard theme limitation requires Firmware Mode.
5. A third-party theme must be committed and redistribution rights are unclear.
6. Two official Rockbox source paths conflict and the correct current behavior is uncertain.
7. A parser edit cannot preserve the original source safely.
8. A phase requires a backend service rather than a browser-only solution.
9. A major UI redesign would be necessary before the core milestone is complete.

Codex should not stop for ordinary implementation choices that can be resolved through the rules in this document.

---

## 12. Commands Codex should run at the start of every phase

```bash
git status --short --branch
git fetch --all --prune
git switch main
git pull --ff-only
npm install
npm run typecheck
npm test
npm run build
```

Then create the phase branch.

When using an existing lockfile and a clean environment, prefer:

```bash
npm ci
```

Do not use `npm audit fix --force` as routine maintenance.

---

## 13. Master prompt for Codex Desktop

Use this only after Phase 0 has established the repository instructions and tests.

> You are implementing Rockbox Designer according to `ROCKBOX_DESIGNER_CODEX_EXECUTION_PLAN.md`. Read the entire plan and the repository `AGENTS.md`. Inspect `docs/IMPLEMENTATION_STATUS.md` to identify the next incomplete phase. Execute only that phase. Start from current `main`, preserve unrelated work, and use a focused branch. Research current Rockbox source whenever behavior is uncertain and record the upstream commit SHA. Do not guess syntax, normalize untouched source, flatten source into visual elements, vendor GPL code without a decision, or misrepresent firmware-controlled screens as standard themes. Add tests, update all required documentation, run the phase validation commands, commit logically, and prepare a draft pull request. Stop only for one of the explicit decision gates in the plan.

---

## 14. Expected final product architecture

When all phases are mature:

```text
Rockbox Designer
├── Lossless theme source engine
├── Official tag registry
├── Device profile registry
├── Semantic skin interpreter
├── Pixel-native renderer
├── Source-aware editing command system
├── Canva-like component library
├── WPS editor
├── SBS and menu editor
├── FMS editor
├── Font and bitmap pipeline
├── Device-state simulator
├── Official parser validation
├── Simulator render comparison
├── Standard theme exporter
└── Optional firmware-mode exporter
```

The core success criterion is not that the editor looks like Canva. The success criterion is that a user can visually modify a real Rockbox theme without the application corrupting, flattening, inventing, or silently discarding Rockbox source behavior.

---

## 15. Immediate next action

Start with **Phase 0**, even if the visual prototype already appears functional.

The first technically meaningful product milestone is complete only after **Phase 1G**, when real themes can be imported, preserved, edited narrowly, exported, and checked through a documented compatibility process.
