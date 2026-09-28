import { type BufferGeometry, type Material, Mesh, type Object3D, Texture } from 'three';

/** Disposes every geometry, material and material texture under `root` (each once). */
export function disposeObject(root: Object3D): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    const list: Material[] = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof Texture) value.dispose();
    }
    material.dispose();
  }
}
