# Pri Learning · reviewed JEE PYQ assets

This directory is the **publish output** of `tools/jee-question-department/pack.py`.

The committed `catalog.js` is intentionally empty until reviewed source records pass the strict publish audit. No extracted question is student-facing merely because a PDF parser found it.

When approved records are packed, this directory receives gzip/base64 shards as tiny ES modules (`<part>-NN.js`, `export default "<base64>"`) plus a generated `catalog.js` containing only:

- lazy local dynamic-import shard loaders that Vite code-splits (and plain Node can load in tests) and the offline cache can own without adding a network API;
- generator-id → shard-part coverage;
- aggregate record/checksum metadata.

The source PDF, raw extraction queue and review work-in-progress do not belong here. Do not hand-edit generated shards; change the reviewed record, audit it, and repack.
