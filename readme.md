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
- **Персонализация** — выбор шрифта, размера текста, темы оформления
- **Ambient-звуки** — фоновая атмосфера (дождь, камин, кафе)
- **Адаптивный дизайн** — корректная работа на десктопе и мобильных устройствах
- **Сохранение прогресса** — автоматическое запоминание позиции чтения
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
├── js/
│   ├── index.js                    # Точка входа
│   ├── config.js                   # Конфигурация глав, шрифтов, звуков
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
│   │   └── ScreenReaderAnnouncer.js # Анонсы для скринридеров
│   │
│   ├── managers/                   # Бизнес-логика и данные
│   │   ├── BookStateMachine.js     # Конечный автомат состояний
│   │   ├── SettingsManager.js      # Персистентные настройки (localStorage)
│   │   ├── ContentLoader.js        # Загрузка HTML-контента глав
│   │   ├── AsyncPaginator.js       # CSS multi-column пагинация
│   │   └── BackgroundManager.js    # Кроссфейд фонов глав
│   │
│   └── core/                       # Ядро приложения
│       ├── BookController.js       # Главный координатор (DI-контейнер)
│       ├── ComponentFactory.js     # Фабрика компонентов
│       ├── DOMManager.js           # Централизованный доступ к DOM
│       ├── BookRenderer.js         # Рендеринг страниц (double buffering)
│       ├── BookAnimator.js         # Оркестрация CSS-анимаций
│       ├── EventController.js      # Обработка пользовательского ввода
│       ├── LoadingIndicator.js     # UI индикатора загрузки
│       ├── DebugPanel.js           # Панель отладки (dev)
│       ├── AppInitializer.js       # Инициализация приложения
│       ├── SubscriptionManager.js  # Управление подписками на события
│       ├── ResizeHandler.js        # Обработка изменения размера окна
│       │
│       ├── services/               # Сервисные группы (DI)
│       │   ├── CoreServices.js         # DOM, события, таймеры, storage
│       │   ├── AudioServices.js        # Звуки и ambient
│       │   ├── RenderServices.js       # Рендеринг и анимации
│       │   └── ContentServices.js      # Загрузка и пагинация контента
│       │
│       └── delegates/              # Делегаты по доменам
│           ├── BaseDelegate.js         # Абстрактный базовый класс
│           ├── NavigationDelegate.js   # Логика перелистывания
│           ├── DragDelegate.js         # Touch-перетаскивание страниц
│           ├── DragAnimator.js         # Анимация угла поворота при drag
│           ├── DragShadowRenderer.js   # Рендеринг теней при drag
│           ├── SettingsDelegate.js     # UI настроек
│           ├── ChapterDelegate.js      # Переключение глав
│           └── LifecycleDelegate.js    # Открытие/закрытие книги
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
│   ├── responsive.css              # Адаптивность
│   └── controls/                   # Стили UI-контролов
│       ├── index.css               # Входная точка + общие стили
│       ├── pod-variables.css       # CSS-переменные контролов
│       ├── navigation-pod.css      # Навигация и прогресс-бар
│       ├── settings-pod.css        # Панель настроек
│       └── audio-pod.css           # Аудио-контролы
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
    │   └── core/                   # Тесты ядра
    ├── integration/                # Интеграционные тесты (Vitest)
    │   ├── smoke.test.js           # Smoke-тесты
    │   ├── flows/                  # Тесты пользовательских сценариев
    │   │   ├── navigation.test.js  # Навигация по страницам
    │   │   ├── settings.test.js    # Работа с настройками
    │   │   ├── chapters.test.js    # Переключение глав
    │   │   ├── drag.test.js        # Drag-взаимодействие
    │   │   └── events.test.js      # Обработка событий
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
        │   └── responsive.spec.js  # Адаптивность
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
| **DragDelegate** | `core/delegates/DragDelegate.js` | Touch-перетаскивание страниц |
| **DragAnimator** | `core/delegates/DragAnimator.js` | Анимация угла поворота при drag |
| **DragShadowRenderer** | `core/delegates/DragShadowRenderer.js` | Рендеринг теней при drag |
| **CoreServices** | `core/services/CoreServices.js` | Группа: DOM, события, таймеры, storage |
| **AudioServices** | `core/services/AudioServices.js` | Группа: звуки и ambient |
| **RenderServices** | `core/services/RenderServices.js` | Группа: рендеринг и анимации |
| **ContentServices** | `core/services/ContentServices.js` | Группа: загрузка и пагинация |
| **InstallPrompt** | `utils/InstallPrompt.js` | PWA-промпт установки приложения |
| **OfflineIndicator** | `utils/OfflineIndicator.js` | Индикатор офлайн-режима |
| **ScreenReaderAnnouncer** | `utils/ScreenReaderAnnouncer.js` | Анонсы для скринридеров (a11y) |
| **RateLimiter** | `utils/RateLimiter.js` | Ограничение частоты вызовов |

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
- **LRU-кэш** для распарсенных страниц (лимит: 12 страниц)
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
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  font-src 'self';
  media-src 'self';
  connect-src 'self';
  object-src 'none';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self'
```

| Директива | Значение | Причина |
|-----------|----------|---------|
| `script-src 'self'` | Только свои скрипты | ES Modules, нет inline-скриптов |
| `style-src 'self' 'unsafe-inline'` | Свои + inline | CSS custom properties в JS |
| `img-src 'self' data:` | Свои + data URI | WebP фоны + возможные base64 |
| `media-src 'self'` | Только свои | MP3 звуки страниц и ambient |
| `object-src 'none'` | Запрет плагинов | Защита от Flash/Java |
| `frame-ancestors 'none'` | Запрет iframe | Защита от clickjacking |

#### Настройка для хостингов

<details>
<summary><b>Netlify</b> (_headers файл)</summary>

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
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
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
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
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

</details>

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
