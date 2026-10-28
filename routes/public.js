'use strict';

const rateLimit = require('express-rate-limit');
const router = require('../lib/async-router').Router();
const { getContent, getAllContent } = require('../lib/store');
const { defaultCourses, defaultSafetyRules } = require('../lib/defaults');
const { listImages } = require('../lib/images');
const { sanitizeHtml } = require('../lib/sanitize');

const SITE_NAME = 'Front Line Refinement';

/**
 * Build the shared view data for public pages. Content values come from the
 * database so the owner can edit them, with sensible fallbacks.
 */
async function pageData(activePage) {
  const pageTitles = {
    home: 'Home',
    biography: 'Biography',
    about: 'About',
    safety: 'Safety Rules',
    classes: 'Classes',
  };
  // One query fetches all content rows instead of ~8 sequential getContent calls.
  const c = await getAllContent();
  const or = (key, fallback) => c[key] ?? fallback;
  return {
    activePage,
    siteName: SITE_NAME,
    pageTitle: pageTitles[activePage] || '',
    tagline: 'Fundamentals First. Confidence Follows.',
    content: {
      bioName: or('bio_name', 'Lucas Parrish'),
      bioTitle: or('bio_title', 'Founder & Lead Coach'),
      bioBody: sanitizeHtml(or('bio_body', '<p>Biography content is being prepared.</p>')),
      aboutBody: sanitizeHtml(or('about_body', '<p>About content is being prepared.</p>')),
      aboutLine: or('about_line', 'Fundamentals First. Confidence Follows.'),
      safetyIntro:
        or(
          'safety_intro',
          'Your safety and the safety of everyone on the range are the highest priorities at Front Line Refinement. Every participant must understand and follow these rules.'
        ),
      safetyRules: JSON.parse(c.safety_rules || JSON.stringify(defaultSafetyRules())),
      safetyClosing:
        or('safety_closing', 'No signed waiver. No firearm handling. No shooting. No exceptions.'),
    },
  };
}

router.get('/', async (req, res) => {
  const data = await pageData('home');
  data.images = await listImages();
  res.render('home', data);
});

router.get('/biography', async (req, res) => {
  const data = await pageData('biography');
  const { getProfileImage } = require('../lib/images');
  data.profileImage = await getProfileImage();
  res.render('biography', data);
});

router.get('/about', async (req, res) => {
  res.render('about', await pageData('about'));
});

router.get('/safety', async (req, res) => {
  res.render('safety', await pageData('safety'));
});

router.get('/classes', async (req, res) => {
  const data = await pageData('classes');
  data.content.courses = JSON.parse(
    (await getContent('courses')) || JSON.stringify(defaultCourses())
  );
  const { listEvents } = require('../lib/events');
  const { formatCents } = require('../lib/payments');
  const { formatDateTime } = require('../lib/time');
  const { firstImagesByPrefix } = require('../lib/images');
  const [upcoming, photos] = await Promise.all([
    listEvents({ from: new Date() }),
    firstImagesByPrefix('course:'),
  ]);
  data.coursePhotos = {};
  data.courseSessions = {};
  for (const c of data.content.courses) {
    data.coursePhotos[c.id] = photos[`course:${c.id}`] || null;
    data.courseSessions[c.id] = upcoming.filter((e) => e.course_id === c.id).slice(0, 3);
  }
  data.formatCents = formatCents;
  data.formatDateTime = formatDateTime;
  res.render('classes', data);
});

// Serve a slideshow image by ID (stored in Postgres as a data URL).
// Image IDs are never reused for different content, so browsers may cache
// them forever; the server also keeps decoded bytes in memory.
router.get('/image/:id', async (req, res) => {
  if (!/^\d{1,10}$/.test(req.params.id)) return res.status(404).end();
  const { getDecodedImage } = require('../lib/images');
  const img = await getDecodedImage(req.params.id);
  if (!img) return res.status(404).end();
  res.set('Content-Type', img.type);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(img.buf);
});

// ---- Public-form spam protection ------------------------------------------
// Rate-limit anonymous submissions so an attacker can't flood waiver records
// or booking requests. Keyed by IP (the proxy's, via trust proxy) per-window.
const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 submissions per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).render('error', {
      status: 429,
      message: 'Too many submissions. Please wait 15 minutes and try again.',
    }),
});

// ---- Waiver ----------------------------------------------------------------

router.get('/waiver', async (req, res) => {
  res.render('waiver', {
    activePage: 'waiver',
    siteName: SITE_NAME,
    pageTitle: 'Liability Waiver',
    content: { siteName: SITE_NAME },
    success: false,
    error: null,
    form: {},
  });
});

router.post('/waiver', publicFormLimiter, async (req, res) => {
  const { full_name, email, phone, address, date_of_birth, signature } = req.body;
  const legal_attestation = req.body.legal_attestation === 'on' || req.body.legal_attestation === 'true';

  const render = (opts = {}) =>
    res.render('waiver', {
      activePage: 'waiver',
      siteName: SITE_NAME,
      pageTitle: 'Liability Waiver',
      content: { siteName: SITE_NAME },
      success: false,
      error: null,
      ...opts,
    });

  // Basic validation
  if (!full_name || !email || !signature) {
    return render({
      error: 'Please complete all required fields (name, email, and signature).',
      form: req.body,
    });
  }
  if (!legal_attestation) {
    return render({
      error: 'You must confirm your legal eligibility to possess and use firearms.',
      form: req.body,
    });
  }

  try {
    const { saveWaiver } = require('../lib/waivers');
    await saveWaiver({
      full_name,
      email,
      phone,
      address,
      date_of_birth,
      legal_attestation,
      signature,
    });
    return render({ success: true });
  } catch (err) {
    console.error(err);
    return render({ error: 'Could not submit your waiver. Please try again.' });
  }
});

// ---- Scheduling / calendar -------------------------------------------------

async function renderSchedule(req, res, opts = {}) {
  const { calendarData } = require('./checkout');
  const cal = await calendarData(req.query.month);
  res.render('schedule', {
    activePage: 'schedule',
    siteName: SITE_NAME,
    pageTitle: 'Class Calendar',
    content: { siteName: SITE_NAME },
    courses: JSON.parse((await getContent('courses')) || JSON.stringify(defaultCourses())),
    month: cal.month,
    monthEvents: cal.events,
    byDay: cal.byDay,
    success: false,
    error: null,
    form: {},
    ...opts,
  });
}

router.get('/schedule', (req, res) => renderSchedule(req, res));

router.post('/schedule', publicFormLimiter, async (req, res) => {
  const { customer_name, email, phone, course, scheduled_at, notes } = req.body;

  const render = (opts = {}) => renderSchedule(req, res, opts);

  if (!customer_name || !email || !course || !scheduled_at) {
    return render({
      error: 'Please provide your name, email, course, and a time.',
      form: req.body,
    });
  }

  // Reject past requests: the booking form should only accept future slots.
  const requestedTime = new Date(scheduled_at);
  if (Number.isNaN(requestedTime.getTime())) {
    return render({
      error: 'Please choose a valid date and time for your session.',
      form: req.body,
    });
  }
  if (requestedTime.getTime() <= Date.now()) {
    return render({
      error: 'That time has already passed. Please choose a future date and time.',
      form: req.body,
    });
  }

  try {
    const { createAppointment } = require('../lib/appointments');
    await createAppointment({
      customer_name,
      email,
      phone,
      course,
      scheduled_at,
      notes,
    });
    return render({ success: true });
  } catch (err) {
    console.error(err);
    // Show a fixed, friendly message for expected slot conflicts, but never
    // surface raw database error text to visitors.
    const isConflict = err && err.message === 'That time slot is already booked.';
    return render({
      error: isConflict
        ? 'That time slot is already booked. Please choose another time.'
        : 'Could not book that time. Please try again.',
      form: req.body,
    });
  }
});

module.exports = router;
