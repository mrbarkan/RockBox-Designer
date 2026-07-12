# Implementation Status

Last updated: 2026-07-12

## Current phase

- **Phase:** Phase 1A — Lossless Rockbox syntax engine
- **Branch:** `codex/phase-1a-lossless-syntax`
- **Merged milestones:** Phase 0 merged through [PR #5](https://github.com/mrbarkan/RockBox-Designer/pull/5) at `c39026b`.
- **Status:** Phase 1A acceptance criteria pass locally; awaiting draft pull request review and merge.
- **Scope boundary:** Lossless syntax, diagnostics, serialization, fixtures, and a migration adapter only. Existing visual editing remains on the legacy AST until Phase 1B.

## Current architecture

- React 19 and Vite 6 provide the browser application and build pipeline.
- `App.tsx` owns the active `ProjectState` through the `useHistory` hook and coordinates editing, simulation, import, export, and storage.
- The project currently has two overlapping representations: a flat visual-element model and an early Rockbox AST for WPS, SBS, and FMS source.
- ZIP import in `services/rockboxParser.ts` reads a CFG, builds visual elements, and creates early AST documents for WPS and SBS when those paths are present.
- ZIP export in `services/rockboxCompiler.ts` prefers serialized AST source when available and otherwise compiles the visual-element model.
- Canvas rendering can use either the visual-element evaluator or the AST evaluator. AST viewports, text, and images have narrow editor helpers.
- Package assets are currently stored as data URLs keyed primarily by basename. JSZip is provided by a global browser script.
- `rockbox/syntax/` now provides a separate lossless document model with absolute source spans, exact raw slices, diagnostics, a structural conditional model, a tokenizer, and a minimum-change serializer.
- `services/rockboxSyntaxAdapter.ts` exposes the lossless document beside the legacy AST without changing current application behavior.

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

- The application still uses the early AST parser and serializer; product import/edit/export is not lossless until Phase 1B migrates callers.
- The new syntax engine preserves tested source exactly and structures nested and parameterized conditionals, but it is not yet semantically interpreted by the UI.
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
npm test               passed — 4 files, 43 tests
npm run build          passed — Vite production build
npm run validate       passed — typecheck, test, and build
npm run test:coverage  passed — coverage runner operational
```

Phase 1A evidence:

- Twenty named exact round-trip fixtures cover required syntax categories.
- Three hundred randomized combinations of known-safe fragments and two hundred randomized safe-Unicode samples round-trip exactly per test run.
- Unknown and malformed source remains serializable, with diagnostics for incomplete tags, unterminated argument regions, missing conditional delimiters, and unexpected separators.
- Parameterized tests and nested conditional branches are represented structurally.
- Dirty known tags preserve parenthesis or pipe invocation style and do not invent missing delimiters.
- The existing UI and legacy parser remain buildable and unchanged.

## Known blockers

- No Phase 1A blocker is currently known.
- Parser compatibility remains intentionally unverified until the later official-validation and real-theme phases.

## Next task

Finish and merge Phase 1A. Phase 1B must begin from updated `main` on a separate branch and migrate editing callers through the lossless document without broadening rendering or UI scope.

## Compatibility summary

The new syntax API demonstrates exact preservation for its synthetic fixture corpus, including unknown and malformed input. The current product workflow has not migrated to that API, and official or real-theme compatibility has not been demonstrated. See `COMPATIBILITY_MATRIX.md` and `PARSER_LIMITATIONS.md` for the evidence level of each subsystem.
