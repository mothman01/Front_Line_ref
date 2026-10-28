'use strict';

const express = require('express');

/**
 * Express 4 does not catch rejected promises from async handlers. On modern
 * Node an unhandled rejection crashes the process, so a single failed DB query
 * would take the whole site down. This Router forwards those errors to the
 * Express error handler instead.
 */
function wrap(handler) {
  if (typeof handler !== 'function' || handler.length === 4) return handler; // error middleware
  return function wrapped(req, res, next) {
    try {
      const result = handler(req, res, next);
      if (result && typeof result.catch === 'function') result.catch(next);
    } catch (err) {
      next(err);
    }
  };
}

function Router(options) {
  const router = express.Router(options);
  for (const method of ['get', 'post', 'put', 'patch', 'delete', 'all', 'use']) {
    const original = router[method].bind(router);
    router[method] = (...args) => original(...args.map((a) => (Array.isArray(a) ? a.map(wrap) : wrap(a))));
  }
  return router;
}

module.exports = { Router, wrap };
