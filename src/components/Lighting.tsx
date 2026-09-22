'use client';

import { useMemo } from 'react';

export function SceneLighting({ gridSize = 8 }: { gridSize?: number }) {
  const center = useMemo(() => (gridSize - 1) / 2, [gridSize]);

  return (
    <>
      <ambientLight intensity={0.65} color="#ffffff" />
      <hemisphereLight intensity={0.5} color="#bfe3ff" groundColor="#a67c52" />
      <directionalLight
        position={[center + 8, 14, center + 6]}
        intensity={1.4}
        color="#fff4e0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={-gridSize - 2}
        shadow-camera-right={gridSize + 2}
        shadow-camera-top={gridSize + 2}
        shadow-camera-bottom={-gridSize - 2}
        shadow-bias={-0.0015}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-center - 4, 6, -center - 4]} intensity={0.25} color="#aaccff" />
    </>
  );
}
