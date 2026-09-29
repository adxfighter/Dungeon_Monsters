import {
  CapsuleGeometry,
  ConeGeometry,
  type BufferGeometry,
  Euler,
  Group,
  Matrix4,
  Mesh,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MonsterDef } from '@content/schemas';
import { createToonMaterial } from '../materials/toon';
import { addOutline } from '../outline';
import { createBlobShadow } from './blobShadow';
import { NEWCOMER_FACTORIES } from './newcomers';
import { easeOut, type Rig } from './pose';

/**
 * Procedural monsters (original designs, docs/LEGAL.md), facing local +Z, ≤ 6 draw calls each (outline and blob
 * shadow included). Every windup has a readable pose — it is the telegraph: inflate (fugu), flare (porcupine).
 */
export type MonsterRig = Rig;

const m4 = new Matrix4();
const euler = new Euler();
const UP = new Vector3(0, 1, 0);
/** lookAt aims local -Z; this turns a +Y cone to point along the look direction instead. */
const TILT = new Matrix4().makeRotationX(-Math.PI / 2);

function placed(g: BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): BufferGeometry {
  g.applyMatrix4(m4.makeRotationFromEuler(euler.set(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  if (!merged) throw new Error('monsters: failed to merge geometry');
  return merged;
}

/** Two dark eye dots, merged. Black: not part of the hit flash. */
function eyes(r: number, spread: number, y: number, z: number): Mesh {
  const mesh = new Mesh(
    merge([
      placed(new SphereGeometry(r, 10, 6), spread, y, z),
      placed(new SphereGeometry(r, 10, 6), -spread, y, z),
    ]),
    createToonMaterial({ color: 0x1a1414, rimStrength: 0 }),
  );
  mesh.name = 'monster-eyes';
  return mesh;
}

/**
 * Fugu: a pink puffer-fish covered in sea-urchin spines, floating in the air. Windup: inflates, the spines
 * stand up and tremble; then the ring of spines fires (projectiles come from the core).
 * 6 draw calls: body + outline, spines, fins and lips, eyes, blob shadow.
 */
function fugu(def: MonsterDef): MonsterRig {
  const root = new Group();
  const body = new Group();
  body.position.y = 0.55;
  root.add(body);

  const skinMat = createToonMaterial({ color: def.appearance.body });
  const skin = new Mesh(new SphereGeometry(0.32, 24, 16), skinMat);
  skin.name = 'fugu-body';
  skin.scale.set(1, 0.92, 1.05);
  addOutline(skin);
  // Spines spread evenly over the sphere (Fibonacci lattice), none on the face (+Z) so the eyes stay readable.
  const spineParts: BufferGeometry[] = [];
  const N = 40;
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N;
    const r = Math.sqrt(1 - y * y);
    const a = i * 2.39996;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    if (z > 0.72 || y < -0.8) continue;
    const g = new ConeGeometry(0.035, 0.16, 5);
    g.translate(0, 0.3 + 0.08, 0);
    // Point the cone (local +Y) along the surface normal (x, y, z).
    g.applyMatrix4(m4.lookAt(new Vector3(0, 0, 0), new Vector3(x, y, z), UP).multiply(TILT));
    spineParts.push(g);
  }
  const spineMat = createToonMaterial({ color: def.appearance.accent });
  const spines = new Mesh(merge(spineParts), spineMat);
  spines.name = 'fugu-spines';
  const finMat = createToonMaterial({ color: '#ffc2d9' });
  const fins = new Mesh(
    merge([
      placed(new ConeGeometry(0.09, 0.2, 8), 0.33, -0.02, 0, 0, 0, -Math.PI / 2),
      placed(new ConeGeometry(0.09, 0.2, 8), -0.33, -0.02, 0, 0, 0, Math.PI / 2),
      placed(new ConeGeometry(0.13, 0.24, 8), 0, 0, -0.42, -Math.PI / 2, 0, 0),
      placed(new TorusGeometry(0.045, 0.02, 6, 12), 0, -0.07, 0.32), // round "o" lips
    ]),
    finMat,
  );
  fins.name = 'fugu-fins';
  body.add(skin, spines, fins, eyes(0.05, 0.13, 0.07, 0.28));
  root.add(createBlobShadow(0.32));

  let t = 0;
  return {
    root,
    materials: [skinMat, spineMat, finMat],
    update(dt, speed01, pose) {
      t += dt;
      body.position.y = 0.55 + Math.sin(t * 2.2) * 0.05;
      body.rotation.z = Math.sin(t * 1.3) * 0.08;
      fins.rotation.y = Math.sin(t * (6 + 6 * speed01)) * 0.12;
      // Telegraph: puff up, spines bristle and tremble; after the volley it slowly deflates.
      let inflate = 1;
      if (pose.phase === 'windup') inflate = 1 + 0.35 * easeOut(pose.t01);
      else if (pose.phase === 'active') inflate = 1.4;
      else if (pose.phase === 'recovery') inflate = 1.35 - 0.35 * pose.t01;
      const tremble = pose.phase === 'windup' ? Math.sin(t * 60) * 0.03 * pose.t01 : 0;
      body.scale.set(inflate + tremble, inflate - tremble, inflate);
      spines.scale.setScalar(1 + (inflate - 1) * 0.6);
      if (pose.staggered) body.rotation.z = Math.sin(t * 20) * 0.3;
    },
  };
}

/**
 * Polar porcupine: a big white porcupine with long icy quills; curls into a ball, quills flare before firing.
 * 6 draw calls: body + outline, quills, snout, eyes, blob shadow.
 */
function porcupine(def: MonsterDef): MonsterRig {
  const root = new Group();
  const body = new Group();
  root.add(body);

  const hogMat = createToonMaterial({ color: def.appearance.body });
  const torso = new Mesh(
    placed(new SphereGeometry(0.37, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), 0, 0.12, 0),
    hogMat,
  );
  torso.name = 'porcupine-body';
  torso.scale.set(1, 0.85, 1.15);
  addOutline(torso, { smoothNormals: true });

  const quillParts: BufferGeometry[] = [];
  for (let ring = 0; ring < 3; ring++) {
    const count = [11, 8, 5][ring] ?? 0;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + ring * 0.3;
      // Quills only on the back and sides, not the face (+Z).
      if (Math.cos(a) > 0.55) continue;
      const tilt = [1, 0.65, 0.3][ring] ?? 0;
      // Tilt each quill outward (rotate first, then move into place). Long, porcupine-like quills.
      const g = new ConeGeometry(0.04, 0.36 - ring * 0.04, 5)
        .rotateX(Math.cos(a) * tilt)
        .rotateZ(-Math.sin(a) * tilt);
      const rr = [0.25, 0.17, 0.08][ring] ?? 0;
      g.translate(Math.sin(a) * rr, 0.34 - ring * 0.01 + ring * 0.04, Math.cos(a) * rr * 1.1 - 0.04);
      quillParts.push(g);
    }
  }
  const quillMat = createToonMaterial({ color: def.appearance.accent });
  quillMat.emissive.set(def.appearance.accent);
  quillMat.emissiveIntensity = 0.6;
  const quills = new Mesh(merge(quillParts), quillMat);
  quills.name = 'porcupine-quills';

  const snout = new Mesh(
    placed(new SphereGeometry(0.1, 12, 8), 0, 0.15, 0.38),
    createToonMaterial({ color: 0x2a2a30, rimStrength: 0 }),
  );
  snout.name = 'porcupine-snout';
  const face = eyes(0.04, 0.12, 0.26, 0.31);
  // The face lives outside the squashed body so curling can't sink it into the dome.
  const faceGroup = new Group();
  faceGroup.add(snout, face);
  body.add(torso, quills);
  root.add(faceGroup);
  root.add(createBlobShadow(0.42));

  let t = 0;
  let curl = 0;
  return {
    root,
    materials: [hogMat, quillMat],
    update(dt, speed01, pose) {
      t += dt;
      body.position.y = Math.abs(Math.sin(t * 14)) * 0.03 * speed01;
      // Guard: curl into a spiky ball (smoothly); the face stays visible and pokes forward.
      curl += ((pose.guarding ? 1 : 0) - curl) * Math.min(1, dt * 12);
      body.scale.set(1 + 0.1 * curl, 1 - 0.3 * curl, 1 + 0.1 * curl);
      quills.scale.setScalar(1 + 0.35 * curl);
      // Players read a vanishing face as a bug (playtest): keep it on the surface of the curled ball —
      // follow the body bob, drop with the squash and move forward as the dome widens.
      faceGroup.position.set(0, body.position.y - 0.05 * curl, 0.05 * curl);
      // Telegraph: quills glow brighter and brighter until they fire.
      const charge = pose.phase === 'windup' ? pose.t01 : 0;
      quillMat.emissiveIntensity = 0.5 + Math.sin(t * 3) * 0.2 + charge * 1.6 + curl * 0.4;
      quills.rotation.y = charge * Math.sin(t * 40) * 0.05;
      body.rotation.z = pose.staggered ? Math.sin(t * 20) * 0.2 : 0;
      faceGroup.rotation.z = body.rotation.z; // the face wobbles with the body (same pivot)
    },
  };
}

const FACTORIES: Readonly<Record<string, (def: MonsterDef) => MonsterRig>> = {
  fugu,
  porcupine,
  ...NEWCOMER_FACTORIES,
};

export function createMonster(def: MonsterDef): MonsterRig {
  const factory = FACTORIES[def.id];
  if (!factory) throw new Error(`createMonster: no model for '${def.id}'`);
  const rig = factory(def);
  rig.root.name = `monster:${def.id}`;
  return rig;
}

// ---------------------------------------------------------------- projectiles

let quillGeometry: BufferGeometry | undefined;
const quillMaterials = new Map<string, ReturnType<typeof createToonMaterial>>();

/**
 * Glowing quill; geometry and the material of each colour are shared by all projectiles (never disposed per
 * projectile).
 */
export function createQuill(color = '#ffd35a'): Mesh {
  quillGeometry ??= new CapsuleGeometry(0.04, 0.22, 3, 6).rotateX(Math.PI / 2);
  let material = quillMaterials.get(color);
  if (!material) {
    material = createToonMaterial({ color, rimStrength: 0 });
    material.emissive.set(color);
    material.emissiveIntensity = 0.8;
    quillMaterials.set(color, material);
  }
  const mesh = new Mesh(quillGeometry, material);
  mesh.name = 'projectile-quill';
  mesh.position.y = 0.3;
  return mesh;
}
