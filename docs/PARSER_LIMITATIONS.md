# Parser Limitations

The lossless syntax API is authoritative for imported WPS/SBS/FMS editing and export. The distinction still matters:

- **New syntax API:** `rockbox/syntax/` preserves tested source exactly and provides structural diagnostics.
- **Screen preview path:** Phase 3 interprets documented WPS, SBS, and FMS subsets directly from their lossless documents. Unsupported syntax stays source-exact and visibly unsupported.

Passing synthetic fixtures are evidence for those inputs, not a claim of complete Rockbox compatibility.

## Unsupported conditional expressions stay advanced source

- **Example:** A future `%?zzFuture<...>` test or a complex operand the browser semantic interpreter does not evaluate.
- **Current behavior:** Logic inventories the exact conditional, nesting, branch source, and span; labels it preserved source; and permits a disposable forced-branch preview. It does not translate the expression into a simpler visual rule. Known target requirements such as FM, touch, recording, RTC, and album art are capability-gated.
- **Preservation status:** Untouched conditionals, separators, comments, whitespace, and unknown tags round-trip exactly. Explicit branch duplication appends only a re-keyed copy of the chosen branch through the minimum-change serializer.
- **Diagnostic:** The workspace distinguishes live browser state, preserved source, and unavailable-on-target conditions.
- **Boundary:** Rockbox's external simulator remains authoritative for unsupported operands, complete numeric branch mapping, firmware state, and target behavior.

## Application migration remains screen-specific

- **Example:** Importing a WPS through the current ZIP workflow and editing it on the canvas.
- **Current behavior:** Import, viewport/text/image editing, compilation, ZIP screen export, and source previews use the lossless document. WPS/SBS/FMS render from one screen-aware source-linked semantic engine.
- **Preservation status:** Exact for untouched source and the tested edit subset; visual interpretation remains approximate.
- **Diagnostic:** Unsafe commands return an edit diagnostic and leave source unchanged.
- **Planned phase:** Expand per-screen coverage only with source and official evidence.

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
- **Current behavior:** Common direct state tests plus nested `%if`, `%and`, `%or`, `%St`, and `%ss` operands used by the Adwaitapod WPS select branches automatically. Phase 5 adds deterministic RTC/RTL/touch capability state for `%cc`, `%Sr`, `%Tp`, and `%Tl`; target profiles gate FM and touch before evaluation. False one-branch conditionals select no branch, and `%Vl` definitions remain hidden until an active `%Vd` enables their label. Every conditional and branch still appears in the logic panel and can be previewed manually.
- **Preservation status:** Exact; inactive and unsupported branch source remains present.
- **Diagnostic:** Expression tags outside the supported evaluator remain preserved and are marked unsupported rather than being silently treated as true.
- **Planned phase:** Expand operands only alongside simulator state and official behavior evidence.

## Recovery coverage is representative, not exhaustive

- **Example:** Incomplete `%`, missing `)`, missing pipe, missing `<`, missing `>`, and unexpected `|` or `>`.
- **Current behavior:** These cases produce invalid or recoverable nodes with severity, code, message, absolute span, and recovery text.
- **Preservation status:** Exact for tested cases.
- **Diagnostic:** Available through `RockboxDocument.diagnostics`.
- **Planned phase:** Expand fixtures as real themes and official parser differences reveal additional recovery cases.

## CFG editing is source-safe but intentionally bounded

- **Example:** Comments, blank lines, duplicate keys, unknown settings, or values with significant surrounding whitespace.
- **Current behavior:** Theme and Source CFG share one commit transaction. The source remains exact; typed controls update only the final matching verified key; comments and raw lines never become visual elements. Unknown-only edits persist without repainting the canvas. WPS/SBS/FMS path edits relocate an existing canonical screen document, while missing documents remain warnings.
- **Preservation status:** Exact when untouched, for raw edits, and for tested minimum-change typed updates including CRLF and duplicate keys.
- **Diagnostic:** Unsafe CFG/screen paths and invalid typed colors/ranges block commit. Missing package references are reported without deleting source.
- **Boundary:** The workspace exposes only the global-setting names and value shapes rechecked in pinned `apps/settings_list.c`. The rest of Rockbox's settings catalog remains raw source rather than receiving guessed controls.

## FMS visual support remains a documented subset

- **Example:** `fms: /.rockbox/wps/theme.fms` in a CFG.
- **Current behavior:** The package model resolves and preserves FMS. Phase 3 source-linked semantics project frequency, preset, signal, stereo, tuned/scan, and RDS state; other tags remain visible as unsupported source layers.
- **Preservation status:** Package source and tested viewport edits are exact; visual support is partial.
- **Diagnostic:** Missing FMS files are reported.
- **Planned phase:** Expand against real themes and the official simulator rather than guessing tuner behavior.

## Browser font glyphs are not Rockbox bitmap glyphs

- **Example:** A custom `.fnt` file with glyph widths that differ from the browser's monospace font.
- **Current behavior:** Fonts validates the full RB12 bitmap/offset/width layout, retains exact bytes, draws actual 1-bit or 4-bit glyph pixels, measures stored advances and line heights, and reports declared-range misses plus probable default-glyph aliases. Screen canvas text still uses browser rasterization, so the Font workspace preview is more exact than general WPS/SBS/FMS text drawing.
- **Boundary:** RB12 has no explicit coverage bit for missing characters inside its continuous range; identical default-glyph offsets are reported as probable aliases. Combining-mark placement, bidirectional shaping, fallback-font chains, and full firmware UI text layout remain external Level C concerns.
- **Preservation status:** Font references and binaries remain exact.
- **Diagnostic:** The Phase 3 guide distinguishes exact RB12 metrics and packaging from approximate browser glyph rendering; no pixel-parity claim is made.
- **Current evidence:** Phase 4 repeats a clean official simulator capture twice and compares it with the deterministic browser render. The authored SBS reference differs at 6,315 of 76,800 pixels, all classified as native text/row layout or selector approximation; the surrounding background is identical.
- **Planned phase:** Render actual RB12 glyph bitmaps and expand official fixture coverage before making broader pixel-parity claims.

## Invalid source intentionally makes the preview stale

- **Example:** Applying `%?mp<Play|Pause` without a closing `>`.
- **Current behavior:** The invalid source and diagnostics remain editable. The canvas retains the last valid WPS operation list and displays a stale-preview badge instead of rendering a misleading partial replacement.
- **Preservation status:** The invalid text is preserved exactly.
- **Diagnostic:** Line/column parser diagnostics appear in the source editor and source-linked panel.
- **Planned phase:** Keep this safety contract as semantic coverage expands.

## Level A simulation is not full firmware behavior

- **Example:** Selecting USB connected, pressing the click wheel, or opening the remote-display scenario.
- **Current behavior:** Named Phase 5 scenarios deterministically drive the documented semantic state and real condition branches. The device shell maps controls to browser actions but remains separate from the screen renderer. Play can select verified Rockbox activities; USB renders the authoritative SBS at activity 21 and then labels the compiled fallback separately. Unsupported touch/remote scenarios stay disabled.
- **Preservation status:** Simulation never rewrites source.
- **Diagnostic:** Play labels itself Level A and explains unavailable target capabilities.
- **Current evidence:** Phase 7 built and launch-smoked one external native iPod Video core, reused the authored-theme/two-frame official capture, and documented the GPL, build, thread/main-loop, dynamic-code, filesystem, audio, bundle, and maintenance constraints. The owner selected external Level C: the pinned actual simulator is the firmware UI/theme authority. Phase 8 separately proves a generated USB source patch through two real iPod Video firmware builds.
- **Planned phase:** Do not infer firmware behavior from Level A state controls. The browser does not ship Level C. Device-only hardware effects still require real-device testing.

## RTL preview is not native bidi parity

- **Example:** The right-to-left scenario with Arabic metadata and `%?Sr`.
- **Current behavior:** `%Sr` selects the RTL-language branch and browser canvas text uses RTL direction.
- **Preservation status:** Metadata and source remain unchanged unless the user explicitly edits them.
- **Diagnostic:** Phase 5 documentation and Play identify this as a browser preview.
- **Planned phase:** Compare native font shaping and bidi pixels with official target output before claiming parity.

## Asset safety covers known references, not future syntax

- **Example:** `dark/icons/play.bmp` and `light/icons/play.bmp` in one ZIP, or a future tag that accepts a bitmap path unknown to this editor.
- **Current behavior:** Assets uses canonical bytes and exact archive paths. Known WPS/SBS/FMS image, preload, backdrop, bar, font, CFG font, CFG backdrop, and CFG icon references are resolved relative to their real source location. Replacement keeps references unchanged; rename rewrites only the references resolved to that exact path; delete refuses resolved and component-owned assets. The older synthetic-project upload controls remain a data-URL compatibility input, but imported and Assets-workspace mutations no longer depend on that bridge.
- **Preservation status:** Imported duplicate basenames and untouched bytes are safe. Unknown/future syntax remains source-exact, but its asset reference may not appear in the safety console.
- **Diagnostic:** Missing and case-mismatched known references are reported rather than guessed. An asset with no resolved known reference is described as a candidate for manual review, not guaranteed unused.
- **Planned phase:** Expand reference discovery only when new path-bearing tags are verified against the pinned source; never scan-and-replace arbitrary source text.

## Browser BMP preparation is not device rendering parity

- **Example:** A PNG with alpha, an 8-bit indexed imported BMP, or a 12-frame vertical battery strip.
- **Current behavior:** Imported BMP bytes remain exact and their header is checked against Rockbox's accepted bit depths and compression modes. PNG/JPEG inputs become deterministic 24-bit BMPs; alpha inputs become 32-bit alpha-bitfield BMPs. Equal-size frames are stacked vertically, and compact or expanded `%xl` frame counts drive frame-by-frame preview.
- **Preservation status:** Existing bytes are unchanged until explicit replacement. Generated bytes and ZIP output are deterministic.
- **Diagnostic:** Invalid headers, unsupported compression/masks, truncated data, and non-divisible manual frame counts are shown before use.
- **Planned phase:** Indexed palette authoring, Rockbox-native scaling/dithering, and exact device pixel behavior remain external-simulator work.

## Real-theme preservation is measured; semantic and visual support remain partial

- **Example:** AMusicPod, Adwaitapod, target-dependent tags, and constructs outside the authored fixture corpus.
- **Current behavior:** The Phase 1G runner measures exact source serialization, package manifests, asset hashes, browser diagnostics, support inventories, and optional CheckWPS results. Local third-party ZIPs stay ignored.
- **Preservation status:** Both named real themes round-trip exactly with complete manifests. Adwaitapod passes CheckWPS; AMusicPod's original WPS has a documented official rejection while remaining byte-exact.
- **Diagnostic:** `reports/themes/latest.json` records complete evidence and `reports/themes/latest.md` provides a readable summary.
- **Current evidence:** Phase 4 adds per-tag/per-device CheckWPS evidence and a reproducible iPod Video framebuffer comparison. Untested constructs remain explicitly separate from officially validated rows.
- **Planned phase:** Continue expanding per-construct and per-device evidence without weakening preservation.
