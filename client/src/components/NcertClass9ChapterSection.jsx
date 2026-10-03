import React, { useMemo, useState } from 'react';
import { MathText } from '../lib/latex.jsx';
import { useT, useTx } from '../i18n/index.js';
import { ncertClass9Chapter, NCERT_CLASS9_RELEASE_AUDIT } from '../engine/ncert/class9-chapters-production.js';

// Tab ids with the catalogue keys for their labels.
const TABS = Object.freeze({notes:'ncert.topperNotes',examples:'ncert.workedExamples',exercises:'ncert.ncertExercises',coverage:'ncert.sourceCoverage'});
const Text = ({children}) => <MathText text={String(children ?? '')} />;

function Verification({chapter}) {
  const t = useT();
  const tx = useTx();
  const verified = chapter.answerAudit.reduce((n,x)=>n+x.verifiedQuestionCount,0);
  const total = chapter.answerAudit.reduce((n,x)=>n+x.sourceQuestionCount,0);
  return <div className="card" style={{padding:16,marginBottom:14}}>
    <div className="spread" style={{gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div>
        <div className="sc-label">{t('ncert.c9Eyebrow')}</div>
        <h3 style={{margin:'5px 0 3px'}}>{t('ncert.chapterTitle',{n:chapter.num,title:chapter.title})}</h3>
        <div className="muted">{t('ncert.c9AuditLine',{pages:chapter.pages,sections:chapter.exercises.length,verified,total})}</div>
      </div>
      <span className="tag tag-brand">{t('ncert.c9MasteryCells',{n:chapter.questionBank.authoredCells})}</span>
    </div>
    <div className="grid cols-3" style={{gap:10,marginTop:12}}>
      <div className="stat"><b>{chapter.notes.length}</b><span>{t('ncert.c9NoteModules')}</span></div>
      <div className="stat"><b>{chapter.examples.length}</b><span>{t('ncert.c9FullyWorked')}</span></div>
      <div className="stat"><b>{t('ncert.writeType')}</b><span>{t('ncert.productionAnswerPath')}</span></div>
    </div>
    <div className="muted" style={{marginTop:10}}>{t('ncert.c9InkNote')}</div>
    <div className="muted" style={{marginTop:8}}>{tx('ncert.c9AnswerVerification',{label:<b>{t('ncert.c9AnswerVerificationLabel')}</b>})}</div>
  </div>;
}

// `formula` carries bare maths with no $…$ of its own — `PQ=\sqrt{…}`, `t_n=ar^{n-1}` —
// so it is wrapped here, the way Class10NCERTLibrary wraps the identically shaped Class 10
// field. Unwrapped, MathText finds no math span and prints the backslashes. The Class 8
// section deliberately does NOT wrap: its formulas are English sentences with Unicode
// symbols ("Sector angle = … × 360°"), which maths mode would turn into italic letters.
function Notes({chapter}) { const t = useT(); return <div className="grid cols-2" style={{gap:12}}>{chapter.notes.map((n,i)=><article className="card" key={i} style={{padding:16}}>
  <div className="sc-label">{n.level}</div><h3 style={{margin:'5px 0 10px'}}>{n.title}</h3>
  <ul style={{margin:0,paddingLeft:20}}>{n.points.map((p,j)=><li key={j} style={{marginBottom:7}}><Text>{p}</Text></li>)}</ul>
  <div style={{marginTop:10,padding:10,borderRadius:10,background:'var(--surface-2)'}}><b>{t('ncert.coreRelation')}</b><div style={{marginTop:4}}><MathText text={`$${n.formula}$`}/></div></div>
  <div style={{marginTop:10}}><b>{t('ncert.topperEdgeLabel')}</b> <Text>{n.edge}</Text></div>
</article>)}</div>; }

function Examples({chapter}) { const t = useT(); return <div className="grid cols-2" style={{gap:12}}>{chapter.examples.map((e,i)=><article className="card" key={i} style={{padding:16}}>
  <div className="sc-label">{t('ncert.fullyWorkedPriLevel')}</div><h3 style={{margin:'5px 0 8px'}}>{e.title}</h3>
  <div style={{padding:10,borderRadius:10,background:'var(--surface-2)',marginBottom:10}}><Text>{e.prompt}</Text></div>
  <ol style={{margin:0,paddingLeft:22}}>{e.steps.map((s,j)=><li key={j} style={{marginBottom:7}}><Text>{s}</Text></li>)}</ol>
  <div style={{marginTop:10}}><b>{t('ncert.answerLabel')}</b> <Text>{e.answer}</Text></div><div className="muted" style={{marginTop:7}}><b>{t('ncert.topperInsight')}</b> <Text>{e.topper}</Text></div>
</article>)}</div>; }

function Exercises({chapter}) { const t = useT(); return <div style={{display:'grid',gap:12}}>
  {chapter.answerAudit.map(x=><details className="card" key={x.exercise} style={{padding:14}}>
    <summary style={{cursor:'pointer',fontWeight:700}}>{t('ncert.c9ExerciseSummary',{n:x.exercise,verified:x.verifiedQuestionCount,total:x.sourceQuestionCount})}</summary>
    <div style={{marginTop:12}}><div className="sc-label">{t('ncert.c9SourceAnswerAudit')}</div><div style={{marginTop:7}}><Text>{x.verificationBasis}</Text></div>
    <div style={{marginTop:10}}><b>{t('ncert.priSolutionMethod')}</b> <Text>{chapter.exerciseMethods[x.exercise]}</Text></div><div className="muted" style={{marginTop:8}}><Text>{x.note}</Text></div></div>
  </details>)}
  <div className="card" style={{padding:14}}><b>{t('ncert.c9QuestionModeTitle')}</b><div className="muted" style={{marginTop:5}}>{t('ncert.c9QuestionModeBody')}</div></div>
</div>; }

function Coverage({chapter}) { const t = useT(); return <div style={{display:'grid',gap:12}}>
  <div className="card" style={{padding:16}}><div className="spread" style={{gap:12,flexWrap:'wrap'}}><div><div className="sc-label">{t('ncert.productionContract')}</div><h3 style={{margin:'5px 0'}}>{t('ncert.c9ContractTitle')}</h3></div><span className="tag tag-brand">{t('ncert.c9Cells',{n:chapter.questionBank.authoredCells})}</span></div><ol style={{marginBottom:0}}>{chapter.dotpoints.map((d,i)=><li key={i} style={{marginBottom:7}}><Text>{d}</Text></li>)}</ol></div>
  {chapter.sourceMap.map((r,i)=><div className="card" key={i} style={{padding:14}}><div className="spread" style={{gap:10,flexWrap:'wrap'}}><b>{r.section}</b><span className="tag">{t('ncert.pdfPages',{pages:r.pages})}</span></div><div className="muted" style={{marginTop:7}}><Text>{r.coverage}</Text></div></div>)}
  <div className="card" style={{padding:14}}><b>{t('ncert.c9ReleaseTitle')}</b><div className="muted" style={{marginTop:6}}>{t('ncert.c9ReleaseLine',{chapters:NCERT_CLASS9_RELEASE_AUDIT.chapterCount,pages:NCERT_CLASS9_RELEASE_AUDIT.sourcePages,sections:NCERT_CLASS9_RELEASE_AUDIT.exerciseSections,prompts:NCERT_CLASS9_RELEASE_AUDIT.sourceExerciseQuestions,cells:NCERT_CLASS9_RELEASE_AUDIT.authoredCells})}</div></div>
</div>; }

export default function NcertClass9ChapterSection({chapterId}) {
  const t = useT();
  const chapter = useMemo(()=>ncertClass9Chapter(chapterId),[chapterId]);
  const [tab,setTab] = useState('notes');
  if(!chapter) return null;
  return <section style={{margin:'0 auto 18px',maxWidth:1180,padding:'14px 18px 0'}}>
    <Verification chapter={chapter}/>
    <div className="card" style={{padding:10,marginBottom:12,display:'flex',gap:8,flexWrap:'wrap'}}>{Object.entries(TABS).map(([k,label])=><button type="button" key={k} className={tab===k?'btn btn-primary':'btn'} onClick={()=>setTab(k)}>{t(label)}</button>)}</div>
    {tab==='notes'&&<Notes chapter={chapter}/>} {tab==='examples'&&<Examples chapter={chapter}/>} {tab==='exercises'&&<Exercises chapter={chapter}/>} {tab==='coverage'&&<Coverage chapter={chapter}/>} 
  </section>;
}
