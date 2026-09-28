import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';

/** Opacity at the centre of a blob shadow. */
const SHADOW_OPACITY = 0.38;

let texture: CanvasTexture | undefined;

/** Shared soft radial gradient (white → transparent); tinted black by the material. */
function shadowTexture(): CanvasTexture {
  if (!texture) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const g = canvas.getContext('2d');
    if (!g) throw new Error('blobShadow: 2D canvas unavailable');
    const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.6, 'rgba(255,255,255,0.6)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gradient;
    g.fillRect(0, 0, size, size);
    texture = new CanvasTexture(canvas);
  }
  return texture;
}

/**
 * Fake contact shadow: a transparent quad just above the floor (ARCHITECTURE §7: no shadow maps on low).
 * `radius` in world units.
 */
export function createBlobShadow(radius: number): Mesh {
  const material = new MeshBasicMaterial({
    color: 0x000000,
    alphaMap: shadowTexture(),
    transparent: true,
    opacity: SHADOW_OPACITY,
    depthWrite: false,
  });
  const mesh = new Mesh(new PlaneGeometry(radius * 2, radius * 2), material);
  mesh.name = 'blob-shadow';
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.005;
  mesh.renderOrder = 1;
  return mesh;
}
