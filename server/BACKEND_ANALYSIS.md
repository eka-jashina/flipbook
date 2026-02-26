# Анализ серверной части Flipbook

## Общая архитектура

Бэкенд построен на **Express 5 + TypeScript**, использует **PostgreSQL 17** через **Prisma ORM** и **MinIO** (S3-совместимое хранилище) для файлов. Контейнеризация через Docker Compose.

```
server/src/
├── index.ts          — точка входа, graceful shutdown
├── app.ts            — Express-приложение, middleware pipeline
├── config.ts         — Zod-валидация переменных окружения
├── swagger.ts        — OpenAPI 3.0 спецификация
├── middleware/        — auth, CSRF, rate-limit, validation, upload, errorHandler
├── routes/           — 13 файлов маршрутов
├── services/         — бизнес-логика
├── utils/            — logger, prisma, storage, password, mappers, limits, reorder
├── parsers/          — парсинг книг (txt, doc, docx, epub, fb2)
└── types/            — TypeScript-интерфейсы API
```

## Что сделано хорошо

### 1. Конфигурация через Zod (`config.ts`)

Все переменные окружения проходят через Zod-схему при старте. Если что-то не так — сервер не стартанёт (fail fast).

### 2. Многоуровневая безопасность

- **Helmet** — security headers (CSP, X-Frame-Options, HSTS)
- **CSRF** — double-submit cookie pattern через `csrf-csrf`
- **Rate limiting** — три уровня: общий (100 req/min), auth (5 req/min), public (30 req/min)
- **bcrypt** с 12 раундами для хэширования паролей
- **Zod-валидация** входных данных на каждом маршруте
- **CORS** с явным указанием origin
- **httpOnly + sameSite=lax** cookies для сессий
- **Password hash никогда не попадает в ответы API**

### 3. Graceful shutdown (`index.ts`)

Корректное завершение работы: закрытие HTTP-сервера, отключение Prisma, force shutdown через 10 секунд.

### 4. Health check (`app.ts`)

Проверяет и БД, и S3 хранилище. При частичной деградации возвращает 503 + `"degraded"`.

### 5. Serializable-транзакции с автоматическим retry (`serializable.ts`)

`withSerializableRetry` оборачивает Prisma-транзакции в уровень изоляции `Serializable` и автоматически перезапускает при P2034 (serialization conflict). Защита от race conditions при создании/импорте.

### 6. Эффективное bulk-обновление позиций (`reorder.ts`)

Одним SQL-запросом через параметризованный `CASE WHEN`. Защита от SQL-injection через `Prisma.sql`.

### 7. DTO-маппинг (`mappers.ts`)

Чёткое разделение внутренней структуры БД и API-контрактов. Prisma-модели преобразуются в DTO перед отправкой клиенту.

### 8. Разделение memory/disk storage для загрузок (`upload.ts`)

Мелкие файлы (шрифты, звуки, картинки) — memory storage. Книги (до 50MB) — disk storage через `os.tmpdir()`. Защита от OOM.

### 9. Docker и CI/CD

- Multi-stage Dockerfile (builder + production)
- Docker Compose с healthcheck на Postgres и MinIO
- GitHub Actions с параллельными lint/test + серверные тесты на реальной PostgreSQL

## Замечания и рекомендации

### Критические

#### 1. CSRF: константный session identifier

```typescript
// csrf.ts:16
getSessionIdentifier: () => 'csrf',
```

CSRF-токен от одного пользователя валиден для другого. Рекомендация:

```typescript
getSessionIdentifier: (req) => req.sessionID || 'anonymous',
```

#### 2. Нет единого middleware проверки ownership

Каждый service повторяет проверку `book.userId !== userId`. Рекомендуется `requireBookOwnership` middleware.

#### 3. Одинаковый лимит body для всех маршрутов

`express.json({ limit: '10mb' })` на весь API — избыточно для CRUD. Для импорта 10MB может быть оправдано, но для обычных запросов нужен меньший лимит (256kb).

#### 4. Нет санитизации HTML при импорте

`importUserConfig` принимает `htmlContent` без DOMPurify-фильтрации — потенциальный stored XSS.

### Архитектурные

#### 5. Отсутствие service layer для upload/export маршрутов

Бизнес-логика в route handler'ах нарушает единообразие и усложняет тестирование.

#### 6. Нет пагинации

`getUserBooks()` загружает все книги одним запросом. При лимите 100 — допустимо, но не масштабируется.

#### 7. Дублирование default-значений

Defaults разбросаны по `schema.prisma`, `seed.ts`, `exportImport.service.ts`. Нужен единый `defaults.ts`.

#### 8. Swagger-спецификация написана вручную

При изменениях API легко забыть обновить документацию. Рекомендация — генерация из Zod-схем.

#### 9. 4xx ошибки не логируются

Только 500-е попадают в лог. Для мониторинга полезно логировать 401/403/429.

### Производительность

#### 10. Повторный запрос после create/update

`getBookById` вызывается после `createBook` и `updateBook` — лишний SQL. При текущей нагрузке допустимо.

#### 11. Нет кеширования

Нет ни серверного кеша, ни Cache-Control/ETag headers для read-heavy эндпоинтов.

### DevOps

#### 12. Request ID не возвращается в response headers

Для troubleshooting полезно добавить `X-Request-Id` в ответы.

#### 13. Секреты в docker-compose.yml

Для development — OK, для production нужен `.env` или secrets management.

## Итоговая оценка

| Аспект | Оценка | Комментарий |
|--------|--------|-------------|
| **Архитектура** | 8/10 | Чистое разделение, хорошие паттерны |
| **Безопасность** | 7/10 | Многоуровневая защита, но CSRF и import XSS |
| **Типобезопасность** | 9/10 | TypeScript strict mode, Zod, DTO |
| **Масштабируемость** | 6/10 | Stateful sessions, нет кеша и пагинации |
| **Тестирование** | 7/10 | Хорошее покрытие, мало edge cases |
| **DevOps** | 8/10 | Docker, CI/CD, multi-stage, health checks |
| **Кодовая база** | 8/10 | Чистая, читаемая, минимальные зависимости |

**Общий вердикт:** Крепкий бэкенд для проекта такого масштаба. Основные точки роста — привязка CSRF к сессии, санитизация импортируемого HTML, ownership-middleware, подготовка к масштабированию (кеш, пагинация, stateless auth).
