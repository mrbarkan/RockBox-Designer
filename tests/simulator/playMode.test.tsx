import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlayMode } from '../../components/PlayMode';
import App from '../../App';
import { DEFAULT_PROJECT } from '../../constants';
import { getDeviceProfile } from '../../rockbox/devices';
import { createScenarioSession } from '../../rockbox/simulator';

describe('Phase 5 Play mode', () => {
  it('keeps Play prominent in Screens without retaining the duplicated control panel', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('▶ PLAY');
    expect(html).toContain('▶ Open Play');
    expect(html).toContain('Preview state');
    expect(html).not.toContain('Transport (%mp)');
  });

  it('presents a first-class Level A simulator with deterministic state controls', () => {
    const profile = getDeviceProfile('apple-ipod-video-5g');
    const html = renderToStaticMarkup(
      <PlayMode
        project={DEFAULT_PROJECT}
        profile={profile}
        session={createScenarioSession('normal-playback')}
        activeScenario="normal-playback"
        semanticResult={null}
        onClose={() => undefined}
        onApplyScenario={() => undefined}
        onAction={() => undefined}
      />
    );

    expect(html).toContain('Level A · Browser state simulator');
    expect(html).toContain('Copy scenario link');
    expect(html).toContain('Seeking forward');
    expect(html).toContain('Track metadata');
    expect(html).toContain('Rockbox activity');
    expect(html).toContain('10 · Quick screen');
    expect(html).toContain('21 · USB connected');
    expect(html).toContain('Theme projection');
    expect(html).toContain('Brightness 70%');
    expect(html).toContain('Charging');
    expect(html).toContain('USB inserted');
    expect(html).toContain('FM &amp; RDS');
    expect(html).toContain('Browser state preview only');
    expect(html).not.toContain('compatibility percentage');
  });

  it('identifies USB as an SBS activity scene instead of a standalone theme screen', () => {
    const profile = getDeviceProfile('apple-ipod-video-5g');
    const html = renderToStaticMarkup(
      <PlayMode
        project={DEFAULT_PROJECT}
        profile={profile}
        session={createScenarioSession('usb-connected')}
        activeScenario="usb-connected"
        semanticResult={null}
        onClose={() => undefined}
        onApplyScenario={() => undefined}
        onAction={() => undefined}
      />
    );

    expect(html).toContain('SBS · USB activity 21');
    expect(html).toContain('USB presentation is authored in the SBS');
    expect(html).toContain('%cs = 21');
  });

  it('explains FM, touch, and remote restrictions on iPod Classic', () => {
    const profile = getDeviceProfile('apple-ipod-classic-6g');
    const html = renderToStaticMarkup(
      <PlayMode
        project={{ ...DEFAULT_PROJECT, settings: { ...DEFAULT_PROJECT.settings, target: profile.id } }}
        profile={profile}
        session={createScenarioSession('normal-playback')}
        activeScenario="normal-playback"
        semanticResult={null}
        onClose={() => undefined}
        onApplyScenario={() => undefined}
        onAction={() => undefined}
      />
    );

    expect(html).toContain(`FM and RDS are unavailable on ${profile.model}`);
    expect(html).toContain(`Touch: unavailable on ${profile.model}`);
    expect(html).toContain(`Remote: unavailable on ${profile.model}`);
    expect(html).toContain('FM preset — unavailable');
    expect(html).toContain('Touch input — unavailable');
    expect(html).toContain('Remote display — unavailable');
  });
});
