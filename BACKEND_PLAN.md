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

**Рекомендация: JWT (access + refresh tokens)**

- Stateless аутентификация, хорошо масштабируется
- Access token (15-30 мин) + Refresh token (7-30 дней)
- Хранение refresh token в httpOnly cookie
- Альтернатива: сессии с express-session + Redis (проще, но требует стейт на сервере)

### 1.4 Файловое хранилище

- Все data URL (шрифты, аудио, обложки, текстуры) заменяются на файлы в объектном хранилище
- Сервер генерирует уникальные имена файлов и возвращает URL
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

#### refresh_tokens
```sql
CREATE TABLE refresh_tokens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash    VARCHAR(255) NOT NULL,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
```

---

## 3. REST API

### 3.1 Аутентификация

| Метод  | Эндпоинт              | Описание                    | Тело запроса                         |
|--------|------------------------|-----------------------------|--------------------------------------|
| POST   | `/api/auth/register`   | Регистрация                 | `{email, password, displayName?}`    |
| POST   | `/api/auth/login`      | Вход                        | `{email, password}`                  |
| POST   | `/api/auth/refresh`    | Обновление токена           | httpOnly cookie с refresh token      |
| POST   | `/api/auth/logout`     | Выход                       | httpOnly cookie с refresh token      |
| GET    | `/api/auth/me`         | Получить текущего пользователя | —                                  |

**Формат ответа (login/register):**
```json
{
  "accessToken": "eyJhbG...",
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
│   │   ├── auth.ts                # JWT аутентификация middleware
│   │   ├── errorHandler.ts        # Глобальная обработка ошибок
│   │   ├── validate.ts            # Валидация запросов (zod)
│   │   ├── rateLimit.ts           # Rate limiting
│   │   └── upload.ts              # Multer для загрузки файлов
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
│   │   ├── jwt.ts                 # JWT генерация и верификация
│   │   ├── password.ts            # Хэширование паролей (bcrypt/argon2)
│   │   ├── storage.ts             # Абстракция над файловым хранилищем
│   │   └── sanitize.ts            # Санитизация HTML (server-side DOMPurify)
│   │
│   └── types/
│       ├── api.ts                 # Типы запросов/ответов API
│       └── models.ts              # Доменные типы
│
├── uploads/                       # Локальное файловое хранилище (dev)
│   ├── fonts/
│   ├── sounds/
│   └── images/
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

    // Авто-обновление токена при 401
    async request(method, path, body, options) { ... }

    // Auth
    async register(email, password, displayName) { ... }
    async login(email, password) { ... }
    async logout() { ... }
    async refreshToken() { ... }
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

- JWT access token: короткоживущий (15-30 мин)
- Refresh token: долгоживущий (7-30 дней), в httpOnly Secure cookie
- Все API эндпоинты (кроме auth) требуют валидный access token
- Проверка владения: все операции с книгами/главами проверяют `book.user_id === currentUser.id`
- Rate limiting: ограничение запросов (100 req/min для обычных, 5 req/min для auth)

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
- CSRF: SameSite cookies + double submit token (если нужно)

---

## 9. Переменные окружения

```env
# Server
PORT=4000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/flipbook

# JWT
JWT_SECRET=your-secret-key-min-32-chars
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=30d

# File Storage
STORAGE_TYPE=local                    # 'local' | 's3'
UPLOAD_DIR=./uploads                  # для local storage
S3_BUCKET=flipbook-uploads            # для S3
S3_REGION=us-east-1
S3_ACCESS_KEY=...
S3_SECRET_KEY=...

# CORS
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW=60000               # 1 минута
RATE_LIMIT_MAX=100                    # запросов в окно
```

---

## 10. План реализации по фазам

### Фаза 1: Фундамент (MVP серверной части)

**Цель:** Работающий сервер с аутентификацией и CRUD книг

1. Инициализация серверного проекта (package.json, tsconfig, eslint)
2. Настройка Prisma + PostgreSQL, создание схемы
3. Middleware: CORS, JSON parsing, error handler, request logging
4. Аутентификация: register, login, refresh, logout, auth middleware
5. CRUD книг: GET /api/books, POST, GET /:id, PATCH /:id, DELETE /:id
6. CRUD глав: GET, POST, GET /:id, PATCH, DELETE, GET /:id/content
7. Базовые тесты API (supertest)

**Результат:** Сервер с auth + книги + главы, можно тестировать через curl/Postman

### Фаза 2: Полный API

**Цель:** Все ресурсы доступны через API

8. Appearance API (GET, PATCH per-theme)
9. Sounds API (GET, PATCH)
10. Ambients API (CRUD)
11. Fonts API (reading fonts CRUD + decorative font)
12. Global settings API (GET, PATCH)
13. Reading progress API (GET, PUT)
14. Загрузка файлов (multer + local storage)
15. Парсинг книг на сервере (перенос парсеров)
16. Export/Import API

**Результат:** Полный API, полностью покрывающий текущую функциональность AdminConfigStore

### Фаза 3: Интеграция с фронтендом

**Цель:** Фронтенд переключён на API

17. Создать ApiClient.js
18. Добавить UI аутентификации (login/register)
19. Адаптировать config.js для загрузки с сервера
20. Адаптировать BookshelfScreen.js
21. Адаптировать ContentLoader.js
22. Адаптировать SettingsManager.js (debounced progress sync)
23. Адаптировать все админ-модули
24. Удалить клиентские парсеры (или оставить fallback)

**Результат:** Приложение работает через API

### Фаза 4: Надёжность и UX

**Цель:** Надёжная работа в реальных условиях

25. Индикатор синхронизации в UI
26. Offline fallback: localStorage cache + sync queue
27. Обработка конфликтов прогресса чтения
28. Миграция данных: импорт из localStorage при первом входе
29. Оптимистичные обновления в UI
30. E2E тесты с бэкендом

### Фаза 5: Production

**Цель:** Готовность к деплою

31. Настройка S3/MinIO для файлов (вместо локальной FS)
32. Docker / docker-compose конфигурация
33. CI/CD: тесты + деплой сервера
34. Мониторинг и логирование (pino + structured logs)
35. Документация API (Swagger/OpenAPI)
36. Настройка HTTPS, домена, CDN для статики

---

## 11. Зависимости серверной части

### Runtime

```json
{
  "express": "^5.0.0",
  "prisma": "^6.0.0",
  "@prisma/client": "^6.0.0",
  "bcrypt": "^5.1.0",
  "jsonwebtoken": "^9.0.0",
  "zod": "^3.23.0",
  "multer": "^1.4.0",
  "helmet": "^8.0.0",
  "cors": "^2.8.0",
  "express-rate-limit": "^7.0.0",
  "cookie-parser": "^1.4.0",
  "dompurify": "^3.3.0",
  "jsdom": "^25.0.0",
  "jszip": "^3.10.0",
  "pino": "^9.0.0",
  "pino-pretty": "^13.0.0",
  "dotenv": "^16.0.0"
}
```

### Dev

```json
{
  "typescript": "^5.7.0",
  "tsx": "^4.0.0",
  "vitest": "^4.0.0",
  "supertest": "^7.0.0",
  "@types/express": "^5.0.0",
  "@types/bcrypt": "^5.0.0",
  "@types/jsonwebtoken": "^9.0.0",
  "@types/multer": "^1.4.0",
  "@types/cors": "^2.8.0",
  "@types/cookie-parser": "^1.4.0"
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
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
```

---

## 13. Вопросы для уточнения

Перед началом реализации рекомендуется определить:

1. **Мультитенантность:** Один пользователь = один набор книг? Или поддержка шаринга книг между пользователями?
2. **OAuth:** Нужна ли авторизация через Google/GitHub или достаточно email+password?
3. **Хостинг:** Self-hosted (VPS/Docker) или облачный (Railway, Render, Fly.io)?
4. **Лимиты:** Максимальное количество книг/глав на пользователя? Квота хранилища?
5. **Реальное время:** Нужны ли WebSocket для уведомлений о синхронизации?
6. **TypeScript на бэкенде:** Использовать TypeScript (рекомендуется) или чистый JavaScript?
7. **Тестовая БД:** SQLite для тестов или отдельный PostgreSQL?
