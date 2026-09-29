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
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MonsterDef } from '@content/schemas';
import { createToonMaterial } from '../materials/toon';
import { addOutline } from '../outline';
import { createBlobShadow } from './blobShadow';
import { easeOut, type Rig } from './pose';

/**
 * Procedural models of the five new monsters (user decision 2026-09-29), facing local +Z, ≤ 6 draw calls each.
 * Toadhog / Dragochick are original designs (frog legs + throat sac; stubby wings + horn-crest + fire) — NOT the
 * Angry Birds characters (docs/LEGAL.md).
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
  const pale = createToonMaterial({ color: def.appearance.accent });
  const snoutMat = createToonMaterial({ color: '#f29aa0' });

  // Round pig body with small pointed ears.
  const torso = new Mesh(
    merge([
      placed(new SphereGeometry(0.36, 22, 14), 0, 0.36, 0),
      ...pair(() => new ConeGeometry(0.07, 0.14, 6), 0.17, 0.66, 0.02, -0.3, -0.4),
    ]),
    skin,
  );
  torso.name = 'toadhog-body';
  addOutline(torso);
  // Frog legs: big folded hind legs and small front feet.
  const legs = new Mesh(
    merge([
      ...pair(() => new CapsuleGeometry(0.09, 0.22, 4, 8), 0.26, 0.12, -0.15, 1.2, 0.3),
      ...pair(() => new SphereGeometry(0.1, 10, 6), 0.3, 0.05, 0.05),
      ...pair(() => new CapsuleGeometry(0.05, 0.1, 4, 6), 0.16, 0.08, 0.25),
    ]),
    skin,
  );
  legs.name = 'toadhog-legs';
  addOutline(legs, { thickness: 0.02 });
  const snout = new Mesh(
    merge([
      placed(new CylinderGeometry(0.11, 0.12, 0.08, 14), 0, 0.4, 0.37, Math.PI / 2),
      ...pair(() => new SphereGeometry(0.022, 8, 6), 0.04, 0.4, 0.42),
    ]),
    snoutMat,
  );
  snout.name = 'toadhog-snout';
  // Throat sac under the chin: inflates as the telegraph.
  const sac = new Mesh(new SphereGeometry(0.15, 16, 10), pale);
  sac.name = 'toadhog-sac';
  sac.position.set(0, 0.2, 0.26);
  // Bulging frog eyes on top.
  const eyeWhites = new Mesh(merge(pair(() => new SphereGeometry(0.08, 12, 8), 0.14, 0.66, 0.16)), pale);
  const pupils = new Mesh(merge(pair(() => new SphereGeometry(0.04, 8, 6), 0.15, 0.68, 0.23)), dark());
  body.add(torso, legs, snout, sac, eyeWhites, pupils);
  root.add(createBlobShadow(0.38));

  let t = 0;
  let hop = 0;
  return {
    root,
    materials: [skin, pale, snoutMat],
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
  const beakMat = createToonMaterial({ color: '#ff9f2e' });

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
  addOutline(wings, { thickness: 0.02 });
  // Horn-crest: two little horns and a comb, flame-coloured.
  const crest = new Mesh(
    merge([
      ...pair(() => new ConeGeometry(0.035, 0.14, 6), 0.08, 0.68, -0.02, -0.3, -0.3),
      placed(new ConeGeometry(0.05, 0.12, 6), 0, 0.7, 0.05, 0.2),
    ]),
    flame,
  );
  crest.name = 'dragochick-crest';
  const beak = new Mesh(placed(new ConeGeometry(0.07, 0.16, 8), 0, 0.36, 0.33, Math.PI / 2), beakMat);
  beak.name = 'dragochick-beak';
  const eyes = new Mesh(merge(pair(() => new SphereGeometry(0.035, 8, 6), 0.1, 0.46, 0.25)), dark());
  const feet = new Mesh(
    merge(pair(() => new ConeGeometry(0.05, 0.1, 5), 0.09, 0.04, 0.05, Math.PI)),
    beakMat,
  );
  body.add(torso, wings, crest, beak, eyes, feet);
  root.add(createBlobShadow(0.3));

  let t = 0;
  return {
    root,
    materials: [down, flame, beakMat],
    update(dt, speed01, pose) {
      t += dt;
      body.position.y = Math.abs(Math.sin(t * 10 * (0.3 + speed01))) * 0.05;
      wings.scale.set(1, 1, 1);
      wings.rotation.z = Math.sin(t * 18) * 0.15 * (0.3 + speed01);
      beak.scale.set(1, 1, 1);
      if (pose.phase === 'windup') {
        // Telegraph: puff up, flap, beak glowing and opening.
        const k = easeOut(pose.t01);
        torso.scale.setScalar(1 + 0.18 * k);
        wings.rotation.z = Math.sin(t * 40) * 0.35 * k;
        flame.emissive.set(def.appearance.accent);
        flame.emissiveIntensity = k * 1.2;
      } else if (pose.phase === 'active') {
        torso.scale.setScalar(1.05);
        beak.scale.set(1.3, 1.3, 1.2); // fire breath (particles come from the scene)
      } else {
        torso.scale.setScalar(1);
        flame.emissiveIntensity = 0;
      }
      body.rotation.z = pose.staggered ? Math.sin(t * 20) * 0.3 : 0;
    },
  };
}

// ---------------------------------------------------------------- Mossback

function mossback(def: MonsterDef): Rig {
  const root = new Group();
  const body = new Group();
  root.add(body);
  const shellMat = createToonMaterial({ color: def.appearance.body });
  const mossMat = createToonMaterial({ color: def.appearance.accent });
  mossMat.emissive.set(def.appearance.accent);
  mossMat.emissiveIntensity = 0.5;
  const skinMat = createToonMaterial({ color: '#7f8f6a' });

  const shell = new Mesh(
    new SphereGeometry(0.42, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1.1),
    shellMat,
  );
  shell.name = 'mossback-shell';
  shell.position.y = 0.1;
  addOutline(shell, { smoothNormals: true });
  const moss = new Mesh(
    merge([
      placed(new SphereGeometry(0.12, 10, 6), 0.12, 0.38, 0.05),
      placed(new SphereGeometry(0.1, 10, 6), -0.14, 0.36, -0.08),
      placed(new SphereGeometry(0.09, 10, 6), 0.02, 0.4, -0.18),
      placed(new SphereGeometry(0.08, 10, 6), -0.05, 0.37, 0.2),
    ]),
    mossMat,
  );
  moss.name = 'mossback-moss';
  // Head, four stumpy legs and a tail — everything that pulls into the shell.
  const limbs = new Group();
  const limbMesh = new Mesh(
    merge([
      placed(new SphereGeometry(0.13, 14, 10), 0, 0.2, 0.46),
      ...pair(() => new CapsuleGeometry(0.07, 0.08, 4, 8), 0.3, 0.08, 0.25),
      ...pair(() => new CapsuleGeometry(0.07, 0.08, 4, 8), 0.3, 0.08, -0.25),
      placed(new ConeGeometry(0.06, 0.2, 6), 0, 0.12, -0.5, -Math.PI / 2),
    ]),
    skinMat,
  );
  limbMesh.name = 'mossback-limbs';
  addOutline(limbMesh, { thickness: 0.02 });
  const eyes = new Mesh(merge(pair(() => new SphereGeometry(0.025, 8, 6), 0.06, 0.26, 0.56)), dark());
  limbs.add(limbMesh, eyes);
  body.add(shell, moss, limbs);
  root.add(createBlobShadow(0.46));

  let t = 0;
  let tuck = 0;
  let spin = 0;
  return {
    root,
    materials: [shellMat, mossMat, skinMat],
    update(dt, speed01, pose) {
      t += dt;
      tuck += ((pose.guarding ? 1 : 0) - tuck) * Math.min(1, dt * 10);
      limbs.scale.setScalar(Math.max(0.01, 1 - tuck)); // pulls into the shell
      body.position.y = -0.06 * tuck + Math.abs(Math.sin(t * 5)) * 0.015 * speed01;
      mossMat.emissiveIntensity = 0.5 + Math.sin(t * 2) * 0.15 + tuck * 0.3;
      if (pose.phase === 'windup') {
        body.rotation.y = -0.5 * easeOut(pose.t01); // winds up the spin
      } else if (pose.phase === 'active') {
        spin = -0.5 + pose.t01 * Math.PI * 2;
        body.rotation.y = spin; // tail sweep all around
      } else {
        body.rotation.y *= 0.8;
      }
      body.rotation.z = pose.staggered ? Math.sin(t * 20) * 0.15 : 0;
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
  mossback,
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
