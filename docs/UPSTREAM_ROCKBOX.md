# Upstream Rockbox Reference

## Inspected source

- **Canonical project:** [Rockbox](https://www.rockbox.org/)
- **Inspected Git repository:** [Rockbox/rockbox](https://github.com/Rockbox/rockbox)
- **Commit SHA:** `078a506dfd0deb18165a3ed80c7fcbdb3afb0d31`
- **Commit date:** 2026-07-12
- **Date inspected:** 2026-07-12
- **Commit subject:** `hibyr1: route ADB through the usb-mode setting`

The GitHub repository was used as the accessible upstream mirror for this inspection. Record a new exact SHA whenever parser, tag registry, device, simulator, or compatibility claims are updated.

## Relevant source paths verified at this SHA

```text
lib/skin_parser/tag_table.c
lib/skin_parser/tag_table.h
lib/skin_parser/skin_parser.c
lib/skin_parser/skin_scan.c
firmware/export/config/ipodvideo.h
firmware/export/config/ipod6g.h
firmware/screendump.c
firmware/target/hosted/sdl/button-sdl.c
tools/configure
apps/gui/skin_engine/skin_parser.c
apps/gui/skin_engine/skin_tokens.c
apps/gui/skin_engine/skin_render.c
apps/gui/skin_engine/skin_display.c
apps/misc.h
apps/root_menu.c
apps/gui/icon.h
apps/gui/statusbar-skinned.c
apps/radio/radio_skin.c
apps/gui/usb_screen.c
apps/gui/quickscreen.c
apps/recorder/bmp.c
tools/convttf.c
tools/convbdf.c
firmware/font.c
firmware/export/font.h
firmware/common/diacritic.c
fonts/README
fonts/COPYING
uisimulator/
uisimulator/common/sim_tasks.c
utils/themeeditor/
docs/COPYING
```

Phase 0 verified that these paths exist and inspected the parser/tag-table headers. Phase 1D generated factual tag metadata from the first two paths without copying parser functions or comments.

## Phase 1E device verification

Phase 1E verified the iPod Video `ipodvideo` and iPod Classic `ipod6g` target entries plus their LCD and capability definitions at this SHA. The checked-in profiles and optional local-source verifier are documented in `docs/DEVICE_PROFILES.md`.

## Phase 1A syntax verification

At the recorded SHA, Phase 1A re-inspected:

- `find_escape_character()` and `legal_escape_characters` in `lib/skin_parser/tag_table.c`
- `skin_parse_text()`, `skin_parse_conditional()`, and `skin_parse_comment()` in `lib/skin_parser/skin_parser.c`
- `skip_tag()` and argument scanning in `lib/skin_parser/skin_scan.c`
- parser delimiter constants in `lib/skin_parser/symbols.h`

This confirmed the escape set `%(,);#<|>` and that an unescaped `#` starts a comment at its source position rather than only at the beginning of a line. The Phase 1A browser parser was adjusted and tested accordingly. The inspection informed behavior; no upstream implementation code was copied.

## Updating the reference

Use a separate local checkout so GPL source is not accidentally added to this application:

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/Rockbox/rockbox.git /tmp/rockbox-upstream-reference
git -C /tmp/rockbox-upstream-reference sparse-checkout set lib/skin_parser firmware/export/config apps/gui/skin_engine apps/gui apps/radio tools utils/themeeditor uisimulator docs
git -C /tmp/rockbox-upstream-reference rev-parse HEAD
git -C /tmp/rockbox-upstream-reference show -s --format=%cI HEAD
```

Then verify the relevant paths, update the SHA and inspection date here, and update any generated compatibility metadata that cites the previous SHA.

## Generated tag registry

Phase 1D generated `rockbox/registry/generated/rockbox-tags.json` from `lib/skin_parser/tag_table.c` and `lib/skin_parser/tag_table.h` at this exact SHA. The checked-in output contains 193 non-sentinel tag definitions and is reproducible through `npm run registry:generate` and `npm run registry:verify`. See `docs/ROCKBOX_TAG_REGISTRY.md` for the workflow and licensing-review boundary.

## Official parser harness

Phase 1F builds and runs upstream `tools/checkwps` from a separately checked-out Rockbox tree provided through `ROCKBOX_SOURCE_DIR`. The demonstrated structured report cites this SHA. Ordinary application tests do not require the checkout or network access, and Rockbox parser source or binaries are not bundled into the browser. See `docs/OFFICIAL_PARSER_VALIDATION.md`.

## Phase 2 semantic reference

Phase 2 inspected `apps/gui/skin_engine/skin_tokens.c`, `skin_render.c`, and `skin_display.c` at the recorded SHA for playback status numbering, battery/volume conditional values, album-art presence, charging/USB truth values, viewport clipping, progress bars, and bitmap display behavior. The browser implementation is an independently written documented subset; no upstream implementation code is copied or linked. The edited Authored Full export was accepted by the external CheckWPS harness at this SHA.

## Phase 3 screen and font reference

Phase 3 re-inspected `lib/skin_parser/tag_table.c` and `apps/gui/skin_engine/skin_tokens.c` for SBS/FMS tag identity and current-screen behavior. It inspected `apps/misc.h`, `apps/root_menu.c`, and `apps/gui/icon.h` for activity values, root-menu ordering, and firmware icon IDs; `apps/gui/quickscreen.c` for the firmware-owned quick-screen layout; `apps/gui/usb_screen.c` for `ACTIVITY_USBSCREEN` 21, the theme-selected UI viewport parent, and the built-in fallback draw; and `apps/radio/radio_skin.c` for FMS state.

The font workflow inspected `tools/convttf.c`, `tools/convbdf.c`, `firmware/font.c`, `firmware/export/font.h`, `firmware/common/diacritic.c`, and the collection's `fonts/README`/`COPYING`. The application independently parses the factual RB12 layout, including 16-/32-bit offset selection, padding, width tables, rotated 1-bit BDF glyph blocks, and row-major 4-bit antialiased pixels. Development tooling builds and executes the unmodified converters from the separate pinned checkout, writes executables/output outside the repository, and verifies generated output in an external Rockbox simulator. No upstream source, object, executable, collection BDF/FNT, or generated third-party font is committed or distributed.

The pinned `fonts/` directory contains 88 BDF filenames. Rockbox's manual describes these as a separate downloadable font package and requires runtime FNT files under `/.rockbox/fonts/`. `rockbox/fonts/catalog.ts` records only those factual output names, pixel heights encoded by the naming convention, and the source SHA. `npm run font:catalog:verify` checks the metadata without external source and, when `ROCKBOX_SOURCE_DIR` is set, compares it directly with all pinned `fonts/*.bdf` names.

## Phase 4 official render reference

Phase 4 assessed the official parser and skin engine as a possible WebAssembly dependency, then retained them as external oracles under ADR-0014. The assessment inspected the GPL license boundary, target-generated build inputs, native/global memory model, Rockbox path conventions, browser-bundle implications, and SHA-pinned update process.

The canonical capture path was source-verified through:

- `firmware/target/hosted/sdl/button-sdl.c`, where simulator F5/keypad-0 input calls `sim_trigger_screendump()`.
- `uisimulator/common/sim_tasks.c`, where the simulator task dispatches the screen-dump request.
- `firmware/screendump.c`, which writes the target framebuffer as BMP.

The development harness invokes that existing path on an unmodified external iPod Video simulator. Two clean captures at this SHA produced identical normalized pixel hashes. The repository checks in only the comparison report; the simulator, temporary disk, BMP, normalized screenshots, and diff images remain outside version control.

## Phase 5 simulator-state reference

Phase 5 re-inspected `apps/status.h`, `apps/status.c`, `apps/gui/skin_engine/skin_tokens.c`, `apps/gui/skin_engine/skin_parser.c`, `apps/gui/skin_engine/wps_internals.h`, and `lib/skin_parser/tag_table.c` at the recorded SHA.

This confirmed:

- `%mp` branch order for stop, play, pause, fast-forward, and fast-backward.
- Separate charger-connected `%bp`, charging `%bc`, and USB-inserted `%bu` truth values.
- RTC feature `%cc` and clock refresh tags.
- Tick-relative momentary volume `%mv`.
- `%Sr` as the current language's RTL state.
- Target-gated `%Tp` and tick-relative `%Tl`, including its default ten-second timeout.
- Tuner availability plus tuned/scan/stereo/signal/preset/RDS state.

The application expresses those facts through independent TypeScript state transitions and target profiles. It does not copy or execute the upstream implementation.

## Phase 6 component reference

Phase 6 re-inspected `lib/skin_parser/tag_table.c` for the current `%xl`, `%xd`, `%Vl`, `%Vd`, `%Vi`, album-art, touch, FM, state, and metadata parameter contracts. It inspected `apps/gui/skin_engine/skin_parser.c` to confirm that duplicate image labels are invalid and that image-display references must resolve an existing preload. `apps/gui/skin_engine/skin_render.c` and `apps/gui/skin_engine/wps_internals.h` confirmed tag-driven subimage selection and one-based values.

The component engine independently allocates unique labels and viewport names and writes its own authored 24-bit BMP. The external Phase 6 runner then passed all 53 available component/profile/screen fixtures to `checkwps.ipodvideo` or `checkwps.ipod6g` at this exact SHA. No upstream source, object, or executable is bundled. The touch definition is not run against an invented target: both current profiles report no touchscreen, and the checked report records that target gate explicitly.

## Phase 7 full simulator reference

Phase 7 inspected the complete native simulator boundary at the recorded SHA:

- `tools/configure` for target generation, SDL discovery, native host selection, current Darwin GCC 16 choice, and SDL-thread fallback.
- `uisimulator/common/filesystem-sim.c` and `firmware/target/hosted/sdl/system-sdl.c` for the mutable simulator root and process/event lifecycle.
- `firmware/target/hosted/sdl/thread-sdl.c` and `kernel-sdl.c` for SDL threads, mutexes, semaphores, ticks, and `setjmp`/`longjmp` exits.
- `firmware/target/hosted/sdl/button-sdl.c` and `window-sdl.c` for blocking input and SDL2 texture/window display.
- `firmware/target/hosted/sdl/pcm-sdl.c` for audio-device callbacks and PCM completion.
- `firmware/target/hosted/sdl/load_code-sdl.c`, `uisimulator/common/load_code-sim.c`, `apps/codecs.c`, and `apps/plugin.c` for runtime-loaded codec/plugin objects.
- `docs/COPYING` and the source headers for GPL version 2 or later.

An external iPod Video core was built and launch-smoked from this SHA. The prepared minimum runtime used by the Phase 4 harness loaded an authored SBS and produced two identical framebuffer hashes. A fresh stock simulator-disk installation launched and captured but rendered stock configuration in that harness, so it is retained as a documented limitation rather than being substituted for the canonical evidence.

The feasibility report also records current official Emscripten requirements for pthread isolation, asynchronous browser main loops, virtual/persistent filesystems, dynamic modules, `setjmp`/`longjmp`, and audio startup. No Rockbox source, object, binary, runtime asset, screenshot, or WebAssembly module is committed.

## Assets workspace bitmap reference

The post-phase Assets implementation re-inspected `apps/recorder/bmp.c`, `apps/gui/skin_engine/skin_parser.c`, `lib/skin_parser/tag_table.c`, `manual/appendix/wps_tags.tex`, and the iPod Video/Classic target LCD definitions at the recorded SHA.

This confirmed:

- Theme skin images use BMP files, while the target bitmap directory is derived from the skin path without its extension.
- `%xl` accepts an image handle and path with optional coordinates and an optional subimage count. With exactly three parameters, the third value is the subimage count; Adwaitapod uses this compact form.
- Subimages are equal-height frames in one vertical bitmap, and the loader divides the bitmap height by the declared count.
- The loader accepts uncompressed 1-, 4-, 8-, 16-, 24-, and 32-bit BMP data plus the supported 16-/32-bit bitfield layouts; unsupported compression and masks are rejected.
- Both current iPod profiles use a 320 × 240 RGB565 LCD and expose bitmap scaling/JPEG capabilities, but generated theme assets remain BMP because the skin-image contract requires it.

The editor implements these factual contracts independently in TypeScript. It does not copy or link the Rockbox loader, scaler, or skin parser, and external Level C remains authoritative for final pixels.

## Logic workspace conditional reference

The post-phase Logic implementation re-inspected `lib/skin_parser/tag_table.c`, `lib/skin_parser/tag_table.h`, `apps/gui/skin_engine/skin_tokens.c`, `apps/gui/skin_engine/skin_render.c`, and `manual/appendix/wps_tags.tex` at the recorded SHA.

This confirmed the current tag identities and truth/numeric values used by the existing independent interpreter, including `%mp` playback ordering, `%mm` repeat ordering, `%mh` hold, `%bc` charging, `%bp` charger presence, `%bu` USB insertion, `%mv` recent volume change, `%ps` shuffle, `%C` album-art presence, and `%Sr` RTL/LTR branch order. Human branch names are used only for the evidenced tags; every other branch keeps a neutral number.

The application does not copy the Rockbox evaluator. The CST remains authoritative, explicit browser support is narrower than official syntax, and external Level C remains authoritative for the full conditional engine and device state.

## Licensing note

Rockbox source files inspected here state that they are licensed under the GNU General Public License, version 2 or later, and `docs/COPYING` contains the project license text. No Rockbox parser implementation has been copied into Rockbox Designer. The generated factual registry is explicitly flagged for human licensing review. Vendoring, linking, translating, or distributing Rockbox implementation code requires an explicit project licensing decision before work continues.
