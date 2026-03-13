/**
 * Рендеринг UI страниц фотоальбома:
 * карточки страниц, слоты изображений, кнопки раскладки, селекты опций
 */

import { t } from '@i18n';
import {
  getFrameOptions, getFilterOptions,
  DEFAULT_FILTER_INTENSITY, IMAGE_MAX_FILE_SIZE,
  getPageSlots, computeFilterStyle,
} from './albumConstants.js';

/** Отрисовать все страницы альбома */
export function renderAlbumPages(manager) {
  // Сохранить позицию скролла перед перерисовкой
  const scrollParent = manager.albumPagesEl.closest('.admin-section-content') || manager.albumPagesEl.parentElement;
  const savedScroll = scrollParent?.scrollTop ?? 0;

  manager.albumPagesEl.innerHTML = '';

  manager._albumPages.forEach((page, pageIndex) => {
    const card = document.createElement('div');
    card.className = 'album-page-card';

    // Заголовок страницы
    const header = document.createElement('div');
    header.className = 'album-page-header';

    const title = document.createElement('span');
    title.className = 'album-page-title';
    title.textContent = t('admin.album.pageTitle', { num: pageIndex + 1 });

    header.appendChild(title);

    if (manager._albumPages.length > 1) {
      // Кнопки перемещения
      const moveWrap = document.createElement('span');
      moveWrap.className = 'album-page-move';

      if (pageIndex > 0) {
        const upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'album-page-move-btn';
        upBtn.title = t('admin.album.moveUp');
        upBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>';
        upBtn.addEventListener('click', () => manager._movePageUp(pageIndex));
        moveWrap.appendChild(upBtn);
      }

      if (pageIndex < manager._albumPages.length - 1) {
        const downBtn = document.createElement('button');
        downBtn.type = 'button';
        downBtn.className = 'album-page-move-btn';
        downBtn.title = t('admin.album.moveDown');
        downBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>';
        downBtn.addEventListener('click', () => manager._movePageDown(pageIndex));
        moveWrap.appendChild(downBtn);
      }

      header.appendChild(moveWrap);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'album-page-remove';
      removeBtn.title = t('admin.album.removePage');
      removeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
      removeBtn.addEventListener('click', () => manager._removeAlbumPage(pageIndex));
      header.appendChild(removeBtn);
    }

    // Кнопка массовой загрузки на уровне страницы
    const pageBulkBtn = document.createElement('button');
    pageBulkBtn.type = 'button';
    pageBulkBtn.className = 'album-page-bulk-btn';
    pageBulkBtn.title = t('admin.album.bulkUpload');
    pageBulkBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>';
    pageBulkBtn.addEventListener('click', () => manager._bulkUploadToPage(pageIndex));
    header.appendChild(pageBulkBtn);

    card.appendChild(header);

    // Шаблон раскладки
    const layoutsWrap = document.createElement('div');
    layoutsWrap.className = 'album-layouts';
    layoutsWrap.innerHTML = buildLayoutButtons(page.layout);
    layoutsWrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-layout]');
      if (!btn) return;
      manager._selectPageLayout(pageIndex, btn.dataset.layout);
    });
    card.appendChild(layoutsWrap);

    // Слоты изображений
    const imagesWrap = document.createElement('div');
    imagesWrap.className = 'album-images';
    renderPageImageSlots(manager, imagesWrap, page, pageIndex);
    card.appendChild(imagesWrap);

    manager.albumPagesEl.appendChild(card);
  });

  // Восстановить позицию скролла после перерисовки
  if (scrollParent && savedScroll) {
    scrollParent.scrollTop = savedScroll;
  }
}

/** Сгенерировать HTML кнопок выбора шаблона */
export function buildLayoutButtons(activeLayout) {
  const layouts = [
    { id: '1', title: t('admin.album.layout1'), items: 1 },
    { id: '2', title: t('admin.album.layout2v'), items: 2 },
    { id: '2h', title: t('admin.album.layout2h'), items: 2 },
    { id: '3', title: t('admin.album.layout3l'), items: 3 },
    { id: '3r', title: t('admin.album.layout3r'), items: 3 },
    { id: '3t', title: t('admin.album.layout3t'), items: 3 },
    { id: '3b', title: t('admin.album.layout3b'), items: 3 },
    { id: '4', title: t('admin.album.layout4'), items: 4 },
  ];
  return layouts.map(l => {
    const active = l.id === activeLayout ? ' active' : '';
    const icons = Array.from({ length: l.items }, () => '<i></i>').join('');
    return `<button class="album-layout-btn${active}" type="button" data-layout="${l.id}" title="${l.title}"><span class="album-layout-preview album-layout-preview--${l.id}">${icons}</span><span class="album-layout-label">${l.id}</span></button>`;
  }).join('');
}

/** Отрисовать слоты изображений для одной страницы */
function renderPageImageSlots(manager, container, page, pageIndex) {
  for (const [i, img] of getPageSlots(page).entries()) {
    const group = document.createElement('div');
    group.className = 'album-image-group';

    const slot = document.createElement('div');
    slot.className = `album-image-slot${img ? ' has-image' : ''}`;

    const tmpl = document.getElementById('tmpl-album-image-slot');
    const slotContent = tmpl.content.cloneNode(true);
    slotContent.querySelector('.album-image-slot-placeholder-text').textContent = t('admin.album.photoLabel', { index: i + 1 });
    slotContent.querySelector('.album-image-slot-num').textContent = i + 1;
    slot.appendChild(slotContent);

    if (img) {
      const imgEl = document.createElement('img');
      imgEl.className = 'album-image-slot-img';
      imgEl.src = img.dataUrl;
      if (img.rotation) {
        imgEl.style.transform = `rotate(${img.rotation}deg)`;
      }
      slot.insertBefore(imgEl, slot.firstChild);
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.hidden = true;

    // Показывать кнопку сброса кадрирования только если есть оригинал, отличный от текущего
    const isCropped = img?.originalDataUrl && img.originalDataUrl !== img.dataUrl;
    const uncropBtn = slot.querySelector('.album-image-slot-uncrop');
    if (!isCropped) uncropBtn.style.display = 'none';

    slot.addEventListener('click', (e) => {
      if (e.target.closest('.album-image-slot-remove')) return;
      if (e.target.closest('.album-image-slot-crop')) return;
      if (e.target.closest('.album-image-slot-uncrop')) return;
      if (e.target.closest('.album-image-slot-rotate')) return;
      fileInput.click();
    });

    slot.querySelector('.album-image-slot-crop').addEventListener('click', () => {
      if (!page.images[i]?.dataUrl) return;
      manager._cropPageImage(pageIndex, i);
    });

    uncropBtn.addEventListener('click', () => {
      manager._resetCrop(pageIndex, i);
    });

    slot.querySelector('.album-image-slot-rotate').addEventListener('click', () => {
      if (!page.images[i]?.dataUrl) return;
      manager._rotatePageImage(pageIndex, i);
    });

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (!manager._module._validateFile(file, { maxSize: IMAGE_MAX_FILE_SIZE, mimePrefix: 'image/', inputEl: fileInput })) return;
      manager._readPageImageFile(file, pageIndex, i);
      fileInput.value = '';
    });

    // Drag & Drop загрузка фото
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      slot.classList.add('drag-over');
    });
    slot.addEventListener('dragleave', () => {
      slot.classList.remove('drag-over');
    });
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (!manager._module._validateFile(file, { maxSize: IMAGE_MAX_FILE_SIZE, mimePrefix: 'image/' })) return;
      manager._readPageImageFile(file, pageIndex, i);
    });

    slot.querySelector('.album-image-slot-remove').addEventListener('click', () => {
      manager._isDirty = true;
      page.images[i] = null;
      manager._renderAlbumPages();
    });

    group.appendChild(slot);
    group.appendChild(fileInput);

    const captionInput = document.createElement('input');
    captionInput.type = 'text';
    captionInput.className = 'album-image-slot-caption';
    captionInput.placeholder = t('admin.album.captionPlaceholder');
    captionInput.value = img?.caption || '';
    captionInput.addEventListener('input', () => {
      manager._isDirty = true;
      if (!page.images[i]) page.images[i] = { dataUrl: '', caption: '' };
      page.images[i].caption = captionInput.value;
    });
    group.appendChild(captionInput);

    // Рамка и фильтр
    const optionsRow = document.createElement('div');
    optionsRow.className = 'album-image-options';

    const frameSelect = buildOptionSelect(
      getFrameOptions(), img?.frame || 'none', (val) => {
        manager._ensureImageData(page, i);
        page.images[i].frame = val;
      },
    );
    optionsRow.appendChild(frameSelect);

    const currentFilter = img?.filter || 'none';
    const filterSelect = buildOptionSelect(
      getFilterOptions(), currentFilter, (val) => {
        manager._ensureImageData(page, i);
        page.images[i].filter = val;
        // Показать/скрыть слайдер интенсивности
        intensityRow.hidden = val === 'none';
        // Обновить превью фильтра на миниатюре
        applyFilterPreview(slot, page.images[i]);
      },
    );
    optionsRow.appendChild(filterSelect);

    group.appendChild(optionsRow);

    // Слайдер интенсивности фильтра
    const intensityRow = document.createElement('div');
    intensityRow.className = 'album-filter-intensity';
    intensityRow.hidden = currentFilter === 'none';

    const intensityLabel = document.createElement('span');
    intensityLabel.className = 'album-filter-intensity-label';
    intensityLabel.textContent = `${img?.filterIntensity ?? DEFAULT_FILTER_INTENSITY}%`;

    const intensityRange = document.createElement('input');
    intensityRange.type = 'range';
    intensityRange.className = 'album-filter-intensity-range';
    intensityRange.min = '0';
    intensityRange.max = '100';
    intensityRange.value = String(img?.filterIntensity ?? DEFAULT_FILTER_INTENSITY);

    intensityRange.addEventListener('input', () => {
      manager._ensureImageData(page, i);
      const val = Number(intensityRange.value);
      page.images[i].filterIntensity = val;
      intensityLabel.textContent = `${val}%`;
      applyFilterPreview(slot, page.images[i]);
    });

    intensityRow.appendChild(intensityRange);
    intensityRow.appendChild(intensityLabel);
    group.appendChild(intensityRow);

    // Превью фильтра на миниатюре
    applyFilterPreview(slot, img);

    container.appendChild(group);
  }
}

/** Создать <select> для выбора рамки/фильтра */
export function buildOptionSelect(options, activeId, onChange) {
  const select = document.createElement('select');
  select.className = 'album-image-option-select';
  for (const opt of options) {
    const option = document.createElement('option');
    option.value = opt.id;
    option.textContent = opt.label;
    if (opt.id === activeId) option.selected = true;
    select.appendChild(option);
  }
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

/** Применить превью фильтра к миниатюре в слоте */
export function applyFilterPreview(slot, img) {
  const imgEl = slot.querySelector('.album-image-slot-img');
  if (!imgEl) return;
  const filterStyle = computeFilterStyle(img?.filter, img?.filterIntensity);
  imgEl.style.filter = filterStyle || '';
}

/** Получить DOM-элемент слота по индексу страницы и изображения */
export function getSlotElement(manager, pageIndex, imageIndex) {
  const pageCard = manager.albumPagesEl?.children[pageIndex];
  if (!pageCard) return null;
  const slots = pageCard.querySelectorAll('.album-image-slot');
  return slots[imageIndex] || null;
}
