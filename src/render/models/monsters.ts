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

/**
 * Procedural Tier I monsters (original designs, docs/LEGAL.md), facing local +Z, ≤ 6 draw calls each.
 * `update(dt, speed01, state)` animates idle / move; combat readability effects live in render/fx (M2 feel).
 */
export interface MonsterRig {
  readonly root: Group;
  update(dtSeconds: number, speed01: number): void;
}

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

/** Two dark eye dots, merged. */
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

/** Bubbler: round floating puffer with little fins; bobs in the air. */
function bubbler(def: MonsterDef): MonsterRig {
  const root = new Group();
  const body = new Group();
  body.position.y = 0.55;
  root.add(body);

  const shell = new Mesh(
    new SphereGeometry(0.34, 24, 16),
    createToonMaterial({ color: def.appearance.body }),
  );
  shell.name = 'bubbler-body';
  shell.scale.set(1, 0.9, 1.05);
  addOutline(shell);
  const fins = new Mesh(
    merge([
      placed(new ConeGeometry(0.1, 0.24, 8), 0.34, 0, -0.02, 0, 0, -Math.PI / 2),
      placed(new ConeGeometry(0.1, 0.24, 8), -0.34, 0, -0.02, 0, 0, Math.PI / 2),
      placed(new ConeGeometry(0.12, 0.26, 8), 0, 0.02, -0.4, -Math.PI / 2, 0, 0),
    ]),
    createToonMaterial({ color: def.appearance.accent }),
  );
  fins.name = 'bubbler-fins';
  addOutline(fins, { thickness: 0.02 });
  body.add(shell, fins, eyes(0.045, 0.13, 0.08, 0.3));
  root.add(createBlobShadow(0.32));

  let t = 0;
  return {
    root,
    update(dt, speed01) {
      t += dt;
      body.position.y = 0.55 + Math.sin(t * 2.2) * 0.05;
      body.rotation.z = Math.sin(t * 1.3) * 0.08;
      fins.rotation.y = Math.sin(t * (6 + 6 * speed01)) * 0.15;
    },
  };
}

/** Sparkhog: squat hedgehog with a crown of glowing quills. */
function sparkhog(def: MonsterDef): MonsterRig {
  const root = new Group();
  const body = new Group();
  root.add(body);

  const torso = new Mesh(
    placed(new SphereGeometry(0.32, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), 0, 0.12, 0),
    createToonMaterial({ color: def.appearance.body }),
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
  body.add(torso, quills, snout, eyes(0.035, 0.11, 0.24, 0.27));
  root.add(createBlobShadow(0.36));

  let t = 0;
  return {
    root,
    update(dt, speed01) {
      t += dt;
      body.position.y = Math.abs(Math.sin(t * 14)) * 0.03 * speed01;
      quillMat.emissiveIntensity = 0.5 + Math.sin(t * 3) * 0.2;
    },
  };
}

/** Stonenibbler: lean rock-grey rabbit with long ears and big front teeth; hops when it runs. */
function stonenibbler(def: MonsterDef): MonsterRig {
  const root = new Group();
  const body = new Group();
  root.add(body);

  const torso = new Mesh(
    merge([
      placed(new CapsuleGeometry(0.17, 0.2, 6, 12), 0, 0.3, -0.03, Math.PI / 2 - 0.4, 0, 0),
      placed(new SphereGeometry(0.16, 16, 10), 0, 0.5, 0.18),
    ]),
    createToonMaterial({ color: def.appearance.body }),
  );
  torso.name = 'stonenibbler-body';
  addOutline(torso);
  const ears = new Mesh(
    merge([
      placed(new CapsuleGeometry(0.04, 0.22, 4, 8), 0.07, 0.75, 0.1, -0.35, 0, -0.25),
      placed(new CapsuleGeometry(0.04, 0.22, 4, 8), -0.07, 0.75, 0.1, -0.35, 0, 0.25),
    ]),
    createToonMaterial({ color: def.appearance.accent }),
  );
  ears.name = 'stonenibbler-ears';
  addOutline(ears, { thickness: 0.02 });
  body.add(torso, ears, eyes(0.03, 0.08, 0.55, 0.31));
  root.add(createBlobShadow(0.3));

  let t = 0;
  let hop = 0;
  return {
    root,
    update(dt, speed01) {
      t += dt;
      hop += dt * 12 * speed01;
      body.position.y = Math.abs(Math.sin(hop)) * 0.12 * speed01;
      body.rotation.x = -Math.sin(hop) * 0.15 * speed01;
      ears.rotation.x = Math.sin(t * 2) * 0.05;
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
