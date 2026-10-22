// Read-only adapter over the EXISTING Pri curricular identities and authored
// expert prerequisite map. No imported data is modified and no mark is inferred.
import { IN_CHAPTER_BY_ID } from '../../engine/curriculum-in.js';
import { prerequisitesOf, mapStrandOf } from '../../engine/prerequisites.js';
import { PROGRESS_THRESHOLDS, accuracyClaim, evidenceByKey } from '../../engine/progressTruth.js';
import { constellation } from '../../instrument/mapLayout.js';

// Curated exploration window; IDs resolve against the app's live curriculum.
// Deliberately not a claim that the prototype represents complete CBSE coverage.
export const ATLAS_IDS = Object.freeze([
  'c8-linear-equations', 'c8-factorisation', 'c8-squares-roots',
  'c9-number-systems', 'c9-linear-polynomials', 'c9-algebraic-identities',
  'c9-coordinate-geometry', 'c9-circles', 'c9-probability',
  'c10-real-numbers', 'c10-polynomials', 'c10-pair-linear-equations',
  'c10-quadratic-equations', 'c10-coordinate-geometry', 'c10-trigonometry',
  'c10-statistics', 'c10-probability'
]);

// Editorial *conceptual relationships*, distinct from necessary prerequisites.
// Every edge has an inspectable, human-authored explanation.
const RELATIONS = Object.freeze([
  ['c9-coordinate-geometry', 'c10-pair-linear-equations', 'Graphs turn simultaneous solutions into intersection points.'],
  ['c10-polynomials', 'c10-quadratic-equations', 'Quadratic roots are also zeroes of quadratic polynomials.'],
  ['c9-probability', 'c10-probability', 'Both describe likelihood, with increasingly structured sample spaces.'],
  ['c10-coordinate-geometry', 'c10-trigonometry', 'Coordinate distance and right-triangle ratios connect geometry with algebra.'],
  ['c9-algebraic-identities', 'c10-polynomials', 'Polynomial expressions can be rewritten using algebraic identities.']
]);

export const ATLAS_SUBJECTS = Object.freeze({
  number: { label: 'Number', colour: '#8fb8ec', shape: 'square' },
  algebra: { label: 'Algebra', colour: '#c5adf0', shape: 'circle' },
  geometry: { label: 'Geometry', colour: '#e1b888', shape: 'diamond' },
  trig: { label: 'Trigonometry', colour: '#8bcfc8', shape: 'triangle' },
  coord: { label: 'Coordinates', colour: '#a7c5ed', shape: 'hexagon' },
  calculus: { label: 'Calculus', colour: '#d3b7e2', shape: 'circle' },
  data: { label: 'Data', colour: '#d1c68d', shape: 'square' }
});

/** Every link must have valid, distinct endpoints and an explicit meaning. */
export function buildAtlasGraph({ ids = ATLAS_IDS, attempts = [], evidenceLinks = [], demo = false } = {}) {
  const uniqueIds = [...new Set(ids)];
  const rows = uniqueIds.map(id => IN_CHAPTER_BY_ID[id]).filter(Boolean);
  const counts = evidenceByKey(demo ? [] : attempts.filter(a => a?.serverVerified === true));
  const placed = constellation(rows.map(ch => ({ id: ch.id, name: ch.name, mastery: 0 })), id => prerequisitesOf(id).map(p => p.id));
  const positions = new Map(placed.nodes.map(n => [n.id, n]));
  const nodes = rows.map(ch => {
    const evidence = counts[ch.id] || { attempts: 0, correct: 0, independentCorrect: 0 };
    const accuracy = accuracyClaim(evidence.correct, evidence.attempts, PROGRESS_THRESHOLDS.chapterAccuracy);
    return {
      id: ch.id, name: ch.name, grade: ch.grade, strand: mapStrandOf(ch.id) || 'algebra',
      chapterSource: ch.examSource || 'Pri curriculum chapter identity', native: !!ch.native,
      prerequisites: prerequisitesOf(ch.id).map(p => ({ id: p.id, name: IN_CHAPTER_BY_ID[p.id]?.name || p.id, skill: p.skill })),
      evidence: { count: evidence.attempts, independentCorrect: evidence.independentCorrect,
        accuracy: accuracy.enough ? accuracy.value : null, needed: accuracy.needed,
        state: demo ? 'synthetic demonstration' : evidence.attempts === 0 ? 'no observed evidence' :
          accuracy.enough ? 'observed answers, minimum met' : 'insufficient evidence' },
      ...positions.get(ch.id)
    };
  });
  const known = new Set(nodes.map(n => n.id));
  const prerequisites = nodes.flatMap(to => to.prerequisites
    .filter(p => known.has(p.id)).map(p => ({ source: p.id, target: to.id, meaning: p.skill, kind: 'prerequisite', provenance: 'Pri authored prerequisite map (not an official CBSE prerequisite)' })));
  const conceptual = RELATIONS.filter(([a, b]) => known.has(a) && known.has(b))
    .map(([source, target, meaning]) => ({ source, target, meaning, kind: 'conceptual',
      provenance: 'Pri Atlas prototype editorial association' }));
  // A learning-evidence edge is NOT a correlation-derived "prerequisite".
  // The caller must supply actual verified, same-account paired records.
  // Demo fixtures are stamped and never promoted to observed learning.
  const evidence = evidenceLinks.filter(e => known.has(e.source) && known.has(e.target) && e.source !== e.target && e.verified === true)
    .map(e => ({ source: e.source, target: e.target,
      kind: 'evidence', meaning: 'Verified paired-work record ' + String(e.recordId || 'without display ID'),
      provenance: demo ? 'SYNTHETIC DEMONSTRATION, not learner progress' : 'Caller-supplied verified paired-work event',
      simulated: !!demo }));
  return { nodes, layers: { prerequisite: prerequisites, conceptual, evidence },
    height: placed.height, width: placed.width, demo, selectionDefault: known.has('c10-pair-linear-equations') ? 'c10-pair-linear-equations' : nodes[0]?.id || null };
}

export const demoEvidenceLinks = Object.freeze([
  { source: 'c9-coordinate-geometry', target: 'c10-pair-linear-equations', recordId: 'DEMO-001', verified: true },
  { source: 'c9-algebraic-identities', target: 'c10-quadratic-equations', recordId: 'DEMO-002', verified: true }
]);

export const syntheticAtlas = () => buildAtlasGraph({ demo: true, evidenceLinks: demoEvidenceLinks });
