import { SimulationState, SongMetadata } from '../types';

/**
 * Parses a Rockbox string with tags and conditionals against the current simulation state.
 */
export const parseRockboxString = (
    text: string, 
    sim: SimulationState, 
    meta: SongMetadata
): string => {
    let output = text;

    // 1. Basic Metadata Tags
    output = output.replace(/%s/g, meta.title);
    output = output.replace(/%a/g, meta.artist);
    output = output.replace(/%id/g, meta.album);
    output = output.replace(/%It/g, "Next Song Title"); // Placeholder for next track
    output = output.replace(/%Ia/g, "Next Artist");

    // 2. Technical Metadata
    output = output.replace(/%fc/g, meta.format);
    output = output.replace(/%fb/g, meta.kbps.toString());
    
    // 3. Time & Progress
    // %pc = percent current
    const pct = Math.floor((meta.currentSec / meta.totalSec) * 100);
    output = output.replace(/%pc/g, pct.toString());
    
    // %pt = time elapsed, %pt = time total (simulated)
    const fmtTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };
    output = output.replace(/%pt/g, fmtTime(meta.currentSec));
    output = output.replace(/%pt/g, fmtTime(meta.totalSec)); // This tag is context dependent in reality, usually %pt is elapsed. %tt is total.
    output = output.replace(/%tt/g, fmtTime(meta.totalSec));

    // 4. System Status
    output = output.replace(/%bl/g, sim.batteryLevel.toString());
    output = output.replace(/%pv/g, sim.volume + "dB");
    
    // Clock
    const [hh, mm] = sim.currentTime.split(':');
    output = output.replace(/%cH/g, hh);
    output = output.replace(/%cM/g, mm);
    // 12h format simulation
    const h12 = parseInt(hh) % 12 || 12;
    output = output.replace(/%cl/g, h12.toString());
    output = output.replace(/%cp/g, parseInt(hh) >= 12 ? 'pm' : 'am');


    // 5. Conditionals: %?xx<true|false|option3...>
    // Regex to find %?tag<...> content
    // Note: Nested conditionals are hard with regex, we do single level here for preview.
    const conditionalRegex = /%\?([a-zA-Z0-9]+)<([^>]+)>/g;
    
    output = output.replace(conditionalRegex, (match, tag, content) => {
        const options = content.split('|');
        let selectedIndex = 0;

        switch(tag) {
            case 'mp': // Play status: Stop|Play|Pause|Ffwd|Rew...
                // Rockbox order: Stop, Play, Pause, Ffwd, Rew, Rec, Rec Pause, FM, FM Pause
                if (sim.playStatus === 'stop') selectedIndex = 0;
                else if (sim.playStatus === 'play') selectedIndex = 1;
                else if (sim.playStatus === 'pause') selectedIndex = 2;
                else if (sim.playStatus === 'ffwd') selectedIndex = 3;
                else if (sim.playStatus === 'rew') selectedIndex = 4;
                break;
            
            case 'bl': // Battery Level? Usually %?bl is not a conditional like this, but %bp is charging.
                // Let's assume %?bc (Battery Charging) for this example or custom logic
                break;
            
            case 'ps': // Shuffle
                selectedIndex = sim.shuffle ? 1 : 0;
                break;

            case 'mm': // Repeat mode: Off, All, One, Shuffle
                 if (sim.repeat === 'off') selectedIndex = 0;
                 else if (sim.repeat === 'all') selectedIndex = 1;
                 else if (sim.repeat === 'one') selectedIndex = 2;
                 break;
        }

        // Return the selected option, or empty string if out of bounds
        return options[selectedIndex] || options[0] || '';
    });

    return output;
};
