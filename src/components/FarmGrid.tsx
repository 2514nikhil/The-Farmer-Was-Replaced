'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGrid, useShowGrid } from '@/stores/useGameStore';
import { CROP_DEFINITIONS } from '@/types/game';
import { getWheatTexture } from '@/lib/textures';

const TILE_SIZE = 1;
// Tiles are a raised two-tone block (soil cap overhanging a wood/stone base)
// rather than a thin flat slab, so they read as chunky 3D plots instead of
// flat diamonds under the isometric camera.
const TILE_BASE_HEIGHT = 0.32;
const TILE_CAP_HEIGHT = 0.1;
const TILE_SURFACE_Y = TILE_BASE_HEIGHT + TILE_CAP_HEIGHT;

const SOIL_COLOR = new THREE.Color('#c9a876');
const SOIL_COLOR_DRY = new THREE.Color('#d9c19a');
const BASE_COLOR = new THREE.Color('#8a6f4d');
const BASE_COLOR_ALT = new THREE.Color('#7d6342');
const PEBBLE_COLOR = new THREE.Color('#9a8f7d');
const WHEAT_YOUNG = new THREE.Color('#8fbf4a');
const WHEAT_MATURE = new THREE.Color('#dfab3f');

const CORNER_OFFSETS: [number, number][] = [
  [0.36, 0.36],
  [-0.36, 0.36],
  [0.36, -0.36],
  [-0.36, -0.36],
];

export function FarmGrid({ gridSize }: { gridSize: number }) {
  const grid = useGrid();
  const showGrid = useShowGrid();
  const wheatTexture = useMemo(() => getWheatTexture(), []);

  const cropRefs = useRef<Map<string, THREE.Mesh | THREE.Group>>(new Map());

  const setCropRef = (key: string) => (el: THREE.Mesh | THREE.Group | null) => {
    if (el) cropRefs.current.set(key, el);
    else cropRefs.current.delete(key);
  };

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    cropRefs.current.forEach((mesh, key) => {
      const [x, y] = key.split(',').map(Number);
      const tile = grid[y]?.[x];
      if (!tile || !tile.cropType || tile.growthStage <= 0) return;
      const base = tile.growthStage;
      const pulse = tile.growthStage >= 1 ? 1 + Math.sin(t * 3 + x + y) * 0.04 : 1;
      const s = base * pulse;
      mesh.scale.set(s, s, s);
      if (tile.cropType === 'grass') mesh.rotation.y = Math.sin(t * 2 + x + y) * 0.06;
    });
  });

  const tiles = useMemo(() => {
    const elements: JSX.Element[] = [];
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const tile = grid[y]?.[x];
        if (!tile) continue;
        const key = `${x},${y}`;
        const worldX = x * TILE_SIZE;
        const worldZ = y * TILE_SIZE;
        const checker = (x + y) % 2 === 0;

        // Base block - the raised bed's side walls.
        elements.push(
          <mesh
            key={`base-${key}`}
            position={[worldX, TILE_BASE_HEIGHT / 2, worldZ]}
            receiveShadow
            castShadow
          >
            <boxGeometry args={[TILE_SIZE - 0.08, TILE_BASE_HEIGHT, TILE_SIZE - 0.08]} />
            <meshStandardMaterial color={checker ? BASE_COLOR : BASE_COLOR_ALT} roughness={0.95} metalness={0} />
          </mesh>
        );

        // Soil cap - overhangs the base slightly, like a lip.
        elements.push(
          <mesh
            key={`cap-${key}`}
            position={[worldX, TILE_BASE_HEIGHT + TILE_CAP_HEIGHT / 2, worldZ]}
            receiveShadow
          >
            <boxGeometry args={[TILE_SIZE - 0.03, TILE_CAP_HEIGHT, TILE_SIZE - 0.03]} />
            <meshStandardMaterial color={checker ? SOIL_COLOR : SOIL_COLOR_DRY} roughness={0.9} metalness={0} />
          </mesh>
        );

        // A small scattered pebble on some tiles for texture, deterministic
        // per-tile so it doesn't flicker/reshuffle as the grid re-renders.
        const detailSeed = (x * 928371 + y * 123457 + 17) % 100;
        if (detailSeed < 42) {
          const corner = CORNER_OFFSETS[detailSeed % 4];
          elements.push(
            <mesh
              key={`pebble-${key}`}
              position={[worldX + corner[0], TILE_BASE_HEIGHT * 0.4, worldZ + corner[1]]}
              castShadow
            >
              <icosahedronGeometry args={[0.05, 0]} />
              <meshStandardMaterial color={PEBBLE_COLOR} roughness={0.9} flatShading />
            </mesh>
          );
        }

        if (tile.cropType && tile.growthStage > 0) {
          const def = CROP_DEFINITIONS[tile.cropType];
          const color = def.color;

          if (tile.cropType === 'grass') {
            const tint = WHEAT_YOUNG.clone().lerp(WHEAT_MATURE, Math.min(1, tile.growthStage));
            elements.push(
              <group key={`crop-${key}`} ref={setCropRef(key)} position={[worldX, TILE_SURFACE_Y + 0.22, worldZ]}>
                <mesh rotation={[0, 0, 0]}>
                  <planeGeometry args={[0.55, 0.5]} />
                  <meshStandardMaterial
                    map={wheatTexture}
                    color={tint}
                    alphaTest={0.3}
                    transparent
                    side={THREE.DoubleSide}
                    roughness={0.85}
                  />
                </mesh>
                <mesh rotation={[0, Math.PI / 2, 0]}>
                  <planeGeometry args={[0.55, 0.5]} />
                  <meshStandardMaterial
                    map={wheatTexture}
                    color={tint}
                    alphaTest={0.3}
                    transparent
                    side={THREE.DoubleSide}
                    roughness={0.85}
                  />
                </mesh>
              </group>
            );
          } else if (tile.cropType === 'bush') {
            elements.push(
              <mesh
                key={`crop-${key}`}
                ref={setCropRef(key)}
                position={[worldX, TILE_SURFACE_Y + 0.26, worldZ]}
                castShadow
              >
                <sphereGeometry args={[0.28, 8, 6]} />
                <meshStandardMaterial color={color} roughness={0.75} />
              </mesh>
            );
          } else if (tile.cropType === 'carrot') {
            elements.push(
              <group key={`crop-${key}`} ref={setCropRef(key)} position={[worldX, TILE_SURFACE_Y, worldZ]}>
                <mesh position={[0, 0.18, 0]} castShadow>
                  <coneGeometry args={[0.22, 0.45, 6]} />
                  <meshStandardMaterial color={color} roughness={0.5} />
                </mesh>
                <mesh position={[0, 0.46, 0]} castShadow>
                  <coneGeometry args={[0.11, 0.18, 4]} />
                  <meshStandardMaterial color="#4a7c2e" roughness={0.6} />
                </mesh>
              </group>
            );
          } else if (tile.cropType === 'pumpkin') {
            elements.push(
              <mesh
                key={`crop-${key}`}
                ref={setCropRef(key)}
                position={[worldX, TILE_SURFACE_Y + 0.2, worldZ]}
                castShadow
              >
                <sphereGeometry args={[0.26, 8, 6]} />
                <meshStandardMaterial color={color} roughness={0.55} />
              </mesh>
            );
          }
        }
      }
    }
    return elements;
  }, [grid, gridSize, wheatTexture]);

  if (!showGrid) return null;
  return <group>{tiles}</group>;
}
