# Book Reader — Модульная архитектура

Интерактивная читалка книг с анимацией переворота страниц.

## Структура проекта

```
book-reader/
├── index.html              # Главный HTML файл
├── README.md               # Этот файл
│
├── css/                    # CSS модули
│   ├── index.css           # Главный файл (импортирует все модули)
│   ├── variables.css       # CSS Custom Properties (тайминги, цвета, размеры)
│   ├── reset.css           # Сброс стилей
│   ├── themes.css          # Тёмная и ч/б темы
│   ├── layout.css          # Базовая раскладка
│   ├── book.css            # Стили контейнера книги
│   ├── pages.css           # Стили статических страниц
│   ├── cover.css           # Стили обложки
│   ├── sheet.css           # Стили анимированного листа
│   ├── typography.css      # Типографика
│   ├── controls.css        # Панель управления
│   ├── loading.css         # Индикатор загрузки
│   ├── debug.css           # Панель отладки
│   ├── animations.css      # Keyframe анимации
│   └── responsive.css      # Адаптивные стили
│
├── js/                     # JavaScript модули
│   ├── index.js            # Точка входа
│   ├── config.js           # Конфигурация и константы
│   │
│   ├── utils/              # Утилиты
│   │   ├── index.js        # Реэкспорт утилит
│   │   ├── CSSVariables.js # Чтение CSS переменных
│   │   ├── MediaQueryManager.js # Реактивные media queries
│   │   ├── EventEmitter.js # Паттерн Observer
│   │   ├── EventListenerManager.js # Управление listeners
│   │   ├── TimerManager.js # Управление таймерами
│   │   ├── LRUCache.js     # LRU кэш для страниц
│   │   ├── TransitionHelper.js # Ожидание CSS transitions
│   │   ├── HTMLSanitizer.js # Защита от XSS
│   │   ├── ErrorHandler.js # Обработка ошибок
│   │   └── StorageManager.js # localStorage абстракция
│   │
│   ├── managers/           # Менеджеры данных
│   │   ├── index.js        # Реэкспорт менеджеров
│   │   ├── BookStateMachine.js # Конечный автомат состояний
│   │   ├── SettingsManager.js # Управление настройками
│   │   ├── BackgroundManager.js # Фоны глав
│   │   ├── ContentLoader.js # Загрузка HTML контента
│   │   └── AsyncPaginator.js # Асинхронная пагинация
│   │
│   └── core/               # Ядро приложения
│       ├── index.js        # Реэкспорт компонентов
│       ├── BookController.js # Главный координатор
│       ├── BookRenderer.js # Рендеринг страниц
│       ├── BookAnimator.js # CSS анимации
│       ├── EventController.js # Обработка событий
│       ├── LoadingIndicator.js # Индикатор загрузки
│       └── DebugPanel.js   # Панель отладки
│
├── content/                # HTML контент глав
│   ├── part_1.html
│   ├── part_2.html
│   └── part_3.html
│
└── images/                 # Изображения (опционально)
    └── backgrounds/        # Фоны для глав
```

## Архитектура

### Паттерны

1. **State Machine** — управление состояниями книги (CLOSED → OPENING → OPENED → FLIPPING)
2. **Observer** — EventEmitter для связи между компонентами
3. **Single Source of Truth** — CSS Custom Properties для всех настраиваемых значений
4. **Double Buffering** — две пары страниц для плавных переходов
5. **LRU Cache** — кэширование распарсенных страниц

### Поток данных

```
User Input → EventController → BookController → Components
                                    ↓
                              StateMachine
                                    ↓
                         BookAnimator / BookRenderer
                                    ↓
                                  DOM
```

### Компоненты

| Компонент | Ответственность |
|-----------|-----------------|
| `BookStateMachine` | Валидация переходов между состояниями |
| `BookRenderer` | Рендеринг страниц, управление буферами |
| `BookAnimator` | CSS анимации (lift → rotate → drop) |
| `AsyncPaginator` | Разбивка контента на страницы |
| `EventController` | Обработка кликов, свайпов, клавиатуры |
| `SettingsManager` | Персистентные настройки |
| `BackgroundManager` | Кроссфейд фонов глав |

## Использование

### Базовый запуск

```bash
# Любой статический сервер
npx serve .
# или
python -m http.server 8000
```

### Конфигурация

Настройки в `js/config.js`:

```javascript
export const CONFIG = {
  CHAPTERS: [
    { id: "ch1", file: "content/ch1.html", bg: "images/bg1.webp" },
    // ...
  ],
  FONTS: {
    georgia: "Georgia, serif",
    // ...
  },
  // ...
};
```

### CSS переменные

Все тайминги и размеры настраиваются в `styles/variables.css`:

```css
:root {
  --timing-rotate: 800ms;    /* Скорость переворота */
  --font-default: 18px;      /* Размер шрифта */
  --swipe-threshold: 20px;   /* Чувствительность свайпа */
}
```

## Клавиатурные сочетания

| Клавиша | Действие |
|---------|----------|
| `←` / `→` | Предыдущая / следующая страница |
| `Home` | К началу |
| `End` | В конец |
| `Ctrl+D` | Панель отладки |

## Требования

- Современный браузер с поддержкой ES Modules
- CSS Custom Properties
- CSS Multi-column Layout

## Лицензия

MIT
