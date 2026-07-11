#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const forkRoot = path.resolve(appRoot, '..');
const dmojRoot = path.join(forkRoot, 'dmoj', 'repo');

const [main, nginx, bridge, deploy] = await Promise.all([
  readFile(path.join(appRoot, 'src', 'main.tsx'), 'utf8'),
  readFile(path.join(forkRoot, 'dmoj', 'nginx', 'conf.d', 'nginx.conf'), 'utf8'),
  readFile(path.join(dmojRoot, 'judge', 'views', 'cppro_api.py'), 'utf8'),
  readFile(path.join(forkRoot, '.deployment', 'safe-redeploy-lcojcppro-vps.sh'), 'utf8'),
]);

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `Cannot locate ${startMarker}.`);
  return source.slice(start, end);
}

const legacySelector = section(main, 'function shouldUseLcojLegacyRoutes()', 'type CpproFetchInit');
assert.match(legacySelector, /return shouldUseStaticCpproData\(\);/, 'Only offline static preview may use legacy navigation.');
assert.doesNotMatch(legacySelector, /isLcojBackendMode\(\)/, 'LCOJ must use CPPro as its public frontend.');

const logout = section(main, 'const logout = async () => {', "if (path === '/logout')");
assert.match(logout, /isLcojBackendMode\(\)/, 'LCOJ logout must invalidate its Django session.');
assert.match(logout, /cpproApiFetch\('\/auth\/logout'/, 'Logout must use the CSRF-protected CPPro bridge.');
assert.match(logout, /clearPlatformBridgeSession\(\)/, 'Logout must clear the browser bridge state.');
assert.match(logout, /go\('\/login'\)/, 'Logout must return to the CPPro login screen.');
assert.match(main, /if \(path === '\/logout'\) \{[\s\S]{0,180}<CpproLogoutPage/, 'The old logout URL must have a CPPro page that completes logout.');

const authPreview = section(main, 'function AuthPreviewCrawl({', 'function DataLoadingPanel(');
assert.match(authPreview, /cpproApiFetch<[\s\S]{0,180}\('\/auth\/login'/, 'Login form must call the CPPro bridge.');
assert.match(authPreview, /cpproApiFetch<[\s\S]{0,180}\('\/auth\/register'/, 'Registration form must call the CPPro bridge.');
assert.match(authPreview, /twoFactorCode: twoFactorCode\.trim\(\)/, 'The CPPro login form must submit the second factor only to the CPPro bridge.');
assert.match(authPreview, /data-auth-two-factor/, 'The CPPro login screen must present a second-factor field when required.');
assert.doesNotMatch(authPreview, /openLcojLegacyPath\(/, 'Auth form must never send users back to Django templates.');
assert.match(main, /className="ghost-login" onClick=\{\(\) => go\(authPathWithReturn\('login'\)\)\}/, 'Topbar login must remain in CPPro.');
assert.match(main, /className="primary-login" onClick=\{\(\) => go\('\/register'\)\}/, 'Topbar registration must remain in CPPro.');
assert.doesNotMatch(main, /\/accounts\/(login|register|logout)\//, 'No CPPro UI link may target a native DMOJ auth page.');
const pathNormalizer = section(main, 'function normalizeCpproPublicPath(pathname: string)', 'function isCpproPublicAuthAlias');
assert.match(pathNormalizer, /const authAlias = cleanPath\.match/, 'Legacy auth aliases must be normalized in the client.');
assert.match(pathNormalizer, /login\|register\|logout/, 'All public auth aliases must normalize to CPPro routes.');
assert.match(pathNormalizer, /return `\/\$\{authAlias\[1\]\}`;/, 'Auth aliases must resolve to the CPPro route name.');
assert.match(main, /if \(isCpproPublicAuthAlias\(window\.location\.pathname\)\) return;/, 'Direct /accounts auth URLs must stay on their current CPPro origin.');

const adminHandler = section(main, 'const openLegacyAdminRoute = () => {', 'const adminRoles =');
assert.match(adminHandler, /isLcojBackendMode\(\)/, 'Only LCOJ deployment may use the native admin path.');
assert.match(adminHandler, /openLcojLegacyPath\('\/admin\/'\)/, 'DMOJ admin must remain a hard navigation.');
assert.doesNotMatch(adminHandler, /\bgo\(/, 'The native admin path must not be handled by the SPA router.');
assert.match(main, /function CpproManagementPage\([\s\S]{0,60000}if \(!isAdmin\) \{[\s\S]{0,640}Administrator access required/, 'The CPPro management UI must deny non-admin users before rendering management data.');

for (const fragment of [
  'location ~ ^/accounts/(login|register|logout)/?$',
  'location ~ ^/(vi|en)/accounts/(login|register|logout)/?$',
  'location ~ ^/(problem|contest|user|organization|submission)(/.*)?$',
  'try_files /index.html @uwsgi;',
]) {
  assert.ok(nginx.includes(fragment), `Missing CPPro compatibility route: ${fragment}`);
}
assert.match(nginx, /location ~ \^\/\(management\|problems[\s\S]{0,180}\|login\|register\|logout\)/, 'Direct public auth routes must resolve to the SPA.');
assert.ok(nginx.indexOf('location ~ ^/accounts/(login|register|logout)') < nginx.indexOf('location ~ ^/(vi|en)/(admin|api|accounts'), 'CPPro auth aliases must precede Django accounts routing.');
assert.ok(nginx.includes('location @uwsgi'), 'Django backend remains available for APIs and native admin.');

for (const fragment of [
  'def cppro_auth_login(request):',
  'def cppro_auth_logout(request):',
  'def _require_platform_admin(request):',
  'def cppro_admin_management(request, section, identifier=None):',
]) {
  assert.ok(bridge.includes(fragment), `Missing backend authorization boundary: ${fragment}`);
}
assert.match(bridge, /@csrf_protect\s*@require_http_methods\(\['POST'\]\)\s*def cppro_auth_login/, 'Login must be CSRF-protected.');
assert.match(bridge, /@csrf_protect\s*@require_http_methods\(\['POST'\]\)\s*def cppro_auth_logout/, 'Logout must be CSRF-protected.');
assert.match(bridge, /requires_two_factor = bool\(profile\.is_totp_enabled or profile\.is_webauthn_enabled\)/, 'CPPro login must not bypass an enabled second factor.');
assert.match(bridge, /'twoFactorRequired': True/, 'CPPro login must explicitly request the second factor before creating a session.');
assert.match(bridge, /request\.session\.pop\('2fa_passed', None\)[\s\S]{0,300}if requires_two_factor:[\s\S]{0,140}request\.session\['2fa_passed'\] = True/, 'Only a validated current two-factor login may mark the session as passed.');
assert.match(bridge, /def _is_platform_admin\(user\):[\s\S]{0,100}user\.is_authenticated and user\.is_staff/, 'CPPro management must require an authenticated staff user.');
assert.match(bridge, /def cppro_admin_management\([\s\S]{0,180}denied = _require_platform_admin\(request\)/, 'Management endpoint must enforce staff authorization before returning data.');

for (const fragment of [
  'smoke_spa /accounts/login/',
  'smoke_spa /accounts/register/',
  'smoke_spa /accounts/logout/',
]) {
  assert.ok(deploy.includes(fragment), `Deployment must verify ${fragment}.`);
}

console.log('public-auth contract passed: CPPro owns public auth; Django remains only the protected admin/backend.');
