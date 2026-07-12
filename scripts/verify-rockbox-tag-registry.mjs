#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRegistry,
  defaultOutputPath,
  serializeRegistry,
  SOURCE_PATHS,
  UPSTREAM_REPOSITORY
} from './generate-rockbox-tag-registry.mjs';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const registryText = readFileSync(defaultOutputPath, 'utf8');
const registry = JSON.parse(registryText);

const fail = message => {
  throw new Error(`Rockbox tag registry verification failed: ${message}`);
};

if (registry.schemaVersion !== 1) fail('schemaVersion must be 1.');
if (registry.upstream?.repository !== UPSTREAM_REPOSITORY) fail('upstream repository is incorrect.');
if (!/^[0-9a-f]{40}$/.test(registry.upstream?.commit ?? '')) fail('commit must be a full Git SHA.');
if (!Number.isFinite(Date.parse(registry.upstream?.commitTimestamp ?? ''))) {
  fail('commitTimestamp is invalid.');
}
if (!Number.isFinite(Date.parse(registry.upstream?.generatedAt ?? ''))) fail('generatedAt is invalid.');
if (JSON.stringify(registry.upstream?.sourcePaths) !== JSON.stringify(SOURCE_PATHS)) {
  fail('source paths do not match the generator.');
}
if (!Array.isArray(registry.tags) || registry.tags.length === 0) fail('tags must be a non-empty array.');

const seen = new Set();
for (const tag of registry.tags) {
  if (!tag || typeof tag.name !== 'string' || !tag.name) fail('every tag needs a name.');
  if (seen.has(tag.name)) fail(`duplicate tag name ${tag.name}.`);
  seen.add(tag.name);
  if (!/^SKIN_TOKEN_[A-Z0-9_]+$/.test(tag.token ?? '')) fail(`${tag.name} has an invalid token.`);
  if (typeof tag.rawParameterSpec !== 'string') fail(`${tag.name} has no raw parameter spec.`);
  if (typeof tag.rawFlags !== 'string') fail(`${tag.name} has no raw flags.`);
  if (typeof tag.category !== 'string' || !tag.category) fail(`${tag.name} has no category.`);
  if (JSON.stringify(tag.supportLevels) !== JSON.stringify(['preserved', 'parsed'])) {
    fail(`${tag.name} has unexpected generated support levels.`);
  }
}

const docs = readFileSync(resolve(projectRoot, 'docs/UPSTREAM_ROCKBOX.md'), 'utf8');
if (!docs.includes(`Commit SHA:** \`${registry.upstream.commit}\``)) {
  fail('docs/UPSTREAM_ROCKBOX.md does not cite the generated registry SHA.');
}

if (process.env.ROCKBOX_SOURCE_DIR) {
  const regenerated = buildRegistry({
    sourceDir: process.env.ROCKBOX_SOURCE_DIR,
    generatedAt: registry.upstream.generatedAt
  });
  if (serializeRegistry(regenerated) !== registryText) {
    fail('checked-in output differs from regeneration using ROCKBOX_SOURCE_DIR.');
  }
}

process.stdout.write(
  `Verified ${registry.tags.length} Rockbox tags at ${registry.upstream.commit}.` +
  (process.env.ROCKBOX_SOURCE_DIR ? ' Regeneration matches.\n' : '\n')
);
