'use strict';

const bcrypt = require('bcryptjs');
const { query, hasDatabase, initSchema } = require('./db');

/**
 * PostgreSQL-backed store. Replaces the previous JSON-file store. All functions
 * are async; the app initializes the schema and seeds defaults before serving.
 *
 * A small synchronous in-memory fallback is provided for local development
 * without DATABASE_URL, but production always requires Postgres.
 */

// ---- In-memory fallback (dev only) ----------------------------------------
const fallback = {
  users: [],
  content: {},
  _init: false,
};

function useFallback() {
  return !hasDatabase;
}

// ---- content ---------------------------------------------------------------
async function getContent(key) {
  if (useFallback()) return fallback.content[key] ?? null;

  const res = await query('SELECT value FROM content WHERE key = $1', [key]);
  return res.rows.length ? res.rows[0].value : null;
}

async function setContent(key, value) {
  if (useFallback()) {
    fallback.content[key] = value == null ? '' : String(value);
    return;
  }

  await query(
    `INSERT INTO content (key, value, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, value == null ? '' : String(value)]
  );
}

async function getAllContent() {
  if (useFallback()) return { ...fallback.content };

  const res = await query('SELECT key, value FROM content');
  const out = {};
  for (const row of res.rows) out[row.key] = row.value;
  return out;
}

// ---- users -----------------------------------------------------------------
async function createUser(username, password) {
  const hash = bcrypt.hashSync(password, 12);

  if (useFallback()) {
    const user = {
      id: fallback.users.length ? Math.max(...fallback.users.map((u) => u.id)) + 1 : 1,
      username,
      password_hash: hash,
      created_at: new Date().toISOString(),
    };
    fallback.users.push(user);
    return user;
  }

  const res = await query(
    'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *',
    [username, hash]
  );
  return res.rows[0];
}

async function getUserByUsername(username) {
  if (useFallback()) {
    return fallback.users.find((u) => u.username === username) || null;
  }

  const res = await query('SELECT * FROM users WHERE username = $1', [username]);
  return res.rows.length ? res.rows[0] : null;
}

function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password_hash);
}

async function updatePassword(userId, newPassword) {
  const hash = bcrypt.hashSync(newPassword, 12);

  if (useFallback()) {
    const user = fallback.users.find((u) => u.id === userId);
    if (user) user.password_hash = hash;
    return;
  }

  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
}

async function updateUsername(userId, newUsername) {
  if (useFallback()) {
    const user = fallback.users.find((u) => u.id === userId);
    if (user) user.username = newUsername;
    return;
  }

  await query('UPDATE users SET username = $1 WHERE id = $2', [newUsername, userId]);
}

async function countUsers() {
  if (useFallback()) return fallback.users.length;

  const res = await query('SELECT COUNT(*)::int AS n FROM users');
  return res.rows[0].n;
}

module.exports = {
  initSchema,
  getContent,
  setContent,
  getAllContent,
  createUser,
  getUserByUsername,
  verifyPassword,
  updatePassword,
  updateUsername,
  countUsers,
  hasDatabase,
};
