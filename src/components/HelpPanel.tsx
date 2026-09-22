'use client';

import { X, RotateCcw } from 'lucide-react';
import { clearSavedGame } from '@/hooks/useGamePersistence';

const FUNCTIONS: Array<{ sig: string; desc: string }> = [
  { sig: 'move(direction)', desc: 'Move one tile: North, South, East, West. Returns True if it moved, False if blocked by the edge.' },
  { sig: 'plant(crop)', desc: 'Plant a crop: Grass, Bush, Carrot, Pumpkin.' },
  { sig: 'harvest()', desc: 'Harvest the crop under the drone, if ready.' },
  { sig: 'water()', desc: 'Water the current tile.' },
  { sig: 'till()', desc: "Permanently boosts this tile's growth speed (diminishing, caps after a few tills)." },
  { sig: 'get_pos()', desc: "Returns the drone's (x, y) position." },
  { sig: 'can_harvest()', desc: 'Returns True if the current tile is ready.' },
  { sig: 'get_crop()', desc: 'Crop type at the current tile, or None.' },
  { sig: 'get_moisture()', desc: 'Current tile moisture, 0 to 1.' },
  { sig: 'get_growth()', desc: 'Current tile growth progress, 0 to 1.' },
  { sig: 'grid_size()', desc: 'Current grid size (e.g. 3 for 3x3).' },
  { sig: 'spawn_drone()', desc: 'Spawns another drone, returns a handle to control it.' },
];

export function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute top-16 right-4 z-30 w-96 max-w-[85vw] rounded-xl bg-white/95 border border-farm-panel-border shadow-panel overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-farm-panel-border bg-farm-bg/70">
        <span className="font-mono text-xs text-farm-accent">FUNCTIONS</span>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded hover:bg-farm-panel-border text-farm-text-muted transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-2.5 max-h-80 overflow-y-auto">
        {FUNCTIONS.map((f) => (
          <div key={f.sig}>
            <div className="font-mono text-xs text-farm-accent">{f.sig}</div>
            <div className="text-xs text-farm-text-muted">{f.desc}</div>
          </div>
        ))}
        <p className="text-[11px] text-farm-text-muted pt-1 border-t border-farm-panel-border">
          The field is covered in wild wheat (Grass) by default and grows on its own - <code>plant(crop)</code> is only
          needed to replace it with something else.
        </p>
        <p className="text-[11px] text-farm-text-muted">
          No <code>await</code> needed - each call is automatically sequenced, and the drone visibly finishes one
          action before the next line runs.
        </p>
        <div className="text-[11px] text-farm-text-muted pt-1 border-t border-farm-panel-border">
          <p className="mb-1">
            Multiple drones run concurrently via asyncio - <code>spawn_drone()</code> handles need explicit{' '}
            <code>await</code>, since they aren&apos;t auto-sequenced like the main drone:
          </p>
          <pre className="font-mono text-[10px] bg-farm-bg rounded p-2 overflow-x-auto whitespace-pre">{`import asyncio

async def run(d):
    while True:
        if not await d.move(East):
            break

d2 = spawn_drone()
asyncio.ensure_future(run(d2))

while True:
    move(East)`}</pre>
        </div>
        <div className="pt-1 border-t border-farm-panel-border">
          <p className="text-[11px] text-farm-text-muted mb-2">
            Your farm, inventory, research and scripts autosave in this browser every few seconds.
          </p>
          <button
            onClick={() => {
              if (!window.confirm('Reset all progress? This clears your farm, inventory, research, and scripts.')) return;
              clearSavedGame();
              window.location.reload();
            }}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset progress
          </button>
        </div>
      </div>
    </div>
  );
}
