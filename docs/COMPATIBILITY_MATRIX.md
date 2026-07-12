# Compatibility Matrix

This matrix records separate evidence levels. It deliberately does not combine them into a single compatibility percentage.

| Area | Preserved | Parsed | Interpreted | Rendered | Editable | Officially validated | Baseline note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Generated official tag names | Yes | 193 names and longest boundaries | No blanket claim | No blanket claim | No blanket claim | No | Names, raw parameter specs, flags, tokens, and categories come from the pinned Rockbox tag table. |
| iPod Video device profile | Profile data preserved | Target and capabilities loaded | Feature gates | Native 320×240 canvas | Profile selection | Source-config verified | `ipodvideo` values match the pinned config and local verifier. |
| iPod Classic device profile | Profile data preserved | Target and capabilities loaded | Feature gates | Native 320×240 canvas | Profile selection | Source-config verified | `ipod6g` has no configured tuner, so FMS is hidden despite identical LCD dimensions. |
| Official parser fixture bridge | Browser source preserved for all 6 | Browser structural results recorded | Not applicable | Not applicable | Not applicable | Yes, target-specific `checkwps` | Three accepted by both, one intentional future-tag difference, one diagnostic difference, and one target-dependent result. |
| Real-theme corpus | Exact for local AMusicPod and Adwaitapod | Zero browser syntax/package diagnostics in the latest local run | Reported per tag; no blanket claim | Reported per tag; no blanket claim | Reported per tag; no blanket claim | Adwaitapod accepted; AMusicPod source rejected at documented line | Private ZIPs remain ignored; package manifests and asset hashes survive export/re-import. |
| Phase 1A syntax document | Yes for tested corpus | Structural subset | No | No | Serializer primitive only | No | Twenty named fixtures and randomized safe-fragment combinations round-trip exactly. |
| WPS product workflow | Yes for untouched and tested edits | Structural subset | Legacy adapter subset | Legacy adapter subset | Viewport, text, image | No | Import/edit/export authority is lossless; rendering remains approximate. |
| SBS source | Yes for untouched and tested edits | Structural subset | Legacy adapter subset | Legacy adapter subset | Viewport, text, image | No | CFG `sbs` is loaded when found and uses the same lossless edit path. |
| FMS source | Yes for package fixtures | Structural source document | Partial synthetic support | Partial synthetic support | Partial synthetic support | No | Package import/export resolves FMS; the legacy visual derivation remains incomplete. |
| CFG | Yes for tested corpus | Settings plus raw lines | Partial | Not applicable | Source helper subset | No | Comments, duplicates, unknown keys, whitespace, colons, ordering, and CRLF survive. |
| Unknown tags in new syntax API | Yes | Generic raw tag | No | No | No | No | Unknown names and arguments remain preserved when no generated official definition matches. |
| Malformed syntax in new syntax API | Yes for tested cases | Recovery nodes and diagnostics | No | No | No | No | Incomplete tags, delimiters, and conditionals remain serializable. |
| Conditionals in new syntax API | Yes for tested corpus | Nested tests and branches | No | No | Serializer primitive only | No | Parameterized tests, nested branches, empty branches, argument pipes, and escaped separators are structural. |
| Viewports | Yes for tested edits | `%V`, `%Vl`, `%Vi` helpers | Partial | Partial | Yes for geometry | No | Narrow edits preserve surrounding bytes and invocation style. |
| Images and preloads | Source reference yes | `%x`, `%xl`, `%xd`, `%X` helpers | Partial | Partial | Image path subset | Real-theme references exercised | Direct screen-relative and screen-named sibling asset directories resolve without basename fallback; sprite behavior is approximate. |
| Album art | Partial | Partial | Partial | Partial | No | No | `%Cl`/`%Cd` preview support exists for the prototype subset. |
| Progress and volume bars | Partial | Partial | Partial | Partial | Visual model only | No | Rendering and compiler behavior are approximations. |
| Theme ZIP assets | Yes for authored and local real-theme corpus | Path-safe manifest | Partial | Partial | Upload bridge | Package contents compared around CheckWPS run | Archive paths and bytes are canonical; duplicate basenames, fonts, unknown binaries, AMusicPod, and Adwaitapod are tested. |
| Deterministic export | Yes for tested corpus | Not applicable | Not applicable | Not applicable | Not applicable | No | Sorted logical contents and fixed ZIP metadata produce repeatable bytes in fixtures. |

Support terms:

- **Preserved:** Original input survives without unintended changes.
- **Parsed:** The application recognizes source structure.
- **Interpreted:** The application assigns known Rockbox meaning.
- **Rendered:** The browser preview draws an approximation.
- **Editable:** A user-facing edit can update the represented construct.
- **Officially validated:** Behavior has been compared with current Rockbox source tooling.
