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

## Фаза 1: База данных и API ✅

> **Коммит:** `feat: add username, visibility fields and public API endpoints`

### Что сделано

**Prisma-миграция** (`server/prisma/schema.prisma`):
- `User`: добавлены `username` (unique, nullable) и `bio` (varchar 500)
- `Book`: добавлены `visibility` (draft/published/unlisted, default draft), `description` (varchar 2000), `publishedAt` (timestamptz)
- Составной индекс `@@index([visibility, publishedAt])`
- Миграция: `add-username-visibility`

**Решение:** `username` обязателен при регистрации (валидация `^[a-z0-9][a-z0-9-]{2,39}$`). Существующие юзеры без username — получат при следующем логине (Phase 5 — редактирование профиля). Резерв служебных слов: `account`, `book`, `embed`, `api`, `admin`, `about`, `help`, `settings`, `search`, `explore`, `login`, `register`, `auth`, `static`, `assets`, `public`, `new`.

**Zod-схемы** (`server/src/schemas.ts`):
- `updateProfileSchema`, `usernameParamSchema`, `discoverQuerySchema`
- Расширен `registerSchema` — добавлено `username` (обязательно)
- Расширен `updateBookSchema` — `visibility`, `description`
- `publicBooksQuerySchema`

**Новые API-эндпоинты:**

| Маршрут | Файл | Описание |
|---------|------|----------|
| `GET/PUT /api/profile` | `profile.routes.ts` | Профиль текущего юзера |
| `GET /api/profile/check-username/:username` | `profile.routes.ts` | Проверка доступности username |
| `GET /api/public/shelves/:username` | `public.routes.ts` | Шкаф автора (профиль + published книги) |
| `GET /api/public/books/:bookId` | `public.routes.ts` | Детали публичной книги |
| `GET /api/public/books/:bookId/chapters` | `public.routes.ts` | Главы публичной книги |
| `GET /api/public/books/:bookId/chapters/:chapterId/content` | `public.routes.ts` | Контент главы |
| `GET /api/public/discover` | `public.routes.ts` | Каталог новых публичных книг |

**Сервисы:** `profile.service.ts`, `public.service.ts`
**Маппер:** `toPublicAuthor()`, `toPublicBookCard()`, `toPublicBookDetail()` в `mappers.ts`
**Rate limiting:** `publicRateLimiter` применён к `/api/public/*`

**Расширены существующие эндпоинты:**
- `PATCH /api/books/:bookId` — обработка `visibility`, `description`
- `publishedAt` ставится автоматически при первом `published`, не сбрасывается при `draft`
- `POST /api/auth/register` — принимает `username` (обязательно)

---

## Фаза 2: Фронтенд-роутер ✅

> **Коммит:** `feat: add SPA router with history API, refactor entry point`

### Что сделано

**SPA-роутер** (`js/utils/Router.js`):
- History API, перехват `popstate` и кликов по `a[data-route]`
- Компиляция path-шаблонов в RegExp (`:param` → capture groups)
- `BASE_URL` поддержка (для GitHub Pages `/flipbook/`)
- Методы: `start()`, `navigate()`, `getCurrentRoute()`, `destroy()`
- Маршруты матчатся в порядке регистрации (первый match побеждает)

**Рефакторинг entry point** (`js/index.js`):
- Переход от `sessionStorage` + `location.reload()` к `router.navigate()`
- Контейнеры экранов через `data-screen` + `hidden` атрибуты
- View Transitions API для плавных переходов
- Миграция старых `sessionStorage`-флагов при первом запуске

**Решение:** `admin.html` остаётся как отдельный файл (не объединяем с `index.html`). Объединение перенесено в Phase 5, когда будет AccountScreen. Кнопка «Редактировать» в bookshelf навигирует в `admin.html` через `window.location.href` (а не SPA-роутинг).

---

## Фаза 3: Лендинг ✅

> **Коммит:** `feat: add landing page for guests, username field in registration`

### Что сделано

**LandingScreen** (`js/core/LandingScreen.js`):
- Hero-секция: заголовок «Flipbook» + подзаголовок + CTA «Создать книгу»
- Витрина: до 6 публичных книг из `GET /api/public/discover` (карточки с обложками)
- «Как это работает»: 3 шага — загрузите / оформите / поделитесь (SVG-иконки)
- Footer
- Scroll-анимации через `IntersectionObserver`

**Стили** (`css/landing.css`):
- Тёмная тема (`#0f0f1a`), gradient hero, акцентный цвет `#5b6abf`
- Mobile-first адаптивность
- Импорт в `css/index.css` (секция 14)

**HTML** (`html/partials/reader/landing.html`):
- Включён в `index.html` перед bookshelf

**AuthModal** (`js/core/AuthModal.js`):
- Добавлено поле `username` при регистрации (обязательное)
- Клиентская валидация: `^[a-z0-9][a-z0-9-]{2,39}$`
- Подсказка под полем

**ApiClient** (`js/utils/ApiClient.js`):
- `register()` принимает 4-й параметр `username`

**Решение:** Отдельный шаг «Выберите username» после регистрации убран — username собирается сразу в форме регистрации (принято в Phase 1). Авторизованные на `/` видят текущую BookshelfScreen (redirect на `/:username` — Phase 4). Лендинг полный по плану (hero + витрина + шаги + footer).

**Логика** (`js/index.js`):
- `checkAuth()` — неблокирующая проверка (возвращает user или null, без модалки)
- `handleHome()`: гости → лендинг, авторизованные → полка
- `showLanding()`: CTA → AuthModal → после входа → redirect на полку
- `onUnauthorized` → redirect на лендинг (сессия истекла)
- Гость на `/book/:id` → redirect на `/` (публичное чтение — Phase 6)

---

## Фаза 4: Публичный шкаф ✅

> **Коммит:** `feat: add public shelf (/:username) with owner/guest modes`

### Что сделано

**ProfileHeader** (`js/core/ProfileHeader.js`):
- Аватар-инициалы (первая буква displayName/username, детерминированный hue из хэша)
- Имя, @username, bio
- Кнопка «Редактировать профиль» (только для хозяина)

**Решение:** Поля `avatar` нет в модели User — используем инициалы. Настоящий аватар (загрузка файла) будет в Phase 5 при редактировании профиля.

**BookshelfScreen** (`js/core/BookshelfScreen.js`) — рефакторинг в два режима:

**Owner mode** (`mode: 'owner'`):
- Все книги пользователя + визуальные метки видимости
- Контекстное меню: Читать / Редактировать / Видимость / Удалить
- Переключение видимости: draft → published → unlisted → draft (циклическое)
- Кнопка «Добавить книгу» → inline mode selector (как раньше)
- Профильная шапка (ProfileHeader, isOwner=true)

**Решение:** Кнопка «Добавить книгу» оставлена inline (mode selector в bookshelf). Redirect на `/account/books` будет в Phase 5 когда AccountScreen готов.

**Guest mode** (`mode: 'guest'`):
- Только published-книги автора
- Клик = сразу переход к чтению (без контекстного меню)
- Нет кнопок управления, нет add/edit/delete
- Профильная шапка (ProfileHeader, isOwner=false)

**Решение:** `/:username` доступен всем, включая неавторизованных гостей. Это и есть смысл «опубликованных» книг.

**Шаблон** (`html/partials/reader/templates.html`):
- Добавлен `.bookshelf-book-badge` (бейдж видимости)
- Добавлен пункт «Видимость» (`data-book-action="visibility"`) с динамическим label

**CSS** (`css/bookshelf.css`):
- `.bookshelf-book--draft` (opacity 0.55, бейдж «Черновик»)
- `.bookshelf-book--unlisted` (opacity 0.75, бейдж «По ссылке»)
- `.bookshelf-book-badge` (absolute, backdrop-filter)
- `.profile-header` (аватар, info, кнопка редактирования)

**Роутинг** (`js/index.js`):
- `/:username` — catch-all route (последний в списке маршрутов Router)
- `handlePublicShelf({ username })`:
  - Хозяин → `GET /api/books` (все свои)
  - Гость → `GET /api/public/shelves/:username` (только published)
  - 404 → redirect на `/`
- `handleHome`: авторизованные → redirect на `/:username`, гости → лендинг
- После аутентификации через CTA → redirect на `/:username`

**ApiClient** (`js/utils/ApiClient.js`):
- `getPublicShelf(username)`
- `getPublicDiscover(limit)`
- `updateProfile(data)`

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
- При успехе → `admin.html` удаляется (или оставляется как redirect на `/account`)
- Вкладки в кабинете + контент из admin HTML-partial'ов переносятся в `html/partials/reader/account.html`

### 5.3 Вкладка «Профиль»

**Новый файл:** `js/admin/modules/ProfileModule.js`

- Форма: username (с live-валидацией через `GET /api/profile/check-username/:username`), displayName, bio (textarea), аватар (загрузка)
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

### 5.6 Обновить BookshelfScreen

- Кнопка «Добавить книгу» → `router.navigate('/account')` вместо inline mode selector
- Кнопка «Редактировать профиль» → `router.navigate('/account?tab=profile')`
- Кнопка «Редактировать» в контекстном меню → `router.navigate('/account?edit=' + bookId)`

### 5.7 Маршрут /account

- Добавить `{ name: 'account', path: '/account', handler: handleAccount }` в Router (перед `/:username`)
- `handleAccount`: динамический import `AccountScreen`, показ нужной вкладки

### 5.8 Обновить Vite-конфиг

**Файл:** `vite.config.js`

- Убрать `admin.html` из entry points (теперь один SPA)
- Добавить chunk `account.js` для динамического импорта кабинета
- Обновить PWA: precache новых маршрутов, навигационный fallback

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
- Кнопка «Редактировать» → `router.navigate('/account?edit=' + bookId)`

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

### 6.5 Обновить index.js

- Убрать redirect гостей с `/book/:id` на `/` (теперь гости могут читать published/unlisted книги)
- Добавить маршрут `{ name: 'embed', path: '/embed/:bookId', handler: handleEmbed }` (перед `/:username`)

---

## Фаза 7: OG-метатеги

### 7.1 Серверный рендер метатегов

**Файл:** `server/src/app.ts`

Добавить middleware **перед** SPA fallback:

```typescript
// Публичные маршруты с OG-тегами
app.get('/book/:bookId', asyncHandler(async (req, res, next) => {
  if (!isBot(req)) return next();

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

### 8.1 Обновить серверный SPA fallback

**Файл:** `server/src/app.ts`

Маршрут `/:username` конфликтует с SPA fallback. Решение:
- OG-бот → серверный рендер метатегов (фаза 7)
- Обычный юзер → SPA fallback (`index.html`), роутер на клиенте разберётся
- `/api/*` → API (уже работает)
- Статика (`/assets/*`, `/images/*`, etc.) → `express.static` (уже работает)

### 8.2 Обновить PWA Service Worker

**Файл:** `vite.config.js` (секция VitePWA)

- `navigateFallback: '/index.html'` — все маршруты → SPA
- `navigateFallbackAllowlist: [/^(?!\/api\/).*/]` — кроме API

### 8.3 Финальная проверка

- Полный прогон тестов (unit + integration + e2e)
- Проверка всех маршрутов: `/`, `/:username`, `/account`, `/book/:id`, `/embed/:id`
- Проверка guest/owner/embed режимов ридера
- Проверка OG-тегов с помощью Facebook Debugger / Twitter Card Validator
- Проверка PWA: offline-доступ, навигация по маршрутам
- Mobile responsive check

---

## Порядок реализации

| Этап | Фаза | Статус | Что получили |
|------|-------|--------|-------------|
| **1** | 1 | ✅ | DB: username, visibility, description + API: профиль + публичные эндпоинты |
| **2** | 2 | ✅ | SPA-роутер на History API, рефакторинг entry point |
| **3** | 3 | ✅ | Лендинг для гостей, username в форме регистрации |
| **4** | 4 | ✅ | Публичный шкаф `/:username` (owner/guest), ProfileHeader, метки видимости |
| **5** | 5 | ⬜ | Личный кабинет `/account`, миграция admin.html, профиль, аватар |
| **6** | 6 | ⬜ | Ридер: guest / owner / embed режимы |
| **7** | 7 | ⬜ | OG-метатеги для шаринга |
| **8** | 8 | ⬜ | Интеграция, PWA, финализация |

---

## Принятые решения (лог)

| Фаза | Вопрос | Решение |
|------|--------|---------|
| 1 | Username nullable или required? | **Required** при регистрации. Существующие юзеры — nullable, получат username через профиль (Phase 5) |
| 1 | Формат username | `^[a-z0-9][a-z0-9-]{2,39}$` — латиница, цифры, дефис, 3-40 символов |
| 1 | Поведение publishedAt при смене visibility | Ставится при первом `published`, НЕ сбрасывается при возврате в `draft` |
| 2 | Объединять admin.html с index.html? | **Нет**, отложено до Phase 5 (AccountScreen) |
| 3 | Отдельный шаг «Выберите username» после регистрации? | **Убран** — username собирается в форме регистрации |
| 3 | Redirect авторизованных на / | **На текущую полку** (BookshelfScreen), redirect на `/:username` — Phase 4 |
| 3 | Насколько детальный лендинг? | **Полный** — hero + витрина + 3 шага + footer |
| 4 | Кнопка «Добавить книгу» → куда? | **Inline mode selector** (как было). Redirect на `/account` — Phase 5 |
| 4 | Аватар в ProfileHeader | **Инициалы** (цветной круг, hue из хэша). Настоящий аватар — Phase 5 |
| 4 | `/:username` доступен гостям? | **Да**, публичные полки видны всем без авторизации |

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
