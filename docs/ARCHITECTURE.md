# Архитектура — Dungeon Monsters

Версия: 0.1 · 2026-09-28 · Владелец: CTO/Architect (Claude). Изменения — только через ADR.

## 1. Ключевые драйверы
1. **Разработка ИИ-агентом.** Claude должен уметь сам собрать, запустить, протестировать и увидеть игру
   (браузер-превью, скриншоты, автотесты). → Веб-стек, а не Unity/Unreal (см. ADR-0001).
2. **Мобильная производительность** на mid-range Android в WebGL.
3. **Тестируемость логики** без рендера → строгое разделение core/render/ui.
4. **Контент как данные** — чтобы наращивать монстров/рецепты без правки систем.

## 2. Стек
| Слой | Технология | Почему |
|---|---|---|
| Язык | TypeScript 5.x, `strict: true`, `noUncheckedIndexedAccess` | типы = документация для агента |
| Сборка | Vite | быстрый dev-сервер, HMR, code-splitting |
| 3D | Three.js (WebGL2) | зрелый, лёгкий, огромная база примеров |
| Аниме-персонажи (позже) | @pixiv/three-vrm | VRM-модели из VRoid Studio |
| UI | Preact + CSS modules поверх canvas | 4 КБ, JSX, привычный компонентный UI |
| Валидация контента | Zod | ошибки контента ловятся на старте/в тестах |
| Сохранения | IndexedDB (idb-keyval) | офлайн, объём |
| Аудио | Howler.js | мобильный unlock, спрайты |
| Тесты | Vitest (core, unit), Playwright (e2e smoke, мобильный вьюпорт) | |
| Качество | ESLint (flat config) + Prettier + `eslint-plugin-boundaries` | enforce границ слоёв |
| Моб. упаковка | PWA → Capacitor (Android/iOS) | один код |
| CI | GitHub Actions: typecheck, lint, test, build, e2e | |

Физический движок **не используется**: мир — сетка тайлов + круговые коллайдеры, собственная простая коллизия
(дешевле и детерминированнее на мобильных). Пересмотр — ADR, если понадобится.

## 3. Слои и зависимости
```
            ┌─────────────┐
            │   app/      │  bootstrap, game loop, wiring, сцены-состояния
            └──┬───┬───┬──┘
      ┌────────┘   │   └────────┐
┌─────▼────┐ ┌─────▼─────┐ ┌────▼────┐
│ render/  │ │   ui/     │ │ platform│ input, audio, storage, haptics, i18n
│ Three.js │ │  Preact   │ │ (adapters)
└─────┬────┘ └─────┬─────┘ └────┬────┘
      │  read-only │ commands   │ interfaces
      └────────────┼────────────┘
             ┌─────▼─────┐        ┌───────────┐
             │  core/    │◀───────│ content/  │ данные + Zod-схемы
             │ pure TS   │        └───────────┘
             └───────────┘
```
Правила (проверяются `eslint-plugin-boundaries`: element-types для слоёв, `boundaries/external` для пакетов —
`three` только в render/app, `preact` только в ui/app, `zod` только в content). Дополнительно `src/core` проверяется
отдельным `tsconfig.core.json` с `lib: ["ES2022"]` без DOM — `window`, `navigator`, `setTimeout`,
`requestAnimationFrame`, `performance` там не скомпилируются.
- `core` → может импортировать только `core`, `content` (типы/данные), `shared`.
- `content` → только `shared` и `zod`.
- `render`, `ui` → `core` (read-only API и типы), `content` (**только чтение** данных: внешность, иконки, тексты),
  `shared`, `platform`.
- `platform` → не знает про `render`/`ui`.
- `app` → всё.

## 4. Структура репозитория
```
/
├─ CLAUDE.md                 правила для агента
├─ .claude/agents/           субагенты: reviewer, doc-keeper
├─ docs/                     вся проектная документация
├─ src/
│  ├─ app/                   main.ts, GameLoop, SceneManager (Boot, Hub, Floor, Camp, Cutscene)
│  ├─ core/
│  │  ├─ ecs/                World, Entity, компоненты (plain data), запросы
│  │  ├─ systems/            movement, collision, combat, ai, loot, butcher, cooking, ecosystem, progression
│  │  ├─ dungeon/            генератор этажей (seed → FloorLayout)
│  │  ├─ state/              GameState, Commands, Events, reducers для мета-состояния
│  │  ├─ rng.ts, clock.ts    детерминированные сервисы
│  │  └─ save/               сериализация, версии, миграции
│  ├─ content/               characters/, monsters/, ingredients/, recipes/, rooms/, floors/, ecology/,
│  │                         dialogue/, balance.ts, schemas.ts
│  ├─ render/                Renderer, materials/toon, outline, camera, fx, view-синхронизация сущностей
│  ├─ ui/                    hud/, joystick/, cooking-minigames/, menus/, dialogue/
│  ├─ platform/              input, audio, storage, haptics, i18n
│  └─ shared/                math (vec2/vec3), types, utils без зависимостей
├─ public/                   статические ассеты (модели .glb, звуки, шрифты)
├─ tests/e2e/                Playwright
└─ tools/                    скрипты: валидация контента, генерация атласов, perf-замеры
```

## 5. Игровой цикл
- Фиксированный шаг симуляции **30 Гц** (`core`), рендер — с интерполяцией на частоте дисплея.
- Порядок кадра: `input → commands → core.step(dt_fixed) × n → events → render.sync(alpha) → ui`.
- `core` порождает **события** (`DamageDealt`, `MonsterKilled`, `DishCooked`...), на которые подписаны
  render (VFX), ui (попапы), audio. Core ничего не знает о подписчиках.

## 6. ECS-lite
Собственная минимальная ECS: сущность = number; компоненты = typed-объекты в `Map`/массивах; системы —
функции `(world, dt, ctx) => void`. Без сторонней библиотеки (простота отладки агентом). Если профилирование
покажет узкое место — ADR на bitecs.

## 7. Рендер
- `WebGLRenderer` с `powerPreference: 'high-performance'`, pixel ratio ≤ 2 (адаптивно снижаем при падении FPS).
- Материал **ToonMaterial**: `MeshToonMaterial` + gradientMap 3 ступени + rim light через `onBeforeCompile`.
- **Outline**: inverted hull (второй меш с `BackSide`, выдавливание по нормали) — дешевле постпроцесса на мобильных.
- Постэффекты: только лёгкий bloom на high-профиле; на low — выключен.
- Инстансинг (`InstancedMesh`) для тайлов пола/стен, грибов, декора.
- Профили качества: `low / medium / high`, автоопределение по первым 3 с FPS.

## 8. Контент-пайплайн
- Контент — TS-модули, экспортирующие объекты, которые проходят `Schema.parse` в тесте `content.test.ts`
  и при старте в dev-режиме. Ссылки между сущностями по строковым `id` проверяются тестом целостности.
- Процедурные модели (чиби-герои, монстры из примитивов) — фабрики в `render/models/`.
- Внешние модели — `.glb`, сжатие Draco/Meshopt, текстуры KTX2 (когда появятся).

## 9. Сохранения
`SaveData { saveVersion, meta: {...}, runs?: {...} }` → JSON → IndexedDB. Миграции `migrate_vN_to_vN+1`
с тестами на фикстурах старых версий.

## 10. Performance budget (mid-range Android, например Snapdragon 6-серии)
| Метрика | Бюджет |
|---|---|
| FPS | цель 60, минимум 30 |
| Draw calls | ≤ 150 |
| Треугольники в кадре | ≤ 150k |
| Текстурная память | ≤ 128 МБ |
| Стартовый JS (gzip) | ≤ 1 МБ; весь стартовый бандл ≤ 3 МБ |
| Время до игры | ≤ 5 с на 4G |
Встроенный dev-оверлей (`?debug=1`): FPS, draw calls, tris, память.

## 11. Тестирование
- Unit (Vitest): все системы core, генератор этажей (снапшоты по seed), готовка (формулы качества), миграции.
- Контент: схемы + целостность ссылок + баланс-санити (нет рецепта без доступных ингредиентов).
- E2E (Playwright, вьюпорт 390×844, touch): загрузка → старт → движение → бой → готовка (smoke).
- Визуальная проверка агентом: скриншоты ключевых экранов в PR.

## 12. Деплой
- `main` → GitHub Actions → сборка → **превью-хостинг** (GitHub Pages при публичном репо / платном плане;
  иначе Cloudflare Pages или Netlify — решение ADR-0003 в M0).
- Релиз: Capacitor Android (AAB) → Google Play internal testing; iOS — при наличии Mac/аккаунта.
