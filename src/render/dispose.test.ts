import { BoxGeometry, Group, InstancedMesh, MeshBasicMaterial } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeObject } from './dispose';

describe('disposeObject', () => {
  it('disposes InstancedMesh views too (frees their instance-matrix buffer)', () => {
    const root = new Group();
    const legs = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 4);
    root.add(legs);
    const onDispose = vi.fn();
    legs.addEventListener('dispose', onDispose);
    disposeObject(root);
    expect(onDispose).toHaveBeenCalledTimes(1);
  });
});
