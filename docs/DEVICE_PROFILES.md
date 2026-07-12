# Device Profiles

## Current verified profiles

Rockbox Designer currently ships two profiles derived from Rockbox at commit `078a506dfd0deb18165a3ed80c7fcbdb3afb0d31`:

| Profile | Rockbox target | Main LCD | FM/FMS | Recording | Touch | Remote LCD | USB HID | RTC | Album art |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Apple iPod Video 5G/5.5G | `ipodvideo` | 320×240×16, 160 DPI | Yes, through configured remote tuner | Yes | No | No | Yes | Yes | Yes |
| Apple iPod Classic 6G/7G port | `ipod6g` | 320×240×16, 160 DPI | No configured tuner | Yes | No | No | Yes | Yes | Yes |

Equal dimensions are not treated as equal capabilities. In particular, `HAVE_FMRADIO_IN` in the Classic configuration is not treated as a configured Rockbox tuner: `CONFIG_TUNER` is commented out there, so the profile does not expose FMS authoring.

## Sources

The values and target names are checked against:

```text
firmware/export/config/ipodvideo.h
firmware/export/config/ipod6g.h
tools/configure
```

Every profile records the exact Rockbox SHA and its source paths. Ordinary validation checks profile shape, uniqueness, source metadata, documented SHA, and internal capability consistency without network access.

With a local Rockbox checkout, verify the factual values directly:

```bash
ROCKBOX_SOURCE_DIR=/absolute/path/to/rockbox npm run device:verify
```

This checks LCD dimensions/depth/DPI and the relevant active preprocessor definitions for recording, tuner, touch, remote LCD, USB HID mouse, RTC, and album art, plus the target entries in `tools/configure`.

## Product behavior

- New projects use `apple-ipod-video-5g` as their profile ID.
- Saved `ipod_video`, `ipodvideo`, `ipod_6g`, and `ipod6g` targets migrate when project JSON or mock-cloud data is loaded.
- Unknown or missing saved target values fall back safely to the Video profile without deleting project content.
- Canvas size, alignment, legacy renderer defaults, layout generation, and imported-screen defaults read the selected profile dimensions.
- The settings panel exposes the two profiles.
- WPS/SBS/FMS tabs are driven by supported screen files; Classic therefore hides FMS.
- FM and touch presets are capability-gated. Neither current profile exposes touch authoring.
- Remote-screen capability and file support are separate gates; neither current profile claims a remote LCD.

Changing profile hides unsupported authoring surfaces but does not delete preserved source or assets.
