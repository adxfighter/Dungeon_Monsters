import {
  CapsuleGeometry,
  ConeGeometry,
  type BufferGeometry,
  Euler,
  Group,
  Matrix4,
  Mesh,
  SphereGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MonsterDef } from '@content/schemas';
import { createToonMaterial } from '../materials/toon';
import { addOutline } from '../outline';
import { createBlobShadow } from './blobShadow';
import { easeOut, type Rig } from './pose';

/**
 * Procedural Tier I monsters (original designs, docs/LEGAL.md), facing local +Z, ≤ 6 draw calls each.
 * Every windup has a readable pose — it is the telegraph: inflate (bubbler), flare (sparkhog), crouch (rabbit).
 */
export type MonsterRig = Rig;

const m4 = new Matrix4();
const euler = new Euler();

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

/** Bubbler: round floating puffer with little fins; bobs in the air, inflates before ramming. */
function bubbler(def: MonsterDef): MonsterRig {
  const root = new Group();
  const body = new Group();
  body.position.y = 0.55;
  root.add(body);

  const shellMat = createToonMaterial({ color: def.appearance.body });
  const shell = new Mesh(new SphereGeometry(0.34, 24, 16), shellMat);
  shell.name = 'bubbler-body';
  shell.scale.set(1, 0.9, 1.05);
  addOutline(shell);
  const finMat = createToonMaterial({ color: def.appearance.accent });
  const fins = new Mesh(
    merge([
      placed(new ConeGeometry(0.1, 0.24, 8), 0.34, 0, -0.02, 0, 0, -Math.PI / 2),
      placed(new ConeGeometry(0.1, 0.24, 8), -0.34, 0, -0.02, 0, 0, Math.PI / 2),
      placed(new ConeGeometry(0.12, 0.26, 8), 0, 0.02, -0.4, -Math.PI / 2, 0, 0),
    ]),
    finMat,
  );
  fins.name = 'bubbler-fins';
  addOutline(fins, { thickness: 0.02 });
  body.add(shell, fins, eyes(0.045, 0.13, 0.08, 0.3));
  root.add(createBlobShadow(0.32));

  let t = 0;
  return {
    root,
    materials: [shellMat, finMat],
    update(dt, speed01, pose) {
      t += dt;
      body.position.y = 0.55 + Math.sin(t * 2.2) * 0.05;
      body.rotation.z = Math.sin(t * 1.3) * 0.08;
      fins.rotation.y = Math.sin(t * (6 + 6 * speed01)) * 0.15;
      // Telegraph: inflate and tremble; ram: stretched forward; then deflate.
      let inflate = 1;
      if (pose.phase === 'windup') inflate = 1 + 0.4 * easeOut(pose.t01);
      else if (pose.phase === 'active') inflate = 1.4 - 0.25 * pose.t01;
      else if (pose.phase === 'recovery') inflate = 1.15 - 0.15 * pose.t01;
      const tremble = pose.phase === 'windup' ? Math.sin(t * 60) * 0.03 * pose.t01 : 0;
      const stretch = pose.phase === 'active' ? 1.15 : 1;
      body.scale.set(inflate + tremble, inflate - tremble, inflate * stretch);
      if (pose.staggered) body.rotation.z = Math.sin(t * 20) * 0.3;
    },
  };
}

/** Sparkhog: squat hedgehog with a crown of glowing quills; curls into a ball, quills flare before firing. */
function sparkhog(def: MonsterDef): MonsterRig {
  const root = new Group();
  const body = new Group();
  root.add(body);

  const hogMat = createToonMaterial({ color: def.appearance.body });
  const torso = new Mesh(
    placed(new SphereGeometry(0.32, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), 0, 0.12, 0),
    hogMat,
  );
  torso.name = 'sparkhog-body';
  torso.scale.set(1, 0.85, 1.15);
  addOutline(torso, { smoothNormals: true });

  const quillParts: BufferGeometry[] = [];
  for (let ring = 0; ring < 2; ring++) {
    const count = ring === 0 ? 9 : 6;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + ring * 0.3;
      // Quills only on the back and sides, not the face (+Z).
      if (Math.cos(a) > 0.55) continue;
      const tilt = ring === 0 ? 0.9 : 0.45;
      // Tilt each quill outward (rotate first, then move into place).
      const g = new ConeGeometry(0.045, 0.24, 5).rotateX(Math.cos(a) * tilt).rotateZ(-Math.sin(a) * tilt);
      g.translate(Math.sin(a) * 0.2, 0.3 - ring * 0.02, Math.cos(a) * 0.22);
      quillParts.push(g);
    }
  }
  const quillMat = createToonMaterial({ color: def.appearance.accent });
  quillMat.emissive.set(def.appearance.accent);
  quillMat.emissiveIntensity = 0.6;
  const quills = new Mesh(merge(quillParts), quillMat);
  quills.name = 'sparkhog-quills';

  const snout = new Mesh(
    placed(new SphereGeometry(0.09, 12, 8), 0, 0.14, 0.33),
    createToonMaterial({ color: 0x3a2a24, rimStrength: 0 }),
  );
  snout.name = 'sparkhog-snout';
  const face = eyes(0.035, 0.11, 0.24, 0.27);
  // The face lives outside the squashed body so curling can't sink it into the dome.
  const faceGroup = new Group();
  faceGroup.add(snout, face);
  body.add(torso, quills);
  root.add(faceGroup);
  root.add(createBlobShadow(0.36));

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

/** Stonenibbler: lean rock-grey rabbit with long ears; crouches before a pounce, dizzy after a miss. */
function stonenibbler(def: MonsterDef): MonsterRig {
  const root = new Group();
  const body = new Group();
  root.add(body);

  const furMat = createToonMaterial({ color: def.appearance.body });
  const torso = new Mesh(
    merge([
      placed(new CapsuleGeometry(0.17, 0.2, 6, 12), 0, 0.3, -0.03, Math.PI / 2 - 0.4, 0, 0),
      placed(new SphereGeometry(0.16, 16, 10), 0, 0.5, 0.18),
    ]),
    furMat,
  );
  torso.name = 'stonenibbler-body';
  addOutline(torso);
  const earMat = createToonMaterial({ color: def.appearance.accent });
  // Ears pivot at the top of the head (not at the feet), so flicking them keeps them attached.
  const ears = new Mesh(
    merge([
      placed(new CapsuleGeometry(0.04, 0.22, 4, 8), 0.07, 0.13, -0.02, -0.35, 0, -0.25),
      placed(new CapsuleGeometry(0.04, 0.22, 4, 8), -0.07, 0.13, -0.02, -0.35, 0, 0.25),
    ]),
    earMat,
  );
  ears.position.set(0, 0.62, 0.12);
  ears.name = 'stonenibbler-ears';
  addOutline(ears, { thickness: 0.02 });
  body.add(torso, ears, eyes(0.03, 0.08, 0.55, 0.31));
  root.add(createBlobShadow(0.3));

  let t = 0;
  let hop = 0;
  return {
    root,
    materials: [furMat, earMat],
    update(dt, speed01, pose) {
      t += dt;
      hop += dt * 12 * speed01;
      body.position.y = Math.abs(Math.sin(hop)) * 0.12 * speed01;
      body.rotation.x = -Math.sin(hop) * 0.15 * speed01;
      body.rotation.z = 0;
      body.scale.set(1, 1, 1);
      ears.rotation.x = Math.sin(t * 2) * 0.05;
      if (pose.phase === 'windup') {
        // Telegraph: crouch low, ears pinned back, wiggle before the pounce.
        const k = easeOut(pose.t01);
        body.position.y = -0.1 * k;
        body.rotation.x = 0.35 * k;
        body.scale.set(1 + 0.1 * k, 1 - 0.2 * k, 1);
        ears.rotation.x = -0.9 * k;
        body.rotation.z = Math.sin(t * 30) * 0.05 * k;
      } else if (pose.phase === 'active') {
        body.scale.set(0.9, 0.9, 1.35); // stretched mid-leap
        body.position.y = Math.sin(pose.t01 * Math.PI) * 0.25;
        ears.rotation.x = -1.1;
      } else if (pose.phase === 'recovery' && pose.whiffed) {
        body.rotation.z = Math.sin(t * 8) * 0.25; // dizzy after a miss: the punish window
        ears.rotation.x = 0.6;
      }
      if (pose.staggered) body.rotation.z = Math.sin(t * 20) * 0.3;
    },
  };
}

const FACTORIES: Readonly<Record<string, (def: MonsterDef) => MonsterRig>> = {
  bubbler,
  sparkhog,
  stonenibbler,
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
let quillMaterial: ReturnType<typeof createToonMaterial> | undefined;

/** Glowing quill; geometry and material are shared by all projectiles (never disposed per projectile). */
export function createQuill(): Mesh {
  quillGeometry ??= new CapsuleGeometry(0.04, 0.22, 3, 6).rotateX(Math.PI / 2);
  if (!quillMaterial) {
    quillMaterial = createToonMaterial({ color: 0xffd35a, rimStrength: 0 });
    quillMaterial.emissive.set(0xffd35a);
    quillMaterial.emissiveIntensity = 0.8;
  }
  const mesh = new Mesh(quillGeometry, quillMaterial);
  mesh.name = 'projectile-quill';
  mesh.position.y = 0.3;
  return mesh;
}
