'use strict';

const {
  createUser,
  getUserByUsername,
  countUsers,
  getContent,
  setContent,
} = require('./store');
const {
  defaultCourses,
  defaultSafetyRules,
  defaultContentOverrides,
} = require('./defaults');

/**
 * Ensure at least one admin user exists. On first run, creates the initial
 * admin from environment variables or documented defaults.
 * Returns the username of the created admin, or null if one already existed.
 */
function ensureAdminUser() {
  if (countUsers() > 0) {
    return null;
  }

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;

  // In production, never silently create an account with a known default
  // password. Require an explicit ADMIN_PASSWORD so the owner must choose one.
  if (process.env.NODE_ENV === 'production' && !password) {
    throw new Error(
      'ADMIN_PASSWORD must be set in production. Set a strong password in your host environment variables so the initial admin account is not created with an insecure default.'
    );
  }

  createUser(username, password || 'ChangeMeNow!123');
  return username;
}

/**
 * Populate default text content on first run so the site is never blank and
 * the admin panel shows editable content immediately.
 */
function seedDefaultContent() {
  const seed = {
    bio_name: 'Lucas Parrish',
    bio_title: 'Founder & Lead Coach',
    bio_body: [
      "<p>Hi, I\u2019m Lucas Parrish, the founder and lead coach of Front Line Refinement. During my time in the Army, I gained years of experience helping people become safer, more confident, and more consistent shooters. I served as a Master Marksmanship Trainer, where I helped develop clear, step-by-step instruction for people ranging from complete beginners to experienced shooters.</p>",
      "<p>What I enjoyed most was working directly with individuals\u2014identifying what was holding them back, explaining techniques in a way that made sense, and watching their confidence improve. That experience taught me that effective coaching is not about overwhelming someone with complicated terminology. It is about creating a safe, comfortable environment where they can ask questions, understand their firearm, and build dependable skills at their own pace.</p>",
      "<p>I understand that walking onto a range can feel intimidating, especially for someone who is new to firearms or has never received personal instruction. My goal is to make every student feel respected, supported, and comfortable throughout the learning process. Whether you are learning to safely handle your first firearm or trying to improve your accuracy and consistency, I will meet you at your current skill level and help you build from there.</p>",
    ].join('\n'),
    about_body: [
      "<p>Front Line Refinement provides structured, safety-focused firearms and marksmanship coaching for responsible adults. The company was founded to help shooters develop confidence, consistency, and dependable skills through disciplined instruction and purposeful practice.</p>",
      "<p>Coaching is available for newer firearm owners learning the fundamentals as well as experienced shooters looking to improve their performance. Every lesson emphasizes safe firearm handling, proper technique, individualized feedback, and measurable progression.</p>",
      "<p>At Front Line Refinement, the goal is not simply to fire more rounds\u2014it is to make every repetition intentional and give each shooter the knowledge needed to continue improving.</p>",
    ].join('\n'),
    about_line: 'Fundamentals First. Confidence Follows.',
  };

  // Also seed the large structured content (courses / safety rules) as JSON.
  if (getContent('courses') === null) {
    seed.courses = JSON.stringify(defaultCourses(), null, 2);
  }
  if (getContent('safety_rules') === null) {
    seed.safety_rules = JSON.stringify(defaultSafetyRules(), null, 2);
  }

  // Overrides for intro/closing lines.
  for (const [key, value] of Object.entries(defaultContentOverrides)) {
    if (getContent(key) === null) seed[key] = value;
  }

  let changed = false;
  for (const [key, value] of Object.entries(seed)) {
    if (getContent(key) === null) {
      setContent(key, value);
      changed = true;
    }
  }
  return changed;
}

/**
 * Middleware factory that protects admin routes.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  if (req.accepts('html')) {
    return res.redirect('/admin/login');
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

module.exports = {
  ensureAdminUser,
  seedDefaultContent,
  requireAuth,
  getUserByUsername,
};
