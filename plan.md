# Plan: Product Analytics + Lighthouse CI

## Выбор пользователя
- **Аналитика:** Plausible
- **События:** Расширенный набор
- **Reading sessions:** Как аналитические события (в Plausible)
- **Lighthouse CI:** Отдельный workflow (не блокирует деплой)

---

## Часть 1: Plausible Analytics Integration

### 1.1. Клиентский модуль аналитики (`js/utils/Analytics.js`)

Создать модуль-обёртку над Plausible:
- Функция `initAnalytics()` — вызывается из `js/index.js` при старте
- Функция `trackEvent(name, props)` — обёртка над `window.plausible(name, { props })`
- Graceful degradation: если Plausible заблокирован (ad blocker), вызовы просто игнорируются (no-op)
- Экспорт отдельных функций-хелперов для типизированных событий

### 1.2. Скрипт Plausible в `index.html`

Добавить `<script>` тег с настройками:
- `defer`, `data-domain` из env-переменной `VITE_PLAUSIBLE_DOMAIN`
- `data-api` из env-переменной `VITE_PLAUSIBLE_API` (для прокси)
- `src` из env-переменной `VITE_PLAUSIBLE_SRC` (по умолчанию `https://plausible.io/js/script.js`)
- Скрипт рендерится только если `VITE_PLAUSIBLE_DOMAIN` задан (через Vite HTML transform)
- SPA-навигация через History API обрабатывается Plausible автоматически

### 1.3. Расширенный набор событий

Точки интеграции (вызовы `trackEvent`):

| Событие | Файл | Момент | Props |
|---------|------|--------|-------|
| `book_opened` | `BookshelfScreen.js` | Клик «Читать» | `{ book_id }` |
| `chapter_completed` | `NavigationDelegate.js` | Последняя страница главы | `{ book_id, chapter_index }` |
| `reading_session_start` | `LifecycleDelegate.js` | `openBook()` | `{ book_id }` |
| `reading_session_end` | `LifecycleDelegate.js` | `closeBook()` / `beforeunload` | `{ book_id, pages_read, duration_sec }` |
| `settings_changed` | `SettingsDelegate.js` | Любое изменение | `{ setting, value }` |
| `book_published` | `AccountPublishTab.js` | Публикация книги | `{ book_id }` |
| `book_imported` | `BookUploadManager.js` | Успешный импорт | `{ format }` (txt/epub/fb2/doc/docx) |
| `export_config` | `ExportModule.js` | Экспорт конфига | — |
| `guest_registered` | `AuthModal.js` | Успешная регистрация | `{ method }` (email/google) |
| `theme_changed` | `ThemeController.js` | Смена темы | `{ theme }` (light/dark/bw) |
| `font_changed` | `FontController.js` | Смена шрифта | `{ font }` |
| `language_changed` | `i18n/index.js` | `setLanguage()` | `{ language }` |

### 1.4. Reading Session Tracking

Реализация через аналитические события (без серверной таблицы):
- При `openBook()` — запомнить `startTime` и `startPage` в памяти
- При `closeBook()` / `beforeunload` / `visibilitychange(hidden)` — отправить `reading_session_end` с `duration_sec` и `pages_read`
- Использовать `navigator.sendBeacon` через Plausible callback для надёжной отправки при закрытии

### 1.5. Vite конфигурация

В `vite.config.js` добавить HTML-трансформ плагин (или использовать `vite-plugin-html-includes`):
- При наличии `VITE_PLAUSIBLE_DOMAIN` — инжектить `<script>` в `<head>`
- При отсутствии — ничего не делать (dev-режим по умолчанию без аналитики)

---

## Часть 2: Lighthouse CI

### 2.1. Конфигурация (`lighthouserc.json`)

Создать в корне проекта:
- `staticDistDir: "./dist"` + `isSinglePageApplication: true`
- 3 прогона (`numberOfRuns: 3`) для стабильности
- Пороги:
  - Performance: `warn` при < 0.85 (не блокирует)
  - Accessibility: `error` при < 0.90
  - Best Practices: `error` при < 0.90
  - SEO: `error` при < 0.90
- `temporaryPublicStorage: true` для отчётов

### 2.2. GitHub Actions workflow (`.github/workflows/lighthouse.yml`)

Отдельный workflow:
- Триггер: `pull_request` + `push` на `main`
- Шаги: checkout → setup-node → npm ci → npm run build → `treosh/lighthouse-ci-action@v12`
- Результаты: ссылка в GitHub status check + артефакты
- Не блокирует деплой (отдельный workflow)

---

## Файлы для создания/изменения

**Новые файлы:**
1. `js/utils/Analytics.js` — модуль аналитики
2. `.github/workflows/lighthouse.yml` — Lighthouse CI workflow
3. `lighthouserc.json` — Lighthouse конфигурация

**Изменяемые файлы:**
4. `index.html` — Plausible script tag (условный, через Vite)
5. `vite.config.js` — HTML transform для Plausible скрипта
6. `js/index.js` — вызов `initAnalytics()` при старте
7. `js/core/BookshelfScreen.js` — `book_opened`
8. `js/core/delegates/NavigationDelegate.js` — `chapter_completed`
9. `js/core/delegates/LifecycleDelegate.js` — `reading_session_start/end`
10. `js/core/delegates/SettingsDelegate.js` — `settings_changed`
11. `js/core/AccountPublishTab.js` — `book_published`
12. `js/admin/modules/BookUploadManager.js` — `book_imported`
13. `js/admin/modules/ExportModule.js` — `export_config`
14. `js/core/AuthModal.js` — `guest_registered`
15. `js/core/delegates/ThemeController.js` — `theme_changed`
16. `js/core/delegates/FontController.js` — `font_changed`
17. `js/i18n/index.js` — `language_changed`
