'use client';

import { Wheat, TreePine, Carrot, CircleDot, AlertTriangle, Plus, Info, Boxes } from 'lucide-react';
import { useInventory } from '@/stores/useGameStore';

interface TopBarProps {
  errorCount: number;
  onOpenConsole: () => void;
  onNewScript: () => void;
  onOpenHelp: () => void;
  onOpenResearch: () => void;
}

const RESOURCE_ICONS = [
  { key: 'hay', icon: Wheat, color: '#d4a017' },
  { key: 'wood', icon: TreePine, color: '#8b6914' },
  { key: 'carrots', icon: Carrot, color: '#c45a2a' },
  { key: 'pumpkins', icon: CircleDot, color: '#d4761a' },
] as const;

function formatCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${Math.floor(n)}`;
}

function IconButton({ onClick, title, badge, children }: { onClick: () => void; title: string; badge?: number; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="relative w-9 h-9 flex items-center justify-center rounded-lg bg-white/90 border border-farm-panel-border shadow-panel hover:border-farm-accent hover:bg-white transition-colors text-farm-text"
    >
      {children}
      {!!badge && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-farm-accent text-white text-[10px] leading-4 text-center font-mono">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

export function TopBar({ errorCount, onOpenConsole, onNewScript, onOpenHelp, onOpenResearch }: TopBarProps) {
  const inventory = useInventory();

  return (
    <>
      <div className="absolute top-4 left-4 z-20 flex gap-2 flex-wrap max-w-[70vw]">
        {RESOURCE_ICONS.map(({ key, icon: Icon, color }) => (
          <div
            key={key}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/90 border border-farm-panel-border shadow-panel"
          >
            <Icon className="w-4 h-4" style={{ color }} />
            <span className="font-mono text-sm text-farm-text tabular-nums">{formatCount(inventory[key])}</span>
          </div>
        ))}
      </div>

      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <IconButton onClick={onOpenConsole} title="Console & errors" badge={errorCount}>
          <AlertTriangle className="w-4 h-4" />
        </IconButton>
        <IconButton onClick={onNewScript} title="New script">
          <Plus className="w-4 h-4" />
        </IconButton>
        <IconButton onClick={onOpenHelp} title="Function reference">
          <Info className="w-4 h-4" />
        </IconButton>
        <IconButton onClick={onOpenResearch} title="Research tree">
          <Boxes className="w-4 h-4" />
        </IconButton>
      </div>
    </>
  );
}
