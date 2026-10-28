'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const connectPgSimple = require('connect-pg-simple');

const { initSchema, pool, hasDatabase } = require('./lib/db');
const csrf = require('./lib/csrf');
const { ensureAdminUser, seedDefaultContent, requireAuth } = require('./lib/auth');

const app = express();
const PORT = process.env.PORT || 3000;
// Listen on localhost only when HOST=127.0.0.1 (recommended behind Cloudflare
// Tunnel so the app can't be reached around the tunnel from the LAN).
const HOST = process.env.HOST || '0.0.0.0';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Trust the first proxy hop so req.secure and secure cookies work correctly
// when deployed behind HTTPS proxies (Cloudflare Tunnel, nginx, etc.).
app.set('trust proxy', 1);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
if (IS_PRODUCTION) app.set('view cache', true);

// Changes on every restart, so browsers fetch fresh CSS/JS after a deploy
// while still caching them long-term in between (see express.static below).
app.locals.assetVersion = Date.now().toString(36);

// Security headers. Content-Security-Policy blocks inline scripts and restricts
// script sources to same-origin, while inline `style="..."` attributes on the
// templates still need `'unsafe-inline'` for styles (no scripts are inlined).
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:'],
        // allow same-origin form posts (CSRF-protected) and image data URLs.
        // Stripe Checkout is reached via a redirect after the checkout form
        // post, which form-action also governs.
        'form-action': ["'self'", 'https://checkout.stripe.com'],
        // The admin "Preview Site" tab frames the site itself; nobody else may.
        'frame-ancestors': ["'self'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
      },
    },
  })
);

// Static assets. Versioned URLs (?v=...) let browsers cache for a week.
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: IS_PRODUCTION ? '7d' : 0,
  })
);

// Stripe webhook needs the raw, unparsed body to verify its signature, and is
// authenticated by that signature instead of CSRF — so it is mounted before
// the body parsers and CSRF middleware.
app.post(
  '/stripe/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  require('./routes/checkout').stripeWebhook
);

app.use(cookieParser());

// Sessions. In production, backed by Postgres (Neon) so sessions survive
// restarts. A generated secret is fine for local dev only.
const sessionSecret =
  process.env.SESSION_SECRET ||
  (IS_PRODUCTION ? '' : crypto.randomBytes(32).toString('hex'));

if (IS_PRODUCTION && !sessionSecret) {
  throw new Error(
    'SESSION_SECRET must be set in production. Set a long random value in your host environment variables.'
  );
}

const sessionConfig = {
  name: 'flr.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PRODUCTION,
    maxAge: 1000 * 60 * 60 * 12, // 12 hours
  },
};

if (hasDatabase) {
  const PgSession = connectPgSimple(session);
  sessionConfig.store = new PgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
  });
}

app.use(session(sessionConfig));

// Body parsing. Only signed-in admins may send large bodies (base64 photo
// uploads); everyone else is capped at 100kb so public forms can't be used to
// push huge payloads at the server.
app.use(
  ['/admin/images', '/admin/profile-image', '/admin/course-image'],
  requireAuth,
  express.json({ limit: '15mb' })
);
app.use(express.urlencoded({ extended: true, limit: '200kb' }));
app.use(express.json({ limit: '100kb' }));

// CSRF protection (double-submit cookie). Applied before routes so all forms
// must embed the token.
app.use(csrf);

// Make flags available to all templates.
app.use((req, res, next) => {
  res.locals.isAuthenticated = !!(req.session && req.session.authenticated);
  res.locals.currentYear = new Date().getFullYear();
  next();
});

// Lightweight page-view tracking: real page loads only (successful HTML
// responses), not assets, API polling, 404 probes, or the signed-in owner.
const { recordView, prunePageViews } = require('./lib/views');
app.use((req, res, next) => {
  if (
    req.method === 'GET' &&
    !req.path.startsWith('/image') &&
    !req.path.startsWith('/api/') &&
    !req.path.startsWith('/admin') &&
    !(req.session && req.session.authenticated) &&
    req.accepts('html')
  ) {
    res.on('finish', () => {
      if (res.statusCode === 200) recordView(req.path).catch(() => {});
    });
  }
  next();
});

// Route handlers
app.use('/', require('./routes/public'));
app.use('/', require('./routes/checkout'));
app.use('/admin', require('./routes/admin'));

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    status: 404,
    message: 'Page not found.',
  });
});

// Error handler
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  // Body-parser errors (too large, malformed JSON) carry a 4xx status.
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(err);
  const message =
    status === 413
      ? 'That upload is too large. Please use a smaller file.'
      : status === 500
        ? 'Something went wrong on our end.'
        : 'That request could not be processed.';
  if (!req.accepts('html')) return res.status(status).json({ error: message });
  res.status(status).render('error', { status, message });
});

// Log, don't crash, if a background promise rejects somewhere unexpected.
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

// Initialize the database schema, seed defaults, and ensure an admin account
// exist before listening. This is async, so we wrap startup.
async function boot() {
  await initSchema();
  // Keep the page_views table from growing unbounded (on boot, then daily).
  await prunePageViews();
  setInterval(() => prunePageViews().catch(() => {}), 24 * 60 * 60 * 1000).unref();
  const createdAdmin = await ensureAdminUser();
  await seedDefaultContent();

  app.listen(PORT, HOST, () => {
    console.log(`Front Line Refinement running at http://localhost:${PORT}`);
    if (createdAdmin) {
      console.log(
        `Initial admin account created: "${createdAdmin}" — sign in at /admin/login and change the password.`
      );
    }
  });
}

boot().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;
