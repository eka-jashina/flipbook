/**
 * Тесты для modeCardsData
 * Конфигурация и генерация карточек выбора режима
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../js/i18n/index.js', () => ({
  t: vi.fn((key) => key),
}));

import { MODE_CARDS, renderModeCards } from '../../../js/admin/modeCardsData.js';

describe('modeCardsData', () => {
  describe('MODE_CARDS', () => {
    it('should have 3 mode cards', () => {
      expect(MODE_CARDS).toHaveLength(3);
    });

    it('should include upload, manual, and album modes', () => {
      const modes = MODE_CARDS.map(c => c.mode);
      expect(modes).toContain('upload');
      expect(modes).toContain('manual');
      expect(modes).toContain('album');
    });

    it('should have icon, titleKey, descKey for each card', () => {
      for (const card of MODE_CARDS) {
        expect(card.icon).toBeTruthy();
        expect(card.titleKey).toBeTruthy();
        expect(card.descKey).toBeTruthy();
      }
    });
  });

  describe('renderModeCards', () => {
    let container;

    beforeEach(() => {
      container = document.createElement('div');
    });

    it('should render 3 buttons into container', () => {
      renderModeCards(container);
      const buttons = container.querySelectorAll('button');
      expect(buttons).toHaveLength(3);
    });

    it('should set data-mode attribute on buttons', () => {
      renderModeCards(container);
      const modes = [...container.querySelectorAll('button')].map(b => b.dataset.mode);
      expect(modes).toEqual(['upload', 'manual', 'album']);
    });

    it('should use default CSS classes', () => {
      renderModeCards(container);
      expect(container.querySelector('.mode-card')).not.toBeNull();
      expect(container.querySelector('.mode-card-icon')).not.toBeNull();
      expect(container.querySelector('.mode-card-title')).not.toBeNull();
      expect(container.querySelector('.mode-card-desc')).not.toBeNull();
    });

    it('should use custom CSS classes', () => {
      renderModeCards(container, {
        cardClass: 'custom-card',
        iconClass: 'custom-icon',
        titleClass: 'custom-title',
        descClass: 'custom-desc',
      });
      expect(container.querySelector('.custom-card')).not.toBeNull();
      expect(container.querySelector('.custom-icon')).not.toBeNull();
      expect(container.querySelector('.custom-title')).not.toBeNull();
      expect(container.querySelector('.custom-desc')).not.toBeNull();
    });

    it('should include SVG icons', () => {
      renderModeCards(container);
      const svgs = container.querySelectorAll('svg');
      expect(svgs).toHaveLength(3);
    });

    it('should set data-i18n attributes for translation', () => {
      renderModeCards(container);
      const i18nEls = container.querySelectorAll('[data-i18n]');
      expect(i18nEls.length).toBe(6); // 3 titles + 3 descriptions
    });
  });
});
