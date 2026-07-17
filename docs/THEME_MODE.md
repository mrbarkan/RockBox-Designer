# Theme / CFG workspace

The Theme workspace is the project-wide control surface for a Rockbox theme. It stages metadata, target selection, supported global settings, package paths, and raw CFG source, then applies them together with **Commit project**.

## Source contract

Imported projects keep one canonical CFG in `ThemePackage.cfg`. Editor-created projects do not fabricate an imported package; their first real Theme/CFG commit creates one `ProjectState.standaloneThemeConfig`. Export consumes the appropriate owner directly. These stores are mutually exclusive editable authorities.

The CFG parser retains comments, blank lines, duplicates, unknown settings, malformed lines, surrounding whitespace, ordering, colons inside values, and original line endings. A typed edit updates only the final matching setting. A raw edit is parsed back into the lossless document and known values are projected into `ProjectSettings`; unsupported values remain source-exact even when the browser cannot interpret them.

Comments and raw lines are never visual elements. Project author and description are saved as Designer metadata rather than invented Rockbox settings or injected comments.

## Verified typed subset

The editable names and enumerated/ranged values were checked at Rockbox commit `078a506dfd0deb18165a3ed80c7fcbdb3afb0d31` in `apps/settings_list.c`. The workspace exposes:

- foreground, background, and selector colors;
- selector, status-bar, scrollbar, volume, battery, and icon behavior;
- scroll speed, delay, and step plus backlight-on-hold;
- global font, backdrop, iconset, and viewers-iconset references;
- top, left, right, and bottom quick-screen assignments;
- WPS/SBS/FMS and CFG package paths through the lossless source.

Unknown settings stay editable only as raw source. The editor does not infer a value schema for them.

## Package and preview behavior

Changing an imported WPS/SBS/FMS CFG reference relocates the matching canonical screen document in the exported archive. Unsafe paths and extension mismatches block the commit. A reference to a screen document that is not present remains visible as a warning rather than being silently generated.

The Theme draft is disposable component state. Nothing reaches history, persistence, package output, or the preview until commit. Metadata and unknown-only CFG commits preserve the render-relevant settings, screens, assets, and screen-path object identities, so `EditorCanvas` does not reload images or repaint. Visual-setting commits update the shared preview.

Rockbox accepts `statusbar: off`, `top`, and `bottom`; all three remain distinct in project state. The legacy synthetic preview now places its approximate overlay at the selected edge. Imported source rendering and the external Level C simulator remain authoritative for final firmware pixels.

## Boundaries

- Theme metadata is project-only and is not a standard Rockbox CFG field.
- A path reference does not create the referenced bitmap, font, iconset, or screen. Assets and Fonts inspect exact package bytes.
- The browser's supported global-setting projection is not the complete Rockbox settings catalog.
- USB remains a state of SBS activity 21, not a `.usb` theme file.
- Full quick-screen layout changes and firmware UI remain external Level C or separately verified Firmware work.

The Theme UI and its domain model are lazy chunks. Opening the general editor does not load the project-wide workspace.
