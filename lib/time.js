'use strict';

/**
 * Timezone helpers. The calendar, "today" highlight, and class times are all
 * shown in the business's local timezone regardless of where the server or
 * visitor is. Override with SITE_TIMEZONE (an IANA name).
 */

const SITE_TIMEZONE = process.env.SITE_TIMEZONE || 'America/Chicago';

// Returns { year, month (1-12), day, hour, minute } for `date` in the site zone.
function zonedParts(date, tz = SITE_TIMEZONE) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const out = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out;
}

/**
 * Convert a wall-clock string from a <input type="datetime-local"> (e.g.
 * "2026-11-14T09:00") in the site zone into a real UTC Date.
 */
function zonedToUtc(localString, tz = SITE_TIMEZONE) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(localString || '');
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Find the zone's offset at that instant, then correct (twice, for DST edges).
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess), tz);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += asUtc - shown;
  }
  return new Date(guess);
}

// Inverse of zonedToUtc: a Date -> "YYYY-MM-DDTHH:MM" in the site zone.
function utcToLocalInput(date, tz = SITE_TIMEZONE) {
  if (!date) return '';
  const p = zonedParts(new Date(date), tz);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

// "YYYY-MM-DD" key for the calendar day a Date falls on in the site zone.
function dayKey(date, tz = SITE_TIMEZONE) {
  const p = zonedParts(new Date(date), tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function formatDateTime(date, opts = {}) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: SITE_TIMEZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...opts,
  }).format(new Date(date));
}

function formatTime(date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: SITE_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));
}

/**
 * Build a month grid (Sunday-first) for the calendar view. `monthParam` is an
 * optional "YYYY-MM"; defaults to the current month in the site zone.
 */
function buildMonth(monthParam) {
  const today = zonedParts(new Date());
  let year = today.year;
  let month = today.month;
  const m = /^(\d{4})-(\d{2})$/.exec(monthParam || '');
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    year = Number(m[1]);
    month = Number(m[2]);
  }

  const pad = (n) => String(n).padStart(2, '0');
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const todayKey = `${today.year}-${pad(today.month)}-${pad(today.day)}`;

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${pad(month)}-${pad(d)}`;
    cells.push({ day: d, key, isToday: key === todayKey, isPast: key < todayKey });
  }
  while (cells.length % 7) cells.push(null);

  const prev = month === 1 ? `${year - 1}-12` : `${year}-${pad(month - 1)}`;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${pad(month + 1)}`;
  const label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );

  return {
    year,
    month,
    key: `${year}-${pad(month)}`,
    label,
    cells,
    prev,
    next,
    isCurrentMonth: year === today.year && month === today.month,
    // UTC range that safely covers the whole month in any US zone.
    rangeStart: zonedToUtc(`${year}-${pad(month)}-01T00:00`),
    rangeEnd: zonedToUtc(`${next}-01T00:00`),
  };
}

module.exports = {
  SITE_TIMEZONE,
  zonedToUtc,
  utcToLocalInput,
  dayKey,
  formatDateTime,
  formatTime,
  buildMonth,
};
