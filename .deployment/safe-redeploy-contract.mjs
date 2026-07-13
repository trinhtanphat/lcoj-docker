import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const deploymentRoot = path.dirname(fileURLToPath(import.meta.url));
const script = await readFile(path.join(deploymentRoot, 'safe-redeploy-lcojcppro-vps.sh'), 'utf8');

assert.match(script, /set -Eeuo pipefail/, 'Deploy failures must propagate into the recovery trap.');
assert.match(script, /umask 077/, 'Deploy artifacts and backups must default to owner-only permissions.');
assert.match(script, /compose config --quiet/, 'Compose interpolation must be validated without logging resolved secrets.');
assert.match(script, /com\.docker\.compose\.project/, 'Existing fixed-name containers must be checked against the requested Compose project.');
assert.match(script, /chmod 600 "\$DB_BACKUP"/, 'The database backup must be owner-readable only.');
assert.match(script, /MYSQL_PWD="\$MYSQL_ROOT_PASSWORD" exec "\$dump_bin"/, 'The database password must not be printed as a dump command argument.');
assert.match(script, /trap recover_on_exit EXIT/, 'A failed deploy must arm an EXIT recovery path.');
assert.match(script, /Deploy failed[\s\S]{0,420}compose up -d db redis site celery bridged judge wsevent nginx/, 'Recovery must attempt to restart the complete existing stack.');
assert.doesNotMatch(script, /compose down/, 'The deploy must preserve the database, networks, and volumes during migration.');
assert.doesNotMatch(script, /set -x|cat\s+environment\/|compose config\s*(?:\n|$)/, 'The deploy log must not print secret-bearing environment/config content.');

const backup = script.indexOf('backup_database\n');
const build = script.indexOf('compose build base', backup);
const stop = script.indexOf('compose stop nginx', backup);
const migrate = script.indexOf('manage.py migrate --noinput', backup);
assert.ok(backup >= 0 && build > backup && stop > build && migrate > stop, 'Backup must precede build, downtime, and migration; build must finish before downtime.');

console.log('safe redeploy contract passed: preflight, secure backup, bounded downtime, and failure restart are enforced.');
