'use strict';

const express = require('express');
const router = express.Router();
const { getContent } = require('../lib/store');
const { defaultCourses, defaultSafetyRules } = require('../lib/defaults');

const SITE_NAME = 'Front Line Refinement';

/**
 * Build the shared view data for public pages. Content values come from the
 * database so the owner can edit them, with sensible fallbacks.
 */
function pageData(activePage) {
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
      bioName: getContent('bio_name') || 'Lucas Parrish',
      bioTitle: getContent('bio_title') || 'Founder & Lead Coach',
      bioBody: getContent('bio_body') || '<p>Biography content is being prepared.</p>',
      aboutBody: getContent('about_body') || '<p>About content is being prepared.</p>',
      aboutLine: getContent('about_line') || 'Fundamentals First. Confidence Follows.',
      safetyIntro:
        getContent('safety_intro') ||
        'Your safety and the safety of everyone on the range are the highest priorities at Front Line Refinement. Every participant must understand and follow these rules.',
      safetyRules: JSON.parse(
        getContent('safety_rules') || JSON.stringify(defaultSafetyRules())
      ),
      safetyClosing:
        getContent('safety_closing') ||
        'No signed waiver. No firearm handling. No shooting. No exceptions.',
    },
  };
}

router.get('/', (req, res) => {
  res.render('home', pageData('home'));
});

router.get('/biography', (req, res) => {
  res.render('biography', pageData('biography'));
});

router.get('/about', (req, res) => {
  res.render('about', pageData('about'));
});

router.get('/safety', (req, res) => {
  res.render('safety', pageData('safety'));
});

router.get('/classes', (req, res) => {
  const data = pageData('classes');
  data.content.courses = JSON.parse(
    getContent('courses') || JSON.stringify(defaultCourses())
  );
  res.render('classes', data);
});

module.exports = router;
