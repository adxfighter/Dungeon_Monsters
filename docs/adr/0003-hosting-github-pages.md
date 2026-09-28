# ADR-0003: Превью-хостинг на GitHub Pages

- Статус: **Принято**
- Дата: 2026-09-28
- Решение пользователя: репозиторий сделан публичным, хостинг — GitHub Pages.

## Контекст
Для проверки игры на телефоне нужна постоянная ссылка на свежую сборку. Репозиторий был приватным (Pages недоступен на бесплатном плане).

## Рассмотренные варианты
| Вариант | + | − |
|---|---|---|
| **GitHub Pages (публичный репо)** | без новых аккаунтов, деплой из Actions, HTTPS | код открыт всем |
| Cloudflare Pages / Netlify | приватный код | ещё один аккаунт и токен |
| Локальная сеть (`vite preview --host`) | ничего не нужно | только дома, нет HTTPS (PWA/service worker не работают) |

## Решение
GitHub Pages, источник — GitHub Actions (`actions/deploy-pages`). Деплой при каждом push в `main`.
URL: `https://adxfighter.github.io/Dungeon_Monsters/` → в Vite `base: '/Dungeon_Monsters/'`.
Включение Pages в M0: проверить `build_type` (GET), при 404 — POST, при `legacy` — PUT с `build_type=workflow`. `base` задаётся только для `vite build`.

## Последствия
- Код и документация публичны → никаких секретов в репозитории (и так запрещено CLAUDE.md §4).
- PR-превью не делаем (Pages даёт один сайт); для PR — CI artifact `dist`.
- Все пути к ассетам — относительно `import.meta.env.BASE_URL`.
