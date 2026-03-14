# Plan: Improve Book & Album Creation UX

## Summary

Redesign the creation flow for books and photo albums:
1. Replace 3 equal mode cards with 2 clear product types (Book / Album)
2. Simplify book creation: fewer steps, inline chapter editing instead of modal
3. Album becomes a book with `type: 'album'`, own editor with sections (= chapters)
4. Faster path from bookshelf to creating content

---

## Phase 1: New Entry Point — Two Product Types

### What changes:
- **modeCardsData.js**: Replace 3 cards (upload/manual/album) with 2 cards (book/album)
- **account.html**: Remove `data-view="mode-selector"` as separate view. Instead, merge the creation choice into a new combined "create book" view
- **AccountScreen.js**: Update `_handleModeSelect()` to handle 2 modes instead of 3

### New "Create Book" view (replaces mode-selector + upload views):
```
┌──────────────────────────────────────┐
│  ← Назад              Новая книга    │
│                                      │
│  ┌──────────────────────────────┐   │
│  │  📁 Перетащите файл сюда     │   │
│  │  .epub .fb2 .docx .doc .txt  │   │
│  └──────────────────────────────┘   │
│                                      │
│  ─── или ───                        │
│  [Создать пустую книгу]             │
└──────────────────────────────────────┘
```

### New "Choose Type" screen (replaces 3 mode cards):
```
┌─────────────────────────────┐
│     Что создаём?            │
│  ┌─────────┐  ┌──────────┐ │
│  │  📖     │  │  🖼️      │ │
│  │  Книга  │  │  Альбом  │ │
│  └─────────┘  └──────────┘ │
└─────────────────────────────┘
```

### Files to modify:
- `js/admin/modeCardsData.js` — 2 cards instead of 3
- `html/partials/reader/account.html` — merge mode-selector + upload views into one; update album view
- `js/core/AccountScreen.js` — update `_handleModeSelect`, remove upload view logic, merge into "create-book" view
- `css/admin/book-upload.css` — adjust styles for combined view
- `js/i18n/locales/*.js` — add/update translation keys for new UI text

---

## Phase 2: Simplify Book Creation

### Upload path (fast):
1. User drops file on the combined "create book" view
2. File is parsed (spinner in-place)
3. Book created automatically with parsed title/author/chapters
4. **Navigate to reader** (`/book/:id`) — not to the editor
5. User can edit later from bookshelf context menu → "Редактировать"

### Empty book path:
1. User clicks "Создать пустую книгу"
2. Book created with default title
3. Navigate to editor (existing behavior, but from new combined view)

### Key change: no more pending book for upload
- Upload creates a real book immediately after parsing
- No `_pendingBookId` needed for upload flow
- `_pendingBookId` still used for empty book (cleaned up if abandoned)

### Files to modify:
- `js/admin/modules/BookUploadManager.js` — after `_applyParsedBook()`, navigate to reader instead of editor
- `js/core/AccountScreen.js` — remove separate upload view handling, integrate into create-book view

---

## Phase 3: Inline Chapter Editing (Replace Modal)

### Current: Modal dialog with fields (ID, title, content toggle, backgrounds)
### New: Expandable inline blocks in the chapters list

Each chapter card becomes expandable (▶/▼):

**Collapsed state** (existing card, slightly enhanced):
```
▶ Глава 1: Неожиданное угощение (524 сл.)  ↑ ↓ ✕
```

**Expanded state** (replaces modal):
```
▼ Глава 1: Неожиданное угощение             ↑ ↓ ✕
┌──────────────────────────────────────────────┐
│ Название: [Неожиданное угощение____]         │
│                                               │
│ Контент:  ○ Редактор  ○ Файл                 │
│ ┌──────────────────────────────────────────┐ │
│ │ B I U  ≡  ¶  🔗  📷                     │ │
│ │──────────────────────────────────────────│ │
│ │ В норе, вырытой в земле, жил-был...     │ │
│ └──────────────────────────────────────────┘ │
│                                               │
│ Фон (десктоп):  [background_1.webp] [✕]     │
│ Фон (мобильный): [—] [Выбрать]              │
└──────────────────────────────────────────────┘
```

### Implementation approach:
- **ChaptersModule.js**: Replace `_openModal()` with `_toggleChapter(index)` that expands/collapses inline
- **editor-chapters.html**: Remove reference to modal. Chapter list items become expandable containers
- **modal-chapter.html**: Keep file but stop using it for chapters (still referenced for backwards compat, can remove later)
- **ChaptersModule.js `_renderChapters()`**: Generate expandable HTML with form fields inside each card
- **QuillEditorWrapper**: Must support being instantiated inside any expanded chapter (not just one fixed container)
- Only one chapter expanded at a time (expanding one collapses others)
- Auto-save on collapse or on field blur (no explicit "Save" button needed — consistent with other editor tabs)

### CSS changes:
- `css/admin/chapters.css` — add `.chapter-card--expanded` styles, inline form styles
- `css/admin/editor.css` — Quill container in inline context

### Files to modify:
- `js/admin/modules/ChaptersModule.js` — major: replace modal logic with inline expand/collapse
- `html/partials/admin/editor-chapters.html` — update structure
- `html/partials/admin/modal-chapter.html` — keep but remove usage (or remove entirely)
- `html/partials/reader/account.html` — remove modal include if no longer needed
- `css/admin/chapters.css` — expanded card styles
- `js/admin/modules/QuillEditorWrapper.js` — support dynamic container (re-mount to different elements)
- `js/admin/modules/ChapterFileHandler.js` — adapt to inline context instead of modal

### Dropzone at the top of Chapters tab:
- Add a file dropzone above the chapters list (same as in create-book view)
- Dropping a file adds chapters from it to the existing list
- This replaces the book-level upload and makes it chapter-level

---

## Phase 4: Album as Book Type with Sections

### Data model change:
- Add `type` field to book: `'book'` (default) or `'album'`
- No new DB table — reuse Book model
- Album sections = Chapter records with `albumData`

### Album editor:
- **Same tab structure as book editor** (Cover, Chapters→Sections, Appearance, Sounds, Defaults, Publish)
- "Chapters" tab renamed to "Разделы" (Sections) when `type === 'album'`
- Sections tab: expandable inline blocks (same pattern as book chapters)
- Each section expands to show photo pages with layouts (existing AlbumManager UI)

### Section (expanded):
```
▼ Утро невесты                                 ↑ ↓ ✕
┌──────────────────────────────────────────────────┐
│ Название: [Утро невесты__________________]       │
│ ☐ Скрыть заголовок на странице                   │
│                                                   │
│ Стр.1: [1] [2v] [2h] [3] [4]                    │
│  ┌──────┐  ┌──────┐                              │
│  │ фото │  │ фото │                              │
│  └──────┘  └──────┘                              │
│                                                   │
│ Стр.2: [1] [2v] [2h] [3] [4]                    │
│  ┌────────────────┐                              │
│  │     фото       │                              │
│  └────────────────┘                              │
│                                                   │
│ [+ Добавить страницу]  [Загрузить фото]          │
└──────────────────────────────────────────────────┘
```

### Album creation flow:
1. User picks "Альбом" from type selector
2. Album book created with `type: 'album'`
3. Opens album editor (same editor UI, but Chapters tab shows Sections)
4. User adds sections, fills with photos
5. Sections saved as chapters with `albumData`

### Files to modify:
- `js/core/AccountScreen.js` — handle `type: 'album'` in editor, rename tab label dynamically
- `js/admin/modules/ChaptersModule.js` — detect album mode, render sections instead of chapters
- `js/admin/modules/AlbumManager.js` — refactor to work as inline section editor (not separate view)
- `html/partials/reader/account.html` — remove separate album view (`data-view="album"`), album editing happens within editor view's Sections tab
- `html/partials/admin/editor-chapters.html` — support section mode (dynamic heading, add section button)
- `js/admin/modeCardsData.js` — album card config
- `css/admin/chapters.css` — section-specific styles (album page layouts inside expanded cards)
- `js/i18n/locales/*.js` — translation keys for sections

### Backend (minimal changes):
- `server/prisma/schema.prisma` — add `type` field to Book model (`String @default("book")`)
- `server/src/services/books.service.ts` — pass through `type` field
- `server/src/routes/books.routes.ts` — accept `type` in create/update
- Migration for new field

---

## Phase 5: Bookshelf Quick Access

### Current: Bookshelf → navigate to /account → Add Book → Mode selector
### New: Bookshelf → [+] opens type chooser inline (modal/popover)

- **BookshelfScreen.js**: Instead of `router.navigate('/account')`, show a small popover/modal with 2 options (Book / Album)
- Selecting an option navigates to `/account` with `?mode=book` or `?mode=album`
- AccountScreen reads the query param and goes directly to the right creation view (skipping the type selector step)

### Alternative (simpler):
- Keep navigation to /account but auto-show the type selector on arrival
- Remove the intermediate "bookshelf" view in account (go straight to type chooser or editor)

### Files to modify:
- `js/core/BookshelfScreen.js` — add inline type chooser or pass mode param
- `js/core/AccountScreen.js` — handle `mode` query param to skip steps
- `html/partials/reader/bookshelf.html` — add popover/modal HTML for type chooser (if inline approach)

---

## Implementation Order

1. **Phase 1** (Entry point) — Foundation for everything else
2. **Phase 5** (Bookshelf quick access) — Can be done with Phase 1
3. **Phase 2** (Simplified book creation) — Depends on Phase 1
4. **Phase 3** (Inline chapters) — Independent, biggest change
5. **Phase 4** (Album as book type) — Depends on Phase 3 (reuses inline pattern)

### Estimated scope:
- ~15 files modified
- 1 DB migration (add `type` to Book)
- New CSS for expanded chapter cards
- Translation updates for 5 languages
- Tests: update existing + add new for inline editing

---

## What stays the same:
- Editor tab structure (Cover, Chapters/Sections, Appearance, Sounds, Defaults, Publish)
- All customization features (fonts, themes, sounds, ambient)
- Store abstraction (ServerAdminConfigStore / AdminConfigStore)
- Book/chapter data model (except `type` field addition)
- AlbumManager core logic (page layouts, image processing, cropping)
- Context menu on bookshelf (read, edit, delete, visibility)
- Publication flow
