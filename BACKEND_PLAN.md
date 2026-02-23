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

**Решение: express-session + connect-pg-simple + Passport.js (local + Google OAuth)**

- Серверные сессии — простая инвалидация (выход, смена пароля — мгновенно)
- connect-pg-simple — хранение сессий в PostgreSQL (отдельная таблица `session`)
- Passport.js стратегии:
  - **passport-local** — вход по email + password
  - **passport-google-oauth20** — вход через Google (Google Cloud Console → OAuth 2.0)
- httpOnly Secure cookie для session ID
- При входе через Google: если аккаунт с таким email уже существует — привязка, иначе — создание нового пользователя
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
User 1──* Album
Album 1──* AlbumPage
AlbumPage 1──* AlbumPhoto
Album 0──* AlbumView
User 1──0..1 Subscription
User 1──0..1 UserBranding
```

### 2.2 Таблицы

#### users
```sql
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),                  -- NULL для OAuth-only пользователей
    display_name  VARCHAR(100),
    avatar_url    VARCHAR(500),                  -- URL аватара (из Google)
    google_id     VARCHAR(255) UNIQUE,           -- Google OAuth subject ID
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_google_id ON users(google_id);
```

> **Примечание:** Пользователь может иметь и пароль, и Google OAuth. При входе через Google, если аккаунт с таким email уже есть — привязывается `google_id`. Если `password_hash` IS NULL и `google_id` IS NULL — невалидное состояние (CHECK constraint).

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

#### albums
```sql
CREATE TABLE albums (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title         VARCHAR(500) NOT NULL DEFAULT '',
    slug          VARCHAR(200) UNIQUE NOT NULL,           -- публичный URL: /album/:slug
    description   TEXT DEFAULT '',
    cover_photo_url VARCHAR(500),                         -- URL обложки альбома в S3
    password_hash VARCHAR(255),                           -- NULL = публичный, иначе защищён паролем
    is_public     BOOLEAN DEFAULT TRUE,
    is_published  BOOLEAN DEFAULT FALSE,                  -- черновик / опубликован
    theme_preset  VARCHAR(50) DEFAULT 'classic',          -- 'classic', 'wedding', 'newborn', 'travel', 'event', 'custom'
    -- Appearance
    cover_bg_start    VARCHAR(20) DEFAULT '#3a2d1f',
    cover_bg_end      VARCHAR(20) DEFAULT '#2a2016',
    cover_text_color  VARCHAR(20) DEFAULT '#f2e9d8',
    page_texture      VARCHAR(20) DEFAULT 'default',      -- 'default' | 'none' | 'craft' | 'old-paper' | 'custom'
    custom_texture_url VARCHAR(500),
    bg_color          VARCHAR(20) DEFAULT '#fdfcf8',
    -- Ambient & sounds
    ambient_type      VARCHAR(100) DEFAULT 'none',
    ambient_url       VARCHAR(500),                       -- кастомный эмбиент
    page_flip_sound   BOOLEAN DEFAULT TRUE,
    -- Watermark (Pro)
    watermark_enabled BOOLEAN DEFAULT FALSE,
    watermark_text    VARCHAR(200),                        -- текст водяного знака или имя студии
    watermark_opacity REAL DEFAULT 0.3,
    -- Analytics cache
    views_count       INTEGER DEFAULT 0,
    -- Timestamps
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_albums_slug ON albums(slug);
CREATE INDEX idx_albums_user_id ON albums(user_id);
CREATE INDEX idx_albums_published ON albums(user_id, is_published);
```

#### album_pages
```sql
CREATE TABLE album_pages (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id      UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    position      INTEGER NOT NULL DEFAULT 0,
    layout        VARCHAR(10) NOT NULL DEFAULT '1',       -- '1', '2', '2h', '3', '3a', '3b', '4'
    frame_type    VARCHAR(30) DEFAULT 'none',             -- 'none', 'thin', 'shadow', 'polaroid', 'rounded', 'double'
    filter_type   VARCHAR(30) DEFAULT 'none',             -- 'none', 'grayscale', 'sepia', 'contrast', 'warm', 'cool'
    filter_intensity REAL DEFAULT 1.0,                    -- 0.0–1.0
    bg_color      VARCHAR(20),                            -- фон страницы (опционально)
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_album_pages_album_id ON album_pages(album_id);
CREATE INDEX idx_album_pages_position ON album_pages(album_id, position);
```

#### album_photos
```sql
CREATE TABLE album_photos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id         UUID NOT NULL REFERENCES album_pages(id) ON DELETE CASCADE,
    position        INTEGER NOT NULL DEFAULT 0,           -- позиция фото на странице (0–3)
    file_url        VARCHAR(500) NOT NULL,                -- оригинал в S3
    thumbnail_url   VARCHAR(500),                         -- миниатюра в S3 (для админки и lightbox preload)
    display_url     VARCHAR(500),                         -- оптимизированная версия для отображения (max 1920px)
    width           INTEGER,                              -- размеры оригинала
    height          INTEGER,
    file_size       INTEGER,                              -- размер файла в байтах
    caption         VARCHAR(500) DEFAULT '',               -- подпись к фото
    -- Crop (кадрирование)
    crop_x          REAL,                                 -- 0.0–1.0 (пропорция от ширины)
    crop_y          REAL,
    crop_w          REAL,
    crop_h          REAL,
    -- EXIF metadata
    taken_at        TIMESTAMPTZ,                          -- дата съёмки из EXIF
    camera_model    VARCHAR(200),
    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_album_photos_page_id ON album_photos(page_id);
```

#### album_views (аналитика просмотров)
```sql
CREATE TABLE album_views (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id        UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    viewer_ip_hash  VARCHAR(64),                          -- SHA-256 хеш IP (не храним сырые IP)
    pages_viewed    INTEGER DEFAULT 0,                    -- сколько страниц просмотрел
    total_pages     INTEGER DEFAULT 0,                    -- сколько страниц было в альбоме
    duration_sec    INTEGER DEFAULT 0,                    -- время просмотра в секундах
    viewed_at       TIMESTAMPTZ DEFAULT NOW(),
    referrer        VARCHAR(500),                         -- откуда пришёл
    user_agent      VARCHAR(500)
);

CREATE INDEX idx_album_views_album_id ON album_views(album_id);
CREATE INDEX idx_album_views_date ON album_views(album_id, viewed_at);
```

#### subscriptions (биллинг)
```sql
CREATE TABLE subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan                    VARCHAR(20) NOT NULL DEFAULT 'free',  -- 'free', 'personal', 'pro'
    stripe_customer_id      VARCHAR(255),
    stripe_subscription_id  VARCHAR(255),
    status                  VARCHAR(30) DEFAULT 'active',        -- 'active', 'trialing', 'past_due', 'canceled', 'incomplete'
    current_period_start    TIMESTAMPTZ,
    current_period_end      TIMESTAMPTZ,
    cancel_at_period_end    BOOLEAN DEFAULT FALSE,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
```

> **Лимиты по планам:**
>
> | Ресурс | Free | Personal ($12/мес) | Pro ($49/мес) |
> |--------|------|--------------------|---------------|
> | Альбомов | 2 | Безлимит | Безлимит |
> | Фото / альбом | 50 | 500 | 1000 |
> | Хранилище | 500 МБ | 10 ГБ | 50 ГБ |
> | Водяной знак | Flipbook branding | Без branding | Свой watermark |
> | Пароль на альбом | — | ✓ | ✓ |
> | Аналитика | — | Базовая | Полная |
> | White-label | — | — | ✓ |
> | Кастомный домен | — | — | ✓ |
> | Embed-код | — | — | ✓ |

#### user_branding (Pro — white-label)
```sql
CREATE TABLE user_branding (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    studio_name     VARCHAR(200),
    logo_url        VARCHAR(500),                         -- логотип в S3
    custom_domain   VARCHAR(255),                         -- CNAME: albums.photostudio.ru
    primary_color   VARCHAR(20) DEFAULT '#3a2d1f',
    accent_color    VARCHAR(20) DEFAULT '#d4a574',
    footer_text     VARCHAR(500),                         -- «© Studio Name 2026»
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. REST API

### 3.1 Аутентификация (серверные сессии + Passport.js)

#### Email + Password

| Метод  | Эндпоинт              | Описание                         | Тело запроса                         |
|--------|------------------------|----------------------------------|--------------------------------------|
| POST   | `/api/auth/register`   | Регистрация + автоматический вход | `{email, password, displayName?}`   |
| POST   | `/api/auth/login`      | Вход (создаёт сессию)            | `{email, password}`                 |
| POST   | `/api/auth/logout`     | Выход (уничтожает сессию)        | —                                   |
| GET    | `/api/auth/me`         | Получить текущего пользователя   | —                                   |

#### Google OAuth 2.0

| Метод  | Эндпоинт                    | Описание                                      |
|--------|-------------------------------|-----------------------------------------------|
| GET    | `/api/auth/google`            | Редирект на Google для авторизации             |
| GET    | `/api/auth/google/callback`   | Callback от Google → создание сессии → редирект на фронтенд |

**Флоу Google OAuth:**
1. Клиент открывает `/api/auth/google` (или popup)
2. Passport.js редиректит на Google consent screen
3. Google редиректит на `/api/auth/google/callback` с authorization code
4. Passport обменивает code на токен, получает профиль пользователя
5. Если email уже есть в БД — привязывает `google_id`, входит
6. Если email новый — создаёт пользователя (без пароля), входит
7. Редирект на фронтенд (`/` или `/admin`)

**Механизм сессий:**
- При login/register/google callback сервер создаёт сессию в PostgreSQL (connect-pg-simple)
- Session ID передаётся в httpOnly Secure cookie (`connect.sid`)
- Все последующие запросы автоматически включают cookie
- При logout — `req.session.destroy()` удаляет сессию из БД

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

### 3.12 Фотоальбомы (CRUD, authenticated)

| Метод  | Эндпоинт                                    | Описание                                     |
|--------|----------------------------------------------|----------------------------------------------|
| GET    | `/api/albums`                                | Список альбомов текущего пользователя         |
| POST   | `/api/albums`                                | Создать альбом                               |
| GET    | `/api/albums/:albumId`                       | Получить альбом (все страницы + фото)         |
| PATCH  | `/api/albums/:albumId`                       | Обновить метаданные альбома                   |
| DELETE | `/api/albums/:albumId`                       | Удалить альбом (каскадно с фото из S3)        |
| POST   | `/api/albums/:albumId/publish`               | Опубликовать альбом                          |
| POST   | `/api/albums/:albumId/unpublish`             | Снять с публикации                           |

**POST /api/albums — создание:**
```json
{
  "title": "Свадьба Ани и Миши",
  "themePreset": "wedding",
  "description": "12 июня 2026, Тоскана"
}
```
Ответ: `{ "id": "uuid", "slug": "svadba-ani-i-mishi-a3f2" }`

**GET /api/albums/:albumId — полная информация:**
```json
{
  "id": "uuid",
  "title": "Свадьба Ани и Миши",
  "slug": "svadba-ani-i-mishi-a3f2",
  "isPublished": true,
  "isPublic": true,
  "hasPassword": true,
  "themePreset": "wedding",
  "appearance": {
    "coverBgStart": "#3a2d1f",
    "coverBgEnd": "#2a2016",
    "coverTextColor": "#f2e9d8",
    "pageTexture": "default",
    "bgColor": "#fdfcf8"
  },
  "watermark": { "enabled": true, "text": "PhotoStudio", "opacity": 0.3 },
  "pages": [
    {
      "id": "uuid",
      "position": 0,
      "layout": "1",
      "frameType": "polaroid",
      "filterType": "warm",
      "filterIntensity": 0.6,
      "photos": [
        {
          "id": "uuid",
          "position": 0,
          "displayUrl": "https://cdn.../photo_1920.jpg",
          "thumbnailUrl": "https://cdn.../photo_thumb.jpg",
          "width": 4000,
          "height": 2667,
          "caption": "Первый танец",
          "crop": null
        }
      ]
    }
  ],
  "viewsCount": 142,
  "createdAt": "2026-06-15T10:00:00Z"
}
```

#### Страницы альбома

| Метод  | Эндпоинт                                              | Описание                        |
|--------|--------------------------------------------------------|---------------------------------|
| POST   | `/api/albums/:albumId/pages`                           | Добавить страницу               |
| PATCH  | `/api/albums/:albumId/pages/:pageId`                   | Обновить страницу (layout, frame, filter) |
| DELETE | `/api/albums/:albumId/pages/:pageId`                   | Удалить страницу                |
| PATCH  | `/api/albums/:albumId/pages/reorder`                   | Изменить порядок страниц        |

#### Фото

| Метод  | Эндпоинт                                              | Описание                             |
|--------|--------------------------------------------------------|--------------------------------------|
| POST   | `/api/albums/:albumId/pages/:pageId/photos`            | Загрузить фото (multipart)           |
| POST   | `/api/albums/:albumId/photos/batch`                    | Пакетная загрузка (до 50 фото)       |
| PATCH  | `/api/albums/:albumId/photos/:photoId`                 | Обновить фото (caption, crop)        |
| DELETE | `/api/albums/:albumId/photos/:photoId`                 | Удалить фото (+ файлы из S3)         |
| POST   | `/api/albums/:albumId/photos/:photoId/crop`            | Применить кадрирование               |

**POST /api/albums/:albumId/photos/batch — пакетная загрузка:**
- Content-Type: multipart/form-data
- Поля: `photos[]` (до 50 файлов), `autoLayout` (bool — авторасставить по страницам)
- Макс. размер файла: 15 МБ, макс. запрос: 200 МБ
- Сервер обрабатывает каждое фото: EXIF → resize (оригинал, display 1920px, thumbnail 400px) → S3
- Ответ:
```json
{
  "uploaded": 47,
  "failed": 3,
  "photos": [
    { "id": "uuid", "displayUrl": "...", "thumbnailUrl": "...", "width": 4000, "height": 2667 }
  ],
  "errors": [
    { "filename": "broken.jpg", "error": "Invalid image format" }
  ]
}
```

### 3.13 Публичные эндпоинты (без аутентификации)

> Эти маршруты доступны любому пользователю по ссылке — для просмотра опубликованных альбомов.

| Метод  | Эндпоинт                                     | Описание                                        |
|--------|-----------------------------------------------|------------------------------------------------|
| GET    | `/api/public/album/:slug`                     | Получить альбом для просмотра                   |
| POST   | `/api/public/album/:slug/verify-password`     | Проверить пароль (если альбом защищён)          |
| POST   | `/api/public/album/:slug/view`                | Записать аналитику просмотра                    |
| GET    | `/api/public/album/:slug/embed`               | Данные для embed-виджета (урезанные)            |

**GET /api/public/album/:slug — ответ:**
- Если альбом без пароля — полное содержимое (страницы, фото URL, настройки)
- Если альбом с паролем — `{ "requiresPassword": true, "title": "...", "coverPhotoUrl": "..." }` (только обложка)
- После верификации пароля: session cookie с доступом → полное содержимое

**POST /api/public/album/:slug/view — аналитика:**
```json
{
  "pagesViewed": 12,
  "totalPages": 24,
  "durationSec": 180,
  "referrer": "https://instagram.com/photographer"
}
```

### 3.14 Биллинг (Stripe)

| Метод  | Эндпоинт                                     | Описание                                   |
|--------|-----------------------------------------------|-------------------------------------------|
| GET    | `/api/billing`                                | Текущий план и статус подписки             |
| POST   | `/api/billing/checkout`                       | Создать Stripe Checkout Session            |
| POST   | `/api/billing/portal`                         | Создать Stripe Customer Portal Session     |
| POST   | `/api/billing/webhook`                        | Stripe webhook (raw body, signature verify) |

**POST /api/billing/checkout:**
```json
{ "plan": "pro" }
```
Ответ: `{ "checkoutUrl": "https://checkout.stripe.com/..." }`

**GET /api/billing — ответ:**
```json
{
  "plan": "pro",
  "status": "active",
  "currentPeriodEnd": "2026-03-15T00:00:00Z",
  "cancelAtPeriodEnd": false,
  "usage": {
    "albums": 12,
    "storageUsedMb": 2400,
    "storageLimitMb": 51200
  }
}
```

**Stripe webhook events:**
- `checkout.session.completed` → активация подписки
- `invoice.paid` → продление
- `invoice.payment_failed` → пометить `past_due`
- `customer.subscription.deleted` → даунгрейд на free

### 3.15 Аналитика альбомов (Pro)

| Метод  | Эндпоинт                                                | Описание                                |
|--------|----------------------------------------------------------|-----------------------------------------|
| GET    | `/api/albums/:albumId/analytics`                         | Сводная аналитика альбома               |
| GET    | `/api/albums/:albumId/analytics/views`                   | Детальная история просмотров            |
| GET    | `/api/analytics/dashboard`                               | Общая аналитика по всем альбомам        |

**GET /api/albums/:albumId/analytics — ответ:**
```json
{
  "totalViews": 142,
  "uniqueViewers": 89,
  "avgPagesViewed": 18.5,
  "avgDurationSec": 245,
  "completionRate": 0.72,
  "viewsByDay": [
    { "date": "2026-02-20", "views": 15 },
    { "date": "2026-02-21", "views": 23 }
  ],
  "topReferrers": [
    { "referrer": "instagram.com", "count": 45 },
    { "referrer": "direct", "count": 38 }
  ]
}
```

### 3.16 Брендинг (Pro)

| Метод  | Эндпоинт                          | Описание                          |
|--------|-------------------------------------|-----------------------------------|
| GET    | `/api/branding`                     | Получить настройки брендинга      |
| PATCH  | `/api/branding`                     | Обновить брендинг                 |
| POST   | `/api/branding/logo`                | Загрузить логотип (multipart)     |

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
│   │   ├── albumAccess.ts         # Проверка доступа к альбому (пароль, публичность)
│   │   ├── planLimits.ts          # Проверка лимитов тарифного плана
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
│   │   ├── export.routes.ts       # /api/export, /api/import
│   │   ├── albums.routes.ts       # /api/albums/* (CRUD альбомов, страниц, фото)
│   │   ├── public.routes.ts       # /api/public/* (публичные эндпоинты, без auth)
│   │   ├── billing.routes.ts      # /api/billing/* (Stripe checkout, portal, webhook)
│   │   ├── analytics.routes.ts    # /api/albums/:albumId/analytics/*
│   │   └── branding.routes.ts     # /api/branding/*
│   │
│   ├── services/
│   │   ├── auth.service.ts        # Логика аутентификации (хэширование, OAuth привязка)
│   │   ├── books.service.ts       # CRUD книг
│   │   ├── chapters.service.ts    # CRUD глав
│   │   ├── appearance.service.ts  # Внешний вид книги
│   │   ├── sounds.service.ts      # Звуки книги
│   │   ├── ambients.service.ts    # Эмбиенты
│   │   ├── fonts.service.ts       # Шрифты (reading + decorative)
│   │   ├── settings.service.ts    # Глобальные настройки
│   │   ├── progress.service.ts    # Прогресс чтения
│   │   ├── upload.service.ts      # Обработка загрузок + хранение
│   │   ├── export.service.ts      # Экспорт/импорт
│   │   ├── albums.service.ts      # CRUD альбомов + страниц + фото
│   │   ├── imageProcessor.service.ts # Обработка фото (sharp): resize, thumbnail, watermark, EXIF
│   │   ├── billing.service.ts     # Stripe: checkout, webhook, plan management
│   │   ├── analytics.service.ts   # Аналитика просмотров альбомов
│   │   └── branding.service.ts    # White-label брендинг
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
│   │   ├── sanitize.ts            # Санитизация HTML (server-side DOMPurify)
│   │   └── slug.ts                # Генерация уникальных slug для альбомов (transliteration + nanoid)
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
- Форма входа / регистрации (email + password)
- Кнопка «Войти через Google» → переход на `/api/auth/google`
- Валидация на стороне клиента

#### Индикатор синхронизации
- Показывать статус: «Сохранено» / «Сохранение...» / «Ошибка синхронизации»
- При ошибке сети: сохранять локально, синхронизировать при восстановлении

### 5.4 Новые компоненты для фотоальбома

#### AlbumManager — рефакторинг хранения
- Замена base64 в HTML на S3 URL:
  ```
  Было:   <img src="data:image/jpeg;base64,/9j/4...">
  Стало:  <img src="https://cdn.example.com/photos/abc123_1920.jpg">
  ```
- Загрузка фото через `POST /api/albums/:albumId/photos/batch` вместо FileReader.readAsDataURL()
- Пакетная загрузка (drag & drop multiple + multi-select)
- Обработка на сервере (resize, thumbnail, EXIF, watermark)
- Progress bar для batch upload

#### Публичный просмотр альбома
- Новый entry point: `album.html` (или SPA route `/album/:slug`)
- Загрузка альбома: `GET /api/public/album/:slug`
- Форма ввода пароля (если альбом защищён)
- Трекинг просмотра: `POST /api/public/album/:slug/view` при закрытии
- Lightbox для полноразмерных фото
- Брендинг владельца (логотип, имя студии) — если Pro

#### Биллинг UI
- Страница тарифов с кнопками «Выбрать план»
- Редирект на Stripe Checkout: `POST /api/billing/checkout` → `window.location = checkoutUrl`
- Управление подпиской: `POST /api/billing/portal` → Stripe Customer Portal
- Отображение текущего плана и использования (storage, albums count)

#### Аналитика альбомов (Pro)
- Дашборд с графиками просмотров (Chart.js / lightweight)
- Per-album аналитика: views, unique viewers, completion rate, referrers
- Экспорт аналитики в CSV

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
- Passport.js: local strategy для email+password, google-oauth20 для Google
- Все API эндпоинты (кроме auth и /api/public/*) требуют активную сессию (`req.isAuthenticated()`)
- Проверка владения: все операции с книгами/главами/альбомами проверяют `resource.user_id === currentUser.id`
- Публичные эндпоинты `/api/public/*`: не требуют auth, но rate limited (30 req/min per IP)
- Публичные альбомы с паролем: верификация пароля → сессионный cookie с доступом к конкретному альбому
- Stripe webhook `/api/billing/webhook`: верификация подписи (stripe-signature header), raw body
- Rate limiting: ограничение запросов (100 req/min для обычных, 5 req/min для auth, 30 req/min для public)
- **На будущее:** connect-redis для хранения сессий при высокой нагрузке

### 8.2 Валидация данных

- Входные данные валидируются на сервере (zod/joi)
- Санитизация HTML контента на сервере (DOMPurify server-side через jsdom)
- Максимальные размеры тел запросов: 10 MB для обычных, 50 MB для загрузки книг, 200 MB для batch upload фото
- MIME-type проверка загружаемых файлов (изображения: JPEG, PNG, WebP, HEIC)
- Защита от path traversal при файловых операциях
- Проверка лимитов плана (planLimits middleware): альбомы, хранилище, фичи
- Slug validation: только допустимые символы (a-z, 0-9, дефис), уникальность

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

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback

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

# App URL (для публичных ссылок на альбомы)
APP_URL=http://localhost:3000

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PERSONAL=price_...       # Stripe Price ID для Personal ($12/мес)
STRIPE_PRICE_PRO=price_...            # Stripe Price ID для Pro ($49/мес)

# Image Processing
IMAGE_MAX_DISPLAY_WIDTH=1920          # Максимальная ширина для отображения
IMAGE_THUMBNAIL_WIDTH=400             # Ширина миниатюры
IMAGE_JPEG_QUALITY=85                 # Качество JPEG
IMAGE_MAX_FILE_SIZE=15728640          # 15 МБ в байтах
IMAGE_BATCH_MAX_FILES=50              # Макс. файлов в пакетной загрузке

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
6. Аутентификация: Passport.js (local + google-oauth20), register, login, Google OAuth, logout, auth middleware
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

**Цель:** Готовность к деплою (книжный ридер)

33. CI/CD: тесты + деплой сервера
34. Мониторинг и логирование (pino + structured logs)
35. Документация API (Swagger/OpenAPI)
36. Настройка HTTPS, домена, CDN для статики
37. **(По необходимости):** Миграция сессий на Redis (connect-redis + ioredis)

### Фаза 6: Фотоальбом — фундамент

**Цель:** CRUD альбомов с S3-хранением фотографий

38. Схема БД: albums, album_pages, album_photos (Prisma миграция)
39. Image processing pipeline (sharp): resize → display (1920px) + thumbnail (400px) + EXIF extraction
40. Albums CRUD API: создание, обновление, удаление с каскадным удалением фото из S3
41. Album pages API: добавление/удаление/реордеринг страниц
42. Photo upload: single + batch (до 50 файлов), multipart → sharp → S3
43. Slug generation: транслитерация + nanoid для уникальности
44. Рефакторинг AlbumManager.js на клиенте: S3 URL вместо base64
45. Пакетная загрузка на клиенте: drag & drop, multi-select, progress bar

**Результат:** Альбомы создаются и хранятся на сервере, фото — в S3

### Фаза 7: Фотоальбом — публичный доступ

**Цель:** Альбомы доступны по ссылке для просмотра

46. Public routes: GET /api/public/album/:slug (без аутентификации)
47. Пароль на альбом: хеширование (bcrypt), сессионная верификация
48. Публичный viewer: album.html / SPA route с книжным перелистыванием
49. Lightbox с FLIP-анимацией для полноразмерных фото
50. Ambient-звуки и текстуры страниц в публичном альбоме
51. Защита от скачивания: disable right-click, CSS pointer-events overlay (базовая)
52. SEO: meta tags (Open Graph, Twitter Card) для шаринга ссылок

**Результат:** Пользователь может отправить ссылку → получатель видит красивый альбом

### Фаза 8: Биллинг и тарифные планы

**Цель:** Монетизация через Stripe

53. Схема БД: subscriptions (Prisma миграция)
54. Stripe интеграция: Checkout Session, Customer Portal, Webhook handler
55. Middleware planLimits: проверка лимитов (альбомы, хранилище, фичи) по текущему плану
56. Billing API: GET /api/billing, POST checkout, POST portal
57. Billing UI: страница тарифов, текущий план, usage bar
58. Free-tier watermark: «Сделано в Flipbook» на бесплатных альбомах
59. Graceful downgrade: при отмене Pro — альбомы остаются, но watermark возвращается

**Результат:** Пользователи могут оплатить Pro/Personal, лимиты работают

### Фаза 9: Pro-фичи (фотографы)

**Цель:** White-label и аналитика для фотографов

60. Схема БД: user_branding, album_views (Prisma миграция)
61. Аналитика: сбор данных просмотров, агрегация (views, unique, completion rate, referrers)
62. Analytics API + дашборд на клиенте (Chart.js)
63. White-label брендинг: логотип, имя студии, цвета → отображение в публичном альбоме
64. Водяной знак: sharp overlay на все фото альбома при генерации display-версии
65. Embed-код: iframe snippet с минимальным viewer
66. **(По необходимости):** Кастомный домен (CNAME + SSL через Let's Encrypt / Cloudflare)

**Результат:** Фотографы могут брендировать альбомы и отслеживать аналитику

### Фаза 10: B2C и рост

**Цель:** Массовый рынок

67. Шаблоны тематик: свадьба, newborn, travel, событие — presets (цвета, текстуры, ambient)
68. Автораскладка: при batch upload — автоматическое создание страниц (portrait/landscape → подходящий layout)
69. Базовое кадрирование фото на клиенте (crop tool перед загрузкой)
70. Реферальная программа: фотограф Pro получает уникальную ссылку → скидка для клиента
71. «Открыть в Flipbook» ссылка на бесплатных альбомах → виральность
72. **(По необходимости):** Мобильный редактор альбомов (responsive admin)

**Результат:** Продукт готов для B2C аудитории, органический рост

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
  "passport-google-oauth20": "^2.0.0",
  "zod": "^3.23.0",
  "multer": "^1.4.0",
  "@aws-sdk/client-s3": "^3.700.0",
  "helmet": "^8.0.0",
  "cors": "^2.8.0",
  "express-rate-limit": "^7.0.0",
  "dompurify": "^3.3.0",
  "jsdom": "^25.0.0",
  "jszip": "^3.10.0",
  "stripe": "^17.0.0",
  "sharp": "^0.34.0",
  "exif-reader": "^2.0.0",
  "nanoid": "^5.0.0",
  "transliteration": "^2.3.0",
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
  "@types/passport-google-oauth20": "^2.0.0",
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
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      GOOGLE_CALLBACK_URL: http://localhost:4000/api/auth/google/callback
      S3_ENDPOINT: http://minio:9000
      S3_BUCKET: flipbook-uploads
      S3_ACCESS_KEY: minioadmin
      S3_SECRET_KEY: minioadmin
      S3_FORCE_PATH_STYLE: "true"
      S3_PUBLIC_URL: http://localhost:9000/flipbook-uploads
      CORS_ORIGIN: http://localhost:3000
      APP_URL: http://localhost:3000
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY:-sk_test_placeholder}
      STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET:-whsec_placeholder}
      STRIPE_PRICE_PERSONAL: ${STRIPE_PRICE_PERSONAL}
      STRIPE_PRICE_PRO: ${STRIPE_PRICE_PRO}
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
| Аутентификация | express-session + connect-pg-simple + Passport.js (local + Google OAuth) |
| Файлы | S3 с первого дня (MinIO для dev, AWS S3 для prod) |
| Структура | Монорепо (`server/` в этом репозитории) |
| API | REST |
| Деплой | Docker + docker-compose |
| Redis | На будущее (замена connect-pg-simple → connect-redis) |
| Шеринг книг | Нет — один пользователь = свой набор книг |
| OAuth | Google OAuth 2.0 (passport-google-oauth20) |
| WebSocket | Не нужны — синхронизация через REST |
| Фотоальбом | Самостоятельный SaaS-продукт с публичными ссылками |
| Биллинг | Stripe (Checkout + Customer Portal + Webhooks) |
| Тарифы | Free (2 альбома) / Personal $12/мес / Pro $49/мес |
| Хранение фото | S3 (не base64) — оригинал + display 1920px + thumbnail 400px |
| Image processing | sharp (server-side resize, watermark, EXIF) |
| Публичный доступ | /api/public/* — без auth, по slug альбома |
| Аналитика | Серверная (album_views), агрегация для Pro |
| White-label | Pro: логотип, имя студии, кастомный домен |
| Slug | Транслитерация заголовка + nanoid для уникальности |

## 15. Обработка изображений (Image Processing Pipeline)

Серверный pipeline обработки фотографий при загрузке:

```
Загрузка файла (multipart/form-data)
    ↓
Валидация (MIME type, размер ≤ 15 МБ, формат: JPEG/PNG/WebP/HEIC)
    ↓
EXIF extraction (exif-reader): дата съёмки, камера, ориентация
    ↓
Auto-orient (sharp): исправить ориентацию по EXIF
    ↓
┌─────────────────────────────────────────────────┐
│ Параллельная генерация трёх версий (sharp):     │
│                                                 │
│ 1. Original → S3 (как есть, для скачивания)     │
│ 2. Display  → resize max 1920px → JPEG 85%      │
│    + watermark overlay (если включён) → S3      │
│ 3. Thumbnail → resize max 400px → JPEG 80% → S3 │
└─────────────────────────────────────────────────┘
    ↓
Запись метаданных в album_photos (URLs, размеры, EXIF)
    ↓
Ответ клиенту: { id, displayUrl, thumbnailUrl, width, height }
```

**Watermark (Pro):**
- sharp `composite()` — наложение текста или PNG логотипа
- Позиция: правый нижний угол, opacity из настроек пользователя
- Применяется только к display-версии (не к оригиналу и thumbnail)

**Batch upload:**
- До 50 файлов в одном запросе
- Обработка через `Promise.allSettled()` — частичные ошибки не блокируют весь batch
- Progress: клиент отслеживает через отдельные запросы или SSE (Server-Sent Events)

---

## 16. Открытые вопросы

1. **Лимиты:** Максимальное количество книг/глав на пользователя? Квота S3 хранилища?
2. **CDN для фото:** Нужен ли CloudFront/Cloudflare перед S3 для публичных альбомов? (Рекомендуется при >1000 просмотров/день)
3. **HEIC support:** Поддерживать ли Apple HEIC формат? (sharp поддерживает, но увеличивает время обработки)
4. **Video:** Поддерживать ли видеоклипы на страницах альбома? (Значительно усложняет pipeline)
5. **GDPR:** Нужен ли EU-регион S3 для европейских пользователей? Политика удаления данных?
6. **Stripe Connect:** Нужна ли фотографам возможность перепродавать альбомы своим клиентам через Stripe Connect?
7. **Автораскладка:** Простой алгоритм (portrait/landscape → шаблон) или ML-based (aesthetic scoring)?
