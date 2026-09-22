'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/stores/useGameStore';
import type { SaveData } from '@/types/game';

const SAVE_KEY = 'farmer-replaced-save-v1';
const LEGACY_SCRIPTS_KEY = 'farmer-replaced-scripts-v2';
const AUTOSAVE_INTERVAL = 4000;

function isValidSaveData(data: unknown): data is SaveData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Partial<SaveData>;
  return Array.isArray(d.grid) && Array.isArray(d.drones) && Array.isArray(d.scripts);
}

// Carries over scripts saved under the old, scripts-only persistence key
// (before full game state was saved) so in-progress code isn't lost.
function migrateLegacyScripts() {
  try {
    const raw = localStorage.getItem(LEGACY_SCRIPTS_KEY);
    if (raw) {
      const scripts = JSON.parse(raw);
      if (Array.isArray(scripts) && scripts.length > 0) {
        useGameStore.setState({ scripts });
      }
    }
    localStorage.removeItem(LEGACY_SCRIPTS_KEY);
  } catch {
    // ignore corrupt legacy data
  }
}

// Single source of truth for persistence: on mount, restores a previous
// save (grid, drones, inventory, research, scripts) if one exists,
// otherwise starts a fresh 3x3 field. Then autosaves the full state on a
// fixed interval - not on every keystroke/tick, to avoid thrashing
// localStorage while code is being typed or crops are growing.
export function useGamePersistence() {
  const initialized = useGameStore((s) => s.initialized);
  const initializeGrid = useGameStore((s) => s.initializeGrid);

  useEffect(() => {
    if (initialized) return;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (isValidSaveData(data)) {
          useGameStore.getState().loadGame(data);
          return;
        }
      }
    } catch {
      // corrupt or unreadable save - fall through to a fresh start
    }
    initializeGrid(3);
    migrateLegacyScripts();
  }, [initialized, initializeGrid]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!useGameStore.getState().initialized) return;
      try {
        const data = useGameStore.getState().saveGame();
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      } catch {
        // localStorage unavailable/full - progress just won't persist
      }
    }, AUTOSAVE_INTERVAL);
    return () => clearInterval(interval);
  }, []);
}

export function clearSavedGame() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
