import {
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  OctahedronGeometry,
  Quaternion,
  Vector3,
} from 'three';

const CAPACITY = 160;
const GRAVITY = 9;
const SIZE = 0.07;

/**
 * Pooled hit sparks / death bursts: one InstancedMesh (1 draw call), fixed capacity, the oldest particle is
 * recycled when full. Render-only randomness (Math.random is fine outside core).
 */
export class Particles {
  readonly mesh: InstancedMesh;
  private readonly px = new Float32Array(CAPACITY);
  private readonly py = new Float32Array(CAPACITY);
  private readonly pz = new Float32Array(CAPACITY);
  private readonly vx = new Float32Array(CAPACITY);
  private readonly vy = new Float32Array(CAPACITY);
  private readonly vz = new Float32Array(CAPACITY);
  private readonly life = new Float32Array(CAPACITY);
  private readonly maxLife = new Float32Array(CAPACITY);
  private next = 0;
  private alive = 0;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly p = new Vector3();
  private readonly s = new Vector3();
  private readonly color = new Color();

  constructor() {
    this.mesh = new InstancedMesh(
      new OctahedronGeometry(SIZE, 0),
      new MeshBasicMaterial({ color: 0xffffff }),
      CAPACITY,
    );
    this.mesh.name = 'particles';
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < CAPACITY; i++) this.mesh.setColorAt(i, this.color.set(0xffffff));
  }

  /** Emits `count` sparks at world (x, y, z) in `color`, flying up and out at `speed`. */
  burst(x: number, y: number, z: number, color: number, count: number, speed = 3): void {
    this.color.set(color);
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % CAPACITY;
      const a = Math.random() * Math.PI * 2;
      const up = 0.4 + Math.random() * 0.8;
      const sp = speed * (0.5 + Math.random() * 0.5);
      this.px[i] = x;
      this.py[i] = y;
      this.pz[i] = z;
      this.vx[i] = Math.cos(a) * sp;
      this.vy[i] = up * sp;
      this.vz[i] = Math.sin(a) * sp;
      const l = 0.35 + Math.random() * 0.25;
      this.life[i] = l;
      this.maxLife[i] = l;
      this.mesh.setColorAt(i, this.color);
    }
    this.alive = Math.min(CAPACITY, this.alive + count);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** Emits one particle with an explicit velocity (directional effects such as fire breath). */
  emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    color: number,
    life: number,
  ): void {
    const i = this.next;
    this.next = (this.next + 1) % CAPACITY;
    this.px[i] = x;
    this.py[i] = y;
    this.pz[i] = z;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.mesh.setColorAt(i, this.color.set(color));
    this.alive = Math.min(CAPACITY, this.alive + 1);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dtSeconds: number): void {
    if (this.alive === 0) return;
    let any = false;
    for (let i = 0; i < CAPACITY; i++) {
      const life = this.life[i] ?? 0;
      if (life <= 0) {
        this.m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this.m);
        continue;
      }
      any = true;
      const nl = life - dtSeconds;
      this.life[i] = nl;
      this.vy[i] = (this.vy[i] ?? 0) - GRAVITY * dtSeconds;
      this.px[i] = (this.px[i] ?? 0) + (this.vx[i] ?? 0) * dtSeconds;
      this.py[i] = Math.max(0.02, (this.py[i] ?? 0) + (this.vy[i] ?? 0) * dtSeconds);
      this.pz[i] = (this.pz[i] ?? 0) + (this.vz[i] ?? 0) * dtSeconds;
      const k = Math.max(0, nl / (this.maxLife[i] || 1));
      this.p.set(this.px[i] ?? 0, this.py[i] ?? 0, this.pz[i] ?? 0);
      this.s.setScalar(k);
      this.mesh.setMatrixAt(i, this.m.compose(this.p, this.q, this.s));
    }
    this.mesh.count = any ? CAPACITY : 0;
    if (!any) this.alive = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
  }
}
