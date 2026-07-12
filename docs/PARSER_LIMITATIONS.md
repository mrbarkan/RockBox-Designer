# Parser Limitations

The lossless syntax API is authoritative for imported WPS/SBS/FMS editing and export. The distinction still matters:

- **New syntax API:** `rockbox/syntax/` preserves tested source exactly and provides structural diagnostics.
- **WPS preview path:** Phase 2 interprets a documented subset directly from the lossless document. SBS and FMS still use the derived legacy adapter.

Passing synthetic fixtures are evidence for those inputs, not a claim of complete Rockbox compatibility.

## Application migration remains screen-specific

- **Example:** Importing a WPS through the current ZIP workflow and editing it on the canvas.
- **Current behavior:** Import, viewport/text/image editing, compilation, ZIP screen export, and source previews use the lossless document. WPS renders from source-linked semantics; SBS/FMS still receive a derived legacy AST.
- **Preservation status:** Exact for untouched source and the tested edit subset; visual interpretation remains approximate.
- **Diagnostic:** Unsafe commands return an edit diagnostic and leave source unchanged.
- **Planned phase:** Phase 3 migrates SBS/FMS semantics.

## Known-tag names are generated; meaning is still incremental

- **Example:** A no-argument tag immediately followed by alphabetic text, or a future tag whose prefix matches a current tag.
- **Current behavior:** The parser uses the Phase 1D registry generated from the pinned Rockbox tag table for longest official name matching. When no definition matches, it preserves the full alphanumeric unknown name.
- **Preservation status:** Exact bytes survive; known names use upstream-derived boundaries and future unknown names remain openable.
- **Diagnostic:** No unknown-tag error is emitted because unknown syntax must remain openable.
- **Planned phase:** Higher support states require per-tag semantic/render/edit evidence and later official render comparison.

## Pipe-style argument arity is transitional

- **Example:** Legacy image syntax such as `%xl|A|strip.bmp|0|0|10|` or an unknown future pipe-style tag.
- **Current behavior:** Raw argument text is preserved. A small arity table prevents known image and viewport pipes from being mistaken for conditional separators.
- **Preservation status:** Exact bytes survive; unlisted multi-argument pipe syntax may have an approximate node boundary.
- **Diagnostic:** Unterminated known pipe regions report `unterminated-pipe-arguments`.
- **Planned phase:** Later tag-specific semantic decoders may use the registry's raw parameter specifications, but must not normalize untouched source.

## Argument semantics are decoded only for the supported WPS subset

- **Example:** `%V( 0, 0, 320, 240, - )` or `%?if(%pv, =, -90)<...>`.
- **Current behavior:** Invocation style and exact raw arguments remain structural. Phase 2 decodes viewports, colors, images, bars, album art, rectangles, touch regions, and selected state tags into projections without changing the raw source.
- **Preservation status:** Exact for tested source.
- **Diagnostic:** Delimiter errors are reported; type/arity validation is deferred.
- **Planned phase:** Expand only with source and official evidence; never infer blanket semantics from the registry parameter string alone.

## Conditional expression evaluation is intentionally bounded

- **Example:** `%?if(%pv, =, -90)<Muted|Audible>` or nested `%?and`/`%?or` expressions.
- **Current behavior:** Common direct state tests plus nested `%if`, `%and`, `%or`, `%St`, and `%ss` operands used by the Adwaitapod WPS select branches automatically. False one-branch conditionals select no branch, and `%Vl` definitions remain hidden until an active `%Vd` enables their label. Every conditional and branch still appears in the logic panel and can be previewed manually.
- **Preservation status:** Exact; inactive and unsupported branch source remains present.
- **Diagnostic:** Expression tags outside the supported evaluator remain preserved and are marked unsupported rather than being silently treated as true.
- **Planned phase:** Expand operands only alongside simulator state and official behavior evidence.

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

## Browser font metrics are not Rockbox font metrics

- **Example:** A custom `.fnt` file with glyph widths that differ from the browser's monospace font.
- **Current behavior:** Phase 2 resolves `%Fl` font slots and uses the declared pixel size and bold weight with a browser sans-serif approximation. The canvas position and clipping are native-pixel, but text width and glyph shape can differ from the packaged Rockbox `.fnt` file.
- **Preservation status:** Font references and binaries remain exact.
- **Diagnostic:** The Phase 2 guide labels font rendering approximate; no pixel-parity claim is made.
- **Planned phase:** Phase 3 font pipeline and Phase 4 simulator screenshot comparison.

## Invalid source intentionally makes the preview stale

- **Example:** Applying `%?mp<Play|Pause` without a closing `>`.
- **Current behavior:** The invalid source and diagnostics remain editable. The canvas retains the last valid WPS operation list and displays a stale-preview badge instead of rendering a misleading partial replacement.
- **Preservation status:** The invalid text is preserved exactly.
- **Diagnostic:** Line/column parser diagnostics appear in the source editor and source-linked panel.
- **Planned phase:** Keep this safety contract as semantic coverage expands.

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
- **Planned phase:** Continue expanding per-construct evidence without weakening preservation; Phase 4 adds official render comparison.
