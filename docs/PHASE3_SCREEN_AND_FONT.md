# Phase 3 Screen Editor and Font Pipeline

Phase 3 extends the source-linked semantic editor to WPS, SBS, and FMS while keeping every screen document and package asset lossless. It also adds an externally built Rockbox font conversion and verification path without copying GPL Rockbox code or binaries into this repository.

## Screen behavior

- WPS, SBS, and FMS import from their CFG paths, retain their exact source documents, render through the same semantic operation model, accept supported viewport edits, and export from the authoritative source.
- SBS recognizes Rockbox current-screen state, UI viewport activation, menu/list projections, selector colors, scrollbar settings, and source-derived icon-strip settings.
- The menu rows and icon IDs come from firmware state. The theme controls their viewports and presentation; it does not define the firmware menu contents.
- The quick-screen preview is a clearly labeled simulation of Rockbox's firmware-controlled layout inside the active SBS UI viewport. Rockbox does not use a separate quick-screen theme file.
- FMS projects frequency, preset, signal, stereo, tuned/scan, and RDS state for the documented tag subset.
- USB remains a stock/firmware mode boundary. The editor does not invent a `.usb` skin file or imply that a full USB screen redesign is ordinary theme functionality.
- Comments remain in the CST and serialized source but never become visual elements or layer rows.

The semantic subset is independently implemented from behavior verified at Rockbox commit `078a506dfd0deb18165a3ed80c7fcbdb3afb0d31`. Relevant upstream paths are `lib/skin_parser/tag_table.c`, `apps/gui/skin_engine/skin_tokens.c`, `apps/misc.h`, `apps/gui/icon.h`, `apps/root_menu.c`, `apps/gui/quickscreen.c`, and `apps/gui/usb_screen.c`.

## Font behavior

The application can import an existing Rockbox `.fnt` file, validate its RB12 header, retain its exact bytes under `.rockbox/fonts/`, expose its actual height, ascent, maximum width, character range, and glyph count, and export the same binary unchanged. The Font Workshop also converts TTF/OTF/TTC through the accepted local companion architecture:

```bash
npm run font:helper
```

The browser shows helper connectivity, the pinned upstream SHA, pixel-size controls, Basic Latin/Latin-1/broad Unicode/custom glyph ranges, the actual generated RB12 metrics, and a font-license warning. Existing `.fnt` import remains available when the helper is offline.

The native development workflow builds `tools/convttf.c` from a separate Rockbox checkout at the pinned SHA, converts a user-supplied TTF/OTF/TTC file, validates the generated RB12 data, and can inject it into a theme ZIP:

```bash
ROCKBOX_SOURCE_DIR=/absolute/path/to/rockbox npm run font:convert -- \
  --input /absolute/path/to/font.ttf \
  --pixel-size 16 \
  --start 32 \
  --limit 126 \
  --output /tmp/16-font.fnt
```

Add `--theme /absolute/path/to/theme.zip --output-theme /tmp/theme-with-font.zip` to preserve and update a theme package in the same run.

The demonstrated validation additionally installed the generated font into an external iPod Video simulator disk and inspected the font loaded by current Rockbox:

```bash
ROCKBOX_SOURCE_DIR=/absolute/path/to/rockbox \
ROCKBOX_FONT_INPUT=/absolute/path/to/font.ttf \
ROCKBOX_SIMULATOR_BUILD_DIR=/absolute/path/to/rockbox-simulator-build \
npm run test:phase3-font
```

The checked-in report records only the pinned upstream SHA, conversion parameters, output hash/metrics, package result, and simulator result. It does not contain the input font path or bytes, generated font bytes, Rockbox source, or a Rockbox executable.

## Licensing and local-companion boundary

- Confirm that an input font's license permits conversion and redistribution before sharing its generated `.fnt` file.
- Rockbox's `convttf` source is GPL-2.0-or-later. The accepted companion builds and executes it only from an exact separate checkout on the user's machine and does not distribute its source or binary through this repository or browser bundle.
- The helper binds only to `127.0.0.1`, checks exact browser origins and a versioned protocol header, accepts no client paths, limits the request size, uses a private temporary directory, and removes conversion inputs and outputs after returning the validated bytes.
- The helper can fetch the pinned official Rockbox checkout into a SHA-keyed user cache on first conversion. This is a local build of upstream GPL software rather than redistribution in Rockbox Designer.
- ADR-0013 records the license, build system, memory model, filesystem interface, browser bundle impact, security boundary, and upstream update workflow. That decision resolves the Phase 3 stop condition.

## Verification

```bash
npm run test:visual
npm run test:phase3-real
ROCKBOX_SOURCE_DIR=/absolute/path/to/rockbox npm run test:phase3-official
npm run phase3:font:report:verify
npm run font:helper:report:verify
npm run validate
```

The real-theme runner uses ignored local third-party fixtures. The official runner builds CheckWPS outside the repository. Ordinary validation consumes the checked-in reports and remains self-contained.
