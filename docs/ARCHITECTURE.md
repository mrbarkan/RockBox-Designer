# Architecture

## Current baseline

Rockbox Designer is a browser-only React application. `App.tsx` coordinates a central `ProjectState`, visual editing, simulation, persistence, theme package import, and export.

The prototype currently has two overlapping theme representations:

1. A flat list of visual `WpsElement` values used by the original canvas and compiler.
2. An early Rockbox AST used by the newer preview, editing helpers, and serializer.

The AST becomes the export source when a screen has one, but it is not lossless. Its parser splits arguments and its serializer reconstructs syntax. Phase 0 intentionally leaves that behavior unchanged.

## Phase 1A lossless syntax layer

`rockbox/syntax/` now exists beside the legacy services:

- `sourceText.ts` indexes line starts and creates absolute, half-open source spans.
- `tokenizer.ts` preserves lexical text, newlines, comments, escapes, conditional introducers, and delimiters.
- `parser.ts` creates text, escape, comment, tag, conditional, and invalid nodes while retaining every raw source slice.
- `serializer.ts` returns the original source slice for clean documents and raw node text for clean nodes. Dirty known tags regenerate only themselves with their original invocation style.
- `diagnostics.ts` provides severity, code, message, span, and recovery information.
- `services/rockboxSyntaxAdapter.ts` returns the lossless document and legacy AST in parallel for incremental caller migration.

Every root and conditional-branch document references the same original source string and carries its own absolute span. This prevents branch parsing from losing parent coordinates while allowing clean branch serialization to return only the branch slice.

## Phase 1B editing and migration layer

`rockbox/editing/` adds:

- immutable text, tag-argument, viewport, and image-reference commands;
- conditional branch replacement plus insert, delete, and move commands;
- stable node-ID traversal through nested conditional branches;
- known-tag argument schemas that retain raw whitespace and invocation style;
- query projections for the existing viewport, text, and image canvas controls;
- explicit diagnostics when an edit is missing, incompatible, or unsafe.

`ProjectState` may now carry `wpsDocument`, `sbsDocument`, and `fmsDocument`. New imports create lossless and legacy representations together. The lossless document is authoritative; `applyProjectSyntaxDocument()` serializes it and derives a fresh legacy AST only for the current preview evaluator. Old saved projects are parsed lazily from the legacy document's stored raw source.

## Legacy data flow being retired

```text
Theme ZIP
  -> explicit JSZip module
  -> lossless CFG, package, and screen parsers
  -> ProjectState
       -> visual elements -> graphics evaluator -> canvas
       -> early AST       -> AST evaluator      -> canvas
       -> storage / JSON save
       -> compiler or AST serializer -> theme ZIP
```

During Phase 1A, callers may opt into a parallel syntax result:

```text
Raw screen source
  -> lossless parser -> RockboxDocument (authority)
       -> source-aware commands -> updated RockboxDocument
       -> compiler/export/source preview
       -> legacy adapter -> RockboxAstDocument (derived render compatibility)
```

## Required source-of-truth rule

The original Rockbox source is authoritative inside the new syntax API. Visual state will become a projection over this lossless concrete syntax tree (CST), not a replacement for it. Untouched input already serializes exactly in the Phase 1A fixture corpus; application-wide authority moves in Phase 1B.

## Target module boundaries

- **Syntax:** Preserve source text, spans, formatting, unknown constructs, malformed input, and diagnostics.
- **Semantics:** Interpret only known syntax without changing the source representation.
- **Editing:** Apply immutable, narrow source updates and refuse unsafe destructive edits.
- **Rendering:** Convert interpreted operations into device-native pixels.
- **Validation:** Report browser support and optional official Rockbox parser results separately.
- **Packages:** Preserve CFG lines, source files, paths, and binary assets; produce deterministic exports.
- **Devices:** Supply target dimensions and capabilities from verified profiles rather than UI conditionals.
- **UI:** Present source, semantic state, diagnostics, and visual editing without becoming the source of truth.

## Editing flow target

```text
User edit -> source-aware command -> new CST document -> diagnostics
                                      -> semantic projection -> render list -> canvas
                                      -> exact/narrow serializer -> export
```

## Package flow target

```text
ZIP bytes -> path-safe manifest -> source documents + binary asset store
          -> edits
          -> deterministic manifest -> ZIP bytes
```

## Phase 1C package implementation

`rockbox/packages/` implements the package flow:

- `cfgParser.ts` retains every CFG line, delimiter, duplicate, unknown setting, whitespace choice, and newline.
- `paths.ts` normalizes separators and dot segments without basename fallback.
- `assetStore.ts` stores archive paths, `Uint8Array` bytes, hashes, kind, and MIME hints.
- `themeImporter.ts` resolves WPS/SBS/FMS from CFG paths, records missing references, and retains all unconsumed files as binary assets.
- `themeExporter.ts` sorts paths, fixes ZIP metadata, omits absent optional screens, and exports deterministic logical contents.

The existing UI may derive data URLs for `<img>` previews, but imported package bytes remain canonical in `ProjectState.themePackage`. Project persistence has an explicit binary JSON encoding rather than relying on JavaScript's default typed-array serialization.

## Phase 1D tag registry

`rockbox/registry/` exposes the generated Rockbox tag table through typed lookup functions. The lossless parser asks `getLongestKnownTagAt()` for official tag boundaries; when no definition matches, it retains the complete alphanumeric future name as unknown source.

The registry is generated outside the browser from a local Rockbox checkout. Checked-in JSON contains factual identifiers and metadata only. Validation checks its schema, duplicate names, documented SHA, and—when `ROCKBOX_SOURCE_DIR` is present—exact regeneration. This does not execute or vendor the official parser.

## Phase 1E device profiles

`rockbox/devices/` owns source-referenced target identity, native screen dimensions, capabilities, supported screen files, legacy target aliases, and feature-gate queries. `ProjectSettings.target` now stores a profile ID rather than the old single-target literal.

Project deserialization migrates legacy IDs in direct JSON and nested mock-cloud records. The selected profile supplies dimensions to the canvas, alignment, both legacy evaluators, layout generation, and imported-screen defaults. The UI derives its theme-screen tabs and FM/touch presets from capabilities; unsupported source is hidden, not deleted.

## Phase 1F official validation bridge

`scripts/official/` builds upstream `tools/checkwps` in an external temporary directory and compares it with the browser parser over checked-in fixtures. The runner records both outcomes in `reports/official-parser/latest.json`; it does not make official acceptance the browser parser's source-of-truth or discard unknown syntax that Rockbox rejects.

`rockbox/validation/` owns the comparison categories independently of process execution. Ordinary tests exercise all category branches and verify the checked-in report without requiring Rockbox. The optional `test:official` command is the only path that needs `ROCKBOX_SOURCE_DIR` or executes GPL tooling.

## Phase 1G real-theme corpus

`scripts/themes/` discovers committed authored fixtures, ignored private fixtures, and configured local fixture directories. It imports each package, checks exact CFG/WPS/SBS/FMS serialization, exports and re-imports it, compares manifests and asset hashes, records syntax and package diagnostics, inventories support levels, and optionally invokes the Phase 1F CheckWPS bridge.

Rockbox bitmap references can resolve beside a screen or in the conventional sibling directory named after that screen. Resolution remains archive-path based and case-sensitive; there is no global basename fallback. Reports explicitly keep preservation, parsing, interpretation, rendering, editing, and official validation as separate evidence dimensions.

## Rendering flow target

Rendering should operate at the selected device's native pixel dimensions, with integer coordinates and explicit clipping. DOM overlays may provide editing handles but must not define the rendered pixel positions.

## Phase 1G boundary

Phase 1G adds reproducible corpus evidence without committing third-party themes, changing browser acceptance rules, expanding semantic rendering, or redesigning the interface. Phase 2 begins the semantic and rendering migration.

## Phase 2 source-linked WPS editor

`rockbox/semantics/` walks the authoritative `RockboxDocument` and emits a documented render-operation subset plus a logic-aware layer model. Every operation carries the originating CST node ID and source span. Context state covers Rockbox-relative viewport geometry, `%Fl` font slots, colors, alignment, conditional viewport activation, bitmap preloads, album-art geometry, timed sublines, and scrolling state. Conditional selection is derived from deterministic simulation/settings fields, the evidenced logical-expression subset, or an explicit per-conditional branch override.

`rockbox/rendering/` consumes that device-independent list. The browser renderer draws at the profile's native resolution, rounds coordinates, clips viewports explicitly, disables bitmap interpolation, applies Rockbox's magenta bitmap transparency key, composes image-backed bars, and lets CSS scale only the completed canvas. A separate dependency-free RGB renderer produces deterministic golden images for CI.

```text
RockboxDocument (authority)
  -> semantic interpreter
       -> RenderOperation[] + source links -> native canvas pixels
       -> SemanticLayer[]                  -> logic-aware panel + inspector
  -> source-aware command
       -> new RockboxDocument -> interpreter -> preview/export
```

The source editor reparses applied WPS/SBS/FMS text. For WPS, a document with error diagnostics remains stored and editable while the UI retains the last valid semantic operations and marks the preview stale. Unsupported nodes never disappear from source or the layer model.

## Phase 2 boundary

Phase 2 migrates the documented WPS subset only. The legacy visual-element path remains available for synthetic projects and non-WPS screens. Exact Rockbox font metrics, expression operands outside the evidenced subset, SBS/FMS semantics, list/menu behavior, and broad simulator-reference comparison are explicit later-phase work.

## Phase 3 screen semantics

The Phase 2 operation and layer model now accepts an explicit WPS, SBS, or FMS screen context. `App.tsx` caches the last valid interpretation per project and screen so invalid source cannot replace another screen's render state. Imports retain all three authoritative documents and project relevant lossless CFG values into the simulation/render settings without rewriting the CFG.

```text
WPS/SBS/FMS RockboxDocument
  -> screen-aware semantic interpreter
       -> authored operations linked to CST nodes
       -> firmware-derived operations labeled by screen state
  -> native canvas + logic-aware layer panel
```

SBS interpretation tracks current activity and active `%Vi` UI viewports. Menu/list rows, selector, scrollbar, and themeable icon-strip frames are derived from verified firmware state rather than flattened into source elements. The quick-screen uses the same SBS parent and is labeled as a firmware-controlled layout. USB connected routes through the same SBS document at activity 21; authored scene pixels render normally, followed by a separate compiled-fallback operation clipped to the `%VI`-selected viewport. No fictional `.usb` source exists. FMS interpretation projects the documented frequency, preset, signal, stereo, tuned/scan, and RDS subset.

Comments are a syntax concern only. They remain exact in the source document and serializer and are excluded from both compatibility elements and semantic layer inventory.

## Phase 3 font boundary

`rockbox/fonts/` independently validates the RB12 file header and exposes actual Rockbox font metrics. Existing `.fnt` bytes are canonical package assets under `.rockbox/fonts/`; UI display of metrics does not decode or redraw the bitmap glyphs.

Development conversion uses the pinned upstream `tools/convttf.c` from a separate checkout. `scripts/fonts/` builds its executable into a temporary directory, converts a licensed TTF/OTF/TTC input, validates the generated RB12 file, preserves it through package export/re-import, and can confirm that current Rockbox loads it in an external simulator. The repository distributes none of the GPL source, executable, input font, or generated font.

## Phase 4 official comparison boundary

The official Rockbox parser and skin renderer remain out-of-process development oracles. ADR-0014 rejects a current WebAssembly distribution after assessing its GPL license, target-generated build, native/global memory model, `.rockbox` filesystem needs, client-bundle impact, and upstream-update workflow.

`scripts/phase4/` uses the pinned external tools in two ways:

- Target-specific CheckWPS runs attach accepted fixture IDs to individual tag/device evidence rows.
- An unmodified iPod Video simulator renders an authored SBS and emits its own firmware framebuffer through Rockbox's screen-dump path.

The official capture is repeated from clean temporary simulator disks. Its normalized pixel hash must be stable. The browser's deterministic RGB render, official framebuffer, and visual diff are generated locally; only hashes, metrics, classifications, and support rows are checked in. No browser code receives simulator filesystem paths or GPL artifacts.

The Compatibility Lab reads the checked-in evidence report. It does not infer semantic support from the upstream name registry: 193 recognized names remain distinct from the smaller interpreted, rendered, editable, and officially exercised subsets.

## Phase 5 deterministic simulator

`rockbox/simulator/` separates deterministic scenario/state behavior from React and from screen drawing:

```text
named scenario or user input
  -> pure SimulatorAction transition + DeviceProfile gates
  -> SimulationState + SongMetadata + active screen/surface
  -> source-linked semantic interpreter
  -> native-pixel screen renderer

DeviceShell
  -> maps physical/touch controls to SimulatorAction
  -> contains the rendered screen
  -> never owns or generates theme pixels
```

The simulator uses a monotonic `timelineMs` value for playback progress, seek motion, RTC advancement, timed sublines, scrolling, `%mv`, and `%Tl`. Named scenarios always start from the same baseline and share through `?play=<scenario-id>`. Arbitrary manual state is labeled custom instead of being mistaken for the named preset.

Play is a first-class, lazy-loaded Level A workflow. The editor header and compact Screens state strip open it; the former four-column simulation panel is removed. The same `SimulationState` drives the editor preview and Play, so conditional evaluation cannot diverge between modes. Device-profile enforcement happens both when a preset is selected and after every transition. Unsupported FM, touch, remote, RTC, or album-art state never becomes an implied target feature.

The semantic interpreter now treats `%cS`, `%cc`, `%Sr`, `%Tp`, and `%Tl` as explicit state/capability projections. This raises the checked-in support catalog to 101 interpreted/rendered tags without changing the 12 source-aware edit surfaces or claiming new official pixel parity.

## Phase 6 source-aware component transactions

`rockbox/components/` owns a versioned definition catalog and immutable insertion/removal engine:

```text
component definition + property values + DeviceProfile
  -> capability/screen/source validation
  -> deterministic instance ID + collision-free handle/viewport
  -> binary asset hash/path allocation
  -> source template
  -> stable prefixed CST nodes + instance metadata
  -> one ProjectState history update

component removal
  -> verify exact recorded root boundary
  -> remove only those CST nodes
  -> retain assets referenced by another instance or any remaining source
  -> never delete imported ThemePackage assets
```

For synthetic projects, the existing compiled screen becomes the initial authoritative document before insertion. For imported themes, insertion adds nodes around the existing lossless document without normalizing it. Marker comments remain source-only and never enter the visual layer projection.

Generated binary assets are stored in `ProjectState.componentAssets`; imported bytes remain in `ThemePackage.assets`. Export combines the two by exact archive path and does not replace an imported path. A different generated bitmap receives a safe suffixed path. The initial battery strip is a deterministic 24-bit BMP rather than the legacy SVG data-URL placeholder.

Components is a lazy-loaded focused workspace with a compact Screens entry. The UI displays the complete contract and explicit target restrictions. `scripts/phase6/` exercises every available definition/target/screen combination through the external pinned CheckWPS tools and binds the checked report to hashes of the catalog, engine, and contract.

## Phase 7 full simulator feasibility boundary

The actual Rockbox UI simulator remains an external development runtime:

```text
Rockbox Designer browser
  -> Level A independent state + source-linked renderer
  -> no Rockbox runtime dependency

Phase 7 development evidence
  -> pinned external Rockbox checkout
  -> external target-generated iPod Video simulator core
  -> private minimum simulator disk
  -> authored-theme load + firmware framebuffer dump
  -> derived checked report only
```

`scripts/phase7/build-native-ipodvideo.ts` generates and builds the native core outside the repository, installs the minimum theme runtime, and launch-smokes it with dummy SDL drivers. `scripts/phase7/run-simulator-feasibility.ts` checks the exact upstream SHA, inspects the simulator's build/thread/input/display/audio/filesystem/dynamic-loader paths, binds the result to the existing reproducible Phase 4 capture, and writes no local paths or simulator bytes.

ADR-0017 keeps Level C separate. A browser port would require a GPL distribution product plus a maintained Emscripten host build, pthread/main-loop architecture, virtual and persistent simulator disk, codec/plugin strategy, audio behavior, performance budgets, and an upstream refresh process. Until approved, the browser bundle has zero Phase 7 runtime bytes and Play remains accurately labeled Level A.

The owner selected the external Level C architecture. The pinned Rockbox simulator is authoritative for firmware UI/theme behavior on its recorded target and revision; it is not a substitute for testing device-only hardware effects.

## Phase 8 Firmware Mode source packages

Firmware Mode is isolated from the theme document and package layers:

```text
explicit Firmware Mode entry
  -> verified DeviceProfile + exact Rockbox SHA
  -> target-specific asset validation
  -> generated source patch + GPL overlay + manifest
  -> deterministic source-package ZIP
  -> external clean worktree and cross build
  -> rockbox.ipod / rockbox.zip outside this repository

Theme Mode
  -> unchanged WPS/SBS/FMS/CFG/assets pipeline
  -> never imports Firmware Mode state
```

`rockbox/firmware/` owns the pure target contract, BMP inspection, patch/header generation, deterministic manifest, and package creation. `components/FirmwareMode.tsx` owns only opt-in interaction, recovery acknowledgement, preview placement, and download. `scripts/phase8/` extracts the actual generated package, verifies it against the pinned checkout, performs two complete device builds, and commits only derived hashes and metrics.

The first patch replaces the compiled USB fallback logo positioning expression with a generated macro and overlays the target-selected 176 × 48 bitmap. It neither invents a standard theme file nor owns the browser's SBS activity-21 scene semantics. ADR-0018 records the licensing, target, build, and recovery boundary; ADR-0019 records the split between the themeable scene and compiled fallback.

The accepted delivery architecture is a loopback-only local companion:

```text
Browser Font Workshop
  -> origin + protocol-checked request to 127.0.0.1
  -> bounded in-memory TTF/OTF/TTC bytes + size/range
  -> private temporary directory
  -> pinned external Rockbox convttf executable
  -> validated RB12 bytes + hashes + metrics
  -> browser re-validates RB12 -> exact .rockbox/fonts package asset
```

`scripts/fonts/local-helper.ts` never accepts browser file paths, binds no public interface, and accepts only known local app origins unless an origin is explicitly configured. It uses a matching external `ROCKBOX_SOURCE_DIR` or obtains the exact pinned upstream source into a SHA-keyed user cache and builds there. Conversion files are removed after each request. `services/fontCompanion.ts` implements the versioned browser client, and the Font Workshop keeps existing `.fnt` imports independent of helper availability.

The browser bundle contains no GPL source or executable and gains only the protocol client and UI. Input font licensing remains the user's responsibility; generated `.fnt` files should be shared only when the source license permits conversion and redistribution.
