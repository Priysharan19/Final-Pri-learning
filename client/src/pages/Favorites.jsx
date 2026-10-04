// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Favourites (Section 7.5)
//
// Every question a student saved, in folders of their own, with two things to
// do with a folder: practise it (each question again, in order, by the same
// retry path History uses) and print it as a worksheet. The bookmarks are the
// profile's learning records; the folders are an arrangement kept on this
// device (favoriteFolders.js) and the page says so.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { MathText } from '../lib/latex.jsx';
import { printPage } from '../lib/files.js';
import { formatDate } from '../lib/locale.js';
import { useT } from '../i18n/index.js';
import TermGloss from '../components/TermGloss.jsx';
import Icon from '../components/Icon.jsx';
import PageState from '../components/PageState.jsx';
import {
  createFolder, deleteFolder, folderOf, moveToFolder, pruneFolders, readFolders, renameFolder, writeFolders, writeQueue, MAX_NAME
} from './favoriteFolders.js';
import './Favorites.css';

const ALL = '__all';
const UNSORTED = '__unsorted';

export default function Favorites() {
  const { user, toast } = useApp();
  const t = useT();
  const nav = useNavigate();
  const [data, setData] = useState(null);          // { items } | null while loading
  const [failed, setFailed] = useState(false);
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  const [folders, setFolders] = useState(() => readFolders(user?.id));
  const [current, setCurrent] = useState(ALL);
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(null);   // { id, name }
  const [worksheet, setWorksheet] = useState(null); // { name, items } while printing

  const load = useCallback(() => {
    setFailed(false);
    api.post('/history/list', { filter: 'bookmarked', pageSize: 200 })
      .then(r => setData({ items: r.items || [] }))
      .catch(() => { setFailed(true); setData({ items: [] }); });
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Folders follow the saved set: a question un-saved elsewhere leaves its folder.
  useEffect(() => {
    if (!data) return;
    const pruned = pruneFolders(folders, data.items.map(i => i.id));
    if (JSON.stringify(pruned) !== JSON.stringify(folders)) commit(pruned);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (next) => {
    setFolders(next);
    if (!writeFolders(user?.id, next)) toast(<span>{t('favorites.folderNotSaved')}</span>);
  };

  const items = data?.items || [];
  const shown = useMemo(() => {
    if (current === ALL) return items;
    if (current === UNSORTED) return items.filter(i => !folderOf(folders, i.id));
    const f = folders.find(x => x.id === current);
    return f ? items.filter(i => f.ids.includes(i.id)) : items;
  }, [items, folders, current]);
  const currentFolder = folders.find(f => f.id === current) || null;
  const currentName = currentFolder ? currentFolder.name : t(current === UNSORTED ? 'favorites.unsorted' : 'favorites.allSaved');

  const unstar = async (id) => {
    try { await api.post(`/history/${id}/bookmark`, {}); load(); }
    catch (e) { toast(<span>{e.message}</span>); }
  };
  const retry = async (id, variant) => {
    try {
      const r = await api.post(`/history/${id}/retry`, { variant });
      nav('/practice', { state: { serve: { question: r.question, reason: 'retry', why: t(variant === 'same' ? 'history.whySame' : 'history.whyFresh') } } });
    } catch (e) { toast(<span>{e.message}</span>); }
  };

  // Practise this folder: the first question is handed to Practice now; the
  // rest wait in the tab's queue and Practice serves them on Next, in order.
  const practiseFolder = async () => {
    const ids = shown.filter(i => i.canRetry).map(i => i.id);
    if (!ids.length) return;
    try {
      const r = await api.post(`/history/${ids[0]}/retry`, { variant: 'same' });
      writeQueue({ ids: ids.slice(1), name: currentName, total: ids.length });
      nav('/practice', { state: { serve: { question: r.question, reason: 'retry', why: t('favorites.whyFolder', { name: currentName }) }, folderQueue: { name: currentName, total: ids.length, remaining: ids.length - 1 } } });
    } catch (e) { toast(<span>{e.message}</span>); }
  };

  // The worksheet: the questions of this view, numbered, with room to work,
  // printed through the platform's own print path (window.print or the
  // native share sheet). Answers are not printed: it is a worksheet.
  const printWorksheet = () => {
    if (!shown.length) return;
    setWorksheet({ name: currentName, items: shown });
    setTimeout(() => { printPage().finally(() => setTimeout(() => setWorksheet(null), 1500)); }, 120);
  };

  const addFolder = () => {
    const next = createFolder(folders, newName);
    if (next === folders) { toast(<span>{t('favorites.folderNameTaken')}</span>); return; }
    commit(next); setNewName(''); setNaming(false); setCurrent(next[next.length - 1].id);
  };

  if (!data) return <PageState kind="loading" height={300} label={t('favorites.loading')} />;

  return (
    <div className="fav">
      <div className="spread fav-head">
        <div>
          <h1>{t('favorites.title')}</h1>
          <p className="sub" style={{ marginTop: 3 }}>{t('favorites.sub')}</p>
        </div>
        <span className="chip">{t('favorites.saved', { count: items.length, n: items.length })}</span>
      </div>

      {offline && <PageState kind="offline" title={t('favorites.offlineTitle')} body={t('favorites.offlineBody')} />}
      {failed && <PageState kind="error" title={t('favorites.loadFailed')} action={{ label: t('common.tryAgain'), onClick: load }} />}

      {!failed && items.length === 0 && (
        <PageState kind="empty" title={t('favorites.emptyTitle')} body={t('favorites.emptySub')}
          action={{ label: t('favorites.openHistory'), onClick: () => nav('/review') }} />
      )}

      {items.length > 0 && (
        <>
          {/* Folders: a row of tabs, the whole set first, then each folder, then what is in none. */}
          <div className="fav-folders" role="tablist" aria-label={t('favorites.folders')}>
            {[{ id: ALL, name: t('favorites.allSaved'), n: items.length },
              ...folders.map(f => ({ id: f.id, name: f.name, n: f.ids.length })),
              { id: UNSORTED, name: t('favorites.unsorted'), n: items.filter(i => !folderOf(folders, i.id)).length }
            ].map(f => (
              <button key={f.id} type="button" role="tab" className={`seg-tab fav-folder${current === f.id ? ' on' : ''}`}
                aria-selected={current === f.id} data-folder={f.id} onClick={() => setCurrent(f.id)}>
                {f.name}<span className="fav-folder-n">{f.n}</span>
              </button>
            ))}
            {!naming
              ? <button type="button" className="btn btn-quiet btn-sm" data-fav-new-folder onClick={() => setNaming(true)}>{t('favorites.newFolder')}</button>
              : (
                <form className="fav-new" onSubmit={e => { e.preventDefault(); addFolder(); }}>
                  <input className="input" value={newName} maxLength={MAX_NAME} autoFocus aria-label={t('favorites.folderName')}
                    placeholder={t('favorites.folderPlaceholder')} onChange={e => setNewName(e.target.value)} />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={!newName.trim()}>{t('favorites.create')}</button>
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => { setNaming(false); setNewName(''); }}>{t('common.cancel')}</button>
                </form>
              )}
          </div>
          <p className="muted fav-note">{t('favorites.foldersNote')}</p>

          {/* What you can do with this view: practise it, print it, rename or remove the folder. */}
          <div className="fav-actions" role="group" aria-label={currentName}>
            <h2 className="fav-current">{currentName}</h2>
            <button type="button" className="btn btn-ghost btn-sm" data-fav-practise disabled={!shown.some(i => i.canRetry)} onClick={practiseFolder}>
              <Icon name="practice" size={15} />{t('favorites.practiseThis', { count: shown.filter(i => i.canRetry).length, n: shown.filter(i => i.canRetry).length })}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" data-fav-print disabled={!shown.length} onClick={printWorksheet}>
              <Icon name="notes" size={15} />{t('favorites.printWorksheet')}
            </button>
            {currentFolder && !renaming && (
              <>
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => setRenaming({ id: currentFolder.id, name: currentFolder.name })}>{t('favorites.rename')}</button>
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => { commit(deleteFolder(folders, currentFolder.id)); setCurrent(ALL); }}>{t('favorites.removeFolder')}</button>
              </>
            )}
            {renaming && (
              <form className="fav-new" onSubmit={e => { e.preventDefault(); commit(renameFolder(folders, renaming.id, renaming.name)); setRenaming(null); }}>
                <input className="input" value={renaming.name} maxLength={MAX_NAME} autoFocus aria-label={t('favorites.folderName')}
                  onChange={e => setRenaming(r => ({ ...r, name: e.target.value }))} />
                <button type="submit" className="btn btn-primary btn-sm" disabled={!renaming.name.trim()}>{t('common.save')}</button>
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => setRenaming(null)}>{t('common.cancel')}</button>
              </form>
            )}
          </div>

          {shown.length === 0 && (
            <PageState kind="empty" title={t('favorites.folderEmpty')} body={t('favorites.folderEmptyBody')} />
          )}

          <div className="card card-flush fav-list">
            {shown.map(it => {
              const inFolder = folderOf(folders, it.id);
              return (
                <div className="hist-row fav-row" key={it.id} data-question-id={it.id}>
                  <button className="hist-star on" title={t('favorites.remove')} aria-pressed="true"
                    aria-label={t('favorites.removeOn', { topic: it.subtopicName })} onClick={() => unstar(it.id)}><Icon name="bookmark" size={17} /></button>
                  <div className="hist-main" style={{ cursor: 'default' }}>
                    <div className="hist-top">
                      <span className={`hist-verdict ${it.correct ? 'good' : it.correct === false ? 'bad' : ''}`}>
                        {it.correct ? <Icon name="check" size={15} /> : it.correct === false ? <Icon name="correction" size={15} /> : '·'}
                        <span className="sr-only">{it.correct ? t('app.correct') : it.correct === false ? t('app.incorrect') : t('history.notMarked')}</span>
                      </span>
                      <span className="hist-name" lang="en"><TermGloss text={it.subtopicName} /></span>
                      <span className="tag">{`D${it.difficulty}`}</span>
                      <span className="muted" style={{ marginLeft: 'auto', fontSize: 12, whiteSpace: 'nowrap' }}>{formatDate(it.answeredAt, user)}</span>
                    </div>
                    <div className="hist-prompt"><MathText text={it.prompt} /></div>
                  </div>
                  <div className="hist-actions fav-row-actions">
                    <label className="fav-move">
                      <span className="sr-only">{t('favorites.moveTo')}</span>
                      <select className="input" value={inFolder || ''} aria-label={t('favorites.moveTo')} data-fav-move
                        onChange={e => commit(moveToFolder(folders, it.id, e.target.value || null))}>
                        <option value="">{t('favorites.unsorted')}</option>
                        {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </label>
                    {it.canRetry && <button className="btn btn-ghost btn-sm" onClick={() => retry(it.id, 'same')}>{t('favorites.retrySame')}</button>}
                    {it.canRetry && <button className="btn btn-ghost btn-sm" onClick={() => retry(it.id, 'fresh')}>{t('favorites.retryVariant')}</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* The worksheet, drawn only while printing: a paper page, numbered, with
          ruled space under each question. Hidden on screen by the stylesheet. */}
      {worksheet && (
        <section className="fav-worksheet" aria-label={t('favorites.worksheetAria', { name: worksheet.name })} data-fav-worksheet={worksheet.items.length}>
          <header className="fav-ws-head">
            <h1>{t('favorites.worksheetTitle', { name: worksheet.name })}</h1>
            <p>{t('favorites.worksheetMeta', { name: user.name, count: worksheet.items.length, n: worksheet.items.length })}</p>
          </header>
          <ol className="fav-ws-list">
            {worksheet.items.map((it, i) => (
              <li key={it.id} className="fav-ws-item">
                <div className="fav-ws-q"><span className="fav-ws-n">{i + 1}.</span><MathText text={it.prompt} /></div>
                <div className="fav-ws-meta" lang="en">{`${it.subtopicName} · D${it.difficulty}`}</div>
                <div className="fav-ws-space" aria-hidden="true" />
              </li>
            ))}
          </ol>
          <footer className="fav-ws-foot">{t('favorites.worksheetFoot')}</footer>
        </section>
      )}
    </div>
  );
}
