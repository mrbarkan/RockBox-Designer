# Assets Workspace

Assets is the source-safe package workshop for ordinary Rockbox theme files. It is separate from **Firmware Assets**, which changes compiled fallback firmware behavior.

## What it owns

- Exact imported, project-added, and component-owned archive paths and bytes.
- Rockbox BMP header inspection.
- Local PNG/JPEG-to-BMP conversion.
- Equal-size vertical `%xl` strip construction and frame preview.
- Exact WPS/SBS/FMS/CFG usage discovery for the supported path-bearing tags.
- Replacement, reference-aware rename, guarded deletion, and deterministic ZIP export.
- A license-clean generated starter shelf that inserts bytes only, never implicit source.

Preview object URLs, thumbnails, decoded images, search state, and frame selection are disposable UI state. They are not package authority.

## Safety rules

1. Replacement changes bytes at one exact path and leaves source untouched.
2. Rename updates only known references that resolve to that exact path.
3. Delete refuses a referenced asset and every component-owned asset.
4. Duplicate basenames never fall back to a global filename guess.
5. Unsupported or future syntax remains lossless and is never rewritten by a text search.
6. “No known references” still requires manual review when unsupported syntax may own a path.

## Bitmap contract

At pinned Rockbox commit `078a506dfd0deb18165a3ed80c7fcbdb3afb0d31`, the loader accepts the documented uncompressed and bitfield BMP layouts. Imported compatible BMP bytes remain unchanged. Web raster inputs are converted locally to deterministic 24-bit RGB BMP, or 32-bit alpha bitfields when alpha is present. Sprite frames must share dimensions and are stacked vertically.

The browser preview confirms structure and editing intent; the external pinned Rockbox simulator remains the Level C authority for final theme behavior and pixels.

## Adwaitapod acceptance

The private user-supplied ZIP is not committed. Local browser acceptance on 2026-07-17 verified:

- 104 canonical package assets and zero missing known references.
- WPS, SBS, FMS, and USB navigation at a 1280 × 720 app viewport with source rendering still enabled.
- `BatteryStatus.bmp` as a loader-compatible 14 × 192, 8-bit `BI_RGB` bitmap.
- Three exact `%xl` references—WPS, SBS, and FMS—using the compact 12-frame form.
- Frame-by-frame 14 × 16 preview.
- No browser console error during import, screen navigation, or asset inspection.
