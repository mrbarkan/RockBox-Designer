import React from 'react';
import { SimulationState, SongMetadata } from '../types';

interface SimulationPanelProps {
  sim: SimulationState;
  meta: SongMetadata;
  onUpdateSim: (updates: Partial<SimulationState>) => void;
  onUpdateMeta: (updates: Partial<SongMetadata>) => void;
}

export const SimulationPanel: React.FC<SimulationPanelProps> = ({ sim, meta, onUpdateSim, onUpdateMeta }) => {
  return (
    <div className="bg-[#1a1a1a] border-t border-black p-4 grid grid-cols-4 gap-4 text-[10px] text-gray-400 font-mono select-none shadow-[0_-5px_10px_rgba(0,0,0,0.3)] z-10">
      
      {/* 1. Playback Control Module */}
      <div className="border border-[#333] bg-[#222] p-2 flex flex-col gap-2 relative group">
        <div className="absolute -top-2 left-2 bg-[#1a1a1a] px-1 text-orange-600 font-bold tracking-widest uppercase">Transport</div>
        
        <div className="flex gap-1 mt-1">
            {['stop', 'play', 'pause'].map((s) => (
                <button
                    key={s}
                    onClick={() => onUpdateSim({ playStatus: s as any })}
                    className={`flex-1 py-3 uppercase font-bold text-[9px] border border-black active:translate-y-[1px] transition-colors
                        ${sim.playStatus === s 
                            ? 'bg-orange-600 text-white shadow-[0_0_5px_rgba(255,88,0,0.5)]' 
                            : 'bg-[#333] text-gray-400 hover:bg-[#444]'}
                    `}
                >
                    {s}
                </button>
            ))}
        </div>
        
        <div className="mt-2">
             <div className="flex justify-between mb-1 text-gray-500">
                <span>SEEK</span>
                <span className="text-orange-500">{Math.floor(meta.currentSec / 60)}:{(meta.currentSec % 60).toString().padStart(2,'0')}</span>
             </div>
             <input 
                type="range" 
                min={0} 
                max={meta.totalSec} 
                value={meta.currentSec}
                onChange={(e) => onUpdateMeta({ currentSec: parseInt(e.target.value) })}
                className="w-full"
             />
        </div>
      </div>

      {/* 2. System State Module */}
      <div className="border border-[#333] bg-[#222] p-2 flex flex-col gap-3 relative">
        <div className="absolute -top-2 left-2 bg-[#1a1a1a] px-1 text-gray-500 font-bold tracking-widest uppercase">System</div>
        
        <div className="mt-1">
             <div className="flex justify-between mb-1">
                 <span>PWR_LVL</span>
                 <span className="text-white">{sim.batteryLevel}%</span>
             </div>
             <input 
                type="range" 
                min={0} 
                max={100} 
                value={sim.batteryLevel}
                onChange={(e) => onUpdateSim({ batteryLevel: parseInt(e.target.value) })}
             />
        </div>
        <div>
             <div className="flex justify-between mb-1">
                 <span>MAIN_OUT</span>
                 <span className="text-white">{sim.volume}dB</span>
             </div>
             <input 
                type="range" 
                min={-90} 
                max={0} 
                value={sim.volume}
                onChange={(e) => onUpdateSim({ volume: parseInt(e.target.value) })}
             />
        </div>
      </div>

      {/* 3. Metadata Module */}
      <div className="col-span-2 border border-[#333] bg-[#222] p-2 relative">
         <div className="absolute -top-2 left-2 bg-[#1a1a1a] px-1 text-gray-500 font-bold tracking-widest uppercase">ID3_Override</div>
         
         <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-600">TITLE</label>
                <input 
                    type="text" 
                    value={meta.title}
                    onChange={(e) => onUpdateMeta({ title: e.target.value })}
                    className="bg-black border border-[#444] text-orange-500 p-1 lcd-text focus:border-orange-600 outline-none"
                />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-600">ARTIST</label>
                <input 
                    type="text" 
                    value={meta.artist}
                    onChange={(e) => onUpdateMeta({ artist: e.target.value })}
                    className="bg-black border border-[#444] text-orange-500 p-1 lcd-text focus:border-orange-600 outline-none"
                />
            </div>
             <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-600">ALBUM</label>
                <input 
                    type="text" 
                    value={meta.album}
                    onChange={(e) => onUpdateMeta({ album: e.target.value })}
                    className="bg-black border border-[#444] text-orange-500 p-1 lcd-text focus:border-orange-600 outline-none"
                />
            </div>
             <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-600">FMT</label>
                <input 
                    type="text" 
                    value={meta.format}
                    onChange={(e) => onUpdateMeta({ format: e.target.value })}
                    className="bg-black border border-[#444] text-orange-500 p-1 lcd-text focus:border-orange-600 outline-none"
                />
            </div>
         </div>
      </div>
    </div>
  );
};
