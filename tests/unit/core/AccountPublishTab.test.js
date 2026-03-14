/**
 * Тесты для AccountPublishTab
 * Вкладка публикации книги
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../js/utils/Analytics.js', () => ({
  trackBookPublished: vi.fn(),
}));

import { AccountPublishTab } from '../../../js/core/AccountPublishTab.js';
import { trackBookPublished } from '../../../js/utils/Analytics.js';

describe('AccountPublishTab', () => {
  let tab;
  let container;
  let mockApi;
  let mockStore;
  let mockShowToast;

  beforeEach(() => {
    vi.clearAllMocks();

    container = document.createElement('div');
    container.innerHTML = `
      <div id="publishVisibility">
        <input type="radio" name="bookVisibility" value="draft">
        <input type="radio" name="bookVisibility" value="published">
      </div>
      <textarea id="bookDescription"></textarea>
      <span id="descCharCount">0</span>
      <div id="shareSection" hidden>
        <input id="shareLink" value="">
      </div>
      <button id="copyShareLink"></button>
      <button id="savePublish"></button>
    `;

    mockApi = {
      getBook: vi.fn(() => Promise.resolve({ visibility: 'draft', description: 'A book' })),
      updateBook: vi.fn(() => Promise.resolve()),
    };

    mockStore = {
      getActiveBookId: vi.fn(() => 'book-123'),
    };

    mockShowToast = vi.fn();

    tab = new AccountPublishTab({
      container,
      apiClient: mockApi,
      store: mockStore,
      showToast: mockShowToast,
    });
  });

  describe('constructor', () => {
    it('should cache DOM elements', () => {
      expect(tab._publishVisibility).not.toBeNull();
      expect(tab._bookDescription).not.toBeNull();
      expect(tab._descCharCount).not.toBeNull();
      expect(tab._shareSection).not.toBeNull();
      expect(tab._shareLink).not.toBeNull();
      expect(tab._copyShareLinkBtn).not.toBeNull();
      expect(tab._savePublishBtn).not.toBeNull();
    });
  });

  describe('bindEvents', () => {
    it('should update char count on description input', () => {
      tab.bindEvents();
      tab._bookDescription.value = 'Hello';
      tab._bookDescription.dispatchEvent(new Event('input'));

      expect(tab._descCharCount.textContent).toBe('5');
    });
  });

  describe('render', () => {
    it('should load book data and populate fields', async () => {
      await tab.render();

      expect(mockApi.getBook).toHaveBeenCalledWith('book-123');
      expect(tab._bookDescription.value).toBe('A book');
      expect(tab._descCharCount.textContent).toBe('6');
    });

    it('should check correct visibility radio', async () => {
      mockApi.getBook.mockResolvedValue({ visibility: 'published', description: '' });
      await tab.render();

      const radio = container.querySelector('input[value="published"]');
      expect(radio.checked).toBe(true);
    });

    it('should show share section when published', async () => {
      mockApi.getBook.mockResolvedValue({ visibility: 'published', description: '' });
      await tab.render();

      expect(tab._shareSection.hidden).toBe(false);
      expect(tab._shareLink.value).toContain('/book/book-123');
    });

    it('should hide share section when draft', async () => {
      await tab.render();

      expect(tab._shareSection.hidden).toBe(true);
    });

    it('should not call API without activeBookId', async () => {
      mockStore.getActiveBookId.mockReturnValue(null);
      await tab.render();

      expect(mockApi.getBook).not.toHaveBeenCalled();
    });

    it('should not call API without apiClient', async () => {
      tab._api = null;
      await tab.render();

      expect(mockApi.getBook).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      mockApi.getBook.mockRejectedValue(new Error('Network error'));
      await expect(tab.render()).resolves.toBeUndefined();
    });
  });

  describe('_save', () => {
    it('should save visibility and description', async () => {
      tab.bindEvents();

      container.querySelector('input[value="published"]').checked = true;
      tab._bookDescription.value = 'New description';

      await tab._save();

      expect(mockApi.updateBook).toHaveBeenCalledWith('book-123', {
        visibility: 'published',
        description: 'New description',
      });
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.any(String),
        'success'
      );
    });

    it('should track analytics when publishing', async () => {
      container.querySelector('input[value="published"]').checked = true;
      await tab._save();

      expect(trackBookPublished).toHaveBeenCalledWith('book-123');
    });

    it('should not track analytics for draft', async () => {
      container.querySelector('input[value="draft"]').checked = true;
      await tab._save();

      expect(trackBookPublished).not.toHaveBeenCalled();
    });

    it('should show error toast on failure', async () => {
      mockApi.updateBook.mockRejectedValue(new Error('Server error'));
      container.querySelector('input[value="draft"]').checked = true;
      await tab._save();

      expect(mockShowToast).toHaveBeenCalledWith('Server error', 'error');
    });

    it('should not save without activeBookId', async () => {
      mockStore.getActiveBookId.mockReturnValue(null);
      await tab._save();

      expect(mockApi.updateBook).not.toHaveBeenCalled();
    });
  });
});
