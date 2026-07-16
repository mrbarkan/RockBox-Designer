import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from '../../App';
import { ElementLibraryModal } from '../../components/ElementLibraryModal';
import { DEFAULT_PROJECT } from '../../constants';
import { getDeviceProfile } from '../../rockbox/devices';

describe('Phase 6 Components mode', () => {
  it('keeps a quick Components entry in Screens', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('⊕ Components');
    expect(html).not.toContain('Transport (%mp)');
  });

  it('shows contract details and target restrictions instead of hiding unavailable definitions', () => {
    const profile = getDeviceProfile('apple-ipod-classic-6g');
    const html = renderToStaticMarkup(
      <ElementLibraryModal
        isOpen
        onClose={() => undefined}
        project={{ ...DEFAULT_PROJECT, settings: { ...DEFAULT_PROJECT.settings, target: profile.id } }}
        activeScreen="wps"
        deviceProfile={profile}
        onInsert={async () => ({ ok: false, project: DEFAULT_PROJECT, conflicts: [] })}
        onRemove={async () => ({ ok: false, project: DEFAULT_PROJECT, conflicts: [] })}
      />
    );

    expect(html).toContain('Rockbox-aware library');
    expect(html).toContain('Source, assets, rules, target support');
    expect(html).toContain('Ten-frame battery strip');
    expect(html).toContain('Touch play region');
    expect(html).toContain('Restricted');
    expect(html).toContain('Editable properties');
    expect(html).toContain('Official + browser');
    expect(html).toContain('Inserted components appear here as exact, reversible instances.');
    expect(html).not.toContain('Add Element');
  });
});
