# Compatibility Matrix

This matrix records separate evidence levels. It deliberately does not combine them into a single compatibility percentage.

| Area | Preserved | Parsed | Interpreted | Rendered | Editable | Officially validated | Baseline note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Generated official tag names | Yes | 193 names and longest boundaries | No blanket claim | No blanket claim | No blanket claim | No | Names, raw parameter specs, flags, tokens, and categories come from the pinned Rockbox tag table. |
| Phase 1A syntax document | Yes for tested corpus | Structural subset | No | No | Serializer primitive only | No | Twenty named fixtures and randomized safe-fragment combinations round-trip exactly. |
| WPS product workflow | Yes for untouched and tested edits | Structural subset | Legacy adapter subset | Legacy adapter subset | Viewport, text, image | No | Import/edit/export authority is lossless; rendering remains approximate. |
| SBS source | Yes for untouched and tested edits | Structural subset | Legacy adapter subset | Legacy adapter subset | Viewport, text, image | No | CFG `sbs` is loaded when found and uses the same lossless edit path. |
| FMS source | Yes for package fixtures | Structural source document | Partial synthetic support | Partial synthetic support | Partial synthetic support | No | Package import/export resolves FMS; the legacy visual derivation remains incomplete. |
| CFG | Yes for tested corpus | Settings plus raw lines | Partial | Not applicable | Source helper subset | No | Comments, duplicates, unknown keys, whitespace, colons, ordering, and CRLF survive. |
| Unknown tags in new syntax API | Yes | Generic raw tag | No | No | No | No | Unknown names and arguments remain preserved when no generated official definition matches. |
| Malformed syntax in new syntax API | Yes for tested cases | Recovery nodes and diagnostics | No | No | No | No | Incomplete tags, delimiters, and conditionals remain serializable. |
| Conditionals in new syntax API | Yes for tested corpus | Nested tests and branches | No | No | Serializer primitive only | No | Parameterized tests, nested branches, empty branches, argument pipes, and escaped separators are structural. |
| Viewports | Yes for tested edits | `%V`, `%Vl`, `%Vi` helpers | Partial | Partial | Yes for geometry | No | Narrow edits preserve surrounding bytes and invocation style. |
| Images and preloads | Source reference yes | `%x`, `%xl`, `%xd`, `%X` helpers | Partial | Partial | Image path subset | No | Asset lookup can still collide; sprite behavior is approximate. |
| Album art | Partial | Partial | Partial | Partial | No | No | `%Cl`/`%Cd` preview support exists for the prototype subset. |
| Progress and volume bars | Partial | Partial | Partial | Partial | Visual model only | No | Rendering and compiler behavior are approximations. |
| Theme ZIP assets | Yes for tested corpus | Path-safe manifest | Partial | Partial | Upload bridge | No | Archive paths and bytes are canonical; duplicate basenames, fonts, and unknown binaries are tested. |
| Deterministic export | Yes for tested corpus | Not applicable | Not applicable | Not applicable | Not applicable | No | Sorted logical contents and fixed ZIP metadata produce repeatable bytes in fixtures. |

Support terms:

- **Preserved:** Original input survives without unintended changes.
- **Parsed:** The application recognizes source structure.
- **Interpreted:** The application assigns known Rockbox meaning.
- **Rendered:** The browser preview draws an approximation.
- **Editable:** A user-facing edit can update the represented construct.
- **Officially validated:** Behavior has been compared with current Rockbox source tooling.
