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

**Live Demo:** Deployed to GitHub Pages at `/flipbook/`

## Quick Reference

### Essential Commands

```bash
npm run dev          # Start dev server (port 3000, auto-opens browser)
npm run build        # Production build to dist/
npm run preview      # Preview production build locally
npm run build:prod   # Clean + build (recommended for production)
npm run size         # Check dist folder size
npm run docs         # Generate API documentation to docs/
npm run docs:serve   # Generate and serve docs on port 3001
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
│   ├── controls.css          # UI controls
│   ├── loading.css           # Loading indicator
│   ├── debug.css             # Debug panel (dev only)
│   ├── animations.css        # Keyframe animations
│   ├── drag.css              # Drag interaction styles
│   └── responsive.css        # Mobile/responsive
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
│   │   └── AmbientManager.js # Background music
│   │
│   ├── managers/             # Business logic & data
│   │   ├── BookStateMachine.js    # State machine (CLOSED→OPENING→OPENED⇄FLIPPING)
│   │   ├── SettingsManager.js     # User preferences (persistent)
│   │   ├── BackgroundManager.js   # Chapter background images
│   │   ├── ContentLoader.js       # Fetch chapter HTML
│   │   └── AsyncPaginator.js      # CSS multi-column pagination
│   │
│   └── core/                 # Application orchestration
│       ├── BookController.js # Main coordinator (DI container)
│       ├── ComponentFactory.js   # Factory pattern
│       ├── DOMManager.js     # DOM element references
│       ├── BookRenderer.js   # Page rendering (double buffering)
│       ├── BookAnimator.js   # CSS animation orchestration
│       ├── EventController.js    # Input handling
│       ├── LoadingIndicator.js   # Loading UI
│       ├── DebugPanel.js     # Development tools
│       ├── AppInitializer.js # Startup logic
│       ├── SubscriptionManager.js   # Event subscriptions
│       ├── ResizeHandler.js  # Window resize
│       │
│       └── delegates/        # Responsibility delegation
│           ├── BaseDelegate.js       # Abstract base
│           ├── NavigationDelegate.js # Page flip logic
│           ├── SettingsDelegate.js   # Settings UI
│           ├── LifecycleDelegate.js  # Book open/close
│           ├── ChapterDelegate.js    # Chapter switching
│           └── DragDelegate.js       # Touch drag
│
├── public/                    # Static assets (copied as-is)
│   ├── content/              # Chapter HTML files (part_1.html, etc.)
│   ├── images/               # Backgrounds & illustrations (.webp)
│   ├── fonts/                # Custom fonts (.woff2)
│   └── sounds/               # Audio (page-flip.mp3, ambient/)
│
├── vite.config.js            # Vite configuration
├── postcss.config.js         # PostCSS (autoprefixer)
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
| NavigationDelegate | `core/delegates/NavigationDelegate.js` | Page flip logic |

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
export const CONFIG = {
  CHAPTERS: [
    { id: "ch1", file: "content/part_1.html", bg: "images/backgrounds/part_1.webp" },
    // ...
  ],
  FONTS: {
    georgia: "Georgia, serif",
    merriweather: "'Merriweather', serif",
    // ...
  },
  // ...
};
```

### CSS Variables (`css/variables.css`)

```css
:root {
  --timing-lift: 240ms;      /* Page lift animation */
  --timing-rotate: 900ms;    /* Page rotation */
  --timing-drop: 160ms;      /* Page drop */
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
  ambientType: 'rain',   // Background sound type
  ambientVolume: 0.5     // Ambient volume 0.0-1.0
}
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
2. Add background image to `public/images/backgrounds/`
3. Update `CONFIG.CHAPTERS` in `js/config.js`:
   ```javascript
   { id: "ch4", file: "content/part_4.html", bg: "images/backgrounds/part_4.webp" }
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
- Terser minification (removes console.log, debugger)
- Gzip + Brotli compression
- Image optimization
- CSS minification
- Code splitting (utils, managers, delegates chunks)

### GitHub Pages Deployment

Automatic via GitHub Actions on push to `main`:
1. Checkout → Setup Node → Install → Build → Deploy

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

### Browser Support
- Modern browsers only (ES Modules required)
- CSS 3D transforms with `-webkit-` prefixes
- No IE11 support

### Accessibility
- ARIA labels on main book region
- `aria-live="polite"` on page content
- Keyboard navigation (arrows, Home, End)
- Semantic HTML structure

### Security
- `HTMLSanitizer.js` for XSS protection
- Content loaded from same origin only

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` / `→` | Previous / Next page |
| `Home` | Go to beginning |
| `End` | Go to end |
| `Ctrl+D` | Toggle debug panel |

## File Size Reference

Total codebase: ~5,200 lines (JS + CSS)
Production build: ~500KB-1MB (compressed)
