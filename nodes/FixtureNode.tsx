
import React, { useState, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FIXTURE_LAYOUTS, MAX_DMX_VALUE } from '../constants';

const getChannelColor = (label: string, type: string, defaultColor: string) => {
  const l = label.toLowerCase();
  const t = type.toLowerCase();
  
  if (t === 'red' || l.includes('red') || l === 'r' || l.startsWith('r-')) return '#ef4444';
  if (t === 'green' || l.includes('green') || l.includes('grn') || l === 'g' || l.startsWith('g-')) return '#10b981';
  if (t === 'blue' || l.includes('blue') || l.includes('blu') || l === 'b' || l.startsWith('b-')) return '#3b82f6';
  if (t === 'white' || l.includes('white') || l.includes('wht') || l === 'w' || l.startsWith('w-')) return '#ffffff';
  
  return defaultColor;
};

export const FixtureNode = ({ data, id }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const layout = FIXTURE_LAYOUTS[data.params.fixtureType as keyof typeof FIXTURE_LAYOUTS];
  const { manualValues, mutes, startChannel, currentValues } = data.params;
  const nodeAccentColor = data.color || '#10b981';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 w-64 shadow-2xl transition-all" style={{ borderColor: `${nodeAccentColor}44` }}>
      <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-2">
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center gap-2 group">
            {isEditing ? (
              <input 
                autoFocus
                type="text" 
                value={data.label} 
                onChange={(e) => data.onParamChange(id, 'label', e.target.value)}
                onBlur={() => setIsEditing(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
                className="nodrag bg-zinc-800 text-[10px] font-black uppercase tracking-widest outline-none border border-emerald-500/50 rounded px-1 w-full"
                style={{ color: nodeAccentColor }}
              />
            ) : (
              <span className="text-[10px] font-black uppercase tracking-widest truncate" style={{ color: nodeAccentColor }}>
                {data.label}
              </span>
            )}
            <button 
                onClick={() => setIsEditing(!isEditing)}
                className="nodrag opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-white transition-opacity"
            >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            </button>
          </div>
          <span className="text-[8px] text-zinc-600 font-bold uppercase">CH: {startChannel}</span>
        </div>
        <div className="flex items-center gap-2 ml-2">
           <input 
             type="color" 
             value={nodeAccentColor} 
             onChange={(e) => data.onParamChange(id, 'color', e.target.value)}
             className="nodrag w-4 h-4 rounded-full border-none bg-transparent cursor-pointer"
           />
           <div className="w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_currentColor]" style={{ backgroundColor: nodeAccentColor, color: nodeAccentColor }} />
        </div>
      </div>

      <div className="space-y-4">
        {layout.map((chan, idx) => {
          const liveVal = currentValues?.[idx] ?? manualValues[idx];
          const chanColor = getChannelColor(chan.label, chan.type, nodeAccentColor);
          const isStandardColor = chanColor !== nodeAccentColor;

          return (
            <div key={idx} className="relative flex items-center gap-3">
              <Handle
                type="target"
                position={Position.Left}
                id={`in-${idx}`}
                className="!w-2 !h-2 !-left-4"
                style={{ 
                  backgroundColor: chanColor,
                  borderColor: isStandardColor ? '#000' : `${chanColor}88`
                }}
              />
              
              <div className="flex-1">
                <div className="flex justify-between text-[8px] font-black uppercase tracking-tighter text-zinc-500 mb-1">
                  <span className={isStandardColor ? 'font-black' : ''} style={{ color: isStandardColor ? chanColor : undefined }}>
                    {chan.label}
                  </span>
                  <span className={mutes[idx] ? 'text-red-500' : ''} style={{ color: mutes[idx] ? undefined : chanColor }}>
                    {mutes[idx] ? 'MUTED' : liveVal}
                  </span>
                </div>
                <div className="relative h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full transition-all duration-75"
                    style={{ 
                      width: `${(liveVal / MAX_DMX_VALUE) * 100}%`,
                      backgroundColor: chanColor,
                      boxShadow: `0 0 10px ${chanColor}88`
                    }}
                  />
                  <input
                    type="range"
                    min="0"
                    max={MAX_DMX_VALUE}
                    value={liveVal}
                    onChange={(e) => data.onChange(id, idx, parseInt(e.target.value))}
                    className="nodrag absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                </div>
              </div>

              <Handle
                type="source"
                position={Position.Right}
                id={`out-${idx}`}
                className="!w-2 !h-2 !-right-4"
                style={{ 
                  backgroundColor: chanColor,
                  borderColor: isStandardColor ? '#000' : `${chanColor}88`
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
