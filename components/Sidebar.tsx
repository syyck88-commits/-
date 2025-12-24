
import React from 'react';

interface SidebarProps {
    onAddNode: (type: string) => void;
    onAutoLayout: (mode: 'smart' | 'grid') => void;
    layoutDensity: number;
    onDensityChange: (val: number) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onAddNode, onAutoLayout, layoutDensity, onDensityChange }) => {
    return (
        <div className="w-16 border-r border-zinc-900 flex flex-col items-center py-6 gap-6 bg-zinc-950/50 z-40">
           <div className="flex flex-col gap-2 items-center">
             <span className="text-[7px] font-bold text-zinc-600 uppercase">Input</span>
             <button onClick={() => onAddNode('input')} className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-500 hover:scale-110 transition-all font-bold">IN</button>
             <button onClick={() => onAddNode('midi')} className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-500 hover:scale-110 transition-all font-bold">MIDI</button>
           </div>
           <div className="h-px w-8 bg-zinc-900" />
           <div className="flex flex-col gap-2 items-center">
             <span className="text-[7px] font-bold text-zinc-600 uppercase">DSP</span>
             <button onClick={() => onAddNode('audio')} className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-500 hover:scale-110 transition-all font-bold">DSP</button>
             <button onClick={() => onAddNode('math')} className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-500 hover:scale-110 transition-all font-bold">∑</button>
           </div>
           <div className="h-px w-8 bg-zinc-900" />
           <div className="flex flex-col gap-2 items-center w-full px-1">
             <span className="text-[7px] font-bold text-zinc-600 uppercase">Layout</span>
             <button onClick={() => onAutoLayout('smart')} className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center justify-center text-emerald-500 transition-all hover:bg-emerald-500/20"><span className="text-lg">→</span></button>
             <button onClick={() => onAutoLayout('grid')} className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 transition-all hover:bg-emerald-500/20">
                <div className="grid grid-cols-2 gap-0.5"><div className="w-1.5 h-1.5 bg-current rounded-sm"></div><div className="w-1.5 h-1.5 bg-current rounded-sm"></div><div className="w-1.5 h-1.5 bg-current rounded-sm"></div><div className="w-1.5 h-1.5 bg-current rounded-sm"></div></div>
             </button>
             
             <div className="mt-2 w-full flex flex-col items-center gap-1">
                 <div className="w-full flex justify-between px-1 text-[6px] font-bold text-zinc-600 uppercase">
                    <span>Dense</span><span>Sparse</span>
                 </div>
                 <input 
                    type="range" 
                    min="0.6" max="1.6" step="0.1"
                    value={layoutDensity}
                    onChange={(e) => onDensityChange(parseFloat(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-full appearance-none accent-emerald-500 cursor-pointer" 
                 />
             </div>
           </div>
        </div>
    );
};

export default Sidebar;
