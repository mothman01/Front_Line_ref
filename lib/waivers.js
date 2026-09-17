'use strict';

const { query, hasDatabase } = require('./db');

// In-memory fallback for local dev without DATABASE_URL.
const fallback = [];

/**
 * Record a signed liability waiver. Returns the created record.
 */
async function saveWaiver(data) {
  const sql = `
    INSERT INTO waivers
      (full_name, email, phone, address, date_of_birth, legal_attestation, signature)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const params = [
    data.full_name,
    data.email,
    data.phone || null,
    data.address || null,
    data.date_of_birth || null,
    !!data.legal_attestation,
    data.signature,
  ];

  if (!hasDatabase) {
    const rec = { id: fallback.length + 1, signed_at: new Date(), ...data };
    fallback.push(rec);
    return rec;
  }

  const res = await query(sql, params);
  return res.rows[0];
}

async function listWaivers() {
  if (!hasDatabase) return fallback;
  const res = await query(
    'SELECT * FROM waivers ORDER BY signed_at DESC'
  );
  return res.rows;
}

async function countWaivers() {
  if (!hasDatabase) return fallback.length;
  const res = await query('SELECT COUNT(*)::int AS n FROM waivers');
  return res.rows[0].n;
}

async function getWaiver(id) {
  if (!hasDatabase) return fallback.find((w) => w.id === Number(id)) || null;
  const res = await query('SELECT * FROM waivers WHERE id = $1', [id]);
  return res.rows.length ? res.rows[0] : null;
}

module.exports = {
  saveWaiver,
  listWaivers,
  countWaivers,
  getWaiver,
};
