import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

const window = new JSDOM('').window;
const purify = DOMPurify(window as unknown as Window);

export function sanitizeHtml(html: string): string {
  return purify.sanitize(html, {
    ALLOWED_TAGS: [
      'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'em', 'strong',
      'b', 'i', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'img', 'table',
      'thead', 'tbody', 'tr', 'th', 'td', 'figure', 'figcaption', 'span', 'div', 'hr', 'sup', 'sub',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel', 'width', 'height'],
    ALLOW_DATA_ATTR: false,
  });
}
