import { cloudRequest } from './cloudTransport.js';

const SAFE_ID = /^[A-Za-z0-9._:-]{1,160}$/;

function pathId(value, label) {
  const id = String(value || '');
  if (!SAFE_ID.test(id)) throw new Error(`${label} is invalid`);
  return id;
}

export function assignmentSubmissions(classId, assignmentId) {
  return cloudRequest(`/v1/assignments/${pathId(classId, 'class id')}/${pathId(assignmentId, 'assignment id')}/submissions`);
}
