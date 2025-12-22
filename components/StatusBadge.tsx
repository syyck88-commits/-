
import React from 'react';
import { ConnectionStatus } from '../types';

interface StatusBadgeProps {
  status: ConnectionStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getColors = () => {
    switch (status) {
      case ConnectionStatus.CONNECTED:
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case ConnectionStatus.CONNECTING:
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case ConnectionStatus.DISCONNECTED:
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
    }
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${getColors()}`}>
      <span className={`w-2 h-2 rounded-full animate-pulse ${status === ConnectionStatus.CONNECTED ? 'bg-emerald-500' : status === ConnectionStatus.CONNECTING ? 'bg-amber-500' : 'bg-red-500'}`} />
      {status}
    </div>
  );
};

export default StatusBadge;
