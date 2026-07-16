# Phase 4 Official Validation and Render Comparison

Phase 4 measures the browser's documented support against Rockbox at the pinned upstream commit without copying Rockbox code or binaries into this repository.

## Architecture decision

ADR-0014 records the WebAssembly feasibility assessment. The official parser and renderer remain external development oracles:

- `tools/checkwps` provides target-specific parser acceptance.
- The Rockbox UI simulator provides the official 320×240 framebuffer.
- The browser keeps its independent lossless parser, semantic interpreter, and renderer.
- No official source, object, executable, WebAssembly module, screenshot, or third-party theme is committed.

The assessment covers the required license, build-system, memory-model, filesystem, browser-bundle, and upstream-update boundaries. An official WebAssembly port is deliberately not started because it would require a separate GPL distribution and delivery decision.

## Canonical pixel reference

The authored Phase 4 fixture is a minimal iPod Video SBS that defines the full screen and one named firmware UI viewport. The harness:

1. Requires a Rockbox checkout at `078a506dfd0deb18165a3ed80c7fcbdb3afb0d31`.
2. Copies a simulator disk into a private temporary directory.
3. Installs the authored SBS and deterministic settings.
4. Starts the unmodified `ipodvideo` simulator with dummy SDL audio and video.
5. Calls the simulator's existing `sim_trigger_screendump()` path.
6. Decodes Rockbox's framebuffer BMP and normalizes it to RGB.
7. Repeats the clean simulator capture and requires identical pixel hashes.
8. Renders the same source/state through the deterministic browser pixel renderer.
9. Generates local browser, official, and diff images.
10. Classifies every differing pixel before writing the checked-in report.

Latest evidence:

- Geometry: 320×240, 76,800 pixels.
- Clean official captures: 2.
- Official captures reproducible: yes.
- Differing pixels: 6,315 (8.22%).
- Classified pixels: 6,315.
- Unclassified pixels: 0.
- Non-zero classes: native font/text layout and selector approximation.
- Background outside the named UI viewport: pixel-identical.

Generated images remain under the ignored `reports/phase4-render/artifacts/` directory. The checked-in report stores their SHA-256 hashes, dimensions, metrics, and classifications.

Regenerate the comparison:

```bash
ROCKBOX_SOURCE_DIR=/absolute/path/to/rockbox \
ROCKBOX_SIMULATOR_BUILD_DIR=/absolute/path/to/ipodvideo-simulator \
npm run test:phase4-render
```

## Compatibility Lab

`reports/phase4-compatibility/latest.json` contains one evidence row for every combination of:

- 193 generated official tag identities.
- Apple iPod Video 5G/5.5G.
- Apple iPod Classic 6G/7G port.

Each row keeps these claims separate:

- Preserved
- Parsed
- Interpreted
- Rendered
- Editable
- Officially validated
- Known visual difference

It also records whether the tag's feature family is available on the selected target. Radio tags remain preserved and parsed for iPod Classic while the target is clearly marked as having no FM screen; touch-only tags are likewise marked unavailable on both non-touch iPod profiles.

The report uses target-specific CheckWPS runs for both devices plus the iPod Video simulator comparison. The Compatibility Lab is an advanced evidence view in the existing application; it is not the later Pulp-inspired studio-shell migration.

The evidence view is code-split. The measured main production chunk grows by 1.94 KB minified / 0.73 KB gzip over the Phase 3 baseline; its detailed report/view is an on-demand 129.33 KB / 8.88 KB gzip chunk. No Rockbox code is present in either chunk.

Regenerate the dashboard:

```bash
ROCKBOX_SOURCE_DIR=/absolute/path/to/rockbox \
npm run test:phase4-compatibility
```

Verify the checked-in reports without external Rockbox tools:

```bash
npm run phase4:render:report:verify
npm run phase4:compatibility:report:verify
```

## Claim boundary

Phase 4 proves a repeatable official comparison process and identifies exact gaps for the authored fixture. It does not claim full Rockbox pixel parity. Native Rockbox font glyph rasterization and firmware-owned list layout remain distinct from the browser projection, and untested tags remain visibly separated from officially evidenced tags.
