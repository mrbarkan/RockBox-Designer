import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import JSZip from 'jszip';
import { parseCfg } from '../../rockbox/packages';

const fixedDate = new Date('2000-01-01T00:00:00.000Z');
const argument = process.argv.find(value => value.startsWith('--firmware-dir='));
if (!argument) throw new Error('Pass --firmware-dir=/absolute/path/to/the/local/rockbox-firmware-directory.');
const firmwareDir = resolve(argument.slice('--firmware-dir='.length));
const outputDir = resolve('tests/private-themes');

const definitions = [
  { name: 'AMusicPod', cfg: 'themes/AMusicPod.cfg', target: 'ipodvideo' },
  { name: 'Adwaitapod', cfg: 'themes/adwaitapod.cfg', target: 'ipodvideo' }
];

const findCaseInsensitive = (root: string, relativePath: string): string | null => {
  let current = root;
  for (const part of relativePath.split('/').filter(Boolean)) {
    const match = readdirSync(current).find(entry => entry.toLowerCase() === part.toLowerCase());
    if (!match) return null;
    current = join(current, match);
  }
  return current;
};

const addFile = (zip: JSZip, sourcePath: string, archivePath: string) => {
  zip.file(archivePath, readFileSync(sourcePath), { date: fixedDate, createFolders: true });
};

const addDirectory = (zip: JSZip, sourceDir: string, archiveDir: string) => {
  for (const entry of readdirSync(sourceDir).sort()) {
    if (entry === '.DS_Store') continue;
    const sourcePath = join(sourceDir, entry);
    const archivePath = `${archiveDir}/${entry}`;
    if (statSync(sourcePath).isDirectory()) addDirectory(zip, sourcePath, archivePath);
    else addFile(zip, sourcePath, archivePath);
  }
};

const cfgReferences = (source: string) => parseCfg(source).lines
  .filter(line => line.kind === 'setting' && line.value && line.value !== '-')
  .map(line => line.value!.trim())
  .filter(value => value.startsWith('/.rockbox/'));

mkdirSync(outputDir, { recursive: true });
for (const definition of definitions) {
  const cfgSourcePath = findCaseInsensitive(firmwareDir, definition.cfg);
  if (!cfgSourcePath) throw new Error(`Missing local CFG: ${definition.cfg}`);
  const cfgSource = readFileSync(cfgSourcePath, 'utf8');
  const zip = new JSZip();
  addFile(zip, cfgSourcePath, `.rockbox/themes/${basename(definition.cfg)}`);

  const screenSources: string[] = [];
  for (const reference of cfgReferences(cfgSource)) {
    const archivePath = reference.replace(/^\//, '');
    const localRelative = archivePath.replace(/^\.rockbox\//, '');
    const sourcePath = findCaseInsensitive(firmwareDir, localRelative);
    if (!sourcePath || statSync(sourcePath).isDirectory()) continue;
    addFile(zip, sourcePath, archivePath);
    if (/\.(wps|sbs|fms)$/i.test(sourcePath)) {
      const screenSource = readFileSync(sourcePath, 'utf8');
      screenSources.push(screenSource);
      const assetDirName = basename(localRelative).replace(/\.(wps|sbs|fms)$/i, '');
      const assetSourceDir = findCaseInsensitive(firmwareDir, join(dirname(localRelative), assetDirName));
      if (assetSourceDir && statSync(assetSourceDir).isDirectory()) {
        addDirectory(zip, assetSourceDir, `${dirname(archivePath)}/${assetDirName}`);
      }
    }
  }

  const fontNames = new Set(
    screenSources.flatMap(source => [...source.matchAll(/[A-Za-z0-9_.-]+\.fnt/gi)].map(match => match[0]))
  );
  for (const fontName of fontNames) {
    const fontPath = findCaseInsensitive(firmwareDir, `fonts/${fontName}`);
    if (fontPath) addFile(zip, fontPath, `.rockbox/fonts/${fontName}`);
  }

  const zipBytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'DOS',
    streamFiles: false
  });
  const zipPath = resolve(outputDir, `${definition.name}.zip`);
  writeFileSync(zipPath, zipBytes);
  writeFileSync(`${zipPath}.provenance.json`, `${JSON.stringify({
    name: definition.name,
    target: definition.target,
    sourceClass: 'private-local',
    source: 'User-owned local Rockbox firmware tree',
    redistribution: 'not-confirmed-do-not-commit'
  }, null, 2)}\n`);
  process.stdout.write(`Prepared private fixture ${definition.name}.zip (${zipBytes.length} bytes).\n`);
}
