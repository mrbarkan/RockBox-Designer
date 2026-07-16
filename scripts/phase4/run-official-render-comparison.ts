import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { encodePpm, type PixelImage } from '../../rockbox/rendering/pixelRenderer';
import {
  PHASE4_REFERENCE_SOURCE,
  PHASE4_REFERENCE_VIEWPORT,
  buildPhase4BrowserReference
} from '../../tests/fixtures/phase4/reference';
import { differenceImage, readBmp } from './pixelImages';

const sourceDir = process.env.ROCKBOX_SOURCE_DIR;
const simulatorDir = process.env.ROCKBOX_SIMULATOR_BUILD_DIR;
if (!sourceDir || !simulatorDir) {
  throw new Error('ROCKBOX_SOURCE_DIR and ROCKBOX_SIMULATOR_BUILD_DIR are required for Phase 4 render comparison.');
}

const registry = JSON.parse(readFileSync(resolve('rockbox/registry/generated/rockbox-tags.json'), 'utf8'));
const commit = execFileSync('git', ['-C', resolve(sourceDir), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (commit !== registry.upstream.commit) {
  throw new Error(`Rockbox checkout SHA ${commit} does not match ${registry.upstream.commit}.`);
}
const simulator = resolve(simulatorDir, 'rockboxui');
const simulatorDisk = resolve(simulatorDir, 'simdisk');
if (!existsSync(simulator) || !existsSync(resolve(simulatorDisk, '.rockbox'))) {
  throw new Error('The provided Rockbox simulator build is missing rockboxui or simdisk/.rockbox.');
}

const wait = (milliseconds: number) => new Promise(resolveWait => setTimeout(resolveWait, milliseconds));
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const imageHash = (image: PixelImage) => sha256(encodePpm(image));

const captureOfficial = async (pass: number) => {
  const root = mkdtempSync(join(tmpdir(), `rockbox-designer-phase4-pass${pass}-`));
  const disk = resolve(root, 'simdisk');
  cpSync(simulatorDisk, disk, { recursive: true });
  const rockbox = resolve(disk, '.rockbox');
  const wpsDir = resolve(rockbox, 'wps');
  mkdirSync(wpsDir, { recursive: true });
  for (const filename of readdirSync(rockbox)) {
    if (/^\.resume|^config\.cfg$/.test(filename)) rmSync(resolve(rockbox, filename), { force: true });
  }
  writeFileSync(resolve(wpsDir, 'phase4-reference.sbs'), `${PHASE4_REFERENCE_SOURCE}\n`);
  writeFileSync(resolve(rockbox, 'config.cfg'), [
    'sbs: phase4-reference',
    'font: -',
    'foreground color: 000000',
    'background color: ffffff',
    'line selector start color: c6c6c6',
    'line selector end color: c6c6c6',
    'line selector text color: 000000',
    'selector type: bar (color)',
    'statusbar: off',
    'scrollbar: off',
    'show icons: off',
    ''
  ].join('\n'));

  const child = spawn(simulator, ['--root', disk], {
    cwd: simulatorDir,
    env: { ...process.env, SDL_VIDEODRIVER: 'dummy', SDL_AUDIODRIVER: 'dummy' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => { output += String(chunk); });
  child.stderr.on('data', chunk => { output += String(chunk); });

  try {
    await wait(1800);
    if (child.exitCode !== null) throw new Error(`Rockbox simulator exited before capture.\n${output}`);
    execFileSync('/usr/bin/lldb', [
      '-p', String(child.pid),
      '-o', 'expression (void)sim_trigger_screendump()',
      '-o', 'detach',
      '-o', 'quit'
    ], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });

    let screenshot = '';
    for (let attempt = 0; attempt < 20 && !screenshot; attempt += 1) {
      await wait(100);
      screenshot = readdirSync(disk).find(filename => /^dump .*\.bmp$|^dump_\d+\.bmp$/.test(filename)) ?? '';
    }
    if (!screenshot) throw new Error(`The simulator did not produce a framebuffer dump.\n${output}`);
    const screenshotPath = resolve(disk, screenshot);
    const image = readBmp(screenshotPath);
    return { image, bmp: new Uint8Array(readFileSync(screenshotPath)), output };
  } finally {
    child.kill('SIGINT');
    if (child.exitCode === null) {
      await Promise.race([
        new Promise<void>(resolveExit => child.once('exit', () => resolveExit())),
        wait(3000).then(() => { child.kill('SIGKILL'); })
      ]);
    }
    rmSync(root, { recursive: true, force: true });
  }
};

const officialPasses = [await captureOfficial(1), await captureOfficial(2)];
const official = officialPasses[0].image;
const reproducible = imageHash(officialPasses[0].image) === imageHash(officialPasses[1].image);
if (!reproducible) throw new Error('Two clean simulator captures produced different framebuffer pixels.');

const browserReference = buildPhase4BrowserReference();
const browser = browserReference.image;
if (official.width !== browser.width || official.height !== browser.height) {
  throw new Error(`Official ${official.width}x${official.height} and browser ${browser.width}x${browser.height} captures differ in geometry.`);
}

const classifications = [
  { id: 'native-font-and-text-layout', label: 'Native font raster and text layout', pixels: 0, tags: ['Vi'] },
  { id: 'selector-style', label: 'Firmware selector and browser selector approximation', pixels: 0, tags: ['Vi'] },
  { id: 'firmware-list-spacing', label: 'Firmware-owned list spacing and content projection', pixels: 0, tags: ['VI', 'Vi'] },
  { id: 'screen-background', label: 'Screen background initialization outside the UI viewport', pixels: 0, tags: ['V', 'Vf', 'Vb'] }
];
const textRects = browserReference.semantic.operations.filter(operation => operation.type === 'drawText').map(operation => operation.rect);
const selectorRects = browserReference.semantic.operations.filter(operation => operation.type === 'drawRect').map(operation => operation.rect);
const contains = (rect: { x: number; y: number; width: number; height: number }, x: number, y: number) =>
  x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;

let differingPixels = 0;
let absoluteChannelDelta = 0;
let maxChannelDelta = 0;
let minX = browser.width;
let minY = browser.height;
let maxX = -1;
let maxY = -1;
for (let y = 0; y < browser.height; y += 1) {
  for (let x = 0; x < browser.width; x += 1) {
    const offset = (y * browser.width + x) * 3;
    const deltas = [0, 1, 2].map(channel => Math.abs(browser.pixels[offset + channel] - official.pixels[offset + channel]));
    const pixelDelta = Math.max(...deltas);
    absoluteChannelDelta += deltas[0] + deltas[1] + deltas[2];
    maxChannelDelta = Math.max(maxChannelDelta, pixelDelta);
    if (pixelDelta === 0) continue;
    differingPixels += 1;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    if (textRects.some(rect => contains(rect, x, y))) classifications[0].pixels += 1;
    else if (selectorRects.some(rect => contains(rect, x, y))) classifications[1].pixels += 1;
    else if (contains(PHASE4_REFERENCE_VIEWPORT, x, y)) classifications[2].pixels += 1;
    else classifications[3].pixels += 1;
  }
}
const classifiedPixels = classifications.reduce((sum, classification) => sum + classification.pixels, 0);
const diff = differenceImage(browser, official);
const artifactDir = resolve('reports/phase4-render/artifacts');
mkdirSync(artifactDir, { recursive: true });
writeFileSync(resolve(artifactDir, 'browser.ppm'), encodePpm(browser));
writeFileSync(resolve(artifactDir, 'official.ppm'), encodePpm(official));
writeFileSync(resolve(artifactDir, 'diff.ppm'), encodePpm(diff));
writeFileSync(resolve(artifactDir, 'official.bmp'), officialPasses[0].bmp);

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  upstream: { repository: registry.upstream.repository, commit },
  harness: {
    tool: 'Rockbox UI simulator firmware framebuffer dump',
    target: 'ipodvideo',
    trigger: 'uisimulator sim_trigger_screendump -> firmware/screendump.c',
    sourceBundled: false,
    binaryBundled: false,
    screenshotsCommitted: false,
    cleanCapturePasses: officialPasses.length
  },
  fixture: {
    id: 'phase4-authored-sbs-menu',
    screen: 'sbs',
    device: 'apple-ipod-video-5g',
    width: browser.width,
    height: browser.height,
    sourceSha256: sha256(new TextEncoder().encode(PHASE4_REFERENCE_SOURCE)),
    sourceTags: ['V', 'Vf', 'Vb', 'VI', 'Vi']
  },
  captures: {
    reproducible,
    browser: { format: 'ppm', sha256: imageHash(browser) },
    official: { sourceFormat: 'bmp', normalizedFormat: 'ppm', sha256: imageHash(official) },
    diff: { format: 'ppm', sha256: imageHash(diff) },
    artifactsDirectory: 'reports/phase4-render/artifacts',
    artifactsCommitted: false
  },
  comparison: {
    totalPixels: browser.width * browser.height,
    differingPixels,
    differingPixelRatio: differingPixels / (browser.width * browser.height),
    meanAbsoluteChannelDelta: absoluteChannelDelta / (browser.width * browser.height * 3),
    maxChannelDelta,
    boundingBox: differingPixels ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null,
    classifications,
    classifiedPixels,
    unclassifiedPixels: differingPixels - classifiedPixels
  }
};
const reportPath = resolve('reports/phase4-render/latest.json');
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`Phase 4 official render comparison: ${differingPixels}/${report.comparison.totalPixels} pixels differ; ${classifiedPixels} classified.\nReport: ${reportPath}\nLocal images: ${artifactDir}\n`);
if (!reproducible || report.comparison.unclassifiedPixels !== 0 || classifications.slice(0, 2).some(classification => classification.pixels === 0)) {
  throw new Error('Phase 4 render comparison did not meet reproducibility and classification gates.');
}
