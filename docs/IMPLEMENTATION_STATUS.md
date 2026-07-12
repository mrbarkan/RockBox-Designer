# Implementation Status

Last updated: 2026-07-12

## Current phase

- **Phase:** Phase 2 — Accurate WPS visual editor
- **Branch:** `main`
- **Merged milestones:** Phase 0 through Phase 2; Phase 2 merged through [PR #13](https://github.com/mrbarkan/RockBox-Designer/pull/13) at `e4ac184`, with the Adwaitapod dogfood correction in [PR #15](https://github.com/mrbarkan/RockBox-Designer/pull/15).
- **Status:** Phase 2 and its dogfood-discovered Adwaitapod rendering correction are complete, verified, and merged. The supported WPS subset is ready for targeted dogfooding.
- **Scope boundary:** The source-linked semantic editor covers a documented WPS subset. SBS/FMS semantics, Rockbox font metrics, lists/menus, and the broader simulator remain later phases.

## Current architecture

- React 19 and Vite 6 provide the browser application and build pipeline.
- `App.tsx` owns the active `ProjectState` through the `useHistory` hook and coordinates editing, simulation, import, export, and storage.
- The project retains the legacy flat visual-element model for synthetic projects and non-WPS fallback, but imported WPS source now renders directly from the lossless document through Phase 2 semantics.
- ZIP import in `services/rockboxParser.ts` reads a CFG, builds visual elements, and creates early AST documents for WPS and SBS when those paths are present.
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
- `rockbox/semantics/` interprets the supported WPS subset without mutating source and retains a CST source link on every render operation.
- `rockbox/rendering/` owns the browser canvas renderer and a deterministic RGB pixel renderer used for the 320×240 golden screenshot.
- The logic-aware right panel distinguishes global preloads, viewports, elements, conditionals, branches, source-only nodes, and unsupported preserved nodes.

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
- Playback, battery, volume, hold, USB, repeat, shuffle, and metadata simulation controls.
- Theme ZIP import/export, project JSON save/load, font and image upload, and browser storage workflows.
- Preset component generation and optional Gemini-assisted layout generation.

## Known parser and package risks

- WPS viewport, text, image, color, bar, album-art, touch, and conditional controls project from and edit the lossless document. SBS/FMS still use the legacy preview adapter.
- The source editor applies WPS/SBS/FMS text through the lossless parser. Invalid source remains authoritative while the canvas visibly holds the last valid WPS render.
- Official tag names come from generated upstream metadata; interpretation and editing remain intentionally limited to evidenced subsets.
- Legacy pipe-style argument boundaries still use a small transitional arity table outside the evidenced image/viewport subset.
- CFG source and unknown settings are preserved, but ordinary settings-panel edits are not yet merged back into imported CFG text automatically.
- Package path resolution is deliberately case-sensitive; case mismatches are diagnostics rather than silent basename fallback. Conventional ZIPs with one outer wrapper directory resolve their absolute `/.rockbox/...` CFG references inside that wrapper.
- Binary assets are canonical for imported packages, while newly uploaded UI resources still enter through the legacy data-URL control before export conversion.
- FMS is supported by the package model, but the legacy visual importer still does not populate FMS-derived visual elements.
- Syntax assumptions and official comparisons use Rockbox source at `078a506dfd0deb18165a3ed80c7fcbdb3afb0d31`; the latest local corpus report includes AMusicPod and Adwaitapod.
- Browser text resolves `%Fl` size/weight but still approximates Rockbox `.fnt` glyph metrics with browser sans-serif glyphs. The evidenced `%?if`, `%?and`, `%?or`, `%St`, and `%ss` subset is automatic; other operands remain preserved and visibly unsupported.

## Validation

Latest passing validation on 2026-07-12:

```text
npm run typecheck      passed
npm test               passed — 17 files, 119 tests
npm run build          passed — Vite production build
npm run validate       passed — registry/device/report verification, typecheck, test, and build
npm run test:coverage  passed — coverage runner operational
official validation   passed — 6 fixtures executed against `checkwps.ipodvideo`
npm run test:themes    passed — 4 themes, 4 exact round trips, 4 manifest matches
npm run test:visual    passed — deterministic 320×240 golden screenshot
npm run test:phase2-real passed — AMusicPod and Adwaitapod visual edit/export/re-import
Phase 2 official       passed — edited exported Authored Full WPS accepted by CheckWPS
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

## Known blockers

- No Phase 2 acceptance blocker is currently known.
- This is ready for targeted WPS dogfooding, not a claim that every real-theme construct or Rockbox font renders exactly.

## Next task

Dogfood the supported WPS workflow and record any real-theme gaps by preservation, interpretation, rendering, and editing category. Phase 3 is the next planned implementation phase but has not started.

## Compatibility summary

Phase 2 is ready for targeted WPS dogfooding: a user can import wrapped or root-level real-theme ZIPs, inspect source-aware logic layers, preview the evidenced logical-expression and state branches, render only enabled conditional viewports, move supported viewports, edit known properties or source, and export without losing unsupported syntax/assets. Exact `.fnt` metrics, condition operands outside the evidenced subset, and broad tag rendering remain visible limitations.
