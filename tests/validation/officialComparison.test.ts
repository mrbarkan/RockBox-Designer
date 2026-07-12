import { describe, expect, it } from 'vitest';
import { classifyParserComparison } from '../../rockbox/validation';

describe('official parser comparison categories', () => {
  it.each([
    [{ browser: { preserved: true, accepted: true }, official: { executed: true, accepted: true } }, 'accepted-by-both'],
    [{ browser: { preserved: true, accepted: true }, official: { executed: true, accepted: false } }, 'browser-preserved-official-rejected'],
    [{ browser: { preserved: true, accepted: false }, official: { executed: true, accepted: false } }, 'browser-diagnostic-differs'],
    [{ browser: { preserved: false, accepted: false }, official: { executed: true, accepted: false } }, 'browser-preservation-failure'],
    [{ browser: { preserved: true, accepted: true }, official: { executed: false, accepted: false } }, 'official-parser-unavailable'],
    [{ browser: { preserved: true, accepted: true }, official: { executed: true, accepted: true }, targetDependent: true }, 'target-dependent']
  ] as const)('classifies %j as %s', (input, expected) => {
    expect(classifyParserComparison(input)).toBe(expected);
  });
});
