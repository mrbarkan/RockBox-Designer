
import React, { useEffect, useState } from 'react';
import { CloudProject, User, ProjectState } from '../types';
import { storageService } from '../services/storageService';

interface ProjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onLoadProject: (project: ProjectState) => void;
}

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({ isOpen, onClose, user, onLoadProject }) => {
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
        loadProjects();
    }
  }, [isOpen]);

  const loadProjects = async () => {
      setLoading(true);
      try {
          const list = await storageService.listProjects(user);
          setProjects(list.sort((a,b) => b.updated - a.updated));
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if(confirm("Delete this project from cloud?")) {
          await storageService.deleteProject(user, id);
          loadProjects();
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[#e0e0e0] border-2 border-black w-full max-w-lg shadow-[12px_12px_0px_rgba(0,0,0,1)] flex flex-col h-[600px] animate-bounce-in relative z-10">
        
        <div className="bg-[#2a2a2a] text-white p-4 flex justify-between items-center border-b border-black select-none">
            <span className="font-bold uppercase tracking-widest text-sm">Cloud Projects // {user.username}</span>
            <button onClick={onClose} className="hover:text-orange-500 font-bold text-xl px-2">×</button>
        </div>

        <div className="flex-1 bg-[#f2f2f2] p-6 overflow-y-auto pinstripe">
            {loading ? (
                <div className="flex flex-col items-center justify-center h-full opacity-50">
                    <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                    <span className="text-sm font-bold uppercase">Connecting to Database...</span>
                </div>
            ) : projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <span className="text-4xl mb-3">📂</span>
                    <span className="text-sm font-bold uppercase">No projects saved in cloud</span>
                    <span className="text-xs mt-2">Save your current work to see it here.</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {projects.map(p => (
                        <div 
                            key={p.id}
                            onClick={() => { onLoadProject(p.data); onClose(); }}
                            className="bg-white border border-gray-300 p-4 hover:border-orange-500 hover:shadow-md cursor-pointer group flex items-center justify-between transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gray-100 border border-gray-200 flex items-center justify-center text-2xl group-hover:bg-orange-50">
                                    📄
                                </div>
                                <div>
                                    <div className="font-bold text-base group-hover:text-orange-600 mb-1">{p.name}</div>
                                    <div className="text-[10px] text-gray-500 font-mono">
                                        Last Edited: {new Date(p.updated).toLocaleString()}
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-mono">
                                        {p.data.elements.length} Elements
                                    </div>
                                </div>
                            </div>
                            
                            <button 
                                onClick={(e) => handleDelete(e, p.id)}
                                className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors text-lg"
                                title="Delete Project"
                            >
                                🗑️
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
