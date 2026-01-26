
import React, { useRef } from 'react';
import { SimulationState, SongMetadata } from '../types';

interface SimulationPanelProps {
  sim: SimulationState;
  meta: SongMetadata;
  onUpdateSim: (updates: Partial<SimulationState>) => void;
  onUpdateMeta: (updates: Partial<SongMetadata>) => void;
  onLoadTrack?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const SimulationPanel: React.FC<SimulationPanelProps> = ({ sim, meta, onUpdateSim, onUpdateMeta, onLoadTrack }) => {
  const trackInputRef = useRef<HTMLInputElement>(null);

  const Toggle = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: () => void }) => (
      <div 
        onClick={onChange}
        className={`flex items-center justify-between p-2 border cursor-pointer select-none transition-colors ${checked ? 'bg-orange-600 border-black text-white' : 'bg-[#333] border-[#444] text-gray-400'}`}
      >
          <span className="font-bold text-[9px] uppercase">{label}</span>
          <div className={`w-3 h-3 rounded-full ${checked ? 'bg-white' : 'bg-black'}`}></div>
      </div>
  );

  const EnumSelect = ({ label, value, options, onChange }: any) => (
      <div className="flex flex-col gap-1">
          <label className="text-[9px] font-bold text-gray-500 uppercase">{label}</label>
          <select 
            value={value} 
            onChange={(e) => onChange(e.target.value)}
            className="bg-[#111] border border-[#444] text-gray-300 text-[10px] p-1 uppercase"
          >
              {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
          </select>
      </div>
  );

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

      {/* 4. Metadata Override */}
      <div className="border border-[#333] bg-[#222] p-3 flex flex-col gap-3 relative">
         <div className="absolute -top-2 left-2 bg-[#1a1a1a] px-1 text-gray-500 font-bold tracking-widest uppercase">Metadata (%?)</div>
         
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
      </div>

    </div>
  );
};
