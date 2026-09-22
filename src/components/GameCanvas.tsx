'use client';

import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Drone, DroneShadow } from './Drone';
import { FarmGrid } from './FarmGrid';
import { GameCamera } from './GameCamera';
import { SceneLighting } from './Lighting';
import { useGameStore } from '@/stores/useGameStore';
import { useKeyboardControls, useCameraControls } from '@/hooks/useControls';

const SKY_COLOR = '#87ceeb';

function Scene({ gridSize }: { gridSize: number }) {
  const gamePhase = useGameStore((s) => s.gamePhase);
  const droneCount = useGameStore((s) => s.drones.length);
  useKeyboardControls(gamePhase !== 'running');
  useCameraControls(true);

  return (
    <>
      <SceneLighting gridSize={gridSize} />
      <GameCamera gridSize={gridSize} />
      <FarmGrid gridSize={gridSize} />
      {Array.from({ length: droneCount }, (_, id) => (
        <group key={id}>
          <DroneShadow droneId={id} />
          <Drone droneId={id} />
        </group>
      ))}
    </>
  );
}

export function GameCanvas() {
  const gridSize = useGameStore((s) => s.config.gridSize);

  return (
    <Canvas
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      shadows
      onCreated={({ gl }) => {
        gl.setClearColor(SKY_COLOR, 1);
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <color attach="background" args={[SKY_COLOR]} />
      <fog attach="fog" args={[SKY_COLOR, 30, 90]} />
      <Scene gridSize={gridSize} />
    </Canvas>
  );
}
