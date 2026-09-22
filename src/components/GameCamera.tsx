'use client';

import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useCameraPosition, useCameraZoom } from '@/stores/useGameStore';

const ISO_DIR = new THREE.Vector3(1, 1, 1).normalize();

// A real orthographic camera (via drei, properly registered as the R3F
// default) framed at a true isometric angle. Left/right/top/bottom/position
// are recomputed every frame from grid size + zoom, which overrides R3F's
// own pixel-based auto-resize every render - this is what keeps the
// isometric framing correct across window resizes.
export function GameCamera({ gridSize }: { gridSize: number }) {
  const camRef = useRef<THREE.OrthographicCamera>(null);
  const cameraPos = useCameraPosition();
  const cameraZoom = useCameraZoom();
  const { size } = useThree();

  const center = useMemo(() => (gridSize - 1) / 2, [gridSize]);

  useFrame(() => {
    const cam = camRef.current;
    if (!cam) return;

    const targetX = center + cameraPos.x;
    const targetZ = center + cameraPos.y;
    const distance = Math.max(gridSize * 1.15, 10);
    const desired = new THREE.Vector3(targetX, 0, targetZ).add(ISO_DIR.clone().multiplyScalar(distance));

    cam.position.lerp(desired, 0.12);
    cam.lookAt(targetX, 0, targetZ);

    const aspect = size.width / Math.max(size.height, 1);
    const viewSize = (Math.max(gridSize, 5) * 0.72) / cameraZoom;
    cam.left = -viewSize * aspect;
    cam.right = viewSize * aspect;
    cam.top = viewSize;
    cam.bottom = -viewSize;
    cam.near = 0.1;
    cam.far = distance * 3;
    cam.updateProjectionMatrix();
  });

  return <OrthographicCamera ref={camRef} makeDefault position={[center + 8, 8, center + 8]} />;
}
