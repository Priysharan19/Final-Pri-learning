export function validateWriterSplit(records) {
  const writers = new Map();

  for (const record of records) {
    if (!record.writer_id || !record.split) {
      throw new Error('Missing writer_id or split');
    }

    if (!writers.has(record.writer_id)) {
      writers.set(record.writer_id, new Set());
    }

    writers.get(record.writer_id).add(record.split);
  }

  for (const [writer, splits] of writers.entries()) {
    if (splits.size > 1) {
      return {
        valid: false,
        reason: `writer leakage detected: ${writer}`,
      };
    }
  }

  return { valid: true };
}
