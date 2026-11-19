// A re-attempt of a saved question, shared by Scripts (History) and the recent
// attempts list beside a Practice question: one request, one hand-over shape.
// `variant` is 'same' (identical numbers) or 'fresh' (same skill, new numbers).
import { api } from '../api.js';

export async function retryServe(id, variant, t) {
  const r = await api.post(`/history/${id}/retry`, { variant });
  return {
    question: r.question,
    reason: 'retry',
    why: t(variant === 'same' ? 'history.whySame' : 'history.whyFresh')
  };
}
