
import React, { useRef } from 'react';
import { SimulationState, SongMetadata, ScreenType } from '../types';

interface SimulationPanelProps {
  sim: SimulationState;
  meta: SongMetadata;
  onUpdateSim: (updates: Partial<SimulationState>) => void;
  onUpdateMeta: (updates: Partial<SongMetadata>) => void;
  onLoadTrack?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  activeScreen: ScreenType;
}

const Toggle = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: () => void }) => (
    <button
      type="button"
      onClick={onChange}
      className={`flex items-center justify-between p-2 border cursor-pointer select-none transition-colors ${checked ? 'bg-orange-600 border-black text-white' : 'bg-[#333] border-[#444] text-gray-400'}`}
    >
        <span className="font-bold text-[9px] uppercase">{label}</span>
        <span className={`w-3 h-3 rounded-full ${checked ? 'bg-white' : 'bg-black'}`}></span>
    </button>
);

const activityOptions = [
  [1, 'Main menu'],
  [2, 'Now playing'],
  [3, 'Recording'],
  [4, 'FM radio'],
  [6, 'Settings'],
  [7, 'Files'],
  [10, 'Quick screen'],
  [15, 'System'],
  [21, 'USB (stock)']
] as const;

export const SimulationPanel: React.FC<SimulationPanelProps> = ({ sim, meta, onUpdateSim, onUpdateMeta, onLoadTrack, activeScreen }) => {
  const trackInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-[#1a1a1a] border-t border-black p-4 grid grid-cols-4 gap-4 text-[10px] text-gray-400 font-mono select-none shadow-[0_-5px_10px_rgba(0,0,0,0.3)] z-10 h-64 overflow-y-auto custom-scrollbar">
      
      {/* 1. Playback & Transport */}
      <div className="border border-[#333] bg-[#222] p-3 flex flex-col gap-3 relative">
        <div className="absolute -top-2 left-2 bg-[#1a1a1a] px-1 text-orange-600 font-bold tracking-widest uppercase">Transport (%mp)</div>
        <div className="flex gap-1 mt-1">
            {['stop', 'play', 'pause'].map((s) => (
                <button
                    key={s}
                    onClick={() => onUpdateSim({ playStatus: s as any })}
                    className={`flex-1 py-3 uppercase font-bold text-[9px] border border-black active:translate-y-[1px] transition-colors
                        ${sim.playStatus === s ? 'bg-orange-600 text-white' : 'bg-[#333] hover:bg-[#444]'}
                    `}
                >
                    {s}
                </button>
            ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
            <Toggle label="Shuffle (%ps)" checked={sim.shuffle} onChange={() => onUpdateSim({ shuffle: !sim.shuffle })} />
            <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-gray-500 uppercase">Repeat (%mm)</label>
                <select value={sim.repeat} onChange={(e) => onUpdateSim({ repeat: e.target.value as any })} className="bg-[#111] border border-[#444] text-gray-300 text-[10px] p-1 uppercase w-full">
                    <option value="off">Off</option>
                    <option value="all">All</option>
                    <option value="one">One</option>
                </select>
            </div>
        </div>
        <div className="mt-2 pt-2 border-t border-[#444]">
             <label className="text-[9px] font-bold text-gray-500 uppercase">Elapsed / Total</label>
             <div className="flex gap-2 mt-1">
                 <input type="number" value={meta.currentSec} onChange={e => onUpdateMeta({ currentSec: parseInt(e.target.value) })} className="w-full bg-black border border-[#444] p-1 text-right" />
                 <span className="self-center">/</span>
                 <input type="number" value={meta.totalSec} onChange={e => onUpdateMeta({ totalSec: parseInt(e.target.value) })} className="w-full bg-black border border-[#444] p-1 text-right" />
             </div>
        </div>
      </div>

      {/* 2. System State */}
      <div className="border border-[#333] bg-[#222] p-3 flex flex-col gap-3 relative">
        <div className="absolute -top-2 left-2 bg-[#1a1a1a] px-1 text-gray-500 font-bold tracking-widest uppercase">Power / Disk</div>
        
        <div className="space-y-2 mt-1">
             <div className="flex items-center gap-2">
                 <input type="range" min={0} max={100} value={sim.batteryLevel} onChange={(e) => onUpdateSim({ batteryLevel: parseInt(e.target.value) })} className="flex-1" />
                 <span className="w-8 text-right text-white">{sim.batteryLevel}%</span>
             </div>
             
             <div className="grid grid-cols-2 gap-2">
                <Toggle label="Chrg %bc" checked={sim.isCharging} onChange={() => onUpdateSim({ isCharging: !sim.isCharging })} />
                <Toggle label="Ext %bp" checked={sim.externalPower} onChange={() => onUpdateSim({ externalPower: !sim.externalPower })} />
                <Toggle label="Hold %mh" checked={sim.isHold} onChange={() => onUpdateSim({ isHold: !sim.isHold })} />
                <Toggle label="Disk %lh" checked={sim.diskActivity} onChange={() => onUpdateSim({ diskActivity: !sim.diskActivity })} />
             </div>
        </div>
      </div>

      {/* 3. Audio / Momentary */}
      <div className="border border-[#333] bg-[#222] p-3 flex flex-col gap-3 relative">
         <div className="absolute -top-2 left-2 bg-[#1a1a1a] px-1 text-gray-500 font-bold tracking-widest uppercase">Audio / Events</div>
         
         <div className="mt-1">
             <div className="flex justify-between mb-1">
                 <span>VOL (%pv)</span>
                 <span className="text-white">{sim.volume}dB</span>
             </div>
             <input type="range" min={-60} max={0} value={sim.volume} onChange={(e) => onUpdateSim({ volume: parseInt(e.target.value) })} className="w-full" />
         </div>

         <button 
            onMouseDown={() => onUpdateSim({ volumeLastChanged: Date.now() })}
            className="w-full py-2 bg-[#444] hover:bg-white hover:text-black border border-black text-xs font-bold uppercase transition-colors"
         >
             Trigger Vol Change (%mv)
         </button>
         
         <div className="text-[9px] text-gray-600 text-center">
             Click to update timestamp. %mv active for ~2s.
         </div>
      </div>

      {/* 4. Screen-specific state */}
      <div className="border border-[#333] bg-[#222] p-3 flex flex-col gap-3 relative">
         <div className="absolute -top-2 left-2 bg-[#1a1a1a] px-1 text-gray-500 font-bold tracking-widest uppercase">
           {activeScreen === 'sbs' ? 'Menu state' : activeScreen === 'fms' ? 'FM state' : activeScreen === 'usb' ? 'USB boundary' : 'Metadata (%?)'}
         </div>

         {activeScreen === 'sbs' ? (
           <div className="flex flex-col gap-2 mt-1">
             <select value={sim.currentActivity} onChange={event => onUpdateSim({ currentActivity: Number(event.target.value) })} className="bg-black border border-[#444] p-1 text-gray-200">
               {activityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
             </select>
             <input type="text" aria-label="Menu title" value={sim.menuTitle} onChange={event => onUpdateSim({ menuTitle: event.target.value })} className="bg-black border border-[#444] p-1 text-orange-500" />
             <Toggle label="12-hour clock %cf" checked={sim.clock12Hour} onChange={() => onUpdateSim({ clock12Hour: !sim.clock12Hour })} />
             <div className="flex items-center gap-2">
               <button onClick={() => onUpdateSim({ menuSelectedIndex: Math.max(0, sim.menuSelectedIndex - 1) })} className="border border-[#444] bg-[#333] px-3 py-2">▲</button>
               <div className="min-w-0 flex-1 truncate text-center text-white">{sim.menuItems[sim.menuSelectedIndex] ?? 'No item'}</div>
               <button onClick={() => onUpdateSim({ menuSelectedIndex: Math.min(sim.menuItems.length - 1, sim.menuSelectedIndex + 1) })} className="border border-[#444] bg-[#333] px-3 py-2">▼</button>
             </div>
             <div className="text-[9px] text-gray-600">Quick screen and USB use stock Rockbox activity layouts inside the SBS theme.</div>
           </div>
         ) : activeScreen === 'fms' ? (
           <div className="grid grid-cols-2 gap-2 mt-1">
             <label className="col-span-2 flex items-center gap-2"><span>MHz</span><input type="number" step="0.1" value={sim.fmFrequency} onChange={event => onUpdateSim({ fmFrequency: Number(event.target.value) })} className="min-w-0 flex-1 bg-black border border-[#444] p-1 text-orange-500" /></label>
             <input type="text" aria-label="FM preset" value={sim.fmPresetName} onChange={event => onUpdateSim({ fmPresetName: event.target.value })} className="col-span-2 bg-black border border-[#444] p-1" />
             <label className="col-span-2 flex items-center gap-2"><span>Signal</span><input type="range" min={0} max={100} value={sim.fmSignalStrength} onChange={event => onUpdateSim({ fmSignalStrength: Number(event.target.value) })} className="min-w-0 flex-1" /></label>
             <Toggle label="Stereo %ts" checked={sim.fmStereo} onChange={() => onUpdateSim({ fmStereo: !sim.fmStereo })} />
             <Toggle label="Tuned %tt" checked={sim.fmTuned} onChange={() => onUpdateSim({ fmTuned: !sim.fmTuned })} />
             <Toggle label="Scan %tm" checked={sim.fmScanMode} onChange={() => onUpdateSim({ fmScanMode: !sim.fmScanMode })} />
             <Toggle label="RDS %tx" checked={sim.fmRdsAvailable} onChange={() => onUpdateSim({ fmRdsAvailable: !sim.fmRdsAvailable })} />
           </div>
         ) : activeScreen === 'usb' ? (
           <div className="mt-1 border border-amber-600 bg-amber-950/40 p-3 text-[10px] leading-relaxed text-amber-200">
             Stock USB behavior preview. Standard themes do not export a <strong>.usb</strong> screen file; arbitrary USB redesign belongs to opt-in Firmware Mode.
           </div>
         ) : (
         <div className="flex flex-col gap-2 mt-1">
            <div className="flex gap-2">
                <input type="text" placeholder="Title %s" value={meta.title} onChange={e => onUpdateMeta({ title: e.target.value })} className="flex-1 bg-black border border-[#444] p-1 text-orange-500" />
                <input type="text" placeholder="Artist %a" value={meta.artist} onChange={e => onUpdateMeta({ artist: e.target.value })} className="flex-1 bg-black border border-[#444] p-1 text-orange-500" />
            </div>
            
            <div className="flex gap-2 items-center">
                 <button onClick={() => trackInputRef.current?.click()} className="px-2 py-1 bg-[#333] border border-black hover:bg-[#555]">Load File</button>
                 <Toggle label="Has Art (%C)" checked={!!meta.albumArt} onChange={() => onUpdateMeta({ albumArt: meta.albumArt ? "" : "PLACEHOLDER" })} />
            </div>

            <input type="file" ref={trackInputRef} onChange={onLoadTrack} accept="audio/*" className="hidden" />
            
            <div className="flex justify-between text-[9px] text-gray-500 border-t border-[#333] pt-2">
                <span>Subline Timer: {sim.sublineCycle.toFixed(1)}s</span>
            </div>
         </div>
         )}
      </div>

    </div>
  );
};
