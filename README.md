# Rockbox Designer

Rockbox Designer is a browser-based, source-preserving editor for Rockbox themes. Phase 3 supports targeted WPS, SBS, and FMS dogfooding: import a theme ZIP, preview the documented source-linked subset at native device pixels, inspect logic-aware layers, make narrow visual or source edits, and export without silently deleting unsupported syntax or assets.

It is not yet a full Rockbox renderer. Complex conditional functions and constructs outside the documented subset remain future work. Existing Rockbox `.fnt` files retain exact bytes and expose RB12 metrics, while browser-side TTF/OTF conversion awaits an explicit delivery and licensing decision.

## Run locally

Prerequisite: Node.js.

```bash
npm install
npm run dev
```

Open the local address printed by the command, create a local profile, then:

1. Open the main menu and import a Rockbox theme ZIP.
2. Keep `SOURCE_RENDER` enabled on the WPS, SBS, or FMS tab.
3. Use the right panel to inspect viewports, visual elements, conditional groups, branches, source-only blocks, and unsupported preserved nodes.
4. Drag or resize a supported viewport, or edit its known properties in the inspector.
5. Use `SOURCE_EDITOR` for two-way WPS/SBS/FMS text changes. If source is invalid, fix the line/column diagnostics while the canvas safely retains the last valid preview.
6. Export the resulting ZIP and test it on a Rockbox simulator or device.

The Gemini layout generator is optional. Set `GEMINI_API_KEY` in `.env.local` only if you intend to use that feature.

## Verification

```bash
npm run validate
npm run test:visual
npm run test:themes
npm run test:phase3-real
```

Local real-theme and official checks require private fixtures or a separate Rockbox checkout:

```bash
ROCKBOX_SOURCE_DIR=/absolute/path/to/rockbox npm run test:phase3-official
```

See [Phase 3 Screen Editor and Font Pipeline](docs/PHASE3_SCREEN_AND_FONT.md), [Phase 2 WPS Editor](docs/PHASE2_WPS_EDITOR.md), [Compatibility Matrix](docs/COMPATIBILITY_MATRIX.md), and [Parser Limitations](docs/PARSER_LIMITATIONS.md) for the exact support boundary.
