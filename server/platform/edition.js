// Pri Learning · the regional edition this server serves (ADR-0002, plan E1).
//
// One source of truth: client/edition.config.mjs, read here exactly as the
// client build reads it, from PRI_EDITION (unset = Priyabhata). An unknown
// value throws, so a mistyped service variable stops the server at start-up
// instead of serving one edition's students under the other's identity.
//
// E1 only reports the edition (/v1/health). Holding the server's edition equal
// to the built client's, and sign-up course defaults, arrive in plan E2.
import { resolveEdition } from '../../client/edition.config.mjs';

export function serverEdition(env = process.env) {
  return resolveEdition(env);
}
