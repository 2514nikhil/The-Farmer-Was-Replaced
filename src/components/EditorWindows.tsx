'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Square, Minus, X, GripHorizontal } from 'lucide-react';
import { useGameStore } from '@/stores/useGameStore';
import { useSound } from '@/hooks/useSound';
import { MonacoEditor } from './MonacoEditor';

interface WindowState {
  id: number;
  scriptIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  z: number;
}

interface EditorWindowsProps {
  registerNewScript: (fn: () => void) => void;
  executeCode: (code: string) => void;
  stopExecution: () => void;
  isReady: boolean;
}

export function EditorWindows({ registerNewScript, executeCode, stopExecution, isReady }: EditorWindowsProps) {
  const scripts = useGameStore((s) => s.scripts);
  const updateScript = useGameStore((s) => s.updateScript);
  const addScript = useGameStore((s) => s.addScript);
  const removeScript = useGameStore((s) => s.removeScript);
  const renameScript = useGameStore((s) => s.renameScript);
  const gamePhase = useGameStore((s) => s.gamePhase);

  const { playClick } = useSound();

  const [windows, setWindows] = useState<WindowState[]>([]);
  const [runningIndex, setRunningIndex] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const nextId = useRef(1);
  const nextZ = useRef(10);
  const dragRef = useRef<{ id: number; startX: number; startY: number; wx: number; wy: number } | null>(null);
  const resizeRef = useRef<{ id: number; startX: number; startY: number; w: number; h: number } | null>(null);

  // Ensure every script (including ones just restored from a save, or
  // newly added) has a window open. Keyed on scripts.length so it re-runs
  // whenever a save is loaded and swaps in a different script list, not
  // just once on mount.
  useEffect(() => {
    setWindows((prev) => {
      const existing = new Set(prev.map((w) => w.scriptIndex));
      const missing = scripts.map((_, i) => i).filter((i) => !existing.has(i));
      if (missing.length === 0) return prev;
      const additions = missing.map((scriptIndex, k) => {
        const offset = (prev.length + k) * 28;
        return {
          id: nextId.current++,
          scriptIndex,
          x: 90 + offset,
          y: 90 + offset,
          width: 420,
          height: 300,
          minimized: false,
          z: nextZ.current++,
        };
      });
      return [...prev, ...additions];
    });
  }, [scripts.length]);

  const newScript = useCallback(() => {
    playClick();
    addScript(`script_${scripts.length + 1}.py`);
  }, [scripts.length, addScript, playClick]);

  useEffect(() => {
    registerNewScript(newScript);
  }, [registerNewScript, newScript]);

  const bringToFront = useCallback((id: number) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, z: nextZ.current++ } : w)));
  }, []);

  const closeWindow = useCallback(
    (win: WindowState) => {
      if (scripts.length <= 1) return;
      // Removing a script shifts every later index down by one - keep the
      // remaining windows' scriptIndex in sync with the store, or they'd
      // silently point at the wrong script after this.
      setWindows((prev) =>
        prev
          .filter((w) => w.id !== win.id)
          .map((w) => (w.scriptIndex > win.scriptIndex ? { ...w, scriptIndex: w.scriptIndex - 1 } : w))
      );
      removeScript(win.scriptIndex);
    },
    [scripts.length, removeScript]
  );

  const toggleMinimize = useCallback((id: number) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: !w.minimized } : w)));
  }, []);

  const runOrStop = useCallback(
    (scriptIndex: number) => {
      playClick();
      if (gamePhase !== 'idle') {
        stopExecution();
        setRunningIndex(null);
        return;
      }
      const script = scripts[scriptIndex];
      if (!script) return;
      setRunningIndex(scriptIndex);
      executeCode(script.content);
    },
    [gamePhase, scripts, executeCode, stopExecution, playClick]
  );

  useEffect(() => {
    if (gamePhase === 'idle') setRunningIndex(null);
  }, [gamePhase]);

  // Drag / resize handling
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragRef.current) {
        const { id, startX, startY, wx, wy } = dragRef.current;
        setWindows((prev) =>
          prev.map((w) => (w.id === id ? { ...w, x: wx + (e.clientX - startX), y: wy + (e.clientY - startY) } : w))
        );
      } else if (resizeRef.current) {
        const { id, startX, startY, w: sw, h: sh } = resizeRef.current;
        setWindows((prev) =>
          prev.map((w) =>
            w.id === id
              ? { ...w, width: Math.max(280, sw + (e.clientX - startX)), height: Math.max(180, sh + (e.clientY - startY)) }
              : w
          )
        );
      }
    };
    const onUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const startDrag = (e: React.MouseEvent, w: WindowState) => {
    e.preventDefault();
    bringToFront(w.id);
    dragRef.current = { id: w.id, startX: e.clientX, startY: e.clientY, wx: w.x, wy: w.y };
  };

  const startResize = (e: React.MouseEvent, w: WindowState) => {
    e.preventDefault();
    e.stopPropagation();
    bringToFront(w.id);
    resizeRef.current = { id: w.id, startX: e.clientX, startY: e.clientY, w: w.width, h: w.height };
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {windows.map((w) => {
        const script = scripts[w.scriptIndex];
        if (!script) return null;
        const isRunningThis = runningIndex === w.scriptIndex && gamePhase !== 'idle';

        return (
          <div
            key={w.id}
            className="absolute pointer-events-auto flex flex-col rounded-xl bg-white/95 border border-farm-panel-border shadow-panel overflow-hidden"
            style={{ left: w.x, top: w.y, width: w.width, height: w.minimized ? 'auto' : w.height, zIndex: w.z }}
            onMouseDown={() => bringToFront(w.id)}
          >
            <div
              className="flex items-center gap-2 px-2.5 py-2 border-b border-farm-panel-border bg-farm-bg/70 cursor-move select-none"
              onMouseDown={(e) => startDrag(e, w)}
            >
              <GripHorizontal className="w-3.5 h-3.5 text-farm-text-muted shrink-0" />
              <span className={`w-2 h-2 rounded-full shrink-0 ${isRunningThis ? 'bg-farm-green animate-pulse' : 'bg-farm-panel-border'}`} />
              {renamingId === w.id ? (
                <input
                  autoFocus
                  defaultValue={script.name}
                  onBlur={(e) => {
                    if (e.target.value.trim()) renameScript(w.scriptIndex, e.target.value.trim());
                    setRenamingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  className="flex-1 min-w-0 text-xs font-mono bg-white border border-farm-accent rounded px-1 py-0.5 text-farm-text"
                  onMouseDown={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="flex-1 min-w-0 truncate text-xs font-mono text-farm-text"
                  onDoubleClick={() => setRenamingId(w.id)}
                  title="Double-click to rename"
                >
                  {script.name}
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  runOrStop(w.scriptIndex);
                }}
                disabled={!isReady}
                className={`w-6 h-6 flex items-center justify-center rounded transition-colors disabled:opacity-40 ${
                  isRunningThis ? 'bg-farm-accent/15 text-farm-accent hover:bg-farm-accent/25' : 'text-farm-text-muted hover:bg-farm-panel-border'
                }`}
                title={isRunningThis ? 'Stop' : 'Run'}
              >
                {isRunningThis ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMinimize(w.id);
                }}
                className="w-6 h-6 flex items-center justify-center rounded text-farm-text-muted hover:bg-farm-panel-border transition-colors"
                title={w.minimized ? 'Expand' : 'Minimize'}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              {scripts.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeWindow(w);
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded text-farm-text-muted hover:bg-red-100 hover:text-red-500 transition-colors"
                  title="Delete script"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {!w.minimized && (
              <div className="flex-1 min-h-0 relative">
                <MonacoEditor content={script.content} onChange={(content) => updateScript(w.scriptIndex, content)} />
                <div
                  className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
                  onMouseDown={(e) => startResize(e, w)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
