// Cross-class Notes search loads only the published, validated grade chunks.
// A rejected request may be retried by the student; this is not a substitute
// for loading from a different class or silently showing incomplete results.
export async function loadAllSearchNotes(grades, load) {
  if (!Array.isArray(grades) || !grades.length || typeof load !== 'function') {
    throw new Error('Notes search cannot be loaded.');
  }
  const rows = await Promise.all(grades.map(async grade => {
    const notes = await load(grade);
    if (!notes || typeof notes !== 'object' || Array.isArray(notes)) {
      throw new Error('Notes search data is unavailable.');
    }
    return [grade, notes];
  }));
  return Object.fromEntries(rows);
}
