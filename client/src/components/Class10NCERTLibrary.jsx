import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MathText } from '../lib/latex.jsx';
import { NCERT_CLASS10_CONTENT, NCERT_CLASS10_RELEASE_AUDIT } from '../engine/ncert/class10-content.js';

const TABS = ['Topper Notes','Worked Examples','Exercises','Source Coverage'];
const DIFF = {1:'Foundation',2:'Intermediate',3:'Advanced',4:'Topper'};

export default function Class10NCERTLibrary(){
  const nav=useNavigate();
  const [chapterId,setChapterId]=useState(NCERT_CLASS10_CONTENT[0].id);
  const [tab,setTab]=useState('Topper Notes');
  const chapter=useMemo(()=>NCERT_CLASS10_CONTENT.find(x=>x.id===chapterId)||NCERT_CLASS10_CONTENT[0],[chapterId]);
  const practice=(d)=>nav(`/practice?subtopic=${encodeURIComponent(chapter.questionBank.primary)}&difficulty=${d}`);
  return <section className="card" aria-labelledby="ncert10-title" style={{marginBottom:24,padding:20}}>
    <div className="spread" style={{gap:16,alignItems:'flex-start'}}>
      <div>
        <div className="sc-label">NCERT · Class X · Reprint 2026–27</div>
        <h2 id="ncert10-title" style={{margin:'4px 0'}}>NCERT Mastery Library</h2>
        <p className="muted" style={{margin:0,maxWidth:760}}>All 14 uploaded chapters, source-audited exercises, Topper Notes and worked examples. Practice opens the normal Pri answer experience, so Type, Apple Pencil handwriting, Photo, Pri Reason and offline progress all stay available.</p>
      </div>
      <span className="tag tag-brand">{NCERT_CLASS10_RELEASE_AUDIT.chapterCount}/14 chapters · offline</span>
    </div>

    <div className="gen-opts" style={{marginTop:18}} aria-label="NCERT Class 10 chapters">
      {NCERT_CLASS10_CONTENT.map(ch=><button key={ch.id} className={`gen-opt ${ch.id===chapter.id?'on':''}`} onClick={()=>setChapterId(ch.id)}>{ch.num}. {ch.title}</button>)}
    </div>

    <div className="card" style={{marginTop:16,padding:16}}>
      <div className="spread" style={{gap:12,alignItems:'flex-start'}}>
        <div><div className="sc-label">Chapter {chapter.num}</div><h3 style={{margin:'3px 0'}}>{chapter.title}</h3><div className="muted">{chapter.sourceFile} · {chapter.pages} source pages · {chapter.exercises.length} exercise set{chapter.exercises.length===1?'':'s'}</div></div>
        <div className="row" style={{flexWrap:'wrap',justifyContent:'flex-end'}}>
          {[1,2,3,4].map(d=><button key={d} className="btn btn-primary btn-sm" onClick={()=>practice(d)}>D{d} {DIFF[d]}</button>)}
        </div>
      </div>

      <div className="row" role="tablist" aria-label="NCERT chapter resources" style={{marginTop:16,flexWrap:'wrap'}}>
        {TABS.map(t=><button key={t} role="tab" aria-selected={tab===t} className={`btn btn-sm ${tab===t?'btn-primary':'btn-quiet'}`} onClick={()=>setTab(t)}>{t}</button>)}
      </div>

      {tab==='Topper Notes'&&<div className="grid cols-2" style={{marginTop:16}}>{chapter.notes.map((n,i)=><article className="card" key={i} style={{padding:16}}><div className="tag tag-brand">TOPPER</div><h3>{n.title}</h3>{n.points.map((p,j)=><p key={j} style={{margin:'6px 0'}}><MathText text={p}/></p>)}<div className="muted" style={{marginTop:10}}><b>Core:</b> <MathText text={`$${n.formula}$`}/></div><div style={{marginTop:8}}><b>Trap:</b> {n.trap}</div></article>)}</div>}

      {tab==='Worked Examples'&&<div style={{marginTop:16}}>{chapter.examples.map((ex,i)=><article className="card" key={i} style={{padding:16,marginBottom:12}}><h3>{i+1}. {ex.title}</h3><p><MathText text={ex.prompt}/></p><ol>{ex.steps.map((s,j)=><li key={j} style={{margin:'7px 0'}}><MathText text={s}/></li>)}</ol><div><b>Answer:</b> <MathText text={ex.answer}/></div><div className="muted" style={{marginTop:8}}><b>Topper insight:</b> {ex.topper}</div></article>)}</div>}

      {tab==='Exercises'&&<div style={{marginTop:16}}><p className="muted">The supplied Answers/Hints appendix is treated as the authority wherever it provides an entry. Proof/construction prompts without an explicit appendix answer are verified from the chapter theorem/method and are labelled rather than invented.</p>{chapter.exercises.map(ex=><div className="card spread" key={ex.exercise} style={{padding:14,marginBottom:8,gap:12}}><div><b>Exercise {ex.exercise}</b><div className="muted">{ex.sourceQuestionCount} top-level source question{ex.sourceQuestionCount===1?'':'s'} · {ex.appendix==='present'?'Answers/Hints block present':'no dedicated appendix block'}</div><div style={{fontSize:13,marginTop:4}}>{ex.note}</div></div><span className={`tag ${ex.status==='verified'?'tag-brand':''}`}>verified</span></div>)}</div>}

      {tab==='Source Coverage'&&<div style={{marginTop:16}}>{chapter.sourceMap.map((row,i)=><div className="card" key={i} style={{padding:14,marginBottom:8}}><div className="spread"><b>{row.section}</b><span className={`tag ${row.currentExam?'tag-brand':''}`}>{row.currentExam?'current exam + book':'full-book source only'}</span></div><p style={{margin:'7px 0 0'}}>{row.coverage}</p></div>)}<div className="muted" style={{marginTop:10}}>Full-book coverage is intentionally broader than the current CBSE exam contract. Source-only material remains teachable without being falsely promoted as current examinable coverage.</div></div>}
    </div>
  </section>;
}
