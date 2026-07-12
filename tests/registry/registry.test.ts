import { describe, expect, it } from 'vitest';
import {
  getLongestKnownTagAt,
  getRawParameterSpec,
  getTagDefinition,
  isKnownTag,
  listTagsByCategory,
  rockboxTagRegistry
} from '../../rockbox/registry';
import { parseRockbox, serializeRockbox } from '../../rockbox/syntax';

describe('generated Rockbox tag registry', () => {
  it('records the pinned upstream source and a substantial official tag set', () => {
    expect(rockboxTagRegistry.upstream.commit).toBe(
      '078a506dfd0deb18165a3ed80c7fcbdb3afb0d31'
    );
    expect(rockboxTagRegistry.tags.length).toBeGreaterThan(150);
    expect(new Set(rockboxTagRegistry.tags.map(tag => tag.name)).size)
      .toBe(rockboxTagRegistry.tags.length);
  });

  it('exposes definitions, parameter specs, support states, and categories', () => {
    expect(isKnownTag('xl')).toBe(true);
    expect(isKnownTag('zzFuture')).toBe(false);
    expect(getRawParameterSpec('xl')).toBe('SF|[IP][IP]I');
    expect(getRawParameterSpec('zzFuture')).toBeNull();
    expect(getTagDefinition('V')).toMatchObject({
      token: 'SKIN_TOKEN_VIEWPORT_LOAD',
      category: 'viewport-display',
      supportLevels: ['preserved', 'parsed']
    });
    expect(listTagsByCategory('image').map(tag => tag.name))
      .toEqual(expect.arrayContaining(['x', 'x9', 'xd', 'xl', 'X']));
  });

  it('selects the longest official name at either a percent or name offset', () => {
    expect(getLongestKnownTagAt('%x9', 0)?.name).toBe('x9');
    expect(getLongestKnownTagAt('%and', 1)?.name).toBe('and');
    expect(getLongestKnownTagAt('%zzFuture', 1)).toBeNull();
  });
});

describe('registry-backed syntax recognition', () => {
  it('uses longest official names while preserving unknown future names', () => {
    const source = '%x9(A) %and(%mp,%ps) %zzFuture(alpha)';
    const document = parseRockbox(source);
    const names = document.nodes
      .filter(node => node.kind === 'tag')
      .map(node => node.name);

    expect(names).toEqual(['x9', 'and', 'zzFuture']);
    expect(serializeRockbox(document)).toBe(source);
  });

  it('recognizes every generated name through the public lookup API', () => {
    for (const definition of rockboxTagRegistry.tags) {
      expect(getLongestKnownTagAt(`%${definition.name}`, 1)?.name).toBe(definition.name);
    }
  });
});
