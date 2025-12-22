
import { LuminaNode, LuminaEdge, MixingStrategy, DmxValue } from '../types';
import { FIXTURE_LAYOUTS } from '../constants';

export const evaluateGraph = (
  nodes: LuminaNode[], 
  edges: LuminaEdge[], 
  inputLevels: Record<string, { low: number, mid: number, high: number }>
): { nodeValues: Record<string, number[]>, dmxUpdates: DmxValue[] } => {
  const nodeValues: Record<string, number[]> = {};
  const dmxUpdates: DmxValue[] = [];

  const sortedNodes = [...nodes].sort((a, b) => {
    const order = ['input', 'audio', 'constant', 'math', 'fixture'];
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

      case 'audio': {
        // Find input node connected to this analyzer
        const inputEdge = edges.find(e => e.target === node.id && e.targetHandle === 'signal-in');
        if (inputEdge) {
            const levels = inputLevels[inputEdge.source] || { low: 0, mid: 0, high: 0 };
            outputs = [levels.low, levels.mid, levels.high];
        } else {
            outputs = [0, 0, 0];
        }
        break;
      }

      case 'constant':
        outputs = [node.data.params?.value ?? 0];
        break;

      case 'math': {
        const inputs = getInputsForNode(node.id, edges, nodeValues);
        const mixing = node.data.mixing || 'max';
        const raw = mix(inputs, mixing);
        const scale = node.data.params?.scale ?? 1;
        const offset = node.data.params?.offset ?? 0;
        outputs = [Math.min(255, Math.max(0, raw * scale + offset))];
        break;
      }

      case 'fixture': {
        outputs = node.data.params.manualValues.map((manual: number, idx: number) => {
          const inputHandle = `in-${idx}`;
          const inputs = getInputsForHandle(node.id, inputHandle, edges, nodeValues);
          if (inputs.length === 0) return manual;
          
          const mixing = node.data.mixing || 'max';
          return Math.round(mix(inputs, mixing));
        });

        outputs.forEach((val, idx) => {
          dmxUpdates.push({ 
            ch: node.data.params.startChannel + idx, 
            val: node.data.params.mutes[idx] ? 0 : val 
          });
        });
        break;
      }
    }

    nodeValues[node.id] = outputs;
  });

  return { nodeValues, dmxUpdates };
};

const getInputsForNode = (nodeId: string, edges: LuminaEdge[], nodeValues: Record<string, number[]>) => {
  return edges
    .filter(e => e.target === nodeId)
    .map(e => {
      const sourceVals = nodeValues[e.source] || [];
      const sourceIdx = parseInt(e.sourceHandle?.split('-')[1] || '0');
      return sourceVals[sourceIdx] ?? 0;
    });
};

const getInputsForHandle = (nodeId: string, handleId: string, edges: LuminaEdge[], nodeValues: Record<string, number[]>) => {
  return edges
    .filter(e => e.target === nodeId && e.targetHandle === handleId)
    .map(e => {
      const sourceVals = nodeValues[e.source] || [];
      const sourceIdx = parseInt(e.sourceHandle?.split('-')[1] || '0');
      return sourceVals[sourceIdx] ?? 0;
    });
};

const mix = (values: number[], strategy: MixingStrategy): number => {
  if (values.length === 0) return 0;
  switch (strategy) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'max': return Math.max(...values);
    case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
    case 'last': return values[values.length - 1];
    default: return Math.max(...values);
  }
};
