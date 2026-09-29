import { Mesh, MeshBasicMaterial, RingGeometry } from 'three';

const COLOR = 0xfff4e0;
const PULSE_RATE = 6;
const PULSE_AMOUNT = 0.12;

/** Ground ring showing where a tap sent the hero. One draw call; hidden when there is no target. */
export class TargetMarker {
  readonly mesh: Mesh;
  private time = 0;

  constructor() {
    this.mesh = new Mesh(
      new RingGeometry(0.16, 0.24, 32),
      new MeshBasicMaterial({ color: COLOR, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    this.mesh.name = 'target-marker';
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.01;
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
  }

  update(dtSeconds: number, active: boolean, x: number, y: number): void {
    this.mesh.visible = active;
    if (!active) {
      this.time = 0;
      return;
    }
    this.time += dtSeconds;
    this.mesh.position.x = x;
    this.mesh.position.z = y;
    this.mesh.scale.setScalar(1 + Math.sin(this.time * PULSE_RATE) * PULSE_AMOUNT);
  }
}
