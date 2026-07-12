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

Phase 0 verified that these paths exist and inspected the parser/tag-table headers. Phase 1D generated factual tag metadata from the first two paths without copying parser functions or comments.

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
git -C /tmp/rockbox-upstream-reference sparse-checkout set lib/skin_parser apps/gui/skin_engine apps/gui apps/radio tools utils/themeeditor uisimulator docs
git -C /tmp/rockbox-upstream-reference rev-parse HEAD
git -C /tmp/rockbox-upstream-reference show -s --format=%cI HEAD
```

Then verify the relevant paths, update the SHA and inspection date here, and update any generated compatibility metadata that cites the previous SHA.

## Generated tag registry

Phase 1D generated `rockbox/registry/generated/rockbox-tags.json` from `lib/skin_parser/tag_table.c` and `lib/skin_parser/tag_table.h` at this exact SHA. The checked-in output contains 193 non-sentinel tag definitions and is reproducible through `npm run registry:generate` and `npm run registry:verify`. See `docs/ROCKBOX_TAG_REGISTRY.md` for the workflow and licensing-review boundary.

## Future official parser harness

Phase 1F will use a separately checked-out Rockbox tree provided through `ROCKBOX_SOURCE_DIR`. Ordinary application tests must not require the checkout or network access, and Rockbox parser code must not be bundled into the browser by default.

## Licensing note

Rockbox source files inspected here state that they are licensed under the GNU General Public License, version 2 or later, and `docs/COPYING` contains the project license text. No Rockbox parser implementation has been copied into Rockbox Designer. The generated factual registry is explicitly flagged for human licensing review. Vendoring, linking, translating, or distributing Rockbox implementation code requires an explicit project licensing decision before work continues.
