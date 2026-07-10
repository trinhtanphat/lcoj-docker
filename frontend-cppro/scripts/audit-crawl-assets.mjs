import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(appRoot, '..');
const crawlRoot = path.join(repoRoot, '.worktrees', 'crawl', 'cloned_site', 'oj.cppro.vn');
const crawlManifest = path.join(repoRoot, '.worktrees', 'crawl', 'cloned_site', 'manifests', 'oj.cppro.vn-playwright.json');
const crawlAssets = path.join(crawlRoot, 'assets');
const publicAssets = path.join(appRoot, 'public', 'assets');
const publicManifest = path.join(appRoot, 'public', 'manifests', 'oj.cppro.vn-playwright.json');
const dataFile = path.join(appRoot, 'public', 'data', 'cppro.json');
const indexHtml = path.join(appRoot, 'index.html');
const mainTsx = path.join(appRoot, 'src', 'main.tsx');

const requiredCrawlStyles = [
  'src-Bai9RFsA.css',
  'MarkdownRenderer-CLe1-_kK.css',
];

const forbiddenFrontendPatterns = [
  /frontend[\\/]+src/i,
  /frontend[\\/]+src[\\/]+styles[\\/]+globals\.css/i,
  /src[\\/]+styles[\\/]+globals\.css/i,
  /\.\.[\\/]+\.\.[\\/]+frontend/i,
  /\.\.[\\/]+frontend/i,
  /from\s+['"][^'"]*frontend[\\/]/i,
  /@import\s+['"][^'"]*frontend[\\/]/i,
];

function fail(message) {
  throw new Error(message);
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function walkFiles(root, ignored = new Set()) {
  const files = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  };
  visit(root);
  return files;
}

if (!existsSync(crawlAssets)) {
  fail(`Missing crawl assets directory: ${path.relative(repoRoot, crawlAssets)}`);
}

if (!existsSync(publicAssets)) {
  fail(`Missing frontend-cppro public assets directory: ${path.relative(repoRoot, publicAssets)}`);
}

if (!existsSync(crawlManifest)) {
  fail(`Missing crawl manifest: ${path.relative(repoRoot, crawlManifest)}`);
}

if (!existsSync(publicManifest)) {
  fail(`Missing copied crawl manifest: ${path.relative(repoRoot, publicManifest)}`);
}

if (sha256(crawlManifest) !== sha256(publicManifest)) {
  fail('Copied CPPro crawl manifest differs from source');
}

const crawlAssetFiles = walkFiles(crawlAssets).sort();
const copiedAssets = [];
for (const sourceFile of crawlAssetFiles) {
  const relative = path.relative(crawlAssets, sourceFile);
  const targetFile = path.join(publicAssets, relative);
  if (!existsSync(targetFile)) {
    fail(`Missing copied crawl asset: frontend-cppro/public/assets/${relative.replaceAll(path.sep, '/')}`);
  }
  const sourceStat = statSync(sourceFile);
  const targetStat = statSync(targetFile);
  if (sourceStat.size !== targetStat.size || sha256(sourceFile) !== sha256(targetFile)) {
    fail(`Copied crawl asset differs from source: frontend-cppro/public/assets/${relative.replaceAll(path.sep, '/')}`);
  }
  copiedAssets.push(relative);
}

const html = readFileSync(indexHtml, 'utf8');
for (const stylesheet of requiredCrawlStyles) {
  if (!html.includes(`/assets/${stylesheet}`)) {
    fail(`index.html must load crawl stylesheet /assets/${stylesheet}`);
  }
}
if (!html.includes('Source+Sans+3') || !html.includes('JetBrains+Mono')) {
  fail('index.html must load the crawl font families Source Sans 3 and JetBrains Mono');
}

if (!existsSync(dataFile)) {
  fail(`Missing crawl data file: ${path.relative(repoRoot, dataFile)}`);
}

const data = JSON.parse(readFileSync(dataFile, 'utf8'));
const manifest = JSON.parse(readFileSync(publicManifest, 'utf8'));
if (Number(manifest.summary?.total ?? 0) !== 311) {
  fail(`CPPro crawl manifest total mismatch: ${manifest.summary?.total}`);
}

const requiredDataMinimums = {
  capturedProblems: 50,
  problemDetails: 8,
  contests: 34,
  users: 500,
  submissions: 20,
  exams: 30,
  tags: 50,
  courses: 1,
  hsgCategories: 10,
};
for (const [key, minimum] of Object.entries(requiredDataMinimums)) {
  const value = Number(data.stats?.[key] ?? 0);
  if (value < minimum) {
    fail(`Crawl data is unexpectedly small: stats.${key}=${value}, expected at least ${minimum}`);
  }
}
if (!Array.isArray(data.problems) || data.problems.length !== Number(data.stats?.capturedProblems)) {
  fail('Crawl data stats.capturedProblems must match problems.length');
}
for (const requiredSlug of ['lazynarek', 'duoibat', 'ts10_gialai2026']) {
  const source = requiredSlug.startsWith('ts10_') ? data.contestDetails : data.problemDetails;
  if (!source?.[requiredSlug]) {
    fail(`Crawl data is missing required detail entry: ${requiredSlug}`);
  }
}

const mainSource = readFileSync(mainTsx, 'utf8');
const styleSource = readFileSync(path.join(appRoot, 'src', 'styles.css'), 'utf8');
if (!mainSource.includes('judge-type-scale app-shell')) {
  fail('App root must include judge-type-scale so crawl typography/layout utilities apply');
}
if (!mainSource.includes("classList.toggle('dark'") && !mainSource.includes('classList.toggle("dark"')) {
  fail('Theme code must toggle html.dark because crawl CSS dark variants depend on it');
}
if (!mainSource.includes('auth-logo') || !mainSource.includes('auth-card') || !mainSource.includes('auth-switch')) {
  fail('Auth routes must keep the crawled CPPro auth class names');
}
if (!mainSource.includes('data-crawl-backdrop')) {
  fail('Backdrop must keep crawled utility classes and use data-crawl-backdrop instead of cppro-* classes');
}

function findForbiddenClassUsage(file, content, prefix) {
  const matches = [];
  const patterns = [
    new RegExp(`className=(?:"[^"]*|\\{\`[^\`]*)((${prefix})-[A-Za-z0-9_-]+)`, 'g'),
    new RegExp(`class=(?:"[^"]*|\\{\`[^\`]*)((${prefix})-[A-Za-z0-9_-]+)`, 'g'),
    new RegExp(`\\.((?:${prefix})-[A-Za-z0-9_-]+)`, 'g'),
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      matches.push(match[1]);
    }
  }
  return [...new Set(matches)].sort().map((className) => `${file}:${className}`);
}

const sourceFiles = walkFiles(appRoot, new Set(['node_modules', 'dist']));
for (const file of sourceFiles) {
  const relative = path.relative(repoRoot, file).replaceAll(path.sep, '/');
  if (!/\.(tsx?|jsx?|css|html|json|mjs|cjs)$/.test(file)) continue;
  const content = readFileSync(file, 'utf8');
  for (const pattern of forbiddenFrontendPatterns) {
    if (pattern.test(content)) {
      fail(`Forbidden old frontend reference in ${relative}: ${pattern}`);
    }
  }
}

const forbiddenCpproClassUsages = [
  [mainTsx, mainSource],
  [path.join(appRoot, 'src', 'styles.css'), styleSource],
].flatMap(([file, content]) => findForbiddenClassUsage(path.relative(repoRoot, file).replaceAll(path.sep, '/'), content, 'cppro'));
if (forbiddenCpproClassUsages.length > 0) {
  fail(`CPPro mirror should not render/use cppro-* CSS classes; use crawled utility classes or data-* selectors instead: ${forbiddenCpproClassUsages.join(', ')}`);
}

const forbiddenSignedClassUsages = [
  [mainTsx, mainSource],
  [path.join(appRoot, 'src', 'styles.css'), styleSource],
].flatMap(([file, content]) => findForbiddenClassUsage(path.relative(repoRoot, file).replaceAll(path.sep, '/'), content, 'signed'));
if (forbiddenSignedClassUsages.length > 0) {
  fail(`Signed-in CPPro home should not render/use signed-* CSS classes; use crawled utility classes or data-* selectors instead: ${forbiddenSignedClassUsages.join(', ')}`);
}

const forbiddenOriginalClassUsages = [
  [mainTsx, mainSource],
  [path.join(appRoot, 'src', 'styles.css'), styleSource],
].flatMap(([file, content]) => findForbiddenClassUsage(path.relative(repoRoot, file).replaceAll(path.sep, '/'), content, 'original'));
if (forbiddenOriginalClassUsages.length > 0) {
  fail(`CPPro original-home mirror should not render/use original-* CSS classes; use crawled utility classes or data-* selectors instead: ${forbiddenOriginalClassUsages.join(', ')}`);
}

const cssAssets = copiedAssets.filter((file) => file.endsWith('.css')).length;
const jsAssets = copiedAssets.filter((file) => file.endsWith('.js')).length;
console.log(JSON.stringify({
  ok: true,
  crawlRoot: path.relative(repoRoot, crawlRoot).replaceAll(path.sep, '/'),
  manifest: path.relative(repoRoot, publicManifest).replaceAll(path.sep, '/'),
  manifestTotal: manifest.summary.total,
  copiedAssets: copiedAssets.length,
  cssAssets,
  jsAssets,
  requiredCrawlStyles,
  dataStats: data.stats,
}, null, 2));
