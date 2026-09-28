# Документация Dungeon Monsters — индекс

Правила для Claude: [`../CLAUDE.md`](../CLAUDE.md) (читаются автоматически в каждой сессии).

## Как работать с Claude (для владельца проекта)
1. Открыть Claude Code в каталоге проекта.
2. Написать: **«Начни сессию по docs/prompts/00_session_start.md»**, и Claude сам определит, на чём остановились.
3. Для конкретного этапа: «Выполни M<N> по docs/prompts/milestones/M<N>_*.md».
4. В конце: «Сохрани документацию по docs/prompts/20_docs_update.md» (Claude делает это и сам).

## Продукт
| Документ | Содержание |
|---|---|
| [GDD.md](GDD.md) | Дизайн игры: столпы, цикл, механики, контент, стиль |
| [STORY.md](STORY.md) | Мир, герои, сюжет, концовки, тон |
| [LEGAL.md](LEGAL.md) | Политика IP (оригинальная игра, не лицензия Dungeon Meshi) |

## Техника
| Документ | Содержание |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Стек, слои, структура, цикл, рендер, perf-бюджет, тесты, деплой |
| [adr/](adr/) | Architecture Decision Records |
| [ASSETS.md](ASSETS.md) | Реестр ассетов и лицензий |

## Управление
| Документ | Содержание |
|---|---|
| [ROADMAP.md](ROADMAP.md) | Milestone M0–M16 с критериями готовности |
| [STATUS.md](STATUS.md) | Где мы сейчас, следующий шаг, блокеры |
| [DECISIONS_LOG.md](DECISIONS_LOG.md) | Журнал всех решений |
| [RISKS.md](RISKS.md) | Реестр рисков |
| [CHANGELOG.md](CHANGELOG.md) | Изменения по версиям |

## Промты для Claude
| Промт | Когда |
|---|---|
| [prompts/00_session_start.md](prompts/00_session_start.md) | Начало каждой сессии |
| [prompts/milestones/](prompts/milestones/) | Реализация этапов M0–M16 |
| [prompts/10_independent_review.md](prompts/10_independent_review.md) | Перед каждым merge (субагент `reviewer`) |
| [prompts/20_docs_update.md](prompts/20_docs_update.md) | Конец задачи/сессии (субагент `doc-keeper`) |
