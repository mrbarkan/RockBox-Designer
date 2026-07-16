# Implementation Status

Last updated: 2026-07-16

## Current phase

- **Phase:** Phase 7 full Rockbox simulator feasibility
- **Branch:** `codex/phase-7-full-simulator-feasibility`
- **Merged milestones:** Phase 0 through Phase 6; the source-aware component ecosystem merged in [PR #22](https://github.com/mrbarkan/RockBox-Designer/pull/22) at `9773386`.
- **Status:** Phase 7 acceptance passes through the documented-blocker path. One pinned external iPod Video core builds and launch-smokes, the prepared official harness loads an authored theme and emits two reproducible framebuffers, and the checked report covers every required feasibility area.
- **Scope boundary:** Level C WebAssembly was not started. ADR-0017 requires an explicit GPL distribution and browser-runtime decision before implementation. The browser client and editor remain independent with zero Phase 7 bundle bytes.
- **UX direction preserved:** Play remains accurately labeled Level A, external official validation remains Level B, and Level C remains visibly unshipped rather than being represented by a partial native port.

## Current architecture

- React 19 and Vite 6 provide the browser application and build pipeline.
- `App.tsx` owns the active `ProjectState` through the `useHistory` hook and coordinates editing, simulation, import, export, and storage.
- The project retains the legacy flat visual-element model for synthetic projects and fallback content, but imported WPS/SBS/FMS source now renders directly from its lossless document through shared screen-aware semantics.
- ZIP import in `services/rockboxParser.ts` reads a lossless CFG, builds compatibility elements without comments, creates WPS/SBS/FMS source documents, imports render-relevant CFG settings, and retains package bytes.
- ZIP export in `services/rockboxCompiler.ts` prefers serialized AST source when available and otherwise compiles the visual-element model.
- WPS canvas rendering uses a source-linked render list at native target pixels with Rockbox-relative viewport dimensions, explicit clipping, font-slot sizing, conditional viewport activation, nearest-neighbor bitmap scaling, transparent bitmap keys, image-backed bars, and non-tinting source-derived editing overlays.
- Imported package assets are binary and archive-path keyed; legacy upload controls still derive data URLs before export conversion. JSZip is an explicit module dependency.
- `rockbox/syntax/` now provides a separate lossless document model with absolute source spans, exact raw slices, diagnostics, a structural conditional model, a tokenizer, and a minimum-change serializer.
- `rockbox/editing/` provides immutable commands, semantic argument helpers for the Phase 1B tag subset, stable node-ID queries, and explicit failure diagnostics.
- New theme imports retain lossless WPS/SBS documents. Existing saved projects migrate lazily from their stored legacy raw source on first edit.
- The compiler, ZIP exporter, source editor, and code preview prefer the lossless document. A newly derived legacy AST remains only as the current renderer adapter.
- `rockbox/packages/` now owns lossless CFG parsing, strict archive paths, binary assets and hashes, package diagnostics, manifests, import, and deterministic export.
- Imported packages are canonical binary runtime state in `ProjectState.themePackage`; browser data URLs remain derived preview state.
- Project JSON and mock-cloud persistence encode `Uint8Array` values explicitly and restore them on load.
- `rockbox/registry/` exposes 193 generated Rockbox tag definitions from the pinned upstream SHA, including raw parameter specs, flags, tokens, categories, and baseline support states.
- The lossless parser now uses the registry for longest official tag-name matching and still preserves unmatched future names generically.
- `rockbox/devices/` now supplies two verified profile IDs, dimensions, capabilities, supported screen files, legacy aliases, and feature-gate queries.
- Canvas sizing, alignment, legacy evaluators, layout generation, and import defaults read the selected profile. The UI profile selector capability-gates FMS, FM presets, and touch presets without deleting source.
- `scripts/official/` builds target-specific upstream `checkwps` outside the repository and writes structured comparisons without bundling GPL source or binaries.
- `rockbox/validation/` models all required official-comparison categories; ordinary validation checks the report without requiring a Rockbox checkout.
- `scripts/themes/` generates public fixtures, prepares ignored private real-theme fixtures, and reports preservation, package, support, and optional CheckWPS evidence separately.
- `rockbox/semantics/` interprets the supported WPS/SBS/FMS subsets without mutating source, retains a CST source link on every authored render operation, and labels firmware-derived menu, quick-screen, and tuner projections separately.
- `rockbox/rendering/` owns the browser canvas renderer and a deterministic RGB pixel renderer used for 320×240 WPS, SBS, and FMS goldens.
- The logic-aware right panel distinguishes global preloads, viewports, elements, conditionals, branches, source-only constructs, and unsupported preserved nodes. Losslessly preserved comments stay in the source editor and are intentionally omitted from the visual layer projection.
- `rockbox/fonts/` validates RB12 `.fnt` binaries and exposes actual height, ascent, width, range, and glyph metrics. Font assets are packaged byte-exact under `.rockbox/fonts/`.
- `scripts/fonts/` builds the pinned upstream `tools/convttf.c` only from an external checkout, converts licensed TTF/OTF/TTC inputs, and can verify generated output in an external Rockbox simulator. No GPL source, binary, or third-party generated font is bundled.
- The versioned local font helper binds to `127.0.0.1`, checks an exact origin allowlist and protocol header, accepts only in-memory font bytes/parameters, uses a private temporary directory, and returns validated RB12 bytes. The Font Workshop exposes connection, pixel-size, glyph-range, metrics, and licensing state without adding GPL code to the browser bundle.
- The Font Workshop and protocol client add 9.25 KB minified / 2.86 KB gzip to the Phase 3 production bundle; no native or GPL artifact is present in that delta.
- `scripts/phase4/` builds no browser dependency. It runs pinned external CheckWPS targets and an external simulator, normalizes screenshots, computes a classified pixel diff, and writes offline-verifiable evidence reports.
- `rockbox/semantics/` exports an explicit support catalog so the Compatibility Lab does not confuse 193 known tag names with the smaller interpreted/rendered subset.
- The Compatibility Lab remains an advanced code-split evidence modal. The checked-in Pulp guideline now informs the first focused migration—Play—without widening Phase 5 into the remaining Theme/Components/Assets/Logic studio modes.
- `rockbox/simulator/` owns deterministic scenarios, pure state transitions, capability enforcement, and stable scenario links. `timelineMs` replaces wall-clock reads for playback, seek, RTC, scrolling, `%mv`, and `%Tl`.
- Play is a first-class, lazy-loaded Level A workflow. `DeviceShell` maps physical or verified touch input around the existing renderer without owning screen pixels. The old four-column simulation panel is removed; Screens retains a compact scenario strip.
- The Phase 5 main chunk is 584.83 KB / 172.99 KB gzip and the Play chunk is 15.63 KB / 4.10 KB gzip. The checked compatibility catalog now records 101 interpreted/rendered tags and still only 12 source-aware edit surfaces.
- `rockbox/components/` owns the versioned catalog, target/screen gates, deterministic identity allocation, source transactions, binary component assets, conflict reporting, and conservative shared-asset removal.
- Component instance metadata records exact root CST nodes, definition/version, resolved properties, allocated handle/viewport names, and asset identities. Imported package assets remain separate and cannot be deleted by component removal.
- Components is a focused lazy-loaded mode. The main chunk is 582.02 KB / 172.23 KB gzip; the Components UI is 9.31 KB / 2.75 KB gzip and its shared component-domain chunk is 14.25 KB / 5.15 KB gzip.
- `scripts/phase7/` builds and launch-smokes one pinned native simulator core outside the repository, inspects the complete upstream SDL/build/runtime boundary, and writes a derived feasibility report without local paths or GPL artifacts.
- ADR-0017 keeps actual Rockbox runtime delivery outside the browser until GPL source delivery, hosted isolation, build, thread/main-loop, dynamic-code, persistence, audio, performance, target, and maintenance choices are approved.
- The measured canonical external simulator is a 1,581,480-byte iPod Video core with a 2,058,415-byte/129-file prepared minimum runtime. It excludes codecs/plugins and is development evidence, not a distributed application asset.

## Baseline findings

Before Phase 0 changes:

- `npm install` completed with zero reported vulnerabilities.
- `npm run build` passed.
- `npm run typecheck` and `npm test` did not exist.
- Direct `npx tsc --noEmit` failed because `types.ts` duplicated the AST type declarations and `EditorCanvas.tsx` was missing AST editor imports and callback props.
- There were no open pull requests in `mrbarkan/RockBox-Designer`.
- `origin/agent/phase-1-parser-foundation` pointed at the same commit as `main` and contained no separate implementation.

## Existing features that must not regress

- Visual editing for WPS, SBS, FMS, and USB workspace modes.
- Canvas-based preview, selection, dragging, resizing, layer ordering, and project history.
- AST preview and narrow viewport, text, and image edits.
- Deterministic playback, seek, track, metadata, album-art, volume, power, hold, USB, repeat, shuffle, RTC, disk, FM/RDS, touch-capability, and remote-capability state controls.
- Theme ZIP import/export, project JSON save/load, font and image upload, and browser storage workflows.
- Preset component generation and optional Gemini-assisted layout generation.

## Known parser and package risks

- WPS viewport, text, image, color, bar, album-art, touch, and conditional controls project from and edit the lossless document. SBS/FMS share that engine for the documented screen-specific subset.
- The source editor applies WPS/SBS/FMS text through the lossless parser. Invalid source remains authoritative while the canvas visibly holds the last valid semantic render for the active screen.
- Official tag names come from generated upstream metadata; interpretation and editing remain intentionally limited to evidenced subsets.
- Legacy pipe-style argument boundaries still use a small transitional arity table outside the evidenced image/viewport subset.
- CFG source and unknown settings are preserved. Imported font, icon, color, selector, statusbar, scrollbar, display, backlight, scroll, and quick-setting values project into preview settings; broad settings-panel write-back to CFG remains incomplete.
- Package path resolution is deliberately case-sensitive; case mismatches are diagnostics rather than silent basename fallback. Conventional ZIPs with one outer wrapper directory resolve their absolute `/.rockbox/...` CFG references inside that wrapper.
- Binary assets are canonical for imported packages, while newly uploaded UI resources still enter through the legacy data-URL control before export conversion.
- FMS is supported by the package model and screen-aware semantics for frequency, presets, signal, stereo, tuned/scan, and RDS state. Tags outside that subset remain preserved and visibly unsupported.
- Syntax assumptions and official comparisons use Rockbox source at `078a506dfd0deb18165a3ed80c7fcbdb3afb0d31`; the latest local corpus report includes AMusicPod and Adwaitapod.
- Imported RB12 font metrics are exact and the binary packages exactly, but browser glyph rasterization still uses browser text rather than the Rockbox bitmap glyphs. The evidenced `%?if`, `%?and`, `%?or`, `%St`, and `%ss` subset is automatic; other operands remain preserved and visibly unsupported.
- Level A Play state is deterministic and shareable by named scenario, but it is not a full firmware simulator. Custom state is intentionally not encoded into scenario URLs.

## Validation

Latest passing validation on 2026-07-16:

```text
npm run typecheck      passed
npm test               passed — 29 files, 164 tests
npm run build          passed — Vite production build; Play and Components code-split
npm run validate       passed — registry/device/report verification, typecheck, test, and build
npm run test:coverage  passed — coverage runner operational
official validation   passed — 6 fixtures executed against `checkwps.ipodvideo`
npm run test:themes    passed — 4 themes, 4 exact round trips, 4 manifest matches
npm run test:visual    passed — deterministic 320×240 golden screenshot
npm run test:phase2-real passed — AMusicPod and Adwaitapod visual edit/export/re-import
Phase 2 official       passed — edited exported Authored Full WPS accepted by CheckWPS
npm run test:phase3-real passed — Adwaitapod WPS/SBS/FMS exact import/edit/export/re-import
Phase 3 official       passed — edited exported Authored Full WPS/SBS/FMS accepted by CheckWPS
Phase 3 font           passed — generated RB12 package round-trip and current Rockbox simulator load
Phase 3 local helper   passed — real Arial TTF converted through loopback protocol to validated 5,337-byte RB12
Phase 4 render report passed — 2 reproducible simulator captures, 6,315 classified differences, 0 unclassified
Phase 4 compatibility passed — 386 tag/device rows across iPod Video and iPod Classic
npm run test:phase5    passed — deterministic scenarios, transitions, conditionals, capability gates, and Play UI
npm run test:phase6    passed — 11 component contract, collision, target, property, asset, persistence, package, and focused-UI tests
Phase 6 official       passed — 53/53 available component/target/screen fixtures accepted by CheckWPS
npm run test:phase7    passed — 3 feasibility boundary, stage, and independence tests
Phase 7 native         passed — external iPod Video core built and launch-smoked with dummy SDL drivers
Phase 7 feasibility    passed — native/theme/capture stages evidenced; 7 browser-port constraint groups documented
Phase 7 report         passed — offline report verification, no local paths or bundled simulator artifacts
```

Phase 1F evidence:

- The bridge builds Rockbox `tools/checkwps` from `ROCKBOX_SOURCE_DIR` in a temporary SHA/target cache and requires the checkout to match `078a506dfd0deb18165a3ed80c7fcbdb3afb0d31`.
- No Rockbox source, object, or executable is written into or bundled from this repository.
- Six fixtures ran against `checkwps.ipodvideo`: three accepted by both, one future tag preserved only by the browser, one diagnostic difference, and one target-dependent result.
- All six browser sources round-trip exactly; no official execution failed.
- The report records source hashes, browser diagnostics, official output/exit codes, target, tool, repository, and exact SHA.
- Missing setup fails clearly; `ROCKBOX_OFFICIAL_SKIP=1` is the only explicit skip path. Ordinary tests remain self-contained.

Phase 1G evidence:

- Two deterministic authored public fixtures and two ignored private local real themes were tested.
- AMusicPod and Adwaitapod preserved every CFG/WPS/SBS byte and complete package manifest through export/re-import with zero browser diagnostics or missing assets.
- CheckWPS accepted Adwaitapod and Authored Full. Authored Basic is intentionally rejected for its future tag; AMusicPod's original WPS rejection at line 119 is recorded without rewriting the source.
- Private third-party ZIPs and provenance sidecars remain ignored; only locally authored CC0 fixtures are committed.

Phase 2 evidence:

- Every semantic render operation carries its originating CST node ID and span; unsupported nodes remain visible as preserved source layers.
- AMusicPod and Adwaitapod each accepted a one-pixel viewport edit, updated the semantic projection, serialized only the intended tag, exported/re-imported exactly, and retained all asset hashes.
- The authored full-screen package completed import, source-aware edit, export, and re-import, then its edited WPS was accepted by `checkwps.ipodvideo` at the pinned SHA.
- Conditional playback branches follow simulation state and can be overridden explicitly in the layer panel. Invalid source diagnostics make the preview visibly stale instead of replacing the last valid render.
- A checked-in 320×240 PPM golden verifies deterministic native-pixel output. The original milestone used integration and package tests for import/edit interaction; the completed real-theme browser comparison for the dogfood correction is recorded below.

Adwaitapod dogfood correction evidence:

- The user-supplied Adwaitapod 3.3 ZIP (`SHA-256 4fda0f1b490a39ff3871b27d5d99d697adbcf3b6c34c2587e132e77bc53dd3a0`) imported its wrapped WPS, SBS, FMS, and referenced assets with zero package diagnostics. The private file is not committed.
- Its original WPS was accepted by `checkwps.ipodvideo` built from the pinned Rockbox SHA.
- Its WPS now activates only Player, info, and the correct playtime viewport for the default simulation; false Lockscreen, AOD, volume, and unused playtime branches do not paint.
- A side-by-side local browser render against the supplied 320×240 reference verified album-art geometry, title/secondary rows, time labels, counter, sprites, transparent bitmap edges, and the image/backdrop/slider progress composition.
- Interaction overlays remain available for editing but no longer stack translucent fills or labels over the theme when they are neither selected nor in debug mode.

Phase 2 dogfood-hardening evidence:

- A semantic regression fixture proves comments remain present in the lossless document while producing no visual layer rows.
- Menu operation rows now have stable component identity outside the timer-driven application render, preventing hover state from being discarded every 100 ms.
- A local browser smoke held the menu open while the simulation subline timer advanced and confirmed the menu rows remained mounted and available.

Phase 3 evidence:

- The ignored user-supplied Adwaitapod fixture imports WPS, SBS, and FMS with zero package diagnostics. Every untouched source is exact, a one-pixel viewport edit updates each semantic projection, and export/re-import retains the edited source path and every asset.
- Comments remain lossless source-only constructs on all three screens. SBS projects the active `%Vi` menu or quick-screen viewport using source-verified activity and icon IDs, imported selector/icon/scrollbar settings, and stable firmware-derived rows. FMS projects frequency, preset, signal, stereo, and RDS simulation state.
- The authored WPS, SBS, and FMS edited exports were each accepted by target-specific `checkwps.ipodvideo` built at the pinned upstream SHA. Deterministic SBS and FMS 320×240 goldens supplement the WPS golden.
- The external native font workflow converted a licensed local TTF sample into a 5,337-byte RB12 file with 95 glyph slots, preserved those bytes through a theme package, and loaded it in a current Rockbox iPod Video simulator with matching 16-pixel height, first character, and glyph count.
- Rockbox source, tools, binaries, generated font bytes, and private theme ZIPs remain outside the repository.
- The accepted local companion converted a real TTF through the same loopback HTTP contract used by the browser and returned the expected `16-Arial.fnt` hash and RB12 metrics. Chrome then completed the Font Workshop flow and set the generated 16px/13px/95-glyph font as the project font.
- Security tests prove an unapproved remote origin and an unknown loopback port are rejected before conversion; the custom protocol header, safe basename, bounded input, and Unicode-range checks are mandatory.

Phase 4 evidence:

- ADR-0014 covers the required official-parser WebAssembly license, build, memory, filesystem, bundle, and upstream-update questions. No official parser or renderer code is shipped.
- The authored iPod Video SBS is rendered by an unmodified Rockbox simulator through the upstream framebuffer-dump path. Two clean runs produce the same normalized official hash.
- The browser and official 320×240 images differ at 6,315 of 76,800 pixels. All differences are classified; native font/text layout and selector approximation are non-zero, while the background outside the UI viewport matches.
- The compatibility report contains 193 tags × 2 device profiles. Preservation and parsing stay separate from 101 interpreted/rendered tags, 12 user-facing source-aware edit surfaces, 13 officially evidenced Video tags, 11 officially evidenced Classic tags, and one currently known visual-difference tag.
- iPod Classic radio tags are preserved and parsed but visibly unavailable because the verified target profile has no FM screen. Touch-only tags are also marked unavailable on both non-touch iPod profiles.
- Browser, official, and diff images are generated locally and ignored. Checked-in reports retain only hashes, metrics, evidence IDs, and classifications.

Phase 5 evidence:

- Every named scenario is deterministic under repeated creation and round-trips through a stable `?play=<scenario-id>` URL.
- Pure actions cover play, pause, stop, five-times seek motion, elapsed time, next/previous track, RTC, click-wheel input, touch coordinates, and momentary volume/recent-touch state.
- Scenario tests select real `%mp`, `%bc`, `%bp`, `%bu`, `%mh`, `%C`, `%Sr`, `%cc`, `%tp`, `%Tp`, `%Tl`, and `%mv` branches in the source-linked semantic interpreter.
- iPod Classic cannot enter FM/FMS scenarios. Neither current profile can enter touch or remote-display scenarios, and the Play UI explains those restrictions without hiding preserved source.
- The device shell and screen renderer are separate components. Play reuses the same semantic result and native-pixel canvas as Screens rather than implementing a second renderer.
- Server-rendered UI tests verify Level A labeling, named scenario selection, complete state controls, and progressive capability explanations.

Phase 6 evidence:

- The 19-definition catalog covers every planned category and records source, assets, target/screen support, capabilities, editable properties, complexity, and validation.
- Existing CRLF source remains exact around inserted nodes. Stable node prefixes make component boundaries reversible without flattening imported documents.
- Repeated battery-strip insertion reuses one 2,934-byte 24-bit BMP while allocating different handles. Removing the first instance keeps the shared bytes; removing the last deletes them unless any remaining source still references the path.
- A conflicting imported asset path is retained byte-exact and the generated asset receives a safe numeric suffix.
- iPod Classic refuses FMS and FM components, both current profiles refuse touch components, and unavailable definitions remain visible with reasons.
- The official report covers both current targets and every available WPS/SBS/FMS combination: 53 accepted, zero rejected. The touch-only definition is explicitly target-gated rather than tested against a fictional device.
- Components is separate from Screens but has a quick insertion entry. The old random-ID, placeholder-data-URL Add Element workflow is removed.

Phase 7 evidence:

- The pinned iPod Video simulator core builds outside the repository after current Rockbox target generation, a generated-Makefile-only Apple Clang feasibility override, `make bin`, and minimum runtime installation.
- The builder launch-smokes the result with dummy SDL video/audio. Codecs and plugins are excluded; the default full build reaches GCC-only codec code and is not represented as supported by Apple Clang.
- The prepared minimum-runtime official harness loads an authored SBS and deterministic settings. Two clean firmware framebuffer dumps have the same normalized SHA-256.
- A fresh stock runtime also launches and captures but uses stock configuration in that harness; the report keeps this limitation visible and does not substitute those pixels for the canonical evidence.
- Source inspection covers SDL display/input, task threads and timing, audio, filesystem root, target generation, dynamic codec/plugin loading, GPL distribution, Emscripten, persistence, asset mounting, build size, performance, and upstream maintenance at the exact registry SHA.
- The report records seven explicit browser-port constraint groups. Prototype stages 4 and 5 remain blocked by the Level C distribution/runtime decision, and target switching remains deferred.
- No browser code changed. No Rockbox source, object, executable, runtime asset, screenshot, or WebAssembly module is committed.

## Known blockers

- No Phase 7 acceptance blocker is open; the execution plan explicitly accepts a documented feasibility report that explains the blockers while the editor remains independent.
- Level C implementation is blocked on the owner's GPL distribution and browser-runtime architecture decision recorded in ADR-0017. This is not permission to start a partial WebAssembly port.
- The current font helper still needs Git, a C compiler, and FreeType; a signed installer is future delivery polish rather than a functional blocker.
- This remains targeted WPS/SBS/FMS dogfood support, not a claim that every real-theme construct or Rockbox bitmap glyph renders exactly.

## Next task

Review and merge the Phase 7 evidence. Before any Level C WebAssembly implementation, obtain the ADR-0017 owner decision covering GPL source delivery, hosted isolation, browser support, target scope, codec/plugin packaging, persistence, audio, performance budgets, and upstream maintenance. Phase 8 has not started.

## Compatibility summary

Phase 7 preserves the Phase 6 dogfood-ready browser editor and adds an honest boundary for the actual Rockbox runtime. Levels A and B remain available without native dependencies; one external native target, authored-theme load, and reproducible screenshot path are evidenced. Level C, full firmware behavior, remote/touch targets, bitmap-glyph parity, and broad tag rendering remain visible limitations rather than hidden compatibility claims.
