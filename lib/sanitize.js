'use strict';

/**
 * HTML sanitization for editable rich-text content (biography / about).
 *
 * Wraps the well-tested `sanitize-html` library, which is far more robust than
 * a hand-rolled regex sanitizer. It strips scripts, event handlers, and
 * dangerous URLs (e.g. encoded `javascript:` links) while allowing a small,
 * explicit set of safe tags and attributes.
 */

const sanitizeHtml = require('sanitize-html');

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'a', 'blockquote', 'span', 'div', 'hr', 'img',
];

const ALLOWED_ATTRS = {
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'title'],
};

const ALLOWED_SCHEMES = ['http', 'https', 'mailto'];

function sanitize(html) {
  if (typeof html !== 'string') return '';
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    // Only permit http(s) and mailto links; block javascript:, data:, etc.
    allowedSchemes: ALLOWED_SCHEMES,
    allowedSchemesByTag: { img: ['http', 'https'] },
    // Keep rel="noopener noreferrer" semantics on links we allow through.
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    },
    allowProtocolRelative: false,
  });
}

module.exports = { sanitizeHtml: sanitize };
