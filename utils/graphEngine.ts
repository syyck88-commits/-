
import { LuminaNode, LuminaEdge, MixingStrategy, DmxValue, MidiState } from '../types';
import { FIXTURE_LAYOUTS } from '../constants';

export const evaluateGraph = (
  nodes: LuminaNode[], 
  edges: LuminaEdge[], 
  inputLevels: Record<string, { low: number, mid: number, high: number }>,
  midiState: MidiState
): { nodeValues: Record<string, number[]>, dmxUpdates: DmxValue[], nodeUpdates: Record<string, any> } => {
  const nodeValues: Record<string, number[]> = {};
  const dmxUpdates: DmxValue[] = [];
  const nodeUpdates: Record<string, any> = {};

  // Sort nodes for correct topological dependency evaluation
  const sortedNodes = [...nodes].sort((a, b) => {
    const order = ['input', 'midi', 'audio', 'constant', 'math', 'fixture'];
    return order.indexOf(a.type as string) - order.indexOf(b.type as string);
  });

  sortedNodes.forEach(node => {
    let outputs: number[] = [];

    switch (node.type) {
      case 'input': {
        const levels = inputLevels[node.id] || { low: 0, mid: 0, high: 0 };
        outputs = [levels.low, levels.mid, levels.high];
        break;
      }

      case 'midi': {
        const ch = node.data.params?.channel || 1;
        const type = node.data.params?.type || 'cc';
        const idx = node.data.params?.index || 0;
        const mode = node.data.params?.mode || 'momentary';
        const deviceId = node.data.params?.deviceId || 'ALL';

        const key = `${deviceId}__${ch}-${type}-${idx}`;
        const rawVal = midiState[key] ?? 0;

        let finalVal = rawVal;
        
        if (mode === 'toggle') {
            const prevRaw = node.data.params?._prevRaw || 0;
            const currentToggle = node.data.params?._toggleState || 0;
            
            if (rawVal > 127 && prevRaw <= 127) {
                finalVal = currentToggle > 0 ? 0 : 255;
                nodeUpdates[node.id] = { 
                    _toggleState: finalVal,
                    _prevRaw: rawVal
                };
            } else {
                finalVal = currentToggle;
                nodeUpdates[node.id] = { 
                    _prevRaw: rawVal
                };
            }
        }
        outputs = [finalVal];
        break;
      }

      case 'audio': {
        const inputEdge = edges.find(e => e.target === node.id && e.targetHandle === 'signal-in');
        let raw = [0, 0, 0];
        if (inputEdge) {
            const levels = inputLevels[inputEdge.source] || { low: 0, mid: 0, high: 0 };
            raw = [levels.low, levels.mid, levels.high];
        } else {
             const inputs = getInputsForNode(node.id, edges, nodeValues);
             if (inputs.length >= 3) raw = [inputs[0], inputs[1], inputs[2]];
             else if (inputs.length > 0) raw = [inputs[0], inputs[0], inputs[0]];
        }

        const gain = node.data.params?.gain ?? 1;
        const gate = node.data.params?.gate ?? 0;
        const decay = node.data.params?.decay ?? 0;
        const prevValues = node.data.values || [0, 0, 0];
        
        outputs = raw.map((val, idx) => {
            let processed = val * gain;
            if (processed < gate) processed = 0;
            const prev = prevValues[idx];
            if (processed < prev) {
                processed = Math.max(processed, prev * (0.5 + (decay * 0.49))); 
            }
            return processed > 255 ? 255 : (processed < 0 ? 0 : processed);
        });

        const now = Date.now();
        const lowVal = outputs[0];
        const lastBeatTime = node.data.params?._lastBeatTime || 0;
        const bpmHistory = node.data.params?._bpmHistory || [];
        const beatThreshold = Math.max(100, gate + 20); 
        
        let newBpm = node.data.params?.bpm || 0;
        let isBeat = false;
        let newLastBeatTime = lastBeatTime;
        let newBpmHistory = bpmHistory;

        if (lowVal > beatThreshold && (now - lastBeatTime > 250)) {
             isBeat = true;
             if (lastBeatTime > 0) {
                 const interval = now - lastBeatTime;
                 const instantBpm = 60000 / interval;
                 if (instantBpm > 40 && instantBpm < 200) {
                    newBpmHistory = [...bpmHistory, instantBpm];
                    if (newBpmHistory.length > 8) newBpmHistory.shift();
                    newBpm = Math.round(newBpmHistory.reduce((a: number, b: number) => a + b, 0) / newBpmHistory.length);
                 }
             }
             newLastBeatTime = now;
        } else if (now - lastBeatTime > 2000) {
            newBpm = 0;
            newBpmHistory = [];
        }

        nodeUpdates[node.id] = { 
            ...(nodeUpdates[node.id] || {}),
            _lastBeatTime: newLastBeatTime,
            _bpmHistory: newBpmHistory,
            bpm: newBpm,
            isBeat: isBeat
        };
        break;
      }

      case 'math': {
        const inputs = getInputsForNode(node.id, edges, nodeValues);
        const mixing = node.data.mixing || 'max';
        const raw = mix(inputs, mixing);
        const scale = node.data.params?.scale ?? 1;
        const offset = node.data.params?.offset ?? 0;
        const final = raw * scale + offset;
        outputs = [final > 255 ? 255 : (final < 0 ? 0 : final)];
        break;
      }

      case 'fixture': {
        const manualValues = node.data.params.manualValues;
        const mixing = node.data.mixing || 'max';
        const mutes = node.data.params.mutes;
        const startChannel = node.data.params.startChannel;
        
        outputs = manualValues.map((manual: number, idx: number) => {
          const inputHandle = `in-${idx}`;
          const inputs = getInputsForHandle(node.id, inputHandle, edges, nodeValues);
          const val = inputs.length === 0 ? manual : Math.round(mix(inputs, mixing));
          
          dmxUpdates.push({ 
            ch: startChannel + idx, 
            val: mutes[idx] ? 0 : (val > 255 ? 255 : val)
          });
          return val;
        });
        break;
      }
    }

    nodeValues[node.id] = outputs;
  });

  return { nodeValues, dmxUpdates, nodeUpdates };
};

const getInputsForNode = (nodeId: string, edges: LuminaEdge[], nodeValues: Record<string, number[]>) => {
  const result: number[] = [];
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    if (e.target === nodeId) {
      const sourceVals = nodeValues[e.source] || [];
      const sourceIdx = parseInt(e.sourceHandle?.split('-')[1] || '0');
      result.push(sourceVals[sourceIdx] ?? 0);
    }
  }
  return result;
};

const getInputsForHandle = (nodeId: string, handleId: string, edges: LuminaEdge[], nodeValues: Record<string, number[]>) => {
  const result: number[] = [];
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    if (e.target === nodeId && e.targetHandle === handleId) {
      const sourceVals = nodeValues[e.source] || [];
      const sourceIdx = parseInt(e.sourceHandle?.split('-')[1] || '0');
      result.push(sourceVals[sourceIdx] ?? 0);
    }
  }
  return result;
};

const mix = (values: number[], strategy: MixingStrategy): number => {
  if (values.length === 0) return 0;
  switch (strategy) {
    case 'sum': {
        let sum = 0;
        for (let i = 0; i < values.length; i++) sum += values[i];
        return sum;
    }
    case 'max': {
        let m = values[0];
        for (let i = 1; i < values.length; i++) if (values[i] > m) m = values[i];
        return m;
    }
    case 'avg': {
        let sum = 0;
        for (let i = 0; i < values.length; i++) sum += values[i];
        return sum / values.length;
    }
    case 'last': return values[values.length - 1];
    default: return Math.max(...values);
  }
};
