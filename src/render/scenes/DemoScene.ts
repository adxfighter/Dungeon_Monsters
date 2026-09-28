import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  TorusKnotGeometry,
} from 'three';
import { disposeObject } from '../dispose';
import { createToonMaterial } from '../materials/toon';
import { addOutline } from '../outline';

/** Rotation speed of the showcase objects, rad/s. */
const SPIN_SPEED = 0.6;
const LANDSCAPE_V_FOV_DEG = 45;
const PORTRAIT_H_FOV_DEG = 60;

/**
 * M0 style test: floor, three coloured primitives and a chibi dummy (sphere head + capsule body),
 * toon-shaded with rim light and inverted-hull outlines.
 */
export class DemoScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(LANDSCAPE_V_FOV_DEG, 1, 0.1, 100);
  private readonly spinning: Mesh[] = [];
  private readonly chibi = new Group();
  private time = 0;

  constructor() {
    this.scene.background = new Color(0x2b2438);
    this.camera.position.set(0, 3.4, 5.6);
    this.camera.lookAt(0, 0.7, 0);

    const hemi = new HemisphereLight(0xfff4e0, 0x4a3b5c, 0.5);
    const sun = new DirectionalLight(0xffffff, 3);
    sun.position.set(4, 5, 2);
    this.scene.add(hemi, sun);

    const floor = new Mesh(
      new CylinderGeometry(2.8, 2.8, 0.2, 48),
      createToonMaterial({ color: 0x6b5a4a, rimStrength: 0 }),
    );
    floor.name = 'floor';
    floor.position.y = -0.1;
    addOutline(floor, { thickness: 0.04, smoothNormals: true });
    this.scene.add(floor);

    this.addSpinning('box', new BoxGeometry(0.9, 0.9, 0.9), 0xe0584f, -1.6, 0.45, 0.5, true);
    this.addSpinning('knot', new TorusKnotGeometry(0.4, 0.14, 96, 12), 0x4fa3e0, 1.6, 0.75, 0.5, false);
    this.addSpinning('cone', new ConeGeometry(0.5, 1.1, 24), 0x7fcf5a, -0.9, 0.55, -1.4, true);

    this.buildChibi();
    this.scene.add(this.chibi);
  }

  private addSpinning(
    name: string,
    geometry: BoxGeometry | TorusKnotGeometry | ConeGeometry,
    color: number,
    x: number,
    y: number,
    z: number,
    smoothOutline: boolean,
  ): void {
    const mesh = new Mesh(geometry, createToonMaterial({ color }));
    mesh.name = name;
    mesh.position.set(x, y, z);
    addOutline(mesh, { smoothNormals: smoothOutline });
    this.scene.add(mesh);
    this.spinning.push(mesh);
  }

  /** Placeholder chibi proportions: big head (~40% of height), small body. */
  private buildChibi(): void {
    const body = new Mesh(new CapsuleGeometry(0.32, 0.4, 6, 16), createToonMaterial({ color: 0xf2c14e }));
    body.name = 'chibi-body';
    body.position.y = 0.62;
    addOutline(body);

    const head = new Mesh(new SphereGeometry(0.46, 32, 16), createToonMaterial({ color: 0xffd9c2 }));
    head.name = 'chibi-head';
    head.position.y = 1.5;
    addOutline(head);

    this.chibi.name = 'chibi';
    this.chibi.position.set(0, 0, 0.6);
    this.chibi.add(body, head);
  }

  setAspect(width: number, height: number): void {
    this.camera.aspect = width / height;
    // Portrait: keep a fixed horizontal FOV so the whole stage fits a narrow screen.
    const halfH = (PORTRAIT_H_FOV_DEG * Math.PI) / 360;
    this.camera.fov =
      this.camera.aspect < 1
        ? (360 / Math.PI) * Math.atan(Math.tan(halfH) / this.camera.aspect)
        : LANDSCAPE_V_FOV_DEG;
    this.camera.updateProjectionMatrix();
  }

  update(dtSeconds: number): void {
    this.time += dtSeconds;
    for (const mesh of this.spinning) {
      mesh.rotation.y += SPIN_SPEED * dtSeconds;
      mesh.rotation.x += SPIN_SPEED * 0.5 * dtSeconds;
    }
    this.chibi.rotation.y = Math.sin(this.time * 0.8) * 0.9;
    this.chibi.position.y = Math.abs(Math.sin(this.time * 3)) * 0.08;
  }

  dispose(): void {
    disposeObject(this.scene);
    this.scene.clear();
  }
}
