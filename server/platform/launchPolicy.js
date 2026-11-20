import { indiaFreeLaunch } from '../../client/src/engine/launchPolicy.js';
import { serverEdition } from './edition.js';

// Deployment identity is server-owned. A request never selects this policy.
export function freeLaunchActive(edition = serverEdition(), env = process.env) {
  return indiaFreeLaunch(edition, env);
}
