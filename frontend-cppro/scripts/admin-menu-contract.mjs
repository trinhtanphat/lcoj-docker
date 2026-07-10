#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [main, styles] = await Promise.all([
  readFile(path.join(appRoot, 'src', 'main.tsx'), 'utf8'),
  readFile(path.join(appRoot, 'src', 'styles.css'), 'utf8'),
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

assert.match(
  styles,
  /\[data-user-menu-admin-grid\]\s*\{[\s\S]{0,160}grid-template-columns:\s*minmax\(0, 1fr\)/,
  'The two admin actions must render as two separate rows.',
);

console.log('admin-menu contract passed: DMOJ /admin/ and CPPro /management are separate actions.');
