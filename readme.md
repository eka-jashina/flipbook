# Flipbook

> Интерактивная читалка электронных книг с реалистичной 3D-анимацией перелистывания страниц

[![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![ES Modules](https://img.shields.io/badge/ES-Modules-4285F4)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![CSS3](https://img.shields.io/badge/CSS3-3D%20Transforms-1572B6?logo=css3)](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Transforms)

[**Live Demo**](https://eka-jashina.github.io/flipbook/) · [Документация](./CLAUDE.md)

---

## Особенности

- **3D-анимация** — реалистичное перелистывание страниц с CSS 3D-трансформациями
- **Мультиглавная навигация** — поддержка книг с несколькими главами
- **Книжная полка** — стартовый экран с карточками книг, контекстное меню (читать / редактировать / удалить)
- **Личный кабинет** — управление книгами, главами, шрифтами, звуками, оформлением
- **Мультикнижность** — поддержка нескольких книг, per-book прогресс чтения (кнопка «Продолжить чтение»)
- **Импорт книг** — загрузка из форматов txt, doc, docx, epub, fb2
- **Персонализация** — выбор шрифта, размера текста, темы оформления
- **Кастомизация оформления** — per-book настройка цветов обложки, текстур страниц, декоративных шрифтов
- **Ambient-звуки** — фоновая атмосфера (дождь, камин, кафе) — настраиваемые через личный кабинет
- **Фотоальбом** — поддержка фотоальбома с лайтбоксом
- **Адаптивный дизайн** — корректная работа на десктопе и мобильных устройствах
- **Сохранение прогресса** — автоматическое запоминание позиции чтения по каждой книге
- **PWA** — установка как приложение, офлайн-доступ через Service Worker

---

## Архитектурные решения

### Паттерны проектирования

| Паттерн | Реализация | Назначение |
|---------|------------|------------|
| **State Machine** | `BookStateMachine` | Гарантия валидных переходов между состояниями книги |
| **Observer** | `EventEmitter` | Слабое связывание компонентов через события |
| **Dependency Injection** | `BookController` | Тестируемость и модульность |
| **Factory** | `ComponentFactory` | Централизованное создание компонентов |
| **Delegate** | `delegates/` | Разделение ответственности по доменам |
| **Mediator** | `DelegateMediator` | Коммуникация между делегатами |
| **Double Buffering** | `BookRenderer` | Плавные переходы между страницами |
| **LRU Cache** | `LRUCache` | Оптимизация производительности пагинации |
| **Service Groups** | `services/` | Группировка связанных зависимостей для DI |

### Конечный автомат состояний

```
┌────────┐      ┌─────────┐      ┌────────┐
│ CLOSED │ ───▶ │ OPENING │ ───▶ │ OPENED │ ◀─┐
└────────┘      └─────────┘      └────────┘   │
    ▲                                │        │
    │           ┌─────────┐          ▼        │
    └────────── │ CLOSING │ ◀── ┌──────────┐  │
                └─────────┘     │ FLIPPING │ ─┘
                                └──────────┘
```

Все переходы между состояниями валидируются. Недопустимые переходы отклоняются с логированием.

### Поток данных

```
User Input (click / touch / keyboard)
          │
          ▼
    ┌─────────────────┐
    │ EventController │  ← Нормализация событий
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │    Delegate     │  ← Navigation / Drag / Settings / Lifecycle
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ BookController  │  ← Координатор + State Machine
    └────────┬────────┘
             │
      ┌──────┴──────┐
      ▼             ▼
┌───────────┐ ┌───────────┐
│ Animator  │ │ Renderer  │  ← CSS-анимации + DOM-рендеринг
└─────┬─────┘ └─────┬─────┘
      │             │
      └──────┬──────┘
             ▼
           DOM
```

---

## Структура проекта

```
flipbook/
├── index.html                     # Точка входа — читалка
├── admin.html                     # Админ-панель
│
├── js/
│   ├── index.js                    # Точка входа
│   ├── config.js                   # Конфигурация (admin-aware, мультикнижная)
│   │
│   ├── utils/                      # Низкоуровневые утилиты
│   │   ├── EventEmitter.js         # Реализация паттерна Observer
│   │   ├── EventListenerManager.js # Автоматическая очистка listeners
│   │   ├── LRUCache.js             # Кэш с вытеснением
│   │   ├── CSSVariables.js         # Чтение CSS Custom Properties
│   │   ├── MediaQueryManager.js    # Реактивные media queries
│   │   ├── TransitionHelper.js     # Промисификация CSS transitions
│   │   ├── TimerManager.js         # Управление таймерами с debounce
│   │   ├── HTMLSanitizer.js        # Защита от XSS
│   │   ├── ErrorHandler.js         # Централизованная обработка ошибок
│   │   ├── StorageManager.js       # Абстракция над localStorage
│   │   ├── SoundManager.js         # Управление звуковыми эффектами
│   │   ├── AmbientManager.js       # Фоновые ambient-звуки
│   │   ├── RateLimiter.js          # Ограничение частоты вызовов
│   │   ├── InstallPrompt.js        # PWA-промпт установки
│   │   ├── OfflineIndicator.js     # Индикатор офлайн-режима
│   │   ├── ScreenReaderAnnouncer.js # Анонсы для скринридеров
│   │   └── PhotoLightbox.js        # Лайтбокс фотоальбома
│   │
│   ├── managers/                   # Бизнес-логика и данные
│   │   ├── BookStateMachine.js     # Конечный автомат состояний
│   │   ├── SettingsManager.js      # Персистентные настройки (localStorage)
│   │   ├── ContentLoader.js        # Загрузка HTML-контента глав
│   │   ├── AsyncPaginator.js       # CSS multi-column пагинация
│   │   └── BackgroundManager.js    # Кроссфейд фонов глав
│   │
│   ├── core/                       # Ядро приложения
│   │   ├── BookController.js       # Главный координатор (DI-контейнер)
│   │   ├── ComponentFactory.js     # Фабрика компонентов
│   │   ├── DOMManager.js           # Централизованный доступ к DOM
│   │   ├── BookRenderer.js         # Рендеринг страниц (double buffering)
│   │   ├── BookAnimator.js         # Оркестрация CSS-анимаций
│   │   ├── EventController.js      # Обработка пользовательского ввода
│   │   ├── LoadingIndicator.js     # UI индикатора загрузки
│   │   ├── DebugPanel.js           # Панель отладки (dev)
│   │   ├── AppInitializer.js       # Инициализация приложения
│   │   ├── SubscriptionManager.js  # Управление подписками на события
│   │   ├── ResizeHandler.js        # Обработка изменения размера окна
│   │   ├── DelegateMediator.js     # Коммуникация между делегатами
│   │   ├── BookshelfScreen.js      # Экран книжной полки (мультикнижность)
│   │   │
│   │   ├── services/               # Сервисные группы (DI)
│   │   │   ├── CoreServices.js         # DOM, события, таймеры, storage
│   │   │   ├── AudioServices.js        # Звуки и ambient
│   │   │   ├── RenderServices.js       # Рендеринг и анимации
│   │   │   └── ContentServices.js      # Загрузка и пагинация контента
│   │   │
│   │   └── delegates/              # Делегаты по доменам
│   │       ├── BaseDelegate.js         # Абстрактный базовый класс
│   │       ├── NavigationDelegate.js   # Логика перелистывания
│   │       ├── DragDelegate.js         # Touch-перетаскивание страниц
│   │       ├── DragAnimator.js         # Анимация угла поворота при drag
│   │       ├── DragDOMPreparer.js      # Подготовка DOM для drag
│   │       ├── DragShadowRenderer.js   # Рендеринг теней при drag
│   │       ├── SettingsDelegate.js     # UI настроек
│   │       ├── ChapterDelegate.js      # Переключение глав
│   │       └── LifecycleDelegate.js    # Открытие/закрытие книги
│   │
│   └── admin/                      # Админ-панель
│       ├── index.js                # Точка входа админки
│       ├── AdminConfigStore.js     # Персистентное хранилище конфига
│       ├── BookParser.js           # Диспетчер парсинга книг
│       ├── modules/                # Функциональные модули админки
│       │   ├── BaseModule.js           # Абстрактный базовый модуль
│       │   ├── AlbumManager.js         # Управление фотоальбомом
│       │   ├── AmbientsModule.js       # Настройка ambient-звуков
│       │   ├── AppearanceModule.js     # Кастомизация оформления книги
│       │   ├── BookUploadManager.js    # Загрузка книг
│       │   ├── ChaptersModule.js       # Управление главами
│       │   ├── ExportModule.js         # Экспорт конфигурации
│       │   ├── FontsModule.js          # Управление шрифтами
│       │   ├── SettingsModule.js       # Глобальные настройки
│       │   └── SoundsModule.js         # Управление звуковыми эффектами
│       └── parsers/                # Парсеры форматов книг
│           ├── parserUtils.js          # Общие утилиты парсеров
│           ├── TxtParser.js            # Парсер .txt
│           ├── DocParser.js            # Парсер .doc (Word 97-2003)
│           ├── DocxParser.js           # Парсер .docx
│           ├── EpubParser.js           # Парсер .epub
│           └── Fb2Parser.js            # Парсер .fb2
│
├── css/                            # Модульная CSS-архитектура
│   ├── index.css                   # Входная точка (импорты)
│   ├── variables.css               # Design tokens (CSS Custom Properties)
│   ├── reset.css                   # Сброс браузерных стилей
│   ├── themes.css                  # Светлая / тёмная / ч/б темы
│   ├── layout.css                  # Grid/flex разметка
│   ├── book.css                    # 3D-контейнер книги
│   ├── pages.css                   # Стили страниц
│   ├── cover.css                   # Обложка книги
│   ├── sheet.css                   # Анимированный лист
│   ├── typography.css              # Типографика
│   ├── images.css                  # Стили изображений в контенте
│   ├── loading.css                 # Индикатор загрузки
│   ├── debug.css                   # Панель отладки (dev)
│   ├── animations.css              # Keyframe-анимации
│   ├── drag.css                    # Стили drag-взаимодействия
│   ├── accessibility.css           # Стили доступности (skip-link, focus)
│   ├── install-prompt.css          # PWA-промпт установки
│   ├── offline.css                 # Индикатор офлайн-режима
│   ├── bookshelf.css               # Экран книжной полки
│   ├── photo-album.css             # Фотоальбом / лайтбокс
│   ├── responsive.css              # Адаптивность
│   ├── controls/                   # Стили UI-контролов
│   │   ├── index.css               # Входная точка + общие стили
│   │   ├── pod-variables.css       # CSS-переменные контролов
│   │   ├── navigation-pod.css      # Навигация и прогресс-бар
│   │   ├── settings-pod.css        # Панель настроек
│   │   └── audio-pod.css           # Аудио-контролы
│   └── admin/                      # Стили админ-панели
│       ├── index.css               # Входная точка
│       ├── base.css                # Базовые стили
│       ├── variables.css           # CSS-переменные админки
│       ├── buttons.css             # Кнопки
│       ├── modal.css               # Модальные окна
│       ├── tabs.css                # Вкладки
│       ├── screens.css             # Экраны
│       ├── responsive.css          # Адаптивность админки
│       ├── book-selector.css       # Выбор книги
│       ├── book-upload.css         # Загрузка книги
│       ├── chapters.css            # Управление главами
│       ├── fonts.css               # Управление шрифтами
│       ├── sounds.css              # Звуки и ambient-звуки
│       ├── appearance.css          # Кастомизация оформления
│       ├── settings.css            # Настройки
│       ├── album.css               # Фотоальбом
│       ├── export.css              # Экспорт
│       └── toast.css               # Toast-уведомления
│
├── public/                         # Статические ресурсы
│   ├── content/                    # HTML-контент глав
│   ├── images/                     # Фоны и иллюстрации (.webp)
│   ├── fonts/                      # Кастомные шрифты (.woff2)
│   ├── icons/                      # PWA-иконки (SVG, PNG)
│   └── sounds/                     # Аудио (перелистывание, ambient)
│
└── tests/                          # Тесты
    ├── setup.js                    # Настройка тестового окружения
    ├── helpers/                    # Вспомогательные утилиты для тестов
    │   ├── testUtils.js            # Утилиты для юнит-тестов
    │   └── integrationUtils.js     # Утилиты для интеграционных тестов
    ├── unit/                       # Юнит-тесты (Vitest)
    │   ├── utils/                  # Тесты утилит
    │   ├── managers/               # Тесты менеджеров
    │   ├── core/                   # Тесты ядра (core, delegates, services)
    │   └── admin/                  # Тесты админ-модулей
    ├── integration/                # Интеграционные тесты (Vitest)
    │   ├── smoke.test.js           # Smoke-тесты
    │   ├── flows/                  # Тесты пользовательских сценариев
    │   │   ├── navigation.test.js      # Навигация по страницам
    │   │   ├── settings.test.js        # Работа с настройками
    │   │   ├── chapters.test.js        # Переключение глав
    │   │   ├── drag.test.js            # Drag-взаимодействие
    │   │   ├── events.test.js          # Обработка событий
    │   │   ├── accessibility.test.js   # Доступность
    │   │   ├── chapterRepagination.test.js  # Репагинация при смене глав
    │   │   ├── settingsRepagination.test.js # Репагинация при смене настроек
    │   │   ├── dragNavConflict.test.js # Конфликт drag/навигации
    │   │   ├── errorRecovery.test.js   # Восстановление при ошибках
    │   │   ├── fullReadingSession.test.js   # Полная сессия чтения
    │   │   └── resizeFlow.test.js      # Обработка ресайза
    │   ├── lifecycle/              # Тесты жизненного цикла
    │   │   ├── bookLifecycle.test.js   # Жизненный цикл книги
    │   │   └── stateMachine.test.js    # Конечный автомат
    │   └── services/               # Тесты сервисов
    │       └── contentLoader.test.js   # Загрузка контента
    └── e2e/                        # E2E-тесты (Playwright)
        ├── fixtures/               # Фикстуры для тестов
        │   └── book.fixture.js     # Фикстура книги
        ├── pages/                  # Page Object модели
        │   ├── index.js            # Экспорт моделей
        │   ├── BookPage.js         # Страница книги
        │   └── SettingsPanel.js    # Панель настроек
        ├── flows/                  # Тестовые сценарии
        │   ├── reading.spec.js     # Сценарии чтения
        │   ├── navigation.spec.js  # Навигация
        │   ├── settings.spec.js    # Настройки
        │   ├── responsive.spec.js  # Адаптивность
        │   └── accessibility.spec.js # Доступность
        └── performance/            # Тесты производительности
            └── loading.spec.js     # Производительность загрузки
```

---

## Быстрый старт

```bash
# Клонирование
git clone https://github.com/eka-jashina/flipbook.git
cd flipbook

# Установка зависимостей
npm install

# Запуск dev-сервера
npm run dev
```

### Доступные команды

| Команда | Описание |
|---------|----------|
| `npm run dev` | Запуск dev-сервера (порт 3000, авто-открытие браузера) |
| `npm run build` | Production-сборка в `dist/` |
| `npm run build:prod` | Полная очистка + сборка |
| `npm run build:analyze` | Сборка с анализом бандла |
| `npm run preview` | Превью production-сборки (порт 4173) |
| `npm run serve` | Запуск статик-сервера для `dist/` |
| `npm run size` | Проверка размера файлов в `dist/` |
| `npm run clean` | Удаление папки `dist/` |
| `npm run deploy` | Сборка + деплой на Netlify |
| `npm run deploy:netlify` | Деплой `dist/` на Netlify |
| `npm run deploy:vercel` | Деплой на Vercel |
| `npm run test` | Запуск unit/integration тестов (Vitest) |
| `npm run test:run` | Однократный запуск тестов |
| `npm run test:watch` | Тесты в watch-режиме |
| `npm run test:coverage` | Тесты с отчётом покрытия |
| `npm run test:ui` | Тесты с UI-интерфейсом Vitest |
| `npm run test:e2e` | Запуск E2E-тестов (Playwright) |
| `npm run test:e2e:ui` | E2E-тесты с UI-интерфейсом |
| `npm run test:e2e:debug` | E2E-тесты в режиме отладки |
| `npm run test:e2e:headed` | E2E-тесты с видимым браузером |
| `npm run test:e2e:report` | Показать отчёт E2E-тестов |
| `npm run lint` | Запуск ESLint + Stylelint |
| `npm run lint:js` | ESLint на js/ |
| `npm run lint:css` | Stylelint на css/ |
| `npm run lint:js:fix` | ESLint с автоисправлением |
| `npm run lint:css:fix` | Stylelint с автоисправлением |
| `npm run docs` | Генерация API-документации в `docs/` |
| `npm run docs:serve` | Генерация и сервер документации (порт 3001) |

---

## Ключевые компоненты

| Компонент | Файл | Ответственность |
|-----------|------|-----------------|
| **BookController** | `core/BookController.js` | Главный координатор, DI-контейнер |
| **BookStateMachine** | `managers/BookStateMachine.js` | Валидация переходов состояний |
| **BookRenderer** | `core/BookRenderer.js` | DOM-рендеринг, double buffering |
| **BookAnimator** | `core/BookAnimator.js` | Оркестрация CSS 3D-анимаций |
| **AsyncPaginator** | `managers/AsyncPaginator.js` | Разбивка контента на страницы |
| **EventController** | `core/EventController.js` | Клики, свайпы, клавиатура |
| **NavigationDelegate** | `core/delegates/NavigationDelegate.js` | Логика навигации по страницам |
| **DelegateMediator** | `core/DelegateMediator.js` | Коммуникация между делегатами |
| **BookshelfScreen** | `core/BookshelfScreen.js` | Экран книжной полки (мультикнижность) |
| **DragDelegate** | `core/delegates/DragDelegate.js` | Touch-перетаскивание страниц |
| **DragAnimator** | `core/delegates/DragAnimator.js` | Анимация угла поворота при drag |
| **DragDOMPreparer** | `core/delegates/DragDOMPreparer.js` | Подготовка DOM для drag |
| **DragShadowRenderer** | `core/delegates/DragShadowRenderer.js` | Рендеринг теней при drag |
| **CoreServices** | `core/services/CoreServices.js` | Группа: DOM, события, таймеры, storage |
| **AudioServices** | `core/services/AudioServices.js` | Группа: звуки и ambient |
| **RenderServices** | `core/services/RenderServices.js` | Группа: рендеринг и анимации |
| **ContentServices** | `core/services/ContentServices.js` | Группа: загрузка и пагинация |
| **PhotoLightbox** | `utils/PhotoLightbox.js` | Лайтбокс фотоальбома |
| **InstallPrompt** | `utils/InstallPrompt.js` | PWA-промпт установки приложения |
| **OfflineIndicator** | `utils/OfflineIndicator.js` | Индикатор офлайн-режима |
| **ScreenReaderAnnouncer** | `utils/ScreenReaderAnnouncer.js` | Анонсы для скринридеров (a11y) |
| **RateLimiter** | `utils/RateLimiter.js` | Ограничение частоты вызовов |
| **AdminConfigStore** | `admin/AdminConfigStore.js` | Персистентное хранилище конфига админки |
| **BookParser** | `admin/BookParser.js` | Диспетчер парсинга книг |

---

## Личный кабинет

Личный кабинет (`admin.html`) позволяет управлять содержимым и оформлением без изменения кода. Открывается кнопкой «Редактировать» из контекстного меню на книжной полке.

### Вкладка «Мои книги»

- **Управление книгами** — создание, выбор, удаление книг; экран выбора режима создания (загрузка файла или создание вручную)
- **Загрузка книг** — импорт из txt, doc, docx, epub, fb2
- **Управление главами** — добавление, редактирование, переупорядочивание глав; переключатель тем оформления (светлая/тёмная) прямо на вкладке «Страницы»
- **Шрифты** — выбор из встроенных или загрузка кастомных (woff2/ttf/otf)
- **Звуки** — настройка звуков перелистывания и обложки
- **Ambient-звуки** — добавление и настройка фоновых звуков
- **Оформление** — цвета обложки, текстуры страниц, фон приложения (отдельно для light/dark тем)
- **Фотоальбом** — управление галереей изображений

### Вкладка «Настройки»

- **Настройки видимости** — какие настройки показывать читателю (шрифт, размер, тема, звук, ambient)
- **Шрифты платформы** — управление доступными шрифтами для чтения

### Вкладка «Экспорт»

- **Экспорт конфигурации** — сохранение всего конфига в файл

Конфигурация сохраняется в localStorage (`flipbook-admin-config`), крупный контент (HTML глав) — в IndexedDB.

---

## Тестирование

### Стратегия тестирования

Проект использует трёхуровневую стратегию тестирования:

| Уровень | Инструмент | Назначение |
|---------|------------|------------|
| **Unit** | Vitest | Изолированное тестирование модулей |
| **Integration** | Vitest + jsdom | Тестирование взаимодействия компонентов |
| **E2E** | Playwright | Сквозное тестирование в реальных браузерах |

### E2E-тестирование (Playwright)

E2E-тесты запускаются в пяти окружениях:
- Desktop Chrome, Firefox, Safari
- Mobile Chrome (Pixel 5), Mobile Safari (iPhone 12)

```bash
# Запуск всех E2E-тестов
npm run test:e2e

# С UI-интерфейсом Playwright
npm run test:e2e:ui

# С видимым браузером
npm run test:e2e:headed

# Отладка
npm run test:e2e:debug
```

### Page Object паттерн

E2E-тесты используют Page Object модели для абстракции взаимодействия с UI:
- `BookPage` — основная страница книги
- `SettingsPanel` — панель настроек

---

## Технические особенности

### Производительность
- **LRU-кэш** для распарсенных страниц (лимит: 50 страниц)
- **Double buffering** для плавных переходов
- **GPU-ускоренные** CSS 3D-трансформации
- **Debounce** обработки resize

### PWA (Progressive Web App)
- **Service Worker** с автообновлением (Workbox)
- **Офлайн-доступ** — предкэширование JS, CSS, HTML, шрифтов
- **Runtime-кэширование** изображений (30 дней, до 60 записей) и аудио (30 дней, до 15 записей)
- **Установка** как нативное приложение на десктопе и мобильных устройствах
- **Иконки** — SVG, PNG 192px, PNG 512px, maskable 512px

### Качество кода
- Чистая архитектура с разделением ответственности
- Автоматическая очистка event listeners и таймеров
- Централизованная обработка ошибок
- JSDoc-документация

### Безопасность
- XSS-защита через `HTMLSanitizer`
- Загрузка контента только с того же origin

### Content Security Policy (CSP)

Рекомендуемые HTTP-заголовки безопасности для production-деплоя:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: blob:;
  font-src 'self' https://fonts.gstatic.com data:;
  media-src 'self' data:;
  connect-src 'self';
  object-src 'none';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'none'
```

| Директива | Значение | Причина |
|-----------|----------|---------|
| `script-src 'self'` | Только свои скрипты | ES Modules, нет inline-скриптов |
| `style-src 'self' 'unsafe-inline' fonts.googleapis.com` | Свои + inline + Google Fonts CSS | CSS custom properties в JS + системные шрифты |
| `img-src 'self' data: blob:` | Свои + data URI + blob | WebP фоны + base64 + blob-объекты |
| `font-src 'self' fonts.gstatic.com data:` | Свои + Google Fonts файлы + data URI | Системные и кастомные шрифты |
| `media-src 'self' data:` | Свои + data URI | MP3 звуки страниц и ambient |
| `object-src 'none'` | Запрет плагинов | Защита от Flash/Java |
| `frame-ancestors 'none'` | Запрет iframe | Защита от clickjacking |

#### Настройка для хостингов

<details>
<summary><b>Netlify</b> (_headers файл)</summary>

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' https://fonts.gstatic.com data:; media-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
```

</details>

<details>
<summary><b>Vercel</b> (vercel.json)</summary>

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' https://fonts.gstatic.com data:; media-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'"
        },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

</details>

<details>
<summary><b>Nginx</b></summary>

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' https://fonts.gstatic.com data:; media-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

</details>

---

## Зависимости

### Runtime
- **jszip** `^3.10.1` — ZIP-операции (экспорт конфига, парсинг docx/epub)

### Dev Dependencies (ключевые)
- **vite** `^5.0.0` — Бандлер
- **vitest** `^4.0.18` — Юнит/интеграционное тестирование
- **@playwright/test** `^1.58.1` — E2E-тестирование
- **eslint** `^9.39.2` — Линтинг JS
- **stylelint** `^17.1.1` — Линтинг CSS
- **sharp** `^0.34.5` — Обработка изображений (генерация иконок)
- **vite-plugin-pwa** `^1.2.0` — PWA/Service Worker

---

## Управление

| Клавиша | Действие |
|---------|----------|
| `←` / `→` | Предыдущая / следующая страница |
| `Home` | В начало книги |
| `End` | В конец книги |
| `Ctrl+D` | Панель отладки (dev) |

---

## Требования

- Node.js >= 18.0.0
- npm >= 9.0.0
- Современный браузер (ES Modules, CSS 3D Transforms)
- Для E2E-тестов: Playwright (устанавливается автоматически)

---

## Лицензия

MIT © [Ekaterina Yashina](https://github.com/eka-jashina)
