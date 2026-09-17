'use strict';

/**
 * Minimal, dependency-free HTML sanitizer for editable rich-text content
 * (biography / about sections).
 *
 * The database layer already uses parameterized queries (safe from SQL
 * injection). This sanitizer adds a defense-in-depth layer against stored XSS
 * by allowing only a small, explicit set of safe tags and attributes, and
 * stripping anything else (including <script>, event handlers, javascript: URLs).
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'a', 'blockquote', 'span', 'div', 'hr', 'img',
]);

const ALLOWED_ATTRS = new Set(['href', 'src', 'alt', 'title', 'target', 'rel']);

function sanitizeHtml(html) {
  if (typeof html !== 'string') return '';

  // Strip comments.
  let out = html.replace(/<!--[\s\S]*?-->/g, '');

  // Remove <script>, <style>, and other dangerous tags entirely.
  out = out.replace(/<\s*(script|style|iframe|object|embed|form|input|button|link|meta|base)[^>]*>[\s\S]*?<\s*\/\s*(script|style|iframe|object|embed|form|input|button|link|meta|base)\s*>/gi, '');
  out = out.replace(/<\s*(script|style|iframe|object|embed|link|meta|base)[^>]*\/?\s*>/gi, '');

  // Remove event handlers and javascript: URLs.
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(/(href|src)\s*=\s*("|')?\s*javascript:[^"'>\s]*("|')?/gi, '$1="#"');

  // For each opening tag, keep only allowed tags/attributes.
  out = out.replace(/<([a-zA-Z0-9]+)([^>]*)>/g, (match, tag, attrs) => {
    const lower = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(lower)) {
      // Some tags we allow their inner content by dropping just the tag.
      if (lower === 'script' || lower === 'style') return '';
      return '';
    }

    // Filter attributes.
    const cleanAttrs = [];
    const attrRegex = /([a-zA-Z-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g;
    let m;
    while ((m = attrRegex.exec(attrs)) !== null) {
      const name = m[1].toLowerCase();
      if (ALLOWED_ATTRS.has(name)) {
        cleanAttrs.push(`${name}=${m[2]}`);
      }
    }

    return cleanAttrs.length ? `<${lower} ${cleanAttrs.join(' ')}>` : `<${lower}>`;
  });

  // Normalize closing tags (keep allowed ones, drop others).
  out = out.replace(/<\s*\/\s*([a-zA-Z0-9]+)\s*>/g, (match, tag) => {
    const lower = tag.toLowerCase();
    return ALLOWED_TAGS.has(lower) ? `</${lower}>` : '';
  });

  return out;
}

module.exports = { sanitizeHtml };
