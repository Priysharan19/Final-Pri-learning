import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildCorpusStatus, renderCorpusStatus } from './ink-corpus-status.mjs';

const root = mkdtempSync(join(tmpdir(), 'pri-ink-status-'));
try {
  const point = { x: 1, y: 2, t: 0, p: 0.5, w: 2 };
  writeFileSync(join(root, 'train.json'), JSON.stringify({
    format: 'pri-ink-corpus',
    version: 2,
    split: 'train',
    writer: { id: 'P1000', sessionId: 'S-TRAIN' },
    samples: [{ target: 'x=2', strokes: [{ points: [point] }] }],
  }));

  const holdoutPoison = 'HOLDOUT-SECRET-TARGET-SHOULD-NEVER-RENDER';
  writeFileSync(join(root, 'holdout.json'), JSON.stringify({
    format: 'pri-ink-corpus',
    version: 2,
    split: 'final-holdout',
    writer: { id: 'P2000', sessionId: 'S-HOLDOUT' },
    samples: [{
      target: holdoutPoison,
      strokes: [{ points: [{ x: 'poison', y: null }] }],
    }],
  }));

  const report = buildCorpusStatus(root);
  assert.equal(report.releaseLane, 'V17.1');
  assert.equal(report.targets.train.writers, 100);
  assert.equal(report.targets.train.minimumPerWriter, 40);
  assert.equal(report.targets.test.writers, 20);
  assert.equal(report.targets.test.samples, 1000);
  assert.equal(report.rows.train.sessions.size, 1);
  assert.equal(report.rows['final-holdout'].sessions.size, 1);
  assert.equal(report.rows['final-holdout'].writers.size, 1);
  assert.equal(report.rows['final-holdout'].samples, null);
  assert.equal(report.rows['final-holdout'].critical, null);
  assert.equal(report.rows['final-holdout'].samplesByWriter, null);
  assert.equal(report.finalHoldoutContentInspected, false);
  assert.equal(report.pipeline.trainingReady, false);
  assert.equal(report.pipeline.testReady, false);

  const rendered = renderCorpusStatus(report);
  assert.match(rendered, /final-holdout\s+collecting \(opaque\)/);
  assert.match(rendered, /routine status does not read final-holdout samples/);
  assert.doesNotMatch(rendered, new RegExp(holdoutPoison));

  console.log('Pri Ink V17.1 corpus status evidence firewall: PASS');
} finally {
  rmSync(root, { recursive: true, force: true });
}
