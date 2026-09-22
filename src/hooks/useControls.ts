'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/stores/useGameStore';
import type { Direction } from '@/types/game';

// Manual keyboard control - only active when no script is running, mostly
// useful for testing a layout by hand before writing code for it.
export function useKeyboardControls(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const store = useGameStore.getState();
      if (store.gamePhase === 'running') return;
      if (store.drones[0]?.isMoving) return;

      const directionForKey: Record<string, Direction> = {
        ArrowUp: 'north',
        KeyW: 'north',
        ArrowDown: 'south',
        KeyS: 'south',
        ArrowLeft: 'west',
        KeyA: 'west',
        ArrowRight: 'east',
        KeyD: 'east',
      };

      if (directionForKey[e.code]) {
        e.preventDefault();
        const dir = directionForKey[e.code];
        const result = store.moveDrone(0, dir);
        if (result.success) {
          setTimeout(() => useGameStore.getState().setDroneMoving(0, false), 180);
        } else {
          useGameStore.getState().setDroneMoving(0, false);
        }
        return;
      }

      switch (e.code) {
        case 'KeyP':
          e.preventDefault();
          store.plantCrop(0, store.selectedCrop);
          break;
        case 'KeyH':
          e.preventDefault();
          store.harvestCrop(0);
          break;
        case 'KeyT':
          e.preventDefault();
          store.waterTile(0);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}

// Alt+drag / middle-drag to pan, Ctrl+scroll to zoom.
export function useCameraControls(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    let isPanning = false;
    let lastMouse = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        isPanning = true;
        lastMouse = { x: e.clientX, y: e.clientY };
        e.preventDefault();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanning) return;
      const { cameraPosition, cameraZoom, setCameraPosition } = useGameStore.getState();
      const dx = (e.clientX - lastMouse.x) * 0.02 * cameraZoom;
      const dy = (e.clientY - lastMouse.y) * 0.02 * cameraZoom;
      setCameraPosition({ x: cameraPosition.x - dx, y: cameraPosition.y + dy });
      lastMouse = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isPanning = false;
    };

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const { cameraZoom, setCameraZoom } = useGameStore.getState();
      setCameraZoom(cameraZoom * (e.deltaY > 0 ? 1.1 : 0.9));
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [enabled]);
}
