import {
  BoxGeometry,
  type BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  SRGBColorSpace,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Character } from '@content/schemas';
import { createToonMaterial } from '../materials/toon';
import { addOutline } from '../outline';
import { createBlobShadow } from './blobShadow';
import { easeOut, type Rig } from './pose';

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

function mergeOrThrow(parts: BufferGeometry[], what: string): BufferGeometry {
  // mergeGeometries needs matching attributes and indexing: all primitives used here are indexed
  // with position, normal and uv.
  const merged = mergeGeometries(parts);
  for (const g of parts) g.dispose();
  if (!merged) throw new Error(`chibi: failed to merge ${what}`);
  return merged;
}

/** Torso with arms merged in (arms don't animate separately). Kimono: flared hem and wide hanging sleeves. */
function bodyGeometry(style: 'tunic' | 'kimono'): BufferGeometry {
  if (style === 'kimono') {
    const h = DIM.bodyLength + DIM.bodyRadius * 2;
    return mergeOrThrow(
      [
        new CylinderGeometry(DIM.bodyRadius * 0.85, DIM.bodyRadius * 1.3, h, 18),
        // Wide sleeves: truncated cones hanging from the shoulders, open end down.
        placed(new CylinderGeometry(0.045, 0.1, 0.22, 10), 0.19, 0.02, 0, 0, 0.35),
        placed(new CylinderGeometry(0.045, 0.1, 0.22, 10), -0.19, 0.02, 0, 0, -0.35),
      ],
      'kimono',
    );
  }
  return mergeOrThrow(
    [
      new CapsuleGeometry(DIM.bodyRadius, DIM.bodyLength, 6, 16),
      placed(new CapsuleGeometry(DIM.armRadius, DIM.armLength, 4, 8), 0.19, 0, 0, 0, 0.35),
      placed(new CapsuleGeometry(DIM.armRadius, DIM.armLength, 4, 8), -0.19, 0, 0, 0, -0.35),
    ],
    'body',
  );
}

/** Obi sash around the waist with a flat bow at the back. */
function obiGeometry(): BufferGeometry {
  return mergeOrThrow(
    [
      new CylinderGeometry(DIM.bodyRadius * 1.02, DIM.bodyRadius * 1.08, 0.09, 18),
      placed(new BoxGeometry(0.2, 0.1, 0.05), 0, 0.01, -DIM.bodyRadius * 1.1),
    ],
    'obi',
  );
}

/** Kanzashi: two thin crossed pins through the bun (metal), returned separately from the flower. */
function kanzashiGeometry(r: number): BufferGeometry {
  const y = r * 1.05;
  const z = -r * 0.2;
  return mergeOrThrow(
    [
      placed(new CylinderGeometry(0.014, 0.014, 0.38, 6), 0, y, z, 0, 1.2),
      placed(new CylinderGeometry(0.014, 0.014, 0.36, 6), 0, y + 0.03, z, 0.3, -1.05),
      placed(new SphereGeometry(0.026, 8, 6), 0.18, y + 0.07, z),
      placed(new SphereGeometry(0.026, 8, 6), -0.16, y + 0.13, z + 0.05),
    ],
    'kanzashi',
  );
}

/** Small five-petal flower on the side of the bun. */
function flowerGeometry(r: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push(
      placed(new SphereGeometry(0.028, 8, 6), 0.1 + Math.cos(a) * 0.03, r * 0.95 + Math.sin(a) * 0.03, 0.02),
    );
  }
  return mergeOrThrow(parts, 'flower');
}

/** Hair cap tilted back to show the forehead, optional bangs, ponytail and bun — one geometry. */
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
  if (style.bun) {
    // A big round bun on top, slightly back — the geisha silhouette.
    parts.push(placed(new SphereGeometry(0.13, 16, 12), 0, r * 1.05, -r * 0.2));
  }
  return mergeOrThrow(parts, 'hair');
}

/** Big anime eyes + blush drawn on a canvas, mapped onto a spherical patch in front of the face. */
function faceTexture(eyeColor: string, lips: string | undefined): CanvasTexture {
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
  if (lips) {
    // Small painted lips.
    g.fillStyle = lips;
    g.beginPath();
    g.ellipse(128, 104, 8, 5, 0, 0, Math.PI * 2);
    g.fill();
  } else {
    // Small smile
    g.strokeStyle = '#7a2e2e';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(128, 100, 10, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Fallback kanzashi colours when a character's data doesn't set them. */
const DEFAULT_ORNAMENT_METAL = '#f2c14e';
const DEFAULT_ORNAMENT = '#ff8fb3';

/** Upper-body twist for the swing: wind back, whip through, settle (radians). */
const SWING_BACK = 0.75;
const SWING_THROUGH = 1.7;

/** Slash trail colour per attack element (the torch leaves an orange trail). */
const TRAIL_COLOR: Readonly<Record<string, number>> = { fire: 0xff8a3d };
const TRAIL_DEFAULT = 0xfff4e0;

/** A torch held in the right hand (M3 weapon swap): a wooden stick with an unlit-bright flame. 2 draw calls. */
function torch(): { group: Group; flame: Mesh } {
  const group = new Group();
  group.name = 'chibi-torch';
  const stick = new Mesh(
    new CylinderGeometry(0.022, 0.028, 0.3, 8),
    createToonMaterial({ color: '#7a4a2a', rimStrength: 0 }),
  );
  stick.position.y = 0.05;
  const flame = new Mesh(new ConeGeometry(0.06, 0.16, 10), new MeshBasicMaterial({ color: 0xffa43a }));
  flame.position.y = 0.25;
  group.add(stick, flame);
  group.position.set(0.25, 0.02, 0.1);
  group.rotation.x = 0.35;
  group.visible = false;
  return { group, flame };
}

/** Crescent slash trail shown during the active phase of a swing. */
function slashArc(): Mesh {
  const arc = new Mesh(
    // RingGeometry sweeps around +Y in its XY plane; rotateX(+π/2) lays it on the floor in FRONT (+Z)
    // of the character (−π/2 would put the trail behind her).
    new RingGeometry(0.55, 0.95, 24, 1, Math.PI * 0.2, Math.PI * 0.6).rotateX(Math.PI / 2),
    new MeshBasicMaterial({
      color: 0xfff4e0,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: DoubleSide,
    }),
  );
  arc.name = 'chibi-slash';
  arc.position.y = 0.45;
  arc.visible = false;
  return arc;
}

/** Root faces local +Z with feet at y = 0; `update` animates walk/idle and combat poses. */
export function createChibi(character: Character): Rig {
  const { appearance } = character;
  const skin = createToonMaterial({ color: appearance.skin });
  const hair = createToonMaterial({ color: appearance.hair });
  const outfit = createToonMaterial({ color: appearance.outfit });
  const accent = createToonMaterial({ color: appearance.accent });
  const legsMat = appearance.legs ? createToonMaterial({ color: appearance.legs }) : accent;
  const kimono = appearance.outfitStyle === 'kimono';

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
    const leg = new Mesh(new CapsuleGeometry(DIM.legRadius, DIM.legLength, 4, 8), legsMat);
    leg.name = 'chibi-leg';
    leg.position.y = -(DIM.legLength / 2 + DIM.legRadius) + 0.02;
    addOutline(leg);
    pivot.add(leg);
    root.add(pivot);
    legs.push(pivot);
  }

  const body = new Mesh(bodyGeometry(kimono ? 'kimono' : 'tunic'), outfit);
  body.name = 'chibi-body';
  body.position.y = DIM.bodyY - DIM.hipY;
  addOutline(body);

  const head = new Mesh(new SphereGeometry(DIM.headRadius, 28, 16), skin);
  head.name = 'chibi-head';
  head.position.y = DIM.headY - DIM.hipY;
  // Chin up a little so the face reads from the high game camera.
  head.rotation.x = HEAD_TILT;
  addOutline(head);

  if (kimono) {
    const obi = new Mesh(obiGeometry(), accent);
    obi.name = 'chibi-obi';
    obi.position.y = 0.02;
    addOutline(obi, { thickness: 0.02 });
    body.add(obi);
  }

  const hairMesh = new Mesh(hairGeometry(appearance.hairStyle), hair);
  hairMesh.name = 'chibi-hair';
  addOutline(hairMesh, { thickness: 0.025 });
  head.add(hairMesh);
  const extraMaterials = [];
  if (appearance.hairStyle.kanzashi) {
    const r = DIM.headRadius * 1.08;
    const metal = createToonMaterial({
      color: appearance.ornamentMetal ?? DEFAULT_ORNAMENT_METAL,
      rimStrength: 0.2,
    });
    const pins = new Mesh(kanzashiGeometry(r), metal);
    pins.name = 'chibi-kanzashi';
    const petal = createToonMaterial({ color: appearance.ornament ?? DEFAULT_ORNAMENT });
    const flower = new Mesh(flowerGeometry(r), petal);
    flower.name = 'chibi-flower';
    addOutline(flower, { thickness: 0.012 });
    head.add(pins, flower);
    extraMaterials.push(metal, petal);
  }

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
    new MeshBasicMaterial({ map: faceTexture(appearance.eyes, appearance.lips), transparent: true }),
  );
  face.name = 'chibi-face';
  head.add(face);

  upper.add(body, head);
  const held = torch();
  upper.add(held.group);
  const arc = slashArc();
  root.add(createBlobShadow(0.36), arc);
  const arcMaterial = arc.material as MeshBasicMaterial;

  let walkPhase = 0;
  let idlePhase = 0;
  return {
    root,
    materials: [skin, hair, outfit, accent, ...(legsMat === accent ? [] : [legsMat]), ...extraMaterials],
    update(dt, speed01, pose) {
      const s = Math.min(Math.max(speed01, 0), 1);
      held.group.visible = pose.weapon === 'torch';
      if (held.group.visible) held.flame.scale.set(1, 1 + Math.sin(idlePhase * 9) * 0.15, 1);
      arcMaterial.color.setHex(TRAIL_COLOR[pose.element] ?? TRAIL_DEFAULT);
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

      // Combat poses.
      let twist = 0;
      arc.visible = false;
      if (pose.phase === 'windup') twist = -SWING_BACK * easeOut(pose.t01);
      else if (pose.phase === 'active') {
        twist = -SWING_BACK + SWING_THROUGH * easeOut(pose.t01);
        arc.visible = true;
        // The trail sweeps with the swing and fades.
        arc.rotation.y = (pose.t01 - 0.5) * 1.2;
        arcMaterial.opacity = 0.85 * (1 - pose.t01 * 0.6);
      } else if (pose.phase === 'recovery') twist = (SWING_THROUGH - SWING_BACK) * (1 - easeOut(pose.t01));
      upper.rotation.y = twist;
      if (pose.phase !== 'none') upper.rotation.x = 0.12;
      if (pose.staggered) {
        upper.rotation.x = -0.3;
        head.rotation.z = Math.sin(idlePhase * 9) * 0.15;
      } else {
        head.rotation.z = 0;
      }
    },
  };
}
