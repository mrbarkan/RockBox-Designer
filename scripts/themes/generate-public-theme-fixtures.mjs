#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outputDir = resolve(projectRoot, 'tests/public-themes');
const fixedDate = new Date('2000-01-01T00:00:00.000Z');

const fixtures = [
  {
    filename: 'authored-basic.zip',
    files: {
      '.rockbox/themes/authored-basic.cfg': '# Authored public fixture\r\nwps: /.rockbox/wps/authored-basic.wps\r\nsbs: /.rockbox/wps/authored-basic.sbs\r\nunknown setting: keep:this\r\n',
      '.rockbox/wps/authored-basic.wps': '# exact CRLF\r\n%V(0,0,320,240,-)\r\n%it — %ia\r\n%zzFixture(alpha)\r\n',
      '.rockbox/wps/authored-basic.sbs': '%V(0,0,320,20,-)\n%?mp<Stopped|Playing>\n',
      '.rockbox/wps/authored-basic/icon.bmp': new Uint8Array([0x42, 0x4d, 0x01, 0x02]),
      '.rockbox/wps/shared/icon.bmp': new Uint8Array([0x42, 0x4d, 0x03, 0x04]),
      '.rockbox/extra/unknown.bin': new Uint8Array([0, 127, 255])
    }
  },
  {
    filename: 'authored-full.zip',
    files: {
      '.rockbox/themes/authored-full.cfg': '# WPS + SBS + FMS\nwps: /.rockbox/wps/authored-full.wps\nsbs: /.rockbox/wps/authored-full.sbs\nfms: /.rockbox/wps/authored-full.fms\nfont: /.rockbox/fonts/authored.fnt\n',
      '.rockbox/wps/authored-full.wps': '%V(0,0,320,240,-)\n%xl(A,strip.bmp,0,0,2)\n%xd(A,1)\n',
      '.rockbox/wps/authored-full.sbs': '%V(0,0,320,240,-)\n%?ps<Shuffle|Normal>\n',
      '.rockbox/wps/authored-full.fms': '%V(0,0,320,240,-)\n%?tp<%tf|No radio>\n',
      '.rockbox/wps/authored-full/strip.bmp': new Uint8Array([0x42, 0x4d, 0x05, 0x06]),
      '.rockbox/fonts/authored.fnt': new Uint8Array([0x52, 0x42, 0x31, 0x32]),
      '.rockbox/icons/authored.icons': new Uint8Array([1, 2, 3, 4])
    }
  }
];

const buildFixture = async fixture => {
  const zip = new JSZip();
  for (const path of Object.keys(fixture.files).sort()) {
    zip.file(path, fixture.files[path], { date: fixedDate, createFolders: false });
  }
  return zip.generateAsync({
    type: 'uint8array',
    compression: 'STORE',
    platform: 'DOS',
    streamFiles: false
  });
};

mkdirSync(outputDir, { recursive: true });
const check = process.argv.includes('--check');
for (const fixture of fixtures) {
  const outputPath = resolve(outputDir, fixture.filename);
  const bytes = await buildFixture(fixture);
  if (check) {
    if (!existsSync(outputPath) || !Buffer.from(readFileSync(outputPath)).equals(Buffer.from(bytes))) {
      throw new Error(`Public theme fixture is stale: ${fixture.filename}`);
    }
  } else {
    writeFileSync(outputPath, bytes);
  }
}

process.stdout.write(
  `${check ? 'Verified' : 'Generated'} ${fixtures.length} authored public theme fixtures.\n`
);
