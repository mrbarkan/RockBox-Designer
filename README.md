# Rockbox Designer

Rockbox Designer is a browser-based, source-preserving editor for Rockbox themes. Phase 2 is ready for targeted WPS dogfooding: import a theme ZIP, preview the supported WPS subset at native device pixels, inspect logic-aware source layers, make narrow visual or source edits, and export without silently deleting unsupported syntax or assets.

It is not yet a full Rockbox renderer. Complex conditional functions, exact `.fnt` metrics, SBS/FMS visual editing, lists, and menus remain documented future work.

## Run locally

Prerequisite: Node.js.

```bash
npm install
npm run dev
```

Open the local address printed by the command, create a local profile, then:

1. Open the main menu and import a Rockbox theme ZIP.
2. Keep `SOURCE_RENDER` enabled on the WPS tab.
3. Use the right panel to inspect viewports, visual elements, conditional groups, branches, source-only blocks, and unsupported preserved nodes.
4. Drag or resize a supported viewport, or edit its known properties in the inspector.
5. Use `SOURCE_EDITOR` for two-way WPS text changes. If source is invalid, fix the line/column diagnostics while the canvas safely retains the last valid preview.
6. Export the resulting ZIP and test it on a Rockbox simulator or device.

The Gemini layout generator is optional. Set `GEMINI_API_KEY` in `.env.local` only if you intend to use that feature.

## Verification

```bash
npm run validate
npm run test:visual
npm run test:themes
```

Local real-theme and official checks require private fixtures or a separate Rockbox checkout:

```bash
npm run test:phase2-real
ROCKBOX_SOURCE_DIR=/absolute/path/to/rockbox npm run test:phase2-official
```

See [Phase 2 WPS Editor](docs/PHASE2_WPS_EDITOR.md), [Compatibility Matrix](docs/COMPATIBILITY_MATRIX.md), and [Parser Limitations](docs/PARSER_LIMITATIONS.md) for the exact support boundary.
