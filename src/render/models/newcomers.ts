import {
  CapsuleGeometry,
  ConeGeometry,
  type BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MonsterDef } from '@content/schemas';
import { createToonMaterial } from '../materials/toon';
import { addOutline } from '../outline';
import { createBlobShadow } from './blobShadow';
import { easeOut, type Rig } from './pose';

/**
 * Procedural models of the five new monsters (user decision 2026-09-29), facing local +Z, ≤ 6 draw calls each
 * (outline and blob shadow included). Toadhog (a smooth frog with a pig snout) and Dragochick (stubby wings,
 * horn-crest, fire) are the user's ideas.
 */
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
  if (!merged) throw new Error('newcomers: failed to merge geometry');
  return merged;
}

const dark = () => createToonMaterial({ color: 0x1a1414, rimStrength: 0 });

function pair(make: () => BufferGeometry, x: number, y: number, z: number, rx = 0, rz = 0): BufferGeometry[] {
  return [placed(make(), x, y, z, rx, 0, rz), placed(make(), -x, y, z, rx, 0, -rz)];
}

// ---------------------------------------------------------------- Toadhog

function toadhog(def: MonsterDef): Rig {
  const root = new Group();
  const body = new Group();
  root.add(body);
  const skin = createToonMaterial({ color: def.appearance.body });
  const pink = createToonMaterial({ color: '#f5a3b5' });

  // A smooth, friendly frog (user, third playtest: "too scary" → short legs, a big pig snout, no spots).
  // 6 draw calls: body + outline, snout, throat sac, dark features, blob shadow.
  const side = (x: number, y: number, z: number, ry: number, make: () => BufferGeometry, rz = 0) => [
    placed(make(), x, y, z, 0, ry, rz),
    placed(make(), -x, y, z, 0, -ry, -rz),
  ];
  const torso = new Mesh(
    merge([
      placed(new SphereGeometry(0.34, 22, 12).scale(0.38 / 0.34, 0.25 / 0.34, 0.34 / 0.34), 0, 0.26, 0),
      placed(new SphereGeometry(0.2, 16, 10).scale(1.25, 0.85, 1), 0, 0.32, 0.2), // head
      ...pair(() => new SphereGeometry(0.09, 12, 8), 0.15, 0.48, 0.16), // eye bulges on top
      // Short little legs.
      ...side(0.3, 0.09, -0.14, 0.6, () => new CapsuleGeometry(0.06, 0.1, 4, 8), Math.PI / 2),
      ...side(0.38, 0.03, -0.22, 0.4, () => new SphereGeometry(0.08, 10, 6).scale(1.3, 0.3, 1)),
      ...side(0.18, 0.03, 0.28, 0, () => new SphereGeometry(0.05, 10, 6).scale(1.2, 0.35, 1)),
    ]),
    skin,
  );
  torso.name = 'toadhog-body';
  addOutline(torso);
  // The big pink pig snout.
  const snout = new Mesh(placed(new CylinderGeometry(0.13, 0.14, 0.08, 16), 0, 0.3, 0.4, Math.PI / 2), pink);
  snout.name = 'toadhog-snout';
  // Round pupils, nostrils and a smile.
  const features = new Mesh(
    merge([
      ...pair(() => new SphereGeometry(0.055, 10, 8), 0.155, 0.5, 0.215),
      ...pair(() => new SphereGeometry(0.03, 8, 6), 0.05, 0.3, 0.445),
      placed(new TorusGeometry(0.1, 0.012, 4, 12, Math.PI * 0.8), 0, 0.25, 0.36, -0.3, 0, Math.PI * 1.1),
    ]),
    dark(),
  );
  features.name = 'toadhog-features';
  // Throat sac under the chin: inflates as the telegraph.
  const sac = new Mesh(new SphereGeometry(0.11, 16, 10), pink);
  sac.name = 'toadhog-sac';
  sac.position.set(0, 0.17, 0.33);
  body.add(torso, snout, features, sac);
  root.add(createBlobShadow(0.4));

  let t = 0;
  let hop = 0;
  return {
    root,
    materials: [skin, pink],
    update(dt, speed01, pose) {
      t += dt;
      // Hop arc while moving (the core gates steering into bursts).
      hop += dt * 9 * speed01;
      body.position.y = Math.abs(Math.sin(hop)) * 0.25 * speed01;
      body.rotation.x = -Math.sin(hop) * 0.15 * speed01;
      let sacScale = 1 + Math.sin(t * 3) * 0.05;
      body.scale.set(1, 1, 1);
      if (pose.phase === 'windup') {
        const k = easeOut(pose.t01);
        sacScale = 1 + 0.9 * k + Math.sin(t * 40) * 0.05 * k;
        body.scale.set(1 + 0.1 * k, 1 - 0.18 * k, 1); // crouch
      } else if (pose.phase === 'active') {
        body.position.y = Math.sin(pose.t01 * Math.PI) * 0.45; // the leap
        body.scale.set(0.95, 1.05, 1.1);
      }
      sac.scale.setScalar(sacScale);
      body.rotation.z = pose.staggered ? Math.sin(t * 20) * 0.3 : 0;
    },
  };
}

// ---------------------------------------------------------------- Dragochick

function dragochick(def: MonsterDef): Rig {
  const root = new Group();
  const body = new Group();
  root.add(body);
  const down = createToonMaterial({ color: def.appearance.body });
  const flame = createToonMaterial({ color: def.appearance.accent });

  // 6 draw calls: torso + outline, wings, flame (crest + beak), dark (eyes + claws), blob shadow.
  const torso = new Mesh(new SphereGeometry(0.3, 20, 14), down);
  torso.name = 'dragochick-body';
  torso.position.y = 0.36;
  addOutline(torso);
  // Stubby wings.
  const wings = new Mesh(
    merge(pair(() => new SphereGeometry(0.12, 12, 8).scale(0.45, 1, 1), 0.3, 0.36, -0.02)),
    down,
  );
  wings.name = 'dragochick-wings';
  // Horn-crest (two little horns and a comb) and the beak: flame-coloured, they glow in the windup.
  const crest = new Mesh(
    merge([
      ...pair(() => new ConeGeometry(0.035, 0.14, 6), 0.08, 0.68, -0.02, -0.3, -0.3),
      placed(new ConeGeometry(0.05, 0.12, 6), 0, 0.7, 0.05, 0.2),
      placed(new ConeGeometry(0.07, 0.16, 8), 0, 0.36, 0.33, Math.PI / 2),
    ]),
    flame,
  );
  crest.name = 'dragochick-crest';
  // Eyes and dark dragon claws.
  const features = new Mesh(
    merge([
      ...pair(() => new SphereGeometry(0.035, 8, 6), 0.1, 0.46, 0.25),
      ...pair(() => new ConeGeometry(0.05, 0.1, 5), 0.09, 0.04, 0.05, Math.PI),
    ]),
    dark(),
  );
  features.name = 'dragochick-features';
  body.add(torso, wings, crest, features);
  root.add(createBlobShadow(0.3));

  let t = 0;
  return {
    root,
    materials: [down, flame],
    update(dt, speed01, pose) {
      t += dt;
      body.position.y = Math.abs(Math.sin(t * 10 * (0.3 + speed01))) * 0.05;
      wings.scale.set(1, 1, 1);
      wings.rotation.z = Math.sin(t * 18) * 0.15 * (0.3 + speed01);
      if (pose.phase === 'windup') {
        // Telegraph: puff up, flap, beak glowing and opening.
        const k = easeOut(pose.t01);
        body.scale.setScalar(1 + 0.18 * k);
        wings.rotation.z = Math.sin(t * 40) * 0.35 * k;
        flame.emissive.set(def.appearance.accent);
        flame.emissiveIntensity = k * 1.2;
      } else if (pose.phase === 'active') {
        body.scale.setScalar(1.05); // fire breath (particles come from the scene)
        flame.emissiveIntensity = 1.5;
      } else {
        body.scale.setScalar(1);
        flame.emissiveIntensity = 0;
      }
      body.rotation.z = pose.staggered ? Math.sin(t * 20) * 0.3 : 0;
    },
  };
}

// ---------------------------------------------------------------- Brooklash

function brooklash(def: MonsterDef): Rig {
  const root = new Group();
  const eel = new Group();
  root.add(eel);
  const skin = createToonMaterial({ color: def.appearance.body });
  const finMat = createToonMaterial({ color: def.appearance.accent });

  // Segmented eel body, head at +Z, rising out of the water.
  const bodyMesh = new Mesh(
    merge([
      placed(new SphereGeometry(0.17, 14, 10), 0, 0.3, 0.12),
      placed(new SphereGeometry(0.14, 12, 8), 0, 0.2, -0.12),
      placed(new SphereGeometry(0.11, 12, 8), 0, 0.12, -0.32),
      placed(new SphereGeometry(0.08, 10, 6), 0, 0.07, -0.48),
    ]),
    skin,
  );
  bodyMesh.name = 'brooklash-body';
  addOutline(bodyMesh);
  const fins = new Mesh(
    merge([
      placed(new ConeGeometry(0.05, 0.16, 5), 0, 0.46, 0.06, -0.4),
      placed(new ConeGeometry(0.04, 0.12, 5), 0, 0.33, -0.16, -0.5),
      ...pair(() => new ConeGeometry(0.04, 0.12, 5), 0.16, 0.28, 0.12, 0, -1.2),
    ]),
    finMat,
  );
  fins.name = 'brooklash-fins';
  const eyes = new Mesh(merge(pair(() => new SphereGeometry(0.03, 8, 6), 0.09, 0.36, 0.25)), dark());
  eel.add(bodyMesh, fins, eyes);

  // Ripple on the water: the only thing visible while submerged.
  const rippleMat = new MeshBasicMaterial({
    color: def.appearance.accent,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    side: DoubleSide,
  });
  const ripple = new Mesh(new RingGeometry(0.22, 0.3, 28).rotateX(-Math.PI / 2), rippleMat);
  ripple.name = 'brooklash-ripple';
  ripple.position.y = 0.015;
  const shadow = createBlobShadow(0.3);
  root.add(ripple, shadow);

  let t = 0;
  let rise = 0;
  return {
    root,
    materials: [skin, finMat],
    update(dt, speed01, pose) {
      t += dt;
      rise += ((pose.hidden ? 0 : 1) - rise) * Math.min(1, dt * 10);
      eel.visible = rise > 0.05;
      shadow.visible = eel.visible;
      eel.position.y = (rise - 1) * 0.45; // sinks below the floor when diving
      eel.rotation.y = Math.sin(t * 6) * 0.15;
      ripple.visible = rise < 0.95;
      const pulse = 1 + ((t * 1.5) % 1) * 0.6;
      ripple.scale.setScalar(pulse);
      rippleMat.opacity = 0.6 * (1 - ((t * 1.5) % 1)) * (1 - rise * 0.8) * (0.6 + speed01 * 0.4);
      if (pose.phase === 'windup') {
        eel.rotation.x = 0.4 * easeOut(pose.t01); // rears back
      } else if (pose.phase === 'active') {
        eel.rotation.x = -0.5;
        eel.scale.set(1, 1, 1.3); // strike
      } else {
        eel.rotation.x = 0;
        eel.scale.set(1, 1, 1);
      }
      if (pose.staggered) eel.rotation.z = Math.sin(t * 20) * 0.3;
      else eel.rotation.z = 0;
    },
  };
}

// ---------------------------------------------------------------- Bonegnaw

function bonegnaw(def: MonsterDef): Rig {
  const root = new Group();
  const body = new Group();
  root.add(body);
  const shell = createToonMaterial({ color: def.appearance.body });
  const bone = createToonMaterial({ color: def.appearance.accent });

  const carapace = new Mesh(
    merge([
      placed(new SphereGeometry(0.26, 18, 12).scale(1, 0.6, 1.25), 0, 0.2, -0.04),
      placed(new SphereGeometry(0.12, 12, 8), 0, 0.18, 0.28),
    ]),
    shell,
  );
  carapace.name = 'bonegnaw-carapace';
  addOutline(carapace);
  const mandibles = new Group();
  mandibles.position.set(0, 0.16, 0.38);
  const jaw = new Mesh(
    merge(pair(() => new ConeGeometry(0.03, 0.14, 5), 0.05, 0, 0.04, Math.PI / 2, 0.35)),
    bone,
  );
  jaw.name = 'bonegnaw-mandibles';
  mandibles.add(jaw);
  const legs = new Mesh(
    merge([
      ...pair(() => new CapsuleGeometry(0.02, 0.18, 3, 6), 0.22, 0.08, 0.14, 0, 1.1),
      ...pair(() => new CapsuleGeometry(0.02, 0.18, 3, 6), 0.24, 0.08, -0.02, 0, 1.2),
      ...pair(() => new CapsuleGeometry(0.02, 0.18, 3, 6), 0.22, 0.08, -0.18, 0, 1.1),
    ]),
    shell,
  );
  legs.name = 'bonegnaw-legs';
  const eyes = new Mesh(merge(pair(() => new SphereGeometry(0.025, 8, 6), 0.07, 0.25, 0.36)), bone);
  body.add(carapace, mandibles, legs, eyes);
  root.add(createBlobShadow(0.3));

  let t = 0;
  return {
    root,
    materials: [shell, bone],
    update(dt, speed01, pose) {
      t += dt;
      body.position.y = Math.abs(Math.sin(t * 22)) * 0.02 * speed01;
      legs.rotation.y = Math.sin(t * 22) * 0.12 * speed01;
      // Chomping: fast while eating, snapping in the attack windup.
      const chomp = pose.eating ? Math.abs(Math.sin(t * 14)) : pose.phase === 'windup' ? pose.t01 : 0.2;
      mandibles.scale.set(1 + chomp * 0.6, 1, 1);
      body.rotation.x = pose.eating ? 0.25 + Math.sin(t * 14) * 0.05 : pose.phase === 'active' ? -0.2 : 0;
      body.rotation.z = pose.staggered ? Math.sin(t * 20) * 0.3 : 0;
    },
  };
}

export const NEWCOMER_FACTORIES: Readonly<Record<string, (def: MonsterDef) => Rig>> = {
  toadhog,
  dragochick,
  brooklash,
  bonegnaw,
};

// ---------------------------------------------------------------- carcass

let carcassGeometry: { bones: BufferGeometry; meat: BufferGeometry } | undefined;
let carcassMaterials:
  { bones: ReturnType<typeof createToonMaterial>; meat: ReturnType<typeof createToonMaterial> } | undefined;

/** A small pile of bones and meat where a monster died. Shared geometry/materials (never disposed per carcass). */
export function createCarcass(): Group {
  carcassGeometry ??= {
    bones: merge([
      placed(new CapsuleGeometry(0.03, 0.22, 3, 6), 0.05, 0.05, 0, 0, 0.5, Math.PI / 2),
      placed(new CapsuleGeometry(0.03, 0.18, 3, 6), -0.08, 0.05, 0.08, 0, -0.7, Math.PI / 2),
      placed(new SphereGeometry(0.045, 8, 6), 0.16, 0.05, -0.06),
    ]),
    meat: new SphereGeometry(0.1, 12, 8).scale(1.2, 0.6, 1),
  };
  carcassMaterials ??= {
    bones: createToonMaterial({ color: '#efe6d6', rimStrength: 0 }),
    meat: createToonMaterial({ color: '#b5524a', rimStrength: 0 }),
  };
  const g = new Group();
  g.name = 'carcass';
  const bones = new Mesh(carcassGeometry.bones, carcassMaterials.bones);
  const meat = new Mesh(carcassGeometry.meat, carcassMaterials.meat);
  meat.position.set(-0.02, 0.05, -0.04);
  g.add(bones, meat);
  return g;
}
