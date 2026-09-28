# M0 — Фундамент

> Промт для Claude Opus 5.5. Перед стартом выполнить `docs/prompts/00_session_start.md`.

## Цель
Создать каркас проекта, на котором все последующие milestone строятся без переделок: сборка, слои, линтинг
границ, тесты, CI, превью-деплой, и визуальное доказательство аниме-стиля (toon + outline) на телефоне.

## Контекст
`CLAUDE.md`, `docs/ARCHITECTURE.md` (§2–4, §7, §10–12), ADR-0001.

## Задачи (каждая — отдельная ветка/PR, либо M0 одним PR, если объём мал)
0. **Git**: если репозиторий не инициализирован — `git init -b main`, remote `https://github.com/adxfighter/Dungeon_Monsters`.
1. **Инициализация**: каталог НЕ пустой (docs/, CLAUDE.md), поэтому шаблон генерировать во временном каталоге
   (`npm create vite@latest ../dm-scaffold -- --template vanilla-ts`), перенести нужные файлы, удалить временный
   каталог. **Никогда** `--overwrite` в корне. Затем структура каталогов по ARCHITECTURE §4 (пустые `index.ts`
   с комментарием назначения). `package.json` scripts: `dev`, `build`, `preview`, `typecheck` (`tsc --noEmit`),
   `lint`, `format`, `test` (vitest run), `test:watch`, `e2e` (playwright), `screenshot` (Playwright-скрипт:
   PNG ключевых экранов 390×844 → `test-results/screens/`). `typecheck` = `tsc --noEmit && tsc -p tsconfig.core.json --noEmit`.
   Node ≥ 22 в `engines`, `.nvmrc`. Создать `.claude/launch.json` (`npm run dev`, порт 5173) для браузер-превью.
2. **TS**: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, path aliases `@core/*`, `@render/*`,
   `@ui/*`, `@content/*`, `@platform/*`, `@shared/*`, `@app/*` (и в Vite, и в Vitest). `tsconfig.core.json` для
   `src/core`, `src/content`, `src/shared` с `lib: ["ES2022"]` (без DOM).
3. **ESLint (flat) + Prettier** + `eslint-plugin-boundaries` с правилами слоёв из ARCHITECTURE §3.
   Дополнительно в `core/**`: `no-restricted-globals` (window, document), `no-restricted-properties`
   (`Math.random`, `Date.now`), `no-restricted-imports` (three, preact). Написать заведомо нарушающий
   файл, убедиться что линт падает, удалить.
4. **Core-сервисы**: `core/rng.ts` (seedable PRNG, например mulberry32/sfc32, с `fork(label)`), `core/clock.ts`
   (фиксированный шаг), `shared/math` (vec2 без аллокаций: функции над `{x,y}` с out-параметром). Unit-тесты
   детерминизма RNG.
5. **Рендер-демо**: `render/Renderer.ts` (WebGL2, adaptive pixelRatio ≤ 2, resize, dispose),
   `render/materials/toon.ts` (MeshToonMaterial + 3-ступенчатая gradientMap с `NearestFilter` + rim light через
   `onBeforeCompile`), `render/outline.ts` (inverted hull, толщина в мировых единицах, настраиваемый цвет).
   Тестовая сцена: пол, 3 примитива разного цвета, «чиби-болванка» (сфера-голова + капсула-тело), вращение,
   направленный свет + hemisphere.
6. **Dev-оверлей** `?debug=1`: FPS (сглаженный), draw calls, triangles, geometries/textures из `renderer.info`.
7. **Мобильная база**: `index.html` с `viewport-fit=cover`, запрет zoom/скролла/выделения, `touch-action: none`
   на canvas, safe-area CSS-переменные, портрет; иконка-заглушка, `manifest.webmanifest`.
8. **Тесты**: Vitest настроен (`environment: node` для core); Playwright с проектом `mobile` (390×844, `hasTouch`,
   `isMobile`), smoke-тест: страница грузится, `canvas.getContext('webgl2') !== null`, нет ошибок консоли.
   В headless CI без GPU: `launchOptions.args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']`.
9. **CI** `.github/workflows/ci.yml`: на PR и push в main: `npm ci`, typecheck, lint, test, build, e2e (chromium),
   загрузка `dist` как artifact. Кэш npm.
10. **Превью-деплой**: репозиторий приватный. Проверить доступность GitHub Pages
    (`gh api repos/adxfighter/Dungeon_Monsters/pages`). Если недоступно — предложить пользователю варианты
    (сделать репозиторий публичным / Cloudflare Pages / Netlify) и **спросить**, не создавая аккаунтов.
    Решение оформить ADR-0003. Пока ответа нет — сборка доступна как CI artifact и через `npm run preview -- --host`
    в локальной сети (зафиксировать инструкцию в `docs/README.md`).
11. **Документация**: `README.md` в корне (как запустить, как открыть на телефоне в локальной сети),
    обновить STATUS, CHANGELOG, DECISIONS_LOG.

## Definition of Done
- [ ] `npm run typecheck && npm run lint && npm run test && npm run build && npm run e2e` — зелёные локально и в CI.
- [ ] Нарушение границ слоя ловится линтом (проверено).
- [ ] Тестовая сцена в браузере-превью 390×844 выглядит «аниме»: 3 ступени тени, rim, чёрный контур. Скриншот в PR.
- [ ] Dev-оверлей показывает FPS/draw calls.
- [ ] Стартовый бандл gzip ≤ 1 МБ (Three.js tree-shaken), размер записан в PR.
- [ ] Инструкция открытия на телефоне в README; ADR-0003 (хостинг) принят или вопрос задан пользователю.
- [ ] Независимое ревью: APPROVE. Документация обновлена. Тег `v0.0.0` на squash-коммит в main.

## Не делать в M0
Геймплей, ECS, UI-фреймворк (Preact подключается в M1), ассеты.

## Уточнения
_(дописывается по итогам предыдущих этапов)_
