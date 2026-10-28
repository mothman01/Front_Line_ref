'use strict';

const { getContent, setContent } = require('./store');

/**
 * Stripe integration for paying in full to reserve a class seat.
 *
 * Requires STRIPE_SECRET_KEY (sk_test_... or sk_live_...). STRIPE_WEBHOOK_SECRET
 * (whsec_...) is strongly recommended so payments are confirmed even if the
 * customer closes the tab before returning to the site.
 */

// Ignore placeholders like "REPLACE_ME" so a half-filled config simply leaves
// checkout off instead of failing at payment time.
const envKey = (name, prefixes) => {
  const v = (process.env[name] || '').trim();
  return prefixes.some((p) => v.startsWith(p)) ? v : '';
};
const STRIPE_SECRET_KEY = envKey('STRIPE_SECRET_KEY', ['sk_', 'rk_']);
const STRIPE_WEBHOOK_SECRET = envKey('STRIPE_WEBHOOK_SECRET', ['whsec_']);

// Stripe's minimum checkout lifetime is 30 minutes; seats are held that long.
const HOLD_MINUTES = 30;

const stripe = STRIPE_SECRET_KEY ? require('stripe')(STRIPE_SECRET_KEY) : null;

function stripeConfigured() {
  return !!stripe;
}

function stripeMode() {
  if (!stripe) return null;
  return STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'live' : 'test';
}

// Owner-controlled on/off switch, stored with the rest of the site content.
async function isCheckoutEnabled() {
  return (await getContent('online_checkout_enabled')) === 'true';
}

async function setCheckoutEnabled(on) {
  await setContent('online_checkout_enabled', on ? 'true' : 'false');
}

// Checkout is only offered when the owner has it on AND Stripe is set up.
async function checkoutAvailable() {
  return stripeConfigured() && (await isCheckoutEnabled());
}

/**
 * Parse an owner-entered price like "$150", "150.00", or "150" into cents.
 * Returns null for blank/invalid input.
 */
function parsePriceToCents(input) {
  if (input == null) return null;
  const cleaned = String(input).replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

function formatCents(cents) {
  if (cents == null) return '';
  const dollars = cents / 100;
  return '$' + (Number.isInteger(dollars) ? dollars.toString() : dollars.toFixed(2));
}

async function createCheckoutSession({ registration, event, baseUrl }) {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: registration.email,
    client_reference_id: String(registration.id),
    metadata: { registration_id: String(registration.id), event_id: String(event.id) },
    line_items: [
      {
        quantity: registration.seats,
        price_data: {
          currency: 'usd',
          unit_amount: event.price_cents,
          product_data: {
            name: event.title,
            description: event.description ? event.description.slice(0, 300) : undefined,
          },
        },
      },
    ],
    expires_at: Math.floor(new Date(registration.hold_expires_at).getTime() / 1000),
    success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/checkout/cancel?session_id={CHECKOUT_SESSION_ID}`,
  });
  return session;
}

async function retrieveCheckoutSession(id) {
  return stripe.checkout.sessions.retrieve(id);
}

async function expireCheckoutSession(id) {
  try {
    await stripe.checkout.sessions.expire(id);
  } catch {
    // Already completed or expired — nothing to do.
  }
}

function constructWebhookEvent(rawBody, signature) {
  if (!STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET is not set.');
  return stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
}

module.exports = {
  HOLD_MINUTES,
  stripeConfigured,
  stripeMode,
  webhookConfigured: () => !!STRIPE_WEBHOOK_SECRET,
  isCheckoutEnabled,
  setCheckoutEnabled,
  checkoutAvailable,
  parsePriceToCents,
  formatCents,
  createCheckoutSession,
  retrieveCheckoutSession,
  expireCheckoutSession,
  constructWebhookEvent,
};
