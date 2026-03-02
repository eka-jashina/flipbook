# Ревью бэкенда Flipbook — взгляд опытного бэкенд-разработчика

> Дата: 2026-03-01
> Проанализирован: `server/` — Express 5 + Prisma + PostgreSQL + S3

---

## Общая оценка: 8.2 / 10

Это **зрелый, production-ready бэкенд** с продуманной архитектурой, хорошей безопасностью и приличным покрытием тестами. Проект значительно выше среднего для персонального/pet-проекта и сопоставим с коммерческими MVP.

---

## 1. Архитектура и структура проекта

### Что хорошо (сильные стороны)

**Чёткое послойное разделение:**
```
routes/ → services/ → utils/prisma.ts → PostgreSQL
                    → utils/storage.ts → S3
middleware/ (сквозные аспекты: auth, CSRF, validation, rate limiting, upload, ownership)
```

Каждый слой имеет ясную ответственность. Роуты — тонкие (вызов validate + asyncHandler + вызов сервиса + ответ). Бизнес-логика сосредоточена в сервисах. Утилиты — чистые функции и инфраструктурные обёртки. Это каноническая архитектура для Express-приложений, легко масштабируемая и понятная новому разработчику.

**13 ресурсных групп** с полным CRUD покрытием: books, chapters, appearance, sounds, ambients, decorativeFont, defaultSettings, fonts, settings, progress, upload, export/import, auth. Каждый ресурс — отдельный файл роутов и сервис. Единая конвенция именования: `*.routes.ts` + `*.service.ts`.

**Типобезопасность:** TypeScript покрывает весь бэкенд. DTO-маппинг (`mappers.ts`) явно отделяет внутренние модели Prisma от API-ответов — passwordHash никогда не утекает. Типы API (`types/api.ts`) создают единый контракт.

**Конфигурация через Zod** (`config.ts`) — все переменные окружения валидируются при старте с чёткими сообщениями об ошибках. Разделение dev/production дефолтов (S3 креды, CORS, secure cookies).

### Что можно улучшить

**Нет явного слоя репозиториев.** Сервисы напрямую вызывают `getPrisma()`. Это работает при текущем размере, но при росте проекта замена Prisma или юнит-тестирование бизнес-логики без БД станет затруднительной. Внедрение тонкого Repository-интерфейса повысило бы тестируемость. *(Актуально)*

**Singleton-паттерн для Prisma и S3** через мутабельные переменные модуля (`let prisma: PrismaClient | null = null`). Работает, но делает юнит-тестирование сложнее — нельзя подменить зависимость без monkey-patching. В идеале — DI-контейнер или фабрика, передающая зависимости вниз. *(Актуально)*

**Нет разделения на bounded contexts.** Все 13 ресурсов живут в одном плоском пространстве. Пока это не проблема, но при росте (например, добавление комментариев, социальных фич, аналитики) стоит группировать по доменам. *(Актуально)*

---

## 2. Безопасность

### Что хорошо — и это впечатляет

Безопасность — одна из самых сильных сторон проекта. Видно, что автор хорошо знаком с OWASP и типичными атаками.

**Аутентификация:**
- Bcrypt с 12 раундами (файл `password.ts`) — отличный выбор.
- Session regeneration после login/register/OAuth (`auth.routes.ts:26-39`) — предотвращает session fixation.
- Passport с local + Google OAuth стратегиями.
- Защита от account pre-hijacking: Google OAuth не связывается с аккаунтами, у которых уже есть пароль (`auth.ts:151-158`). Это продуманный и нетривиальный кейс.

**CSRF:**
- Double-submit cookie pattern через `csrf-csrf` (`csrf.ts`), привязка к sessionID.
- Отдельный эндпоинт `/api/auth/csrf-token` для SPA.

**Password Reset:**
- 32 байта криптографического рандома, хэш SHA-256 для хранения (правильно — токен уже случайный, bcrypt избыточен).
- Атомарный `updateMany` с WHERE по хэшу токена — предотвращает race condition при concurrent reset (`auth.service.ts:170-182`).
- Инвалидация всех сессий после сброса через raw SQL по JSON-полю `passport.user` в таблице sessions.
- Защита от email enumeration — forgot-password всегда возвращает 200.

**Input validation:**
- Zod-схемы на всех эндпоинтах (`schemas.ts`).
- `isSafeUrl()` блокирует `javascript:`, `vbscript:`, `data:` (кроме `data:font/`) — защита от URI-scheme атак.
- Лимиты на размер тела запроса: 256 KB по умолчанию, 3 MB для глав, 10 MB для импорта.

**XSS:**
- DOMPurify через JSDOM на сервере (`sanitize.ts`) — санитизация HTML глав при создании И обновлении.
- Явный whitelist тегов и атрибутов, `ALLOW_DATA_ATTR: false`.

**SQL Injection:**
- Prisma параметризует все запросы.
- Даже raw SQL в `reorder.ts` использует `Prisma.sql` tagged templates.
- `bulkUpdatePositions` проверяет таблицу по whitelist перед формированием запроса.

**Rate limiting:**
- 3 уровня: общий (100/мин), auth (5/мин), public (30/мин).
- Корректно отключен в тестах.

**Helmet** + `security_opt: no-new-privileges` в Docker.

### Замечания по безопасности

**Несогласованность ownership-проверок — главная проблема.**

В `app.ts:197` видна централизованная проверка:
```typescript
app.use('/api/books/:bookId', requireAuth, requireBookOwnership);
```

Это покрывает все под-ресурсы книг через middleware. **Однако** роуты books.routes.ts дополнительно навешивают `requireBookOwnership` на каждый эндпоинт с `:bookId` (GET, PATCH, DELETE) — что приводит к **двойному вызову** `verifyBookOwnership` для одного запроса. Это не баг, но лишний запрос к БД на каждый запрос к книге. Под-ресурсы (chapters, sounds, ambients и т.д.) не дублируют — только прямые роуты books.

**Рекомендация:** Убрать дублирующий `requireBookOwnership` из отдельных роутов в `books.routes.ts`, раз он уже установлен глобально в `app.ts`. *(Актуально)*

**MIME-type валидация загрузок полагается на клиентский Content-Type.** `application/octet-stream` разрешён в font и book uploads — это позволяет обойти проверку типа. Для продакшена стоит добавить проверку magic bytes (файловых сигнатур). *(Актуально — все 4 типа загрузок (font, sound, image, book) проверяют только mimetype, magic bytes не проверяются)*

**Нет ограничения на количество сессий на пользователя.** Злоумышленник с валидными кредами может создать неограниченное количество сессий, заполняя таблицу session. Стоит либо лимитировать, либо добавить cleanup. *(Актуально)*

**~~Нет Content-Security-Policy на API-ответы.~~** ✅ РЕШЕНО — Helmet применяется глобально в `app.ts` (строки 65–77) с настроенным CSP. Для JSON API-ответов CSP не релевантен, но `X-Content-Type-Options: nosniff` устанавливается Helmet по умолчанию, что защищает от MIME-sniffing.

---

## 3. Работа с базой данных

### Что хорошо

**Prisma-схема спроектирована грамотно:**
- UUID v4 как первичные ключи (`gen_random_uuid()`) — нет sequential ID enumeration.
- Каскадное удаление на всех FK — удаление книги автоматически чистит главы, ambient'ы, настройки.
- Составные индексы: `@@index([userId, position])` для сортированных списков, `@@unique([userId, bookId])` для reading progress.
- Чёткий маппинг между camelCase (JS) и snake_case (DB) через `@map`.
- `@db.Timestamptz()` для дат — корректная обработка часовых поясов.

**Serializable transactions с retry** (`serializable.ts`) для позиционных операций — правильный подход к race conditions при создании элементов с автоинкрементом position.

**Bulk reorder** через один SQL UPDATE с CASE WHEN (`reorder.ts`) — эффективнее, чем N отдельных UPDATE.

**Ограничения ресурсов** (`limits.ts`): 100 книг/пользователь, 200 глав/книга, 50 шрифтов, 20 ambient'ов — предотвращает resource exhaustion.

### Замечания

**~~Нет soft delete.~~** ✅ РЕШЕНО — Модель `Book` имеет поле `deletedAt DateTime?` в `schema.prisma`. Фильтрация реализована через хелпер `activeBooks(userId)` в `books.service.ts`. Есть составной индекс `@@index([userId, deletedAt])`.

**~~Нет оптимистичной блокировки на обычных update'ах.~~** ✅ РЕШЕНО — Реализована оптимистичная блокировка через `ifUnmodifiedSince` в `books.service.ts`, `chapters.service.ts`, `progress.service.ts`. При конфликте возвращается `409 CONFLICT_DETECTED`.

**~~ReadingProgress хранит настройки (font, fontSize, theme и т.д.)~~** ✅ РЕШЕНО — `ReadingProgress` теперь содержит только `page` и `updatedAt`. Настройки вынесены в отдельную модель `ReadingPreferences` (font, fontSize, theme, soundEnabled и т.д.).

**Нет миграции вниз (down migrations).** ~~Prisma миграции — только вперёд.~~ Частично решено — у большинства миграций есть `down.sql` (init, add_updated_at_fields, soft_delete_split_progress_pool). Однако миграция `add_username_visibility` не имеет `down.sql`. *(Частично актуально)*

**~~Нет connection pooling конфигурации.~~** ✅ РЕШЕНО — `connection_limit` и `pool_timeout` настроены в `docker-compose.yml` (`connection_limit=10&pool_timeout=10`). В `config.ts` задокументированы рекомендации для dev и prod окружений.

---

## 4. API Design

### Что хорошо

**RESTful конвенции соблюдаются:**
- `GET /api/books` — список, `POST /api/books` — создание.
- `GET /api/books/:id` — детали, `PATCH /api/books/:id` — частичное обновление, `DELETE` — удаление.
- Вложенные ресурсы: `/api/books/:bookId/chapters`.
- `PATCH /reorder` — именованная операция для массового обновления позиций.
- 201 для создания, 204 для удаления, 200 для остального.

**Единый формат ответов** через `ok()` и `created()` хелперы:
```json
{ "data": { ... }, "meta": { ... } }
```

**Пагинация:** `limit/offset` для списка книг с `total` в ответе.

**OpenAPI/Swagger** автогенерируется из Zod-схем через кастомный `zodToOpenApi()` конвертер — документация всегда синхронизирована с валидацией.

### Замечания

**Нет версионирования API** (`/api/v1/...`). При изменении контракта придётся ломать клиентов или городить хаки. *(Актуально)*

**Пагинация только для книг.** Остальные списки (chapters, ambients, fonts) возвращаются полностью. При 200 главах с htmlContent это может быть проблемой. Впрочем, `getChapters()` не возвращает htmlContent — только метаданные. Это правильно. *(Актуально, но некритично)*

**PATCH для reorder** — спорный выбор. Семантически это скорее action, не частичное обновление ресурса. `POST /api/books/reorder` был бы яснее. Но это вкусовщина. *(Актуально, но вкусовщина)*

**Нет ETag/If-Match для кэширования и конкурентных обновлений.** Для e-book reader'а с offline-режимом это было бы особенно полезно. *(Актуально — при этом оптимистичная блокировка через `ifUnmodifiedSince` уже реализована как альтернатива If-Match)*

**Health check** (`app.ts:116-148`) — грамотный, проверяет и DB, и S3, возвращает degraded вместо ошибки. ~~Единственное замечание — health-эндпоинт не защищён от спама (не за rate limiter'ом).~~ ✅ РЕШЕНО — health endpoint находится по пути `/api/health` и покрывается глобальным rate limiter `app.use('/api/', createRateLimiter())`, который применяется раньше.

---

## 5. Обработка ошибок

### Что хорошо — эталонная реализация

**Централизованный error handler** (`errorHandler.ts`) обрабатывает все типы ошибок:
- `AppError` — кастомные бизнес-ошибки с кодом и деталями.
- `ZodError` — ошибки валидации с подробностями (path, message).
- `MulterError` — ошибки загрузки (413 для размера, 400 для типа).
- `PrismaClientKnownRequestError` — P2002 (409, без утечки имён полей), P2025 (404), P2003 (409).
- Ошибки CSRF — проброс statusCode.
- Неизвестные ошибки — 500 с generic message, детальный лог.

**Security logging:** 401, 403, 429 логируются как warn для мониторинга.

**RequestId** в каждом ответе об ошибке — позволяет трейсить проблему в логах.

**Утечки внутренней информации нет:** Prisma error codes, имена полей, stack traces — не попадают в ответ.

**asyncHandler** (`asyncHandler.ts`) — элегантный паттерн, устраняющий try/catch бойлерплейт. Работает корректно.

### Замечания

**Нет различия между клиентскими и серверными ошибками в формате ответа.** И 400, и 500 имеют одинаковую структуру `{ error, message, statusCode }`. Это скорее преимущество (единообразие), но некоторые команды предпочитают разные форматы. *(Не проблема — единообразие лучше)*

**Нет retry-логики для transient DB errors** (connection timeout, pool exhaustion). Serializable retry обрабатывает только P2034. Стоит добавить обработку connection errors. *(Актуально)*

---

## 6. Тестирование

### Что хорошо

**~207 тест-кейсов** (не 99, как было в начальной оценке) покрывают все 16 endpoint-групп (включая health и profile). Тесты через supertest проверяют реальный HTTP-стек (middleware → route → service → DB).

**Тестовая инфраструктура грамотная:**
- `cleanDatabase()` чистит в правильном FK-порядке.
- `createAuthenticatedAgent()` создаёт сессию + CSRF одним вызовом.
- `wrapAgentWithCsrf()` автоматически добавляет CSRF-хедер к мутирующим запросам.

**Что тестируется:**
- CRUD операции — happy path.
- Auth: регистрация, логин, дубликат email, слабые пароли.
- Ownership: доступ к чужим ресурсам → 403.
- CSRF: мутация без токена → 403.
- Валидация: некорректные данные → 400 с деталями.
- Лимиты ресурсов.
- Export/Import — полный цикл.
- File parsing (txt, fb2).

### Замечания — важные

**Нет юнит-тестов сервисов.** Все тесты — интеграционные через HTTP. Сервисная логика (sanitization, position calculation, S3 cleanup) не тестируется изолированно. При росте проекта это станет узким местом — интеграционные тесты медленные. *(Актуально)*

**Нет тестов на конкурентность.** Serializable retry — ключевой механизм, но ни один тест не создаёт race condition. Стоит добавить тесты с параллельными запросами на создание элементов с position. *(Актуально)*

**Нет тестов на edge cases парсеров.** Upload-тесты проверяют txt и fb2, но не docx, epub, doc. Учитывая сложность этих парсеров (особенно DOC с OLE2), это серьёзный пробел. *(Актуально)*

**Нет нагрузочных тестов.** Для проекта с rate limiting и connection pooling это было бы полезно. *(Актуально)*

**Coverage неизвестен.** Нет настроенного coverage-отчёта для серверных тестов (в package.json нет `test:coverage`). *(Актуально)*

**`fileParallelism: false`** в конфиге vitest — тесты идут последовательно. Правильно для консистентности БД, но замедляет CI. *(Осознанное решение, не проблема)*

---

## 7. Парсеры книг

### Что хорошо

5 форматов (TXT, DOC, DOCX, EPUB, FB2) — впечатляющий набор. Каждый парсер возвращает унифицированный `ParsedBook { title, author, chapters[] }`.

**DOC-парсер** (`DocParser.ts`) — реализация парсинга OLE2 формата с нуля (Piece Table, FAT navigation, CP1252 mapping). Это сложная и качественная работа.

**EPUB-парсер** корректно обрабатывает OPF metadata, spine order, image embedding (base64 data URLs).

**FB2-парсер** поддерживает рекурсивный парсинг секций, embedded images, стихи, эпиграфы.

### Замечания

**Нет ограничения на размер распарсенных данных.** Файл 50 MB после парсинга может сгенерировать HTML, значительно превышающий лимиты. Стоит добавить проверку размера выходных данных. Import-схема в `exportImport.service.ts` ограничивает `htmlContent` до 2 MB, но парсеры сами не проверяют суммарный размер выходных данных. *(Актуально)*

**Парсеры не обрабатывают malformed-файлы gracefully.** Некорректный EPUB или DOC может вызвать uncaught exception. `BookParser.ts` не оборачивает вызовы парсеров в try/catch. DocParser использует loop guards (1000/10000/100000 итераций) для защиты от бесконечных циклов, но при ошибке возвращает null без контекста. Fb2Parser имеет рекурсивный парсинг без ограничения глубины (риск stack overflow). *(Актуально)*

**Нет timeout на парсинг.** Сложный DOC-файл может парситься долго, блокируя event loop. `upload.service.ts` и `upload.routes.ts` не оборачивают вызов парсера в `Promise.race()` с таймаутом. *(Актуально)*

---

## 8. Инфраструктура и DevOps

### Что хорошо

**Docker Compose** — полный стек (PostgreSQL 17, MinIO, server) с healthcheck'ами и `service_healthy` условиями. `minio-init` контейнер для автоматического создания bucket'а — правильный подход.

**Dockerfile** — multi-stage build (frontend → backend → production). Alpine-базы, dumb-init для PID 1, non-root user (`appuser`), HEALTHCHECK, `npm ci --omit=dev` + cache clean.

**Graceful shutdown** (`index.ts:32-51`) — обработка SIGTERM/SIGINT с 10-секундным таймаутом, `.unref()` на таймере. `unhandledRejection` и `uncaughtException` логируются.

**Sentry** — опциональная интеграция для мониторинга ошибок в production.

**Pino** для логирования — structured JSON в production, pretty-print в development, silent в тестах.

### Замечания

**~~Нет CI/CD для бэкенда.~~** ✅ РЕШЕНО — Существует `.github/workflows/server-tests.yml`: запускается на push в main и на PR при изменениях в `server/**`. Поднимает PostgreSQL 17 контейнер с healthcheck, прогоняет полный тест-сюит.

**Docker Compose использует dev-секреты в environment:** `SESSION_SECRET: dev-session-secret-change-in-production-min32chars`. Для production нужен .env файл или secrets management. Это очевидно для dev, но стоит добавить docker-compose.prod.yml. *(Актуально)*

**Нет health check endpoint для readiness vs liveness.** `/api/health` проверяет всё — и DB, и S3. Kubernetes требует разделения: liveness (процесс жив) и readiness (готов принимать трафик). *(Актуально)*

**Нет миграций как часть CI.** `prisma migrate deploy` выполняется в CMD Dockerfile — при ошибке миграции контейнер упадёт. Стоит разделить миграцию и запуск. *(Актуально)*

---

## 9. Качество кода

### Что хорошо

**Единообразие.** Все роуты следуют одному паттерну: `router.method(path, middleware[], asyncHandler(handler))`. Все сервисы — чистые async-функции. Маппинг через отдельные mapper-функции.

**Минимализм.** Нет over-engineering'а. Utility-файлы (`asyncHandler.ts` — 15 строк, `response.ts` — 19 строк, `password.ts` — 14 строк) делают ровно одну вещь. Нет абстракций ради абстракций.

**Хорошая обработка nullable-полей.** Selective update'ы через spread с проверкой `undefined`:
```typescript
...(data.title !== undefined && { title: data.title })
```

**Дефолты вынесены в `defaults.ts`** — единый источник правды, зеркалирующий schema.prisma `@default`.

### Замечания

**Дублирование маппинга.** `getBookById()` в books.service.ts и `exportUserConfig()` в exportImport.service.ts дублируют один и тот же маппинг BookDetail (~28 строк). Стоит извлечь в общую функцию. *(Актуально)*

**Magic strings.** Тема `'light'`/`'dark'` проверяется через строковые литералы в appearance.service.ts (сигнатура `theme: 'light' | 'dark'`). Стоит использовать enum или const. *(Актуально)*

**Нет JSDoc на сервисных функциях** (кроме отдельных). Для библиотечного кода документация важна. *(Актуально)*

---

## 10. S3 / файловое хранилище

### Что хорошо

**Абстракция через утилиты** (`storage.ts`): `uploadFile`, `deleteFile`, `generateFileKey`, `extractKeyFromUrl` — чистые функции, легко заменить провайдера.

**UUID в ключах** (`generateFileKey`) — нет коллизий при конкурентных загрузках.

**Best-effort cleanup** при удалении книги (`books.service.ts:268-283`): `Promise.allSettled` + логирование orphaned URL'ов. Правильный паттерн — не блокировать DB-операцию из-за S3.

**`extractKeyFromUrl`** с корректным URL parsing и origin-проверкой — защита от SSRF через подменённый URL.

### Замечания

**Нет автоматической очистки orphaned файлов.** Если S3 cleanup при удалении книги не сработал, файлы остаются навсегда. `books.service.ts` логирует orphaned URL'ы для ручной очистки, но автоматического cron job нет. *(Актуально)*

**Нет S3 presigned URLs.** Все файлы доступны по прямому публичному URL. `storage.ts` экспортирует `getPublicUrl()`, но не имеет функции генерации presigned URLs. Для приватного контента стоит использовать presigned URLs с ограниченным сроком. *(Актуально)*

**Нет content-type verification на уровне S3.** Файл загружается с клиентским content-type без проверки magic bytes. Злоумышленник может загрузить HTML как `image/png` и получить XSS при прямом доступе к S3. *(Актуально)*

---

## 11. Зависимости

### Что хорошо

**Выбор зависимостей осмысленный:**
- Express 5 (latest), Prisma 6, bcrypt, passport, pino, zod, helmet — зрелые, поддерживаемые библиотеки.
- DOMPurify для санитизации — лучший выбор в экосистеме.
- `csrf-csrf` — современная альтернатива устаревшему `csurf`.

**Минимум зависимостей.** Нет лишнего — каждая библиотека решает конкретную задачу.

### Замечания

**`vitest: ^2.0.0` в server/package.json, но `vitest: ^4.0.18` в корневом package.json.** Несогласованность мажорных версий может привести к проблемам. *(Актуально)*

**~~Нет `@types/express@5`.~~** ✅ РЕШЕНО — `@types/express: ^5.0.0` в server/package.json корректно соответствует `express: ^5.0.1`.

**Нет dependabot или renovate** для автоматических обновлений безопасности. *(Актуально)*

---

## 12. Итоговая таблица

| Аспект | Оценка | Было | Стало после доработок |
|--------|--------|------|----------------------|
| **Архитектура** | 8/10 | Нет DI и repository layer | Без изменений — актуально |
| **Безопасность** | 9/10 | Замечания по MIME, сессиям, CSP | CSP ✅ решено (Helmet). MIME и сессии — актуально |
| **База данных** | 8→9/10 | Нет soft delete, оптимистичной блокировки, connection pooling | Soft delete ✅, оптимистичная блокировка ✅, connection pooling ✅, ReadingProgress разделён ✅ |
| **API Design** | 8/10 | Нет версионирования, ETag, health не rate-limited | Health rate-limited ✅. Версионирование и ETag — актуально |
| **Обработка ошибок** | 9/10 | Все типы обработаны, нет утечек | Без изменений |
| **Тестирование** | 7→7.5/10 | 99 кейсов, нет юнит-тестов, coverage | ~207 кейсов, 16 файлов. Юнит-тесты и coverage — актуально |
| **Парсеры** | 8/10 | Нет error handling и timeout | Без изменений — актуально |
| **Инфраструктура** | 8→9/10 | Нет CI для бэкенда | CI ✅ (server-tests.yml). Docker секреты и liveness/readiness — актуально |
| **Качество кода** | 8.5/10 | Минорное дублирование | Без изменений — актуально |
| **Хранилище файлов** | 7.5/10 | Нет presigned URLs и orphan cleanup | Без изменений — актуально |

---

## 13. Рекомендации по приоритету

### Критические (P0)

1. ~~**Добавить серверные тесты в CI/CD**~~ ✅ РЕШЕНО — `.github/workflows/server-tests.yml`.
2. **Добавить timeout и error handling в парсеры книг** — malformed файлы могут повесить сервер. *(Актуально)*
3. **Убрать дублирование requireBookOwnership** в books.routes.ts (двойной запрос к БД). *(Актуально)*

### Важные (P1)

4. **Добавить юнит-тесты сервисов** — ускорит feedback loop и поймает баги в бизнес-логике. *(Актуально)*
5. **Добавить content-type verification по magic bytes** для загружаемых файлов. *(Актуально)*
6. **Добавить API versioning** (`/api/v1/`) до первого production-деплоя. *(Актуально)*
7. **Настроить test coverage** для серверных тестов. *(Актуально)*

### Желательные (P2)

8. ~~Добавить connection pool настройки для Prisma.~~ ✅ РЕШЕНО.
9. Разделить health check на liveness и readiness. *(Актуально)*
10. Добавить cron job для очистки orphaned S3 файлов. *(Актуально)*
11. Рассмотреть presigned URLs для приватного контента. *(Актуально)*
12. ~~Добавить rate limiting на health endpoint.~~ ✅ РЕШЕНО — покрыт глобальным `/api/` rate limiter.

---

## Заключение

Бэкенд Flipbook — это **качественная, безопасная и хорошо структурированная серверная часть**. Автор демонстрирует глубокое понимание веб-безопасности (session fixation, CSRF, account hijacking, XSS), правильно работает с транзакциями и конкурентностью, и поддерживает высокий уровень единообразия кода.

Основные зоны роста — тестирование (юнит-тесты + coverage) и операционная зрелость (versioning, presigned URLs, orphan cleanup). Это не критические проблемы, а естественные шаги эволюции от MVP к production-grade системе.

Для pet-проекта / портфолио — это **отличная работа**, демонстрирующая зрелый подход к бэкенд-разработке.

---

## Приложение: Статус замечаний (обновлено 2026-03-02)

### ✅ Решённые замечания (7):
1. **Soft delete** — реализован (`deletedAt` в модели Book, индекс, фильтрация в `activeBooks()`)
2. **Оптимистичная блокировка** — реализована (`ifUnmodifiedSince` в books, chapters, progress)
3. **ReadingProgress / Settings разделение** — `ReadingProgress` хранит только page, настройки в `ReadingPreferences`
4. **Connection pooling** — настроен в docker-compose.yml и документирован в config.ts
5. **CI/CD для бэкенда** — `.github/workflows/server-tests.yml` с PostgreSQL контейнером
6. **CSP / Helmet** — Helmet применяется глобально, `X-Content-Type-Options: nosniff` защищает JSON
7. **Health endpoint rate limiting** — покрыт глобальным `/api/` rate limiter
8. **@types/express совместимость** — v5.0.0 корректно соответствует express v5.0.1

### ⚠️ Актуальные замечания (по приоритету):

**P0 — Критические:**
- Timeout и error handling в парсерах книг
- Дублирование `requireBookOwnership` в books.routes.ts

**P1 — Важные:**
- Юнит-тесты сервисов (все тесты — интеграционные через HTTP)
- Content-type verification по magic bytes (все 4 типа загрузок)
- API versioning (`/api/v1/`)
- Test coverage для серверных тестов
- Vitest version mismatch (v2 vs v4)

**P2 — Желательные:**
- Liveness / readiness разделение health check
- Cron job для очистки orphaned S3 файлов
- Presigned URLs для приватного контента
- Ограничение сессий на пользователя
- Dependabot / Renovate для автообновлений
- Дублирование BookDetail маппинга (books.service / exportImport.service)
- Magic strings для тем ('light'/'dark')
- Down migration для `add_username_visibility`
- Docker secrets management для production
- Repository layer / DI
- JSDoc на сервисных функциях
- Bounded contexts
- Тесты на конкурентность, edge cases парсеров, нагрузку
