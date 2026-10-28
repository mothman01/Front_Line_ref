'use strict';

const { query, hasDatabase } = require('./db');

// In-memory fallback for local dev without DATABASE_URL.
const fallback = [];

/**
 * Image storage for the homepage slideshow. Images are stored as base64 data
 * URIs in Postgres so they survive restarts/redeploys (the filesystem on Render
 * is ephemeral).
 */
async function saveImage({ filename, mimeType, dataUrl, category = 'slideshow' }) {
  if (!hasDatabase) {
    const rec = {
      id: fallback.length ? Math.max(...fallback.map((im) => im.id)) + 1 : 1,
      filename,
      mime_type: mimeType,
      data: dataUrl,
      category,
      sort_order: fallback.length,
      created_at: new Date().toISOString(),
    };
    fallback.push(rec);
    return rec;
  }

  const res = await query(
    `INSERT INTO images (filename, mime_type, data, category, sort_order)
     VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM images))
     RETURNING *`,
    [filename, mimeType, dataUrl, category]
  );
  return res.rows[0];
}

async function listImages(category = 'slideshow') {
  if (!hasDatabase) {
    return fallback.filter((im) => im.category === category).sort((a, b) => a.sort_order - b.sort_order);
  }
  // Only fetch metadata. The base64 `data` column is large and is never needed
  // by list callers — they render <img src="/image/:id"> links instead.
  const res = await query(
    'SELECT id, filename, sort_order FROM images WHERE category = $1 ORDER BY sort_order ASC',
    [category]
  );
  return res.rows;
}

/**
 * First image per category for every category starting with `prefix`, in one
 * query. Returns { [category]: { id, filename } } — used for course photos
 * ("course:<id>") so pages don't run one query per course.
 */
async function firstImagesByPrefix(prefix) {
  let rows;
  if (!hasDatabase) {
    rows = fallback
      .filter((im) => im.category.startsWith(prefix))
      .sort((a, b) => a.sort_order - b.sort_order);
  } else {
    const res = await query(
      `SELECT id, filename, category, sort_order FROM images
       WHERE starts_with(category, $1) ORDER BY sort_order ASC`,
      [prefix]
    );
    rows = res.rows;
  }
  const out = {};
  for (const r of rows) if (!out[r.category]) out[r.category] = { id: r.id, filename: r.filename };
  return out;
}

async function getProfileImage() {
  const list = await listImages('profile');
  return list.length ? list[0] : null;
}

async function getImage(id) {
  if (!hasDatabase) return fallback.find((im) => im.id === Number(id)) || null;
  const res = await query('SELECT * FROM images WHERE id = $1', [id]);
  return res.rows.length ? res.rows[0] : null;
}

// Decoded images kept in memory (up to ~64 MB, oldest evicted first) so
// popular photos aren't re-fetched and re-decoded on every request.
const decodedCache = new Map();
const DECODED_CACHE_MAX_BYTES = 64 * 1024 * 1024;
let decodedCacheBytes = 0;

function forget(id) {
  const old = decodedCache.get(String(id));
  if (old) {
    decodedCache.delete(String(id));
    decodedCacheBytes -= old.buf.length;
  }
}

/** Returns { type, buf } for an image, or null. */
async function getDecodedImage(id) {
  const key = String(id);
  const hit = decodedCache.get(key);
  if (hit) return hit;
  const img = await getImage(id);
  if (!img) return null;
  // img.data is a data URL like "data:image/jpeg;base64,..."
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.*)$/s.exec(img.data);
  if (!match) return null;
  const entry = { type: match[1], buf: Buffer.from(match[2], 'base64') };
  decodedCache.set(key, entry);
  decodedCacheBytes += entry.buf.length;
  for (const k of decodedCache.keys()) {
    if (decodedCacheBytes <= DECODED_CACHE_MAX_BYTES) break;
    forget(k);
  }
  return entry;
}

async function deleteImage(id) {
  forget(id);
  if (!hasDatabase) {
    const idx = fallback.findIndex((im) => im.id === Number(id));
    if (idx >= 0) fallback.splice(idx, 1);
    return;
  }
  await query('DELETE FROM images WHERE id = $1', [id]);
}

module.exports = {
  saveImage,
  listImages,
  firstImagesByPrefix,
  getImage,
  getDecodedImage,
  getProfileImage,
  deleteImage,
};
