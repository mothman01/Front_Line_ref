'use strict';

const express = require('express');
const router = express.Router();
const { getContent } = require('../lib/store');
const { defaultCourses, defaultSafetyRules } = require('../lib/defaults');
const { listBlockedSlots, listAppointments } = require('../lib/appointments');
const { listEvents } = require('../lib/events');
const { listImages } = require('../lib/images');

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
  return {
    activePage,
    siteName: SITE_NAME,
    pageTitle: pageTitles[activePage] || '',
    tagline: 'Fundamentals First. Confidence Follows.',
    content: {
      bioName: (await getContent('bio_name')) || 'Lucas Parrish',
      bioTitle: (await getContent('bio_title')) || 'Founder & Lead Coach',
      bioBody: (await getContent('bio_body')) || '<p>Biography content is being prepared.</p>',
      aboutBody: (await getContent('about_body')) || '<p>About content is being prepared.</p>',
      aboutLine: (await getContent('about_line')) || 'Fundamentals First. Confidence Follows.',
      safetyIntro:
        (await getContent('safety_intro')) ||
        'Your safety and the safety of everyone on the range are the highest priorities at Front Line Refinement. Every participant must understand and follow these rules.',
      safetyRules: JSON.parse(
        (await getContent('safety_rules')) || JSON.stringify(defaultSafetyRules())
      ),
      safetyClosing:
        (await getContent('safety_closing')) ||
        'No signed waiver. No firearm handling. No shooting. No exceptions.',
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
  res.render('classes', data);
});

// Serve a slideshow image by ID (stored in Postgres as a data URL).
router.get('/image/:id', async (req, res) => {
  const { getImage } = require('../lib/images');
  const img = await getImage(req.params.id);
  if (!img) return res.status(404).end();
  // img.data is a data URL like "data:image/jpeg;base64,..."
  const match = img.data.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) return res.status(500).end();
  const mimeType = match[1];
  const buf = Buffer.from(match[2], 'base64');
  res.set('Content-Type', mimeType);
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(buf);
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

router.post('/waiver', async (req, res) => {
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

router.get('/schedule', async (req, res) => {
  const appts = await listAppointments();
  const blocked = await listBlockedSlots();
  const events = await listEvents();
  res.render('schedule', {
    activePage: 'schedule',
    siteName: SITE_NAME,
    pageTitle: 'Schedule a Session',
    content: { siteName: SITE_NAME },
    appointments: appts,
    events,
    blocked: blocked,
    success: false,
    error: null,
    form: {},
  });
});

router.post('/schedule', async (req, res) => {
  const { customer_name, email, phone, course, scheduled_at, notes } = req.body;

  const render = async (opts = {}) =>
    res.render('schedule', {
      activePage: 'schedule',
      siteName: SITE_NAME,
      pageTitle: 'Schedule a Session',
      content: { siteName: SITE_NAME },
      appointments: await listAppointments(),
      blocked: await listBlockedSlots(),
      success: false,
      error: null,
      ...opts,
    });

  if (!customer_name || !email || !course || !scheduled_at) {
    return render({
      error: 'Please provide your name, email, course, and a time.',
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
    return render({
      error: err.message || 'Could not book that time. Please try again.',
      form: req.body,
    });
  }
});

module.exports = router;
