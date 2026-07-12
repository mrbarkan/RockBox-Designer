# Parser Limitations

These are baseline limitations of the pre-Phase-1 parser. Phase 0 documents them but does not change parser behavior.

## Argument formatting is reconstructed

- **Example:** `%V( 0, 0, 320, 240, - )` or pipe-delimited image tags.
- **Current behavior:** Arguments are split, trimmed, and later joined. The serializer chooses delimiter style from a hard-coded tag set.
- **Preservation status:** Not exact.
- **Diagnostic:** None.
- **Planned phase:** Phase 1A lossless syntax engine.

## Conditional tests are too simple

- **Example:** `%?if(%pv, =, -90)<muted|audible>` and `%?mh<hold|%?mp<playing|paused>>`.
- **Current behavior:** Everything before `<` is stored as a string-like tag field. Branch scanning uses approximate depth rules and does not structurally represent a parameterized test.
- **Preservation status:** Unverified and unsafe for complex nesting.
- **Diagnostic:** None.
- **Planned phase:** Phase 1A tokenizer, conditional model, and recovery tests.

## Unknown tags can be normalized

- **Example:** A future tag with an unfamiliar invocation style.
- **Current behavior:** The parser creates a generic tag node, but the serializer may rebuild its arguments using the wrong delimiter style.
- **Preservation status:** Name may survive; exact bytes are not guaranteed.
- **Diagnostic:** None.
- **Planned phase:** Phase 1A unknown-node preservation and Phase 1D generated registry.

## Malformed input has no recovery contract

- **Example:** Missing `>`, missing `)`, an incomplete `%`, or an empty branch.
- **Current behavior:** Parsing attempts to continue, but there are no structured diagnostics, source spans, or guaranteed raw slices for recovery.
- **Preservation status:** Unverified.
- **Diagnostic:** None.
- **Planned phase:** Phase 1A diagnostics and malformed-source fixtures.

## Untouched source is not the serializer contract

- **Example:** Comments, spacing, escapes, CRLF line endings, and several tags mixed on one line.
- **Current behavior:** Text chunks can retain some raw characters, but tags and conditionals are regenerated from simplified fields. Stored `raw` values are not used by the serializer.
- **Preservation status:** Partial only.
- **Diagnostic:** None.
- **Planned phase:** Phase 1A exact round-trip tests.

## CFG import is destructive

- **Example:** Comments, blank lines, duplicate keys, unknown settings, or values with significant surrounding whitespace.
- **Current behavior:** CFG lines are split into selected settings; the original source document is discarded.
- **Preservation status:** No.
- **Diagnostic:** Only general import warnings infrastructure exists; these losses are not reported.
- **Planned phase:** Phase 1C source-preserving CFG parser.

## FMS package import is incomplete

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

## Official behavior has not been checked

- **Example:** Tag parameter rules, target-dependent syntax, and parser error cases.
- **Current behavior:** The browser implementation is based on local approximations and hard-coded tag handling.
- **Preservation status:** Not applicable.
- **Diagnostic:** No official comparison report.
- **Planned phase:** Phase 1D registry, Phase 1F official parser bridge, and Phase 1G real-theme corpus.
