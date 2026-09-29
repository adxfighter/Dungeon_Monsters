import { Color, DirectionalLight, HemisphereLight, Plane, Raycaster, Scene, Vector2, Vector3 } from 'three';
import { Attacker, Brain, MoveTarget, Transform, Velocity } from '@core/components';
import type { Game } from '@core/Game';
import type { Entity } from '@core/ecs/World';
import type { GameEvent } from '@core/state/events';
import { CameraRig } from '../CameraRig';
import { disposeObject } from '../dispose';
import { EntityViews } from '../EntityViews';
import { RoomView } from '../RoomView';
import { TargetMarker } from '../TargetMarker';
import { Particles } from '../fx/Particles';
import { Telegraphs } from '../fx/Telegraphs';
import type { Element } from '@content/schemas';

const BACKGROUND = 0x1f1a2b;

/** Spark colour per damage element; blocked hits spark grey. */
const ELEMENT_SPARK: Readonly<Record<Element, number>> = {
  slash: 0xfff4e0,
  blunt: 0xffc07a,
  fire: 0xff7a2e,
  cold: 0x9ee7ff,
};
const BLOCK_SPARK = 0xb8b0c0;
/** Embers per second per breathing monster. */
const FIRE_RATE = 70;
const FIRE_A = 0xff7a2e;
const FIRE_B = 0xffd23f;
/** Height (world units) where hit sparks appear. */
const HIT_HEIGHT = 0.45;

/** M1 play scene: one tile room, the hero and a follow camera. Reads core state, never writes it. */
export class RoomScene {
  readonly scene = new Scene();
  readonly rig: CameraRig;
  private readonly entities = new EntityViews();
  private readonly room: RoomView;
  private readonly game: Game;
  private readonly focus = { x: 0, y: 0 };
  private readonly marker = new TargetMarker();
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly ground = new Plane(new Vector3(0, 1, 0), 0);
  private readonly hit = new Vector3();
  private readonly telegraphs = new Telegraphs();
  private readonly particles = new Particles();
  private fireAcc = 0;
  private readonly scratch = { x: 0, y: 0 };

  constructor(game: Game) {
    this.game = game;
    this.scene.background = new Color(BACKGROUND);

    const hemi = new HemisphereLight(0xfff0dc, 0x3a2f4a, 0.7);
    const sun = new DirectionalLight(0xfff6e8, 2.6);
    sun.position.set(3, 6, 2);
    this.scene.add(hemi, sun);

    this.room = new RoomView(game.map);
    this.scene.add(
      this.room.group,
      this.entities.group,
      this.marker.mesh,
      this.telegraphs.group,
      this.particles.mesh,
    );
    this.rig = new CameraRig({ minX: 0, minY: 0, maxX: game.map.width, maxY: game.map.height });
  }

  get camera(): CameraRig['camera'] {
    return this.rig.camera;
  }

  setAspect(width: number, height: number): void {
    this.rig.setAspect(width, height);
  }

  handleEvents(events: readonly GameEvent[]): void {
    this.entities.handle(events);
    for (const e of events) {
      if (e.type === 'DamageDealt') {
        if (!e.blocked) this.entities.flash(e.target);
        const color = e.blocked ? BLOCK_SPARK : ELEMENT_SPARK[e.element];
        this.particles.burst(e.x, HIT_HEIGHT, e.y, color, e.crit || e.staggered ? 12 : 7, e.crit ? 4 : 3);
      } else if (e.type === 'MonsterKilled') {
        this.particles.burst(e.x, HIT_HEIGHT, e.y, 0xfff4e0, 18, 4.5);
      }
    }
  }

  /** Interpolated ground position of an entity's view (for world-anchored UI). */
  positionOf(entity: Entity, out: { x: number; y: number }): boolean {
    return this.entities.positionOf(entity, out);
  }

  /** Camera shake (see CameraRig.shake); respects the player's setting. */
  shake(amplitude: number, duration: number): void {
    this.rig.shake(amplitude, duration);
  }

  set shakeEnabled(enabled: boolean) {
    this.rig.shakeEnabled = enabled;
  }

  /** World point (x, height, y) → normalized device coordinates; z > 1 means behind the camera. */
  worldToScreen(x: number, height: number, y: number, out: { x: number; y: number }): boolean {
    this.hit.set(x, height, y).project(this.camera);
    out.x = this.hit.x;
    out.y = this.hit.y;
    return this.hit.z < 1;
  }

  update(alpha: number, dtSeconds: number): void {
    this.entities.sync(this.game.world, alpha, dtSeconds);
    const pos = this.focus;
    if (this.entities.positionOf(this.game.player, pos)) {
      const v = this.game.world.get(this.game.player, Velocity);
      this.rig.update(dtSeconds, pos.x, pos.y, v?.x ?? 0, v?.y ?? 0);
    }
    const target = this.game.world.get(this.game.player, MoveTarget);
    this.marker.update(dtSeconds, target?.active ?? false, target?.x ?? 0, target?.y ?? 0);

    // Enemy telegraphs: every monster in its windup shows the attack's footprint on the floor.
    const { world } = this.game;
    this.telegraphs.begin();
    for (const e of world.query(Brain, Attacker, Transform)) {
      const cur = world.require(e, Attacker).current;
      if (!cur || cur.phase !== 'windup') continue;
      if (!this.entities.positionOf(e, this.scratch)) continue;
      const t01 = cur.def.windup > 0 ? cur.t / cur.def.windup : 1;
      this.telegraphs.show(e, cur.def, this.scratch.x, this.scratch.y, cur.dirX, cur.dirY, t01);
    }
    this.telegraphs.end((e) => world.isAlive(e));

    // Fire breath: a stream of embers along the attack direction during the active phase. Emission is timed
    // (FIRE_RATE per second, not per frame), so the density does not depend on the display refresh rate.
    this.fireAcc = Math.min(this.fireAcc + dtSeconds * FIRE_RATE, 4);
    const fireCount = Math.floor(this.fireAcc);
    this.fireAcc -= fireCount;
    for (const e of world.query(Brain, Attacker, Transform)) {
      const cur = world.require(e, Attacker).current;
      if (!cur || cur.phase !== 'active' || cur.def.element !== 'fire' || !cur.def.shape) continue;
      if (!this.entities.positionOf(e, this.scratch)) continue;
      const range = cur.def.shape.kind === 'cone' ? cur.def.shape.range : 1.5;
      for (let i = 0; i < fireCount; i++) {
        const spread = (Math.random() - 0.5) * 0.5;
        const dx = cur.dirX + -cur.dirY * spread;
        const dy = cur.dirY + cur.dirX * spread;
        const speed = range * (2.2 + Math.random());
        this.particles.emit(
          this.scratch.x + cur.dirX * 0.3,
          0.4,
          this.scratch.y + cur.dirY * 0.3,
          dx * speed,
          1.2,
          dy * speed,
          Math.random() < 0.5 ? FIRE_A : FIRE_B,
          0.35,
        );
      }
    }
    this.particles.update(dtSeconds);
  }

  /**
   * Projects a point in normalized device coordinates (-1..1, y up) onto the floor plane.
   * Writes simulation-space (x, y) into `out`; false if the ray misses the floor.
   */
  screenToGround(ndcX: number, ndcY: number, out: { x: number; y: number }): boolean {
    this.ndc.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.ground, this.hit)) return false;
    out.x = this.hit.x;
    out.y = this.hit.z;
    return true;
  }

  /** Simulation point → normalized device coordinates (for tests and debug). */
  groundToScreen(x: number, y: number, out: { x: number; y: number }): void {
    this.hit.set(x, 0, y).project(this.camera);
    out.x = this.hit.x;
    out.y = this.hit.y;
  }

  dispose(): void {
    this.entities.dispose();
    this.telegraphs.dispose();
    this.particles.dispose();
    disposeObject(this.scene);
    this.scene.clear();
  }
}
