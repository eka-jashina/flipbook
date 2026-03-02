# Командное ревью проекта Flipbook

**Дата:** 2 марта 2026
**Команда:** Фронтендер, Бэкендер, Тестировщик, Дизайнер, DevOps, Маркетолог

---

## Общая оценка

| Специалист | Оценка | Вердикт |
|------------|--------|---------|
| **Фронтенд** | 8.3/10 | Production-ready, зрелая архитектура |
| **Бэкенд** | 8.5/10 | Сильная безопасность, чистый API |
| **Тестирование** | 8.0/10 | Отличное покрытие, есть пробелы в E2E |
| **Дизайн** | 8.1/10 | Сильная дизайн-система, нужна документация |
| **DevOps** | 7.2/10 | Хорошая база, критические пробелы в мониторинге |
| **Маркетинг** | 5.5/10 | Сильный продукт, слабое продвижение |
| **Общая** | **7.6/10** | **Технически зрелый продукт с пробелами в инфраструктуре и маркетинге** |

---

## 1. Фронтенд-разработчик

### Что отлично

- **Архитектура (9/10)**: Образцовое применение паттернов — DI через `BookControllerBuilder`, State Machine (`BookStateMachine`), Delegate Pattern с 8 делегатами, Service Groups. Фазированная конструкция DI-графа (5 фаз) с проверкой зависимостей.
- **Минимальные зависимости**: Всего 3 runtime-зависимости (DOMPurify, JSZip, Quill) — нет bloat.
- **Производительность (9/10)**: LRU-кеш страниц (50 элементов), асинхронная пагинация (`AsyncPaginator`) с chunked processing (16ms yield для 60fps), ленивая загрузка контента.
- **Очистка ресурсов**: Все компоненты имеют `destroy()`, EventListenerManager отслеживает слушатели, TimerManager чистит таймеры.
- **Сборка**: Vite с Terser (удаление console.log), Gzip + Brotli сжатие, ручное разделение чанков (utils, managers, delegates, account), оптимизация изображений через Sharp.

### Замечания

- **AdminConfigStore.js (733 строки)** — приближается к лимиту. Рекомендация: разделить на `AdminConfigStore` (CRUD) + `AdminConfigPersistence` (IDB/localStorage миграция).
- **config.js (480 строк)** — смешивает 3 режима конфигурации (default, admin, API). Рекомендация: выделить `ConfigFactory`, `AdminConfigAdapter`, `ServerConfigAdapter`.
- **localStorage не централизован**: 104 прямых обращения к localStorage разбросаны по коду вместо использования `StorageManager`.
- **AlbumManager.js (926 строк)** — самый большой модуль админки, стоит разделить логику фоторедактирования.
- **Дупликация в парсерах**: TxtParser, DocParser, DocxParser, EpubParser, Fb2Parser имеют похожую структуру — нет базового класса.
- **ErrorHandler** — базовый: нет категоризации ошибок (network/validation/runtime), нет мониторинга.

### Рекомендации

| Приоритет | Действие |
|-----------|----------|
| HIGH | Разделить AdminConfigStore.js (733 → 300+300 строк) |
| HIGH | Рефакторинг config.js (480 → 3 модуля по ~150 строк) |
| HIGH | Централизовать localStorage через StorageManager |
| MEDIUM | Добавить категоризацию ошибок в ErrorHandler |
| MEDIUM | Извлечь общие хелперы форм/модалок из admin-модулей |
| LOW | Добавить ARCHITECTURE.md с диаграммами DI и state flow |

---

## 2. Бэкенд-разработчик

### Что отлично

- **API-дизайн (9/10)**: Чистый REST с единым форматом ответов `{ data, ...meta }`. Правильные HTTP-статусы (201, 204, 404, 409). Пагинация через `limit`/`offset`. `asyncHandler` на всех роутах.
- **Безопасность (9/10)**:
  - Passport.js (local + Google OAuth) с `session.regenerate()` после аутентификации
  - bcrypt (SALT_ROUNDS=12) для паролей
  - CSRF double-submit cookie через `csrf-csrf`
  - Zod-валидация всех входных данных (269 строк схем)
  - Magic-byte верификация загружаемых файлов (WOFF2, MP3, PNG, JPEG и др.)
  - Rate limiting: 100 req/min глобально, 5 req/min на auth-эндпоинты
  - `isSafeUrl()` блокирует `javascript:`, `vbscript:`, `data:` (кроме шрифтов)
- **БД-схема (8/10)**: 13 моделей Prisma, стратегические индексы (`[userId, position]`, `[userId, bookId]`), каскадное удаление, уникальные ограничения на 1-to-1 связи.
- **Graceful shutdown**: SIGTERM/SIGINT обработчики, 10-секундный таймаут, очистка Prisma-соединений.

### Замечания

- **Soft-delete неконсистентен**: `deletedAt` на модели Book есть, но фильтрация `WHERE deletedAt = null` не везде применяется. Отсутствует отдельный индекс на `deletedAt`.
- **Дупликация ReadingPreferences/BookDefaultSettings**: Обе модели хранят одинаковые поля (font, fontSize, theme, soundEnabled...) — назначение не задокументировано.
- **Пагинация неполная**: Только `getUserBooks` поддерживает limit/offset. `getChapters`, `getAmbients`, `getReadingFonts` возвращают всё.
- **CSRF_SECRET может совпадать с SESSION_SECRET** (fallback в csrf.ts) — в production они должны быть разными.
- **S3-очистка best-effort**: При удалении книги файлы в S3 могут осиротеть, если удаление S3-объектов падает.

### Рекомендации

| Приоритет | Действие |
|-----------|----------|
| HIGH | Добавить `@@index([deletedAt])` на Book |
| HIGH | Задокументировать разницу ReadingPreferences vs BookDefaultSettings |
| HIGH | Добавить пагинацию в getChapters (может быть >200 глав) |
| MEDIUM | Валидировать CSRF_SECRET != SESSION_SECRET в production |
| MEDIUM | Задокументировать процесс очистки осиротевших S3-файлов |
| LOW | Стандартизировать маппинг данных (часть в services, часть в mappers.ts) |

---

## 3. Тестировщик (QA)

### Что отлично

- **Соотношение тест/код 2.3:1**: 51,325 строк тестов на 22,232 строк фронтенд-кода. Это превосходный показатель.
- **Покрытие по уровням**: 76 unit-тестов, 28 интеграционных, 11 E2E, 18 серверных — итого 133 тест-файла.
- **Качество unit-тестов (9/10)**: Семантические матчеры (`.toHaveBeenCalledOnce()`, `.toHaveBeenCalledWith()`), тестирование edge cases, negative assertions.
- **Интеграционные тесты (8/10)**: Реальные компоненты (BookStateMachine, Delegates, Managers), мок только внешних зависимостей. `fullReadingSession.test.js` — полный цикл: открытие → навигация → смена главы → шрифт → закрытие → проверка сохранения.
- **E2E (7/10)**: 5 браузеров (Chrome, Firefox, Safari, Pixel 5, iPhone 12), Page Object Models, кастомные fixtures.
- **Инфраструктура**: Comprehensive mock setup (409 строк) — localStorage, Audio API, matchMedia, RAF, fetch, ResizeObserver.
- **CI**: Пороги покрытия: 80% statements / 70% branches для core, 60% для admin.

### Замечания

- **Захардкоженные таймауты в E2E**: `page.waitForTimeout(500)` встречается 10+ раз — риск нестабильности на медленном CI.
- **Нет unit-тестов для критических модулей**:
  - `BookControllerBuilder.js` (сборка DI-графа) — HIGH risk
  - `BookDIConfig.js` (конфигурация делегатов) — HIGH risk
  - `SettingsBindings.js` (привязки UI настроек) — HIGH risk
  - `Router.js` (SPA-маршрутизация) — MEDIUM risk
  - `IdbStorage.js` (IndexedDB обёртка) — MEDIUM risk
- **Нет E2E для админ-панели**: Загрузка книг, редактирование глав, управление шрифтами не покрыты.
- **Нет E2E для мультикнижных сценариев**: Переключение книг, per-book progress.
- **Нет тестов конкурентных операций** на сервере (race conditions).

### Рекомендации

| Приоритет | Действие |
|-----------|----------|
| HIGH | Заменить `waitForTimeout()` на `waitForSelector()` в E2E |
| HIGH | Добавить unit-тесты для BookControllerBuilder, BookDIConfig, SettingsBindings |
| HIGH | Добавить unit-тесты для Router.js |
| MEDIUM | Создать E2E-тесты для админ-панели |
| MEDIUM | Добавить E2E мультикнижных сценариев |
| MEDIUM | Unit-тесты для IdbStorage.js |
| LOW | Создать test data builders/factories для снижения boilerplate |

---

## 4. Дизайнер

### Что отлично

- **Дизайн-система (9/10)**: 117 CSS-переменных в `variables.css`, токен-система для анимаций, размеров, теней, 3D-эффектов.
- **3 темы**: Light (WCAG AAA — контраст 17.7:1), Dark (WCAG AAA — 11.5:1), B&W (максимальный контраст 21:1).
- **Анимации (9/10)**: Физически реалистичный page-flip (lift 240ms → rotate 900ms → drop 160ms), cubic-bezier для плавности, GPU-ускорение через `transform-style: preserve-3d`.
- **Адаптивность (9/10)**: 3 брейкпоинта (mobile 768px, tablet 1024px, desktop 1440px+), `dvh`/`svh` для safe viewport, PWA standalone mode.
- **Микроинтеракции**: Книги на полке `translateY(-12px) rotateY(-8deg)` при hover, scale 0.95x при клике, wave-эффект на loading-точках.
- **Accessibility (9/10)**: Focus-visible стили, skip navigation, touch targets 44px (iOS HIG), `prefers-reduced-motion` поддержка.

### Замечания

- **Spacing не документирован**: Используется 8px-система, но с отклонениями (5px, 10px). Нет формальной шкалы в variables.css.
- **Кнопки не унифицированы**: 4 разных размера (32px, 36px, 40px, 44px) без явной шкалы (Small/Medium/Large).
- **border-radius разброс**: 6 вариантов (2px, 4px, 6px, 8px, 10px, 12px) — можно упростить до 3-4.
- **Auth-модаль не тематизирован**: Захардкоженный синий `#5b6abf` не адаптируется к light/dark/bw темам.
- **~15% цветов захардкожены**: Особенно в auth.css (8 значений), bookshelf.css (5), admin/* (15+).
- **Иконочная система**: Нет конвенции именования, нет единой библиотеки. Размеры варьируются: 18px, 20px, 24px.

### Рекомендации

| Приоритет | Действие |
|-----------|----------|
| HIGH | Создать документированную шкалу spacing: 4, 8, 12, 16, 24, 32px |
| HIGH | Унифицировать кнопки: Small (32px), Medium (40px), Large (44px) |
| HIGH | Сделать auth-модаль theme-aware (заменить `#5b6abf` на CSS-переменные) |
| MEDIUM | Упростить border-radius: 4px, 8px, 12px, 50% |
| MEDIUM | Вынести все захардкоженные цвета в CSS-переменные |
| LOW | Создать именованные shadow-токены |
| LOW | Документировать easing-функции как именованные переменные |

---

## 5. DevOps-инженер

### Что отлично

- **Docker (95/100)**: Multi-stage build, non-root user (`appuser`), `dumb-init` для PID 1, health checks с проверкой DB + S3, Alpine-образы (170MB vs 1GB).
- **Docker Compose**: PostgreSQL 17 + MinIO + Server с health checks, persistent volumes, `tmpfs` для temp, auto-init бакетов.
- **CI/CD**: GitHub Actions с параллельными lint + test, staged dependencies (build зависит от lint + test), concurrency groups.
- **Build**: Gzip + Brotli, image optimization, code splitting, PWA Service Worker (Workbox).
- **Graceful shutdown**: SIGTERM handler, 10s timeout, Prisma cleanup.
- **Деплой**: 3 платформы (GitHub Pages, Amvera, Railway) с правильными health checks.

### Критические замечания

- **Бэкапы: 0/100** — Нет стратегии бэкапов для PostgreSQL и S3. Данные могут быть утеряны.
- **Мониторинг: 30/100** — Sentry опционален, нет APM, нет log aggregation, нет alerting. Логи теряются при рестарте контейнера.
- **Frontend error tracking: 0/100** — Нет клиентского мониторинга ошибок.
- **Load testing: 0/100** — Нет результатов нагрузочного тестирования.
- **E2E не в CI**: Playwright-тесты не запускаются в GitHub Actions.
- **Нет git hooks**: Отсутствуют Husky/lint-staged для pre-commit проверок.
- **Нет `.nvmrc`**: Разработчики могут использовать разные версии Node.
- **Нет Dependabot/Renovate**: Зависимости могут устареть без автоматических PR.
- **`unsafe-inline` в CSP**: Ослабляет защиту от XSS. Нужен nonce-based подход.
- **`frame-ancestors: '*'`**: Позволяет любому домену встроить приложение в iframe.

### Рекомендации

| Приоритет | Действие |
|-----------|----------|
| CRITICAL | Внедрить систему бэкапов БД (ежедневные, 7-дневное хранение) |
| CRITICAL | Включить Sentry APM для сервера + клиента |
| CRITICAL | Настроить log aggregation (ELK/CloudWatch/Datadog) |
| CRITICAL | Провести нагрузочное тестирование (k6/JMeter) |
| HIGH | Добавить E2E тесты в CI (Playwright) |
| HIGH | Установить Husky + lint-staged |
| HIGH | Добавить `.nvmrc` с Node 22 |
| HIGH | Настроить Dependabot или Renovate |
| MEDIUM | Заменить `unsafe-inline` на nonce в CSP |
| MEDIUM | Ограничить `frame-ancestors` доверенными доменами |
| MEDIUM | Добавить Lighthouse CI в pipeline |
| LOW | Добавить resource limits в docker-compose |

---

## 6. Маркетолог

### Что отлично

- **Уникальное позиционирование**: Единственный ридер с физически реалистичной 3D-анимацией перелистывания — сильный дифференциатор.
- **Богатая функциональность**: 25+ пользовательских фич (3D-анимации, мультикнижность, кастомизация, PWA, offline, ambient-звуки).
- **PWA (9/10)**: Standalone mode, правильные иконки, Service Worker, offline-поддержка — готов к установке.
- **Документация (9/10)**: Отличные readme.md, CLAUDE.md, DEPLOYMENT.md — порог входа для разработчиков низкий.
- **Демо-контент**: 3 главы "Хоббита" с иллюстрациями, ambient-звуками — полноценная демонстрация возможностей.
- **Landing page**: Есть, с hero-секцией, 3-шаговым "How It Works", showcase публичных книг.

### Критические замечания

- **Аналитика: 0/10** — Нет Google Analytics, Plausible, PostHog, Mixpanel. Полная слепота по поведению пользователей.
- **SEO: 3/10** — Нет meta description, Open Graph тегов, Twitter Cards, structured data, sitemap.xml, robots.txt. Социальные ссылки не будут показывать rich preview.
- **Локализация: 1/10** — Только русский язык. TAM ограничен ~250M русскоговорящих. Нет i18n-фреймворка.
- **Social sharing: 4/10** — Есть копирование ссылки, но нет кнопок шаринга в соцсети, нет UTM-параметров, нет OG-изображений.
- **Landing page неполна (6/10)**: Нет отзывов/социального доказательства, нет информации о ценах, нет email-подписки, нет trust badges.
- **Нет ценовой прозрачности**: Непонятно — бесплатный сервис или есть платные тарифы.

### Рекомендации

| Приоритет | Действие |
|-----------|----------|
| CRITICAL | Добавить SEO мета-теги (description, OG, Twitter Cards) |
| CRITICAL | Внедрить аналитику (Plausible — privacy-friendly) |
| CRITICAL | Создать sitemap.xml и robots.txt |
| HIGH | Добавить социальные кнопки шаринга + OG-изображения |
| HIGH | Расширить landing page (отзывы, pricing, email capture) |
| HIGH | Добавить английскую локализацию (максимальный ROI) |
| MEDIUM | Подать PWA в Chrome Web Store и Microsoft Store |
| MEDIUM | Разработать контент-стратегию (блог, case studies) |
| LOW | Добавить альтернативный демо-контент (бизнес/образование) |

---

## Общие выводы команды

### Сильные стороны проекта

1. **Зрелая архитектура** — DI, State Machine, Delegates, Service Groups, Double Buffering. Проект демонстрирует глубокое понимание паттернов проектирования.
2. **Безопасность на высоком уровне** — CSRF, bcrypt, rate limiting, Zod-валидация, magic-byte проверка файлов, CSP, Helmet.
3. **Отличное тестирование** — соотношение тест/код 2.3:1, 133 тест-файла, 5 браузеров в E2E, пороги покрытия.
4. **Минимальные зависимости** — 3 runtime-зависимости на фронте, ~30 на бэке. Нет bloat.
5. **Производительность** — LRU-кеш, GPU-ускорение, async pagination, code splitting, Gzip+Brotli.
6. **Docker** — multi-stage build, non-root, health checks, dumb-init.
7. **Уникальный продукт** — 3D page-flip анимация — реальный дифференциатор на рынке.

### Критические пробелы

| # | Проблема | Ответственный | Влияние |
|---|----------|---------------|---------|
| 1 | Нет бэкапов БД и S3 | DevOps | Потеря данных пользователей |
| 2 | Нет мониторинга/alerting | DevOps | Проблемы обнаруживаются только по жалобам |
| 3 | Нет аналитики | Маркетолог | Слепота по поведению пользователей |
| 4 | Отсутствие SEO | Маркетолог | Низкая органическая видимость |
| 5 | Только русский язык | Маркетолог + Фронтенд | Ограниченный рынок |
| 6 | Нет нагрузочного тестирования | DevOps + QA | Неизвестна максимальная нагрузка |
| 7 | E2E не в CI | DevOps + QA | UI-регрессии не ловятся автоматически |

### Приоритизированный план действий

**Фаза 1 — Критическое (1-2 недели):**
- Бэкапы PostgreSQL + S3 versioning
- Sentry APM (сервер + клиент)
- SEO мета-теги + sitemap.xml + robots.txt
- Аналитика (Plausible)
- `.nvmrc` + Husky + lint-staged

**Фаза 2 — Важное (2-4 недели):**
- Unit-тесты для BookControllerBuilder, BookDIConfig, Router
- E2E для админ-панели
- Замена `waitForTimeout` на `waitForSelector` в E2E
- Рефакторинг AdminConfigStore.js и config.js
- Английская локализация
- Social sharing + OG-изображения
- Централизация localStorage через StorageManager

**Фаза 3 — Улучшения (1-2 месяца):**
- Auth-модаль theme-aware
- Документированная шкала spacing + кнопок
- Landing page (отзывы, pricing, email capture)
- Lighthouse CI + bundle size tracking в CI
- Нагрузочное тестирование (k6)
- Dependabot/Renovate
- Redis session store для масштабирования

**Фаза 4 — Полировка (по мере ресурсов):**
- ARCHITECTURE.md с диаграммами
- BaseParser для уменьшения дупликации
- PWA в Chrome Web Store
- i18n-фреймворк
- CDN для статики
- Canary deployments

---

*Документ подготовлен командой из 6 специалистов на основе полного анализа кодовой базы (44,464 строк JS, 18,090 строк CSS, 9,548 строк TypeScript, 51,325 строк тестов).*
