// Local-first API — every call is served on-device from IndexedDB.
// Same interface as a network client, zero network. Your data never leaves the iPad.
import { dispatch } from './local/backend.js';

async function call(method, path, body) {
  try {
    return await dispatch(method, path, body);
  } catch (e) {
    if (!e.status) e.status = 500;
    throw e;
  }
}

export const api = {
  get: p => call('GET', p),
  post: (p, b = {}) => call('POST', p, b),
  patch: (p, b = {}) => call('PATCH', p, b)
};
