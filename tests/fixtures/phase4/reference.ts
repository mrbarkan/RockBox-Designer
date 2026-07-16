import { DEFAULT_SIMULATION, DEFAULT_SONG } from '../../../constants';
import { renderToPixelImage } from '../../../rockbox/rendering/pixelRenderer';
import { interpretSkin } from '../../../rockbox/semantics';
import { parseRockbox } from '../../../rockbox/syntax';

export const PHASE4_REFERENCE_SCREEN = 'sbs' as const;
export const PHASE4_REFERENCE_SOURCE = [
  '%V(0,0,320,240,-)',
  '%Vf(000000)%Vb(ffffff)',
  '%VI(Menu)',
  '%Vi(Menu,4,16,312,220,-)'
].join('\n');
export const PHASE4_REFERENCE_VIEWPORT = { x: 4, y: 16, width: 312, height: 220 };

export const buildPhase4BrowserReference = () => {
  const simulation = {
    ...DEFAULT_SIMULATION,
    sublineCycle: 0,
    menuSelectedIndex: 0
  };
  const semantic = interpretSkin(parseRockbox(PHASE4_REFERENCE_SOURCE), {
    width: 320,
    height: 240,
    defaultFont: '12-Sys-Proportional.fnt',
    foreground: '#000000',
    background: '#ffffff',
    sim: simulation,
    song: DEFAULT_SONG,
    settings: {
      'selector color': '#c6c6c6',
      'selector text color': '#000000',
      'line selector': 'bar_color',
      scrollbar: 'off',
      'show icons': false
    },
    screen: PHASE4_REFERENCE_SCREEN
  });
  if (!semantic.valid) throw new Error('The Phase 4 browser reference source is invalid.');
  return {
    semantic,
    image: renderToPixelImage(320, 240, semantic.operations, '#ffffff')
  };
};
