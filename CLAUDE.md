# CLAUDE.md - AI Assistant Guide for Flipbook

This document provides essential context for AI assistants working on this codebase.

## Project Overview

**Flipbook** is an interactive e-book reader web application with realistic 3D page-flip animations. Built with vanilla JavaScript (ES Modules) and CSS, using Vite as the build tool. Features a backend server (Express + Prisma + PostgreSQL) with user authentication, and an admin panel for managing multiple books, chapters, fonts, sounds, and appearance customization.

**Key Features:**
- 3D page flip animations with realistic physics
- Multi-chapter support (default: 3 chapters of Tolkien's "The Hobbit" in Russian)
- Landing page for guests with public book discovery
- Bookshelf as the main screen — book cards with context menu (read / edit / delete)
- Account screen (SPA) for book management (upload, chapters, fonts, sounds, appearance, export) and user profile
- User profiles — username, display name, bio, avatar; public author shelves
- Backend server with REST API, user authentication (email/password + Google OAuth), S3 file storage
- Public book discovery — browse recently published books, view author shelves
- Multi-book support with per-book reading progress (Continue Reading button)
- Internationalization (i18n) — 5 languages: Russian, English, Spanish, French, German (via i18next)
- SPA routing via History API (Router utility)
- Customizable reading experience (fonts, sizes, themes, sounds)
- Per-book appearance customization (cover colors, page textures, decorative fonts)
- Responsive design (desktop & mobile)
- Background ambient sounds (rain, fireplace, cafe) — configurable via account panel
- Page-turn sound effects — configurable via account panel
- Photo album / lightbox with cropping tool
- Dual persistence: localStorage/IndexedDB (offline) or server API (authenticated)
- Data migration from localStorage to server on first login
- PWA — installable as native app, offline access via Service Worker
- Book import from txt, doc, docx, epub, fb2 formats
- WYSIWYG chapter editor (Quill) with formatting, tables, and images
- Mobile swipe hint for first-time users
- Error monitoring via Sentry (client + server)
- K6 load testing suite (smoke, load, stress, spike, soak scenarios)
- Reading sessions tracking (pages read, duration, per-book analytics)
- Web Vitals performance monitoring (LCP, FID, CLS via web-vitals)
- Prometheus metrics endpoint for server monitoring
- Lighthouse CI quality gates (performance, accessibility, best practices, SEO)
- Security scanning (npm audit + Trivy for Docker images)
- SEO support (robots.txt, sitemap.xml, server-side SEO service)

**Live Demo:** Deployed to GitHub Pages at `/flipbook/`

## Quick Reference

### Essential Commands

```bash
# Frontend Development
npm run dev          # Start dev server (port 3000, auto-opens browser, proxies /api → :4000)
npm run build        # Production build to dist/
npm run preview      # Preview production build locally (port 4173)
npm run build:prod   # Clean + build (recommended for production)
npm run build:analyze # Build with bundle analysis
npm run clean        # Remove dist/ folder
npm run size         # Check dist folder size
npm run serve        # Serve dist/ with static server

# Backend Development (from server/)
cd server && npm run dev       # Start backend dev server (port 4000, tsx watch)
cd server && npm run db:migrate # Run Prisma migrations
cd server && npm run db:seed    # Seed database with test data
cd server && npm run db:studio  # Open Prisma Studio GUI
cd server && npm run db:backup  # Backup PostgreSQL database
cd server && npm run test       # Run server tests (Vitest + supertest)

# Docker (full stack)
docker compose up -d           # Start PostgreSQL + MinIO + server

# Frontend Testing
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

# K6 Load Testing
npm run test:k6:smoke   # Smoke test (2 VU, 30s)
npm run test:k6:load    # Load test (up to 50 VU, 5 min)
npm run test:k6:stress  # Stress test (up to 200 VU, 10 min)
npm run test:k6:spike   # Spike test (10→200 VU instant)
npm run test:k6:soak    # Soak test (30 VU, 30 min)
npm run test:k6:docker:smoke   # Docker-based smoke test
npm run test:k6:docker:load    # Docker-based load test
npm run test:k6:docker:stress  # Docker-based stress test

# Infrastructure & Observability
npm run infra:observability    # Start Loki + Grafana + DB backup stack
npm run infra:backup           # Run manual database backup
cd server && npm run db:backup # Alternative: backup via server script

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
- PostgreSQL 17+ (via Docker or local) — for backend
- Docker & Docker Compose — for local full-stack development

## Directory Structure

```
flipbook/
├── index.html                 # Main entry — landing + bookshelf + reader + account (SPA)
├── html/                      # HTML partials (build-time includes)
│   └── partials/
│       ├── admin/             # Admin panel partials
│       │   ├── editor-appearance.html
│       │   ├── editor-chapters.html
│       │   ├── editor-cover.html
│       │   ├── editor-defaults.html
│       │   ├── editor-sounds.html
│       │   ├── export-panel.html
│       │   ├── modal-ambient.html
│       │   ├── modal-chapter.html
│       │   ├── modal-reading-font.html
│       │   └── platform-settings.html
│       └── reader/            # Reader partials
│           ├── landing.html       # Landing screen (guests)
│           ├── bookshelf.html
│           ├── account.html       # Account management screen
│           ├── book-container.html
│           ├── controls.html
│           ├── pwa.html
│           └── templates.html
│
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
│   ├── auth.css              # Auth modal (login/register)
│   ├── install-prompt.css    # PWA install prompt
│   ├── offline.css           # Offline status indicator
│   ├── bookshelf.css         # Bookshelf screen (multi-book)
│   ├── landing.css           # Landing page (guests)
│   ├── embed.css             # Embedded reader mode
│   ├── photo-album.css       # Photo album / lightbox
│   ├── swipe-hint.css        # Mobile swipe hint
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
│       ├── cropper.css       # Photo cropper overlay
│       ├── editor.css        # Quill WYSIWYG editor styles
│       ├── export.css        # Export functionality
│       ├── profile.css       # User profile management
│       └── toast.css         # Toast notifications
│
├── js/                        # JavaScript modules
│   ├── index.js              # Reader application entry point
│   ├── config.js             # Configuration (multi-source: localStorage / API)
│   ├── sentry.js             # Sentry error monitoring initialization
│   │
│   ├── config/              # Configuration helpers (extracted from config.js)
│   │   ├── configHelpers.js     # Pure helpers: path resolution, fonts, ambients
│   │   └── enrichConfigFromIDB.js # IndexedDB data enrichment for config
│   │
│   ├── i18n/                 # Internationalization (i18next)
│   │   ├── index.js              # i18n initialization & helpers (initI18n, t, setLanguage, applyTranslations)
│   │   └── locales/              # Translation files
│   │       ├── index.js          # Locales entry point
│   │       ├── ru.js             # Russian
│   │       ├── en.js             # English
│   │       ├── es.js             # Spanish
│   │       ├── fr.js             # French
│   │       └── de.js             # German
│   │
│   ├── utils/                # Low-level utilities
│   │   ├── Analytics.js      # Web Vitals performance monitoring (LCP, FID, CLS)
│   │   ├── ApiClient.js      # HTTP API client (server communication)
│   │   ├── CSSVariables.js   # Read CSS custom properties
│   │   ├── MediaQueryManager.js  # Reactive media queries
│   │   ├── EventEmitter.js   # Observer pattern implementation
│   │   ├── EventListenerManager.js  # Event listener cleanup
│   │   ├── TimerManager.js   # Debounced timers
│   │   ├── LRUCache.js       # Page DOM caching
│   │   ├── TransitionHelper.js  # CSS transition promises
│   │   ├── HTMLSanitizer.js  # XSS protection (DOMPurify engine)
│   │   ├── ErrorHandler.js   # Centralized error handling
│   │   ├── StorageManager.js # localStorage abstraction
│   │   ├── IdbStorage.js     # IndexedDB wrapper for large data
│   │   ├── SettingsValidator.js # Settings validation & sanitization
│   │   ├── RateLimiter.js    # Call rate limiting
│   │   ├── Router.js         # SPA router (History API)
│   │   ├── InstallPrompt.js  # PWA install prompt
│   │   ├── OfflineIndicator.js   # Offline status indicator
│   │   ├── ScreenReaderAnnouncer.js # Screen reader announcements (a11y)
│   │   ├── SwipeHint.js      # Mobile swipe gesture hint
│   │   └── PhotoLightbox.js  # Photo album lightbox
│   │
│   ├── routes/               # SPA route handlers
│   │   └── handlers.js       # Route handler functions for Router
│   │
│   ├── managers/             # Business logic & data
│   │   ├── BookStateMachine.js    # State machine (CLOSED→OPENING→OPENED⇄FLIPPING)
│   │   ├── SettingsManager.js     # User preferences (persistent)
│   │   ├── BackgroundManager.js   # Chapter background images
│   │   ├── ContentLoader.js       # Fetch chapter HTML
│   │   ├── AsyncPaginator.js      # CSS multi-column pagination
│   │   ├── SoundManager.js        # Audio playback control
│   │   └── AmbientManager.js      # Background ambient music
│   │
│   ├── core/                 # Application orchestration
│   │   ├── BookController.js      # Main coordinator (DI container)
│   │   ├── BookControllerBuilder.js # DI graph construction (services, components, delegates)
│   │   ├── BookDIConfig.js        # DI wiring configuration for delegates
│   │   ├── ComponentFactory.js    # Factory pattern
│   │   ├── DOMManager.js          # DOM element references
│   │   ├── BookRenderer.js        # Page rendering (double buffering)
│   │   ├── BookAnimator.js        # CSS animation orchestration
│   │   ├── EventController.js     # Input handling
│   │   ├── SettingsBindings.js    # Settings UI bindings (font, theme, sound, fullscreen)
│   │   ├── LoadingIndicator.js    # Loading UI
│   │   ├── DebugPanel.js          # Development tools
│   │   ├── AppInitializer.js      # Startup logic
│   │   ├── AuthModal.js           # Login/register modal (email + Google OAuth)
│   │   ├── MigrationHelper.js     # localStorage → server data migration
│   │   ├── SubscriptionManager.js # Event subscriptions
│   │   ├── ResizeHandler.js       # Window resize
│   │   ├── DelegateMediator.js    # Delegate communication
│   │   ├── BookshelfScreen.js     # Bookshelf display (multi-book)
│   │   ├── LandingScreen.js       # Landing page for guests (public book showcase)
│   │   ├── AccountScreen.js       # Personal account management (books, profile, settings, export)
│   │   ├── AccountScreenUI.js     # Account screen UI rendering helpers
│   │   ├── AccountPublishTab.js   # Book publishing tab (visibility, description)
│   │   ├── ProfileHeader.js       # Profile header component (avatar, name, bio)
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
│   │       ├── DragShadowRenderer.js  # Drag shadow effects
│   │       ├── AudioController.js     # Audio & ambient sound control
│   │       ├── FontController.js      # Font selection operations
│   │       └── ThemeController.js     # Theme switching operations
│   │
│   └── admin/                 # Admin panel
│       ├── index.js               # Admin entry point
│       ├── AdminConfigStore.js    # Persistent admin config (localStorage/IndexedDB)
│       ├── ServerAdminConfigStore.js # Server-backed admin config (API adapter)
│       ├── AdminConfigDefaults.js # Pure defaults constants
│       ├── AdminConfigMigration.js # Config schema validation & normalization
│       ├── AdminConfigStrip.js    # Config data URL stripping for localStorage
│       ├── ServerConfigOperations.js # Server config CRUD operations
│       ├── BookParser.js          # Book parsing dispatch
│       ├── modeCardsData.js       # Book creation mode cards data
│       ├── modules/               # Admin functional modules
│       │   ├── BaseModule.js          # Abstract module base
│       │   ├── adminHelpers.js        # Shared admin helper functions
│       │   ├── albumConstants.js      # Album configuration constants
│       │   ├── AlbumManager.js        # Photo album management
│       │   ├── AlbumHtmlBuilder.js    # Album HTML generation
│       │   ├── AlbumImageProcessor.js # Album image processing & upload
│       │   ├── AlbumPageRenderer.js   # Album page rendering
│       │   ├── AmbientsModule.js      # Ambient sounds config
│       │   ├── AppearanceModule.js    # Book appearance customization
│       │   ├── BookUploadManager.js   # Book upload handling
│       │   ├── ChaptersModule.js      # Chapter management
│       │   ├── ExportModule.js        # Config export
│       │   ├── FontsModule.js         # Font management
│       │   ├── PhotoCropper.js        # Interactive photo cropping tool
│       │   ├── ProfileModule.js       # User profile editing (username, bio, avatar)
│       │   ├── QuillEditorWrapper.js  # Quill WYSIWYG editor wrapper
│       │   ├── SettingsModule.js      # Global settings
│       │   └── SoundsModule.js        # Sound effects management
│       └── parsers/               # Book format parsers
│           ├── BaseParser.js          # Abstract base parser
│           ├── parserUtils.js         # Shared parser utilities
│           ├── TxtParser.js           # Plain text (.txt)
│           ├── DocParser.js           # Word 97-2003 (.doc)
│           ├── DocxParser.js          # Word (.docx)
│           ├── EpubParser.js          # EPUB (.epub)
│           ├── Fb2Parser.js           # FictionBook (.fb2)
│           └── OLE2Parser.js          # OLE2 binary format parser (for .doc)
│
├── server/                    # Backend server (Express + Prisma + PostgreSQL)
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── prisma/
│   │   ├── schema.prisma         # Database schema (16 models)
│   │   ├── seed.ts               # Database seeding
│   │   └── migrations/           # Prisma migrations
│   ├── src/
│   │   ├── index.ts              # Server entry point
│   │   ├── app.ts                # Express app setup
│   │   ├── config.ts             # Environment config (Zod validated)
│   │   ├── swagger.ts            # OpenAPI/Swagger docs
│   │   ├── schemas.ts            # Zod request/response schemas
│   │   ├── middleware/           # Express middleware
│   │   │   ├── auth.ts               # Passport auth (local + Google OAuth)
│   │   │   ├── bookOwnership.ts      # Book ownership verification
│   │   │   ├── csrf.ts               # CSRF protection
│   │   │   ├── errorHandler.ts       # Error handling
│   │   │   ├── metrics.ts             # Prometheus metrics collection
│   │   │   ├── rateLimit.ts          # Rate limiting
│   │   │   ├── upload.ts             # File upload (Multer → S3)
│   │   │   └── validate.ts           # Zod validation middleware
│   │   ├── routes/               # API route handlers
│   │   │   ├── auth.routes.ts        # POST /api/auth/*
│   │   │   ├── books.routes.ts       # CRUD /api/books
│   │   │   ├── chapters.routes.ts    # CRUD /api/books/:id/chapters
│   │   │   ├── sounds.routes.ts      # PUT /api/books/:id/sounds
│   │   │   ├── ambients.routes.ts    # CRUD /api/books/:id/ambients
│   │   │   ├── appearance.routes.ts  # PUT /api/books/:id/appearance
│   │   │   ├── decorativeFont.routes.ts # PUT /api/books/:id/decorative-font
│   │   │   ├── defaultSettings.routes.ts # PUT /api/books/:id/default-settings
│   │   │   ├── fonts.routes.ts       # CRUD /api/fonts
│   │   │   ├── settings.routes.ts    # GET/PUT /api/settings
│   │   │   ├── progress.routes.ts    # GET/PUT /api/progress
│   │   │   ├── upload.routes.ts      # POST /api/upload
│   │   │   ├── profile.routes.ts     # GET/PUT /api/profile
│   │   │   ├── public.routes.ts      # GET /api/public/* (discovery, shelves)
│   │   │   ├── readingSessions.routes.ts # POST/GET /api/reading-sessions
│   │   │   └── exportImport.routes.ts # GET/POST /api/export, /api/import
│   │   ├── services/             # Business logic (one per resource)
│   │   │   ├── auth.service.ts       # Authentication
│   │   │   ├── books.service.ts      # Book CRUD
│   │   │   ├── chapters.service.ts   # Chapter CRUD
│   │   │   ├── sounds.service.ts     # Sound configuration
│   │   │   ├── ambients.service.ts   # Ambient sounds
│   │   │   ├── appearance.service.ts # Theme appearance
│   │   │   ├── decorativeFont.service.ts # Decorative fonts
│   │   │   ├── defaultSettings.service.ts # Default settings
│   │   │   ├── fonts.service.ts      # Reading fonts
│   │   │   ├── settings.service.ts   # Global settings
│   │   │   ├── progress.service.ts   # Reading progress
│   │   │   ├── upload.service.ts     # File upload
│   │   │   ├── profile.service.ts    # User profile management
│   │   │   ├── public.service.ts     # Public discovery & author shelves
│   │   │   ├── readingSessions.service.ts # Reading session tracking & analytics
│   │   │   ├── seo.service.ts       # SEO metadata generation
│   │   │   └── exportImport.service.ts # Export/import
│   │   ├── parsers/              # Server-side book parsers
│   │   │   ├── BaseParser.ts         # Abstract base parser (shared utilities, error handling)
│   │   │   ├── BookParser.ts         # Parser dispatch
│   │   │   ├── parserUtils.ts        # Shared parser utilities
│   │   │   ├── TxtParser.ts          # Plain text (.txt)
│   │   │   ├── DocParser.ts          # Word 97-2003 (.doc)
│   │   │   ├── DocxParser.ts         # Word (.docx)
│   │   │   ├── EpubParser.ts         # EPUB (.epub)
│   │   │   └── Fb2Parser.ts          # FictionBook (.fb2)
│   │   ├── utils/                # Server utilities
│   │   │   ├── prisma.ts             # Prisma client singleton
│   │   │   ├── storage.ts            # S3 storage operations
│   │   │   ├── sanitize.ts           # HTML sanitization
│   │   │   ├── password.ts           # Password hashing (bcrypt)
│   │   │   ├── logger.ts             # Pino logger (with pino-loki integration)
│   │   │   ├── mappers.ts            # DB→API response mappers
│   │   │   ├── defaults.ts           # Default values
│   │   │   ├── limits.ts             # Upload size limits
│   │   │   ├── ownership.ts          # Ownership check helper
│   │   │   ├── reorder.ts            # Position reordering
│   │   │   ├── response.ts           # Standard JSON response helpers
│   │   │   ├── asyncHandler.ts       # Async Express handler wrapper
│   │   │   ├── serializable.ts       # JSON serialization
│   │   │   └── zodToOpenApi.ts       # Zod→OpenAPI conversion
│   │   └── types/
│   │       └── api.ts                # API type definitions
│   └── tests/                    # Server tests (Vitest + supertest)
│       ├── setup.ts
│       ├── helpers.ts
│       └── *.test.ts                 # Per-resource test files
│
├── k6/                        # K6 load testing suite
│   ├── lib/                  # Shared utilities (auth, checks, config, data, endpoints)
│   ├── flows/                # User flow scripts (reader, author, browsing, admin)
│   └── scenarios/            # Load test scenarios (smoke, load, stress, spike, soak)
│
├── public/                    # Static assets (copied as-is)
│   ├── content/              # Chapter HTML files (part_1.html, etc.)
│   ├── images/               # Backgrounds & illustrations (.webp)
│   ├── fonts/                # Custom fonts (.woff2)
│   ├── icons/                # PWA icons (SVG, PNG, maskable)
│   ├── sounds/               # Audio (page-flip.mp3, cover-flip.mp3, ambient/)
│   ├── robots.txt            # SEO robots directives
│   └── sitemap.xml           # SEO sitemap
│
├── tests/                     # Frontend test suite
│   ├── setup.js              # Test environment setup
│   ├── helpers/              # Test utilities
│   ├── unit/                 # Unit tests (Vitest)
│   │   ├── utils/            # Utility tests (23 files)
│   │   ├── managers/         # Manager tests (5 files)
│   │   ├── core/             # Core + delegates + services tests (20 + 8 + 4 files)
│   │   └── admin/            # Admin module tests (21 files)
│   ├── integration/          # Integration tests (Vitest + jsdom)
│   │   ├── smoke.test.js
│   │   ├── flows/            # User flow tests (24 files)
│   │   ├── lifecycle/        # Lifecycle tests
│   │   └── services/         # Service tests
│   └── e2e/                  # E2E tests (Playwright)
│       ├── fixtures/         # Test fixtures
│       ├── pages/            # Page Object models
│       ├── flows/            # Test scenarios (8 files incl. offline, admin-panel, multi-book)
│       └── performance/      # Performance tests
│
├── scripts/                   # Build & maintenance scripts
│   ├── generate-icons.js     # PWA icon generation (sharp)
│   ├── backup-db.sh          # PostgreSQL backup with retention
│   └── cleanup-s3-orphans.sh # Remove orphaned S3 files not referenced in DB
│
├── infra/                     # Infrastructure configuration
│   ├── loki-config.yaml      # Loki log aggregation config (14-day retention)
│   ├── grafana-datasources.yaml # Grafana data source provisioning
│   ├── grafana-alerting.yaml # Grafana alerting rules provisioning
│   └── prometheus.yaml       # Prometheus scrape config for server metrics
│
├── .github/workflows/         # CI/CD pipelines
│   ├── deploy.yml            # Frontend: Lint → Test → E2E → Build → Deploy (GitHub Pages)
│   ├── server-tests.yml      # Server API tests (PostgreSQL service, Prisma migrations)
│   ├── lighthouse.yml        # Lighthouse CI audit (performance, a11y, SEO)
│   └── security.yml          # Security scanning (npm audit + Trivy Docker scan)
│
├── .husky/                    # Git hooks (pre-commit linting via lint-staged)
├── .nvmrc                     # Node.js version (22)
├── Dockerfile                # Full-stack Docker build (frontend + server)
├── docker-compose.yml        # Docker Compose (PostgreSQL + MinIO + server)
├── docker-compose.k6.yml     # Docker Compose overlay for K6 load testing
├── docker-compose.observability.yml # Docker Compose overlay (Loki + Grafana + DB backup)
├── amvera.yml                # Amvera Cloud deployment config
├── railway.toml              # Railway deployment config
├── DEPLOYMENT.md             # Deployment guide (Amvera + Cloud.ru S3)
├── PROJECT_REVIEW.md         # Project review & analysis document
├── vite.config.js            # Vite configuration
├── vite-plugin-mobile-backgrounds.js # Custom plugin for mobile backgrounds
├── vite-plugin-html-includes.js # Custom plugin for HTML partials
├── postcss.config.js         # PostCSS (autoprefixer)
├── vitest.config.js          # Vitest configuration
├── playwright.config.js      # Playwright E2E configuration
├── eslint.config.js          # ESLint configuration
├── stylelint.config.js       # Stylelint configuration
├── jsdoc.json                # JSDoc configuration
├── lighthouserc.json         # Lighthouse CI configuration (quality thresholds)
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
| **Builder** | `BookControllerBuilder.js` | Phased DI graph construction |
| **Factory** | `ComponentFactory.js` | Centralized creation |
| **Delegate** | `delegates/` folder | Separation of concerns |
| **Mediator** | `DelegateMediator.js` | Delegate communication |
| **Service Groups** | `services/` folder | DI dependency bundles |
| **Double Buffering** | `BookRenderer.js` | Smooth page transitions |
| **LRU Cache** | `LRUCache.js` | Performance optimization |
| **Adapter** | `ServerAdminConfigStore.js` | Same interface, server backend |

### Screen Navigation (SPA Router)

```
Landing (/) ──[auth]──→ Bookshelf (/)
                             │
                    ┌────────┼────────┐
                    ▼        ▼        ▼
              Reader      Account   Public Shelf
           (/book/:id)  (/account)  (/:username)
```

Routes are managed by `Router.js` using History API. Guests see the Landing screen; authenticated users see the Bookshelf.

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
| BookControllerBuilder | `core/BookControllerBuilder.js` | DI graph construction (services → components → delegates) |
| BookDIConfig | `core/BookDIConfig.js` | DI wiring configuration for delegates |
| SettingsBindings | `core/SettingsBindings.js` | Settings UI bindings (font, theme, sound, fullscreen) |
| BookStateMachine | `managers/BookStateMachine.js` | State transitions |
| BookRenderer | `core/BookRenderer.js` | Page DOM rendering, buffer swapping |
| BookAnimator | `core/BookAnimator.js` | CSS animation orchestration |
| AsyncPaginator | `managers/AsyncPaginator.js` | Content pagination |
| EventController | `core/EventController.js` | Input handling |
| DelegateMediator | `core/DelegateMediator.js` | Delegate communication |
| LandingScreen | `core/LandingScreen.js` | Landing page for guests (hero, public book showcase, CTA) |
| BookshelfScreen | `core/BookshelfScreen.js` | Main start screen: bookshelf with context menu (read/edit/delete), mode selector for book creation, per-book reading progress |
| AccountScreen | `core/AccountScreen.js` | Personal account management (books, profile, settings, export tabs) |
| AccountScreenUI | `core/AccountScreenUI.js` | Account screen UI rendering helpers |
| AccountPublishTab | `core/AccountPublishTab.js` | Book publishing tab (visibility, description) |
| ProfileHeader | `core/ProfileHeader.js` | Reusable profile header component (avatar, name, bio) |
| AuthModal | `core/AuthModal.js` | Login/register modal (email + Google OAuth) |
| MigrationHelper | `core/MigrationHelper.js` | localStorage → server data migration |
| NavigationDelegate | `core/delegates/NavigationDelegate.js` | Page flip logic |
| DragDelegate | `core/delegates/DragDelegate.js` | Touch drag coordination |
| DragAnimator | `core/delegates/DragAnimator.js` | Drag rotation animation |
| DragDOMPreparer | `core/delegates/DragDOMPreparer.js` | Drag DOM setup |
| DragShadowRenderer | `core/delegates/DragShadowRenderer.js` | Drag shadow effects |
| AudioController | `core/delegates/AudioController.js` | Audio & ambient sound control |
| FontController | `core/delegates/FontController.js` | Font selection operations |
| ThemeController | `core/delegates/ThemeController.js` | Theme switching operations |
| CoreServices | `core/services/CoreServices.js` | DOM, events, timers, storage |
| AudioServices | `core/services/AudioServices.js` | Sounds & ambient |
| RenderServices | `core/services/RenderServices.js` | Rendering & animations |
| ContentServices | `core/services/ContentServices.js` | Loading & pagination |
| Router | `utils/Router.js` | SPA router (History API: /, /book/:id, /account, /:username, /embed/:id) |
| ApiClient | `utils/ApiClient.js` | HTTP API client (server communication) |
| PhotoLightbox | `utils/PhotoLightbox.js` | Photo album lightbox |
| SwipeHint | `utils/SwipeHint.js` | Mobile swipe gesture hint |
| i18n | `i18n/index.js` | Internationalization (initI18n, t, setLanguage, applyTranslations) |
| AdminConfigStore | `admin/AdminConfigStore.js` | Persistent admin config (localStorage/IndexedDB) |
| ServerAdminConfigStore | `admin/ServerAdminConfigStore.js` | Server-backed admin config (API adapter) |
| AdminConfigDefaults | `admin/AdminConfigDefaults.js` | Pure defaults constants for admin config |
| AdminConfigMigration | `admin/AdminConfigMigration.js` | Config schema validation & normalization |
| AdminConfigStrip | `admin/AdminConfigStrip.js` | Data URL stripping for localStorage snapshots |
| BookParser | `admin/BookParser.js` | Book format parsing dispatch |
| ProfileModule | `admin/modules/ProfileModule.js` | User profile editing (username, bio, avatar) |
| PhotoCropper | `admin/modules/PhotoCropper.js` | Interactive photo cropping tool |
| QuillEditorWrapper | `admin/modules/QuillEditorWrapper.js` | Quill WYSIWYG editor wrapper |
| Analytics | `utils/Analytics.js` | Web Vitals performance monitoring (LCP, FID, CLS) |
| IdbStorage | `utils/IdbStorage.js` | IndexedDB wrapper for large data |
| SettingsValidator | `utils/SettingsValidator.js` | Settings validation & sanitization |
| ServerConfigOperations | `admin/ServerConfigOperations.js` | Server config CRUD operations |

## Backend Architecture (server/)

### Tech Stack
- **Runtime:** Node.js + TypeScript (tsx for dev, tsc for build)
- **Framework:** Express 5
- **Database:** PostgreSQL 17 via Prisma ORM
- **Auth:** Passport.js (local strategy + Google OAuth)
- **Storage:** S3-compatible (MinIO in dev, AWS S3 / compatible in prod)
- **Validation:** Zod schemas
- **Monitoring:** Sentry (`@sentry/node`) + Prometheus metrics (`prom-client`)
- **Testing:** Vitest + supertest

### Database Models (Prisma)

| Model | Relationship | Purpose |
|-------|-------------|---------|
| User | has many Books, ReadingFonts, ReadingProgress, ReadingPreferences, ReadingSessions; has one GlobalSettings | User accounts (with profile: username, displayName, bio, avatarUrl) |
| Book | belongs to User; has many Chapters, Ambients, ReadingSessions; has one Appearance, Sounds, DefaultSettings, DecorativeFont | Book entity (with visibility: draft/published, description) |
| Chapter | belongs to Book | Chapter content + background |
| BookAppearance | belongs to Book | Light/dark theme customization |
| BookSounds | belongs to Book | Page flip / cover sounds |
| BookDefaultSettings | belongs to Book | Default reader settings per book |
| Ambient | belongs to Book | Background ambient sounds |
| DecorativeFont | belongs to Book | Per-book decorative font |
| ReadingFont | belongs to User | Custom reading fonts |
| GlobalSettings | belongs to User | Font size limits, settings visibility |
| ReadingProgress | belongs to User + Book | Per-book reading state |
| ReadingPreferences | belongs to User + Book | Per-book user reading preferences (font, theme, volume) |
| ReadingSession | belongs to User + Book | Reading session tracking (pages read, duration, timestamps) |

### API Routes

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/auth/*` | POST | Register, login, logout, Google OAuth, current user |
| `/api/books` | CRUD | Book management (with cover fields) |
| `/api/books/:id/chapters` | CRUD | Chapter management |
| `/api/books/:id/sounds` | PUT | Sound configuration |
| `/api/books/:id/ambients` | CRUD | Ambient sounds |
| `/api/books/:id/appearance` | PUT | Theme appearance |
| `/api/books/:id/decorative-font` | PUT/DELETE | Decorative font |
| `/api/books/:id/default-settings` | PUT | Default reader settings |
| `/api/fonts` | CRUD | User reading fonts |
| `/api/settings` | GET/PUT | Global settings |
| `/api/progress` | GET/PUT | Reading progress |
| `/api/upload` | POST | File upload to S3 |
| `/api/profile` | GET/PUT | User profile (username, displayName, bio, avatar) |
| `/api/profile/check-username/:name` | GET | Username availability check |
| `/api/public/discover` | GET | Browse recently published books (paginated) |
| `/api/public/shelves/:username` | GET | Author's public book shelf |
| `/api/public/books/:bookId` | GET | Public book details |
| `/api/public/books/:bookId/chapters/:id` | GET | Public chapter content |
| `/api/reading-sessions` | POST/GET | Reading session tracking & analytics |
| `/api/metrics` | GET | Prometheus metrics endpoint |
| `/api/export`, `/api/import` | GET/POST | Config export/import |

### Local Development

```bash
# Start infrastructure (PostgreSQL + MinIO)
docker compose up -d

# Setup server
cd server
npm install
npm run db:migrate     # Apply Prisma migrations
npm run db:seed        # Seed test data
npm run dev            # Start with tsx watch (port 4000)

# Frontend (in root dir) — proxies /api → :4000
npm run dev            # Start Vite dev server (port 3000)
```

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
- No external frameworks — minimal runtime dependencies (dompurify, jszip, quill, i18next, @sentry/browser, web-vitals)
- Async/await for asynchronous operations
- Destructuring in function parameters
- i18n: `data-i18n` attributes for DOM translation (supports `data-i18n-html`, `data-i18n-placeholder`, `data-i18n-aria-label`, `data-i18n-title`)

### Resource Cleanup
- All event listeners tracked and removed on destroy
- Timer manager clears all timeouts
- Components have `destroy()` methods
- EventEmitter listeners cleaned up

## Configuration

### Main Config (`js/config.js`)

The config system supports three data sources:
1. **Default mode** — hardcoded chapters and settings (Tolkien's "The Hobbit")
2. **Admin mode** — chapters, fonts, sounds, appearance loaded from admin config in localStorage (`flipbook-admin-config`)
3. **Server API mode** — data fetched from backend REST API (authenticated users)

**Exported API:**
- `createConfig(adminConfig)` — pure factory, builds config from localStorage data (or null for defaults)
- `createConfigFromAPI(bookDetail, globalSettings, readingFonts)` — builds config from server API data
- `loadConfigFromAPI(apiClient, bookId)` — fetches data from API and builds config
- `enrichConfigFromIDB(config)` — enriches config with large data from IndexedDB (fonts, ambients)
- `CONFIG` — singleton for backwards compatibility (created once at module load)
- `getConfig()` — returns current active config (recommended for new code)
- `setConfig(config)` — replaces active config (for book switching / testing)

```javascript
const BASE_URL = import.meta.env.BASE_URL || '/';

export const CONFIG = Object.freeze({
  STORAGE_KEY: "reader-settings",    // or "reader-settings:{bookId}" for multi-book
  BOOK_ID: "...",                    // only in API mode
  COVER_BG, COVER_BG_MOBILE,

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
    fontSize, theme, font, fullscreen, sound, ambient,
  },

  VIRTUALIZATION: { cacheLimit: 50 },
  LAYOUT: { MIN_PAGE_WIDTH_RATIO: 0.4, SETTLE_DELAY: 100 },
  TIMING: { FLIP_THROTTLE: 100 },
  UI: { ERROR_HIDE_TIMEOUT: 5000 },
  NETWORK: { MAX_RETRIES: 3, INITIAL_RETRY_DELAY: 1000, FETCH_TIMEOUT: 10000 },
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
  --spine-shadow-blur: 4px;
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
'@i18n':    '/js/i18n'
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
| **Server API** | Vitest + supertest | Backend endpoint testing |
| **Load** | K6 | Performance & stress testing (smoke, load, stress, spike, soak) |

### Test Structure

```
tests/
├── setup.js              # Test environment setup
├── helpers/
│   ├── testUtils.js      # Unit test utilities
│   └── integrationUtils.js # Integration test utilities
├── unit/                 # Unit tests
│   ├── utils/            # Utility tests (23 files)
│   ├── managers/         # Manager tests (5 files)
│   ├── core/             # Core tests (20 files)
│   │   ├── delegates/    # Delegate tests (8 files)
│   │   └── services/     # Service tests (4 files)
│   └── admin/            # Admin module tests (21 files)
├── integration/          # Integration tests
│   ├── smoke.test.js
│   ├── flows/            # User flow tests (24 files)
│   │   ├── navigation, settings, chapters, drag, events, accessibility
│   │   ├── chapterRepagination, settingsRepagination, dragNavConflict
│   │   ├── errorRecovery, fullReadingSession, resizeFlow
│   │   ├── adminPanel, audio, authMigration, bookshelf, theme
│   │   ├── ambientSoundLifecycle, bookSwitchingLifecycle, configExportImport
│   │   ├── delegateMediator, fontManagement, multiBookSession, photoAlbumLifecycle
│   ├── lifecycle/        # Lifecycle tests
│   └── services/         # Service tests
└── e2e/                  # E2E tests (Playwright)
    ├── fixtures/         # Test fixtures
    ├── pages/            # Page Object models
    ├── flows/            # Test scenarios (reading, navigation, settings, responsive, accessibility, offline, admin-panel, multi-book)
    └── performance/      # Performance tests
```

### Running Tests

```bash
# Frontend
npm run test:run          # Unit + integration (single run)
npm run test:coverage     # With coverage report
npm run test:e2e          # E2E in all browsers
npm run test:e2e:headed   # E2E with visible browser

# Backend
cd server && npm run test       # Server API tests (single run)
cd server && npm run test:watch # Server tests in watch mode

# K6 Load Testing
npm run test:k6:smoke     # Quick smoke test (2 VU, 30s)
npm run test:k6:load      # Load test (up to 50 VU, 5 min)
npm run test:k6:stress    # Stress test (up to 200 VU, 10 min)
# Docker-based (includes full infrastructure):
npm run test:k6:docker:smoke
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
1. Open Account screen (click "Редактировать" from the bookshelf context menu, or navigate to /account)
2. Upload a book file (txt, doc, docx, epub, fb2) or add chapters manually
3. Configure backgrounds and settings
4. Save — config is persisted to localStorage (offline) or server (authenticated)

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

### Adding a New Language (i18n)

1. Create a new locale file in `js/i18n/locales/` (e.g., `ja.js`) exporting a translation object
2. Register it in `js/i18n/locales/index.js`
3. Add the language entry to the `LANGUAGES` array in `js/i18n/index.js`
4. Use `data-i18n="key"` attributes in HTML for translatable elements

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
- Manual chunks (utils, managers, delegates, account)
- PWA Service Worker generation (Workbox)

### GitHub Pages Deployment

Automatic via GitHub Actions (`deploy.yml`) on push to `main`:
1. **Lint** — ESLint + Stylelint (10 min timeout)
2. **Test** — Unit + integration tests (10 min timeout, parallel with lint)
3. **E2E** — Playwright tests on Chromium (15 min timeout)
4. **Build** — Production build (after lint + test + e2e pass)
5. **Deploy** — Upload to GitHub Pages

Separate workflow (`server-tests.yml`) runs server API tests on `server/` changes:
- PostgreSQL 17 test service
- Prisma migrations + Vitest + supertest

Additional CI workflows:
- **`lighthouse.yml`** — Lighthouse CI audit on push/PR to `main`: builds the project and runs 3 Lighthouse runs with quality thresholds (performance ≥ 0.85, accessibility ≥ 0.85, best-practices ≥ 0.85, SEO ≥ 0.85)
- **`security.yml`** — Security scanning on push/PR to `main` + weekly schedule: npm audit for both frontend and server, Trivy Docker image scan with SARIF upload to GitHub Security

Base path configured via environment variable:
```javascript
const base = process.env.VITE_BASE_URL || '/';
// GitHub Pages: set VITE_BASE_URL=/flipbook/ in CI
```

### Full-Stack Deployment

A root-level `Dockerfile` builds both frontend and server into a single image:
- Multi-stage build: frontend (Vite) → server (tsc) → production image
- Configured for Amvera Cloud (`amvera.yml`) and Railway (`railway.toml`)
- See `DEPLOYMENT.md` for step-by-step guide (Amvera + Cloud.ru S3)

### Observability & Infrastructure

```bash
npm run infra:observability    # Start observability stack via Docker Compose overlay
npm run infra:backup           # Manual database backup
```

Observability stack (`docker-compose.observability.yml`):
- **Loki** — Log aggregation (port 3200, 14-day retention)
- **Prometheus** — Metrics scraping from server `/api/metrics` endpoint (port 9090)
- **Grafana** — Dashboards + alerting (port 3100, default: admin/admin)
- **pg-backup** — Daily PostgreSQL backup (3:00 UTC cron, 7-day rotation)
- Server logs shipped via `pino-loki` integration
- Server metrics exposed via `prom-client` (HTTP request duration, active connections, etc.)
- Grafana alerting rules provisioned via `infra/grafana-alerting.yaml`

DevOps scripts (`scripts/`):
- `backup-db.sh` — PostgreSQL backup with gzip compression and configurable retention
- `cleanup-s3-orphans.sh` — Identify/remove orphaned S3 files (dry-run or --delete mode)

## Dependencies

### Frontend Runtime
- **dompurify** `^3.3.1` — XSS protection (sanitization engine for HTMLSanitizer)
- **jszip** `^3.10.1` — ZIP operations (admin export, docx/epub parsing)
- **quill** `^2.0.3` — WYSIWYG rich text editor (admin chapter editing)
- **i18next** `^25.8.13` — Internationalization (5 languages)
- **@sentry/browser** `^10.40.0` — Client-side error monitoring
- **web-vitals** `^5.1.0` — Core Web Vitals performance monitoring (LCP, FID, CLS)

### Frontend Dev Dependencies (key)
- **vite** `^5.0.0` — Bundler
- **vitest** `^4.0.18` — Unit/integration testing
- **@playwright/test** `^1.58.1` — E2E testing
- **eslint** `^9.39.2` — JS linting
- **stylelint** `^17.1.1` — CSS linting
- **sharp** `^0.34.5` — Image processing (icon generation)
- **vite-plugin-pwa** `^1.2.0` — PWA/Service Worker support
- **husky** `^9.1.7` — Git hooks (pre-commit linting)
- **lint-staged** `^16.3.1` — Pre-commit lint runner

### Backend Runtime (server/)
- **express** `^5.0.1` — HTTP framework
- **@prisma/client** `^6.0.0` — Database ORM (PostgreSQL)
- **passport** `^0.7.0` — Authentication framework
- **passport-local** `^1.0.0` — Local auth strategy (email/password)
- **passport-google-oauth20** `^2.0.0` — Google OAuth strategy
- **@aws-sdk/client-s3** `^3.700.0` — S3-compatible file storage (MinIO in dev)
- **zod** `^3.23.0` — Request/response validation
- **helmet** `^8.0.0` — Security headers
- **pino** `^9.0.0` — Structured logging
- **pino-http** `^10.5.0` — HTTP request logging
- **pino-loki** `^2.6.0` — Log shipping to Grafana Loki
- **bcrypt** `^5.1.0` — Password hashing
- **csrf-csrf** `^4.0.3` — CSRF protection
- **express-rate-limit** `^7.0.0` — Rate limiting
- **express-session** `^1.18.0` — Session management
- **connect-pg-simple** `^10.0.0` — PostgreSQL session store
- **cors** `^2.8.5` — CORS support
- **cookie-parser** `^1.4.7` — Cookie parsing
- **multer** `^1.4.5-lts.1` — File upload handling (multipart/form-data)
- **dompurify** `^3.3.1` — Server-side HTML sanitization
- **jsdom** `^28.1.0` — Server-side DOM for sanitization
- **jszip** `^3.10.1` — ZIP operations (export/import)
- **@sentry/node** `^9.47.1` — Error monitoring
- **prom-client** `^15.1.3` — Prometheus metrics collection

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
- `HTMLSanitizer.js` for XSS protection (powered by DOMPurify — protects against mXSS, namespace pollution)
- `SettingsValidator.js` for validating and sanitizing settings before DOM application
- Content loaded from same origin only
- Content Security Policy meta tag in `index.html`
- Server-side: Helmet security headers, CSRF protection, rate limiting
- Authentication: bcrypt password hashing, secure session cookies
- Input validation: Zod schemas on all API endpoints
- File uploads: type/size restrictions, S3 storage (not filesystem)

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
