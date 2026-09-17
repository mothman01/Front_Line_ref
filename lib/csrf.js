'use strict';

const crypto = require('crypto');

/**
 * Lightweight CSRF protection using the double-submit-cookie pattern.
 *
 * - A random token is stored in a cookie (readable by JS) and also expected to
 *   be submitted via request body or the X-CSRF-Token header.
 * - On state-changing requests (POST/PUT/PATCH/DELETE), we verify the submitted
 *   token matches the cookie token.
 *
 * This avoids the deprecated `csurf` package and its vulnerable transitive deps.
 */

const COOKIE_NAME = '_csrf';
const FIELD_NAME = '_csrf';

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

function csrf(req, res, next) {
  // Ensure a token exists in the cookie.
  let token = req.cookies ? req.cookies[COOKIE_NAME] : undefined;
  if (!token) {
    token = generateToken();
    res.cookie(COOKIE_NAME, token, {
      httpOnly: false, // must be readable by our JS for the header, but safe via double-submit
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  // Expose the token to templates so forms can embed it.
  res.locals.csrfToken = token;
  req.csrfToken = () => token;

  const method = (req.method || '').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const submitted =
      (req.body && req.body[FIELD_NAME]) || req.get('X-CSRF-Token') || (req.query && req.query[FIELD_NAME]);

    if (!submitted || submitted !== token) {
      if (req.accepts('html')) {
        return res.status(403).render('error', {
          status: 403,
          message: 'Invalid or missing security token. Please go back and try again.',
        });
      }
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
  }

  next();
}

module.exports = csrf;
module.exports.COOKIE_NAME = COOKIE_NAME;
module.exports.FIELD_NAME = FIELD_NAME;
