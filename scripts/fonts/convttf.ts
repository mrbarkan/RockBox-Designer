import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { parseRb12Font } from '../../rockbox/fonts';

const run = (command: string, args: string[], cwd?: string) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: process.env, maxBuffer: 32 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed.\n${`${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()}`);
  }
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
};

const commandExists = (command: string) => {
  const result = spawnSync('sh', ['-c', `command -v "$1"`, 'sh', command], { stdio: 'ignore' });
  return result.status === 0;
};

export const readPinnedRockboxCommit = () => {
  const registry = JSON.parse(readFileSync(resolve('rockbox/registry/generated/rockbox-tags.json'), 'utf8'));
  return String(registry.upstream.commit);
};

const freetypeFlags = () => {
  const pkgConfig = process.env.PKG_CONFIG ?? (commandExists('pkg-config') ? 'pkg-config' : undefined);
  if (pkgConfig) return run(pkgConfig, ['--cflags', '--libs', 'freetype2']).trim().split(/\s+/).filter(Boolean);
  const candidates = [
    process.env.FREETYPE_CONFIG,
    '/opt/homebrew/opt/freetype/bin/freetype-config',
    '/usr/local/opt/freetype/bin/freetype-config',
    commandExists('freetype-config') ? 'freetype-config' : undefined
  ].filter((candidate): candidate is string => Boolean(candidate));
  const config = candidates.find(candidate => candidate === 'freetype-config' || existsSync(candidate));
  if (!config) throw new Error('FreeType development flags are unavailable. Set PKG_CONFIG or FREETYPE_CONFIG.');
  return [
    ...run(config, ['--cflags']).trim().split(/\s+/),
    ...run(config, ['--libs']).trim().split(/\s+/)
  ].filter(Boolean);
};

export const buildConvttf = (sourceDirectory: string) => {
  const sourceDir = resolve(sourceDirectory);
  const source = resolve(sourceDir, 'tools/convttf.c');
  if (!existsSync(source)) throw new Error(`Rockbox convttf source is missing: ${source}`);
  const commit = execFileSync('git', ['-C', sourceDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const pinnedCommit = readPinnedRockboxCommit();
  if (commit !== pinnedCommit) throw new Error(`Rockbox checkout SHA ${commit} does not match ${pinnedCommit}.`);
  const outputDir = resolve(process.env.ROCKBOX_FONT_TOOL_DIR ?? join(tmpdir(), 'rockbox-designer-font-tools', commit));
  const binary = join(outputDir, 'convttf');
  const stamp = join(outputDir, '.rockbox-source-sha');
  if (existsSync(binary) && existsSync(stamp) && readFileSync(stamp, 'utf8').trim() === commit) {
    return { binary, commit, sourceDir, reused: true };
  }
  mkdirSync(outputDir, { recursive: true });
  const compiler = process.env.CC ?? (existsSync('/usr/bin/clang') ? '/usr/bin/clang' : 'cc');
  run(compiler, ['-std=c99', '-O2', '-Wall', source, '-o', binary, ...freetypeFlags(), '-lm']);
  writeFileSync(stamp, `${commit}\n`);
  return { binary, commit, sourceDir, reused: false };
};

export const convertWithConvttf = ({
  sourceDir,
  input,
  output,
  pixelSize,
  startCharacter,
  limitCharacter
}: {
  sourceDir: string;
  input: string;
  output: string;
  pixelSize: number;
  startCharacter: number;
  limitCharacter: number;
}) => {
  if (!existsSync(input)) throw new Error(`Input font does not exist: ${input}`);
  if (!/\.(ttf|otf|ttc)$/i.test(input)) throw new Error('Input must be a TTF, OTF, or TTC font.');
  if (!Number.isInteger(pixelSize) || pixelSize < 4 || pixelSize > 200) throw new Error('Pixel size must be an integer from 4 to 200.');
  if (!Number.isInteger(startCharacter) || !Number.isInteger(limitCharacter) || startCharacter < 0 || limitCharacter > 0x10ffff || startCharacter > limitCharacter) {
    throw new Error('Glyph range must be a valid ascending Unicode code-point range.');
  }
  const tool = buildConvttf(sourceDir);
  mkdirSync(dirname(resolve(output)), { recursive: true });
  const log = run(tool.binary, [
    '-p', String(pixelSize), '-s', String(startCharacter), '-l', String(limitCharacter),
    '-o', resolve(output), resolve(input)
  ]);
  const bytes = new Uint8Array(readFileSync(output));
  return { ...tool, output: resolve(output), filename: basename(output), bytes, metrics: parseRb12Font(bytes), log };
};
