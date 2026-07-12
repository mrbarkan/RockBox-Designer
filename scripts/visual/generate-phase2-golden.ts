import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildPhase2Golden } from '../../tests/fixtures/phase2/golden';

const output = resolve('tests/golden/phase2-wps.ppm');
mkdirSync(resolve('tests/golden'), { recursive: true });
writeFileSync(output, buildPhase2Golden());
process.stdout.write(`Generated ${output}.\n`);
