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
const { ensureAdminUser, seedDefaultContent } = require('./lib/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Trust the first proxy hop so req.secure and secure cookies work correctly
// when deployed behind HTTPS proxies (Render, Railway, Fly.io, nginx, etc.).
app.set('trust proxy', 1);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // EJS templates inline styles; configure later if needed
  })
);

// Static assets
app.use(express.static(path.join(__dirname, 'public')));

// Body & cookie parsing. Increased JSON limit to accommodate base64 image uploads.
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.json({ limit: '25mb' }));
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

// CSRF protection (double-submit cookie). Applied before routes so all forms
// must embed the token.
app.use(csrf);

// Make flags available to all templates.
app.use((req, res, next) => {
  res.locals.isAuthenticated = !!(req.session && req.session.authenticated);
  res.locals.currentYear = new Date().getFullYear();
  next();
});

// Lightweight page-view tracking (GET page requests only, not assets/assets).
const { recordView } = require('./lib/views');
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/image') && req.accepts('html')) {
    recordView(req.path).catch(() => {});
  }
  next();
});

// Route handlers
app.use('/', require('./routes/public'));
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
  console.error(err);
  res.status(500).render('error', {
    status: 500,
    message: 'Something went wrong on our end.',
  });
});

// Initialize the database schema, seed defaults, and ensure an admin account
// exist before listening. This is async, so we wrap startup.
async function boot() {
  await initSchema();
  const createdAdmin = await ensureAdminUser();
  await seedDefaultContent();

  app.listen(PORT, () => {
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
