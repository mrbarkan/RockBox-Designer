import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createThemeAsset, exportThemePackage, importThemePackage, updateCfgSetting } from '../../rockbox/packages';
import { convertWithConvttf } from './convttf';

const sourceDir = process.env.ROCKBOX_SOURCE_DIR;
const input = process.env.ROCKBOX_FONT_INPUT;
const simulatorDir = process.env.ROCKBOX_SIMULATOR_BUILD_DIR;
if (!sourceDir || !input || !simulatorDir) {
  throw new Error('ROCKBOX_SOURCE_DIR, ROCKBOX_FONT_INPUT, and ROCKBOX_SIMULATOR_BUILD_DIR are required.');
}
const pixelSize = Number(process.env.ROCKBOX_FONT_PIXEL_SIZE ?? 16);
const startCharacter = Number(process.env.ROCKBOX_FONT_START ?? 32);
const limitCharacter = Number(process.env.ROCKBOX_FONT_LIMIT ?? 126);
const validationDir = join(tmpdir(), 'rockbox-designer-font-validation');
mkdirSync(validationDir, { recursive: true });
const output = join(validationDir, `${pixelSize}-${basename(input).replace(/\.[^.]+$/, '')}.fnt`);
const converted = convertWithConvttf({ sourceDir, input, output, pixelSize, startCharacter, limitCharacter });
const packageFixture = await importThemePackage(new Uint8Array(readFileSync('tests/public-themes/authored-full.zip')));
const archivePath = `.rockbox/fonts/${converted.filename}`;
const packageAsset = await createThemeAsset(archivePath, converted.bytes);
packageFixture.assets = [...packageFixture.assets.filter(candidate => candidate.archivePath !== archivePath), packageAsset];
if (packageFixture.cfg) packageFixture.cfg = updateCfgSetting(packageFixture.cfg, 'font', `/.rockbox/fonts/${converted.filename}`);
const packaged = await importThemePackage(await exportThemePackage(packageFixture));
const packagedFont = packaged.assets.find(candidate => candidate.archivePath === archivePath);
const packageRoundTripVerified = Boolean(packagedFont && Buffer.from(packagedFont.bytes).equals(Buffer.from(converted.bytes)));
const simulator = resolve(simulatorDir, 'rockboxui');
const simdisk = resolve(simulatorDir, 'simdisk');
if (!existsSync(simulator) || !existsSync(resolve(simdisk, '.rockbox'))) {
  throw new Error('The provided Rockbox simulator build is missing rockboxui or simdisk/.rockbox.');
}
const fontsDir = resolve(simdisk, '.rockbox/fonts');
const installedFont = resolve(fontsDir, converted.filename);
const configPath = resolve(simdisk, '.rockbox/config.cfg');
const priorConfig = existsSync(configPath) ? readFileSync(configPath) : undefined;
const priorFont = existsSync(installedFont) ? readFileSync(installedFont) : undefined;
mkdirSync(fontsDir, { recursive: true });
copyFileSync(converted.output, installedFont);
writeFileSync(configPath, `font: ${converted.filename.replace(/\.fnt$/i, '')}\nforeground color: 000000\nbackground color: ffffff\n`);

const child = spawn(simulator, ['--root', simdisk], {
  cwd: simulatorDir,
  env: { ...process.env, SDL_VIDEODRIVER: 'dummy', SDL_AUDIODRIVER: 'dummy' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let simulatorOutput = '';
child.stdout.on('data', chunk => { simulatorOutput += String(chunk); });
child.stderr.on('data', chunk => { simulatorOutput += String(chunk); });

try {
  await new Promise(resolveWait => setTimeout(resolveWait, 1500));
  if (child.exitCode !== null) throw new Error(`Rockbox simulator exited before validation.\n${simulatorOutput}`);
  const debuggerOutput = execFileSync('/usr/bin/lldb', [
    '-p', String(child.pid),
    '-o', 'p global_settings.font_file',
    '-o', 'p *(struct font*)font_get(1)',
    '-o', 'detach',
    '-o', 'quit'
  ], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const loadedName = debuggerOutput.includes(converted.filename.replace(/\.fnt$/i, ''));
  const loadedHeight = Number(debuggerOutput.match(/\bheight = (\d+)/)?.[1]);
  const loadedFirstCharacter = Number(debuggerOutput.match(/\bfirstchar = (\d+)/)?.[1]);
  const loadedGlyphCount = Number(debuggerOutput.match(/\bsize = (\d+)/)?.[1]);
  const simulatorVerified = loadedName && loadedHeight === converted.metrics.height &&
    loadedFirstCharacter === converted.metrics.firstCharacter && loadedGlyphCount === converted.metrics.glyphCount;
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    upstream: { repository: 'https://github.com/Rockbox/rockbox.git', commit: converted.commit },
    tool: { source: 'tools/convttf.c', binaryBundled: false, sourceBundled: false, generatedFontCommitted: false },
    input: { pathRecorded: false, bytesCommitted: false, pixelSize, glyphRange: { start: startCharacter, limit: limitCharacter } },
    output: {
      sha256: createHash('sha256').update(converted.bytes).digest('hex'),
      bytes: converted.bytes.length,
      metrics: converted.metrics,
      packageRoundTripVerified
    },
    simulator: {
      buildDirectoryRecorded: false,
      binaryBundled: false,
      verified: simulatorVerified,
      loadedName,
      loadedHeight,
      loadedFirstCharacter,
      loadedGlyphCount,
      fontLoadError: /font load error/i.test(simulatorOutput)
    }
  };
  const reportPath = resolve('reports/phase3-font/latest.json');
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`Phase 3 native font validation: ${simulatorVerified ? 'verified' : 'failed'}.\nReport: ${reportPath}\n`);
  if (!packageRoundTripVerified || !simulatorVerified || report.simulator.fontLoadError) {
    throw new Error('The generated font failed package preservation or Rockbox simulator validation.');
  }
} finally {
  child.kill('SIGINT');
  await new Promise(resolveWait => child.once('exit', resolveWait));
  if (priorConfig) writeFileSync(configPath, priorConfig); else rmSync(configPath, { force: true });
  if (priorFont) writeFileSync(installedFont, priorFont); else rmSync(installedFont, { force: true });
}
