import { registerTopic } from './registry.js';
import { SEQUENCE_SLIPS } from './sequences.slips.js';
import { registrySlips, numericWorking } from './_adapt.js';
registerTopic({ topic: 'sequences', appliesTo: numericWorking, slips: registrySlips(SEQUENCE_SLIPS) });
