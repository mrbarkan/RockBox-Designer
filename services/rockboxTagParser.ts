
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

    // Pre-process: Handle %t(time) tags (Alternating Sublines)
    // For now, we just strip the tag and show the first subline if multiple exist, 
    // or just clean up the syntax so it displays readable text.
    // Example: "%t(5)Title;%t(5)Artist" -> "Title" (or ideally cycle)
    if (output.includes('%t')) {
        // Simple regex to remove %t(...)
        output = output.replace(/%t\(\d+(\.\d+)?\)/g, '');
        // Split by semicolon and take the first part to avoid clutter
        const parts = output.split(';');
        if (parts.length > 0) output = parts[0];
    }

    // 1. Basic Metadata Tags
    output = output.replace(/%s/g, meta.title);
    output = output.replace(/%a/g, meta.artist);
    output = output.replace(/%id/g, meta.album);
    output = output.replace(/%it/g, meta.title); // Track Title
    output = output.replace(/%ia/g, meta.artist);
    output = output.replace(/%ic/g, "Composer Name"); // Placeholder
    output = output.replace(/%iA/g, "Album Artist"); // Placeholder
    output = output.replace(/%iG/g, "Grouping");
    output = output.replace(/%ig/g, "Genre");
    output = output.replace(/%in/g, meta.trackNum.toString());
    output = output.replace(/%ik/g, "1"); // Disc Num
    output = output.replace(/%iy/g, "1981"); // Year
    output = output.replace(/%iv/g, "2.3"); // ID3 Ver
    output = output.replace(/%iC/g, "Comment");

    // 2. Next Track
    output = output.replace(/%It/g, "Next Song Title"); 
    output = output.replace(/%Ia/g, "Next Artist");
    output = output.replace(/%Id/g, "Next Album");
    output = output.replace(/%If/g, "next_song.mp3");

    // 3. Technical Metadata
    output = output.replace(/%fn/g, "filename.mp3");
    output = output.replace(/%fp/g, "/Music/Kraftwerk/Computer World/filename.mp3");
    output = output.replace(/%fc/g, meta.format);
    output = output.replace(/%fb/g, meta.kbps.toString());
    output = output.replace(/%fz/g, "4.2 MB");
    
    // 4. Time & Progress
    const fmtTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    // Calculate Percentage
    const pct = meta.totalSec > 0 ? Math.floor((meta.currentSec / meta.totalSec) * 100) : 0;

    output = output.replace(/%pc/g, fmtTime(meta.currentSec)); // Current Time
    output = output.replace(/%pt/g, fmtTime(meta.totalSec));   // Total Time
    output = output.replace(/%tt/g, fmtTime(meta.totalSec));   // Alias for Total
    output = output.replace(/%pr/g, "-" + fmtTime(meta.totalSec - meta.currentSec)); // Remaining
    output = output.replace(/%px/g, pct.toString()); // Percentage
    output = output.replace(/%pp/g, meta.trackNum.toString()); // Playlist Pos
    output = output.replace(/%pe/g, meta.totalTracks.toString()); // Playlist End/Total

    // 5. System Status
    output = output.replace(/%bl/g, sim.batteryLevel.toString());
    output = output.replace(/%bv/g, "3.75V");
    output = output.replace(/%bt/g, "10h 20m");
    output = output.replace(/%pv/g, sim.volume + "dB");
    
    // 6. DB / FM
    output = output.replace(/%rp/g, "42"); // Play count
    output = output.replace(/%rr/g, "5"); // Rating
    output = output.replace(/%Rg/g, "-1.5 dB"); // ReplayGain
    
    output = output.replace(/%tf/g, "104.5 MHz");
    output = output.replace(/%ti/g, "Rock FM");
    output = output.replace(/%ts/g, "Strong");

    // Clock
    const [hh, mm] = sim.currentTime.split(':');
    output = output.replace(/%cH/g, hh);
    output = output.replace(/%cM/g, mm);
    // 12h format simulation
    const h12 = parseInt(hh) % 12 || 12;
    output = output.replace(/%cl/g, h12.toString());
    output = output.replace(/%cP/g, parseInt(hh) >= 12 ? 'PM' : 'AM');
    output = output.replace(/%cp/g, parseInt(hh) >= 12 ? 'pm' : 'am');
    output = output.replace(/%cb/g, "Oct");
    output = output.replace(/%cd/g, "24");
    output = output.replace(/%cY/g, "2023");
    output = output.replace(/%ca/g, "Tue");

    // 7. Conditionals: %?xx<true|false>
    const conditionalRegex = /%\?([a-zA-Z0-9]+)<([^>]+)>/g;
    
    output = output.replace(conditionalRegex, (match, tag, content) => {
        const options = content.split('|');
        let selectedIndex = 0;

        switch(tag) {
            case 'mp': // Play status
                if (sim.playStatus === 'stop') selectedIndex = 0;
                else if (sim.playStatus === 'play') selectedIndex = 1;
                else if (sim.playStatus === 'pause') selectedIndex = 2;
                else if (sim.playStatus === 'ffwd') selectedIndex = 3;
                else if (sim.playStatus === 'rew') selectedIndex = 4;
                break;
            case 'cf': // Crossfade
                selectedIndex = 0; // Off
                break;
            case 'tS': // FM Stereo
                selectedIndex = 1; // Stereo
                break;
            case 'ps': // Shuffle
                selectedIndex = sim.shuffle ? 1 : 0;
                break;
            case 'mm': // Repeat mode
                 if (sim.repeat === 'off') selectedIndex = 0;
                 else if (sim.repeat === 'all') selectedIndex = 1;
                 else if (sim.repeat === 'one') selectedIndex = 2;
                 break;
            case 'mh': // Hold
                 selectedIndex = sim.isHold ? 1 : 0;
                 break;
            case 'lh': // LED
                 selectedIndex = 0; // HDD inactive
                 break;
        }

        // Return the selected option, or empty string if out of bounds
        return options[selectedIndex] !== undefined ? options[selectedIndex] : (options[0] || '');
    });

    return output;
};
