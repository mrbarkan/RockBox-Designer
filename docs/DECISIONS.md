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

**Decision:** Interpret WPS, SBS, and FMS from their authoritative CST documents through one screen-aware semantic engine. Represent menu/list rows, quick-screen controls, and tuner state as clearly labeled derived firmware projections inside source-defined UI viewports. Use source-verified activity and icon IDs. Route USB through SBS activity 21, retain the compiled logo as a labeled firmware fallback inside the theme-selected UI viewport, and do not invent unsupported theme files.

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

## ADR-0015 — Use a deterministic browser state engine behind first-class Play mode

**Status:** Accepted

**Context:** Phase 5 requires playback, power, device, clock, FM, touch, and remote scenarios that drive real skin conditionals. The previous bottom panel mixed simulation controls into the visual editor and used `Date.now()` for momentary tags, so the same nominal state could render differently later and could not be shared as a stable scenario. The Pulp UX direction also requires Play to be a distinct, prominent workflow rather than another overloaded editor panel.

**Decision:** `rockbox/simulator/` owns canonical scenario definitions, pure state transitions, target-capability enforcement, and stable `?play=<scenario-id>` links. A scenario always resets from the same simulation/song baseline. Runtime time is a monotonic `timelineMs` field: playback progress, seeking, RTC advancement, scrolling, `%mv`, and `%Tl` use that clock rather than wall-clock time. Manual changes intentionally mark the session as custom; preset links share only named deterministic scenarios.

Play is a lazy-loaded Level A browser simulator. It uses the existing source-linked renderer inside a separate `DeviceShell` component. The shell may map click-wheel or verified touch input to simulation actions, but it never draws or owns theme pixels. The old duplicated simulation panel is removed; Screens retains a compact scenario strip and a prominent Play entry. Target profiles gate FMS, touch, album-art, RTC, and remote behavior before a state reaches the semantic interpreter. Rockbox activities route to WPS, FMS, or SBS; USB uses the SBS source at activity 21 and labels only the compiled fallback as firmware-owned.

Rockbox status numbering, charger/USB truth values, RTC presence, RTL-language state, tuner/RDS state, and touch timeout behavior were rechecked at upstream commit `078a506dfd0deb18165a3ed80c7fcbdb3afb0d31`. The browser implementation remains independent and does not include upstream code.

**Consequences:** Named scenarios are repeatable, URL-shareable, and immediately exercise source conditionals. iPod Classic cannot enter FM scenarios, and neither current profile pretends to support touch or remote LCD. The RTL state is a browser bidi preview, not a new official pixel-parity claim. The main production chunk is 584.83 KB / 172.99 KB gzip; Play is progressively disclosed in a separate 15.63 KB / 4.10 KB gzip chunk.

## ADR-0016 — Store components as reversible source transactions

**Status:** Accepted

**Context:** The legacy preset palette created flat canvas elements, used random IDs, and copied placeholder data URLs. That model could not preserve imported source ordering, allocate image/viewport identities safely, retain binary package assets, remove shared assets conservatively, or prove target validity. A component also cannot be treated as only an image because Rockbox behaviors commonly combine viewports, conditionals, preloads, tags, and target requirements.

**Decision:** `rockbox/components/` defines a versioned, target-aware catalog and a source-transaction engine. Every definition declares its supported screens/targets, required device capabilities and tags, source template, binary assets, editable properties, insertion location, complexity, and validation rules. An inserted instance stores its definition/version, exact root source-node IDs, allocated handle/viewport name, asset identities/references, and resolved property values.

Insertion refuses unsupported or invalid-source contexts, allocates deterministic collision-free names, hashes binary assets, avoids overwriting imported path conflicts, and inserts a source-only marker plus fragment under a stable CST node prefix. Existing source remains untouched around that fragment. Component assets live beside imported package assets in a separate project collection and merge by archive path only during export. Removal operates only on the recorded root boundary and retains an asset whenever another instance or any remaining source document references it; imported package assets are never deleted.

The focused Components workspace is lazy-loaded. It shows unavailable definitions and their reasons instead of hiding target restrictions. The initial 19-definition catalog is validated through 53 accepted target/screen CheckWPS runs across `ipodvideo` and `ipod6g`; the touch definition is recorded as unavailable because neither current profile has a touchscreen. Rockbox source and validator binaries remain external at the pinned SHA.

**Consequences:** Component insert/remove is exact, reversible, package-aware, and naturally covered by whole-project undo. Imported or manually written source is not heuristically converted into components. Editing source inside a recorded component boundary may make safe removal refuse until the user resolves the conflict. Personal/public component sharing remains deferred until the versioned format has further real-world evidence. The main production chunk is 582.02 KB / 172.23 KB gzip; Components loads as 9.31 KB / 2.75 KB gzip UI plus a shared 14.25 KB / 5.15 KB gzip component-domain chunk.

## ADR-0017 — Keep the full Rockbox simulator external

**Status:** Accepted

**Context:** Phase 7 asks whether the actual Rockbox UI simulator can run in a browser. A pinned iPod Video simulator core builds and runs outside this repository, and the existing official harness loads an authored theme and captures two reproducible firmware framebuffers. The full simulator is not only a display library: it combines GPL firmware UI code, target-generated configuration, SDL threads and blocking input, timing, audio callbacks, a synchronous mutable simulator disk, and dynamically loaded codecs/plugins.

Emscripten can supply SDL, pthreads, virtual filesystems, persistence, dynamic modules, and `setjmp`/`longjmp` compatibility, but the combination needs explicit product architecture. Pthreads require cross-origin isolation, browser main-loop code must yield, persistent storage synchronizes asynchronously, dynamic linking with pthreads remains high-risk, and the measured native core excludes the codec/plugin bundle. Serving a WebAssembly derivative also requires a GPL source-delivery, notices, hosting, versioning, and upstream-update policy.

**Decision:** Phase 7 passes through its documented-feasibility-report acceptance path. Do not start or distribute a Level C WebAssembly port unless the owner later approves:

- a GPL-compatible distribution and corresponding-source delivery model;
- hosted cross-origin isolation and supported-browser policy;
- a maintained Emscripten target/build path;
- pthread scheduler and asynchronous main-loop behavior;
- static versus dynamic codec/plugin packaging;
- simulator-disk mounting, persistence, quotas, reset, and editor synchronization;
- audio, background timing, bundle, memory, startup, and performance budgets;
- initial target scope and pinned-upstream update ownership.

Keep the current levels explicit: Level A is the independent deterministic browser state simulator, Level B is external official validation, and Level C is not shipped. The external Phase 7 recipe may build the iPod Video core and minimum runtime from the exact registry SHA, apply a generated-Makefile-only Apple Clang override for local feasibility, and smoke-launch it with dummy SDL drivers. It must not write Rockbox source, objects, binaries, runtime assets, or screenshots into the repository.

On 2026-07-16 the owner chose the external Level C path. The actual Rockbox UI simulator at a pinned target and SHA is the behavioral authority for firmware UI and theme behavior; the browser will not carry a partial WebAssembly runtime. This choice does not turn simulator evidence into a claim about device-only hardware behavior.

**Consequences:** Native target, generated-theme load, and screenshot stages are evidenced without changing the browser client or adding a GPL artifact. The checked report records every browser-port blocker, exact upstream paths, external binary/runtime metrics, and the zero-byte browser impact. The editor remains usable independently. Prototype stages 4 and 5 are intentionally closed under the chosen external architecture rather than remaining a pending product blocker. Target-specific external simulator recipes may expand only with pinned evidence.

## ADR-0018 — Export Firmware Mode as a SHA-pinned source package

**Status:** Accepted

**Context:** The target-selected built-in USB fallback bitmap and its final placement are owned by `apps/gui/usb_screen.c`, while the surrounding connected presentation is authored in SBS. Representing either as a `.usb` theme file would be fictional. Building firmware in the browser would require a cross compiler, Rockbox source, GPL distribution, and risky device-install workflow inside the ordinary theme editor.

**Decision:** Firmware Mode is a separate, lazy-loaded, opt-in workspace. Its first verified target is `ipodvideo` at `078a506dfd0deb18165a3ed80c7fcbdb3afb0d31`. It accepts only a 176 × 48 uncompressed 24-bit BMP, generates a small reviewable source patch plus GPL header and target asset overlay, and exports deterministic verification/build instructions. Export requires explicit custom-firmware and recovery acknowledgements. The package refuses any other Rockbox SHA, builds in a detached external worktree, and contains no Rockbox tree, compiled firmware, or proprietary component.

Theme Mode, its ZIP format, and its source-preserving document pipeline do not import Firmware Mode state. iPod Classic remains unavailable until separately verified. External target builds are acceptance evidence; the browser never claims to have compiled or hardware-tested the result.

**Consequences:** The compiled fallback now has an honest end-to-end modification path without weakening ordinary SBS theme semantics or bundling a Rockbox source tree or binary. The archive explicitly identifies its Rockbox-derived patch and generated source as GPL, and includes the matching notice. The pinned patch applies cleanly, and two complete iPod Video builds produced byte-identical `rockbox.ipod` images. The local evidence compiler was Arm GNU 9.3.1 rather than Rockbox's recommended 9.5.0, so the report preserves that warning and the exported instructions default to the recommended toolchain. Users still need target recovery knowledge and actual-device testing before installation.

## ADR-0019 — Model USB connected as an SBS activity scene

**Status:** Accepted; amends ADR-0011, ADR-0015, and the USB wording in ADR-0018

**Context:** Reinspection of pinned Rockbox source and the Adwaitapod theme showed that the earlier “stock USB boundary” wording was too broad. `usb_screen.c` enters `ACTIVITY_USBSCREEN` (value 21), uses the SBS-selected `%VI` UI viewport as the parent for the built-in logo, and draws that firmware fallback after the skin. Adwaitapod uses `%?if(%cs, =, 21)`, `%VI(USB)`, `%Vd(...)`, and a 1 × 1 `%Vi(USB,...)` to author the connected scene and clip the fallback without any `.usb` file.

**Decision:** A USB preview is a scene over the authoritative SBS document, never a standalone theme document. Screen routing, source editing, source-linked rendering, and legacy fallback evaluation map the UI's USB scene to SBS while setting activity 21. Theme operations render first; a separate external-authority operation represents the built-in firmware logo in the selected UI viewport. A 1 × 1 viewport intentionally suppresses that placeholder. Firmware Assets modifies only the compiled fallback bitmap/placement. Generic component insertion stays unavailable in the USB scene until it can create an explicit activity-guarded SBS transaction safely.

**Consequences:** Real themes can reproduce their authored USB presentation in Theme Mode and Play without flattening or inventing source. Comments remain source-only, and USB edits update SBS. The app still does not claim full firmware parity: the Level C simulator remains authoritative, and the firmware fallback, USB protocol, bootloader, and hardware behavior stay external. The private Adwaitapod acceptance now requires both USB notification text and bitmap operations plus its exact 1 × 1 fallback viewport at upstream commit `078a506dfd0deb18165a3ed80c7fcbdb3afb0d31`.
