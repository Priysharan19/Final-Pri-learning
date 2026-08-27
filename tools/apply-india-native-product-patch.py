from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    n = text.count(old)
    if n != 1:
        raise SystemExit(f'{path}: expected one anchor, found {n}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def replace_all(path, old, new, expected=None):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    n = text.count(old)
    if expected is not None and n != expected:
        raise SystemExit(f'{path}: expected {expected} anchors, found {n}: {old[:120]!r}')
    if not n:
        raise SystemExit(f'{path}: anchor missing: {old[:120]!r}')
    p.write_text(text.replace(old, new), encoding='utf-8')


# ── Local API: profile, curriculum and practice become India-aware ───────────
b = 'client/src/local/backend.js'
replace_once(b,
"} from '../engine/curriculum.js';\nimport { generateQuestion } from '../engine/generators/index.js';\n",
"} from '../engine/curriculum.js';\nimport {\n  cleanIndiaTrack, indiaTrack, indiaCourseLabel, indiaScope, indiaChapter,\n  indiaChapterGrade, resolveIndiaTarget, indiaProductSections\n} from '../engine/indiaProduct.js';\nimport { generateQuestion } from '../engine/generators/index.js';\n")

replace_once(b,
"  ib: { name: 'IB', junior: y => `MYP Year ${y - 6}`, senior: () => 'IB DP · Mathematics AA' }\n};\nexport const courseLabel = (course, year, pathway) => {\n  const c = COURSES[course] || COURSES.nsw;\n",
"  ib: { name: 'IB', junior: y => `MYP Year ${y - 6}`, senior: () => 'IB DP · Mathematics AA' },\n  in: { name: 'India · CBSE / JEE', junior: y => `Class ${y} · CBSE / NCERT`, senior: y => `Class ${y} · CBSE / NCERT` }\n};\nexport const courseLabel = (course, year, pathway, indiaTrackId = 'cbse') => {\n  if (course === 'in') return indiaCourseLabel(year, indiaTrackId);\n  const c = COURSES[course] || COURSES.nsw;\n")

replace_once(b,
"    id: p.id, name: p.name, year: p.year, theme: p.theme || 'dark',\n    course: p.course || 'nsw', courseLabel: courseLabel(p.course || 'nsw', p.year, pathwayOf(p)),\n    pathway: p.year >= 11 ? pathwayOf(p) : null, pathwayName: p.year >= 11 ? PATHWAYS[pathwayOf(p)].name : null,\n",
"    id: p.id, name: p.name, year: p.year, theme: p.theme || 'dark',\n    course: p.course || 'nsw',\n    courseLabel: courseLabel(p.course || 'nsw', p.year, pathwayOf(p), cleanIndiaTrack(p.indiaTrack, p.year)),\n    pathway: p.course === 'nsw' && p.year >= 11 ? pathwayOf(p) : null,\n    pathwayName: p.course === 'nsw' && p.year >= 11 ? PATHWAYS[pathwayOf(p)].name : null,\n    indiaTrack: p.course === 'in' ? cleanIndiaTrack(p.indiaTrack, p.year) : null,\n    indiaTrackName: p.course === 'in' ? indiaTrack(p.indiaTrack, p.year).name : null,\n")

replace_once(b,
"  name: p.name, year: p.year, course: p.course || 'nsw', role: p.role || 'student',\n",
"  name: p.name, year: p.year, course: p.course || 'nsw', indiaTrack: p.indiaTrack || null, role: p.role || 'student',\n")
replace_once(b,
"    course: COURSES[src.course] ? src.course : 'nsw',\n    role: src.role === 'teacher' ? 'teacher' : 'student',\n",
"    course: COURSES[src.course] ? src.course : 'nsw',\n    indiaTrack: (COURSES[src.course] ? src.course : 'nsw') === 'in' ? cleanIndiaTrack(src.indiaTrack, year) : null,\n    role: src.role === 'teacher' ? 'teacher' : 'student',\n")
replace_once(b,
"    pathway: cleanPathway(src.pathway, year) || (year >= 11 ? 'advanced' : null),\n",
"    pathway: (COURSES[src.course] ? src.course : 'nsw') === 'nsw' ? (cleanPathway(src.pathway, year) || (year >= 11 ? 'advanced' : null)) : null,\n")

replace_once(b,
"    p.pathway = cleanPathway(body.pathway, p.year) || (p.year >= 11 ? 'advanced' : null);\n",
"    p.pathway = p.course === 'nsw' ? (cleanPathway(body.pathway, p.year) || (p.year >= 11 ? 'advanced' : null)) : null;\n    p.indiaTrack = p.course === 'in' ? cleanIndiaTrack(body.indiaTrack, p.year) : null;\n")

replace_once(b,
"    if (body.pathway !== undefined) p.pathway = cleanPathway(body.pathway, p.year) || (p.year >= 11 ? 'advanced' : null);\n    if (body.year !== undefined && body.pathway === undefined) p.pathway = cleanPathway(p.pathway, p.year) || (p.year >= 11 ? 'advanced' : null);\n",
"    if (body.pathway !== undefined && p.course === 'nsw') p.pathway = cleanPathway(body.pathway, p.year) || (p.year >= 11 ? 'advanced' : null);\n    if (body.year !== undefined && body.pathway === undefined && p.course === 'nsw') p.pathway = cleanPathway(p.pathway, p.year) || (p.year >= 11 ? 'advanced' : null);\n")
replace_once(b,
"    if (body.course !== undefined && COURSES[body.course]) p.course = body.course;\n",
"    if (body.course !== undefined && COURSES[body.course]) p.course = body.course;\n    if (p.course === 'in') {\n      p.pathway = null;\n      p.indiaTrack = cleanIndiaTrack(body.indiaTrack !== undefined ? body.indiaTrack : p.indiaTrack, p.year);\n    } else {\n      p.indiaTrack = null;\n      if (p.course === 'nsw') p.pathway = cleanPathway(p.pathway, p.year) || (p.year >= 11 ? 'advanced' : null);\n      else p.pathway = null;\n    }\n")

# India-aware question metadata + direct chapter generation.
replace_once(b,
"function criteriaFor(q) {\n",
"const indiaGeneratorIds = chapter => [...new Set((chapter?.covers || []).map(c => c.gen))];\n\nfunction indiaState(chapter, ratings, now = Date.now()) {\n  const rows = indiaGeneratorIds(chapter).map(id => ratings[id]).filter(Boolean);\n  if (!rows.length) return { attempts: 0, correct: 0, rating: START_RATING, mastery: 0 };\n  const attempts = rows.reduce((n, st) => n + (st.attempts || 0), 0);\n  const correct = rows.reduce((n, st) => n + (st.correct || 0), 0);\n  const weights = rows.reduce((n, st) => n + Math.max(1, st.attempts || 0), 0);\n  const rating = rows.reduce((n, st) => n + (st.rating || START_RATING) * Math.max(1, st.attempts || 0), 0) / Math.max(1, weights);\n  const mastery = rows.reduce((n, st) => n + masteryOf(st.rating, st.attempts, st.last_at, now) * Math.max(1, st.attempts || 0), 0) / Math.max(1, weights);\n  return { attempts, correct, rating, mastery };\n}\n\nasync function createIndiaQuestion(pid, chapter, target, mode, trackId, examId = null, taskId = null) {\n  if (!chapter || !target) throw Object.assign(new Error('That India syllabus target has no authored question form yet.'), { status: 409, code: 'INDIA_TARGET_UNCOVERED' });\n  const q = generateQuestion(target.generator, target.difficulty);\n  const row = {\n    id: uuid(), pid, subtopic: q.subtopic, difficulty: q.difficulty || target.difficulty, payload: q,\n    india: { chapterId: chapter.id, track: trackId, dotpointIndex: target.dotpointIndex },\n    mode, examId, taskId, answered: 0, tries: 0, hintsUsed: 0, createdAt: Date.now()\n  };\n  await put('questions', row);\n  return { row, payload: q };\n}\n\nfunction criteriaFor(q) {\n")

replace_once(b,
"function sanitize(q, row) {\n  if (q.multipart) {\n",
"function sanitize(q, row) {\n  if (q.multipart) {\n")
replace_once(b,
"  const s = SUBTOPIC_BY_ID[q.subtopic];\n  const dp = s ? dotpointOf(q.subtopic, q.dotpoint) : null;\n  return {\n    id: row.id, subtopic: q.subtopic, subtopicName: q.custom ? q.customName || 'Custom question' : (s?.name || q.subtopic),\n    year: s?.year, strand: s?.strand,\n    dotpoint: dp ? dp.id : null, dotpointText: dp ? dp.text : null, dotpointIndex: dp ? dp.ordinal : null,\n",
"  const s = SUBTOPIC_BY_ID[q.subtopic];\n  const dp = s ? dotpointOf(q.subtopic, q.dotpoint) : null;\n  const inChapter = row.india ? indiaChapter(row.india.chapterId) : null;\n  const inDp = inChapter && Number.isInteger(row.india?.dotpointIndex) ? row.india.dotpointIndex : null;\n  return {\n    id: row.id, subtopic: inChapter?.id || q.subtopic,\n    subtopicName: inChapter?.name || (q.custom ? q.customName || 'Custom question' : (s?.name || q.subtopic)),\n    year: inChapter ? indiaChapterGrade(inChapter) : s?.year, strand: inChapter?.strand || s?.strand,\n    indiaTrack: row.india?.track || null,\n    dotpoint: inChapter ? inDp : (dp ? dp.id : null),\n    dotpointText: inChapter && inDp != null ? inChapter.dotpoints[inDp] : (dp ? dp.text : null),\n    dotpointIndex: inChapter ? inDp : (dp ? dp.ordinal : null),\n")

# GET /curriculum: return actual India chapters/tracks when this profile chose India.
replace_once(b,
"    const now = Date.now();\n    /** Dot points with their own mastery, and an honest `generated` flag. */\n",
"    const now = Date.now();\n    if (p.course === 'in') {\n      const product = indiaProductSections();\n      const decorate = chapter => {\n        const state = indiaState(chapter, ratings, now);\n        const dotpoints = chapter.dotpoints.map((text, ordinal) => {\n          const covers = (chapter.covers || []).filter(c => c.dp.includes(ordinal));\n          const forms = [...new Set(covers.flatMap(c => c.diff || []))].sort((a, b) => a - b);\n          const ids = [...new Set(covers.map(c => c.gen))];\n          const dRows = ids.map(id => ratings[id]).filter(Boolean);\n          const attempts = dRows.reduce((n, st) => n + (st.attempts || 0), 0);\n          const correct = dRows.reduce((n, st) => n + (st.correct || 0), 0);\n          const weights = dRows.reduce((n, st) => n + Math.max(1, st.attempts || 0), 0);\n          const m = dRows.length ? dRows.reduce((n, st) => n + masteryOf(st.rating, st.attempts, st.last_at, now) * Math.max(1, st.attempts || 0), 0) / Math.max(1, weights) : 0;\n          return { id: `${chapter.id}#${ordinal}`, key: String(ordinal), text, difficulties: forms, mastery: Math.round(m * 100), band: attempts ? masteryBand(m) : 'unseen', attempts, correct, generated: forms.length > 0 };\n        });\n        return {\n          id: chapter.id, name: chapter.name, strand: chapter.strand, weight: chapter.weight, code: null, dotpoints,\n          mastery: Math.round(state.mastery * 100), band: state.attempts ? masteryBand(state.mastery) : 'unseen',\n          attempts: state.attempts, correct: state.correct, due: indiaGeneratorIds(chapter).some(id => due.has(id)), rating: state.attempts ? state.rating : null\n        };\n      };\n      const years = product.years.map(section => ({\n        year: section.year, key: section.key, track: section.track, title: section.title, caption: section.caption,\n        courseLabel: section.label, difficultyCeiling: section.difficultyCeiling, subtopics: section.chapters.map(decorate)\n      }));\n      const streams = product.streams.map(section => ({\n        year: section.year, allYears: !!section.allYears, key: section.key, track: section.track, title: section.title, caption: section.caption,\n        courseLabel: section.label, difficultyCeiling: section.difficultyCeiling, subtopics: section.chapters.map(decorate)\n      }));\n      return { country: 'in', years, streams, userYear: p.year, pathway: null, course: 'in', indiaTrack: cleanIndiaTrack(p.indiaTrack, p.year) };\n    }\n    /** Dot points with their own mastery, and an honest `generated` flag. */\n")

# India practice path must never fall through into the Australian picker.
replace_once(b,
"    const { mode = 'smart', subtopic, difficulty, dotpoint, taskId } = body || {};\n",
"    const { mode = 'smart', subtopic, difficulty, dotpoint, taskId, track } = body || {};\n")
replace_once(b,
"    const now = Date.now();\n    let choice;\n    if (mode === 'topic' && subtopic && SUBTOPIC_BY_ID[subtopic]) {\n",
"    const now = Date.now();\n    if (p.course === 'in' && !taskId) {\n      const trackId = cleanIndiaTrack(track || p.indiaTrack, p.year);\n      const ratings = await ratingsFor(p.id);\n      let chapter = subtopic ? indiaChapter(subtopic) : null;\n      if (subtopic && !chapter) throw Object.assign(new Error('That topic is not part of the India syllabus.'), { status: 404, code: 'INDIA_TOPIC_NOT_FOUND' });\n      if (!chapter) {\n        const scope = indiaScope(trackId, p.year).filter(c => (c.covers || []).some(x => (x.diff || []).length));\n        if (!scope.length) throw Object.assign(new Error('No generated questions are available for this India track yet.'), { status: 409, code: 'INDIA_TRACK_UNCOVERED' });\n        const ranked = scope.map(c => ({ chapter: c, ...indiaState(c, ratings, now) }))\n          .sort((a, b) => a.attempts - b.attempts || a.mastery - b.mastery);\n        chapter = ranked[Math.floor(Math.random() * Math.min(4, ranked.length))].chapter;\n      }\n      const state = indiaState(chapter, ratings, now);\n      const want = difficulty != null ? Number(difficulty) : pickDifficulty(state.rating, state.attempts, { state, nowMs: now });\n      const target = resolveIndiaTarget(chapter, { dotpoint, difficulty: want, track: trackId, grade: indiaChapterGrade(chapter) || p.year });\n      if (!target) {\n        const suffix = dotpoint != null ? 'dot point' : 'chapter';\n        throw Object.assign(new Error(`That India ${suffix} has no authored question form at this track yet.`), { status: 409, code: 'INDIA_TARGET_UNCOVERED' });\n      }\n      const { row, payload } = await createIndiaQuestion(p.id, chapter, target, 'practice', trackId);\n      return {\n        question: sanitize(payload, row), reason: subtopic ? 'topic' : 'smart',\n        why: subtopic ? `${indiaTrack(trackId, p.year).name} · focused practice on ${chapter.name}.` : `${indiaTrack(trackId, p.year).name} · adapting across ${chapter.name}.`,\n        dotpoint: target.dotpointIndex, target: state.mastery, misconception: null\n      };\n    }\n    let choice;\n    if (mode === 'topic' && subtopic && SUBTOPIC_BY_ID[subtopic]) {\n")

# ── API preload: India profiles warm India generator banks, not Australian scope ──
a = 'client/src/api.js'
replace_once(a,
"import { scopeForYear } from './engine/curriculum.js';\n",
"import { scopeForYear } from './engine/curriculum.js';\nimport { indiaGeneratorsForScope, indiaChapter, cleanIndiaTrack } from './engine/indiaProduct.js';\n")
replace_once(a,
"let pathway = 'advanced';\n\n/** Pull in what a profile practises from: their year and stream, plus the year below. */\nfunction warmScope(year, pw) {\n  const y = Number(year);\n  if (!y) return;\n  const { own, revision } = scopeForYear(y, y >= 11 ? (pw || 'advanced') : 'advanced');\n  const job = loadBanksFor([...own, ...revision].map(s => s.id));\n",
"let pathway = 'advanced';\nlet course = 'nsw';\nlet indiaTrackId = 'cbse';\n\n/** Pull in what a profile practises from. India and Australia have separate scopes. */\nfunction warmScope(year, pw, selectedCourse = course, selectedIndiaTrack = indiaTrackId) {\n  const y = Number(year);\n  if (!y) return;\n  const ids = selectedCourse === 'in'\n    ? indiaGeneratorsForScope(cleanIndiaTrack(selectedIndiaTrack, y), y)\n    : (() => { const { own, revision } = scopeForYear(y, y >= 11 ? (pw || 'advanced') : 'advanced'); return [...own, ...revision].map(s => s.id); })();\n  const job = loadBanksFor(ids);\n")
replace_once(a,
"  pathway = u.pathway || 'advanced';\n  warmScope(u.year, pathway);\n",
"  pathway = u.pathway || 'advanced';\n  course = u.course || 'nsw';\n  indiaTrackId = u.indiaTrack || 'cbse';\n  warmScope(u.year, pathway, course, indiaTrackId);\n")
replace_once(a,
"  if (body?.subtopic) await loadBanksFor([body.subtopic]);\n",
"  if (body?.subtopic) {\n    const chapter = indiaChapter(body.subtopic);\n    await loadBanksFor(chapter ? [...new Set((chapter.covers || []).map(c => c.gen))] : [body.subtopic]);\n  }\n")
replace_once(a,
"  if (path === '/exams' && body?.year) warmScope(body.year, pathway);\n",
"  if (path === '/exams' && body?.year) warmScope(body.year, pathway, course, indiaTrackId);\n")

# ── Gateway contracts ────────────────────────────────────────────────────────
g = 'client/src/local/gateway.js'
replace_once(g,
"    optionalString(body, 'pathway', 30);\n",
"    optionalString(body, 'pathway', 30); optionalString(body, 'indiaTrack', 30);\n")
replace_once(g,
"    optionalString(body, 'course', 30); optionalString(body, 'avatar', 32); optionalBoolean(body, 'handwriting'); optionalString(body, 'email', 180);\n",
"    optionalString(body, 'course', 30); optionalString(body, 'indiaTrack', 30); optionalString(body, 'avatar', 32); optionalBoolean(body, 'handwriting'); optionalString(body, 'email', 180);\n")
replace_once(g,
"    requireObject(body, 'POST /practice/next'); optionalString(body, 'mode', 30); optionalId(body, 'subtopic');\n    optionalNumber(body, 'difficulty'); optionalId(body, 'dotpoint'); optionalId(body, 'taskId');\n",
"    requireObject(body, 'POST /practice/next'); optionalString(body, 'mode', 30); optionalId(body, 'subtopic'); optionalString(body, 'track', 30);\n    optionalNumber(body, 'difficulty');\n    if (typeof body.dotpoint === 'number') optionalNumber(body, 'dotpoint'); else optionalId(body, 'dotpoint');\n    optionalId(body, 'taskId');\n")

# ── Home question generator: expose CBSE/JEE/Olympiad sections ───────────────
h = 'client/src/pages/Home.jsx'
replace_once(h,
"    const core = curriculum.years.find(y => y.year === year);\n    if (core) out.push({ key: `y${year}`, label: year >= 11 ? 'Advanced' : 'Core', ...core });\n    for (const g of curriculum.streams || []) {\n      if (g.year === year) out.push({ key: g.key, label: g.title.replace(/^Mathematics\\s*/, ''), ...g });\n    }\n",
"    const core = curriculum.years.find(y => y.year === year);\n    if (core) out.push({ key: core.key || `y${year}`, label: curriculum.country === 'in' ? 'CBSE / NCERT' : (year >= 11 ? 'Advanced' : 'Core'), ...core });\n    for (const g of curriculum.streams || []) {\n      if (g.year === year || g.allYears) out.push({ key: g.key, label: curriculum.country === 'in' ? (g.courseLabel || g.title) : g.title.replace(/^Mathematics\\s*/, ''), ...g });\n    }\n")
replace_once(h,
"  if (year != null) chips.push({ k: 'year', label: `Year ${year}`, clear: () => { setYear(user.year); setSectionKey(null); setSubtopic(null); setDotpoint(null); } });\n",
"  if (year != null) chips.push({ k: 'year', label: `${curriculum?.country === 'in' ? 'Class' : 'Year'} ${year}`, clear: () => { setYear(user.year); setSectionKey(null); setSubtopic(null); setDotpoint(null); } });\n")
replace_once(h,
"    if (difficulty != null) p.set('difficulty', String(difficulty));\n",
"    if (difficulty != null) p.set('difficulty', String(difficulty));\n    if (section?.track) p.set('track', section.track);\n")
replace_once(h,
"                ['year', 'Year'], ['course', 'Course'], ['topics', 'Topics'],\n",
"                ['year', curriculum?.country === 'in' ? 'Class' : 'Year'], ['course', curriculum?.country === 'in' ? 'Track' : 'Course'], ['topics', 'Topics'],\n")
replace_once(h,
"                  <div className=\"gen-pane-title\">Select the year level to target</div>\n",
"                  <div className=\"gen-pane-title\">Select the {curriculum?.country === 'in' ? 'class' : 'year level'} to target</div>\n")
replace_once(h,
"                        Year {y}{y === user.year ? <small> · yours</small> : null}\n",
"                        {curriculum?.country === 'in' ? 'Class' : 'Year'} {y}{y === user.year ? <small> · yours</small> : null}\n")
replace_once(h,
"                  <div className=\"gen-pane-title\">Now select the maths course</div>\n",
"                  <div className=\"gen-pane-title\">Now select the {curriculum?.country === 'in' ? 'India maths track' : 'maths course'}</div>\n")
replace_once(h,
"                    {[1, 2, 3, 4].map(d => (\n",
"                    {[1, 2, 3, 4].filter(d => !section?.difficultyCeiling || d <= section.difficultyCeiling).map(d => (\n")

# ── Practice passes track and labels Class correctly ─────────────────────────
p = 'client/src/pages/Practice.jsx'
replace_once(p,
"  const difficulty = params.get('difficulty');\n",
"  const difficulty = params.get('difficulty');\n  const track = params.get('track');\n")
replace_once(p,
"        : subtopic ? { mode: 'topic', subtopic, dotpoint: dotpoint != null ? Number(dotpoint) : undefined, difficulty: difficulty != null ? Number(difficulty) : undefined }\n          : { mode: 'smart', difficulty: difficulty != null ? Number(difficulty) : undefined };\n",
"        : subtopic ? { mode: 'topic', subtopic, track: track || undefined, dotpoint: dotpoint != null ? Number(dotpoint) : undefined, difficulty: difficulty != null ? Number(difficulty) : undefined }\n          : { mode: 'smart', track: track || undefined, difficulty: difficulty != null ? Number(difficulty) : undefined };\n")
replace_once(p,
"  }, [subtopic, dotpoint, difficulty, taskId]);\n",
"  }, [subtopic, dotpoint, difficulty, taskId, track]);\n")
replace_once(p,
"  const course = (user.courseLabel || 'Mathematics').replace(/^Year \\d+\\s*·\\s*/, '');\n  const metaLine = `Year ${serve?.question?.year ?? user.year} · ${course}`;\n",
"  const course = (user.courseLabel || 'Mathematics').replace(/^(?:Year|Class) \\d+\\s*·\\s*/, '');\n  const metaLine = `${user.course === 'in' ? 'Class' : 'Year'} ${serve?.question?.year ?? user.year} · ${serve?.question?.indiaTrack ? (user.indiaTrackName || course) : course}`;\n")

# ── Onboarding: India is an actual syllabus choice, with track selection ─────l = 'client/src/pages/Login.jsx'
replace_once(l,
"const AVATARS = ['🚀', '🦊', '🐨', '🦉', '🌟', '🐯', '🍀', '🎧', '🦄', '⚡', '🌊', '🧠'];\n",
"const AVATARS = ['🚀', '🦊', '🐨', '🦉', '🌟', '🐯', '🍀', '🎧', '🦄', '⚡', '🌊', '🧠'];\nconst INDIA_TRACKS = [['cbse', 'CBSE / NCERT'], ['jee-main', 'JEE Main'], ['jee-advanced', 'JEE Advanced'], ['olympiad', 'Olympiad']];\n")
replace_once(l,
"  const [form, setForm] = useState({ name: '', email: '', password: '', password2: '', year: 12, avatar: '🚀', role: 'student', course: 'nsw', pathway: 'advanced', protect: false });\n",
"  const [form, setForm] = useState({ name: '', email: '', password: '', password2: '', year: 12, avatar: '🚀', role: 'student', course: 'nsw', pathway: 'advanced', indiaTrack: 'cbse', protect: false });\n")
replace_once(l,
"      course: form.course, pathway: form.pathway,\n",
"      course: form.course, pathway: form.course === 'nsw' ? form.pathway : undefined, indiaTrack: form.course === 'in' ? form.indiaTrack : undefined,\n")
replace_once(l,
"          <div className=\"hero-kicker\">NSW · HSC · VCE · QCE · WACE · SACE · IB</div>\n",
"          <div className=\"hero-kicker\">NSW · HSC · CBSE · JEE · OLYMPIAD · VCE · QCE · WACE · SACE · IB</div>\n")
replace_once(l,
"                    <label className=\"label\" htmlFor=\"signup-year\">School year</label>\n",
"                    <label className=\"label\" htmlFor=\"signup-year\">{form.course === 'in' ? 'School class' : 'School year'}</label>\n")
replace_once(l,
"                      {[7, 8, 9, 10, 11, 12].map(y => <option key={y} value={y}>Year {y}</option>)}\n",
"                      {[7, 8, 9, 10, 11, 12].map(y => <option key={y} value={y}>{form.course === 'in' ? 'Class' : 'Year'} {y}</option>)}\n")
replace_once(l,
"                      <option value=\"ib\">IB</option>\n",
"                      <option value=\"ib\">IB</option>\n                      <option value=\"in\">India · CBSE / JEE / Olympiad</option>\n")
replace_once(l,
"              {form.role === 'student' && form.year >= 11 && (\n",
"              {form.role === 'student' && form.course === 'nsw' && form.year >= 11 && (\n")
replace_once(l,
"              <div className=\"field\">\n                <div className=\"label\" id=\"signup-avatar\">Avatar</div>\n",
"              {form.role === 'student' && form.course === 'in' && (\n                <div className=\"field\">\n                  <div className=\"label\" id=\"signup-india-track\">India maths track</div>\n                  <div className=\"pathway-row\" role=\"group\" aria-labelledby=\"signup-india-track\">\n                    {INDIA_TRACKS.filter(([k]) => form.year >= 11 || !k.startsWith('jee-')).map(([k, name]) => (\n                      <button key={k} type=\"button\" className={`pathway-pick ${form.indiaTrack === k ? 'on' : ''}`}\n                        onClick={() => setForm(f => ({ ...f, indiaTrack: k }))}><b>{name}</b></button>\n                    ))}\n                  </div>\n                </div>\n              )}\n              <div className=\"field\">\n                <div className=\"label\" id=\"signup-avatar\">Avatar</div>\n")

# ── Settings: India can be selected/changed after profile creation ───────────s = 'client/src/pages/Settings.jsx'
replace_once(s,
"const COURSES = [['nsw', 'NSW · HSC'], ['vic', 'VIC · VCE'], ['qld', 'QLD · QCE'], ['wa', 'WA · WACE'], ['sa', 'SA · SACE'], ['ib', 'IB']];\n",
"const COURSES = [['nsw', 'NSW · HSC'], ['vic', 'VIC · VCE'], ['qld', 'QLD · QCE'], ['wa', 'WA · WACE'], ['sa', 'SA · SACE'], ['ib', 'IB'], ['in', 'India · CBSE / JEE / Olympiad']];\nconst INDIA_TRACKS = [['cbse', 'CBSE / NCERT', 'Classes 7–12 school syllabus'], ['jee-main', 'JEE Main', 'Classes 11–12 objective depth'], ['jee-advanced', 'JEE Advanced', 'Classes 11–12 multi-concept depth'], ['olympiad', 'Olympiad', 'PRMO → RMO → INMO']];\n")
replace_once(s,
"  const [form, setForm] = useState({ name: user.name, year: user.year, dailyGoal: user.dailyGoal, course: user.course, avatar: user.avatar, pathway: user.pathway || 'advanced' });\n",
"  const [form, setForm] = useState({ name: user.name, year: user.year, dailyGoal: user.dailyGoal, course: user.course, avatar: user.avatar, pathway: user.pathway || 'advanced', indiaTrack: user.indiaTrack || 'cbse' });\n")
replace_once(s,
"                {user.role !== 'teacher' && <div className=\"set-row\"><span className=\"set-k\">Year level</span><span className=\"set-v\">Year {user.year}</span></div>}\n",
"                {user.role !== 'teacher' && <div className=\"set-row\"><span className=\"set-k\">{user.course === 'in' ? 'Class level' : 'Year level'}</span><span className=\"set-v\">{user.course === 'in' ? 'Class' : 'Year'} {user.year}</span></div>}\n")
replace_once(s,
"                      <label className=\"label\" htmlFor=\"set-year\">School year</label>\n",
"                      <label className=\"label\" htmlFor=\"set-year\">{form.course === 'in' ? 'School class' : 'School year'}</label>\n")
replace_once(s,
"                        {[7, 8, 9, 10, 11, 12].map(y => <option key={y} value={y}>Year {y}</option>)}\n",
"                        {[7, 8, 9, 10, 11, 12].map(y => <option key={y} value={y}>{form.course === 'in' ? 'Class' : 'Year'} {y}</option>)}\n")
replace_once(s,
"                {user.role !== 'teacher' && form.year >= 11 && (\n",
"                {user.role !== 'teacher' && form.course === 'nsw' && form.year >= 11 && (\n")
replace_once(s,
"                <div className=\"field\">\n                  <label className=\"label\" htmlFor=\"set-goal\">Daily goal — {form.dailyGoal} questions</label>\n",
"                {user.role !== 'teacher' && form.course === 'in' && (\n                  <div className=\"field\">\n                    <div className=\"label\" id=\"set-india-track\">India maths track</div>\n                    <div className=\"pathway-row\" role=\"group\" aria-labelledby=\"set-india-track\">\n                      {INDIA_TRACKS.filter(([k]) => form.year >= 11 || !k.startsWith('jee-')).map(([k, name, desc]) => (\n                        <button key={k} type=\"button\" className={`pathway-pick ${form.indiaTrack === k ? 'on' : ''}`}\n                          onClick={() => setForm(f => ({ ...f, indiaTrack: k }))}><b>{name}</b><span>{desc}</span></button>\n                      ))}\n                    </div>\n                  </div>\n                )}\n                <div className=\"field\">\n                  <label className=\"label\" htmlFor=\"set-goal\">Daily goal — {form.dailyGoal} questions</label>\n")

# Make handwriting copy honest about the runtime instead of quoting training
# sample counts as if browser fallback and release confidence were equivalent.
replace_once(s,
"      <p className=\"sub\" style={{ marginBottom: 12 }}>\n        The recogniser reads your ink with a two-model neural ensemble trained on ~142,000 handwriting\n        samples, cross-checked by geometric matching, a maths-aware decoder and a grammar search — and it\n        <b> learns your hand</b>: every correction becomes a personal template that outranks the built-in\n        shapes, kept separately for each profile on this iPad.\n      </p>\n",
"      <p className=\"sub\" style={{ marginBottom: 12 }}>\n        {window.__PRI_NATIVE__\n          ? <>The native iPad app captures Apple Pencil ink with PencilKit. Pri uses the bundled foundation model only when that build permits the model metadata; otherwise it falls back to the local recogniser. <b>Corrections still learn your hand</b> and stay on this iPad.</>\n          : <>This browser build uses Pri’s legacy JavaScript handwriting fallback. It is useful for testing the web UI, <b>not</b> for judging the native PencilKit/Core ML handwriting experience. Corrections still stay local to this device.</>}\n      </p>\n")

# ── Ink canvas: browser fallback is visibly labelled before a user tests it ──i = 'client/src/ink/InkAnswer.jsx'
replace_once(i,
"      : rec.engine === 'pri-js-v3'\n        ? 'JS V3 fallback'\n",
"      : rec.engine === 'pri-js-v3'\n        ? 'Legacy JS V3 fallback · not native PencilKit/Core ML'\n")
replace_once(i,
"    <div className={`ink-answer ${disabled ? 'ink-disabled' : ''}`}>\n      <div className=\"ink-toolbar\">\n",
"    <div className={`ink-answer ${disabled ? 'ink-disabled' : ''}`}>\n      {!NATIVE_INK && (\n        <div role=\"note\" style={{ padding: '9px 12px', marginBottom: 8, border: '1px solid var(--warn)', borderRadius: 10, fontSize: 12.5 }}>\n          Browser handwriting = legacy JS fallback. For handwriting quality testing, run the native iPad package with PencilKit; this web fallback is not the production acceptance path.\n        </div>\n      )}\n      <div className=\"ink-toolbar\">\n")

# ── One-command native iPad launcher ─────────────────────────────────────────pkg = 'package.json'
replace_once(pkg,
"    \"serve:lan\": \"node scripts/serve-lan.mjs\",\n",
"    \"serve:lan\": \"node scripts/serve-lan.mjs\",\n    \"test:ipad:native\": \"node scripts/test-ipad-native.mjs\",\n")

launcher = Path('scripts/test-ipad-native.mjs')
launcher.write_text("""import { spawnSync } from 'node:child_process';\nimport { resolve } from 'node:path';\n\nconst root = resolve(new URL('..', import.meta.url).pathname);\nconst run = (cmd, args) => {\n  const out = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' });\n  if (out.status !== 0) process.exit(out.status || 1);\n};\n\nrun('npm', ['run', 'build']);\nrun('npm', ['run', 'sync:ios']);\nrun('npm', ['run', 'check:ios']);\nconst pkg = resolve(root, 'ios/PriLearning.swiftpm');\nconsole.log('\\nPri Learning native iPad package is synced.');\nconsole.log(`Opening ${pkg}`);\nconsole.log('In Xcode: select your physical iPad as the run destination, then Run.');\nconsole.log('This is the PencilKit/native handwriting acceptance path; Safari/LAN is not.\\n');\nrun('open', [pkg]);\n""", encoding='utf-8')

print('India/native product patch applied')
