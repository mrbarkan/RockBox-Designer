# Implementation Status

Last updated: 2026-07-12

## Current phase

- **Phase:** Phase 1C — Theme packages, CFG, and binary assets
- **Branch:** `codex/phase-1c-theme-packages`
- **Merged milestones:** Phase 0 through Phase 1B; Phase 1B merged through [PR #7](https://github.com/mrbarkan/RockBox-Designer/pull/7) at `51c6697`.
- **Status:** Phase 1C acceptance criteria pass locally; ready to publish and merge.
- **Scope boundary:** Source-preserving CFG, explicit JSZip, binary assets, safe paths, deterministic logical export, and package fixtures only. Tag registry remains Phase 1D.

## Current architecture

- React 19 and Vite 6 provide the browser application and build pipeline.
- `App.tsx` owns the active `ProjectState` through the `useHistory` hook and coordinates editing, simulation, import, export, and storage.
- The project currently has two overlapping representations: a flat visual-element model and an early Rockbox AST for WPS, SBS, and FMS source.
- ZIP import in `services/rockboxParser.ts` reads a CFG, builds visual elements, and creates early AST documents for WPS and SBS when those paths are present.
- ZIP export in `services/rockboxCompiler.ts` prefers serialized AST source when available and otherwise compiles the visual-element model.
- Canvas rendering can use either the visual-element evaluator or the AST evaluator. AST viewports, text, and images have narrow editor helpers.
- Package assets are currently stored as data URLs keyed primarily by basename. JSZip is provided by a global browser script.
- `rockbox/syntax/` now provides a separate lossless document model with absolute source spans, exact raw slices, diagnostics, a structural conditional model, a tokenizer, and a minimum-change serializer.
- `rockbox/editing/` provides immutable commands, semantic argument helpers for the Phase 1B tag subset, stable node-ID queries, and explicit failure diagnostics.
- New theme imports retain lossless WPS/SBS documents. Existing saved projects migrate lazily from their stored legacy raw source on first edit.
- The compiler, ZIP exporter, source editor, and code preview prefer the lossless document. A newly derived legacy AST remains only as the current renderer adapter.
- `rockbox/packages/` now owns lossless CFG parsing, strict archive paths, binary assets and hashes, package diagnostics, manifests, import, and deterministic export.
- Imported packages are canonical binary runtime state in `ProjectState.themePackage`; browser data URLs remain derived preview state.
- Project JSON and mock-cloud persistence encode `Uint8Array` values explicitly and restore them on load.

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
- Known-tag matching uses a transitional local list until Phase 1D generates the registry from Rockbox source.
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
npm test               passed — 9 files, 85 tests
npm run build          passed — Vite production build
npm run validate       passed — typecheck, test, and build
npm run test:coverage  passed — coverage runner operational
```

Phase 1C evidence:

- CFG comments, blank lines, duplicates, unknown keys, colons, whitespace, and CRLF round-trip exactly.
- WPS-only, WPS+SBS, and WPS+SBS+FMS package fixtures import correctly.
- Missing CFG, screens, and referenced assets produce explicit diagnostics.
- Duplicate basenames in separate directories remain distinct; fonts and unknown binary files retain bytes and hashes.
- Import/export logical manifests and source bytes round-trip, and repeated ZIP exports are deterministic.
- Product export preserves imported CFG text and does not create absent SBS/FMS files.
- Runtime and persisted project state round-trip binary `Uint8Array` assets without making data URLs canonical.

## Known blockers

- No Phase 1C blocker is currently known.
- Parser compatibility remains intentionally unverified until the later official-validation and real-theme phases.

## Next task

Finish and merge Phase 1C. Phase 1D must begin from updated `main` and generate the known-tag registry from the pinned Rockbox source without bundling GPL implementation code.

## Compatibility summary

The product uses lossless screen and CFG source plus binary package assets for tested import/export paths. Rendering remains a legacy adapter, tag recognition is still transitional, and official or real-theme compatibility has not been demonstrated.
