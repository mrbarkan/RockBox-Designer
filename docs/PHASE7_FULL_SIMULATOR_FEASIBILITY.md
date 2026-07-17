# Phase 7 Full Rockbox Simulator Feasibility

## Verdict

Phase 7 acceptance passes through the plan's documented-blocker path.

- A pinned iPod Video native simulator core builds outside this repository.
- The existing official harness loads an authored theme into a private simulator disk.
- Two clean framebuffer screenshots are reproducible.
- A full Level C browser simulator is feasible only as a separate GPL runtime product, not as a small extension of the current browser renderer.
- No Rockbox source, binary, runtime assets, screenshot, or WebAssembly module is committed or served.
- The editor remains independent and its browser bundle changes by zero bytes.

The checked report is `reports/phase7-simulator/latest.json`. Ordinary validation verifies it offline through `npm run phase7:simulator:report:verify`.

## Product levels

The Pulp UX levels remain literal:

| Level | Current state | Meaning |
| --- | --- | --- |
| A | Available | Deterministic browser state simulator using Rockbox Designer's independent source-linked renderer. |
| B | Available for development | External CheckWPS and native-simulator comparison at the pinned Rockbox SHA. |
| C | Not shipped | Actual Rockbox firmware UI runtime. Distribution and browser-port architecture remain undecided. |

Play continues to label itself Level A. Phase 7 does not silently replace it with an incomplete Level C port or make normal editing depend on native tooling.

## Native one-target prototype

Target: `ipodvideo`, 64 MiB, Rockbox `078a506dfd0deb18165a3ed80c7fcbdb3afb0d31`.

The external native recipe:

1. Runs Rockbox's target-generating configure step.
2. Keeps the simulator and all generated files outside this repository.
3. Uses the SDL thread backend selected by current Rockbox configure.
4. Applies a generated-Makefile-only Apple Clang override because current upstream configure selects unavailable GCC 16 on this host.
5. Builds `make bin`, not the codec/plugin bundle.
6. Installs the minimum theme runtime into the external simulator disk.
7. Launches the simulator with dummy video and audio drivers as a smoke test.

```bash
ROCKBOX_SOURCE_DIR=/absolute/path/to/pinned-rockbox \
ROCKBOX_PHASE7_BUILD_DIR=/absolute/external/empty/build-dir \
npm run phase7:native:build
```

This is development evidence, not a supported distributable Rockbox build. The measured canonical external binary is 1,581,480 bytes; its minimum prepared simulator disk is 2,058,415 bytes across 129 files. Those figures exclude browser glue, codecs, plugins, media, persistence, and target switching.

The current macOS source path deserves two separate notes:

- Rockbox configure intentionally selects GCC 16 and the SDL thread fallback on recent macOS.
- The simulator core builds with the recorded generated-Makefile override. A default full build reaches standalone codec sources that use GCC-only nested functions, so Apple Clang is not a substitute for the complete codec/plugin installation.

## Generated-theme and screenshot evidence

Phase 4 already owns the canonical official capture contract. It:

1. Copies a prepared minimum simulator disk to a private temporary directory.
2. Installs an authored SBS plus deterministic settings.
3. Launches the external iPod Video simulator with dummy SDL drivers.
4. Calls Rockbox's own framebuffer dump path.
5. Repeats the capture from a clean disk.

Both official frames normalize to SHA-256 `a1021a11e254131c128b5aece6aba38126d52421c634e3b05f9db1383e400a79`. No screenshot is committed.

A newly installed stock simulator disk was also exercised during Phase 7. It launched and captured successfully but used stock configuration in this harness instead of the authored SBS. That result is deliberately not substituted for the prepared minimum-runtime evidence.

## Why display and input are not a self-contained port

The current UI simulator is a native Rockbox process with these connected boundaries:

```text
target-generated firmware UI
  -> Rockbox task scheduler
  -> SDL threads, mutexes, semaphores, timing
  -> blocking SDL event loop
  -> SDL texture/window framebuffer
  -> synchronous mutable simulator disk
  -> runtime-loaded codecs and plugins
  -> SDL audio callback
```

Porting only the last display call would not create a running target. Input wakes scheduled tasks; those tasks read settings/assets from the simulator disk, update the framebuffer on Rockbox timing, and may invoke dynamically loaded code or audio callbacks.

## Browser-port blockers

### Licensing and distribution

The inspected simulator and firmware source headers are GPL-2.0-or-later and `docs/COPYING` contains GPL version 2. A served WebAssembly runtime would need an approved source-delivery, notices, modification, hosting, versioning, and update policy. ADR-0017 keeps that decision explicit.

### Target build generation

`tools/configure` generates target headers and chooses native host flags. It currently recognizes named desktop systems, not an Emscripten host. The Darwin branch also selects native `dlopen`, Mach-O shared-library settings, SDL discovery, and GCC 16. A production port needs a maintained Emscripten build path, not a patch to generated files.

### Threads and the browser event loop

`thread-sdl.c` creates SDL threads and coordinates them through a global mutex and per-thread semaphores. Thread exits use `setjmp`/`longjmp`. `button-sdl.c` blocks in `SDL_WaitEvent`.

Emscripten pthread builds use `SharedArrayBuffer` and require cross-origin isolation headers. A single build cannot transparently fall back to non-threaded operation. Browser work must also yield to the browser's cooperative event loop; Emscripten recommends an asynchronous main-loop callback or Asyncify, each with architectural and performance consequences.

### Dynamic codecs and plugins

The simulator resolves codec and plugin objects at runtime through `SDL_LoadObject` and `SDL_LoadFunction`. Emscripten can model main and side modules, but this affects dead-code elimination, filesystem packaging, startup, and synchronization. Emscripten documents runtime dynamic linking combined with pthreads as experimental.

### Filesystem and persistence

Rockbox expects a synchronous, mutable disk rooted at `sim_root_dir`. A useful browser runtime needs themes, fonts, settings, databases, media, screenshots, codecs, and plugins.

Emscripten's in-memory filesystem is temporary. Persistent IDBFS synchronization is asynchronous. A product design must define preload contents, import/export, quotas, reset behavior, editor-to-runtime mounting, and when persistent writes become durable.

### Audio and timing

SDL audio callbacks drive PCM completion while scheduler timing reads SDL ticks. Browsers require event-loop yielding and normally require a user gesture before audio starts. Background-tab throttling and deterministic theme-only operation also need explicit behavior.

### Bundle, performance, and maintenance

The measured native core is not the product bundle. Level C also needs runtime assets, codecs/plugins or replacements, JavaScript glue, workers, persistent storage, source delivery, target metadata, and a pinned upstream refresh process. Load-time, memory, browser-support, and update budgets must be approved and measured before integration.

## Prototype-stage result

| Stage | Result |
| --- | --- |
| 1. Reproducible native target | Passed for an external development-only iPod Video core. |
| 2. Automated generated-theme load | Passed through the prepared Phase 4 simulator disk. |
| 3. Screenshot capture | Passed with two reproducible clean framebuffer dumps. |
| 4. Display/input WebAssembly port | Not started; blocked by the licensing and runtime architecture decision. |
| 5. One browser target | Blocked by stage 4. |
| 6. Target switching | Deferred until one browser target is stable. |

## Evidence generation

Regenerate the feasibility report after building or providing a matching external simulator:

```bash
ROCKBOX_SOURCE_DIR=/absolute/path/to/pinned-rockbox \
ROCKBOX_SIMULATOR_BUILD_DIR=/absolute/path/to/ipodvideo-simulator \
npm run test:phase7-feasibility
```

The generator refuses an upstream SHA or simulator target mismatch. It inspects the pinned source paths, records only derived counts/hashes, and never writes local absolute paths into the report.

## External technical references

- [Emscripten pthreads support](https://emscripten.org/docs/porting/pthreads.html)
- [Emscripten runtime environment and browser main loop](https://emscripten.org/docs/porting/emscripten-runtime-environment.html)
- [Emscripten File System API](https://emscripten.org/docs/api_reference/Filesystem-API.html)
- [Emscripten dynamic linking](https://emscripten.org/docs/compiling/Dynamic-Linking.html)
- [Emscripten setjmp/longjmp support](https://emscripten.org/docs/porting/setjmp-longjmp.html)
- [Emscripten audio guidance](https://emscripten.org/docs/porting/Audio.html)

## Level C decision outcome

On 2026-07-16 the owner chose the external Level C path. Rockbox Designer will not distribute or maintain a browser WebAssembly runtime under the current architecture. The actual Rockbox UI simulator at a pinned target and SHA is the authoritative firmware UI/theme reference.

Levels A and B remain the browser product and official-validation paths, and the editor continues to work independently. External simulator evidence does not prove device-only hardware behavior.
