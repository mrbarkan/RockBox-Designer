import fs from 'node:fs';
import path from 'node:path';
import { ROCKBOX_FONT_CATALOG, ROCKBOX_FONT_SOURCE_SHA } from '../../rockbox/fonts/catalog';

const EXPECTED_SHA = '078a506dfd0deb18165a3ed80c7fcbdb3afb0d31';

if (ROCKBOX_FONT_SOURCE_SHA !== EXPECTED_SHA) throw new Error('Rockbox font catalog SHA drifted from the pinned upstream source.');
if (ROCKBOX_FONT_CATALOG.length !== 88) throw new Error(`Expected 88 Rockbox font entries, found ${ROCKBOX_FONT_CATALOG.length}.`);
const filenames = ROCKBOX_FONT_CATALOG.map(entry => entry.filename);
if (new Set(filenames).size !== filenames.length) throw new Error('Rockbox font catalog contains duplicate filenames.');
if (filenames.some(filename => !/^\d{2}-.+\.fnt$/.test(filename))) throw new Error('Rockbox font catalog contains an invalid filename.');
if (ROCKBOX_FONT_CATALOG.some(entry => entry.height !== Number.parseInt(entry.filename.slice(0, 2), 10))) {
  throw new Error('Rockbox font catalog height does not match its upstream filename.');
}

const sourceDir = process.env.ROCKBOX_SOURCE_DIR;
if (sourceDir) {
  const upstream = fs.readdirSync(path.join(sourceDir, 'fonts'))
    .filter(filename => filename.endsWith('.bdf'))
    .map(filename => filename.replace(/\.bdf$/, '.fnt'))
    .sort();
  const expected = [...filenames].sort();
  if (JSON.stringify(upstream) !== JSON.stringify(expected)) {
    throw new Error(`Rockbox font catalog does not match ${path.join(sourceDir, 'fonts')}.`);
  }
}

console.log(`Verified ${filenames.length} Rockbox font-package entries at ${ROCKBOX_FONT_SOURCE_SHA}.`);
