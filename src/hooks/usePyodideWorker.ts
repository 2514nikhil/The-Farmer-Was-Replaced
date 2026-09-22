'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useGameStore } from '@/stores/useGameStore';

export interface LogEntry {
  id: number;
  message: string;
  type: 'log' | 'error' | 'system';
  timestamp: number;
}

const MOVE_DELAY = 400;
const ACTION_DELAY = 140;

let logIdCounter = 0;

export function usePyodideWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const pausedRef = useRef(false);
  const heldCompletionRef = useRef<(() => void) | null>(null);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'log') => {
    setLogs((prev) => [...prev.slice(-299), { id: ++logIdCounter, message, type, timestamp: Date.now() }]);
  }, []);

  const sendToWorker = useCallback((message: unknown) => {
    workerRef.current?.postMessage(message);
  }, []);

  const handleAction = useCallback(
    (id: number, action: string, payload: Record<string, unknown>) => {
      const store = useGameStore.getState();
      const droneId = typeof payload.droneId === 'number' ? payload.droneId : 0;
      let result: unknown;
      let delay = 0;

      switch (action) {
        case 'move': {
          const r = store.moveDrone(droneId, payload.direction as 'north' | 'south' | 'east' | 'west');
          // Return a plain boolean, not {success,x,y} - a JS object crossing into
          // Python via Pyodide's default conversion becomes a JsProxy wrapper,
          // which is always truthy regardless of the success field inside it.
          // That silently broke "if not move(...)" edge-detection idioms.
          result = r.success;
          delay = MOVE_DELAY;
          break;
        }
        case 'plant': {
          const crop = payload.cropType ?? store.selectedCrop;
          result = store.plantCrop(droneId, crop as never);
          delay = ACTION_DELAY;
          break;
        }
        case 'harvest':
          result = store.harvestCrop(droneId);
          delay = ACTION_DELAY;
          break;
        case 'water':
          result = store.waterTile(droneId);
          delay = ACTION_DELAY;
          break;
        case 'till':
          result = store.tillTile(droneId);
          delay = ACTION_DELAY;
          break;
        case 'get_pos':
          result = store.getDronePos(droneId);
          break;
        case 'can_harvest':
          result = store.canHarvestHere(droneId);
          break;
        case 'get_crop':
          result = store.getCropAtDrone(droneId);
          break;
        case 'get_moisture':
          result = store.getMoistureAtDrone(droneId);
          break;
        case 'get_growth':
          result = store.getGrowthAtDrone(droneId);
          break;
        case 'grid_size':
          result = store.config.gridSize;
          break;
        case 'spawn_drone':
          result = store.spawnDrone();
          break;
        default:
          result = null;
      }

      const scaledDelay = delay / store.executionSpeed;

      const complete = () => {
        if (action === 'move') useGameStore.getState().setDroneMoving(droneId, false);
        sendToWorker({ type: 'ACTION_RESULT', id, result });
      };

      if (scaledDelay <= 0) {
        complete();
        return;
      }

      if (pausedRef.current) {
        heldCompletionRef.current = complete;
        return;
      }

      setTimeout(() => {
        if (pausedRef.current) {
          heldCompletionRef.current = complete;
        } else {
          complete();
        }
      }, scaledDelay);
    },
    [sendToWorker]
  );

  useEffect(() => {
    const worker = new Worker('/pyodide-worker.js');
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const msg = event.data || {};
      switch (msg.type) {
        case 'READY':
          setIsReady(true);
          break;
        case 'STDOUT':
          if (msg.text && msg.text.trim()) addLog(msg.text, 'log');
          break;
        case 'STDERR':
          if (msg.text && msg.text.trim()) addLog(msg.text, 'error');
          break;
        case 'ACTION':
          handleAction(msg.id, msg.action, msg.payload || {});
          break;
        case 'DONE':
          pausedRef.current = false;
          heldCompletionRef.current = null;
          useGameStore.getState().setGamePhase('idle');
          if (msg.error) addLog(`Stopped: ${msg.error}`, 'error');
          else addLog('Program finished.', 'system');
          break;
      }
    };

    worker.onerror = (err) => {
      addLog(`Worker error: ${err.message}`, 'error');
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [addLog, handleAction]);

  // Ambient simulation: crop growth, moisture, weeds - runs independent of scripts.
  useEffect(() => {
    const config = useGameStore.getState().config;
    const interval = setInterval(() => {
      const state = useGameStore.getState();
      state.simulateCropGrowth();
      state.simulateSoilMoisture();
      const { grid, config: cfg } = useGameStore.getState();
      for (let y = 0; y < cfg.gridSize; y++) {
        for (let x = 0; x < cfg.gridSize; x++) {
          const tile = grid[y]?.[x];
          if (tile && tile.cropType === 'pumpkin' && tile.growthStage >= 1) {
            state.checkPumpkinMerge(x, y);
          }
        }
      }
    }, config.tickRate);
    return () => clearInterval(interval);
  }, []);

  const executeCode = useCallback(
    (code: string) => {
      if (!isReady) {
        addLog('Python runtime still loading...', 'system');
        return;
      }
      pausedRef.current = false;
      heldCompletionRef.current = null;
      useGameStore.getState().setGamePhase('running');
      addLog('Running...', 'system');
      sendToWorker({ type: 'RUN', code });
    },
    [isReady, addLog, sendToWorker]
  );

  const stopExecution = useCallback(() => {
    pausedRef.current = false;
    heldCompletionRef.current = null;
    useGameStore.getState().setGamePhase('idle');
    sendToWorker({ type: 'STOP' });
  }, [sendToWorker]);

  const pauseExecution = useCallback(() => {
    if (useGameStore.getState().gamePhase !== 'running') return;
    pausedRef.current = true;
    useGameStore.getState().setGamePhase('paused');
  }, []);

  const resumeExecution = useCallback(() => {
    if (useGameStore.getState().gamePhase !== 'paused') return;
    pausedRef.current = false;
    useGameStore.getState().setGamePhase('running');
    const fn = heldCompletionRef.current;
    heldCompletionRef.current = null;
    if (fn) fn();
  }, []);

  const stepExecution = useCallback(() => {
    if (!pausedRef.current) return;
    const fn = heldCompletionRef.current;
    heldCompletionRef.current = null;
    if (fn) fn();
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  return {
    isReady,
    logs,
    executeCode,
    stopExecution,
    pauseExecution,
    resumeExecution,
    stepExecution,
    clearLogs,
  };
}
