
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { 
  ReactFlow, 
  Controls, 
  Background, 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge,
  Connection,
  NodeChange,
  EdgeChange,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
  SelectionMode
} from '@xyflow/react';
import { FixtureNode } from './nodes/FixtureNode';
import { AudioNode } from './nodes/AudioNode';
import { MathNode } from './nodes/MathNode';
import { InputNode } from './nodes/InputNode';
import { MidiNode } from './nodes/MidiNode';
import ButtonEdge from './components/ButtonEdge';
import { DmxClient } from './services/dmxClient';
import { MidiManager } from './services/midiService';
import { evaluateGraph } from './utils/graphEngine';
import { ConnectionStatus, LuminaNode, LuminaEdge, MidiState } from './types';
import { DEFAULT_WS_URL, INITIAL_FIXTURES } from './constants';

// Memoize Node components to prevent unnecessary re-renders
const nodeTypes = {
  fixture: memo(FixtureNode),
  audio: memo(AudioNode),
  math: memo(MathNode),
  input: memo(InputNode),
  midi: memo(MidiNode)
};

const edgeTypes = {
  button: ButtonEdge
};

// Fast numerical array comparison (much faster than JSON.stringify)
const arraysEqual = (a: number[] | undefined, b: number[] | undefined) => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

// Fix: Added getColorFromName helper function to resolve reference error on line 216
const getColorFromName = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes('red')) return '#ef4444';
  if (n.includes('green') || n.includes('grn')) return '#10b981';
  if (n.includes('blue') || n.includes('blu')) return '#3b82f6';
  if (n.includes('white') || n.includes('wht')) return '#ffffff';
  if (n.includes('wash')) return '#f59e0b'; // Amber
  if (n.includes('top')) return '#8b5cf6'; // Purple
  if (n.includes('led')) return '#ec4899'; // Pink
  if (n.includes('fx') || n.includes('spider')) return '#06b6d4'; // Cyan
  if (n.includes('spark')) return '#f97316'; // Orange
  if (n.includes('laser')) return '#d946ef'; // Fuchsia
  return '#10b981'; // Default Emerald
};

const FlowWrapper: React.FC = () => {
  const { fitView, screenToFlowPosition, getNodes, getEdges } = useReactFlow();
  const [nodes, setNodes] = useState<LuminaNode[]>([]);
  const [edges, setEdges] = useState<LuminaEdge[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [isBlackout, setIsBlackout] = useState(false);
  const [txActivity, setTxActivity] = useState(false);
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isMiddleMousePressed, setIsMiddleMousePressed] = useState(false);
  const [menu, setMenu] = useState<{ x: number, y: number, nodeId?: string } | null>(null);
  
  // Layout State
  const [layoutDensity, setLayoutDensity] = useState<number>(1.0);

  const dmxClient = useRef<DmxClient | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const midiManagerRef = useRef<MidiManager | null>(null);
  if (!midiManagerRef.current) {
    midiManagerRef.current = new MidiManager();
  }
  const midiManager = midiManagerRef.current;
  
  const inputLevels = useRef<Record<string, { low: number, mid: number, high: number }>>({});
  const midiStateRef = useRef<MidiState>({});
  
  const nodesRef = useRef<LuminaNode[]>([]);
  const edgesRef = useRef<LuminaEdge[]>([]);

  const lastUiUpdate = useRef<number>(0);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Alt') { e.preventDefault(); setIsAltPressed(true); }
      if (e.key === ' ') { e.preventDefault(); setIsSpacePressed(true); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSaveProject(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') { e.preventDefault(); fileInputRef.current?.click(); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltPressed(false);
      if (e.key === ' ') setIsSpacePressed(false);
    };
    const mouseDown = (e: MouseEvent) => { if (e.button === 1) setIsMiddleMousePressed(true); };
    const mouseUp = (e: MouseEvent) => { if (e.button === 1) setIsMiddleMousePressed(false); };
    const blur = () => { setIsAltPressed(false); setIsSpacePressed(false); setIsMiddleMousePressed(false); };
    
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('mousedown', mouseDown);
    window.addEventListener('mouseup', mouseUp);
    window.addEventListener('blur', blur);
    return () => { 
      window.removeEventListener('keydown', down); 
      window.removeEventListener('keyup', up);
      window.removeEventListener('mousedown', mouseDown);
      window.removeEventListener('mouseup', mouseUp);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const handleAudioLevelsUpdate = useCallback((nodeId: string, levels: { low: number, mid: number, high: number }) => {
    inputLevels.current[nodeId] = levels;
  }, []);

  const handleNodeValueChange = useCallback((nodeId: string, channelIdx: number, val: number) => {
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        const newManual = [...(n.data.params?.manualValues || [])];
        newManual[channelIdx] = val;
        return { ...n, data: { ...n.data, params: { ...n.data.params, manualValues: newManual } } };
      }
      return n;
    }));
  }, []);

  const handleNodeParamChange = useCallback((nodeId: string, key: string, val: any) => {
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        if (key === 'label' || key === 'color') return { ...n, data: { ...n.data, [key]: val } };
        return { ...n, data: { ...n.data, params: { ...n.data.params, [key]: val } } };
      }
      return n;
    }));
  }, []);

  const injectHandlers = useCallback((node: LuminaNode): LuminaNode => ({
    ...node,
    data: {
      ...node.data,
      onChange: handleNodeValueChange,
      onParamChange: handleNodeParamChange,
      onAudioLevelsUpdate: handleAudioLevelsUpdate
    }
  }), [handleAudioLevelsUpdate, handleNodeValueChange, handleNodeParamChange]);

  const injectEdgeHandlers = useCallback((edge: LuminaEdge): LuminaEdge => ({
    ...edge,
    type: 'button',
    markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#10b981' },
    data: {
      ...edge.data,
      onDelete: (id: string) => setEdges((eds) => eds.filter(e => e.id !== id))
    }
  }), []);

  // --- SMART LAYOUT ENGINE ---
  const autoLayout = (mode: 'smart' | 'grid') => {
    setNodes(nds => {
      const selectedNodes = nds.filter(n => n.selected);
      const targets = selectedNodes.length > 1 ? selectedNodes : nds;
      const targetIds = new Set(targets.map(n => n.id));
      
      // Calculate Bounds for current selection to keep them roughly in place
      let originX = 50;
      let originY = 50;
      if (selectedNodes.length > 1) {
        originX = Math.min(...targets.map(n => n.position.x));
        originY = Math.min(...targets.map(n => n.position.y));
      }

      const GAP_X = 400 * layoutDensity;
      const GAP_Y = 250 * layoutDensity;
      const newPositions = new Map<string, {x: number, y: number}>();

      if (mode === 'grid') {
        // Simple Grid Logic
        const cols = Math.ceil(Math.sqrt(targets.length));
        const sortedTargets = [...targets].sort((a, b) => {
            if (a.type !== b.type) return (a.type || '').localeCompare(b.type || '');
            return (a.data.label as string).localeCompare(b.data.label as string);
        });
        sortedTargets.forEach((n, i) => { 
            const col = i % cols;
            const row = Math.floor(i / cols);
            newPositions.set(n.id, { x: originX + (col * GAP_X), y: originY + (row * GAP_Y) });
        });
      } else {
        // --- SMART TOPOLOGICAL SORT (DAG) ---
        
        // 1. Build Dependency Graph
        const ranks = new Map<string, number>();
        const children = new Map<string, string[]>();
        const parents = new Map<string, string[]>();
        
        targets.forEach(n => {
          ranks.set(n.id, 0);
          children.set(n.id, []);
          parents.set(n.id, []);
        });

        // Populate graph from edges
        edges.forEach(e => {
          if (targetIds.has(e.source) && targetIds.has(e.target)) {
            children.get(e.source)?.push(e.target);
            parents.get(e.target)?.push(e.source);
          }
        });

        // 2. Assign Ranks (Longest Path)
        // Initialize sources (Rank 0)
        let queue = targets.filter(n => (parents.get(n.id)?.length || 0) === 0).map(n => n.id);
        
        // If circular or no clear sources, pick inputs/midi/generators as Rank 0
        if (queue.length === 0) {
           queue = targets.filter(n => ['input', 'midi', 'constant'].includes(n.type as string)).map(n => n.id);
        }

        const visited = new Set<string>();
        // Process queue to propagate ranks
        // We iterate multiple times to settle dependencies
        for(let i=0; i < targets.length + 2; i++) {
           const nextQueue: string[] = [];
           targets.forEach(n => {
               const ps = parents.get(n.id) || [];
               if (ps.length > 0) {
                   const maxParentRank = Math.max(...ps.map(p => ranks.get(p) || 0));
                   ranks.set(n.id, maxParentRank + 1);
               }
           });
        }
        
        // Force Fixtures to be at least Rank 1 if they have inputs, or push them right
        targets.filter(n => n.type === 'fixture').forEach(n => {
            const r = ranks.get(n.id) || 0;
            ranks.set(n.id, Math.max(r, 2)); // Encourage fixtures to move right
        });

        // 3. Group by Rank
        const layers: Record<number, LuminaNode[]> = {};
        targets.forEach(n => {
            const r = ranks.get(n.id) || 0;
            if (!layers[r]) layers[r] = [];
            layers[r].push(n);
        });

        // 4. Position
        const maxRank = Math.max(...Array.from(ranks.values()));
        
        for (let r = 0; r <= maxRank; r++) {
            const layerNodes = layers[r];
            if (!layerNodes) continue;

            // Sort within layer based on parent positions (Barycenter heuristic)
            layerNodes.sort((a, b) => {
                const getAvgParentY = (nid: string) => {
                   const ps = parents.get(nid) || [];
                   if (ps.length === 0) return 0;
                   const parentPositions = ps.map(pid => newPositions.get(pid)?.y || 0);
                   return parentPositions.reduce((sum, y) => sum + y, 0) / ps.length;
                };
                
                const ay = getAvgParentY(a.id);
                const by = getAvgParentY(b.id);
                
                // If no parents, sort by type then label
                if (ay === 0 && by === 0) {
                    return (a.data.label as string).localeCompare(b.data.label as string);
                }
                return ay - by;
            });

            // Apply positions
            let layerY = originY;
            // Center the layer vertically relative to previous layer if possible? 
            // Simple stack is safer for now.
            
            layerNodes.forEach((n, idx) => {
                // Adjust Y to avoid overlap
                newPositions.set(n.id, { 
                    x: originX + (r * GAP_X), 
                    y: layerY 
                });
                
                // Fixtures are tall, inputs are small. Use dynamic gap?
                const nodeHeight = n.type === 'fixture' ? 350 : 150;
                layerY += nodeHeight + (50 * layoutDensity);
            });
        }
      }

      return nds.map(n => {
        if (newPositions.has(n.id)) {
            return { ...n, position: newPositions.get(n.id)! };
        }
        return n;
      });
    });

    if (!nodes.some(n => n.selected)) {
        setTimeout(() => fitView({ duration: 600, padding: 0.2 }), 50);
    }
  };

  useEffect(() => {
    window.luminaMidi = {
        isReady: false,
        setLearnMode: (cb) => midiManager.setLearnMode(cb),
        init: async () => {
             const success = await midiManager.init();
             if(window.luminaMidi) window.luminaMidi.isReady = success;
             return success;
        },
        getDevices: () => midiManager.getDevices()
    };
    dmxClient.current = new DmxClient(DEFAULT_WS_URL, setStatus);
    return () => {
        midiManager.terminate();
        dmxClient.current?.close();
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('lumina-graph');
    if (saved) {
      try {
        const { nodes: savedNodes, edges: savedEdges } = JSON.parse(saved);
        setNodes(savedNodes.map(injectHandlers));
        setEdges(savedEdges.map(injectEdgeHandlers));
      } catch (e) { console.error(e); }
    } else {
      const initialNodes: LuminaNode[] = [
        { id: 'input-1', type: 'input', position: { x: 50, y: 50 }, data: { label: 'Audio Input', type: 'input', values: [0,0,0] } },
        { id: 'audio-1', type: 'audio', position: { x: 450, y: 50 }, data: { label: 'DSP Analyzer', type: 'audio', values: [0,0,0], params: { gain: 1, gate: 0, decay: 0 } } },
        ...INITIAL_FIXTURES.map((f, i) => ({
          id: f.id, type: 'fixture', position: { x: 850 + (Math.floor(i/8) * 300), y: 50 + (i % 8) * 350 },
          data: { label: f.name, type: 'fixture', color: getColorFromName(f.name), params: { ...f, fixtureType: f.type, currentValues: f.values }, onChange: handleNodeValueChange, onParamChange: handleNodeParamChange }
        }))
      ];
      setNodes(initialNodes.map(injectHandlers));
    }
  }, [injectHandlers, injectEdgeHandlers, handleNodeValueChange, handleNodeParamChange]);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
    const nodesToSave = nodes.map(({ data, ...n }) => {
        const { onChange, onParamChange, onAudioLevelsUpdate, ...cleanData } = data as any;
        return { ...n, data: cleanData };
    });
    localStorage.setItem('lumina-graph', JSON.stringify({ nodes: nodesToSave, edges }));
  }, [nodes, edges]);

  const handleSaveProject = () => {
    const nodesToSave = nodes.map(({ data, ...n }) => {
        const { onChange, onParamChange, onAudioLevelsUpdate, ...cleanData } = data as any;
        return { ...n, data: cleanData };
    });
    const blob = new Blob([JSON.stringify({ version: '2.4', timestamp: Date.now(), nodes: nodesToSave, edges }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lumina-project-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleLoadProject = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const projectData = JSON.parse(e.target?.result as string);
            if (projectData.nodes && projectData.edges) {
                // When loading, allow time for components to mount and initialize their internal logic
                setNodes([]);
                setEdges([]);
                setTimeout(() => {
                    setNodes(projectData.nodes.map(injectHandlers));
                    setEdges(projectData.edges.map(injectEdgeHandlers));
                    setTimeout(() => fitView(), 100);
                }, 50);
            }
        } catch (err) { alert('Failed to load project file'); }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  useEffect(() => {
    // Standard Art-Net logic runs at 25-40ms. 
    // We'll run the logic at 25ms (40fps) for smooth faders.
    const ticker = setInterval(() => {
      midiStateRef.current = midiManager.getState();

      const { nodeValues, dmxUpdates, nodeUpdates } = evaluateGraph(
          nodesRef.current, 
          edgesRef.current, 
          inputLevels.current,
          midiStateRef.current
      );
      
      const now = performance.now();
      
      // UI Throttle: 50ms (20fps) is enough for visual bars. 
      if (now - lastUiUpdate.current > 50) {
        let globalChanged = false;
        
        setNodes(nds => {
          const nextNodes = nds.map(n => {
            const newVals = nodeValues[n.id];
            const stateUpdates = nodeUpdates[n.id];
            
            let nodeDirty = false;
            let newData = n.data;

            // Use arraysEqual instead of JSON.stringify for massive performance boost
            if (newVals && !arraysEqual(newVals, n.data.values)) {
              newData = { ...newData, values: newVals };
              nodeDirty = true;
            }

            if (stateUpdates) {
              newData = { ...newData, params: { ...newData.params, ...stateUpdates } };
              nodeDirty = true;
            }

            if (n.type === 'fixture') {
               if (!arraysEqual(newData.params.currentValues, newVals)) {
                   newData = { ...newData, params: { ...newData.params, currentValues: newVals } };
                   nodeDirty = true;
               }
            }

            if (nodeDirty) globalChanged = true;
            return nodeDirty ? { ...n, data: newData } : n;
          });

          return globalChanged ? nextNodes : nds;
        });

        lastUiUpdate.current = now;
      }

      // Send DMX (Always High Priority)
      const finalUpdates = isBlackout ? dmxUpdates.map(u => ({ ...u, val: 0 })) : dmxUpdates;
      if (dmxClient.current?.send(finalUpdates)) {
        setTxActivity(true);
        setTimeout(() => setTxActivity(false), 50);
      }
    }, 25); 
    
    return () => clearInterval(ticker);
  }, [isBlackout]);

  const onNodesChange = useCallback((changes: NodeChange<LuminaNode>[]) => setNodes((nds) => applyNodeChanges<LuminaNode>(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange<LuminaEdge>[]) => setEdges((eds) => applyEdgeChanges<LuminaEdge>(changes, eds)), []);
  
  const onConnect = useCallback((params: Connection) => {
    if (params.source === params.target) return;
    const newEdge = injectEdgeHandlers({ ...params, id: `e-${params.source}-${params.target}-${params.sourceHandle}-${params.targetHandle}`, type: 'button' } as LuminaEdge);
    setEdges((eds) => addEdge(newEdge, eds));
  }, [injectEdgeHandlers]);

  const addNode = (type: string, pos?: { x: number, y: number }) => {
    const id = `${type}-${Date.now()}`;
    let defaultParams: any = {};
    if (type === 'math') defaultParams = { scale: 1, offset: 0 };
    if (type === 'audio') defaultParams = { gain: 1, gate: 0, decay: 0 };
    if (type === 'midi') defaultParams = { channel: 1, type: 'cc', index: 1, mode: 'momentary', deviceId: 'ALL' };

    const newNode: LuminaNode = injectHandlers({ id, type, position: pos || { x: 100, y: 100 }, data: { label: type.toUpperCase(), type, params: defaultParams } } as LuminaNode);
    setNodes(nds => [...nds, newNode]);
    setMenu(null);
  };

  const deleteNode = (id: string) => {
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
    delete inputLevels.current[id];
    setMenu(null);
  };

  const handleContextMenu = useCallback((event: React.MouseEvent | MouseEvent, node?: LuminaNode) => {
    event.preventDefault();
    const e = event as MouseEvent;
    setMenu({ x: e.clientX, y: e.clientY, nodeId: node?.id });
  }, []);

  const isPanning = isSpacePressed || isMiddleMousePressed;

  return (
    <div className={`h-screen w-full flex flex-col bg-zinc-950 ${isAltPressed ? 'alt-active' : ''} ${isPanning ? 'space-panning' : ''}`} onClick={() => setMenu(null)}>
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
            <input type="file" ref={fileInputRef} onChange={handleLoadProject} accept=".json" className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-xl text-[10px] font-black bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all">LOAD PROJECT</button>
            <button onClick={handleSaveProject} className="px-4 py-2 rounded-xl text-[10px] font-black bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 transition-all">SAVE PROJECT</button>
            <div className="w-px h-6 bg-zinc-800 mx-2" />
            <button onClick={() => setIsBlackout(!isBlackout)} className={`px-6 py-2 rounded-xl text-[10px] font-black border-2 transition-all ${isBlackout ? 'bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/30' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
              {isBlackout ? 'BLACKOUT ON' : 'BLACKOUT'}
            </button>
        </div>
      </header>

      <div className="flex-1 relative flex">
        <div className="w-16 border-r border-zinc-900 flex flex-col items-center py-6 gap-6 bg-zinc-950/50 z-40">
           <div className="flex flex-col gap-2 items-center">
             <span className="text-[7px] font-bold text-zinc-600 uppercase">Input</span>
             <button onClick={() => addNode('input')} className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-500 hover:scale-110 transition-all font-bold">IN</button>
             <button onClick={() => addNode('midi')} className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-500 hover:scale-110 transition-all font-bold">MIDI</button>
           </div>
           <div className="h-px w-8 bg-zinc-900" />
           <div className="flex flex-col gap-2 items-center">
             <span className="text-[7px] font-bold text-zinc-600 uppercase">DSP</span>
             <button onClick={() => addNode('audio')} className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-500 hover:scale-110 transition-all font-bold">DSP</button>
             <button onClick={() => addNode('math')} className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-500 hover:scale-110 transition-all font-bold">∑</button>
           </div>
           <div className="h-px w-8 bg-zinc-900" />
           <div className="flex flex-col gap-2 items-center w-full px-1">
             <span className="text-[7px] font-bold text-zinc-600 uppercase">Layout</span>
             <button onClick={() => autoLayout('smart')} className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center justify-center text-emerald-500 transition-all hover:bg-emerald-500/20"><span className="text-lg">→</span></button>
             <button onClick={() => autoLayout('grid')} className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 transition-all hover:bg-emerald-500/20">
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
                    onChange={(e) => setLayoutDensity(parseFloat(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-full appearance-none accent-emerald-500 cursor-pointer" 
                 />
             </div>
           </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onPaneContextMenu={(e) => handleContextMenu(e)}
            onNodeContextMenu={(e, n) => handleContextMenu(e, n)}
            onSelectionContextMenu={(e) => handleContextMenu(e)}
            fitView
            panOnDrag={isSpacePressed ? [0, 1] : [1]} 
            selectionOnDrag={!isSpacePressed}
            nodesDraggable={!isSpacePressed} 
            elementsSelectable={!isSpacePressed} 
            selectionMode={SelectionMode.Partial}
            zoomOnScroll={true}
            panOnScroll={false}
            zoomOnPinch={true}
          >
            <Controls />
            <Background />
            <Panel position="bottom-right" className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800 text-[9px] font-bold text-zinc-500">
               SPACE/MIDDLE-CLICK + DRAG TO PAN • HOLD ALT TO CUT • ADD NODES FOR LOGIC
            </Panel>
          </ReactFlow>

          {menu && (
            <div className="custom-context-menu" style={{ left: menu.x, top: menu.y }}>
                {!menu.nodeId ? (
                    <>
                        <div className="context-menu-item" onClick={() => addNode('input', screenToFlowPosition({ x: menu.x, y: menu.y }))}>+ Input Node</div>
                        <div className="context-menu-item" onClick={() => addNode('midi', screenToFlowPosition({ x: menu.x, y: menu.y }))}>+ MIDI Node</div>
                        <div className="context-menu-item" onClick={() => addNode('audio', screenToFlowPosition({ x: menu.x, y: menu.y }))}>+ DSP Node</div>
                        <div className="context-menu-item" onClick={() => addNode('math', screenToFlowPosition({ x: menu.x, y: menu.y }))}>+ Math Node</div>
                        <div className="context-menu-item" onClick={() => autoLayout('smart')}>Smart Layout</div>
                    </>
                ) : (
                    <>
                        <div className="context-menu-item" onClick={() => {
                            const node = nodes.find(n => n.id === menu.nodeId);
                            if (node) addNode(node.type as string, { x: node.position.x + 20, y: node.position.y + 20 });
                        }}>Duplicate</div>
                        <div className="context-menu-item text-red-500" onClick={() => deleteNode(menu.nodeId!)}>Delete Node</div>
                    </>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => (
  <ReactFlowProvider>
    <FlowWrapper />
  </ReactFlowProvider>
);

export default App;
