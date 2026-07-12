import { DEFAULT_SIMULATION, DEFAULT_SONG } from '../../../constants';
import { encodePpm, renderToPixelImage } from '../../../rockbox/rendering';
import { interpretWps } from '../../../rockbox/semantics';
import { parseRockbox } from '../../../rockbox/syntax';

export const PHASE2_GOLDEN_SOURCE = [
  '%V(4,4,120,40,-)',
  '%Vf(ff5800)%alPhase 2',
  '%V(4,50,120,8,-)%Vf(ffffff)%Vb(202020)%pb(0,0,120,8,-)',
  '%Cl(160,20,80,80,c,c)%Cd',
  '%T(10,110,40,20,play)',
  '%zzFuture(alpha)'
].join('\n');

export const buildPhase2Golden = () => {
  const result = interpretWps(parseRockbox(PHASE2_GOLDEN_SOURCE), {
    width: 320, height: 240, defaultFont: '14-Nimbus.fnt',
    foreground: '#ffffff', background: '#000000',
    sim: DEFAULT_SIMULATION,
    song: { ...DEFAULT_SONG, currentSec: 90, totalSec: 240 }
  });
  return encodePpm(renderToPixelImage(320, 240, result.operations, '#000000'));
};
