
import React, { memo, useState } from 'react';

interface MainMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onExport: () => void;
  onImportZip: () => void;
  onShowFonts: () => void;
  onShowAssets: () => void;
  onShowCompatibility: () => void;
  onShowFirmware: () => void;
}

type MenuButtonProps = {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  onClose: () => void;
  subLabel?: string;
};

const MenuButton = memo(({ icon, label, onClick, onClose, subLabel }: MenuButtonProps) => (
  <button
      onClick={() => { onClick(); onClose(); }}
      className="w-full text-left flex items-center gap-5 p-5 hover:bg-orange-600 hover:text-white border-b border-gray-300 group transition-colors bg-white/50"
  >
      <div className="w-10 h-10 bg-gray-200 border border-gray-400 flex items-center justify-center font-mono text-2xl group-hover:bg-white group-hover:text-black shadow-sm">
          {icon}
      </div>
      <div>
          <div className="font-bold uppercase text-base tracking-wide">{label}</div>
          {subLabel && <div className="text-xs opacity-60 font-mono group-hover:text-white">{subLabel}</div>}
      </div>
  </button>
));
MenuButton.displayName = 'MenuButton';

export const MainMenuModal: React.FC<MainMenuModalProps> = ({
    isOpen, onClose, onNew, onOpen, onSave, onExport, onImportZip, onShowFonts, onShowAssets, onShowCompatibility, onShowFirmware
}) => {
  const [activeTab, setActiveTab] = useState<'menu' | 'about'>('menu');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0" onClick={onClose}></div>

      <div className="bg-[#e0e0e0] pinstripe border-2 border-black w-full max-w-xl shadow-[16px_16px_0px_rgba(0,0,0,1)] flex flex-col max-h-[90vh] animate-bounce-in relative z-10">
        
        <div className="bg-[#2a2a2a] text-white p-5 flex justify-between items-center border-b border-black select-none">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-orange-600 flex items-center justify-center font-bold text-white text-xl border border-white">R</div>
                <h2 className="font-bold uppercase tracking-widest text-base">RockBox Designer</h2>
            </div>
            <button onClick={onClose} className="hover:text-orange-500 font-bold text-2xl px-2">×</button>
        </div>

        <div className="flex flex-1 min-h-0 border-t border-white/50">
            <div className="w-40 bg-[#d4d4d4] border-r border-gray-400 flex flex-col p-3 gap-2 shadow-inner">
                <button 
                    onClick={() => setActiveTab('menu')}
                    className={`text-left px-4 py-3 text-sm font-bold uppercase transition-all ${activeTab === 'menu' ? 'bg-white border border-black shadow-md translate-x-1' : 'text-gray-500 hover:text-black'}`}
                >
                    File Ops
                </button>
                <button 
                    onClick={() => setActiveTab('about')}
                    className={`text-left px-4 py-3 text-sm font-bold uppercase transition-all ${activeTab === 'about' ? 'bg-white border border-black shadow-md translate-x-1' : 'text-gray-500 hover:text-black'}`}
                >
                    About
                </button>
            </div>

            <div className="flex-1 bg-[#f2f2f2] overflow-y-auto shadow-inner">
                {activeTab === 'menu' && (
                    <div className="flex flex-col">
                        <MenuButton icon="📄" label="New Project" onClick={onNew} onClose={onClose} subLabel="Clear workspace" />
                        <MenuButton icon="📂" label="Open Project" onClick={onOpen} onClose={onClose} subLabel=".json files" />
                        <MenuButton icon="💾" label="Save Project" onClick={onSave} onClose={onClose} subLabel="Download .json" />
                        <div className="h-1 bg-gray-300 my-2" />
                        <MenuButton icon="📦" label="Import Theme" onClick={onImportZip} onClose={onClose} subLabel="Load existing .zip theme" />
                        <MenuButton icon="Aa" label="Fonts" onClick={onShowFonts} onClose={onClose} subLabel="RB12 preview, font pack, conversion, and usage" />
                        <MenuButton icon="▧" label="Assets" onClick={onShowAssets} onClose={onClose} subLabel="BMP conversion, strips, paths, and usage" />
                        <MenuButton icon="▦" label="Compatibility Lab" onClick={onShowCompatibility} onClose={onClose} subLabel="Official parser and pixel evidence" />
                        <div className="h-1 bg-gray-300 my-2" />
                        <MenuButton icon="⬇" label="Export Theme" onClick={onExport} onClose={onClose} subLabel="Compile to .zip for iPod" />
                        <MenuButton icon="FW" label="Firmware Assets" onClick={onShowFirmware} onClose={onClose} subLabel="Built-in USB fallback · source package" />
                    </div>
                )}

                {activeTab === 'about' && (
                    <div className="p-6 text-sm h-full flex flex-col">
                        <h3 className="font-bold text-lg mb-2">RockBox Designer</h3>
                        <p className="text-gray-600 mb-6 leading-relaxed w-3/4">
                             A visual IDE for Rockbox themes (iPod Classic/Video). Developed in tandem with Google AI Studio.
                        </p>

                        <div className="flex flex-col gap-4 flex-1 min-h-0">
                            <div className="bg-white border border-gray-300 p-3 shadow-sm flex flex-col min-h-0">
                                <h4 className="font-bold text-xs uppercase text-orange-600 mb-2 border-b border-gray-200 pb-1">Version History</h4>
                                <ul className="space-y-2 text-xs font-mono text-gray-500 overflow-y-auto custom-scrollbar leading-tight h-32">
                                    <li><span className="text-black">v1.2.1</span> - Rebranding & Texture UI.</li>
                                    <li><span className="text-black">v1.2.0</span> - Metadata, Audio Test, Layers.</li>
                                    <li><span className="text-black">v1.1.0</span> - Font Import, Adv. Selectors.</li>
                                    <li><span className="text-black">v1.0.5</span> - AI Theme Generator.</li>
                                    <li><span className="text-black">v1.0.0</span> - Initial Release.</li>
                                </ul>
                            </div>

                            <div className="mt-auto pt-4 border-t border-gray-300">
                                <h4 className="font-bold text-xs uppercase mb-2">Contact / Support</h4>
                                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); alert('Message simulation sent!'); }}>
                                    <div className="flex gap-2">
                                         <input type="email" placeholder="Email" className="flex-1 p-2 text-xs border border-gray-300 focus:border-orange-500 outline-none" required />
                                    </div>
                                    <textarea placeholder="Feedback or bugs..." className="w-full p-2 text-xs border border-gray-300 h-16 focus:border-orange-500 outline-none resize-none" required></textarea>
                                    <div className="flex justify-between items-center">
                                        <button className="px-4 py-2 bg-black text-white text-xs font-bold uppercase hover:bg-gray-800">Send</button>
                                        <button type="button" onClick={() => alert("Thank you!")} className="bg-[#ffeb3b] text-black border border-black shadow-[2px_2px_0px_black] px-3 py-1.5 text-xs font-bold uppercase hover:bg-[#fff176] active:translate-y-[1px] active:shadow-none transition-all">
                                            ☕ Donate
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
