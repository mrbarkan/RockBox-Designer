
import React, { useState } from 'react';

interface ColorPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  palette: string[];
  onUpdatePalette: (newPalette: string[]) => void;
}

export const ColorPaletteModal: React.FC<ColorPaletteModalProps> = ({ isOpen, onClose, palette, onUpdatePalette }) => {
  const [newColor, setNewColor] = useState('#000000');

  if (!isOpen) return null;

  const handleAdd = () => {
    if (!palette.includes(newColor)) {
      onUpdatePalette([...palette, newColor]);
    }
  };

  const handleRemove = (color: string) => {
    onUpdatePalette(palette.filter(c => c !== color));
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[#e0e0e0] border-2 border-black w-80 shadow-[12px_12px_0px_black] animate-bounce-in">
        <div className="bg-[#2a2a2a] text-white p-3 border-b border-black flex justify-between items-center select-none">
          <span className="font-bold text-sm uppercase tracking-widest">Color Palette</span>
          <button onClick={onClose} className="hover:text-orange-500 text-lg px-2">×</button>
        </div>
        
        <div className="p-6">
          {/* Add New */}
          <div className="flex gap-3 mb-6">
            <input 
              type="color" 
              value={newColor} 
              onChange={e => setNewColor(e.target.value)} 
              className="w-10 h-10 p-0 border border-black cursor-pointer"
            />
            <input 
              type="text" 
              value={newColor} 
              onChange={e => setNewColor(e.target.value)}
              className="flex-1 border border-black p-2 font-mono text-sm uppercase"
            />
            <button 
              onClick={handleAdd}
              className="px-4 bg-white border border-black font-bold hover:bg-orange-500 hover:text-white text-lg"
            >
              +
            </button>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-4 gap-3">
            {palette.map((color, idx) => (
              <div key={idx} className="group relative w-full pt-[100%] border border-black shadow-sm" style={{ backgroundColor: color }}>
                <button 
                  onClick={() => handleRemove(color)}
                  className="absolute top-0 right-0 bg-red-500 text-white w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100"
                  title="Remove"
                >
                  ×
                </button>
                <div 
                  className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] font-mono text-center opacity-0 group-hover:opacity-100 cursor-pointer py-1"
                  onClick={() => { navigator.clipboard.writeText(color); alert(`Copied ${color}`); }}
                >
                  {color}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
