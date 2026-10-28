'use strict';

const rateLimit = require('express-rate-limit');
const router = require('../lib/async-router').Router();

const { getContent } = require('../lib/store');
const { defaultCourses } = require('../lib/defaults');
const { listImages } = require('../lib/images');
const {
  listEvents,
  getEvent,
  holdSeats,
  attachCheckoutSession,
  getRegistrationBySession,
  markPaid,
  releaseHold,
  SeatsUnavailableError,
} = require('../lib/events');
const payments = require('../lib/payments');
const { buildMonth, dayKey, formatDateTime, formatTime } = require('../lib/time');

const SITE_NAME = 'Front Line Refinement';
const MAX_SEATS_PER_ORDER = 6;

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).render('error', {
      status: 429,
      message: 'Too many checkout attempts. Please wait 15 minutes and try again.',
    }),
});

function baseUrl(req) {
  return (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

async function loadCourses() {
  return JSON.parse((await getContent('courses')) || JSON.stringify(defaultCourses()));
}

// Shape an event for the public calendar / live seat tracker.
function publicEvent(e) {
  return {
    id: e.id,
    title: e.title,
    starts_at: e.starts_at,
    day: dayKey(e.starts_at),
    time: formatTime(e.starts_at),
    capacity: e.capacity,
    seats_left: e.seats_left,
    price: payments.formatCents(e.price_cents),
    past: new Date(e.starts_at).getTime() <= Date.now(),
  };
}

// ---- Calendar ---------------------------------------------------------------

router.get('/calendar', (req, res) => res.redirect(301, '/schedule'));

/**
 * Month calendar data used by the schedule page (server render) and by the
 * live seat tracker, which polls this endpoint.
 */
async function calendarData(monthParam) {
  const month = buildMonth(monthParam);
  const events = (await listEvents({ from: month.rangeStart, to: month.rangeEnd })).map(publicEvent);
  const byDay = {};
  for (const e of events) (byDay[e.day] = byDay[e.day] || []).push(e);
  return { month, events, byDay };
}

// Live seat tracker: /api/seats?ids=1,2,3 -> current seats left per class.
// Pages poll every 15s; the limit leaves plenty of room for several open tabs.
const seatsLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

router.get('/api/seats', seatsLimiter, async (req, res) => {
  const ids = String(req.query.ids || '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 100);
  const events = ids.length ? await listEvents({ ids: [...new Set(ids)] }) : [];
  res.set('Cache-Control', 'no-store');
  res.json({
    seats: events.map((e) => ({
      id: e.id,
      seats_left: e.seats_left,
      capacity: e.capacity,
      past: new Date(e.starts_at).getTime() <= Date.now(),
    })),
  });
});

// ---- Class detail + checkout ----------------------------------------------

async function renderClassPage(req, res, ev, extra = {}) {
  const courses = await loadCourses();
  const course = courses.find((c) => c.id === ev.course_id) || null;
  const photo = course ? (await listImages(`course:${course.id}`))[0] || null : null;
  res.render('class-session', {
    activePage: 'schedule',
    siteName: SITE_NAME,
    pageTitle: ev.title,
    content: { siteName: SITE_NAME },
    ev,
    course,
    photo,
    when: formatDateTime(ev.starts_at),
    endsAt: ev.ends_at ? formatTime(ev.ends_at) : null,
    price: payments.formatCents(ev.price_cents),
    isPast: new Date(ev.starts_at).getTime() <= Date.now(),
    checkoutOn: await payments.checkoutAvailable(),
    maxSeats: Math.min(MAX_SEATS_PER_ORDER, ev.seats_left),
    holdMinutes: payments.HOLD_MINUTES,
    error: null,
    form: {},
    ...extra,
  });
}

router.get('/class/:id', async (req, res, next) => {
  const ev = await getEvent(req.params.id);
  if (!ev) return next();
  await renderClassPage(req, res, ev, { cancelled: req.query.cancelled === '1' });
});

router.post('/class/:id/checkout', checkoutLimiter, async (req, res, next) => {
  const ev = await getEvent(req.params.id);
  if (!ev) return next();

  const { customer_name, email, phone } = req.body;
  const seats = Math.floor(Number(req.body.seats) || 1);
  const fail = (error) => renderClassPage(req, res, ev, { error, form: req.body });

  if (!(await payments.checkoutAvailable())) {
    return fail('Online registration is currently unavailable. Please contact us to reserve a seat.');
  }
  if (new Date(ev.starts_at).getTime() <= Date.now()) {
    return fail('This class has already started.');
  }
  if (!ev.price_cents || ev.price_cents < 50) {
    return fail('This class does not have a price set yet. Please contact us to register.');
  }
  if (!customer_name || !email) {
    return fail('Please enter your name and email.');
  }
  if (
    String(customer_name).length > 120 ||
    String(email).length > 254 ||
    String(phone || '').length > 40 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
  ) {
    return fail('Please check your name, email, and phone number.');
  }
  if (seats < 1 || seats > MAX_SEATS_PER_ORDER) {
    return fail(`You can reserve between 1 and ${MAX_SEATS_PER_ORDER} seats per order.`);
  }
  if (req.body.agree_terms !== 'on') {
    return fail('Please confirm you have read the safety rules and will sign the liability waiver.');
  }

  let registration;
  try {
    registration = await holdSeats({
      event_id: ev.id,
      customer_name: customer_name.trim(),
      email: email.trim(),
      phone: (phone || '').trim(),
      seats,
      amount_cents: ev.price_cents * seats,
      hold_expires_at: new Date(Date.now() + payments.HOLD_MINUTES * 60 * 1000 + 30 * 1000),
    });
  } catch (err) {
    if (err instanceof SeatsUnavailableError) return fail(err.message);
    throw err;
  }

  try {
    const session = await payments.createCheckoutSession({ registration, event: ev, baseUrl: baseUrl(req) });
    await attachCheckoutSession(registration.id, session.id);
    return res.redirect(303, session.url);
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    // Free the hold so the seat isn't stuck for 30 minutes.
    await attachCheckoutSession(registration.id, `failed_${registration.id}`);
    await releaseHold(`failed_${registration.id}`);
    return fail('We could not start the payment. Please try again in a moment.');
  }
});

router.get('/checkout/success', async (req, res) => {
  const sessionId = String(req.query.session_id || '');
  let reg = sessionId ? await getRegistrationBySession(sessionId) : null;

  // Confirm with Stripe directly so the page is correct even before (or
  // without) the webhook arriving.
  if (reg && reg.status !== 'paid' && payments.stripeConfigured()) {
    try {
      const s = await payments.retrieveCheckoutSession(sessionId);
      if (s.payment_status === 'paid') reg = await markPaid(sessionId, s.payment_intent);
    } catch (err) {
      console.error('Stripe session lookup failed:', err.message);
    }
  }

  const ev = reg ? await getEvent(reg.event_id) : null;
  res.render('checkout-result', {
    activePage: 'schedule',
    siteName: SITE_NAME,
    pageTitle: 'Registration',
    content: { siteName: SITE_NAME },
    reg,
    ev,
    when: ev ? formatDateTime(ev.starts_at) : null,
    total: reg ? payments.formatCents(reg.amount_cents) : null,
    outcome: reg && reg.status === 'paid' ? 'paid' : 'processing',
  });
});

router.get('/checkout/cancel', async (req, res) => {
  const sessionId = String(req.query.session_id || '');
  const reg = sessionId ? await getRegistrationBySession(sessionId) : null;
  if (reg && reg.status === 'pending') {
    // Customer backed out: release their seats right away.
    if (payments.stripeConfigured()) await payments.expireCheckoutSession(sessionId);
    await releaseHold(sessionId);
  }
  if (reg) return res.redirect(`/class/${reg.event_id}?cancelled=1`);
  res.redirect('/schedule');
});

// ---- Stripe webhook (mounted with a raw body parser in server.js) ----------

async function stripeWebhook(req, res) {
  let event;
  try {
    event = payments.constructWebhookEvent(req.body, req.get('stripe-signature'));
  } catch (err) {
    console.error('Stripe webhook rejected:', err.message);
    return res.status(400).send('Invalid signature');
  }

  try {
    const s = event.data.object;
    if (
      (event.type === 'checkout.session.completed' && s.payment_status === 'paid') ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      await markPaid(s.id, s.payment_intent);
    } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      await releaseHold(s.id);
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook handling failed:', err);
    res.status(500).send('Webhook handler error');
  }
}

module.exports = router;
module.exports.calendarData = calendarData;
module.exports.stripeWebhook = stripeWebhook;
