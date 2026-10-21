// Trusted, side-effect-free changed-file scope verification. Both the old and
// new names of a rename/copy must be authorized. Never trust a PR's supplied
// path metadata without validating shape and canonical ownership.
const statuses = new Set(['added','modified','removed','renamed','copied','changed']);
export function validRepoPath(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 4096 &&
    !value.startsWith('/') && !value.endsWith('/') && !value.includes('\\') &&
    !/[\x00-\x1f\x7f]/.test(value) && value.split('/').every(s => s && s !== '.' && s !== '..');
}
export function pathMatches(pattern, filename) {
  if (!validRepoPath(pattern) || !validRepoPath(filename)) return false;
  let regex='^';
  for (let i=0; i<pattern.length; i++) {
    const c=pattern[i];
    if (c==='*' && pattern[i+1]==='*') { i++; regex += '.*'; }
    else if (c==='*') regex += '[^/]*';
    else if (c==='?') regex += '[^/]';
    else regex += c.replace(/[\\^$+?.()|{}\[\]]/g,'\\$&');
  }
  return new RegExp(regex+'$').test(filename);
}
export function validatedDiffPaths(files) {
  if (!Array.isArray(files) || !files.length) throw Error('EMPTY_PR_DIFF');
  const seen=new Set(), out=[];
  for (const f of files) {
    if (!f || !statuses.has(f.status) || !validRepoPath(f.filename)) throw Error('MALFORMED_GITHUB_CHANGED_FILE');
    const renamed=f.status==='renamed' || f.status==='copied';
    if (renamed !== (typeof f.previous_filename==='string' && !!f.previous_filename)) throw Error('INVALID_RENAME_METADATA');
    const paths=renamed?[f.previous_filename,f.filename]:[f.filename];
    for (const path of paths) {
      if (!validRepoPath(path)) throw Error('INVALID_CHANGED_PATH');
      if (seen.has(path)) throw Error('DUPLICATE_CHANGED_PATH');
      seen.add(path); out.push(path);
    }
  }
  return out;
}
export function verifyDiffOwnership(files, allowedPatterns, agent, routeOwner) {
  if (!Array.isArray(allowedPatterns) || !allowedPatterns.length ||
    !allowedPatterns.every(validRepoPath) || typeof routeOwner !== 'function' ||
    !agent) throw Error('INVALID_WRITER_SCOPE_CONTRACT');
  const paths=validatedDiffPaths(files);
  for (const path of paths) {
    if (!allowedPatterns.some(p=>pathMatches(p,path))) throw Error('WRITER_SCOPE_ESCAPES_'+path);
    const owner=routeOwner(path);
    if (!owner?.owned || owner.primary!==agent) throw Error('WRITER_FILE_OWNER_MISMATCH_'+path);
  }
  return {checked_paths:paths.length,changed_files:files.length};
}
