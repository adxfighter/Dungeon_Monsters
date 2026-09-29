import './style.css';
import { render as renderUi } from 'preact';
import { Brain, Health, MoveTarget, Transform } from '@core/components';
import { Game } from '@core/Game';
import { arenas, characters, locales, monsters, rooms } from '@content/index';
import { InputController } from '@platform/input/InputController';
import { createI18n, pickLocale } from '@platform/i18n/i18n';
import { Renderer } from '@render/Renderer';
import { DemoScene } from '@render/scenes/DemoScene';
import { RoomScene } from '@render/scenes/RoomScene';
import { createInputState } from '@shared/input';
import { HudStore, UiRoot } from '@ui/index';
import { DebugOverlay } from './DebugOverlay';
import { FpsMeter } from './FpsMeter';
import { GameLoop } from './GameLoop';
import { TapTargeting } from './TapTargeting';
import { parseLaunchParams } from './params';

/** Frames rendered before the page reports itself ready (e2e / screenshots). */
const READY_AFTER_FRAMES = 3;
const DEFAULT_LOCALE = 'ru';

interface Stage {
  readonly scene: RoomScene['scene'];
  readonly camera: RoomScene['camera'];
  setAspect(width: number, height: number): void;
  dispose(): void;
}

/** Debug hooks for e2e tests; only present in dev builds. */
declare global {
  interface Window {
    __debug?: {
      getPlayerPos(): { x: number; y: number } | null;
      getTick(): number;
      getMoveTarget(): { active: boolean; x: number; y: number } | null;
      /** Spawns a monster by id (perf tests, manual play-testing). */
      spawnMonster(id: string, x: number, y: number): void;
      getHeroHp(): number;
      setHeroHp(hp: number): void;
      /** Living monsters: hp per entity. */
      getMonsters(): { id: string; hp: number; x: number; y: number }[];
      /** Simulation point → client (CSS px) coordinates, to aim taps in e2e. */
      groundToClient(x: number, y: number): { x: number; y: number };
    };
  }
}

function showFatal(root: HTMLElement, title: string, body: string): void {
  const box = document.createElement('div');
  box.className = 'fatal';
  box.setAttribute('role', 'alert');
  const h = document.createElement('h1');
  h.textContent = title;
  const p = document.createElement('p');
  p.textContent = body;
  box.append(h, p);
  root.replaceChildren(box);
}

function start(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#game');
  const root = document.querySelector<HTMLElement>('#app');
  const uiRoot = document.querySelector<HTMLElement>('#ui');
  if (!canvas || !root || !uiRoot) throw new Error('index.html is missing #app / #game / #ui');

  const i18n = createI18n(
    locales,
    pickLocale(navigator.languages, Object.keys(locales), DEFAULT_LOCALE),
    DEFAULT_LOCALE,
  );
  document.documentElement.lang = i18n.locale;
  const params = parseLaunchParams(window.location.search);

  let renderer: Renderer;
  try {
    renderer = new Renderer(
      canvas,
      params.forcedPixelRatio === undefined ? {} : { forcedPixelRatio: params.forcedPixelRatio },
    );
  } catch (error) {
    console.warn('WebGL2 renderer failed to start', error);
    showFatal(root, i18n.t('error.webgl.title'), i18n.t('error.webgl.body'));
    return;
  }

  const input = new InputController();
  const detachKeyboard = input.attachKeyboard(window);
  const inputState = createInputState();

  let stage: Stage;
  let game: Game | undefined;
  let roomScene: RoomScene | undefined;
  let demo: DemoScene | undefined;
  let tapTargeting: TapTargeting | undefined;
  const hud = new HudStore();
  if (params.demo) {
    demo = new DemoScene();
    stage = demo;
  } else {
    const hero = characters['tavi'];
    if (!hero) throw new Error('content: tavi missing');
    // Default: the M2 combat arena. `?room=<id>` opens a peaceful room instead (e.g. the M1 test room).
    const peaceful = params.room ? rooms[params.room] : undefined;
    const arena = arenas['arena_test'];
    if (peaceful) {
      game = new Game({ room: peaceful, player: hero });
    } else {
      if (!arena) throw new Error('content: arena_test missing');
      game = new Game({
        room: arena.room,
        player: hero,
        monsters,
        waves: arena.waves,
        seed: params.seed ?? 1,
      });
    }
    roomScene = new RoomScene(game);
    stage = roomScene;
    const scene = roomScene;
    const tapping = new TapTargeting((clientX, clientY, out) => {
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      return scene.screenToGround(ndcX, ndcY, out);
    }, input);
    tapTargeting = tapping;
    renderUi(
      <UiRoot
        input={input}
        controls={params.joystick ? 'joystick' : 'tap'}
        hud={hud}
        t={i18n.t}
        onTapPress={(x, y) => tapping.press(x, y, performance.now())}
        onTapRelease={() => tapping.release()}
        onRestart={() => window.location.reload()}
      />,
      uiRoot,
    );
  }
  renderer.setResizeHandler((width, height) => stage.setAspect(width, height));

  const overlay = params.debug ? new DebugOverlay(root) : undefined;
  const fps = new FpsMeter();
  let frames = 0;

  const loop = new GameLoop({
    step(dt) {
      if (!game) return;
      // Input is sampled per step: at most one simulation step of latency.
      game.step(input.sample(inputState), dt);
    },
    render(alpha, dt, rawDt) {
      if (game && roomScene) {
        roomScene.handleEvents(game.drainEvents());
        roomScene.update(alpha, dt);
        tapTargeting?.frame(performance.now());
        const h = game.world.get(game.player, Health);
        hud.update(h?.hp ?? 0, h?.maxHp ?? 1, game.status, game.waveNumber, game.waveCount);
      }
      demo?.update(dt);
      renderer.render(stage.scene, stage.camera);

      const smoothedFps = fps.push(rawDt);
      renderer.adapt(smoothedFps, dt);
      overlay?.update(dt, smoothedFps, renderer.stats());
      if (++frames === READY_AFTER_FRAMES) document.body.dataset['ready'] = '1';
    },
  });

  // Paused while hidden OR while the GL context is lost (mobile browsers drop it when backgrounded;
  // three re-uploads resources on 'restored'). Both conditions are combined so neither event unpauses early.
  let contextLost = false;
  const updatePause = (): void => loop.setPaused(document.hidden || contextLost);
  const onVisibility = (): void => {
    // A finger held while the app is backgrounded may never send pointerup/cancel.
    if (document.hidden) input.releaseTouch();
    updatePause();
  };
  const onContextLost = (event: Event): void => {
    event.preventDefault();
    contextLost = true;
    updatePause();
  };
  const onContextRestored = (): void => {
    contextLost = false;
    updatePause();
  };
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  renderer.three.setAnimationLoop((now: number) => loop.frame(now));

  if (import.meta.env.DEV) {
    void import('@content/validate').then(({ validateContent }) => validateContent());
  }

  if (import.meta.env.DEV && game) {
    const g = game;
    window.__debug = {
      getPlayerPos: () => {
        const t = g.transformOf(g.player);
        return t ? { x: t.x, y: t.y } : null;
      },
      getTick: () => g.tick,
      spawnMonster: (id, x, y) => {
        const def = monsters[id];
        if (!def) throw new Error(`unknown monster ${id}`);
        g.spawnMonster(def, x, y);
      },
      getHeroHp: () => g.world.get(g.player, Health)?.hp ?? 0,
      setHeroHp: (hp) => {
        const h = g.world.get(g.player, Health);
        if (h) h.hp = hp;
      },
      getMonsters: () =>
        g.world.query(Brain, Health, Transform).map((e) => {
          const t = g.world.require(e, Transform);
          return { id: g.world.require(e, Brain).def.id, hp: g.world.require(e, Health).hp, x: t.x, y: t.y };
        }),
      getMoveTarget: () => {
        const t = g.world.get(g.player, MoveTarget);
        return t ? { active: t.active, x: t.x, y: t.y } : null;
      },
      groundToClient: (x, y) => {
        const ndc = { x: 0, y: 0 };
        roomScene?.groundToScreen(x, y, ndc);
        const rect = canvas.getBoundingClientRect();
        return {
          x: rect.left + ((ndc.x + 1) / 2) * rect.width,
          y: rect.top + ((1 - ndc.y) / 2) * rect.height,
        };
      },
    };
  }

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      renderer.three.setAnimationLoop(null);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      detachKeyboard();
      renderUi(null, uiRoot);
      overlay?.dispose();
      stage.dispose();
      renderer.dispose();
      delete window.__debug;
    });
  }
}

start();
