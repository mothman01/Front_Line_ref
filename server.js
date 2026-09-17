'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');

const { ensureAdminUser, seedDefaultContent } = require('./lib/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Trust the first proxy hop so req.secure and secure cookies work correctly
// when deployed behind HTTPS proxies (Render, Railway, Fly.io, nginx, etc.).
app.set('trust proxy', 1);

// Make sure an admin account and default content exist before serving anything.
const createdAdmin = ensureAdminUser();
seedDefaultContent();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static assets
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sessions. Using the in-memory store keeps the app dependency-free; sessions
// simply reset on restart, which is acceptable for a single-owner admin tool.
// In production, require a persistent, cryptographically strong session secret.
// A generated one is fine for local dev, but would invalidate all sessions on
// every restart in production.
const sessionSecret =
  process.env.SESSION_SECRET ||
  (IS_PRODUCTION ? '' : crypto.randomBytes(32).toString('hex'));

if (IS_PRODUCTION && !sessionSecret) {
  throw new Error(
    'SESSION_SECRET must be set in production. Set a long random value in your host environment variables.'
  );
}

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      // Secure cookies require HTTPS, which is always true behind Render/Railway
      // proxies (and locally rejected otherwise).
      secure: IS_PRODUCTION,
      maxAge: 1000 * 60 * 60 * 12, // 12 hours
    },
  })
);

// Make flags available to all templates.
app.use((req, res, next) => {
  res.locals.isAuthenticated = !!(req.session && req.session.authenticated);
  res.locals.currentYear = new Date().getFullYear();
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

app.listen(PORT, () => {
  console.log(`Front Line Refinement running at http://localhost:${PORT}`);
  if (createdAdmin) {
    console.log(
      `Initial admin account created: "${createdAdmin}" — sign in at /admin/login and change the password.`
    );
  }
});
