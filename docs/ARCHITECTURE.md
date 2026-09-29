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
│  │  ├─ save/               сериализация, версии, миграции
│  │  └─ testing/            фикстуры для тестов движка (монстры-заглушки механик), в бандл не попадают
│  ├─ content/               characters/, monsters/, ingredients/, recipes/, rooms/, floors/, ecology/,
│  │                         dialogue/, balance.ts, schemas.ts
│  ├─ render/                Renderer, materials/toon, outline, camera, fx, view-синхронизация сущностей
│  ├─ ui/                    hud/, tapToMove/, joystick/, cooking-minigames/, menus/, dialogue/
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
- Бой (M2): порядок шага `Game.step` — snapshot → combatTimers → status (замедление, захват) → playerInput →
  heroCombatInput (удар, рывок, смена оружия) → loot (команды разделки → рюкзак) → ai → navigation → action (фазы атак windup/active/recovery, рывок, выпад через `ForcedVelocity`,
  облака `Hazard`) → steeringMovement → physics → separation (тела не проходят друг сквозь друга) → projectiles →
  meleeHit → hazards (урон со временем, замедление) → carrion → death → удаление → волны арены.
  Статусы героини — компонент `Status` (`slowMult/slowT`, `heldBy/heldT`); захват (`attack.grab`) не наносит урон,
  его не останавливают i-кадры после удара, только рывок (`Dodge.invuln`). Монстр с несколькими атаками выбирает
  случайную из доступных по дистанции (RNG тянется, только когда выбор есть).
- Добыча (M3): туша `Carrion {monsterId, killElement, overkillRatio}` от `deathSystem`; `core/loot/quality.ts`
  (`ingredientStars` — чистая функция), `core/loot/backpack.ts` (стаки, вес/слоты), `core/systems/loot.ts`
  (`lootSystem`, селектор `lootableCarcass` для кнопки UI); событие `LootTaken`. Разделка — команда UI →
  core: `Game.butcher(carcass, cuts, skipped)` (применяется на следующем шаге); мини-игра `ui/butchery/ButcherBoard`
  оценивает свайп чистыми функциями `core/loot/cut.ts` (`scoreSwipe`, `scoreTaps`), на время доски main не шагает sim. Оружие героини — `Arsenal`
  (`CharacterDef.combat.weapons`), смена — `Buttons.Swap`, событие `WeaponSwapped`.
  Весь рандом — `Rng(seed).fork('combat')` (урон, криты, ИИ), поэтому replay по seed + инпуту детерминирован (тест).
  Формула урона и глобальные константы — `content/balance.ts`; атаки, монстры, комбо — данные с Zod-схемами.
- Сложность (M2): `Game({ awaitStart: true })` держит арену в статусе `ready` (героиня ходит, волн нет), пока UI
  (`ui/hud/DifficultyPicker`) не вызовет `game.startArena(waves, modifiers)`; множители применяются при спавне
  монстра (HP, ATK, пауза между атаками — `Brain.cooldownBase`, с учётом overrides уровня).
- Ощущение боя (M2, всё вне core, детерминизм не затронут): события `DamageDealt/MonsterKilled` →
  `render` (вспышка `fx/HitFlash`, искры `fx/Particles` — пул InstancedMesh, шейк `CameraRig.shake`),
  `app/CombatFeedback` (hit-stop `GameLoop.hitStop` — сим замирает, рендер идёт; вибро `platform/haptics`; цифры
  урона). Телеграфы — `render/fx/Telegraphs` читают `Attacker.current` (windup) и рисуют форму атаки на полу.
  HP-бары врагов и цифры — `ui/overlay/WorldOverlay` (пул DOM, позиционирование через проекцию из app, стиль
  пишется только при изменении). Настройки шейка/вибро — `platform/settings` (localStorage, до M7).
- Реализация (M1): `app/GameLoop.ts` (clamp кадра ≤ 0.25 с, пауза по `visibilitychange` и потере WebGL-контекста),
  `core/Game.ts` (`step(input, dt)`: snapshot → playerInput → navigation → steeringMovement → physics), `render/EntityViews.ts` (интерполяция
  `PrevTransform → Transform` по `alpha`, вью создаются по `EntitySpawned/Despawned`). Ввод сэмплируется на каждом
  шаге симуляции (`platform/input` → `shared/input.InputState`) — задержка ≤ 1 шага.
- Управление (с 2026-09-29) — тап по точке: `ui/tapToMove` → `app/TapTargeting` (экран → пол через
  `RoomScene.screenToGround`; удержание > 350 мс перепроецируется каждый кадр) → `InputController.setMoveTarget`
  → `InputState.target {seq, x, y}` → core: `playerInputSystem` планирует путь `core/dungeon/pathfinding.ts`
  (A* 8 направлений без срезания углов, string pulling, конечная точка выталкивается из стен на радиус) в
  `MoveTarget`; `navigationSystem` ведёт по точкам в `Steering` (торможение без перелёта, сброс при застревании);
  `steeringMovementSystem` — общий для всех, кто движется (ИИ монстров — тоже через `Steering`).
- **Координаты:** симуляция 2D, 1 единица = 1 тайл; `x` — вправо по экрану, `y` — к камере (вниз по экрану);
  тайл (tx, ty) = [tx, tx+1) × [ty, ty+1), строка 0 шаблона — дальняя. Мир three: (x, y) → (x, 0, y).
  `rot` — угол взгляда, направление (sin rot, cos rot); в three это `rotation.y = rot`.
  Камера фиксированной ориентации смотрит с +Z под 52°, поэтому экранные направления (джойстик `?joystick=1`,
  WASD) = оси симуляции.

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
Тестовое устройство пользователя — **Samsung Galaxy S22 Ultra** (флагман 2022; экран 120 Гц; dpr 2.81 в FHD+
по умолчанию / 3.75 в WQHD+; чипсет Snapdragon 8 Gen 1 или Exynos 2200 — зависит от региона).
Бюджет остаётся рассчитанным на mid-range. На S22 Ultra цель — FPS не ниже 60 (или частоты экрана при
энергосбережении) после 10 минут игры (троттлинг). При каждом замере записывать: чипсет, режим разрешения,
частоту экрана, энергосбережение — `?debug=1` показывает `devicePixelRatio`.
Прокси mid-range: CPU — Chrome DevTools CPU throttling 4×; GPU/fill-rate — принудительно `pixelRatio 1` +
профиль `low` на S22 и замер на встроенной графике ноутбука. pixelRatio ограничен 2.

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
- `main` → GitHub Actions → сборка → **GitHub Pages** `https://adxfighter.github.io/Dungeon_Monsters/` (ADR-0003).
  PR — сборка как CI artifact.
- Релиз: Capacitor Android (AAB) → Google Play internal testing; iOS — при наличии Mac/аккаунта.
