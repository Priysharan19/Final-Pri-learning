// Topic slip catalogues. One side-effect import per topic file, one per line,
// so parallel branches merge as a union. See ./registry.js for the shape.
export { diagnoseTopicLine, registerTopic, registeredTopics, slipInfo, topicDiagnosisCodes } from './registry.js';
import './algebra.js';
import './indices.js';
