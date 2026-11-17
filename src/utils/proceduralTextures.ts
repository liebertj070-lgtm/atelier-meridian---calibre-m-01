import * as THREE from 'three';

export function createBrushedMetalTexture(radial = true): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    if (radial) {
      const cx = size / 2;
      const cy = size / 2;
      for (let i = 0; i < 1600; i++) {
        const r = Math.random() * (size * 0.5);
        const start = Math.random() * Math.PI * 2;
        const len = 0.2 + Math.random() * 1.4;
        const shade = Math.floor(105 + Math.random() * 55);
        ctx.strokeStyle = `rgba(${shade}, ${shade}, ${shade}, 0.24)`;
        ctx.lineWidth = 0.7 + Math.random() * 1.1;
        ctx.beginPath();
        ctx.arc(cx, cy, r, start, start + len);
        ctx.stroke();
      }
    } else {
      for (let i = 0; i < 1800; i++) {
        const y = Math.random() * size;
        const shade = Math.floor(100 + Math.random() * 65);
        ctx.strokeStyle = `rgba(${shade}, ${shade}, ${shade}, 0.2)`;
        ctx.lineWidth = 0.6 + Math.random() * 1.2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y + (Math.random() - 0.5) * 4);
        ctx.stroke();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createSoftParticleTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2
    );
    grad.addColorStop(0, 'rgba(255, 244, 224, 1)');
    grad.addColorStop(0.35, 'rgba(212, 168, 106, 0.45)');
    grad.addColorStop(1, 'rgba(212, 168, 106, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createGoldAuraTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.5);
    grad.addColorStop(0, 'rgba(232, 184, 112, 0.52)');
    grad.addColorStop(0.28, 'rgba(212, 168, 106, 0.24)');
    grad.addColorStop(0.62, 'rgba(158, 112, 54, 0.07)');
    grad.addColorStop(1, 'rgba(9, 9, 11, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}
