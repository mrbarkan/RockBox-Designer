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
    <div className="bg-[#1e1e1e] border-t border-[#333] p-4 grid grid-cols-4 gap-6 text-xs text-gray-300">
      
      {/* 1. Playback Control */}
      <div className="space-y-2">
        <h4 className="font-bold uppercase tracking-wider text-gray-500 mb-2">Playback</h4>
        <div className="flex bg-gray-800 rounded p-1 border border-gray-700">
            {['stop', 'play', 'pause'].map((s) => (
                <button
                    key={s}
                    onClick={() => onUpdateSim({ playStatus: s as any })}
                    className={`flex-1 py-1 capitalize rounded ${sim.playStatus === s ? 'bg-orange-600 text-white shadow' : 'hover:text-white'}`}
                >
                    {s}
                </button>
            ))}
        </div>
        
        <div className="mt-2">
             <label className="block mb-1">Progress: {Math.floor(meta.currentSec / 60)}:{(meta.currentSec % 60).toString().padStart(2,'0')}</label>
             <input 
                type="range" 
                min={0} 
                max={meta.totalSec} 
                value={meta.currentSec}
                onChange={(e) => onUpdateMeta({ currentSec: parseInt(e.target.value) })}
                className="w-full accent-orange-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
             />
        </div>
      </div>

      {/* 2. System State */}
      <div className="space-y-2">
        <h4 className="font-bold uppercase tracking-wider text-gray-500 mb-2">System</h4>
        <div>
             <label className="flex justify-between mb-1">
                 <span>Battery</span>
                 <span>{sim.batteryLevel}%</span>
             </label>
             <input 
                type="range" 
                min={0} 
                max={100} 
                value={sim.batteryLevel}
                onChange={(e) => onUpdateSim({ batteryLevel: parseInt(e.target.value) })}
                className="w-full accent-green-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
             />
        </div>
        <div>
             <label className="flex justify-between mb-1">
                 <span>Volume</span>
                 <span>{sim.volume}dB</span>
             </label>
             <input 
                type="range" 
                min={-90} 
                max={0} 
                value={sim.volume}
                onChange={(e) => onUpdateSim({ volume: parseInt(e.target.value) })}
                className="w-full accent-blue-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
             />
        </div>
      </div>

      {/* 3. Metadata */}
      <div className="space-y-2 col-span-2">
         <h4 className="font-bold uppercase tracking-wider text-gray-500 mb-2">Metadata Override</h4>
         <div className="grid grid-cols-2 gap-2">
            <input 
                type="text" 
                value={meta.title}
                onChange={(e) => onUpdateMeta({ title: e.target.value })}
                placeholder="Title"
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-orange-500"
            />
            <input 
                type="text" 
                value={meta.artist}
                onChange={(e) => onUpdateMeta({ artist: e.target.value })}
                placeholder="Artist"
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-orange-500"
            />
             <input 
                type="text" 
                value={meta.album}
                onChange={(e) => onUpdateMeta({ album: e.target.value })}
                placeholder="Album"
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-orange-500"
            />
             <input 
                type="text" 
                value={meta.format}
                onChange={(e) => onUpdateMeta({ format: e.target.value })}
                placeholder="Format (e.g. FLAC)"
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-orange-500"
            />
         </div>
      </div>
    </div>
  );
};
