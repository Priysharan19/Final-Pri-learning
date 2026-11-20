// `node --import client/test/support/legacy-packaging.mjs <suite>` runs the
// suite with the superseded d19-d20 packaging active (see the hooks module).
import { register } from 'node:module';
register('./legacy-packaging-hooks.mjs', import.meta.url);
