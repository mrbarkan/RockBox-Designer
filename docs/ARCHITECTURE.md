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

## Current data flow

```text
Theme ZIP
  -> global JSZip loader
  -> CFG and screen parser
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

## Rendering flow target

Rendering should operate at the selected device's native pixel dimensions, with integer coordinates and explicit clipping. DOM overlays may provide editing handles but must not define the rendered pixel positions.

## Phase 1B boundary

Phase 1B migrates existing viewport, text, and image interactions and export authority. It retains the legacy parser/serializer only as a clearly deprecated saved-project and preview adapter. It does not replace JSZip, make CFG source-preserving, migrate binary assets, expand rendering, or redesign the interface.
