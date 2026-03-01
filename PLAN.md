# План: Flipbook → мультипользовательская платформа

## Обзор

Четыре экрана, один SPA:

```
/                → Лендинг (гости) | Редирект на /:username (авторизованные)
/:username       → Публичный шкаф автора (гость = витрина, хозяин = витрина + управление)
/account         → Личный кабинет (только владелец)
/book/:id        → Ридер (гость = read-only, автор = с редактированием)
/embed/:id       → Встраиваемый ридер (минимальный, без навигации)
```

---

## Фаза 1: База данных и API

### 1.1 Миграция Prisma — User: добавить username и bio

**Файл:** `server/prisma/schema.prisma` — модель `User`

```prisma
model User {
  // Добавить:
  username    String?   @unique @db.VarChar(40)
  bio         String?   @db.VarChar(500)
}
```

- `username` — nullable на старте (существующие юзеры без него)
- Валидация: `^[a-z0-9][a-z0-9-]{2,39}$` (латиница, цифры, дефис, 3-40 символов)
- Резерв служебных слов: `account`, `book`, `embed`, `api`, `admin`, `about`, `help`, `settings`, `search`, `explore`, `login`, `register`, `auth`, `static`, `assets`, `public`, `new`

### 1.2 Миграция Prisma — Book: visibility и описание

**Файл:** `server/prisma/schema.prisma` — модель `Book`

```prisma
model Book {
  // Добавить:
  visibility  String    @default("draft") @db.VarChar(20)  // draft | published | unlisted
  description String?   @db.VarChar(2000)
  publishedAt DateTime? @db.Timestamptz()

  @@index([visibility, publishedAt])  // для каталога публичных книг
}
```

### 1.3 Создать миграцию

**Команда:** `cd server && npx prisma migrate dev --name add-username-visibility`

### 1.4 Zod-схемы для новых полей

**Файл:** `server/src/schemas.ts`

Добавить:
- `updateProfileSchema` — `{ username?, displayName?, bio?, avatarUrl? }` с валидацией username
- `usernameParamSchema` — для парсинга `:username` из URL
- Расширить `updateBookSchema` — добавить `visibility` и `description`
- `publicBooksQuerySchema` — `{ limit?, offset?, sort? }`

### 1.5 Новые API-эндпоинты

**Новый файл:** `server/src/routes/profile.routes.ts`

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| `GET` | `/api/profile` | Да | Получить свой профиль (с username, bio) |
| `PUT` | `/api/profile` | Да | Обновить профиль (username, displayName, bio, avatarUrl) |
| `GET` | `/api/profile/check-username/:username` | Да | Проверить доступность username |

**Новый файл:** `server/src/routes/public.routes.ts`

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| `GET` | `/api/public/shelves/:username` | Нет | Шкаф автора (профиль + published книги) |
| `GET` | `/api/public/books/:bookId` | Нет | Детали публичной книги (published/unlisted) |
| `GET` | `/api/public/books/:bookId/chapters` | Нет | Главы публичной книги |
| `GET` | `/api/public/books/:bookId/chapters/:chapterId/content` | Нет | Контент главы |
| `GET` | `/api/public/discover` | Нет | Каталог: новые публичные книги |

**Новый файл:** `server/src/services/profile.service.ts`

- `getProfile(userId)` — получить профиль
- `updateProfile(userId, data)` — обновить (с проверкой уникальности username)
- `isUsernameAvailable(username)` — проверка + резерв слов

**Новый файл:** `server/src/services/public.service.ts`

- `getShelf(username)` — профиль автора + его published книги
- `getPublicBook(bookId)` — деталь книги (только published/unlisted)
- `getPublicChapters(bookId)` — главы публичной книги
- `getPublicChapterContent(bookId, chapterId)` — контент главы
- `discoverBooks({ limit, offset, sort })` — каталог с пагинацией

### 1.6 Расширить существующие эндпоинты

**Файл:** `server/src/routes/books.routes.ts`

- `PATCH /api/books/:bookId` — добавить обработку `visibility`, `description`
- При установке `visibility: 'published'` — автоматически ставить `publishedAt = new Date()` (если ещё не установлено)
- При установке `visibility: 'draft'` — НЕ сбрасывать `publishedAt` (дата первой публикации сохраняется)

### 1.7 Rate limiting для публичных эндпоинтов

**Файл:** `server/src/middleware/rateLimit.ts`

- `createPublicRateLimiter()` уже существует (30 req/min) — использовать для `/api/public/*`

### 1.8 Маппер для публичных данных

**Файл:** `server/src/utils/mappers.ts`

Добавить:
- `toPublicAuthor(user)` — `{ username, displayName, avatarUrl, bio }` (без email!)
- `toPublicBookCard(book)` — `{ id, title, author, description, visibility, publishedAt, chaptersCount, appearance.light.coverBg* }`
- `toPublicBookDetail(book)` — полная деталь без приватных полей

---

## Фаза 2: Фронтенд-роутер

### 2.1 Создать SPA-роутер

**Новый файл:** `js/utils/Router.js`

Лёгкий роутер на History API, без зависимостей:

```javascript
class Router {
  constructor(routes) { /* { pattern, handler } */ }
  navigate(path, { replace } = {})
  getCurrentRoute()
  start()
  destroy()
}
```

Маршруты:
- `/` → `LandingScreen` (гость) или редирект на `/:username` (авторизованный)
- `/:username` → `BookshelfScreen` (публичный шкаф)
- `/account` → `AccountScreen` (личный кабинет)
- `/account/books` → `AccountScreen` (вкладка «Мои книги»)
- `/book/:id` → Ридер
- `/embed/:id` → Ридер в embed-режиме

### 2.2 Рефакторинг точки входа

**Файл:** `js/index.js`

Сейчас: хардкожен флоу `bookshelf → reader` через `sessionStorage` + `location.reload()`.

Переделать:
1. Инициализация → проверка auth → запуск Router
2. Router определяет текущий экран по URL
3. Переходы через `router.navigate()` вместо `location.reload()`
4. Убрать `sessionStorage` флаги (`flipbook-admin-mode`, `flipbook-admin-edit-book`)

### 2.3 Контейнер экранов

**Файл:** `index.html`

Добавить секции-контейнеры для каждого экрана:

```html
<div id="screen-landing" class="screen" hidden></div>
<div id="screen-bookshelf" class="screen" hidden></div>
<div id="screen-account" class="screen" hidden></div>
<div id="screen-reader" class="screen" hidden></div>
```

Роутер показывает/скрывает нужный контейнер. View Transitions API (уже используется в BookshelfScreen) — применить ко всем переходам.

### 2.4 Объединить index.html и admin.html

Сейчас — два отдельных HTML-файла с отдельными entry points. Нужно объединить в один SPA:

- Контент из `admin.html` переносится в секцию `#screen-account` внутри `index.html`
- `js/admin/index.js` становится модулем, подключаемым по требованию (dynamic import)
- `admin.html` как отдельный файл — удалить (или оставить как редирект)
- Vite entry point: остаётся один `index.html`

---

## Фаза 3: Лендинг

### 3.1 Экран лендинга

**Новый файл:** `js/core/LandingScreen.js`

```javascript
class LandingScreen {
  constructor({ onAuth, apiClient })
  show()    // Рендерит лендинг в #screen-landing
  hide()
  destroy()
}
```

Содержание:
- **Hero-секция:** заголовок + подзаголовок + CTA-кнопка «Создать книгу» → `AuthModal`
- **Витрина:** 3-6 публичных книг из `GET /api/public/discover` (карточки с обложками)
- **Как это работает:** 3 шага — загрузи / оформи / поделись (иконки + текст)
- **Footer:** ссылки

### 3.2 Стили лендинга

**Новый файл:** `css/landing.css`

- Импортировать в `css/index.css`
- Адаптивность: mobile-first
- Анимации при скролле — минимальные, через `IntersectionObserver`

### 3.3 Логика показа

**Файл:** `js/index.js` (роутер)

```
GET / →
  if (авторизован) → router.navigate('/' + user.username)
  else → LandingScreen.show()
```

### 3.4 Интеграция AuthModal

**Файл:** `js/core/AuthModal.js`

Доработать:
- После успешной регистрации → показать шаг «Выберите username» (inline в модалке)
- Валидация username в реальном времени (`GET /api/profile/check-username/:username`)
- После выбора username → `router.navigate('/' + username)`

---

## Фаза 4: Публичный шкаф

### 4.1 Рефакторинг BookshelfScreen

**Файл:** `js/core/BookshelfScreen.js`

Сейчас: показывает только свои книги, контекстное меню (read/edit/delete).

Переделать в два режима:

**Режим «гость»** (`:username` ≠ текущий юзер):
- Шапка: аватар, displayName, bio автора
- Полки с published-книгами автора (данные из `GET /api/public/shelves/:username`)
- Клик на книгу → `router.navigate('/book/' + bookId)`
- Нет контекстного меню, нет кнопки «Добавить книгу»

**Режим «хозяин»** (`:username` === текущий юзер):
- Та же шапка (свой профиль), но с кнопкой «Редактировать профиль» → `/account`
- Полки со ВСЕМИ своими книгами (данные из `GET /api/books`)
- Визуальные метки на книгах: `draft` (серая), `unlisted` (полупрозрачная), `published` (нормальная)
- Контекстное меню: Читать / Редактировать / Видимость / Удалить
- Кнопка «Добавить книгу» → `/account/books` с открытым mode selector
- Быстрое переключение видимости из контекстного меню

### 4.2 Компонент шапки профиля

**Новый файл:** `js/core/ProfileHeader.js`

```javascript
class ProfileHeader {
  constructor({ user, isOwner })
  render(container)
  destroy()
}
```

Рендерит: аватар, имя, bio. У хозяина — кнопка «Редактировать профиль».
Переиспользуется и на шкафу, и в кабинете.

### 4.3 Стили для меток видимости

**Файл:** `css/bookshelf.css`

Добавить:
- `.book-card--draft` — приглушённые цвета, бейдж «Черновик»
- `.book-card--unlisted` — слегка прозрачная, бейдж «По ссылке»
- `.book-card--published` — без изменений (по умолчанию)

---

## Фаза 5: Личный кабинет

### 5.1 Экран кабинета

**Новый файл:** `js/core/AccountScreen.js`

```javascript
class AccountScreen {
  constructor({ apiClient, router })
  show(tab = 'books')
  hide()
  destroy()
}
```

Вкладки:
1. **Мои книги** — текущий функционал из admin.html (BookUploadManager, editor tabs)
2. **Профиль** — редактирование username, displayName, bio, аватар
3. **Настройки** — текущий Platform Settings из admin.html
4. **Экспорт** — текущий Export из admin.html

### 5.2 Миграция admin-модулей

**Файлы:** `js/admin/modules/*.js`

Все модули остаются как есть, но:
- `AdminApp` (из `js/admin/index.js`) рефакторится → `AccountScreen` принимает DOM-контейнер вместо `document.body`
- Навигация внутри кабинета — через методы `AccountScreen`, не через отдельные URL
- Dynamic import: `const { AccountScreen } = await import('./core/AccountScreen.js')` — грузится только когда нужен

### 5.3 Вкладка «Профиль»

**Новый файл:** `js/admin/modules/ProfileModule.js`

- Форма: username (с live-валидацией), displayName, bio (textarea), аватар (загрузка)
- Сохранение: `PUT /api/profile`
- Превью: показывает как будет выглядеть шапка на шкафу

### 5.4 Управление видимостью книг

**Файл:** `js/admin/modules/ChaptersModule.js` (или новый раздел в editor)

В editor книги — добавить секцию «Публикация»:
- Селектор: Черновик / Опубликована / По ссылке
- Поле описания книги (textarea, до 2000 символов)
- Ссылка для шаринга (копируется одной кнопкой): `flipbook.app/book/:id`

### 5.5 Стили кабинета

**Файлы:** `css/admin/*.css`

В основном переиспользуются as-is. Добавить:
- Стили для вкладки «Профиль» — `css/admin/profile.css`
- Импортировать в `css/admin/index.css`

---

## Фаза 6: Ридер — режимы guest / owner / embed

### 6.1 Режим гостя

**Файл:** `js/core/BookController.js` + `js/core/AppInitializer.js`

При загрузке книги определить режим:
```javascript
const isOwner = currentUser && book.userId === currentUser.id;
const isEmbed = router.getCurrentRoute().name === 'embed';
```

**Гостевой режим:**
- Данные из `GET /api/public/books/:id` (не `/api/books/:id`)
- Контент глав из `GET /api/public/books/:id/chapters/:chapterId/content`
- Скрыть: кнопку «Редактировать» из header/controls
- Показать: имя автора + ссылку на шкаф (`/:username`)
- Reading progress — сохранять в localStorage (гость не авторизован)
- Если авторизован, но не автор — тоже гостевой режим, но progress на сервер

### 6.2 Режим владельца

Без изменений (текущее поведение). Добавить:
- Кнопка «Редактировать» → `router.navigate('/account/books?edit=' + bookId)`

### 6.3 Embed-режим

**Файл:** `js/core/AppInitializer.js`

При `isEmbed`:
- Скрыть: header, footer, все панели управления
- Скрыть: bookshelf navigation
- Показать: только книгу + перелистывание
- Внизу: дискретная ссылка «Открыть на Flipbook» → `/book/:id`
- Звуки отключены по умолчанию (автоплей заблокирован в iframe)
- `postMessage` API для внешнего управления (опционально, на будущее)

### 6.4 Стили embed

**Новый файл:** `css/embed.css`

- `body.embed-mode` — убирает всё лишнее
- Минимальный padding, максимальная область книги

---

## Фаза 7: OG-метатеги

### 7.1 Серверный рендер метатегов

**Файл:** `server/src/app.ts`

Добавить middleware **перед** SPA fallback:

```typescript
// Публичные маршруты с OG-тегами
app.get('/book/:bookId', asyncHandler(async (req, res, next) => {
  // Только для краулеров или если принудительно
  if (!isBot(req)) return next(); // Для обычных юзеров — SPA fallback

  const book = await publicService.getPublicBook(req.params.bookId);
  if (!book) return next();

  const html = injectOGTags(indexHtml, {
    title: `${book.title} — ${book.author}`,
    description: book.description || `Читать "${book.title}" на Flipbook`,
    image: book.coverImageUrl || defaultOgImage,
    url: `${APP_URL}/book/${book.id}`,
  });
  res.send(html);
}));

app.get('/:username', asyncHandler(async (req, res, next) => {
  if (!isBot(req)) return next();

  const shelf = await publicService.getShelf(req.params.username);
  if (!shelf) return next();

  const html = injectOGTags(indexHtml, {
    title: `${shelf.displayName} — Flipbook`,
    description: shelf.bio || `Книжный шкаф ${shelf.displayName}`,
    image: shelf.avatarUrl || defaultOgImage,
    url: `${APP_URL}/${shelf.username}`,
  });
  res.send(html);
}));
```

### 7.2 Утилиты OG

**Новый файл:** `server/src/utils/og.ts`

- `isBot(req)` — проверка User-Agent (Googlebot, Twitterbot, TelegramBot, facebookexternalhit, etc.)
- `injectOGTags(html, { title, description, image, url })` — замена `<meta>` в шаблоне `index.html`
- Шаблон: в `index.html` добавить плейсхолдеры (`<!--OG_TAGS-->`) или дефолтные мета-теги, которые заменяются

### 7.3 Дефолтные мета-теги

**Файл:** `index.html`

Добавить в `<head>`:
```html
<meta property="og:title" content="Flipbook — Создавай книги и фотоальбомы">
<meta property="og:description" content="Интерактивная платформа для создания книг с реалистичным перелистыванием">
<meta property="og:image" content="/images/og-default.jpg">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
```

Эти значения будут перезаписываться сервером для конкретных книг/шкафов.

---

## Фаза 8: Финальная интеграция

### 8.1 Обновить ApiClient

**Файл:** `js/utils/ApiClient.js`

Добавить методы:
```javascript
// Профиль
getProfile()
updateProfile(data)
checkUsername(username)

// Публичные
getPublicShelf(username)
getPublicBook(bookId)
getPublicChapters(bookId)
getPublicChapterContent(bookId, chapterId)
discoverBooks({ limit, offset })
```

### 8.2 Обновить Vite-конфиг

**Файл:** `vite.config.js`

- Убрать `admin.html` из entry points (теперь один SPA)
- Добавить chunk `account.js` для динамического импорта кабинета
- Обновить PWA: precache новых маршрутов, навигационный fallback

### 8.3 Обновить серверный SPA fallback

**Файл:** `server/src/app.ts`

Маршрут `/:username` конфликтует с SPA fallback. Решение:
- OG-бот → серверный рендер метатегов (фаза 7)
- Обычный юзер → SPA fallback (`index.html`), роутер на клиенте разберётся
- `/api/*` → API (уже работает)
- Статика (`/assets/*`, `/images/*`, etc.) → `express.static` (уже работает)

### 8.4 Обновить PWA Service Worker

**Файл:** `vite.config.js` (секция VitePWA)

- `navigateFallback: '/index.html'` — все маршруты → SPA
- `navigateFallbackAllowlist: [/^(?!\/api\/).*/]` — кроме API

---

## Порядок реализации

| Этап | Фазы | Что получаем |
|------|-------|-------------|
| **1** | 1.1–1.3 | DB: username, visibility, description — миграция |
| **2** | 1.4–1.8 | API: профиль + публичные эндпоинты |
| **3** | 2.1–2.2 | Фронтенд: SPA-роутер, рефакторинг entry point |
| **4** | 2.3–2.4 | Объединение index.html + admin.html в один SPA |
| **5** | 3.1–3.4 | Лендинг + онбординг username |
| **6** | 4.1–4.3 | Публичный шкаф (два режима) |
| **7** | 5.1–5.5 | Личный кабинет |
| **8** | 6.1–6.4 | Ридер: guest / owner / embed |
| **9** | 7.1–7.3 | OG-метатеги |
| **10** | 8.1–8.4 | Интеграция, PWA, финализация |

---

## Что НЕ входит в этот план (отложено)

- Оценки и отзывы
- Подписки на авторов и уведомления
- Модерация контента
- Аналитика для авторов (счётчики просмотров)
- Полнотекстовый поиск
- Кастомные домены
- Монетизация
- Email-верификация
