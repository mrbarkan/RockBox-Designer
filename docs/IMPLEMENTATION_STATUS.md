# Implementation Status

Last updated: 2026-07-12

## Current phase

- **Phase:** Phase 0 — Repository stabilization and execution scaffolding
- **Branch:** `codex/phase-0-foundation`
- **Plan milestones merged:** None. The repository contains a functional prototype and earlier AST-preview work, but no milestone in `ROCKBOX_DESIGNER_CODEX_EXECUTION_PLAN.md` has been completed on `main` yet.
- **Status:** Acceptance criteria pass locally; awaiting draft pull request review and merge.
- **Scope boundary:** Infrastructure and baseline repairs only. Parser replacement and Phase 1A work have not started.

## Current architecture

- React 19 and Vite 6 provide the browser application and build pipeline.
- `App.tsx` owns the active `ProjectState` through the `useHistory` hook and coordinates editing, simulation, import, export, and storage.
- The project currently has two overlapping representations: a flat visual-element model and an early Rockbox AST for WPS, SBS, and FMS source.
- ZIP import in `services/rockboxParser.ts` reads a CFG, builds visual elements, and creates early AST documents for WPS and SBS when those paths are present.
- ZIP export in `services/rockboxCompiler.ts` prefers serialized AST source when available and otherwise compiles the visual-element model.
- Canvas rendering can use either the visual-element evaluator or the AST evaluator. AST viewports, text, and images have narrow editor helpers.
- Package assets are currently stored as data URLs keyed primarily by basename. JSZip is provided by a global browser script.

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

- The early AST parser and serializer are not lossless; argument formatting and delimiter style can change.
- Conditional tests are stored too simply, and nested or parameterized conditions are not modeled safely.
- Unknown and malformed syntax has no diagnostic/recovery contract.
- The CFG import is not source-preserving and does not currently load the FMS path.
- Asset lookup can silently collide when separate folders contain the same basename.
- Assets are stored canonically as data URLs rather than binary bytes.
- Import/export relies on a global JSZip script and export always creates WPS, SBS, and FMS files.
- ZIP metadata and file manifests are not normalized or tested for deterministic output.
- No behavior has been checked against the official Rockbox parser yet.

## Validation

Latest passing validation on 2026-07-12:

```text
npm run typecheck      passed
npm test               passed — 1 file, 1 test
npm run build          passed — Vite production build
npm run validate       passed — typecheck, test, and build
npm run test:coverage  passed — coverage runner operational; the smoke test imports no production module
```

Acceptance notes:

- `AGENTS.md` and all Phase 0 documentation files exist.
- No parser or serializer behavior was intentionally changed.
- No UI redesign is included.
- The only application repair removes duplicated AST type declarations and restores the existing AST editor imports/callback wiring required for TypeScript and runtime correctness.

## Known blockers

- No Phase 0 blocker is currently known.
- Parser compatibility remains intentionally unverified until the later official-validation and real-theme phases.

## Next task

Finish and merge Phase 0. Afterward, Phase 1A must begin from updated `main` on a separate branch; it must not be included in this pull request.

## Compatibility summary

The current prototype can import, interpret, render, and edit a limited subset of Rockbox theme syntax. Exact preservation and official compatibility have not been demonstrated. See `COMPATIBILITY_MATRIX.md` and `PARSER_LIMITATIONS.md` for the evidence level of each subsystem.
