// Pri Learning · NSW Notes — the next step into Practice for one topic.
//
// A notes topic is a focus area of a current NSW syllabus (nswNotesIndex.js); Practice
// serves the legacy NSW subtopics, each with its own generator. The crosswalk
// (engine/curriculum-nsw/crosswalk.js) records, per dot point of each subtopic, the
// current outcome codes it teaches. A topic's practice is the subtopic whose dot points
// land on the topic's outcomes most often, among the subtopics the server actually
// issues questions from (engine/nswOffer.js): a link to a subtopic nothing is issued
// from would open Practice on a refusal.
//
// Where no issued subtopic reaches a topic, there is no topic practice to offer. The
// page then says so and opens Practice for the student's own year and course instead,
// rather than pretending another topic is this one.
//
// Pure, and NSW only: no India curriculum, no lib/practiceLinks.js (the India builder),
// so the Prithagoras notes chunk stays free of India code (nsw-notes-no-india-check).
import { NSW_CROSSWALK, ADV, EXT1, EXT2, STD, K10 } from '../../engine/curriculum-nsw/crosswalk.js';
import { nswIssuedLevels } from '../../engine/nswOffer.js';

const SYLLABUS_OF_COURSE = Object.freeze({ standard: STD, advanced: ADV, ext1: EXT1, ext2: EXT2 });

/**
 * The practice subtopic for a notes topic, or null when no issued subtopic teaches it.
 * Ties go to a subtopic labelled in the topic's own course, then to crosswalk order.
 */
export function nswPracticeSubtopic(topic) {
  if (!topic?.outcomes?.length) return null;
  const own = topic.course ? SYLLABUS_OF_COURSE[topic.course] : K10;
  let best = null;
  NSW_CROSSWALK.forEach((row, order) => {
    if (!row.subtopicId || !nswIssuedLevels(row.subtopicId).length) return;
    const hits = row.dotpoints.filter(codes => codes.some(c => topic.outcomes.includes(c))).length;
    if (!hits) return;
    const score = [hits, row.syllabus === own ? 1 : 0, -order];
    if (!best || score[0] > best.score[0] || (score[0] === best.score[0] && (score[1] > best.score[1] || (score[1] === best.score[1] && score[2] > best.score[2])))) {
      best = { id: row.subtopicId, score };
    }
  });
  return best ? best.id : null;
}

/** `/practice?subtopic=…` for the topic, or plain `/practice` (the student's own year and course). */
export function nswPracticeHref(topic) {
  const subtopic = nswPracticeSubtopic(topic);
  return subtopic ? `/practice?${new URLSearchParams({ subtopic })}` : '/practice';
}
