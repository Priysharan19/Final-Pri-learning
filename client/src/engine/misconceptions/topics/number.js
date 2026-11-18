import { registerTopic } from './registry.js';
import { NUMBER_SLIPS } from './number.slips.js';
import { registrySlips, numericWorking } from './_adapt.js';
registerTopic({ topic: 'number', appliesTo: numericWorking, slips: registrySlips(NUMBER_SLIPS) });
