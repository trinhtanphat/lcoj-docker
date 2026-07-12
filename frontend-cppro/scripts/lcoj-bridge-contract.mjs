#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const forkRoot = path.resolve(appRoot, '..');
const dmojRoot = path.join(forkRoot, 'dmoj', 'repo');

const [main, build, urls, nginx, bridge, widgets, styles, deploy] = await Promise.all([
  readFile(path.join(appRoot, 'src', 'main.tsx'), 'utf8'),
  readFile(path.join(appRoot, 'scripts', 'build-lcoj.mjs'), 'utf8'),
  readFile(path.join(dmojRoot, 'dmoj', 'urls.py'), 'utf8'),
  readFile(path.join(forkRoot, 'dmoj', 'nginx', 'conf.d', 'nginx.conf'), 'utf8'),
  readFile(path.join(dmojRoot, 'judge', 'views', 'cppro_api.py'), 'utf8'),
  readFile(path.join(dmojRoot, 'judge', 'views', 'widgets.py'), 'utf8'),
  readFile(path.join(appRoot, 'src', 'styles.css'), 'utf8'),
  readFile(path.join(forkRoot, '.deployment', 'safe-redeploy-lcojcppro-vps.sh'), 'utf8'),
]);

assert.match(build, /VITE_CPPRO_DEPLOYMENT:\s*'lcoj'/, 'LCOJ build must enable the signed-session bridge.');
assert.doesNotMatch(build, /VITE_CPPRO_DATA_SOURCE/, 'LCOJ must not enter static-data mode.');
assert.match(build, /assertNoCrawlArtifacts\(distDir\)[\s\S]{0,240}assertNoCrawlArtifacts\(runtimeDir\)/, 'LCOJ build must verify crawl data is absent from both dist and deployed runtime output.');
assert.match(main, /fetch\('\/api\/cppro\/auth\/me'/, 'The topbar must load the DMOJ session from the server.');
assert.match(main, /function formatSubmissionRuntime\(value: number\) \{[\s\S]{0,520}minimumFractionDigits: 2, maximumFractionDigits: 2[\s\S]{0,220}minimumFractionDigits: 2, maximumFractionDigits: 2/, 'Submission runtime must render with exactly two decimal digits.');
assert.equal(
  (25.270457999999998).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  '25,27',
  'The reported runtime example must round to exactly 25,27.',
);
assert.doesNotMatch(main, /`\$\{test\.runtime\} ms`/, 'Testcase runtime must not render an unrounded raw float.');
assert.match(main, /timeMs \/ 1000\)\.toLocaleString\('vi-VN', \{ minimumFractionDigits: 2, maximumFractionDigits: 2 \}\)/, 'Submission rows must also keep exactly two runtime decimals.');
assert.match(main, /async function loadLcojBridgeCpproData\(\):[\s\S]{0,420}cpproApiFetch<Record<string, unknown>>\('\/data'/, 'The LCOJ initial model must come from the privacy-aware CPPro bridge.');
assert.match(main, /async function loadLcojBridgeCpproData\(\):[\s\S]{0,1800}payload\.posts\)\.map\(mapBackendPost\)/, 'Live database community posts must be mapped into the LCOJ home feed.');
assert.match(main, /if \(isLcojBackendMode\(\)\) \{[\s\S]{0,340}loadLcojBridgeCpproData\(\)/, 'LCOJ mode must select the privacy-aware bridge loader.');
assert.doesNotMatch(main, /loadLcojApiCpproData\(null\)/, 'LCOJ mode must not fall back to broad API v2 collections.');
for (const contestFormat of ['DEFAULT', 'ICPC', 'IOI', 'IOI_LEGACY', 'ATCODER', 'ECOO', 'VNOJ']) {
  assert.match(main, new RegExp(`value: '${contestFormat}'`), `Contest management must expose ${contestFormat}.`);
}
assert.match(main, /freezeMinutes: draft\.freezeMinutes,[\s\S]{0,180}scoreboardVisibility: draft\.scoreboardVisibility,[\s\S]{0,180}showSubmissionList: draft\.showSubmissionList,/, 'Contest management must persist freeze and scoreboard policy.');
assert.match(main, /data-management-contest-freeze[\s\S]{0,260}disabled=\{!selectedFormat\.freeze\}/, 'Freeze input must only be enabled for supported formats.');
assert.match(styles, /\.cppro-management-format-picker[\s\S]{0,4000}\.cppro-management-contest-policy/, 'Contest format and freeze controls must retain their management UI styling.');
assert.match(main, /async function ensureLcojCsrfCookie\(\)[\s\S]{0,520}fetch\('\/api\/cppro\/auth\/me'/, 'An unsafe first request must bootstrap Django\'s CSRF cookie.');
assert.match(main, /let csrf = readSharedCookie\('csrftoken'\);[\s\S]{0,300}ensureLcojCsrfCookie\(\)[\s\S]{0,180}headers\.set\('X-CSRFToken', csrf\)/, 'LCOJ mutations must echo Django\'s CSRF token.');
assert.match(main, /if \(parts\[0\] === 'management'\) \{[\s\S]{0,240}<CpproManagementPage/, 'CPPRO management must stay in the SPA.');
assert.match(main, /function managementPrimaryReadEndpoint\(section: ManagementSectionKey\) \{[\s\S]{0,180}isLcojBackendMode\(\)[\s\S]{0,100}\/admin\/management\/\$\{section\}/, 'The CPPro management page must use bridge endpoints in LCOJ mode.');
assert.match(main, /openLcojLegacyPath\('\/admin\/'\)/, 'DMOJ admin must remain a hard legacy navigation.');
assert.match(main, /async function fetchSubmissionDetail\([\s\S]{0,420}includePrivateTests && isLcojBackendMode\(\) \? '&admin=true'/, 'LCOJ managers must request the server-verified admin testcase context.');
assert.doesNotMatch(main, /CPPRO management shows saved LCOJ testcases read-only/, 'LCOJ editing must not disable testcase ZIP replacement.');
assert.match(main, /const visibleTestCases = draft\.testCases/, 'Create and edit problem forms must share the testcase editor state.');
assert.match(main, /const patchSampleTestcase = \(field: 'input' \| 'output', value: string\)/, 'An existing problem must allow its sample testcase to be edited.');

for (const route of [
  "path('api/cppro/auth/me', cppro_api.cppro_auth_me)",
  "path('api/cppro/data', cppro_api.cppro_data)",
  "path('api/cppro/admin/management/<str:section>', cppro_api.cppro_admin_management)",
  "path('api/cppro/problems/<str:identifier>', cppro_api.cppro_problems)",
]) {
  assert.ok(urls.includes(route), `Missing LCOJ bridge route: ${route}`);
}
assert.match(urls, /path\(\s*'api\/cppro\/problems\/<str:identifier>\/testcases',/, 'Missing protected testcase route.');
for (const route of [
  "path('api/cppro/problems/package/inspect', cppro_api.cppro_problem_package_inspect)",
  "path('api/cppro/problems/<str:identifier>/package.zip', cppro_api.cppro_problem_package_download)",
  "path('api/cppro/problems/<str:identifier>/testcases/import', cppro_api.cppro_problem_testcase_import)",
  "path('api/cppro/submissions/verification-challenge', cppro_api.cppro_submission_verification_challenge)",
  "path('api/cppro/admin/badges', cppro_api.cppro_admin_management, {'section': 'badges'})",
]) {
  assert.ok(urls.includes(route), `Missing LCOJ management API route: ${route}`);
}
assert.ok(
  urls.indexOf("'api/cppro/problems/<str:identifier>/testcases'")
    < urls.indexOf("path('api/cppro/problems/<str:identifier>', cppro_api.cppro_problems)"),
  'The protected testcase route must precede generic problem detail.',
);
assert.doesNotMatch(nginx, /\(admin\|management\|api\|accounts\|channels/, 'Localized /management must not be sent to Django.');
assert.match(nginx, /location ~ \^\/\(vi\|en\)\(\/\.\*\)\?\$/, 'Localized CPPro SPA fallback is required.');
assert.match(
  nginx,
  /location ~ \^\/\([^)]*management[^)]*\)\(\/\.\*\)\?\$ \{[\s\S]{0,180}try_files \/index\.html @uwsgi;/,
  'Direct /management loads and refreshes must use the CPPro SPA fallback.',
);
assert.doesNotMatch(deploy, /cppro-public-shell/, 'Deployment smoke must not depend on a removed static marker.');
assert.match(deploy, /smoke_spa \/ \/tmp\/lcojcppro-home\.html/, 'Deployment must smoke-test the CPPro root.');
assert.match(deploy, /smoke_spa \/management \/tmp\/lcojcppro-management\.html/, 'Deployment must smoke-test direct CPPro management loads.');
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
assert.match(bridge, /def cppro_problem_testcase_import\(request, identifier\):/, 'Bridge must import testcase ZIPs for an existing problem.');
assert.match(bridge, /def cppro_problem_package_inspect\(request\):/, 'Bridge must inspect full problem packages before saving.');
assert.match(bridge, /def cppro_problem_package_download\(request, identifier\):/, 'Bridge must export the current problem package.');
assert.match(bridge, /def cppro_submission_verification_challenge\(request\):/, 'Bridge must issue server-side submission challenges.');
assert.match(bridge, /def _consume_submission_verification\(/, 'Bridge must validate a submitted challenge server-side.');
assert.match(bridge, /verification_error = _consume_submission_verification\(request, profile, payload\)/, 'Submissions must consume a one-time server-side challenge.');
assert.match(bridge, /def _problem_testcase_material_rows\(problem\):/, 'Problem managers must receive protected testcase source material.');
assert.match(bridge, /def _submission_problem_testcase_materials\(problem\):/, 'Submission detail must map manager testcase material into judge rows.');
assert.match(bridge, /def _visible_contests_for_user\(user\):[\s\S]{0,320}Contest\.get_visible_contests\(user\)/, 'Public contest routes must use DMOJ private-contest visibility rules.');
assert.match(bridge, /def _visible_submission_queryset\(user\):[\s\S]{0,900}Problem\.get_visible_problems\(user\)/, 'Public submission rows must use DMOJ problem visibility rules.');
assert.match(bridge, /def _visible_submission_queryset\(user\):[\s\S]{0,1400}_visible_contests_for_user\(user\)[\s\S]{0,240}can_see_full_submission_list\(user\)/, 'Submission rows must also honor native contest submission-list visibility.');
assert.match(bridge, /def _can_view_contest_problems\(contest, request_user, profile=None\):[\s\S]{0,700}contest\.is_in_contest\(request_user\)/, 'Active contest problem identities must require participation or management access.');
assert.match(bridge, /def _public_profile_row\(profile, submission_count=0\):[\s\S]{0,140}row\.pop\('email', None\)/, 'Public profile rows must redact email addresses.');
assert.match(bridge, /def _profile_organization\(profile, include_unlisted=False\):[\s\S]{0,420}public_organizations[\s\S]{0,300}not organization\.is_unlisted/, 'Public profile and standings rows must redact unlisted organization affiliations.');
assert.match(bridge, /visible_submission_counts = dict\([\s\S]{0,1800}_public_profile_row\(profile, visible_submission_counts\.get\(profile\.id, 0\)\)/, 'Public profile submission totals must use only viewer-visible rows.');
assert.match(bridge, /def _organization_member_row\(profile, role='member', include_email=False\):[\s\S]{0,500}if include_email:/, 'Organization member email must be opt-in for managers only.');
assert.match(bridge, /def _find_blog_post\(request, identifier\):[\s\S]{0,420}post\.can_see\(request\.user\)/, 'Post comments and reactions must honor native post visibility.');
assert.match(bridge, /def _visible_registered_posts\(kind, request_user, limit=24\):[\s\S]{0,620}post\.can_see\(request_user\)/, 'Community feeds must honor native post visibility too.');
assert.match(bridge, /def _can_view_submission_context\(submission, request_user\):[\s\S]{0,700}_visible_contests_for_user\(request_user\)/, 'Submission detail must retain private contest visibility boundaries.');
assert.match(bridge, /def _can_view_submission_context\(submission, request_user\):[\s\S]{0,1100}contest\.can_see_full_submission_list\(request_user\)/, 'Direct submission IDs must honor frozen and hidden contest submission-list rules.');
assert.match(bridge, /submission\.can_see_detail\(request\.user\)[\s\S]{0,180}_can_view_submission_context\(submission, request\.user\)[\s\S]{0,100}return _json_error\('Submission not found\.', 404\)/, 'Submission detail must not leak private metadata based on an ID alone.');
assert.match(bridge, /can_view_judge_log = bool\([\s\S]{0,420}submission\.status != 'IE'[\s\S]{0,900}'judge_log': \(submission\.error or ''\) if can_view_judge_log else ''/, 'Internal judge diagnostics must stay manager-only.');
assert.match(bridge, /judge_warning = 'The submission could not be queued for judging\. Please try again shortly\.'/ , 'Submission queue failures must not return raw infrastructure exceptions.');
assert.match(bridge, /def _contest_participation_row\(participation, frozen=False\):[\s\S]{0,720}participation\.frozen_score if frozen/, 'Frozen contest rows must use frozen scores.');
assert.match(bridge, /def _contest_payload\(request, contest\):[\s\S]{0,1800}row\['participant_users'\] = \[\][\s\S]{0,180}if can_view_full:/, 'Contest detail must not expose participants without scoreboard access.');
assert.match(bridge, /def _contest_scoreboard_access\(contest, request_user\):[\s\S]{0,420}_is_platform_admin\(request_user\)[\s\S]{0,240}can_view_full = bool\(can_edit or contest\.can_see_full_scoreboard/, 'CPPro platform staff must have consistent contest management and full-scoreboard access.');
assert.match(bridge, /if contest\.require_registration and not contest\.can_register and existing_live is None:[\s\S]{0,120}Contest registration is required before joining\./, 'Joining must enforce a closed registration window.');
assert.ok(
  bridge.indexOf('if admin_context and _can_manage_problem(request_user, submission.problem):')
    < bridge.indexOf('if _active_contests_for_problem(submission.problem).exists():'),
  'Problem managers must retain testcase access while a contest scoreboard is frozen.',
);

console.log('LCOJ bridge contract passed: distinct admin routes, protected testcase access, and CSRF-safe mutations.');
