// Handwriting readiness evidence collector.
// Real-world evidence is intentionally separate from synthetic benchmarks.

export function collectHandwritingEvidence(metrics = {}) {
  const gates = [
    ['synthetic_benchmark', metrics.syntheticBenchmark],
    ['real_writer_validation', metrics.realWriterValidation],
    ['teacher_agreement', metrics.teacherAgreement]
  ];

  return {
    id: 'ai.handwriting_reality',
    category: 'handwriting_reality',
    evidence: gates.map(([name, value]) => ({
      id: name,
      passed: Boolean(value),
      status: value ? 'measured' : 'missing'
    }))
  };
}
