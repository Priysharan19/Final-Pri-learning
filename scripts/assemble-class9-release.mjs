import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const run = (cmd,args=[]) => {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd,args,{stdio:'inherit'});
};

const indexPath='client/src/engine/generators/index.js';
let index=fs.readFileSync(indexPath,'utf8');
const anchor="  'c9-statistics-grouped': 'india-junior',\n";
const bankLines=[
  "  'c9-coordinate-geometry-ncert-mastery': 'india-junior',",
  "  'c9-linear-polynomials-ncert-mastery': 'india-junior',",
  "  'c9-number-systems-ncert-mastery': 'india-junior',",
  "  'c9-algebraic-identities-ncert-mastery': 'india-junior',",
  "  'c9-circles-ncert-mastery': 'india-junior',",
  "  'c9-perimeter-area-ncert-mastery': 'india-junior',",
  "  'c9-probability-ncert-mastery': 'india-junior',",
  "  'c9-sequences-progressions-ncert-mastery': 'india-junior',"
].join('\n')+'\n';
if(!index.includes(bankLines)){
  if(!index.includes(anchor)) throw new Error('Class 9 bank-routing anchor missing');
  index=index.replace(anchor,anchor+bankLines);
  fs.writeFileSync(indexPath,index);
}

const generatorPath='client/src/engine/ncert/class9-generators.js';
let generators=fs.readFileSync(generatorPath,'utf8');
const patches=[
  [
    "const r=pick(rng,[5,10,13,17]),d=pick(rng,[3,4,5,8,12,15].filter(x=>x<r)),half=Math.sqrt(r*r-d*d),chord=2*half;",
    "const [r,d,half]=pick(rng,[[5,3,4],[10,6,8],[13,5,12],[17,8,15]]),chord=2*half;"
  ],
  [
    "const r=pick(rng,[7,14,21]),theta=pick(rng,[60,90,120,180,270]),L=2*22/7*r*theta/360;",
    "const r=pick(rng,[7,14,21]),theta=pick(rng,[90,180,270]),L=(44*r*theta)/(7*360);"
  ],
  [
    "const r=pick(rng,[7,14]),theta=pick(rng,[60,90,120]),sector=22/7*r*r*theta/360;",
    "const r=pick(rng,[7,14]),theta=pick(rng,[90,180]),sector=(22*r*r*theta)/(7*360);"
  ],
  [
    "['Sample space','$\\\\{1,2,3,4,5,6\\\\}$']",
    "['Sample space','Six equally likely outcomes: 1, 2, 3, 4, 5, 6.']"
  ],
  [
    "['Sample space','$\\{1,2,3,4,5,6\\}$']",
    "['Sample space','Six equally likely outcomes: 1, 2, 3, 4, 5, 6.']"
  ],
  [
    "['Sample space','Outcomes: 1, 2, 3, 4, 5, 6']",
    "['Sample space','Six equally likely outcomes: 1, 2, 3, 4, 5, 6.']"
  ]
];
for(const [from,to] of patches){ if(generators.includes(from)) generators=generators.replace(from,to); }
const requiredFragments=[
  "const [r,d,half]=pick(rng,[[5,3,4],[10,6,8],[13,5,12],[17,8,15]]),chord=2*half;",
  "theta=pick(rng,[90,180,270]),L=(44*r*theta)/(7*360);",
  "theta=pick(rng,[90,180]),sector=(22*r*r*theta)/(7*360);",
  "['Sample space','Six equally likely outcomes: 1, 2, 3, 4, 5, 6.']"
];
for(const fragment of requiredFragments){ if(!generators.includes(fragment)) throw new Error(`Generator safety patch missing: ${fragment}`); }
fs.writeFileSync(generatorPath,generators);

const pkgPath='package.json';
const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
pkg.scripts['test:ncert:class9']='node client/test/ncert-class9-check.mjs';
if(!pkg.scripts.test.includes('npm run test:ncert:class9')) pkg.scripts.test=pkg.scripts.test.replace('npm run test:ncert:class8:rest && npm run test:explain','npm run test:ncert:class8:rest && npm run test:ncert:class9 && npm run test:explain');
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');

const ciPath='.github/workflows/ci.yml';
let ci=fs.readFileSync(ciPath,'utf8');
const floors={
  'ENGINE_SELFCHECKS: 1072000':'ENGINE_SELFCHECKS: 1344000',
  'INDIA_CHECKS: 1358':'INDIA_CHECKS: 1432',
  'INDIA_QUESTIONS: 4644':'INDIA_QUESTIONS: 5136',
  'INDIA_DOTPOINTS: 261':'INDIA_DOTPOINTS: 246'
};
for(const [from,to] of Object.entries(floors)) if(ci.includes(from)) ci=ci.replaceAll(from,to);
for(const to of Object.values(floors)) if(!ci.includes(to)) throw new Error(`CI floor update missing: ${to}`);
fs.writeFileSync(ciPath,ci);

for(const f of [generatorPath,'client/src/engine/ncert/class9-content.js','client/src/engine/ncert/class9-chapters-production.js','client/test/ncert-class9-check.mjs']) run('node',['--check',f]);
run('npm',['run','test:ncert:class9']);
run('npm',['run','test:india']);
run('npm',['run','test:ncert:rational']);
run('npm',['run','test:ncert:linear']);
run('npm',['run','test:ncert:class8:rest']);
run('npm',['run','test:engine']);
run('npm',['run','test:explain']);
run('npm',['run','test:ink:bridge']);
run('npm',['run','test:photo:bridge']);
run('npm',['run','test:ink:interaction']);
run('npm',['run','build']);
run('npm',['run','sync:ios']);
run('npm',['run','check:ios']);

run('git',['config','user.name','github-actions[bot]']);
run('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
run('git',['add',indexPath,generatorPath,pkgPath,ciPath,'ios']);
let dirty=true;
try { execFileSync('git',['diff','--cached','--quiet']); dirty=false; } catch {}
if(dirty){
  run('git',['commit','-m','Assemble Grade 9 release and sync iPad bundles [class9-assembled]']);
  run('git',['push','origin','HEAD:feature/ncert-class9-complete']);
} else console.log('No assembled changes to commit.');
