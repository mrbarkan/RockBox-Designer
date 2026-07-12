# Architecture

## Current baseline

Rockbox Designer is a browser-only React application. `App.tsx` coordinates a central `ProjectState`, visual editing, simulation, persistence, theme package import, and export.

The prototype currently has two overlapping theme representations:

1. A flat list of visual `WpsElement` values used by the original canvas and compiler.
2. An early Rockbox AST used by the newer preview, editing helpers, and serializer.

The AST becomes the export source when a screen has one, but it is not lossless. Its parser splits arguments and its serializer reconstructs syntax. Phase 0 intentionally leaves that behavior unchanged.

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

## Required source-of-truth rule

The original Rockbox source must become the authoritative document. Visual state will be a projection over a lossless concrete syntax tree (CST), not a replacement for it. Untouched source must eventually serialize exactly.

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

## Phase 0 boundary

Phase 0 establishes scripts, tests, documentation, and a compiling baseline. It does not introduce the CST, change parser behavior, replace JSZip, restructure project state, or redesign the interface.
