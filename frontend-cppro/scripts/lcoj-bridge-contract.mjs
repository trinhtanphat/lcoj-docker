#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const forkRoot = path.resolve(appRoot, '..');
const dmojRoot = path.join(forkRoot, 'dmoj', 'repo');

const [main, build, urls, nginx, bridge, widgets] = await Promise.all([
  readFile(path.join(appRoot, 'src', 'main.tsx'), 'utf8'),
  readFile(path.join(appRoot, 'scripts', 'build-lcoj.mjs'), 'utf8'),
  readFile(path.join(dmojRoot, 'dmoj', 'urls.py'), 'utf8'),
  readFile(path.join(forkRoot, 'dmoj', 'nginx', 'conf.d', 'nginx.conf'), 'utf8'),
  readFile(path.join(dmojRoot, 'judge', 'views', 'cppro_api.py'), 'utf8'),
  readFile(path.join(dmojRoot, 'judge', 'views', 'widgets.py'), 'utf8'),
]);

assert.match(build, /VITE_CPPRO_DEPLOYMENT:\s*'lcoj'/, 'LCOJ build must enable the signed-session bridge.');
assert.doesNotMatch(build, /VITE_CPPRO_DATA_SOURCE/, 'LCOJ must not enter static-data mode.');
assert.match(main, /fetch\('\/api\/cppro\/auth\/me'/, 'The topbar must load the DMOJ session from the server.');
assert.match(main, /async function ensureLcojCsrfCookie\(\)[\s\S]{0,520}fetch\('\/api\/cppro\/auth\/me'/, 'An unsafe first request must bootstrap Django\'s CSRF cookie.');
assert.match(main, /let csrf = readSharedCookie\('csrftoken'\);[\s\S]{0,300}ensureLcojCsrfCookie\(\)[\s\S]{0,180}headers\.set\('X-CSRFToken', csrf\)/, 'LCOJ mutations must echo Django\'s CSRF token.');
assert.match(main, /if \(parts\[0\] === 'management'\) \{[\s\S]{0,240}<CpproManagementPage/, 'CPPRO management must stay in the SPA.');
assert.match(main, /function managementPrimaryReadEndpoint\(section: ManagementSectionKey\) \{[\s\S]{0,180}isLcojBackendMode\(\)[\s\S]{0,100}\/admin\/management\/\$\{section\}/, 'The CPPro management page must use bridge endpoints in LCOJ mode.');
assert.match(main, /openLcojLegacyPath\('\/admin\/'\)/, 'DMOJ admin must remain a hard legacy navigation.');
assert.match(main, /async function fetchSubmissionDetail\([\s\S]{0,420}includePrivateTests && isLcojBackendMode\(\) \? '&admin=true'/, 'LCOJ managers must request the server-verified admin testcase context.');

for (const route of [
  "path('api/cppro/auth/me', cppro_api.cppro_auth_me)",
  "path('api/cppro/data', cppro_api.cppro_data)",
  "path('api/cppro/admin/management/<str:section>', cppro_api.cppro_admin_management)",
  "path('api/cppro/problems/<str:identifier>', cppro_api.cppro_problems)",
]) {
  assert.ok(urls.includes(route), `Missing LCOJ bridge route: ${route}`);
}
assert.match(urls, /path\(\s*'api\/cppro\/problems\/<str:identifier>\/testcases',/, 'Missing protected testcase route.');
assert.ok(
  urls.indexOf("'api/cppro/problems/<str:identifier>/testcases'")
    < urls.indexOf("path('api/cppro/problems/<str:identifier>', cppro_api.cppro_problems)"),
  'The protected testcase route must precede generic problem detail.',
);
assert.doesNotMatch(nginx, /\(admin\|management\|api\|accounts\|channels/, 'Localized /management must not be sent to Django.');
assert.match(nginx, /location ~ \^\/\(vi\|en\)\(\/\.\*\)\?\$/, 'Localized CPPro SPA fallback is required.');
assert.match(nginx, /location \^~ \/api\/ \{\s*try_files \$uri @uwsgi;/, 'The authenticated CPPro bridge must be routed directly to Django.');
assert.match(bridge, /def cppro_auth_me\(request\):/, 'Bridge must expose the current signed-in user.');
assert.match(bridge, /@ensure_csrf_cookie\s*@require_GET\s*def cppro_auth_me\(request\):/, 'The bridge must issue a Django CSRF cookie before SPA mutations.');
assert.doesNotMatch(bridge, /csrf_exempt/, 'Cookie-authenticated CPPro endpoints must not bypass CSRF protection.');
assert.match(widgets, /if request\.path\.startswith\('\/api\/cppro\/'\):[\s\S]{0,160}JsonResponse\(\{'message': 'CSRF token missing or incorrect\.'\}, status=403\)/, 'A rejected CPPro mutation must stay an explicit JSON 403.');
for (const mutation of [
  'cppro_admin_management',
  'cppro_problem_admin',
  'cppro_contests',
  'cppro_contest_detail',
  'cppro_create_submission',
  'cppro_profile',
  'cppro_post_comments',
]) {
  assert.match(
    bridge,
    new RegExp(`@csrf_protect\\s*@require_http_methods\\([^\\n]+\\)\\s*def ${mutation}\\(`),
    `${mutation} must retain Django CSRF protection.`,
  );
}
assert.match(bridge, /def _can_manage_problem\(request_user, problem\):/, 'Bridge testcase access must use a server permission boundary.');
assert.match(bridge, /def cppro_problem_admin\(request, identifier, action\):/, 'Bridge must serve protected testcase management data.');
assert.ok(
  bridge.indexOf('if admin_context and _can_manage_problem(request_user, submission.problem):')
    < bridge.indexOf('if _active_contests_for_problem(submission.problem).exists():'),
  'Problem managers must retain testcase access while a contest scoreboard is frozen.',
);

console.log('LCOJ bridge contract passed: distinct admin routes, protected testcase access, and CSRF-safe mutations.');
