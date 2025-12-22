
import React from 'react';
import { Handle, Position } from '@xyflow/react';

export const AudioNode = ({ data }: any) => {
  return (
    <div className="bg-zinc-900 border-2 border-emerald-500/40 rounded-2xl p-4 w-52 shadow-2xl backdrop-blur-xl">
      <div className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            DSP ANALYZER
        </div>
        <Handle type="target" position={Position.Left} id="signal-in" className="!bg-zinc-700 !w-2 !h-2" />
      </div>
      
      <div className="space-y-4">
        {['LOW', 'MID', 'HIGH'].map((band, idx) => (
          <div key={band} className="relative flex items-center justify-between">
            <span className="text-[9px] font-bold text-zinc-500">{band}</span>
            <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-emerald-500 shadow-[0_0_10px_#10b981] transition-all duration-75" 
                    style={{ width: `${((data.values?.[idx] || 0) / 255) * 100}%` }} 
                />
            </div>
            <Handle
              type="source"
              position={Position.Right}
              id={`out-${idx}`}
              className="!bg-emerald-500"
            />
          </div>
        ))}
      </div>
      <div className="mt-3 text-[7px] font-bold text-zinc-600 uppercase text-center">Connect Audio Input to Signal In</div>
    </div>
  );
};
