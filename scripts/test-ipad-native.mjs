import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const run = (cmd, args) => {
  const out = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' });
  if (out.status !== 0) process.exit(out.status || 1);
};

run('npm', ['run', 'build']);
run('npm', ['run', 'sync:ios']);
run('npm', ['run', 'check:ios']);
const pkg = resolve(root, 'ios/PriLearning.swiftpm');
console.log('\nPri Learning native iPad package is synced.');
console.log(`Opening ${pkg} explicitly in Xcode`);
console.log('In Xcode: select your physical iPad as the run destination, then Run.');
console.log('This is the PencilKit/native handwriting acceptance path; Safari/LAN is not.\n');

const opened = spawnSync('open', ['-a', 'Xcode', pkg], { cwd: root, stdio: 'inherit' });
if (opened.status !== 0) {
  console.log('Could not launch Xcode with open -a. Trying xed instead.');
  run('xed', [pkg]);
}
