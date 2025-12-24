
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

// Components
import { FixtureNode } from './nodes/FixtureNode';
import { AudioNode } from './nodes/AudioNode';
import { MathNode } from './nodes/MathNode';
import { InputNode } from './nodes/InputNode';
import { MidiNode } from './nodes/MidiNode';
import ButtonEdge from './components/ButtonEdge';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ContextMenu from './components/ContextMenu';

// Services & Logic
import { DmxClient } from './services/dmxClient';
import { MidiManager } from './services/midiService';
import { evaluateGraph } from './utils/graphEngine';
import { computeAutoLayout } from './utils/autoLayout';
import { arraysEqual, getColorFromName } from './utils/helpers';
import { useKeyboard } from './hooks/useKeyboard';

// Types & Constants
import { ConnectionStatus, LuminaNode, LuminaEdge, MidiState } from './types';
import { DEFAULT_WS_URL, INITIAL_FIXTURES } from './constants';

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

const FlowWrapper: React.FC = () => {
  const { fitView, getNodes } = useReactFlow();
  
  // -- State --
  const [nodes, setNodes] = useState<LuminaNode[]>([]);
  const [edges, setEdges] = useState<LuminaEdge[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [isBlackout, setIsBlackout] = useState(false);
  const [txActivity, setTxActivity] = useState(false);
  const [menu, setMenu] = useState<{ x: number, y: number, nodeId?: string } | null>(null);
  const [layoutDensity, setLayoutDensity] = useState<number>(1.0);
  const [midiInitialized, setMidiInitialized] = useState(false);

  // -- Refs --
  const dmxClient = useRef<DmxClient | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const midiManagerRef = useRef<MidiManager | null>(null);
  const inputLevels = useRef<Record<string, { low: number, mid: number, high: number }>>({});
  const midiStateRef = useRef<MidiState>({});
  const nodesRef = useRef<LuminaNode[]>([]);
  const edgesRef = useRef<LuminaEdge[]>([]);
  const lastUiUpdate = useRef<number>(0);

  if (!midiManagerRef.current) {
    midiManagerRef.current = new MidiManager();
  }
  const midiManager = midiManagerRef.current;

  // -- Handlers --
  const handleSaveProject = () => {
    const nodesToSave = nodes.map(({ data, ...n }) => {
        const { onChange, onParamChange, onAudioLevelsUpdate, ...cleanData } = data as any;
        return { ...n, data: cleanData };
    });
    const blob = new Blob([JSON.stringify({ version: '2.5', timestamp: Date.now(), nodes: nodesToSave, edges }, null, 2)], { type: 'application/json' });
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

  // -- Hooks --
  const { isAltPressed, isSpacePressed, isMiddleMousePressed } = useKeyboard({
    onSave: handleSaveProject,
    onOpen: () => fileInputRef.current?.click()
  });

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

  // -- Layout Engine --
  const autoLayout = (mode: 'smart' | 'grid') => {
    setNodes(currentNodes => {
      const updatedNodes = computeAutoLayout(currentNodes, edges, mode, layoutDensity);
      if (!currentNodes.some(n => n.selected)) {
        setTimeout(() => fitView({ duration: 600, padding: 0.2 }), 50);
      }
      return updatedNodes;
    });
  };

  // -- Initialization --
  useEffect(() => {
    const initMidi = async () => {
        const success = await midiManager.init();
        if (success) {
            setMidiInitialized(true);
            if (window.luminaMidi) window.luminaMidi.isReady = true;
        }
    };

    window.luminaMidi = {
        isReady: false,
        setLearnMode: (cb) => midiManager.setLearnMode(cb),
        init: async () => {
             const success = await midiManager.init();
             if(window.luminaMidi) window.luminaMidi.isReady = success;
             if(success) setMidiInitialized(true);
             return success;
        },
        getDevices: () => midiManager.getDevices()
    };
    
    // AUTO-INIT MIDI
    initMidi();

    dmxClient.current = new DmxClient(DEFAULT_WS_URL, setStatus);
    
    // Load project from local storage
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

    return () => {
        midiManager.terminate();
        dmxClient.current?.close();
    };
  }, [injectHandlers, injectEdgeHandlers, handleNodeValueChange, handleNodeParamChange]);

  // -- State Persistence --
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
    const nodesToSave = nodes.map(({ data, ...n }) => {
        const { onChange, onParamChange, onAudioLevelsUpdate, ...cleanData } = data as any;
        return { ...n, data: cleanData };
    });
    localStorage.setItem('lumina-graph', JSON.stringify({ nodes: nodesToSave, edges }));
  }, [nodes, edges]);

  // -- Main Engine Loop --
  useEffect(() => {
    const blob = new Blob([`
      let timer = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (timer) clearTimeout(timer);
          let expected = Date.now() + 25;
          const step = () => {
             const dt = Date.now() - expected;
             if (dt > 25) expected = Date.now();
             self.postMessage('tick');
             expected += 25;
             timer = setTimeout(step, Math.max(0, 25 - dt));
          };
          timer = setTimeout(step, 25);
        } else if (e.data === 'stop') {
          if (timer) clearTimeout(timer);
        }
      };
    `], { type: 'application/javascript' });
    
    const timerWorker = new Worker(URL.createObjectURL(blob));

    timerWorker.onmessage = () => {
      midiStateRef.current = midiManager.getState();

      const { nodeValues, dmxUpdates, nodeUpdates } = evaluateGraph(
          nodesRef.current, 
          edgesRef.current, 
          inputLevels.current,
          midiStateRef.current
      );
      
      const now = performance.now();
      
      if (now - lastUiUpdate.current > 50) {
        let globalChanged = false;
        
        setNodes(nds => {
          const nextNodes = nds.map(n => {
            const newVals = nodeValues[n.id];
            const stateUpdates = nodeUpdates[n.id];
            
            let nodeDirty = false;
            let newData = n.data;

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

      const finalUpdates = isBlackout ? dmxUpdates.map(u => ({ ...u, val: 0 })) : dmxUpdates;
      if (dmxClient.current?.send(finalUpdates)) {
        setTxActivity(true);
        setTimeout(() => setTxActivity(false), 50);
      }
    };

    timerWorker.postMessage('start');
    
    return () => {
      timerWorker.postMessage('stop');
      timerWorker.terminate();
    };
  }, [isBlackout]);

  const onNodesChange = useCallback((changes: NodeChange<LuminaNode>[]) => setNodes((nds) => applyNodeChanges<LuminaNode>(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange<LuminaEdge>[]) => setEdges((eds) => applyEdgeChanges<LuminaEdge>(changes, eds)), []);
  
  const onConnect = useCallback((params: Connection) => {
    if (params.source === params.target) return;
    
    const currentNodes = getNodes();
    const targetNode = currentNodes.find(n => n.id === params.target);
    
    let connections: Connection[] = [params];
    
    if (targetNode?.selected) {
        const otherSelected = currentNodes.filter(n => n.selected && n.id !== params.target);
        const additionalConnections = otherSelected.map(n => ({
            ...params,
            target: n.id
        }));
        connections = [...connections, ...additionalConnections];
    }

    setEdges((eds) => {
        let nextEdges = eds;
        connections.forEach(conn => {
            if (conn.source === conn.target) return;
            const newEdge = injectEdgeHandlers({ 
                ...conn, 
                id: `e-${conn.source}-${conn.target}-${conn.sourceHandle}-${conn.targetHandle}`, 
                type: 'button' 
            } as LuminaEdge);
            nextEdges = addEdge(newEdge, nextEdges);
        });
        return nextEdges;
    });
  }, [getNodes, injectEdgeHandlers]);

  const addNode = (type: string, pos?: { x: number, y: number }) => {
    const id = `${type}-${Date.now()}`;
    let defaultParams: any = {};
    if (type === 'math') defaultParams = { scale: 1, offset: 0 };
    if (type === 'audio') defaultParams = { gain: 1, gate: 0, decay: 0 };
    if (type === 'midi') defaultParams = { channel: 1, type: 'cc', index: 1, mode: 'momentary', deviceId: 'ALL', deviceName: 'All Devices (Omni)' };

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
      <Header 
        status={status}
        txActivity={txActivity}
        isBlackout={isBlackout}
        onToggleBlackout={() => setIsBlackout(!isBlackout)}
        onSave={handleSaveProject}
        onLoad={handleLoadProject}
        onLoadClick={() => fileInputRef.current?.click()}
        fileInputRef={fileInputRef}
      />

      <div className="flex-1 relative flex">
        <Sidebar 
          onAddNode={(type) => addNode(type)}
          onAutoLayout={autoLayout}
          layoutDensity={layoutDensity}
          onDensityChange={setLayoutDensity}
        />

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
             <ContextMenu 
                menu={menu}
                nodes={nodes}
                onClose={() => setMenu(null)}
                onAddNode={addNode}
                onDeleteNode={deleteNode}
                onAutoLayout={autoLayout}
             />
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
