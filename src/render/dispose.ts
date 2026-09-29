import { type BufferGeometry, InstancedMesh, type Material, Mesh, type Object3D, Texture } from 'three';

/**
 * Disposes every geometry, material and material texture under `root` (each once), and every InstancedMesh (its
 * instance-matrix GPU buffer is freed only by the mesh's own dispose event).
 */
export function disposeObject(root: Object3D): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const instanced: InstancedMesh[] = [];
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    if (object instanceof InstancedMesh) instanced.push(object);
    geometries.add(object.geometry);
    const list: Material[] = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) materials.add(material);
  });
  for (const mesh of instanced) mesh.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof Texture) value.dispose();
    }
    material.dispose();
  }
}
