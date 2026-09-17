'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const {
  getContent,
  setContent,
  getAllContent,
  getUserByUsername,
  verifyPassword,
  updatePassword,
  updateUsername,
} = require('../lib/store');
const { requireAuth } = require('../lib/auth');
const { listWaivers, countWaivers, getWaiver } = require('../lib/waivers');
const {
  listAppointments,
  cancelAppointment,
  confirmAppointment,
} = require('../lib/appointments');
const { createEvent, listEvents, deleteEvent } = require('../lib/events');
const { listImages, saveImage, deleteImage } = require('../lib/images');

// Login rate limiting (brute-force protection).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).render('admin-login', {
      error: 'Too many login attempts. Please try again in 15 minutes.',
    }),
});

// ---- Login ----------------------------------------------------------------
router.get('/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/admin');
  res.render('admin-login', { error: null });
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  const user = await getUserByUsername((username || '').trim());

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
router.get('/', requireAuth, async (req, res) => {
  const validSections = ['bio', 'courses', 'safety', 'waivers', 'calendar', 'events', 'images'];
  const section = validSections.includes(req.query.section) ? req.query.section : 'bio';

  const courses = JSON.parse((await getContent('courses')) || '[]');

  const data = {
    section,
    saved: req.query.saved === '1',
    content: await getAllContent(),
    saveError: null,
    username: req.session.username,
    waivers: await listWaivers(),
    waiverCount: await countWaivers(),
    appointments: await listAppointments(),
    events: await listEvents(),
    images: await listImages(),
    courses,
  };

  res.render('admin', data);
});

// ---- Content editing (bio + about) ----------------------------------------
router.post('/content', requireAuth, async (req, res) => {
  const allowed = [
    'bio_name',
    'bio_title',
    'bio_body',
    'about_body',
    'about_line',
  ];

  for (const key of allowed) {
    if (key in req.body) {
      await setContent(key, req.body[key]);
    }
  }

  res.redirect('/admin?section=bio&saved=1');
});

// ---- Safety rules editing -------------------------------------------------
router.post('/safety', requireAuth, async (req, res) => {
  const raw = req.body.safety_rules || '[]';
  try {
    const rules = JSON.parse(raw);
    if (!Array.isArray(rules)) throw new Error('not an array');
    await setContent('safety_rules', JSON.stringify(rules));
  } catch (e) {
    return renderAdmin(res, req, 'safety', {
      saveError: 'Invalid safety rules data — could not save.',
    });
  }

  if ('safety_intro' in req.body) await setContent('safety_intro', req.body.safety_intro);
  if ('safety_closing' in req.body) await setContent('safety_closing', req.body.safety_closing);

  res.redirect('/admin?section=safety&saved=1');
});

// ---- Courses editing ------------------------------------------------------
router.post('/courses', requireAuth, async (req, res) => {
  const raw = req.body.courses || '[]';
  try {
    const courses = JSON.parse(raw);
    if (!Array.isArray(courses)) throw new Error('not an array');
    await setContent('courses', JSON.stringify(courses));
  } catch (e) {
    return renderAdmin(res, req, 'courses', {
      saveError: 'Invalid course data — could not save.',
    });
  }

  res.redirect('/admin?section=courses&saved=1');
});

// ---- Quick price editing (friendly, non-technical) ------------------------
router.post('/prices', requireAuth, async (req, res) => {
  const courses = JSON.parse((await getContent('courses')) || '[]');
  for (const course of courses) {
    const key = `price_${course.id}`;
    if (key in req.body) {
      course.price = (req.body[key] || '').trim();
    }
  }
  await setContent('courses', JSON.stringify(courses));
  res.redirect('/admin?section=courses&saved=1');
});

// ---- Calendar management (cancel/confirm) ---------------------------------
router.post('/appointments/cancel', requireAuth, async (req, res) => {
  await cancelAppointment(req.body.id);
  res.redirect('/admin?section=calendar');
});

router.post('/appointments/confirm', requireAuth, async (req, res) => {
  await confirmAppointment(req.body.id);
  res.redirect('/admin?section=calendar');
});

// ---- Events management -----------------------------------------------------
router.post('/events', requireAuth, async (req, res) => {
  const { title, course_id, course_name, starts_at, ends_at, location, price, description } = req.body;

  if (!title || !starts_at) {
    return res.redirect('/admin?section=events');
  }

  // If course_id is provided, look up the course name.
  let resolvedName = course_name;
  if (course_id && !course_name) {
    const courses = JSON.parse((await getContent('courses')) || '[]');
    const c = courses.find((x) => x.id === course_id);
    if (c) resolvedName = c.name;
  }

  await createEvent({
    title,
    course_id,
    course_name: resolvedName,
    starts_at,
    ends_at,
    location,
    price,
    description,
  });

  res.redirect('/admin?section=events&saved=1');
});

router.post('/events/delete', requireAuth, async (req, res) => {
  await deleteEvent(req.body.id);
  res.redirect('/admin?section=events');
});

// ---- Images management -----------------------------------------------------
router.post('/images', requireAuth, async (req, res) => {
  const { filename, mimeType, dataUrl } = req.body;
  if (!filename || !mimeType || !dataUrl) {
    return res.status(400).json({ error: 'Missing image data.' });
  }
  if (!mimeType.startsWith('image/')) {
    return res.status(400).json({ error: 'Only images are allowed.' });
  }
  const img = await saveImage({ filename, mimeType, dataUrl });
  res.json({ ok: true, id: img.id });
});

router.delete('/images/:id', requireAuth, async (req, res) => {
  await deleteImage(req.params.id);
  res.json({ ok: true });
});

// ---- Account (username/password) -----------------------------------------
router.get('/account', requireAuth, (req, res) => {
  res.render('admin-account', {
    username: req.session.username,
    message: null,
    error: null,
  });
});

router.post('/account', requireAuth, async (req, res) => {
  const { currentPassword, newUsername, newPassword, confirmPassword } = req.body;
  const user = await getUserByUsername(req.session.username);

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
    await updatePassword(user.id, newPassword);
  }

  if (newUsername && newUsername.trim() !== user.username) {
    const trimmed = newUsername.trim();
    if (trimmed.length < 3) {
      return renderAccount(null, 'Username must be at least 3 characters.');
    }
    if (await getUserByUsername(trimmed)) {
      return renderAccount(null, 'That username is already taken.');
    }
    await updateUsername(user.id, trimmed);
    req.session.username = trimmed;
  }

  renderAccount('Account updated successfully.', null);
});

async function renderAdmin(res, req, section, extra = {}) {
  const data = {
    section,
    saved: false,
    content: await getAllContent(),
    saveError: null,
    username: req.session.username,
    waivers: await listWaivers(),
    waiverCount: await countWaivers(),
    appointments: await listAppointments(),
    events: await listEvents(),
    images: await listImages(),
    courses: JSON.parse((await getContent('courses')) || '[]'),
  };
  res.render('admin', { ...data, ...extra });
}

module.exports = router;
