import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT } from '../../constants';
import { settingsFromRockboxCfg } from '../../services/rockboxProjectSettings';

describe('Rockbox CFG to editor settings', () => {
  it('projects menu, font, icon, quick-screen, and display settings', () => {
    const settings = settingsFromRockboxCfg([
      'font: /.rockbox/fonts/18-Cantarell-Regular.fnt',
      'iconset: /.rockbox/icons/adwaitapod.bmp',
      'viewers iconset: /.rockbox/icons/adwaitapod_viewers.bmp',
      'foreground color: 292829',
      'background color: ffffff',
      'line selector start color: e7e7e7',
      'line selector end color: d6d7d6',
      'line selector text color: 000000',
      'selector type: bar (gradient)',
      'show icons: on',
      'scrollbar: left',
      'scrollbar width: 8',
      'volume display: numeric',
      'battery display: graphic',
      'statusbar: bottom',
      'backlight on button hold: off',
      'qs top: brightness'
    ].join('\n'), DEFAULT_PROJECT.settings, 'Adwaitapod');

    expect(settings).toMatchObject({
      name: 'Adwaitapod',
      uiFont: '18-Cantarell-Regular.fnt',
      iconset: '/.rockbox/icons/adwaitapod.bmp',
      viewersIconset: '/.rockbox/icons/adwaitapod_viewers.bmp',
      foregroundColor: '#292829',
      backgroundColor: '#ffffff',
      selectorColor: '#e7e7e7',
      lineSelectorEndColor: '#d6d7d6',
      selectorTextColor: '#000000',
      lineSelectorType: 'bar_gradient',
      showIcons: true,
      scrollbar: 'left',
      scrollbarWidth: 8,
      volumeDisplay: 'numeric',
      batteryDisplay: 'graphic',
      statusBarTop: false,
      statusBarPosition: 'bottom',
      backlightOnHold: 'off',
      qsTop: 'brightness'
    });
  });

  it('keeps valid defaults when malformed values are imported', () => {
    const settings = settingsFromRockboxCfg('foreground color: nope\nscrollbar width: nope\nshow icons: off', DEFAULT_PROJECT.settings, 'Broken');
    expect(settings.foregroundColor).toBe(DEFAULT_PROJECT.settings.foregroundColor);
    expect(settings.scrollbarWidth).toBe(DEFAULT_PROJECT.settings.scrollbarWidth);
    expect(settings.showIcons).toBe(false);
  });
});
