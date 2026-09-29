# M2 — Бой

> Перед стартом: `docs/prompts/00_session_start.md`. Опирается на M1.

## Цель
Честный, читаемый на тач-экране бой с тремя монстрами Яруса I. Способ убийства фиксируется для будущего качества ингредиентов.

## Контекст
GDD §4.1, §4.3, §5; STORY §4 (Пролог, Акт I).

## Задачи
1. **Контент-схемы** (`content/schemas.ts`, Zod): `MonsterDef {id, nameKey, stats, element resist/weak, ai,
   attacks[], drops[] (заглушка до M3), bestiaryKey}`, `AttackDef {windup, active, recovery, shape, damage, element}`.
   Тест валидации всего контента.
2. **Монстры Яруса I** (оригинальные, собственный дизайн, модели из примитивов в `render/models/monsters/`;
   сверить с запретным списком `docs/LEGAL.md`):
   - **Пузырник** — парящая пещерная рыба-пузырь, травоядная; медленно дрейфует, при угрозе раздувается и
     таранит; лопается от огня (огонь портит мясо — M3).
   - **Искроёж** — ёж со светящимися иглами, оборонительный: сворачивается (неуязвим спереди), выстреливает иглы
     веером; уязвим со спины.
   - **Кроль-камнеед** — хищник, быстрые наскоки, уязвим после промаха.
3. **Системы core**: `combat` (хитбоксы: круг/конус/линия; кадры windup/active/recovery), `health` (HP, i-frames,
   stagger), `damage` (ATK/DEF/элемент/крит; формула в `content/balance.ts`), `ai` (FSM: idle→wander→notice→
   chase→telegraph→attack→recover; параметры в данных), `death` → событие `MonsterKilled {killElement, overkill,
   hitsTaken}` (понадобится в M3).
4. **Игрок**: удар (тап, комбо ×3 с окном 0.4 с), рывок (i-frames 0.25 с, cooldown 0.8 с), автонаведение
   (конус 60°, ближайший), поражение → экран «Вас вынесли» (заглушка).
5. **UI (Preact)**: кнопки справа (≥ 64dp, полупрозрачные), HP-бар героя, HP-бары врагов над головой,
   плавающие цифры урона (пул DOM-элементов или спрайтов — без аллокаций на каждый удар).
6. **Читаемость**: телеграфы атак (декаль на полу, заполняющаяся к моменту удара), hit-stop 60 мс, шейк камеры
   (отключаемый), вспышка белым материала при попадании, частицы (пул), вибро-отклик (`platform/haptics`, отключаемый).
7. **Тестовая арена**: комната со спавном волн (данные в `content/rooms/arena_test.ts`).
8. **Тесты**: формула урона, i-frames, FSM переходы, комбо-окно, детерминированный бой по seed (replay инпута
   → тот же результат).

## DoD
- [ ] 3 монстра с разным поведением; каждую атаку можно увидеть заранее и увернуться.
- [ ] Бой 1 против 3 держит ≥ 55 FPS (десктоп, моб. вьюпорт); нет аллокаций в горячем цикле (проверить профайлером).
- [ ] Детерминированный replay-тест проходит.
- [ ] Все строки через i18n; монстры IP-чисты.
- [ ] Ревью APPROVE, документация (бестиарий-черновик в GDD/контенте), тег `v0.2.0`.

## Уточнения
_По итогам M1 (2026-09-29):_
- ECS: `core/ecs/World.ts` (`defineComponent`, `add/get/require/remove`, кэшируемый `query`; id не переиспользуются).
  Компоненты — `core/components.ts`. Новые системы вызывать из `Game.step` в явном порядке
  (snapshot → steering → physics → combat …). Координаты и `rot` — ARCHITECTURE §5.
- События: `core/state/events.ts` (`GameEvent`), `Game.drainEvents()` раз в кадр в `app/main.tsx` → `RoomScene.handleEvents`.
  `EntityDespawned` уже поддержан в `EntityViews` (dispose вью) — использовать для смерти монстров.
- Ввод: управление — **тап по точке** (`ui/tapToMove`, слой на весь экран; `InputState.target` с `seq`), джойстик —
  `?joystick=1`. Кнопки добавлять битами в `shared/input.ts` (`Buttons`) и в `InputController`; кнопки — Preact
  в `ui/` **поверх** tap-слоя (`pointer-events: auto`, `stopPropagation` в `onPointerDown`), ≥ 48 dp.
  Тап по монстру (M2) — вероятно «атаковать цель»: решить в дизайне M2 (экранная точка → ground → ближайший враг).
- Навигация: `core/dungeon/pathfinding.ts` (`findPath`, `segmentClear`, `nearestFloorTile`) и компоненты
  `Steering`/`MoveTarget` — ИИ монстров может использовать тот же путь (`navigationSystem` + `steeringMovementSystem`).
- Камера показывает ~4 тайла по ширине: телеграфы атак и монстры должны помещаться в этот кадр.
- Коллизии: `core/systems/collision.ts` (`moveCircle`, `resolveCircleVsTiles`) — переиспользовать для монстров.
- Вью монстров: по аналогии с `render/models/chibi.ts` (`createChibi` → `{ root, update }`), выбор фабрики — по
  `Kind.kind` в `EntityViews.handle`. Бюджет: комната+герой = 18 draw calls; на монстра ≤ 6.
- i18n: `platform/i18n` (`createI18n`) + словари `content/i18n/{ru,en}.ts`; тест проверяет совпадение ключей.
- Контент: Zod-схемы в `content/schemas.ts`, тест `content/content.test.ts` — добавить схемы монстров туда же.
- Демо-сцена M0 доступна по `?demo=1`.
