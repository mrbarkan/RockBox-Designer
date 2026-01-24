import React, { useState } from 'react';

interface MainMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onExport: () => void;
  onImportZip: () => void;
  onImportFont: () => void;
}

export const MainMenuModal: React.FC<MainMenuModalProps> = ({ 
    isOpen, onClose, onNew, onOpen, onSave, onExport, onImportZip, onImportFont 
}) => {
  const [activeTab, setActiveTab] = useState<'menu' | 'about'>('menu');

  if (!isOpen) return null;

  const MenuButton = ({ icon, label, onClick, subLabel }: any) => (
    <button 
        onClick={() => { onClick(); onClose(); }}
        className="w-full text-left flex items-center gap-4 p-3 hover:bg-orange-600 hover:text-white border-b border-gray-300 group transition-colors bg-white/50 hover:bg-orange-600"
    >
        <div className="w-8 h-8 bg-gray-200 border border-gray-400 flex items-center justify-center font-mono text-lg group-hover:bg-white group-hover:text-black">
            {icon}
        </div>
        <div>
            <div className="font-bold uppercase text-sm tracking-wide">{label}</div>
            {subLabel && <div className="text-[9px] opacity-60 font-mono group-hover:text-white">{subLabel}</div>}
        </div>
    </button>
  );

  return (
    // Removed bg-black/60 and backdrop-blur-sm. Added transparent bg but keeping it blocking to capture clicks.
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Click backdrop to close */}
      <div className="absolute inset-0" onClick={onClose}></div>

      {/* Modal Window */}
      <div className="bg-[#e0e0e0] pinstripe border-2 border-black w-full max-w-lg shadow-[12px_12px_0px_rgba(0,0,0,1)] flex flex-col max-h-[90vh] animate-bounce-in relative z-10">
        
        {/* Header */}
        <div className="bg-[#2a2a2a] text-white p-4 flex justify-between items-center border-b border-black select-none">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-600 flex items-center justify-center font-bold text-white border border-white">R</div>
                <h2 className="font-bold uppercase tracking-widest text-sm">RockBox Designer</h2>
            </div>
            <button onClick={onClose} className="hover:text-orange-500 font-bold text-xl">×</button>
        </div>

        <div className="flex flex-1 min-h-0 border-t border-white/50">
            {/* Sidebar */}
            <div className="w-32 bg-[#d4d4d4] border-r border-gray-400 flex flex-col p-2 gap-1 shadow-inner">
                <button 
                    onClick={() => setActiveTab('menu')}
                    className={`text-left px-3 py-2 text-xs font-bold uppercase ${activeTab === 'menu' ? 'bg-white border border-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
                >
                    File Ops
                </button>
                <button 
                    onClick={() => setActiveTab('about')}
                    className={`text-left px-3 py-2 text-xs font-bold uppercase ${activeTab === 'about' ? 'bg-white border border-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
                >
                    About
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-[#f2f2f2] overflow-y-auto shadow-inner">
                {activeTab === 'menu' && (
                    <div className="flex flex-col">
                        <MenuButton icon="📄" label="New Project" onClick={onNew} subLabel="Clear workspace" />
                        <MenuButton icon="📂" label="Open Project" onClick={onOpen} subLabel=".json files" />
                        <MenuButton icon="💾" label="Save Project" onClick={onSave} subLabel="Download .json" />
                        <div className="h-1 bg-gray-300 my-1" />
                        <MenuButton icon="📦" label="Import Theme" onClick={onImportZip} subLabel="Load existing .zip theme" />
                        <MenuButton icon="Aa" label="Import Font" onClick={onImportFont} subLabel="Load .fnt resource" />
                        <div className="h-1 bg-gray-300 my-1" />
                        <MenuButton icon="⬇" label="Export Theme" onClick={onExport} subLabel="Compile to .zip for iPod" />
                    </div>
                )}

                {activeTab === 'about' && (
                    <div className="p-6 text-sm">
                        <h3 className="font-bold text-lg mb-2">RockBox Designer</h3>
                        <p className="text-gray-600 mb-4 leading-relaxed">
                            A visual IDE for creating Rockbox themes for iPod Classic and Video (5th Gen). 
                            Inspired by the functionalist design principles of Dieter Rams.
                            <br/><br/>
                            Built to simplify the process of `.wps` and `.sbs` creation without writing code manually.
                        </p>

                        <div className="bg-white border border-gray-300 p-4 mb-6 shadow-sm">
                            <h4 className="font-bold text-xs uppercase text-orange-600 mb-3 border-b border-gray-200 pb-1">Version History</h4>
                            <ul className="space-y-2 text-xs font-mono text-gray-500 h-32 overflow-y-auto custom-scrollbar">
                                <li><span className="text-black">v1.2.1</span> - Rebranding & Texture UI updates.</li>
                                <li><span className="text-black">v1.2.0</span> - Added Metadata Reader, Audio Testing, Minimizable Layers.</li>
                                <li><span className="text-black">v1.1.0</span> - Added Font Importer, Advanced Selectors.</li>
                                <li><span className="text-black">v1.0.5</span> - Integrated AI Theme Generator.</li>
                                <li><span className="text-black">v1.0.0</span> - Initial Release. Basic WPS/SBS compilation.</li>
                            </ul>
                        </div>

                        <div className="mb-6">
                            <h4 className="font-bold text-xs uppercase mb-2">Contact / Feedback</h4>
                            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); alert('Message simulation sent! (This is a frontend demo)'); }}>
                                <input type="email" placeholder="your@email.com" className="w-full p-2 text-xs border border-gray-300 focus:border-orange-500 outline-none" required />
                                <textarea placeholder="Report a bug or suggest a feature..." className="w-full p-2 text-xs border border-gray-300 h-20 focus:border-orange-500 outline-none resize-none" required></textarea>
                                <button className="px-4 py-1 bg-black text-white text-xs font-bold uppercase hover:bg-gray-800">Send Message</button>
                            </form>
                        </div>

                        <div className="border-t border-gray-300 pt-4 flex flex-col items-center gap-2">
                             <p className="text-xs text-gray-500 italic">Enjoying the tool?</p>
                             <button onClick={() => alert("Thank you for considering a donation! (Link placeholder)")} className="bg-[#ffeb3b] text-black border border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] px-4 py-2 text-xs font-bold uppercase hover:bg-[#fff176] active:translate-y-[1px] active:shadow-none transition-all">
                                 ☕ Consider Donating
                             </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};