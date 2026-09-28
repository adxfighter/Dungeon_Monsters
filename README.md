# Dungeon Monsters

Мобильная 3D-игра в аниме-стиле: спустись в живое подземелье, победи монстров, приготовь из них ужин и спустись глубже.

Статус: M1 «Движение и мир» — героиня ходит по тайловой комнате. Подробности — [docs/STATUS.md](docs/STATUS.md).

**Играть (свежая сборка `main`):** https://adxfighter.github.io/Dungeon_Monsters/
Управление: палец в **левой половине** экрана — плавающий джойстик; на компьютере — WASD/стрелки или перетаскивание мышью.
Dev-параметры: `?debug=1` — оверлей (FPS, draw calls, треугольники, pixelRatio); `?pr=1` — принудительный pixelRatio 1
(прокси mid-range GPU); `?demo=1` — тестовая toon-сцена M0.

- Дизайн: [docs/GDD.md](docs/GDD.md) · Сюжет: [docs/STORY.md](docs/STORY.md)
- Архитектура: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Дорожная карта: [docs/ROADMAP.md](docs/ROADMAP.md)
- Вся документация: [docs/README.md](docs/README.md) · Правила для ИИ-агента: [CLAUDE.md](CLAUDE.md)

Стек: TypeScript · Vite · Three.js · Preact · Vitest · Playwright · Capacitor.

## Запуск

Нужен Node.js ≥ 22 (см. `.nvmrc`).

```bash
npm ci
npm run dev          # http://localhost:5173
```

| Команда | Что делает |
|---|---|
| `npm run dev` | dev-сервер Vite с HMR |
| `npm run build` | продакшен-сборка в `dist/` (base `/Dungeon_Monsters/` для GitHub Pages) |
| `npm run preview` | раздаёт `dist/` → http://localhost:4173/Dungeon_Monsters/ |
| `npm run typecheck` | `tsc` для всего проекта + отдельно ядро без DOM (`tsconfig.core.json`) |
| `npm run lint` | ESLint, включая границы слоёв (`eslint-plugin-boundaries`) |
| `npm run format` | Prettier |
| `npm run test` | unit-тесты Vitest |
| `npm run e2e` | Playwright smoke в мобильном вьюпорте 390×844 (первый раз: `npx playwright install chromium`) |
| `npm run screenshot` | PNG ключевых экранов 390×844 → `test-results/screens/` |

Перед коммитом: `npm run typecheck && npm run lint && npm run test && npm run build`.

## Открыть на телефоне

1. **GitHub Pages** (основной способ): открыть https://adxfighter.github.io/Dungeon_Monsters/ — обновляется после
   каждого merge в `main`. Можно «Добавить на главный экран» — запустится в полноэкранном портретном режиме.
2. **Локальная сеть** (без деплоя): телефон и компьютер в одной Wi-Fi-сети.
   ```bash
   npm run dev -- --host
   ```
   Vite напечатает адрес `Network: http://192.168.x.x:5173/` — открыть его на телефоне. Для проверки продакшен-сборки:
   `npm run build && npm run preview -- --host` → `http://192.168.x.x:4173/Dungeon_Monsters/`.
   Если не открывается — разрешить Node.js в брандмауэре Windows для частных сетей.
