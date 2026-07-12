# Parser Limitations

Phase 1A adds a lossless syntax API beside the existing application parser. The distinction matters:

- **New syntax API:** `rockbox/syntax/` preserves tested source exactly and provides structural diagnostics.
- **Current product path:** ZIP import, canvas editing, and export still use the legacy AST until Phase 1B.

Passing synthetic fixtures are evidence for those inputs, not a claim of complete Rockbox compatibility.

## Application callers have not migrated

- **Example:** Importing a WPS through the current ZIP workflow and editing it on the canvas.
- **Current behavior:** `services/rockboxParser.ts`, the AST evaluator, and compiler still use the early `RockboxAstDocument`.
- **Preservation status:** Product-level exact preservation is not yet guaranteed.
- **Diagnostic:** The lossless document is available through `services/rockboxSyntaxAdapter.ts`, but legacy UI diagnostics are unchanged.
- **Planned phase:** Phase 1B source-aware editing and caller migration.

## Known-tag boundaries are transitional

- **Example:** A no-argument tag immediately followed by alphabetic text, or a future tag whose prefix matches a current tag.
- **Current behavior:** Phase 1A uses a small local longest-match list for currently exercised tags and otherwise preserves an alphanumeric unknown name.
- **Preservation status:** Exact bytes survive; the structural name boundary can be ambiguous.
- **Diagnostic:** No unknown-tag error is emitted because unknown syntax must remain openable.
- **Planned phase:** Phase 1D generated registry from the recorded Rockbox source SHA.

## Pipe-style argument arity is transitional

- **Example:** Legacy image syntax such as `%xl|A|strip.bmp|0|0|10|` or an unknown future pipe-style tag.
- **Current behavior:** Raw argument text is preserved. A small arity table prevents known image and viewport pipes from being mistaken for conditional separators.
- **Preservation status:** Exact bytes survive; unlisted multi-argument pipe syntax may have an approximate node boundary.
- **Diagnostic:** Unterminated known pipe regions report `unterminated-pipe-arguments`.
- **Planned phase:** Phase 1D registry metadata and later tag-specific semantic decoders.

## Arguments are intentionally not semantically decoded

- **Example:** `%V( 0, 0, 320, 240, - )` or `%?if(%pv, =, -90)<...>`.
- **Current behavior:** Invocation style and the exact raw argument region are structural, but parameter values are not split into normalized semantic fields.
- **Preservation status:** Exact for tested source.
- **Diagnostic:** Delimiter errors are reported; type/arity validation is deferred.
- **Planned phase:** Phase 1B known-tag argument helpers and Phase 1D registry metadata.

## Dirty conditional editing is only a serializer primitive

- **Example:** Replacing or inserting a branch in a malformed conditional.
- **Current behavior:** The serializer can combine dirty nodes and branch documents while retaining existing separators and missing delimiters, but Phase 1A exposes no public editing commands.
- **Preservation status:** Clean conditionals round-trip exactly; no user-facing edit claim is made.
- **Diagnostic:** Structural parse diagnostics remain attached to source spans.
- **Planned phase:** Phase 1B immutable commands and minimal-diff tests.

## Recovery coverage is representative, not exhaustive

- **Example:** Incomplete `%`, missing `)`, missing pipe, missing `<`, missing `>`, and unexpected `|` or `>`.
- **Current behavior:** These cases produce invalid or recoverable nodes with severity, code, message, absolute span, and recovery text.
- **Preservation status:** Exact for tested cases.
- **Diagnostic:** Available through `RockboxDocument.diagnostics`.
- **Planned phase:** Expand fixtures as real themes and official parser differences reveal additional recovery cases.

## CFG import remains destructive

- **Example:** Comments, blank lines, duplicate keys, unknown settings, or values with significant surrounding whitespace.
- **Current behavior:** CFG lines are split into selected settings; the original CFG source document is discarded.
- **Preservation status:** No.
- **Diagnostic:** These losses are not currently reported.
- **Planned phase:** Phase 1C source-preserving CFG parser.

## FMS package import remains incomplete

- **Example:** `fms: /.rockbox/wps/theme.fms` in a CFG.
- **Current behavior:** The import path reads `wps` and `sbs` settings but does not capture or load `fms`, so `fmsAst` remains undefined.
- **Preservation status:** No package-level preservation.
- **Diagnostic:** None.
- **Planned phase:** Phase 1C package pipeline.

## Asset resolution can collide

- **Example:** `dark/icons/play.bmp` and `light/icons/play.bmp` in the same ZIP.
- **Current behavior:** Assets are keyed and resolved primarily by basename, so one file can overwrite or resolve as the other.
- **Preservation status:** Unsafe for duplicate basenames.
- **Diagnostic:** None.
- **Planned phase:** Phase 1C binary asset store and path-safe resolver.

## Official parser and real themes are not yet test inputs

- **Example:** Target-dependent tags, complex legacy themes, and constructs outside the authored fixture corpus.
- **Current behavior:** Phase 1A inspected the pinned upstream source for delimiter, escape, comment, and conditional rules, but does not execute the official parser.
- **Preservation status:** Not established beyond the current synthetic and randomized safe-fragment corpus.
- **Diagnostic:** No official comparison report.
- **Planned phase:** Phase 1F official parser bridge and Phase 1G real-theme corpus.
