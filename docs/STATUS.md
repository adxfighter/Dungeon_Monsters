# Статус проекта

Обновлено: 2026-09-28

## Текущий milestone
**M0 — Фундамент** · в работе, 5/7 пунктов DoD. Ветка `m0/foundation`, PR https://github.com/adxfighter/Dungeon_Monsters/pull/2.
- [x] typecheck, lint, test (33), build, e2e (3) — зелёные локально и в CI
- [x] нарушение границ слоя ловится линтом (проверено автором и ревьюером)
- [x] тестовая сцена 390×844 в toon-стиле (3 ступени, rim, контур) — скриншоты `npm run screenshot`
- [x] dev-оверлей `?debug=1` (FPS, draw calls, tris, geo/tex, dpr/pr), `?pr=1`
- [x] стартовый бандл: JS 136 КБ gzip (бюджет 1 МБ)
- [ ] Pages: включён (`build_type: workflow`), деплой после merge; **пользователь проверяет на S22 Ultra**
- [~] ревью: APPROVE (0 blocker/major, 9 minor/nit — 7 исправлены, 2 в бэклоге); после merge — тег `v0.0.0`

## Сделано
- 2026-09-28 — Сессия планирования: GDD, сценарий, архитектура, дорожная карта M0–M16, ADR-0001 (веб-стек),
  ADR-0002 (оригинальная IP), правила разработки (`CLAUDE.md`), промты старта/ревью/документации,
  субагенты `reviewer` и `doc-keeper`.
- 2026-09-28 — Независимое ревью документации: 15 findings (1 blocker, 7 major, 7 minor), все исправлены
  (переделаны отряд и монстры Яруса I по IP, объём MVP согласован, M0 усилен: scaffold во временном каталоге,
  launch.json, SwiftShader в CI, tsconfig ядра без DOM). `git init`, первый коммит и push в `main`.
- 2026-09-28 — Решения пользователя: GitHub Pages (ADR-0003), устройство S22 Ultra, утверждение сюжета.
  Ревью: APPROVE, 8 minor/nit исправлены (deploy.yml permissions/environment, base только для build,
  проверка build_type Pages, dpr и чипсет S22, GPU-прокси mid-range).
- 2026-09-28 — M0: каркас Vite 8 + TS 6, слои и ESLint-границы, core (Rng/FixedClock/vec2), toon + outline демо,
  dev-оверлей, Vitest + Playwright (SwiftShader, 1 воркер), CI и deploy на Pages (PR #2). Решения — DECISIONS_LOG.

## Следующий шаг
1. Дождаться зелёного CI в PR #2 → squash-merge → проверить деплой-workflow и https://adxfighter.github.io/Dungeon_Monsters/
   → `git tag v0.0.0 <squash-коммит> && git push origin v0.0.0`.
2. Пользователь открывает сайт на S22 Ultra (с `?debug=1`), сообщает FPS/dpr/ощущения → отметить последний пункт DoD.
3. Затем M1: `git checkout main && git pull && git checkout -b m1/movement`, промт `docs/prompts/milestones/M1_movement_world.md`
   (раздел «Уточнения» дополнен по итогам M0).

## Блокеры и вопросы к пользователю
- Проверка сборки на Samsung S22 Ultra (после merge PR #2): FPS в `?debug=1`, режим разрешения, частота экрана.

## Ответы пользователя (2026-09-28)
- Репозиторий сделан публичным, хостинг — GitHub Pages (ADR-0003). Pages ещё не включён — включается в M0.
- Тестовое устройство: **Samsung Galaxy S22 Ultra**.
- Отряд, сюжет и подход к IP (оригинальная игра) — **утверждены**.

## Бэклог (вне текущего объёма)
- Адаптивное разрешение (`render/Renderer.ts` `adapt`): при ограничении rAF 30 Гц (энергосбережение) pixelRatio необратимо
  падает до 1. Сравнивать с частотой дисплея / добавить подъём с гистерезисом — вместе с профилями качества (ревью M0 #2).
- Нет фолбэк-экрана без WebGL2 и обработки `webglcontextlost`/`restored` (мобильные теряют контекст при сворачивании) —
  нужен i18n-текст, сделать в M1 (ревью M0 #5).
- e2e гоняется только против dev-сервера; прод-сборка с base `/Dungeon_Monsters/` автотестом не покрыта.
