# Parser Limitations

Phase 1B makes the lossless syntax API authoritative for imported WPS/SBS editing and export. The distinction still matters:

- **New syntax API:** `rockbox/syntax/` preserves tested source exactly and provides structural diagnostics.
- **Current preview path:** Canvas rendering still consumes a derived legacy AST while semantic migration remains incomplete.

Passing synthetic fixtures are evidence for those inputs, not a claim of complete Rockbox compatibility.

## Application migration is intentionally partial

- **Example:** Importing a WPS through the current ZIP workflow and editing it on the canvas.
- **Current behavior:** Import, viewport/text/image editing, compilation, ZIP screen export, and source previews use the lossless document. The renderer receives a derived legacy AST.
- **Preservation status:** Exact for untouched source and the tested edit subset; visual interpretation remains approximate.
- **Diagnostic:** Unsafe commands return an edit diagnostic and leave source unchanged.
- **Planned phase:** Phase 2 semantic interpreter and two-way source synchronization.

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

## Conditional editing is structural but intentionally narrow

- **Example:** Replacing or inserting a branch in a malformed conditional.
- **Current behavior:** Branch replacement and nested text/image edits are immutable and preserve sibling branches. The current UI does not yet expose a general conditional editor.
- **Preservation status:** Exact for tested nested edits and branch replacement.
- **Diagnostic:** Missing conditionals or branch indexes fail without changing source.
- **Planned phase:** Phase 2 logic-aware layers and conditional inspector controls.

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
