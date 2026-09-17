'use strict';

const express = require('express');
const router = express.Router();

const {
  setContent,
  getAllContent,
  getUserByUsername,
  verifyPassword,
  updatePassword,
  updateUsername,
} = require('../lib/store');
const { requireAuth } = require('../lib/auth');

// ---- Login ----------------------------------------------------------------
router.get('/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/admin');
  res.render('admin-login', { error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = getUserByUsername((username || '').trim());

  if (!user || !verifyPassword(user, password || '')) {
    return res.status(401).render('admin-login', {
      error: 'Invalid username or password.',
    });
  }

  req.session.authenticated = true;
  req.session.userId = user.id;
  req.session.username = user.username;

  req.session.save(() => {
    res.redirect('/admin');
  });
});

router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// ---- Dashboard ------------------------------------------------------------
router.get('/', requireAuth, (req, res) => {
  const validSections = ['bio', 'courses', 'safety'];
  const section = validSections.includes(req.query.section) ? req.query.section : 'bio';
  res.render('admin', {
    section,
    saved: req.query.saved === '1',
    content: getAllContent(),
    saveError: null,
    username: req.session.username,
  });
});

// ---- Content editing (bio + about) ----------------------------------------
router.post('/content', requireAuth, (req, res) => {
  const allowed = [
    'bio_name',
    'bio_title',
    'bio_body',
    'about_body',
    'about_line',
  ];

  for (const key of allowed) {
    if (key in req.body) {
      setContent(key, req.body[key]);
    }
  }

  res.redirect('/admin?section=bio&saved=1');
});

// ---- Safety rules editing -------------------------------------------------
router.post('/safety', requireAuth, (req, res) => {
  const raw = req.body.safety_rules || '[]';
  try {
    const rules = JSON.parse(raw);
    if (!Array.isArray(rules)) throw new Error('not an array');
    setContent('safety_rules', JSON.stringify(rules));
  } catch (e) {
    return renderAdmin(res, req, 'safety', {
      saveError: 'Invalid safety rules data — could not save.',
    });
  }

  if ('safety_intro' in req.body) setContent('safety_intro', req.body.safety_intro);
  if ('safety_closing' in req.body) setContent('safety_closing', req.body.safety_closing);

  res.redirect('/admin?section=safety&saved=1');
});

// ---- Courses editing ------------------------------------------------------
router.post('/courses', requireAuth, (req, res) => {
  const raw = req.body.courses || '[]';
  try {
    const courses = JSON.parse(raw);
    if (!Array.isArray(courses)) throw new Error('not an array');
    setContent('courses', JSON.stringify(courses));
  } catch (e) {
    return renderAdmin(res, req, 'courses', {
      saveError: 'Invalid course data — could not save.',
    });
  }

  res.redirect('/admin?section=courses&saved=1');
});

// ---- Account (username/password) -----------------------------------------
router.get('/account', requireAuth, (req, res) => {
  res.render('admin-account', {
    username: req.session.username,
    message: null,
    error: null,
  });
});

router.post('/account', requireAuth, (req, res) => {
  const { currentPassword, newUsername, newPassword, confirmPassword } = req.body;
  const user = getUserByUsername(req.session.username);

  const renderAccount = (message = null, error = null) => {
    res.render('admin-account', {
      username: req.session.username,
      message,
      error,
    });
  };

  if (!user || !verifyPassword(user, currentPassword || '')) {
    return renderAccount(null, 'Current password is incorrect.');
  }

  if (newPassword) {
    if (newPassword.length < 12) {
      return renderAccount(null, 'New password must be at least 12 characters long.');
    }
    if (newPassword !== confirmPassword) {
      return renderAccount(null, 'New passwords do not match.');
    }
    updatePassword(user.id, newPassword);
  }

  if (newUsername && newUsername.trim() !== user.username) {
    const trimmed = newUsername.trim();
    if (trimmed.length < 3) {
      return renderAccount(null, 'Username must be at least 3 characters.');
    }
    if (getUserByUsername(trimmed)) {
      return renderAccount(null, 'That username is already taken.');
    }
    updateUsername(user.id, trimmed);
    req.session.username = trimmed;
  }

  renderAccount('Account updated successfully.', null);
});

function renderAdmin(res, req, section, extra = {}) {
  res.render('admin', {
    section,
    saved: false,
    content: getAllContent(),
    saveError: null,
    username: req.session.username,
    ...extra,
  });
}

module.exports = router;
