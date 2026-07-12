import { execFileSync, spawnSync } from 'node:child_process';
import { cpus, platform, tmpdir } from 'node:os';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

type BuildOptions = {
  sourceDir: string;
  target: string;
  buildRoot?: string;
};

const requireSourcePath = (sourceDir: string, path: string) => {
  const absolute = resolve(sourceDir, path);
  if (!existsSync(absolute)) throw new Error(`Required Rockbox source path is missing: ${absolute}`);
  return absolute;
};

const commandExists = (command: string) => {
  try {
    execFileSync('sh', ['-c', `command -v ${command}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const run = (command: string, args: string[], cwd: string) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 32 * 1024 * 1024
  });
  if (result.error || result.status !== 0) {
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim().split(/\r?\n/).slice(-40).join('\n');
    throw new Error(
      `${command} ${args.join(' ')} failed in ${cwd}.` +
      (output ? `\n${output}` : '')
    );
  }
};

const applyDarwinClangCompatibility = (makefilePath: string) => {
  let makefile = readFileSync(makefilePath, 'utf8');
  makefile = makefile
    .replace(/^export CC=.*$/m, 'export CC=/usr/bin/clang')
    .replace(/^export CPP=.*$/m, 'export CPP=/usr/bin/cpp')
    .replace(/^export AR=.*$/m, 'export AR=/usr/bin/ar')
    .replace(/^export GCCOPTS=(.*)$/m, (_line, options) =>
      `export GCCOPTS=${options} -D_FORTIFY_SOURCE=0`
    );
  writeFileSync(makefilePath, makefile);
};

export const buildCheckWps = ({ sourceDir, target, buildRoot }: BuildOptions) => {
  if (!/^[a-z0-9_-]+$/.test(target)) throw new Error(`Invalid Rockbox target: ${target}`);
  const absoluteSourceDir = resolve(sourceDir);
  const configure = requireSourcePath(absoluteSourceDir, 'tools/configure');
  requireSourcePath(absoluteSourceDir, 'tools/checkwps/checkwps.c');
  requireSourcePath(absoluteSourceDir, 'lib/skin_parser/skin_parser.c');

  const commit = execFileSync('git', ['-C', absoluteSourceDir, 'rev-parse', 'HEAD'], {
    encoding: 'utf8'
  }).trim();
  const root = resolve(buildRoot ?? join(tmpdir(), 'rockbox-designer-official'));
  const buildDir = join(root, commit, target);
  const binaryPath = join(buildDir, `checkwps.${target}`);
  const stampPath = join(buildDir, '.rockbox-source-sha');

  if (
    existsSync(binaryPath) &&
    existsSync(stampPath) &&
    readFileSync(stampPath, 'utf8').trim() === commit
  ) {
    return { binaryPath, buildDir, commit, reused: true };
  }

  rmSync(buildDir, { recursive: true, force: true });
  mkdirSync(buildDir, { recursive: true });
  run(configure, [
    `--target=${target}`,
    '--type=C',
    '--ram=64',
    '--lcdwidth=320',
    '--lcdheight=240',
    '--no-ccache'
  ], buildDir);

  if (platform() === 'darwin' && !commandExists('gcc-16')) {
    applyDarwinClangCompatibility(join(buildDir, 'Makefile'));
  }

  const jobs = process.env.ROCKBOX_OFFICIAL_JOBS ?? String(Math.max(1, Math.min(4, cpus().length)));
  run('make', [`-j${jobs}`], buildDir);
  if (!existsSync(binaryPath)) throw new Error(`checkwps build completed without ${binaryPath}.`);
  writeFileSync(stampPath, `${commit}\n`);
  return { binaryPath, buildDir, commit, reused: false };
};
