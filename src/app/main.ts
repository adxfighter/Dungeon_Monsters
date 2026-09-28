import './style.css';
import { FixedClock } from '@core/clock';
import { Renderer } from '@render/Renderer';
import { DemoScene } from '@render/scenes/DemoScene';
import { DebugOverlay } from './DebugOverlay';
import { FpsMeter } from './FpsMeter';
import { parseLaunchParams } from './params';

/** Frames rendered before the page reports itself ready (e2e / screenshots). */
const READY_AFTER_FRAMES = 3;
/** Cap for the per-frame animation step, seconds. */
const MAX_ANIM_DT_S = 0.1;

function start(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#game');
  const root = document.querySelector<HTMLElement>('#app');
  if (!canvas || !root) throw new Error('index.html is missing #app / #game');

  const params = parseLaunchParams(window.location.search);
  const renderer = new Renderer(
    canvas,
    params.forcedPixelRatio === undefined ? {} : { forcedPixelRatio: params.forcedPixelRatio },
  );
  const demo = new DemoScene();
  renderer.setResizeHandler((width, height) => demo.setAspect(width, height));

  const overlay = params.debug ? new DebugOverlay(root) : undefined;
  const fps = new FpsMeter();
  // Simulation clock is wired now; core systems plug into the fixed step from M1.
  const clock = new FixedClock();

  let last = performance.now();
  let frames = 0;
  renderer.three.setAnimationLoop((now: number) => {
    const frameDt = Math.max(0, (now - last) / 1000);
    last = now;
    // Long frames (tab was hidden) must not teleport animations.
    const dt = Math.min(frameDt, MAX_ANIM_DT_S);
    clock.advance(frameDt);

    demo.update(dt);
    renderer.render(demo.scene, demo.camera);

    const smoothedFps = fps.push(frameDt);
    renderer.adapt(smoothedFps, dt);
    overlay?.update(dt, smoothedFps, renderer.stats());

    if (++frames === READY_AFTER_FRAMES) document.body.dataset['ready'] = '1';
  });

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      renderer.three.setAnimationLoop(null);
      overlay?.dispose();
      demo.dispose();
      renderer.dispose();
    });
  }
}

start();
