# Phase 8 — Firmware Mode

## Result

Phase 8 adds an explicit, opt-in Firmware Mode for behavior that Rockbox compiles into the firmware. The first verified output customizes the built-in USB screen for the Apple iPod Video 5G/5.5G target.

The browser does not compile or distribute firmware. It exports a deterministic source package containing:

- a patch for `apps/gui/usb_screen.c`;
- a generated GPL-2.0-or-later layout header;
- a user-supplied `apps/bitmaps/native/usblogo.176x48x16.bmp` overlay;
- exact-SHA verification and isolated build scripts;
- a manifest, recovery guidance, and licensing notice.

Every Firmware Mode surface says **Requires custom firmware**. Theme ZIP export remains a separate workflow.

## Verified target contract

| Field | Value |
| --- | --- |
| Device | Apple iPod Video 5G/5.5G |
| Rockbox target | `ipodvideo` |
| Upstream SHA | `078a506dfd0deb18165a3ed80c7fcbdb3afb0d31` |
| Modified source | `apps/gui/usb_screen.c` |
| Generated source overlay | `apps/gui/rockbox_designer_usb.h` |
| Target asset | `apps/bitmaps/native/usblogo.176x48x16.bmp` |
| Asset contract | 176 × 48, Windows BMP, 24-bit RGB, uncompressed |
| Layout choices | left, center, right |

The package refuses a Rockbox checkout at any other SHA. It creates a detached Git worktree, applies the patch and overlay there, builds outside the supplied checkout, and copies only `rockbox.ipod` and `rockbox.zip` to its external output directory.

## Safety boundary

Firmware Mode requires two non-persistent confirmations before export:

1. the user understands that the output is not an ordinary Rockbox theme;
2. the user has a backup, disk-mode recovery instructions, and a known-good build for the exact player.

The package contains no Rockbox source tree, compiled Rockbox binary, Apple firmware, or proprietary firmware component. The patch and generated C header are GPL-2.0-or-later. A user distributing the resulting modified Rockbox binary is responsible for the applicable GPL corresponding-source and notice obligations. The uploaded bitmap remains the asset creator's responsibility.

iPod Classic stays visibly unavailable until a target-specific patch and real target build are separately verified. Identical LCD dimensions are not treated as proof of firmware compatibility.

## Acceptance evidence

`reports/phase8-firmware/latest.json` records the checked evidence without committing build outputs or local paths:

- the generated patch passed `git apply --check` at the pinned SHA;
- a complete iPod Video normal build produced `rockbox.ipod` and `rockbox.zip` twice from clean external worktrees;
- both 1,160,624-byte firmware images have SHA-256 `5c7bb4cc8cd5604310b227d27f693ab17e2b4110f9cbd4221f9d66a24c2c879c`;
- the two install ZIPs differ because their archive metadata is generated during each build; the installable firmware image itself is byte-identical;
- no generated package, Rockbox source, object, binary, toolchain, or proprietary component is committed.

The local acceptance run used Arm's isolated `arm-none-eabi-gcc` 9.3.1 distribution. Rockbox warns that its recommended compiler for this revision is `arm-elf-eabi-gcc` 9.5.0; the exported build instructions prefer that recommended toolchain and require an explicit override for alternatives. The non-recommended compiler caveat is intentionally retained in the report.

Regenerate the external evidence with:

```bash
ROCKBOX_SOURCE_DIR=/absolute/path/to/rockbox \
ROCKBOX_COMPILER_PREFIX=/absolute/path/to/toolchain/bin/arm-elf-eabi- \
npm run test:phase8-firmware
```

Ordinary offline validation verifies the checked report with:

```bash
npm run phase8:firmware:report:verify
```

## Level C decision

The owner chose to keep Level C external. For the pinned iPod target and Rockbox revision, the actual Rockbox UI simulator is the behavioral authority for firmware UI and theme behavior. Level A remains an approximate independent browser preview, and Level B remains external official parser/render validation.

This does not claim device-only hardware parity. USB electrical behavior, storage recovery, bootloader behavior, and other hardware-specific effects must be tested on the actual device. No browser WebAssembly simulator is planned under the current decision.
