#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const UPSTREAM_REPOSITORY = 'https://github.com/Rockbox/rockbox.git';
export const SOURCE_PATHS = [
  'lib/skin_parser/tag_table.c',
  'lib/skin_parser/tag_table.h'
];

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const defaultOutputPath = resolve(
  projectRoot,
  'rockbox/registry/generated/rockbox-tags.json'
);

const decodeCString = value => JSON.parse(value);

const normalizeCategory = value => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const readCommit = sourceDir => execFileSync(
  'git',
  ['-C', sourceDir, 'rev-parse', 'HEAD'],
  { encoding: 'utf8' }
).trim();

const readCommitTimestamp = sourceDir => execFileSync(
  'git',
  ['-C', sourceDir, 'show', '-s', '--format=%cI', 'HEAD'],
  { encoding: 'utf8' }
).trim();

const parseStringMacros = source => {
  const macros = new Map();
  for (const match of source.matchAll(/^#define\s+([A-Z][A-Z0-9_]*)\s+("(?:[^"\\]|\\.)*")\s*$/gm)) {
    macros.set(match[1], decodeCString(match[2]));
  }
  return macros;
};

const parseTokenCategories = header => {
  const enumMatch = header.match(/enum\s+skin_token_type\s*\{([\s\S]*?)\n\};/);
  if (!enumMatch) throw new Error('Could not find enum skin_token_type in tag_table.h.');

  const categories = new Map();
  let category = 'uncategorized';
  for (const line of enumMatch[1].split(/\r?\n/)) {
    const heading = line.trim().match(/^\/\*\s*([^*]+?)\s*\*\/$/);
    if (heading) {
      category = normalizeCategory(heading[1]);
      continue;
    }
    const token = line.match(/^\s*(SKIN_TOKEN_[A-Z0-9_]+)\s*,/);
    if (token) categories.set(token[1], category);
  }
  return categories;
};

const resolveParameterSpec = (expression, macros) => {
  const trimmed = expression.trim();
  if (/^"(?:[^"\\]|\\.)*"$/.test(trimmed)) return decodeCString(trimmed);
  if (macros.has(trimmed)) return macros.get(trimmed);
  throw new Error(`Unsupported parameter expression: ${trimmed}`);
};

export const extractTags = (tableSource, headerSource) => {
  const macros = parseStringMacros(tableSource);
  const categories = parseTokenCategories(headerSource);
  const tags = [];
  const tagPattern = /^\s*TAG\(\s*(SKIN_TOKEN_[A-Z0-9_]+)\s*,\s*("(?:[^"\\]|\\.)*")\s*,\s*([^,]+?)\s*,\s*([^\n]+?)\s*\),?\s*$/gm;

  for (const match of tableSource.matchAll(tagPattern)) {
    const name = decodeCString(match[2]);
    if (!name) continue;
    const token = match[1];
    tags.push({
      name,
      token,
      rawParameterSpec: resolveParameterSpec(match[3], macros),
      rawFlags: match[4].trim(),
      category: categories.get(token) ?? 'uncategorized',
      supportLevels: ['preserved', 'parsed']
    });
  }

  if (tags.length === 0) throw new Error('No Rockbox TAG entries were found.');
  const seen = new Set();
  for (const tag of tags) {
    if (seen.has(tag.name)) throw new Error(`Duplicate Rockbox tag name: ${tag.name}`);
    seen.add(tag.name);
  }
  return tags.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
};

export const buildRegistry = ({ sourceDir, generatedAt }) => {
  if (!sourceDir) throw new Error('Set ROCKBOX_SOURCE_DIR to a local Rockbox checkout.');
  const absoluteSourceDir = resolve(sourceDir);
  const [tablePath, headerPath] = SOURCE_PATHS.map(path => resolve(absoluteSourceDir, path));
  for (const path of [tablePath, headerPath]) {
    if (!existsSync(path)) throw new Error(`Required Rockbox source file is missing: ${path}`);
  }

  const commit = readCommit(absoluteSourceDir);
  return {
    schemaVersion: 1,
    upstream: {
      repository: UPSTREAM_REPOSITORY,
      commit,
      commitTimestamp: readCommitTimestamp(absoluteSourceDir),
      generatedAt: generatedAt ?? new Date().toISOString(),
      sourcePaths: SOURCE_PATHS
    },
    tags: extractTags(readFileSync(tablePath, 'utf8'), readFileSync(headerPath, 'utf8'))
  };
};

export const serializeRegistry = registry => `${JSON.stringify(registry, null, 2)}\n`;

export const generateRegistry = ({ sourceDir, outputPath = defaultOutputPath, refreshTimestamp = false }) => {
  let generatedAt;
  if (!refreshTimestamp && existsSync(outputPath)) {
    try {
      const previous = JSON.parse(readFileSync(outputPath, 'utf8'));
      if (sourceDir && previous.upstream?.commit === readCommit(resolve(sourceDir))) {
        generatedAt = previous.upstream?.generatedAt;
      }
    } catch {
      generatedAt = undefined;
    }
  }
  const registry = buildRegistry({ sourceDir, generatedAt });
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, serializeRegistry(registry));
  return registry;
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const refreshTimestamp = process.argv.includes('--refresh-timestamp');
  const registry = generateRegistry({
    sourceDir: process.env.ROCKBOX_SOURCE_DIR,
    refreshTimestamp
  });
  process.stdout.write(
    `Generated ${registry.tags.length} Rockbox tags from ${registry.upstream.commit}.\n`
  );
}
