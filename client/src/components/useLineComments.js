// Pri Learning · fetch the comments for a marked answer (after the mark; never before, never part of it).
//
// Asks the server for the comments on this attempt. The server has the feature OFF unless it sets
// PRI_FEATURE_LINE_COMMENTS=1, and then it answers `enabled: false`: nothing is drawn, the page is exactly
// the engine's own sentences, and the question is not asked again this session. With it on, the comments are
// only those a model wrote for lines the engine gave a final verdict, and that passed the engine's rules.
// A pending answer (another tab is writing them) is asked again shortly. Any failure shows no comments:
// the page is whole without them.
import { useEffect, useState } from 'react';
import { cloud } from '../platform/cloudTransport.js';

// Learned once per page load: the server said the feature is not enabled.
let serverSaysOff = false;
export const lineCommentsOffForSession = () => serverSaysOff;
export const resetLineCommentsSession = () => { serverSaysOff = false; };

export function useLineComments(res, { language = 'en', enabled = true } = {}) {
  const [comments, setComments] = useState(null);
  const qid = res?.questionId, attemptId = res?.attemptId;
  const judged = Array.isArray(res?.stepReport?.lines) && res.stepReport.lines.length >= 2;
  useEffect(() => {
    setComments(null);
    if (!enabled || serverSaysOff || !judged || typeof qid !== 'string' || typeof attemptId !== 'string' || res?.invalid || res?.revealed) return undefined;
    let live = true; let timer = null; let tries = 0;
    const ask = () => {
      tries += 1;
      Promise.resolve().then(() => cloud.lineCommentsPractice(qid, { attemptId, language })).then(r => {
        if (r?.enabled === false) { serverSaysOff = true; return; }
        if (!live) return;
        if (r?.pending && tries < 4) { timer = setTimeout(ask, 1500 * tries); return; }
        setComments(Array.isArray(r?.comments) && r.comments.length ? r.comments : null);
      }).catch(() => { if (live) setComments(null); });
    };
    ask();
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [qid, attemptId, language, enabled, judged, res?.invalid, res?.revealed]);
  return comments;
}
