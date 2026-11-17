// Topic slip catalogues. One side-effect import per topic file, one per line,
// so parallel branches merge as a union. See ./registry.js for the shape.
export { diagnoseTopicLine, registerTopic, registeredTopics, topicDiagnosisCodes } from './registry.js';
import './polynomial-lines.js';
