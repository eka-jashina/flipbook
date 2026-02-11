# Code Review & Refactoring Plan

## Общая оценка

| Категория | Оценка | Комментарий |
|-----------|--------|-------------|
| Архитектура | 8.5/10 | DI, делегаты, стейт-машина — сильная основа |
| Организация кода | 8/10 | Чёткая структура, но крупные файлы нуждаются в разделении |
| Производительность | 9/10 | LRU-кэш, double buffering, RAF-троттлинг, async pagination |
| Тестирование | 7/10 | Хорошее покрытие utils/managers, пробелы в delegates/services/admin |
| Безопасность | 9.5/10 | HTMLSanitizer, CSP, нет eval() |
| Поддерживаемость | 7.5/10 | Хорошие паттерны, но некоторые файлы перегружены |
| Типизация | 6.5/10 | JSDoc хорош, но не enforced — TypeScript улучшил бы ситуацию |

**Вердикт:** Кодовая база хорошего продакшн-качества. Vanilla JS enterprise-уровня, без критических архитектурных проблем. Рефакторинг не срочный, но повысит поддерживаемость.

---

## 1. Критические проблемы (баги / потенциальные ошибки)

### 1.1 LRUCache — отсутствует проверка на пустой Map
**Файл:** `js/utils/LRUCache.js:61-63`

```javascript
if (this.cache.size >= this.limit) {
  const firstKey = this.cache.keys().next().value;
  this.cache.delete(firstKey);  // firstKey может быть undefined
}
```

**Исправление:** Добавить guard `if (firstKey !== undefined)`.

### 1.2 EventListenerManager — неполный ключ опций
**Файл:** `js/utils/EventListenerManager.js:20-24`

`_createKey()` использует только `capture` для ключа, игнорируя `passive` и `once`. Это может привести к тому, что `removeEventListener` не найдёт нужный listener при разных опциях.

### 1.3 DragDelegate — нет обработки ошибок в animate()
**Файл:** `js/core/delegates/DragDelegate.js:287-302`

Если `dragAnimator.animate()` бросит исключение до вызова `onComplete`, состояние останется неконсистентным. Нужен try-catch.

### 1.4 MediaQueryManager — утечка слушателей
**Файл:** `js/utils/MediaQueryManager.js:31-34`

`register()` создаёт event listener, но нет `unregister()`. Повторные вызовы `register()` с тем же именем создают дублирующие обработчики.

---

## 2. Рефакторинг: SettingsDelegate (HIGH PRIORITY)

**Проблема:** God Object — 509 строк, 9 обработчиков, нарушение SRP.

Текущий `SettingsDelegate` управляет:
- Загрузкой шрифтов (FontFace API)
- Переключением тем
- Настройками звука
- Ambient-аудио
- Полноэкранным режимом
- Заполнением UI
- Appearance-конфигурацией

**План разделения:**

```
SettingsDelegate.js (509 LOC)
  ├── SettingsDelegate.js (~150 LOC) — роутинг handleChange + координация
  ├── FontSettingsHandler.js (~120 LOC) — шрифты, размеры, загрузка custom fonts
  ├── ThemeSettingsHandler.js (~80 LOC) — темы, appearance, CSS variables
  └── AudioSettingsHandler.js (~80 LOC) — звук, ambient, громкость
```

**Дополнительно:**
- Вынести hardcoded маппинги (`fontNames`, `themeNames`) в `CONFIG`
- Кэшировать `this.dom.get("html")` — сейчас вызывается 6 раз в разных методах
- Заменить `console.warn/error` на `ErrorHandler.handle()`
- Добавить проверку `isDestroyed` перед выполнением `.then()` от `_registerFont()`

---

## 3. Рефакторинг: EventController (MEDIUM PRIORITY)

**Проблема:** 420 строк, монолитный event hub.

**План:**
- Выделить `NavigationBindings`, `SettingsBindings`, `KeyboardBindings` (<100 LOC каждый)
- Каждый модуль — независимо тестируемый
- EventController остаётся координатором

---

## 4. Рефакторинг: Config.js (MEDIUM PRIORITY)

**Проблема:** 318 строк, смешение функций-строителей и экспортов.

**План:**
- Объединить `resolveAssetPath`, `resolveCoverBg`, `resolveSound` в одну универсальную функцию
- Вынести `buildFontsConfig`/`buildAmbientConfig` в отдельный `configBuilders.js`
- Оставить в `config.js` только финальные экспорты

---

## 5. Рефакторинг: LifecycleDelegate (LOW PRIORITY)

**Проблема:** 384 строки, смешение открытия книги, загрузки контента, пагинации и ambient-инициализации.

**План:**
- Выделить логику пагинации в `PaginationController`
- Отделить загрузку контента от lifecycle-управления

---

## 6. Стандартизация обработки ошибок

**Текущее состояние:** Смешение подходов — `ErrorHandler`, `console.error`, `.catch(() => {})`, `try/catch`.

**План:**
- Все delegates → `ErrorHandler.handle(error, context)`
- Убрать голые `console.warn/error` (42 вызова по кодовой базе)
- Стандартизировать: async методы используют `try/catch`, промисы — `.catch()`
- Не глотать ошибки молча (`BackgroundManager.js:144`, `AmbientManager.js:201`)

---

## 7. Устранение дублирования кода

### 7.1 Fade In/Out (AmbientManager.js)
`_fadeIn()` (22 строки) и `_fadeOut()` (25 строк) почти идентичны. Объединить в `_fade(targetVolume)`.

### 7.2 Загрузка аудио (SoundManager + AmbientManager)
Оба содержат одинаковую логику: timeout + canplaythrough/error. Извлечь `_loadAudioWithTimeout()`.

### 7.3 Promise-обёртки setTimeout
`ContentLoader._delay()` и `AsyncPaginator._yieldToUI()` — дублирование. Вынести в общую утилиту.

### 7.4 Валидация в делегатах
Шаблон `_validateRequiredDependencies()` повторяется в 5 делегатах. Перенести валидацию в конструктор `BaseDelegate`.

---

## 8. Магические числа → константы

| Значение | Где | Куда |
|----------|-----|------|
| `swipeVerticalLimit = 30` | EventController | `CONFIG.UI.SWIPE_VERTICAL_LIMIT` |
| Debounce delays (100, 300ms) | Разные файлы | `CONFIG.TIMING.DEBOUNCE_*` |
| AsyncPaginator фазы ("sanitize", "parse", "layout"...) | AsyncPaginator | `PaginationPhase` enum (как `BookState`) |
| Border-radius (4px, 8px, 12px) | CSS-файлы | `--radius-sm`, `--radius-md`, `--radius-lg` |
| Box-shadow значения | CSS-файлы | `--shadow-sm`, `--shadow-md`, `--shadow-lg` |

---

## 9. Тестирование: пробелы в покрытии

### Текущее покрытие
```
Utils:           15/18 (83%)
Managers:         5/5 (100%)
Core:             8/12 (67%)
Delegates:        7/9 (78%)
Services:         0/4 (0%)   ← критический пробел
Admin modules:    2/10 (20%) ← критический пробел
```

### План по приоритету

**P0 — Service layer (0% покрытие):**
- `CoreServices.js` — unit-тест инициализации
- `RenderServices.js` — unit-тест создания renderer/animator
- `AudioServices.js` — unit-тест звуковых сервисов
- `ContentServices.js` — unit-тест загрузки контента

**P1 — Delegates:**
- Изолированные unit-тесты для `NavigationDelegate`, `DragDelegate`, `LifecycleDelegate`
- Покрытие state transitions, error cases, cleanup

**P2 — Admin modules:**
- Тесты для `ChaptersModule`, `AppearanceModule`, `ExportModule`
- Хотя бы smoke-тесты для остальных 5 модулей

**P3 — Integration:**
- Multi-chapter navigation с repagination
- Full drag sequence (start → move → end)
- Admin workflows (upload, edit appearance, export)

---

## 10. CSS: улучшения

### 10.1 Крупные файлы
- `bookshelf.css` (490 строк) → разделить на layout, 3D-стили, анимации полок
- `photo-album.css` (343 строки) → выделить grid-шаблоны
- `settings-pod.css` (323 строки) → модуляризировать по секциям

### 10.2 Design tokens
В `variables.css` добавить:
```css
:root {
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.1);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.15);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.2);
}
```

### 10.3 Admin CSS
Admin CSS (1,715 строк) должен наследовать от основного и только расширять, а не переопределять base-стили.

---

## 11. Паттерн use-after-destroy

**Проблема:** После вызова `destroy()` публичные методы делегатов всё ещё вызываемы без ошибок.

**Решение:** Добавить в `BaseDelegate`:
```javascript
_ensureAlive() {
  if (this.isDestroyed) {
    throw new Error(`${this.constructor.name}: method called after destroy`);
  }
}
```

Вызывать в начале всех публичных методов.

---

## 12. Консистентность паттерна BaseDelegate

**Проблема:** `DragDOMPreparer`, `DragAnimator`, `DragShadowRenderer` не наследуют `BaseDelegate` и принимают аргументы напрямую, а не через `deps` объект.

**Варианты:**
1. Привести к общему паттерну с `BaseDelegate`
2. Переименовать в `*Service` / `*Helper` для ясности
3. Задокументировать причину отличия

---

## Порядок выполнения

### Фаза 1: Исправление багов
1. [ ] LRUCache guard для пустого Map
2. [ ] EventListenerManager — учитывать все options в ключе
3. [ ] DragDelegate — try-catch вокруг animate()
4. [ ] MediaQueryManager — добавить unregister()

### Фаза 2: Основной рефакторинг
5. [ ] Разделить SettingsDelegate на 4 модуля
6. [ ] Стандартизировать error handling → ErrorHandler
7. [ ] Устранить дублирование (fade, audio load, promise wrappers)
8. [ ] Магические числа → CONFIG / CSS variables

### Фаза 3: EventController и Config
9. [ ] Разделить EventController на focused bindings
10. [ ] Рефакторинг Config.js — объединить builder-функции

### Фаза 4: Тестирование
11. [ ] Unit-тесты для 4 Service-модулей
12. [ ] Unit-тесты для ключевых delegates
13. [ ] Smoke-тесты для admin-модулей

### Фаза 5: CSS и polish
14. [ ] Design tokens для border-radius / shadow
15. [ ] Разделение крупных CSS-файлов
16. [ ] Консолидация admin CSS

---

*Сгенерировано на основе полного code review кодовой базы flipbook.*
