// PRI Learning backend contract foundation.
// This registry creates a single source of truth for future local/cloud adapters.

export const ROUTE_CONTRACTS = Object.freeze([
  {
    method: 'GET',
    path: '/health',
    auth: 'none',
    request: {},
    response: { status: 'string' }
  }
]);

export function findContract(method, path) {
  return ROUTE_CONTRACTS.find(
    route => route.method === method && route.path === path
  ) || null;
}
