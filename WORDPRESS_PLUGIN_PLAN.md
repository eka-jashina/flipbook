# Полный план конвертации Flipbook в WordPress-плагин

> Пошаговое руководство для тех, кто делает это впервые.

---

## Содержание

1. [Подготовка окружения](#1-подготовка-окружения)
2. [Создание структуры плагина](#2-создание-структуры-плагина)
3. [Главный файл плагина](#3-главный-файл-плагина)
4. [Сборка JS/CSS ассетов через Vite](#4-сборка-jscss-ассетов-через-vite)
5. [Адаптация JavaScript под WordPress](#5-адаптация-javascript-под-wordpress)
6. [Адаптация CSS под WordPress](#6-адаптация-css-под-wordpress)
7. [HTML-разметка: от index.html к PHP-шаблону](#7-html-разметка-от-indexhtml-к-php-шаблону)
8. [Custom Post Type для глав](#8-custom-post-type-для-глав)
9. [Страница настроек в админке](#9-страница-настроек-в-админке)
10. [Shortcode для вставки книги](#10-shortcode-для-вставки-книги)
11. [Gutenberg-блок (опционально)](#11-gutenberg-блок-опционально)
12. [Работа со статическими файлами](#12-работа-со-статическими-файлами)
13. [Безопасность](#13-безопасность)
14. [Решение типичных проблем совместимости](#14-решение-типичных-проблем-совместимости)
15. [Тестирование](#15-тестирование)
16. [Упаковка и распространение](#16-упаковка-и-распространение)

---

## 1. Подготовка окружения

### Что понадобится

| Инструмент | Зачем | Где взять |
|---|---|---|
| **Локальный WordPress** | Разработка и тестирование | [LocalWP](https://localwp.com/) (самый простой способ) или Docker |
| **Node.js >= 18** | Сборка JS/CSS ассетов | [nodejs.org](https://nodejs.org/) |
| **Текстовый редактор** | Код | VS Code, PhpStorm и т.д. |
| **PHP >= 7.4** | Серверная часть плагина | Входит в LocalWP |
| **Git** | Контроль версий | [git-scm.com](https://git-scm.com/) |

### Шаг за шагом

1. **Установи LocalWP**
   - Скачай с [localwp.com](https://localwp.com/), установи
   - Создай новый сайт: нажми «+» → выбери имя (напр. `flipbook-test`) → создай
   - Запомни путь к сайту, обычно: `~/Local Sites/flipbook-test/`

2. **Найди папку плагинов**
   ```
   ~/Local Sites/flipbook-test/app/public/wp-content/plugins/
   ```

3. **Создай папку плагина**
   ```bash
   cd ~/Local\ Sites/flipbook-test/app/public/wp-content/plugins/
   mkdir flipbook-reader
   cd flipbook-reader
   ```

4. **Инициализируй Git и npm**
   ```bash
   git init
   npm init -y
   ```

5. **Скопируй исходники Flipbook** в подпапку `src/`:
   ```bash
   mkdir src
   # Скопируй содержимое оригинального flipbook-проекта в src/
   cp -r /path/to/flipbook/js src/
   cp -r /path/to/flipbook/css src/
   cp -r /path/to/flipbook/public src/
   ```

---

## 2. Создание структуры плагина

```
flipbook-reader/                     ← Корень плагина
│
├── flipbook-reader.php              ← Главный файл плагина (точка входа)
├── uninstall.php                    ← Код очистки при удалении плагина
├── readme.txt                       ← Описание для WordPress.org
│
├── includes/                        ← PHP-логика
│   ├── class-flipbook-plugin.php    ← Главный класс плагина
│   ├── class-flipbook-cpt.php       ← Custom Post Type «Глава»
│   ├── class-flipbook-settings.php  ← Страница настроек в админке
│   ├── class-flipbook-shortcode.php ← Shortcode [flipbook]
│   ├── class-flipbook-assets.php    ← Подключение JS/CSS
│   └── class-flipbook-rest-api.php  ← REST API endpoints (опционально)
│
├── templates/                       ← PHP-шаблоны
│   └── flipbook-template.php        ← HTML-разметка книги (из index.html)
│
├── assets/                          ← Скомпилированные файлы (git-tracked)
│   ├── dist/                        ← Результат Vite build
│   │   ├── flipbook.js              ← Собранный JS-бандл
│   │   ├── flipbook.css             ← Собранный CSS
│   │   └── flipbook.asset.php       ← Зависимости (опционально)
│   ├── sounds/                      ← Аудиофайлы
│   │   ├── page-flip.mp3
│   │   ├── cover-flip.mp3
│   │   └── ambient/
│   │       ├── rain.mp3
│   │       ├── fireplace.mp3
│   │       └── cafe.mp3
│   ├── images/                      ← Фоны и иллюстрации
│   │   └── backgrounds/
│   ├── fonts/                       ← Шрифты
│   │   └── tolkiencyr.woff2
│   └── icons/                       ← Иконки (если нужны)
│
├── src/                             ← Исходники (НЕ поставляются пользователям)
│   ├── js/                          ← Оригинальные JS-модули (адаптированные)
│   ├── css/                         ← Оригинальные CSS-файлы (адаптированные)
│   └── entry.js                     ← Новая точка входа для WP
│
├── blocks/                          ← Gutenberg-блок (опционально)
│   └── flipbook/
│       ├── block.json
│       ├── edit.js
│       ├── save.js
│       └── index.js
│
├── languages/                       ← Переводы (i18n)
│   └── flipbook-reader-ru_RU.po
│
├── package.json                     ← Node.js зависимости
├── vite.config.js                   ← Конфиг сборки (адаптированный)
├── .gitignore
└── .editorconfig
```

### Зачем каждая папка

| Папка/Файл | Назначение |
|---|---|
| `flipbook-reader.php` | WordPress читает этот файл, чтобы распознать плагин |
| `includes/` | Вся PHP-логика, разбитая по классам (один класс = одна ответственность) |
| `templates/` | HTML-разметка, которая была в `index.html`, теперь в PHP-шаблоне |
| `assets/dist/` | Собранные JS/CSS файлы — именно их подключает WordPress |
| `src/` | Исходники JS/CSS для разработки — при публикации плагина их можно исключить |
| `blocks/` | Если захочешь добавить Gutenberg-блок для визуального редактора |
| `languages/` | Файлы переводов для интернационализации |

---

## 3. Главный файл плагина

Создай файл `flipbook-reader.php` в корне плагина. WordPress определяет плагин по специальному комментарию в начале файла.

### Что должен содержать файл

```php
<?php
/**
 * Plugin Name:       Flipbook Reader
 * Plugin URI:        https://github.com/your-username/flipbook-reader
 * Description:       Интерактивная 3D-читалка с реалистичной анимацией перелистывания страниц.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Your Name
 * Author URI:        https://your-site.com
 * License:           MIT
 * License URI:       https://opensource.org/licenses/MIT
 * Text Domain:       flipbook-reader
 * Domain Path:       /languages
 */

// Защита от прямого доступа к файлу (стандартная практика WP)
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}
```

### Объяснение комментариев

| Поле | Что делает |
|---|---|
| `Plugin Name` | Имя в списке плагинов WP |
| `Description` | Описание под именем |
| `Version` | Версия (для обновлений) |
| `Requires at least` | Минимальная версия WordPress |
| `Requires PHP` | Минимальная версия PHP |
| `Text Domain` | Идентификатор для переводов |
| `Domain Path` | Папка с файлами переводов |

### Константы плагина

```php
// Версия плагина — используется для кэш-бастинга CSS/JS
define( 'FLIPBOOK_VERSION', '1.0.0' );

// Абсолютный путь к папке плагина на сервере
// Пример: /var/www/html/wp-content/plugins/flipbook-reader/
define( 'FLIPBOOK_PATH', plugin_dir_path( __FILE__ ) );

// URL папки плагина (для подключения CSS/JS в браузере)
// Пример: https://example.com/wp-content/plugins/flipbook-reader/
define( 'FLIPBOOK_URL', plugin_dir_url( __FILE__ ) );

// Путь к собранным ассетам
define( 'FLIPBOOK_ASSETS_URL', FLIPBOOK_URL . 'assets/' );

// Базовое имя файла плагина (для хуков активации/деактивации)
define( 'FLIPBOOK_BASENAME', plugin_basename( __FILE__ ) );
```

### Зачем нужна каждая константа

- **`FLIPBOOK_PATH`** — чтобы подключать PHP-файлы через `require_once FLIPBOOK_PATH . 'includes/...'`
- **`FLIPBOOK_URL`** — чтобы подключать CSS/JS через `wp_enqueue_script(... FLIPBOOK_URL . 'assets/dist/...')`
- **`FLIPBOOK_VERSION`** — чтобы при обновлении плагина браузер загружал свежие файлы, а не кэшированные

### Подключение файлов и запуск

```php
// Подключение всех PHP-классов
require_once FLIPBOOK_PATH . 'includes/class-flipbook-plugin.php';
require_once FLIPBOOK_PATH . 'includes/class-flipbook-cpt.php';
require_once FLIPBOOK_PATH . 'includes/class-flipbook-settings.php';
require_once FLIPBOOK_PATH . 'includes/class-flipbook-shortcode.php';
require_once FLIPBOOK_PATH . 'includes/class-flipbook-assets.php';

// Запуск плагина
function flipbook_reader_init() {
    $plugin = new Flipbook_Plugin();
    $plugin->run();
}
add_action( 'plugins_loaded', 'flipbook_reader_init' );

// Хук активации — выполняется один раз при включении плагина
register_activation_hook( __FILE__, array( 'Flipbook_Plugin', 'activate' ) );

// Хук деактивации — при выключении плагина
register_deactivation_hook( __FILE__, array( 'Flipbook_Plugin', 'deactivate' ) );
```

### Что такое хуки WordPress (ключевое понятие)

**Хук** — это механизм, позволяющий «встроить» свой код в определённый момент работы WordPress. Два вида:
- **Action** (`add_action`) — «сделай что-то в этот момент». Пример: `plugins_loaded` — «когда все плагины загружены, запусти мой код».
- **Filter** (`add_filter`) — «измени данные, проходящие через эту точку». Пример: `the_content` — «измени содержимое поста перед выводом».

```
WordPress загружается
    ↓
Хук 'plugins_loaded' → тут запускается наш плагин
    ↓
Хук 'init' → тут регистрируется Custom Post Type
    ↓
Хук 'wp_enqueue_scripts' → тут подключаются CSS/JS
    ↓
Хук 'the_content' / Shortcode → тут выводится наша книга
    ↓
HTML отправляется в браузер
```

---

## 4. Сборка JS/CSS ассетов через Vite

### Проблема

Оригинальный проект использует Vite для dev-сервера и сборки. WordPress не имеет встроенной поддержки Vite. Нужно адаптировать сборку так, чтобы результат подключался через WordPress.

### Что нужно изменить в Vite-конфиге

Создай **новый** `vite.config.js` в корне плагина (не путать с оригинальным):

```javascript
// flipbook-reader/vite.config.js

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Убираем dev-server — он не нужен для WP-плагина
  // (используем WP-сервер через LocalWP)

  build: {
    // Куда складывать результат сборки
    outDir: resolve(__dirname, 'assets/dist'),

    // НЕ очищать папку (там могут быть другие файлы)
    emptyOutDir: true,

    // Формат бандла
    lib: {
      // Точка входа — наш адаптированный файл
      entry: resolve(__dirname, 'src/entry.js'),
      // Имя глобальной переменной (на случай UMD-сборки)
      name: 'FlipbookReader',
      // Формат файлов
      formats: ['iife'], // IIFE — самый простой для WordPress
      // Имя выходного файла
      fileName: () => 'flipbook.js',
    },

    rollupOptions: {
      output: {
        // CSS будет в отдельном файле
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'flipbook.css';
          }
          return '[name][extname]';
        },
      },
    },

    // Минификация
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Оставляем console для отладки (уберём в продакшене)
        drop_debugger: true,
      },
    },

    // Source maps для отладки (отключи в продакшене)
    sourcemap: true,
  },

  // Алиасы путей (такие же, как в оригинале)
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/js'),
      '@utils': resolve(__dirname, 'src/js/utils'),
      '@managers': resolve(__dirname, 'src/js/managers'),
      '@core': resolve(__dirname, 'src/js/core'),
      '@css': resolve(__dirname, 'src/css'),
    },
  },
});
```

### Почему IIFE, а не ES Modules

WordPress подключает скрипты через `<script src="...">` (без `type="module"`). Формат IIFE (Immediately Invoked Function Expression) оборачивает весь код в самовызывающуюся функцию — он работает как обычный `<script>` и не загрязняет глобальную область видимости.

```javascript
// ES Module (оригинал) — требует type="module"
import { BookController } from './core/BookController.js';

// IIFE (для WordPress) — работает как обычный <script>
(function() {
  // Весь код внутри, ничего не утекает наружу
  var BookController = /* ... */;
})();
```

### Скрипты в package.json

```json
{
  "scripts": {
    "build": "vite build",
    "watch": "vite build --watch",
    "dev": "vite build --watch --sourcemap"
  }
}
```

### Рабочий процесс разработки

```bash
# Терминал 1: запущен LocalWP (WordPress-сервер)
# Терминал 2:
cd ~/Local\ Sites/flipbook-test/app/public/wp-content/plugins/flipbook-reader/
npm run watch
# Vite автоматически пересобирает при изменениях
# Обновляешь страницу WordPress в браузере — видишь результат
```

---

## 5. Адаптация JavaScript под WordPress

### Создание новой точки входа

Оригинальный `js/index.js` делает три вещи, которые не нужны в WordPress:
1. Регистрация Service Worker (PWA) — **убираем**
2. Кнопка установки PWA — **убираем**
3. Инициализация BookController — **оставляем, адаптируем**

Создай файл `src/entry.js`:

```javascript
// src/entry.js — Точка входа для WordPress-версии

// Импортируем стили (Vite соберёт их в отдельный CSS-файл)
import './css/index.css';

// Импортируем главный контроллер
import { BookController } from './js/core/BookController.js';

// WordPress передаст настройки через wp_localize_script
// Они будут доступны как глобальная переменная
const wpConfig = window.flipbookConfig || {};

let app = null;

async function init() {
  try {
    app = new BookController(wpConfig);
    await app.init();
  } catch (error) {
    console.error('[Flipbook] Initialization failed:', error);
  }
}

function cleanup() {
  if (app) {
    app.destroy();
    app = null;
  }
}

// Инициализация когда DOM готов
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.addEventListener('beforeunload', cleanup);
```

### Адаптация config.js

Оригинальный `config.js` использует `import.meta.env.BASE_URL` (Vite) для путей. В WordPress пути к файлам другие и задаются из PHP.

**Изменения в `src/js/config.js`:**

```javascript
// БЫЛО (Vite):
const BASE_URL = import.meta.env.BASE_URL || '/';

// СТАЛО (WordPress):
// WordPress передаёт базовый URL через wp_localize_script
const BASE_URL = (window.flipbookConfig && window.flipbookConfig.baseUrl) || '/';
```

### Что такое wp_localize_script

Это способ передать данные из PHP (сервер) в JavaScript (браузер). WordPress создаёт глобальную JS-переменную с объектом данных.

**PHP-сторона:**
```php
wp_localize_script('flipbook-js', 'flipbookConfig', array(
    'baseUrl'  => FLIPBOOK_ASSETS_URL,
    'ajaxUrl'  => admin_url('admin-ajax.php'),
    'nonce'    => wp_create_nonce('flipbook_nonce'),
    'chapters' => $chapters_data, // Массив глав из БД
    'settings' => $settings,      // Настройки из админки
));
```

**JS-сторона:**
```javascript
// WordPress автоматически создаст:
// window.flipbookConfig = { baseUrl: '...', ajaxUrl: '...', ... }
console.log(flipbookConfig.baseUrl);
// → "https://example.com/wp-content/plugins/flipbook-reader/assets/"
```

### Адаптация ContentLoader.js

Оригинальный ContentLoader загружает главы из статических HTML-файлов (`/content/part_1.html`). В WordPress контент хранится в базе данных как Custom Post Type.

**Два подхода (выбери один):**

#### Подход A: REST API (рекомендуется)

Главы загружаются через WordPress REST API.

```javascript
// Адаптированный ContentLoader
async _fetchWithRetry(url, signal) {
  // url теперь будет вида:
  // /wp-json/flipbook/v1/chapter/part_1
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return data.content; // HTML-контент главы
}
```

**PHP-сторона (REST endpoint):**
```php
// includes/class-flipbook-rest-api.php
register_rest_route('flipbook/v1', '/chapter/(?P<id>[a-z0-9_-]+)', array(
    'methods'  => 'GET',
    'callback' => function($request) {
        $chapter_id = $request['id'];
        // Получаем пост по slug
        $post = get_page_by_path($chapter_id, OBJECT, 'flipbook_chapter');
        if (!$post) {
            return new WP_Error('not_found', 'Chapter not found', array('status' => 404));
        }
        return array(
            'id'      => $post->post_name,
            'title'   => $post->post_title,
            'content' => apply_filters('the_content', $post->post_content),
        );
    },
    'permission_callback' => '__return_true', // Публичный endpoint
));
```

#### Подход B: Inline-данные (проще, но не масштабируется)

Весь контент встраивается в HTML при загрузке страницы.

```php
// В PHP-шаблоне:
<script>
window.flipbookChapters = <?php echo json_encode($chapters_html); ?>;
</script>
```

```javascript
// В JS:
const content = window.flipbookChapters[chapterId];
```

**Рекомендация:** Используй Подход A (REST API) — он масштабируется, контент подгружается по запросу, страница грузится быстрее.

### Адаптация SettingsManager.js

Оригинал хранит настройки в `localStorage`. Для WordPress есть два варианта:

| | localStorage (оставить как есть) | WordPress user meta |
|---|---|---|
| **Плюсы** | Просто, работает без изменений | Синхронизация между устройствами |
| **Минусы** | Нет синхронизации между устройствами | Нужен AJAX, работает только для авторизованных |
| **Когда использовать** | Для гостевых посетителей | Для авторизованных пользователей |

**Рекомендация:** Оставь `localStorage` как есть — это самое простое решение, и оно уже работает. Синхронизацию через `user_meta` можно добавить позже.

### Удаление PWA-функциональности

Следующие файлы и импорты нужно **убрать** из WordPress-версии, т.к. PWA — ответственность всего сайта, а не плагина:

- Удалить импорт `virtual:pwa-register` из entry.js
- Удалить `InstallPrompt.js` (или не импортировать)
- Удалить `OfflineIndicator.js` (или не импортировать)
- Убрать `vite-plugin-pwa` из vite.config.js
- Убрать Service Worker регистрацию

---

## 6. Адаптация CSS под WordPress

### Проблема конфликтов

WordPress-тема уже имеет свои стили. Ваши стили могут конфликтовать:
- Тема может переопределить `body`, `p`, `h1` — и сломать внешний вид книги
- Ваш `reset.css` может сломать стили темы
- Общие CSS-классы (`.container`, `.wrapper`) могут конфликтовать

### Решение: CSS-префиксы (Namespace)

**Шаг 1.** Оберни весь HTML книги в контейнер с уникальным классом:

```html
<div class="flipbook-reader">
  <!-- Вся разметка книги внутри -->
</div>
```

**Шаг 2.** Оберни все CSS-правила в этот контейнер:

```css
/* БЫЛО: */
.book { perspective: 1600px; }
.page { background: #fff; }

/* СТАЛО: */
.flipbook-reader .book { perspective: 1600px; }
.flipbook-reader .page { background: #fff; }
```

**Автоматизация:** Можно использовать PostCSS-плагин `postcss-prefix-selector`:

```bash
npm install -D postcss-prefix-selector
```

```javascript
// postcss.config.js
module.exports = {
  plugins: [
    require('postcss-prefix-selector')({
      prefix: '.flipbook-reader',
      // Не применять к :root (нужен для CSS-переменных)
      exclude: [':root', '[data-theme]', '@keyframes', '@font-face'],
    }),
    require('autoprefixer')(),
  ],
};
```

**Шаг 3.** CSS-переменные из `:root` перенеси в `.flipbook-reader`:

```css
/* БЫЛО: */
:root {
  --bg-book: #fdfcf8;
  --timing-rotate: 900ms;
}

/* СТАЛО: */
.flipbook-reader {
  --bg-book: #fdfcf8;
  --timing-rotate: 900ms;
}
```

Это изолирует переменные от остального сайта.

**Шаг 4.** Удали `reset.css` из WordPress-версии — WordPress уже имеет свой reset через тему. Вместо глобального reset'а добавь изолированный:

```css
.flipbook-reader {
  /* Сброс только внутри контейнера книги */
  box-sizing: border-box;
  line-height: 1.5;
  font-family: Georgia, serif;
}

.flipbook-reader *, .flipbook-reader *::before, .flipbook-reader *::after {
  box-sizing: inherit;
  margin: 0;
  padding: 0;
}
```

### Темы (data-theme)

Оригинал использует `[data-theme="dark"]` на `<body>`. В WordPress нельзя менять `<body>` — он принадлежит теме.

**Решение:** Ставь `data-theme` на контейнер `.flipbook-reader`:

```css
/* БЫЛО: */
[data-theme="dark"] { --bg-book: #1a1a1a; }

/* СТАЛО: */
.flipbook-reader[data-theme="dark"] { --bg-book: #1a1a1a; }
```

```javascript
// БЫЛО:
document.body.setAttribute('data-theme', theme);

// СТАЛО:
document.querySelector('.flipbook-reader').setAttribute('data-theme', theme);
```

---

## 7. HTML-разметка: от index.html к PHP-шаблону

### Что меняется

Оригинальный `index.html` — это полный HTML-документ (`<html>`, `<head>`, `<body>`). В WordPress этого не нужно — WordPress сам генерирует `<html>`, `<head>`, `<body>` через тему. Нам нужен только **фрагмент**, который вставляется внутрь страницы.

### Создание PHP-шаблона

Создай файл `templates/flipbook-template.php`. Перенеси туда содержимое `<body>` из `index.html`, убрав:

- `<!DOCTYPE html>`, `<html>`, `<head>`, `<body>` — уже есть в теме
- `<link>` для CSS — подключается через `wp_enqueue_style`
- `<script>` для JS — подключается через `wp_enqueue_script`
- `<meta>` теги — уже в теме
- Google Fonts `<link>` — подключим через `wp_enqueue_style`
- Preload-ссылки — подключим через `wp_head`

### Пример шаблона (с объяснениями)

```php
<?php
/**
 * Шаблон книги Flipbook.
 *
 * Этот файл вызывается из shortcode-обработчика.
 * Переменные $chapters и $settings передаются извне.
 *
 * @var array $chapters — список глав из Custom Post Type
 * @var array $settings — настройки из админки
 */

// Запрет прямого доступа
if ( ! defined( 'ABSPATH' ) ) exit;
?>

<div class="flipbook-reader" data-theme="light" data-debug="false">

  <!-- Фон главы (два слоя для плавной смены) -->
  <div class="chapter-bg" aria-hidden="true">
    <div class="bg" data-active="false"></div>
    <div class="bg" data-active="false"></div>
  </div>

  <!-- Сообщение об ошибке -->
  <div id="flipbook-errorMessage" class="error-message" hidden role="alert"></div>

  <!-- Анонсатор для скринридеров -->
  <div id="flipbook-sr-announcer" class="sr-only" aria-live="polite" aria-atomic="true"></div>

  <!-- Основная сцена -->
  <main class="scene">
    <div class="book-wrap" data-state="closed">
      <div class="book" role="region" aria-label="<?php esc_attr_e( 'Книга', 'flipbook-reader' ); ?>">

        <!-- Активные страницы (буфер A) -->
        <div id="flipbook-leftA" class="page page--left" data-active="true">
          <div class="page-inner" aria-live="polite"></div>
        </div>
        <div id="flipbook-rightA" class="page page--right" data-active="true">
          <div class="page-inner" aria-live="polite"></div>
        </div>

        <!-- Буферные страницы (буфер B) -->
        <div id="flipbook-leftB" class="page page--left" data-buffer="true">
          <div class="page-inner"></div>
        </div>
        <div id="flipbook-rightB" class="page page--right" data-buffer="true">
          <div class="page-inner"></div>
        </div>

        <!-- Анимированный лист -->
        <div id="flipbook-sheet" class="sheet">
          <div id="flipbook-sheetFront" class="sheet-side sheet-side--front">
            <div class="page-inner"></div>
          </div>
          <div id="flipbook-sheetBack" class="sheet-side sheet-side--back">
            <div class="page-inner"></div>
          </div>
        </div>

        <!-- Обложка -->
        <div id="flipbook-cover" class="cover" tabindex="0" role="button"
             aria-label="<?php esc_attr_e( 'Открыть книгу', 'flipbook-reader' ); ?>">
          <div class="cover-front">
            <h1 class="cover-title"><?php echo esc_html( $settings['book_title'] ?? 'Книга' ); ?></h1>
            <p class="cover-author"><?php echo esc_html( $settings['book_author'] ?? '' ); ?></p>
          </div>
          <div class="cover-back"></div>
        </div>

        <!-- Тень перелистывания -->
        <div id="flipbook-flipShadow" class="flip-shadow" aria-hidden="true"></div>
        <!-- Край страниц -->
        <div class="pages-edge" aria-hidden="true"></div>

        <!-- Зоны перетаскивания (углы) -->
        <div class="corner-zone corner-zone--top-right" data-dir="next" aria-hidden="true"></div>
        <div class="corner-zone corner-zone--bottom-right" data-dir="next" aria-hidden="true"></div>
        <div class="corner-zone corner-zone--top-left" data-dir="prev" aria-hidden="true"></div>
        <div class="corner-zone corner-zone--bottom-left" data-dir="prev" aria-hidden="true"></div>
      </div>
    </div>
  </main>

  <!-- Индикатор загрузки -->
  <div id="flipbook-loadingOverlay" class="loading-overlay" hidden aria-live="assertive">
    <div class="spinner" aria-hidden="true"></div>
    <p id="flipbook-loadingProgress" class="loading-progress">
      <?php esc_html_e( 'Загрузка…', 'flipbook-reader' ); ?>
    </p>
  </div>

  <!-- Панель управления -->
  <aside class="controls" aria-label="<?php esc_attr_e( 'Управление книгой', 'flipbook-reader' ); ?>">

    <!-- Навигация -->
    <div class="control-pod navigation-pod">
      <button id="flipbook-prev" class="nav-btn nav-btn--prev"
              aria-label="<?php esc_attr_e( 'Предыдущая страница', 'flipbook-reader' ); ?>" disabled>‹</button>
      <span class="page-counter">
        <span id="flipbook-current-page">0</span>/<span id="flipbook-total-pages">0</span>
      </span>
      <button id="flipbook-next" class="nav-btn nav-btn--next"
              aria-label="<?php esc_attr_e( 'Следующая страница', 'flipbook-reader' ); ?>" disabled>›</button>

      <button id="flipbook-tocBtn" class="toc-btn"
              aria-label="<?php esc_attr_e( 'Оглавление', 'flipbook-reader' ); ?>">☰</button>

      <progress id="flipbook-reading-progress" class="reading-progress" value="0" max="100"></progress>

      <button id="flipbook-continueBtn" class="continue-btn" hidden>
        <?php esc_html_e( 'Продолжить чтение', 'flipbook-reader' ); ?>
      </button>
    </div>

    <!-- Настройки -->
    <div class="control-pod settings-pod">
      <!-- Размер шрифта -->
      <div class="font-size-control">
        <button id="flipbook-decrease" aria-label="<?php esc_attr_e( 'Уменьшить шрифт', 'flipbook-reader' ); ?>">A−</button>
        <span id="flipbook-font-size-value">18</span>
        <button id="flipbook-increase" aria-label="<?php esc_attr_e( 'Увеличить шрифт', 'flipbook-reader' ); ?>">A+</button>
      </div>

      <!-- Тема -->
      <div class="theme-segmented" id="flipbook-themeSegmented" role="radiogroup"
           aria-label="<?php esc_attr_e( 'Тема оформления', 'flipbook-reader' ); ?>">
        <button data-theme="light" role="radio" aria-checked="true">☀️</button>
        <button data-theme="dark" role="radio" aria-checked="false">🌙</button>
        <button data-theme="bw" role="radio" aria-checked="false">◑</button>
      </div>

      <!-- Шрифт -->
      <select id="flipbook-fontSelect" aria-label="<?php esc_attr_e( 'Выбор шрифта', 'flipbook-reader' ); ?>">
        <option value="georgia">Georgia</option>
        <option value="merriweather">Merriweather</option>
        <option value="libre-baskerville">Libre Baskerville</option>
        <option value="inter">Inter</option>
        <option value="roboto">Roboto</option>
        <option value="open-sans">Open Sans</option>
      </select>

      <button id="flipbook-fullscreen-btn" class="fullscreen-btn"
              aria-label="<?php esc_attr_e( 'Полноэкранный режим', 'flipbook-reader' ); ?>">⛶</button>
    </div>

    <!-- Аудио -->
    <div class="control-pod audio-pod">
      <label class="sound-toggle-label">
        <input type="checkbox" id="flipbook-sound-toggle" checked>
        <span><?php esc_html_e( 'Звук', 'flipbook-reader' ); ?></span>
      </label>
      <div id="flipbook-pageVolumeControl" class="volume-control">
        <input type="range" id="flipbook-volume-slider" min="0" max="100" value="30"
               aria-label="<?php esc_attr_e( 'Громкость перелистывания', 'flipbook-reader' ); ?>">
      </div>

      <div id="flipbook-ambientPills" class="ambient-pills" role="radiogroup"
           aria-label="<?php esc_attr_e( 'Фоновый звук', 'flipbook-reader' ); ?>">
        <!-- Заполняется JavaScript'ом из CONFIG.AMBIENT -->
      </div>
      <div id="flipbook-ambientVolumeWrapper" class="volume-control" hidden>
        <input type="range" id="flipbook-ambient-volume" min="0" max="100" value="50"
               aria-label="<?php esc_attr_e( 'Громкость фонового звука', 'flipbook-reader' ); ?>">
      </div>
    </div>
  </aside>

</div><!-- .flipbook-reader -->
```

### Ключевые изменения по сравнению с index.html

| Было (index.html) | Стало (PHP-шаблон) | Почему |
|---|---|---|
| `id="leftA"` | `id="flipbook-leftA"` | Префикс `flipbook-` чтобы не конфликтовать с другими плагинами/темой |
| Статический текст | `esc_html_e('...', 'flipbook-reader')` | Интернационализация (i18n) — возможность перевода на другие языки |
| `<script>` / `<link>` | Убраны | WordPress подключает их через `wp_enqueue_script/style` |
| `<body data-debug>` | `<div class="flipbook-reader" data-debug>` | Наш контейнер вместо body |
| Google Fonts preload | Убрано | Подключим через `wp_enqueue_style` |

### Важно: обновление DOMManager.js

Поскольку все `id` теперь имеют префикс `flipbook-`, нужно обновить `DOMManager.js`:

```javascript
// БЫЛО:
const $ = id => document.getElementById(id);
this.elements = { leftA: $('leftA'), ... }

// СТАЛО:
const $ = id => document.getElementById('flipbook-' + id);
this.elements = { leftA: $('leftA'), ... }
// Или использовать маппинг:
this.elements = { leftA: $('flipbook-leftA'), ... }
```

---

## 8. Custom Post Type для глав

### Что такое Custom Post Type (CPT)

WordPress из коробки имеет типы контента: «Записи» (posts) и «Страницы» (pages). CPT — это ваш собственный тип контента. В нашем случае — «Главы книги».

После регистрации CPT в админке появится новый раздел «Главы» с возможностью создавать, редактировать и удалять главы.

### Файл `includes/class-flipbook-cpt.php`

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class Flipbook_CPT {

    /**
     * Регистрация Custom Post Type.
     * Вызывается на хуке 'init'.
     */
    public static function register() {
        // Метки для интерфейса админки
        $labels = array(
            'name'               => __( 'Главы', 'flipbook-reader' ),
            'singular_name'      => __( 'Глава', 'flipbook-reader' ),
            'add_new'            => __( 'Добавить главу', 'flipbook-reader' ),
            'add_new_item'       => __( 'Добавить новую главу', 'flipbook-reader' ),
            'edit_item'          => __( 'Редактировать главу', 'flipbook-reader' ),
            'new_item'           => __( 'Новая глава', 'flipbook-reader' ),
            'view_item'          => __( 'Просмотреть главу', 'flipbook-reader' ),
            'search_items'       => __( 'Найти главу', 'flipbook-reader' ),
            'not_found'          => __( 'Глав не найдено', 'flipbook-reader' ),
            'not_found_in_trash' => __( 'В корзине глав не найдено', 'flipbook-reader' ),
            'menu_name'          => __( 'Flipbook', 'flipbook-reader' ),
        );

        // Аргументы регистрации
        $args = array(
            'labels'             => $labels,
            'public'             => false,      // Не показывать на фронтенде как отдельные страницы
            'show_ui'            => true,        // Показывать в админке
            'show_in_menu'       => true,        // Показывать в меню админки
            'show_in_rest'       => true,        // Включить REST API (нужно для Gutenberg и нашего API)
            'menu_icon'          => 'dashicons-book',  // Иконка в меню
            'menu_position'      => 25,          // Позиция в меню (после «Комментарии»)
            'supports'           => array(
                'title',          // Заголовок главы
                'editor',         // Редактор контента (Gutenberg)
                'page-attributes' // Порядок (menu_order) — для сортировки глав
            ),
            'has_archive'        => false,       // Нет архивной страницы
            'rewrite'            => false,       // Нет отдельных URL для глав
            'capability_type'    => 'post',      // Права как у обычных записей
            'hierarchical'       => false,       // Не вложенные (как записи, а не как страницы)
        );

        register_post_type( 'flipbook_chapter', $args );
    }

    /**
     * Добавление мета-полей для главы.
     * Мета-поля — дополнительные данные, привязанные к посту.
     */
    public static function register_meta_boxes() {
        add_meta_box(
            'flipbook_chapter_settings',                    // Уникальный ID
            __( 'Настройки главы', 'flipbook-reader' ),    // Заголовок
            array( __CLASS__, 'render_meta_box' ),          // Callback отрисовки
            'flipbook_chapter',                             // Для какого типа постов
            'side',                                         // Позиция (сайдбар)
            'default'                                       // Приоритет
        );
    }

    /**
     * Отрисовка мета-бокса в редакторе главы.
     */
    public static function render_meta_box( $post ) {
        // Nonce для безопасности (защита от CSRF)
        wp_nonce_field( 'flipbook_chapter_meta', 'flipbook_chapter_nonce' );

        // Получаем сохранённые значения
        $bg_image    = get_post_meta( $post->ID, '_flipbook_bg_image', true );
        $bg_mobile   = get_post_meta( $post->ID, '_flipbook_bg_mobile', true );
        $chapter_order = $post->menu_order;
        ?>
        <p>
            <label for="flipbook_bg_image">
                <?php esc_html_e( 'Фоновое изображение (десктоп):', 'flipbook-reader' ); ?>
            </label><br>
            <input type="text" id="flipbook_bg_image" name="flipbook_bg_image"
                   value="<?php echo esc_attr( $bg_image ); ?>" class="widefat">
            <button type="button" class="button flipbook-upload-image" data-target="flipbook_bg_image">
                <?php esc_html_e( 'Выбрать изображение', 'flipbook-reader' ); ?>
            </button>
        </p>
        <p>
            <label for="flipbook_bg_mobile">
                <?php esc_html_e( 'Фоновое изображение (мобильное):', 'flipbook-reader' ); ?>
            </label><br>
            <input type="text" id="flipbook_bg_mobile" name="flipbook_bg_mobile"
                   value="<?php echo esc_attr( $bg_mobile ); ?>" class="widefat">
            <button type="button" class="button flipbook-upload-image" data-target="flipbook_bg_mobile">
                <?php esc_html_e( 'Выбрать изображение', 'flipbook-reader' ); ?>
            </button>
        </p>
        <p class="description">
            <?php esc_html_e( 'Порядок главы задаётся в поле «Порядок» справа.', 'flipbook-reader' ); ?>
        </p>
        <?php
    }

    /**
     * Сохранение мета-данных при сохранении поста.
     */
    public static function save_meta( $post_id ) {
        // Проверка nonce
        if ( ! isset( $_POST['flipbook_chapter_nonce'] ) ||
             ! wp_verify_nonce( $_POST['flipbook_chapter_nonce'], 'flipbook_chapter_meta' ) ) {
            return;
        }
        // Проверка прав
        if ( ! current_user_can( 'edit_post', $post_id ) ) {
            return;
        }
        // Проверка автосохранения
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
            return;
        }

        // Сохранение
        if ( isset( $_POST['flipbook_bg_image'] ) ) {
            update_post_meta( $post_id, '_flipbook_bg_image',
                esc_url_raw( $_POST['flipbook_bg_image'] ) );
        }
        if ( isset( $_POST['flipbook_bg_mobile'] ) ) {
            update_post_meta( $post_id, '_flipbook_bg_mobile',
                esc_url_raw( $_POST['flipbook_bg_mobile'] ) );
        }
    }

    /**
     * Получить все главы, отсортированные по порядку.
     * Используется для формирования данных для JS.
     *
     * @return array Массив глав в формате, совместимом с CONFIG.CHAPTERS
     */
    public static function get_chapters() {
        $posts = get_posts( array(
            'post_type'      => 'flipbook_chapter',
            'post_status'    => 'publish',
            'posts_per_page' => -1,         // Все главы
            'orderby'        => 'menu_order', // Сортировка по полю «Порядок»
            'order'          => 'ASC',
        ) );

        $chapters = array();
        foreach ( $posts as $post ) {
            $chapters[] = array(
                'id'       => $post->post_name,     // Slug поста (напр. "part_1")
                'title'    => $post->post_title,
                'file'     => rest_url( 'flipbook/v1/chapter/' . $post->post_name ),
                'bg'       => get_post_meta( $post->ID, '_flipbook_bg_image', true ),
                'bgMobile' => get_post_meta( $post->ID, '_flipbook_bg_mobile', true ),
            );
        }

        return $chapters;
    }
}
```

### Как администратор добавляет контент

1. Открой админку WordPress → в меню слева появится **«Flipbook»** (с иконкой книги)
2. Нажми **«Добавить главу»**
3. Введи заголовок: например «Глава 1. Нежданное угощение»
4. В редакторе вставь HTML-контент главы (можно скопировать из `public/content/part_1.html`)
5. В сайдбаре справа выбери фоновые изображения
6. В поле **«Порядок»** укажи число (1, 2, 3...) для правильной сортировки
7. Нажми **«Опубликовать»**

---

## 9. Страница настроек в админке

### Файл `includes/class-flipbook-settings.php`

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class Flipbook_Settings {

    // Имя группы настроек в БД
    const OPTION_GROUP = 'flipbook_settings';
    const OPTION_NAME  = 'flipbook_options';

    /**
     * Регистрация страницы настроек.
     * Вызывается на хуке 'admin_menu'.
     */
    public static function add_settings_page() {
        add_submenu_page(
            'edit.php?post_type=flipbook_chapter', // Родительский пункт меню
            __( 'Настройки Flipbook', 'flipbook-reader' ),  // Заголовок страницы
            __( 'Настройки', 'flipbook-reader' ),            // Текст в меню
            'manage_options',                                 // Необходимые права
            'flipbook-settings',                              // Slug страницы
            array( __CLASS__, 'render_page' )                 // Callback отрисовки
        );
    }

    /**
     * Регистрация полей настроек.
     * Вызывается на хуке 'admin_init'.
     */
    public static function register_settings() {
        register_setting(
            self::OPTION_GROUP,
            self::OPTION_NAME,
            array(
                'type'              => 'array',
                'sanitize_callback' => array( __CLASS__, 'sanitize' ),
                'default'           => self::defaults(),
            )
        );

        // Секция «Основные»
        add_settings_section(
            'flipbook_general',
            __( 'Основные настройки', 'flipbook-reader' ),
            null,
            'flipbook-settings'
        );

        // Поле: Заголовок книги
        add_settings_field(
            'book_title',
            __( 'Название книги', 'flipbook-reader' ),
            array( __CLASS__, 'render_text_field' ),
            'flipbook-settings',
            'flipbook_general',
            array( 'field' => 'book_title', 'description' => 'Отображается на обложке' )
        );

        // Поле: Автор
        add_settings_field(
            'book_author',
            __( 'Автор', 'flipbook-reader' ),
            array( __CLASS__, 'render_text_field' ),
            'flipbook-settings',
            'flipbook_general',
            array( 'field' => 'book_author' )
        );

        // Поле: Изображение обложки
        add_settings_field(
            'cover_image',
            __( 'Фон обложки', 'flipbook-reader' ),
            array( __CLASS__, 'render_image_field' ),
            'flipbook-settings',
            'flipbook_general',
            array( 'field' => 'cover_image' )
        );

        // Поле: Шрифт по умолчанию
        add_settings_field(
            'default_font',
            __( 'Шрифт по умолчанию', 'flipbook-reader' ),
            array( __CLASS__, 'render_select_field' ),
            'flipbook-settings',
            'flipbook_general',
            array(
                'field'   => 'default_font',
                'options' => array(
                    'georgia'          => 'Georgia',
                    'merriweather'     => 'Merriweather',
                    'libre-baskerville' => 'Libre Baskerville',
                    'inter'            => 'Inter',
                    'roboto'           => 'Roboto',
                    'open-sans'        => 'Open Sans',
                ),
            )
        );

        // Поле: Тема по умолчанию
        add_settings_field(
            'default_theme',
            __( 'Тема по умолчанию', 'flipbook-reader' ),
            array( __CLASS__, 'render_select_field' ),
            'flipbook-settings',
            'flipbook_general',
            array(
                'field'   => 'default_theme',
                'options' => array(
                    'light' => __( 'Светлая', 'flipbook-reader' ),
                    'dark'  => __( 'Тёмная', 'flipbook-reader' ),
                    'bw'    => __( 'Чёрно-белая', 'flipbook-reader' ),
                ),
            )
        );

        // Поле: Включить звуки
        add_settings_field(
            'enable_sounds',
            __( 'Звуки по умолчанию', 'flipbook-reader' ),
            array( __CLASS__, 'render_checkbox_field' ),
            'flipbook-settings',
            'flipbook_general',
            array( 'field' => 'enable_sounds', 'label' => 'Включить звуковые эффекты' )
        );
    }

    /**
     * Значения по умолчанию.
     */
    public static function defaults() {
        return array(
            'book_title'    => 'Книга',
            'book_author'   => '',
            'cover_image'   => '',
            'default_font'  => 'georgia',
            'default_theme' => 'light',
            'enable_sounds' => true,
        );
    }

    /**
     * Получить настройки (с fallback на defaults).
     */
    public static function get_options() {
        return wp_parse_args(
            get_option( self::OPTION_NAME, array() ),
            self::defaults()
        );
    }

    /**
     * Валидация и очистка данных перед сохранением.
     */
    public static function sanitize( $input ) {
        $clean = array();
        $clean['book_title']    = sanitize_text_field( $input['book_title'] ?? '' );
        $clean['book_author']   = sanitize_text_field( $input['book_author'] ?? '' );
        $clean['cover_image']   = esc_url_raw( $input['cover_image'] ?? '' );
        $clean['default_font']  = sanitize_key( $input['default_font'] ?? 'georgia' );
        $clean['default_theme'] = sanitize_key( $input['default_theme'] ?? 'light' );
        $clean['enable_sounds'] = ! empty( $input['enable_sounds'] );
        return $clean;
    }

    // --- Функции отрисовки полей ---

    public static function render_text_field( $args ) {
        $options = self::get_options();
        $value = $options[ $args['field'] ] ?? '';
        printf(
            '<input type="text" name="%s[%s]" value="%s" class="regular-text">',
            self::OPTION_NAME,
            esc_attr( $args['field'] ),
            esc_attr( $value )
        );
        if ( ! empty( $args['description'] ) ) {
            printf( '<p class="description">%s</p>', esc_html( $args['description'] ) );
        }
    }

    public static function render_select_field( $args ) {
        $options = self::get_options();
        $value = $options[ $args['field'] ] ?? '';
        printf( '<select name="%s[%s]">', self::OPTION_NAME, esc_attr( $args['field'] ) );
        foreach ( $args['options'] as $key => $label ) {
            printf(
                '<option value="%s" %s>%s</option>',
                esc_attr( $key ),
                selected( $value, $key, false ),
                esc_html( $label )
            );
        }
        echo '</select>';
    }

    public static function render_checkbox_field( $args ) {
        $options = self::get_options();
        $checked = ! empty( $options[ $args['field'] ] );
        printf(
            '<label><input type="checkbox" name="%s[%s]" value="1" %s> %s</label>',
            self::OPTION_NAME,
            esc_attr( $args['field'] ),
            checked( $checked, true, false ),
            esc_html( $args['label'] ?? '' )
        );
    }

    public static function render_image_field( $args ) {
        $options = self::get_options();
        $value = $options[ $args['field'] ] ?? '';
        printf(
            '<input type="text" name="%s[%s]" value="%s" class="regular-text" id="%s">',
            self::OPTION_NAME,
            esc_attr( $args['field'] ),
            esc_attr( $value ),
            esc_attr( $args['field'] )
        );
        printf(
            ' <button type="button" class="button flipbook-upload-image" data-target="%s">%s</button>',
            esc_attr( $args['field'] ),
            esc_html__( 'Выбрать изображение', 'flipbook-reader' )
        );
        if ( $value ) {
            printf( '<br><img src="%s" style="max-width:200px;margin-top:8px;">', esc_url( $value ) );
        }
    }

    /**
     * Отрисовка страницы настроек.
     */
    public static function render_page() {
        ?>
        <div class="wrap">
            <h1><?php esc_html_e( 'Настройки Flipbook Reader', 'flipbook-reader' ); ?></h1>
            <form method="post" action="options.php">
                <?php
                settings_fields( self::OPTION_GROUP );
                do_settings_sections( 'flipbook-settings' );
                submit_button();
                ?>
            </form>
        </div>
        <?php
    }
}
```

### Где это появится в админке

```
Админка WordPress
├── ...
├── Flipbook (иконка 📖)
│   ├── Все главы        ← список глав
│   ├── Добавить главу   ← редактор новой главы
│   └── Настройки        ← страница настроек (наша)
├── ...
```

---

## 10. Shortcode для вставки книги

### Что такое Shortcode

Shortcode — это короткий код вида `[flipbook]`, который можно вставить в любой пост или страницу WordPress. WordPress заменяет его на HTML-контент.

### Файл `includes/class-flipbook-shortcode.php`

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class Flipbook_Shortcode {

    /**
     * Регистрация shortcode.
     * После этого [flipbook] будет доступен в редакторе.
     */
    public static function register() {
        add_shortcode( 'flipbook', array( __CLASS__, 'render' ) );
    }

    /**
     * Обработчик shortcode.
     * Вызывается WordPress каждый раз, когда встречает [flipbook] в контенте.
     *
     * @param array $atts Атрибуты shortcode
     *   Пример: [flipbook book_id="hobbit" theme="dark"]
     *           $atts = ['book_id' => 'hobbit', 'theme' => 'dark']
     *
     * @return string HTML-разметка книги
     */
    public static function render( $atts ) {
        // Объединяем переданные атрибуты с дефолтными
        $atts = shortcode_atts( array(
            'book_id' => '',     // ID конкретной книги (для будущего)
            'height'  => '90vh', // Высота контейнера
            'theme'   => '',     // Принудительная тема (пусто = из настроек)
        ), $atts, 'flipbook' );

        // Получаем настройки из админки
        $settings = Flipbook_Settings::get_options();

        // Получаем главы
        $chapters = Flipbook_CPT::get_chapters();
        if ( empty( $chapters ) ) {
            return '<p class="flipbook-no-content">' .
                   esc_html__( 'Главы не найдены. Добавьте главы в разделе Flipbook.', 'flipbook-reader' ) .
                   '</p>';
        }

        // Подключаем CSS и JS (только на страницах, где есть shortcode)
        Flipbook_Assets::enqueue();

        // Передаём данные в JavaScript
        wp_localize_script( 'flipbook-js', 'flipbookConfig', array(
            'baseUrl'    => FLIPBOOK_ASSETS_URL,
            'restUrl'    => rest_url( 'flipbook/v1/' ),
            'nonce'      => wp_create_nonce( 'wp_rest' ),
            'chapters'   => $chapters,
            'settings'   => array(
                'book_title'   => $settings['book_title'],
                'book_author'  => $settings['book_author'],
                'cover_image'  => $settings['cover_image'],
                'default_font' => $settings['default_font'],
                'default_theme' => $atts['theme'] ?: $settings['default_theme'],
                'enable_sounds' => $settings['enable_sounds'],
            ),
            'sounds'     => array(
                'pageFlip'  => FLIPBOOK_ASSETS_URL . 'sounds/page-flip.mp3',
                'bookOpen'  => FLIPBOOK_ASSETS_URL . 'sounds/cover-flip.mp3',
                'bookClose' => FLIPBOOK_ASSETS_URL . 'sounds/cover-flip.mp3',
            ),
            'ambient'    => array(
                'none'      => array( 'label' => 'Без звука', 'icon' => '✕', 'file' => null ),
                'rain'      => array( 'label' => 'Дождь', 'icon' => '🌧️',
                                      'file' => FLIPBOOK_ASSETS_URL . 'sounds/ambient/rain.mp3' ),
                'fireplace' => array( 'label' => 'Камин', 'icon' => '🔥',
                                      'file' => FLIPBOOK_ASSETS_URL . 'sounds/ambient/fireplace.mp3' ),
                'cafe'      => array( 'label' => 'Кафе', 'icon' => '☕',
                                      'file' => FLIPBOOK_ASSETS_URL . 'sounds/ambient/cafe.mp3' ),
            ),
        ) );

        // Рендерим шаблон
        // ob_start() начинает буферизацию вывода —
        // всё, что выведет include, попадёт в буфер, а не на экран
        ob_start();
        include FLIPBOOK_PATH . 'templates/flipbook-template.php';
        return ob_get_clean(); // Возвращаем содержимое буфера как строку
    }
}
```

### Файл `includes/class-flipbook-assets.php`

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class Flipbook_Assets {

    private static $enqueued = false;

    /**
     * Подключение CSS и JS.
     * Вызывается только когда на странице есть shortcode [flipbook].
     */
    public static function enqueue() {
        // Защита от повторного подключения
        if ( self::$enqueued ) return;
        self::$enqueued = true;

        // CSS
        wp_enqueue_style(
            'flipbook-css',                                  // Handle (уникальное имя)
            FLIPBOOK_ASSETS_URL . 'dist/flipbook.css',       // URL файла
            array(),                                          // Зависимости (нет)
            FLIPBOOK_VERSION                                  // Версия (для кэш-бастинга)
        );

        // Google Fonts
        wp_enqueue_style(
            'flipbook-google-fonts',
            'https://fonts.googleapis.com/css2?' .
            'family=Inter:wght@400;500&' .
            'family=Merriweather:wght@400;700&' .
            'family=Libre+Baskerville:wght@400;700&' .
            'family=Open+Sans:wght@400;600&' .
            'family=Roboto:wght@400;500&' .
            'display=swap',
            array(),
            null  // null = не добавлять ?ver= (Google Fonts не нуждается)
        );

        // JavaScript
        wp_enqueue_script(
            'flipbook-js',                                   // Handle
            FLIPBOOK_ASSETS_URL . 'dist/flipbook.js',        // URL файла
            array(),                                          // Зависимости
            FLIPBOOK_VERSION,                                 // Версия
            true                                              // В footer (true = перед </body>)
        );
    }
}
```

### Как администратор использует shortcode

1. Создай новую **Страницу** в WordPress (Страницы → Добавить новую)
2. Назови её, например, «Читать книгу»
3. В редакторе вставь: `[flipbook]`
4. Опубликуй страницу
5. Открой страницу — там будет книга

**С параметрами:**
```
[flipbook height="100vh" theme="dark"]
```

---

## 11. Gutenberg-блок (опционально)

### Зачем

Shortcode `[flipbook]` работает, но выглядит как просто текст в редакторе. Gutenberg-блок даёт визуальный предпросмотр и удобный интерфейс настроек прямо в редакторе.

### Это можно сделать позже

Для MVP (первой рабочей версии) shortcode достаточно. Gutenberg-блок — это отдельная задача, требующая знания React. Можно вернуться к ней позже.

### Краткий план (если решишь делать)

1. Создай `blocks/flipbook/block.json` — описание блока
2. `blocks/flipbook/edit.js` — React-компонент для редактора (показывает превью)
3. `blocks/flipbook/save.js` — серверный рендеринг (PHP) или сохранение shortcode
4. Зарегистрируй через `register_block_type()` в PHP
5. Собери через `@wordpress/scripts` или тот же Vite

---

## 12. Работа со статическими файлами

### Звуки, изображения, шрифты

Эти файлы просто копируются из оригинального проекта в папку `assets/`.

```bash
# Из корня плагина:
cp -r /path/to/flipbook/public/sounds assets/sounds
cp -r /path/to/flipbook/public/images assets/images
cp -r /path/to/flipbook/public/fonts assets/fonts
```

### Пути к файлам

В оригинале пути вида `/sounds/page-flip.mp3` работают через Vite dev-server.
В WordPress пути должны быть абсолютными URL:

```
https://example.com/wp-content/plugins/flipbook-reader/assets/sounds/page-flip.mp3
```

Эти URL формируются в PHP через `FLIPBOOK_ASSETS_URL` и передаются в JS через `wp_localize_script`.

### Медиабиблиотека WordPress

Для фоновых изображений глав используем **WordPress Media Library** (встроенная медиабиблиотека). Администратор загружает изображения через стандартный интерфейс WP, а в мета-поле главы сохраняется URL.

Для этого нужен JS-скрипт, открывающий медиабиблиотеку:

```javascript
// assets/admin.js — подключается ТОЛЬКО в админке
jQuery(function($) {
    $('.flipbook-upload-image').on('click', function(e) {
        e.preventDefault();
        var button = $(this);
        var targetInput = $('#' + button.data('target'));

        var frame = wp.media({
            title: 'Выбрать изображение',
            button: { text: 'Использовать' },
            multiple: false
        });

        frame.on('select', function() {
            var attachment = frame.state().get('selection').first().toJSON();
            targetInput.val(attachment.url);
        });

        frame.open();
    });
});
```

```php
// В class-flipbook-plugin.php, подключение скрипта медиабиблиотеки в админке:
public function admin_scripts( $hook ) {
    // Подключаем только на страницах нашего плагина
    $screen = get_current_screen();
    if ( $screen->post_type !== 'flipbook_chapter' && $hook !== 'flipbook_chapter_page_flipbook-settings' ) {
        return;
    }

    wp_enqueue_media(); // Подключает WP Media Library
    wp_enqueue_script(
        'flipbook-admin',
        FLIPBOOK_ASSETS_URL . 'admin.js',
        array( 'jquery' ),
        FLIPBOOK_VERSION,
        true
    );
}
```

---

## 13. Безопасность

### Что нужно обеспечить

| Аспект | Оригинал | WordPress-версия |
|---|---|---|
| **XSS-защита** | `HTMLSanitizer.js` | Оставляем + PHP-санитизация (`esc_html`, `wp_kses`) |
| **CSRF** | Нет (статический сайт) | `wp_nonce_field()` / `wp_verify_nonce()` |
| **SQL-инъекции** | Нет БД | WordPress `$wpdb->prepare()` (если пишем SQL) |
| **Прямой доступ к файлам** | Нет | `if (!defined('ABSPATH')) exit;` |
| **CSP** | Meta-тег в HTML | Управляется сервером/темой — **убрать мета-тег** |
| **Валидация данных** | Минимальная | `sanitize_text_field()`, `esc_url_raw()`, `absint()` |
| **REST API** | Нет | `permission_callback` + nonce |

### Правило трёх «Э»

В WordPress всегда соблюдай:
1. **Экранирование** (escape) — при выводе: `esc_html()`, `esc_attr()`, `esc_url()`
2. **Эталонирование** (sanitize) — при сохранении: `sanitize_text_field()`, `wp_kses()`
3. **Энонсирование** (nonce) — при формах: `wp_nonce_field()`, `wp_verify_nonce()`

---

## 14. Решение типичных проблем совместимости

### Проблема 1: 3D-трансформации ломаются

**Симптом:** Книга плоская, нет эффекта перелистывания.

**Причина:** Тема WordPress или другой плагин ставит `overflow: hidden` или `transform` на родительском элементе. Это ломает CSS `perspective` и 3D-трансформации.

**Решение:**
```css
/* Принудительно сбрасываем свойства, ломающие 3D */
.flipbook-reader {
  transform: none !important;
  overflow: visible !important;
}

/* Или используем CSS containment: */
.flipbook-reader {
  contain: layout style;
  isolation: isolate;
}
```

### Проблема 2: jQuery-конфликты

**Симптом:** JS-ошибки в консоли.

**Причина:** WordPress загружает jQuery в noConflict-режиме, `$` не определена.

**Решение:** Наш код не использует jQuery (vanilla JS), поэтому проблем не должно быть. Но если добавите jQuery-зависимости:

```javascript
// Правильно в WordPress:
jQuery(function($) {
  // $ работает только внутри этой функции
  $('.flipbook-reader').doSomething();
});
```

### Проблема 3: Стили темы переопределяют стили книги

**Симптом:** Шрифты, цвета, отступы в книге выглядят неправильно.

**Причина:** CSS-правила темы имеют более высокую специфичность.

**Решения (в порядке предпочтения):**

1. **Увеличить специфичность:**
   ```css
   /* Двойной класс повышает специфичность */
   .flipbook-reader.flipbook-reader .page { ... }
   ```

2. **CSS `all: initial` (ядерная опция):**
   ```css
   .flipbook-reader {
     all: initial; /* Сбрасывает ВСЁ наследование */
   }
   .flipbook-reader * {
     all: unset; /* Сбрасывает все стили дочерних элементов */
   }
   /* Затем заново определяем нужные стили */
   ```

3. **Shadow DOM (самая надёжная изоляция):**
   ```javascript
   // В entry.js:
   const host = document.querySelector('.flipbook-reader');
   const shadow = host.attachShadow({ mode: 'open' });
   // Все стили и DOM внутри Shadow DOM полностью изолированы
   shadow.innerHTML = `<style>${flipbookCSS}</style>${flipbookHTML}`;
   ```
   Минус: Shadow DOM требует значительной переработки (DOM-запросы не видят элементы внутри shadow).

**Рекомендация:** Начни с CSS-префиксов (секция 6) + повышение специфичности. Если не помогает — используй `all: initial` на контейнере.

### Проблема 4: Множественные экземпляры на странице

**Симптом:** Если `[flipbook]` вставлен дважды на одной странице, работает только первый.

**Причина:** `document.getElementById()` возвращает первый найденный элемент.

**Решение:** Вместо глобальных ID — искать элементы относительно контейнера:

```javascript
// БЫЛО:
document.getElementById('flipbook-leftA');

// СТАЛО:
const container = document.querySelector('.flipbook-reader[data-instance="1"]');
container.querySelector('.page--left[data-active="true"]');
```

Для MVP можно ограничить одним экземпляром на странице.

### Проблема 5: Конфликты клавиатурных сочетаний

**Симптом:** Стрелки ←→ перелистывают книгу, даже когда фокус в другом месте.

**Причина:** Оригинальный `EventController` слушает события на `document`.

**Решение:** Ограничить слушатели контейнером книги:

```javascript
// БЫЛО:
document.addEventListener('keydown', handler);

// СТАЛО:
this.container.addEventListener('keydown', handler);
// + container должен иметь tabindex="0" для получения фокуса
```

---

## 15. Тестирование

### Шаг 1: Ручное тестирование

**Чек-лист:**

- [ ] Плагин активируется без ошибок
- [ ] В меню появился раздел «Flipbook»
- [ ] Можно создать главу с контентом
- [ ] Страница настроек работает, настройки сохраняются
- [ ] Shortcode `[flipbook]` рендерит книгу на странице
- [ ] Обложка отображается, кликается, книга открывается
- [ ] Перелистывание страниц работает (клик, клавиатура, перетаскивание)
- [ ] Контент глав загружается и отображается
- [ ] Смена шрифта, размера, темы работает
- [ ] Звуки работают (если включены)
- [ ] На мобильном: свайп перелистывает
- [ ] Нет ошибок в консоли браузера
- [ ] Нет конфликтов с популярными темами (Twenty Twenty-Four, Astra, GeneratePress)

### Шаг 2: Тестирование с разными темами

Установи 2-3 популярные темы и проверь, что книга выглядит правильно в каждой:

1. **Twenty Twenty-Four** (стандартная тема WordPress)
2. **Astra** (самая популярная)
3. **GeneratePress** (лёгкая и чистая)

### Шаг 3: Тестирование с другими плагинами

Проверь совместимость с:
- **Yoast SEO** — не должно быть конфликтов
- **WooCommerce** — если на сайте есть магазин
- **Elementor / WPBakery** — популярные page-builders

### Шаг 4: Адаптация существующих тестов

Юнит-тесты из `tests/unit/` можно адаптировать:
- Модули JS не зависят от WordPress — тесты работают как есть
- Нужно замокать `window.flipbookConfig` вместо `import.meta.env`
- E2E тесты (Playwright) придётся переписать для WordPress-контекста

---

## 16. Упаковка и распространение

### Для WordPress.org (бесплатный плагин)

1. **Создай `readme.txt`** в формате WordPress:
   ```
   === Flipbook Reader ===
   Contributors: your-username
   Tags: ebook, reader, flipbook, 3d, animation
   Requires at least: 5.8
   Tested up to: 6.4
   Requires PHP: 7.4
   Stable tag: 1.0.0
   License: MIT

   Interactive 3D e-book reader with realistic page-flip animations.

   == Description ==
   ...

   == Installation ==
   1. Upload the plugin files to /wp-content/plugins/flipbook-reader/
   2. Activate the plugin through the 'Plugins' screen in WordPress
   3. Add chapters via Flipbook menu
   4. Use [flipbook] shortcode on any page

   == Changelog ==
   = 1.0.0 =
   * Initial release
   ```

2. **Собери ZIP-архив для установки:**
   ```bash
   # Из папки wp-content/plugins/
   cd flipbook-reader

   # Сборка ассетов
   npm run build

   # Создание ZIP (без dev-файлов)
   cd ..
   zip -r flipbook-reader-1.0.0.zip flipbook-reader/ \
     -x "flipbook-reader/node_modules/*" \
     -x "flipbook-reader/src/*" \
     -x "flipbook-reader/.git/*" \
     -x "flipbook-reader/package-lock.json" \
     -x "flipbook-reader/vite.config.js" \
     -x "flipbook-reader/postcss.config.js"
   ```

3. **Подай заявку** на [wordpress.org/plugins/developers](https://wordpress.org/plugins/developers/) (ревью занимает 1-4 недели).

### Для ручной установки

Просто дай пользователю ZIP-файл. Он установит через:
**Админка → Плагины → Добавить новый → Загрузить плагин → выбрать ZIP**

---

## Порядок выполнения работ (итоговый чеклист)

### Фаза 1: Подготовка (1-2 дня)
- [ ] Установить LocalWP, создать тестовый сайт
- [ ] Создать структуру папок плагина
- [ ] Скопировать исходники в `src/`
- [ ] Настроить `package.json` и `vite.config.js`

### Фаза 2: PHP-каркас (2-3 дня)
- [ ] Главный файл плагина (`flipbook-reader.php`)
- [ ] Класс плагина (`class-flipbook-plugin.php`)
- [ ] Custom Post Type для глав
- [ ] Страница настроек в админке
- [ ] Shortcode `[flipbook]`
- [ ] Подключение CSS/JS ассетов

### Фаза 3: Адаптация фронтенда (3-5 дней)
- [ ] Новая точка входа `src/entry.js` (без PWA)
- [ ] Адаптация `config.js` (пути из `wp_localize_script`)
- [ ] Адаптация `DOMManager.js` (префиксы ID)
- [ ] Адаптация `ContentLoader.js` (REST API вместо статических файлов)
- [ ] CSS-изоляция (префиксы, переменные в контейнере)
- [ ] Перенос `data-theme` с `<body>` на `.flipbook-reader`
- [ ] Удаление PWA-логики из JS
- [ ] PHP-шаблон (`flipbook-template.php`)
- [ ] Сборка через Vite → `assets/dist/`

### Фаза 4: REST API (1-2 дня)
- [ ] Endpoint для загрузки контента главы
- [ ] Nonce-проверка (если нужна)
- [ ] Адаптация JS для работы с REST API

### Фаза 5: Тестирование и отладка (2-3 дня)
- [ ] Ручное тестирование по чек-листу
- [ ] Тестирование с 2-3 темами
- [ ] Исправление CSS-конфликтов
- [ ] Тестирование мобильной версии
- [ ] Тестирование клавиатурной навигации

### Фаза 6: Упаковка (1 день)
- [ ] Написать `readme.txt`
- [ ] Создать `uninstall.php`
- [ ] Собрать ZIP-архив
- [ ] Проверить установку «с нуля»

**Итого: ~10-16 дней** (зависит от опыта с PHP и WordPress)

---

## Глоссарий

| Термин | Что значит |
|---|---|
| **Hook (Хук)** | Точка, куда можно встроить свой код в процесс работы WordPress |
| **Action** | Тип хука: «сделай что-то в этот момент» |
| **Filter** | Тип хука: «измени эти данные перед использованием» |
| **Shortcode** | `[тег]` в контенте, который WordPress заменяет на HTML |
| **Custom Post Type (CPT)** | Пользовательский тип контента (помимо постов и страниц) |
| **Meta Box** | Блок с дополнительными полями в редакторе поста |
| **post_meta** | Произвольные данные, привязанные к конкретному посту |
| **wp_enqueue_script/style** | Правильный способ подключения CSS/JS в WordPress |
| **wp_localize_script** | Способ передачи данных из PHP в JavaScript |
| **Nonce** | Одноразовый токен для защиты от CSRF-атак |
| **sanitize** | Очистка входных данных перед сохранением |
| **escape (esc_)** | Экранирование данных перед выводом в HTML |
| **ABSPATH** | Константа с путём к корню WordPress — если не определена, файл запрошен напрямую |
| **IIFE** | Immediately Invoked Function Expression — формат JS-бандла |
| **REST API** | HTTP-интерфейс WordPress для получения/отправки данных (JSON) |
| **Gutenberg** | Блочный редактор WordPress (начиная с WP 5.0) |
| **Shadow DOM** | Браузерная технология изоляции DOM и стилей |
