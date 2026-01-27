
import { SimulationState, SongMetadata } from '../types';

/**
 * Evaluates a serialized condition string against the current SimulationState.
 */
export const checkCondition = (condition: string | undefined, sim: SimulationState, meta: SongMetadata): boolean => {
    if (!condition) return true;

    // Split AND conditions (all must be true)
    const conditions = condition.split('&').map(s => s.trim());

    for (const cond of conditions) {
        if (!cond) continue;
        const [tagRaw, targetIndexStr] = cond.split(':');
        const targetIndex = parseInt(targetIndexStr);

        // 1. Momentary Volume: %?mv(x)
        if (tagRaw.startsWith('mv(')) {
            const match = tagRaw.match(/mv\(([\d.]+)\)/);
            if (match) {
                const durationSec = parseFloat(match[1]);
                const elapsed = (Date.now() - sim.volumeLastChanged) / 1000;
                // Branch 0 is "Active"
                const isActive = elapsed < durationSec;
                if (targetIndex === 0 && !isActive) return false;
                if (targetIndex === 1 && isActive) return false;
            }
            continue;
        }

        // 2. Playback Status (%mp)
        if (tagRaw === 'mp') {
            const map = { 'stop': 0, 'play': 1, 'pause': 2, 'ffwd': 3, 'rew': 4 };
            if (map[sim.playStatus] !== targetIndex) return false;
            continue;
        }

        // 3. Shuffle (%ps)
        if (tagRaw === 'ps') {
            const val = sim.shuffle ? 1 : 0;
            if (val !== targetIndex) return false;
            continue;
        }

        // 4. Repeat (%mm)
        if (tagRaw === 'mm') {
            const map = { 'off': 0, 'all': 1, 'one': 2 };
            if (map[sim.repeat] !== targetIndex) return false;
            continue;
        }

        // 5. Battery Power (%bp)
        if (tagRaw === 'bp') {
            const val = sim.externalPower ? 1 : 0;
            if (val !== targetIndex) return false;
            continue;
        }

        // 6. Battery Charging (%bc)
        if (tagRaw === 'bc') {
            const val = sim.isCharging ? 1 : 0;
            if (val !== targetIndex) return false;
            continue;
        }

        // 7. Hold Switch (%mh)
        if (tagRaw === 'mh') {
            const val = sim.isHold ? 1 : 0;
            if (val !== targetIndex) return false;
            continue;
        }

        // 8. Disk Activity / LED (%lh)
        if (tagRaw === 'lh') {
            const val = sim.diskActivity ? 1 : 0;
            if (val !== targetIndex) return false;
            continue;
        }

        // 9. Album Art Present (%C)
        if (tagRaw === 'C') {
            const hasArt = !!meta.albumArt && meta.albumArt.length > 0;
            const val = hasArt ? 1 : 0;
            if (val !== targetIndex) return false;
            continue;
        }

        // 10. Battery Level Logic (%bl) - Approximation for strips
        if (tagRaw === 'bl') {
             const numSegments = 10; 
             const segment = Math.min(numSegments - 1, Math.floor(sim.batteryLevel / (100/numSegments)));
             if (segment !== targetIndex) return false;
        }
        
        // 11. Volume Level Logic (%pv) 
        if (tagRaw === 'pv') {
             const norm = Math.max(0, (sim.volume + 60) / 60);
             const numSegments = 10; 
             const segment = Math.min(numSegments - 1, Math.floor(norm * numSegments));
             if (segment !== targetIndex) return false;
        }
    }

    return true;
};

/**
 * Parses a Rockbox string with tags for display (Text Content).
 * Handles %t(time) sublines based on sim.sublineCycle.
 * Handles %Sx(English) translations.
 */
export const parseRockboxString = (
    text: string, 
    sim: SimulationState, 
    meta: SongMetadata
): string => {
    let output = text;

    // 0. Translation Tags: %Sx(Fallback)
    // We just strip the tag and use the fallback content
    output = output.replace(/%Sx\(([^)]*)\)/g, '$1');

    // 1. Handle Timed Sublines: %t(5)Line1;%t(2)Line2;Line3
    if (output.includes(';')) {
        const parts = output.split(';');
        const sublines: { text: string, duration: number }[] = [];
        
        parts.forEach(part => {
            const match = part.match(/^%t\((\d+(?:\.\d+)?)\)(.*)/);
            if (match) {
                sublines.push({ duration: parseFloat(match[1]), text: match[2] });
            } else {
                sublines.push({ duration: 2, text: part });
            }
        });

        const totalDuration = sublines.reduce((acc, l) => acc + l.duration, 0);
        const cyclePos = sim.sublineCycle % totalDuration;
        
        let currentT = 0;
        let activeText = sublines[0].text;
        
        for (const line of sublines) {
            if (cyclePos >= currentT && cyclePos < currentT + line.duration) {
                activeText = line.text;
                break;
            }
            currentT += line.duration;
        }
        
        output = activeText;
    }

    // 2. Metadata Replacement
    output = output.replace(/%s/g, meta.title || "No Title");
    output = output.replace(/%a/g, meta.artist || "No Artist");
    output = output.replace(/%id/g, meta.album || "No Album");
    output = output.replace(/%it/g, meta.title || ""); 
    output = output.replace(/%ia/g, meta.artist || "");
    output = output.replace(/%in/g, meta.trackNum.toString());
    output = output.replace(/%ik/g, "1");
    output = output.replace(/%iy/g, "2023");
    
    // 3. Technical
    output = output.replace(/%fc/g, meta.format);
    output = output.replace(/%fb/g, meta.kbps.toString());
    
    // 4. Time
    const fmtTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };
    output = output.replace(/%pc/g, fmtTime(meta.currentSec));
    output = output.replace(/%pt/g, fmtTime(meta.totalSec));
    output = output.replace(/%pr/g, "-" + fmtTime(Math.max(0, meta.totalSec - meta.currentSec)));
    output = output.replace(/%pp/g, meta.trackNum.toString());
    output = output.replace(/%pe/g, meta.totalTracks.toString());

    // 5. System
    output = output.replace(/%bl/g, sim.batteryLevel.toString());
    output = output.replace(/%pv/g, sim.volume + " dB");
    
    // Clock
    const [hh, mm] = sim.currentTime.split(':');
    output = output.replace(/%cH/g, hh);
    output = output.replace(/%cM/g, mm);
    const h12 = parseInt(hh) % 12 || 12;
    output = output.replace(/%cl/g, h12.toString());
    output = output.replace(/%cP/g, parseInt(hh) >= 12 ? 'PM' : 'AM');
    output = output.replace(/%cp/g, parseInt(hh) >= 12 ? 'pm' : 'am');

    return output;
};
