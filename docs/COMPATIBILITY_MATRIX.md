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
| WPS product workflow | Yes for untouched and tested edits | Structural subset | Documented Phase 2 subset | Native-pixel operation list | Viewport, text, image, bars, colors, touch, branch preview | Edited export accepted for Authored Full | AMusicPod and Adwaitapod complete minimum-change visual edit/export/re-import locally. |
| SBS source | Yes for untouched and tested edits | Structural subset | Legacy adapter subset | Legacy adapter subset | Viewport, text, image | No | CFG `sbs` is loaded when found and uses the same lossless edit path. |
| FMS source | Yes for package fixtures | Structural source document | Partial synthetic support | Partial synthetic support | Partial synthetic support | No | Package import/export resolves FMS; the legacy visual derivation remains incomplete. |
| CFG | Yes for tested corpus | Settings plus raw lines | Partial | Not applicable | Source helper subset | No | Comments, duplicates, unknown keys, whitespace, colons, ordering, and CRLF survive. |
| Unknown tags in new syntax API | Yes | Generic raw tag | No | No | No | No | Unknown names and arguments remain preserved when no generated official definition matches. |
| Malformed syntax in new syntax API | Yes for tested cases | Recovery nodes and diagnostics | No | No | No | No | Incomplete tags, delimiters, and conditionals remain serializable. |
| Conditionals in new syntax API | Yes for tested corpus | Nested tests and branches | Common playback/power/art states | Selected branch at native pixels | Automatic and manual branch preview | Playback subset included in accepted export | Complex `%?if`/`%?and`/`%?or` tests remain manual-preview only. |
| Viewports | Yes for tested edits | `%V`, `%Vl`, `%Vi`, `%Vd` | Position, size, font slot | Integer geometry and clipping | Drag, resize, inspector geometry | Edited viewport accepted by CheckWPS | Narrow edits preserve surrounding bytes and invocation style. |
| Images and preloads | Source reference yes | `%x`, `%xl`, `%xd`, `%X` helpers | Static image, preload, frame subset | Nearest-neighbor native pixels | Image path and frame fields | Real-theme references exercised | Screen-named asset directories resolve without basename fallback; advanced sprite layouts remain approximate. |
| Album art | Yes | `%Cl`/`%Cd` | Geometry and presence state | Native-pixel rectangle/image | Geometry through source fields | Tested in accepted authored fixture | Missing art uses an explicit placeholder. |
| Progress and volume bars | Yes | `%pb`/`%pv` geometry | Track and volume values | Deterministic filled bars | Geometry and optional path | Authored progress edit/export subset accepted | Advanced bitmap, gradient, and option semantics remain partial. |
| Touch regions | Yes | `%T` geometry/action | Action retained | Debug overlay | Geometry and action fields | Tag identity source-derived | Touch execution is simulated visually, not dispatched as firmware input. |
| Two-way source synchronization | Yes | WPS/SBS/FMS reparsed on apply | WPS subset reinterpreted | Last valid WPS render retained on errors | Source text plus known visual properties | Tested export uses synchronized source | Parser diagnostics show line/column and stale-preview state. |
| Native pixel renderer | Render list retains source links | Not applicable | Operation subset | 320×240 deterministic golden | DOM handles are derived only | Browser operations compared through accepted source | CSS only zooms the completed canvas; it does not define pixel positions. |
| Theme ZIP assets | Yes for authored and local real-theme corpus | Path-safe manifest | Partial | Partial | Upload bridge | Package contents compared around CheckWPS run | Archive paths and bytes are canonical; duplicate basenames, fonts, unknown binaries, AMusicPod, and Adwaitapod are tested. |
| Deterministic export | Yes for tested corpus | Not applicable | Not applicable | Not applicable | Source-aware WPS changes included | Edited Authored Full export accepted | Sorted logical contents and fixed ZIP metadata produce repeatable bytes in fixtures. |

Support terms:

- **Preserved:** Original input survives without unintended changes.
- **Parsed:** The application recognizes source structure.
- **Interpreted:** The application assigns known Rockbox meaning.
- **Rendered:** The browser preview draws an approximation.
- **Editable:** A user-facing edit can update the represented construct.
- **Officially validated:** Behavior has been compared with current Rockbox source tooling.
