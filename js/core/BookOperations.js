/**
 * Операции с книгами на полке (API + localStorage)
 * Переключение видимости, удаление книг.
 */
import { adminConfigStorage } from '../config/configHelpers.js';
import { t } from '@i18n';
import { VISIBILITY_NEXT } from './bookshelfUtils.js';

/**
 * Переключить видимость книги (draft → published → unlisted → draft)
 * @param {string} bookId
 * @param {Array} books - Массив книг (мутируется при успехе)
 * @param {import('../utils/ApiClient.js').ApiClient|null} apiClient
 * @returns {Promise<boolean>} true если видимость изменена
 */
export async function toggleVisibility(bookId, books, apiClient) {
  const book = books.find(b => b.id === bookId);
  if (!book) return false;

  const currentVis = book.visibility || 'draft';
  const nextVis = VISIBILITY_NEXT[currentVis] || 'draft';

  if (apiClient) {
    try {
      await apiClient.updateBook(bookId, { visibility: nextVis });
      book.visibility = nextVis;
      return true;
    } catch (err) {
      console.error('Ошибка смены видимости:', err);
      return false;
    }
  }

  return false;
}

/**
 * Удалить книгу с полки
 * @param {string} bookId
 * @param {Array} books - Массив книг
 * @param {import('../utils/ApiClient.js').ApiClient|null} apiClient
 * @returns {Promise<boolean>} true если книга удалена
 */
export async function deleteBook(bookId, books, apiClient) {
  const book = books.find(b => b.id === bookId);
  const title = book?.title || book?.cover?.title || '';

  if (!confirm(t('bookshelf.deleteConfirm', { title }))) return false;

  if (apiClient) {
    try {
      await apiClient.deleteBook(bookId);
    } catch (err) {
      console.error('Ошибка удаления книги:', err);
      return false;
    }
  } else {
    // Fallback: localStorage
    const config = adminConfigStorage.load();
    if (Object.keys(config).length > 0) {
      config.books = (config.books || []).filter(b => b.id !== bookId);
      if (config.activeBookId === bookId) delete config.activeBookId;
      adminConfigStorage.setFull(config);
    }
  }

  return true;
}
