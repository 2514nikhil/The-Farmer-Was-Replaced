'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@/stores/useGameStore';
import { getSoftShadowTexture } from '@/lib/textures';

const ARM_LENGTH = 0.85;
const ARM_ANGLES_DEG = [45, 135, 225, 315];
const BEACON_COLORS = ['#d4a017', '#4a9fd4', '#c4487a', '#5fb85a'];

export function Drone({ droneId, scale = 1 }: { droneId: number; scale?: number }) {
  const targetPos = useGameStore((s) => s.drones[droneId]?.targetPosition ?? { x: 0, y: 0 });
  const currentPos = useGameStore((s) => s.drones[droneId]?.position ?? { x: 0, y: 0 });
  const targetRot = useGameStore((s) => s.drones[droneId]?.targetRotation ?? 0);
  const beaconColor = BEACON_COLORS[droneId % BEACON_COLORS.length];

  const groupRef = useRef<THREE.Group>(null);
  const rotorRefs = useRef<(THREE.Mesh | null)[]>([]);
  const beaconRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const t = Math.min(delta * 7, 1);
    if (groupRef.current) {
      groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x || currentPos.x, targetPos.x, t);
      groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z || currentPos.y, targetPos.y, t);
      groupRef.current.position.y = 0.9 + Math.sin(state.clock.elapsedTime * 2.5 + droneId) * 0.04;
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRot, t);
    }
    rotorRefs.current.forEach((rotor, i) => {
      if (rotor) rotor.rotation.y += delta * 28 * (i % 2 === 0 ? 1 : -1);
    });
    if (beaconRef.current) {
      const mat = beaconRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.5 + Math.sin(state.clock.elapsedTime * 5) * 0.3;
    }
  });

  return (
    <group ref={groupRef} position={[currentPos.x, 0.9, currentPos.y]} scale={scale}>
      {/* Four long crossed arms with a motor + propeller at each tip.
          No castShadow here - the wide hat brim below was throwing a huge,
          hard-edged shadow via the real-time shadow map, so the drone
          relies on the small soft blob shadow underneath instead. */}
      {ARM_ANGLES_DEG.map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const dx = Math.cos(rad) * ARM_LENGTH;
        const dz = Math.sin(rad) * ARM_LENGTH;
        return (
          <group key={deg}>
            <mesh position={[dx / 2, 0.02, dz / 2]} rotation={[0, -rad, 0]}>
              <boxGeometry args={[ARM_LENGTH, 0.035, 0.05]} />
              <meshStandardMaterial color="#2b241c" metalness={0.4} roughness={0.4} />
            </mesh>
            <mesh position={[dx, 0.04, dz]}>
              <cylinderGeometry args={[0.045, 0.05, 0.09, 8]} />
              <meshStandardMaterial color="#2b241c" metalness={0.4} roughness={0.35} />
            </mesh>
            <mesh
              ref={(el) => {
                rotorRefs.current[i] = el;
              }}
              position={[dx, 0.09, dz]}
            >
              <boxGeometry args={[0.5, 0.015, 0.045]} />
              <meshStandardMaterial color="#1c1712" side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}

      {/* Straw-hat body sitting where the arms cross */}
      <group position={[0, 0.14, 0]}>
        <mesh>
          <cylinderGeometry args={[0.5, 0.53, 0.05, 20]} />
          <meshStandardMaterial color="#e0a840" roughness={0.65} />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.3, 0.32, 0.06, 20]} />
          <meshStandardMaterial color="#c9762a" roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.22, 0.29, 0.22, 20]} />
          <meshStandardMaterial color="#f0c25f" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.27, 0]}>
          <sphereGeometry args={[0.09, 12, 8]} />
          <meshStandardMaterial color="#e6ac48" roughness={0.6} />
        </mesh>
      </group>

      <mesh ref={beaconRef} position={[0, -0.02, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color={beaconColor} transparent opacity={0.7} />
      </mesh>
      <pointLight position={[0, -0.05, 0]} color={beaconColor} intensity={0.5} distance={2.5} decay={2} />
    </group>
  );
}

export function DroneShadow({ droneId, opacity = 0.35 }: { droneId: number; opacity?: number }) {
  const currentPos = useGameStore((s) => s.drones[droneId]?.position ?? { x: 0, y: 0 });
  const targetPos = useGameStore((s) => s.drones[droneId]?.targetPosition ?? { x: 0, y: 0 });
  const ref = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => getSoftShadowTexture(), []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const t = Math.min(delta * 7, 1);
    ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x || currentPos.x, targetPos.x, t);
    ref.current.position.z = THREE.MathUtils.lerp(ref.current.position.z || currentPos.y, targetPos.y, t);
  });

  return (
    <mesh ref={ref} position={[currentPos.x, 0.06, currentPos.y]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.6, 0.6]} />
      <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}
