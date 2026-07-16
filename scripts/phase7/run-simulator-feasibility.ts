import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { dirname, resolve } from 'node:path';

const sourceDir = process.env.ROCKBOX_SOURCE_DIR;
const simulatorDir = process.env.ROCKBOX_SIMULATOR_BUILD_DIR;
if (!sourceDir || !simulatorDir) {
  throw new Error('ROCKBOX_SOURCE_DIR and ROCKBOX_SIMULATOR_BUILD_DIR are required for Phase 7 feasibility evidence.');
}

const repositoryRoot = resolve('.');
const registry = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'rockbox/registry/generated/rockbox-tags.json'), 'utf8')
);
const commit = execFileSync('git', ['-C', resolve(sourceDir), 'rev-parse', 'HEAD'], {
  encoding: 'utf8'
}).trim();
if (commit !== registry.upstream.commit) {
  throw new Error(`Rockbox checkout SHA ${commit} does not match ${registry.upstream.commit}.`);
}

const readSource = (path: string) => {
  const absolute = resolve(sourceDir, path);
  if (!existsSync(absolute)) throw new Error(`Pinned Rockbox checkout is missing ${path}.`);
  return readFileSync(absolute, 'utf8');
};
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const matchCount = (text: string, pattern: RegExp) => [...text.matchAll(pattern)].length;
const commandAvailable = (command: string) => {
  try {
    execFileSync('which', [command], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const directoryMetrics = (root: string) => {
  let bytes = 0;
  let files = 0;
  const visit = (path: string) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = resolve(path, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile()) {
        bytes += statSync(child).size;
        files += 1;
      }
    }
  };
  visit(root);
  return { bytes, files };
};
const parseInfo = (text: string) => Object.fromEntries(
  text.split(/\r?\n/)
    .map(line => line.match(/^([^:]+):\s*(.*)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map(match => [match[1].trim(), match[2].trim()])
);

const sourcePaths = {
  configure: 'tools/configure',
  system: 'firmware/target/hosted/sdl/system-sdl.c',
  threads: 'firmware/target/hosted/sdl/thread-sdl.c',
  input: 'firmware/target/hosted/sdl/button-sdl.c',
  display: 'firmware/target/hosted/sdl/window-sdl.c',
  audio: 'firmware/target/hosted/sdl/pcm-sdl.c',
  filesystem: 'uisimulator/common/filesystem-sim.c',
  dynamicLoader: 'firmware/target/hosted/sdl/load_code-sdl.c',
  codecLoader: 'apps/codecs.c',
  pluginLoader: 'apps/plugin.c',
  license: 'docs/COPYING'
} as const;
const source = Object.fromEntries(
  Object.entries(sourcePaths).map(([key, path]) => [key, readSource(path)])
) as Record<keyof typeof sourcePaths, string>;

const requiredEvidence = [
  ['configure host switch', source.configure, /case \$uname in/],
  ['Darwin GCC selection', source.configure, /CC=gcc-16/],
  ['SDL thread fallback', source.configure, /HAVE_SDL_THREADS/],
  ['blocking SDL input loop', source.input, /SDL_WaitEvent/],
  ['SDL texture display', source.display, /SDL_CreateTexture/],
  ['SDL thread creation', source.threads, /SDL_CreateThread/],
  ['thread jump buffers', source.threads, /setjmp|longjmp/],
  ['SDL audio device', source.audio, /SDL_OpenAudio/],
  ['simulator root filesystem', source.filesystem, /sim_root_dir/],
  ['SDL dynamic object loading', source.dynamicLoader, /SDL_LoadObject/],
  ['codec dynamic loading', source.codecLoader, /lc_open/],
  ['plugin dynamic loading', source.pluginLoader, /lc_open/],
  ['simulator source GPL version 2 or later', source.system, /either version 2[\s\S]*any later version/],
  ['GPL version 2 or later', source.license, /GNU GENERAL PUBLIC LICENSE[\s\S]*Version 2/]
] as const;
for (const [label, text, pattern] of requiredEvidence) {
  if (!pattern.test(text)) throw new Error(`Upstream feasibility evidence changed: ${label}.`);
}

const binary = resolve(simulatorDir, 'rockboxui');
const simdisk = resolve(simulatorDir, 'simdisk');
const infoPath = existsSync(resolve(simulatorDir, 'rockbox-info.txt'))
  ? resolve(simulatorDir, 'rockbox-info.txt')
  : resolve(simdisk, '.rockbox/rockbox-info.txt');
if (!existsSync(binary) || !existsSync(resolve(simdisk, '.rockbox')) || !existsSync(infoPath)) {
  throw new Error('The simulator build is missing rockboxui, simdisk/.rockbox, or rockbox-info.txt.');
}
const binaryBytes = new Uint8Array(readFileSync(binary));
const simulatorInfo = parseInfo(readFileSync(infoPath, 'utf8'));
if (simulatorInfo.Target !== 'ipodvideo' || !simulatorInfo.Version?.startsWith(commit.slice(0, 10))) {
  throw new Error('The provided simulator is not the pinned iPod Video target.');
}

const phase4 = JSON.parse(readFileSync(resolve(repositoryRoot, 'reports/phase4-render/latest.json'), 'utf8'));
if (
  phase4.upstream?.commit !== commit ||
  phase4.harness?.target !== 'ipodvideo' ||
  phase4.captures?.reproducible !== true ||
  phase4.harness?.cleanCapturePasses < 2
) {
  throw new Error('Phase 4 does not provide matching reproducible simulator screenshot evidence.');
}

const simdiskMetrics = directoryMetrics(simdisk);
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  upstream: {
    repository: registry.upstream.repository,
    commit,
    target: 'ipodvideo',
    sourceBundled: false,
    binaryBundled: false,
    simulatorAssetsBundled: false
  },
  nativePrototype: {
    status: 'passed-external-development-only',
    target: simulatorInfo.Target,
    version: simulatorInfo.Version,
    memoryMiB: Number(simulatorInfo.Memory),
    binary: {
      bytes: binaryBytes.byteLength,
      sha256: sha256(binaryBytes)
    },
    minimalSimulatorDisk: simdiskMetrics,
    buildRecipe: 'scripts/phase7/build-native-ipodvideo.ts',
    themeLoadHarness: 'scripts/phase4/run-official-render-comparison.ts',
    coreBuildIncludesCodecsAndPlugins: false,
    upstreamSupportedMacToolchainUsed: false,
    notes: [
      'The simulator core and minimum theme runtime build outside this repository.',
      'The current macOS configure path selects GCC 16; the feasibility recipe uses a generated-Makefile Apple Clang override and excludes codec/plugin shared objects.',
      'Rockbox selects its SDL thread fallback on this host. A newly installed stock simulator disk rendered stock configuration in the Phase 4 harness, while the prepared minimum runtime used by the checked evidence loaded the authored theme.'
    ]
  },
  officialCaptureEvidence: {
    report: 'reports/phase4-render/latest.json',
    target: phase4.harness.target,
    generatedThemeFixture: phase4.fixture.id,
    cleanCapturePasses: phase4.harness.cleanCapturePasses,
    reproducible: phase4.captures.reproducible,
    officialPixelSha256: phase4.captures.official.sha256,
    sourceSha256: phase4.fixture.sourceSha256,
    screenshotPathCommitted: false
  },
  toolAvailability: {
    emcc: commandAvailable('emcc'),
    emconfigure: commandAvailable('emconfigure'),
    emmake: commandAvailable('emmake'),
    wasmLd: commandAvailable('wasm-ld'),
    sdl2Config: commandAvailable('sdl2-config')
  },
  upstreamArchitecture: {
    sourcePaths,
    evidenceCounts: {
      sdlThreadCreates: matchCount(source.threads, /SDL_CreateThread/g),
      threadJumpOperations: matchCount(source.threads, /\b(?:setjmp|longjmp)\b/g),
      blockingEventWaits: matchCount(source.input, /SDL_WaitEvent/g),
      displayTextureOperations: matchCount(source.display, /SDL_(?:CreateTexture|UpdateTexture|RenderPresent)/g),
      sdlAudioOpenCalls: matchCount(source.audio, /SDL_OpenAudio(?:Device)?/g),
      simulatorRootReferences: matchCount(source.filesystem, /sim_root_dir/g),
      dynamicObjectOperations: matchCount(source.dynamicLoader, /SDL_(?:LoadObject|LoadFunction|UnloadObject)/g)
    }
  },
  prototypeStages: [
    {
      stage: 1,
      name: 'Build one native simulator target reproducibly',
      status: 'passed-external-development-only',
      evidence: 'Pinned iPod Video simulator core, minimum runtime, binary hash, and documented external recipe.'
    },
    {
      stage: 2,
      name: 'Automate loading a generated theme',
      status: 'passed',
      evidence: 'Phase 4 installs an authored SBS and deterministic settings into a private simulator disk.'
    },
    {
      stage: 3,
      name: 'Capture screenshots',
      status: 'passed',
      evidence: 'Two clean firmware framebuffer captures have the same normalized pixel hash.'
    },
    {
      stage: 4,
      name: 'Port the display and input loop to WebAssembly',
      status: 'blocked-by-decision',
      evidence: 'No GPL WebAssembly derivative was started before resolving distribution, runtime, and maintenance architecture.'
    },
    {
      stage: 5,
      name: 'Run a single target in browser',
      status: 'blocked-by-stage-4',
      evidence: 'A browser target cannot be claimed until the display/input port is implemented and validated.'
    },
    {
      stage: 6,
      name: 'Add target switching',
      status: 'deferred',
      evidence: 'The plan forbids target switching before one browser target is stable.'
    }
  ],
  browserPortConstraints: [
    {
      id: 'license-distribution',
      status: 'blocking-decision',
      finding: 'The simulator, firmware UI, codecs, and plugins are GPL-2.0-or-later source. Serving a modified WebAssembly build needs an explicit source, notices, delivery, and update policy.',
      sourceEvidence: [sourcePaths.license, sourcePaths.system, sourcePaths.threads],
      resolution: 'Approve a GPL-compatible distribution and source-delivery architecture before compiling browser artifacts.'
    },
    {
      id: 'target-build-generation',
      status: 'blocking-engineering',
      finding: 'Configure generates target headers and only handles named native host systems. Its Darwin path selects GCC 16, native SDL flags, dlopen, and Mach-O shared-library settings.',
      sourceEvidence: [sourcePaths.configure],
      resolution: 'Add and maintain an upstreamable Emscripten host/toolchain path rather than patching generated outputs for production.'
    },
    {
      id: 'threads-and-main-loop',
      status: 'blocking-engineering',
      finding: 'The simulator maps Rockbox tasks to SDL threads, mutexes and semaphores, uses setjmp/longjmp for exits, and blocks in SDL_WaitEvent. Browser code must yield to the event loop.',
      sourceEvidence: [sourcePaths.system, sourcePaths.threads, sourcePaths.input],
      resolution: 'Choose pthreads with cross-origin isolation or redesign the scheduler/event loop, then measure responsiveness and shutdown behavior.'
    },
    {
      id: 'dynamic-code',
      status: 'blocking-engineering',
      finding: 'Playback codecs and plugins are separate objects loaded at runtime through SDL_LoadObject/SDL_LoadFunction.',
      sourceEvidence: [sourcePaths.dynamicLoader, sourcePaths.codecLoader, sourcePaths.pluginLoader],
      resolution: 'Choose and validate static linking or Emscripten main/side modules; dynamic linking plus pthreads remains a high-risk combination.'
    },
    {
      id: 'filesystem-and-persistence',
      status: 'design-required',
      finding: 'Rockbox expects a synchronous mutable simulator disk rooted at sim_root_dir, including themes, fonts, settings, databases, media, screenshots, codecs, and plugins.',
      sourceEvidence: [sourcePaths.system, sourcePaths.filesystem],
      resolution: 'Define preloaded MEMFS assets, IDBFS synchronization, imports, quotas, reset semantics, and exact editor-to-simulator mounting.'
    },
    {
      id: 'audio-and-timing',
      status: 'design-required',
      finding: 'SDL audio callbacks participate in PCM completion while Rockbox timing reads SDL ticks across scheduled tasks.',
      sourceEvidence: [sourcePaths.audio, sourcePaths.threads],
      resolution: 'Prototype user-gesture audio startup, callback scheduling, background throttling, and deterministic non-audio theme mode.'
    },
    {
      id: 'bundle-performance-maintenance',
      status: 'measurement-required',
      finding: 'The measured native core excludes codec/plugin objects; a useful Level C bundle also needs target runtime assets, browser glue, persistence, and an upstream refresh process.',
      sourceEvidence: [sourcePaths.configure, sourcePaths.codecLoader, sourcePaths.pluginLoader],
      resolution: 'Set load-time, memory, bundle, browser-support, and upstream-update budgets before product integration.'
    }
  ],
  externalReferences: [
    {
      title: 'Emscripten pthreads support',
      url: 'https://emscripten.org/docs/porting/pthreads.html',
      relevance: 'SharedArrayBuffer, COOP/COEP, worker pool, and separate threaded/non-threaded builds.'
    },
    {
      title: 'Emscripten runtime environment',
      url: 'https://emscripten.org/docs/porting/emscripten-runtime-environment.html',
      relevance: 'Browser main-loop yielding, virtual filesystems, MEMFS, and IDBFS.'
    },
    {
      title: 'Emscripten File System API',
      url: 'https://emscripten.org/docs/api_reference/Filesystem-API.html',
      relevance: 'Synchronous virtual filesystem and asynchronous persistent storage synchronization.'
    },
    {
      title: 'Emscripten dynamic linking',
      url: 'https://emscripten.org/docs/compiling/Dynamic-Linking.html',
      relevance: 'Main/side modules, runtime dlopen, code-size effects, and experimental pthread interaction.'
    },
    {
      title: 'Emscripten setjmp/longjmp support',
      url: 'https://emscripten.org/docs/porting/setjmp-longjmp.html',
      relevance: 'Compatibility modes and code-size/performance implications for simulator thread exits.'
    },
    {
      title: 'Emscripten audio guidance',
      url: 'https://emscripten.org/docs/porting/Audio.html',
      relevance: 'Event-loop yielding and browser user-gesture requirements for audio.'
    }
  ],
  productBoundary: {
    phase7Acceptance: 'passed-with-documented-blockers',
    levelA: 'available-browser-state-simulator',
    levelB: 'available-external-official-validation',
    levelC: 'not-shipped',
    editorIndependent: true,
    browserClientChanged: false,
    browserBundleDeltaBytes: 0,
    nextDecision: 'Choose whether Rockbox Designer will distribute and maintain a GPL Level C runtime; do not start the WebAssembly port before that choice.'
  }
};

const reportPath = resolve(repositoryRoot, 'reports/phase7-simulator/latest.json');
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write([
  'Phase 7 full simulator feasibility: acceptance passed with documented browser-port blockers.',
  `Native target: ${report.nativePrototype.target} ${report.nativePrototype.version}`,
  `Report: ${reportPath}`,
  ''
].join('\n'));
