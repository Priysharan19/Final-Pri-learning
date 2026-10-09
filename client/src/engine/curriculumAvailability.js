// Pri Learning · student-facing practice availability contract
//
// Curriculum truth and generator availability are different facts. A current
// syllabus outcome can be real while Pri Learning has not authored a safe
// production form for it yet. Product selectors use these helpers to keep that
// gap visible without sending a student into an impossible practice request.

export function dotpointAvailable(dotpoint) {
  if (!dotpoint) return false;
  // Legacy non-decorated strings are treated as available only outside the
  // production /curriculum response. The response used by Home always supplies
  // an explicit generated boolean.
  if (typeof dotpoint === 'string') return true;
  return dotpoint.generated !== false;
}

export function topicAvailability(topic) {
  const dotpoints = Array.isArray(topic?.dotpoints) ? topic.dotpoints : [];
  const available = dotpoints.filter(dotpointAvailable).length;
  return Object.freeze({
    total: dotpoints.length,
    available,
    missing: Math.max(0, dotpoints.length - available),
    selectable: available > 0,
    complete: dotpoints.length > 0 && available === dotpoints.length
  });
}

export function practiceTargetAvailable(topic, dotpointOrdinal = null) {
  const topicState = topicAvailability(topic);
  if (!topicState.selectable) return false;
  if (dotpointOrdinal === null || dotpointOrdinal === undefined || dotpointOrdinal === '') return true;
  const index = Number(dotpointOrdinal);
  if (!Number.isInteger(index) || index < 0) return false;
  return dotpointAvailable(topic?.dotpoints?.[index]);
}

/**
 * The difficulty buttons a selector may show for a chapter or dot point: the
 * levels the track allows, narrowed to those the curriculum response says a
 * question really exists at for that selection (`requestable`). A selection
 * that carries no such list — nothing chosen yet, or a curriculum that does not
 * publish one — keeps the track's levels, and the practice reply then states
 * any difference between the level asked for and the level served.
 */
export function selectableDifficulties(trackLevels, selection) {
  const levels = Array.isArray(trackLevels) ? trackLevels : [];
  const real = selection && typeof selection === 'object' && Array.isArray(selection.requestable) ? selection.requestable : null;
  return real ? levels.filter(d => real.includes(d)) : [...levels];
}
