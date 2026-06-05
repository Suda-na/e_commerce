import DOMPurify from 'isomorphic-dompurify';

const RICH_TEXT_ALLOWED_TAGS = ['b', 'i', 'u', 'br', 'p', 'ul', 'ol', 'li'];
const RICH_TEXT_ALLOWED_ATTR: string[] = [];

export function sanitizeRichText(value: string): string {
  if (!value) return value;
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: RICH_TEXT_ALLOWED_TAGS,
    ALLOWED_ATTR: RICH_TEXT_ALLOWED_ATTR,
  });
}

export function sanitizeXSS(value: string): string {
  if (!value) return value;
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
