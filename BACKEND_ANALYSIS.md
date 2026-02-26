# Анализ серверной части Flipbook — взгляд опытного бэкенд-разработчика

## 1. Общая архитектура

### Стек

| Компонент | Технология |
|-----------|------------|
| Runtime | Node.js 22 (ESM) |
| Язык | TypeScript (ES2022 → ESNext) |
| Фреймворк | Express 5.0.1 |
| ORM | Prisma 6.0 |
| БД | PostgreSQL 17 |
| Хранилище файлов | S3-совместимое (MinIO для dev, AWS S3 для prod) |
| Аутентификация | Passport.js (Local + Google OAuth 2.0) |
| Сессии | express-session + connect-pg-simple (PostgreSQL store) |
| Валидация | Zod |
| Логирование | Pino + pino-http |
| Мониторинг | Sentry (опционально) |
| Контейнеризация | Docker (multi-stage) + docker-compose |

### Слоистая структура

```
Routes (13 модулей)  →  Middleware (5 модулей)  →  Services (12 модулей)  →  Prisma ORM  →  PostgreSQL
                                                        ↓
                                              Utils (storage, password, ownership, logger, prisma)
```

Архитектура следует классическому трёхслойному паттерну: **Routes → Services → Data Access**. Это хороший выбор — логика чётко разделена, каждый слой имеет свою зону ответственности.

---

## 2. Что сделано хорошо

### 2.1. Валидация конфигурации через Zod (`config.ts`)

```typescript
const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  SESSION_SECRET: z.string().min(32),
  // ...
});
```

Все переменные окружения валидируются на старте через Zod-схему. Сервер не запустится с невалидной конфигурацией — это fail-fast подход, который предотвращает множество проблем на production. Синглтон `loadConfig()` кешируется после первого вызова.

### 2.2. Graceful shutdown (`index.ts`)

```typescript
async function shutdown(signal: string) {
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000); // force kill
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

Корректное завершение с таймаутом на 10 секунд. Prisma-соединение закрывается штатно. Это критически важно для production (k8s rolling deploys, Docker stop).

### 2.3. Безопасность

- **Helmet** — security-заголовки (CSP, HSTS, X-Frame-Options, etc.)
- **bcrypt с 12 раундами** — достаточная стойкость для хеширования паролей
- **Rate limiting** — 3 уровня: общий (100 req/min), auth (5 req/min), public (30 req/min)
- **Zod-валидация** на всех входных данных (body, query)
- **httpOnly + sameSite + secure cookies** для сессий
- **CORS** с настраиваемым origin
- **Multer file filters** с проверкой MIME-типов и лимитами размеров
- **`trust proxy: 1`** — корректная обработка за реверс-прокси

### 2.4. Ownership-проверки

```typescript
export async function verifyBookOwnership(bookId, userId) {
  const book = await prisma.book.findUnique({ where: { id: bookId }, select: { userId: true } });
  if (!book) throw new AppError(404, 'Book not found');
  if (book.userId !== userId) throw new AppError(403, 'Access denied');
}
```

Вынесено в отдельную утилиту — проверка владения ресурсом происходит единообразно во всех сервисах. 404 возвращается раньше 403, чтобы не раскрывать информацию о существовании чужих ресурсов (хотя тут порядок наоборот — см. замечания ниже).

### 2.5. Структурированное логирование (Pino)

- Request ID (UUID) для трейсинга запросов
- Health-check эндпоинт исключён из логов (`autoLogging.ignore`)
- `pino-pretty` в dev, JSON в production
- Silent-режим в тестах

### 2.6. Docker и CI/CD

- Multi-stage Dockerfile (builder → production) — минимальный размер образа
- Health checks для postgres и minio в docker-compose
- CI pipeline: lint → test → server-test (с PostgreSQL service) → build → deploy
- MinIO init-контейнер для автоматического создания бакета

### 2.7. Типизация API-ответов

Файл `types/api.ts` определяет чёткий контракт API. Все сервисы возвращают типизированные DTO, а не сырые Prisma-модели — хорошая практика для предотвращения утечки внутренней структуры данных.

### 2.8. RESTful-дизайн маршрутов

```
/api/books/:bookId/chapters
/api/books/:bookId/appearance
/api/books/:bookId/sounds
/api/books/:bookId/ambients
/api/books/:bookId/decorative-font
/api/books/:bookId/progress
/api/books/:bookId/default-settings
```

Вложенная иерархия ресурсов — каноничный REST. CRUD-операции покрыты, reorder вынесен отдельно.

### 2.9. Prisma-схема

- UUID как Primary Key (через `gen_random_uuid()` — серверная генерация)
- Составные индексы (`[userId, position]`, `[bookId, position]`, `[userId, bookId]`)
- `@map` для snake_case в БД при camelCase в коде
- `Timestamptz` для дат — timezone-aware
- Каскадное удаление (`onDelete: Cascade`) по всему дереву зависимостей
- Unique constraint на `[userId, bookId]` в ReadingProgress

---

## 3. Проблемы и замечания

### 3.1. КРИТИЧНЫЕ

#### 3.1.1. Отсутствие CSRF-защиты

Сессионная аутентификация через cookies **обязательно** требует CSRF-защиты. Сейчас её нет. Любой вредоносный сайт может выполнить запрос от имени авторизованного пользователя, так как cookie отправляется автоматически.

**Решение:** добавить `csrf-csrf` или `csurf`-подобный middleware. Альтернативно — перейти на Bearer-токены (JWT) для API-запросов.

`sameSite: 'lax'` частично защищает от CSRF на POST-запросы из внешних форм, но не от запросов через `fetch` с `credentials: 'include'` (при CORS `origin: true`).

#### 3.1.2. Утечка passwordHash в сессию и десериализацию

```typescript
// auth.ts, deserializeUser:
const user = await prisma.user.findUnique({ where: { id } });
done(null, user); // ← вся модель, включая passwordHash
```

При десериализации из сессии загружается **полная модель User**, включая `passwordHash`. Это значит, что хеш пароля лежит в `req.user` на протяжении всего жизненного цикла запроса. Хотя `formatUser()` фильтрует хеш при отправке клиенту, он остаётся в памяти процесса и потенциально может утечь через логирование или ошибки.

**Решение:**
```typescript
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, email: true, displayName: true, avatarUrl: true, googleId: true },
});
```

#### 3.1.3. Отсутствие ограничения количества книг/глав/шрифтов на пользователя

Нет лимитов на количество создаваемых ресурсов. Злоумышленник может создать миллионы книг, глав и шрифтов, исчерпав место в БД и S3.

**Решение:** добавить проверки в сервисах:
```typescript
const count = await prisma.book.count({ where: { userId } });
if (count >= MAX_BOOKS_PER_USER) throw new AppError(403, 'Book limit reached');
```

#### 3.1.4. Memory storage в Multer для файлов до 50 МБ

```typescript
const storage = multer.memoryStorage();
export const bookUpload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });
```

Файлы книг до 50 МБ загружаются полностью в оперативную память. При нескольких параллельных загрузках это может привести к OOM (Out of Memory). Node.js по умолчанию имеет ~1.5 ГБ heap.

**Решение:** использовать disk storage для больших файлов или потоковую загрузку в S3 через `multer-s3`.

### 3.2. ВАЖНЫЕ

#### 3.2.1. N+1 запросов в import и reorder

```typescript
// exportImport.service.ts — import:
for (const bookData of data.books) {
  const book = await tx.book.create(...);
  for (let i = 0; i < bookData.chapters.length; i++) {
    await tx.chapter.create(...); // N запросов
  }
  for (let i = 0; i < bookData.ambients.length; i++) {
    await tx.ambient.create(...); // + N запросов
  }
}
```

При импорте 10 книг с 20 главами каждая — это ~200+ INSERT-запросов внутри одной транзакции. Prisma поддерживает `createMany()`, который выполняет один SQL-запрос.

**Аналогичная проблема в reorder:**
```typescript
await prisma.$transaction(
  bookIds.map((id, index) => prisma.book.update({ where: { id }, data: { position: index } }))
);
```

Каждый ID — отдельный UPDATE. Для 100 книг — 100 запросов. Лучше использовать raw SQL:
```sql
UPDATE books SET position = data.pos FROM (VALUES ($1, 0), ($2, 1), ...) AS data(id, pos) WHERE books.id = data.id::uuid;
```

#### 3.2.2. Дублирование маппинга Prisma → DTO

Маппинг `book.appearance.lightCoverBgStart` → `appearance.light.coverBgStart` дублируется в:
- `books.service.ts` → `getBookById()`
- `books.service.ts` → `getUserBooks()`
- `exportImport.service.ts` → `exportUserConfig()`

Одно изменение в схеме потребует правок в трёх местах. Стоит вынести маппинг в отдельные функции-трансформеры (`mapAppearanceToDto()`, `mapBookToDetail()`, etc.).

#### 3.2.3. Отсутствие пагинации

```typescript
export async function getUserBooks(userId: string) {
  const books = await prisma.book.findMany({
    where: { userId },
    orderBy: { position: 'asc' },
    // нет take/skip
  });
}
```

Эндпоинт `GET /api/books` возвращает **все книги** пользователя. Если их 10000 — ответ будет огромным. То же касается глав и шрифтов. Для данного приложения, возможно, это допустимо (у пользователя вряд ли будет больше ~100 книг), но для промышленного API стоит добавить cursor-based или offset pagination.

#### 3.2.4. Нет cleanup S3-файлов при удалении книги

```typescript
export async function deleteBook(bookId, userId) {
  await prisma.book.delete({ where: { id: bookId } });
  // S3-файлы (шрифты, звуки, изображения) остаются навечно
}
```

Каскадное удаление в Prisma удаляет записи из БД, но файлы в S3 (аудио, изображения, шрифты) не удаляются. Со временем S3 превратится в «свалку» осиротевших файлов.

**Решение:** перед удалением книги собирать все `fileUrl`-поля из связанных записей и удалять файлы из S3 в том же сервисе или через фоновую задачу.

#### 3.2.5. Race condition при получении `nextPosition`

```typescript
const lastBook = await prisma.book.findFirst({
  where: { userId }, orderBy: { position: 'desc' }, select: { position: true },
});
const nextPosition = (lastBook?.position ?? -1) + 1;
const book = await prisma.book.create({ data: { position: nextPosition } });
```

При двух параллельных запросах `POST /api/books` оба могут получить одинаковую `nextPosition`. Нет уникального индекса на `[userId, position]` (есть обычный индекс, но не `@@unique`).

**Решение:** обернуть в транзакцию с уровнем изоляции `Serializable`, или использовать `@@unique([userId, position])` + retry при конфликте, или использовать `MAX(position) + 1` в raw SQL.

#### 3.2.6. Отсутствие санитизации HTML-контента глав

```typescript
// chapters.service.ts — createChapter:
const chapter = await prisma.chapter.create({
  data: { htmlContent: data.htmlContent || null } // ← сохраняется as-is
});
```

HTML-контент глав сохраняется в БД без санитизации. При рендеринге на клиенте используется `HTMLSanitizer` (DOMPurify), но правильная практика — санитизировать и на сервере (defense in depth). Если клиент окажется без DOMPurify (мобильное приложение, другой фронтенд), хранимый XSS станет реальностью.

### 3.3. СРЕДНИЕ

#### 3.3.1. Health check с dynamic import

```typescript
app.get('/api/health', async (_req, res) => {
  const { getPrisma } = await import('./utils/prisma.js');
  const { getS3Client } = await import('./utils/storage.js');
});
```

Динамический `import()` внутри health-check — необычный паттерн. Предположительно, это сделано для ленивой инициализации, но health-check вызывается часто (каждые 5–30 сек мониторингом), и динамический импорт добавляет ненужный overhead. Лучше импортировать статически наверху файла.

#### 3.3.2. `$queryRawUnsafe('SELECT 1')` в health check

```typescript
await getPrisma().$queryRawUnsafe('SELECT 1');
```

Используется `$queryRawUnsafe` вместо `$queryRaw`. Хотя в данном случае инъекция невозможна (строка захардкожена), стилистически лучше использовать `$queryRaw\`SELECT 1\`` (tagged template), чтобы IDE/линтеры не помечали это как потенциальную проблему.

#### 3.3.3. Синглтон Prisma без graceful reconnect

```typescript
let prisma: PrismaClient | null = null;
export function getPrisma(): PrismaClient {
  if (prisma) return prisma;
  prisma = new PrismaClient({ log: [...] });
  return prisma;
}
```

Если PostgreSQL временно недоступен, `getPrisma()` всё равно вернёт уже созданный (но неработающий) клиент. Prisma имеет встроенный retry для connection pool, но стоит добавить health-проверку или пересоздание клиента при фатальных ошибках.

#### 3.3.4. Генерация файловых ключей с Math.random

```typescript
export function generateFileKey(folder, originalName): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${folder}/${timestamp}-${random}.${ext}`;
}
```

`Math.random()` не является криптографически безопасным. Для S3-ключей это не критично (они не секретные), но паттерн стоит заменить на `crypto.randomUUID()` для единообразия с остальным кодом (UUID уже используются повсеместно).

#### 3.3.5. Нет middleware для `mergeParams` на вложенных роутерах

```typescript
// app.ts:
app.use('/api/books/:bookId/chapters', chaptersRoutes);

// chapters.routes.ts:
const router = Router();
```

`Router()` по умолчанию не видит параметры родительского маршрута. Нужен `Router({ mergeParams: true })`. Сейчас `req.params.bookId` может быть `undefined` внутри вложенных роутеров.

> **Замечание:** Express 5 мог изменить поведение по умолчанию — стоит проверить конкретную версию. Если это работает, значит mergeParams включён по умолчанию в v5.

#### 3.3.6. Validate middleware бросает исключение без try/catch

```typescript
export function validate(schema: ZodSchema) {
  return (req, _res, next) => {
    req.body = schema.parse(req.body); // throws ZodError
    next();
  };
}
```

`schema.parse()` бросает `ZodError` синхронно, но он не обёрнут в `try/catch` и не передаётся в `next(err)`. В Express 4 это приведёт к необработанному исключению. В Express 5 синхронные ошибки автоматически перехватываются — если проект действительно на Express 5, это нормально, но документировать это допущение стоит.

#### 3.3.7. Нет логирования действий пользователя (audit log)

Нет audit trail: кто когда создал/удалил книгу, кто импортировал конфигурацию. Для production-приложения с пользовательским контентом это важно для расследования инцидентов.

### 3.4. МЕЛКИЕ

#### 3.4.1. Нет `@updatedAt` на нескольких моделях

Модели `BookAppearance`, `BookSounds`, `BookDefaultSettings`, `Ambient`, `DecorativeFont`, `ReadingFont`, `GlobalSettings` не имеют поля `updatedAt`. Это затруднит отладку и аналитику — невозможно понять, когда данные последний раз менялись.

#### 3.4.2. Разная версия Postgres в docker-compose и CI

```yaml
# docker-compose.yml:
image: postgres:17-alpine

# deploy.yml (CI):
image: postgres:16
```

Production-like окружение (docker-compose) использует PostgreSQL 17, а CI — 16. Это может привести к ситуации, когда тесты проходят в CI, но сервер падает с PostgreSQL 17 (или наоборот).

#### 3.4.3. `pino-pretty` в production-зависимостях

```json
"dependencies": {
  "pino-pretty": "^13.0.0"
}
```

`pino-pretty` используется только в development (`NODE_ENV === 'development'`), но установлен как production-зависимость. Это увеличивает размер Docker-образа. Стоит перенести в `devDependencies`.

#### 3.4.4. Express 5 — ещё не stable release

Express 5.0.1 на момент анализа всё ещё считается pre-release/early-release. Для production-приложения это рискованно — возможны breaking changes, не все middleware полностью совместимы.

#### 3.4.5. Отсутствие миграций в репозитории

Папка `prisma/migrations` не проверялась, но `db:push` используется как альтернатива миграциям. Для production **необходимы** миграции (`prisma migrate`), а не `db push`, чтобы изменения схемы были воспроизводимы и откатываемы.

---

## 4. Архитектурные рекомендации

### 4.1. Добавить слой Repository

Сейчас сервисы напрямую работают с Prisma. При росте проекта стоит добавить Repository-слой:

```
Routes → Services (бизнес-логика) → Repositories (data access) → Prisma → PostgreSQL
```

Это позволит:
- Тестировать сервисы без моков Prisma
- Заменить Prisma на другой ORM без изменения сервисов
- Централизовать повторяющиеся запросы

### 4.2. Фоновые задачи

Операции вроде:
- Парсинг загруженных книг (до 50 МБ)
- Удаление файлов из S3
- Генерация превью обложек

…выполняются синхронно в HTTP-запросе. Для production стоит добавить очередь задач (BullMQ + Redis) и выносить тяжёлые операции в background workers.

### 4.3. Кеширование

Нет ни одного уровня кеширования:
- **Горячие данные** (список книг пользователя) можно кешировать в Redis
- **S3-файлы** можно раздавать через CDN (CloudFront/Cloudflare)
- **Сессии** уже в PostgreSQL, но Redis-хранилище для сессий было бы производительнее

### 4.4. API versioning

Маршруты не версионированы (`/api/books` вместо `/api/v1/books`). При росте проекта это затруднит обратную совместимость.

### 4.5. OpenAPI-спецификация

Swagger-документация генерируется из объекта `swaggerSpec`, но маршруты не аннотированы (нет `@swagger` JSDoc-комментариев или Zod-to-OpenAPI интеграции). Стоит добавить `zod-openapi` для автоматической генерации спецификации из Zod-схем.

---

## 5. Резюме

### Оценка по критериям

| Критерий | Оценка | Комментарий |
|----------|--------|-------------|
| **Архитектура** | 7/10 | Чистое разделение на слои, REST, но нет Repository |
| **Безопасность** | 6/10 | Хорошая базовая защита, но нет CSRF, утечка passwordHash, нет лимитов ресурсов |
| **Производительность** | 5/10 | N+1 в импорте, memory storage на 50 МБ, нет кеширования |
| **Надёжность** | 7/10 | Graceful shutdown, health checks, но race conditions |
| **Тестируемость** | 7/10 | Есть тесты с real DB, но сервисы жёстко связаны с Prisma |
| **Observability** | 7/10 | Pino + Sentry + request ID, но нет audit log |
| **DevOps** | 8/10 | Docker, CI/CD, multi-stage build, health checks |
| **Код** | 7/10 | TypeScript, чистый стиль, но дублирование маппингов |

### Общая оценка: **6.8/10**

Это **добротный MVP/early-stage backend**, написанный с пониманием базовых принципов бэкенд-разработки. Архитектура чистая, стек современный, безопасность выше среднего для проектов этого уровня. Однако для production с реальной нагрузкой необходимо:

1. **Срочно:** CSRF-защита, лимиты ресурсов, фильтрация passwordHash
2. **Важно:** cleanup S3, пагинация, устранение N+1, потоковая загрузка больших файлов
3. **При росте:** Redis, фоновые задачи, Repository-слой, API versioning
