import React from 'react';
import RationalNumbersTopperSection from './RationalNumbersTopperSection.jsx';
import { NCERT_CLASS8_RATIONAL_EXERCISE_ANSWER_AUDIT } from '../engine/ncert/class8-rational-production.js';

const styles = {
  shell: {
    margin: '0 0 14px',
    padding: '16px 18px',
    border: '1px solid var(--border)',
    borderRadius: 18,
    background: 'var(--surface)'
  },
  eyebrow: {
    margin: 0,
    color: 'var(--accent)',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '.08em',
    textTransform: 'uppercase'
  },
  title: { margin: '5px 0 4px', fontSize: 18, lineHeight: 1.25 },
  intro: { margin: 0, color: 'var(--muted)', fontSize: 13, lineHeight: 1.55 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
    gap: 8,
    marginTop: 13
  },
  answer: {
    padding: '10px 12px',
    borderRadius: 12,
    background: 'var(--surface-2)',
    border: '1px solid var(--border)'
  },
  source: { display: 'block', color: 'var(--muted)', fontSize: 10, fontWeight: 800, marginBottom: 3 },
  value: { display: 'block', fontSize: 13, fontWeight: 800, lineHeight: 1.35 },
  note: {
    marginTop: 11,
    padding: '10px 12px',
    borderRadius: 12,
    background: 'var(--accent-faint)',
    border: '1px solid color-mix(in srgb,var(--accent) 20%,var(--border))',
    fontSize: 12,
    lineHeight: 1.55
  }
};

/**
 * Production wrapper for the complete NCERT chapter layer.
 *
 * The attached answer-key crop labels the final visible answer as item 2, while
 * the uploaded NCERT source contains an additional numbered Q2 (associativity)
 * before the fill-in that is Q3 in the source. We show that distinction instead
 * of silently renumbering either source.
 */
export default function RationalNumbersTopperSectionProduction() {
  const audit = NCERT_CLASS8_RATIONAL_EXERCISE_ANSWER_AUDIT;

  return (
    <>
      <section style={styles.shell} aria-labelledby="ncert-exercise-key-title">
        <p style={styles.eyebrow}>Verified against attached answer key</p>
        <h2 id="ncert-exercise-key-title" style={styles.title}>Exercise 1.1 · answer verification</h2>
        <p style={styles.intro}>
          Pri Learning keeps the uploaded NCERT exercise as the source of truth and records exactly what the attached answer-key crop confirms.
        </p>
        <div style={styles.grid}>
          {audit.attachedKeyConfirmed.map(item => (
            <div key={`${item.source}-${item.answer}`} style={styles.answer}>
              <span style={styles.source}>{item.source}{item.attachedLabel ? ` · key labels this ${item.attachedLabel}` : ''}</span>
              <strong style={styles.value}>✓ {item.answer}</strong>
            </div>
          ))}
        </div>
        <div style={styles.note}>
          <strong>{audit.sourceOnly.source}: {audit.sourceOnly.answer}.</strong>{' '}
          {audit.sourceOnly.reason} {audit.sourceOnly.note}
        </div>
      </section>
      <RationalNumbersTopperSection />
    </>
  );
}
