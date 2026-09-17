'use strict';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'site.json');

/**
 * Simple JSON-file-backed data store. This avoids native-dependency builds
 * (better-sqlite3 / sqlite3) so the app installs and runs reliably on any
 * Node.js host, including Windows machines without a compiler toolchain.
 */

let data = null;

function load() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    data = { users: [], content: {} };
    persist();
    return data;
  }

  const raw = fs.readFileSync(DB_PATH, 'utf8');
  try {
    data = JSON.parse(raw);
  } catch (e) {
    // Corrupt file — start fresh rather than crashing.
    data = { users: [], content: {} };
  }

  if (!data.users) data.users = [];
  if (!data.content) data.content = {};

  return data;
}

function persist() {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ---- content ---------------------------------------------------------------
function getContent(key) {
  const d = data || load();
  return key in d.content ? d.content[key] : null;
}

function setContent(key, value) {
  const d = data || load();
  d.content[key] = value == null ? '' : String(value);
  persist();
}

function getAllContent() {
  const d = data || load();
  return { ...d.content };
}

// ---- users -----------------------------------------------------------------
function createUser(username, password) {
  const d = data || load();
  const hash = bcrypt.hashSync(password, 12);
  const user = {
    id: d.users.length ? Math.max(...d.users.map((u) => u.id)) + 1 : 1,
    username,
    password_hash: hash,
    created_at: new Date().toISOString(),
  };
  d.users.push(user);
  persist();
  return user;
}

function getUserByUsername(username) {
  const d = data || load();
  return d.users.find((u) => u.username === username) || null;
}

function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password_hash);
}

function updatePassword(userId, newPassword) {
  const d = data || load();
  const user = d.users.find((u) => u.id === userId);
  if (!user) return;
  user.password_hash = bcrypt.hashSync(newPassword, 12);
  persist();
}

function updateUsername(userId, newUsername) {
  const d = data || load();
  const user = d.users.find((u) => u.id === userId);
  if (!user) return;
  user.username = newUsername;
  persist();
}

function countUsers() {
  const d = data || load();
  return d.users.length;
}

module.exports = {
  getContent,
  setContent,
  getAllContent,
  createUser,
  getUserByUsername,
  verifyPassword,
  updatePassword,
  updateUsername,
  countUsers,
};
