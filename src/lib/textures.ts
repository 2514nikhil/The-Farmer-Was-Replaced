'use client';

import * as THREE from 'three';

// Small procedurally-generated textures, built once on the client and
// cached at module scope so every tile/drone instance shares the same
// GPU texture instead of paying for a canvas draw per mesh.

let wheatTexture: THREE.CanvasTexture | null = null;
let shadowTexture: THREE.CanvasTexture | null = null;

// A Minecraft-style "cross quad" wheat sprite: a handful of tapered blade
// shapes with light grain strokes, drawn onto a transparent canvas. Used as
// the alpha-cutout map for two crossed planes. Left mostly neutral/light so
// per-tile growth-stage tinting (green -> gold) reads correctly.
export function getWheatTexture(): THREE.CanvasTexture {
  if (wheatTexture) return wheatTexture;

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const bladeCount = 6;
  for (let i = 0; i < bladeCount; i++) {
    const cx = ((i + 0.5) / bladeCount) * size;
    const sway = Math.sin(i * 2.3) * 6;
    const topY = 3 + Math.sin(i * 1.4) * 3;

    ctx.beginPath();
    ctx.moveTo(cx - 2.2, size);
    ctx.quadraticCurveTo(cx + sway * 0.6, size * 0.55, cx + sway, topY);
    ctx.quadraticCurveTo(cx + sway * 0.6, size * 0.55, cx + 2.2, size);
    ctx.closePath();
    const shade = 205 + Math.floor(Math.random() * 35);
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.95)`;
    ctx.fill();

    ctx.strokeStyle = 'rgba(90, 75, 40, 0.45)';
    ctx.lineWidth = 0.7;
    for (let g = 0; g < 5; g++) {
      const gy = 10 + g * ((size - 16) / 4);
      ctx.beginPath();
      ctx.moveTo(cx - 2, gy);
      ctx.lineTo(cx + 2, gy - 2.5);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  wheatTexture = texture;
  return texture;
}

// Soft radial-gradient blob shadow (a light contact shadow rather than a
// hard-edged disc), used under the drone instead of relying on the
// real-time shadow map, which was producing an oversized, hard shadow from
// the wide hat brim.
export function getSoftShadowTexture(): THREE.CanvasTexture {
  if (shadowTexture) return shadowTexture;

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(0,0,0,0.5)');
  gradient.addColorStop(0.6, 'rgba(0,0,0,0.22)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  shadowTexture = texture;
  return texture;
}
