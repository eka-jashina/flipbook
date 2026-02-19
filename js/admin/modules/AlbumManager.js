/**
 * Менеджер фотоальбомов
 * Управляет созданием мульти-страничных фотоальбомов с раскладками
 * Работает как полноэкранный вид (screen-view), а не модалка
 */

/** Количество изображений для каждого шаблона */
const LAYOUT_IMAGE_COUNT = {
  '1': 1, '2': 2, '2h': 2,
  '3': 3, '3r': 3, '3t': 3, '3b': 3,
  '4': 4,
};

export class AlbumManager {
  constructor(chaptersModule) {
    this._module = chaptersModule;
    this._albumPages = []; // [{ layout: '1', images: [{dataUrl, caption}] }]
  }

  get store() { return this._module.store; }

  cacheDOM() {
    this.albumTitleInput = document.getElementById('albumTitle');
    this.albumHideTitle = document.getElementById('albumHideTitle');
    this.albumPagesEl = document.getElementById('albumPages');
    this.albumAddPageBtn = document.getElementById('albumAddPage');
    this.saveAlbumBtn = document.getElementById('saveAlbum');
    this.cancelAlbumBtn = document.getElementById('cancelAlbum');
  }

  bindEvents() {
    this.albumAddPageBtn.addEventListener('click', () => this._addAlbumPage());
    this.saveAlbumBtn.addEventListener('click', () => this._handleAlbumSubmit());
    this.cancelAlbumBtn.addEventListener('click', () => this._cancelAlbum());
  }

  /** Открыть как полноэкранный вид (вызывается из роутера) */
  openInView() {
    this._albumPages = [{ layout: '1', images: [] }];
    this.albumTitleInput.value = '';
    this.albumHideTitle.checked = true;
    this._renderAlbumPages();
  }

  _cancelAlbum() {
    this._module.app._showView('editor');
  }

  _addAlbumPage() {
    this._albumPages.push({ layout: '1', images: [] });
    this._renderAlbumPages();
  }

  _removeAlbumPage(pageIndex) {
    if (this._albumPages.length <= 1) return;
    this._albumPages.splice(pageIndex, 1);
    this._renderAlbumPages();
  }

  _selectPageLayout(pageIndex, layout) {
    const page = this._albumPages[pageIndex];
    page.layout = layout;

    const count = LAYOUT_IMAGE_COUNT[layout] || 1;
    page.images = page.images.slice(0, count);

    this._renderAlbumPages();
  }

  /** Отрисовать все страницы альбома */
  _renderAlbumPages() {
    this.albumPagesEl.innerHTML = '';

    this._albumPages.forEach((page, pageIndex) => {
      const card = document.createElement('div');
      card.className = 'album-page-card';

      // Заголовок страницы
      const header = document.createElement('div');
      header.className = 'album-page-header';

      const title = document.createElement('span');
      title.className = 'album-page-title';
      title.textContent = `Страница ${pageIndex + 1}`;

      header.appendChild(title);

      if (this._albumPages.length > 1) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'album-page-remove';
        removeBtn.title = 'Удалить страницу';
        removeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
        removeBtn.addEventListener('click', () => this._removeAlbumPage(pageIndex));
        header.appendChild(removeBtn);
      }

      card.appendChild(header);

      // Шаблон раскладки
      const layoutsWrap = document.createElement('div');
      layoutsWrap.className = 'album-layouts';
      layoutsWrap.innerHTML = this._buildLayoutButtons(page.layout);
      layoutsWrap.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-layout]');
        if (!btn) return;
        this._selectPageLayout(pageIndex, btn.dataset.layout);
      });
      card.appendChild(layoutsWrap);

      // Слоты изображений
      const imagesWrap = document.createElement('div');
      imagesWrap.className = 'album-images';
      this._renderPageImageSlots(imagesWrap, page, pageIndex);
      card.appendChild(imagesWrap);

      this.albumPagesEl.appendChild(card);
    });
  }

  /** Получить слоты изображений для страницы — всегда length === LAYOUT_IMAGE_COUNT */
  _getPageSlots(page) {
    const count = LAYOUT_IMAGE_COUNT[page.layout] || 1;
    return Array.from({ length: count }, (_, i) => page.images[i] || null);
  }

  /** Сгенерировать HTML кнопок выбора шаблона */
  _buildLayoutButtons(activeLayout) {
    const layouts = [
      { id: '1', title: '1 фото', items: 1 },
      { id: '2', title: '2 фото (вертикально)', items: 2 },
      { id: '2h', title: '2 фото (горизонтально)', items: 2 },
      { id: '3', title: 'Большое слева + 2 справа', items: 3 },
      { id: '3r', title: 'Большое справа + 2 слева', items: 3 },
      { id: '3t', title: 'Большое сверху + 2 снизу', items: 3 },
      { id: '3b', title: 'Большое снизу + 2 сверху', items: 3 },
      { id: '4', title: 'Сетка 2x2', items: 4 },
    ];
    return layouts.map(l => {
      const active = l.id === activeLayout ? ' active' : '';
      const icons = Array.from({ length: l.items }, () => '<i></i>').join('');
      return `<button class="album-layout-btn${active}" type="button" data-layout="${l.id}" title="${l.title}"><span class="album-layout-preview album-layout-preview--${l.id}">${icons}</span><span class="album-layout-label">${l.id}</span></button>`;
    }).join('');
  }

  /** Отрисовать слоты изображений для одной страницы */
  _renderPageImageSlots(container, page, pageIndex) {
    for (const [i, img] of this._getPageSlots(page).entries()) {
      const group = document.createElement('div');
      group.className = 'album-image-group';

      const slot = document.createElement('div');
      slot.className = `album-image-slot${img ? ' has-image' : ''}`;

      slot.innerHTML = `
        <span class="album-image-slot-placeholder">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 7v2.99s-1.99.01-2 0V7h-3s.01-1.99 0-2h3V2h2v3h3v2h-3zm-3 4V8h-3V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8h-3zM5 19l3-4 2 3 3-4 4 5H5z"/></svg>
          Фото ${i + 1}
        </span>
        <span class="album-image-slot-num">${i + 1}</span>
        <button class="album-image-slot-remove" type="button" title="Удалить">&times;</button>
      `;

      if (img) {
        const imgEl = document.createElement('img');
        imgEl.className = 'album-image-slot-img';
        imgEl.src = img.dataUrl;
        slot.insertBefore(imgEl, slot.firstChild);
      }

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.hidden = true;

      slot.addEventListener('click', (e) => {
        if (e.target.closest('.album-image-slot-remove')) return;
        fileInput.click();
      });

      fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;
        this._readPageImageFile(file, pageIndex, i);
        fileInput.value = '';
      });

      slot.querySelector('.album-image-slot-remove').addEventListener('click', () => {
        page.images[i] = null;
        this._renderAlbumPages();
      });

      group.appendChild(slot);
      group.appendChild(fileInput);

      const captionInput = document.createElement('input');
      captionInput.type = 'text';
      captionInput.className = 'album-image-slot-caption';
      captionInput.placeholder = 'Подпись...';
      captionInput.value = img?.caption || '';
      captionInput.addEventListener('input', () => {
        if (!page.images[i]) page.images[i] = { dataUrl: '', caption: '' };
        page.images[i].caption = captionInput.value;
      });
      group.appendChild(captionInput);

      container.appendChild(group);
    }
  }

  _readPageImageFile(file, pageIndex, imageIndex) {
    const reader = new FileReader();
    reader.onload = () => {
      const page = this._albumPages[pageIndex];
      page.images[imageIndex] = {
        dataUrl: reader.result,
        caption: page.images[imageIndex]?.caption || '',
      };
      this._renderAlbumPages();
    };
    reader.readAsDataURL(file);
  }

  _handleAlbumSubmit() {
    const title = this.albumTitleInput.value.trim();
    if (!title) {
      this._module._showToast('Укажите название альбома');
      return;
    }

    // Проверить, что хотя бы на одной странице есть изображение
    const hasAnyImage = this._albumPages.some(page =>
      page.images.some(img => img?.dataUrl)
    );
    if (!hasAnyImage) {
      this._module._showToast('Добавьте хотя бы одно изображение');
      return;
    }

    const htmlContent = this._buildAlbumHtml(title, this._albumPages);

    const chapterId = `album_${Date.now()}`;
    this.store.addChapter({
      id: chapterId,
      file: '',
      htmlContent,
      bg: '',
      bgMobile: '',
    });

    // Вернуться к редактору и обновить список глав
    this._module._renderChapters();
    this._module._renderJsonPreview();
    this._module.app._showView('editor');
    this._module._showToast('Фотоальбом добавлен');
  }

  /**
   * Сгенерировать HTML-разметку мульти-страничного фотоальбома
   */
  _buildAlbumHtml(title, pages) {
    const hideTitle = this.albumHideTitle.checked;
    const h2Class = hideTitle ? ' class="sr-only"' : '';

    const albumDivs = pages.map(page => {
      const figures = this._getPageSlots(page).map(img => {
        if (!img?.dataUrl) {
          return '<figure class="photo-album__item"><img src="" alt=""></figure>';
        }
        const caption = img.caption
          ? `<figcaption>${this._module._escapeHtml(img.caption)}</figcaption>`
          : '';
        return `<figure class="photo-album__item"><img src="${img.dataUrl}" alt="${this._module._escapeHtml(img.caption || '')}">${caption}</figure>`;
      });
      return `<div class="photo-album" data-layout="${page.layout}">${figures.join('')}</div>`;
    });

    return `<article><h2${h2Class}>${this._module._escapeHtml(title)}</h2>${albumDivs.join('')}</article>`;
  }
}
