# Compatibility Matrix

This matrix records separate evidence levels. It deliberately does not combine them into a single compatibility percentage.

| Area | Preserved | Parsed | Interpreted | Rendered | Editable | Officially validated | Baseline note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WPS source | Partial | Partial | Partial | Partial | Partial | No | Import creates an early AST, but serialization is not exact. |
| SBS source | Partial | Partial | Partial | Partial | Partial | No | CFG `sbs` is loaded when found; limitations match WPS. |
| FMS source | No package evidence | No package evidence | Partial synthetic support | Partial synthetic support | Partial synthetic support | No | Project state supports FMS, but ZIP import does not read the CFG `fms` path. |
| CFG | No | Partial | Partial | Not applicable | Settings only | No | Comments, duplicate/unknown keys, whitespace, and original ordering are not retained. |
| Unknown tags | Partial | Generic tag only | No | No | No | No | Names may survive, but argument style and formatting can change. |
| Malformed syntax | Unverified | No recovery contract | No | No | No | No | There are no parser diagnostics or malformed-source fixtures. |
| Conditionals | Partial | Approximate | Partial | Partial | Branch content only | No | Parameterized tests and nested separators are not modeled safely. |
| Viewports | Partial | Partial | Partial | Partial | Partial | No | Basic `%V` and `%Vl` geometry is supported. |
| Images and preloads | Partial | Partial | Partial | Partial | Partial | No | Basename asset lookup can collide; sprite behavior is approximate. |
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
