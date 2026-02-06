# CLAUDE.md - AI Assistant Guide for Flipbook

This document provides essential context for AI assistants working on this codebase.

## Project Overview

**Flipbook** is an interactive e-book reader web application with realistic 3D page-flip animations. Built with vanilla JavaScript (ES Modules) and CSS, using Vite as the build tool.

**Key Features:**
- 3D page flip animations with realistic physics
- Multi-chapter support (currently 3 chapters of Tolkien's "The Hobbit" in Russian)
- Customizable reading experience (fonts, sizes, themes, sounds)
- Responsive design (desktop & mobile)
- Background ambient sounds (rain, fireplace, cafe)
- Page-turn sound effects
- Persistent user settings via localStorage
- PWA — installable as native app, offline access via Service Worker

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
├── index.html                 # Entry HTML file
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
│   ├── responsive.css        # Mobile/responsive
│   └── controls/             # UI control panels
│       ├── index.css         # Entry + shared styles
│       ├── pod-variables.css # Pod-specific CSS variables
│       ├── navigation-pod.css # Navigation & progress bar
│       ├── settings-pod.css  # Settings panel
│       └── audio-pod.css     # Audio controls
│
├── js/                        # JavaScript modules
│   ├── index.js              # Application entry point
│   ├── config.js             # Configuration constants
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
│   │   └── ScreenReaderAnnouncer.js # Screen reader announcements (a11y)
│   │
│   ├── managers/             # Business logic & data
│   │   ├── BookStateMachine.js    # State machine (CLOSED→OPENING→OPENED⇄FLIPPING)
│   │   ├── SettingsManager.js     # User preferences (persistent)
│   │   ├── BackgroundManager.js   # Chapter background images
│   │   ├── ContentLoader.js       # Fetch chapter HTML
│   │   └── AsyncPaginator.js      # CSS multi-column pagination
│   │
│   └── core/                 # Application orchestration
│       ├── BookController.js      # Main coordinator (DI container)
│       ├── ComponentFactory.js    # Factory pattern
│       ├── DOMManager.js          # DOM element references
│       ├── BookRenderer.js        # Page rendering (double buffering)
│       ├── BookAnimator.js        # CSS animation orchestration
│       ├── EventController.js     # Input handling
│       ├── LoadingIndicator.js    # Loading UI
│       ├── DebugPanel.js          # Development tools
│       ├── AppInitializer.js      # Startup logic
│       ├── SubscriptionManager.js # Event subscriptions
│       ├── ResizeHandler.js       # Window resize
│       ├── DelegateMediator.js    # Delegate communication
│       │
│       ├── services/              # Service groups (DI bundles)
│       │   ├── CoreServices.js        # DOM, events, timers, storage
│       │   ├── AudioServices.js       # Sounds & ambient
│       │   ├── RenderServices.js      # Rendering & animations
│       │   └── ContentServices.js     # Loading & pagination
│       │
│       └── delegates/             # Responsibility delegation
│           ├── BaseDelegate.js        # Abstract base
│           ├── NavigationDelegate.js  # Page flip logic
│           ├── SettingsDelegate.js    # Settings UI
│           ├── LifecycleDelegate.js   # Book open/close
│           ├── ChapterDelegate.js     # Chapter switching
│           ├── DragDelegate.js        # Touch drag coordination
│           ├── DragAnimator.js        # Drag rotation animation
│           ├── DragDOMPreparer.js     # Drag DOM setup
│           └── DragShadowRenderer.js  # Drag shadow effects
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
│   ├── integration/          # Integration tests (Vitest + jsdom)
│   └── e2e/                  # E2E tests (Playwright)
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
| NavigationDelegate | `core/delegates/NavigationDelegate.js` | Page flip logic |
| DragDelegate | `core/delegates/DragDelegate.js` | Touch drag coordination |
| DragAnimator | `core/delegates/DragAnimator.js` | Drag rotation animation |
| DragDOMPreparer | `core/delegates/DragDOMPreparer.js` | Drag DOM setup |
| DragShadowRenderer | `core/delegates/DragShadowRenderer.js` | Drag shadow effects |
| CoreServices | `core/services/CoreServices.js` | DOM, events, timers, storage |
| AudioServices | `core/services/AudioServices.js` | Sounds & ambient |
| RenderServices | `core/services/RenderServices.js` | Rendering & animations |
| ContentServices | `core/services/ContentServices.js` | Loading & pagination |

## Code Conventions

### Language
- **Comments:** Russian language (bilingual codebase)
- **Code:** English variable/function names
- **Documentation:** Russian in readme.md

### Module Organization
- Each file exports one class/function
- Index files (`index.js`) re-export from folder
- Clear separation: utils → managers → core

### CSS Architecture
- **Design Tokens:** All magic values in `variables.css`
- **CSS Custom Properties:** Used extensively, readable via `CSSVariables` utility
- **Themes:** Override CSS variables in `themes.css`
- **Import Order:** Variables → Reset → Themes → Components → Animations → Responsive
- **Controls:** Separate `controls/` subdirectory with pod-based architecture

### JavaScript Patterns
- ES Modules (import/export)
- Classes for components
- No external frameworks
- Async/await for asynchronous operations
- Destructuring in function parameters

### Resource Cleanup
- All event listeners tracked and removed on destroy
- Timer manager clears all timeouts
- Components have `destroy()` methods
- EventEmitter listeners cleaned up

## Configuration

### Main Config (`js/config.js`)

```javascript
const BASE_URL = import.meta.env.BASE_URL || '/';

export const CONFIG = Object.freeze({
  STORAGE_KEY: "reader-settings",
  COVER_BG: `${BASE_URL}images/backgrounds/bg-cover.webp`,
  COVER_BG_MOBILE: `${BASE_URL}images/backgrounds/bg-cover-mobile.webp`,
  CHAPTERS: [
    {
      id: "part_1",
      file: `${BASE_URL}content/part_1.html`,
      bg: `${BASE_URL}images/backgrounds/part_1.webp`,
      bgMobile: `${BASE_URL}images/backgrounds/part_1-mobile.webp`,
    },
    // part_2, part_3...
  ],
  FONTS: {
    georgia: "Georgia, serif",
    merriweather: '"Merriweather", serif',
    "libre-baskerville": '"Libre Baskerville", serif',
    inter: "Inter, sans-serif",
    roboto: "Roboto, sans-serif",
    "open-sans": '"Open Sans", sans-serif',
  },
  SOUNDS: {
    pageFlip: `${BASE_URL}sounds/page-flip.mp3`,
    bookOpen: `${BASE_URL}sounds/cover-flip.mp3`,
    bookClose: `${BASE_URL}sounds/cover-flip.mp3`,
  },
  AMBIENT: {
    none: { label: "Без звука", icon: "✕", file: null },
    rain: { label: "Дождь", icon: "🌧️", file: `${BASE_URL}sounds/ambient/rain.mp3` },
    fireplace: { label: "Камин", icon: "🔥", file: `${BASE_URL}sounds/ambient/fireplace.mp3` },
    cafe: { label: "Кафе", icon: "☕", file: `${BASE_URL}sounds/ambient/cafe.mp3` },
  },
  DEFAULT_SETTINGS: { /* ... */ },
  VIRTUALIZATION: { cacheLimit: 12 },
  // ...
});

export const BookState = Object.freeze({
  CLOSED: "closed", OPENING: "opening", OPENED: "opened",
  FLIPPING: "flipping", CLOSING: "closing",
});

export const FlipPhase = Object.freeze({
  LIFT: "lift", ROTATE: "rotate", DROP: "drop", DRAG: "drag",
});

export const Direction = Object.freeze({ NEXT: "next", PREV: "prev" });
```

### CSS Variables (`css/variables.css`)

```css
:root {
  --timing-lift: 240ms;      /* Page lift animation */
  --timing-rotate: 900ms;    /* Page rotation */
  --timing-drop: 160ms;      /* Page drop */
  --timing-cover: 1200ms;    /* Cover open/close */
  --timing-wrap: 300ms;      /* Container expand */
  --timing-transition: 300ms; /* General transitions */
  --font-min: 14px;
  --font-max: 22px;
  --font-default: 18px;      /* Default font size */
  --swipe-threshold: 20px;   /* Touch swipe sensitivity */
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
├── integration/          # Integration tests
│   ├── smoke.test.js
│   ├── flows/            # User flow tests
│   ├── lifecycle/        # Lifecycle tests
│   └── services/         # Service tests
└── e2e/                  # E2E tests (Playwright)
    ├── fixtures/         # Test fixtures
    ├── pages/            # Page Object models
    ├── flows/            # Test scenarios
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

1. Create HTML file in `public/content/` (e.g., `part_4.html`)
2. Add background images to `public/images/backgrounds/` (desktop + mobile variants)
3. Update `CONFIG.CHAPTERS` in `js/config.js`:
   ```javascript
   {
     id: "part_4",
     file: `${BASE_URL}content/part_4.html`,
     bg: `${BASE_URL}images/backgrounds/part_4.webp`,
     bgMobile: `${BASE_URL}images/backgrounds/part_4-mobile.webp`,
   }
   ```

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

1. Add font to `css/typography.css` or import from Google Fonts
2. Update `CONFIG.FONTS` in `js/config.js`
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
- Image optimization (imagemin)
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

## Important Considerations

### Performance
- LRU cache limits DOM parsing overhead (default: 12 pages)
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
