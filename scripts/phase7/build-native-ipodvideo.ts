import { execFileSync, spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';

const sourceDir = process.env.ROCKBOX_SOURCE_DIR;
if (!sourceDir) {
  throw new Error('ROCKBOX_SOURCE_DIR is required and must point to the pinned Rockbox checkout.');
}

const repositoryRoot = resolve('.');
const registry = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'rockbox/registry/generated/rockbox-tags.json'), 'utf8')
);
const sourceCommit = execFileSync('git', ['-C', resolve(sourceDir), 'rev-parse', 'HEAD'], {
  encoding: 'utf8'
}).trim();
if (sourceCommit !== registry.upstream.commit) {
  throw new Error(`Rockbox checkout SHA ${sourceCommit} does not match ${registry.upstream.commit}.`);
}

const configuredBuildDir = process.env.ROCKBOX_PHASE7_BUILD_DIR;
const buildDir = configuredBuildDir
  ? resolve(configuredBuildDir)
  : mkdtempSync(resolve(tmpdir(), 'rockbox-designer-phase7-ipodvideo-'));
const buildRelative = relative(repositoryRoot, buildDir);
if (buildRelative === '' || (!buildRelative.startsWith('..') && !resolve(buildRelative).startsWith(resolve(tmpdir())))) {
  throw new Error('The native simulator build directory must remain outside the Rockbox Designer repository.');
}
if (existsSync(resolve(buildDir, 'Makefile'))) {
  throw new Error(`Refusing to replace an existing configured build at ${buildDir}. Choose an empty ROCKBOX_PHASE7_BUILD_DIR.`);
}
mkdirSync(buildDir, { recursive: true });

execFileSync(
  resolve(sourceDir, 'tools/configure'),
  ['--target=ipodvideo', '--type=S', '--ram=64', '--no-ccache'],
  { cwd: buildDir, stdio: 'inherit' }
);

const makefilePath = resolve(buildDir, 'Makefile');
let makefile = readFileSync(makefilePath, 'utf8');
const replacements = [
  [/^export CC=.*$/m, 'export CC=/usr/bin/clang'],
  [/^export CPP=.*$/m, 'export CPP=/usr/bin/cpp'],
  [/^export AR=.*$/m, 'export AR=/usr/bin/ar'],
  [/^export RANLIB=.*$/m, 'export RANLIB=/usr/bin/ranlib']
] as const;
for (const [pattern, replacement] of replacements) {
  if (!pattern.test(makefile)) {
    throw new Error(`Generated Makefile is missing the expected field for ${replacement}.`);
  }
  makefile = makefile.replace(pattern, replacement);
}
makefile = makefile.replace(
  /^(export GCCOPTS=.*)$/m,
  line => line.includes('-D_FORTIFY_SOURCE=0') ? line : `${line} -D_FORTIFY_SOURCE=0`
);
writeFileSync(makefilePath, makefile);

const jobs = String(Math.max(1, Math.min(4, Number(process.env.ROCKBOX_BUILD_JOBS) || 4)));
execFileSync('make', [`-j${jobs}`, 'bin'], { cwd: buildDir, stdio: 'inherit' });
execFileSync('make', ['install'], { cwd: buildDir, stdio: 'inherit' });

const binaryPath = resolve(buildDir, 'rockboxui');
const installedInfo = resolve(buildDir, 'simdisk/.rockbox/rockbox-info.txt');
if (!existsSync(binaryPath) || !existsSync(installedInfo)) {
  throw new Error('Native simulator build finished without rockboxui or the minimal simulator disk.');
}

const child = spawn(binaryPath, ['--root', resolve(buildDir, 'simdisk')], {
  cwd: buildDir,
  env: { ...process.env, SDL_VIDEODRIVER: 'dummy', SDL_AUDIODRIVER: 'dummy' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let simulatorOutput = '';
child.stdout.on('data', chunk => { simulatorOutput += String(chunk); });
child.stderr.on('data', chunk => { simulatorOutput += String(chunk); });
await new Promise(resolveWait => setTimeout(resolveWait, 1200));
if (child.exitCode !== null) {
  throw new Error(`Native simulator exited during its launch smoke test.\n${simulatorOutput}`);
}
child.kill('SIGINT');
await Promise.race([
  new Promise<void>(resolveExit => child.once('exit', () => resolveExit())),
  new Promise<void>(resolveTimeout => setTimeout(() => {
    child.kill('SIGKILL');
    resolveTimeout();
  }, 3000))
]);

process.stdout.write([
  'Phase 7 native iPod Video simulator core built.',
  `Build directory: ${buildDir}`,
  `Binary size: ${statSync(binaryPath).size} bytes`,
  'Scope: simulator core plus minimum theme runtime; codecs and plugins are intentionally excluded.',
  'Thread backend: Rockbox configure-selected SDL fallback.',
  'Launch smoke: passed with dummy video and audio drivers.',
  ''
].join('\n'));
