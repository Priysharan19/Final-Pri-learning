import { indiaFreeLaunch } from '../engine/launchPolicy.js';
import { EDITION } from './edition.js';

/* global __PRI_FREE_LAUNCH__ */
// Vite fixes the shipped policy at build time. Node contract suites can
// explicitly opt into the paid-mode fixture to retain its regression tests.
const testEnv = typeof process !== 'undefined' ? process.env : {};
export const FREE_LAUNCH = typeof __PRI_FREE_LAUNCH__ === 'boolean'
  ? __PRI_FREE_LAUNCH__ : indiaFreeLaunch(EDITION, testEnv);
