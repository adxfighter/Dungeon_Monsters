import {
  CanvasTexture,
  CapsuleGeometry,
  ConeGeometry,
  type BufferGeometry,
  Euler,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  SRGBColorSpace,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Character } from '@content/schemas';
import { createToonMaterial } from '../materials/toon';
import { addOutline } from '../outline';
import { createBlobShadow } from './blobShadow';

/**
 * Procedural chibi (GDD §6: head ≈ 1/3 of height), built from primitives, facing local +Z.
 * Units: 1 = one tile; total height ≈ 1.05.
 * Draw calls: legs ×2, body, head, hair, face, shadow + 5 outlines = 12.
 */
const DIM = {
  hipY: 0.24,
  legRadius: 0.065,
  legLength: 0.12,
  legSpread: 0.08,
  bodyRadius: 0.15,
  bodyLength: 0.18,
  bodyY: 0.42,
  armRadius: 0.05,
  armLength: 0.16,
  headRadius: 0.24,
  headY: 0.8,
} as const;

/** Walk cycle frequency at full speed, rad/s of phase. */
const STEP_RATE = 16;
const STEP_BOUNCE = 0.05;
const LEG_SWING = 0.7;
const MAX_LEAN = 0.18;
const IDLE_RATE = 2.2;
const IDLE_BOB = 0.012;
const HEAD_TILT = -0.22;

const m4 = new Matrix4();
const euler = new Euler();

/** Rotates (X then Z) and translates a geometry in place — model-build time only. */
function placed(
  geometry: BufferGeometry,
  x: number,
  y: number,
  z: number,
  rotX = 0,
  rotZ = 0,
): BufferGeometry {
  geometry.applyMatrix4(m4.makeRotationFromEuler(euler.set(rotX, 0, rotZ)));
  geometry.translate(x, y, z);
  return geometry;
}

/** Torso with arms merged in (arms don't animate separately in M1). */
function bodyGeometry(): BufferGeometry {
  const torso = new CapsuleGeometry(DIM.bodyRadius, DIM.bodyLength, 6, 16);
  const armL = placed(new CapsuleGeometry(DIM.armRadius, DIM.armLength, 4, 8), 0.19, 0, 0, 0, 0.35);
  const armR = placed(new CapsuleGeometry(DIM.armRadius, DIM.armLength, 4, 8), -0.19, 0, 0, 0, -0.35);
  const merged = mergeGeometries([torso, armL, armR]);
  torso.dispose();
  armL.dispose();
  armR.dispose();
  if (!merged) throw new Error('chibi: failed to merge body');
  return merged;
}

/** Hair cap tilted back to show the forehead, optional bangs and ponytail — one geometry. */
function hairGeometry(style: Character['appearance']['hairStyle']): BufferGeometry {
  const r = DIM.headRadius * 1.08;
  const parts: BufferGeometry[] = [
    placed(new SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), 0, 0, 0, -0.62),
  ];
  if (style.bangs) {
    for (const [x, tilt] of [
      [-0.09, 0.3],
      [0, 0],
      [0.09, -0.3],
    ] as const) {
      // Inverted cones hanging over the forehead.
      parts.push(placed(new ConeGeometry(0.06, 0.1, 8), x, 0.17, r * 0.78, Math.PI + 1.0, tilt));
    }
  }
  if (style.ponytail) {
    parts.push(placed(new CapsuleGeometry(0.075, 0.2, 4, 10), 0, 0.02, -r * 1.05, -0.6));
  }
  // mergeGeometries needs matching attributes and indexing: sphere/cone/capsule are all indexed
  // with position, normal and uv.
  const merged = mergeGeometries(parts);
  for (const g of parts) g.dispose();
  if (!merged) throw new Error('chibi: failed to merge hair');
  return merged;
}

/** Big anime eyes + blush drawn on a canvas, mapped onto a spherical patch in front of the face. */
function faceTexture(eyeColor: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('chibi: 2D canvas unavailable');
  for (const cx of [84, 172]) {
    // Eye white + outline
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#1a1414';
    g.lineWidth = 6;
    g.beginPath();
    g.ellipse(cx, 58, 22, 30, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // Iris, pupil, highlights
    g.fillStyle = eyeColor;
    g.beginPath();
    g.ellipse(cx, 64, 16, 22, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1a1414';
    g.beginPath();
    g.ellipse(cx, 66, 8, 12, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(cx - 6, 52, 6, 0, Math.PI * 2);
    g.arc(cx + 7, 76, 3, 0, Math.PI * 2);
    g.fill();
    // Upper lash line
    g.strokeStyle = '#1a1414';
    g.lineWidth = 8;
    g.beginPath();
    g.ellipse(cx, 58, 24, 31, 0, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
  }
  g.fillStyle = 'rgba(255, 120, 120, 0.45)';
  for (const cx of [52, 204]) {
    g.beginPath();
    g.ellipse(cx, 104, 18, 8, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Small smile
  g.strokeStyle = '#7a2e2e';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(128, 100, 10, Math.PI * 0.15, Math.PI * 0.85);
  g.stroke();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export interface ChibiRig {
  /** Root to place/rotate in the world (feet at y = 0, facing local +Z). */
  readonly root: Group;
  /** Advances procedural animation. `speed01` = current speed / max speed. */
  update(dtSeconds: number, speed01: number): void;
}

export function createChibi(character: Character): ChibiRig {
  const { appearance } = character;
  const skin = createToonMaterial({ color: appearance.skin });
  const hair = createToonMaterial({ color: appearance.hair });
  const outfit = createToonMaterial({ color: appearance.outfit });
  const accent = createToonMaterial({ color: appearance.accent });

  const root = new Group();
  root.name = `chibi:${character.id}`;
  /** Everything above the feet; bounces and leans. */
  const upper = new Group();
  upper.position.y = DIM.hipY;
  root.add(upper);

  const legs: Group[] = [];
  for (const side of [1, -1]) {
    const pivot = new Group();
    pivot.position.set(side * DIM.legSpread, DIM.hipY, 0);
    const leg = new Mesh(new CapsuleGeometry(DIM.legRadius, DIM.legLength, 4, 8), accent);
    leg.name = 'chibi-leg';
    leg.position.y = -(DIM.legLength / 2 + DIM.legRadius) + 0.02;
    addOutline(leg);
    pivot.add(leg);
    root.add(pivot);
    legs.push(pivot);
  }

  const body = new Mesh(bodyGeometry(), outfit);
  body.name = 'chibi-body';
  body.position.y = DIM.bodyY - DIM.hipY;
  addOutline(body);

  const head = new Mesh(new SphereGeometry(DIM.headRadius, 28, 16), skin);
  head.name = 'chibi-head';
  head.position.y = DIM.headY - DIM.hipY;
  // Chin up a little so the face reads from the high game camera.
  head.rotation.x = HEAD_TILT;
  addOutline(head);

  const hairMesh = new Mesh(hairGeometry(appearance.hairStyle), hair);
  hairMesh.name = 'chibi-hair';
  addOutline(hairMesh, { thickness: 0.025 });
  head.add(hairMesh);

  // Spherical patch centred on +Z (phi = π/2), slightly above the skin to avoid z-fighting.
  const facePatch = new SphereGeometry(
    DIM.headRadius * 1.012,
    16,
    8,
    Math.PI / 2 - 0.75,
    1.5,
    Math.PI * 0.3,
    Math.PI * 0.32,
  );
  const face = new Mesh(
    facePatch,
    new MeshBasicMaterial({ map: faceTexture(appearance.eyes), transparent: true }),
  );
  face.name = 'chibi-face';
  head.add(face);

  upper.add(body, head);
  root.add(createBlobShadow(0.36));

  let walkPhase = 0;
  let idlePhase = 0;
  return {
    root,
    update(dt, speed01) {
      const s = Math.min(Math.max(speed01, 0), 1);
      idlePhase += dt * IDLE_RATE;
      if (s > 0.01) walkPhase += dt * STEP_RATE * (0.5 + 0.5 * s);
      const swing = Math.sin(walkPhase) * LEG_SWING * s;
      const [left, right] = legs;
      if (left && right) {
        left.rotation.x = swing;
        right.rotation.x = -swing;
      }
      upper.position.y =
        DIM.hipY + Math.abs(Math.sin(walkPhase)) * STEP_BOUNCE * s + Math.sin(idlePhase) * IDLE_BOB * (1 - s);
      upper.rotation.x = MAX_LEAN * s;
    },
  };
}
