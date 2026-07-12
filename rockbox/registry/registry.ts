import generatedRegistry from './generated/rockbox-tags.json';
import { RockboxTagDefinition, RockboxTagRegistryData } from './types';

export const rockboxTagRegistry = generatedRegistry as RockboxTagRegistryData;

const definitions = new Map(
  rockboxTagRegistry.tags.map(definition => [definition.name, definition] as const)
);

const namesByLength = rockboxTagRegistry.tags
  .map(definition => definition.name)
  .sort((left, right) => right.length - left.length || (left < right ? -1 : left > right ? 1 : 0));

export const getTagDefinition = (name: string): RockboxTagDefinition | null =>
  definitions.get(name) ?? null;

export const isKnownTag = (name: string): boolean => definitions.has(name);

export const getLongestKnownTagAt = (
  source: string,
  offset: number
): RockboxTagDefinition | null => {
  const nameOffset = source[offset] === '%' ? offset + 1 : offset;
  if (nameOffset < 0 || nameOffset >= source.length) return null;
  const name = namesByLength.find(candidate => source.startsWith(candidate, nameOffset));
  return name ? definitions.get(name) ?? null : null;
};

export const listTagsByCategory = (category: string): RockboxTagDefinition[] =>
  rockboxTagRegistry.tags.filter(definition => definition.category === category);

export const getRawParameterSpec = (name: string): string | null =>
  definitions.get(name)?.rawParameterSpec ?? null;
