// Express 4 does not catch a rejected promise from an async handler: the
// request would hang and the rejection would be unhandled. Every /v1 handler is
// async now that the store is, so every router is built from this one, which
// forwards a thrown error or a rejection to next(err) — exactly where Express
// sends a synchronous throw — and leaves error handlers and sub-routers alone.
import { Router } from 'express';

const METHODS = ['use', 'all', 'get', 'post', 'put', 'patch', 'delete'];

export function asyncHandler(fn) {
  if (typeof fn !== 'function' || fn.length === 4 || typeof fn.handle === 'function' || Array.isArray(fn.stack)) return fn;
  if (fn.__priAsync) return fn;
  const wrapped = function priAsyncHandler(req, res, next) {
    let result;
    try { result = fn(req, res, next); } catch (error) { return next(error); }
    if (result && typeof result.then === 'function') result.then(undefined, next);
    return undefined;
  };
  Object.defineProperty(wrapped, '__priAsync', { value: true });
  return wrapped;
}

function wrapArgument(arg) {
  return Array.isArray(arg) ? arg.map(wrapArgument) : asyncHandler(arg);
}

/**
 * Records the TEMPLATE of the route that matched (`/v1/classes/:classId`) on
 * the request, at the moment it matches: req.baseUrl is the literal mount path
 * here and req.route.path the declared pattern. The request log and the error
 * log name requests by this, never by the raw path, which carries ids. It has
 * to be taken here: by the time an error reaches the /v1 error handler Express
 * has already restored baseUrl to '/v1' while req.route still points at the
 * sub-router's route.
 */
function stampRouteTemplate(req, res, next) {
  const path = req.route?.path;
  if (typeof path === 'string') {
    const base = typeof req.baseUrl === 'string' ? req.baseUrl : '';
    req.routeTemplate = `${base}${path === '/' && base ? '' : path}` || '/';
  }
  next();
}

export function asyncRouter(options) {
  const router = Router(options);
  for (const method of METHODS) {
    const original = router[method].bind(router);
    router[method] = method === 'use'
      ? (...args) => original(...args.map(wrapArgument))
      : (path, ...handlers) => typeof path === 'function'
        ? original(path, ...handlers.map(wrapArgument))
        : original(path, stampRouteTemplate, ...handlers.map(wrapArgument));
  }
  return router;
}
