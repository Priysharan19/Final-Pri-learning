// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · dropping a file onto the answer card
//
// useFileDrop gives a container the props that make it a drop target for ONE
// file, and (while enabled) stops a file dropped anywhere else on the page from
// navigating the tab away to open it. It looks only at drags that carry files:
// dragged text, links and in-page drags are ignored. The keyboard and
// screen-reader path (a "Choose" button) is separate and unchanged.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';

export function dragHasFiles(event) {
  const types = event?.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes('Files');
}

/**
 * The files of a drop, as { file, extra } — the first file and how many more
 * were dropped with it. Directories and non-files are skipped.
 */
export function filesOfDrop(event) {
  const dt = event?.dataTransfer;
  const items = dt?.items ? Array.from(dt.items).filter(i => i.kind === 'file') : [];
  const files = items.length ? items.map(i => i.getAsFile()).filter(Boolean) : Array.from(dt?.files || []);
  return { file: files[0] || null, extra: Math.max(0, files.length - 1) };
}

export default function useFileDrop({ enabled, onFile }) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const handler = useRef(onFile);
  handler.current = onFile;

  // A file dropped outside the target must not navigate away from the work.
  useEffect(() => {
    if (!enabled) { depth.current = 0; setDragging(false); return undefined; }
    const stop = e => { if (dragHasFiles(e)) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'; } };
    const end = () => { depth.current = 0; setDragging(false); };
    window.addEventListener('dragover', stop);
    window.addEventListener('drop', stop);
    window.addEventListener('dragend', end);
    return () => { window.removeEventListener('dragover', stop); window.removeEventListener('drop', stop); window.removeEventListener('dragend', end); };
  }, [enabled]);

  const onDragEnter = useCallback(e => {
    if (!enabled || !dragHasFiles(e)) return;
    e.preventDefault();
    depth.current += 1;
    setDragging(true);
  }, [enabled]);
  const onDragOver = useCallback(e => {
    if (!enabled || !dragHasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }, [enabled]);
  const onDragLeave = useCallback(e => {
    if (!enabled || !dragHasFiles(e)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  }, [enabled]);
  const onDrop = useCallback(e => {
    if (!enabled || !dragHasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    depth.current = 0;
    setDragging(false);
    const { file, extra } = filesOfDrop(e);
    if (file) handler.current?.(file, { extra });
  }, [enabled]);

  return { dragging: enabled && dragging, bind: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}
