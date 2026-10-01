import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = path => readFileSync(join(ROOT, path), 'utf8');
const app = read('client/src/App.jsx');
const history = read('client/src/pages/History.jsx');
const teach = read('client/src/pages/Teach.jsx');
const en = read('client/src/i18n/strings.en.js');
const hi = read('client/src/i18n/strings.hi.js');

let pass = 0;
let fail = 0;
function check(name, condition) {
  if (condition) {
    pass += 1;
    console.log(`  ✔ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✘ ${name}`);
  }
}

const has = (text, value) => text.includes(value);
const teacherBlock = app.slice(app.indexOf('const TEACHER_NAV'), app.indexOf('const STUDENT_MOBILE_PRIMARY'));
check('student Home is canonical', has(app, "{ to: '/', key: 'nav.home'"));
check('student Practice is primary navigation', has(app, "{ to: '/practice', key: 'nav.practice'"));
check('student Tasks is in My work', has(app, "{ to: '/tasks', key: 'nav.tasks'"));
check('student Exams is in My work', has(app, "{ to: '/exams', key: 'nav.exams'"));
check('student Classes is in My work', has(app, "{ to: '/classes', key: 'nav.classes'"));
check('student Progress is canonical', has(app, "{ to: '/progress', key: 'nav.progress'"));
check('student Review enters wrong-answer revision', has(app, "{ to: '/review?filter=wrong', key: 'nav.review'"));
check('Rush remains secondary practice mode', has(app, "{ to: '/rush', key: 'nav.rush'"));
check('Match remains secondary practice mode', has(app, "{ to: '/match', key: 'nav.match'"));
check('Settings remains canonical', has(app, "{ to: '/settings', key: 'nav.settings'"));

check('teacher has a distinct workspace', has(teacherBlock, "nav.teacherWorkspace"));
check('teacher Classes deep-links to real section', has(teacherBlock, "/teach#teacher-classes"));
check('teacher Assignments deep-links to real section', has(teacherBlock, "/teach#teacher-assignments"));
check('teacher Analytics deep-links to real section', has(teacherBlock, "/teach#teacher-analytics"));
check('teacher Question tools deep-links to real section', has(teacherBlock, "/teach#teacher-questions"));
check('teacher primary IA excludes Practice', !has(teacherBlock, "nav.practice"));
check('teacher primary IA excludes Exams', !has(teacherBlock, "nav.exams"));
check('teacher primary IA excludes Match', !has(teacherBlock, "nav.match"));
check('teacher root lands in Teacher Workspace', has(app, 'user.role === \'teacher\' ? <Navigate to="/teach" replace /> : <Home />'));
check('student Practice is role guarded', has(app, 'path="/practice" element={studentOnly(<Practice />)}'));
check('teacher Tasks maps to Assignments', has(app, "studentOnly(<Tasks />, '/teach#teacher-assignments')"));
check('teacher Progress maps to Analytics', has(app, "studentOnly(<Progress />, '/teach#teacher-analytics')"));
check('teacher Classes maps to teacher Classes', has(app, "studentOnly(<Classes />, '/teach#teacher-classes')"));
check('Teacher Studio is teacher-only', has(app, 'path="/teach" element={teacherOnly(<Teach />)}'));

check('/review is the one canonical review surface', has(app, 'path="/review" element={studentOnly(<History />)}'));
check('/history is compatibility redirect', has(app, 'path="/history" element={<Navigate to="/review" replace />}'));
check('/favorites is compatibility redirect', has(app, 'path="/favorites" element={<Navigate to="/review?filter=bookmarked" replace />}'));
check('/mistakes is compatibility redirect', has(app, 'path="/mistakes" element={<Navigate to="/review?filter=wrong" replace />}'));
check('Favorites duplicate is no longer lazy-loaded', !has(app, "import('./pages/Favorites.jsx')"));
check('unknown routes use role-safe landing', has(app, 'path="*" element={<Navigate to={roleLanding} replace />}'));

check('Review filter is URL-backed', has(history, 'useSearchParams'));
check('Review reads filter query', has(history, "params.get('filter')"));
check('Review filter changes navigation state', has(history, 'setParams('));
check('Review keeps real retry path', has(history, "api.post(`/history/${id}/retry`"));
check('teacher Classes anchor exists', has(teach, 'id="teacher-classes"'));
check('teacher Assignments anchor exists', has(teach, 'id="teacher-assignments"'));
check('teacher Analytics anchor exists', has(teach, 'id="teacher-analytics"'));
check('teacher Questions anchor exists', has(teach, 'id="teacher-questions"'));
check('teacher workspace has visible identity', has(teach, 'Teacher workspace'));

for (const [label, source] of [['English', en], ['Hindi', hi]]) {
  check(`${label} Review label resolves`, has(source, "'nav.review':"));
  check(`${label} Teacher Workspace label resolves`, has(source, "'nav.teacherWorkspace':"));
}

check('mobile More supports Escape', has(app, "if (e.key === 'Escape')"));
check('mobile More restores trigger focus', has(app, 'moreButtonRef.current?.focus()'));
check('teacher account menu points to workspace', has(app, "label: t('nav.teacherWorkspace'), run: () => nav('/teach')"));
check('teacher sidebar hides student recent history', has(app, "user.role !== 'teacher' && <SidebarHistory"));

console.log(`\nKALP-02 NAVIGATION SOURCE CHECK — ${pass}/${pass + fail} checks`);
if (fail) process.exit(1);
console.log('KALP-02 SOURCE GATE: PASS');
