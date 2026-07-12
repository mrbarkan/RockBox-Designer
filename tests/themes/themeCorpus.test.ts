import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportThemePackage, importThemePackage, serializeCfg } from '../../rockbox/packages';
import { serializeRockbox } from '../../rockbox/syntax';

describe('authored public theme corpus', () => {
  it.each(['authored-basic.zip', 'authored-full.zip'])('%s preserves source and package contents', async filename => {
    const bytes = new Uint8Array(readFileSync(resolve('tests/public-themes', filename)));
    const imported = await importThemePackage(bytes);

    expect(imported.cfg && serializeCfg(imported.cfg)).toBe(imported.cfg?.source);
    for (const document of Object.values(imported.screens)) {
      if (document) expect(serializeRockbox(document)).toBe(document.source);
    }

    const reimported = await importThemePackage(await exportThemePackage(imported));
    expect(reimported.manifest).toEqual(imported.manifest);
  });
});
