import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { createThemeAsset, exportThemePackage, importThemePackage, updateCfgSetting } from '../../rockbox/packages';
import { convertWithConvttf } from './convttf';

const value = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const input = value('--input');
const sourceDir = process.env.ROCKBOX_SOURCE_DIR;
if (!sourceDir) throw new Error('ROCKBOX_SOURCE_DIR is required.');
if (!input) throw new Error('--input is required.');
const pixelSize = Number(value('--pixel-size') ?? 16);
const startCharacter = Number(value('--start') ?? 32);
const limitCharacter = Number(value('--limit') ?? 126);
const output = resolve(value('--output') ?? `${pixelSize}-${basename(input).replace(/\.[^.]+$/, '')}.fnt`);
const converted = convertWithConvttf({ sourceDir, input, output, pixelSize, startCharacter, limitCharacter });

const themePath = value('--theme');
const themeOutput = value('--output-theme');
if (themePath || themeOutput) {
  if (!themePath || !themeOutput) throw new Error('--theme and --output-theme must be provided together.');
  const theme = await importThemePackage(new Uint8Array(readFileSync(themePath)));
  const archivePath = `.rockbox/fonts/${converted.filename}`;
  const asset = await createThemeAsset(archivePath, converted.bytes);
  theme.assets = [...theme.assets.filter(candidate => candidate.archivePath !== archivePath), asset];
  if (theme.cfg) theme.cfg = updateCfgSetting(theme.cfg, 'font', `/.rockbox/fonts/${converted.filename}`);
  const exported = await exportThemePackage(theme);
  writeFileSync(resolve(themeOutput), exported);
  const reimported = await importThemePackage(exported);
  const packaged = reimported.assets.find(candidate => candidate.archivePath === archivePath);
  if (!packaged || !Buffer.from(packaged.bytes).equals(Buffer.from(converted.bytes))) {
    throw new Error('Generated font did not survive package export exactly.');
  }
  process.stdout.write(`Updated theme: ${resolve(themeOutput)}\n`);
}

process.stdout.write([
  `Generated ${converted.output}`,
  `RB12 metrics: ${converted.metrics.height}px high, ${converted.metrics.maxWidth}px max width, ${converted.metrics.glyphCount} glyph slots, ascent ${converted.metrics.ascent}px.`,
  `Rockbox source: ${converted.commit}`,
  'Licensing: confirm that the input font license allows conversion and redistribution before sharing the generated FNT.'
].join('\n') + '\n');
