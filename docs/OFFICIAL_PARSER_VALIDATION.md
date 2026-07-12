# Official Rockbox Parser Validation

## Architecture and licensing boundary

The optional validation bridge builds Rockbox's target-specific `tools/checkwps` utility from a separate checkout and runs it as an external process. Rockbox source, object files, and the `checkwps` binary remain under the operating system's temporary directory (or an explicitly configured external build directory). They are not copied into the repository or production browser bundle.

Rockbox and `checkwps` are GPL-2.0-or-later source. This workflow uses the upstream program for development-time comparison; it does not change the application's licensing decision or authorize redistribution of the utility.

## Setup

Prepare a separate checkout at the SHA in `docs/UPSTREAM_ROCKBOX.md`. A sparse checkout must include the parser, CheckWPS inputs, application sources, firmware headers, libraries, fonts, and tools:

```bash
git clone --filter=blob:none --sparse https://github.com/Rockbox/rockbox.git /path/to/rockbox
git -C /path/to/rockbox sparse-checkout set lib apps firmware fonts tools
git -C /path/to/rockbox checkout 078a506dfd0deb18165a3ed80c7fcbdb3afb0d31
```

Run the comparison:

```bash
ROCKBOX_SOURCE_DIR=/path/to/rockbox npm run test:official
```

The checkout SHA must exactly match the generated registry SHA. The default target is `ipodvideo`; set `ROCKBOX_OFFICIAL_TARGET` to another configured target. The build cache defaults to a SHA-and-target directory under the OS temporary folder and can be moved with `ROCKBOX_OFFICIAL_BUILD_DIR`.

When `ROCKBOX_SOURCE_DIR` is missing, the command fails with a setup message. Automation may skip only explicitly:

```bash
ROCKBOX_OFFICIAL_SKIP=1 npm run test:official
```

## Build method

The bridge invokes Rockbox's own `tools/configure --type=C` and the generated CheckWPS makefile. It does not patch upstream source. On current macOS, Rockbox's configure script selects `gcc-16`; when that executable is unavailable, the bridge adjusts only the generated out-of-tree makefile to use Apple Clang and disables the SDK's default fortify macro, which otherwise conflicts with Rockbox's `strlcpy` declarations. The compiled program still consists of unmodified upstream source.

An already built binary may be supplied through `ROCKBOX_CHECKWPS_BIN`. This is useful for CI images that prepare GPL tooling separately.

## Comparison model

Each fixture is parsed and serialized by the browser parser, then written to a temporary WPS/SBS/FMS file and passed to target-specific `checkwps`. The JSON report records source hashes, browser preservation, browser diagnostics, official exit code/output, target, upstream repository, and exact SHA.

Categories are:

- `accepted-by-both`
- `browser-preserved-official-rejected`
- `browser-diagnostic-differs`
- `browser-preservation-failure`
- `official-parser-unavailable`
- `target-dependent`

Compatibility differences are report data, not automatic failures. A browser preservation failure or inability to execute the official parser does fail the command.

## Demonstrated report

`reports/official-parser/latest.json` contains the Phase 1F `ipodvideo` demonstration at SHA `078a506dfd0deb18165a3ed80c7fcbdb3afb0d31`:

- 6 fixtures executed by both parsers.
- 3 accepted by both.
- 1 future unknown tag preserved by the browser and rejected by Rockbox.
- 1 malformed conditional with both diagnostic forms visible.
- 1 touch feature conditional recorded as target-dependent.
- 0 browser preservation failures.
- 0 official execution failures.

Ordinary `npm test` never builds or invokes Rockbox. `npm run validate` only verifies the checked-in report's schema, SHA, fixture hashes, preservation evidence, and external-binary declaration.
