import React from 'react';

interface RemixModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RemixModal: React.FC<RemixModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[#e0e0e0] border-2 border-black w-full max-w-md shadow-[10px_10px_0px_rgba(0,0,0,1)] relative animate-bounce-in">
        
        {/* Title Bar */}
        <div className="bg-gradient-to-b from-[#f2f2f2] to-[#d4d4d4] border-b border-black h-8 flex items-center justify-between px-2 cursor-grab active:cursor-grabbing">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-700">Community_Notice.txt</span>
            <button onClick={onClose} className="w-4 h-4 bg-red-500 rounded-full border border-black hover:bg-red-400 flex items-center justify-center">
                <span className="text-black text-[10px] font-bold leading-none mt-[-2px]">×</span>
            </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center text-center font-mono text-xs text-black">
            
            <div className="w-24 h-24 bg-white border border-black mb-4 flex items-center justify-center overflow-hidden grayscale contrast-125">
                 <img src="https://media.giphy.com/media/l2Je4zlfxF6z0IWZi/giphy.gif" alt="Steve Jobs Thumbs Up" className="object-cover w-full h-full" />
            </div>

            <h2 className="text-lg font-bold uppercase mb-2">Theme Loaded!</h2>
            
            <p className="mb-4 leading-relaxed">
                You have successfully imported a Rockbox theme.
            </p>
            
            <div className="bg-white border border-black p-3 mb-4 text-left shadow-[4px_4px_0px_#999]">
                <p className="mb-2 font-bold underline">Remix Protocol:</p>
                <p className="mb-2">If this theme is not your own, you can remix it, just make sure you credit it to the original dev.</p>
                <p>This is a very cool community, let's keep it this way.</p>
            </div>

            <p className="italic font-bold text-gray-600">
                "Stay hungry, stay foolish."
            </p>

            <button 
                onClick={onClose}
                className="mt-6 w-full py-2 bg-orange-600 text-white font-bold border border-black shadow-[4px_4px_0px_black] active:translate-y-[2px] active:shadow-none transition-all uppercase hover:bg-orange-500"
            >
                I Agree & Continue
            </button>

        </div>
      </div>
    </div>
  );
};
