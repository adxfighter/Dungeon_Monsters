import { type BufferGeometry, InstancedMesh, type Material, Object3D } from 'three';

export type Hip = readonly [number, number, number];

export interface SpreadOptions {
  /** Direction of each leg around the body, radians about Y (0 = the leg points to +X). */
  yaws: readonly number[];
  /** How high the tip lifts on the forward swing, radians. */
  lift: number;
}

/**
 * Walking legs: one InstancedMesh (1 draw call), one instance per leg, animated from the movement speed.
 * - Hanging legs (quadrupeds, bipeds): the geometry hangs down from its hip (−Y) and swings about X.
 * - Spread legs (`spread`: bugs, tentacles): the geometry points along +X from its hip; each leg is turned to its
 *   `yaw`, sweeps forward and back about Y and lifts its tip on the forward swing (a tripod gait for insects, a
 *   travelling wave for tentacles — set by `phases`).
 * `phases` offsets the gait per leg (diagonal pairs for quadrupeds, opposite for bipeds).
 */
export class Legs {
  readonly mesh: InstancedMesh;
  private readonly dummy = new Object3D();
  private clock = 0;
  private readonly hips: readonly Hip[];
  private readonly phases: readonly number[];
  private readonly stride: number;
  private readonly spread: SpreadOptions | undefined;

  constructor(
    geometry: BufferGeometry,
    material: Material,
    hips: readonly Hip[],
    phases: readonly number[],
    stride: number,
    spread?: SpreadOptions,
  ) {
    this.hips = hips;
    this.phases = phases;
    this.stride = stride;
    this.spread = spread;
    this.dummy.rotation.order = 'YXZ'; // yaw first, then the leg's own swing/lift
    this.mesh = new InstancedMesh(geometry, material, hips.length);
    this.mesh.frustumCulled = false; // instances move around their hips; the default bounds would clip them
    this.update(0, 0, 0);
  }

  /**
   * `speed01` drives the stride; `cadence` is steps per second at full speed; `bend` adds a pose-driven tilt
   * (about X for hanging legs, a lift for spread legs). `idle` keeps a little motion while standing (tentacles).
   */
  update(dt: number, speed01: number, bend: number, cadence = 7, idle = 0): void {
    const move = Math.min(2, speed01);
    this.clock += dt * cadence * (0.3 + move);
    const amount = Math.max(idle, Math.min(1, move));
    for (let i = 0; i < this.hips.length; i++) {
      const [x, y, z] = this.hips[i] ?? [0, 0, 0];
      const a = this.clock + (this.phases[i] ?? 0);
      this.dummy.position.set(x, y, z);
      if (this.spread) {
        const yaw = this.spread.yaws[i] ?? 0;
        // A leg pointing right sweeps its tip forward by turning clockwise (−Y); a left leg — the other way.
        const forward = Math.cos(yaw) >= 0 ? -1 : 1;
        this.dummy.rotation.set(
          0,
          yaw + forward * Math.sin(a) * this.stride * amount,
          Math.max(0, Math.cos(a)) * this.spread.lift * amount + bend,
        );
      } else {
        this.dummy.rotation.set(Math.sin(a) * this.stride * amount + bend, 0, 0);
      }
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
