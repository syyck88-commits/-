
import React from 'react';
import { ConnectionStatus } from '../types';

interface HeaderProps {
    status: ConnectionStatus;
    txActivity: boolean;
    isBlackout: boolean;
    onToggleBlackout: () => void;
    onSave: () => void;
    onLoad: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onLoadClick: () => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
}

const Header: React.FC<HeaderProps> = ({ 
    status, txActivity, isBlackout, onToggleBlackout, onSave, onLoad, onLoadClick, fileInputRef 
}) => {
    return (
      <header className="h-16 border-b border-zinc-900 flex items-center justify-between px-6 z-50 bg-zinc-950/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="text-xl font-black italic tracking-tighter text-emerald-500">LUMINA GRAPH</div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase">
             <div className={`w-2 h-2 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
             {status}
             <div className={`ml-4 px-2 py-0.5 rounded border transition-colors ${txActivity ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10' : 'border-zinc-800 text-zinc-800'}`}>TX STREAM</div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
            <input type="file" ref={fileInputRef} onChange={onLoad} accept=".json" className="hidden" />
            <button onClick={onLoadClick} className="px-4 py-2 rounded-xl text-[10px] font-black bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all">LOAD PROJECT</button>
            <button onClick={onSave} className="px-4 py-2 rounded-xl text-[10px] font-black bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 transition-all">SAVE PROJECT</button>
            <div className="w-px h-6 bg-zinc-800 mx-2" />
            <button onClick={onToggleBlackout} className={`px-6 py-2 rounded-xl text-[10px] font-black border-2 transition-all ${isBlackout ? 'bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/30' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
              {isBlackout ? 'BLACKOUT ON' : 'BLACKOUT'}
            </button>
        </div>
      </header>
    );
};

export default Header;
