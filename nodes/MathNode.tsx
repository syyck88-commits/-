
import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';

export const MathNode = ({ data, id }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const accentColor = data.color || '#3b82f6';
  
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 w-44" style={{ borderColor: `${accentColor}44` }}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2 group flex-1">
          {isEditing ? (
            <input 
                autoFocus
                type="text" 
                value={data.label} 
                onChange={(e) => data.onParamChange(id, 'label', e.target.value)}
                onBlur={() => setIsEditing(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
                className="nodrag bg-zinc-800 text-[9px] font-black uppercase tracking-widest outline-none border border-emerald-500/50 rounded px-1 w-full"
                style={{ color: accentColor }}
            />
          ) : (
            <span className="text-[9px] font-black uppercase tracking-widest truncate" style={{ color: accentColor }}>
                {data.label}
            </span>
          )}
          <button 
                onClick={() => setIsEditing(!isEditing)}
                className="nodrag opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-white transition-opacity"
            >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            </button>
        </div>
        <input 
             type="color" 
             value={accentColor} 
             onChange={(e) => data.onParamChange(id, 'color', e.target.value)}
             className="nodrag w-3 h-3 rounded-full border-none bg-transparent cursor-pointer ml-2"
        />
      </div>
      
      <div className="relative mb-4">
        <Handle type="target" position={Position.Left} id="in-0" style={{ backgroundColor: accentColor }} className="!-left-4" />
        <div className="text-center py-2 bg-zinc-800 rounded-lg font-mono text-lg font-bold" style={{ color: accentColor }}>
          {Math.round(data.values?.[0] || 0)}
        </div>
        <Handle type="source" position={Position.Right} id="out-0" style={{ backgroundColor: accentColor }} className="!-right-4" />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-[8px] font-bold text-zinc-600 uppercase">
            <span>Scale</span>
            <span className="text-zinc-400">x{data.params?.scale?.toFixed(1) || '1.0'}</span>
        </div>
        <input 
            type="range" min="0" max="5" step="0.1" 
            value={data.params?.scale ?? 1} 
            onChange={e => data.onParamChange(id, 'scale', parseFloat(e.target.value))}
            className="nodrag w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: accentColor }}
        />
      </div>
    </div>
  );
};
