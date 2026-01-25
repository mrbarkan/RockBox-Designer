
import React, { useState } from 'react';
import { storageService } from '../services/storageService';
import { User } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onLoginSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let user: User;
      if (isRegistering) {
        user = await storageService.register(username);
      } else {
        user = await storageService.login(username);
      }
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black">
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>

      <div className="bg-[#e0e0e0] border-2 border-black w-full max-w-sm shadow-[12px_12px_0px_rgba(255,88,0,0.5)] relative animate-bounce-in z-10 flex flex-col">
        
        <div className="bg-[#2a2a2a] text-white p-5 border-b border-black select-none flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-600 flex items-center justify-center font-bold text-white border border-white text-sm">R</div>
                <h2 className="font-bold uppercase tracking-widest text-sm">Access Control</h2>
            </div>
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
        </div>

        <div className="p-10 flex flex-col items-center bg-[#d4d4d4] pinstripe">
            
            <h1 className="text-3xl font-bold mb-3 uppercase tracking-tighter">RockBox Designer</h1>
            <p className="text-xs text-gray-500 font-mono mb-8 uppercase tracking-widest">
                {isRegistering ? 'Create User Profile' : 'User Authentication'}
            </p>

            <form onSubmit={handleSubmit} className="w-full space-y-6">
                <div>
                    <label className="block text-xs font-bold mb-2 uppercase text-gray-600">Username</label>
                    <input 
                        type="text" 
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        className="w-full p-3 border border-black font-mono text-base focus:outline-none focus:border-orange-600 focus:bg-white bg-[#f2f2f2]"
                        placeholder="Enter username..."
                        autoFocus
                    />
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 text-xs font-bold uppercase text-center">
                        {error}
                    </div>
                )}

                <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-black text-white font-bold uppercase tracking-widest text-sm hover:bg-gray-800 transition-all border border-transparent hover:border-orange-500 flex justify-center shadow-lg active:translate-y-1 active:shadow-none"
                >
                    {loading ? 'Processing...' : (isRegistering ? 'Initialize Profile' : 'Login')}
                </button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-400 w-full text-center">
                <button 
                    onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
                    className="text-xs font-bold uppercase text-gray-600 hover:text-orange-600 underline decoration-dotted p-2"
                >
                    {isRegistering ? "Back to Login" : "New User? Create Profile"}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
