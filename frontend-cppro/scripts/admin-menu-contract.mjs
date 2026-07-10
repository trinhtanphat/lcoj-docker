#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [main, styles, lcojBuild] = await Promise.all([
  readFile(path.join(appRoot, 'src', 'main.tsx'), 'utf8'),
  readFile(path.join(appRoot, 'src', 'styles.css'), 'utf8'),
  readFile(path.join(appRoot, 'scripts', 'build-lcoj.mjs'), 'utf8'),
]);

function occurrences(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

assert.equal(occurrences(main, /data-admin-dmoj-action="true"/g), 1, 'Render exactly one DMOJ Admin action.');
assert.equal(occurrences(main, /data-admin-management-action="true"/g), 1, 'Render exactly one CPPro Management action.');
assert.match(
  main,
  /data-admin-dmoj-action="true"[\s\S]{0,180}onClick=\{openLegacyAdminRoute\}[\s\S]{0,180}admin\.dmoj/,
  'The DMOJ row must use the dedicated legacy navigation handler.',
);
assert.match(
  main,
  /data-admin-management-action="true"[\s\S]{0,180}onClick=\{\(\) => openRoute\('\/management'\)\}[\s\S]{0,180}admin\.cppro/,
  'The CPPro row must stay inside the SPA management route.',
);

const legacyHandlerStart = main.indexOf('const openLegacyAdminRoute = () => {');
const legacyHandlerEnd = main.indexOf('\n  };', legacyHandlerStart);
assert.ok(legacyHandlerStart >= 0 && legacyHandlerEnd > legacyHandlerStart, 'Missing the legacy DMOJ Admin handler.');
const legacyHandler = main.slice(legacyHandlerStart, legacyHandlerEnd);
assert.match(legacyHandler, /openLcojLegacyPath\('\/admin\/'\)/);
assert.match(legacyHandler, /window\.location\.assign\(legacyFrontendUrlForPath\('\/admin\/', platformFrontendUrl\)\)/);
assert.doesNotMatch(legacyHandler, /\bgo\(/, 'Legacy /admin/ must bypass the SPA router.');
assert.doesNotMatch(
  main,
  /const isAdminUser = !lcojLegacyRoutes/,
  'LCOJ mode must still render both admin rows for an authorized manager.',
);
assert.match(main, /Boolean\(currentUser\?\.is_teacher\)/, 'Authenticated DMOJ staff must receive the management menu.');
assert.match(main, /Boolean\(user\?\.is_teacher\)/, 'The CPPro management gate must agree with the DMOJ staff session.');
assert.match(main, /fetch\('\/api\/cppro\/auth\/me'/, 'LCOJ must obtain the signed-in DMOJ user from the server.');
assert.match(main, /if \(parts\[0\] === 'management'\) \{[\s\S]{0,240}<CpproManagementPage/, 'The CPPro row must remain inside the CPPro SPA.');
assert.match(lcojBuild, /VITE_CPPRO_DEPLOYMENT:\s*'lcoj'/, 'The LCOJ build must enable the authenticated bridge.');
assert.doesNotMatch(lcojBuild, /VITE_CPPRO_DATA_SOURCE/, 'The LCOJ build must not enter static-data mode.');

assert.match(
  styles,
  /\[data-user-menu-admin-grid\]\s*\{[\s\S]{0,160}grid-template-columns:\s*minmax\(0, 1fr\)/,
  'The two admin actions must render as two separate rows.',
);

console.log('admin-menu contract passed: DMOJ /admin/ and CPPro /management are separate actions.');
