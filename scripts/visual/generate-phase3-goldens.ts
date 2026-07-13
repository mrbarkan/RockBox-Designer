import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildPhase3FmsGolden, buildPhase3SbsGolden } from '../../tests/fixtures/phase3/golden';

const outputs = [
  ['phase3-sbs.ppm', buildPhase3SbsGolden()],
  ['phase3-fms.ppm', buildPhase3FmsGolden()]
] as const;
mkdirSync(resolve('tests/golden'), { recursive: true });
for (const [name, bytes] of outputs) writeFileSync(resolve('tests/golden', name), bytes);
process.stdout.write(`Generated ${outputs.length} Phase 3 golden images.\n`);
