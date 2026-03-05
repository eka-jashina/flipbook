/**
 * ANALYTICS MODULE
 *
 * Обёртка над Plausible Analytics для трекинга пользовательских событий.
 * Graceful degradation: если Plausible заблокирован (ad blocker), вызовы игнорируются.
 *
 * Plausible скрипт подключается в index.html (data-domain + src).
 * SPA-навигация по History API обрабатывается Plausible автоматически.
 */

// ═══════════════════════════════════════════
// Внутреннее состояние reading session
// ═══════════════════════════════════════════

let _sessionBookId = null;
let _sessionStartTime = null;
let _sessionStartPage = 0;
let _sessionCurrentPage = 0;

/**
 * Отправить пользовательское событие в Plausible.
 * No-op если Plausible не загружен.
 *
 * @param {string} name — имя события (например, 'book_opened')
 * @param {Object} [props] — свойства события (все значения приводятся к строкам)
 */
export function trackEvent(name, props) {
  if (typeof window.plausible !== 'function') return;

  if (props) {
    // Plausible требует строковые значения для props
    const stringProps = {};
    for (const [k, v] of Object.entries(props)) {
      stringProps[k] = String(v);
    }
    window.plausible(name, { props: stringProps });
  } else {
    window.plausible(name);
  }
}

// ═══════════════════════════════════════════
// Типизированные хелперы
// ═══════════════════════════════════════════

/** Книга открыта для чтения */
export function trackBookOpened(bookId) {
  trackEvent('book_opened', { book_id: bookId });
}

/** Глава дочитана до конца */
export function trackChapterCompleted(bookId, chapterIndex) {
  trackEvent('chapter_completed', { book_id: bookId, chapter_index: chapterIndex });
}

/** Начало сессии чтения (запоминает в памяти, отправляет событие) */
export function trackReadingSessionStart(bookId, startPage) {
  _sessionBookId = bookId;
  _sessionStartTime = Date.now();
  _sessionStartPage = startPage || 0;
  _sessionCurrentPage = _sessionStartPage;

  trackEvent('reading_session_start', { book_id: bookId });
}

/** Обновить текущую страницу (для подсчёта pages_read при завершении) */
export function updateReadingPage(page) {
  _sessionCurrentPage = page;
}

/** Завершение сессии чтения (отправляет событие с длительностью и количеством страниц) */
export function trackReadingSessionEnd() {
  if (!_sessionBookId || !_sessionStartTime) return;

  const durationSec = Math.round((Date.now() - _sessionStartTime) / 1000);
  const pagesRead = Math.abs(_sessionCurrentPage - _sessionStartPage);

  trackEvent('reading_session_end', {
    book_id: _sessionBookId,
    pages_read: pagesRead,
    duration_sec: durationSec,
  });

  // Сброс
  _sessionBookId = null;
  _sessionStartTime = null;
  _sessionStartPage = 0;
  _sessionCurrentPage = 0;
}

/** Изменение настройки */
export function trackSettingsChanged(setting, value) {
  trackEvent('settings_changed', { setting, value });
}

/** Смена темы */
export function trackThemeChanged(theme) {
  trackEvent('theme_changed', { theme });
}

/** Смена шрифта */
export function trackFontChanged(font) {
  trackEvent('font_changed', { font });
}

/** Успешная регистрация гостя */
export function trackGuestRegistered(method) {
  trackEvent('guest_registered', { method });
}

/** Публикация книги */
export function trackBookPublished(bookId) {
  trackEvent('book_published', { book_id: bookId });
}

/** Импорт книги */
export function trackBookImported(format) {
  trackEvent('book_imported', { format });
}

/** Экспорт конфигурации */
export function trackExportConfig() {
  trackEvent('export_config');
}

/** Смена языка интерфейса */
export function trackLanguageChanged(language) {
  trackEvent('language_changed', { language });
}

// ═══════════════════════════════════════════
// Обработка закрытия страницы (beforeunload)
// ═══════════════════════════════════════════

/**
 * Инициализация аналитики.
 * Подписывается на beforeunload для отправки reading_session_end при закрытии.
 */
export function initAnalytics() {
  window.addEventListener('beforeunload', () => {
    trackReadingSessionEnd();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      trackReadingSessionEnd();
    }
  });
}
