import { Color, DirectionalLight, HemisphereLight, Plane, Raycaster, Scene, Vector2, Vector3 } from 'three';
import { MoveTarget, Velocity } from '@core/components';
import type { Game } from '@core/Game';
import type { GameEvent } from '@core/state/events';
import { CameraRig } from '../CameraRig';
import { disposeObject } from '../dispose';
import { EntityViews } from '../EntityViews';
import { RoomView } from '../RoomView';
import { TargetMarker } from '../TargetMarker';

const BACKGROUND = 0x1f1a2b;

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

  constructor(game: Game) {
    this.game = game;
    this.scene.background = new Color(BACKGROUND);

    const hemi = new HemisphereLight(0xfff0dc, 0x3a2f4a, 0.7);
    const sun = new DirectionalLight(0xfff6e8, 2.6);
    sun.position.set(3, 6, 2);
    this.scene.add(hemi, sun);

    this.room = new RoomView(game.map);
    this.scene.add(this.room.group, this.entities.group, this.marker.mesh);
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
    disposeObject(this.scene);
    this.scene.clear();
  }
}
