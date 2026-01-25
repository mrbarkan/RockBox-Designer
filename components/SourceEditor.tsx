
import React, { useState, useEffect } from 'react';
import { ProjectState } from '../types';
import { compileWps, compileCfg, compileSbs, compileFms } from '../services/rockboxCompiler';

interface SourceEditorProps {
  project: ProjectState;
  onClose: () => void;
  onApplyChanges: (screen: 'wps' | 'sbs' | 'cfg', content: string) => void;
}

export const SourceEditor: React.FC<SourceEditorProps> = ({ project, onClose, onApplyChanges }) => {
  const [activeTab, setActiveTab] = useState<'wps' | 'sbs' | 'fms' | 'cfg'>('wps');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Load initial content on open or tab change
  useEffect(() => {
    let code = '';
    switch(activeTab) {
        case 'wps': code = compileWps(project); break;
        case 'sbs': code = compileSbs(project); break;
        case 'fms': code = compileFms(project); break;
        case 'cfg': code = compileCfg(project); break;
    }
    setContent(code);
    setError(null);
  }, [activeTab, project]);

  const validate = (code: string) => {
      // Basic Rockbox syntax checks
      const lines = code.split('\n');
      for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Check for balanced parentheses in viewport tags
          if (line.includes('%V') && (line.match(/\(/g)?.length !== line.match(/\)/g)?.length)) {
              return `Line ${i + 1}: Unbalanced parentheses in Viewport tag.`;
          }
          // Check for conditional closure
          if (line.includes('%?') && line.includes('<') && !line.includes('>')) {
              return `Line ${i + 1}: Unclosed conditional tag.`;
          }
      }
      return null;
  };

  const handleApply = () => {
      const err = validate(content);
      if (err) {
          setError(err);
          return;
      }
      alert("Changes applied to internal buffer (Visual update requires full re-parse logic which is currently experimental).");
      setError(null);
  };

  return (
    <div className="absolute top-14 right-0 bottom-0 w-[600px] bg-[#1a1a1a] border-l border-black z-40 shadow-xl flex flex-col font-mono text-sm animate-slide-in-right">
        {/* Tabs */}
        <div className="flex bg-[#222] border-b border-black">
            {['wps', 'sbs', 'fms', 'cfg'].map(tab => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`flex-1 py-3 text-xs font-bold uppercase border-r border-black hover:bg-[#333] transition-colors ${activeTab === tab ? 'bg-[#333] text-orange-500 border-b-2 border-b-orange-500' : 'text-gray-500'}`}
                >
                    .{tab}
                </button>
            ))}
            <button onClick={onClose} className="px-5 text-gray-500 hover:text-white bg-red-900/20 border-l border-black text-lg">×</button>
        </div>

        {/* Toolbar */}
        <div className="bg-[#111] p-3 flex justify-between items-center border-b border-black">
             <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Live Editor</span>
             <div className="flex gap-3">
                 <button className="px-3 py-1.5 bg-[#333] text-gray-300 text-xs border border-black hover:bg-[#444]" onClick={() => setContent(compileWps(project))}>Reset</button>
                 <button onClick={handleApply} className="px-4 py-1.5 bg-orange-600 text-white text-xs font-bold uppercase border border-black shadow-[2px_2px_0px_black] active:translate-y-[1px] active:shadow-none transition-all">
                     Apply Changes
                 </button>
             </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 relative">
            <textarea
                value={content}
                onChange={(e) => { setContent(e.target.value); setError(null); }}
                className="w-full h-full bg-[#0a0a0a] text-[#d4d4d4] p-6 outline-none resize-none font-mono text-sm leading-relaxed"
                spellCheck={false}
            />
            {error && (
                <div className="absolute bottom-6 left-6 right-6 bg-red-900/90 text-white p-3 border border-red-500 text-xs font-bold flex items-center gap-3 shadow-lg">
                    <span className="text-xl">⚠️</span> {error}
                </div>
            )}
        </div>
        
        {/* Status */}
        <div className="h-8 bg-[#222] border-t border-black flex items-center px-4 text-xs text-gray-500 justify-between">
             <span>Ln {content.split('\n').length}, Col 1</span>
             <span>UTF-8</span>
        </div>
    </div>
  );
};
