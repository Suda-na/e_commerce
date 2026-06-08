import sanitize from 'sanitize-html';

const RICH_TEXT_ALLOWED_TAGS = ['b', 'i', 'u', 'br', 'p', 'ul', 'ol', 'li'];

export function sanitizeRichText(value: string): string {
  if (!value) return value;
  return sanitize(value, {
    allowedTags: RICH_TEXT_ALLOWED_TAGS,
    allowedAttributes: {},
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
