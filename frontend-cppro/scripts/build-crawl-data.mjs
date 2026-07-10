import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(appRoot, '..');
const crawlRoot = path.join(repoRoot, '.worktrees', 'crawl', 'cloned_site', 'oj.cppro.vn');
const apiRoot = path.join(crawlRoot, 'api');
const outputFile = path.join(appRoot, 'public', 'data', 'cppro.json');

const sourcePayloads = [];

function fail(message) {
  throw new Error(message);
}

function readJson(relativePath, options = {}) {
  const file = path.join(apiRoot, relativePath);
  if (!existsSync(file)) {
    if (options.optional) return options.defaultValue;
    fail(`Missing crawl API capture: ${path.relative(repoRoot, file)}`);
  }
  const text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const payload = JSON.parse(text);
  sourcePayloads.push(payload);
  return payload;
}

function readJsonFile(file) {
  const payload = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  sourcePayloads.push(payload);
  return payload;
}

function htmlFilesIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

function indexFilesInChildDirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dir, entry.name, 'index.html'))
    .filter((file) => existsSync(file))
    .sort();
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function compactArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function mapTags(tags) {
  return compactArray(tags).map((tag, index) => ({
    id: toNumber(tag.id, index + 1),
    name: toString(tag.name || tag.slug || tag, 'Tag'),
    slug: toString(tag.slug || tag.name || tag, `tag-${index + 1}`),
  }));
}

function mapProblem(row) {
  const slug = toString(row.slug || row.problem_slug || row.problem_code || row.code || row.id);
  return {
    id: toNumber(row.id || row.problem, 0),
    code: toString(row.problem_code || row.code || slug),
    slug,
    title: toString(row.title || row.problem_title || slug, slug),
    difficulty: toString(row.difficulty || row.difficulty_tag || 'easy', 'easy'),
    score: toNumber(row.full_score ?? row.score ?? row.points, 0),
    source: toString(row.source_name || row.source_detail || row.source || 'CPPro', 'CPPro'),
    timeLimitMs: toNumber(row.time_limit_ms ?? row.timeLimitMs, 1000),
    memoryLimitMb: toNumber(row.memory_limit_mb ?? row.memoryLimitMb, 256),
    accepted: toNumber(row.accepted_count ?? row.accepted, 0),
    submissions: toNumber(row.submission_count ?? row.submissions, 0),
    solvers: toNumber(row.solver_count ?? row.solvers, 0),
    tags: mapTags(row.tags),
    statement: row.statement || undefined,
    inputDescription: row.input_description || row.inputDescription || undefined,
    outputDescription: row.output_description || row.outputDescription || undefined,
    constraints: row.constraints || undefined,
    editorial: row.editorial || undefined,
    createdBy: row.created_by_username || row.createdBy || undefined,
  };
}

function mergeProblem(base, detail) {
  return {
    ...base,
    ...detail,
    tags: detail.tags?.length ? detail.tags : base.tags,
    accepted: detail.accepted || base.accepted,
    submissions: detail.submissions || base.submissions,
    solvers: detail.solvers || base.solvers,
  };
}

function mapContestProblem(row) {
  return {
    id: toNumber(row.id, 0),
    problem: toNumber(row.problem, 0),
    problem_code: row.problem_code || row.problem_slug_snapshot || undefined,
    order_index: toNumber(row.order_index, 0),
    points: row.points ?? row.full_score_snapshot ?? 0,
    problem_title_snapshot: row.problem_title_snapshot || row.title || undefined,
    problem_slug_snapshot: row.problem_slug_snapshot || row.slug || row.problem_code || undefined,
    difficulty_tag: row.difficulty_tag || undefined,
    time_limit_ms_snapshot: row.time_limit_ms_snapshot || undefined,
    memory_limit_mb_snapshot: row.memory_limit_mb_snapshot || undefined,
    my_status: row.my_status || undefined,
    my_best_verdict: row.my_best_verdict || null,
  };
}

function mapContest(row) {
  const problems = compactArray(row.problems).map(mapContestProblem);
  return {
    id: toNumber(row.id, 0),
    slug: toString(row.slug || row.id),
    title: toString(row.title || row.slug || row.id, 'Contest'),
    scope: row.scope || undefined,
    accessType: row.access_type || row.accessType || undefined,
    format: row.contest_format || row.format || undefined,
    startTime: row.start_time || row.startTime || undefined,
    endTime: row.end_time || row.endTime || undefined,
    durationMinutes: toNumber(row.duration_minutes ?? row.durationMinutes, 0),
    participants: toNumber(row.participant_count ?? row.participants, 0),
    virtualParticipants: toNumber(row.virtual_participant_count ?? row.virtualParticipants, 0),
    problemCount: toNumber(row.problem_count ?? problems.length, problems.length),
    status: toString(row.status || 'published', 'published'),
    description: row.description || undefined,
    problems,
    isRated: Boolean(row.is_rated || row.has_rating),
    scoreboardFreezeMode: row.scoreboard_freeze_mode || undefined,
    scoreboardFreezeTime: row.scoreboard_freeze_time || undefined,
  };
}

function mergeContest(base, detail) {
  return {
    ...base,
    ...detail,
    problems: detail.problems?.length ? detail.problems : base.problems,
    problemCount: detail.problemCount || base.problemCount,
    participants: detail.participants || base.participants,
    virtualParticipants: detail.virtualParticipants || base.virtualParticipants,
  };
}

function mapUser(row) {
  const username = toString(row.username || row.user || '').trim();
  return {
    username,
    fullName: toString(row.full_name || row.fullName || row.displayName || username, username),
    avatarUrl: row.avatar_url ?? row.avatarUrl ?? null,
    rating: toNumber(row.rating, 0),
    score: toNumber(row.pp_score ?? row.score, 0),
    solved: toNumber(row.solved, 0),
    streak: toNumber(row.streak, 0),
    rankName: toString(row.rank_name || row.rankName || row.color_of_name || '', ''),
    tags: compactArray(row.tags).map(String),
    proTier: toString(row.pro_tier || row.proTier || '', ''),
    bio: row.bio || undefined,
    maxRating: toNumber(row.max_rating ?? row.maxRating, toNumber(row.rating, 0)),
    contestCount: toNumber(row.contest_count ?? row.contestCount, 0),
    totalSubmissions: toNumber(row.total_submissions ?? row.totalSubmissions, 0),
  };
}

function mapSubmission(row) {
  return {
    id: toNumber(row.id, 0),
    username: toString(row.username || row.user_username || row.user || 'unknown', 'unknown'),
    problemTitle: toString(row.problem_title || row.problemTitle || row.problem_slug || 'Bai tap', 'Bai tap'),
    problemSlug: toString(row.problem_slug || row.problemSlug || row.contest_problem_code || row.problem || ''),
    contestTitle: row.contest_title || row.contestTitle || undefined,
    contestSlug: row.contest_slug || row.contestSlug || undefined,
    language: toString(row.language_name || row.language_code || row.language || 'C++17', 'C++17'),
    verdict: toString(row.verdict || row.status || 'completed', 'completed'),
    score: toString(row.score ?? row.raw_score ?? '0.00', '0.00'),
    maxScore: toString(row.max_score ?? row.raw_max_score ?? '100.00', '100.00'),
    passed: toNumber(row.passed_test_count ?? row.passed, 0),
    total: toNumber(row.total_test_count ?? row.total, 0),
    timeMs: toNumber(row.time_used_ms ?? row.timeMs, 0),
    memoryKb: toNumber(row.memory_used_kb ?? row.memoryKb, 0),
    submittedAt: toString(row.submitted_at || row.judged_at || row.submittedAt || '', ''),
  };
}

function mapCourse(row) {
  return {
    id: toNumber(row.id, 0),
    name: toString(row.name || row.slug || 'Course', 'Course'),
    slug: toString(row.slug || row.id),
    short_description: toString(row.short_description || row.description || '', ''),
    banner: toString(row.banner || row.thumbnail || '', ''),
    theme_color: toString(row.theme_color || '#2563EB', '#2563EB'),
    url_apply: row.url_apply ?? null,
    price: toNumber(row.price, 0),
    duration_months: toNumber(row.duration_months, 0),
    sessions_per_month: toNumber(row.sessions_per_month, 0),
    schedule_note: toString(row.schedule_note || '', ''),
    status: toString(row.status || 'upcoming', 'upcoming'),
    language: toString(row.language || 'C++', 'C++'),
  };
}

function collectIsoDates(value, into = []) {
  if (!value || typeof value !== 'object') return into;
  if (Array.isArray(value)) {
    for (const item of value) collectIsoDates(item, into);
    return into;
  }
  for (const [key, child] of Object.entries(value)) {
    const isCaptureTimestamp =
      key === 'created_at'
      || key === 'updated_at'
      || key === 'submitted_at'
      || key === 'judged_at'
      || key === 'standings_updated_at'
      || key === 'judging_started_at'
      || key === 'judging_finished_at';
    if (isCaptureTimestamp && typeof child === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(child)) {
      const time = new Date(child).getTime();
      if (Number.isFinite(time)) into.push(time);
    } else if (child && typeof child === 'object') {
      collectIsoDates(child, into);
    }
  }
  return into;
}

function latestSourceTimestamp() {
  const times = sourcePayloads.flatMap((payload) => collectIsoDates(payload));
  if (times.length) return new Date(Math.max(...times)).toISOString();

  const crawlStat = statSync(crawlRoot);
  return crawlStat.mtime.toISOString();
}

if (!existsSync(apiRoot)) {
  fail(`Missing crawl API root: ${path.relative(repoRoot, apiRoot)}`);
}

const problemRowsBySlug = new Map();
let problemTotal = 0;
for (const file of htmlFilesIn(path.join(apiRoot, 'judge', 'problems'))) {
  const payload = readJsonFile(file);
  const rows = Array.isArray(payload) ? payload : compactArray(payload.results);
  problemTotal = Math.max(problemTotal, toNumber(payload.count, rows.length));
  for (const row of rows) {
    const problem = mapProblem(row);
    if (!problemRowsBySlug.has(problem.slug)) problemRowsBySlug.set(problem.slug, problem);
  }
}

const problemDetails = {};
for (const file of indexFilesInChildDirs(path.join(apiRoot, 'judge', 'problems'))) {
  const detail = mapProblem(readJsonFile(file));
  if (detail.slug) problemDetails[detail.slug] = detail;
}

for (const [slug, detail] of Object.entries(problemDetails)) {
  const existing = problemRowsBySlug.get(slug);
  problemRowsBySlug.set(slug, existing ? mergeProblem(existing, detail) : detail);
}
const problems = [...problemRowsBySlug.values()];

const contestRowsBySlug = new Map();
for (const file of htmlFilesIn(path.join(apiRoot, 'judge', 'contests'))) {
  const payload = readJsonFile(file);
  const rows = Array.isArray(payload) ? payload : compactArray(payload.results);
  for (const row of rows) {
    const contest = mapContest(row);
    if (!contestRowsBySlug.has(contest.slug)) contestRowsBySlug.set(contest.slug, contest);
  }
}

const contestDetails = {};
for (const file of indexFilesInChildDirs(path.join(apiRoot, 'judge', 'contests'))) {
  const detail = mapContest(readJsonFile(file));
  if (detail.slug) contestDetails[detail.slug] = detail;
}

for (const [slug, detail] of Object.entries(contestDetails)) {
  const existing = contestRowsBySlug.get(slug);
  contestRowsBySlug.set(slug, existing ? mergeContest(existing, detail) : detail);
}
const contests = [...contestRowsBySlug.values()];

const leaderboard = readJson('auth/leaderboard/index.html');
const usersByName = new Map(compactArray(leaderboard).map((row) => {
  const user = mapUser(row);
  return [user.username, user];
}).filter(([username]) => username));

const profiles = {};
for (const file of indexFilesInChildDirs(path.join(apiRoot, 'auth', 'profile'))) {
  const profile = mapUser(readJsonFile(file));
  if (!profile.username) continue;
  const existing = usersByName.get(profile.username);
  const merged = existing ? { ...existing, ...profile, tags: profile.tags.length ? profile.tags : existing.tags } : profile;
  usersByName.set(profile.username, merged);
  profiles[profile.username] = merged;
}
const users = [...usersByName.values()];

const submissionPayload = readJson('judge/submissions/index__q_51e37fdc9371.html');
const liveSubmissionPayload = readJson('judge/submissions/live/index__q_6f30842f8b18.html', { optional: true, defaultValue: {} });
const submissionsById = new Map();
for (const row of [
  ...compactArray(submissionPayload.results),
  ...compactArray(liveSubmissionPayload.results),
  ...compactArray(liveSubmissionPayload.updates),
]) {
  const submission = mapSubmission(row);
  if (submission.id) submissionsById.set(submission.id, submission);
}
const submissions = [...submissionsById.values()]
  .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());

const tags = compactArray(readJson('judge/problem-tags/index.html')).map((tag, index) => ({
  id: toNumber(tag.id, index + 1),
  name: toString(tag.name || tag.slug || `Tag ${index + 1}`),
  slug: toString(tag.slug || tag.name || `tag-${index + 1}`),
}));

const hsgCategories = compactArray(readJson('judge/exam-categories/index.html')).map((category) => ({
  id: toNumber(category.id, 0),
  name: toString(category.name || category.id),
  description: category.description || undefined,
  icon: category.icon || undefined,
  order: toNumber(category.order, 0),
  paper_count: toNumber(category.paper_count, 0),
  is_default: Boolean(category.is_default),
  color_config: category.color_config || undefined,
}));

const exams = compactArray(readJson('judge/exam-papers/index.html')).map((exam) => ({
  id: toNumber(exam.id, 0),
  title: toString(exam.title || exam.contest_title || exam.id),
  category: toNumber(exam.category, 0),
  category_detail: exam.category_detail || undefined,
  contest_slug: toString(exam.contest_slug || ''),
  contest_title: exam.contest_title || undefined,
  year: toNumber(exam.year, 0),
  exam_date: toString(exam.exam_date || ''),
  total_problems: toNumber(exam.total_problems, 0),
  solved_problems: toNumber(exam.solved_problems, 0),
  attempted_problems: toNumber(exam.attempted_problems, 0),
  progress_percent: toNumber(exam.progress_percent, 0),
  status: toString(exam.status || 'not_started', 'not_started'),
  solution_url: exam.solution_url || undefined,
}));

const coursesPayload = readJson('courses/courses/home/index.html');
const courses = [
  ...compactArray(coursesPayload.my_courses),
  ...compactArray(coursesPayload.preview_courses),
].map(mapCourse);

const data = {
  generatedAt: latestSourceTimestamp(),
  source: 'crawl:oj.cppro.vn/api',
  crawlManifest: path.relative(repoRoot, crawlRoot).replaceAll(path.sep, '/'),
  stats: {
    problems: problemTotal || problems.length,
    capturedProblems: problems.length,
    problemDetails: Object.keys(problemDetails).length,
    contests: contests.length,
    users: users.length,
    submissions: submissions.length,
    exams: exams.length,
    tags: tags.length,
    courses: courses.length,
    hsgCategories: hsgCategories.length,
  },
  problems,
  problemDetails,
  contests,
  contestDetails,
  users,
  profiles,
  submissions,
  exams,
  hsgCategories,
  tags,
  courses,
};

const minimums = {
  capturedProblems: 50,
  problemDetails: 8,
  contests: 34,
  users: 500,
  submissions: 20,
  exams: 30,
  hsgCategories: 10,
  tags: 50,
  courses: 1,
};

for (const [key, minimum] of Object.entries(minimums)) {
  if (toNumber(data.stats[key], 0) < minimum) {
    fail(`Generated data is unexpectedly small: stats.${key}=${data.stats[key]}, expected at least ${minimum}`);
  }
}

mkdirSync(path.dirname(outputFile), { recursive: true });
writeFileSync(outputFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  output: path.relative(repoRoot, outputFile).replaceAll(path.sep, '/'),
  generatedAt: data.generatedAt,
  stats: data.stats,
}, null, 2));
