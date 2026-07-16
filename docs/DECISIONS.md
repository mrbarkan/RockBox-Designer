# Architecture Decisions

## ADR-0001 — Treat Rockbox source as the future authoritative document

**Status:** Accepted

**Context:** The prototype can flatten imported source into visual elements and reconstruct AST syntax, which cannot guarantee preservation of real themes.

**Decision:** The project will introduce a lossless concrete syntax tree alongside the legacy parser. Visual state, semantic interpretation, rendering, validation, and editing will be projections or narrow operations over that source document.

**Consequences:** Untouched source must eventually round-trip exactly. Unknown and malformed syntax must remain present. The legacy parser stays in place until later migration tests prove that callers can move safely.

## ADR-0002 — Keep Phase 0 behavior-neutral except for baseline repairs

**Status:** Accepted

**Context:** TypeScript checking exposed duplicated declarations and missing AST editor wiring on the current default branch. Parser replacement is explicitly outside Phase 0.

**Decision:** Phase 0 may repair compile/runtime wiring needed for a clean baseline, but it will not change parser, serializer, package, rendering, or UI contracts.

**Consequences:** The current compatibility limitations remain visible and documented. Phase 1A starts only after the Phase 0 validation and pull request are complete.

## ADR-0003 — Use one root source with absolute spans for all syntax documents

**Status:** Accepted

**Context:** Conditional branches need to serialize as independent documents while diagnostics and later editing commands still require coordinates in the original file.

**Decision:** Root and branch `RockboxDocument` values share the original source string and carry absolute, half-open spans. Clean documents serialize their source span directly; clean nodes serialize their exact `raw` slice. Tag arguments remain raw syntax and are not semantically split during initial parsing.

**Consequences:** Untouched source and branches round-trip exactly, line/column diagnostics remain globally meaningful, and Phase 1B can target narrow source regions. Callers must not assume a branch document's source string contains only that branch.

## ADR-0004 — Make lossless source authoritative and derive the legacy preview AST

**Status:** Accepted

**Context:** The canvas evaluator still consumes the legacy AST, but using that simplified tree as the export source would undo Phase 1A preservation guarantees.

**Decision:** Imported screens retain a lossless `RockboxDocument`. All Phase 1B edits and screen compilation use it. After an edit, the application serializes the lossless document and reparses that source into a legacy AST only for the current renderer. Saved projects without a lossless document migrate lazily from their stored raw legacy source.

**Consequences:** Export no longer depends on normalized legacy nodes, existing preview behavior remains available, and migration is incremental. The derived AST may still render approximately, and Phase 2 must move semantic interpretation off the legacy representation.

## ADR-0005 — Use archive paths and bytes as package identity

**Status:** Accepted

**Context:** Basename-keyed data URLs cannot distinguish duplicate assets, preserve unknown binary files reliably, or produce deterministic package manifests.

**Decision:** Imported files are identified by normalized, case-sensitive archive path and stored as `Uint8Array` bytes with SHA-256 hashes. Data URLs are derived UI state. CFG and screen documents preserve source, and ZIP export sorts entries with fixed metadata.

**Consequences:** Duplicate basenames remain safe, unknown files survive, and logical manifests are reproducible. Project persistence needs explicit typed-array encoding, and case mismatches now produce diagnostics instead of silent fallback.

## ADR-0006 — Generate tag identity without vendoring the parser

**Status:** Accepted

**Context:** A local tag shortlist creates incorrect name boundaries and drifts from Rockbox, while copying the GPL parser into the browser would cross the project's current licensing and architecture boundary.

**Decision:** Extract factual tag names, token identifiers, parameter specs, raw flags, and categories from a separately checked-out pinned Rockbox tree. Check in reproducible JSON with attribution and licensing-review notes. Use it only for registry queries and longest-name matching; preserve unmatched names generically.

**Consequences:** Official names track an exact upstream SHA and ordinary tests stay offline. Parameter metadata does not itself prove interpretation, rendering, editing, or official parser agreement, and generated output requires human licensing review before distribution assumptions are made.

## ADR-0007 — Gate features by verified device capability

**Status:** Accepted

**Context:** The core state accepted only `ipod_video`, while dimensions and feature surfaces were scattered as iPod-specific constants. The Video and Classic targets share LCD dimensions but differ in tuner capability.

**Decision:** Store a source-referenced device profile ID in project settings. Centralize dimensions, capabilities, supported screen files, alias migration, and feature queries under `rockbox/devices/`. Hide unsupported authoring surfaces without deleting preserved project data.

**Consequences:** Existing projects migrate safely, target selection controls canvas geometry and minimal FM/touch/screen-file gates, and identical dimensions no longer imply identical capabilities. New profiles require source evidence and verification rather than UI conditionals.

## ADR-0008 — Use upstream CheckWPS as an external reference oracle

**Status:** Accepted

**Context:** Browser-only fixtures cannot establish agreement with Rockbox, while embedding or translating the GPL parser would cross the current licensing boundary. Rockbox already provides a target-specific validation program that links its real skin engine.

**Decision:** Build upstream `tools/checkwps` unchanged in an external SHA-and-target directory, invoke it as a development-time process, and compare its results with browser preservation and diagnostics. Keep category logic and checked-in reports in this repository, but never source, objects, or binaries from the official tool.

**Consequences:** Official differences and target dependence become visible without altering lossless future-syntax behavior. Local validation needs a matching Rockbox checkout and toolchain; ordinary tests remain offline. macOS may adjust only the generated out-of-tree makefile to select an available compiler.

## ADR-0009 — Separate public authored fixtures from private real themes

**Status:** Accepted

**Context:** Real themes are necessary compatibility evidence, but redistribution rights for locally obtained third-party files are not automatically established.

**Decision:** Commit only deterministic fixtures authored for this repository. Ignore private theme ZIPs and provenance sidecars, provide a helper that derives AMusicPod and Adwaitapod fixtures from a user-owned firmware tree, and check in reports that separate source preservation from semantic, visual, editing, and official-parser support.

**Consequences:** Ordinary validation stays self-contained and legally conservative while developers can reproduce real-theme evidence locally. A passing round trip cannot be advertised as full visual compatibility, and private fixtures must never be force-added without confirmed permission.

## ADR-0010 — Render a source-linked semantic operation list at native pixels

**Status:** Accepted

**Context:** The legacy AST and flat visual-element model cannot represent logic-aware WPS editing without weakening the lossless source-of-truth rule.

**Decision:** Interpret a documented WPS subset directly from the CST into device-independent render operations. Link every operation and layer to its source node, render at native device pixels with explicit clipping, and make DOM handles derived overlays. Preserve unsupported nodes as source-only/unsupported layers. When applied source is invalid, retain the last valid render and show the current diagnostics.

**Consequences:** Visual and source edits converge on the same document, conditionals retain logic context, and deterministic pixel goldens become possible. Browser fonts and the documented semantic subset remain approximations; support claims must continue to be tracked per construct rather than inferred from preservation.

## ADR-0011 — Project firmware-owned screen state through the shared semantic engine

**Status:** Accepted

**Context:** SBS and FMS source were preserved but still routed through the legacy flat-element adapter. Rockbox menus, quick screens, tuner state, and USB behavior also include firmware-owned content that a theme positions or styles without defining as ordinary source elements.

**Decision:** Interpret WPS, SBS, and FMS from their authoritative CST documents through one screen-aware semantic engine. Represent menu/list rows, quick-screen controls, and tuner state as clearly labeled derived firmware projections inside source-defined UI viewports. Use source-verified activity and icon IDs. Keep USB as a stock/firmware behavior boundary and do not invent unsupported theme files.

**Consequences:** Imported SBS/FMS files share source-linked rendering, editing, stale-preview, and export behavior with WPS. Firmware-owned rows are previewable but do not become authored source nodes. Support remains a documented tag/state subset, and no preview claims to reproduce the complete firmware simulator.

## ADR-0012 — Keep Rockbox font conversion external until a delivery architecture is chosen

**Status:** Accepted

**Context:** Existing `.fnt` files can be preserved in a browser package, but generating one from TTF/OTF requires Rockbox's GPL `tools/convttf.c` or an independently implemented equivalent. Bundling, linking, translating, or remotely hosting that conversion introduces licensing or backend decisions outside the current browser-only architecture.

**Decision:** Parse and package RB12 `.fnt` binaries independently in the application. For development validation, build and execute the pinned upstream `convttf` from a separate checkout and verify the result in an external Rockbox simulator. Do not commit or distribute Rockbox source/binaries or generated third-party fonts. Pause browser TTF/OTF conversion until the project explicitly chooses a local companion, backend service, or GPL-compatible WebAssembly delivery model.

**Consequences:** Existing `.fnt` import/export and actual Rockbox metrics are usable now, and the native conversion path is reproducible and simulator-verified. A no-code browser conversion workflow remains unavailable by design; starting it is an architecture and licensing stop condition.

## ADR-0013 — Use a loopback-only local companion for outline-font conversion

**Status:** Accepted

**Context:** The project owner selected the local companion option at the Phase 3 stop condition. TTF/OTF/TTC conversion needs Rockbox's GPL-2.0-or-later `tools/convttf.c`, FreeType, native process execution, and temporary filesystem access. Shipping that source or executable in the browser bundle would create different licensing and delivery obligations; a backend would upload user fonts and add infrastructure.

**Decision:** Rockbox Designer will use a versioned HTTP companion bound only to `127.0.0.1`. The browser sends in-memory font bytes, pixel size, and a glyph range through an origin-checked protocol. The helper accepts the known local development and preview origins, requires a custom protocol header, caps inputs at 24 MB, rejects browser-supplied paths, writes only a private temporary work directory, validates the returned RB12 file, and removes the work directory after conversion. Additional deployed origins require an explicit `--allow-origin` value.

The helper executes the exact upstream converter from the tag-registry SHA. It may use a matching `ROCKBOX_SOURCE_DIR` or fetch that exact upstream checkout into a SHA-keyed user cache and build it locally with the system C compiler and FreeType. The repository and browser bundle distribute no Rockbox source, object, executable, generated font, or input font. The client adds only the protocol, conversion UI, and RB12 validation code: the measured production bundle changes from 572.05 KB / 168.13 KB gzip to 581.30 KB / 170.99 KB gzip, an increase of 9.25 KB minified and 2.86 KB gzip.

The companion and browser exchange base64 inside a bounded JSON request. Native input and output exist only for the duration of one conversion. The browser receives the generated bytes and independently parses their RB12 header before storing the exact binary in the theme package. Updating Rockbox requires first regenerating the pinned registry; the helper refuses a checkout at any other SHA and uses a separate cache directory for every upstream commit.

**Consequences:** Users can select a TTF/OTF/TTC, pixel size, and glyph range without uploading the font to a third party or adding GPL code to the web application. The prototype requires Node.js, Git, a C compiler, and FreeType on the local machine; a signed standalone companion installer remains delivery polish rather than a parser/rendering prerequisite. The helper must be running for outline conversion, while exact `.fnt` import and all other editor functions remain browser-only. Phase 4 may begin because the Phase 3 delivery and licensing stop condition is resolved.

## ADR-0014 — Keep the official parser and renderer as external validation oracles

**Status:** Accepted

**Context:** Phase 4 requires an assessment of compiling Rockbox's official skin parser to WebAssembly before any implementation begins. The relevant parser and renderer are GPL-2.0-or-later C code, depend on target-generated configuration and headers, use native pointers and process-global state, and read skins, bitmaps, fonts, and settings through Rockbox filesystem conventions. A useful in-browser port would therefore be more than a small parser binary: it would need a target build, resettable memory ownership, a virtual `.rockbox` filesystem, asset/font bridges, and a documented GPL distribution strategy.

**Decision:** Do not compile or distribute the official parser or skin engine as WebAssembly in the current browser application. Keep the browser's lossless parser, semantic projection, and renderer independently implemented. Use the pinned upstream `checkwps` program and Rockbox UI simulator as external, target-specific development oracles.

- **License:** no Rockbox source, object, executable, or WebAssembly module is committed, bundled, or served. A future GPL WebAssembly distribution requires an explicit licensing and delivery decision before implementation.
- **Build system:** official tools are built out of tree from the exact tag-registry SHA with target-generated configuration. The repository stores only harness code and derived reports.
- **Memory model:** the official process retains its native global state, pointer model, framebuffer, and allocators. The browser does not share memory with it.
- **Filesystem interface:** the harness creates a private temporary simulator disk, installs only authored fixtures, and records no user path in reports. Browser code receives neither filesystem paths nor simulator files.
- **Browser bundle impact:** zero official-engine bytes enter the client bundle. The measured main chunk changes from the Phase 3 581.30 KB / 170.99 KB gzip baseline to 583.24 KB / 171.72 KB gzip, an increase of 1.94 KB minified / 0.73 KB gzip. The detailed 386-row Compatibility Lab is progressively disclosed in a separate 129.33 KB / 8.88 KB gzip chunk that loads only when opened.
- **Upstream updates:** regenerate the registry first, then rebuild both external tools at that exact SHA and regenerate the official reports. A SHA mismatch fails before validation.

The canonical render harness launches the unmodified simulator with dummy audio/video drivers, triggers Rockbox's own `sim_trigger_screendump()` path, normalizes its firmware framebuffer BMP, and compares it with the deterministic browser pixel renderer. It performs two clean captures and refuses a report if the official pixels differ between runs or if any differing pixel is unclassified.

**Consequences:** Phase 4 gains official parser and pixel evidence without crossing the existing GPL distribution boundary or adding a large client dependency. Validation that regenerates official evidence requires a matching Rockbox checkout, target toolchain, simulator build, and currently LLDB on macOS; ordinary project validation verifies the checked-in report offline. Official parser acceptance and pixel comparison remain evidence for the tested target/fixture only, not a blanket compatibility claim. A future WebAssembly port remains possible only after a separate ADR resolves licensing, build, memory, filesystem, bundle, and update obligations.
