
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import ButtonEdge from './components/ButtonEdge';
import { DmxClient } from './services/dmxClient';
import { evaluateGraph } from './utils/graphEngine';
import { ConnectionStatus, LuminaNode, LuminaEdge } from './types';
import { DEFAULT_WS_URL, INITIAL_FIXTURES } from './constants';

const nodeTypes = {
  fixture: FixtureNode,
  audio: AudioNode,
  math: MathNode,
  input: InputNode
};

const edgeTypes = {
  button: ButtonEdge
};

const getColorFromName = (name: string): string | undefined => {
  const n = name.toLowerCase();
  if (n.includes('red')) return '#ef4444';
  if (n.includes('green')) return '#10b981';
  if (n.includes('blue')) return '#3b82f6';
  if (n.includes('white')) return '#ffffff';
  return undefined;
};

const FlowWrapper: React.FC = () => {
  const { fitView, screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes] = useState<LuminaNode[]>([]);
  const [edges, setEdges] = useState<LuminaEdge[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [isBlackout, setIsBlackout] = useState(false);
  const [txActivity, setTxActivity] = useState(false);
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isMiddleMousePressed, setIsMiddleMousePressed] = useState(false);
  const [menu, setMenu] = useState<{ x: number, y: number, nodeId?: string } | null>(null);

  const dmxClient = useRef<DmxClient | null>(null);
  const inputLevels = useRef<Record<string, { low: number, mid: number, high: number }>>({});
  const nodesRef = useRef<LuminaNode[]>([]);
  const edgesRef = useRef<LuminaEdge[]>([]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Alt') {
        e.preventDefault();
        setIsAltPressed(true);
      }
      if (e.key === ' ') {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltPressed(false);
      if (e.key === ' ') setIsSpacePressed(false);
    };
    const mouseDown = (e: MouseEvent) => {
      if (e.button === 1) {
        setIsMiddleMousePressed(true);
      }
    };
    const mouseUp = (e: MouseEvent) => {
      if (e.button === 1) {
        setIsMiddleMousePressed(false);
      }
    };
    const blur = () => {
      setIsAltPressed(false);
      setIsSpacePressed(false);
      setIsMiddleMousePressed(false);
    };
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

  const autoLayout = (mode: 'horizontal' | 'grid' | 'vertical') => {
    setNodes(nds => {
      const newNodes = nds.map(n => ({ ...n }));
      if (mode === 'horizontal') {
        const columns: Record<string, LuminaNode[]> = { input: [], audio: [], math: [], fixture: [] };
        newNodes.forEach(n => columns[n.type as string]?.push(n));
        let currentX = 50;
        Object.keys(columns).forEach(key => {
          columns[key].forEach((n, i) => { n.position = { x: currentX, y: 100 + i * 400 }; });
          currentX += 450;
        });
      } else if (mode === 'grid') {
        const cols = Math.ceil(Math.sqrt(newNodes.length));
        newNodes.forEach((n, i) => { n.position = { x: (i % cols) * 400 + 50, y: Math.floor(i / cols) * 400 + 50 }; });
      }
      return newNodes;
    });
    setTimeout(() => fitView({ duration: 600, padding: 0.2 }), 50);
  };

  useEffect(() => {
    const saved = localStorage.getItem('lumina-graph');
    if (saved) {
      const { nodes: savedNodes, edges: savedEdges } = JSON.parse(saved);
      setNodes(savedNodes.map(injectHandlers));
      setEdges(savedEdges.map(injectEdgeHandlers));
    } else {
      const initialNodes: LuminaNode[] = [
        { id: 'input-1', type: 'input', position: { x: 50, y: 50 }, data: { label: 'Audio Input', type: 'input', values: [0,0,0] } },
        { id: 'audio-1', type: 'audio', position: { x: 450, y: 50 }, data: { label: 'DSP Analyzer', type: 'audio', values: [0,0,0] } },
        ...INITIAL_FIXTURES.map((f, i) => ({
          id: f.id, 
          type: 'fixture', 
          position: { x: 850 + (Math.floor(i/8) * 300), y: 50 + (i % 8) * 350 },
          data: { 
            label: f.name, 
            type: 'fixture', 
            color: getColorFromName(f.name),
            params: { ...f, fixtureType: f.type, currentValues: f.values }, 
            onChange: handleNodeValueChange, 
            onParamChange: handleNodeParamChange 
          }
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

  useEffect(() => {
    dmxClient.current = new DmxClient(DEFAULT_WS_URL, setStatus);
    const ticker = setInterval(() => {
      const { nodeValues, dmxUpdates } = evaluateGraph(nodesRef.current, edgesRef.current, inputLevels.current);
      setNodes(nds => nds.map(n => {
        const newVals = nodeValues[n.id];
        const updatedParams = n.type === 'fixture' ? { ...n.data.params, currentValues: newVals } : n.data.params;
        if (JSON.stringify(newVals) !== JSON.stringify(n.data.values) || n.type === 'fixture') {
          return { ...n, data: { ...n.data, values: newVals, params: updatedParams } };
        }
        return n;
      }));
      const finalUpdates = isBlackout ? dmxUpdates.map(u => ({ ...u, val: 0 })) : dmxUpdates;
      const active = dmxClient.current?.send(finalUpdates);
      if (active) {
        setTxActivity(true);
        setTimeout(() => setTxActivity(false), 50);
      }
    }, 33);
    return () => { clearInterval(ticker); dmxClient.current?.close(); };
  }, [isBlackout]);

  const onNodesChange = useCallback((changes: NodeChange<LuminaNode>[]) => setNodes((nds) => applyNodeChanges<LuminaNode>(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange<LuminaEdge>[]) => setEdges((eds) => applyEdgeChanges<LuminaEdge>(changes, eds)), []);
  
  const onConnect = useCallback((params: Connection) => {
    const newEdge = injectEdgeHandlers({
        ...params,
        id: `e-${params.source}-${params.target}-${params.sourceHandle}-${params.targetHandle}`,
        type: 'button'
    } as LuminaEdge);
    setEdges((eds) => addEdge(newEdge, eds));
  }, [injectEdgeHandlers]);

  const addNode = (type: string, pos?: { x: number, y: number }) => {
    const id = `${type}-${Date.now()}`;
    const newNode: LuminaNode = injectHandlers({
      id, type, position: pos || { x: 100, y: 100 },
      data: { label: type.toUpperCase(), type, params: type === 'math' ? { scale: 1, offset: 0 } : {} }
    } as LuminaNode);
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
        <div className="flex-1 flex justify-center text-[10px] font-black text-zinc-600 uppercase tracking-widest">
            Art-Net Control Center v2.1 • Signal Flow Engine
        </div>
        <button onClick={() => setIsBlackout(!isBlackout)} className={`px-6 py-2 rounded-xl text-[10px] font-black border-2 transition-all ${isBlackout ? 'bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/30' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
          {isBlackout ? 'BLACKOUT ON' : 'BLACKOUT'}
        </button>
      </header>

      <div className="flex-1 relative flex">
        <div className="w-16 border-r border-zinc-900 flex flex-col items-center py-6 gap-6 bg-zinc-950/50 z-40">
           <div className="flex flex-col gap-2 items-center">
             <span className="text-[7px] font-bold text-zinc-600 uppercase">Input</span>
             <button onClick={() => addNode('input')} className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-500 hover:scale-110 hover:border-emerald-500/50 transition-all font-bold" title="Add Input Node">IN</button>
           </div>
           <div className="h-px w-8 bg-zinc-900" />
           <div className="flex flex-col gap-2 items-center">
             <span className="text-[7px] font-bold text-zinc-600 uppercase">DSP</span>
             <button onClick={() => addNode('audio')} className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-500 hover:scale-110 hover:border-emerald-500/50 transition-all font-bold" title="Add DSP Node">DSP</button>
             <button onClick={() => addNode('math')} className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-500 hover:scale-110 hover:border-emerald-500/50 transition-all font-bold" title="Add Math Node">∑</button>
           </div>
           <div className="h-px w-8 bg-zinc-900" />
           <div className="flex flex-col gap-2 items-center">
             <span className="text-[7px] font-bold text-zinc-600 uppercase">Sort</span>
             <button onClick={() => autoLayout('horizontal')} className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center justify-center text-emerald-500 transition-all" title="Flow Sort">
                <span className="text-lg">→</span>
             </button>
             <button onClick={() => autoLayout('grid')} className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 transition-all" title="Grid Sort">
                <div className="grid grid-cols-2 gap-0.5"><div className="w-1.5 h-1.5 bg-current rounded-sm"></div><div className="w-1.5 h-1.5 bg-current rounded-sm"></div><div className="w-1.5 h-1.5 bg-current rounded-sm"></div><div className="w-1.5 h-1.5 bg-current rounded-sm"></div></div>
             </button>
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
               SPACE/MIDDLE-CLICK + DRAG TO PAN • HOLD ALT TO CUT • ADD INPUT TO START SYNC
            </Panel>
          </ReactFlow>

          {menu && (
            <div className="custom-context-menu" style={{ left: menu.x, top: menu.y }}>
                {!menu.nodeId ? (
                    <>
                        <div className="context-menu-item" onClick={() => addNode('input', screenToFlowPosition({ x: menu.x, y: menu.y }))}>+ Input Node</div>
                        <div className="context-menu-item" onClick={() => addNode('audio', screenToFlowPosition({ x: menu.x, y: menu.y }))}>+ DSP Node</div>
                        <div className="context-menu-item" onClick={() => addNode('math', screenToFlowPosition({ x: menu.x, y: menu.y }))}>+ Math Node</div>
                        <div className="context-menu-item" onClick={() => autoLayout('grid')}>Auto Layout</div>
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
