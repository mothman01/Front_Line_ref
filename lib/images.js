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
      id: fallback.length + 1,
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

async function getProfileImage() {
  const list = await listImages('profile');
  return list.length ? list[0] : null;
}

async function getImage(id) {
  if (!hasDatabase) return fallback.find((im) => im.id === Number(id)) || null;
  const res = await query('SELECT * FROM images WHERE id = $1', [id]);
  return res.rows.length ? res.rows[0] : null;
}

async function deleteImage(id) {
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
  getImage,
  getProfileImage,
  deleteImage,
};
