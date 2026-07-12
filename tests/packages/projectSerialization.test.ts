import { describe, expect, it } from 'vitest';
import { parseProjectData, stringifyProjectData } from '../../services/projectSerialization';

describe('binary project serialization', () => {
  it('round-trips Uint8Array values without converting runtime state to data URLs', () => {
    const original = { nested: { bytes: new Uint8Array([0, 127, 255]) } };
    const parsed = parseProjectData<typeof original>(stringifyProjectData(original));
    expect(parsed.nested.bytes).toBeInstanceOf(Uint8Array);
    expect(parsed.nested.bytes).toEqual(original.nested.bytes);
  });
});
