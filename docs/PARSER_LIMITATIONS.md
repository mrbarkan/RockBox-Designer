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

## Known-tag names are generated; meaning is still incremental

- **Example:** A no-argument tag immediately followed by alphabetic text, or a future tag whose prefix matches a current tag.
- **Current behavior:** The parser uses the Phase 1D registry generated from the pinned Rockbox tag table for longest official name matching. When no definition matches, it preserves the full alphanumeric unknown name.
- **Preservation status:** Exact bytes survive; known names use upstream-derived boundaries and future unknown names remain openable.
- **Diagnostic:** No unknown-tag error is emitted because unknown syntax must remain openable.
- **Planned phase:** Higher support states require Phase 2 interpretation and Phase 1F official validation evidence.

## Pipe-style argument arity is transitional

- **Example:** Legacy image syntax such as `%xl|A|strip.bmp|0|0|10|` or an unknown future pipe-style tag.
- **Current behavior:** Raw argument text is preserved. A small arity table prevents known image and viewport pipes from being mistaken for conditional separators.
- **Preservation status:** Exact bytes survive; unlisted multi-argument pipe syntax may have an approximate node boundary.
- **Diagnostic:** Unterminated known pipe regions report `unterminated-pipe-arguments`.
- **Planned phase:** Later tag-specific semantic decoders may use the registry's raw parameter specifications, but must not normalize untouched source.

## Arguments are intentionally not semantically decoded

- **Example:** `%V( 0, 0, 320, 240, - )` or `%?if(%pv, =, -90)<...>`.
- **Current behavior:** Invocation style and the exact raw argument region are structural, but parameter values are not split into normalized semantic fields.
- **Preservation status:** Exact for tested source.
- **Diagnostic:** Delimiter errors are reported; type/arity validation is deferred.
- **Planned phase:** Phase 2 semantic interpretation expands beyond the current Phase 1B editable subset.

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

## CFG settings-panel synchronization is incomplete

- **Example:** Comments, blank lines, duplicate keys, unknown settings, or values with significant surrounding whitespace.
- **Current behavior:** Imported CFG source is preserved exactly and exported unchanged. The low-level update helper preserves formatting, but every settings-panel control is not yet wired to it.
- **Preservation status:** Exact when untouched and for tested helper updates.
- **Diagnostic:** Missing package references are reported during import.
- **Planned phase:** Wire broader CFG editing as the settings and source-editor workflows mature.

## FMS visual derivation remains incomplete

- **Example:** `fms: /.rockbox/wps/theme.fms` in a CFG.
- **Current behavior:** The Phase 1C package model resolves and preserves FMS. The legacy visual-element derivation path still covers WPS and SBS only.
- **Preservation status:** Package source is preserved; visual support is partial.
- **Diagnostic:** Missing FMS files are reported.
- **Planned phase:** Phase 3 FMS editor.

## Newly uploaded assets still enter through a compatibility bridge

- **Example:** `dark/icons/play.bmp` and `light/icons/play.bmp` in the same ZIP.
- **Current behavior:** Imported assets use binary archive-path identity. Existing upload controls still create data URLs, which are converted into new binary package entries at export.
- **Preservation status:** Imported duplicate basenames are safe; replacing one duplicate through the old upload UI is not yet path-aware.
- **Diagnostic:** Missing and case-mismatched references are reported rather than resolved by basename.
- **Planned phase:** Later asset-library UI migration.

## Real-theme preservation is measured; semantic and visual support remain partial

- **Example:** AMusicPod, Adwaitapod, target-dependent tags, and constructs outside the authored fixture corpus.
- **Current behavior:** The Phase 1G runner measures exact source serialization, package manifests, asset hashes, browser diagnostics, support inventories, and optional CheckWPS results. Local third-party ZIPs stay ignored.
- **Preservation status:** Both named real themes round-trip exactly with complete manifests. Adwaitapod passes CheckWPS; AMusicPod's original WPS has a documented official rejection while remaining byte-exact.
- **Diagnostic:** `reports/themes/latest.json` records complete evidence and `reports/themes/latest.md` provides a readable summary.
- **Planned phase:** Phase 2 expands the interpreted, rendered, and editable WPS subset without weakening preservation.
