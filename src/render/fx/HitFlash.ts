import { Color, type MeshToonMaterial } from 'three';

/** Flash length, seconds. */
const FLASH_S = 0.12;
const WHITE = new Color(0xffffff);

/**
 * White hit flash (M2 readability): pushes the materials' emissive toward white and fades back to their
 * own emissive (e.g. glowing quills). No allocation per hit.
 */
export class HitFlash {
  private readonly materials: readonly MeshToonMaterial[];
  private readonly baseColor: Color[];
  private readonly baseIntensity: number[];
  private t = 0;

  constructor(materials: readonly MeshToonMaterial[]) {
    this.materials = materials;
    this.baseColor = materials.map((m) => m.emissive.clone());
    this.baseIntensity = materials.map((m) => m.emissiveIntensity);
  }

  trigger(): void {
    this.t = FLASH_S;
  }

  /** Call every frame after the rig animation (which may itself animate emissive intensity). */
  update(dtSeconds: number): void {
    if (this.t <= 0) return;
    this.t = Math.max(0, this.t - dtSeconds);
    const k = this.t / FLASH_S;
    this.materials.forEach((m, i) => {
      const base = this.baseColor[i];
      if (!base) return;
      m.emissive.copy(base).lerp(WHITE, k);
      m.emissiveIntensity = Math.max(m.emissiveIntensity, (this.baseIntensity[i] ?? 0) + k * 0.9);
      if (this.t === 0) {
        m.emissive.copy(base);
        m.emissiveIntensity = this.baseIntensity[i] ?? 0;
      }
    });
  }
}
