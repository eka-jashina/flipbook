# Backend Server Plan for Flipbook

## Обзор

Данный документ описывает план миграции Flipbook с клиентской архитектуры (localStorage + IndexedDB) на клиент-серверную с бэкенд-сервером. Все данные (книги, главы, настройки, файлы) хранятся на сервере, клиент взаимодействует через REST API.

### Текущий статус

| Фаза | Статус | Описание |
|-------|--------|----------|
| Фаза 1 | ✅ Готово | Фундамент: сервер, auth, CRUD книг/глав, S3, Docker |
| Фаза 2 | ✅ Готово | Полный API: все ресурсы, парсеры, экспорт/импорт |
| Фаза 3 | ⏳ Следующая | Интеграция фронтенда с API |
| Фаза 4 | 📋 Запланировано | Надёжность и UX (offline, sync) |
| Фаза 5 | 📋 Запланировано | Production readiness |
| Фаза 6–10 | 📋 Будущее | Фотоальбомы, биллинг, аналитика |

---

## 1. Технологический стек (реализован)

### 1.1 Серверный фреймворк

**Express 5 + TypeScript**

- Express ^5.0.1 — HTTP-сервер
- TypeScript ^5.7.0 — типизация
- tsx — запуск TS в dev-режиме
- pino — структурированное логирование

### 1.2 База данных

**PostgreSQL 17 + Prisma ORM**

- PostgreSQL 17 Alpine — основная БД
- Prisma ^6.0.0 — ORM, миграции, типогенерация
- S3-совместимое хранилище (MinIO для dev, AWS S3 для prod) — файлы (шрифты, звуки, обложки)

### 1.3 Аутентификация

**express-session + connect-pg-simple + Passport.js**

- Серверные сессии в PostgreSQL (connect-pg-simple)
- Passport.js стратегии: passport-local (email/password) + passport-google-oauth20
- httpOnly Secure cookie для session ID
- Session TTL: 7 дней
- На будущее: connect-redis при высокой нагрузке

### 1.4 Файловое хранилище

**S3-совместимое хранилище**

- Dev: MinIO в Docker (S3 API на порту 9000, консоль на 9001)
- Production: AWS S3 / DigitalOcean Spaces / Cloudflare R2
- Единый интерфейс через @aws-sdk/client-s3
- Лимиты: шрифты 400 КБ, звуки 2 МБ, изображения 5 МБ, книги 50 МБ

---

## 2. Схема базы данных (реализована)

### 2.1 ER-диаграмма

```
User 1──* Book
Book 1──* Chapter
Book 1──* Ambient
Book 1──1 BookAppearance
Book 1──1 BookSounds
Book 1──1 BookDefaultSettings
Book 1──0..1 DecorativeFont
User 1──* ReadingFont
User 1──1 GlobalSettings
User 1──* ReadingProgress (per book)
```

### 2.2 Модели Prisma (11 моделей)

#### User
```prisma
model User {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email        String   @unique @db.VarChar(255)
  passwordHash String?  // NULL для OAuth-only
  displayName  String?  @db.VarChar(100)
  avatarUrl    String?  @db.VarChar(500)
  googleId     String?  @unique @db.VarChar(255)
  // relations: books, readingFonts, globalSettings, readingProgress
}
```

#### Book
```prisma
model Book {
  id              String  @id @db.Uuid
  userId          String  @db.Uuid
  title           String  @default("") @db.VarChar(500)
  author          String  @default("") @db.VarChar(500)
  position        Int     @default(0)
  coverBg         String  @default("") @db.VarChar(500)
  coverBgMobile   String  @default("") @db.VarChar(500)
  coverBgMode     String  @default("default") @db.VarChar(20)
  coverBgCustomUrl String? @db.VarChar(500)
  // relations: chapters, ambients, appearance, sounds, defaultSettings, decorativeFont, readingProgress
  // indexes: [userId], [userId, position]
}
```

#### Chapter
```prisma
model Chapter {
  id          String  @id @db.Uuid
  bookId      String  @db.Uuid
  title       String  @default("") @db.VarChar(500)
  position    Int     @default(0)
  filePath    String? @db.VarChar(500)      // статический HTML (дефолтные главы)
  htmlContent String? @db.Text              // HTML (загруженные книги)
  bg          String  @default("") @db.VarChar(500)
  bgMobile    String  @default("") @db.VarChar(500)
  // indexes: [bookId], [bookId, position]
}
```

#### BookAppearance
```prisma
model BookAppearance {
  bookId  String @unique @db.Uuid
  fontMin Int    @default(14)
  fontMax Int    @default(22)
  // Light theme: coverBgStart, coverBgEnd, coverText, coverBgImageUrl,
  //              pageTexture, customTextureUrl, bgPage, bgApp
  // Dark theme:  аналогичные поля с dark-префиксом
}
```

#### BookSounds
```prisma
model BookSounds {
  bookId       String @unique @db.Uuid
  pageFlipUrl  String @default("sounds/page-flip.mp3")
  bookOpenUrl  String @default("sounds/cover-flip.mp3")
  bookCloseUrl String @default("sounds/cover-flip.mp3")
}
```

#### BookDefaultSettings
```prisma
model BookDefaultSettings {
  bookId        String  @unique @db.Uuid
  font          String  @default("georgia")
  fontSize      Int     @default(18)
  theme         String  @default("light")
  soundEnabled  Boolean @default(true)
  soundVolume   Float   @default(0.3)
  ambientType   String  @default("none")
  ambientVolume Float   @default(0.5)
}
```

#### Ambient
```prisma
model Ambient {
  id         String  @id @db.Uuid
  bookId     String  @db.Uuid
  ambientKey String  @db.VarChar(100)
  label      String  @db.VarChar(200)
  shortLabel String? @db.VarChar(50)
  icon       String? @db.VarChar(20)
  fileUrl    String? @db.VarChar(500)
  visible    Boolean @default(true)
  builtin    Boolean @default(false)
  position   Int     @default(0)
}
```

#### DecorativeFont
```prisma
model DecorativeFont {
  bookId  String @unique @db.Uuid
  name    String @db.VarChar(200)
  fileUrl String @db.VarChar(500)
}
```

#### ReadingFont (глобальные, per-user)
```prisma
model ReadingFont {
  id       String  @id @db.Uuid
  userId   String  @db.Uuid
  fontKey  String  @db.VarChar(100)
  label    String  @db.VarChar(200)
  family   String  @db.VarChar(300)
  builtin  Boolean @default(false)
  enabled  Boolean @default(true)
  fileUrl  String? @db.VarChar(500)
  position Int     @default(0)
}
```

#### GlobalSettings (per-user)
```prisma
model GlobalSettings {
  userId        String  @unique @db.Uuid
  fontMin       Int     @default(14)
  fontMax       Int     @default(22)
  visFontSize   Boolean @default(true)
  visTheme      Boolean @default(true)
  visFont       Boolean @default(true)
  visFullscreen Boolean @default(true)
  visSound      Boolean @default(true)
  visAmbient    Boolean @default(true)
}
```

#### ReadingProgress (per-book, per-user)
```prisma
model ReadingProgress {
  userId        String  @db.Uuid
  bookId        String  @db.Uuid
  page          Int     @default(0)
  font          String  @default("georgia")
  fontSize      Int     @default(18)
  theme         String  @default("light")
  soundEnabled  Boolean @default(true)
  soundVolume   Float   @default(0.3)
  ambientType   String  @default("none")
  ambientVolume Float   @default(0.5)
  @@unique([userId, bookId])
}
```

> **Будущие модели** (Фазы 6–10): Album, AlbumPage, AlbumPhoto, AlbumView, Subscription, UserBranding

---

## 3. REST API (реализован)

### 3.1 Аутентификация

#### Email + Password

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/api/auth/register` | Регистрация + автоматический вход |
| POST | `/api/auth/login` | Вход (создаёт сессию) |
| POST | `/api/auth/logout` | Выход (уничтожает сессию) |
| GET | `/api/auth/me` | Текущий пользователь |

#### Google OAuth 2.0

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/auth/google` | Редирект на Google |
| GET | `/api/auth/google/callback` | Callback → сессия → редирект |

**Формат ответа (login/register/me):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "Username",
    "avatarUrl": "https://...",
    "hasPassword": true,
    "hasGoogle": true
  }
}
```

### 3.2 Книги

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/books` | Список книг (для полки, с readingProgress) |
| POST | `/api/books` | Создать книгу |
| GET | `/api/books/:bookId` | Полная информация о книге |
| PATCH | `/api/books/:bookId` | Обновить метаданные |
| DELETE | `/api/books/:bookId` | Удалить книгу |
| PATCH | `/api/books/reorder` | Изменить порядок |

### 3.3 Главы

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/books/:bookId/chapters` | Список глав (мета, без контента) |
| POST | `/api/books/:bookId/chapters` | Добавить главу |
| GET | `/api/books/:bookId/chapters/:chapterId` | Глава с метаданными |
| PATCH | `/api/books/:bookId/chapters/:chapterId` | Обновить главу |
| DELETE | `/api/books/:bookId/chapters/:chapterId` | Удалить главу |
| PATCH | `/api/books/:bookId/chapters/reorder` | Изменить порядок |
| GET | `/api/books/:bookId/chapters/:chapterId/content` | HTML контент главы |

### 3.4 Внешний вид книги

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/books/:bookId/appearance` | Настройки внешнего вида |
| PATCH | `/api/books/:bookId/appearance` | Общие (fontMin, fontMax) |
| PATCH | `/api/books/:bookId/appearance/light` | Светлая тема |
| PATCH | `/api/books/:bookId/appearance/dark` | Тёмная тема |

### 3.5 Звуки

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/books/:bookId/sounds` | Звуки книги |
| PATCH | `/api/books/:bookId/sounds` | Обновить звуки |

### 3.6 Эмбиенты

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/books/:bookId/ambients` | Список эмбиентов |
| POST | `/api/books/:bookId/ambients` | Добавить |
| PATCH | `/api/books/:bookId/ambients/:ambientId` | Обновить |
| DELETE | `/api/books/:bookId/ambients/:ambientId` | Удалить |
| PATCH | `/api/books/:bookId/ambients/reorder` | Изменить порядок |

### 3.7 Шрифты

#### Декоративный шрифт (per-book)

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/books/:bookId/decorative-font` | Получить |
| PUT | `/api/books/:bookId/decorative-font` | Установить (upsert) |
| DELETE | `/api/books/:bookId/decorative-font` | Удалить |

#### Шрифты для чтения (global)

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/fonts` | Список |
| POST | `/api/fonts` | Добавить |
| PATCH | `/api/fonts/:fontId` | Обновить |
| DELETE | `/api/fonts/:fontId` | Удалить |
| PATCH | `/api/fonts/reorder` | Изменить порядок |

### 3.8 Настройки

#### Глобальные (per-user)

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/settings` | Глобальные настройки |
| PATCH | `/api/settings` | Обновить |

#### Дефолтные настройки книги (per-book)

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/books/:bookId/default-settings` | Дефолтные настройки |
| PATCH | `/api/books/:bookId/default-settings` | Обновить |

### 3.9 Прогресс чтения

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/books/:bookId/progress` | Получить прогресс |
| PUT | `/api/books/:bookId/progress` | Сохранить (upsert) |

### 3.10 Загрузка файлов

| Метод | Эндпоинт | Лимит | Форматы |
|-------|----------|-------|---------|
| POST | `/api/upload/font` | 400 КБ | .woff2, .woff, .ttf, .otf |
| POST | `/api/upload/sound` | 2 МБ | audio/* |
| POST | `/api/upload/image` | 5 МБ | image/* |
| POST | `/api/upload/book` | 50 МБ | .txt, .doc, .docx, .epub, .fb2 |

**POST /api/upload/book** — парсинг на сервере:
```json
{
  "title": "Parsed Title",
  "author": "Parsed Author",
  "chapters": [
    { "title": "Chapter 1", "html": "<p>Content...</p>" }
  ]
}
```

### 3.11 Экспорт/Импорт

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/export` | Экспорт всей конфигурации |
| POST | `/api/import` | Импорт конфигурации |

### 3.12 Health

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/health` | Проверка здоровья сервера |

### Будущие эндпоинты (Фазы 6–10)

<details>
<summary>Фотоальбомы, биллинг, аналитика, брендинг</summary>

#### Фотоальбомы (CRUD)

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/albums` | Список альбомов |
| POST | `/api/albums` | Создать альбом |
| GET | `/api/albums/:albumId` | Получить (со страницами и фото) |
| PATCH | `/api/albums/:albumId` | Обновить метаданные |
| DELETE | `/api/albums/:albumId` | Удалить (каскад + S3 cleanup) |
| POST | `/api/albums/:albumId/publish` | Опубликовать |
| POST | `/api/albums/:albumId/unpublish` | Снять с публикации |

#### Страницы альбома

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/api/albums/:albumId/pages` | Добавить страницу |
| PATCH | `/api/albums/:albumId/pages/:pageId` | Обновить (layout, frame, filter) |
| DELETE | `/api/albums/:albumId/pages/:pageId` | Удалить |
| PATCH | `/api/albums/:albumId/pages/reorder` | Изменить порядок |

#### Фото

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/api/albums/:albumId/pages/:pageId/photos` | Загрузить фото |
| POST | `/api/albums/:albumId/photos/batch` | Пакетная загрузка (до 50) |
| PATCH | `/api/albums/:albumId/photos/:photoId` | Обновить (caption, crop) |
| DELETE | `/api/albums/:albumId/photos/:photoId` | Удалить (+ S3) |

#### Публичные (без auth)

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/public/album/:slug` | Просмотр альбома |
| POST | `/api/public/album/:slug/verify-password` | Проверка пароля |
| POST | `/api/public/album/:slug/view` | Аналитика просмотра |

#### Биллинг (Stripe)

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/billing` | Текущий план |
| POST | `/api/billing/checkout` | Stripe Checkout Session |
| POST | `/api/billing/portal` | Stripe Customer Portal |
| POST | `/api/billing/webhook` | Stripe webhook |

#### Аналитика и брендинг

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/albums/:albumId/analytics` | Аналитика альбома |
| GET | `/api/analytics/dashboard` | Общий дашборд |
| GET | `/api/branding` | Настройки брендинга |
| PATCH | `/api/branding` | Обновить |

</details>

---

## 4. Структура серверного проекта (реализована)

```
server/
├── package.json              # Dependencies & scripts
├── tsconfig.json             # TypeScript config
├── Dockerfile                # Multi-stage production build
├── vitest.config.ts          # Test config
├── prisma/
│   ├── schema.prisma         # 11 моделей (User, Book, Chapter, ...)
│   ├── seed.ts               # Seed-скрипт (демо-данные)
│   └── migrations/           # Prisma миграции
│
├── src/
│   ├── index.ts              # Точка входа, graceful shutdown
│   ├── app.ts                # Express app, middleware, маршруты
│   ├── config.ts             # Zod-валидируемые env-переменные
│   │
│   ├── middleware/
│   │   ├── auth.ts           # Passport.js (local + Google OAuth), requireAuth
│   │   ├── errorHandler.ts   # AppError, Zod/Multer обработка
│   │   ├── validate.ts       # Zod-валидация body/query
│   │   ├── upload.ts         # Multer (memory → S3): font/sound/image/book
│   │   └── rateLimit.ts      # Rate limiting (100/60s general, 5/60s auth)
│   │
│   ├── routes/               # 13 route-файлов
│   │   ├── auth.routes.ts
│   │   ├── books.routes.ts
│   │   ├── chapters.routes.ts
│   │   ├── appearance.routes.ts
│   │   ├── sounds.routes.ts
│   │   ├── ambients.routes.ts
│   │   ├── decorativeFont.routes.ts
│   │   ├── fonts.routes.ts
│   │   ├── settings.routes.ts
│   │   ├── defaultSettings.routes.ts
│   │   ├── progress.routes.ts
│   │   ├── upload.routes.ts
│   │   └── exportImport.routes.ts
│   │
│   ├── services/             # 11 service-файлов
│   │   ├── auth.service.ts
│   │   ├── books.service.ts
│   │   ├── chapters.service.ts
│   │   ├── appearance.service.ts
│   │   ├── sounds.service.ts
│   │   ├── ambients.service.ts
│   │   ├── decorativeFont.service.ts
│   │   ├── fonts.service.ts
│   │   ├── settings.service.ts
│   │   ├── defaultSettings.service.ts
│   │   ├── progress.service.ts
│   │   └── exportImport.service.ts
│   │
│   ├── parsers/              # Парсеры книг (перенесены с клиента)
│   │   ├── BookParser.ts     # Диспетчер (по расширению)
│   │   ├── TxtParser.ts      # .txt
│   │   ├── DocParser.ts      # .doc (OLE2 binary)
│   │   ├── DocxParser.ts     # .docx (Office Open XML)
│   │   ├── EpubParser.ts     # .epub (v2/v3)
│   │   ├── Fb2Parser.ts      # .fb2 (FictionBook XML)
│   │   └── parserUtils.ts    # escapeHtml, parseXml, parseHtml
│   │
│   ├── utils/
│   │   ├── prisma.ts         # Prisma client singleton
│   │   ├── storage.ts        # S3 client (upload/delete/get/exists)
│   │   ├── password.ts       # bcrypt hash/verify
│   │   ├── ownership.ts      # verifyBookOwnership
│   │   └── logger.ts         # pino logger
│   │
│   └── types/
│       └── api.ts            # TypeScript-интерфейсы API
│
└── tests/                    # 14 тест-файлов, ~1400 строк
    ├── setup.ts              # Тестовое окружение
    ├── helpers.ts            # Утилиты (createTestUser, authAgent)
    ├── health.test.ts
    ├── auth.test.ts
    ├── books.test.ts
    ├── chapters.test.ts
    ├── appearance.test.ts
    ├── sounds.test.ts
    ├── ambients.test.ts
    ├── decorativeFont.test.ts
    ├── fonts.test.ts
    ├── settings.test.ts
    ├── defaultSettings.test.ts
    ├── progress.test.ts
    ├── upload.test.ts
    └── exportImport.test.ts
```

---

## 5. Модификации на клиенте (Фаза 3) — принятые решения

> Подробнее: `PHASE-3-ADR.md`

### 5.1 ApiClient — один класс

**Файл:** `js/utils/ApiClient.js`

- Единый класс с базовым `fetch(path, options)` и методами для каждого ресурса
- Обработка 401: колбэк `_onUnauthorized` → показ экрана логина (без retry/refresh)
- ~30-40 методов — нормальный размер для одного класса
- Разбивка на `booksApi.js`, `authApi.js` — преждевременная декомпозиция

### 5.2 Аутентификация — модальное окно

- Модальное окно поверх bookshelf (не отдельная страница — SPA-архитектура)
- Только email/password на старте (Google OAuth отложен — зависимость на домен)
- Поток: `GET /api/auth/me` → 401 → модалка → 200 → bookshelf

### 5.3 ServerAdminConfigStore — адаптер

**Файл:** `js/admin/ServerAdminConfigStore.js`

- Тот же интерфейс, что у `AdminConfigStore`, но внутри — вызовы API
- 10 admin-модулей (`ChaptersModule`, `SoundsModule`, ...) работают без изменений через `this.store.*`
- Замена одной строки: `AdminConfigStore.create()` → `ServerAdminConfigStore.create(apiClient)`
- Методы становятся `async` — в модулях добавить `await` где необходимо

### 5.4 Миграция localStorage

- При первом логине: если сервер пуст и есть `flipbook-admin-config` → диалог «Импортировать?»
- «Да» → `POST /api/import` → удаление localStorage и IndexedDB
- «Нет» → удаление локальных данных
- Два источника правды не держать

### 5.5 Контент глав — через API

- `GET /api/books/:bookId/chapters/:chapterId/content` — основной путь
- Авторизация из коробки (сессия), signed URLs не нужны
- `ContentLoader.js` уже умеет работать с inline-контентом

### 5.6 Оффлайн — не в Фазе 3

- При ошибке сети — сообщение пользователю, без fallback
- Все вызовы через единый `fetch` в ApiClient — интерфейс для Фазы 4

### 5.7 Порядок реализации Фазы 3

| # | Задача | Ключевые файлы |
|---|--------|-----------------|
| 1 | `ApiClient.js` — fetch, обработка ошибок, 401 | `js/utils/ApiClient.js` |
| 2 | Модалка auth — логин/регистрация | `index.html`, `css/auth.css`, `js/core/AuthModal.js` |
| 3 | `config.js` — асинхронная загрузка через API | `js/config.js` |
| 4 | `BookshelfScreen.js` — книги из API | `js/core/BookshelfScreen.js` |
| 5 | `ServerAdminConfigStore.js` — адаптер | `js/admin/ServerAdminConfigStore.js` |
| 6 | Миграция localStorage | `js/core/MigrationHelper.js` |
| 7 | `ContentLoader.js` — контент через API | `js/managers/ContentLoader.js` |
| 8 | `SettingsManager.js` — debounced sync | `js/managers/SettingsManager.js` |

### 5.8 Новые компоненты UI (Фаза 3)

- **Модалка аутентификации:** форма входа/регистрации (email + password)
- **Индикатор синхронизации:** «Сохранено» / «Сохранение...» / «Ошибка»

---

## 6. Стратегия миграции данных

### 6.1 Миграция localStorage → сервер

При первом входе зарегистрированного пользователя:

1. `GET /api/books` → пустой массив (новый аккаунт)
2. Проверить наличие `flipbook-admin-config` в localStorage/IndexedDB
3. Диалог: «У вас есть локальные данные. Импортировать?»
4. При «Да»: `POST /api/import` → сервер создаёт книги, главы, загружает контент
5. Data URL шрифтов/звуков → загрузка файлов → замена на серверные URL
6. Удаление localStorage и IndexedDB после успешного импорта
7. При «Нет»: удаление локальных данных, чистый аккаунт

### 6.2 Обратная совместимость

После Фазы 3 приложение работает только с сервером. Без бэкенда — не функционирует. Автономный режим (localStorage) — только для демо/GitHub Pages (текущая ветка `main`).

---

## 7. Прогресс чтения

### 7.1 Проблема

Прогресс обновляется при каждом перелистывании. Нельзя отправлять запрос на каждый флип.

### 7.2 Решение: debounced sync

```
Перелистывание → память (мгновенно) → debounce 5 сек → PUT /api/books/:bookId/progress
```

- При каждом перелистывании: обновление в памяти
- Через 5 сек после последнего перелистывания: отправка на сервер
- При закрытии вкладки: `navigator.sendBeacon()` для финальной синхронизации
- При потере сети: сообщение «прогресс не сохранён»

### 7.3 Конфликт версий

- Сервер хранит `updated_at` для каждого прогресса
- Last-write-wins — для прогресса чтения достаточно

---

## 8. Безопасность (реализовано)

### 8.1 Аутентификация и авторизация

- Серверные сессии в PostgreSQL, cookie httpOnly + Secure + SameSite=Lax
- Session TTL: 7 дней
- Passport.js: local + google-oauth20
- Все API (кроме auth и health) требуют `requireAuth`
- Проверка владения: `verifyBookOwnership()` на каждой операции с книгами
- Rate limiting: 100 req/min general, 5 req/min auth

### 8.2 Валидация данных

- Zod-схемы на всех роутах (body + query)
- Multer с MIME-type проверкой и лимитами размера
- AppError для структурированных ошибок (400, 401, 403, 404, 409)

### 8.3 Защита от атак

- CORS: разрешён только `CORS_ORIGIN`
- Helmet.js для HTTP-заголовков безопасности
- SQL injection: предотвращается Prisma ORM
- XSS: санитизация HTML контента глав (DOMPurify server-side)

---

## 9. Переменные окружения (реализовано)

```env
# Server
PORT=4000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/flipbook

# Session
SESSION_SECRET=your-session-secret-min-32-chars
SESSION_MAX_AGE=604800000             # 7 дней
SESSION_SECURE=false                  # true в production

# Google OAuth 2.0
GOOGLE_CLIENT_ID=placeholder          # Заменить при настройке OAuth
GOOGLE_CLIENT_SECRET=placeholder
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback

# S3 / MinIO
S3_ENDPOINT=http://localhost:9000     # Убрать для AWS S3
S3_BUCKET=flipbook-uploads
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_FORCE_PATH_STYLE=true             # true для MinIO, false для AWS S3
S3_PUBLIC_URL=http://localhost:9000/flipbook-uploads

# CORS & URLs
CORS_ORIGIN=http://localhost:3000
APP_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100
```

---

## 10. План реализации по фазам

### Фаза 1: Фундамент ✅

**Цель:** Работающий сервер с аутентификацией и CRUD книг

**Реализовано:**
1. ✅ Docker Compose: PostgreSQL 17 + MinIO + Node.js сервер (healthchecks)
2. ✅ Серверный проект: package.json, tsconfig, TypeScript
3. ✅ Prisma + PostgreSQL: схема, миграции, seed-скрипт
4. ✅ S3 StorageService (@aws-sdk/client-s3)
5. ✅ Middleware: CORS, Helmet, JSON parsing, error handler, session, rate limiting
6. ✅ Аутентификация: Passport.js (local + Google OAuth), register, login, logout, requireAuth
7. ✅ CRUD книг с reorder и проверкой владения
8. ✅ CRUD глав с контентом и reorder
9. ✅ Тесты API (supertest): auth, books, chapters, health
10. ✅ Vite proxy: `/api` → `http://localhost:4000`
11. ✅ Production Dockerfile (multi-stage build)

### Фаза 2: Полный API ✅

**Цель:** Все ресурсы доступны через API

**Реализовано:**
12. ✅ Appearance API (GET, PATCH per-theme: light/dark)
13. ✅ Sounds API (GET, PATCH)
14. ✅ Ambients API (CRUD + reorder)
15. ✅ Reading Fonts API (CRUD + reorder)
16. ✅ Decorative Font API (GET, PUT upsert, DELETE)
17. ✅ Global Settings API (GET, PATCH)
18. ✅ Default Settings API (GET, PATCH) — per-book
19. ✅ Reading Progress API (GET, PUT upsert)
20. ✅ Загрузка файлов (multer memory → S3): font/sound/image/book
21. ✅ Парсинг книг на сервере: TXT, DOC, DOCX, EPUB, FB2
22. ✅ Export/Import API (полная конфигурация с транзакциями)
23. ✅ Тесты: 14 тест-файлов, ~1400 строк, 95/95 pass

### Фаза 3: Интеграция с фронтендом ⏳

**Цель:** Фронтенд переключён на API

> Принятые решения: `PHASE-3-ADR.md`

24. ApiClient.js (fetch + credentials: 'include' + обработка 401)
25. Модалка аутентификации (email/password)
26. config.js → асинхронная загрузка через API
27. BookshelfScreen.js → книги из API
28. ServerAdminConfigStore.js → адаптер store → API
29. Миграция localStorage при первом логине
30. ContentLoader.js → загрузка контента через API
31. SettingsManager.js → debounced progress sync

**Результат:** Приложение работает через API

### Фаза 4: Надёжность и UX

**Цель:** Надёжная работа в реальных условиях

32. Индикатор синхронизации в UI
33. Offline fallback: кэш в памяти + sync queue в ApiClient
34. Обработка конфликтов прогресса чтения
35. Оптимистичные обновления в UI
36. E2E тесты с бэкендом

### Фаза 5: Production

**Цель:** Готовность к деплою

37. CI/CD: тесты + деплой сервера
38. Мониторинг и логирование (pino structured logs)
39. Документация API (Swagger/OpenAPI)
40. HTTPS, домен, CDN для статики
41. **(По необходимости):** Redis для сессий (connect-redis)

### Фаза 6: Фотоальбом — фундамент

**Цель:** CRUD альбомов с S3-хранением фотографий

42. Схема БД: albums, album_pages, album_photos (Prisma миграция)
43. Image pipeline (sharp): resize, thumbnail, EXIF
44. Albums CRUD API
45. Photo upload: single + batch (до 50)
46. Slug generation (транслитерация + nanoid)
47. AlbumManager.js → S3 URL вместо base64

### Фаза 7: Фотоальбом — публичный доступ

**Цель:** Альбомы доступны по ссылке

48. Public routes: GET /api/public/album/:slug
49. Пароль на альбом (bcrypt + сессия)
50. Публичный viewer
51. Lightbox, ambient-звуки, текстуры
52. SEO: Open Graph, Twitter Card

### Фаза 8: Биллинг

**Цель:** Монетизация через Stripe

53. Схема БД: subscriptions
54. Stripe: Checkout, Portal, Webhooks
55. planLimits middleware
56. Billing UI + usage

**Тарифы:**

| Ресурс | Free | Personal ($12/мес) | Pro ($49/мес) |
|--------|------|--------------------|---------------|
| Альбомов | 2 | Безлимит | Безлимит |
| Фото / альбом | 50 | 500 | 1000 |
| Хранилище | 500 МБ | 10 ГБ | 50 ГБ |
| Водяной знак | Flipbook branding | Без branding | Свой watermark |
| Пароль на альбом | — | ✓ | ✓ |
| Аналитика | — | Базовая | Полная |
| White-label | — | — | ✓ |

### Фаза 9: Pro-фичи

**Цель:** White-label и аналитика для фотографов

57. album_views, user_branding (Prisma миграция)
58. Analytics API + дашборд (Chart.js)
59. White-label брендинг
60. Водяной знак (sharp overlay)
61. Embed-код (iframe)

### Фаза 10: B2C и рост

**Цель:** Массовый рынок

62. Шаблоны тематик (свадьба, newborn, travel)
63. Автораскладка при batch upload
64. Кадрирование на клиенте
65. Реферальная программа
66. Мобильный редактор

---

## 11. Зависимости (актуальные)

### Runtime

```json
{
  "express": "^5.0.1",
  "@prisma/client": "^6.0.0",
  "bcrypt": "^5.1.0",
  "express-session": "^1.18.0",
  "connect-pg-simple": "^10.0.0",
  "passport": "^0.7.0",
  "passport-local": "^1.0.0",
  "passport-google-oauth20": "^2.0.0",
  "zod": "^3.23.0",
  "multer": "^1.4.5-lts.1",
  "@aws-sdk/client-s3": "^3.700.0",
  "helmet": "^8.0.0",
  "cors": "^2.8.5",
  "express-rate-limit": "^7.0.0",
  "jsdom": "^28.1.0",
  "jszip": "^3.10.1",
  "pino": "^9.0.0",
  "pino-pretty": "^13.0.0"
}
```

### Dev

```json
{
  "typescript": "^5.7.0",
  "tsx": "^4.0.0",
  "prisma": "^6.0.0",
  "vitest": "^2.0.0",
  "supertest": "^7.0.0",
  "@types/express": "^5.0.0",
  "@types/express-session": "^1.18.0",
  "@types/connect-pg-simple": "^7.0.0",
  "@types/passport": "^1.0.0",
  "@types/passport-local": "^1.0.0",
  "@types/passport-google-oauth20": "^2.0.0",
  "@types/bcrypt": "^5.0.0",
  "@types/multer": "^1.4.0",
  "@types/cors": "^2.8.0",
  "@types/jsdom": "^28.0.0",
  "@types/supertest": "^6.0.0"
}
```

> **Будущие:** `stripe`, `sharp`, `exif-reader`, `nanoid`, `transliteration` (Фазы 6+)

---

## 12. Docker Compose (реализовано)

```yaml
services:
  postgres:
    image: postgres:17-alpine        # Port 5432, volume pgdata
    healthcheck: pg_isready

  minio:
    image: minio/minio               # S3 API :9000, Console :9001
    healthcheck: mc ready local

  minio-init:
    image: minio/mc                   # Создание бакета + public access
    depends_on: minio (healthy)

  server:
    build: ./server                   # Port 4000
    depends_on: postgres + minio (healthy)
    volumes: ./server/src, ./server/prisma (hot reload)

volumes: pgdata, minio_data
```

**Запуск:** `docker compose up` → PostgreSQL + MinIO + сервер. Фронтенд отдельно: `npm run dev`.

---

## 13. Vite Dev Proxy (реализовано)

```javascript
// vite.config.js
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:4000',
      changeOrigin: true,
    },
  },
}
```

---

## 14. Принятые решения

| Вопрос | Решение | Статус |
|--------|---------|--------|
| Фреймворк | Express 5 + TypeScript | ✅ Реализовано |
| ORM | Prisma 6 | ✅ Реализовано |
| Аутентификация | express-session + connect-pg-simple + Passport.js | ✅ Реализовано |
| Файлы | S3 (MinIO dev / AWS S3 prod) | ✅ Реализовано |
| Структура | Монорепо (`server/` в этом репозитории) | ✅ Реализовано |
| API | REST | ✅ Реализовано |
| Деплой | Docker + docker-compose | ✅ Реализовано |
| Парсинг книг | На сервере (TXT, DOC, DOCX, EPUB, FB2) | ✅ Реализовано |
| Фронтенд ApiClient | Один класс `js/utils/ApiClient.js` | 📋 Фаза 3 |
| Auth UI | Модалка в index.html, email/password | 📋 Фаза 3 |
| Admin store | Адаптер `ServerAdminConfigStore.js` | 📋 Фаза 3 |
| Миграция localStorage | При первом логине → `POST /api/import` → удалить | 📋 Фаза 3 |
| Контент глав | Через API эндпоинт (не S3) | 📋 Фаза 3 |
| Offline | Не в Фазе 3, интерфейс заложить | 📋 Фаза 4 |
| Google OAuth UI | Отложен (зависимость на домен) | 📋 Позже |
| Redis | На будущее (connect-redis) | 📋 Позже |
| WebSocket | Не нужны — синхронизация через REST | — |
| Шеринг книг | Нет — один пользователь = свой набор книг | — |
| Фотоальбом | SaaS с публичными ссылками | 📋 Фаза 6+ |
| Биллинг | Stripe (Checkout + Portal + Webhooks) | 📋 Фаза 8 |
