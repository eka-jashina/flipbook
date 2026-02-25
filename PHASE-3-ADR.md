# ADR: Фаза 3 — Интеграция фронтенда с серверным API

**Статус:** Принято
**Дата:** 2026-02-25

## Контекст

Фазы 1–2 реализовали серверный API (Express + Prisma + PostgreSQL): аутентификация, CRUD книг/глав/шрифтов/звуков/оформления, импорт/экспорт. Фаза 3 — подключение существующего фронтенда (vanilla JS, ES Modules) к этому API вместо localStorage/IndexedDB.

---

## Решения

### 1. ApiClient — один класс, один файл

**Файл:** `js/utils/ApiClient.js`

- Единственный класс с базовым `fetch(path, options)` и методами для каждого ресурса
- Обработка 401: колбэк `_onUnauthorized` → показ экрана логина (без retry/refresh — сессия 7 дней)
- ~30-40 методов для 12 ресурсов — нормальный размер для одного класса
- Разбивка на отдельные модули (`booksApi.js`, `authApi.js`) — преждевременная декомпозиция

### 2. Аутентификация — модальное окно в index.html, email/password

- **Модальное окно** поверх bookshelf, не отдельная страница (SPA-подобная архитектура)
- **Только email/password** на старте. Google OAuth отложен (зависимость на GOOGLE_CLIENT_ID, Google Console, домен)
- **Поток:** `GET /api/auth/me` → если 401 → модалка логина/регистрации → если 200 → bookshelf с книгами

### 3. Миграция localStorage — при первом логине, удалять после импорта

- При первом логине: если `GET /api/books` пусто и в localStorage/IndexedDB есть `flipbook-admin-config` → диалог «Импортировать локальные данные?»
- При «Да» → `POST /api/import` → удаление localStorage и IndexedDB
- При «Нет» → удаление локальных данных, чистый аккаунт
- **Два источника правды не держать** — гарантированный путь к багам рассинхронизации

### 4. Оффлайн — не в Фазе 3, но заложить интерфейс

- При ошибке сети — чёткое сообщение пользователю, без localStorage fallback
- Все вызовы через единый `fetch` метод в ApiClient — в Фазе 4 добавится перехват ошибок, sync queue
- Ридер после первой загрузки работает из памяти — основной сценарий чтения не ломается
- При невозможности сохранить прогресс — сообщение «нет соединения, прогресс не сохранён»

### 5. Контент глав — через API, не через S3

- **Эндпоинт:** `GET /api/books/:bookId/chapters/:chapterId/content`
- Авторизация из коробки (сессия), не нужны signed URLs
- `ContentLoader.js` уже умеет работать с inline-контентом — минимум переделок
- Большие главы (EPUB с base64 картинками, 5-10 МБ) — допустимо на данном этапе
- Оптимизация (вынос картинок в S3) — отдельная задача на будущее

### 6. Admin модули — адаптер ServerAdminConfigStore, не переписывать модули

- **Файл:** `js/admin/ServerAdminConfigStore.js` — тот же интерфейс, что у `AdminConfigStore`, но внутри — вызовы API
- 10 модулей (`ChaptersModule`, `SoundsModule`, `AppearanceModule`...) продолжают работать без изменений через `this.store.*`
- Замена одной строки: `AdminConfigStore.create()` → `ServerAdminConfigStore.create(apiClient)`
- Методы становятся `async` — в модулях добавить `await` где необходимо (минимальное изменение)
- В Фазе 4 в `ServerAdminConfigStore` добавится кэш + sync queue — модули об этом не узнают

---

## Порядок реализации

| # | Задача | Ключевые файлы |
|---|--------|-----------------|
| 1 | `ApiClient.js` — базовый класс с fetch, обработкой ошибок, 401 | `js/utils/ApiClient.js` |
| 2 | Модалка auth в `index.html` — логин/регистрация (email/password) | `index.html`, `css/auth.css`, `js/core/AuthModal.js` |
| 3 | `config.js` — асинхронная загрузка через API вместо localStorage | `js/config.js` |
| 4 | `BookshelfScreen.js` — книги из API, continue reading из API | `js/core/BookshelfScreen.js` |
| 5 | `ServerAdminConfigStore.js` — адаптер store → API | `js/admin/ServerAdminConfigStore.js` |
| 6 | Миграция localStorage при первом логине | `js/core/MigrationHelper.js` |
| 7 | `ContentLoader.js` — загрузка контента через API | `js/managers/ContentLoader.js` |
| 8 | `SettingsManager.js` — debounced sync прогресса на сервер | `js/managers/SettingsManager.js` |

---

## Последствия

- **Положительные:** минимальные изменения в существующих модулях; чёткое разделение фаз; нет преждевременной оптимизации
- **Компромиссы:** большие главы передаются через API (не оптимально для >10 МБ); нет офлайн-режима в Фазе 3
- **Риски:** асинхронизация `config.js` может потребовать изменения точки входа (`index.js`); переход `store.*` на async может затронуть цепочки вызовов в модулях
