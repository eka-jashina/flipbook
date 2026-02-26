# План устранения проблем серверной части Flipbook

## Обзор

План разделён на 4 фазы по приоритету. Каждая задача содержит: описание проблемы, затронутые файлы, конкретные шаги реализации и критерии приёмки.

**Уточнения после повторной проверки кода:**
- `mergeParams: true` уже корректно установлен на всех book-scoped роутерах — ложное срабатывание в первоначальном анализе.
- `validate()` middleware работает корректно благодаря Express 5, который автоматически перехватывает синхронные исключения.

---

## Фаза 1 — Критичная безопасность (неделя 1)

### 1.1. CSRF-защита

**Проблема:** Сессионная аутентификация через cookies без CSRF-токенов позволяет вредоносным сайтам выполнять запросы от имени авторизованного пользователя.

**Файлы:**
- `server/package.json` — добавить зависимость
- `server/src/app.ts` — подключить middleware
- `server/src/routes/auth.routes.ts` — эндпоинт для получения токена
- `server/tests/` — обновить тесты

**Шаги:**
1. Установить `csrf-csrf` (double-submit cookie pattern, совместим с SPA):
   ```bash
   cd server && npm install csrf-csrf
   ```
2. Создать `server/src/middleware/csrf.ts`:
   ```typescript
   import { doubleCsrf } from 'csrf-csrf';

   const { doubleCsrfProtection, generateToken } = doubleCsrf({
     getSecret: () => getConfig().SESSION_SECRET,
     cookieName: '__csrf',
     cookieOptions: { httpOnly: true, sameSite: 'lax', secure: getConfig().SESSION_SECURE },
     getTokenFromRequest: (req) => req.headers['x-csrf-token'] as string,
   });

   export { doubleCsrfProtection, generateToken };
   ```
3. В `app.ts` подключить после `passport.session()`:
   ```typescript
   app.use(doubleCsrfProtection);
   ```
4. Добавить `GET /api/auth/csrf-token` → возвращает `{ token: generateToken(req, res) }`.
5. На клиенте: при загрузке запрашивать CSRF-токен и отправлять его в заголовке `X-CSRF-Token` на каждом мутирующем запросе (POST/PUT/PATCH/DELETE).
6. Обновить тесты: `createAuthenticatedAgent()` должен получать CSRF-токен после логина.

**Критерии приёмки:**
- POST/PUT/PATCH/DELETE без CSRF-токена → 403
- GET-запросы не требуют токен
- Все существующие тесты проходят

---

### 1.2. Фильтрация passwordHash из сессии

**Проблема:** `deserializeUser` загружает полную модель User, включая `passwordHash`, и кладёт в `req.user`.

**Файлы:**
- `server/src/middleware/auth.ts` — deserializeUser + configurePassport

**Шаги:**
1. В `deserializeUser` заменить `findUnique` на `findUnique` с `select`:
   ```typescript
   passport.deserializeUser(async (id: string, done) => {
     try {
       const user = await prisma.user.findUnique({
         where: { id },
         select: {
           id: true,
           email: true,
           displayName: true,
           avatarUrl: true,
           googleId: true,
         },
       });
       if (!user) { done(null, false); return; }
       done(null, user as Express.User);
     } catch (err) { done(err); }
   });
   ```
2. Обновить `Express.User` интерфейс — убрать `passwordHash`:
   ```typescript
   interface User {
     id: string;
     email: string;
     displayName: string | null;
     avatarUrl: string | null;
     googleId: string | null;
   }
   ```
3. В `LocalStrategy` и `GoogleStrategy`: после успешной проверки пароля/OAuth передавать в `done()` не полный объект, а отфильтрованный (без `passwordHash`), или оставить как есть — `serializeUser` берёт только `id`, а `deserializeUser` уже не вернёт хеш.
4. Проверить `formatUser()` в `auth.service.ts` — он использует `user.passwordHash !== null` для поля `hasPassword`. Это ломается, если `passwordHash` не загружается. Варианты:
   - a) Добавить `passwordHash` **только в select `deserializeUser`** для проверки `hasPassword`, но не прокидывать его в `req.user` (сделать отдельный запрос в `GET /api/auth/me`).
   - b) Хранить `hasPassword: boolean` как отдельное поле в `Express.User`.
   - **Рекомендация:** вариант (b) — добавить вычисляемое поле:
     ```typescript
     select: { id: true, email: true, displayName: true, avatarUrl: true, googleId: true,
               passwordHash: true }, // загружаем только для проверки
     // а затем:
     done(null, { ...user, hasPassword: user.passwordHash !== null, passwordHash: undefined });
     ```
     Или лучше — вообще не класть `passwordHash` в `Express.User`, а `hasPassword` вычислять при отдаче:
     ```typescript
     const { passwordHash, ...safeUser } = user;
     done(null, { ...safeUser, hasPassword: passwordHash !== null });
     ```

**Критерии приёмки:**
- `req.user` не содержит `passwordHash` ни при каких обстоятельствах
- `GET /api/auth/me` корректно возвращает `hasPassword: true/false`
- Тесты на аутентификацию проходят

---

### 1.3. Лимиты на количество ресурсов

**Проблема:** Нет ограничений на создание книг, глав, шрифтов, амбиентов. Возможен abuse.

**Файлы:**
- `server/src/utils/limits.ts` — новый файл с константами
- `server/src/services/books.service.ts`
- `server/src/services/chapters.service.ts`
- `server/src/services/fonts.service.ts`
- `server/src/services/ambients.service.ts`

**Шаги:**
1. Создать `server/src/utils/limits.ts`:
   ```typescript
   export const RESOURCE_LIMITS = {
     MAX_BOOKS_PER_USER: 100,
     MAX_CHAPTERS_PER_BOOK: 200,
     MAX_FONTS_PER_USER: 50,
     MAX_AMBIENTS_PER_BOOK: 20,
   } as const;
   ```
2. В каждом сервисе добавить проверку перед `create`:
   ```typescript
   // books.service.ts → createBook():
   const count = await prisma.book.count({ where: { userId } });
   if (count >= RESOURCE_LIMITS.MAX_BOOKS_PER_USER) {
     throw new AppError(403, 'Book limit reached');
   }
   ```
3. Аналогично для `createChapter`, `createAmbient`, `createFont` (в `fonts.service.ts`).
4. В `importUserConfig` (exportImport.service.ts) — проверить лимиты перед началом транзакции:
   ```typescript
   const existingBooks = await prisma.book.count({ where: { userId } });
   if (existingBooks + data.books.length > RESOURCE_LIMITS.MAX_BOOKS_PER_USER) {
     throw new AppError(403, 'Import would exceed book limit');
   }
   ```
5. Добавить тесты: попытка создать ресурс сверх лимита → 403.

**Критерии приёмки:**
- Создание 101-й книги → 403 с понятным сообщением
- Импорт, превышающий лимит → 403
- Существующие тесты не ломаются

---

### 1.4. Потоковая загрузка больших файлов

**Проблема:** Multer с `memoryStorage()` для файлов до 50 МБ загружает всё в RAM. Параллельные загрузки → OOM.

**Файлы:**
- `server/package.json` — добавить `multer-s3` (опционально)
- `server/src/middleware/upload.ts` — изменить storage для книг
- `server/src/routes/upload.routes.ts` — обработка потокового ввода

**Шаги:**

**Вариант A — disk storage (проще):**
1. Для `bookUpload` переключить на `multer.diskStorage()`:
   ```typescript
   import os from 'node:os';
   import path from 'node:path';

   const bookStorage = multer.diskStorage({
     destination: os.tmpdir(),
     filename: (_req, file, cb) => cb(null, `upload-${Date.now()}-${file.originalname}`),
   });

   export const bookUpload = multer({
     storage: bookStorage,
     limits: { fileSize: 50 * 1024 * 1024 },
     fileFilter: /* ... то же самое ... */
   });
   ```
2. В `upload.routes.ts` → `/book` — после парсинга удалить временный файл:
   ```typescript
   import { unlink } from 'node:fs/promises';

   router.post('/book', bookUpload.single('file'), async (req, res, next) => {
     try {
       if (!req.file) throw new AppError(400, 'No file uploaded');
       const buffer = await readFile(req.file.path);
       const parsed = await parseBook(buffer, req.file.originalname);
       res.json(parsed);
     } catch (err) { next(err); }
     finally { if (req.file?.path) await unlink(req.file.path).catch(() => {}); }
   });
   ```
3. Для font/sound/image (до 5 МБ) — memory storage приемлем, оставить как есть.

**Вариант B — multer-s3 (оптимальнее, но сложнее):**
- Потоковая загрузка напрямую в S3 через `multer-s3`. Парсинг книг всё равно требует буфер, поэтому для `/book` disk storage предпочтительнее.

**Рекомендация:** вариант A — минимум изменений, решает основную проблему.

**Критерии приёмки:**
- Загрузка книги 50 МБ не увеличивает heap существенно
- Временные файлы удаляются после обработки
- Тесты на upload проходят

---

## Фаза 2 — Производительность и надёжность (неделя 2)

### 2.1. Устранение N+1 в importUserConfig

**Проблема:** Каждая глава/амбиент/шрифт — отдельный INSERT. При 10 книгах по 20 глав → 200+ запросов.

**Файлы:**
- `server/src/services/exportImport.service.ts`

**Шаги:**
1. Заменить последовательные `tx.chapter.create()` на `tx.chapter.createMany()`:
   ```typescript
   if (bookData.chapters?.length) {
     await tx.chapter.createMany({
       data: bookData.chapters.map((ch, i) => ({
         bookId: book.id,
         title: ch.title || '',
         position: i,
         filePath: ch.filePath || null,
         bg: ch.bg || '',
         bgMobile: ch.bgMobile || '',
       })),
     });
   }
   ```
2. Аналогично для `tx.ambient.createMany()` и `tx.readingFont.createMany()`.
3. Для моделей 1:1 (appearance, sounds, defaultSettings, decorativeFont) — `create` единичный, оптимизация не нужна.

**Ограничение:** `createMany` не возвращает созданные записи в Prisma. Для данного сценария это OK — import возвращает только счётчики.

**Критерии приёмки:**
- Import 10 книг по 20 глав: количество SQL-запросов < 50 (вместо 200+)
- Тесты на import/export проходят

---

### 2.2. Устранение N+1 в reorder-операциях

**Проблема:** `reorderBooks`, `reorderChapters`, `reorderAmbients` — каждый ID = отдельный UPDATE.

**Файлы:**
- `server/src/services/books.service.ts` → `reorderBooks()`
- `server/src/services/chapters.service.ts` → `reorderChapters()`
- `server/src/services/ambients.service.ts` → `reorderAmbients()`

**Шаги:**
1. Создать утилиту `server/src/utils/reorder.ts`:
   ```typescript
   import { getPrisma } from './prisma.js';

   export async function bulkUpdatePositions(
     table: string,
     ids: string[],
     parentColumn?: string,
     parentId?: string,
   ): Promise<void> {
     if (ids.length === 0) return;
     const prisma = getPrisma();

     const values = ids.map((id, i) => `('${id}'::uuid, ${i})`).join(', ');
     await prisma.$executeRawUnsafe(
       `UPDATE "${table}" SET "position" = data.pos
        FROM (VALUES ${values}) AS data(id, pos)
        WHERE "${table}".id = data.id`
     );
   }
   ```
2. Заменить `$transaction(ids.map(...))` на один вызов `bulkUpdatePositions('books', bookIds)`.
3. **Важно:** сохранить предварительную проверку валидности ID (count должен совпадать).

**Альтернатива (без raw SQL):** Если кол-во элементов гарантированно небольшое (< 100), текущий подход с `$transaction` приемлем. Но для консистентности лучше оптимизировать.

**Критерии приёмки:**
- Reorder 50 элементов = 2 SQL-запроса (SELECT для проверки + 1 UPDATE), а не 51
- Тесты проходят

---

### 2.3. Race condition при nextPosition

**Проблема:** Два параллельных `createBook` могут получить одинаковую `position`.

**Файлы:**
- `server/src/services/books.service.ts` → `createBook()`
- `server/src/services/chapters.service.ts` → `createChapter()`
- `server/src/services/ambients.service.ts` → `createAmbient()`

**Шаги:**
1. Обернуть определение `nextPosition` и `create` в транзакцию с уровнем изоляции `Serializable`:
   ```typescript
   export async function createBook(userId, data) {
     const prisma = getPrisma();

     return prisma.$transaction(async (tx) => {
       const lastBook = await tx.book.findFirst({
         where: { userId },
         orderBy: { position: 'desc' },
         select: { position: true },
       });
       const nextPosition = (lastBook?.position ?? -1) + 1;

       const book = await tx.book.create({
         data: { userId, ...data, position: nextPosition },
       });

       await Promise.all([
         tx.bookAppearance.create({ data: { bookId: book.id } }),
         tx.bookSounds.create({ data: { bookId: book.id } }),
         tx.bookDefaultSettings.create({ data: { bookId: book.id } }),
       ]);

       return getBookByIdInTx(tx, book.id, userId);
     }, { isolationLevel: 'Serializable' });
   }
   ```
2. Аналогично для `createChapter` и `createAmbient`.
3. Добавить retry-логику при конфликте сериализации (Prisma бросает `P2034`):
   ```typescript
   import { Prisma } from '@prisma/client';

   async function withSerializableRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
     for (let i = 0; i < retries; i++) {
       try { return await fn(); }
       catch (e) {
         if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034' && i < retries - 1) continue;
         throw e;
       }
     }
     throw new Error('Unreachable');
   }
   ```

**Критерии приёмки:**
- 10 параллельных `POST /api/books` → все 10 получают уникальные position
- Нет duplicate-key ошибок

---

### 2.4. Cleanup S3-файлов при удалении ресурсов

**Проблема:** Удаление книги/шрифта/амбиента удаляет запись из БД, но файлы в S3 остаются.

**Файлы:**
- `server/src/services/books.service.ts` → `deleteBook()`
- `server/src/services/fonts.service.ts` → `deleteFont()`
- `server/src/services/ambients.service.ts` → `deleteAmbient()`
- `server/src/services/decorativeFont.service.ts` → `deleteDecorativeFont()`
- `server/src/utils/storage.ts` — функция `deleteFileByUrl()`

**Шаги:**
1. Добавить в `storage.ts`:
   ```typescript
   export function extractKeyFromUrl(url: string): string | null {
     const config = getConfig();
     if (!url.startsWith(config.S3_PUBLIC_URL)) return null;
     return url.slice(config.S3_PUBLIC_URL.length + 1); // убираем prefix + /
   }

   export async function deleteFileByUrl(url: string): Promise<void> {
     const key = extractKeyFromUrl(url);
     if (key) await deleteFile(key);
   }
   ```
2. В `deleteBook()` — перед удалением собрать все файловые URL:
   ```typescript
   export async function deleteBook(bookId, userId) {
     const prisma = getPrisma();
     const book = await prisma.book.findUnique({
       where: { id: bookId },
       select: { userId: true },
       include: {
         ambients: { select: { fileUrl: true } },
         sounds: { select: { pageFlipUrl: true, bookOpenUrl: true, bookCloseUrl: true } },
         decorativeFont: { select: { fileUrl: true } },
         appearance: { select: { lightCoverBgImageUrl: true, darkCoverBgImageUrl: true, lightCustomTextureUrl: true, darkCustomTextureUrl: true } },
       },
     });
     if (!book) throw new AppError(404, 'Book not found');
     if (book.userId !== userId) throw new AppError(403, 'Access denied');

     // Собираем все URL для удаления из S3
     const urls: string[] = [];
     book.ambients?.forEach(a => { if (a.fileUrl) urls.push(a.fileUrl); });
     if (book.sounds) {
       [book.sounds.pageFlipUrl, book.sounds.bookOpenUrl, book.sounds.bookCloseUrl]
         .forEach(u => { if (u && !u.startsWith('sounds/')) urls.push(u); });
     }
     if (book.decorativeFont?.fileUrl) urls.push(book.decorativeFont.fileUrl);
     if (book.appearance) {
       [book.appearance.lightCoverBgImageUrl, book.appearance.darkCoverBgImageUrl,
        book.appearance.lightCustomTextureUrl, book.appearance.darkCustomTextureUrl]
         .filter(Boolean).forEach(u => urls.push(u!));
     }

     await prisma.book.delete({ where: { id: bookId } });

     // Удаляем S3-файлы после успешного удаления из БД (best-effort)
     await Promise.allSettled(urls.map(deleteFileByUrl));
   }
   ```
3. В `deleteFont()`, `deleteAmbient()`, `deleteDecorativeFont()` — аналогичная логика для одного файла:
   ```typescript
   const font = await prisma.readingFont.findUnique({ where: { id }, select: { fileUrl: true, ... } });
   await prisma.readingFont.delete({ where: { id } });
   if (font.fileUrl) await deleteFileByUrl(font.fileUrl).catch(() => {});
   ```
4. S3-удаление — best-effort (через `catch(() => {})`): не блокировать основную операцию при ошибке S3.

**Критерии приёмки:**
- Удаление книги с загруженными файлами удаляет файлы из S3
- Ошибка S3 не блокирует удаление из БД
- Удаление книги с default звуками (`sounds/page-flip.mp3`) не пытается удалить встроенные файлы

---

### 2.5. Серверная санитизация HTML-контента

**Проблема:** HTML-контент глав сохраняется без санитизации. Хранимый XSS при использовании другого клиента.

**Файлы:**
- `server/package.json` — добавить `dompurify` + `jsdom` (jsdom уже есть)
- `server/src/utils/sanitize.ts` — новый файл
- `server/src/services/chapters.service.ts` — createChapter, updateChapter
- `server/src/services/exportImport.service.ts` — importUserConfig (главы)

**Шаги:**
1. `jsdom` уже в зависимостях. Добавить `dompurify`:
   ```bash
   cd server && npm install dompurify && npm install -D @types/dompurify
   ```
2. Создать `server/src/utils/sanitize.ts`:
   ```typescript
   import { JSDOM } from 'jsdom';
   import DOMPurify from 'dompurify';

   const window = new JSDOM('').window;
   const purify = DOMPurify(window);

   export function sanitizeHtml(html: string): string {
     return purify.sanitize(html, {
       ALLOWED_TAGS: ['article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'em', 'strong',
         'b', 'i', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'img', 'table',
         'thead', 'tbody', 'tr', 'th', 'td', 'figure', 'figcaption', 'span', 'div', 'hr', 'sup', 'sub'],
       ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel', 'width', 'height'],
       ALLOW_DATA_ATTR: false,
     });
   }
   ```
3. В `createChapter` и `updateChapter` — санитизировать перед сохранением:
   ```typescript
   import { sanitizeHtml } from '../utils/sanitize.js';

   // в createChapter:
   htmlContent: data.htmlContent ? sanitizeHtml(data.htmlContent) : null,

   // в updateChapter:
   ...(data.htmlContent !== undefined && {
     htmlContent: data.htmlContent ? sanitizeHtml(data.htmlContent) : data.htmlContent
   }),
   ```
4. В `importUserConfig` — санитизировать главы при импорте (если когда-нибудь будет передаваться контент).

**Критерии приёмки:**
- `<script>alert(1)</script>` в htmlContent → сохраняется без `<script>`
- Легитимный HTML (`<p>`, `<em>`, `<img>`) сохраняется корректно
- Тесты на chapters CRUD проходят

---

## Фаза 3 — Качество кода (неделя 3)

### 3.1. Устранение дублирования маппингов Prisma → DTO

**Проблема:** Маппинг appearance/book/sounds дублируется в `books.service.ts`, `exportImport.service.ts`.

**Файлы:**
- `server/src/utils/mappers.ts` — новый файл
- `server/src/services/books.service.ts` — рефакторинг
- `server/src/services/exportImport.service.ts` — рефакторинг

**Шаги:**
1. Создать `server/src/utils/mappers.ts` с функциями:
   ```typescript
   export function mapAppearanceToDto(a: BookAppearance): AppearanceDetail { ... }
   export function mapSoundsToDto(s: BookSounds): SoundsDetail { ... }
   export function mapAmbientToDto(a: Ambient): AmbientItem { ... }
   export function mapChapterToListItem(ch: Chapter): ChapterListItem { ... }
   export function mapBookToDetail(book: BookWithRelations): BookDetail { ... }
   ```
2. Заменить inline-маппинги в `getBookById()` и `exportUserConfig()` на вызовы из `mappers.ts`.
3. Убрать `mapAmbient()` из `ambients.service.ts` — использовать `mapAmbientToDto()` из mappers.

**Критерии приёмки:**
- Маппинг каждой сущности определён ровно в одном месте
- Все тесты проходят без изменений

---

### 3.2. Замена $queryRawUnsafe на $queryRaw в health check

**Проблема:** Стилистическая — `$queryRawUnsafe` для захардкоженного `SELECT 1`.

**Файлы:**
- `server/src/app.ts` (строка 112)

**Шаги:**
1. Заменить:
   ```typescript
   // Было:
   await getPrisma().$queryRawUnsafe('SELECT 1');
   // Стало:
   await getPrisma().$queryRaw`SELECT 1`;
   ```

**Критерии приёмки:**
- Health check работает корректно

---

### 3.3. Статический импорт в health check

**Проблема:** Динамический `import()` в health check — неоправданный overhead.

**Файлы:**
- `server/src/app.ts`

**Шаги:**
1. Перенести импорты в начало файла:
   ```typescript
   import { getPrisma } from './utils/prisma.js';
   import { getS3Client } from './utils/storage.js';
   import { HeadBucketCommand } from '@aws-sdk/client-s3';
   ```
2. Заменить `await import(...)` в теле health-check на прямые вызовы.

**Критерии приёмки:**
- Health check быстрее на ~5-10 мс (без dynamic import overhead)

---

### 3.4. Замена Math.random на crypto в generateFileKey

**Файлы:**
- `server/src/utils/storage.ts`

**Шаги:**
1. Заменить:
   ```typescript
   // Было:
   const random = Math.random().toString(36).substring(2, 8);
   // Стало:
   import { randomUUID } from 'node:crypto';
   const random = randomUUID().split('-')[0]; // 8 hex chars
   ```

**Критерии приёмки:**
- Файлы загружаются с уникальными ключами

---

### 3.5. Перенести pino-pretty в devDependencies

**Файлы:**
- `server/package.json`

**Шаги:**
1. `npm uninstall pino-pretty && npm install -D pino-pretty`
2. В `logger.ts` обернуть transport в проверку:
   ```typescript
   transport: process.env.NODE_ENV === 'development'
     ? { target: 'pino-pretty', options: { colorize: true } }
     : undefined,
   ```
   Это уже есть, но при `NODE_ENV=production` pino-pretty не используется — всё корректно.
3. В Dockerfile production-образ не содержит devDependencies (`npm ci --omit=dev`), поэтому pino-pretty не попадёт в образ.

**Критерии приёмки:**
- `npm ci --omit=dev` не включает pino-pretty
- Dev-сервер (`npm run dev`) по-прежнему логирует красиво

---

### 3.6. Добавить updatedAt к моделям без него

**Файлы:**
- `server/prisma/schema.prisma`

**Шаги:**
1. Добавить `updatedAt DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz()` к:
   - `BookAppearance`
   - `BookSounds`
   - `BookDefaultSettings`
   - `Ambient`
   - `DecorativeFont`
   - `ReadingFont`
   - `GlobalSettings`
2. Создать миграцию: `npx prisma migrate dev --name add_updated_at_fields`
3. Обновить DTO в `types/api.ts` при необходимости (для аудита).

**Критерии приёмки:**
- Все модели имеют `updatedAt`
- Миграция применяется без ошибок

---

### 3.7. Выровнять версию PostgreSQL в CI

**Файлы:**
- `.github/workflows/deploy.yml` (строка 76)

**Шаги:**
1. Заменить `image: postgres:16` на `image: postgres:17-alpine` (или `postgres:17`) чтобы совпадало с docker-compose.yml.

**Критерии приёмки:**
- CI и docker-compose используют одну и ту же мажорную версию PostgreSQL

---

## Фаза 4 — Масштабируемость (по мере роста)

Эти задачи не являются срочными, но стоит заложить их в backlog для реализации при увеличении нагрузки.

### 4.1. Пагинация списковых эндпоинтов

**Когда:** когда у пользователей появится > 50 книг или > 50 глав.

**Затронутые эндпоинты:**
- `GET /api/books`
- `GET /api/books/:bookId/chapters`
- `GET /api/fonts`
- `GET /api/books/:bookId/ambients`

**Подход:** cursor-based pagination по полю `position`:
```
GET /api/books?cursor=10&limit=20
→ { books: [...], nextCursor: 30 }
```

### 4.2. Фоновые задачи (BullMQ + Redis)

**Когда:** когда парсинг книг или экспорт начнёт таймаутиться (> 30 сек).

**Задачи для вынесения в очередь:**
- Парсинг загруженных книг (`POST /api/upload/book`)
- Cleanup S3 при массовом удалении
- Генерация превью обложек (если появится)

**Подход:**
1. Установить Redis + BullMQ
2. `POST /api/upload/book` → возвращает `{ jobId }`, статус → `GET /api/jobs/:jobId`
3. Worker обрабатывает файл и сохраняет результат

### 4.3. Redis для сессий и кеширования

**Когда:** когда количество активных сессий > 10000 или нагрузка на БД станет узким местом.

**Подход:**
- Заменить `connect-pg-simple` на `connect-redis`
- Добавить Redis-кеш для `getUserBooks()` и `getBookById()` (invalidation при мутациях)

### 4.4. API versioning

**Когда:** при появлении мобильного приложения или публичного API.

**Подход:**
```typescript
app.use('/api/v1/books', booksRoutes);
// v2 — с пагинацией и другим форматом ответа
app.use('/api/v2/books', booksRoutesV2);
```

### 4.5. Audit log

**Когда:** для compliance или расследования инцидентов.

**Подход:**
1. Создать модель `AuditLog`:
   ```prisma
   model AuditLog {
     id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     userId    String   @map("user_id") @db.Uuid
     action    String   @db.VarChar(50)    // "book.create", "chapter.delete", etc.
     entity    String   @db.VarChar(50)    // "book", "chapter"
     entityId  String?  @map("entity_id") @db.Uuid
     metadata  Json?
     createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz()
     @@index([userId])
     @@index([createdAt])
     @@map("audit_logs")
   }
   ```
2. Middleware или service-level логирование всех мутирующих операций.

---

## Приоритизация и зависимости

```
Фаза 1 (неделя 1) — КРИТИЧНО
├── 1.1 CSRF-защита
├── 1.2 Фильтрация passwordHash ── (не зависит от 1.1)
├── 1.3 Лимиты ресурсов           ── (не зависит от 1.1, 1.2)
└── 1.4 Disk storage для книг      ── (не зависит от остальных)

Фаза 2 (неделя 2) — ВАЖНО
├── 2.1 N+1 в import ─────── (независимо)
├── 2.2 N+1 в reorder ────── (независимо)
├── 2.3 Race condition ────── (независимо)
├── 2.4 S3 cleanup ────────── (независимо)
└── 2.5 HTML-санитизация ──── (независимо)

Фаза 3 (неделя 3) — КАЧЕСТВО
├── 3.1 Устранение дублирования маппингов
├── 3.2 $queryRaw в health check ─── (минимальное изменение)
├── 3.3 Статический импорт ────────── (минимальное изменение)
├── 3.4 crypto вместо Math.random ── (минимальное изменение)
├── 3.5 pino-pretty в devDeps ─────── (минимальное изменение)
├── 3.6 updatedAt на все модели ───── (миграция, можно сделать рано)
└── 3.7 PostgreSQL версия в CI ────── (минимальное изменение)

Фаза 4 (backlog) — МАСШТАБИРУЕМОСТЬ
├── 4.1 Пагинация
├── 4.2 Фоновые задачи (BullMQ)
├── 4.3 Redis
├── 4.4 API versioning
└── 4.5 Audit log
```

**Все задачи Фазы 2 независимы друг от друга** — можно распараллелить между разработчиками.

**Задачи Фазы 3** — мелкие, можно включать в любые PR как сопутствующие улучшения.

**Общая оценка трудозатрат:**
- Фаза 1: ~3-4 дня (1 разработчик)
- Фаза 2: ~3-4 дня (параллелизуется до 2 дней при 2+ разработчиках)
- Фаза 3: ~1-2 дня
- Фаза 4: по мере необходимости
