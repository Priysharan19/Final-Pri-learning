import { registerTopic } from './registry.js';
import { FINANCE_SLIPS } from './finance.slips.js';
import { registrySlips, numericWorking } from './_adapt.js';
registerTopic({ topic: 'finance', appliesTo: numericWorking, slips: registrySlips(FINANCE_SLIPS) });
