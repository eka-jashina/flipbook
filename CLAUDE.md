# CLAUDE.md - AI Assistant Guide for Flipbook

This document provides essential context for AI assistants working on this codebase.

## Project Overview

**Flipbook** is an interactive e-book reader web application with realistic 3D page-flip animations. Built with vanilla JavaScript (ES Modules) and CSS, using Vite as the build tool. Includes a personal account (admin panel) for managing multiple books, chapters, fonts, sounds, and appearance customization.

**Key Features:**
- 3D page flip animations with realistic physics
- Multi-chapter support (default: 3 chapters of Tolkien's "The Hobbit" in Russian)
- Bookshelf as the main screen — book cards with context menu (read / edit / delete)
- Personal account (admin.html) for book management (upload, chapters, fonts, sounds, appearance, export)
- Multi-book support with per-book reading progress (Continue Reading button)
- Customizable reading experience (fonts, sizes, themes, sounds)
- Per-book appearance customization (cover colors, page textures, decorative fonts)
- Responsive design (desktop & mobile)
- Background ambient sounds (rain, fireplace, cafe) — configurable via personal account
- Page-turn sound effects — configurable via personal account
- Photo album / lightbox support
- Persistent user settings via localStorage (per-book reading progress)
- Admin config persistence via localStorage (large content via IndexedDB)
- PWA — installable as native app, offline access via Service Worker
- Book import from txt, doc, docx, epub, fb2 formats

**Live Demo:** Deployed to GitHub Pages at `/flipbook/`

## Quick Reference

### Essential Commands

```bash
# Development
npm run dev          # Start dev server (port 3000, auto-opens browser)
npm run build        # Production build to dist/
npm run preview      # Preview production build locally (port 4173)
npm run build:prod   # Clean + build (recommended for production)
npm run build:analyze # Build with bundle analysis
npm run clean        # Remove dist/ folder
npm run size         # Check dist folder size
npm run serve        # Serve dist/ with static server

# Testing
npm run test         # Run unit/integration tests (Vitest, watch mode)
npm run test:run     # Single test run
npm run test:watch   # Tests in watch mode
npm run test:coverage # Tests with coverage report
npm run test:ui      # Tests with Vitest UI
npm run test:e2e     # Run E2E tests (Playwright)
npm run test:e2e:ui  # E2E with Playwright UI
npm run test:e2e:headed # E2E with visible browser
npm run test:e2e:debug  # E2E in debug mode
npm run test:e2e:report # Show E2E test report

# Linting
npm run lint         # Run ESLint + Stylelint
npm run lint:js      # ESLint on js/
npm run lint:css     # Stylelint on css/
npm run lint:js:fix  # ESLint autofix
npm run lint:css:fix # Stylelint autofix

# Documentation
npm run docs         # Generate API documentation to docs/
npm run docs:serve   # Generate and serve docs on port 3001

# Deployment
npm run deploy       # Build + deploy to Netlify
npm run deploy:netlify # Deploy dist/ to Netlify
npm run deploy:vercel  # Deploy to Vercel
```

### Requirements
- Node.js >= 18.0.0
- npm >= 9.0.0
- Modern browser with ES Modules support

## Directory Structure

```
flipbook/
├── index.html                 # Main entry — bookshelf + reader
├── admin.html                 # Personal account (book management)
├── css/                       # Modular CSS (import order matters)
│   ├── index.css             # Main entry (imports all modules)
│   ├── variables.css         # Design tokens (CSS custom properties)
│   ├── reset.css             # Browser reset
│   ├── themes.css            # Light/dark/B&W themes
│   ├── layout.css            # Grid/flex layout
│   ├── book.css              # Book container & 3D effects
│   ├── pages.css             # Page styles
│   ├── cover.css             # Book cover
│   ├── sheet.css             # Animated page sheet
│   ├── typography.css        # Font styles
│   ├── images.css            # Content image styles
│   ├── loading.css           # Loading indicator
│   ├── debug.css             # Debug panel (dev only)
│   ├── animations.css        # Keyframe animations
│   ├── drag.css              # Drag interaction styles
│   ├── accessibility.css     # Skip-link, focus styles
│   ├── install-prompt.css    # PWA install prompt
│   ├── offline.css           # Offline status indicator
│   ├── bookshelf.css         # Bookshelf screen (multi-book)
│   ├── photo-album.css       # Photo album / lightbox
│   ├── responsive.css        # Mobile/responsive
│   ├── controls/             # UI control panels
│   │   ├── index.css         # Entry + shared styles
│   │   ├── pod-variables.css # Pod-specific CSS variables
│   │   ├── navigation-pod.css # Navigation & progress bar
│   │   ├── settings-pod.css  # Settings panel
│   │   └── audio-pod.css     # Audio controls
│   └── admin/                # Admin panel styles
│       ├── index.css         # Admin entry point
│       ├── base.css          # Admin base styles
│       ├── variables.css     # Admin CSS variables
│       ├── buttons.css       # Button styles
│       ├── modal.css         # Modal dialogs
│       ├── tabs.css          # Tab interface
│       ├── screens.css       # Screen layouts
│       ├── responsive.css    # Admin responsive design
│       ├── book-selector.css # Book selection UI
│       ├── book-upload.css   # Book upload UI
│       ├── chapters.css      # Chapters management
│       ├── fonts.css         # Fonts management
│       ├── sounds.css        # Sounds & ambient sounds management
│       ├── appearance.css    # Appearance customization
│       ├── settings.css      # Settings panel
│       ├── album.css         # Album/gallery management
│       ├── export.css        # Export functionality
│       └── toast.css         # Toast notifications
│
├── js/                        # JavaScript modules
│   ├── index.js              # Reader application entry point
│   ├── config.js             # Configuration (admin-aware, multi-book)
│   │
│   ├── utils/                # Low-level utilities
│   │   ├── CSSVariables.js   # Read CSS custom properties
│   │   ├── MediaQueryManager.js  # Reactive media queries
│   │   ├── EventEmitter.js   # Observer pattern implementation
│   │   ├── EventListenerManager.js  # Event listener cleanup
│   │   ├── TimerManager.js   # Debounced timers
│   │   ├── LRUCache.js       # Page DOM caching
│   │   ├── TransitionHelper.js  # CSS transition promises
│   │   ├── HTMLSanitizer.js  # XSS protection
│   │   ├── ErrorHandler.js   # Centralized error handling
│   │   ├── StorageManager.js # localStorage abstraction
│   │   ├── SoundManager.js   # Audio playback control
│   │   ├── AmbientManager.js # Background music
│   │   ├── RateLimiter.js    # Call rate limiting
│   │   ├── InstallPrompt.js  # PWA install prompt
│   │   ├── OfflineIndicator.js   # Offline status indicator
│   │   ├── ScreenReaderAnnouncer.js # Screen reader announcements (a11y)
│   │   └── PhotoLightbox.js  # Photo album lightbox
│   │
│   ├── managers/             # Business logic & data
│   │   ├── BookStateMachine.js    # State machine (CLOSED→OPENING→OPENED⇄FLIPPING)
│   │   ├── SettingsManager.js     # User preferences (persistent)
│   │   ├── BackgroundManager.js   # Chapter background images
│   │   ├── ContentLoader.js       # Fetch chapter HTML
│   │   └── AsyncPaginator.js      # CSS multi-column pagination
│   │
│   ├── core/                 # Application orchestration
│   │   ├── BookController.js      # Main coordinator (DI container)
│   │   ├── ComponentFactory.js    # Factory pattern
│   │   ├── DOMManager.js          # DOM element references
│   │   ├── BookRenderer.js        # Page rendering (double buffering)
│   │   ├── BookAnimator.js        # CSS animation orchestration
│   │   ├── EventController.js     # Input handling
│   │   ├── LoadingIndicator.js    # Loading UI
│   │   ├── DebugPanel.js          # Development tools
│   │   ├── AppInitializer.js      # Startup logic
│   │   ├── SubscriptionManager.js # Event subscriptions
│   │   ├── ResizeHandler.js       # Window resize
│   │   ├── DelegateMediator.js    # Delegate communication
│   │   ├── BookshelfScreen.js     # Bookshelf display (multi-book)
│   │   │
│   │   ├── services/              # Service groups (DI bundles)
│   │   │   ├── CoreServices.js        # DOM, events, timers, storage
│   │   │   ├── AudioServices.js       # Sounds & ambient
│   │   │   ├── RenderServices.js      # Rendering & animations
│   │   │   └── ContentServices.js     # Loading & pagination
│   │   │
│   │   └── delegates/             # Responsibility delegation
│   │       ├── BaseDelegate.js        # Abstract base
│   │       ├── NavigationDelegate.js  # Page flip logic
│   │       ├── SettingsDelegate.js    # Settings UI
│   │       ├── LifecycleDelegate.js   # Book open/close
│   │       ├── ChapterDelegate.js     # Chapter switching
│   │       ├── DragDelegate.js        # Touch drag coordination
│   │       ├── DragAnimator.js        # Drag rotation animation
│   │       ├── DragDOMPreparer.js     # Drag DOM setup
│   │       └── DragShadowRenderer.js  # Drag shadow effects
│   │
│   └── admin/                 # Admin panel
│       ├── index.js               # Admin entry point
│       ├── AdminConfigStore.js    # Persistent admin config storage
│       ├── BookParser.js          # Book parsing dispatch
│       ├── modules/               # Admin functional modules
│       │   ├── BaseModule.js          # Abstract module base
│       │   ├── AlbumManager.js        # Photo album management
│       │   ├── AmbientsModule.js      # Ambient sounds config
│       │   ├── AppearanceModule.js    # Book appearance customization
│       │   ├── BookUploadManager.js   # Book upload handling
│       │   ├── ChaptersModule.js      # Chapter management
│       │   ├── ExportModule.js        # Config export
│       │   ├── FontsModule.js         # Font management
│       │   ├── SettingsModule.js      # Global settings
│       │   └── SoundsModule.js        # Sound effects management
│       └── parsers/               # Book format parsers
│           ├── parserUtils.js         # Shared parser utilities
│           ├── TxtParser.js           # Plain text (.txt)
│           ├── DocParser.js           # Word 97-2003 (.doc)
│           ├── DocxParser.js          # Word (.docx)
│           ├── EpubParser.js          # EPUB (.epub)
│           └── Fb2Parser.js           # FictionBook (.fb2)
│
├── public/                    # Static assets (copied as-is)
│   ├── content/              # Chapter HTML files (part_1.html, etc.)
│   ├── images/               # Backgrounds & illustrations (.webp)
│   ├── fonts/                # Custom fonts (.woff2)
│   ├── icons/                # PWA icons (SVG, PNG, maskable)
│   └── sounds/               # Audio (page-flip.mp3, cover-flip.mp3, ambient/)
│
├── tests/                     # Test suite
│   ├── setup.js              # Test environment setup
│   ├── helpers/              # Test utilities
│   ├── unit/                 # Unit tests (Vitest)
│   │   ├── utils/            # Utility tests
│   │   ├── managers/         # Manager tests
│   │   ├── core/             # Core + delegates + services tests
│   │   └── admin/            # Admin module tests
│   ├── integration/          # Integration tests (Vitest + jsdom)
│   │   ├── smoke.test.js
│   │   ├── flows/            # User flow tests
│   │   ├── lifecycle/        # Lifecycle tests
│   │   └── services/         # Service tests
│   └── e2e/                  # E2E tests (Playwright)
│       ├── fixtures/         # Test fixtures
│       ├── pages/            # Page Object models
│       ├── flows/            # Test scenarios
│       └── performance/      # Performance tests
│
├── scripts/                   # Build scripts
│   └── generate-icons.js     # PWA icon generation (sharp)
│
├── vite.config.js            # Vite configuration
├── vite-plugin-mobile-backgrounds.js # Custom plugin for mobile backgrounds
├── postcss.config.js         # PostCSS (autoprefixer)
├── vitest.config.js          # Vitest configuration
├── playwright.config.js      # Playwright E2E configuration
├── eslint.config.js          # ESLint configuration
├── stylelint.config.js       # Stylelint configuration
├── jsdoc.json                # JSDoc configuration
├── .editorconfig             # Editor code style
└── package.json              # Dependencies & scripts
```

## Architecture

### State Machine

The book operates on a finite state machine (`BookStateMachine.js`):

```
CLOSED → OPENING → OPENED ↔ FLIPPING
                      ↓
                   CLOSING → CLOSED
```

- All state transitions are validated
- Invalid transitions are rejected
- Observers are notified on state change

### Design Patterns Used

| Pattern | Implementation | Purpose |
|---------|---------------|---------|
| **State Machine** | `BookStateMachine.js` | Valid state transitions |
| **Observer** | `EventEmitter.js` | Decoupled communication |
| **Dependency Injection** | `BookController.js` | Testable, loose coupling |
| **Factory** | `ComponentFactory.js` | Centralized creation |
| **Delegate** | `delegates/` folder | Separation of concerns |
| **Mediator** | `DelegateMediator.js` | Delegate communication |
| **Service Groups** | `services/` folder | DI dependency bundles |
| **Double Buffering** | `BookRenderer.js` | Smooth page transitions |
| **LRU Cache** | `LRUCache.js` | Performance optimization |

### Data Flow

```
User Input (click/touch/keyboard)
    ↓
EventController
    ↓
Appropriate Delegate (Navigation, Drag, Settings, etc.)
    ↓
BookController (state update)
    ↓
BookAnimator + BookRenderer (DOM update)
    ↓
DOM + CSS Animations
```

### Key Components

| Component | File | Responsibility |
|-----------|------|----------------|
| BookController | `core/BookController.js` | Main orchestrator, DI container |
| BookStateMachine | `managers/BookStateMachine.js` | State transitions |
| BookRenderer | `core/BookRenderer.js` | Page DOM rendering, buffer swapping |
| BookAnimator | `core/BookAnimator.js` | CSS animation orchestration |
| AsyncPaginator | `managers/AsyncPaginator.js` | Content pagination |
| EventController | `core/EventController.js` | Input handling |
| DelegateMediator | `core/DelegateMediator.js` | Delegate communication |
| BookshelfScreen | `core/BookshelfScreen.js` | Main start screen: bookshelf with context menu (read/edit/delete), mode selector for book creation, per-book reading progress |
| NavigationDelegate | `core/delegates/NavigationDelegate.js` | Page flip logic |
| DragDelegate | `core/delegates/DragDelegate.js` | Touch drag coordination |
| DragAnimator | `core/delegates/DragAnimator.js` | Drag rotation animation |
| DragDOMPreparer | `core/delegates/DragDOMPreparer.js` | Drag DOM setup |
| DragShadowRenderer | `core/delegates/DragShadowRenderer.js` | Drag shadow effects |
| CoreServices | `core/services/CoreServices.js` | DOM, events, timers, storage |
| AudioServices | `core/services/AudioServices.js` | Sounds & ambient |
| RenderServices | `core/services/RenderServices.js` | Rendering & animations |
| ContentServices | `core/services/ContentServices.js` | Loading & pagination |
| PhotoLightbox | `utils/PhotoLightbox.js` | Photo album lightbox |
| AdminConfigStore | `admin/AdminConfigStore.js` | Persistent admin configuration |
| BookParser | `admin/BookParser.js` | Book format parsing dispatch |

## Code Conventions

### Language
- **Comments:** Russian language (bilingual codebase)
- **Code:** English variable/function names
- **Documentation:** Russian in readme.md

### Module Organization
- Each file exports one class/function
- Index files (`index.js`) re-export from folder
- Clear separation: utils → managers → core
- Admin panel code isolated in `js/admin/`

### CSS Architecture
- **Design Tokens:** All magic values in `variables.css`
- **CSS Custom Properties:** Used extensively, readable via `CSSVariables` utility
- **Themes:** Override CSS variables in `themes.css`
- **Import Order:** Variables → Reset → Themes → Components → Animations → Responsive
- **Controls:** Separate `controls/` subdirectory with pod-based architecture
- **Admin:** Separate `admin/` subdirectory with modular styles

### JavaScript Patterns
- ES Modules (import/export)
- Classes for components
- No external frameworks (jszip is the only runtime dependency)
- Async/await for asynchronous operations
- Destructuring in function parameters

### Resource Cleanup
- All event listeners tracked and removed on destroy
- Timer manager clears all timeouts
- Components have `destroy()` methods
- EventEmitter listeners cleaned up

## Configuration

### Main Config (`js/config.js`)

The config system supports two modes:
1. **Default mode** — hardcoded chapters and settings (Tolkien's "The Hobbit")
2. **Admin mode** — chapters, fonts, sounds, appearance loaded from admin config in localStorage (`flipbook-admin-config`)

```javascript
const BASE_URL = import.meta.env.BASE_URL || '/';

// Admin config is loaded from localStorage if available
const adminConfig = loadAdminConfig();  // from 'flipbook-admin-config'
const activeBook = getActiveBook(adminConfig);  // supports multi-book: books[] + activeBookId

export const CONFIG = Object.freeze({
  STORAGE_KEY: "reader-settings",
  COVER_BG: resolveCoverBg(...),        // From admin or default
  COVER_BG_MOBILE: resolveCoverBg(...),

  CHAPTERS,        // From active book or default 3 chapters
  FONTS,           // From admin readingFonts (enabled only) or defaults
  FONTS_LIST,      // Font metadata list for <select> generation
  CUSTOM_FONTS,    // Custom fonts requiring FontFace loading
  DECORATIVE_FONT, // Per-book decorative font (for titles)

  SOUNDS: { pageFlip, bookOpen, bookClose },
  AMBIENT: { none, rain, fireplace, cafe, ... },  // Filtered by visible flag

  DEFAULT_SETTINGS: {
    font: "georgia", fontSize: 18, theme: "light", page: 0,
    soundEnabled: true, soundVolume: 0.3,
    ambientType: 'none', ambientVolume: 0.5,
  },

  APPEARANCE: {
    coverTitle, coverAuthor, fontMin, fontMax,
    light: { coverBgStart, coverBgEnd, coverText, coverBgImage, pageTexture, bgPage, bgApp },
    dark:  { coverBgStart, coverBgEnd, coverText, coverBgImage, pageTexture, bgPage, bgApp },
  },

  SETTINGS_VISIBILITY: {
    fontSize, theme, font, fullscreen, sound, ambient,  // Admin controls which settings are shown
  },

  VIRTUALIZATION: { cacheLimit: 50 },
  LAYOUT: { MIN_PAGE_WIDTH_RATIO: 0.4, SETTLE_DELAY: 100 },
  TIMING: { FLIP_THROTTLE: 100 },
  UI: { ERROR_HIDE_TIMEOUT: 5000 },
  NETWORK: { MAX_RETRIES: 3, INITIAL_RETRY_DELAY: 1000 },
  AUDIO: { VISIBILITY_RESUME_DELAY: 100 },
  TIMING_SAFETY_MARGIN: 100,
});

export const BookState = Object.freeze({
  CLOSED: "closed", OPENING: "opening", OPENED: "opened",
  FLIPPING: "flipping", CLOSING: "closing",
});

export const FlipPhase = Object.freeze({
  LIFT: "lift", ROTATE: "rotate", DROP: "drop", DRAG: "drag",
});

export const Direction = Object.freeze({ NEXT: "next", PREV: "prev" });

export const BoolStr = Object.freeze({ TRUE: "true", FALSE: "false" });
```

### CSS Variables (`css/variables.css`)

```css
:root {
  /* Animation timings */
  --timing-lift: 240ms;           /* Page lift */
  --timing-rotate: 900ms;        /* Page rotation */
  --timing-drop: 160ms;          /* Page drop */
  --timing-cover: 1200ms;        /* Cover open/close */
  --timing-wrap: 300ms;          /* Container expand */
  --timing-transition: 300ms;    /* General transitions */
  --timing-blur: 600ms;          /* Blur placeholder removal */
  --timing-swap-next: 30ms;      /* Buffer swap delay (forward) */
  --timing-swap-prev: 100ms;     /* Buffer swap delay (backward) */
  --timing-resize-debounce: 150ms; /* Resize debounce */

  /* Sizes & thresholds */
  --font-min: 14px;
  --font-max: 22px;
  --font-default: 18px;
  --swipe-threshold: 20px;       /* Min swipe distance */
  --swipe-vertical-limit: 30px;  /* Max vertical deviation */

  /* 3D & shadows */
  --perspective: 1600px;
  --spine-shadow-width: 8px;
  --page-edge-noise: 2.6px;
  --pages-depth: 10px;
  --pages-count: 6;

  /* Pagination */
  --pages-per-flip: 2;
  --pagination-chunk-size: 5;
  --pagination-yield-interval: 16ms;
}
```

### Path Aliases (vite.config.js)

```javascript
'@':        '/js'
'@utils':   '/js/utils'
'@managers':'/js/managers'
'@core':    '/js/core'
'@css':     '/css'
'@images':  '/images'
'@fonts':   '/fonts'
```

## State Management

### Application State (`BookController.state`)

```javascript
{
  index: 0,              // Current page index
  chapterStarts: [0, 45, 90]  // Chapter boundary indices
}
```

### Persisted Settings (`SettingsManager`)

```javascript
{
  font: "georgia",       // Selected font family
  fontSize: 18,          // Font size (14-22px)
  theme: "light",        // light/dark/bw
  page: 0,               // Last read page
  soundEnabled: true,    // Sound effects on/off
  soundVolume: 0.3,      // Volume 0.0-1.0
  ambientType: 'none',   // Background sound type (none/rain/fireplace/cafe)
  ambientVolume: 0.5     // Ambient volume 0.0-1.0
}
```

### Admin Config (`flipbook-admin-config` in localStorage)

```javascript
{
  books: [{ id, cover, chapters, sounds, ambients, appearance, decorativeFont, defaultSettings }],
  activeBookId: "...",
  readingFonts: [{ id, label, family, builtin, enabled, dataUrl }],
  settingsVisibility: { fontSize, theme, font, fullscreen, sound, ambient },
  fontMin: 14,
  fontMax: 22,
}
```

## Testing

### Strategy

| Level | Tool | Purpose |
|-------|------|---------|
| **Unit** | Vitest | Isolated module testing |
| **Integration** | Vitest + jsdom | Component interaction testing |
| **E2E** | Playwright | Full browser testing (Chrome, Firefox, Safari, mobile) |

### Test Structure

```
tests/
├── setup.js              # Test environment setup
├── helpers/
│   ├── testUtils.js      # Unit test utilities
│   └── integrationUtils.js # Integration test utilities
├── unit/                 # Unit tests
│   ├── config.test.js
│   ├── utils/            # All utility tests
│   ├── managers/         # All manager tests
│   ├── core/             # Core, delegates, services tests
│   └── admin/            # Admin module tests (10 files)
├── integration/          # Integration tests
│   ├── smoke.test.js
│   ├── flows/            # User flow tests (12 files)
│   │   ├── navigation, settings, chapters, drag, events
│   │   ├── accessibility, chapterRepagination, settingsRepagination
│   │   ├── dragNavConflict, errorRecovery, fullReadingSession, resizeFlow
│   ├── lifecycle/        # Lifecycle tests
│   └── services/         # Service tests
└── e2e/                  # E2E tests (Playwright)
    ├── fixtures/         # Test fixtures
    ├── pages/            # Page Object models
    ├── flows/            # Test scenarios (reading, navigation, settings, responsive, accessibility)
    └── performance/      # Performance tests
```

### Running Tests

```bash
npm run test:run          # Unit + integration (single run)
npm run test:coverage     # With coverage report
npm run test:e2e          # E2E in all browsers
npm run test:e2e:headed   # E2E with visible browser
```

## Linting

```bash
npm run lint              # ESLint (js/) + Stylelint (css/)
npm run lint:js:fix       # ESLint autofix
npm run lint:css:fix      # Stylelint autofix
```

## Debugging

### Debug Panel
- Enable with `Ctrl+D` (when debug mode is on)
- Shows: State, page count, cache info, memory, listeners

### Development Access
- `window.bookApp` available on localhost
- Console logging with context
- Source maps in production builds

## Common Tasks

### Adding a New Chapter

**Via personal account (recommended):**
1. Open `admin.html` (or click "Редактировать" from the bookshelf context menu)
2. Upload a book file (txt, doc, docx, epub, fb2) or add chapters manually
3. Configure backgrounds and settings
4. Save — config is persisted to localStorage

**Via code (default chapters):**
1. Create HTML file in `public/content/` (e.g., `part_4.html`)
2. Add background images to `public/images/backgrounds/` (desktop + mobile variants)
3. Update the default chapters array in `js/config.js`

### Adding a New Theme

1. Add CSS variables in `css/themes.css`:
   ```css
   [data-theme="sepia"] {
     --bg-primary: #f4ecd8;
     --text-primary: #5b4636;
     /* ... */
   }
   ```
2. Add toggle option in settings panel (HTML in index.html)
3. Update `SettingsDelegate.js` if needed

### Adding a New Font

**Via personal account:** Configure in Fonts section — supports custom font upload (woff2/ttf/otf as data URL).

**Via code:**
1. Add font to `css/typography.css` or import from Google Fonts
2. Update default fonts in `js/config.js` `buildFontsConfig()`
3. Add option to font selector in HTML

### Modifying Animation Timings

Edit CSS variables in `css/variables.css`:
```css
--timing-lift: 240ms;
--timing-rotate: 900ms;
--timing-drop: 160ms;
```

JavaScript reads these via `CSSVariables` utility automatically.

## Build & Deploy

### Production Build

```bash
npm run build:prod    # Creates optimized dist/
```

Build includes:
- Terser minification (removes console.log, console.debug, console.info)
- Gzip + Brotli compression
- Image optimization (Sharp + SVGO via vite-plugin-image-optimizer)
- CSS minification + code splitting
- Manual chunks (utils, managers, delegates)
- PWA Service Worker generation (Workbox)

### GitHub Pages Deployment

Automatic via GitHub Actions on push to `main`:
1. **Lint** — ESLint + Stylelint
2. **Test** — Unit + integration tests (parallel with lint)
3. **Build** — Production build (after lint + test pass)
4. **Deploy** — Upload to GitHub Pages

Manual configuration in `vite.config.js`:
```javascript
const base = mode === 'production' ? '/flipbook/' : '/';
```

## Dependencies

### Runtime
- **jszip** `^3.10.1` — ZIP operations (admin export, docx/epub parsing)

### Dev Dependencies (key)
- **vite** `^5.0.0` — Bundler
- **vitest** `^4.0.18` — Unit/integration testing
- **@playwright/test** `^1.58.1` — E2E testing
- **eslint** `^9.39.2` — JS linting
- **stylelint** `^17.1.1` — CSS linting
- **sharp** `^0.34.5` — Image processing (icon generation)
- **vite-plugin-pwa** `^1.2.0` — PWA/Service Worker support

## Important Considerations

### Performance
- LRU cache limits DOM parsing overhead (default: 50 pages)
- Only visible pages are rendered
- CSS animations are GPU-accelerated
- Resize handling is debounced
- Mobile-specific background images for smaller payloads

### Browser Support
- Modern browsers only (ES Modules required)
- CSS 3D transforms with `-webkit-` prefixes
- No IE11 support
- Browserslist: last 2 versions of Chrome, Firefox, Safari, Edge

### Accessibility
- Skip navigation link
- ARIA labels on main book region
- `aria-live="polite"` on page content
- `ScreenReaderAnnouncer` for dynamic content updates
- Keyboard navigation (arrows, Home, End)
- Semantic HTML structure
- Dedicated `accessibility.css` for focus styles

### Security
- `HTMLSanitizer.js` for XSS protection
- Content loaded from same origin only
- Content Security Policy meta tag in `index.html`

### PWA
- Service Worker with auto-update (Workbox via vite-plugin-pwa)
- Offline access — precaching of JS, CSS, HTML, fonts
- Runtime caching: images (30 days, 60 entries), audio (30 days, 15 entries)
- Installable on desktop and mobile
- Icons: SVG, 192px PNG, 512px PNG, 512px maskable PNG

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` / `→` | Previous / Next page |
| `Home` | Go to beginning |
| `End` | Go to end |
| `Ctrl+D` | Toggle debug panel |
