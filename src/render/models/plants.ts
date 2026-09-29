import { ConeGeometry, CylinderGeometry, type BufferGeometry, Group, Mesh, SphereGeometry } from 'three';
import { addOutline } from '../outline';
import { merge, painted, part } from './beasts';
import type { Rig } from './pose';

/**
 * Gatherable plants and fungi (M3), one merged vertex-coloured mesh each (+ outline): 2 draw calls per plant.
 * They sway gently so they read as "something to pick" next to the static mushroom decor.
 */
function shapes(ingredientId: string): BufferGeometry[] {
  switch (ingredientId) {
    case 'glowcap':
      // A cluster of glowing lime caps (the cyan mushrooms on the floor are decor, not loot).
      return [
        part(new CylinderGeometry(0.03, 0.04, 0.22, 8), '#e8e0d0', 0, 0.11, 0),
        part(new SphereGeometry(0.12, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#b8f060', 0, 0.2, 0),
        part(new CylinderGeometry(0.02, 0.03, 0.14, 8), '#e8e0d0', 0.12, 0.07, 0.06),
        part(new SphereGeometry(0.08, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#cdf57e', 0.12, 0.13, 0.06),
      ];
    case 'pepper_puffball':
      // Round red puffballs with pale spots.
      return [
        part(new SphereGeometry(0.1, 12, 8), '#d8452f', 0, 0.09, 0),
        part(new SphereGeometry(0.07, 10, 6), '#e2583c', 0.12, 0.06, 0.04),
        part(new SphereGeometry(0.06, 10, 6), '#c93a28', -0.1, 0.05, 0.06),
        part(new SphereGeometry(0.02, 6, 4), '#f7e6c8', 0.03, 0.18, 0.04),
        part(new SphereGeometry(0.018, 6, 4), '#f7e6c8', 0.14, 0.12, 0.08),
      ];
    case 'sour_root':
      // A tuft of leaves with the orange root top showing.
      return [
        part(new ConeGeometry(0.07, 0.12, 10), '#e0823a', 0, 0.05, 0, Math.PI),
        part(new ConeGeometry(0.03, 0.22, 5), '#5caa3c', 0.02, 0.2, 0, 0, 0, -0.3),
        part(new ConeGeometry(0.03, 0.2, 5), '#6dbb48', -0.03, 0.19, 0.02, 0, 0, 0.35),
        part(new ConeGeometry(0.03, 0.18, 5), '#4f9a33', 0, 0.18, -0.03, -0.3),
      ];
    case 'cave_onion':
      // A pale bulb with tall green stalks.
      return [
        part(new SphereGeometry(0.1, 12, 8).scale(1, 0.9, 1), '#eadbe8', 0, 0.08, 0),
        part(new ConeGeometry(0.035, 0.14, 8), '#eadbe8', 0, 0.2, 0),
        part(new CylinderGeometry(0.012, 0.016, 0.3, 5), '#6dbb48', 0.03, 0.3, 0, 0, 0, -0.15),
        part(new CylinderGeometry(0.012, 0.016, 0.28, 5), '#5caa3c', -0.03, 0.29, 0.02, 0, 0, 0.18),
      ];
    default:
      // honey_moss: a low golden mound with a few tufts.
      return [
        part(
          new SphereGeometry(0.16, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 1),
          '#d8b23e',
          0,
          0,
          0,
        ),
        part(new SphereGeometry(0.05, 8, 6), '#f0cf55', 0.07, 0.06, 0.03),
        part(new SphereGeometry(0.045, 8, 6), '#c49a2e', -0.06, 0.05, -0.04),
      ];
  }
}

export function createPlant(ingredientId: string): Rig {
  const root = new Group();
  root.name = `plant:${ingredientId}`;
  const mat = painted();
  if (ingredientId === 'glowcap') {
    mat.emissive.set('#7ac23a');
    mat.emissiveIntensity = 0.45;
  }
  const mesh = new Mesh(merge(shapes(ingredientId)), mat);
  mesh.name = 'plant-body';
  addOutline(mesh, { thickness: 0.015 });
  root.add(mesh);
  let t = Math.random() * 10; // render-only: desync the sway of neighbouring plants
  return {
    root,
    materials: [mat],
    update(dt) {
      t += dt;
      mesh.rotation.z = Math.sin(t * 1.7) * 0.06;
      mesh.rotation.x = Math.sin(t * 1.3 + 1) * 0.05;
    },
  };
}
