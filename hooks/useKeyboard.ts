
import { useState, useEffect } from 'react';

interface KeyboardProps {
    onSave: () => void;
    onOpen: () => void;
}

export const useKeyboard = ({ onSave, onOpen }: KeyboardProps) => {
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isMiddleMousePressed, setIsMiddleMousePressed] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Alt') { e.preventDefault(); setIsAltPressed(true); }
      if (e.key === ' ') { e.preventDefault(); setIsSpacePressed(true); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); onSave(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') { e.preventDefault(); onOpen(); }
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
  }, [onSave, onOpen]);

  return { isAltPressed, isSpacePressed, isMiddleMousePressed };
};
