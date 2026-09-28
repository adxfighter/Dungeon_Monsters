import { Color, DirectionalLight, HemisphereLight, Scene } from 'three';
import { Velocity } from '@core/components';
import type { Game } from '@core/Game';
import type { GameEvent } from '@core/state/events';
import { CameraRig } from '../CameraRig';
import { disposeObject } from '../dispose';
import { EntityViews } from '../EntityViews';
import { RoomView } from '../RoomView';

const BACKGROUND = 0x1f1a2b;

/** M1 play scene: one tile room, the hero and a follow camera. Reads core state, never writes it. */
export class RoomScene {
  readonly scene = new Scene();
  readonly rig: CameraRig;
  private readonly entities = new EntityViews();
  private readonly room: RoomView;
  private readonly game: Game;
  private readonly focus = { x: 0, y: 0 };

  constructor(game: Game) {
    this.game = game;
    this.scene.background = new Color(BACKGROUND);

    const hemi = new HemisphereLight(0xfff0dc, 0x3a2f4a, 0.7);
    const sun = new DirectionalLight(0xfff6e8, 2.6);
    sun.position.set(3, 6, 2);
    this.scene.add(hemi, sun);

    this.room = new RoomView(game.map);
    this.scene.add(this.room.group, this.entities.group);
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
  }

  dispose(): void {
    this.entities.dispose();
    disposeObject(this.scene);
    this.scene.clear();
  }
}
