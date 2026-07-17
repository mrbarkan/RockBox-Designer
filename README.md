# Rockbox Designer

Rockbox Designer is a browser-based, source-preserving editor for Rockbox themes. It supports targeted WPS, SBS, and FMS dogfooding: import a theme ZIP, preview the documented source-linked subset at native device pixels, exercise deterministic device states in first-class Play mode, make narrow visual or source edits, and export without silently deleting unsupported syntax or assets. An advanced Compatibility Lab separates preservation, parsing, interpretation, rendering, editing, official validation, and known pixel differences per tag and target.

It is not yet a full Rockbox renderer. Complex conditional functions and constructs outside the documented subset remain future work. Existing Rockbox `.fnt` files retain exact bytes and expose RB12 metrics. TTF/OTF/TTC conversion is available through a loopback-only local companion so the native GPL Rockbox converter and input font stay outside the browser bundle.

USB connected presentation is ordinary SBS theme behavior selected by Rockbox activity 21; Play renders that same SBS scene and keeps the built-in logo visible only as a firmware fallback boundary. Optional Firmware Assets is separate from theme editing and creates a SHA-pinned source patch package only when the built-in iPod Video fallback logo or placement itself must change. It requires recovery acknowledgement and exports no compiled or proprietary firmware. The actual external Rockbox simulator remains the Level C behavioral authority for the pinned target; device-only behavior still requires hardware testing.

## Run locally

Prerequisite: Node.js.

```bash
npm install
npm run dev
```

For outline-font conversion, keep a second terminal open:

```bash
npm run font:helper
```

The helper listens only on `127.0.0.1`. On first conversion it obtains the exact pinned Rockbox source into the user cache and builds `convttf` locally; set `ROCKBOX_SOURCE_DIR=/absolute/path/to/rockbox` to use an existing matching checkout. A C compiler and FreeType development files must be available. The ordinary app and existing `.fnt` import continue to work when the helper is stopped.

Open the local address printed by the command, create a local profile, then:

1. Open the main menu and import a Rockbox theme ZIP.
2. Keep `SOURCE_RENDER` enabled on the WPS, SBS, or FMS tab.
3. Use the right panel to inspect viewports, visual elements, conditional groups, branches, source-only blocks, and unsupported preserved nodes.
4. Drag or resize a supported viewport, or edit its known properties in the inspector.
5. Use `SOURCE_EDITOR` for two-way WPS/SBS/FMS text changes. If source is invalid, fix the line/column diagnostics while the canvas safely retains the last valid preview.
6. Choose **Import Font** to add an exact `.fnt` or convert TTF/OTF/TTC with selectable pixel size and glyph coverage.
7. Open **Play** (or press `Cmd/Ctrl+P`) to select real Rockbox activities—including menu, WPS, recording, FM, quick screen, option select, system, and USB—and exercise deterministic power, hold, RTC, metadata, and capability-gated state.
8. Copy a named scenario link when you need another person to see the same state.
9. Export the resulting ZIP and test it on a Rockbox simulator or device.
10. Author the connected-USB scene in SBS with `%cs = 21`. Open **FW ASSETS** only when you intentionally need to replace the compiled iPod Video fallback logo or its placement.

The product direction is now a compact, Pulp-inspired studio with specialized creative modes and Canva-style manipulation concentrated in Screens mode. The foundation phases remain intentionally focused; the studio migration will land through separate, behavior-preserving milestones described in [Pulp UX Guidelines](ROCKBOX_DESIGNER_PULP_UX_GUIDELINES.md).

The Gemini layout generator is optional. Set `GEMINI_API_KEY` in `.env.local` only if you intend to use that feature.

## Verification

```bash
npm run validate
npm run test:visual
npm run test:themes
npm run test:phase3-real
npm run font:helper:report:verify
npm run phase4:render:report:verify
npm run phase4:compatibility:report:verify
npm run test:phase5
npm run phase8:firmware:report:verify
```

Local real-theme and official checks require private fixtures or a separate Rockbox checkout:

```bash
ROCKBOX_SOURCE_DIR=/absolute/path/to/rockbox npm run test:phase3-official
ROCKBOX_SOURCE_DIR=/absolute/path/to/rockbox ROCKBOX_FONT_INPUT=/absolute/path/to/font.ttf npm run test:font-helper
ROCKBOX_SOURCE_DIR=/absolute/path/to/rockbox ROCKBOX_SIMULATOR_BUILD_DIR=/absolute/path/to/simulator npm run test:phase4-render
ROCKBOX_SOURCE_DIR=/absolute/path/to/rockbox npm run test:phase4-compatibility
```

See [Phase 8 Firmware Mode](docs/PHASE8_FIRMWARE_MODE.md), [Phase 5 Device-State Simulator](docs/PHASE5_DEVICE_SIMULATOR.md), [Phase 4 Official Validation](docs/PHASE4_OFFICIAL_VALIDATION.md), [Phase 3 Screen Editor and Font Pipeline](docs/PHASE3_SCREEN_AND_FONT.md), [Compatibility Matrix](docs/COMPATIBILITY_MATRIX.md), and [Parser Limitations](docs/PARSER_LIMITATIONS.md) for the exact support boundary.
