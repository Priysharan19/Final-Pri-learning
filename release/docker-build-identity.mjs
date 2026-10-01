// Build the production client inside the Docker client-build stage with the
// release identity chosen by the same rule the server applies at run time
// (applyDeploymentPrecedence). When the deployment supplies no explicit build
// timestamp (a Railway Git deployment), this image build is stamped once, here,
// and that stamp is baked into client/dist/release.json; the server reads it
// back from there at run time.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyDeploymentPrecedence } from './release-identity.mjs';

export function dockerBuildIdentityEnv(env = process.env, now = new Date()) {
  const next = applyDeploymentPrecedence(env);
  if (!String(next.PRI_BUILD_TIMESTAMP || '').trim() && !String(next.SOURCE_DATE_EPOCH || '').trim()) {
    next.PRI_BUILD_TIMESTAMP = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  return next;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const result = spawnSync('npm', ['run', 'build', '--prefix', join(root, 'client')], {
    env: dockerBuildIdentityEnv(process.env),
    stdio: 'inherit'
  });
  process.exit(result.status ?? 1);
}
