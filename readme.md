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
│   │   ├── HTMLSanitizer.js        # Защита от XSS
│   │   ├── SoundManager.js         # Управление звуковыми эффектами
│   │   ├── AmbientManager.js       # Фоновые ambient-звуки
│   │   └── ...
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
│       ├── AppInitializer.js       # Инициализация приложения
│       ├── SubscriptionManager.js  # Управление подписками на события
│       ├── ResizeHandler.js        # Обработка изменения размера окна
│       │
│       └── delegates/              # Делегаты по доменам
│           ├── BaseDelegate.js     # Абстрактный базовый класс
│           ├── NavigationDelegate.js   # Логика перелистывания
│           ├── DragDelegate.js     # Touch-перетаскивание страниц
│           ├── SettingsDelegate.js # UI настроек
│           ├── ChapterDelegate.js  # Переключение глав
│           └── LifecycleDelegate.js    # Открытие/закрытие книги
│
├── css/                            # Модульная CSS-архитектура
│   ├── index.css                   # Входная точка (импорты)
│   ├── variables.css               # Design tokens (CSS Custom Properties)
│   ├── themes.css                  # Светлая / тёмная / ч/б темы
│   ├── book.css                    # 3D-контейнер книги
│   ├── sheet.css                   # Анимированный лист
│   ├── animations.css              # Keyframe-анимации
│   ├── drag.css                    # Стили drag-взаимодействия
│   └── responsive.css              # Адаптивность
│
└── public/                         # Статические ресурсы
    ├── content/                    # HTML-контент глав
    ├── images/                     # Фоны и иллюстрации (.webp)
    ├── fonts/                      # Кастомные шрифты (.woff2)
    └── sounds/                     # Аудио (перелистывание, ambient)
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
| `npm run dev` | Запуск dev-сервера (порт 3000) |
| `npm run build` | Production-сборка в `dist/` |
| `npm run build:prod` | Полная очистка + сборка |
| `npm run preview` | Превью production-сборки |

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

---

## Технические особенности

### Производительность
- **LRU-кэш** для распарсенных страниц (лимит: 12 страниц)
- **Double buffering** для плавных переходов
- **GPU-ускоренные** CSS 3D-трансформации
- **Debounce** обработки resize

### Качество кода
- Чистая архитектура с разделением ответственности
- Автоматическая очистка event listeners и таймеров
- Централизованная обработка ошибок
- JSDoc-документация

### Безопасность
- XSS-защита через `HTMLSanitizer`
- Загрузка контента только с того же origin

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
- Современный браузер (ES Modules, CSS 3D Transforms)

---

## Лицензия

MIT © [Ekaterina Yashina](https://github.com/eka-jashina)
