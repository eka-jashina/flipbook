# Backend Server Plan for Flipbook

## Обзор

Данный документ описывает подробный план миграции Flipbook с полностью клиентской архитектуры (localStorage + IndexedDB) на клиент-серверную архитектуру с бэкенд-сервером. Цель — все данные (книги, главы, настройки, файлы) хранить и изменять на сервере, а клиент взаимодействует с сервером через REST API.

---

## 1. Выбор технологического стека

### 1.1 Серверный фреймворк

**Рекомендация: Node.js + Express (или Fastify)**

Обоснование:
- Проект уже на JavaScript/ES Modules — единый язык для фронтенда и бэкенда
- Node.js >= 18 уже в требованиях проекта
- Express — зрелый, обширная экосистема middleware
- Fastify — альтернатива с лучшей производительностью и встроенной валидацией схем

### 1.2 База данных

**Рекомендация: PostgreSQL + объектное хранилище (S3/MinIO) для файлов**

- PostgreSQL — реляционная БД для структурированных данных (книги, главы, настройки, пользователи)
- S3-совместимое хранилище (AWS S3, MinIO для self-hosted, DigitalOcean Spaces) — для бинарных файлов (шрифты, обложки, аудио, текстуры)
- ORM: Prisma или Drizzle ORM для типобезопасного доступа к данным

**Альтернатива (упрощённый вариант):** SQLite + локальная файловая система — для простого деплоя без внешних сервисов.

### 1.3 Аутентификация

**Решение: express-session + connect-pg-simple + Passport.js (local strategy)**

- Серверные сессии — простая инвалидация (выход, смена пароля — мгновенно)
- connect-pg-simple — хранение сессий в PostgreSQL (отдельная таблица `session`)
- Passport.js (local strategy) — стандартный модуль аутентификации
- httpOnly Secure cookie для session ID
- **На будущее:** при росте нагрузки — заменить connect-pg-simple на connect-redis (Redis) без изменения остального кода

### 1.4 Файловое хранилище

**Решение: S3-совместимое хранилище с первого дня**

- **Production:** AWS S3 (или DigitalOcean Spaces, Cloudflare R2)
- **Разработка/self-hosted:** MinIO в Docker — полностью S3-совместимый API
- Все data URL (шрифты, аудио, обложки, текстуры) заменяются на файлы в S3
- Сервер генерирует уникальные имена файлов и возвращает URL
- Единый интерфейс `StorageService` с S3 SDK (@aws-sdk/client-s3) — работает и с AWS S3, и с MinIO
- Поддержка multipart/form-data для загрузки
- Лимиты размера: шрифты 400 КБ, звуки 2 МБ, изображения 5 МБ

---

## 2. Схема базы данных

### 2.1 ER-диаграмма (сущности и связи)

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

### 2.2 Таблицы

#### users
```sql
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(100),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

#### books
```sql
CREATE TABLE books (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title         VARCHAR(500) NOT NULL DEFAULT '',
    author        VARCHAR(500) NOT NULL DEFAULT '',
    position      INTEGER NOT NULL DEFAULT 0,       -- порядок на полке
    -- Cover
    cover_bg           VARCHAR(500) DEFAULT '',      -- путь к фоновому изображению обложки (desktop)
    cover_bg_mobile    VARCHAR(500) DEFAULT '',      -- путь к фоновому изображению обложки (mobile)
    cover_bg_mode      VARCHAR(20) DEFAULT 'default', -- 'default' | 'none' | 'custom'
    cover_bg_custom_url VARCHAR(500),                -- URL кастомного фона в object storage
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_books_user_id ON books(user_id);
CREATE INDEX idx_books_position ON books(user_id, position);
```

#### chapters
```sql
CREATE TABLE chapters (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id       UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    title         VARCHAR(500) NOT NULL DEFAULT '',
    position      INTEGER NOT NULL DEFAULT 0,       -- порядок глав
    file_path     VARCHAR(500),                     -- путь к статическому HTML (для дефолтных глав)
    html_content  TEXT,                             -- HTML контент (для загруженных книг)
    bg            VARCHAR(500) DEFAULT '',           -- фон главы (desktop)
    bg_mobile     VARCHAR(500) DEFAULT '',           -- фон главы (mobile)
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chapters_book_id ON chapters(book_id);
CREATE INDEX idx_chapters_position ON chapters(book_id, position);
```

#### book_appearance
```sql
CREATE TABLE book_appearance (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id       UUID UNIQUE NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    font_min      INTEGER DEFAULT 14,
    font_max      INTEGER DEFAULT 22,
    -- Light theme
    light_cover_bg_start    VARCHAR(20) DEFAULT '#3a2d1f',
    light_cover_bg_end      VARCHAR(20) DEFAULT '#2a2016',
    light_cover_text        VARCHAR(20) DEFAULT '#f2e9d8',
    light_cover_bg_image_url VARCHAR(500),           -- URL в object storage
    light_page_texture      VARCHAR(20) DEFAULT 'default', -- 'default' | 'none' | 'custom'
    light_custom_texture_url VARCHAR(500),            -- URL в object storage
    light_bg_page           VARCHAR(20) DEFAULT '#fdfcf8',
    light_bg_app            VARCHAR(20) DEFAULT '#e6e3dc',
    -- Dark theme
    dark_cover_bg_start     VARCHAR(20) DEFAULT '#111111',
    dark_cover_bg_end       VARCHAR(20) DEFAULT '#000000',
    dark_cover_text         VARCHAR(20) DEFAULT '#eaeaea',
    dark_cover_bg_image_url VARCHAR(500),
    dark_page_texture       VARCHAR(20) DEFAULT 'none',
    dark_custom_texture_url VARCHAR(500),
    dark_bg_page            VARCHAR(20) DEFAULT '#1e1e1e',
    dark_bg_app             VARCHAR(20) DEFAULT '#121212'
);
```

#### book_sounds
```sql
CREATE TABLE book_sounds (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id       UUID UNIQUE NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    page_flip_url VARCHAR(500) DEFAULT 'sounds/page-flip.mp3',   -- путь или URL
    book_open_url VARCHAR(500) DEFAULT 'sounds/cover-flip.mp3',
    book_close_url VARCHAR(500) DEFAULT 'sounds/cover-flip.mp3'
);
```

#### book_default_settings
```sql
CREATE TABLE book_default_settings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id         UUID UNIQUE NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    font            VARCHAR(100) DEFAULT 'georgia',
    font_size       INTEGER DEFAULT 18,
    theme           VARCHAR(20) DEFAULT 'light',
    sound_enabled   BOOLEAN DEFAULT TRUE,
    sound_volume    REAL DEFAULT 0.3,
    ambient_type    VARCHAR(100) DEFAULT 'none',
    ambient_volume  REAL DEFAULT 0.5
);
```

#### ambients
```sql
CREATE TABLE ambients (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id       UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    ambient_key   VARCHAR(100) NOT NULL,            -- 'none', 'rain', 'fireplace', 'cafe', 'custom-xxx'
    label         VARCHAR(200) NOT NULL,
    short_label   VARCHAR(50),
    icon          VARCHAR(20),
    file_url      VARCHAR(500),                     -- URL к аудиофайлу
    visible       BOOLEAN DEFAULT TRUE,
    builtin       BOOLEAN DEFAULT FALSE,
    position      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_ambients_book_id ON ambients(book_id);
```

#### decorative_fonts
```sql
CREATE TABLE decorative_fonts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id       UUID UNIQUE NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    name          VARCHAR(200) NOT NULL,
    file_url      VARCHAR(500) NOT NULL              -- URL к файлу шрифта в object storage
);
```

#### reading_fonts (глобальные, для пользователя)
```sql
CREATE TABLE reading_fonts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    font_key      VARCHAR(100) NOT NULL,             -- 'georgia', 'merriweather', 'custom-xxx'
    label         VARCHAR(200) NOT NULL,
    family        VARCHAR(300) NOT NULL,              -- CSS font-family value
    builtin       BOOLEAN DEFAULT FALSE,
    enabled       BOOLEAN DEFAULT TRUE,
    file_url      VARCHAR(500),                      -- URL для кастомных шрифтов
    position      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_reading_fonts_user_id ON reading_fonts(user_id);
```

#### global_settings (глобальные настройки пользователя)
```sql
CREATE TABLE global_settings (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    font_min              INTEGER DEFAULT 14,
    font_max              INTEGER DEFAULT 22,
    -- settings visibility
    vis_font_size         BOOLEAN DEFAULT TRUE,
    vis_theme             BOOLEAN DEFAULT TRUE,
    vis_font              BOOLEAN DEFAULT TRUE,
    vis_fullscreen        BOOLEAN DEFAULT TRUE,
    vis_sound             BOOLEAN DEFAULT TRUE,
    vis_ambient           BOOLEAN DEFAULT TRUE
);
```

#### reading_progress (прогресс чтения, per-book per-user)
```sql
CREATE TABLE reading_progress (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id         UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    page            INTEGER DEFAULT 0,
    font            VARCHAR(100) DEFAULT 'georgia',
    font_size       INTEGER DEFAULT 18,
    theme           VARCHAR(20) DEFAULT 'light',
    sound_enabled   BOOLEAN DEFAULT TRUE,
    sound_volume    REAL DEFAULT 0.3,
    ambient_type    VARCHAR(100) DEFAULT 'none',
    ambient_volume  REAL DEFAULT 0.5,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, book_id)
);

CREATE INDEX idx_reading_progress_user_book ON reading_progress(user_id, book_id);
```

#### session (управляется connect-pg-simple автоматически)
```sql
-- Таблица создаётся автоматически connect-pg-simple при первом запуске
-- или через sql-скрипт из пакета connect-pg-simple
CREATE TABLE "session" (
    "sid"    VARCHAR NOT NULL COLLATE "default",
    "sess"   JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,
    PRIMARY KEY ("sid")
);

CREATE INDEX "IDX_session_expire" ON "session" ("expire");
```

> **Примечание:** При миграции на Redis в будущем — эта таблица больше не нужна. Заменяем `connect-pg-simple` на `connect-redis`, остальной код не меняется.

---

## 3. REST API

### 3.1 Аутентификация (серверные сессии + Passport.js)

| Метод  | Эндпоинт              | Описание                         | Тело запроса                         |
|--------|------------------------|----------------------------------|--------------------------------------|
| POST   | `/api/auth/register`   | Регистрация + автоматический вход | `{email, password, displayName?}`   |
| POST   | `/api/auth/login`      | Вход (создаёт сессию)            | `{email, password}`                 |
| POST   | `/api/auth/logout`     | Выход (уничтожает сессию)        | —                                   |
| GET    | `/api/auth/me`         | Получить текущего пользователя   | —                                   |

**Механизм:**
- При login/register сервер создаёт сессию в PostgreSQL (connect-pg-simple)
- Session ID передаётся в httpOnly Secure cookie (`connect.sid`)
- Все последующие запросы автоматически включают cookie
- При logout — `req.session.destroy()` удаляет сессию из БД

**Формат ответа (login/register):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "Username"
  }
}
```

### 3.2 Книги

| Метод  | Эндпоинт                     | Описание                              |
|--------|-------------------------------|---------------------------------------|
| GET    | `/api/books`                  | Список книг пользователя (для полки)  |
| POST   | `/api/books`                  | Создать книгу                         |
| GET    | `/api/books/:bookId`          | Получить полную информацию о книге    |
| PATCH  | `/api/books/:bookId`          | Обновить мета-данные книги            |
| DELETE | `/api/books/:bookId`          | Удалить книгу                         |
| PATCH  | `/api/books/reorder`          | Изменить порядок книг                 |

**GET /api/books — ответ (список для полки):**
```json
{
  "books": [
    {
      "id": "uuid",
      "title": "The Hobbit",
      "author": "J.R.R. Tolkien",
      "position": 0,
      "chaptersCount": 3,
      "coverBgMode": "default",
      "appearance": {
        "light": {
          "coverBgStart": "#3a2d1f",
          "coverBgEnd": "#2a2016",
          "coverText": "#f2e9d8"
        }
      },
      "readingProgress": {
        "page": 42,
        "updatedAt": "2026-02-20T10:30:00Z"
      }
    }
  ]
}
```

**POST /api/books — создание книги:**
```json
{
  "title": "New Book",
  "author": "Author Name"
}
```

**GET /api/books/:bookId — полная информация:**
```json
{
  "id": "uuid",
  "title": "The Hobbit",
  "author": "J.R.R. Tolkien",
  "cover": {
    "bg": "/images/cover.webp",
    "bgMobile": "/images/cover-mobile.webp",
    "bgMode": "default",
    "bgCustomUrl": null
  },
  "chapters": [
    {
      "id": "uuid",
      "title": "Chapter 1",
      "position": 0,
      "filePath": "content/part_1.html",
      "hasHtmlContent": true,
      "bg": "/images/bg1.webp",
      "bgMobile": "/images/bg1-mobile.webp"
    }
  ],
  "defaultSettings": { "font": "georgia", "fontSize": 18, "theme": "light", ... },
  "appearance": {
    "fontMin": 14,
    "fontMax": 22,
    "light": { ... },
    "dark": { ... }
  },
  "sounds": {
    "pageFlip": "/sounds/page-flip.mp3",
    "bookOpen": "/sounds/cover-flip.mp3",
    "bookClose": "/sounds/cover-flip.mp3"
  },
  "ambients": [ ... ],
  "decorativeFont": { "name": "...", "fileUrl": "..." }
}
```

### 3.3 Главы

| Метод  | Эндпоинт                                    | Описание                        |
|--------|----------------------------------------------|---------------------------------|
| GET    | `/api/books/:bookId/chapters`                | Список глав (мета, без контента)|
| POST   | `/api/books/:bookId/chapters`                | Добавить главу                  |
| GET    | `/api/books/:bookId/chapters/:chapterId`     | Получить главу с контентом      |
| PATCH  | `/api/books/:bookId/chapters/:chapterId`     | Обновить главу                  |
| DELETE | `/api/books/:bookId/chapters/:chapterId`     | Удалить главу                   |
| PATCH  | `/api/books/:bookId/chapters/reorder`        | Изменить порядок глав           |
| GET    | `/api/books/:bookId/chapters/:chapterId/content` | Получить HTML контент главы |

**GET /api/books/:bookId/chapters/:chapterId/content — ответ:**
```json
{
  "html": "<h1>Chapter 1</h1><p>In a hole in the ground...</p>"
}
```

### 3.4 Внешний вид книги (Appearance)

| Метод  | Эндпоинт                                     | Описание                           |
|--------|-----------------------------------------------|------------------------------------|
| GET    | `/api/books/:bookId/appearance`               | Получить настройки внешнего вида   |
| PATCH  | `/api/books/:bookId/appearance`               | Обновить общие (fontMin, fontMax)  |
| PATCH  | `/api/books/:bookId/appearance/:theme`        | Обновить тему (light/dark)         |

### 3.5 Звуки

| Метод  | Эндпоинт                                     | Описание                   |
|--------|-----------------------------------------------|----------------------------|
| GET    | `/api/books/:bookId/sounds`                   | Получить звуки книги       |
| PATCH  | `/api/books/:bookId/sounds`                   | Обновить звуки             |

### 3.6 Эмбиенты

| Метод  | Эндпоинт                                     | Описание                   |
|--------|-----------------------------------------------|----------------------------|
| GET    | `/api/books/:bookId/ambients`                 | Список эмбиентов книги     |
| POST   | `/api/books/:bookId/ambients`                 | Добавить эмбиент           |
| PATCH  | `/api/books/:bookId/ambients/:ambientId`      | Обновить эмбиент           |
| DELETE | `/api/books/:bookId/ambients/:ambientId`      | Удалить эмбиент            |

### 3.7 Шрифты

#### Декоративный шрифт (per-book)

| Метод  | Эндпоинт                                        | Описание                        |
|--------|--------------------------------------------------|---------------------------------|
| GET    | `/api/books/:bookId/decorative-font`             | Получить декоративный шрифт     |
| PUT    | `/api/books/:bookId/decorative-font`             | Установить декоративный шрифт   |
| DELETE | `/api/books/:bookId/decorative-font`             | Удалить декоративный шрифт      |

#### Шрифты для чтения (global)

| Метод  | Эндпоинт                          | Описание                       |
|--------|-------------------------------------|-------------------------------|
| GET    | `/api/fonts`                        | Список шрифтов для чтения     |
| POST   | `/api/fonts`                        | Добавить кастомный шрифт       |
| PATCH  | `/api/fonts/:fontId`                | Обновить шрифт (enabled и т.д.)|
| DELETE | `/api/fonts/:fontId`                | Удалить шрифт                  |

### 3.8 Глобальные настройки

| Метод  | Эндпоинт                          | Описание                          |
|--------|-------------------------------------|-----------------------------------|
| GET    | `/api/settings`                     | Глобальные настройки пользователя |
| PATCH  | `/api/settings`                     | Обновить глобальные настройки     |

### 3.9 Прогресс чтения

| Метод  | Эндпоинт                                          | Описание                       |
|--------|-----------------------------------------------------|-------------------------------|
| GET    | `/api/books/:bookId/progress`                       | Получить прогресс чтения       |
| PUT    | `/api/books/:bookId/progress`                       | Сохранить прогресс чтения      |

**PUT /api/books/:bookId/progress:**
```json
{
  "page": 42,
  "font": "georgia",
  "fontSize": 18,
  "theme": "light",
  "soundEnabled": true,
  "soundVolume": 0.3,
  "ambientType": "rain",
  "ambientVolume": 0.5
}
```

### 3.10 Загрузка файлов

| Метод  | Эндпоинт                  | Описание                                      |
|--------|----------------------------|-----------------------------------------------|
| POST   | `/api/upload/font`         | Загрузить файл шрифта (woff2/ttf/otf)         |
| POST   | `/api/upload/sound`        | Загрузить аудиофайл                            |
| POST   | `/api/upload/image`        | Загрузить изображение (обложка, текстура, фон) |
| POST   | `/api/upload/book`         | Загрузить книгу (txt/doc/docx/epub/fb2)        |

**POST /api/upload/font — multipart/form-data:**
- Поле: `file` (max 400 KB)
- Расширения: .woff2, .woff, .ttf, .otf
- Ответ: `{ "fileUrl": "/uploads/fonts/abc123.woff2" }`

**POST /api/upload/book — multipart/form-data:**
- Поле: `file` (max 50 MB)
- Расширения: .txt, .doc, .docx, .epub, .fb2
- Ответ:
```json
{
  "title": "Parsed Title",
  "author": "Parsed Author",
  "chapters": [
    { "title": "Chapter 1", "html": "<p>Content...</p>" }
  ]
}
```

Парсинг книг (TxtParser, DocParser, DocxParser, EpubParser, Fb2Parser) переносится с клиента на сервер.

### 3.11 Экспорт/Импорт конфигурации

| Метод  | Эндпоинт                  | Описание                                |
|--------|----------------------------|-----------------------------------------|
| GET    | `/api/export`              | Экспорт всей конфигурации как JSON      |
| POST   | `/api/import`              | Импорт конфигурации из JSON             |

---

## 4. Структура серверного проекта

```
server/
├── package.json
├── tsconfig.json                  # TypeScript конфигурация
├── .env.example                   # Шаблон переменных окружения
├── prisma/
│   ├── schema.prisma              # Prisma ORM схема
│   └── migrations/                # Миграции БД
│       └── ...
├── src/
│   ├── index.ts                   # Точка входа, создание сервера
│   ├── app.ts                     # Express app, middleware, маршруты
│   ├── config.ts                  # Конфигурация из переменных окружения
│   │
│   ├── middleware/
│   │   ├── auth.ts                # Passport.js сессионная аутентификация
│   │   ├── errorHandler.ts        # Глобальная обработка ошибок
│   │   ├── validate.ts            # Валидация запросов (zod)
│   │   ├── rateLimit.ts           # Rate limiting
│   │   └── upload.ts              # Multer для загрузки файлов (memory storage → S3)
│   │
│   ├── routes/
│   │   ├── auth.routes.ts         # /api/auth/*
│   │   ├── books.routes.ts        # /api/books/*
│   │   ├── chapters.routes.ts     # /api/books/:bookId/chapters/*
│   │   ├── appearance.routes.ts   # /api/books/:bookId/appearance/*
│   │   ├── sounds.routes.ts       # /api/books/:bookId/sounds/*
│   │   ├── ambients.routes.ts     # /api/books/:bookId/ambients/*
│   │   ├── fonts.routes.ts        # /api/fonts/* + /api/books/:bookId/decorative-font
│   │   ├── settings.routes.ts     # /api/settings/*
│   │   ├── progress.routes.ts     # /api/books/:bookId/progress/*
│   │   ├── upload.routes.ts       # /api/upload/*
│   │   └── export.routes.ts       # /api/export, /api/import
│   │
│   ├── services/
│   │   ├── auth.service.ts        # Логика аутентификации (хэширование, JWT)
│   │   ├── books.service.ts       # CRUD книг
│   │   ├── chapters.service.ts    # CRUD глав
│   │   ├── appearance.service.ts  # Внешний вид книги
│   │   ├── sounds.service.ts      # Звуки книги
│   │   ├── ambients.service.ts    # Эмбиенты
│   │   ├── fonts.service.ts       # Шрифты (reading + decorative)
│   │   ├── settings.service.ts    # Глобальные настройки
│   │   ├── progress.service.ts    # Прогресс чтения
│   │   ├── upload.service.ts      # Обработка загрузок + хранение
│   │   └── export.service.ts      # Экспорт/импорт
│   │
│   ├── parsers/                   # Парсеры книг (перенос с клиента)
│   │   ├── BookParser.ts          # Диспетчер парсеров
│   │   ├── TxtParser.ts
│   │   ├── DocParser.ts
│   │   ├── DocxParser.ts
│   │   ├── EpubParser.ts
│   │   └── Fb2Parser.ts
│   │
│   ├── utils/
│   │   ├── password.ts            # Хэширование паролей (bcrypt)
│   │   ├── storage.ts             # S3 StorageService (@aws-sdk/client-s3) — единый интерфейс для MinIO и AWS S3
│   │   └── sanitize.ts            # Санитизация HTML (server-side DOMPurify)
│   │
│   └── types/
│       ├── api.ts                 # Типы запросов/ответов API
│       └── models.ts              # Доменные типы
│
│
└── tests/
    ├── setup.ts
    ├── auth.test.ts
    ├── books.test.ts
    ├── chapters.test.ts
    └── ...
```

---

## 5. Модификации на клиенте (фронтенд)

### 5.1 Новый модуль: ApiClient

Создать `js/utils/ApiClient.js` — единая точка взаимодействия с бэкендом:

```javascript
class ApiClient {
    constructor(baseUrl) { ... }

    // credentials: 'include' для отправки session cookie
    // Редирект на login при 401
    async request(method, path, body, options) { ... }

    // Auth (session-based)
    async register(email, password, displayName) { ... }
    async login(email, password) { ... }
    async logout() { ... }
    async getMe() { ... }

    // Books
    async getBooks() { ... }
    async createBook(data) { ... }
    async getBook(bookId) { ... }
    async updateBook(bookId, data) { ... }
    async deleteBook(bookId) { ... }
    async reorderBooks(bookIds) { ... }

    // Chapters
    async getChapters(bookId) { ... }
    async getChapterContent(bookId, chapterId) { ... }
    async createChapter(bookId, data) { ... }
    async updateChapter(bookId, chapterId, data) { ... }
    async deleteChapter(bookId, chapterId) { ... }

    // ... остальные методы для всех ресурсов API

    // Upload
    async uploadFont(file) { ... }
    async uploadSound(file) { ... }
    async uploadImage(file) { ... }
    async uploadBook(file) { ... }

    // Progress (с дебаунсом — не при каждом перелистывании)
    async saveProgress(bookId, progress) { ... }
}
```

### 5.2 Изменения в существующих модулях

#### config.js
- Загрузка конфигурации с сервера вместо localStorage
- `createConfig()` принимает данные от API, а не из localStorage
- Начальная загрузка: `GET /api/books/:bookId` → `createConfig(serverData)`
- Кэширование в памяти, инвалидация при изменениях

#### AdminConfigStore.js
- Замена localStorage/IndexedDB операций на API вызовы
- Все методы (`addBook`, `updateChapter`, `updateAppearance` и т.д.) вызывают соответствующие API эндпоинты
- Локальное кэширование для отзывчивости UI (optimistic updates)

#### StorageManager.js
- Для прогресса чтения: запись локально + асинхронная синхронизация с сервером (debounce 2-5 сек)
- Для настроек: чтение с сервера при загрузке, запись через API

#### ContentLoader.js
- Загрузка HTML контента через `GET /api/books/:bookId/chapters/:chapterId/content`
- Вместо загрузки статических файлов из `public/content/`

#### BookshelfScreen.js
- Загрузка списка книг через `GET /api/books`
- Удаление книги через `DELETE /api/books/:bookId`
- Отображение книг с данными с сервера

#### SettingsManager.js
- Начальная загрузка настроек: `GET /api/books/:bookId/progress`
- Сохранение: debounced `PUT /api/books/:bookId/progress`
- Локальный кэш для мгновенного отклика

#### Admin модули (ChaptersModule, FontsModule, SoundsModule и др.)
- Замена всех `store.addChapter()` → `apiClient.createChapter()`
- Загрузка файлов: FormData + `apiClient.uploadFont()` вместо FileReader.readAsDataURL()
- Результат загрузки — URL файла на сервере, не data URL

#### BookParser.js
- Парсинг на сервере: клиент отправляет файл → `POST /api/upload/book` → получает распарсенные главы
- Удалить клиентские парсеры (TxtParser, DocParser и т.д.) или оставить как fallback

### 5.3 Новые компоненты UI

#### Экран аутентификации
- Форма входа / регистрации
- Валидация на стороне клиента
- Восстановление пароля (опционально, фаза 2)

#### Индикатор синхронизации
- Показывать статус: «Сохранено» / «Сохранение...» / «Ошибка синхронизации»
- При ошибке сети: сохранять локально, синхронизировать при восстановлении

---

## 6. Стратегия миграции данных

### 6.1 Миграция с клиента на сервер

При первом входе зарегистрированного пользователя:

1. Проверить наличие данных в localStorage (`flipbook-admin-config`) и IndexedDB
2. Если данные есть → предложить пользователю импортировать
3. `POST /api/import` с полным JSON конфигурации
4. Сервер создаёт книги, главы, загружает inline-контент
5. Data URL → загружаются как файлы → заменяются на серверные URL
6. После успешной миграции — очистить локальные хранилища (с подтверждением)

### 6.2 Обратная совместимость

- Оставить возможность работы без бэкенда (offline-mode / fallback)
- Определять наличие бэкенда через конфигурацию (`API_URL` env variable)
- Если `API_URL` не задан → работает как раньше (localStorage)

---

## 7. Обработка прогресса чтения

### 7.1 Проблема: частота обновлений

Прогресс чтения обновляется при каждом перелистывании страницы. Нельзя отправлять запрос при каждом флипе.

### 7.2 Решение: debounced sync

```
Перелистывание → localStorage (мгновенно) → debounce 5 сек → PUT /api/books/:bookId/progress
```

- При каждом перелистывании: запись в localStorage
- Через 5 секунд после последнего перелистывания: отправка на сервер
- При закрытии вкладки: `beforeunload` → navigator.sendBeacon() для финальной синхронизации
- При потере сети: накопление изменений локально → синхронизация при восстановлении

### 7.3 Конфликт версий

- Сервер хранит `updated_at` для каждого прогресса
- При загрузке: клиент сравнивает локальную и серверную метки времени
- Побеждает более поздняя запись (last-write-wins)
- Для прогресса чтения это приемлемо — нет нужды в сложном мерже

---

## 8. Безопасность

### 8.1 Аутентификация и авторизация

- Серверные сессии в PostgreSQL (connect-pg-simple), cookie httpOnly + Secure + SameSite=Lax
- Session TTL: 7 дней, автоматическая очистка просроченных сессий
- Passport.js local strategy для login/register
- Все API эндпоинты (кроме auth) требуют активную сессию (`req.isAuthenticated()`)
- Проверка владения: все операции с книгами/главами проверяют `book.user_id === currentUser.id`
- Rate limiting: ограничение запросов (100 req/min для обычных, 5 req/min для auth)
- **На будущее:** connect-redis для хранения сессий при высокой нагрузке

### 8.2 Валидация данных

- Входные данные валидируются на сервере (zod/joi)
- Санитизация HTML контента на сервере (DOMPurify server-side через jsdom)
- Максимальные размеры тел запросов: 10 MB для обычных, 50 MB для загрузки книг
- MIME-type проверка загружаемых файлов
- Защита от path traversal при файловых операциях

### 8.3 Защита от атак

- CORS: разрешить только домен фронтенда
- Helmet.js для HTTP заголовков безопасности
- SQL injection: предотвращается ORM (Prisma/Drizzle)
- XSS: санитизация HTML, Content-Security-Policy
- CSRF: SameSite=Lax cookie + проверка Origin/Referer заголовков

---

## 9. Переменные окружения

```env
# Server
PORT=4000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/flipbook

# Session
SESSION_SECRET=your-session-secret-min-32-chars
SESSION_MAX_AGE=604800000             # 7 дней в миллисекундах
SESSION_SECURE=false                  # true в production (HTTPS only)

# S3 / MinIO
S3_ENDPOINT=http://localhost:9000     # MinIO для разработки, убрать для AWS S3
S3_BUCKET=flipbook-uploads
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin              # MinIO default, заменить в production
S3_SECRET_KEY=minioadmin              # MinIO default, заменить в production
S3_FORCE_PATH_STYLE=true             # true для MinIO, false для AWS S3
S3_PUBLIC_URL=http://localhost:9000/flipbook-uploads  # Публичный URL для доступа к файлам

# CORS
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW=60000               # 1 минута
RATE_LIMIT_MAX=100                    # запросов в окно

# --- Future: Redis ---
# REDIS_URL=redis://localhost:6379    # Раскомментировать при переходе на Redis
```

---

## 10. План реализации по фазам

### Фаза 1: Фундамент (MVP серверной части)

**Цель:** Работающий сервер с аутентификацией и CRUD книг

1. Docker-compose: PostgreSQL + MinIO + Node.js сервер
2. Инициализация серверного проекта (package.json, tsconfig, eslint)
3. Настройка Prisma + PostgreSQL, создание схемы
4. S3 StorageService (@aws-sdk/client-s3) — единый интерфейс для MinIO/AWS S3
5. Middleware: CORS, JSON parsing, error handler, request logging, session (express-session + connect-pg-simple)
6. Аутентификация: Passport.js (local strategy), register, login, logout, auth middleware
7. CRUD книг: GET /api/books, POST, GET /:id, PATCH /:id, DELETE /:id
8. CRUD глав: GET, POST, GET /:id, PATCH, DELETE, GET /:id/content
9. Базовые тесты API (supertest)

**Результат:** Сервер с auth + книги + главы + S3 хранилище, `docker compose up` и всё работает

### Фаза 2: Полный API

**Цель:** Все ресурсы доступны через API

10. Appearance API (GET, PATCH per-theme)
11. Sounds API (GET, PATCH)
12. Ambients API (CRUD)
13. Fonts API (reading fonts CRUD + decorative font)
14. Global settings API (GET, PATCH)
15. Reading progress API (GET, PUT)
16. Загрузка файлов (multer memory storage → S3)
17. Парсинг книг на сервере (перенос парсеров)
18. Export/Import API

**Результат:** Полный API, полностью покрывающий текущую функциональность AdminConfigStore

### Фаза 3: Интеграция с фронтендом

**Цель:** Фронтенд переключён на API

19. Создать ApiClient.js (fetch + credentials: 'include')
20. Добавить UI аутентификации (login/register)
21. Адаптировать config.js для загрузки с сервера
22. Адаптировать BookshelfScreen.js
23. Адаптировать ContentLoader.js
24. Адаптировать SettingsManager.js (debounced progress sync)
25. Адаптировать все админ-модули
26. Удалить клиентские парсеры (или оставить fallback)

**Результат:** Приложение работает через API

### Фаза 4: Надёжность и UX

**Цель:** Надёжная работа в реальных условиях

27. Индикатор синхронизации в UI
28. Offline fallback: localStorage cache + sync queue
29. Обработка конфликтов прогресса чтения
30. Миграция данных: импорт из localStorage при первом входе
31. Оптимистичные обновления в UI
32. E2E тесты с бэкендом

### Фаза 5: Production

**Цель:** Готовность к деплою

33. CI/CD: тесты + деплой сервера
34. Мониторинг и логирование (pino + structured logs)
35. Документация API (Swagger/OpenAPI)
36. Настройка HTTPS, домена, CDN для статики
37. **(По необходимости):** Миграция сессий на Redis (connect-redis + ioredis)

---

## 11. Зависимости серверной части

### Runtime

```json
{
  "express": "^5.0.0",
  "prisma": "^6.0.0",
  "@prisma/client": "^6.0.0",
  "bcrypt": "^5.1.0",
  "express-session": "^1.18.0",
  "connect-pg-simple": "^10.0.0",
  "passport": "^0.7.0",
  "passport-local": "^1.0.0",
  "zod": "^3.23.0",
  "multer": "^1.4.0",
  "@aws-sdk/client-s3": "^3.700.0",
  "helmet": "^8.0.0",
  "cors": "^2.8.0",
  "express-rate-limit": "^7.0.0",
  "dompurify": "^3.3.0",
  "jsdom": "^25.0.0",
  "jszip": "^3.10.0",
  "pino": "^9.0.0",
  "pino-pretty": "^13.0.0",
  "dotenv": "^16.0.0"
}
```

> **На будущее (Redis):** Когда понадобится — добавить `connect-redis` + `ioredis`, заменить store в express-session.

### Dev

```json
{
  "typescript": "^5.7.0",
  "tsx": "^4.0.0",
  "vitest": "^4.0.0",
  "supertest": "^7.0.0",
  "@types/express": "^5.0.0",
  "@types/express-session": "^1.18.0",
  "@types/connect-pg-simple": "^7.0.0",
  "@types/passport": "^1.0.0",
  "@types/passport-local": "^1.0.0",
  "@types/bcrypt": "^5.0.0",
  "@types/multer": "^1.4.0",
  "@types/cors": "^2.8.0"
}
```

---

## 12. Vite Dev Server Proxy

Для разработки — проксирование API запросов через Vite:

```javascript
// vite.config.js (дополнение)
export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
```

> **Примечание:** Файлы из S3/MinIO загружаются по прямым URL. В dev-режиме MinIO доступен на `http://localhost:9000`.

---

## 13. Docker Compose (dev-окружение)

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: flipbook
      POSTGRES_USER: flipbook
      POSTGRES_PASSWORD: flipbook_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"    # S3 API
      - "9001:9001"    # Web-консоль MinIO
    volumes:
      - minio_data:/data

  # Автосоздание бакета при старте
  minio-init:
    image: minio/mc
    depends_on:
      - minio
    entrypoint: >
      /bin/sh -c "
      sleep 3;
      mc alias set myminio http://minio:9000 minioadmin minioadmin;
      mc mb myminio/flipbook-uploads --ignore-existing;
      mc anonymous set download myminio/flipbook-uploads;
      "

  server:
    build: ./server
    depends_on:
      - postgres
      - minio
    ports:
      - "4000:4000"
    environment:
      DATABASE_URL: postgresql://flipbook:flipbook_dev@postgres:5432/flipbook
      SESSION_SECRET: dev-session-secret-change-in-production
      S3_ENDPOINT: http://minio:9000
      S3_BUCKET: flipbook-uploads
      S3_ACCESS_KEY: minioadmin
      S3_SECRET_KEY: minioadmin
      S3_FORCE_PATH_STYLE: "true"
      S3_PUBLIC_URL: http://localhost:9000/flipbook-uploads
      CORS_ORIGIN: http://localhost:3000
    volumes:
      - ./server/src:/app/src  # Hot reload

volumes:
  pgdata:
  minio_data:
```

> **Для запуска:** `docker compose up` — поднимает PostgreSQL, MinIO и сервер. Фронтенд запускается отдельно через `npm run dev`.

---

## 14. Принятые решения

| Вопрос | Решение |
|--------|---------|
| ORM | Prisma |
| Аутентификация | express-session + connect-pg-simple + Passport.js (local) |
| Файлы | S3 с первого дня (MinIO для dev, AWS S3 для prod) |
| Структура | Монорепо (`server/` в этом репозитории) |
| API | REST |
| Деплой | Docker + docker-compose |
| Redis | На будущее (замена connect-pg-simple → connect-redis) |

## 14. Открытые вопросы

1. **Мультитенантность:** Один пользователь = один набор книг? Или поддержка шаринга книг?
2. **OAuth:** Нужна ли авторизация через Google/GitHub или достаточно email+password?
3. **Лимиты:** Максимальное количество книг/глав на пользователя? Квота S3 хранилища?
4. **Реальное время:** Нужны ли WebSocket для уведомлений о синхронизации?
