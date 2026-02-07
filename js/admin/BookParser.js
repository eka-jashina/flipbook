/**
 * BookParser
 *
 * Парсер электронных книг (EPUB, FB2).
 * Извлекает главы и метаданные из загруженных файлов.
 *
 * Каждая глава преобразуется в HTML-формат, совместимый с ридером:
 * <article><h2>Заголовок</h2><p>Текст...</p></article>
 */

import JSZip from 'jszip';

/**
 * Результат парсинга книги
 * @typedef {Object} ParsedBook
 * @property {string} title - Заголовок книги
 * @property {string} author - Автор
 * @property {ParsedChapter[]} chapters - Массив глав
 */

/**
 * Глава книги
 * @typedef {Object} ParsedChapter
 * @property {string} id - Уникальный идентификатор
 * @property {string} title - Заголовок главы
 * @property {string} html - HTML-контент главы
 */

export class BookParser {
  /**
   * Определить формат файла и распарсить
   * @param {File} file - Загруженный файл
   * @returns {Promise<ParsedBook>}
   */
  static async parse(file) {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (ext === '.epub') {
      return BookParser.parseEpub(file);
    }

    if (ext === '.fb2') {
      return BookParser.parseFb2(file);
    }

    throw new Error(`Неподдерживаемый формат: ${ext}. Допустимы .epub и .fb2`);
  }

  // --- EPUB ---

  /**
   * Парсинг EPUB файла
   * @param {File} file
   * @returns {Promise<ParsedBook>}
   */
  static async parseEpub(file) {
    const zip = await JSZip.loadAsync(file);

    // 1. Найти путь к content.opf через META-INF/container.xml
    const containerXml = await BookParser._readZipFile(zip, 'META-INF/container.xml');
    const containerDoc = BookParser._parseXml(containerXml);
    const rootfileEl = containerDoc.querySelector('rootfile');
    if (!rootfileEl) {
      throw new Error('Не найден rootfile в container.xml');
    }
    const opfPath = rootfileEl.getAttribute('full-path');
    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

    // 2. Парсинг content.opf — метаданные и spine
    const opfXml = await BookParser._readZipFile(zip, opfPath);
    const opfDoc = BookParser._parseXml(opfXml);

    // Метаданные
    const title = BookParser._getTextContent(opfDoc, 'dc\\:title, title') || file.name.replace(/\.epub$/i, '');
    const author = BookParser._getTextContent(opfDoc, 'dc\\:creator, creator') || '';

    // Manifest — карта id → href
    const manifest = new Map();
    for (const item of opfDoc.querySelectorAll('manifest > item')) {
      manifest.set(item.getAttribute('id'), {
        href: item.getAttribute('href'),
        mediaType: item.getAttribute('media-type'),
      });
    }

    // Spine — порядок чтения
    const spineItems = [];
    for (const itemref of opfDoc.querySelectorAll('spine > itemref')) {
      const idref = itemref.getAttribute('idref');
      const entry = manifest.get(idref);
      if (entry) {
        spineItems.push(entry);
      }
    }

    // 3. Загрузить и обработать изображения (base64 data URLs)
    const imageMap = await BookParser._loadEpubImages(zip, opfDir, manifest);

    // 4. Загрузить и парсить контент глав
    const rawChapters = [];
    for (const item of spineItems) {
      if (!item.mediaType?.includes('html') && !item.mediaType?.includes('xml')) {
        continue;
      }
      const filePath = opfDir + item.href;
      const html = await BookParser._readZipFile(zip, filePath);
      const chapterDir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/') + 1) : '';
      rawChapters.push({ html, dir: chapterDir });
    }

    // 5. Разделить на главы по заголовкам
    const chapters = BookParser._splitEpubChapters(rawChapters, imageMap);

    if (chapters.length === 0) {
      throw new Error('Не удалось извлечь главы из EPUB');
    }

    return { title, author, chapters };
  }

  /**
   * Прочитать файл из ZIP-архива
   * @private
   */
  static async _readZipFile(zip, path) {
    // Попробовать точный путь, затем без начального слеша
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    const file = zip.file(cleanPath);
    if (!file) {
      throw new Error(`Файл не найден в архиве: ${cleanPath}`);
    }
    return file.async('string');
  }

  /**
   * Загрузить изображения из EPUB как base64 data URLs
   * @private
   */
  static async _loadEpubImages(zip, opfDir, manifest) {
    const imageMap = new Map();

    for (const [, entry] of manifest) {
      if (!entry.mediaType?.startsWith('image/')) continue;
      const imgPath = opfDir + entry.href;
      const cleanPath = imgPath.startsWith('/') ? imgPath.substring(1) : imgPath;
      const imgFile = zip.file(cleanPath);
      if (!imgFile) continue;

      const imgData = await imgFile.async('base64');
      const dataUrl = `data:${entry.mediaType};base64,${imgData}`;

      // Сохраняем по нескольким ключам для сопоставления
      imageMap.set(cleanPath, dataUrl);
      imageMap.set(entry.href, dataUrl);
      // Часто в EPUB src="../images/foo.jpg" — нужен только basename
      const basename = entry.href.split('/').pop();
      if (basename) {
        imageMap.set(basename, dataUrl);
      }
    }

    return imageMap;
  }

  /**
   * Разделить EPUB-контент на главы
   * @private
   */
  static _splitEpubChapters(rawChapters, imageMap) {
    const result = [];
    let chapterIndex = 0;

    for (const { html, dir } of rawChapters) {
      const doc = BookParser._parseHtml(html);
      const body = doc.body || doc.documentElement;

      // Извлечь текстовое содержимое
      const elements = BookParser._extractElements(body, imageMap, dir);
      if (elements.trim().length === 0) continue;

      // Попробовать разделить по заголовкам h1/h2/h3 внутри одного spine-файла
      const subChapters = BookParser._splitByHeadings(body, imageMap, dir);

      if (subChapters.length > 1) {
        for (const sub of subChapters) {
          chapterIndex++;
          result.push({
            id: `chapter_${chapterIndex}`,
            title: sub.title || `Глава ${chapterIndex}`,
            html: `<article>\n<h2>${BookParser._escapeHtml(sub.title || `Глава ${chapterIndex}`)}</h2>\n${sub.content}\n</article>`,
          });
        }
      } else {
        // Один файл = одна глава
        chapterIndex++;
        const heading = body.querySelector('h1, h2, h3');
        const chTitle = heading?.textContent?.trim() || `Глава ${chapterIndex}`;

        result.push({
          id: `chapter_${chapterIndex}`,
          title: chTitle,
          html: `<article>\n${elements}\n</article>`,
        });
      }
    }

    return result;
  }

  /**
   * Разделить содержимое body по заголовкам
   * @private
   */
  static _splitByHeadings(body, imageMap, dir) {
    const headingTags = new Set(['H1', 'H2', 'H3']);
    const children = Array.from(body.children);
    const sections = [];
    let currentTitle = '';
    let currentContent = '';

    for (const el of children) {
      if (headingTags.has(el.tagName)) {
        // Если накоплен контент — сохранить секцию
        if (currentContent.trim()) {
          sections.push({ title: currentTitle, content: currentContent });
        }
        currentTitle = el.textContent.trim();
        currentContent = `<h2>${BookParser._escapeHtml(currentTitle)}</h2>\n`;
      } else {
        currentContent += `${BookParser._convertElement(el, imageMap, dir)}\n`;
      }
    }

    // Последняя секция
    if (currentContent.trim()) {
      sections.push({ title: currentTitle, content: currentContent });
    }

    return sections;
  }

  /**
   * Извлечь элементы из тела документа
   * @private
   */
  static _extractElements(body, imageMap, dir) {
    const parts = [];
    for (const child of body.children) {
      parts.push(BookParser._convertElement(child, imageMap, dir));
    }
    return parts.join('\n');
  }

  /**
   * Конвертировать DOM-элемент в чистый HTML для ридера
   * @private
   */
  static _convertElement(el, imageMap, dir) {
    const tag = el.tagName.toLowerCase();

    // Заголовки → h2
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
      return `<h2>${BookParser._escapeHtml(el.textContent.trim())}</h2>`;
    }

    // Параграфы
    if (tag === 'p') {
      const inner = BookParser._convertInlineContent(el, imageMap, dir);
      if (!inner.trim()) return '';
      return `<p>${inner}</p>`;
    }

    // Изображения
    if (tag === 'img') {
      return BookParser._convertImage(el, imageMap, dir);
    }

    // SVG-обёртки изображений
    if (tag === 'svg' || tag === 'image') {
      return '';
    }

    // Div / section — рекурсивно
    if (['div', 'section', 'article', 'main', 'aside', 'blockquote'].includes(tag)) {
      const parts = [];
      for (const child of el.children) {
        const converted = BookParser._convertElement(child, imageMap, dir);
        if (converted) parts.push(converted);
      }
      if (tag === 'blockquote') {
        return `<blockquote>${parts.join('\n')}</blockquote>`;
      }
      return parts.join('\n');
    }

    // Списки
    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(el.querySelectorAll('li'))
        .map(li => `<li>${BookParser._escapeHtml(li.textContent.trim())}</li>`)
        .join('\n');
      return `<${tag}>\n${items}\n</${tag}>`;
    }

    // Прочее — извлечь текст как параграф
    const text = el.textContent.trim();
    if (text) {
      return `<p>${BookParser._escapeHtml(text)}</p>`;
    }

    return '';
  }

  /**
   * Конвертировать inline-содержимое элемента (сохраняя em, strong, a)
   * @private
   */
  static _convertInlineContent(el, imageMap, dir) {
    let result = '';

    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        result += BookParser._escapeHtml(node.textContent);
        continue;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      const tag = node.tagName.toLowerCase();

      if (tag === 'img') {
        result += BookParser._convertImage(node, imageMap, dir);
        continue;
      }

      if (['em', 'i'].includes(tag)) {
        result += `<em>${BookParser._convertInlineContent(node, imageMap, dir)}</em>`;
        continue;
      }

      if (['strong', 'b'].includes(tag)) {
        result += `<strong>${BookParser._convertInlineContent(node, imageMap, dir)}</strong>`;
        continue;
      }

      if (tag === 'a') {
        result += BookParser._convertInlineContent(node, imageMap, dir);
        continue;
      }

      if (tag === 'br') {
        result += '<br>';
        continue;
      }

      if (tag === 'span' || tag === 'sub' || tag === 'sup') {
        result += BookParser._convertInlineContent(node, imageMap, dir);
        continue;
      }

      // Прочие inline-элементы — только текст
      result += BookParser._escapeHtml(node.textContent);
    }

    return result;
  }

  /**
   * Конвертировать изображение с заменой src на data URL
   * @private
   */
  static _convertImage(imgEl, imageMap, dir) {
    const src = imgEl.getAttribute('src') || imgEl.getAttribute('xlink:href') || '';
    if (!src) return '';

    // Попытка найти data URL
    const dataUrl = BookParser._resolveImage(src, imageMap, dir);
    if (dataUrl) {
      return `<img src="${dataUrl}" alt="">`;
    }

    return '';
  }

  /**
   * Резолвить путь к изображению в data URL
   * @private
   */
  static _resolveImage(src, imageMap, dir) {
    // Прямое совпадение
    if (imageMap.has(src)) return imageMap.get(src);

    // Относительный путь от директории главы
    const resolved = BookParser._resolveRelativePath(dir, src);
    if (imageMap.has(resolved)) return imageMap.get(resolved);

    // Только имя файла
    const basename = src.split('/').pop();
    if (basename && imageMap.has(basename)) return imageMap.get(basename);

    return null;
  }

  /**
   * Резолвить относительный путь
   * @private
   */
  static _resolveRelativePath(base, relative) {
    if (!relative.startsWith('.')) return relative;

    const baseParts = base.split('/').filter(Boolean);
    const relParts = relative.split('/');

    for (const part of relParts) {
      if (part === '..') {
        baseParts.pop();
      } else if (part !== '.') {
        baseParts.push(part);
      }
    }

    return baseParts.join('/');
  }

  // --- FB2 ---

  /**
   * Парсинг FB2 файла
   * @param {File} file
   * @returns {Promise<ParsedBook>}
   */
  static async parseFb2(file) {
    const text = await file.text();
    const doc = BookParser._parseXml(text);

    // Метаданные
    const titleInfo = doc.querySelector('title-info');
    const title = BookParser._getFb2Text(titleInfo, 'book-title') || file.name.replace(/\.fb2$/i, '');
    const authorFirst = BookParser._getFb2Text(titleInfo, 'author first-name') || '';
    const authorMiddle = BookParser._getFb2Text(titleInfo, 'author middle-name') || '';
    const authorLast = BookParser._getFb2Text(titleInfo, 'author last-name') || '';
    const author = [authorFirst, authorMiddle, authorLast].filter(Boolean).join(' ');

    // Загрузить встроенные изображения (binary)
    const imageMap = BookParser._loadFb2Images(doc);

    // Извлечь главы из <body>
    const bodyEl = doc.querySelector('body');
    if (!bodyEl) {
      throw new Error('Не найден элемент <body> в FB2');
    }

    const chapters = BookParser._parseFb2Sections(bodyEl, imageMap);

    if (chapters.length === 0) {
      throw new Error('Не удалось извлечь главы из FB2');
    }

    return { title, author, chapters };
  }

  /**
   * Загрузить изображения из FB2 binary-секций
   * @private
   */
  static _loadFb2Images(doc) {
    const imageMap = new Map();

    for (const binary of doc.querySelectorAll('binary')) {
      const id = binary.getAttribute('id');
      const contentType = binary.getAttribute('content-type') || 'image/jpeg';
      const base64 = binary.textContent.trim();
      if (id && base64) {
        const dataUrl = `data:${contentType};base64,${base64}`;
        imageMap.set(id, dataUrl);
        imageMap.set(`#${id}`, dataUrl);
      }
    }

    return imageMap;
  }

  /**
   * Извлечь главы из FB2 <body>
   * @private
   */
  static _parseFb2Sections(bodyEl, imageMap) {
    const sections = bodyEl.querySelectorAll(':scope > section');
    const chapters = [];

    if (sections.length === 0) {
      // Нет секций — всё тело как одна глава
      const html = BookParser._convertFb2Elements(bodyEl, imageMap);
      if (html.trim()) {
        chapters.push({
          id: 'chapter_1',
          title: 'Глава 1',
          html: `<article>\n<h2>Глава 1</h2>\n${html}\n</article>`,
        });
      }
      return chapters;
    }

    let chapterIndex = 0;

    for (const section of sections) {
      const result = BookParser._parseFb2Section(section, imageMap, chapterIndex);
      for (const ch of result) {
        chapterIndex++;
        ch.id = `chapter_${chapterIndex}`;
        if (!ch.title) ch.title = `Глава ${chapterIndex}`;
        chapters.push(ch);
      }
    }

    return chapters;
  }

  /**
   * Парсить одну FB2 секцию (рекурсивно для вложенных секций)
   * @private
   */
  static _parseFb2Section(section, imageMap, baseIndex) {
    const subSections = section.querySelectorAll(':scope > section');

    // Заголовок секции
    const titleEl = section.querySelector(':scope > title');
    const sectionTitle = titleEl ? BookParser._extractFb2Title(titleEl) : '';

    if (subSections.length > 0) {
      // Есть подсекции — каждая станет отдельной главой
      const results = [];
      let idx = baseIndex;

      // Контент до первой подсекции (если есть)
      const preamble = BookParser._convertFb2DirectContent(section, imageMap);
      if (preamble.trim()) {
        results.push({
          id: '',
          title: sectionTitle,
          html: `<article>\n<h2>${BookParser._escapeHtml(sectionTitle || `Глава ${idx + 1}`)}</h2>\n${preamble}\n</article>`,
        });
        idx++;
      }

      for (const sub of subSections) {
        const subResults = BookParser._parseFb2Section(sub, imageMap, idx);
        results.push(...subResults);
        idx += subResults.length;
      }

      return results;
    }

    // Нет подсекций — это листовая секция (одна глава)
    const content = BookParser._convertFb2Elements(section, imageMap);
    if (!content.trim()) return [];

    return [{
      id: '',
      title: sectionTitle,
      html: `<article>\n<h2>${BookParser._escapeHtml(sectionTitle || `Глава ${baseIndex + 1}`)}</h2>\n${content}\n</article>`,
    }];
  }

  /**
   * Извлечь заголовок из FB2 <title>
   * @private
   */
  static _extractFb2Title(titleEl) {
    const parts = [];
    for (const p of titleEl.querySelectorAll('p')) {
      const text = p.textContent.trim();
      if (text) parts.push(text);
    }
    return parts.join('. ') || titleEl.textContent.trim();
  }

  /**
   * Конвертировать только непосредственный контент секции (без вложенных section)
   * @private
   */
  static _convertFb2DirectContent(section, imageMap) {
    const parts = [];

    for (const child of section.children) {
      if (child.tagName.toLowerCase() === 'section') continue;
      if (child.tagName.toLowerCase() === 'title') continue;
      parts.push(BookParser._convertFb2Element(child, imageMap));
    }

    return parts.filter(Boolean).join('\n');
  }

  /**
   * Конвертировать все элементы FB2 секции в HTML
   * @private
   */
  static _convertFb2Elements(section, imageMap) {
    const parts = [];

    for (const child of section.children) {
      if (child.tagName.toLowerCase() === 'title') continue;
      if (child.tagName.toLowerCase() === 'section') continue;
      parts.push(BookParser._convertFb2Element(child, imageMap));
    }

    return parts.filter(Boolean).join('\n');
  }

  /**
   * Конвертировать один FB2-элемент в HTML
   * @private
   */
  static _convertFb2Element(el, imageMap) {
    const tag = el.tagName.toLowerCase();

    if (tag === 'p') {
      const inner = BookParser._convertFb2Inline(el, imageMap);
      if (!inner.trim()) return '';
      return `<p>${inner}</p>`;
    }

    if (tag === 'empty-line') {
      return '<p>&nbsp;</p>';
    }

    if (tag === 'subtitle') {
      return `<h2>${BookParser._escapeHtml(el.textContent.trim())}</h2>`;
    }

    if (tag === 'epigraph') {
      const parts = [];
      for (const child of el.children) {
        parts.push(BookParser._convertFb2Element(child, imageMap));
      }
      return `<blockquote>${parts.filter(Boolean).join('\n')}</blockquote>`;
    }

    if (tag === 'cite') {
      const parts = [];
      for (const child of el.children) {
        parts.push(BookParser._convertFb2Element(child, imageMap));
      }
      return `<blockquote>${parts.filter(Boolean).join('\n')}</blockquote>`;
    }

    if (tag === 'poem') {
      return BookParser._convertFb2Poem(el, imageMap);
    }

    if (tag === 'image') {
      const href = el.getAttribute('l:href') || el.getAttribute('xlink:href') || el.getAttribute('href') || '';
      const dataUrl = imageMap.get(href) || imageMap.get(href.replace('#', ''));
      if (dataUrl) {
        return `<img src="${dataUrl}" alt="">`;
      }
      return '';
    }

    if (tag === 'table') {
      return `<p>${BookParser._escapeHtml(el.textContent.trim())}</p>`;
    }

    if (tag === 'text-author') {
      return `<p><em>${BookParser._escapeHtml(el.textContent.trim())}</em></p>`;
    }

    if (tag === 'annotation') {
      const parts = [];
      for (const child of el.children) {
        parts.push(BookParser._convertFb2Element(child, imageMap));
      }
      return parts.filter(Boolean).join('\n');
    }

    // Прочее — текст
    const text = el.textContent.trim();
    if (text) return `<p>${BookParser._escapeHtml(text)}</p>`;

    return '';
  }

  /**
   * Конвертировать inline FB2-контент
   * @private
   */
  static _convertFb2Inline(el, imageMap) {
    let result = '';

    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        result += BookParser._escapeHtml(node.textContent);
        continue;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      const tag = node.tagName.toLowerCase();

      if (tag === 'emphasis') {
        result += `<em>${BookParser._convertFb2Inline(node, imageMap)}</em>`;
      } else if (tag === 'strong') {
        result += `<strong>${BookParser._convertFb2Inline(node, imageMap)}</strong>`;
      } else if (tag === 'strikethrough') {
        result += `<s>${BookParser._convertFb2Inline(node, imageMap)}</s>`;
      } else if (tag === 'a') {
        result += BookParser._convertFb2Inline(node, imageMap);
      } else if (tag === 'image') {
        const href = node.getAttribute('l:href') || node.getAttribute('xlink:href') || node.getAttribute('href') || '';
        const dataUrl = imageMap.get(href) || imageMap.get(href.replace('#', ''));
        if (dataUrl) {
          result += `<img src="${dataUrl}" alt="">`;
        }
      } else if (tag === 'sup') {
        result += `<sup>${BookParser._convertFb2Inline(node, imageMap)}</sup>`;
      } else if (tag === 'sub') {
        result += `<sub>${BookParser._convertFb2Inline(node, imageMap)}</sub>`;
      } else {
        result += BookParser._escapeHtml(node.textContent);
      }
    }

    return result;
  }

  /**
   * Конвертировать FB2 <poem>
   * @private
   */
  static _convertFb2Poem(poemEl, imageMap) {
    const lines = [];

    for (const child of poemEl.children) {
      const tag = child.tagName.toLowerCase();

      if (tag === 'title') {
        lines.push(`<h2>${BookParser._escapeHtml(child.textContent.trim())}</h2>`);
      } else if (tag === 'stanza') {
        for (const v of child.querySelectorAll('v')) {
          lines.push(`<p>${BookParser._convertFb2Inline(v, imageMap)}</p>`);
        }
        lines.push('<p>&nbsp;</p>');
      } else if (tag === 'text-author') {
        lines.push(`<p><em>${BookParser._escapeHtml(child.textContent.trim())}</em></p>`);
      } else if (tag === 'epigraph') {
        lines.push(BookParser._convertFb2Element(child, imageMap));
      }
    }

    return lines.filter(Boolean).join('\n');
  }

  // --- Утилиты ---

  /**
   * Парсинг XML-строки
   * @private
   */
  static _parseXml(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      // Попробовать как text/html если XML-парсинг не удался
      return parser.parseFromString(xmlString, 'text/html');
    }

    return doc;
  }

  /**
   * Парсинг HTML-строки
   * @private
   */
  static _parseHtml(htmlString) {
    const parser = new DOMParser();
    return parser.parseFromString(htmlString, 'text/html');
  }

  /**
   * Получить текстовое содержимое элемента по селектору
   * @private
   */
  static _getTextContent(doc, selector) {
    const el = doc.querySelector(selector);
    return el?.textContent?.trim() || '';
  }

  /**
   * Получить текст из FB2-элемента по селектору
   * @private
   */
  static _getFb2Text(parent, selector) {
    if (!parent) return '';
    const el = parent.querySelector(selector);
    return el?.textContent?.trim() || '';
  }

  /**
   * Экранирование HTML
   * @private
   */
  static _escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
