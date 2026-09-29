import { InstancedMesh, Mesh, MeshBasicMaterial, PlaneGeometry, type Object3D } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { monsters } from '@content/index';
import { createMonster } from './monsters';
import type { Pose } from './pose';

// The blob shadow draws its gradient on a 2D canvas (no DOM in unit tests): a plain quad counts the same.
vi.mock('./blobShadow', () => ({
  createBlobShadow: () => new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial()),
}));

/** Every mesh is one draw call (outlines are separate meshes; an InstancedMesh — legs — is one call too). */
function drawCalls(root: Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (o instanceof Mesh) n++;
  });
  return n;
}

describe('monster models', () => {
  for (const def of Object.values(monsters)) {
    it(`${def.id}: at most 6 draw calls (M2 budget, outline and shadow included)`, () => {
      const n = drawCalls(createMonster(def).root);
      expect(n).toBeLessThanOrEqual(6);
    });
  }
});

const REST: Pose = {
  phase: 'none',
  t01: 0,
  whiffed: false,
  guarding: false,
  staggered: false,
  hidden: false,
  eating: false,
  attackId: '',
  holdDist: 0,
  life01: 1,
  element: '',
  weapon: '',
};

/** Leg instance matrices after a few frames at the given speed. */
function legFrames(id: string, speed01: number): number[][] {
  const def = monsters[id];
  if (!def) throw new Error(id);
  const rig = createMonster(def);
  const legs = rig.root.getObjectByName(`${id}-legs`);
  if (!(legs instanceof InstancedMesh)) throw new Error(`${id}: no walking legs`);
  const frames: number[][] = [];
  for (let i = 0; i < 6; i++) {
    rig.update(1 / 20, speed01, REST);
    frames.push(Array.from(legs.instanceMatrix.array));
  }
  return frames;
}

describe('walking legs (user, playtest: legs must move while walking)', () => {
  for (const id of ['skunk', 'yak', 'dinostrich', 'bonegnaw', 'decapus']) {
    it(`${id}: legs step while it walks`, () => {
      const frames = legFrames(id, 1);
      expect(new Set(frames.map((f) => f.join(','))).size).toBeGreaterThan(3);
    });
  }
  for (const id of ['skunk', 'yak', 'dinostrich', 'bonegnaw']) {
    it(`${id}: legs are still when it stands`, () => {
      const frames = legFrames(id, 0);
      expect(new Set(frames.map((f) => f.join(','))).size).toBe(1);
    });
  }
});
