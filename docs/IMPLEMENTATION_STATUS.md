# Implementation Status

Last updated: 2026-07-12

## Current phase

- **Phase:** Phase 1F — Official parser validation bridge
- **Branch:** `codex/phase-1f-official-parser-bridge`
- **Merged milestones:** Phase 0 through Phase 1E; Phase 1E merged through [PR #10](https://github.com/mrbarkan/RockBox-Designer/pull/10) at `c861677`.
- **Status:** Phase 1F acceptance criteria pass locally; ready to publish and merge.
- **Scope boundary:** Optional external CheckWPS build/invocation, structured fixture comparison, and checked-in report verification only. Real-theme corpus work remains Phase 1G.

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
- `scripts/official/` builds target-specific upstream `checkwps` outside the repository and writes structured comparisons without bundling GPL source or binaries.
- `rockbox/validation/` models all required official-comparison categories; ordinary validation checks the report without requiring a Rockbox checkout.

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
npm test               passed — 12 files, 102 tests
npm run build          passed — Vite production build
npm run validate       passed — registry/device/report verification, typecheck, test, and build
npm run test:coverage  passed — coverage runner operational
official validation   passed — 6 fixtures executed against `checkwps.ipodvideo`
```

Phase 1F evidence:

- The bridge builds Rockbox `tools/checkwps` from `ROCKBOX_SOURCE_DIR` in a temporary SHA/target cache and requires the checkout to match `078a506dfd0deb18165a3ed80c7fcbdb3afb0d31`.
- No Rockbox source, object, or executable is written into or bundled from this repository.
- Six fixtures ran against `checkwps.ipodvideo`: three accepted by both, one future tag preserved only by the browser, one diagnostic difference, and one target-dependent result.
- All six browser sources round-trip exactly; no official execution failed.
- The report records source hashes, browser diagnostics, official output/exit codes, target, tool, repository, and exact SHA.
- Missing setup fails clearly; `ROCKBOX_OFFICIAL_SKIP=1` is the only explicit skip path. Ordinary tests remain self-contained.

## Known blockers

- No Phase 1F blocker is currently known.
- The representative official fixture report is not a substitute for the Phase 1G real-theme corpus.

## Next task

Finish and merge Phase 1F. Phase 1G must begin from updated `main` and add a provenance-tracked real-theme corpus plus package/parser/report automation.

## Compatibility summary

The product uses lossless screen and CFG source, binary package assets, generated official tag identity, verified device profiles, and a demonstrated official parser bridge for representative fixtures. Rendering remains a legacy adapter, and real-theme compatibility has not yet been demonstrated.
