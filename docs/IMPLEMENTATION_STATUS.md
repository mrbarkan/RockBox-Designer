# Implementation Status

Last updated: 2026-07-12

## Current phase

- **Phase:** Phase 1B — Source-aware editing and legacy migration
- **Branch:** `codex/phase-1b-source-aware-editing`
- **Merged milestones:** Phase 0 through [PR #5](https://github.com/mrbarkan/RockBox-Designer/pull/5); Phase 1A through [PR #6](https://github.com/mrbarkan/RockBox-Designer/pull/6) at `40317a6`.
- **Status:** Phase 1B acceptance criteria pass locally; awaiting draft pull request review and merge.
- **Scope boundary:** Immutable source commands, known-tag argument helpers, viewport/text/image UI migration, and lossless export authority only. Package modernization remains Phase 1C.

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
- The CFG import is not source-preserving and does not currently load the FMS path.
- Asset lookup can silently collide when separate folders contain the same basename.
- Assets are stored canonically as data URLs rather than binary bytes.
- Import/export relies on a global JSZip script and export always creates WPS, SBS, and FMS files.
- ZIP metadata and file manifests are not normalized or tested for deterministic output.
- Syntax assumptions were inspected against Rockbox source at `078a506dfd0deb18165a3ed80c7fcbdb3afb0d31`, but no official parser comparison harness or real-theme compatibility report exists yet.

## Validation

Latest passing validation on 2026-07-12:

```text
npm run typecheck      passed
npm test               passed — 6 files, 71 tests
npm run build          passed — Vite production build
npm run validate       passed — typecheck, test, and build
npm run test:coverage  passed — coverage runner operational
browser smoke          passed — canvas and source/AST controls rendered; no console errors
```

Phase 1B evidence:

- Viewport geometry edits change only the intended arguments and preserve formatting.
- Text and image edits preserve surrounding tags, comments, unknown source, invocation style, and sibling conditional branches.
- Stable node IDs survive narrow updates and moves.
- Insert, delete, move, and conditional-branch replacement commands are immutable and fail safely with diagnostics.
- Semantic schemas cover `%V`, `%Vl`, `%Vi`, `%Vf`, `%Vb`, `%Fl`, `%x`, `%xl`, `%xd`, `%X`, `%pb`, `%pv`, `%Cl`, `%Cd`, and `%T`.
- Lossless source wins over conflicting legacy AST source during compilation and export.
- Saved legacy projects migrate lazily without changing their source before an edit.

## Known blockers

- No Phase 1B blocker is currently known.
- Parser compatibility remains intentionally unverified until the later official-validation and real-theme phases.

## Next task

Finish and merge Phase 1B. Phase 1C must begin from updated `main` on a separate branch and address CFG, ZIP paths, deterministic export, and binary assets without expanding rendering scope.

## Compatibility summary

The product now uses lossless source as the authority for imported WPS/SBS editing and export, with tested viewport, text, and image changes. The renderer remains an adapter over the legacy AST, package fidelity is still incomplete, and official or real-theme compatibility has not been demonstrated.
