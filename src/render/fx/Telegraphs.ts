import { type BufferGeometry, CircleGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { AttackDef } from '@content/schemas';
import type { Entity } from '@core/ecs/World';

const DEG = Math.PI / 180;
/** Floor decal height (above blob shadows, below the target ring). */
const Y = 0.012;
const COLOR = 0xff5a3c;
/** Extra width for projectile lanes so their edges read as danger. */
const LANE_MARGIN = 0.08;

/** Flat geometry on the floor plane (XZ), pointing along local +Z from the attacker. */
export function footprint(def: AttackDef): BufferGeometry {
  const lungeDist = (def.lungeSpeed ?? 0) * def.active;
  if (def.projectile) {
    // One lane per projectile across the fan.
    const p = def.projectile;
    const lanes: BufferGeometry[] = [];
    for (let i = 0; i < p.count; i++) {
      const a = p.count === 1 ? 0 : (i / (p.count - 1) - 0.5) * p.spreadDeg * DEG;
      const lane = new PlaneGeometry(p.radius * 2 + LANE_MARGIN, p.range).rotateX(-Math.PI / 2);
      lane.translate(0, 0, p.range / 2).rotateY(a);
      lanes.push(lane);
    }
    const merged = mergeGeometries(lanes);
    for (const l of lanes) l.dispose();
    if (!merged) throw new Error('telegraph: merge failed');
    return merged;
  }
  const shape = def.shape;
  if (!shape) throw new Error(`telegraph: attack ${def.id} has no shape`);
  switch (shape.kind) {
    case 'circle': {
      if (lungeDist > 0) {
        // Lunge: the whole path the hit circle sweeps.
        const length = lungeDist + shape.offset + shape.radius;
        return new PlaneGeometry(shape.radius * 2, length).rotateX(-Math.PI / 2).translate(0, 0, length / 2);
      }
      return new CircleGeometry(shape.radius, 32).rotateX(-Math.PI / 2).translate(0, 0, shape.offset);
    }
    case 'cone': {
      const half = (shape.angleDeg / 2) * DEG;
      // CircleGeometry sweeps from +X counter-clockwise; after rotating onto the floor, centre it on +Z.
      return new CircleGeometry(shape.range + lungeDist, 32, Math.PI / 2 - half, 2 * half)
        .rotateX(-Math.PI / 2)
        .rotateY(Math.PI);
    }
    case 'line':
      return new PlaneGeometry(shape.width, shape.length + lungeDist)
        .rotateX(-Math.PI / 2)
        .translate(0, 0, (shape.length + lungeDist) / 2);
  }
}

interface Decal {
  group: Group;
  base: Mesh;
  fill: Mesh;
}

/**
 * Enemy attack telegraphs (M2 readability): during the windup a red footprint of the attack's area lies on
 * the floor and a brighter copy grows from the attacker until the hit lands. Geometry is cached per attack,
 * decals are pooled per entity: 2 draw calls per telegraphing enemy, nothing allocated per attack.
 */
export class Telegraphs {
  readonly group = new Group();
  private readonly geometry = new Map<string, BufferGeometry>();
  private readonly decals = new Map<Entity, Decal>();
  private readonly baseMaterial = new MeshBasicMaterial({
    color: COLOR,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  private readonly fillMaterial = new MeshBasicMaterial({
    color: COLOR,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  private readonly seen = new Set<Entity>();

  constructor() {
    this.group.name = 'telegraphs';
  }

  /** Call once per frame before `show` calls. */
  begin(): void {
    this.seen.clear();
  }

  /** Shows `entity`'s windup of `def` at (x, y) facing (dirX, dirY), `t01` = windup progress. */
  show(entity: Entity, def: AttackDef, x: number, y: number, dirX: number, dirY: number, t01: number): void {
    let geometry = this.geometry.get(def.id);
    if (!geometry) {
      geometry = footprint(def);
      this.geometry.set(def.id, geometry);
    }
    let decal = this.decals.get(entity);
    if (!decal) {
      const group = new Group();
      const base = new Mesh(geometry, this.baseMaterial);
      const fill = new Mesh(geometry, this.fillMaterial);
      base.renderOrder = 1;
      fill.renderOrder = 1;
      group.add(base, fill);
      this.group.add(group);
      decal = { group, base, fill };
      this.decals.set(entity, decal);
    }
    decal.base.geometry = geometry;
    decal.fill.geometry = geometry;
    decal.group.visible = true;
    decal.group.position.set(x, Y, y);
    decal.group.rotation.y = Math.atan2(dirX, dirY);
    // Grows from the attacker; fully covered = the hit lands now.
    const k = Math.max(0.02, Math.min(1, t01));
    decal.fill.scale.set(k, 1, k);
    this.seen.add(entity);
  }

  /** Hides decals not shown this frame and drops those of removed entities. */
  end(isAlive: (e: Entity) => boolean): void {
    for (const [entity, decal] of this.decals) {
      if (this.seen.has(entity)) continue;
      decal.group.visible = false;
      if (!isAlive(entity)) {
        this.group.remove(decal.group);
        this.decals.delete(entity);
      }
    }
  }

  dispose(): void {
    for (const g of this.geometry.values()) g.dispose();
    this.geometry.clear();
    this.baseMaterial.dispose();
    this.fillMaterial.dispose();
    this.decals.clear();
    this.group.clear();
  }
}
