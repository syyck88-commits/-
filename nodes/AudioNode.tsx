
import React from 'react';
import { Handle, Position } from '@xyflow/react';

export const AudioNode = ({ data, id }: any) => {
  const bpm = data.params?.bpm || 0;
  const isBeat = data.params?.isBeat || false;

  return (
    <div className="bg-zinc-900 border-2 border-emerald-500/40 rounded-2xl p-4 w-64 shadow-2xl backdrop-blur-xl relative overflow-hidden">
      {/* Beat Flash Overlay */}
      <div 
        className="absolute inset-0 bg-emerald-500/10 pointer-events-none transition-opacity duration-75"
        style={{ opacity: isBeat ? 1 : 0 }}
      />
      
      <div className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-4 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${isBeat ? 'scale-150' : ''} transition-transform`} />
            DSP ANALYZER
        </div>
        <div className="flex items-center gap-1 bg-zinc-800/80 rounded px-1.5 py-0.5 border border-emerald-500/20">
            <span className="text-emerald-400">{bpm > 0 ? bpm : '--'}</span>
            <span className="text-[7px] text-zinc-500">BPM</span>
        </div>
        <Handle type="target" position={Position.Left} id="signal-in" className="!bg-zinc-700 !w-2 !h-2 !-left-4" />
      </div>
      
      {/* DSP Controls */}
      <div className="grid grid-cols-3 gap-2 mb-4 relative z-10">
        <div className="space-y-1">
             <div className="flex justify-between text-[7px] font-black uppercase text-zinc-500">
                <span>Gate</span>
                <span className="text-emerald-500">{data.params?.gate || 0}</span>
             </div>
             <input 
                type="range" min="0" max="255" 
                value={data.params?.gate || 0}
                onChange={e => data.onParamChange(id, 'gate', parseInt(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-full appearance-none accent-emerald-500 cursor-pointer"
             />
        </div>
        <div className="space-y-1">
             <div className="flex justify-between text-[7px] font-black uppercase text-zinc-500">
                <span>Gain</span>
                <span className="text-emerald-500">{(data.params?.gain || 1).toFixed(1)}x</span>
             </div>
             <input 
                type="range" min="0" max="5" step="0.1"
                value={data.params?.gain || 1}
                onChange={e => data.onParamChange(id, 'gain', parseFloat(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-full appearance-none accent-emerald-500 cursor-pointer"
             />
        </div>
        <div className="space-y-1">
             <div className="flex justify-between text-[7px] font-black uppercase text-zinc-500">
                <span>Decay</span>
                <span className="text-emerald-500">{(data.params?.decay || 0).toFixed(2)}</span>
             </div>
             <input 
                type="range" min="0" max="1" step="0.01"
                value={data.params?.decay || 0}
                onChange={e => data.onParamChange(id, 'decay', parseFloat(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-full appearance-none accent-emerald-500 cursor-pointer"
             />
        </div>
      </div>

      <div className="space-y-3 relative z-10">
        {['LOW', 'MID', 'HIGH'].map((band, idx) => (
          <div key={band} className="relative flex items-center justify-between">
            <span className="text-[9px] font-bold text-zinc-500 w-8">{band}</span>
            <div className="flex-1 mx-2 h-2 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/50">
                <div 
                    className="h-full bg-emerald-500 shadow-[0_0_10px_#10b981] transition-all duration-75 origin-left" 
                    style={{ width: `${((data.values?.[idx] || 0) / 255) * 100}%` }} 
                />
            </div>
            <span className="text-[8px] font-mono text-zinc-600 w-6 text-right">
                {Math.round(data.values?.[idx] || 0)}
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id={`out-${idx}`}
              className="!bg-emerald-500 !-right-4"
            />
          </div>
        ))}
      </div>
      
      {!data.values && <div className="mt-3 text-[7px] font-bold text-zinc-600 uppercase text-center">No Signal</div>}
    </div>
  );
};
