
import React from 'react';
import { LuminaNode } from '../types';
import { useReactFlow } from '@xyflow/react';

interface ContextMenuProps {
    menu: { x: number, y: number, nodeId?: string };
    nodes: LuminaNode[];
    onClose: () => void;
    onAddNode: (type: string, pos: { x: number, y: number }) => void;
    onDeleteNode: (id: string) => void;
    onAutoLayout: (mode: 'smart') => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ menu, nodes, onClose, onAddNode, onDeleteNode, onAutoLayout }) => {
    const { screenToFlowPosition } = useReactFlow();

    return (
        <div className="custom-context-menu" style={{ left: menu.x, top: menu.y }}>
            {!menu.nodeId ? (
                <>
                    <div className="context-menu-item" onClick={() => onAddNode('input', screenToFlowPosition({ x: menu.x, y: menu.y }))}>+ Input Node</div>
                    <div className="context-menu-item" onClick={() => onAddNode('midi', screenToFlowPosition({ x: menu.x, y: menu.y }))}>+ MIDI Node</div>
                    <div className="context-menu-item" onClick={() => onAddNode('audio', screenToFlowPosition({ x: menu.x, y: menu.y }))}>+ DSP Node</div>
                    <div className="context-menu-item" onClick={() => onAddNode('math', screenToFlowPosition({ x: menu.x, y: menu.y }))}>+ Math Node</div>
                    <div className="context-menu-item" onClick={() => onAutoLayout('smart')}>Smart Layout</div>
                </>
            ) : (
                <>
                    <div className="context-menu-item" onClick={() => {
                        const node = nodes.find(n => n.id === menu.nodeId);
                        if (node) onAddNode(node.type as string, { x: node.position.x + 20, y: node.position.y + 20 });
                    }}>Duplicate</div>
                    <div className="context-menu-item text-red-500" onClick={() => onDeleteNode(menu.nodeId!)}>Delete Node</div>
                </>
            )}
        </div>
    );
};

export default ContextMenu;
