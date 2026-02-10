/**
 * TESTS: BookParser
 * Тесты для парсера электронных книг
 */

import { describe, it, expect, vi } from 'vitest';
import { BookParser } from '../../../js/admin/BookParser.js';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Создать мок File с текстовым содержимым
 * jsdom не поддерживает File.text(), поэтому добавляем его вручную
 */
function createTextFile(name, content) {
  const blob = new Blob([content], { type: 'text/plain' });
  const file = new File([blob], name, { type: 'text/plain' });
  file.text = () => Promise.resolve(content);
  return file;
}

/**
 * Создать мок File с бинарным содержимым (ArrayBuffer)
 */
function createBinaryFile(name, buffer) {
  const file = new File([buffer], name);
  file.arrayBuffer = () => Promise.resolve(buffer);
  return file;
}

describe('BookParser', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // _escapeHtml
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_escapeHtml', () => {
    it('should escape ampersands', () => {
      expect(BookParser._escapeHtml('A & B')).toBe('A &amp; B');
    });

    it('should escape angle brackets', () => {
      expect(BookParser._escapeHtml('<div>')).toBe('&lt;div&gt;');
    });

    it('should escape double quotes', () => {
      expect(BookParser._escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    });

    it('should escape all special characters together', () => {
      expect(BookParser._escapeHtml('<a href="x">&</a>')).toBe(
        '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;'
      );
    });

    it('should handle empty string', () => {
      expect(BookParser._escapeHtml('')).toBe('');
    });

    it('should not escape regular text', () => {
      expect(BookParser._escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _parseXml
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_parseXml', () => {
    it('should parse valid XML', () => {
      const doc = BookParser._parseXml('<root><child>text</child></root>');
      expect(doc.querySelector('child').textContent).toBe('text');
    });

    it('should fallback to HTML parsing on invalid XML', () => {
      // Невалидный XML, но валидный HTML
      const doc = BookParser._parseXml('<div><p>text</div>');
      expect(doc).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _parseHtml
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_parseHtml', () => {
    it('should parse HTML string into document', () => {
      const doc = BookParser._parseHtml('<html><body><p>Hello</p></body></html>');
      expect(doc.querySelector('p').textContent).toBe('Hello');
    });

    it('should handle fragment HTML', () => {
      const doc = BookParser._parseHtml('<p>fragment</p>');
      expect(doc.querySelector('p').textContent).toBe('fragment');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _getTextContent
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_getTextContent', () => {
    it('should get text content by selector', () => {
      const doc = BookParser._parseXml('<root><title>My Title</title></root>');
      expect(BookParser._getTextContent(doc, 'title')).toBe('My Title');
    });

    it('should return empty string if selector not found', () => {
      const doc = BookParser._parseXml('<root></root>');
      expect(BookParser._getTextContent(doc, 'title')).toBe('');
    });

    it('should trim whitespace', () => {
      const doc = BookParser._parseXml('<root><title>  spaced  </title></root>');
      expect(BookParser._getTextContent(doc, 'title')).toBe('spaced');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _getFb2Text
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_getFb2Text', () => {
    it('should get text from FB2 element', () => {
      const doc = BookParser._parseXml(
        '<title-info><book-title>FB2 Book</book-title></title-info>'
      );
      const parent = doc.querySelector('title-info');
      expect(BookParser._getFb2Text(parent, 'book-title')).toBe('FB2 Book');
    });

    it('should return empty string for null parent', () => {
      expect(BookParser._getFb2Text(null, 'book-title')).toBe('');
    });

    it('should return empty string if not found', () => {
      const doc = BookParser._parseXml('<title-info></title-info>');
      const parent = doc.querySelector('title-info');
      expect(BookParser._getFb2Text(parent, 'book-title')).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _resolveRelativePath
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_resolveRelativePath', () => {
    it('should resolve ../ paths', () => {
      expect(BookParser._resolveRelativePath('OEBPS/Text/', '../Images/img.png'))
        .toBe('OEBPS/Images/img.png');
    });

    it('should resolve ./ paths', () => {
      expect(BookParser._resolveRelativePath('dir/', './file.txt'))
        .toBe('dir/file.txt');
    });

    it('should resolve non-dot-relative path against base directory', () => {
      expect(BookParser._resolveRelativePath('dir/', 'images/img.png'))
        .toBe('dir/images/img.png');
    });

    it('should handle multiple ../ levels', () => {
      expect(BookParser._resolveRelativePath('a/b/c/', '../../img.png'))
        .toBe('a/img.png');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _convertElement
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_convertElement', () => {
    const imageMap = new Map();

    it('should convert headings to h2', () => {
      const doc = BookParser._parseHtml('<h1>Title</h1>');
      const result = BookParser._convertElement(doc.querySelector('h1'), imageMap, '');
      expect(result).toBe('<h2>Title</h2>');
    });

    it('should convert h3 to h2', () => {
      const doc = BookParser._parseHtml('<h3>Subtitle</h3>');
      const result = BookParser._convertElement(doc.querySelector('h3'), imageMap, '');
      expect(result).toBe('<h2>Subtitle</h2>');
    });

    it('should convert paragraphs', () => {
      const doc = BookParser._parseHtml('<p>Some text</p>');
      const result = BookParser._convertElement(doc.querySelector('p'), imageMap, '');
      expect(result).toBe('<p>Some text</p>');
    });

    it('should skip empty paragraphs', () => {
      const doc = BookParser._parseHtml('<p>  </p>');
      const result = BookParser._convertElement(doc.querySelector('p'), imageMap, '');
      expect(result).toBe('');
    });

    it('should convert lists', () => {
      const doc = BookParser._parseHtml('<ul><li>Item 1</li><li>Item 2</li></ul>');
      const result = BookParser._convertElement(doc.querySelector('ul'), imageMap, '');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Item 1</li>');
      expect(result).toContain('<li>Item 2</li>');
    });

    it('should convert ordered lists', () => {
      const doc = BookParser._parseHtml('<ol><li>First</li></ol>');
      const result = BookParser._convertElement(doc.querySelector('ol'), imageMap, '');
      expect(result).toContain('<ol>');
      expect(result).toContain('<li>First</li>');
    });

    it('should convert blockquote', () => {
      const doc = BookParser._parseHtml('<blockquote><p>Quote</p></blockquote>');
      const result = BookParser._convertElement(doc.querySelector('blockquote'), imageMap, '');
      expect(result).toContain('<blockquote>');
      expect(result).toContain('<p>Quote</p>');
    });

    it('should recursively handle div', () => {
      const doc = BookParser._parseHtml('<div><p>Inside div</p></div>');
      const result = BookParser._convertElement(doc.querySelector('div'), imageMap, '');
      expect(result).toBe('<p>Inside div</p>');
    });

    it('should handle unknown elements as text paragraphs', () => {
      const doc = BookParser._parseHtml('<span>Some text</span>');
      const span = doc.querySelector('span');
      // Span внутри body, а не inline внутри p
      const result = BookParser._convertElement(span, imageMap, '');
      expect(result).toBe('<p>Some text</p>');
    });

    it('should return empty string for elements with no text', () => {
      const doc = BookParser._parseHtml('<div></div>');
      const result = BookParser._convertElement(doc.querySelector('div'), imageMap, '');
      expect(result).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _convertInlineContent
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_convertInlineContent', () => {
    const imageMap = new Map();

    it('should preserve em/i as <em>', () => {
      const doc = BookParser._parseHtml('<p><em>italic</em></p>');
      const result = BookParser._convertInlineContent(doc.querySelector('p'), imageMap, '');
      expect(result).toBe('<em>italic</em>');
    });

    it('should preserve strong/b as <strong>', () => {
      const doc = BookParser._parseHtml('<p><strong>bold</strong></p>');
      const result = BookParser._convertInlineContent(doc.querySelector('p'), imageMap, '');
      expect(result).toBe('<strong>bold</strong>');
    });

    it('should handle <br> tags', () => {
      const doc = BookParser._parseHtml('<p>line1<br>line2</p>');
      const result = BookParser._convertInlineContent(doc.querySelector('p'), imageMap, '');
      expect(result).toContain('<br>');
    });

    it('should strip links but preserve text', () => {
      const doc = BookParser._parseHtml('<p><a href="http://example.com">Link text</a></p>');
      const result = BookParser._convertInlineContent(doc.querySelector('p'), imageMap, '');
      expect(result).toBe('Link text');
      expect(result).not.toContain('<a');
    });

    it('should handle mixed inline content', () => {
      const doc = BookParser._parseHtml('<p>Normal <em>italic</em> and <strong>bold</strong></p>');
      const result = BookParser._convertInlineContent(doc.querySelector('p'), imageMap, '');
      expect(result).toBe('Normal <em>italic</em> and <strong>bold</strong>');
    });

    it('should escape HTML in text nodes', () => {
      const doc = BookParser._parseHtml('<p>A &amp; B</p>');
      const result = BookParser._convertInlineContent(doc.querySelector('p'), imageMap, '');
      expect(result).toContain('&amp;');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _convertImage
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_convertImage', () => {
    it('should convert image with mapped src', () => {
      const imageMap = new Map([['img.png', 'data:image/png;base64,abc']]);
      const doc = BookParser._parseHtml('<img src="img.png">');
      const result = BookParser._convertImage(doc.querySelector('img'), imageMap, '');
      expect(result).toBe('<img src="data:image/png;base64,abc" alt="">');
    });

    it('should return empty string for unmapped image', () => {
      const imageMap = new Map();
      const doc = BookParser._parseHtml('<img src="missing.png">');
      const result = BookParser._convertImage(doc.querySelector('img'), imageMap, '');
      expect(result).toBe('');
    });

    it('should return empty string for image without src', () => {
      const imageMap = new Map();
      const doc = BookParser._parseHtml('<img>');
      const result = BookParser._convertImage(doc.querySelector('img'), imageMap, '');
      expect(result).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _resolveImage
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_resolveImage', () => {
    it('should resolve direct match', () => {
      const imageMap = new Map([['images/pic.png', 'data:abc']]);
      expect(BookParser._resolveImage('images/pic.png', imageMap, '')).toBe('data:abc');
    });

    it('should resolve by basename', () => {
      const imageMap = new Map([['pic.png', 'data:abc']]);
      expect(BookParser._resolveImage('path/to/pic.png', imageMap, '')).toBe('data:abc');
    });

    it('should resolve relative path', () => {
      const imageMap = new Map([['OEBPS/Images/pic.png', 'data:abc']]);
      expect(BookParser._resolveImage('../Images/pic.png', imageMap, 'OEBPS/Text/')).toBe('data:abc');
    });

    it('should return null for unresolvable image', () => {
      const imageMap = new Map();
      expect(BookParser._resolveImage('missing.png', imageMap, '')).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // parseTxt
  // ═══════════════════════════════════════════════════════════════════════════

  describe('parseTxt', () => {
    it('should parse simple text file', async () => {
      const file = createTextFile('book.txt', 'First paragraph.\n\nSecond paragraph.');
      const result = await BookParser.parseTxt(file);

      expect(result.title).toBe('book');
      expect(result.author).toBe('');
      expect(result.chapters.length).toBe(1);
      expect(result.chapters[0].id).toBe('chapter_1');
      expect(result.chapters[0].html).toContain('<p>First paragraph.</p>');
      expect(result.chapters[0].html).toContain('<p>Second paragraph.</p>');
    });

    it('should use filename as title (without extension)', async () => {
      const file = createTextFile('my-novel.txt', 'Some text');
      const result = await BookParser.parseTxt(file);
      expect(result.title).toBe('my-novel');
    });

    it('should wrap content in <article>', async () => {
      const file = createTextFile('book.txt', 'Content here');
      const result = await BookParser.parseTxt(file);
      expect(result.chapters[0].html).toMatch(/^<article>/);
      expect(result.chapters[0].html).toMatch(/<\/article>$/);
    });

    it('should escape HTML in text', async () => {
      const file = createTextFile('book.txt', 'Text with <script>alert("xss")</script>');
      const result = await BookParser.parseTxt(file);
      expect(result.chapters[0].html).not.toContain('<script>');
      expect(result.chapters[0].html).toContain('&lt;script&gt;');
    });

    it('should convert newlines within paragraph to <br>', async () => {
      const file = createTextFile('book.txt', 'Line 1\nLine 2\nLine 3');
      const result = await BookParser.parseTxt(file);
      expect(result.chapters[0].html).toContain('Line 1<br>Line 2<br>Line 3');
    });

    it('should throw on empty file', async () => {
      const file = createTextFile('empty.txt', '   ');
      await expect(BookParser.parseTxt(file)).rejects.toThrow('Файл пуст');
    });

    it('should handle multiple paragraphs separated by blank lines', async () => {
      const text = 'Para 1\n\nPara 2\n\n\nPara 3';
      const file = createTextFile('multi.txt', text);
      const result = await BookParser.parseTxt(file);

      const html = result.chapters[0].html;
      expect(html).toContain('<p>Para 1</p>');
      expect(html).toContain('<p>Para 2</p>');
      expect(html).toContain('<p>Para 3</p>');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // parse (format dispatch)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('parse (format dispatch)', () => {
    it('should dispatch .txt files to parseTxt', async () => {
      const spy = vi.spyOn(BookParser, 'parseTxt').mockResolvedValue({ title: '', author: '', chapters: [] });
      const file = createTextFile('book.txt', 'text');
      await BookParser.parse(file);
      expect(spy).toHaveBeenCalledWith(file);
      spy.mockRestore();
    });

    it('should dispatch .epub files to parseEpub', async () => {
      const spy = vi.spyOn(BookParser, 'parseEpub').mockResolvedValue({ title: '', author: '', chapters: [] });
      const file = new File(['data'], 'book.epub');
      await BookParser.parse(file);
      expect(spy).toHaveBeenCalledWith(file);
      spy.mockRestore();
    });

    it('should dispatch .fb2 files to parseFb2', async () => {
      const spy = vi.spyOn(BookParser, 'parseFb2').mockResolvedValue({ title: '', author: '', chapters: [] });
      const file = new File(['data'], 'book.fb2');
      await BookParser.parse(file);
      expect(spy).toHaveBeenCalledWith(file);
      spy.mockRestore();
    });

    it('should dispatch .docx files to parseDocx', async () => {
      const spy = vi.spyOn(BookParser, 'parseDocx').mockResolvedValue({ title: '', author: '', chapters: [] });
      const file = new File(['data'], 'doc.docx');
      await BookParser.parse(file);
      expect(spy).toHaveBeenCalledWith(file);
      spy.mockRestore();
    });

    it('should dispatch .doc files to parseDoc', async () => {
      const spy = vi.spyOn(BookParser, 'parseDoc').mockResolvedValue({ title: '', author: '', chapters: [] });
      const file = new File(['data'], 'doc.doc');
      await BookParser.parse(file);
      expect(spy).toHaveBeenCalledWith(file);
      spy.mockRestore();
    });

    it('should throw on unsupported format', async () => {
      const file = new File(['data'], 'book.pdf');
      await expect(BookParser.parse(file)).rejects.toThrow('Неподдерживаемый формат');
    });

    it('should handle uppercase extensions', async () => {
      const spy = vi.spyOn(BookParser, 'parseTxt').mockResolvedValue({ title: '', author: '', chapters: [] });
      const file = createTextFile('BOOK.TXT', 'text');
      await BookParser.parse(file);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _extractDocText
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_extractDocText', () => {
    it('should extract UTF-16LE text from buffer', () => {
      // Создаём UTF-16LE буфер с длинным текстом
      const text = 'This is a test document with enough characters to be extracted from DOC';
      const buffer = new ArrayBuffer(text.length * 2);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        view[i * 2] = code & 0xFF;
        view[i * 2 + 1] = (code >> 8) & 0xFF;
      }

      const result = BookParser._extractDocText(buffer);
      expect(result).toContain('This is a test document');
    });

    it('should handle empty buffer', () => {
      const buffer = new ArrayBuffer(0);
      const result = BookParser._extractDocText(buffer);
      expect(result).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _extractDocTextAscii
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_extractDocTextAscii', () => {
    it('should extract ASCII text from bytes', () => {
      const text = 'This is a long enough ASCII text to be extracted from a document buffer here';
      const bytes = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) {
        bytes[i] = text.charCodeAt(i);
      }

      const result = BookParser._extractDocTextAscii(bytes);
      expect(result).toContain('This is a long enough ASCII text');
    });

    it('should skip short chunks', () => {
      // Текст короче 30 символов — не должен быть извлечён
      const text = 'Short text';
      const bytes = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) {
        bytes[i] = text.charCodeAt(i);
      }

      const result = BookParser._extractDocTextAscii(bytes);
      expect(result).toBe('');
    });

    it('should normalize line endings', () => {
      const text = 'Line 1\r\nLine 2\rLine 3\nLine 4 and some more text to reach the minimum';
      const bytes = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) {
        bytes[i] = text.charCodeAt(i);
      }

      const result = BookParser._extractDocTextAscii(bytes);
      expect(result).not.toContain('\r');
      expect(result).toContain('\n');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _loadFb2Images
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_loadFb2Images', () => {
    it('should extract binary images from FB2 document', () => {
      const xml = `
        <FictionBook>
          <binary id="cover.jpg" content-type="image/jpeg">AAAA</binary>
          <binary id="img1.png" content-type="image/png">BBBB</binary>
        </FictionBook>
      `;
      const doc = BookParser._parseXml(xml);
      const imageMap = BookParser._loadFb2Images(doc);

      expect(imageMap.get('cover.jpg')).toBe('data:image/jpeg;base64,AAAA');
      expect(imageMap.get('#cover.jpg')).toBe('data:image/jpeg;base64,AAAA');
      expect(imageMap.get('img1.png')).toBe('data:image/png;base64,BBBB');
    });

    it('should handle document without binary elements', () => {
      const doc = BookParser._parseXml('<FictionBook></FictionBook>');
      const imageMap = BookParser._loadFb2Images(doc);
      expect(imageMap.size).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _extractFb2Title
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_extractFb2Title', () => {
    it('should extract title from <p> elements', () => {
      const xml = '<title><p>Part 1</p><p>Introduction</p></title>';
      const doc = BookParser._parseXml(xml);
      const result = BookParser._extractFb2Title(doc.querySelector('title'));
      expect(result).toBe('Part 1. Introduction');
    });

    it('should fallback to textContent', () => {
      const xml = '<title>Simple Title</title>';
      const doc = BookParser._parseXml(xml);
      const result = BookParser._extractFb2Title(doc.querySelector('title'));
      expect(result).toBe('Simple Title');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _convertFb2Element
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_convertFb2Element', () => {
    const imageMap = new Map();

    it('should convert <p> to HTML paragraph', () => {
      const doc = BookParser._parseXml('<root><p>Text</p></root>');
      const result = BookParser._convertFb2Element(doc.querySelector('p'), imageMap);
      expect(result).toBe('<p>Text</p>');
    });

    it('should convert <empty-line> to spacer', () => {
      const doc = BookParser._parseXml('<root><empty-line/></root>');
      const result = BookParser._convertFb2Element(doc.querySelector('empty-line'), imageMap);
      expect(result).toBe('<p>&nbsp;</p>');
    });

    it('should convert <subtitle> to h2', () => {
      const doc = BookParser._parseXml('<root><subtitle>Sub</subtitle></root>');
      const result = BookParser._convertFb2Element(doc.querySelector('subtitle'), imageMap);
      expect(result).toBe('<h2>Sub</h2>');
    });

    it('should convert <epigraph> to blockquote', () => {
      const doc = BookParser._parseXml('<root><epigraph><p>Quote</p></epigraph></root>');
      const result = BookParser._convertFb2Element(doc.querySelector('epigraph'), imageMap);
      expect(result).toContain('<blockquote>');
      expect(result).toContain('<p>Quote</p>');
    });

    it('should convert <cite> to blockquote', () => {
      const doc = BookParser._parseXml('<root><cite><p>Citation</p></cite></root>');
      const result = BookParser._convertFb2Element(doc.querySelector('cite'), imageMap);
      expect(result).toContain('<blockquote>');
    });

    it('should convert <text-author> to italic paragraph', () => {
      const doc = BookParser._parseXml('<root><text-author>Author Name</text-author></root>');
      const result = BookParser._convertFb2Element(doc.querySelector('text-author'), imageMap);
      expect(result).toBe('<p><em>Author Name</em></p>');
    });

    it('should convert <image> with mapped href', () => {
      const map = new Map([['#cover', 'data:image/jpeg;base64,abc'], ['cover', 'data:image/jpeg;base64,abc']]);
      // Создаём элемент напрямую — XML/HTML парсеры плохо обрабатывают <image>
      const el = document.createElement('image');
      el.setAttribute('href', '#cover');
      const result = BookParser._convertFb2Element(el, map);
      expect(result).toBe('<img src="data:image/jpeg;base64,abc" alt="">');
    });

    it('should return empty for unknown empty elements', () => {
      const doc = BookParser._parseXml('<root><custom></custom></root>');
      const result = BookParser._convertFb2Element(doc.querySelector('custom'), imageMap);
      expect(result).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _convertFb2Inline
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_convertFb2Inline', () => {
    const imageMap = new Map();

    it('should convert <emphasis> to <em>', () => {
      const doc = BookParser._parseXml('<p><emphasis>italic</emphasis></p>');
      const result = BookParser._convertFb2Inline(doc.querySelector('p'), imageMap);
      expect(result).toBe('<em>italic</em>');
    });

    it('should convert <strong> to <strong>', () => {
      const doc = BookParser._parseXml('<p><strong>bold</strong></p>');
      const result = BookParser._convertFb2Inline(doc.querySelector('p'), imageMap);
      expect(result).toBe('<strong>bold</strong>');
    });

    it('should convert <strikethrough> to <s>', () => {
      const doc = BookParser._parseXml('<p><strikethrough>deleted</strikethrough></p>');
      const result = BookParser._convertFb2Inline(doc.querySelector('p'), imageMap);
      expect(result).toBe('<s>deleted</s>');
    });

    it('should convert <sup> and <sub>', () => {
      const doc = BookParser._parseXml('<p>H<sub>2</sub>O and x<sup>2</sup></p>');
      const result = BookParser._convertFb2Inline(doc.querySelector('p'), imageMap);
      expect(result).toContain('<sub>2</sub>');
      expect(result).toContain('<sup>2</sup>');
    });

    it('should strip <a> tags but preserve text', () => {
      const doc = BookParser._parseXml('<p><a href="link">linked</a></p>');
      const result = BookParser._convertFb2Inline(doc.querySelector('p'), imageMap);
      expect(result).toBe('linked');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _splitByHeadings
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_splitByHeadings', () => {
    const imageMap = new Map();

    it('should split content by h1/h2/h3 headings', () => {
      const doc = BookParser._parseHtml(`
        <body>
          <h1>Chapter 1</h1>
          <p>Content 1</p>
          <h2>Chapter 2</h2>
          <p>Content 2</p>
        </body>
      `);

      const sections = BookParser._splitByHeadings(doc.body, imageMap, '');
      expect(sections.length).toBe(2);
      expect(sections[0].title).toBe('Chapter 1');
      expect(sections[1].title).toBe('Chapter 2');
    });

    it('should handle content before first heading', () => {
      const doc = BookParser._parseHtml(`
        <body>
          <p>Preamble</p>
          <h1>Chapter</h1>
          <p>Content</p>
        </body>
      `);

      const sections = BookParser._splitByHeadings(doc.body, imageMap, '');
      expect(sections.length).toBe(2);
      expect(sections[0].title).toBe('');
      expect(sections[1].title).toBe('Chapter');
    });

    it('should return single section when no headings', () => {
      const doc = BookParser._parseHtml(`
        <body>
          <p>Just text</p>
          <p>More text</p>
        </body>
      `);

      const sections = BookParser._splitByHeadings(doc.body, imageMap, '');
      expect(sections.length).toBe(1);
      expect(sections[0].title).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // parseDoc
  // ═══════════════════════════════════════════════════════════════════════════

  describe('parseDoc', () => {
    it('should parse DOC file with enough text', async () => {
      const text = 'This is a really long test document paragraph with enough content to be detected by the parser function for document extraction';
      // Создать UTF-16LE буфер
      const buffer = new ArrayBuffer(text.length * 2);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        view[i * 2] = code & 0xFF;
        view[i * 2 + 1] = (code >> 8) & 0xFF;
      }

      const file = createBinaryFile('test.doc', buffer);
      const result = await BookParser.parseDoc(file);

      expect(result.title).toBe('test');
      expect(result.author).toBe('');
      expect(result.chapters.length).toBe(1);
      expect(result.chapters[0].html).toContain('<article>');
    });

    it('should throw on empty DOC', async () => {
      const buffer = new ArrayBuffer(10);
      const file = createBinaryFile('empty.doc', buffer);
      await expect(BookParser.parseDoc(file)).rejects.toThrow('Не удалось извлечь текст из DOC');
    });
  });
});
