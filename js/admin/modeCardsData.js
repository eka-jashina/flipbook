/**
 * Данные и генерация карточек выбора режима создания книги.
 * Используются в admin (index.js) и reader (BookshelfScreen.js).
 */

/** Конфигурация карточек режимов */
export const MODE_CARDS = [
  {
    mode: 'upload',
    icon: '<path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>',
    title: 'Загрузить файл',
    desc: 'EPUB, FB2, DOCX, DOC, TXT — автоматическое извлечение глав',
  },
  {
    mode: 'manual',
    icon: '<path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>',
    title: 'Создать вручную',
    desc: 'Обложка, главы, фоны — полный контроль',
  },
  {
    mode: 'album',
    icon: '<path fill="currentColor" d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4l2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z"/>',
    title: 'Фотоальбом',
    desc: 'Раскладки, фото, подписи — визуальный редактор',
  },
];

/**
 * Генерирует HTML карточек режимов и вставляет в контейнер.
 * @param {HTMLElement} container - контейнер для вставки
 * @param {string} cardClass - CSS-класс кнопки ('mode-card' для admin, 'bookshelf-mode-card' для reader)
 * @param {string} iconClass - CSS-класс иконки ('mode-card-icon' / 'bookshelf-mode-card-icon')
 * @param {string} titleClass - CSS-класс заголовка ('mode-card-title' / 'bookshelf-mode-card-title')
 * @param {string} descClass - CSS-класс описания ('mode-card-desc' / 'bookshelf-mode-card-desc')
 */
export function renderModeCards(container, {
  cardClass = 'mode-card',
  iconClass = 'mode-card-icon',
  titleClass = 'mode-card-title',
  descClass = 'mode-card-desc',
} = {}) {
  container.innerHTML = MODE_CARDS.map(card => `
    <button type="button" class="${cardClass}" data-mode="${card.mode}">
      <div class="${iconClass}">
        <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">${card.icon}</svg>
      </div>
      <div class="${titleClass}">${card.title}</div>
      <div class="${descClass}">${card.desc}</div>
    </button>
  `).join('');
}
