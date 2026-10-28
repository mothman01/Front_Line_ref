'use strict';

const rateLimit = require('express-rate-limit');
const router = require('../lib/async-router').Router();

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
const { listWaivers, countWaivers } = require('../lib/waivers');
const {
  listAppointments,
  cancelAppointment,
  confirmAppointment,
} = require('../lib/appointments');
const {
  createEvent,
  updateEvent,
  listEvents,
  deleteEvent,
  listRegistrations,
  cancelRegistration,
} = require('../lib/events');
const payments = require('../lib/payments');
const { zonedToUtc, utcToLocalInput, formatDateTime, SITE_TIMEZONE } = require('../lib/time');
const { listImages, firstImagesByPrefix, saveImage, deleteImage } = require('../lib/images');
const { getViewCounts } = require('../lib/views');
const { sanitizeHtml } = require('../lib/sanitize');

// Allowed image MIME types. SVG is deliberately excluded because it can
// carry executable script content.
const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// File signatures, so a renamed HTML/SVG file can't be stored as an "image"
// and later served from our own origin.
const IMAGE_SIGNATURES = {
  'image/png': (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/gif': (b) => b.slice(0, 4).toString('ascii') === 'GIF8',
  'image/webp': (b) => b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP',
};

/**
 * Check the declared type, that the data URL really is that type, and the
 * size. Returns true only for a genuine PNG/JPEG/WebP/GIF under 10 MB.
 */
function assertAllowedImage(mimeType, dataUrl) {
  const type = (mimeType || '').toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(type) || typeof dataUrl !== 'string') return false;
  const prefix = `data:${type};base64,`;
  if (!dataUrl.startsWith(prefix)) return false;
  const buf = Buffer.from(dataUrl.slice(prefix.length), 'base64');
  return buf.length > 0 && buf.length <= MAX_IMAGE_BYTES && IMAGE_SIGNATURES[type](buf);
}

// Equalize login timing for unknown usernames so they can't be discovered.
const DUMMY_HASH = require('bcryptjs').hashSync(require('crypto').randomBytes(16).toString('hex'), 12);

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

  const ok = user
    ? await verifyPassword(user, password || '')
    : (await require('bcryptjs').compare(password || '', DUMMY_HASH), false);
  if (!ok) {
    return res.status(401).render('admin-login', {
      error: 'Invalid username or password.',
    });
  }

  // Regenerate the session before marking the user authenticated to prevent
  // session fixation (an attacker-provided session ID must not survive login).
  req.session.regenerate((regenerateErr) => {
    if (regenerateErr) {
      console.error('Session regeneration failed:', regenerateErr);
      return res.status(500).render('admin-login', {
        error: 'Could not complete login. Please try again.',
      });
    }

    req.session.authenticated = true;
    req.session.userId = user.id;
    req.session.username = user.username;

    req.session.save(() => {
      res.redirect('/admin');
    });
  });
});

router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Admin tabs. Each loads only the data it shows, in parallel.
const SECTIONS = {
  overview: { title: 'Overview', sub: 'A quick look at your classes, registrations, and site.' },
  bio: { title: 'Biography & About', sub: 'Your profile photo, biography, and company description.' },
  courses: { title: 'Courses & Prices', sub: 'Course descriptions, prices, and photos shown on the Classes page.' },
  safety: { title: 'Safety Rules', sub: 'The rules every participant must follow.' },
  images: { title: 'Homepage Photos', sub: 'Images in the homepage slideshow.' },
  events: { title: 'Class Calendar', sub: 'Class days, seat limits, and prices shown on the public calendar.' },
  checkout: { title: 'Online Checkout', sub: 'Turn online registration on or off and see who has registered.' },
  calendar: { title: 'Appointments', sub: 'Private session requests from the Schedule page.' },
  waivers: { title: 'Signed Waivers', sub: 'Liability waivers submitted online.' },
  views: { title: 'Page Views', sub: 'Visits per page over the last 30 days.' },
  preview: { title: 'Preview Site', sub: 'See exactly what customers see, on desktop or phone.' },
};

async function loadCourses() {
  return JSON.parse((await getContent('courses')) || '[]');
}

async function loadCoursePhotos(courses) {
  const byCategory = await firstImagesByPrefix('course:');
  return Object.fromEntries(courses.map((c) => [c.id, byCategory[`course:${c.id}`] || null]));
}

const sectionLoaders = {
  async overview() {
    const [events, registrations, waiverCount, appointments, viewCounts, checkoutEnabled] = await Promise.all([
      listEvents({ from: new Date() }),
      listRegistrations(),
      countWaivers(),
      listAppointments({ from: new Date() }),
      getViewCounts(),
      payments.isCheckoutEnabled(),
    ]);
    return {
      events,
      registrations,
      waiverCount,
      appointments: appointments.filter((a) => a.status !== 'cancelled'),
      totalViews: Object.values(viewCounts).reduce((n, v) => n + v, 0),
      checkoutEnabled,
    };
  },
  async bio() {
    const [content, profileImages] = await Promise.all([getAllContent(), listImages('profile')]);
    // Rendered as live HTML inside the editor, so sanitize even older rows.
    content.bio_body = sanitizeHtml(content.bio_body || '');
    content.about_body = sanitizeHtml(content.about_body || '');
    return { content, profileImage: profileImages[0] || null };
  },
  async courses() {
    const courses = await loadCourses();
    return { courses, coursePhotos: await loadCoursePhotos(courses) };
  },
  async safety() {
    return { content: await getAllContent() };
  },
  async images() {
    return { images: await listImages('slideshow') };
  },
  async events() {
    const [events, courses] = await Promise.all([listEvents(), loadCourses()]);
    return { events, courses };
  },
  async checkout() {
    const [registrations, checkoutEnabled] = await Promise.all([listRegistrations(), payments.isCheckoutEnabled()]);
    return { registrations, checkoutEnabled };
  },
  async calendar() {
    return { appointments: await listAppointments() };
  },
  async waivers() {
    const [waivers, waiverCount] = await Promise.all([listWaivers(), countWaivers()]);
    return { waivers, waiverCount };
  },
  async views() {
    return { viewCounts: await getViewCounts() };
  },
  async preview() {
    return { events: await listEvents({ from: new Date() }) };
  },
};

async function renderAdmin(res, req, section, extra = {}) {
  const data = await sectionLoaders[section]();
  res.render('admin', {
    section,
    sections: SECTIONS,
    saved: false,
    saveError: null,
    username: req.session.username,
    stripeConfigured: payments.stripeConfigured(),
    stripeMode: payments.stripeMode(),
    webhookConfigured: payments.webhookConfigured(),
    siteTimezone: SITE_TIMEZONE,
    formatCents: payments.formatCents,
    formatDateTime,
    utcToLocalInput,
    ...data,
    ...extra,
  });
}

// ---- Dashboard ------------------------------------------------------------
router.get('/', requireAuth, async (req, res) => {
  const section = Object.hasOwn(SECTIONS, req.query.section) ? req.query.section : 'overview';
  await renderAdmin(res, req, section, {
    saved: req.query.saved === '1',
    saveError: req.query.error ? String(req.query.error).slice(0, 200) : null,
  });
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
      let value = req.body[key];
      // Sanitize rich-text fields to prevent stored XSS.
      if (key === 'bio_body' || key === 'about_body') {
        value = sanitizeHtml(value);
      }
      await setContent(key, value);
    }
  }

  res.redirect('/admin?section=bio&saved=1');
});

// ---- Profile picture upload ------------------------------------------------
router.post('/profile-image', requireAuth, async (req, res) => {
  const { filename, mimeType, dataUrl } = req.body;
  if (!filename || !mimeType || !dataUrl) {
    return res.status(400).json({ error: 'Missing image data.' });
  }
  if (!mimeType.startsWith('image/')) {
    return res.status(400).json({ error: 'Only images are allowed.' });
  }
  if (!assertAllowedImage(mimeType, dataUrl)) {
    return res.status(400).json({ error: 'Please upload a PNG, JPEG, WebP, or GIF image under 10 MB.' });
  }
  // Replace the previous photo; the site shows the first profile image.
  for (const old of await listImages('profile')) await deleteImage(old.id);
  const img = await saveImage({ filename, mimeType, dataUrl, category: 'profile' });
  res.json({ ok: true, id: img.id });
});

// ---- Safety rules editing -------------------------------------------------
router.post('/safety', requireAuth, async (req, res) => {
  const asList = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
  const titles = asList(req.body.rule_title);
  const bodies = asList(req.body.rule_body);
  const rules = titles
    .map((title, i) => ({
      title: String(title || '').trim(),
      body: String(bodies[i] || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    }))
    .filter((r) => r.title || r.body.length);

  await setContent('safety_rules', JSON.stringify(rules));
  if ('safety_intro' in req.body) await setContent('safety_intro', req.body.safety_intro);
  if ('safety_closing' in req.body) await setContent('safety_closing', req.body.safety_closing);

  res.redirect('/admin?section=safety&saved=1');
});

// ---- Courses editing ------------------------------------------------------
// Form-based editor (the primary UI) — parses per-course fields back into JSON.
router.post('/courses-form', requireAuth, async (req, res) => {
  const current = JSON.parse((await getContent('courses')) || '[]');
  const updated = current.map((course, idx) => {
    const p = (name) => req.body[`course_${idx}_${name}`];
    const descriptionRaw = p('description') || '';
    return {
      ...course,
      id: p('id') || course.id,
      name: p('name') || course.name,
      comingSoon: (p('comingSoon') || '').toString() === 'true',
      intro: p('intro') || course.intro,
      description: descriptionRaw.split('\n').map((s) => s.trim()).filter(Boolean),
      prerequisite: (p('prerequisite') || '').trim(),
      priceCents: payments.parsePriceToCents(p('price')),
    };
  });

  await setContent('courses', JSON.stringify(updated));
  res.redirect('/admin?section=courses&saved=1');
});

// Legacy JSON editor (kept for advanced users).
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

// ---- Calendar management (cancel/confirm) ---------------------------------
router.post('/appointments/cancel', requireAuth, async (req, res) => {
  await cancelAppointment(req.body.id);
  res.redirect('/admin?section=calendar');
});

router.post('/appointments/confirm', requireAuth, async (req, res) => {
  try {
    await confirmAppointment(req.body.id);
  } catch (err) {
    console.error(err);
  }
  res.redirect('/admin?section=calendar');
});

// ---- Class sessions (calendar events with seats + price) ------------------
// Datetimes from <input type="datetime-local"> are wall-clock times in the
// business's timezone; convert them to real instants before storing.
function parseEventForm(body) {
  const starts = zonedToUtc(body.starts_at);
  const ends = body.ends_at ? zonedToUtc(body.ends_at) : null;
  const capacity = Math.floor(Number(body.capacity));
  return {
    starts,
    ends,
    capacity: Number.isFinite(capacity) && capacity >= 0 ? capacity : null,
    price_cents: payments.parsePriceToCents(body.price),
  };
}

router.post('/events', requireAuth, async (req, res) => {
  const { title, course_id, location, description } = req.body;
  const f = parseEventForm(req.body);
  const fail = (msg) => res.redirect('/admin?section=events&error=' + encodeURIComponent(msg));

  if (!title || !f.starts) return fail('Please enter a class title and start time.');
  if (f.capacity == null || f.capacity < 1) return fail('Max seats must be at least 1.');

  // Link to a course: inherit its name and (if no price was entered) its price.
  let course_name = null;
  let price_cents = f.price_cents;
  if (course_id) {
    const courses = JSON.parse((await getContent('courses')) || '[]');
    const c = courses.find((x) => x.id === course_id);
    if (c) {
      course_name = c.name;
      if (price_cents == null && c.priceCents != null) price_cents = c.priceCents;
    }
  }

  await createEvent({
    title,
    course_id,
    course_name,
    starts_at: f.starts,
    ends_at: f.ends,
    location,
    description,
    capacity: f.capacity,
    price_cents,
  });

  res.redirect('/admin?section=events&saved=1');
});

router.post('/events/update', requireAuth, async (req, res) => {
  const f = parseEventForm(req.body);
  const fail = (msg) => res.redirect('/admin?section=events&error=' + encodeURIComponent(msg));
  if (!req.body.title || !f.starts) return fail('Please enter a class title and start time.');
  if (f.capacity == null || f.capacity < 1) return fail('Max seats must be at least 1.');

  await updateEvent(req.body.id, {
    title: req.body.title,
    starts_at: f.starts,
    ends_at: f.ends,
    location: req.body.location || null,
    description: req.body.description || null,
    capacity: f.capacity,
    price_cents: f.price_cents,
  });
  res.redirect('/admin?section=events&saved=1');
});

router.post('/events/delete', requireAuth, async (req, res) => {
  try {
    await deleteEvent(req.body.id);
  } catch (err) {
    return res.redirect('/admin?section=events&error=' + encodeURIComponent(err.message));
  }
  res.redirect('/admin?section=events');
});

// ---- Online checkout ---------------------------------------------------------
router.post('/checkout-toggle', requireAuth, async (req, res) => {
  await payments.setCheckoutEnabled(req.body.enabled === 'true');
  res.redirect('/admin?section=checkout&saved=1');
});

router.post('/registrations/cancel', requireAuth, async (req, res) => {
  await cancelRegistration(req.body.id);
  res.redirect('/admin?section=checkout');
});

// ---- Course photos -----------------------------------------------------------
router.post('/course-image', requireAuth, async (req, res) => {
  const { courseId, filename, mimeType, dataUrl } = req.body;
  if (!courseId || !filename || !mimeType || !dataUrl) {
    return res.status(400).json({ error: 'Missing image data.' });
  }
  if (!assertAllowedImage(mimeType, dataUrl)) {
    return res.status(400).json({ error: 'Please upload a PNG, JPEG, WebP, or GIF image under 10 MB.' });
  }
  const courses = JSON.parse((await getContent('courses')) || '[]');
  if (!courses.some((c) => c.id === courseId)) {
    return res.status(400).json({ error: 'Unknown course.' });
  }
  // Replace any existing photo for this course.
  const category = `course:${courseId}`;
  for (const old of await listImages(category)) await deleteImage(old.id);
  const img = await saveImage({ filename, mimeType, dataUrl, category });
  res.json({ ok: true, id: img.id });
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
  if (!assertAllowedImage(mimeType, dataUrl)) {
    return res.status(400).json({ error: 'Please upload a PNG, JPEG, WebP, or GIF image under 10 MB.' });
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
    section: 'account',
    sections: SECTIONS,
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
      section: 'account',
      sections: SECTIONS,
      username: req.session.username,
      message,
      error,
    });
  };

  if (!user || !(await verifyPassword(user, currentPassword || ''))) {
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

module.exports = router;
