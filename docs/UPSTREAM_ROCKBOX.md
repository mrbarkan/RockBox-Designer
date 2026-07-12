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
apps/gui/skin_engine/skin_parser.c
apps/gui/statusbar-skinned.c
apps/radio/radio_skin.c
apps/gui/usb_screen.c
apps/gui/quickscreen.c
tools/convttf.c
uisimulator/
utils/themeeditor/
docs/COPYING
```

Phase 0 verified that these paths exist and inspected the parser/tag-table headers. It did not generate a tag registry or copy implementation code.

## Updating the reference

Use a separate local checkout so GPL source is not accidentally added to this application:

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/Rockbox/rockbox.git /tmp/rockbox-upstream-reference
git -C /tmp/rockbox-upstream-reference sparse-checkout set lib/skin_parser apps/gui/skin_engine apps/gui apps/radio tools utils/themeeditor uisimulator docs
git -C /tmp/rockbox-upstream-reference rev-parse HEAD
git -C /tmp/rockbox-upstream-reference show -s --format=%cI HEAD
```

Then verify the relevant paths, update the SHA and inspection date here, and update any generated compatibility metadata that cites the previous SHA.

## Future tag-registry generation

Phase 1D will generate factual tag metadata from `lib/skin_parser/tag_table.c` and related declarations. Generated output must preserve attribution, cite this exact upstream SHA, remain reproducible, and receive human licensing review before distribution assumptions are made.

## Future official parser harness

Phase 1F will use a separately checked-out Rockbox tree provided through `ROCKBOX_SOURCE_DIR`. Ordinary application tests must not require the checkout or network access, and Rockbox parser code must not be bundled into the browser by default.

## Licensing note

Rockbox source files inspected here state that they are licensed under the GNU General Public License, version 2 or later, and `docs/COPYING` contains the project license text. No Rockbox source code has been copied into Rockbox Designer during Phase 0. Vendoring, linking, translating, or distributing Rockbox implementation code requires an explicit project licensing decision before work continues.
