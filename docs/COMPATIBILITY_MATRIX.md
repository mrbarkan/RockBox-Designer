# Compatibility Matrix

This matrix records separate evidence levels. It deliberately does not combine them into a single compatibility percentage.

| Area | Preserved | Parsed | Interpreted | Rendered | Editable | Officially validated | Baseline note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Phase 1A syntax document | Yes for tested corpus | Structural subset | No | No | Serializer primitive only | No | Twenty named fixtures and randomized safe-fragment combinations round-trip exactly. |
| WPS product workflow | Yes for untouched and tested edits | Structural subset | Legacy adapter subset | Legacy adapter subset | Viewport, text, image | No | Import/edit/export authority is lossless; rendering remains approximate. |
| SBS source | Yes for untouched and tested edits | Structural subset | Legacy adapter subset | Legacy adapter subset | Viewport, text, image | No | CFG `sbs` is loaded when found and uses the same lossless edit path. |
| FMS source | No package evidence | No package evidence | Partial synthetic support | Partial synthetic support | Partial synthetic support | No | Project state supports FMS, but ZIP import does not read the CFG `fms` path. |
| CFG | No | Partial | Partial | Not applicable | Settings only | No | Comments, duplicate/unknown keys, whitespace, and original ordering are not retained. |
| Unknown tags in new syntax API | Yes | Generic raw tag | No | No | No | No | Unknown names and arguments are preserved; registry-backed name boundaries arrive in Phase 1D. |
| Malformed syntax in new syntax API | Yes for tested cases | Recovery nodes and diagnostics | No | No | No | No | Incomplete tags, delimiters, and conditionals remain serializable. |
| Conditionals in new syntax API | Yes for tested corpus | Nested tests and branches | No | No | Serializer primitive only | No | Parameterized tests, nested branches, empty branches, argument pipes, and escaped separators are structural. |
| Viewports | Yes for tested edits | `%V`, `%Vl`, `%Vi` helpers | Partial | Partial | Yes for geometry | No | Narrow edits preserve surrounding bytes and invocation style. |
| Images and preloads | Source reference yes | `%x`, `%xl`, `%xd`, `%X` helpers | Partial | Partial | Image path subset | No | Asset lookup can still collide; sprite behavior is approximate. |
| Album art | Partial | Partial | Partial | Partial | No | No | `%Cl`/`%Cd` preview support exists for the prototype subset. |
| Progress and volume bars | Partial | Partial | Partial | Partial | Visual model only | No | Rendering and compiler behavior are approximations. |
| Theme ZIP assets | Partial | Partial | Partial | Partial | Upload/replace only | No | Data URLs and basename keys are canonical; binary/path fidelity is unproven. |
| Deterministic export | No evidence | Not applicable | Not applicable | Not applicable | Not applicable | No | ZIP timestamps, manifests, and bytes are not normalized or fixture-tested. |

Support terms:

- **Preserved:** Original input survives without unintended changes.
- **Parsed:** The application recognizes source structure.
- **Interpreted:** The application assigns known Rockbox meaning.
- **Rendered:** The browser preview draws an approximation.
- **Editable:** A user-facing edit can update the represented construct.
- **Officially validated:** Behavior has been compared with current Rockbox source tooling.
