# Theme Compatibility Corpus

Phase 1G tests preservation, package fidelity, browser diagnostics, support boundaries, and optional official-parser results across authored and real local themes. It does not turn a preservation result into a claim of visual compatibility.

## Fixture classes

- `tests/public-themes/` contains deterministic fixtures authored for this repository and released under CC0-1.0. Their provenance sidecars are committed.
- `tests/private-themes/` is ignored except for its README. The preparation helper can build AMusicPod and Adwaitapod ZIPs from a user-owned firmware tree without copying those third-party themes into Git.
- `ROCKBOX_THEME_DIRS` may provide additional local ZIP directories. Each ZIP can have a sibling `.provenance.json` file.

Every report records the fixture class, target, source files, exact source round trip, diagnostics, unknown tags, missing assets, basename collisions, manifest and asset-hash fidelity, semantic/render/edit support boundaries, and optional CheckWPS status.

## Commands

Public, self-contained corpus:

```bash
npm run test:themes
```

Prepare the two private real-theme fixtures:

```bash
npm run themes:prepare-private -- --firmware-dir=/absolute/path/to/rockbox-firmware
```

Include the upstream parser comparison:

```bash
ROCKBOX_THEMES_OFFICIAL=1 \
ROCKBOX_SOURCE_DIR=/absolute/path/to/rockbox \
npm run test:themes
```

The human report is `reports/themes/latest.md`; the complete machine-readable evidence is `reports/themes/latest.json`.

## Phase 1G evidence

- Authored Basic and Authored Full round-trip exactly and preserve their complete manifests.
- Local AMusicPod and Adwaitapod fixtures round-trip WPS/SBS/CFG source exactly and retain every package hash.
- Both real themes produce zero browser syntax or missing-asset diagnostics after resolving Rockbox's screen-named asset-directory convention.
- Adwaitapod is accepted by CheckWPS for `ipodvideo`.
- AMusicPod is preserved exactly but its original WPS is rejected by the pinned CheckWPS at line 119 because `%V(a,10,193,305,24,9)` supplies a label to a viewport form that does not accept one. The runner records this source-theme result without rewriting it.
- Authored Basic deliberately includes a future unknown tag, so browser preservation and official rejection are both expected.

These results establish a safe Phase 1 preservation/package foundation. They do not establish full semantic, rendered, or editable coverage; those are Phase 2 work.
