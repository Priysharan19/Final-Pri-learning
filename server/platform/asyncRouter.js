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
  // The access-control tag (routePolicy.js) must survive wrapping, or the route
  // inventory would stop seeing the guard it describes.
  if (fn.priPolicy) Object.defineProperty(wrapped, 'priPolicy', { value: fn.priPolicy, configurable: true });
  return wrapped;
}

function wrapArgument(arg) {
  return Array.isArray(arg) ? arg.map(wrapArgument) : asyncHandler(arg);
}

export function asyncRouter(options) {
  const router = Router(options);
  for (const method of METHODS) {
    const original = router[method].bind(router);
    router[method] = (...args) => original(...args.map(wrapArgument));
  }
  return router;
}
