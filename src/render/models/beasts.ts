import {
  CapsuleGeometry,
  CircleGeometry,
  Color,
  type ColorRepresentation,
  ConeGeometry,
  type BufferGeometry,
  Euler,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { HazardDef, MonsterDef } from '@content/schemas';
import { createToonMaterial } from '../materials/toon';
import { addOutline } from '../outline';
import { createBlobShadow } from './blobShadow';
import { easeOut, type Rig } from './pose';

/**
 * Procedural models of the four new monsters of the third playtest (user ideas 2026-09-29): Stink skunk, Maniac
 * yak, Dino-ostrich, Decapus. Facing local +Z. Multi-coloured parts are merged into one mesh with vertex colours,
 * so each model stays ≤ 6 draw calls (outline and blob shadow included; checked by monsters.test.ts).
 */
const m4 = new Matrix4();
const euler = new Euler();
const tmp = new Color();

/** Geometry rotated (XYZ Euler), moved into place and painted one flat colour (vertex colours). */
function part(
  g: BufferGeometry,
  color: ColorRepresentation,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): BufferGeometry {
  g.applyMatrix4(m4.makeRotationFromEuler(euler.set(rx, ry, rz)));
  g.translate(x, y, z);
  tmp.set(color);
  const n = g.getAttribute('position').count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return g;
}

/** Left/right mirrored pair of parts. */
function both(
  make: () => BufferGeometry,
  color: ColorRepresentation,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): BufferGeometry[] {
  return [part(make(), color, x, y, z, rx, ry, rz), part(make(), color, -x, y, z, rx, -ry, -rz)];
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  if (!merged) throw new Error('beasts: failed to merge geometry');
  return merged;
}

/** Toon material that takes its colour from the vertices. */
function painted(): ReturnType<typeof createToonMaterial> {
  const m = createToonMaterial({ color: 0xffffff });
  m.vertexColors = true;
  return m;
}

const DARK = '#1a1414';
const WHITE = '#f7f4ee';

// ---------------------------------------------------------------- Stink skunk

function skunk(def: MonsterDef): Rig {
  const root = new Group();
  const body = new Group();
  root.add(body);
  const fur = def.appearance.body;
  const stripe = def.appearance.accent;
  const mat = painted();
  const torso = new Mesh(
    merge([
      part(new CapsuleGeometry(0.16, 0.2, 6, 12), fur, 0, 0.24, -0.02, Math.PI / 2),
      part(new SphereGeometry(0.14, 16, 10), fur, 0, 0.3, 0.24),
      part(new CapsuleGeometry(0.045, 0.3, 4, 8).scale(1, 1, 0.5), stripe, 0, 0.4, 0.0, Math.PI / 2), // back stripe
      part(new CapsuleGeometry(0.03, 0.08, 4, 8).scale(1, 1, 0.6), stripe, 0, 0.4, 0.28, Math.PI / 2 - 0.5), // blaze
      ...both(() => new ConeGeometry(0.045, 0.08, 6), fur, 0.08, 0.43, 0.2),
      ...both(() => new SphereGeometry(0.035, 8, 6), WHITE, 0.06, 0.33, 0.35),
      ...both(() => new SphereGeometry(0.02, 6, 4), DARK, 0.062, 0.335, 0.38),
      part(new SphereGeometry(0.03, 8, 6), '#f29aa0', 0, 0.28, 0.38),
      ...both(() => new CapsuleGeometry(0.04, 0.08, 3, 6), fur, 0.1, 0.07, 0.12),
      ...both(() => new CapsuleGeometry(0.04, 0.08, 3, 6), fur, 0.1, 0.07, -0.14),
    ]),
    mat,
  );
  torso.name = 'skunk-body';
  addOutline(torso);
  // The huge bushy tail, pivoting at the rump: raised and fanned out over the back as the telegraph.
  const tail = new Group();
  tail.position.set(0, 0.3, -0.24);
  const tailMesh = new Mesh(
    merge([
      part(new SphereGeometry(0.12, 12, 8), fur, 0, 0.02, -0.08),
      part(new SphereGeometry(0.17, 14, 10), fur, 0, 0.18, -0.2),
      part(new SphereGeometry(0.16, 14, 10), fur, 0, 0.4, -0.16),
      part(new SphereGeometry(0.1, 12, 8).scale(0.7, 1.5, 0.7), stripe, 0, 0.3, -0.24), // white stripe on the brush
      part(new SphereGeometry(0.1, 12, 8), stripe, 0, 0.53, -0.1),
    ]),
    mat,
  );
  tailMesh.name = 'skunk-tail';
  addOutline(tailMesh, { thickness: 0.02 });
  tail.add(tailMesh);
  body.add(torso, tail);
  root.add(createBlobShadow(0.34));

  /** The huge brush: larger than the body. */
  const TAIL = 1.3;
  let t = 0;
  return {
    root,
    materials: [mat],
    update(dt, speed01, pose) {
      t += dt;
      body.position.y = Math.abs(Math.sin(t * 12)) * 0.03 * speed01;
      body.rotation.z = 0;
      tail.rotation.x = 0.1 + Math.sin(t * 2) * 0.06; // carried high over the back
      tail.rotation.z = Math.sin(t * 1.6) * 0.1;
      tail.scale.setScalar(TAIL);
      if (pose.phase === 'windup') {
        // It has already turned its back (core); now the tail goes up and fans, the body braces and trembles.
        const k = easeOut(pose.t01);
        tail.rotation.x = 0.1 + 0.5 * k;
        tail.scale.setScalar(TAIL * (1 + 0.2 * k));
        body.rotation.z = Math.sin(t * 40) * 0.04 * k;
      } else if (pose.phase === 'active') {
        tail.rotation.x = 0.6;
        tail.scale.setScalar(TAIL * 1.2);
        body.rotation.z = Math.sin(t * 60) * 0.06; // the spray
      }
      if (pose.staggered) body.rotation.z = Math.sin(t * 20) * 0.3;
    },
  };
}

// ---------------------------------------------------------------- Maniac yak

function yak(def: MonsterDef): Rig {
  const root = new Group();
  const body = new Group();
  root.add(body);
  const fur = def.appearance.body;
  const shag = '#36241a';
  const horn = def.appearance.accent;
  const mat = painted();
  const torso = new Mesh(
    merge([
      part(new SphereGeometry(0.36, 20, 14).scale(1, 0.8, 1.15), fur, 0, 0.44, -0.04),
      part(new SphereGeometry(0.22, 14, 10), fur, 0, 0.66, 0.14), // hump
      // Shaggy fringe hanging off the flanks and belly.
      ...both(() => new SphereGeometry(0.16, 12, 8).scale(0.6, 1.2, 1.6), shag, 0.27, 0.3, -0.04),
      part(new SphereGeometry(0.2, 12, 8).scale(1.4, 0.6, 1.8), shag, 0, 0.2, -0.04),
      ...both(() => new CapsuleGeometry(0.07, 0.14, 4, 8), shag, 0.2, 0.1, 0.24),
      ...both(() => new CapsuleGeometry(0.07, 0.14, 4, 8), shag, 0.2, 0.1, -0.3),
    ]),
    mat,
  );
  torso.name = 'yak-body';
  addOutline(torso);
  // Head on its own pivot: lowered for the charge.
  const head = new Group();
  head.position.set(0, 0.5, 0.36);
  const headMesh = new Mesh(
    merge([
      part(new SphereGeometry(0.17, 16, 10).scale(1, 0.9, 1.1), fur, 0, 0, 0.08),
      part(new SphereGeometry(0.1, 12, 8).scale(1.2, 0.8, 1), '#6b4a36', 0, -0.05, 0.22), // muzzle
      part(new SphereGeometry(0.12, 12, 8).scale(1.3, 0.7, 1), shag, 0, 0.13, 0.04), // shaggy fringe on the brow
      // Horns: out to the sides, then forward and up.
      ...both(() => new CapsuleGeometry(0.04, 0.14, 4, 8), horn, 0.18, 0.08, 0.06, 0, 0, Math.PI / 2 - 0.3),
      ...both(() => new ConeGeometry(0.04, 0.16, 8), horn, 0.29, 0.16, 0.12, 0.6, 0, -0.35),
      ...both(() => new SphereGeometry(0.03, 8, 6), '#ff4a3a', 0.08, 0.04, 0.2), // mean red eyes
    ]),
    mat,
  );
  headMesh.name = 'yak-head';
  addOutline(headMesh, { thickness: 0.02 });
  head.add(headMesh);
  body.add(torso, head);
  root.add(createBlobShadow(0.48));

  let t = 0;
  return {
    root,
    materials: [mat],
    update(dt, speed01, pose) {
      t += dt;
      body.position.y = Math.abs(Math.sin(t * 7)) * 0.04 * speed01;
      body.rotation.x = 0;
      body.rotation.z = 0;
      head.rotation.x = Math.sin(t * 1.5) * 0.05;
      if (pose.phase === 'windup') {
        // Telegraph: head down, horns forward, pawing the ground (the body rocks back and forth).
        const k = easeOut(pose.t01);
        head.rotation.x = 0.55 * k;
        body.rotation.x = Math.sin(t * 16) * 0.06 * k;
      } else if (pose.phase === 'active') {
        head.rotation.x = 0.6; // the charge
        body.rotation.x = 0.12;
        body.position.y = Math.abs(Math.sin(t * 20)) * 0.05;
      } else if (pose.phase === 'recovery' && pose.whiffed) {
        body.rotation.z = Math.sin(t * 8) * 0.12; // dazed after a missed charge: the punish window
        head.rotation.x = 0.3;
      }
      if (pose.staggered) body.rotation.z = Math.sin(t * 20) * 0.2;
    },
  };
}

// ---------------------------------------------------------------- Dino-ostrich

function dinostrich(def: MonsterDef): Rig {
  const root = new Group();
  const body = new Group();
  root.add(body);
  const skin = def.appearance.body;
  const dark = def.appearance.accent;
  const mat = painted();
  const torso = new Mesh(
    merge([
      part(new SphereGeometry(0.24, 18, 12).scale(0.9, 0.8, 1.2), skin, 0, 0.56, -0.04),
      // Emu-like feather tuft and a raptor tail.
      part(new ConeGeometry(0.12, 0.34, 8), dark, 0, 0.6, -0.36, -Math.PI / 2 - 0.3),
      part(new SphereGeometry(0.13, 10, 8).scale(1.1, 0.6, 1), dark, 0, 0.66, -0.2),
      // Long strong legs with claws.
      ...both(() => new CapsuleGeometry(0.06, 0.18, 4, 8), skin, 0.1, 0.36, 0.0, -0.3),
      ...both(() => new CapsuleGeometry(0.035, 0.2, 4, 8), dark, 0.1, 0.14, 0.04, 0.2),
      ...both(() => new ConeGeometry(0.035, 0.12, 5), dark, 0.1, 0.03, 0.12, Math.PI / 2),
      // Tiny raptor arms.
      ...both(() => new CapsuleGeometry(0.025, 0.08, 3, 6), skin, 0.18, 0.54, 0.18, 0.9),
    ]),
    mat,
  );
  torso.name = 'dinostrich-body';
  addOutline(torso);
  // Neck + head on a pivot at the shoulders: pulls back and snaps forward for the bite.
  const neck = new Group();
  neck.position.set(0, 0.62, 0.16);
  const neckMesh = new Mesh(
    merge([
      part(new CapsuleGeometry(0.06, 0.3, 4, 8), skin, 0, 0.18, 0.02, 0.25),
      part(new SphereGeometry(0.1, 14, 10).scale(1, 0.9, 1.2), skin, 0, 0.38, 0.08),
      part(new ConeGeometry(0.06, 0.16, 8).scale(1, 1, 0.6), '#c98a4a', 0, 0.36, 0.22, Math.PI / 2), // jaw
      ...both(() => new ConeGeometry(0.012, 0.04, 4), WHITE, 0.03, 0.33, 0.2, Math.PI), // teeth
      ...both(() => new SphereGeometry(0.025, 8, 6), DARK, 0.07, 0.42, 0.13),
      part(new ConeGeometry(0.05, 0.12, 6), dark, 0, 0.47, 0.02, -0.6), // crest
    ]),
    mat,
  );
  neckMesh.name = 'dinostrich-neck';
  addOutline(neckMesh, { thickness: 0.02 });
  neck.add(neckMesh);
  body.add(torso, neck);
  root.add(createBlobShadow(0.34));

  let t = 0;
  let run = 0;
  return {
    root,
    materials: [mat],
    update(dt, speed01, pose) {
      t += dt;
      run += dt * 16 * speed01;
      body.position.y = Math.abs(Math.sin(run)) * 0.05 * speed01;
      body.rotation.x = 0;
      body.scale.set(1, 1, 1);
      neck.rotation.x = Math.sin(run) * 0.1 * speed01 + Math.sin(t * 2) * 0.04;
      const stomp = pose.attackId === 'dinostrich.stomp';
      if (pose.phase === 'windup') {
        const k = easeOut(pose.t01);
        if (stomp) {
          body.position.y = 0.18 * k; // rears up on its toes
          body.rotation.x = -0.25 * k;
        } else {
          neck.rotation.x = -0.6 * k; // head pulled back, jaws open
        }
      } else if (pose.phase === 'active') {
        if (stomp) {
          body.scale.set(1.1, 0.85, 1.1); // slam
        } else {
          neck.rotation.x = 0.8; // the snap
        }
      }
      body.rotation.z = pose.staggered ? Math.sin(t * 20) * 0.25 : 0;
    },
  };
}

// ---------------------------------------------------------------- Decapus

function decapus(def: MonsterDef): Rig {
  const root = new Group();
  const body = new Group();
  root.add(body);
  const skin = def.appearance.body;
  const light = def.appearance.accent;
  const mat = painted();
  const mantle = new Mesh(
    merge([
      part(new SphereGeometry(0.27, 20, 14).scale(1, 1.15, 1), skin, 0, 0.42, -0.04),
      ...both(() => new SphereGeometry(0.035, 8, 6), light, 0.14, 0.58, -0.12),
      part(new SphereGeometry(0.03, 8, 6), light, 0, 0.66, 0.02),
      ...both(() => new SphereGeometry(0.075, 12, 8), WHITE, 0.1, 0.42, 0.2),
      ...both(() => new SphereGeometry(0.045, 10, 6), DARK, 0.105, 0.42, 0.26),
    ]),
    mat,
  );
  mantle.name = 'decapus-mantle';
  addOutline(mantle);
  // Nine short legs spread on the floor (the tenth is the grabbing tentacle).
  const legParts: BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.25 + (i / 8) * Math.PI * 1.5; // leave a gap at the front
    const g = part(new CapsuleGeometry(0.05, 0.22, 4, 8), skin, 0, 0, 0.16, Math.PI / 2 - 0.25);
    g.applyMatrix4(m4.makeRotationY(a + Math.PI));
    g.translate(0, 0.1, 0);
    legParts.push(g);
  }
  const legs = new Mesh(merge(legParts), mat);
  legs.name = 'decapus-legs';
  // The grabbing tentacle: pivots at the front of the mantle, stretches along +Z to the hero.
  const reach = new Group();
  reach.position.set(0, 0.2, 0.2);
  const tentacle = new Mesh(
    merge([
      part(new CapsuleGeometry(0.05, 0.9, 4, 8), skin, 0, 0, 0.5, Math.PI / 2),
      part(new SphereGeometry(0.08, 10, 8), light, 0, 0, 1), // sucker pad at the tip
    ]),
    mat,
  );
  tentacle.name = 'decapus-tentacle';
  reach.add(tentacle);
  body.add(mantle, legs, reach);
  root.add(createBlobShadow(0.42));

  /** Tentacle geometry length (tip at z = 1). */
  const REST = 0.25;
  let t = 0;
  let len = REST;
  return {
    root,
    materials: [mat],
    update(dt, speed01, pose) {
      t += dt;
      body.position.y = Math.sin(t * 3) * 0.02;
      legs.rotation.y = Math.sin(t * (3 + 5 * speed01)) * 0.08;
      mantle.scale.set(1, 1, 1);
      let want = REST;
      reach.rotation.x = 0;
      if (pose.holdDist > 0) {
        // Holding the hero: the tip wraps her body (pivot sits 0.2 in front, she is ~0.3 wide).
        want = Math.max(REST, pose.holdDist - 0.2 - 0.15);
        mantle.scale.set(1 + Math.sin(t * 10) * 0.03, 1 - Math.sin(t * 10) * 0.03, 1);
      } else if (pose.phase === 'windup') {
        // Telegraph: the mantle swells, the tentacle coils up and back.
        const k = easeOut(pose.t01);
        mantle.scale.set(1 + 0.12 * k, 1 + 0.12 * k, 1);
        reach.rotation.x = -1.1 * k;
        want = REST * 0.8;
      } else if (pose.phase === 'active') {
        want = 1.8; // lash out (the grab reaches 2 tiles from the centre)
      }
      len += (want - len) * Math.min(1, dt * 18);
      reach.scale.set(1, 1, Math.max(0.05, len));
      body.rotation.z = pose.staggered ? Math.sin(t * 20) * 0.25 : 0;
    },
  };
}

export const BEAST_FACTORIES: Readonly<Record<string, (def: MonsterDef) => Rig>> = {
  skunk,
  yak,
  dinostrich,
  decapus,
};

// ---------------------------------------------------------------- stink cloud (hazard)

/** Green stinking cloud on the floor; fades out as it runs out (`pose.life01`). 2 draw calls. */
export function createStinkCloud(def: HazardDef): Rig {
  const root = new Group();
  root.name = 'hazard:cloud';
  const floorMat = new MeshBasicMaterial({
    color: 0x8fcf4a,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const floor = new Mesh(new CircleGeometry(def.radius, 28).rotateX(-Math.PI / 2), floorMat);
  floor.position.y = 0.02;
  const puffMat = new MeshBasicMaterial({
    color: 0xa8d860,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  const puffs: BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = def.radius * (i % 2 === 0 ? 0.55 : 0.3);
    puffs.push(new SphereGeometry(def.radius * 0.35, 10, 6).translate(Math.sin(a) * r, 0.2, Math.cos(a) * r));
  }
  const puff = new Mesh(merge(puffs), puffMat);
  root.add(floor, puff);
  let t = 0;
  return {
    root,
    materials: [],
    update(dt, _speed01, pose) {
      t += dt;
      const fade = Math.min(1, pose.life01 * 4); // fade over the last quarter
      floorMat.opacity = 0.35 * fade;
      puffMat.opacity = 0.3 * fade;
      puff.rotation.y = t * 0.4;
      puff.position.y = Math.sin(t * 1.5) * 0.04;
      puff.scale.setScalar(1 + Math.sin(t * 2) * 0.05);
    },
  };
}
