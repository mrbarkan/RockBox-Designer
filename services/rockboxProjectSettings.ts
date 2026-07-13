import type { ProjectSettings } from '../types';
import { parseCfg } from '../rockbox/packages';

const basename = (path: string) => path.replace(/\\/g, '/').split('/').pop() || path;

const color = (value: string, fallback: string) => {
  const clean = value.replace(/^0x/i, '').replace(/^#/, '').trim();
  return /^[0-9a-f]{6}$/i.test(clean) ? `#${clean}` : fallback;
};

const integer = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const enabled = (value: string) => ['on', 'yes', 'true', '1'].includes(value.trim().toLowerCase());

export const settingsFromRockboxCfg = (
  source: string,
  defaults: ProjectSettings,
  name: string
): ProjectSettings => {
  const settings: ProjectSettings = { ...defaults, name };
  const document = parseCfg(source);

  for (const line of document.lines) {
    if (line.kind !== 'setting' || !line.key) continue;
    const key = line.key.toLowerCase();
    const value = line.value?.trim() ?? '';
    const lower = value.toLowerCase();

    if (key === 'backdrop') settings.backdrop = value === '-' ? undefined : basename(value);
    else if (key === 'background color') settings.backgroundColor = color(value, settings.backgroundColor);
    else if (key === 'foreground color') settings.foregroundColor = color(value, settings.foregroundColor);
    else if (key === 'line selector start color' || key === 'selector color') settings.selectorColor = color(value, settings.selectorColor);
    else if (key === 'line selector end color') settings.lineSelectorEndColor = color(value, settings.lineSelectorEndColor ?? settings.selectorColor);
    else if (key === 'line selector text color') settings.selectorTextColor = color(value, settings.selectorTextColor);
    else if (key === 'selector type') {
      settings.lineSelectorType = lower.includes('pointer') ? 'pointer'
        : lower.includes('inverse') ? 'bar_inverse'
          : lower.includes('gradient') ? 'bar_gradient' : 'bar_color';
    } else if (key === 'font') settings.uiFont = basename(value) || settings.uiFont;
    else if (key === 'iconset') settings.iconset = value === '-' ? undefined : value;
    else if (key === 'viewers iconset') settings.viewersIconset = value === '-' ? undefined : value;
    else if (key === 'show icons') settings.showIcons = enabled(value);
    else if (key === 'scrollbar') settings.scrollbar = lower === 'left' || lower === 'right' ? lower : 'off';
    else if (key === 'scrollbar width') settings.scrollbarWidth = integer(value, settings.scrollbarWidth);
    else if (key === 'statusbar') settings.statusBarTop = lower === 'top';
    else if (key === 'volume display' && (lower === 'graphic' || lower === 'numeric')) settings.volumeDisplay = lower;
    else if (key === 'battery display' && (lower === 'graphic' || lower === 'numeric')) settings.batteryDisplay = lower;
    else if (key === 'backlight on button hold' && (lower === 'normal' || lower === 'off' || lower === 'on')) settings.backlightOnHold = lower;
    else if (key === 'scroll speed') settings.scrollSpeed = integer(value, settings.scrollSpeed ?? 14);
    else if (key === 'scroll delay') settings.scrollDelay = integer(value, settings.scrollDelay ?? 1500);
    else if (key === 'scroll step') settings.scrollStep = integer(value, settings.scrollStep ?? 1);
    else if (key === 'qs top') settings.qsTop = value;
    else if (key === 'qs bottom') settings.qsBottom = value;
    else if (key === 'qs left') settings.qsLeft = value;
    else if (key === 'qs right') settings.qsRight = value;
  }

  return settings;
};
