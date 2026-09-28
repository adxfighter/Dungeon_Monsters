import { BoxGeometry, Color, CylinderGeometry, Group, InstancedMesh, Matrix4, SphereGeometry } from 'three';
import { Tile, type TileMap } from '@core/dungeon/TileMap';
import { createToonMaterial } from './materials/toon';
import { addOutline } from './outline';

/** Wall height, world units. Low enough that the ~52° camera sees the hero behind a south wall. */
export const WALL_HEIGHT = 0.8;
const FLOOR_THICKNESS = 0.2;

const FLOOR_COLOR_A = new Color(0x6b5a4a);
const FLOOR_COLOR_B = new Color(0x62523f);
const WALL_COLOR = 0x8a7a8f;
const MUSHROOM_STEM = 0xe8dcc8;
const MUSHROOM_CAP = 0x5fe0c8;

/**
 * Static room geometry from a TileMap: instanced floor tiles, instanced walls with outline,
 * glowing mushroom decor. Everything is instanced: ~7 draw calls regardless of room size.
 */
export class RoomView {
  readonly group = new Group();

  constructor(map: TileMap) {
    this.group.name = 'room';
    const floors: [number, number][] = [];
    const walls: [number, number][] = [];
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const tile = map.get(tx, ty);
        if (tile === Tile.Floor) floors.push([tx, ty]);
        else if (tile === Tile.Wall) walls.push([tx, ty]);
      }
    }

    const m = new Matrix4();

    // Floor: top face at y = 0, checkerboard tint via instance colours.
    const floor = new InstancedMesh(
      new BoxGeometry(1, FLOOR_THICKNESS, 1),
      createToonMaterial({ color: 0xffffff, rimStrength: 0 }),
      floors.length,
    );
    floor.name = 'room-floor';
    floors.forEach(([tx, ty], i) => {
      floor.setMatrixAt(i, m.makeTranslation(tx + 0.5, -FLOOR_THICKNESS / 2, ty + 0.5));
      floor.setColorAt(i, (tx + ty) % 2 === 0 ? FLOOR_COLOR_A : FLOOR_COLOR_B);
    });
    this.group.add(floor);

    const wall = new InstancedMesh(
      new BoxGeometry(1, WALL_HEIGHT, 1),
      createToonMaterial({ color: WALL_COLOR, rimStrength: 0 }),
      walls.length,
    );
    wall.name = 'room-walls';
    walls.forEach(([tx, ty], i) =>
      wall.setMatrixAt(i, m.makeTranslation(tx + 0.5, WALL_HEIGHT / 2, ty + 0.5)),
    );
    addOutline(wall, { smoothNormals: true, thickness: 0.03 });
    this.group.add(wall);

    const mushrooms = map.decor.filter((d) => d.kind === 'mushroom');
    if (mushrooms.length > 0) {
      const stems = new InstancedMesh(
        new CylinderGeometry(0.05, 0.07, 0.22, 8),
        createToonMaterial({ color: MUSHROOM_STEM, rimStrength: 0 }),
        mushrooms.length,
      );
      stems.name = 'decor-mushroom-stems';
      const capMaterial = createToonMaterial({ color: MUSHROOM_CAP, rimStrength: 0.2 });
      capMaterial.emissive.set(MUSHROOM_CAP);
      capMaterial.emissiveIntensity = 0.9;
      const caps = new InstancedMesh(
        new SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        capMaterial,
        mushrooms.length,
      );
      caps.name = 'decor-mushroom-caps';
      mushrooms.forEach((d, i) => {
        stems.setMatrixAt(i, m.makeTranslation(d.x, 0.11, d.y));
        caps.setMatrixAt(i, m.makeTranslation(d.x, 0.2, d.y));
      });
      addOutline(caps, { smoothNormals: true, thickness: 0.02 });
      this.group.add(stems, caps);
    }
  }
}
