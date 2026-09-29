import { describe, expect, it } from 'vitest';
import { CameraRig } from './CameraRig';

describe('CameraRig shake', () => {
  it('a paused frame (dt = 0) keeps the camera still even mid-shake', () => {
    const rig = new CameraRig({ minX: 0, minY: 0, maxX: 20, maxY: 20 });
    rig.setAspect(390, 844);
    rig.update(1 / 60, 10, 10, 0, 0);
    rig.shake(0.35, 0.3);
    rig.update(1 / 60, 10, 10, 0, 0);
    const a = rig.camera.position.clone();
    rig.update(0, 10, 10, 0, 0);
    rig.update(0, 10, 10, 0, 0);
    expect(rig.camera.position.equals(a)).toBe(true);
  });

  it('the shake ends and the offset goes back to zero', () => {
    const rig = new CameraRig({ minX: 0, minY: 0, maxX: 20, maxY: 20 });
    rig.setAspect(390, 844);
    rig.update(1 / 60, 10, 10, 0, 0);
    const rest = rig.camera.position.clone();
    rig.shake(0.35, 0.3);
    for (let i = 0; i < 30; i++) rig.update(1 / 60, 10, 10, 0, 0);
    expect(rig.camera.position.distanceTo(rest)).toBeLessThan(1e-9);
  });
});
