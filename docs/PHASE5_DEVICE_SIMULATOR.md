# Phase 5 Device-State Simulator

Phase 5 adds a deterministic Level A browser simulator without claiming to port the complete Rockbox firmware.

## Product flow

- Play is available from the editor header, the compact state strip, and `Cmd/Ctrl+P`.
- The editor keeps a small scenario strip instead of duplicating the full control surface.
- Play renders the current authoritative WPS/SBS/FMS document through the existing semantic engine.
- `DeviceShell` supplies hardware presentation and input mapping around the screen renderer. It does not generate theme pixels.
- A named scenario can be shared with `?play=<scenario-id>`. Opening that link resets to the same canonical state and opens Play.

The UI labels this as **Level A — Browser state simulator**. Level B remains official skin-engine validation, and Level C remains a future full Rockbox simulator.

## Deterministic state

`rockbox/simulator/` owns:

- canonical scenario definitions
- pure playback, seek, track, shell-input, touch, and time transitions
- target-capability enforcement
- scenario link parsing and generation

`SimulationState.timelineMs` is the only runtime clock. Playback progress, five-times seek motion, RTC seconds, timed sublines, scrolling, momentary volume state, and recent-touch state derive from it. Named presets never call the system clock.

Available named scenarios:

- Normal playback
- Paused with low battery
- Stopped
- Seeking forward
- Track change
- Charging over USB
- USB connected
- Volume overlay
- Missing album art
- Long scrolling title
- FM preset
- Weak FM signal
- Hold active
- Right-to-left language
- Touch input
- Remote display

Manual control changes mark the session as **Custom state**. Named scenario links are shareable; arbitrary custom state is not silently encoded into a potentially huge URL.

## Capability restrictions

Scenarios consult the selected `DeviceProfile` before application:

- iPod Classic cannot enter FM/FMS scenarios.
- Neither current iPod profile exposes touchscreen input.
- Neither current iPod profile exposes a remote LCD or remote screen files.
- Album art and RTC controls honor their capability fields.
- Unsupported source remains preserved even when its simulation is unavailable.

FM, touch, and remote options remain visible but disabled or explicitly explained. The simulator never infers capabilities from equal LCD dimensions.

## Source verification

Behavior was checked against Rockbox commit `078a506dfd0deb18165a3ed80c7fcbdb3afb0d31`:

- `apps/status.h` and `apps/status.c` define playback, pause, fast-forward, and fast-backward ordering.
- `apps/gui/skin_engine/skin_tokens.c` supplies playback, charger, charging, USB, RTC, volume-change, recent-touch, RTL-language, tuner, and RDS behavior.
- `apps/gui/skin_engine/skin_parser.c` defines `%Tl`'s default ten-second timeout and tenth-second parsing unit.
- `lib/skin_parser/tag_table.c` supplies the current tag identities and feature gates.
- Device capability data remains sourced through the paths listed in `docs/DEVICE_PROFILES.md`.

No Rockbox implementation code is copied or bundled.

## Acceptance evidence

- Two independent creations of every preset are structurally equal.
- Scenario query links round-trip every preset ID and reject unknown IDs.
- Pure transitions cover play, pause, stop, seek, next/previous track, elapsed time, RTC, shell input, and momentary state.
- Source-linked tests prove scenario changes select real `%mp`, `%bc`, `%bp`, `%bu`, `%mh`, `%C`, `%Sr`, `%cc`, `%tp`, `%Tp`, `%Tl`, and `%mv` branches.
- Capability tests prevent Classic FM and current-profile touch/remote simulation.
- Server-rendered Play tests verify Level A labeling, progressive capability explanations, and the complete control surface.
- The Phase 4 compatibility report now records 101 interpreted/rendered tags while keeping preservation, parsing, editing, official validation, and target availability separate.

Run the focused suite with:

```bash
npm run test:phase5
```

## Explicit limits

- This is not a firmware port and does not simulate Rockbox audio, storage, menus, or USB protocol internals.
- Click-wheel inputs change only the documented browser state.
- Touch input records target coordinates and recent-touch state only on a verified touchscreen profile.
- Remote rendering remains unavailable until a verified target profile and remote source-document model exist.
- RTL text direction is a useful browser preview; native Rockbox font and bidi pixel parity remain unclaimed.
