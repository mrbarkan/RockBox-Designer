import { describe, expect, it } from 'vitest';
import { parseProjectData, stringifyProjectData } from '../../services/projectSerialization';
import { DEFAULT_PROJECT } from '../../constants';

describe('binary project serialization', () => {
  it('round-trips Uint8Array values without converting runtime state to data URLs', () => {
    const original = { nested: { bytes: new Uint8Array([0, 127, 255]) } };
    const parsed = parseProjectData<typeof original>(stringifyProjectData(original));
    expect(parsed.nested.bytes).toBeInstanceOf(Uint8Array);
    expect(parsed.nested.bytes).toEqual(original.nested.bytes);
  });

  it('migrates legacy saved project targets to device profile IDs', () => {
    const legacy = {
      ...DEFAULT_PROJECT,
      settings: { ...DEFAULT_PROJECT.settings, target: 'ipod_video' }
    };

    const restored = parseProjectData<typeof DEFAULT_PROJECT>(JSON.stringify(legacy));
    expect(restored.settings.target).toBe('apple-ipod-video-5g');
  });

  it('migrates project data nested inside saved cloud entries', () => {
    const saved = [{
      id: 'saved',
      data: {
        ...DEFAULT_PROJECT,
        settings: { ...DEFAULT_PROJECT.settings, target: 'ipod6g' }
      }
    }];

    const restored = parseProjectData<typeof saved>(JSON.stringify(saved));
    expect(restored[0].data.settings.target).toBe('apple-ipod-classic-6g');
  });
});
