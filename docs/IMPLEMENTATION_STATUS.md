# Implementation Status

Last updated: 2026-07-12

## Current phase

- **Phase:** Phase 1E — Device profile foundation
- **Branch:** `codex/phase-1e-device-profiles`
- **Merged milestones:** Phase 0 through Phase 1D; Phase 1D merged through [PR #9](https://github.com/mrbarkan/RockBox-Designer/pull/9) at `8adf130`.
- **Status:** Phase 1E acceptance criteria pass locally; ready to publish and merge.
- **Scope boundary:** Source-referenced iPod Video and Classic profiles, saved-project migration, native dimensions, and minimal capability gates only. Official parser validation remains Phase 1F.

## Current architecture

- React 19 and Vite 6 provide the browser application and build pipeline.
- `App.tsx` owns the active `ProjectState` through the `useHistory` hook and coordinates editing, simulation, import, export, and storage.
- The project currently has two overlapping representations: a flat visual-element model and an early Rockbox AST for WPS, SBS, and FMS source.
- ZIP import in `services/rockboxParser.ts` reads a CFG, builds visual elements, and creates early AST documents for WPS and SBS when those paths are present.
- ZIP export in `services/rockboxCompiler.ts` prefers serialized AST source when available and otherwise compiles the visual-element model.
- Canvas rendering can use either the visual-element evaluator or the AST evaluator. AST viewports, text, and images have narrow editor helpers.
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

- Viewport, text, and image interactions now edit the lossless document and synchronize a derived legacy AST for preview.
- The renderer still interprets the derived legacy AST; broader semantic migration is deferred.
- The raw source editor displays authoritative source but its Apply action is not a two-way parser/editor workflow yet.
- Official tag names come from generated upstream metadata; interpretation and editing remain intentionally limited to evidenced subsets.
- Legacy pipe-style argument boundaries use a small transitional arity table and need registry-backed expansion.
- CFG source and unknown settings are preserved, but ordinary settings-panel edits are not yet merged back into imported CFG text automatically.
- Package path resolution is deliberately case-sensitive; case mismatches are diagnostics rather than silent basename fallback.
- Binary assets are canonical for imported packages, while newly uploaded UI resources still enter through the legacy data-URL control before export conversion.
- FMS is supported by the package model, but the legacy visual importer still does not populate FMS-derived visual elements.
- Syntax assumptions were inspected against Rockbox source at `078a506dfd0deb18165a3ed80c7fcbdb3afb0d31`, but no official parser comparison harness or real-theme compatibility report exists yet.

## Validation

Latest passing validation on 2026-07-12:

```text
npm run typecheck      passed
npm test               passed — 11 files, 96 tests
npm run build          passed — Vite production build
npm run validate       passed — registry/device verification, typecheck, test, and build
npm run test:coverage  passed — coverage runner operational
device verification   passed — 2 profiles; local Rockbox source match
browser smoke         passed — Video shows FMS; Classic hides it; both render 320×240 without page errors
```

Phase 1E evidence:

- iPod Video (`ipodvideo`) and iPod Classic (`ipod6g`) profiles cite the pinned Rockbox SHA and exact target/config paths.
- The optional source verifier confirms target entries, 320×240×16 LCDs at 160 DPI, tuner, recording, touch, remote LCD, USB HID, RTC, and album-art definitions.
- Equal LCD dimensions do not collapse capabilities: Video exposes its configured tuner and FMS; Classic does not.
- Saved direct and nested mock-cloud projects migrate `ipod_video`, `ipodvideo`, `ipod_6g`, and `ipod6g` aliases to profile IDs.
- Canvas and evaluator geometry comes from the selected profile; unsupported screen tabs and FM/touch presets are gated without deleting preserved data.
- Unit tests cover profile evidence, fallback migration, FM, touch, remote LCD, and screen-file gates.

## Known blockers

- No Phase 1E blocker is currently known.
- Parser compatibility remains intentionally unverified until the later official-validation and real-theme phases.

## Next task

Finish and merge Phase 1E. Phase 1F must begin from updated `main` and build an optional official-parser comparison bridge without bundling GPL implementation code.

## Compatibility summary

The product uses lossless screen and CFG source, binary package assets, generated official tag identity, and verified device profiles for tested paths. Rendering remains a legacy adapter, and official-parser or real-theme compatibility has not yet been demonstrated.
