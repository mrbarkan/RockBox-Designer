
import { SimulationState, SongMetadata } from '../types';

/**
 * Evaluates a serialized condition string against the current SimulationState.
 * Condition format: "tag:index & tag2:index"
 * Examples: 
 *  "mp:1" (Play status is Play)
 *  "mp:1 & ps:0" (Play status Play AND Shuffle Off)
 *  "mv(2.5):0" (Momentary Volume logic)
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
        // Syntax stored as "mv(x):0" where 0 is the "active" branch usually
        if (tagRaw.startsWith('mv(')) {
            const match = tagRaw.match(/mv\(([\d.]+)\)/);
            if (match) {
                const durationSec = parseFloat(match[1]);
                const elapsed = (Date.now() - sim.volumeLastChanged) / 1000;
                // Branch 0 is "Active", Branch 1 is "Inactive" (usually empty)
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

        // 5. Battery Power (%bp) - 0: Battery, 1: External
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
            // Logic: 0 = No Art, 1 = Has Art
            const hasArt = !!meta.albumArt && meta.albumArt.length > 0;
            const val = hasArt ? 1 : 0;
            if (val !== targetIndex) return false;
            continue;
        }

        // 10. Battery Level Logic (%bl) - Usually integer ranges in parser, but if simplified to <10|20|...>:
        // This is complex because %bl matches ranges. For xhibition (sprite frames), 
        // the parser usually generated one element per frame with %bl condition?
        // Actually, for images, we often use %?bl<%xd(a)|%xd(b)...>
        // The index corresponds to the battery level bucket.
        // If the parser preserved the buckets, targetIndex is the bucket index.
        // Assuming 10 buckets for standard strips:
        if (tagRaw === 'bl') {
             // Heuristic: If targetIndex is small (0-20), treat as bucket
             const bucket = Math.floor(sim.batteryLevel / 10); // 0-10
             // Correction: 100% is bucket 10 or 9? Usually last branch catches all.
             // If conditionals were %?bl<0|10|20...>, Rockbox evaluates "which branch matches current value?"
             // Actually Rockbox %?bl<a|b|c> divides 100% by N branches.
             // We need to know N (total branches) to calc bucket.
             // Since we don't know N here easily without parsing context, 
             // we assume standard 10-20 frame strips for now or rely on specific mappings.
             // For strict correctness we'd need total branches.
             // Let's approximate: 
             // If index is being checked, assume linear distribution.
             // We'll pass for now if we can't determine.
             // BETTER: The parser should have emitted specific ranges? 
             // Rockbox logic: "If value is X, print branch Y".
             // For %bl, it divides the range. 
             // We will assume 10 segments for now as standard.
             const numSegments = 10; // Default guess
             const segment = Math.min(numSegments - 1, Math.floor(sim.batteryLevel / (100/numSegments)));
             if (segment !== targetIndex) return false;
        }
        
        // 11. Volume Level Logic (%pv) - Similar to Battery
        if (tagRaw === 'pv') {
             // Map -60dB to 0dB into segments?
             // Standard volume strips often have ~10-15 frames.
             // sim.volume is -60 to 0.
             // Normalized 0-1.
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
 */
export const parseRockboxString = (
    text: string, 
    sim: SimulationState, 
    meta: SongMetadata
): string => {
    let output = text;

    // 1. Handle Timed Sublines: %t(5)Line1;%t(2)Line2;Line3
    if (output.includes(';')) {
        const parts = output.split(';');
        // Parse the timings for each part
        const sublines: { text: string, duration: number }[] = [];
        
        parts.forEach(part => {
            const match = part.match(/^%t\((\d+(?:\.\d+)?)\)(.*)/);
            if (match) {
                sublines.push({ duration: parseFloat(match[1]), text: match[2] });
            } else {
                // Default duration if missing tag on a subline (Rockbox defaults to 1s or prev)
                sublines.push({ duration: 2, text: part });
            }
        });

        // Determine active subline based on global cycle
        // Total cycle time
        const totalDuration = sublines.reduce((acc, l) => acc + l.duration, 0);
        // Current position in cycle (sim.sublineCycle is a counter, let's assume it increments 10Hz)
        // Let's treat sim.sublineCycle as seconds * 10 or similar? 
        // Let's assume sim.sublineCycle is ms for accuracy or ticks.
        // Let's use sim.sublineCycle as "Seconds elapsed since start".
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
