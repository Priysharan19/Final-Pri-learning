import React, { useMemo, useState } from 'react';
import { MathText } from '../lib/latex.jsx';
import { ncertClass9Chapter, NCERT_CLASS9_RELEASE_AUDIT } from '../engine/ncert/class9-chapters-production.js';

const TABS = Object.freeze({notes:'Topper notes',examples:'Worked examples',exercises:'NCERT exercises',coverage:'Source coverage'});
const Text = ({children}) => <MathText text={String(children ?? '')} />;

function Verification({chapter}) {
  const verified = chapter.answerAudit.reduce((n,x)=>n+x.verifiedQuestionCount,0);
  const total = chapter.answerAudit.reduce((n,x)=>n+x.sourceQuestionCount,0);
  return <div className="card" style={{padding:16,marginBottom:14}}>
    <div className="spread" style={{gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div>
        <div className="sc-label">GANITA MANJARI 2026–27 · SOURCE AUDITED</div>
        <h3 style={{margin:'5px 0 3px'}}>Chapter {chapter.num} · {chapter.title}</h3>
        <div className="muted">{chapter.pages} uploaded pages audited · {chapter.exercises.length} formal exercise sections · {verified}/{total} formal exercise prompts independently verified.</div>
      </div>
      <span className="tag tag-brand">{chapter.questionBank.authoredCells} Pri mastery cells</span>
    </div>
    <div className="grid cols-3" style={{gap:10,marginTop:12}}>
      <div className="stat"><b>{chapter.notes.length}</b><span>topper note modules</span></div>
      <div className="stat"><b>{chapter.examples.length}</b><span>fully worked examples</span></div>
      <div className="stat"><b>Write · Type</b><span>production answer path</span></div>
    </div>
    <div className="muted" style={{marginTop:10}}>Numeric practice uses Pri Learning’s existing InkAnswer handwriting recognition, confidence handling, marking, retry and Pri Explain pipeline. No chapter-specific weaker recogniser or marker is introduced.</div>
    <div className="muted" style={{marginTop:8}}><b>Answer verification note:</b> the current eight-file Grade 9 upload contained the chapter PDFs but no separate Grade 9 answer-key PDF. Pri Learning therefore independently derives and cross-checks every formal exercise prompt instead of falsely labelling it as an attached-key check.</div>
  </div>;
}

function Notes({chapter}) { return <div className="grid cols-2" style={{gap:12}}>{chapter.notes.map((n,i)=><article className="card" key={i} style={{padding:16}}>
  <div className="sc-label">{n.level}</div><h3 style={{margin:'5px 0 10px'}}>{n.title}</h3>
  <ul style={{margin:0,paddingLeft:20}}>{n.points.map((p,j)=><li key={j} style={{marginBottom:7}}><Text>{p}</Text></li>)}</ul>
  <div style={{marginTop:10,padding:10,borderRadius:10,background:'var(--surface-2)'}}><b>Core relation</b><div style={{marginTop:4}}><Text>{n.formula}</Text></div></div>
  <div style={{marginTop:10}}><b>Topper edge:</b> <Text>{n.edge}</Text></div>
</article>)}</div>; }

function Examples({chapter}) { return <div className="grid cols-2" style={{gap:12}}>{chapter.examples.map((e,i)=><article className="card" key={i} style={{padding:16}}>
  <div className="sc-label">FULLY WORKED · PRI LEVEL</div><h3 style={{margin:'5px 0 8px'}}>{e.title}</h3>
  <div style={{padding:10,borderRadius:10,background:'var(--surface-2)',marginBottom:10}}><Text>{e.prompt}</Text></div>
  <ol style={{margin:0,paddingLeft:22}}>{e.steps.map((s,j)=><li key={j} style={{marginBottom:7}}><Text>{s}</Text></li>)}</ol>
  <div style={{marginTop:10}}><b>Answer:</b> <Text>{e.answer}</Text></div><div className="muted" style={{marginTop:7}}><b>Topper insight:</b> <Text>{e.topper}</Text></div>
</article>)}</div>; }

function Exercises({chapter}) { return <div style={{display:'grid',gap:12}}>
  {chapter.answerAudit.map(x=><details className="card" key={x.exercise} style={{padding:14}}>
    <summary style={{cursor:'pointer',fontWeight:700}}>Exercise {x.exercise} · {x.verifiedQuestionCount}/{x.sourceQuestionCount} prompts verified</summary>
    <div style={{marginTop:12}}><div className="sc-label">SOURCE ANSWER AUDIT</div><div style={{marginTop:7}}><Text>{x.verificationBasis}</Text></div>
    <div style={{marginTop:10}}><b>Pri solution method:</b> <Text>{chapter.exerciseMethods[x.exercise]}</Text></div><div className="muted" style={{marginTop:8}}><Text>{x.note}</Text></div></div>
  </details>)}
  <div className="card" style={{padding:14}}><b>Question-mode worked solutions</b><div className="muted" style={{marginTop:5}}>Every dedicated mastery generator at difficulties 1–4 returns at least three progressive hints and a fully staged worked solution. Numeric forms are handwriting-ready; conceptual classification uses MCQ only where handwriting would add no mathematical value.</div></div>
</div>; }

function Coverage({chapter}) { return <div style={{display:'grid',gap:12}}>
  <div className="card" style={{padding:16}}><div className="spread" style={{gap:12,flexWrap:'wrap'}}><div><div className="sc-label">PRODUCTION CONTRACT</div><h3 style={{margin:'5px 0'}}>3 product outcomes · 4 mastery levels · full page map</h3></div><span className="tag tag-brand">{chapter.questionBank.authoredCells} cells</span></div><ol style={{marginBottom:0}}>{chapter.dotpoints.map((d,i)=><li key={i} style={{marginBottom:7}}><Text>{d}</Text></li>)}</ol></div>
  {chapter.sourceMap.map((r,i)=><div className="card" key={i} style={{padding:14}}><div className="spread" style={{gap:10,flexWrap:'wrap'}}><b>{r.section}</b><span className="tag">PDF pages {r.pages}</span></div><div className="muted" style={{marginTop:7}}><Text>{r.coverage}</Text></div></div>)}
  <div className="card" style={{padding:14}}><b>Complete Grade 9 release audit</b><div className="muted" style={{marginTop:6}}>{NCERT_CLASS9_RELEASE_AUDIT.chapterCount} chapters · {NCERT_CLASS9_RELEASE_AUDIT.sourcePages} source pages · {NCERT_CLASS9_RELEASE_AUDIT.exerciseSections} formal exercise sections · {NCERT_CLASS9_RELEASE_AUDIT.sourceExerciseQuestions} formal exercise prompts · {NCERT_CLASS9_RELEASE_AUDIT.authoredCells} dedicated mastery cells.</div></div>
</div>; }

export default function NcertClass9ChapterSection({chapterId}) {
  const chapter = useMemo(()=>ncertClass9Chapter(chapterId),[chapterId]);
  const [tab,setTab] = useState('notes');
  if(!chapter) return null;
  return <section style={{margin:'0 auto 18px',maxWidth:1180,padding:'14px 18px 0'}}>
    <Verification chapter={chapter}/>
    <div className="card" style={{padding:10,marginBottom:12,display:'flex',gap:8,flexWrap:'wrap'}}>{Object.entries(TABS).map(([k,label])=><button type="button" key={k} className={tab===k?'btn btn-primary':'btn'} onClick={()=>setTab(k)}>{label}</button>)}</div>
    {tab==='notes'&&<Notes chapter={chapter}/>} {tab==='examples'&&<Examples chapter={chapter}/>} {tab==='exercises'&&<Exercises chapter={chapter}/>} {tab==='coverage'&&<Coverage chapter={chapter}/>} 
  </section>;
}
