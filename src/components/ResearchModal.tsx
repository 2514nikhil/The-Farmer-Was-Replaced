'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, Lock, CheckCircle, Boxes, Sprout, Cpu, Wheat, TreePine, Carrot, CircleDot } from 'lucide-react';
import { useGameStore } from '@/stores/useGameStore';
import type { ResearchNode, Inventory } from '@/types/game';
import { useSound } from '@/hooks/useSound';

const CATEGORY_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  expansion: { label: 'Grid Expansion', icon: Boxes },
  crops: { label: 'Crop Unlocks', icon: Sprout },
  drone: { label: 'Drone Upgrades', icon: Cpu },
};

const RESOURCE_META: Record<keyof Inventory, { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string }> = {
  hay: { icon: Wheat, color: '#d4a017' },
  wood: { icon: TreePine, color: '#8b6914' },
  carrots: { icon: Carrot, color: '#c45a2a' },
  pumpkins: { icon: CircleDot, color: '#d4761a' },
};

function CostRow({ cost, inventory }: { cost: Partial<Inventory>; inventory: Inventory }) {
  const entries = (Object.keys(cost) as Array<keyof Inventory>).filter((k) => cost[k]);
  return (
    <div className="flex items-center gap-2.5 flex-wrap mt-1">
      {entries.map((key) => {
        const need = cost[key] || 0;
        const have = inventory[key];
        const short = have < need;
        const Icon = RESOURCE_META[key].icon;
        return (
          <span key={key} className={`flex items-center gap-1 text-xs font-mono ${short ? 'text-red-500' : 'text-farm-gold'}`}>
            <Icon className="w-3 h-3" style={{ color: short ? undefined : RESOURCE_META[key].color }} />
            {Math.floor(have)}/{need}
          </span>
        );
      })}
    </div>
  );
}

export function ResearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const research = useGameStore((s) => s.research);
  const inventory = useGameStore((s) => s.inventory);
  const unlockResearch = useGameStore((s) => s.unlockResearch);
  const getAvailableResearch = useGameStore((s) => s.getAvailableResearch);
  const hasResources = useGameStore((s) => s.hasResources);
  const { playSound } = useSound();
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['expansion', 'crops', 'drone']));

  if (!isOpen) return null;

  const available = getAvailableResearch();
  const isAvailable = (n: ResearchNode) => available.some((a) => a.id === n.id);
  const canAfford = (n: ResearchNode) => hasResources(n.cost);

  const grouped = research.reduce<Record<string, ResearchNode[]>>((acc, node) => {
    (acc[node.category] ||= []).push(node);
    return acc;
  }, {});

  const toggle = (cat: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  const handleUnlock = (node: ResearchNode) => {
    if (unlockResearch(node.id)) playSound('playResearch');
    else playSound('playError');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-xl shadow-panel-hover overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-farm-panel-border bg-farm-bg/50">
            <div className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-farm-accent" />
              <h2 className="font-mono text-lg text-farm-accent">RESEARCH</h2>
            </div>
            <div className="flex items-center gap-3">
              {(Object.keys(RESOURCE_META) as Array<keyof Inventory>).map((key) => {
                const Icon = RESOURCE_META[key].icon;
                return (
                  <span key={key} className="flex items-center gap-1 text-xs font-mono text-farm-text">
                    <Icon className="w-3.5 h-3.5" style={{ color: RESOURCE_META[key].color }} />
                    {Math.floor(inventory[key])}
                  </span>
                );
              })}
              <button onClick={onClose} className="p-1.5 rounded hover:bg-farm-panel-border text-farm-text-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <p className="px-5 pt-3 text-xs text-farm-text-muted">
            Unlocks are paid for directly out of your harvested hay, wood, carrots and pumpkins - harvest more to afford them.
          </p>

          <div className="p-4 overflow-y-auto space-y-3">
            {(['expansion', 'crops', 'drone'] as const).map((cat) => {
              const nodes = grouped[cat] || [];
              if (nodes.length === 0) return null;
              const meta = CATEGORY_META[cat];
              const isOpenCat = expanded.has(cat);

              return (
                <div key={cat}>
                  <button
                    onClick={() => toggle(cat)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-farm-bg hover:bg-farm-panel-border/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <meta.icon className="w-4 h-4 text-farm-accent" />
                      <span className="text-sm font-medium text-farm-text">{meta.label}</span>
                      <span className="text-xs text-farm-text-muted">
                        {nodes.filter((n) => n.unlocked).length}/{nodes.length}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-farm-text-muted transition-transform ${isOpenCat ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isOpenCat && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 ml-3 pl-3 border-l-2 border-farm-panel-border space-y-2 overflow-hidden"
                      >
                        {nodes.map((node) => {
                          const unlocked = node.unlocked;
                          const buyable = !unlocked && isAvailable(node) && canAfford(node);
                          return (
                            <div
                              key={node.id}
                              className={`p-3 rounded-lg border flex items-start justify-between gap-3 ${
                                unlocked
                                  ? 'bg-green-50 border-green-200'
                                  : buyable
                                  ? 'bg-farm-accent/5 border-farm-accent/30'
                                  : 'bg-farm-bg border-farm-panel-border opacity-70'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 text-sm font-medium text-farm-text">
                                  {node.name}
                                  {unlocked && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
                                  {!unlocked && !isAvailable(node) && <Lock className="w-3.5 h-3.5 text-farm-text-muted" />}
                                </div>
                                <p className="text-xs text-farm-text-muted mt-0.5">{node.description}</p>
                                {!unlocked && <CostRow cost={node.cost} inventory={inventory} />}
                              </div>
                              {!unlocked && (
                                <button
                                  onClick={() => handleUnlock(node)}
                                  disabled={!buyable}
                                  className="shrink-0 px-3 py-1.5 text-xs font-mono rounded-lg bg-farm-accent text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-farm-accent-hover transition-colors"
                                >
                                  Unlock
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
