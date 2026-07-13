import { DEFAULT_SIMULATION, DEFAULT_SONG } from '../../../constants';
import { encodePpm, renderToPixelImage } from '../../../rockbox/rendering/pixelRenderer';
import { interpretSkin } from '../../../rockbox/semantics';
import { parseRockbox } from '../../../rockbox/syntax';

const options = {
  width: 320,
  height: 240,
  defaultFont: '18-Cantarell-Regular.fnt',
  foreground: '#292829',
  background: '#ffffff',
  sim: DEFAULT_SIMULATION,
  song: DEFAULT_SONG,
  settings: {
    'selector color': '#e7e7e7',
    'selector text color': '#000000',
    'line selector': 'bar_color',
    scrollbar: 'off',
    'show icons': true,
    iconset: '/.rockbox/icons/adwaitapod.bmp'
  }
};

export const buildPhase3SbsGolden = () => {
  const document = parseRockbox([
    '%V(0,0,320,240,-)',
    '%VI(Menu)',
    '%Vi(Menu,4,28,175,208,-)'
  ].join('\n'));
  const semantic = interpretSkin(document, { ...options, screen: 'sbs' });
  return encodePpm(renderToPixelImage(320, 240, semantic.operations, options.background));
};

export const buildPhase3FmsGolden = () => {
  const document = parseRockbox([
    '%V(0,0,320,240,-)',
    '%ac%Tn',
    '%ac%tf MHz',
    '%ac%?ts<Stereo|Mono>',
    '%ac%?tx<%ty - %tz|No RDS>',
    '%tr(20,180,280,8,-)'
  ].join('\n'));
  const semantic = interpretSkin(document, { ...options, screen: 'fms', sim: { ...DEFAULT_SIMULATION, currentActivity: 4 } });
  return encodePpm(renderToPixelImage(320, 240, semantic.operations, options.background));
};
