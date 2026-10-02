import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MathText } from '../lib/latex.jsx';
import { useT } from '../i18n/index.js';
import { class10LibraryPracticeHref, practiceDifficulties } from '../lib/practiceLinks.js';
import { NCERT_CLASS10_CONTENT, NCERT_CLASS10_RELEASE_AUDIT } from '../engine/ncert/class10-content.js';

// Tab ids with the catalogue keys for their labels (Topper Notes, Worked Examples, Exercises, Source Coverage).
const TABS = [['notes','ncert.c10TabTopperNotes'],['examples','ncert.c10TabWorkedExamples'],['exercises','ncert.c10TabExercises'],['coverage','ncert.c10TabSourceCoverage']];
const DIFF = {1:'difficulty.1',2:'difficulty.2',3:'difficulty.3',4:'ncert.diffTopper'};

export default function Class10NCERTLibrary(){
  const t=useT();
  const nav=useNavigate();
  const [chapterId,setChapterId]=useState(NCERT_CLASS10_CONTENT[0].id);
  const [tab,setTab]=useState('notes');
  const chapter=useMemo(()=>NCERT_CLASS10_CONTENT.find(x=>x.id===chapterId)||NCERT_CLASS10_CONTENT[0],[chapterId]);
  // Practice is requested by the curriculum chapter, which is what India
  // practice resolves (its covers include this chapter's question bank); the
  // generator id alone left 8 of 14 chapters answering INDIA_TOPIC_NOT_FOUND.
  const practice=(d)=>nav(class10LibraryPracticeHref(chapter,d));
  return <section className="card" aria-labelledby="ncert10-title" style={{marginBottom:24,padding:20}}>
    <div className="spread" style={{gap:16,alignItems:'flex-start'}}>
      <div>
        <div className="sc-label">{t('ncert.c10Eyebrow')}</div>
        <h2 id="ncert10-title" style={{margin:'4px 0'}}>{t('ncert.c10Title')}</h2>
        <p className="muted" style={{margin:0,maxWidth:760}}>{t('ncert.c10Intro')}</p>
      </div>
      <span className="tag tag-brand">{t('ncert.c10ChapterCount',{n:NCERT_CLASS10_RELEASE_AUDIT.chapterCount})}</span>
    </div>

    <div className="gen-opts" style={{marginTop:18}} aria-label={t('ncert.c10ChaptersAria')}>
      {NCERT_CLASS10_CONTENT.map(ch=><button key={ch.id} className={`gen-opt ${ch.id===chapter.id?'on':''}`} onClick={()=>setChapterId(ch.id)}>{ch.num}. {ch.title}</button>)}
    </div>

    <div className="card" style={{marginTop:16,padding:16}}>
      <div className="spread" style={{gap:12,alignItems:'flex-start'}}>
        <div><div className="sc-label">{t('ncert.c10ChapterNum',{n:chapter.num})}</div><h3 style={{margin:'3px 0'}}>{chapter.title}</h3><div className="muted">{t('ncert.c10ChapterMeta',{count:chapter.exercises.length,n:chapter.exercises.length,file:chapter.sourceFile,pages:chapter.pages})}</div></div>
        <div className="row" style={{flexWrap:'wrap',justifyContent:'flex-end'}}>
          {practiceDifficulties({track:'cbse'}).map(d=><button key={d} className="btn btn-primary btn-sm" onClick={()=>practice(d)}>{`D${d} ${t(DIFF[d])}`}</button>)}
        </div>
      </div>

      <div className="row" role="tablist" aria-label={t('ncert.c10ResourcesAria')} style={{marginTop:16,flexWrap:'wrap'}}>
        {TABS.map(([k,labelKey])=><button key={k} role="tab" aria-selected={tab===k} className={`btn btn-sm ${tab===k?'btn-primary':'btn-quiet'}`} onClick={()=>setTab(k)}>{t(labelKey)}</button>)}
      </div>

      {tab==='notes'&&<div className="grid cols-2" style={{marginTop:16}}>{chapter.notes.map((n,i)=><article className="card" key={i} style={{padding:16}}><div className="tag tag-brand">{t('ncert.c10TopperTag')}</div><h3>{n.title}</h3>{n.points.map((p,j)=><p key={j} style={{margin:'6px 0'}}><MathText text={p}/></p>)}<div className="muted" style={{marginTop:10}}><b>{t('ncert.c10Core')}</b> <MathText text={`$${n.formula}$`}/></div><div style={{marginTop:8}}><b>{t('ncert.c10Trap')}</b> {n.trap}</div></article>)}</div>}

      {tab==='examples'&&<div style={{marginTop:16}}>{chapter.examples.map((ex,i)=><article className="card" key={i} style={{padding:16,marginBottom:12}}><h3>{i+1}. {ex.title}</h3><p><MathText text={ex.prompt}/></p><ol>{ex.steps.map((s,j)=><li key={j} style={{margin:'7px 0'}}><MathText text={s}/></li>)}</ol><div><b>{t('ncert.answerLabel')}</b> <MathText text={ex.answer}/></div><div className="muted" style={{marginTop:8}}><b>{t('ncert.topperInsight')}</b> {ex.topper}</div></article>)}</div>}

      {tab==='exercises'&&<div style={{marginTop:16}}><p className="muted">{t('ncert.c10AppendixNote')}</p>{chapter.exercises.map(ex=><div className="card spread" key={ex.exercise} style={{padding:14,marginBottom:8,gap:12}}><div><b>{t('ncert.exercise',{n:ex.exercise})}</b><div className="muted">{t('ncert.c10SourceQuestions',{count:ex.sourceQuestionCount,n:ex.sourceQuestionCount})} · {ex.appendix==='present'?t('ncert.c10AppendixPresent'):t('ncert.c10AppendixAbsent')}</div><div style={{fontSize:13,marginTop:4}}>{ex.note}</div></div><span className={`tag ${ex.status==='verified'?'tag-brand':''}`}>{t('ncert.c10Verified')}</span></div>)}</div>}

      {tab==='coverage'&&<div style={{marginTop:16}}>{chapter.sourceMap.map((row,i)=><div className="card" key={i} style={{padding:14,marginBottom:8}}><div className="spread"><b>{row.section}</b><span className={`tag ${row.currentExam?'tag-brand':''}`}>{row.currentExam?t('ncert.c10CurrentExam'):t('ncert.c10SourceOnly')}</span></div><p style={{margin:'7px 0 0'}}>{row.coverage}</p></div>)}<div className="muted" style={{marginTop:10}}>{t('ncert.c10CoverageNote')}</div></div>}
    </div>
  </section>;
}
