import { Mesh, MeshBasicMaterial, PlaneGeometry, type Object3D } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { monsters } from '@content/index';
import { createMonster } from './monsters';

// The blob shadow draws its gradient on a 2D canvas (no DOM in unit tests): a plain quad counts the same.
vi.mock('./blobShadow', () => ({
  createBlobShadow: () => new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial()),
}));

/** Every mesh is one draw call (outlines are separate meshes; nothing here is instanced). */
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
