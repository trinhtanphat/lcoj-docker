import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import {
  Activity,
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  CalendarDays,
  ChartColumn,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleMinus,
  CircleUserRound,
  Clock,
  Code2,
  CodeXml,
  Copy,
  Cpu,
  CreditCard,
  Crown,
  Database,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  ExternalLink,
  FileQuestion,
  FileText,
  Flame,
  Gift,
  GraduationCap,
  Gauge,
  Globe,
  HardDrive,
  Heart,
  Home,
  Image as ImageIcon,
  Inbox,
  Loader2,
  Link2,
  ListChecks,
  Lock,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Megaphone,
  Medal,
  MessageCircle,
  MessageSquare,
  Moon,
  MoreHorizontal,
  PenLine,
  Phone,
  Plus,
  Palette,
  Printer,
  Reply,
  RefreshCw,
  Search,
  Send,
  Server,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  Monitor,
  Swords,
  Tag,
  Terminal,
  Trophy,
  User,
  Upload,
  UsersRound,
  X,
  XCircle,
  Zap,
  ChartPie,
  AlertTriangle,
  TimerReset,
  Ban,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Trash2,
} from 'lucide-react';
import './styles.css';

import type {
  Problem, JudgeLanguage, ContestProblem, Contest, UserRow, UserRatingHistoryPoint,
  UserActivityHeatmapPoint, UserSolvedTag, UserProblemSummary, HomeActivityPoint,
  HomeSummary, StoredCpproUser, Submission, ContestTabKey, ContestComment,
  SortDirection, SortState, ParsedTestResult, ProblemComment, ProblemStatsSummary,
  SubmissionVerificationChallenge, Course, HsgCategory, HsgExam, OrganizationRow,
  OrganizationMemberDetail, OrganizationProblemDetail, OrganizationContestDetail,
  OrganizationDetailPayload, TopbarFeatureKey, TopbarFeatures, CpproData,
  FooterContactSettings, AuthUser, AuthResult, ThemeMode, CpproLocale,
  CpproRatingBand, CpproRatingSettings, CommunityTabKey, CommunityReactionActor,
  CommunityComment, HomePost,
} from './types';
import {
  defaultTopbarFeatures, fallbackJudgeLanguages, emptyStats,
  footerContactStorageKey, defaultFooterContactSettings, emptyCpproData,
} from './types';

function mergeJudgeLanguages(languages?: JudgeLanguage[] | null) {
  const byCode = new Map<string, JudgeLanguage>();
  fallbackJudgeLanguages.forEach((language) => {
    byCode.set(language.code, language);
  });
  (Array.isArray(languages) ? languages : []).forEach((language) => {
    if (!language?.code) return;
    const existing = byCode.get(language.code) || {};
    byCode.set(language.code, { ...existing, ...language });
  });
  return Array.from(byCode.values());
}

function normalizeCpproData(payload: Partial<CpproData> | null | undefined): CpproData {
  const data = payload || {};
  const problems = Array.isArray(data.problems) ? data.problems : [];
  const contests = Array.isArray(data.contests) ? data.contests : [];
  const users = Array.isArray(data.users) ? data.users : [];
  const submissions = Array.isArray(data.submissions) ? data.submissions : [];
  const posts = Array.isArray(data.posts) ? data.posts : [];
  const notifications = Array.isArray(data.notifications) ? data.notifications : [];
  const exams = Array.isArray(data.exams) ? data.exams : [];
  const organizations = Array.isArray(data.organizations) ? data.organizations : [];
  const tags = Array.isArray(data.tags) ? data.tags : [];
  const courses = Array.isArray(data.courses) ? data.courses : [];
  const judgeLanguages = mergeJudgeLanguages(Array.isArray(data.judgeLanguages) ? data.judgeLanguages : []);
  const hsgCategories = Array.isArray(data.hsgCategories) ? data.hsgCategories : [];
  return {
    ...emptyCpproData,
    ...data,
    generatedAt: data.generatedAt || null,
    source: data.source || null,
    crawlManifest: data.crawlManifest || null,
    stats: {
      ...emptyStats,
      ...(data.stats || {}),
      problems: Number(data.stats?.problems ?? problems.length),
      problemDetails: Number(data.stats?.problemDetails ?? Object.keys(data.problemDetails || {}).length),
      contests: Number(data.stats?.contests ?? contests.length),
      users: Number(data.stats?.users ?? users.length),
      submissions: Number(data.stats?.submissions ?? submissions.length),
      posts: Number(data.stats?.posts ?? posts.length),
      notifications: Number(data.stats?.notifications ?? notifications.length),
      exams: Number(data.stats?.exams ?? exams.length),
      organizations: Number(data.stats?.organizations ?? organizations.length),
      tags: Number(data.stats?.tags ?? tags.length),
      courses: Number(data.stats?.courses ?? courses.length),
      hsgCategories: Number(data.stats?.hsgCategories ?? hsgCategories.length),
    },
    problems,
    problemDetails: data.problemDetails || {},
    contests,
    contestDetails: data.contestDetails || {},
    users,
    profiles: data.profiles || {},
    submissions,
    posts,
    notifications,
    exams,
    organizations,
    hsgCategories,
    tags,
    courses,
    judgeLanguages,
    homeSummary: normalizeHomeSummary(data.homeSummary),
    auth: {
      googleEnabled: Boolean(data.auth?.googleEnabled),
    },
    contact: normalizeFooterContactSettings(data.contact),
    topbarFeatures: normalizeTopbarFeatures(data.topbarFeatures),
    ratingSettings: normalizeCpproRatingSettings(data.ratingSettings),
    platformFrontendUrl: data.platformFrontendUrl || null,
  };
}

function cpproApiBase() {
  const configured = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  return configured || '/api';
}

function cpproDataSourceMode() {
  return String(import.meta.env.VITE_CPPRO_DATA_SOURCE || '').trim().toLowerCase();
}

function shouldUseStaticCpproData() {
  return cpproDataSourceMode() === 'static';
}

// True only for the LCOJ build. Its data comes from the real LCOJ/DMOJ database
// over /api/v2 — never from the crawled oj.cppro.vn snapshot, which is stale
// foreign data. An honest empty state beats showing someone else's problems.
function isLcojBackendMode() {
  return cpproDataSourceMode() === 'lcoj'
    || String(import.meta.env.VITE_CPPRO_DEPLOYMENT || '').trim().toLowerCase() === 'lcoj';
}

function shouldUseLcojLegacyRoutes() {
  // LCOJ is the authenticated backend for the CPPro application, not an
  // alternate public frontend. Keep legacy navigation only for the offline
  // static preview where there is no CPPro API to serve the route.
  return shouldUseStaticCpproData();
}

type CpproFetchInit = RequestInit & { timeoutMs?: number };

async function cpproApiFetch<T>(path: string, init: CpproFetchInit = {}): Promise<T> {
  if (isLcojBackendMode()) {
    return lcojApiFetch<T>(`/api/cppro${path}`, init);
  }
  if (shouldUseStaticCpproData()) {
    throw new Error('This CPPRO API action is disabled while this static preview is active.');
  }
  const { timeoutMs, ...fetchInit } = init;
  const headers = new Headers(fetchInit.headers);
  const isFormData = typeof FormData !== 'undefined' && fetchInit.body instanceof FormData;
  if (fetchInit.body && !isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = localStorage.getItem('oj_platform_token') || localStorage.getItem('cppro_access_token');
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  // H-4: echo the double-submit CSRF token on mutating requests so cookie-authenticated
  // mutations are accepted when AUTH_COOKIE_ENABLED is on. Harmless otherwise.
  const method = String(fetchInit.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !headers.has('X-CSRF-Token')) {
    const csrf = readSharedCookie('oj_csrf');
    if (csrf) headers.set('X-CSRF-Token', csrf);
  }
  const controller = timeoutMs && !fetchInit.signal ? new AbortController() : null;
  const timeout = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(`${cpproApiBase()}${path}`, { ...fetchInit, headers, signal: fetchInit.signal || controller?.signal });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.error
        || data?.message
        || (response.status === 413 ? 'Dữ liệu gửi lên quá lớn. Hãy chọn ảnh nhỏ hơn hoặc để hệ thống nén ảnh trước khi lưu.' : `Request failed with ${response.status}`);
      throw new Error(message);
    }
    return data as T;
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
}

let lcojCsrfBootstrap: Promise<void> | null = null;

async function ensureLcojCsrfCookie() {
  const existing = readSharedCookie('csrftoken');
  if (existing) return existing;

  if (!lcojCsrfBootstrap) {
    lcojCsrfBootstrap = fetch('/api/cppro/auth/me', {
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    }).then(() => undefined).finally(() => {
      lcojCsrfBootstrap = null;
    });
  }
  await lcojCsrfBootstrap;
  return readSharedCookie('csrftoken');
}

async function lcojApiFetch<T>(path: string, init: CpproFetchInit = {}): Promise<T> {
  const { timeoutMs, ...fetchInit } = init;
  const headers = new Headers(fetchInit.headers);
  const isFormData = typeof FormData !== 'undefined' && fetchInit.body instanceof FormData;
  if (fetchInit.body && !isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  const method = String(fetchInit.method || 'GET').toUpperCase();
  let csrf = readSharedCookie('csrftoken');
  if (!csrf && !headers.has('X-CSRFToken') && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    csrf = await ensureLcojCsrfCookie();
  }
  if (csrf && !headers.has('X-CSRFToken')) headers.set('X-CSRFToken', csrf);
  const controller = timeoutMs && !fetchInit.signal ? new AbortController() : null;
  const timeout = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(path, {
      ...fetchInit,
      credentials: 'include',
      headers,
      signal: fetchInit.signal || controller?.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String(data?.error || data?.message || `LCOJ API error ${response.status}`));
    }
    return data as T;
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
}

function hasCpproAuthToken() {
  try {
    return Boolean(localStorage.getItem('oj_platform_token') || localStorage.getItem('cppro_access_token'));
  } catch {
    return false;
  }
}

async function copyTextToClipboard(text: string) {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back for HTTP preview hosts where the Clipboard API can be blocked.
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

const maxAvatarUploadBytes = 1_500_000;
const maxAvatarSourceBytes = 10_000_000;
const maxAvatarDataUrlChars = 1_950_000;
const maxInlineImageUploadBytes = 1_800_000;
const maxInlineImageSourceBytes = 18_000_000;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Không đọc được file ảnh.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

async function readFileAsBase64(file: File) {
  const dataUrl = await readFileAsDataUrl(file);
  return dataUrl.includes(',') ? dataUrl.split(',').slice(1).join(',') : dataUrl;
}

function loadImageFromDataUrl(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Không xử lý được ảnh đại diện.'));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function replaceFileExtension(fileName: string, extension: string) {
  const cleanName = (fileName || 'image').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'image';
  return `${cleanName.replace(/\.[a-z0-9]+$/i, '')}.${extension}`;
}

function formatUploadBytes(bytes: number) {
  if (bytes < 1024) return `${bytes.toLocaleString('vi-VN')} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} KiB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} MiB`;
}

async function compressImageFileForUpload(file: File) {
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
    throw new Error('Only PNG, JPEG, WebP, or GIF images are supported.');
  }
  if (file.size > maxInlineImageSourceBytes) {
    throw new Error('Image is too large. Please choose an image under 18MB.');
  }
  if (file.size <= maxInlineImageUploadBytes) {
    return {
      file,
      compressed: false,
      originalSize: file.size,
      uploadSize: file.size,
    };
  }

  const original = await readFileAsDataUrl(file);
  const image = await loadImageFromDataUrl(original);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Browser cannot compress this image.');

  const edgeOptions = [1600, 1280, 1024, 820, 640];
  const qualityOptions = [0.86, 0.76, 0.66, 0.56, 0.48];
  for (const maxEdge of edgeOptions) {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of qualityOptions) {
      const webp = await canvasToBlob(canvas, 'image/webp', quality);
      if (webp && webp.size <= maxInlineImageUploadBytes) {
        const uploadFile = new File([webp], replaceFileExtension(file.name, 'webp'), { type: 'image/webp' });
        return {
          file: uploadFile,
          compressed: true,
          originalSize: file.size,
          uploadSize: uploadFile.size,
        };
      }
      const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality);
      if (jpeg && jpeg.size <= maxInlineImageUploadBytes) {
        const uploadFile = new File([jpeg], replaceFileExtension(file.name, 'jpg'), { type: 'image/jpeg' });
        return {
          file: uploadFile,
          compressed: true,
          originalSize: file.size,
          uploadSize: uploadFile.size,
        };
      }
    }
  }
  throw new Error('Image is still too large after compression. Please choose a smaller image.');
}

async function compressAvatarFile(file: File) {
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
    throw new Error('Chỉ hỗ trợ PNG, JPEG, WebP hoặc GIF.');
  }
  if (file.size > maxAvatarSourceBytes) {
    throw new Error('Ảnh đại diện quá lớn. Vui lòng chọn ảnh dưới 10MB.');
  }
  const original = await readFileAsDataUrl(file);
  if (file.size <= maxAvatarUploadBytes && original.length <= maxAvatarDataUrlChars) return original;

  const image = await loadImageFromDataUrl(original);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Trình duyệt không hỗ trợ nén ảnh.');

  const edgeOptions = [512, 420, 360, 300, 240];
  const qualityOptions = [0.86, 0.78, 0.68, 0.58];
  for (const maxEdge of edgeOptions) {
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of qualityOptions) {
      const webp = canvas.toDataURL('image/webp', quality);
      if (webp.startsWith('data:image/webp') && webp.length <= maxAvatarDataUrlChars) return webp;
      const jpeg = canvas.toDataURL('image/jpeg', quality);
      if (jpeg.length <= maxAvatarDataUrlChars) return jpeg;
    }
  }
  throw new Error('Ảnh vẫn quá lớn sau khi nén. Vui lòng chọn ảnh nhỏ hơn.');
}

async function uploadPostImageAsset(file: File) {
  const prepared = await compressImageFileForUpload(file);
  const body = new FormData();
  body.append('file', prepared.file, prepared.file.name);
  const payload = await cpproApiFetch<Record<string, unknown>>('/posts/assets', {
    method: 'POST',
    body,
    timeoutMs: 30000,
  });
  const url = String(payload.url || '').trim();
  if (!url) throw new Error('Image upload did not return a URL.');
  return {
    url,
    fileName: String(payload.fileName || prepared.file.name || file.name || 'image').trim() || 'image',
    compressed: prepared.compressed,
    originalSize: prepared.originalSize,
    uploadSize: prepared.uploadSize,
  };
}

function rowsFromApi<T = Record<string, unknown>>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.rows)) return record.rows as T[];
    if (Array.isArray(record.results)) return record.results as T[];
    if (Array.isArray(record.data)) return record.data as T[];
    if (Array.isArray(record.value)) return record.value as T[];
    if (record.data && typeof record.data === 'object' && Array.isArray((record.data as Record<string, unknown>).objects)) {
      return (record.data as Record<string, unknown>).objects as T[];
    }
    for (const key of ['objects', 'items', 'groups', 'tickets', 'nodes', 'incidents', 'logs', 'quizzes', 'comments', 'posts', 'notifications', 'languages', 'members', 'requests', 'answers', 'testcases']) {
      if (Array.isArray(record[key])) return record[key] as T[];
    }
    for (const key of ['item', 'group', 'ticket', 'node', 'incident', 'log', 'quiz', 'comment', 'post', 'notification', 'language', 'member', 'request', 'answer', 'badge', 'user', 'organization', 'contest', 'problem']) {
      if (record[key] && typeof record[key] === 'object') return [record[key] as T];
    }
  }
  return [];
}

function BodyPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

function totalFromApi(payload: unknown, fallback: number) {
  if (!payload || typeof payload !== 'object') return fallback;
  const record = payload as Record<string, unknown>;
  return Number(record.total ?? record.count ?? record.Count ?? record.Total ?? fallback) || fallback;
}

function limitFromApi(payload: unknown, fallback: number) {
  if (!payload || typeof payload !== 'object') return fallback;
  const record = payload as Record<string, unknown>;
  return Number(record.limit ?? record.pageSize ?? record.page_size ?? fallback) || fallback;
}

async function fetchPagedApiRows<T extends Record<string, unknown>>(
  firstPayload: unknown,
  pathForPage: (page: number, limit: number) => string,
  maxRows = 1000,
) {
  const firstRows = rowsFromApi<T>(firstPayload);
  const limit = Math.max(1, Math.min(100, limitFromApi(firstPayload, firstRows.length || 100)));
  const total = Math.min(totalFromApi(firstPayload, firstRows.length), maxRows);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) return firstRows.slice(0, maxRows);
  const restPayloads = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => (
      safeApi<unknown>(pathForPage(index + 2, limit), { rows: [], total: 0 })
    )),
  );
  return [
    ...firstRows,
    ...restPayloads.flatMap((payload) => rowsFromApi<T>(payload)),
  ].slice(0, maxRows);
}

function toggleSort<Key extends string>(state: SortState<Key>, key: Key): SortState<Key> {
  if (state.key === key) {
    return { key, direction: state.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: 'asc' };
}

function compareSortValues(left: unknown, right: unknown, direction: SortDirection) {
  const multiplier = direction === 'asc' ? 1 : -1;
  const leftNumber = typeof left === 'number' ? left : Number(left);
  const rightNumber = typeof right === 'number' ? right : Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return (leftNumber - rightNumber) * multiplier;
  }
  const leftDate = typeof left === 'string' ? Date.parse(left) : Number.NaN;
  const rightDate = typeof right === 'string' ? Date.parse(right) : Number.NaN;
  if (Number.isFinite(leftDate) && Number.isFinite(rightDate) && /\d{4}-\d{2}-\d{2}/.test(String(left))) {
    return (leftDate - rightDate) * multiplier;
  }
  return String(left ?? '').localeCompare(String(right ?? ''), 'vi', { numeric: true, sensitivity: 'base' }) * multiplier;
}

function SortButton<Key extends string>({
  label,
  sortKey,
  state,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: Key;
  state: SortState<Key>;
  onSort: (key: Key) => void;
  align?: 'left' | 'right' | 'center';
}) {
  const active = state.key === sortKey;
  return (
    <button
      type="button"
      data-sort-button
      data-active={active ? 'true' : 'false'}
      data-dir={active ? state.direction : undefined}
      data-align={align}
      onClick={() => onSort(sortKey)}
    >
      <span>{label}</span>
      <ChevronDown size={14} aria-hidden="true" />
    </button>
  );
}

async function safeApi<T>(path: string, fallback: T, timeoutMs = 8000): Promise<T> {
  try {
    return await cpproApiFetch<T>(path, { timeoutMs });
  } catch {
    return fallback;
  }
}

async function loadStaticCpproData(): Promise<CpproData | null> {
  // The LCOJ build must never fall back to the crawled snapshot.
  if (isLcojBackendMode()) return null;
  try {
    const response = await fetch('/data/cppro.json', { cache: 'no-cache' });
    if (!response.ok) return null;
    return normalizeCpproData(await response.json());
  } catch {
    return null;
  }
}

async function fetchLcojApiV2(path: string, timeoutMs = 4500): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`/api/v2/${path.replace(/^\/+/, '')}`, {
      cache: 'no-cache',
      credentials: 'same-origin',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`LCOJ API ${path} returned ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

function stableNumericId(value: unknown, fallback = 0) {
  const rawNumber = Number(value);
  if (Number.isFinite(rawNumber) && rawNumber > 0) return Math.floor(rawNumber);
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) || fallback;
}

function lcojContestStatus(row: Record<string, unknown>) {
  const start = new Date(String(row.start_time || ''));
  const end = new Date(String(row.end_time || ''));
  const now = Date.now();
  if (Number.isFinite(start.getTime()) && now < start.getTime()) return 'upcoming';
  if (Number.isFinite(end.getTime()) && now <= end.getTime()) return 'running';
  return 'ended';
}

function mapLcojApiProblem(row: Record<string, unknown>): Problem {
  const slug = normalizeSlug(row.code, row.code || row.name);
  const title = String(row.name || row.title || slug);
  const score = Number(row.points ?? 100) || 100;
  return {
    id: stableNumericId(row.id ?? row.code, 0),
    code: slug,
    slug,
    title,
    difficulty: String(row.partial ? 'partial' : 'standard'),
    score,
    source: String(row.group || 'LCOJ'),
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    accepted: 0,
    submissions: 0,
    solvers: 0,
    userSolved: false,
    userAttempts: 0,
    myStatus: null,
    myBestVerdict: null,
    tags: normalizeProblemTags(row.types),
    statement: undefined,
    constraints: undefined,
    editorial: undefined,
    createdBy: undefined,
    allowedLanguages: null,
  };
}

function mapLcojApiContest(row: Record<string, unknown>): Contest {
  const slug = normalizeSlug(row.key, row.name);
  const durationSeconds = Number(row.time_limit ?? 0) || 0;
  return {
    id: stableNumericId(row.id ?? row.key, 0),
    slug,
    title: String(row.name || slug),
    scope: row.is_private ? 'private' : 'public',
    accessType: row.is_private ? 'private' : 'open',
    format: row.is_rated ? 'rated' : 'contest',
    startTime: String(row.start_time || ''),
    endTime: String(row.end_time || ''),
    durationMinutes: durationSeconds > 0 ? Math.round(durationSeconds / 60) : undefined,
    participants: 0,
    virtualParticipants: 0,
    problemCount: Array.isArray(row.problems) ? row.problems.length : 0,
    status: lcojContestStatus(row),
    description: undefined,
    problems: undefined,
    myAttendance: null,
    myParticipant: null,
  };
}

function mapLcojApiUser(row: Record<string, unknown>, ratingSettings?: CpproRatingSettings): UserRow {
  const username = String(row.username || 'user');
  const rating = Number(row.rating ?? row.performance_points ?? 0) || 0;
  const score = Number(row.points ?? row.performance_points ?? 0) || 0;
  const solvedList = Array.isArray(row.solved_problems) ? row.solved_problems : [];
  return {
    id: Number(row.id ?? 0) || undefined,
    username,
    fullName: username,
    avatarUrl: null,
    rating,
    score,
    solved: Number(row.problem_count ?? solvedList.length ?? 0) || 0,
    streak: 0,
    maxStreak: 0,
    rankName: normalizeRankName(row.rank, rating, ratingSettings),
    rankColor: undefined,
    tags: normalizeStringList(row.rank, []).length ? normalizeStringList(row.rank, []) : [String(row.rank || 'member')],
    proTier: '',
    contestCount: Array.isArray(row.contests) ? row.contests.length : undefined,
    badges: [],
  };
}

function mapLcojApiSubmission(row: Record<string, unknown>): Submission {
  const problemSlug = normalizeSlug(row.problem, row.id);
  const rawScore = Number(row.points ?? 0) || 0;
  const maxScore = Number((row.contest && typeof row.contest === 'object' ? (row.contest as Record<string, unknown>).points : undefined) ?? 100) || 100;
  const verdict = String(row.result || row.status || 'PENDING').toUpperCase();
  return {
    id: Number(row.id ?? 0) || stableNumericId(`${row.problem}-${row.user}-${row.date}`, 0),
    username: String(row.user || 'user'),
    problemTitle: String(row.problem || problemSlug),
    problemSlug,
    contestTitle: undefined,
    contestSlug: row.contest && typeof row.contest === 'object' ? String((row.contest as Record<string, unknown>).key || '') || undefined : undefined,
    language: String(row.language || 'unknown'),
    verdict,
    score: String(rawScore),
    maxScore: String(maxScore),
    passed: verdict === 'AC' || rawScore >= maxScore ? 1 : 0,
    total: 1,
    // DMOJ api/v2 reports `time` in seconds (float) and `memory` in KB.
    timeMs: Math.round((Number(row.time ?? 0) || 0) * 1000),
    memoryKb: Math.round(Number(row.memory ?? 0) || 0),
    submittedAt: String(row.date || new Date().toISOString()),
  };
}

function mapLcojApiOrganization(row: Record<string, unknown>): OrganizationRow {
  const slug = normalizeSlug(row.slug ?? row.short_name ?? row.id, row.id);
  return {
    id: String(row.id ?? slug),
    slug,
    name: String(row.short_name || row.name || slug),
    description: undefined,
    visibility: row.is_open === false ? 'closed' : 'public',
    memberCount: Number(row.member_count ?? 0) || 0,
    problemCount: 0,
    contestCount: 0,
    totalRating: 0,
    myRole: null,
    myStatus: null,
    createdBy: null,
    updatedAt: undefined,
  };
}

function mapLcojApiLanguage(row: Record<string, unknown>): JudgeLanguage {
  return {
    code: String(row.key || row.id || '').trim(),
    label: String(row.common_name || row.short_name || row.key || '').trim(),
    runtimeLabel: String(row.short_name || row.common_name || '').trim() || null,
    extension: null,
    sourceTemplate: String(row.code_template || '').trim() || null,
  };
}

async function loadLcojBridgeCpproData(): Promise<CpproData | null> {
  try {
    // The CPPro bridge applies native DMOJ visibility, contest-freeze and
    // organization privacy rules. The broader /api/v2 collections do not.
    const payload = await cpproApiFetch<Record<string, unknown>>('/data', { timeoutMs: 8000 });
    const siteSettings = payload.siteSettings && typeof payload.siteSettings === 'object'
      ? payload.siteSettings
      : {};
    const ratingSettings = ratingSettingsFromSiteSettings(siteSettings);
    const problems = rowsFromApi<Record<string, unknown>>(payload.problems).map(mapBackendProblem);
    const contests = rowsFromApi<Record<string, unknown>>(payload.contests).map(mapBackendContest);
    const organizations = rowsFromApi<Record<string, unknown>>(payload.organizations).map(mapBackendOrganization);
    const users = rowsFromApi<Record<string, unknown>>(payload.users).map((row) => mapBackendUser(row, ratingSettings));
    const submissions = rowsFromApi<Record<string, unknown>>(payload.submissions).map(mapBackendSubmission);
    const posts = rowsFromApi<Record<string, unknown>>(payload.posts).map(mapBackendPost);
    const notifications = rowsFromApi<Record<string, unknown>>(payload.notifications).map(mapBackendPost);
    const judgeLanguages = rowsFromApi<Record<string, unknown>>(payload.languages)
      .map(mapBackendJudgeLanguage)
      .filter((item) => item.code && item.label);
    const tagsBySlug = new Map<string, Problem['tags'][number]>();
    problems.forEach((problem) => problem.tags.forEach((tag) => tagsBySlug.set(tag.slug, tag)));

    return normalizeCpproData({
      generatedAt: String(payload.generatedAt || new Date().toISOString()),
      source: String(payload.source || 'lcoj-database'),
      crawlManifest: null,
      stats: payload.stats && typeof payload.stats === 'object'
        ? payload.stats as Record<string, number>
        : emptyStats,
      problems,
      problemDetails: Object.fromEntries(problems.flatMap((problem) => [
        [problem.slug, problem],
        [String(problem.id), problem],
      ])),
      contests,
      contestDetails: Object.fromEntries(contests.flatMap((contest) => [
        [contest.slug, contest],
        [String(contest.id), contest],
      ])),
      organizations,
      users,
      profiles: Object.fromEntries(users.map((user) => [user.username, user])),
      submissions,
      posts,
      notifications,
      exams: [],
      tags: [...tagsBySlug.values()],
      courses: [],
      judgeLanguages: judgeLanguages.length ? mergeJudgeLanguages(judgeLanguages) : fallbackJudgeLanguages,
      homeSummary: normalizeHomeSummary(payload.homeSummary),
      auth: { googleEnabled: googleOAuthEnabledFromSettings(siteSettings) },
      contact: contactFromSiteSettings(siteSettings),
      topbarFeatures: topbarFeaturesFromSiteSettings(siteSettings),
      ratingSettings,
      platformFrontendUrl: siteFrontendUrlFromSettings(siteSettings),
    });
  } catch {
    return null;
  }
}

async function loadLcojApiCpproData(staticData: CpproData | null): Promise<CpproData | null> {
  const [
    problemsPayload,
    contestsPayload,
    usersPayload,
    submissionsPayload,
    organizationsPayload,
    languagesPayload,
    judgesPayload,
  ] = await Promise.allSettled([
    fetchLcojApiV2('problems'),
    fetchLcojApiV2('contests'),
    fetchLcojApiV2('users'),
    fetchLcojApiV2('submissions'),
    fetchLcojApiV2('organizations'),
    fetchLcojApiV2('languages'),
    fetchLcojApiV2('judges'),
  ]);

  const fulfilled = [problemsPayload, contestsPayload, usersPayload, submissionsPayload, organizationsPayload, languagesPayload, judgesPayload]
    .some((result) => result.status === 'fulfilled');
  if (!fulfilled) return null;

  const ratingSettings = staticData?.ratingSettings || normalizeCpproRatingSettings(null);
  const problems = problemsPayload.status === 'fulfilled'
    ? rowsFromApi<Record<string, unknown>>(problemsPayload.value).map(mapLcojApiProblem)
    : [];
  const contests = contestsPayload.status === 'fulfilled'
    ? rowsFromApi<Record<string, unknown>>(contestsPayload.value).map(mapLcojApiContest)
    : [];
  const users = usersPayload.status === 'fulfilled'
    ? rowsFromApi<Record<string, unknown>>(usersPayload.value).map((row) => mapLcojApiUser(row, ratingSettings))
    : [];
  const submissions = submissionsPayload.status === 'fulfilled'
    ? rowsFromApi<Record<string, unknown>>(submissionsPayload.value).map(mapLcojApiSubmission)
    : [];
  const organizations = organizationsPayload.status === 'fulfilled'
    ? rowsFromApi<Record<string, unknown>>(organizationsPayload.value).map(mapLcojApiOrganization)
    : [];
  const judgeLanguages = languagesPayload.status === 'fulfilled'
    ? rowsFromApi<Record<string, unknown>>(languagesPayload.value).map(mapLcojApiLanguage).filter((item) => item.code && item.label)
    : [];
  const onlineJudges = judgesPayload.status === 'fulfilled'
    ? rowsFromApi<Record<string, unknown>>(judgesPayload.value).length
    : 0;
  const tagsBySlug = new Map<string, { id: number; name: string; slug: string }>();
  problems.forEach((problem) => problem.tags.forEach((tag) => tagsBySlug.set(tag.slug, tag)));
  const activity = activityFromSubmissions(submissions, null);
  const homeSummary = normalizeHomeSummary({
    activity,
    challenge: problems[0] || staticData?.homeSummary?.challenge || null,
    presence: {
      online: onlineJudges,
      total: Math.max(onlineJudges, users.length),
    },
  });

  const data = normalizeCpproData({
    ...(staticData || emptyCpproData),
    generatedAt: new Date().toISOString(),
    source: 'lcoj-api-v2',
    stats: {
      ...emptyStats,
      ...(staticData?.stats || {}),
      problems: problems.length || staticData?.stats.problems || 0,
      contests: contests.length || staticData?.stats.contests || 0,
      users: users.length || staticData?.stats.users || 0,
      onlineUsers: onlineJudges,
      submissions: submissions.length || staticData?.stats.submissions || 0,
      organizations: organizations.length || staticData?.stats.organizations || 0,
      tags: tagsBySlug.size || staticData?.stats.tags || 0,
    },
    problems: problems.length ? problems : staticData?.problems || [],
    contests: contests.length ? contests : staticData?.contests || [],
    users: users.length ? users : staticData?.users || [],
    submissions: submissions.length ? submissions : staticData?.submissions || [],
    organizations: organizations.length ? organizations : staticData?.organizations || [],
    tags: tagsBySlug.size ? [...tagsBySlug.values()] : staticData?.tags || [],
    judgeLanguages: judgeLanguages.length ? mergeJudgeLanguages(judgeLanguages) : staticData?.judgeLanguages || fallbackJudgeLanguages,
    homeSummary,
    auth: staticData?.auth || emptyCpproData.auth,
    contact: staticData?.contact || defaultFooterContactSettings,
    topbarFeatures: staticData?.topbarFeatures || defaultTopbarFeatures,
    ratingSettings,
    platformFrontendUrl: staticData?.platformFrontendUrl || null,
  });
  return hasBackendRows(data) ? data : null;
}

function hasBackendRows(data: CpproData) {
  return data.problems.length > 0
    || data.contests.length > 0
    || data.users.length > 0
    || data.submissions.length > 0
    || data.posts.length > 0
    || data.organizations.length > 0;
}

function nonNegativeCounter(value: unknown) {
  return Math.max(0, Number(value || 0) || 0);
}

function mergeTrafficCounters(current: CpproData, payload: Record<string, unknown>): CpproData {
  const currentVisits = nonNegativeCounter(current.homeSummary?.traffic?.visits ?? current.stats.visits);
  const currentPageViews = nonNegativeCounter(current.homeSummary?.traffic?.pageViews ?? current.stats.pageViews);
  const visits = Math.max(currentVisits, nonNegativeCounter(payload.visits ?? payload.totalVisits ?? payload.visitCount));
  const pageViews = Math.max(currentPageViews, nonNegativeCounter(payload.pageViews ?? payload.pageviews ?? payload.totalPageViews));
  if (visits === currentVisits && pageViews === currentPageViews) return current;
  return {
    ...current,
    stats: {
      ...current.stats,
      visits,
      pageViews,
    },
    homeSummary: current.homeSummary ? {
      ...current.homeSummary,
      traffic: {
        visits: visits || null,
        pageViews: pageViews || null,
      },
    } : current.homeSummary,
  };
}

function normalizeStringList(value: unknown, fallback: string[]) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item || '').trim()).filter(Boolean);
    } catch {
      // Fall back to comma/newline separated values.
    }
    return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  }
  return fallback;
}

function normalizeFooterContactSettings(value?: Partial<FooterContactSettings> | null): FooterContactSettings {
  const input = (value && typeof value === 'object' ? value : {}) as Partial<FooterContactSettings>;
  const brandName = String(input.brandName || defaultFooterContactSettings.brandName).trim() || defaultFooterContactSettings.brandName;
  const copyrightText = String(input.copyrightText || '').trim()
    || `© ${new Date().getFullYear()} ${brandName}. All rights reserved. Designed for excellence.`;
  return {
    brandName,
    domainName: String(input.domainName || defaultFooterContactSettings.domainName).trim() || defaultFooterContactSettings.domainName,
    logoUrl: String(input.logoUrl || defaultFooterContactSettings.logoUrl).trim() || defaultFooterContactSettings.logoUrl,
    copyrightText,
    emails: normalizeStringList(input.emails, defaultFooterContactSettings.emails),
    phones: normalizeStringList(input.phones, defaultFooterContactSettings.phones),
    location: String(input.location || defaultFooterContactSettings.location).trim() || defaultFooterContactSettings.location,
    facebook: String(input.facebook || defaultFooterContactSettings.facebook).trim() || defaultFooterContactSettings.facebook,
    youtube: String(input.youtube || defaultFooterContactSettings.youtube).trim() || defaultFooterContactSettings.youtube,
    tiktok: String(input.tiktok || defaultFooterContactSettings.tiktok).trim() || defaultFooterContactSettings.tiktok,
  };
}

function readFooterContactSettings(fallback: FooterContactSettings = defaultFooterContactSettings) {
  try {
    const stored = localStorage.getItem(footerContactStorageKey);
    return stored ? normalizeFooterContactSettings(JSON.parse(stored)) : normalizeFooterContactSettings(fallback);
  } catch {
    return normalizeFooterContactSettings(fallback);
  }
}

function saveFooterContactSettings(settings: FooterContactSettings) {
  const normalized = normalizeFooterContactSettings(settings);
  localStorage.setItem(footerContactStorageKey, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent('cppro-contact-settings-changed', { detail: normalized }));
  return normalized;
}

function googleOAuthEnabledFromSettings(payload: unknown) {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const security = record.security && typeof record.security === 'object' ? record.security as Record<string, unknown> : {};
  const providers = Array.isArray(security.oauth) ? security.oauth : Array.isArray(record.providers) ? record.providers : [];
  return providers.some((provider) => {
    const item = provider && typeof provider === 'object' ? provider as Record<string, unknown> : {};
    return String(item.provider || '').toLowerCase() === 'google' && Boolean(item.enabled);
  });
}

function siteFrontendUrlFromSettings(payload: unknown) {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const site = record.site && typeof record.site === 'object' ? record.site as Record<string, unknown> : {};
  const raw = String(site.frontendUrl || site.frontend_url || record.frontendUrl || record.frontend_url || '').trim();
  return raw ? raw.replace(/\/+$/, '') : null;
}

function normalizeTopbarFeatures(value?: unknown): TopbarFeatures {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = value.trim() ? JSON.parse(value) : {};
    } catch {
      parsed = {};
    }
  }
  const record = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  return (Object.keys(defaultTopbarFeatures) as TopbarFeatureKey[]).reduce((features, key) => {
    features[key] = typeof record[key] === 'boolean' ? Boolean(record[key]) : defaultTopbarFeatures[key];
    return features;
  }, {} as TopbarFeatures);
}

function topbarFeaturesFromSiteSettings(payload: unknown) {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const site = record.site && typeof record.site === 'object' ? record.site as Record<string, unknown> : {};
  return normalizeTopbarFeatures(site.topbarFeatures ?? site.topbar_features ?? record.topbarFeatures);
}

function contactFromSiteSettings(payload: unknown) {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const site = record.site && typeof record.site === 'object' ? record.site as Record<string, unknown> : {};
  return normalizeFooterContactSettings({
    brandName: String(site.name || defaultFooterContactSettings.brandName),
    domainName: String(site.domain || defaultFooterContactSettings.domainName),
    logoUrl: String(site.logoUrl || defaultFooterContactSettings.logoUrl),
    copyrightText: String(site.footerCopyright || site.copyright || ''),
    emails: defaultFooterContactSettings.emails,
    phones: defaultFooterContactSettings.phones,
    location: defaultFooterContactSettings.location,
    facebook: defaultFooterContactSettings.facebook,
    youtube: defaultFooterContactSettings.youtube,
    tiktok: defaultFooterContactSettings.tiktok,
  });
}

function ratingSettingsFromSiteSettings(payload: unknown) {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  return normalizeCpproRatingSettings(
    record.rating && typeof record.rating === 'object'
      ? record.rating as Partial<CpproRatingSettings>
      : null,
  );
}

function normalizeSlug(value: unknown, fallback: unknown) {
  return String(value || fallback || '')
    .trim()
    .replace(/^#/, '')
    || 'item';
}

function normalizeProblemTags(value: unknown): Problem['tags'] {
  let source = value;
  if (typeof source === 'string') {
    const rawText = source;
    try {
      source = JSON.parse(rawText);
    } catch {
      source = rawText.split(',').map((item: string) => item.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(source)) return [];
  return source.map((item, index) => {
    const raw: Record<string, unknown> = typeof item === 'object' && item ? item as Record<string, unknown> : { name: item };
    const name = String(raw.name || raw.label || raw.slug || raw.id || item || '').trim();
    const slug = String(raw.slug || name.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || `tag-${index}`);
    return { id: Number(raw.id ?? index + 1), name: name || 'Tag', slug };
  });
}

function booleanFromApi(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  const normalized = String(value || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'ac', 'accepted'].includes(normalized);
}

function normalizeRankName(value: unknown, rating = 0, settings?: CpproRatingSettings) {
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase();
  if (['admin', 'moderator', 'teacher'].includes(normalized)) {
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
  const configuredBand = cpproRatingBandForValue(settings, rating);
  if (configuredBand) return configuredBand.name;
  if (raw && !['user', 'member'].includes(normalized)) return raw;
  if (rating >= 2900) return 'Legendary Grandmaster';
  if (rating >= 2400) return 'Grandmaster';
  if (rating >= 2100) return 'Master';
  if (rating >= 1800) return 'Expert';
  if (rating >= 1400) return 'Specialist';
  if (rating >= 1000) return 'Pupil';
  return 'Member';
}

function normalizeAllowedLanguages(value: unknown): string[] | null {
  let source = value;
  if (typeof source === 'string') {
    const raw = source;
    try {
      source = JSON.parse(raw);
    } catch {
      source = raw.split(',');
    }
  }
  if (!Array.isArray(source)) return null;
  const codes = unique(source.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean));
  return codes.length ? codes : null;
}

function mapBackendJudgeLanguage(row: Record<string, unknown>): JudgeLanguage {
  return {
    code: String(row.code || '').trim().toLowerCase(),
    label: String(row.label || row.code || '').trim(),
    runtimeLabel: row.runtime_label ? String(row.runtime_label) : null,
    extension: row.extension ? String(row.extension).replace(/^\./, '') : null,
    sourceTemplate: row.source_template ? String(row.source_template) : null,
  };
}

function normalizeProblemTitleText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^[\s#*_`>.-]+|[\s#*_`>.-]+$/g, '')
    .replace(/[\[\]()[\]{}:;,.!?"'`*_#|/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripProblemTitleLine(value: string) {
  return value
    .replace(/^\s{0,3}#{1,6}\s+/, '')
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_`]/g, '')
    .trim();
}

function looksLikeProblemStatementHeading(value: string) {
  const normalized = normalizeProblemTitleText(value);
  return [
    'input',
    'output',
    'example',
    'examples',
    'scoring',
    'subtask',
    'constraints',
    'rang buoc',
    'du lieu vao',
    'du lieu ra',
    'vi du',
    'giai thich',
  ].includes(normalized);
}

function cleanProblemTitle(value: unknown, fallback: string) {
  const raw = String(value || '').replace(/\r\n?/g, '\n').trim();
  const lines = raw
    .split('\n')
    .map(stripProblemTitleLine)
    .filter(Boolean);
  const preferred = lines.find((line) => (
    normalizeProblemTitleText(line).length >= 3
    && !looksLikeProblemStatementHeading(line)
    && line.length <= 180
  )) || lines.find((line) => normalizeProblemTitleText(line).length >= 3);
  return (preferred || fallback || 'Problem').replace(/\s+/g, ' ').trim();
}

function stripProblemStatementTitle(statement: unknown, title: string) {
  const text = String(statement || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!text) return undefined;
  const titleKey = normalizeProblemTitleText(title);
  if (!titleKey) return text;
  const lines = text.split('\n');
  let firstContent = lines.findIndex((line) => line.trim());
  if (firstContent < 0) return undefined;
  const scanLimit = Math.min(lines.length, firstContent + 5);
  for (let index = firstContent; index < scanLimit; index += 1) {
    const candidate = stripProblemTitleLine(lines[index]);
    const candidateKey = normalizeProblemTitleText(candidate);
    if (!candidateKey || candidateKey.length < 3) continue;
    const minLength = Math.min(candidateKey.length, titleKey.length);
    const isSameTitle = candidateKey === titleKey
      || (minLength >= 8 && (candidateKey.includes(titleKey) || titleKey.includes(candidateKey)));
    if (isSameTitle) {
      const nextText = lines.slice(index + 1).join('\n').trim();
      return nextText || undefined;
    }
  }
  let joinedTitle = '';
  for (let index = firstContent; index < Math.min(lines.length, firstContent + 8); index += 1) {
    const candidate = stripProblemTitleLine(lines[index]);
    if (!candidate || looksLikeProblemStatementHeading(candidate)) break;
    joinedTitle = `${joinedTitle} ${candidate}`.trim();
    const joinedKey = normalizeProblemTitleText(joinedTitle);
    const minLength = Math.min(joinedKey.length, titleKey.length);
    if (joinedKey === titleKey || (minLength >= 8 && (joinedKey.includes(titleKey) || titleKey.includes(joinedKey)))) {
      const nextText = lines.slice(index + 1).join('\n').trim();
      return nextText || undefined;
    }
  }
  return text;
}

function mapBackendProblem(row: Record<string, unknown>): Problem {
  const slug = normalizeSlug(row.external_id ?? row.slug ?? row.code, row.id);
  const tags = normalizeProblemTags(row.tags);
  const score = Number(row.rating ?? row.full_score ?? row.score ?? 0) || 0;
  const accepted = Number(row.accepted_users ?? row.accepted ?? 0) || 0;
  const submissions = Number(row.attempted_users ?? row.submissions ?? 0) || 0;
  const title = cleanProblemTitle(row.title, slug);
  return {
    id: Number(row.id ?? 0) || 0,
    code: String(row.external_id || row.code || slug),
    slug,
    title,
    difficulty: String(row.difficulty || 'easy'),
    score,
    source: String(row.source || row.organization_name || row.author_full_name || row.author_username || 'ITCoder'),
    timeLimitMs: Number(row.time_limit ?? row.timeLimitMs ?? 1000) || 1000,
    memoryLimitMb: Number(row.memory_limit ?? row.memoryLimitMb ?? 256) || 256,
    accepted,
    submissions,
    solvers: accepted,
    userSolved: booleanFromApi(row.user_solved ?? row.userSolved),
    userAttempts: Number(row.user_attempts ?? row.userAttempts ?? 0) || 0,
    myStatus: row.my_status || row.myStatus ? String(row.my_status || row.myStatus) : null,
    myBestVerdict: row.my_best_verdict || row.myBestVerdict ? String(row.my_best_verdict || row.myBestVerdict) : null,
    tags,
    statement: stripProblemStatementTitle(row.description || row.statement, title),
    constraints: String(row.constraints || '').trim() || undefined,
    editorial: String(row.editorial || '').trim() || undefined,
    createdBy: String(row.author_full_name || row.author_username || '').trim() || undefined,
    allowedLanguages: normalizeAllowedLanguages(row.allowed_languages ?? row.allowedLanguages),
  };
}

function normalizeHomeSummary(payload: unknown): HomeSummary | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const rawActivity = Array.isArray(record.activity) ? record.activity : [];
  const activity = rawActivity.slice(-14).map((entry, index) => {
    const item = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    const day = String(item.date || item.day || index + 1);
    const value = Math.max(0, Number(item.submissions ?? item.value ?? item.count ?? 0) || 0);
    const accepted = Math.max(0, Math.min(value, Number(item.accepted ?? 0) || 0));
    return {
      day,
      value,
      accepted,
      failed: Math.max(0, Number(item.failed ?? (value - accepted)) || 0),
    };
  });
  const streakRecord = record.streak && typeof record.streak === 'object'
    ? record.streak as Record<string, unknown>
    : {};
  const challengeRecord = record.challenge && typeof record.challenge === 'object'
    ? record.challenge as Record<string, unknown>
    : null;
  const presenceRecord = record.presence && typeof record.presence === 'object'
    ? record.presence as Record<string, unknown>
    : {};
  const trafficRecord = record.traffic && typeof record.traffic === 'object'
    ? record.traffic as Record<string, unknown>
    : {};
  const visits = Number(trafficRecord.visits ?? trafficRecord.totalVisits ?? record.visits ?? record.totalVisits);
  const pageViews = Number(trafficRecord.pageViews ?? trafficRecord.pageviews ?? record.pageViews ?? record.pageviews);
  return {
    activity,
    streak: {
      current: Math.max(0, Number(streakRecord.current ?? 0) || 0),
      longest: Math.max(0, Number(streakRecord.longest ?? 0) || 0),
    },
    challenge: challengeRecord ? mapBackendProblem(challengeRecord) : null,
    presence: {
      online: Math.max(0, Number(presenceRecord.online ?? record.onlineUsers ?? record.online ?? 0) || 0),
      total: Math.max(0, Number(presenceRecord.total ?? record.onlineTotal ?? record.presenceTotal ?? 0) || 0),
    },
    traffic: {
      visits: Number.isFinite(visits) && visits > 0 ? visits : null,
      pageViews: Number.isFinite(pageViews) && pageViews > 0 ? pageViews : null,
    },
  };
}

function mapBackendContest(row: Record<string, unknown>): Contest {
  const slug = normalizeSlug(row.external_id ?? row.slug, row.id);
  const problemItems = Array.isArray(row.problemItems)
    ? row.problemItems as ContestProblem[]
    : Array.isArray(row.problem_items)
      ? row.problem_items as ContestProblem[]
      : undefined;
  const rawProblems = Array.isArray(row.problems) && row.problems.every((item) => item && typeof item === 'object')
    ? row.problems as ContestProblem[]
    : undefined;
  const problems = problemItems || rawProblems;
  const myAttendance = row.myAttendance && typeof row.myAttendance === 'object'
    ? row.myAttendance as Contest['myAttendance']
    : null;
  const myParticipant = row.myParticipant && typeof row.myParticipant === 'object'
    ? row.myParticipant as Contest['myParticipant']
    : null;
  const participantUsers = Array.isArray(row.participant_users)
    ? row.participant_users
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const participant = item as Record<string, unknown>;
        const username = String(participant.username || 'user');
        return {
          id: Number(participant.id ?? 0) || undefined,
          userId: Number(participant.user_id ?? participant.userId ?? 0) || undefined,
          username,
          fullName: String(participant.full_name ?? participant.fullName ?? username),
          avatarUrl: participant.avatar_url || participant.avatarUrl ? String(participant.avatar_url || participant.avatarUrl) : null,
          joinedAt: String(participant.joined_at ?? participant.started_at ?? participant.joinedAt ?? ''),
          participationType: String(participant.participation_type ?? participant.participationType ?? ''),
          virtual: participant.virtual === null || participant.virtual === undefined ? null : Boolean(participant.virtual),
          status: participant.status ? String(participant.status) : null,
        };
      })
    : undefined;
  return {
    id: Number(row.id ?? 0) || 0,
    slug,
    title: String(row.title || slug),
    scope: String(row.visibility || row.scope || 'public'),
    accessType: String(row.access_type || row.accessType || row.visibility || 'open'),
    format: String(row.format || 'contest'),
    formatLabel: String(row.format_label || row.formatLabel || row.format || 'Contest'),
    formatConfig: row.format_config && typeof row.format_config === 'object'
      ? row.format_config as Record<string, unknown>
      : row.formatConfig && typeof row.formatConfig === 'object'
        ? row.formatConfig as Record<string, unknown>
        : {},
    freezeMinutes: Math.max(0, Number(row.freeze_minutes ?? row.freezeMinutes ?? 0) || 0),
    freezeTime: String(row.freeze_time ?? row.freezeTime ?? '').trim() || undefined,
    frozen: Boolean(row.frozen),
    freezeSupported: Boolean(row.freeze_supported ?? row.freezeSupported),
    scoreboardVisibility: String(row.scoreboard_visibility ?? row.scoreboardVisibility ?? 'V'),
    showSubmissionList: Boolean(row.show_submission_list ?? row.showSubmissionList),
    startTime: String(row.start_time || row.startTime || ''),
    endTime: String(row.end_time || row.endTime || ''),
    durationMinutes: Number(row.duration_minutes ?? row.durationMinutes ?? 0) || undefined,
    participants: Number(row.participant_count ?? row.participants ?? 0) || 0,
    virtualParticipants: Number(row.virtual_participants ?? row.virtualParticipants ?? 0) || 0,
    participantTotal: Number(row.participant_total ?? row.participantTotal ?? row.participant_count ?? row.participants ?? 0) || 0,
    participantUsers,
    participantUsersAvailable: Boolean(row.participant_users_available ?? row.participantUsersAvailable),
    participantUsersTruncated: Boolean(row.participant_users_truncated ?? row.participantUsersTruncated),
    problemCount: Number(row.problem_count ?? row.problemCount ?? problems?.length ?? 0) || 0,
    status: String(row.phase || row.status || row.configured_status || 'draft'),
    description: String(row.description || '').trim() || undefined,
    problems,
    myAttendance,
    myParticipant,
  };
}

function mapBackendOrganization(row: Record<string, unknown>): OrganizationRow {
  const slug = normalizeSlug(row.slug ?? row.name, row.id);
  return {
    id: String(row.id ?? slug),
    slug,
    name: String(row.name || slug),
    description: String(row.description || row.summary || '').trim() || undefined,
    visibility: String(row.visibility || 'public'),
    memberCount: Number(row.member_count ?? row.memberCount ?? 0) || 0,
    problemCount: Number(row.problem_count ?? row.problemCount ?? 0) || 0,
    contestCount: Number(row.contest_count ?? row.contestCount ?? 0) || 0,
    totalRating: Number(row.total_rating ?? row.totalRating ?? 0) || 0,
    myRole: row.my_role || row.myRole ? String(row.my_role || row.myRole) : null,
    myStatus: row.my_status || row.myStatus ? String(row.my_status || row.myStatus) : null,
    createdBy: row.creator_username || row.created_by || row.createdBy ? String(row.creator_username || row.created_by || row.createdBy) : null,
    updatedAt: String(row.updated_at || row.updatedAt || '').trim() || undefined,
  };
}

function mapBackendOrganizationMember(row: Record<string, unknown>): OrganizationMemberDetail {
  return {
    userId: Number(row.user_id ?? row.userId ?? row.id ?? 0) || 0,
    username: String(row.username || 'user'),
    fullName: String(row.full_name || row.fullName || row.username || 'User'),
    email: row.email ? String(row.email) : null,
    role: String(row.role || 'member'),
    status: String(row.status || 'active'),
    joinedAt: String(row.joined_at || row.joinedAt || '').trim() || undefined,
  };
}

function mapBackendOrganizationProblem(row: Record<string, unknown>): OrganizationProblemDetail {
  const slug = normalizeSlug(row.external_id ?? row.slug ?? row.id, row.id);
  return {
    id: Number(row.id ?? 0) || 0,
    slug,
    title: String(row.title || `Problem #${slug}`),
    difficulty: String(row.difficulty || 'standard'),
    visibility: String(row.visibility || 'public'),
    updatedAt: String(row.updated_at || row.updatedAt || row.created_at || '').trim() || undefined,
  };
}

function mapBackendOrganizationContest(row: Record<string, unknown>): OrganizationContestDetail {
  const slug = normalizeSlug(row.external_id ?? row.slug ?? row.id, row.id);
  return {
    id: Number(row.id ?? 0) || 0,
    slug,
    title: String(row.title || `Contest #${slug}`),
    status: String(row.status || 'scheduled'),
    visibility: String(row.visibility || 'public'),
    startTime: String(row.start_time || row.startTime || '').trim() || undefined,
    endTime: String(row.end_time || row.endTime || '').trim() || undefined,
  };
}

function mapBackendUser(row: Record<string, unknown>, ratingSettings?: CpproRatingSettings): UserRow {
  const rating = Number(row.rating ?? row.contest_rating ?? 0) || 0;
  const score = Number(row.score ?? row.total_score ?? row.points ?? 0) || 0;
  const role = String(row.role || row.rating_tier || '').trim();
  const membershipTier = String(row.membership_tier || row.pro_tier || '').trim().toLowerCase();
  const proTier = membershipTier === 'free' ? '' : membershipTier;
  const createdAt = String(row.created_at || row.createdAt || '').trim();
  const badges = normalizeStringList(row.badges ?? row.badge_names ?? row.badgeNames, []);
  const tags = unique([
    ...normalizeStringList(row.tags, []),
    role,
    row.is_teacher ? 'Teacher' : '',
    row.teacher ? 'Teacher' : '',
    row.is_ultra_max ? 'Ultra Max' : '',
    row.is_ultra ? 'Ultra' : '',
    proTier,
    ...badges,
  ]);
  const configuredBand = cpproRatingBandForValue(ratingSettings, rating);
  const configuredColor = String(row.rating_color || configuredBand?.color || '').trim();
  const rankColor = cpproRatingColors.includes(configuredColor as CpproRatingBand['color'])
    ? configuredColor as CpproRatingBand['color']
    : undefined;
  return {
    id: Number(row.id ?? row.user_id ?? row.userId ?? 0) || undefined,
    username: String(row.username || row.handle || 'user'),
    fullName: String(row.full_name || row.fullName || row.username || 'User'),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    rating,
    score,
    solved: Number(row.solved ?? row.accepted ?? 0) || 0,
    streak: Number(row.current_streak ?? row.streak ?? 0) || 0,
    maxStreak: Number(row.longest_streak ?? row.max_streak ?? row.current_streak ?? row.streak ?? 0) || 0,
    rankName: normalizeRankName(row.rank_name || row.rating_tier || role, rating, ratingSettings),
    rankColor,
    tags,
    proTier,
    badges,
    bio: String(row.bio || '').trim() || undefined,
    maxRating: Number(row.max_rating ?? row.rating ?? 0) || undefined,
    contestCount: Number(row.contests_attempted ?? row.contest_count ?? 0) || undefined,
    totalSubmissions: Number(row.submissions ?? 0) || undefined,
    createdAt: createdAt || undefined,
    organizationName: row.organization_name ? String(row.organization_name) : null,
    organizationSlug: row.organization_slug ? String(row.organization_slug) : null,
    contestRatingTimes: Number(row.contest_rating_times ?? 0) || undefined,
  };
}

function mapBackendSubmission(row: Record<string, unknown>): Submission {
  const problemSlug = normalizeSlug(row.problem_external_id ?? row.problem_slug ?? row.external_id ?? row.problem_id, row.problem_id);
  const score = Number(row.score ?? 0) || 0;
  const maxScore = Number(row.max_score ?? row.full_score ?? row.problem_score ?? 100) || 100;
  const total = Math.max(1, Number(row.testcase_count ?? row.total_tests ?? row.total ?? 0) || 1);
  const passed = Math.max(0, Math.min(total, Number(row.passed_tests ?? row.passed ?? row.accepted_tests ?? (score >= maxScore ? total : score > 0 ? 1 : 0)) || 0));
  return {
    id: Number(row.id ?? 0) || 0,
    username: String(row.username || row.full_name || 'user'),
    problemTitle: String(row.problem_title || row.problemTitle || `Problem #${problemSlug}`),
    problemSlug,
    contestTitle: row.contest_title ? String(row.contest_title) : undefined,
    contestSlug: row.contest_external_id ? String(row.contest_external_id) : undefined,
    language: String(row.language || 'C++17'),
    verdict: String(row.verdict || 'PENDING').toUpperCase(),
    score: String(score),
    maxScore: String(maxScore),
    passed,
    total,
    timeMs: Number(row.runtime ?? row.max_runtime ?? 0) || 0,
    memoryKb: Number(row.memory ?? 0) || 0,
    submittedAt: String(row.created_at || row.submittedAt || new Date().toISOString()),
  };
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeProfileRatingHistory(value: unknown): UserRatingHistoryPoint[] {
  return rowsFromApi<Record<string, unknown>>(value)
    .map((row) => ({
      contestId: Number(row.contest_id ?? row.contestId ?? 0) || undefined,
      contestTitle: String(row.contest_title || row.contestTitle || 'Contest'),
      rating: nullableNumber(row.rating),
      oldRating: nullableNumber(row.old_rating ?? row.oldRating),
      delta: nullableNumber(row.delta),
      rank: nullableNumber(row.rank),
      performance: nullableNumber(row.performance),
      createdAt: String(row.created_at || row.createdAt || new Date().toISOString()),
      virtual: booleanFromApi(row.virtual),
    }))
    .filter((item) => item.contestTitle || item.rating !== null);
}

function normalizeProfileActivityHeatmap(value: unknown): UserActivityHeatmapPoint[] {
  return rowsFromApi<Record<string, unknown>>(value)
    .map((row) => ({
      date: String(row.date || row.day || row.created_at || '').slice(0, 10),
      count: Number(row.count ?? row.value ?? row.submissions ?? 0) || 0,
    }))
    .filter((item) => item.date && item.count > 0);
}

function normalizeProfileSolvedTags(value: unknown): UserSolvedTag[] {
  return rowsFromApi<Record<string, unknown>>(value)
    .map((row, index) => {
      const name = String(row.name || row.tag_name || row.slug || `Tag ${index + 1}`).trim();
      return {
        name,
        slug: String(row.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `tag-${index + 1}`),
        count: Number(row.count ?? row.total ?? 0) || 0,
      };
    })
    .filter((item) => item.name && item.count > 0);
}

function normalizeProfileProblemSummaries(value: unknown, solved = true): UserProblemSummary[] {
  return rowsFromApi<Record<string, unknown>>(value)
    .map((row) => {
      const slug = normalizeSlug(row.external_id ?? row.slug ?? row.problem_slug ?? row.problem_id, row.id ?? row.problem_id);
      return {
        id: Number(row.id ?? row.problem_id ?? 0) || undefined,
        slug,
        title: String(row.title || row.problem_title || row.name || slug),
        solvedAt: solved ? String(row.solved_at || row.created_at || '').trim() || undefined : undefined,
        lastAttempt: !solved ? String(row.last_attempt || row.last_submission || row.created_at || '').trim() || undefined : undefined,
      };
    })
    .filter((item) => item.slug);
}

function normalizeProfileBadges(value: unknown): string[] {
  return rowsFromApi<Record<string, unknown>>(value)
    .map((row) => String(row.name || row.label || row.badge || '').trim())
    .filter(Boolean);
}


const communityTabs: Array<{ key: CommunityTabKey; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'news', label: 'Tin tức hệ thống' },
  { key: 'emotion', label: 'Cảm xúc học viên' },
  { key: 'blog', label: 'Blog thành viên' },
];

function postCategoryKey(value: unknown): Exclude<CommunityTabKey, 'all'> {
  const type = String(value || '').toLowerCase();
  if (type === 'blog' || type === 'magazine') return 'blog';
  if (type === 'success' || type === 'info' || type === 'emotion' || type === 'story') return 'emotion';
  return 'news';
}

function postCategory(value: unknown) {
  const categoryKey = postCategoryKey(value);
  if (categoryKey === 'blog') return 'Blog thành viên';
  if (categoryKey === 'emotion') return 'Cảm xúc học viên';
  return 'Tin tức hệ thống';
}

function slugifyTitle(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function postHref(post: Pick<HomePost, 'id' | 'slug' | 'title'>) {
  const key = post.slug || (post.id ? String(post.id) : slugifyTitle(post.title));
  return `/posts/${encodeURIComponent(key || 'community')}`;
}

function communityPostKey(post: HomePost) {
  return post.slug || (post.id ? String(post.id) : post.title);
}

function openInternalLink(event: React.MouseEvent<HTMLElement>, go: (path: string) => void, href: string) {
  event.preventDefault();
  go(href);
}

const communityPostImages = [
  '/assets/course-gogovoi-advanced.png',
  '/assets/course-luyen-de-quoc-gia-20.png',
  '/assets/course-gogovoi-basic.png',
  '/assets/course-on-thi-vao-10-chuyen-tin.png',
  '/assets/VOI1-DccYHpUA.png',
];

function communityPostImage(row: Record<string, unknown>, title: string) {
  if (row.image_url) return String(row.image_url);
  const seed = Math.abs([...title].reduce((sum, char) => sum + char.charCodeAt(0), Number(row.id || 0)));
  return communityPostImages[seed % communityPostImages.length];
}

function commentsPreviewFromPostRow(row: Record<string, unknown>) {
  const value = row.comments_preview ?? row.commentsPreview;
  if (Array.isArray(value)) return value.map((item) => mapBackendPostComment(item as Record<string, unknown>));
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((item) => mapBackendPostComment(item as Record<string, unknown>));
    } catch {
      return [];
    }
  }
  return [];
}

function mapBackendPostComment(row: Record<string, unknown>): CommunityComment {
  const author = String(row.author_username || row.username || row.author || 'member');
  const fullName = String(row.author_full_name || row.full_name || row.fullName || author);
  const avatarUrl = String(row.author_avatar_url || row.avatar_url || row.avatarUrl || '').trim();
  return {
    id: row.id as string | number | undefined,
    parentId: row.parent_id === null || row.parentId === null ? null : (row.parent_id || row.parentId) as string | number | undefined,
    author,
    badge: String(row.badge || row.author_role || 'Member'),
    body: String(row.body || row.content || '').trim(),
    avatarUrl: avatarUrl || null,
    score: Number(row.score ?? row.vote_score ?? 0) || 0,
    voteCount: Number(row.vote_count ?? row.voteCount ?? 0) || 0,
    myVote: Number(row.my_vote ?? row.myVote ?? 0) || 0,
    reactions: normalizeReactionMap(row.reactions),
    reactionCount: Number(row.reaction_count ?? row.reactionCount ?? 0) || 0,
    myReaction: row.my_reaction || row.myReaction ? String(row.my_reaction || row.myReaction) : null,
    createdAt: String(row.created_at || row.createdAt || row.updated_at || new Date().toISOString()),
  };
}

function normalizeReactionMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, count]) => [key, Number(count) || 0])
      .filter(([, count]) => Number(count) > 0),
  );
}

function normalizeCommunityReactionActors(value: unknown): CommunityReactionActor[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const username = String(row.username || 'member');
    const fullName = String(row.fullName || row.full_name || username);
    const avatarUrl = String(row.avatarUrl || row.avatar_url || '').trim();
    return {
      username,
      fullName,
      avatarUrl: avatarUrl || null,
      reaction: String(row.reaction || row.reaction_type || 'like'),
      updatedAt: row.updatedAt || row.updated_at ? String(row.updatedAt || row.updated_at) : null,
    };
  }).filter((actor) => actor.username);
}

function mapBackendProblemComment(row: Record<string, unknown>): ProblemComment {
  const author = String(row.username || row.author_username || 'member');
  const fullName = String(row.full_name || row.author_full_name || author);
  const avatarUrl = String(row.avatar_url || row.author_avatar_url || '').trim();
  const reactionsRaw = row.reactions && typeof row.reactions === 'object' ? row.reactions as Record<string, unknown> : {};
  const reactions = Object.fromEntries(
    Object.entries(reactionsRaw).map(([key, value]) => [key, Number(value) || 0]),
  );
  return {
    id: (row.id as number | string | undefined) || `${author}-${row.created_at || Date.now()}`,
    parentId: row.parent_id === null || row.parentId === null ? null : Number(row.parent_id ?? row.parentId ?? 0) || null,
    author,
    fullName,
    avatarUrl: avatarUrl || null,
    body: String(row.body || '').trim(),
    isDeleted: Boolean(row.is_deleted ?? row.isDeleted),
    reactions,
    reactionCount: Number(row.reaction_count ?? row.reactionCount ?? Object.values(reactions).reduce((sum, value) => sum + value, 0)) || 0,
    myReaction: row.my_reaction || row.myReaction ? String(row.my_reaction || row.myReaction) : null,
    createdAt: String(row.created_at || row.createdAt || row.updated_at || new Date().toISOString()),
    updatedAt: row.updated_at || row.updatedAt ? String(row.updated_at || row.updatedAt) : undefined,
  };
}

function mapBackendPost(row: Record<string, unknown>): HomePost {
  const id = Number(row.id ?? 0) || undefined;
  const title = String(row.title || 'Thông báo hệ thống');
  const slug = String(row.slug || row.post_slug || row.external_id || id || '').trim();
  const content = String(row.excerpt || row.content || '').replace(/<[^>]*>/g, '').trim();
  const authorAvatarUrl = String(row.author_avatar_url || row.avatar_url || '').trim();
  return {
    id,
    slug: slug || undefined,
    categoryKey: postCategoryKey(row.post_type),
    user: {
      username: String(row.author_username || 'system'),
      fullName: String(row.author_full_name || row.author_username || 'ITCoder'),
      avatarUrl: authorAvatarUrl || null,
      rating: 0,
      score: 0,
      solved: 0,
      streak: 0,
      maxStreak: 0,
      rankName: 'Admin',
      tags: ['admin'],
      proTier: '',
    },
    date: formatDate(String(row.published_at || row.created_at || row.updated_at || new Date().toISOString())),
    category: postCategory(row.post_type),
    title,
    body: content || 'Thông báo mới từ hệ thống.',
    image: communityPostImage(row, title),
    reactions: Number(row.vote_score ?? row.vote_count ?? 0) || 0,
    emotionReactions: normalizeReactionMap(row.emotion_reactions ?? row.emotionReactions),
    emotionReactionCount: Number(row.emotion_reaction_count ?? row.emotionReactionCount ?? 0) || 0,
    myReaction: row.my_reaction || row.myReaction ? String(row.my_reaction || row.myReaction) : null,
    reactionActors: normalizeCommunityReactionActors(row.reactors ?? row.reactionActors),
    isRead: Boolean(row.is_read ?? row.isRead),
    readAt: row.read_at || row.readAt ? String(row.read_at || row.readAt) : null,
    comments: Number(row.comment_count ?? row.comments ?? 0) || 0,
    commentsPreview: commentsPreviewFromPostRow(row),
  };
}

async function loadBackendCpproData(): Promise<CpproData> {
  if (isLcojBackendMode()) {
    // Real LCOJ database only, through the privacy-aware CPPro bridge. No crawl
    // or broad API v2 fallback: an honest empty state is safer than stale or
    // over-broad data.
    return await loadLcojBridgeCpproData() || normalizeCpproData(emptyCpproData);
  }
  if (shouldUseStaticCpproData()) {
    const staticData = await loadStaticCpproData();
    return await loadLcojApiCpproData(staticData) || staticData || normalizeCpproData(emptyCpproData);
  }
  const hasNotificationToken = Boolean(localStorage.getItem('oj_platform_token') || localStorage.getItem('cppro_access_token'));
  const [
    problemsPayload,
    contestsPayload,
    organizationsPayload,
    usersPayload,
    leaderboardPayload,
    submissionsPayload,
    postsPayload,
    notificationPayload,
    announcementFallbackPayload,
    siteSettingsPayload,
    homeSummaryPayload,
    statsPayload,
    onlineUsersPayload,
    languagesPayload,
  ] = await Promise.all([
    safeApi<unknown>('/problems?limit=100&withCount=true', { rows: [], total: 0 }, 6000),
    safeApi<unknown>('/contests?limit=100', [], 4500),
    safeApi<unknown>('/organizations', [], 4500),
    safeApi<unknown>('/users?limit=1000&withCount=true', { rows: [], total: 0 }, 5500),
    safeApi<unknown>('/leaderboard?limit=1000&withCount=true', { rows: [], total: 0 }, 5500),
    safeApi<unknown>('/submissions?limit=50&withCount=true', { rows: [], total: 0 }, 4500),
    safeApi<unknown>('/posts?limit=12&withCount=true', { rows: [], total: 0 }, 4500),
    hasNotificationToken
      ? safeApi<unknown>('/notifications/announcements?limit=10', { rows: [], total: 0, unreadCount: 0 }, 2500)
      : Promise.resolve({ rows: [], total: 0, unreadCount: 0 }),
    safeApi<unknown>('/posts?limit=10&type=announcement&withCount=true', { rows: [], total: 0 }, 2500),
    safeApi<unknown>('/site-settings', null, 3000),
    safeApi<unknown>('/home/summary', null, 2500),
    safeApi<unknown>('/stats', null, 2500),
    safeApi<unknown>('/users/online', { rows: [], total: 0, online: 0 }, 1500),
    safeApi<unknown>('/languages?enabled=true', fallbackJudgeLanguages, 2500),
  ]);

  const [plainUserRows, leaderboardRows] = await Promise.all([
    fetchPagedApiRows<Record<string, unknown>>(
      usersPayload,
      (page, limit) => `/users?page=${page}&limit=${limit}&withCount=true`,
      1000,
    ),
    fetchPagedApiRows<Record<string, unknown>>(
      leaderboardPayload,
      (page, limit) => `/leaderboard?page=${page}&limit=${limit}&withCount=true`,
      1000,
    ),
  ]);
  const problems = rowsFromApi<Record<string, unknown>>(problemsPayload).map(mapBackendProblem);
  const contests = rowsFromApi<Record<string, unknown>>(contestsPayload).map(mapBackendContest);
  const organizations = rowsFromApi<Record<string, unknown>>(organizationsPayload).map(mapBackendOrganization);
  const ratingSettings = ratingSettingsFromSiteSettings(siteSettingsPayload);
  const leaderboardUsers = leaderboardRows.map((row) => mapBackendUser(row, ratingSettings));
  const plainUsers = plainUserRows.map((row) => mapBackendUser(row, ratingSettings));
  const usersByName = new Map<string, UserRow>();
  plainUsers.forEach((user) => usersByName.set(user.username.toLowerCase(), user));
  leaderboardUsers.forEach((user) => {
    const key = user.username.toLowerCase();
    const existing = usersByName.get(key);
    usersByName.set(key, existing ? {
      ...existing,
      ...user,
      tags: unique([...(existing.tags || []), ...(user.tags || [])]),
      bio: existing.bio || user.bio,
      avatarUrl: user.avatarUrl || existing.avatarUrl,
      fullName: user.fullName || existing.fullName,
    } : user);
  });
  const users = Array.from(usersByName.values()).sort((left, right) => (
    (right.score || 0) - (left.score || 0)
    || (right.rating || 0) - (left.rating || 0)
    || left.username.localeCompare(right.username, 'vi', { numeric: true, sensitivity: 'base' })
  ));
  const submissions = rowsFromApi<Record<string, unknown>>(submissionsPayload).map(mapBackendSubmission);
  const posts = rowsFromApi<Record<string, unknown>>(postsPayload).map(mapBackendPost);
  const notificationRows = rowsFromApi<Record<string, unknown>>(notificationPayload);
  const fallbackAnnouncementRows = rowsFromApi<Record<string, unknown>>(announcementFallbackPayload);
  const notifications = (notificationRows.length ? notificationRows : fallbackAnnouncementRows).map(mapBackendPost);
  const statsRecord = statsPayload && typeof statsPayload === 'object' ? statsPayload as Record<string, unknown> : {};
  const onlineRecord = onlineUsersPayload && typeof onlineUsersPayload === 'object' ? onlineUsersPayload as Record<string, unknown> : {};
  const onlineUsers = Math.max(0, Number(onlineRecord.online ?? onlineRecord.total ?? 0) || 0);
  const visits = Math.max(0, Number(statsRecord.visits ?? statsRecord.totalVisits ?? statsRecord.visitCount ?? 0) || 0);
  const pageViews = Math.max(0, Number(statsRecord.pageViews ?? statsRecord.pageviews ?? statsRecord.totalPageViews ?? 0) || 0);
  const judgeLanguages = rowsFromApi<Record<string, unknown>>(languagesPayload)
    .map(mapBackendJudgeLanguage)
    .filter((item) => item.code && item.label);
  const tagsBySlug = new Map<string, Problem['tags'][number]>();
  problems.forEach((problem) => {
    problem.tags.forEach((tag) => tagsBySlug.set(tag.slug, tag));
  });
  const problemDetails = Object.fromEntries(problems.flatMap((problem) => [
    [problem.slug, problem],
    [String(problem.id), problem],
  ]));
  const contestDetails = Object.fromEntries(contests.flatMap((contest) => [
    [contest.slug, contest],
    [String(contest.id), contest],
  ]));
  const profiles = Object.fromEntries(users.map((user) => [user.username, user]));

  const backendData = normalizeCpproData({
    generatedAt: new Date().toISOString(),
    source: 'backend-api',
    crawlManifest: null,
    stats: {
      ...emptyStats,
      problems: totalFromApi(problemsPayload, problems.length),
      contests: totalFromApi(contestsPayload, contests.length),
      organizations: totalFromApi(organizationsPayload, organizations.length),
      users: totalFromApi(leaderboardPayload, totalFromApi(usersPayload, users.length)),
      onlineUsers,
      visits,
      pageViews,
      submissions: totalFromApi(submissionsPayload, submissions.length),
      posts: totalFromApi(postsPayload, posts.length),
      notifications: totalFromApi(notificationPayload, totalFromApi(announcementFallbackPayload, notifications.length)),
      tags: tagsBySlug.size,
    },
    problems,
    problemDetails,
    contests,
    contestDetails,
    organizations,
    users,
    profiles,
    submissions,
    posts,
    notifications,
    exams: [],
    hsgCategories: [],
    tags: [...tagsBySlug.values()],
    courses: [],
    judgeLanguages: judgeLanguages.length ? judgeLanguages : fallbackJudgeLanguages,
    homeSummary: normalizeHomeSummary({
      ...(homeSummaryPayload && typeof homeSummaryPayload === 'object' ? homeSummaryPayload as Record<string, unknown> : {}),
      presence: {
        online: onlineUsers,
        total: Math.max(onlineUsers, totalFromApi(onlineUsersPayload, onlineUsers)),
      },
      traffic: {
        visits: visits || null,
        pageViews: pageViews || null,
      },
    }),
    auth: {
      googleEnabled: googleOAuthEnabledFromSettings(siteSettingsPayload),
    },
    contact: contactFromSiteSettings(siteSettingsPayload),
    topbarFeatures: topbarFeaturesFromSiteSettings(siteSettingsPayload),
    ratingSettings,
    platformFrontendUrl: siteFrontendUrlFromSettings(siteSettingsPayload),
  });
  if (hasBackendRows(backendData)) return backendData;
  return await loadStaticCpproData() || backendData;
}

function authUserToStored(user: AuthUser): StoredCpproUser {
  return {
    username: user.username,
    displayName: user.full_name || user.username,
    email: user.email,
    full_name: user.full_name || user.username,
    avatar_url: user.avatar_url || null,
    roles: [user.role].filter(Boolean),
    role: user.role,
    is_teacher: Boolean(user.is_teacher),
    membership_tier: user.membership_tier || 'free',
    membership_expires_at: user.membership_expires_at || null,
    streak_timezone: user.streak_timezone || 'Asia/Bangkok',
    streak_timezone_changed_at: user.streak_timezone_changed_at || null,
    bio: user.bio || null,
    rank_name: user.role === 'admin' ? 'Admin' : 'Member',
    solved: 0,
    score: 0,
    pp_score: 0,
    streak: 0,
    max_streak: 0,
  };
}

function writeSharedCookie(name: string, value: string, maxAgeSeconds: number) {
  // Add `Secure` on HTTPS so the token cookie is not sent over cleartext HTTP.
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function readSharedCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  if (!match) return null;
  try {
    return decodeURIComponent(match.slice(name.length + 1));
  } catch {
    return match.slice(name.length + 1);
  }
}

// M-7: only allow http(s) or site-relative hrefs. Rejects javascript:/data:/vbscript:
// URIs (stored-XSS sinks) coming from admin/footer-configurable fields.
function safeExternalHref(value: unknown, fallback = ''): string {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  return fallback;
}

function clearSharedCookie(name: string) {
  writeSharedCookie(name, '', 0);
}

function persistPlatformBridgeSession(token: string, user: AuthUser | StoredCpproUser | Record<string, unknown>) {
  const maxAge = 60 * 60 * 12;
  writeSharedCookie('oj_platform_token', token, maxAge);
  writeSharedCookie('oj_platform_user', JSON.stringify(user), maxAge);
}

function syncPlatformBridgeSessionFromStorage() {
  const token = localStorage.getItem('oj_platform_token') || localStorage.getItem('cppro_access_token');
  const userRaw = localStorage.getItem('oj_platform_user') || localStorage.getItem('cppro_user');
  if (!token || !userRaw) return;
  try {
    persistPlatformBridgeSession(token, JSON.parse(userRaw));
  } catch {
    persistPlatformBridgeSession(token, { username: 'user', role: 'user' });
  }
}

function clearPlatformBridgeSession() {
  clearSharedCookie('oj_platform_token');
  clearSharedCookie('oj_platform_user');
}

function saveCpproSession(token: string, user: AuthUser) {
  const storedUser = authUserToStored(user);
  localStorage.setItem('oj_platform_token', token);
  localStorage.setItem('cppro_access_token', token);
  localStorage.setItem('oj_platform_user', JSON.stringify(user));
  localStorage.setItem('cppro_user', JSON.stringify(storedUser));
  persistPlatformBridgeSession(token, user);
  return storedUser;
}

const cpproLocales = ['vi', 'en'] as const;
const defaultTimezoneOptions = [
  'Asia/Bangkok',
  'Asia/Ho_Chi_Minh',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Taipei',
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
] as const;
const cpproI18n = {
  vi: {
    'notifications.title': 'Thông báo',
    'notifications.markAllRead': 'Đọc tất cả',
    'notifications.viewAll': 'Xem tất cả',
    'notifications.empty': 'Chưa có thông báo mới.',
    'notifications.welcomeTitle': 'Chào mừng đến với {brand}!',
    'notifications.welcomeBody': '{greeting} {name}, bắt đầu luyện tập với một bài mới nhé.',
    'notifications.systemFallbackTitle': 'Thông báo hệ thống',
    'notifications.systemFallbackBody': 'Thông báo mới từ hệ thống.',
    'nav.home': 'Trang Chủ',
    'nav.courses': 'Khóa Học',
    'nav.problems': 'Bài Tập',
    'nav.contests': 'Kỳ Thi',
    'nav.organizations': 'Tổ chức',
    'nav.hsg': 'Đề HSG',
    'nav.users': 'Thành Viên',
    'nav.submissions': 'Bài Nộp',
    'nav.status': 'Trạng thái',
    'nav.more': 'Thêm',
    'nav.notifications': 'Thông báo',
    'nav.feedback': 'Góp ý',
    'nav.payments': 'Thanh toán',
    'nav.wardrobe': 'Tủ đồ',
    'nav.theme': 'Giao diện',
    'nav.chat': 'Chat',
    'user.profile': 'Hồ sơ',
    'user.settings': 'Cài đặt',
    'user.logout': 'Đăng xuất',
    'admin.title': 'Quản trị',
    'admin.dmoj': 'Quản trị DMOJ',
    'admin.cppro': 'Quản trị CPPro',
    'admin.dashboard': 'Bảng quản trị',
    'admin.problems': 'Bài tập',
    'admin.contests': 'Kỳ thi',
    'admin.cluster': 'Máy chấm',
    'admin.languages': 'Ngôn ngữ',
    'admin.courses': 'Khóa học',
    'admin.hsg': 'Đề HSG',
    'admin.organizations': 'Tổ chức',
    'admin.theme': 'Giao diện',
    'signed.goalTitle': 'MỤC TIÊU HÔM NAY',
    'signed.goalComplete': 'Bạn đã hoàn thành mục tiêu hôm nay!',
    'signed.goalKeepGoing': 'Cố thêm một chút để hoàn thành mục tiêu hôm nay!',
    'signed.goalDaysDone': 'ngày đạt mục tiêu',
    'signed.goalStreakDays': 'ngày liên tiếp',
    'signed.targetStreak': 'Chuỗi mục tiêu',
    'signed.targetBanner': 'MỤC TIÊU CỦA BẠN',
    'signed.activityTitle': '14 ngày gần đây',
    'signed.activityLegendAc': 'Lượt AC',
    'signed.activityLegendNonAc': 'Chưa AC',
    'signed.submitStreak': 'Chuỗi nộp bài',
    'signed.maxStreak': 'Max chuỗi',
    'settings.timezoneTitle': 'Múi giờ và đồng hồ streak',
    'settings.timezoneSubtitle': 'Chọn múi giờ IANA dùng để tính ngày streak và thời gian trên hồ sơ.',
    'settings.timezoneLabel': 'Múi giờ',
    'settings.timezoneSelected': 'Múi giờ đã chọn',
    'settings.timezoneUtc': 'Giờ UTC',
    'settings.timezoneLimit': 'Chỉ có thể đổi múi giờ một lần trong 14 ngày.',
    'settings.timezoneLastChanged': ' Lần đổi gần nhất {time}.',
    'settings.timezoneSaved': 'Đã lưu múi giờ. Ranh giới streak sẽ dùng múi giờ này.',
    'settings.timezoneSaveFailed': 'Không lưu được múi giờ.',
    'settings.timezoneLoadFailed': 'Không tải được danh sách múi giờ.',
    'settings.timezoneSave': 'Lưu múi giờ',
    'settings.timezoneSaving': 'Đang lưu...',
    'settings.timezoneLogin': 'Đăng nhập để lưu múi giờ cá nhân và tính streak ổn định.',
    'settings.signIn': 'Đăng nhập',
  },
  en: {
    'nav.home': 'Home',
    'nav.courses': 'Courses',
    'nav.problems': 'Problems',
    'nav.contests': 'Contests',
    'nav.organizations': 'Organizations',
    'nav.hsg': 'HSG Sets',
    'nav.users': 'Members',
    'nav.submissions': 'Submissions',
    'nav.status': 'Status',
    'nav.more': 'More',
    'nav.notifications': 'Notifications',
    'nav.feedback': 'Feedback',
    'nav.payments': 'Payments',
    'nav.wardrobe': 'Wardrobe',
    'nav.theme': 'Theme',
    'nav.chat': 'Chat',
    'notifications.title': 'Notifications',
    'notifications.markAllRead': 'Mark all read',
    'notifications.viewAll': 'View all',
    'notifications.empty': 'No new notifications.',
    'notifications.welcomeTitle': 'Welcome to {brand}!',
    'notifications.welcomeBody': '{greeting} {name}, start practicing with a fresh problem.',
    'notifications.systemFallbackTitle': 'System announcement',
    'notifications.systemFallbackBody': 'A new platform announcement is available.',
    'user.profile': 'Profile',
    'user.settings': 'Settings',
    'user.logout': 'Log out',
    'admin.title': 'Management',
    'admin.dmoj': 'DMOJ Admin',
    'admin.cppro': 'CPPro Management',
    'admin.dashboard': 'Dashboard',
    'admin.problems': 'Problems',
    'admin.contests': 'Contests',
    'admin.cluster': 'Judge machines',
    'admin.languages': 'Languages',
    'admin.courses': 'Courses',
    'admin.hsg': 'HSG sets',
    'admin.organizations': 'Organizations',
    'admin.theme': 'Theme',
    'signed.goalTitle': 'TODAY GOAL',
    'signed.goalComplete': 'You have completed today\'s goal!',
    'signed.goalKeepGoing': 'A little more to complete today\'s goal!',
    'signed.goalDaysDone': 'goal days completed',
    'signed.goalStreakDays': 'day streak',
    'signed.targetStreak': 'Goal streak',
    'signed.targetBanner': 'YOUR GOAL',
    'signed.activityTitle': 'Last 14 days',
    'signed.activityLegendAc': 'AC submissions',
    'signed.activityLegendNonAc': 'Non-AC',
    'signed.submitStreak': 'Submit streak',
    'signed.maxStreak': 'Max streak',
    'settings.timezoneTitle': 'Timezone and streak clock',
    'settings.timezoneSubtitle': 'Choose the IANA timezone used for daily streak boundaries and profile timestamps.',
    'settings.timezoneLabel': 'Timezone',
    'settings.timezoneSelected': 'Selected timezone',
    'settings.timezoneUtc': 'Coordinated Universal Time',
    'settings.timezoneLimit': 'Timezone changes are limited to once every 14 days.',
    'settings.timezoneLastChanged': ' Last changed {time}.',
    'settings.timezoneSaved': 'Timezone saved. Streak boundaries now use this timezone.',
    'settings.timezoneSaveFailed': 'Could not save timezone.',
    'settings.timezoneLoadFailed': 'Could not load timezone options.',
    'settings.timezoneSave': 'Save timezone',
    'settings.timezoneSaving': 'Saving...',
    'settings.timezoneLogin': 'Sign in to save a personal timezone and calculate streak days consistently.',
    'settings.signIn': 'Sign in',
  },
} as const;
type CpproI18nKey = keyof typeof cpproI18n.vi;

function t(locale: CpproLocale, key: CpproI18nKey) {
  return cpproI18n[locale]?.[key] || cpproI18n.vi[key] || key;
}

type CpproNavItem = {
  path: string;
  labelKey: CpproI18nKey;
  icon: typeof Home;
  featureKey?: TopbarFeatureKey;
};

const navItems = [
  { path: '/', labelKey: 'nav.home', icon: Home },
  { path: '/courses', labelKey: 'nav.courses', icon: GraduationCap, featureKey: 'courses' },
  { path: '/problems', labelKey: 'nav.problems', icon: Code2, featureKey: 'problems' },
  { path: '/contests', labelKey: 'nav.contests', icon: Trophy, featureKey: 'contests' },
  { path: '/organizations', labelKey: 'nav.organizations', icon: GraduationCap, featureKey: 'organizations' },
  { path: '/hsg', labelKey: 'nav.hsg', icon: BookOpen, featureKey: 'hsg' },
  { path: '/users', labelKey: 'nav.users', icon: UsersRound, featureKey: 'users' },
  { path: '/submissions', labelKey: 'nav.submissions', icon: ListChecks, featureKey: 'submissions' },
] satisfies CpproNavItem[];

function topbarFeatureEnabled(features: TopbarFeatures, key?: TopbarFeatureKey) {
  return !key || features[key] !== false;
}

const fallbackActivity = [2, 5, 3, 8, 1, 0, 4, 6, 9, 2, 4, 7, 10, 5];

const fallbackHsgCategories: HsgCategory[] = [];

function readStoredTheme(): ThemeMode {
  const raw = localStorage.getItem('cppro-theme') || localStorage.getItem('judgeTheme') || 'system';
  return raw === 'dark' || raw === 'light' || raw === 'system' ? raw : 'system';
}

function isCpproLocale(value: string | undefined): value is CpproLocale {
  return cpproLocales.includes(value as CpproLocale);
}

function readStoredLocale(): CpproLocale {
  const raw = localStorage.getItem('oj_platform_locale') || localStorage.getItem('cppro-locale') || '';
  if (isCpproLocale(raw)) return raw;
  const browserLanguage = navigator.language.toLowerCase();
  return browserLanguage.startsWith('vi') ? 'vi' : 'en';
}

function normalizeCpproPublicPath(pathname: string) {
  const cleanPath = (pathname || '/').replace(/\/+$/, '') || '/';
  const authAlias = cleanPath.match(/^\/accounts\/(login|register|logout)$/);
  if (authAlias) return `/${authAlias[1]}`;

  const legacyAlias = cleanPath.match(/^\/(problem|contest|user|organization|submission)(\/.*)?$/);
  if (!legacyAlias) return cleanPath;
  const canonicalByLegacyRoute: Record<string, string> = {
    problem: 'problems',
    contest: 'contests',
    user: 'users',
    organization: 'organizations',
    submission: 'submission',
  };
  const canonical = canonicalByLegacyRoute[legacyAlias[1]];
  return `/${canonical}${legacyAlias[2] || ''}`;
}

function isCpproPublicAuthAlias(pathname: string) {
  return /^\/accounts\/(login|register|logout)\/?$/.test(pathname || '');
}

function parseCpproPath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0]?.toLowerCase();
  if (isCpproLocale(first)) {
    const route = `/${segments.slice(1).join('/')}`.replace(/\/$/, '');
    return { locale: first, path: normalizeCpproPublicPath(route === '' ? '/' : route) };
  }
  return { locale: readStoredLocale(), path: normalizeCpproPublicPath(pathname || '/') };
}

function hasCpproLocalePrefix(pathname: string) {
  return isCpproLocale(pathname.split('/').filter(Boolean)[0]?.toLowerCase());
}

function isLcojReservedPath(pathname: string) {
  return /^\/(accounts|admin|api|channels|event|i18n|impersonate|judge-select2|martor|media|newsletter|old_oj_media|pdf|static|submission_file|tasks|widgets)(\/|$)/.test(pathname);
}

function withCpproLocale(locale: CpproLocale, nextPath: string) {
  const cleanPath = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
  const withoutLocale = cleanPath === '/vi' || cleanPath === '/en' ? '/' : cleanPath.replace(/^\/(vi|en)(?=\/|$)/, '') || '/';
  const normalized = normalizeCpproPublicPath(withoutLocale);
  return normalized === '/' ? `/${locale}` : `/${locale}${normalized}`;
}

function routePathWithSearch(pathname: string, search = '', hash = '') {
  const parsed = parseCpproPath(pathname || '/');
  const path = parsed.path || '/';
  return `${path}${search || ''}${hash || ''}`;
}

function authPathWithReturn(mode: 'login' | 'register' = 'login') {
  const current = routePathWithSearch(window.location.pathname, window.location.search, window.location.hash);
  const currentPath = current.split(/[?#]/, 1)[0] || '/';
  if (currentPath === '/' || currentPath === '/login' || currentPath === '/register') {
    return `/${mode}`;
  }
  return `/${mode}?next=${encodeURIComponent(current)}`;
}

function postLoginRedirectPath(defaultPath = '/') {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('next') || params.get('redirect') || params.get('returnTo') || '';
  if (!raw) return defaultPath;
  try {
    const target = new URL(raw, window.location.origin);
    if (target.origin !== window.location.origin) return defaultPath;
    const normalized = routePathWithSearch(target.pathname, target.search, target.hash);
    const normalizedPath = normalized.split(/[?#]/, 1)[0] || '/';
    return normalizedPath === '/login' || normalizedPath === '/register' ? defaultPath : normalized;
  } catch {
    return defaultPath;
  }
}

function legacyFrontendUrlForPath(nextPath: string, configuredBase?: string | null) {
  const cleanPath = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
  const configured = String(configuredBase || '').trim().replace(/\/+$/, '');
  const current = new URL(window.location.href);
  if (configured) {
    const configuredUrl = new URL(`${configured}/`, current.href);
    if (configuredUrl.port === '18082' || (current.port === '18082' && configuredUrl.host === current.host)) {
      configuredUrl.port = '18081';
    }
    return new URL(cleanPath, configuredUrl.origin).toString();
  }
  if (current.port === '18082') {
    current.port = '18081';
  } else if (['4196', '5173', '5174'].includes(current.port)) {
    current.port = '18081';
  }
  return new URL(cleanPath, current.origin).toString();
}

function managementFrontendUrlForPath(nextPath: string, configuredBase?: string | null) {
  const cleanPath = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
  const current = new URL(window.location.href);
  if (current.port === '18082') return new URL(cleanPath, current.origin).toString();
  return legacyFrontendUrlForPath(cleanPath, configuredBase);
}

const cpproAccentOptions = [
  { code: 'flame', color: '#e32400', soft: 'rgba(227, 36, 0, 0.12)' },
  { code: 'gold', color: '#f4c900', soft: 'rgba(244, 201, 0, 0.14)' },
  { code: 'emerald', color: '#10b981', soft: 'rgba(16, 185, 129, 0.14)' },
  { code: 'sky', color: '#0ea5e9', soft: 'rgba(14, 165, 233, 0.14)' },
  { code: 'violet', color: '#8b5cf6', soft: 'rgba(139, 92, 246, 0.14)' },
  { code: 'rose', color: '#e11d48', soft: 'rgba(225, 29, 72, 0.14)' },
] as const;

function openLcojLegacyPath(path: string) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  window.location.assign(new URL(cleanPath, window.location.origin).toString());
}

function lcojProblemPath(problemKey: string | number, suffix = '') {
  return `/problem/${encodeURIComponent(String(problemKey))}${suffix}`;
}

function readStoredAccent() {
  return localStorage.getItem('oj_platform_accent') || localStorage.getItem('cppro-accent') || 'sky';
}

function resolveCpproAccent(raw: string | null | undefined) {
  const value = String(raw || '').trim();
  const named = cpproAccentOptions.find((item) => item.code === value);
  if (named) return named;
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return { code: 'custom', color: value, soft: `${value}22` };
  }
  return cpproAccentOptions.find((item) => item.code === 'sky') || cpproAccentOptions[0];
}

function applyCpproAccent(raw?: string | null) {
  if (typeof document === 'undefined') return;
  const accent = resolveCpproAccent(raw ?? readStoredAccent());
  const root = document.documentElement;
  root.dataset.accent = accent.code;
  root.style.setProperty('--interface-accent', accent.color);
  root.style.setProperty('--interface-accent-soft', accent.soft);
  root.style.setProperty('--admin-accent', accent.color);
  root.style.setProperty('--admin-accent-soft', accent.soft);
}

function readStoredCpproUser(): StoredCpproUser | null {
  try {
    const raw = localStorage.getItem('cppro_user');
    if (raw) {
      const parsed = JSON.parse(raw) as StoredCpproUser;
      if (parsed && typeof parsed.username === 'string' && parsed.username.trim()) return parsed;
    }
    const platformRaw = localStorage.getItem('oj_platform_user');
    if (!platformRaw) return null;
    const platformUser = JSON.parse(platformRaw) as AuthUser;
    return platformUser && typeof platformUser.username === 'string' ? authUserToStored(platformUser) : null;
  } catch {
    return null;
  }
}

async function fetchLcojCurrentUser(): Promise<StoredCpproUser | null> {
  try {
    const response = await fetch('/api/cppro/auth/me', {
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const payload = await response.json() as { user?: Record<string, unknown> | null };
    const user = payload?.user;
    const username = String(user?.username || '').trim();
    if (!username) return null;
    const roles = Array.isArray(user?.roles)
      ? user!.roles.map((role) => String(role)).filter(Boolean)
      : [String(user?.role || 'user')];
    return {
      username,
      displayName: String(user?.full_name || user?.fullName || username),
      full_name: String(user?.full_name || user?.fullName || username),
      email: String(user?.email || ''),
      avatar_url: user?.avatar_url ? String(user.avatar_url) : user?.avatarUrl ? String(user.avatarUrl) : null,
      role: String(user?.role || roles[0] || 'user'),
      roles,
      tags: Array.isArray(user?.tags) ? user!.tags.map((tag) => String(tag)).filter(Boolean) : roles,
      is_teacher: Boolean(user?.is_teacher || user?.isTeacher),
      membership_tier: String(user?.membership_tier || user?.membershipTier || 'free') as StoredCpproUser['membership_tier'],
      membership_expires_at: user?.membership_expires_at ? String(user.membership_expires_at) : null,
      streak_timezone: String(user?.streak_timezone || user?.streakTimezone || 'Asia/Bangkok'),
      streak_timezone_changed_at: user?.streak_timezone_changed_at ? String(user.streak_timezone_changed_at) : null,
      rating: Number(user?.rating || 0) || 0,
      rank_name: String(user?.rank_name || user?.rankName || ''),
      solved: Number(user?.solved || 0) || 0,
      score: Number(user?.score || 0) || 0,
      pp_score: Number(user?.pp_score || user?.ppScore || 0) || 0,
      streak: Number(user?.streak || user?.current_streak || 0) || 0,
      max_streak: Number(user?.max_streak || user?.longest_streak || 0) || 0,
    };
  } catch {
    return null;
  }
}

function storedUserToRow(user: StoredCpproUser): UserRow {
  const roles = Array.isArray(user.roles) ? user.roles.filter(Boolean) : [];
  const tags = Array.isArray(user.tags) ? user.tags.filter(Boolean) : roles;
  return {
    username: user.username,
    fullName: user.full_name || user.displayName || user.username,
    avatarUrl: user.avatar_url || user.avatarUrl || null,
    rating: user.rating || 0,
    score: user.pp_score ?? user.score ?? 0,
    solved: user.solved || 0,
    streak: user.streak || 0,
    maxStreak: user.max_streak || user.streak || 0,
    rankName: user.rank_name || roles[0] || user.role || 'Member',
    tags: unique([
      ...(tags.length ? tags : user.role ? [user.role] : []),
      user.is_teacher ? 'Teacher' : '',
      user.membership_tier && user.membership_tier !== 'free' ? user.membership_tier : '',
    ].filter(Boolean)),
    proTier: user.membership_tier && user.membership_tier !== 'free' ? user.membership_tier : (user.pro_tier || ''),
    bio: user.bio || undefined,
  };
}

function normalizedActivity(user?: StoredCpproUser | null, summary?: HomeSummary | null) {
  const source = Array.isArray(user?.activity) && user.activity.length
    ? user.activity.slice(-14)
    : summary?.activity?.length
      ? summary.activity.slice(-14)
      : fallbackActivity;
  return source.map((entry, index) => {
    const day = typeof entry === 'object' && entry ? entry.day : undefined;
    const value = typeof entry === 'number' ? entry : Number(entry?.value);
    const accepted = typeof entry === 'number' ? Math.max(0, entry - 1) : Number(entry?.accepted);
    const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
    const safeAccepted = Number.isFinite(accepted) ? Math.max(0, Math.min(safeValue, accepted)) : Math.max(0, safeValue - 1);
    return {
      day: String(day || index + 1),
      value: safeValue,
      accepted: safeAccepted,
    };
  });
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function blankRecentActivity(days = 14) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - index));
    return { day: localDateKey(date), value: 0, accepted: 0 };
  });
}

function activityFromSubmissions(submissions: Submission[] | null, user?: StoredCpproUser | null) {
  if (!submissions) {
    const fromUser = Array.isArray(user?.activity) && user.activity.length ? normalizedActivity(user, null) : [];
    return fromUser.length ? fromUser : blankRecentActivity();
  }
  const activity = blankRecentActivity();
  const byDay = new Map(activity.map((item) => [item.day, item]));
  submissions.forEach((submission) => {
    const submittedAt = new Date(submission.submittedAt);
    if (Number.isNaN(submittedAt.getTime())) return;
    const day = localDateKey(submittedAt);
    const entry = byDay.get(day);
    if (!entry) return;
    entry.value += 1;
    if (submission.verdict === 'AC' && Number(submission.score || 0) >= 100) entry.accepted += 1;
  });
  return activity;
}

function currentActivityStreak(activity: HomeActivityPoint[]) {
  let streak = 0;
  for (let index = activity.length - 1; index >= 0; index -= 1) {
    if ((Number(activity[index]?.value) || 0) <= 0) break;
    streak += 1;
  }
  return streak;
}

function currentAcceptedActivityStreak(activity: HomeActivityPoint[]) {
  let streak = 0;
  for (let index = activity.length - 1; index >= 0; index -= 1) {
    if ((Number(activity[index]?.accepted) || 0) <= 0) break;
    streak += 1;
  }
  return streak;
}

function homeActivity(data: CpproData) {
  return normalizedActivity(null, data.homeSummary);
}

function dailyChallenge(data: CpproData, preferredSlug?: string) {
  return data.homeSummary?.challenge
    || (preferredSlug ? data.problems.find((problem) => problem.slug === preferredSlug) : null)
    || data.problems.find((problem) => problem.slug === 'abc364_g')
    || data.problems.find((problem) => problem.slug === 'hdu4085')
    || data.problems[0]
    || null;
}

const activeContestStorageKey = 'cppro-active-contest';

function contestDateValue(value?: string | null) {
  const time = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(time) ? time : Number.NaN;
}

function contestVirtualEnd(contest: Contest) {
  if (Number(contest.myParticipant?.virtual || 0) <= 0) return Number.NaN;
  const virtualStart = contestDateValue(contest.myParticipant?.virtual_start);
  const start = contestDateValue(contest.startTime);
  const end = contestDateValue(contest.endTime);
  if (![virtualStart, start, end].every(Number.isFinite) || end <= start) return Number.NaN;
  return virtualStart + (end - start);
}

function isJoinedContest(contest?: Contest | null) {
  const status = String(contest?.myParticipant?.status || '').toLowerCase();
  return ['registered', 'checked_in', 'active'].includes(status);
}

function isContestStillActive(contest: Contest, now = Date.now()) {
  const virtualEnd = contestVirtualEnd(contest);
  if (Number.isFinite(virtualEnd)) return now < virtualEnd;
  const start = contestDateValue(contest.startTime);
  const end = contestDateValue(contest.endTime);
  const status = String(contest.status || '').toLowerCase();
  if (status === 'finished' || status === 'ended') return false;
  if (Number.isFinite(end) && now > end) return false;
  if (Number.isFinite(start) && now < start) return true;
  return true;
}

function isContestRunningForLock(contest: Contest, now = Date.now()) {
  const virtualEnd = contestVirtualEnd(contest);
  if (Number.isFinite(virtualEnd)) return now < virtualEnd;
  const start = contestDateValue(contest.startTime);
  const end = contestDateValue(contest.endTime);
  const status = String(contest.status || '').toLowerCase();
  if (status === 'finished' || status === 'ended') return false;
  if (Number.isFinite(start) && now < start) return false;
  if (Number.isFinite(end) && now > end) return false;
  return true;
}

function rememberActiveContest(contest: Contest) {
  localStorage.setItem(activeContestStorageKey, JSON.stringify({
    id: contest.id,
    slug: contest.slug,
    title: contest.title,
    startTime: contest.startTime,
    endTime: contest.endTime,
    status: contest.status,
  }));
}

function storedActiveContest(contests: Contest[]) {
  const raw = localStorage.getItem(activeContestStorageKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Contest>;
    const contest = contests.find((item) => String(item.id) === String(parsed.id) || item.slug === parsed.slug);
    if (!contest) return null;
    const joined = {
      ...contest,
      myParticipant: contest.myParticipant || { status: 'checked_in', virtual: 0 },
    };
    if (!isContestStillActive(joined)) {
      localStorage.removeItem(activeContestStorageKey);
      return null;
    }
    return isContestRunningForLock(joined) ? joined : null;
  } catch {
    localStorage.removeItem(activeContestStorageKey);
    return null;
  }
}

function activeJoinedContest(contests: Contest[]) {
  const now = Date.now();
  return contests
    .filter((contest) => isJoinedContest(contest) && isContestRunningForLock(contest, now))
    .sort((a, b) => {
      const aEnd = contestDateValue(a.endTime);
      const bEnd = contestDateValue(b.endTime);
      return (Number.isFinite(aEnd) ? aEnd : Number.MAX_SAFE_INTEGER) - (Number.isFinite(bEnd) ? bEnd : Number.MAX_SAFE_INTEGER);
    })[0] || storedActiveContest(contests);
}

function contestProblemKey(problem: Pick<Problem, 'id' | 'slug' | 'code'>) {
  return new Set([String(problem.id), problem.slug, problem.code].filter(Boolean).map((item) => item.toLowerCase()));
}

function problemBelongsToContest(problem: Problem, contest: Contest) {
  if (!contest.problems?.length) return null;
  const keys = contestProblemKey(problem);
  return contest.problems.some((item) => {
    const values = [
      item.id,
      item.problem,
      item.external_id,
      item.problem_code,
      item.problem_slug_snapshot,
    ].filter((value) => value !== undefined && value !== null).map((value) => String(value).toLowerCase());
    return values.some((value) => keys.has(value));
  });
}

function formatActivityDay(value: string | number | undefined) {
  const text = String(value || '');
  if (/^\d+$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.slice(5) || text || '0';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function ImpersonationRestoreBanner({ locale }: { locale: CpproLocale }) {
  const mt = (text: string | undefined) => managementText(locale, text);
  const [active] = useState(() => {
    try { return localStorage.getItem('cppro_user__admin_restore') !== null; } catch { return false; }
  });
  if (!active) return null;
  const restore = () => {
    ['oj_platform_token', 'cppro_access_token', 'oj_platform_user', 'cppro_user'].forEach((key) => {
      const backup = localStorage.getItem(`${key}__admin_restore`);
      if (backup !== null) localStorage.setItem(key, backup);
      localStorage.removeItem(`${key}__admin_restore`);
    });
    try { syncPlatformBridgeSessionFromStorage(); } catch { /* ignore */ }
    window.location.assign(withCpproLocale(locale, '/management'));
  };
  return (
    <div className="cppro-impersonation-banner" role="status">
      <span><ShieldCheck size={15} />{mt('You are viewing the platform as another user.')}</span>
      <button type="button" onClick={restore}><LogOut size={14} />{mt('Return to admin')}</button>
    </div>
  );
}

function App() {
  const [data, setData] = useState<CpproData>(() => normalizeCpproData(emptyCpproData));
  const [routeState, setRouteState] = useState(() => parseCpproPath(window.location.pathname));
  const [theme, setTheme] = useState<ThemeMode>(readStoredTheme);
  // The LCOJ browser session is authoritative. Do not render a privileged
  // menu from stale or forged local storage while /auth/me is still loading.
  const [currentUser, setCurrentUser] = useState<StoredCpproUser | null>(() => isLcojBackendMode() ? null : readStoredCpproUser());
  const [dataLoading, setDataLoading] = useState(true);
  const { locale, path } = routeState;

  useEffect(() => {
    let cancelled = false;
    setDataLoading(true);
    loadBackendCpproData()
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(async () => {
        // loadStaticCpproData() is a no-op in LCOJ mode, so this degrades to an
        // honest empty state instead of resurrecting the crawled snapshot.
        const staticData = await loadStaticCpproData();
        if (!cancelled) setData(staticData || normalizeCpproData(emptyCpproData));
      })
      .finally(() => {
        if (!cancelled) {
          setDataLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.username]);

  useEffect(() => {
    if (!isLcojBackendMode()) return;
    let cancelled = false;
    void fetchLcojCurrentUser().then((user) => {
      if (!cancelled) setCurrentUser(user);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  useEffect(() => {
    if (dataLoading) return;
    if (shouldUseStaticCpproData()) return;
    let cancelled = false;
    const today = new Date().toISOString().slice(0, 10);
    const visitKey = `cppro-traffic-visit-${today}`;
    let countVisit = true;
    try {
      countVisit = sessionStorage.getItem(visitKey) !== '1';
      if (countVisit) sessionStorage.setItem(visitKey, '1');
    } catch {
      countVisit = true;
    }
    cpproApiFetch<Record<string, unknown>>('/stats/visit', {
      method: 'POST',
      timeoutMs: 4000,
      body: JSON.stringify({
        path: `${window.location.pathname}${window.location.search}`.slice(0, 256),
        visit: countVisit,
      }),
    })
      .then((payload) => {
        if (!cancelled) setData((current) => mergeTrafficCounters(current, payload));
      })
      .catch(() => {
        // Traffic counting must never block the page.
      });
    return () => {
      cancelled = true;
    };
  }, [locale, path, dataLoading]);

  useEffect(() => {
    const apply = () => {
      const resolved = theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.classList.toggle('dark', resolved === 'dark');
      document.documentElement.style.colorScheme = resolved;
      localStorage.setItem('cppro-theme', theme);
      localStorage.setItem('judgeTheme', resolved);
    };
    apply();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    const syncAccent = () => applyCpproAccent();
    syncAccent();
    window.addEventListener('storage', syncAccent);
    window.addEventListener('ctoj-site-settings-changed', syncAccent);
    return () => {
      window.removeEventListener('storage', syncAccent);
      window.removeEventListener('ctoj-site-settings-changed', syncAccent);
    };
  }, []);

  useEffect(() => {
    const onPop = () => setRouteState(parseCpproPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (hasCpproLocalePrefix(window.location.pathname)) return;
    if (isCpproPublicAuthAlias(window.location.pathname)) return;
    if (shouldUseStaticCpproData() && isLcojReservedPath(window.location.pathname)) return;
    const nextLocation = withCpproLocale(routeState.locale, window.location.pathname || '/');
    window.history.replaceState({}, '', `${nextLocation}${window.location.search}${window.location.hash}`);
    setRouteState(parseCpproPath(new URL(nextLocation, window.location.origin).pathname));
  }, []);

  useEffect(() => {
    localStorage.setItem('cppro-locale', locale);
    localStorage.setItem('oj_platform_locale', locale);
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    document.title = data.contact.brandName || defaultFooterContactSettings.brandName;
  }, [data.contact.brandName]);

  useEffect(() => {
    const onStorage = () => {
      if (isLcojBackendMode()) {
        void fetchLcojCurrentUser().then(setCurrentUser);
      } else {
        setCurrentUser(readStoredCpproUser());
      }
      setTheme(readStoredTheme());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const go = (nextPath: string) => {
    const nextLocation = withCpproLocale(locale, nextPath);
    window.history.pushState({}, '', nextLocation);
    setRouteState(parseCpproPath(new URL(nextLocation, window.location.origin).pathname));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const changeLocale = (nextLocale: CpproLocale) => {
    const nextLocation = withCpproLocale(nextLocale, path);
    localStorage.setItem('cppro-locale', nextLocale);
    localStorage.setItem('oj_platform_locale', nextLocale);
    window.history.pushState({}, '', `${nextLocation}${window.location.search}${window.location.hash}`);
    setRouteState({ locale: nextLocale, path });
  };

  const handleAuth = (result: AuthResult) => {
    setCurrentUser(result.user);
    setTheme(readStoredTheme());
    go(postLoginRedirectPath('/'));
  };

  const handleUserUpdate = (user: StoredCpproUser) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('cppro_user', JSON.stringify(user));
      localStorage.setItem('oj_platform_user', JSON.stringify(user));
      const token = localStorage.getItem('oj_platform_token') || localStorage.getItem('cppro_access_token');
      if (token) persistPlatformBridgeSession(token, user);
    } catch {
      // Keep the current tab updated even when localStorage is unavailable.
    }
  };

  const logout = async () => {
    if (isLcojBackendMode()) {
      // Keep Django's session and the CPPro client state in sync. The bridge
      // bootstraps and submits Django's CSRF token for us.
      await cpproApiFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({}),
      }).catch(() => null);
    }
    localStorage.removeItem('cppro_user');
    localStorage.removeItem('cppro_access_token');
    localStorage.removeItem('cppro_refresh_token');
    localStorage.removeItem('oj_platform_user');
    localStorage.removeItem('oj_platform_token');
    clearPlatformBridgeSession();
    setCurrentUser(null);
    go('/login');
  };

  if (path === '/logout') {
    return <CpproLogoutPage onLogout={logout} brandName={data.contact.brandName || defaultFooterContactSettings.brandName} />;
  }

  const authMode = path === '/login' ? 'login' : path === '/register' ? 'register' : null;
  if (authMode) {
    return (
      <div className="judge-type-scale auth-shell-crawl">
        <div className="relative w-full min-h-screen flex flex-col transition-colors">
          <CpproBackdrop brandName={data.contact.brandName} />
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-10">
            <a
              className="auth-logo mb-6 group"
              href="/"
              onClick={(event) => {
                event.preventDefault();
                go('/');
              }}
            >
              <BrandLogo contact={data.contact} compact={false} />
            </a>
            <AuthPreviewCrawl mode={authMode} go={go} onAuth={handleAuth} googleEnabled={data.auth.googleEnabled} brandName={data.contact.brandName || defaultFooterContactSettings.brandName} />
          </div>
        </div>
      </div>
    );
  }

  return (
      <div className="judge-type-scale app-shell">
      <CpproBackdrop brandName={data.contact.brandName} />
      <ImpersonationRestoreBanner locale={locale} />
      <Topbar
        path={path}
        go={go}
        theme={theme}
        setTheme={setTheme}
        locale={locale}
        onLocale={changeLocale}
        contact={data.contact}
        topbarFeatures={data.topbarFeatures}
        featuresReady={!dataLoading}
        currentUser={currentUser}
        notifications={data.notifications}
        platformFrontendUrl={data.platformFrontendUrl}
        onLogout={logout}
      />
      <main className="page-wrap">
        <Router path={path} data={data} go={go} currentUser={currentUser} onAuth={handleAuth} onUserUpdate={handleUserUpdate} dataLoading={dataLoading} />
      </main>
      <FloatingContestWidget contests={data.contests} go={go} />
      <Footer contact={data.contact} />
    </div>
  );
}

function CpproBackdrop({ brandName }: { brandName?: string }) {
  const mascots = [
    ['VOI1-DccYHpUA.png', 'mascot-a'],
    ['VOI2-DR2xWw91.png', 'mascot-b'],
    ['VOI3-Bs2vLZ8l.png', 'mascot-c'],
    ['VOI4-BfYVe9Fk.png', 'mascot-d'],
    ['VOI1-DccYHpUA.png', 'mascot-e'],
    ['VOI3-Bs2vLZ8l.png', 'mascot-f'],
  ] as const;
  const watermark = `{${compactBrandMark(brandName)}}`;
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" data-crawl-backdrop aria-hidden="true">
      <div className="absolute inset-0 bg-[#F4F5F7] dark:bg-gray-900 transition-colors duration-300" data-crawl-backdrop-base />
      <div className="absolute inset-0 opacity-[0.45] dark:opacity-[0.25]" data-crawl-dot-layer />
      {['mark-a', 'mark-b', 'mark-c', 'mark-d', 'mark-e'].map((className) => (
        <span key={className} className={`${className} text-[#1890FF] select-none tracking-tighter transform`} data-crawl-watermark>{watermark}</span>
      ))}
      {mascots.map(([src, className]) => (
        <img key={className} className={`${className} w-full h-auto drop-shadow-xl transform`} data-crawl-mascot src={`/assets/${src}`} alt="" />
      ))}
      <img className="mascot-elephant w-full h-auto drop-shadow-xl transform" data-crawl-mascot src="/assets/cppro-elephant-programmer.png" alt="" />
    </div>
  );
}

function BrandLogo({ contact, compact = true }: { contact: FooterContactSettings; compact?: boolean }) {
  const brandName = contact.brandName || defaultFooterContactSettings.brandName;
  const logoUrl = safeExternalHref(contact.logoUrl, '');
  return (
    <span className={compact ? 'brand-logo-lockup compact' : 'brand-logo-lockup'} title={brandName}>
      {logoUrl ? (
        <img alt={brandName} src={logoUrl} />
      ) : (
        <span className="brand-mark" aria-hidden="true">{compactBrandMark(brandName)}</span>
      )}
      <span>{brandName}</span>
    </span>
  );
}

function timeGreeting() {
  const fallbackHour = new Date().getHours();
  let hour = fallbackHour;
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const formatted = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone,
    }).format(new Date());
    const parsed = Number(formatted);
    if (Number.isFinite(parsed)) hour = parsed;
  } catch {
    hour = fallbackHour;
  }
  if (hour >= 5 && hour < 11) return 'Chào buổi sáng';
  if (hour >= 11 && hour < 14) return 'Chào buổi trưa';
  if (hour >= 14 && hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function FloatingContestWidget({ contests, go }: { contests: Contest[]; go: (path: string) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const runningContest = useMemo(() => {
    return activeJoinedContest(contests);
  }, [contests]);

  if (!runningContest) return null;

  const timing = contestTiming(runningContest);
  const timeLink = runningContest.endTime
    ? `https://www.timeanddate.com/worldclock/fixedtime.html?msg=${encodeURIComponent(runningContest.title)}&iso=${encodeURIComponent(runningContest.endTime)}`
    : '';

  return (
    <aside data-floating-contest>
      <div data-floating-contest-head>
        <span>
          <i />
          <strong>Đang thi</strong>
        </span>
        <button type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Mở kỳ thi đang diễn ra' : 'Thu gọn kỳ thi đang diễn ra'}>
          <ChevronDown size={16} />
        </button>
      </div>
      {!collapsed && (
        <>
          <a href={`/contests/${runningContest.slug}`} data-floating-contest-title onClick={(event) => openInternalLink(event, go, `/contests/${runningContest.slug}`)}>
            {runningContest.title}
          </a>
          {timeLink ? (
            <a href={timeLink} target="_blank" rel="noreferrer" data-floating-contest-time title="Xem thời gian trên timeanddate.com">
              <small><Clock size={13} /> Còn lại</small>
              <strong>{formatContestCountdown(timing.remainingMs)}</strong>
              <span><ExternalLink size={12} /> timeanddate.com</span>
            </a>
          ) : null}
        </>
      )}
    </aside>
  );
}

function TopbarSkeleton({ locale }: { locale: CpproLocale }) {
  return (
    <header
      className="sticky top-0 z-50 w-full bg-transparent px-8 pt-2 transition-colors topbar"
      data-crawl-topbar
      data-topbar-loading
      aria-busy="true"
      aria-label={locale === 'vi' ? 'Đang tải cấu hình thanh điều hướng' : 'Loading navigation settings'}
    >
      <nav
        className="flex items-center bg-white dark:bg-slate-800 px-3 py-1 rounded-full shadow-[0_4px_0_0_#E5E7EB] dark:shadow-[0_4px_0_0_#1e293b] border-2 border-slate-100 dark:border-slate-700 relative transition-colors"
        data-topbar-shell
      >
        <span data-topbar-skeleton-brand>
          <i />
          <b />
        </span>
        <span data-topbar-skeleton-nav>
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <span data-topbar-skeleton-actions>
          <i />
          <i />
          <i />
        </span>
      </nav>
    </header>
  );
}

function Topbar({
  path,
  go,
  theme,
  setTheme,
  locale,
  onLocale,
  contact,
  topbarFeatures,
  featuresReady,
  currentUser,
  notifications,
  platformFrontendUrl,
  onLogout,
}: {
  path: string;
  go: (path: string) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  locale: CpproLocale;
  onLocale: (locale: CpproLocale) => void;
  contact: FooterContactSettings;
  topbarFeatures: TopbarFeatures;
  featuresReady: boolean;
  currentUser: StoredCpproUser | null;
  notifications: HomePost[];
  platformFrontendUrl?: string | null;
  onLogout: () => void | Promise<void>;
}) {
  const topUser = currentUser ? storedUserToRow(currentUser) : null;
  const [userOpen, setUserOpen] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const navMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const notificationReadKey = `cppro-notification-read:${currentUser?.username || 'guest'}`;

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) setUserOpen(false);
      if (!navMenuRef.current?.contains(event.target as Node)) setNavMenuOpen(false);
      if (!notificationRef.current?.contains(event.target as Node)) setNotificationOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUserOpen(false);
        setNavMenuOpen(false);
        setNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(notificationReadKey) || '[]');
      setReadNotificationIds(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch {
      setReadNotificationIds([]);
    }
  }, [notificationReadKey]);

  const openRoute = (nextPath: string) => {
    setUserOpen(false);
    setNavMenuOpen(false);
    setNotificationOpen(false);
    go(nextPath);
  };
  const openLegacyAdminRoute = () => {
    setUserOpen(false);
    setNavMenuOpen(false);
    setNotificationOpen(false);
    if (isLcojBackendMode()) {
      openLcojLegacyPath('/admin/');
      return;
    }
    syncPlatformBridgeSessionFromStorage();
    window.location.assign(legacyFrontendUrlForPath('/admin/', platformFrontendUrl));
  };
  const adminRoles = [
    currentUser?.role,
    ...(Array.isArray(currentUser?.roles) ? currentUser.roles : []),
    ...(Array.isArray(currentUser?.tags) ? currentUser.tags : []),
    ...(Array.isArray(topUser?.tags) ? topUser.tags : []),
  ]
    .filter(Boolean)
    .map((role) => String(role).toLowerCase());
  const lcojLegacyRoutes = shouldUseLcojLegacyRoutes();
  const lcojStaffManager = isLcojBackendMode() && (Boolean(currentUser?.is_teacher) || adminRoles.some((role) => (
    role === 'teacher'
    || role === 'staff'
    || role.includes('teacher')
    || role.includes('staff')
  )));
  const isAdminUser = lcojStaffManager || adminRoles.some((role) => (
    role === 'admin'
    || role === 'moderator'
    || role.includes('admin')
    || role.includes('moderator')
    || role.includes('quan-tri')
    || role.includes('quản trị')
  ));
  const notificationTitle = t(locale, 'notifications.title');
  const notificationItems: Array<{
    id: string;
    postId?: number;
    title: string;
    body: string;
    href: string;
    icon: React.ReactNode;
    isRead: boolean;
  }> = [
    {
      id: 'welcome',
      title: t(locale, 'notifications.welcomeTitle').replace('{brand}', contact.brandName || defaultFooterContactSettings.brandName),
      body: t(locale, 'notifications.welcomeBody')
        .replace('{greeting}', timeGreeting())
        .replace('{name}', topUser?.fullName || topUser?.username || (locale === 'vi' ? 'bạn' : 'friend')),
      href: '/problems',
      icon: <Megaphone size={16} />,
      isRead: false,
    },
    ...notifications.slice(0, 8).map((item) => ({
      id: String(item.id || item.slug || item.title),
      postId: item.id,
      title: item.title,
      body: item.body,
      href: postHref(item),
      icon: <Bell size={16} />,
      isRead: Boolean(item.isRead),
    })),
  ];
  const readNotificationSet = new Set(readNotificationIds);
  const unreadNotificationItems = notificationItems.filter((item) => !item.isRead && !readNotificationSet.has(item.id));
  const notificationCount = Math.min(9, unreadNotificationItems.length);
  const persistLocalNotificationReads = (ids: string[]) => {
    setReadNotificationIds(ids);
    try {
      localStorage.setItem(notificationReadKey, JSON.stringify(ids));
    } catch {
      // Local notification state is best-effort; signed-in users still sync to the API.
    }
  };
  const markNotificationRead = async (item: { id: string; postId?: number; isRead: boolean }) => {
    if (item.isRead || readNotificationSet.has(item.id)) return;
    const nextIds = Array.from(new Set([...readNotificationIds, item.id]));
    persistLocalNotificationReads(nextIds);
    if (!item.postId || !hasCpproAuthToken()) return;
    try {
      await cpproApiFetch(`/notifications/announcements/${item.postId}/read`, { method: 'POST' });
    } catch {
      persistLocalNotificationReads(readNotificationIds);
    }
  };
  const markAllNotificationsRead = async () => {
    const nextIds = Array.from(new Set([...readNotificationIds, ...notificationItems.map((item) => item.id)]));
    persistLocalNotificationReads(nextIds);
    try {
      await cpproApiFetch('/notifications/announcements/read-all', { method: 'POST' });
    } catch {
      // Guests can still locally dismiss the welcome/read state.
    }
  };
  const ThemeIcon = theme === 'dark' ? Moon : theme === 'system' ? Monitor : Sun;
  const themeTitle = theme === 'dark' ? 'Dark mode' : theme === 'system' ? 'System mode' : 'Light mode';
  const communityChatVisible = false;
  const extraNavItems: CpproNavItem[] = lcojLegacyRoutes
    ? [
      { path: '/status', labelKey: 'nav.status', icon: Server },
    ]
    : [
      { path: '/notifications', labelKey: 'nav.notifications', icon: Bell, featureKey: 'announcements' },
      ...(communityChatVisible ? [{ path: '/chat', labelKey: 'nav.chat', icon: MessageCircle, featureKey: 'messages' } satisfies CpproNavItem] : []),
      { path: '/feedback', labelKey: 'nav.feedback', icon: Send },
      { path: '/payment-history', labelKey: 'nav.payments', icon: CreditCard },
      { path: '/wardrobe', labelKey: 'nav.wardrobe', icon: Gift },
      { path: '/status', labelKey: 'nav.status', icon: Server },
      { path: '/theme', labelKey: 'nav.theme', icon: Palette },
    ];
  const lcojNavPaths = new Set(['/', '/problems', '/contests', '/organizations', '/users', '/submissions']);
  const visibleNavItems = navItems.filter((item) => (
    lcojLegacyRoutes
      ? lcojNavPaths.has(item.path)
      : (!item.featureKey || (featuresReady && topbarFeatureEnabled(topbarFeatures, item.featureKey)))
  ));
  const visibleExtraNavItems = extraNavItems.filter((item) => (
    featuresReady
      ? topbarFeatureEnabled(topbarFeatures, item.featureKey)
      : item.path === '/status'
  ));
  const announcementsEnabled = !lcojLegacyRoutes && featuresReady && topbarFeatureEnabled(topbarFeatures, 'announcements');
  const messagesEnabled = !lcojLegacyRoutes && communityChatVisible && featuresReady && topbarFeatureEnabled(topbarFeatures, 'messages');
  const topbarFeatureLoading = !featuresReady;
  return (
    <header className="sticky top-0 z-50 w-full bg-transparent px-8 pt-2 transition-colors topbar" data-crawl-topbar data-topbar-features-ready={featuresReady ? 'true' : 'false'}>
      <nav
        className="flex items-center bg-white dark:bg-slate-800 px-3 py-1 rounded-full shadow-[0_4px_0_0_#E5E7EB] dark:shadow-[0_4px_0_0_#1e293b] border-2 border-slate-100 dark:border-slate-700 relative transition-colors"
        data-topbar-shell
      >
        <button className="brand" onClick={() => go('/')} type="button" aria-label={contact.brandName || defaultFooterContactSettings.brandName}>
          <BrandLogo contact={contact} />
        </button>
        <div className="nav-scroll" role="navigation" aria-label="Điều hướng chính">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = path === item.path || (item.path !== '/' && path.startsWith(item.path));
            const navKey = item.path === '/' ? 'home' : item.path.replace(/^\//, '').replace(/[^a-z0-9_-]/gi, '-');
            return (
              <button
                key={item.path}
                className={active ? `nav-item nav-${navKey} active` : `nav-item nav-${navKey}`}
                onClick={() => openRoute(item.path)}
                type="button"
              >
                <span data-nav-icon>
                  <Icon size={14} />
                </span>
                <span data-nav-label>{t(locale, item.labelKey)}</span>
              </button>
            );
          })}
          {topbarFeatureLoading ? (
            <span className="topbar-feature-loading" role="status" aria-live="polite" aria-label={locale === 'vi' ? 'Đang tải các mục điều hướng được bật' : 'Loading enabled navigation items'}>
              <i />
              <i />
              <i />
            </span>
          ) : null}
          <div className="nav-more" ref={navMenuRef} data-open={navMenuOpen ? 'true' : 'false'}>
            <button
              aria-controls="topbar-expanded-menu"
              aria-expanded={navMenuOpen}
              aria-haspopup="menu"
              className="nav-item"
              onClick={() => setNavMenuOpen((open) => !open)}
              type="button"
            >
              <span data-nav-icon>
                <MoreHorizontal size={14} />
              </span>
              <span data-nav-label>{t(locale, 'nav.more')}</span>
            </button>
            <div className="nav-more-menu" id="topbar-expanded-menu" role="menu">
              {[...visibleNavItems, ...visibleExtraNavItems].map((item) => {
                const Icon = item.icon;
                const active = path === item.path || (item.path !== '/' && path.startsWith(item.path));
                const navKey = item.path === '/' ? 'home' : item.path.replace(/^\//, '').replace(/[^a-z0-9_-]/gi, '-');
                return (
                  <button
                    key={`more-${item.path}`}
                    className={active ? `nav-more-tile nav-${navKey} active` : `nav-more-tile nav-${navKey}`}
                    onClick={() => openRoute(item.path)}
                    role="menuitem"
                    type="button"
                  >
                    <span data-nav-icon>
                      <Icon size={20} />
                    </span>
                    <span>{t(locale, item.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="top-actions" data-authenticated={topUser ? 'true' : 'false'}>
          <div data-topbar-language-switch role="group" aria-label={locale === 'vi' ? 'Chọn ngôn ngữ' : 'Choose language'}>
            <button
              type="button"
              data-active={locale === 'en' ? 'true' : 'false'}
              aria-label="English"
              title="English"
              onClick={() => onLocale('en')}
            >
              <span aria-hidden="true">🇺🇸</span>
            </button>
            <button
              type="button"
              data-active={locale === 'vi' ? 'true' : 'false'}
              aria-label="Tiếng Việt"
              title="Tiếng Việt"
              onClick={() => onLocale('vi')}
            >
              <span aria-hidden="true">🇻🇳</span>
            </button>
          </div>
          <button
            className="icon-button theme-toggle"
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
            title={themeTitle}
            aria-label={themeTitle}
            data-theme-mode={theme}
          >
            <ThemeIcon size={18} />
          </button>
          {messagesEnabled ? (
            <button
              className={path === '/chat' || path.startsWith('/chat/') ? 'icon-button topbar-chat-button active' : 'icon-button topbar-chat-button'}
              type="button"
              onClick={() => openRoute('/chat')}
              title={t(locale, 'nav.chat')}
              aria-label={t(locale, 'nav.chat')}
              data-topbar-chat-button
            >
              <MessageCircle size={18} />
            </button>
          ) : null}
          {announcementsEnabled ? (
          <div className="relative" data-notification-menu data-open={notificationOpen ? 'true' : 'false'} ref={notificationRef}>
            <button
              aria-controls="topbar-notification-panel"
              aria-expanded={notificationOpen}
              aria-haspopup="menu"
              className="icon-button"
              data-notification-button
              onClick={() => setNotificationOpen((open) => !open)}
              title={notificationTitle}
              type="button"
              aria-label={notificationTitle}
            >
              <Bell size={18} />
              {notificationCount > 0 ? <span>{notificationCount}</span> : null}
            </button>
            {notificationOpen && (
              <div className="notif-panel" id="topbar-notification-panel" role="menu" aria-label={notificationTitle}>
                <div data-notif-head>
                  <span><strong>{notificationTitle}</strong><b>{notificationCount}</b></span>
                  <button type="button" disabled={notificationCount === 0} onClick={() => void markAllNotificationsRead()}><CheckCircle2 size={13} />{t(locale, 'notifications.markAllRead')}</button>
                </div>
                <div data-notif-list>
                  {notificationItems.length === 0 ? (
                    <div data-notif-empty><Inbox size={18} />{t(locale, 'notifications.empty')}</div>
                  ) : notificationItems.map((item, index) => (
                    <a
                      key={`${item.id}-${index}`}
                      data-read={item.isRead || readNotificationSet.has(item.id) ? 'true' : 'false'}
                      href={item.href}
                      role="menuitem"
                      onClick={(event) => {
                        void markNotificationRead(item);
                        openInternalLink(event, openRoute, item.href);
                      }}
                    >
                      <span data-notif-icon>{item.icon}</span>
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.body}</small>
                      </span>
                    </a>
                  ))}
                </div>
                <button type="button" data-notif-footer onClick={() => openRoute('/notifications')}>
                  <Bell size={14} />
                  {t(locale, 'notifications.viewAll')}
                </button>
              </div>
            )}
          </div>
          ) : null}
          {topUser ? (
            <div className="relative" data-top-user-menu data-open={userOpen ? 'true' : 'false'} ref={userMenuRef}>
              <button
                className="top-user-pill"
                aria-controls="top-user-dropdown"
                aria-expanded={userOpen}
                aria-haspopup="menu"
                onClick={() => setUserOpen((open) => !open)}
                type="button"
              >
                <Avatar user={topUser} />
                <span>{topUser.username}</span>
                <ChevronDown size={15} aria-hidden="true" />
              </button>
              <div data-top-user-dropdown id="top-user-dropdown" role="menu">
                <div data-user-menu-head>
                  <Avatar user={topUser} />
                  <span>
                    <strong>{topUser.fullName}</strong>
                    <small>@{topUser.username} · {topUser.rankName}</small>
                  </span>
                </div>
                <button type="button" role="menuitem" onClick={() => openRoute(`/users/${topUser.username}`)}><User size={16} />{t(locale, 'user.profile')}</button>
                <button type="button" role="menuitem" onClick={() => openRoute('/submissions?scope=mine')}><ListChecks size={16} />{locale === 'en' ? 'My submissions' : 'Bài nộp của tôi'}</button>
                <button type="button" role="menuitem" onClick={() => openRoute('/notifications')}><Bell size={16} />{t(locale, 'nav.notifications')}</button>
                <button type="button" role="menuitem" onClick={() => openRoute('/settings')}><Settings size={16} />{t(locale, 'user.settings')}</button>
                <button type="button" role="menuitem" onClick={() => openRoute('/payment-history')}><CreditCard size={16} />{t(locale, 'nav.payments')}</button>
                <button type="button" role="menuitem" onClick={() => openRoute('/wardrobe')}><Gift size={16} />{t(locale, 'nav.wardrobe')}</button>
                <button type="button" role="menuitem" onClick={() => openRoute('/feedback')}><Send size={16} />{t(locale, 'nav.feedback')}</button>
                {isAdminUser ? (
                  <div data-user-menu-admin aria-label="Khu quản trị">
                    <span data-user-menu-admin-title>
                      <Shield size={15} />
                      {t(locale, 'admin.title')}
                    </span>
                    <div data-user-menu-admin-grid>
                      <button
                        type="button"
                        role="menuitem"
                        data-admin-dmoj-action="true"
                        onClick={openLegacyAdminRoute}
                      >
                        <Shield size={16} />
                        {t(locale, 'admin.dmoj')}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        data-admin-management-action="true"
                        onClick={() => openRoute('/management')}
                      >
                        <ShieldCheck size={16} />
                        {t(locale, 'admin.cppro')}
                      </button>
                    </div>
                  </div>
                ) : null}
                <button type="button" role="menuitem" data-logout-action onClick={() => void onLogout()}><LogOut size={16} />{t(locale, 'user.logout')}</button>
              </div>
            </div>
          ) : (
            <>
                <button className="ghost-login" onClick={() => go(authPathWithReturn('login'))} type="button">
                <LogIn size={17} />
                Đăng nhập
              </button>
              <button className="primary-login" onClick={() => go('/register')} type="button">
                <CircleUserRound size={17} />
                Đăng ký
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

function findProblemForRoute(data: CpproData, rawKey: string) {
  const key = decodeURIComponent(rawKey || '').trim();
  const normalized = key.toLowerCase();
  return data.problemDetails[key]
    || data.problemDetails[rawKey]
    || data.problemDetails[normalized]
    || data.problems.find((problem) => (
      problem.slug.toLowerCase() === normalized
      || String(problem.id) === key
      || problem.code.toLowerCase() === normalized
      || problem.title.toLowerCase() === normalized
    ));
}

function Router({
  path,
  data,
  go,
  currentUser,
  onAuth,
  onUserUpdate,
  dataLoading,
}: {
  path: string;
  data: CpproData;
  go: (path: string) => void;
  currentUser: StoredCpproUser | null;
  onAuth: (result: AuthResult) => void;
  onUserUpdate: (user: StoredCpproUser) => void;
  dataLoading: boolean;
}) {
  const parts = path.split('/').filter(Boolean);
  const query = new URLSearchParams(window.location.search);
  const problemRouteKey = parts[0] === 'problems' && parts[1] ? parts[1] : '';
  const problemForRoute = problemRouteKey
    ? findProblemForRoute(data, problemRouteKey)
    : undefined;
  if (shouldUseLcojLegacyRoutes()) {
    if (parts[0] === 'problems' && parts[1] && parts[2] === 'submit') {
      return <LegacyRedirectPage target={lcojProblemPath(parts[1], '/submit')} />;
    }
    if (parts[0] === 'problems' && parts[1] && parts[2] === 'submissions') {
      return <LegacyRedirectPage target={lcojProblemPath(parts[1], parts[3] ? `/submissions/${encodeURIComponent(parts[3])}/` : '/submissions/')} />;
    }
    if (parts[0] === 'problems' && parts[1] && parts[2] === 'rank') {
      return <LegacyRedirectPage target={lcojProblemPath(parts[1], '/rank/')} />;
    }
    if ((parts[0] === 'submission' || parts[0] === 'submissions') && parts[1]) {
      return <LegacyRedirectPage target={`/submission/${encodeURIComponent(parts[1])}`} />;
    }
  }
  if ((parts[0] === 'submission' || parts[0] === 'submissions') && parts[1] && parts[2] === 'resubmit') {
    return <ProblemSubmitPage data={data} go={go} currentUser={currentUser} resubmitId={parts[1]} />;
  }
  if ((parts[0] === 'submission' || parts[0] === 'submissions') && parts[1]) {
    return <SubmissionDetailPage id={parts[1]} data={data} go={go} currentUser={currentUser} />;
  }
  if (parts[0] === 'problems' && parts[1] && parts[2] === 'submit') {
    return <ProblemSubmitPage problem={problemForRoute} problemSlug={parts[1]} data={data} go={go} currentUser={currentUser} contestParam={query.get('contest') || undefined} />;
  }
  if (parts[0] === 'problems' && parts[1] && parts[2] === 'submissions') {
    return <ProblemSubmissionsPage problem={problemForRoute} data={data} go={go} currentUser={currentUser} username={parts[3]} mode={parts[3] ? 'mine' : 'all'} />;
  }
  if (parts[0] === 'problems' && parts[1] && parts[2] === 'rank') {
    return <ProblemSubmissionsPage problem={problemForRoute} data={data} go={go} currentUser={currentUser} mode="best" />;
  }
  if (parts[0] === 'problems' && parts[1]) return <ProblemDetail problem={problemForRoute} problemSlug={parts[1]} data={data} go={go} currentUser={currentUser} contestParam={query.get('contest') || undefined} />;
  if (parts[0] === 'contests' && parts[1]) {
    const contestForRoute = data.contestDetails[parts[1]]
      || data.contestDetails[decodeURIComponent(parts[1])]
      || data.contests.find((c) => c.slug === parts[1] || String(c.id) === parts[1]);
    return <ContestDetail contest={contestForRoute} data={data} go={go} currentUser={currentUser} activeTab={contestTabFromPath(parts[2])} />;
  }
  if (parts[0] === 'users' && parts[1]) return <Profile requestedId={parts[1]} profile={data.profiles[parts[1]] || data.users.find((u) => u.username === parts[1])} data={data} go={go} currentUser={currentUser} onUserUpdate={onUserUpdate} />;
  if (parts[0] === 'management') {
    return <CpproManagementPage section={parts.slice(1).join('/') || 'dashboard'} data={data} go={go} currentUser={currentUser} />;
  }
  if (parts[0] === 'admin') {
    return shouldUseLcojLegacyRoutes()
      ? <LegacyRedirectPage target="/admin/" />
      : <CpproManagementPage section={parts.slice(1).join('/') || 'dashboard'} data={data} go={go} currentUser={currentUser} />;
  }
  if (shouldUseLcojLegacyRoutes() && [
    'courses',
    'hsg',
    'chat',
    'notifications',
    'settings',
    'payment-history',
    'wardrobe',
    'feedback',
    'about',
    'achievements',
    'mentors',
    'alumni',
    'contact',
    'theme',
  ].includes(parts[0])) {
    return <LegacyRedirectPage target="/" />;
  }
  if (parts[0] === 'status' || parts[0] === 'judges') return <SystemStatusPage activeTab="judges" go={go} />;
  if (parts[0] === 'runtimes' && parts[1] === 'matrix') return <SystemStatusPage activeTab="matrix" go={go} />;
  if (parts[0] === 'runtimes') return <SystemStatusPage activeTab="runtimes" go={go} />;
  if (parts[0] === 'problems') return <ProblemsPage data={data} go={go} currentUser={currentUser} loading={dataLoading} />;
  if (parts[0] === 'contests') return <ContestsPage data={data} go={go} loading={dataLoading} />;
  if (parts[0] === 'organizations') return <OrganizationsPage data={data} go={go} currentUser={currentUser} organizationKey={parts[1]} />;
  if (parts[0] === 'users') return <UsersPage data={data} go={go} loading={dataLoading} />;
  if (parts[0] === 'submissions') return <SubmissionsPage data={data} go={go} currentUser={currentUser} initialLoading={dataLoading} />;
  if (parts[0] === 'posts') return <CommunityPostsPage data={data} go={go} postKey={parts[1]} />;
  if (parts[0] === 'hsg') return <HsgPage data={data} go={go} />;
  if (parts[0] === 'chat') return <ChatPage data={data} go={go} currentUser={currentUser} />;
  if (['about', 'achievements', 'mentors', 'alumni', 'contact', 'theme'].includes(parts[0])) {
    return <ExplorePage kind={parts[0] as ExplorePageKind} data={data} go={go} />;
  }
  if (parts[0] === 'courses') return <CoursesPage data={data} />;
  if (['notifications', 'settings', 'payment-history', 'wardrobe', 'feedback'].includes(parts[0])) {
    return <ServicePage kind={parts[0] as ServiceKind} data={data} go={go} currentUser={currentUser} onUserUpdate={onUserUpdate} />;
  }
  if (parts[0] === 'login' || parts[0] === 'register') return <AuthPreview mode={parts[0]} go={go} onAuth={onAuth} />;
  return <HomePageV2 data={data} go={go} currentUser={currentUser} loading={dataLoading} />;
}

function LegacyRedirectPage({ target }: { target: string }) {
  useEffect(() => {
    window.location.replace(target);
  }, [target]);
  return <Empty title="Redirecting" subtitle={target} />;
}

function ManagementBridgePage({ path, platformFrontendUrl }: { path: string; platformFrontendUrl?: string | null }) {
  const locale = parseCpproPath(window.location.pathname).locale || readStoredLocale();
  const target = managementFrontendUrlForPath(withCpproLocale(locale, path || '/management'), platformFrontendUrl);
  useEffect(() => {
    syncPlatformBridgeSessionFromStorage();
    window.location.replace(target);
  }, [target]);
  return (
    <div className="service-shell" data-management-bridge>
      <section className="service-card">
        <ShieldCheck size={26} />
        <h1>Đang mở trang quản trị</h1>
        <p>Hệ thống đang chuyển sang khu quản trị cũ để dùng đầy đủ dashboard và các trang con.</p>
        <a href={target}>Mở quản trị</a>
      </section>
    </div>
  );
}



const cpproRatingColors: CpproRatingBand['color'][] = ['muted', 'success', 'caution', 'primary', 'warning', 'destructive'];

const defaultCpproRatingSettings: CpproRatingSettings = {
  enabled: false,
  base_rating: 1500,
  k_provisional: 40,
  k_stable: 20,
  provisional_threshold: 5,
  bands: [
    { min: 0, name: 'Newbie', color: 'muted' },
    { min: 1200, name: 'Pupil', color: 'success' },
    { min: 1400, name: 'Specialist', color: 'caution' },
    { min: 1600, name: 'Expert', color: 'primary' },
    { min: 1900, name: 'Candidate Master', color: 'primary' },
    { min: 2200, name: 'Master', color: 'warning' },
    { min: 2300, name: 'International Master', color: 'warning' },
    { min: 2400, name: 'Grandmaster', color: 'destructive' },
    { min: 2600, name: 'International Grandmaster', color: 'destructive' },
    { min: 2900, name: 'Legendary Grandmaster', color: 'destructive' },
  ],
};

function normalizeCpproRatingSettings(value?: Partial<CpproRatingSettings> | null, options: { sortBands?: boolean } = {}): CpproRatingSettings {
  const source = value && typeof value === 'object' ? value : {};
  const rawBands = Array.isArray(source.bands) && source.bands.length ? source.bands : defaultCpproRatingSettings.bands;
  const bands = rawBands.map((band, index) => ({
    min: Math.max(0, Math.round(Number(band?.min ?? index * 200) || 0)),
    name: String(band?.name || `Band ${index + 1}`).trim().slice(0, 60) || `Band ${index + 1}`,
    color: cpproRatingColors.includes(band?.color as CpproRatingBand['color']) ? band.color as CpproRatingBand['color'] : 'primary',
  }));
  const finalBands = options.sortBands === false ? bands : [...bands].sort((left, right) => left.min - right.min);
  if (finalBands.length === 0) finalBands.push(defaultCpproRatingSettings.bands[0]);
  return {
    enabled: Boolean(source.enabled),
    base_rating: Math.max(0, Math.round(Number(source.base_rating ?? defaultCpproRatingSettings.base_rating) || 0)),
    k_provisional: Math.max(1, Math.round(Number(source.k_provisional ?? defaultCpproRatingSettings.k_provisional) || 1)),
    k_stable: Math.max(1, Math.round(Number(source.k_stable ?? defaultCpproRatingSettings.k_stable) || 1)),
    provisional_threshold: Math.max(0, Math.round(Number(source.provisional_threshold ?? defaultCpproRatingSettings.provisional_threshold) || 0)),
    bands: finalBands,
  };
}

function cpproRatingBandForValue(settings: CpproRatingSettings | undefined, value: number) {
  const bands = settings?.bands?.length ? settings.bands : defaultCpproRatingSettings.bands;
  const rating = Math.max(0, Number(value || 0));
  let current = bands[0];
  for (const band of bands) {
    if (rating >= band.min) current = band;
    else break;
  }
  return current;
}

function isCpproAdminUser(user: StoredCpproUser | null | undefined) {
  const roles = [
    user?.role,
    ...(Array.isArray(user?.roles) ? user.roles : []),
    ...(Array.isArray(user?.tags) ? user.tags : []),
  ].filter(Boolean).map((role) => String(role).toLowerCase());
  const lcojStaffManager = isLcojBackendMode() && (Boolean(user?.is_teacher) || roles.some((role) => (
    role === 'teacher'
    || role === 'staff'
    || role.includes('teacher')
    || role.includes('staff')
  )));
  return lcojStaffManager || roles.some((role) => (
    role === 'admin'
    || role === 'moderator'
    || role.includes('admin')
    || role.includes('moderator')
    || role.includes('quan-tri')
    || role.includes('quan tri')
    || role.includes('quản trị')
  ));
}

function estimateCpproRating(user: Record<string, unknown>) {
  const stored = Number(user.rating);
  if (Number.isFinite(stored) && stored > 0) return Math.round(stored);
  const solved = Number(user.solved ?? 0) || 0;
  const submissions = Number(user.submissions ?? 0) || 0;
  return Math.max(0, Math.round(solved * 18 + Math.min(submissions, 500) * 1.2));
}

type ManagementSectionKey =
  | 'dashboard'
  | 'analytics'
  | 'announcements'
  | 'posts'
  | 'problem-groups'
  | 'tags'
  | 'rating'
  | 'users'
  | 'problems'
  | 'submissions'
  | 'contests'
  | 'attendance'
  | 'tickets'
  | 'chat'
  | 'comments'
  | 'organizations'
  | 'quizzes'
  | 'badges'
  | 'cluster'
  | 'incidents'
  | 'languages'
  | 'settings'
  | 'smtp'
  | 'audit-logs'
  | 'queue';

const managementNavItems: Array<{ key: ManagementSectionKey; label: string; icon: React.ReactNode }> = [
  { key: 'dashboard', label: 'Dashboard', icon: <ChartPie size={16} /> },
  { key: 'analytics', label: 'Analytics', icon: <ChartColumn size={16} /> },
  { key: 'announcements', label: 'Announcements', icon: <Megaphone size={16} /> },
  { key: 'posts', label: 'Posts', icon: <BookOpen size={16} /> },
  { key: 'problems', label: 'Problems', icon: <Code2 size={16} /> },
  { key: 'problem-groups', label: 'Problem groups', icon: <ListChecks size={16} /> },
  { key: 'tags', label: 'Problem tags', icon: <Tag size={16} /> },
  { key: 'languages', label: 'Judge languages', icon: <CodeXml size={16} /> },
  { key: 'users', label: 'Users', icon: <UsersRound size={16} /> },
  { key: 'organizations', label: 'Organizations', icon: <GraduationCap size={16} /> },
  { key: 'contests', label: 'Contests', icon: <Trophy size={16} /> },
  { key: 'submissions', label: 'Submissions', icon: <Send size={16} /> },
  { key: 'attendance', label: 'Attendance', icon: <CheckCircle2 size={16} /> },
  { key: 'tickets', label: 'Support tickets', icon: <Inbox size={16} /> },
  { key: 'chat', label: 'Chat groups', icon: <MessageSquare size={16} /> },
  { key: 'comments', label: 'Comments', icon: <MessageCircle size={16} /> },
  { key: 'quizzes', label: 'Quizzes', icon: <FileQuestion size={16} /> },
  { key: 'badges', label: 'Badges', icon: <Medal size={16} /> },
  { key: 'cluster', label: 'Cluster', icon: <HardDrive size={16} /> },
  { key: 'queue', label: 'Judge queue', icon: <Terminal size={16} /> },
  { key: 'incidents', label: 'Incidents', icon: <ShieldCheck size={16} /> },
  { key: 'settings', label: 'Settings', icon: <Settings size={16} /> },
  { key: 'rating', label: 'Rating', icon: <Trophy size={16} /> },
  { key: 'smtp', label: 'SMTP server', icon: <Mail size={16} /> },
  { key: 'audit-logs', label: 'Audit logs', icon: <Clock size={16} /> },
];

function normalizeManagementSection(section: string): ManagementSectionKey {
  const key = String(section || 'dashboard').split('/')[0] || 'dashboard';
  if (key === 'home' || key === 'admin') return 'dashboard';
  if (key === 'problem-list') return 'problems';
  if (key === 'contest') return 'contests';
  if (key === 'language') return 'languages';
  if (key === 'quiz') return 'quizzes';
  if (key === 'problemGroups') return 'problem-groups';
  if (key === 'chatGroups') return 'chat';
  if (key === 'auditLogs') return 'audit-logs';
  if (key === 'notification') return 'announcements';
  if (managementNavItems.some((item) => item.key === key)) return key as ManagementSectionKey;
  if (key === 'queue') return 'queue';
  return 'dashboard';
}

type ManagementSubpageRoute =
  | { kind: 'problem-create' }
  | { kind: 'problem-edit'; id: string }
  | { kind: 'contest-create' }
  | { kind: 'contest-edit'; id: string }
  | { kind: 'contest-integrity'; id: string }
  | { kind: 'contest-moss'; id: string }
  | { kind: 'organization-create' }
  | { kind: 'quiz-create' }
  | { kind: 'quiz-questions' }
  | { kind: 'quiz-reviews' }
  | { kind: 'profile' };

function managementSubpageForPath(section: string): ManagementSubpageRoute | null {
  const parts = String(section || '').split('/').filter(Boolean);
  const [root, id, child] = parts;
  if (root === 'problems' && id === 'new') return { kind: 'problem-create' };
  if (root === 'problems' && id) return { kind: 'problem-edit', id };
  if (root === 'contests' && id === 'new') return { kind: 'contest-create' };
  if (root === 'contests' && id && child === 'integrity') return { kind: 'contest-integrity', id };
  if (root === 'contests' && id && child === 'moss') return { kind: 'contest-moss', id };
  if (root === 'contests' && id) return { kind: 'contest-edit', id };
  if (root === 'organizations' && id === 'new') return { kind: 'organization-create' };
  if ((root === 'quiz' || root === 'quizzes') && id === 'new') return { kind: 'quiz-create' };
  if ((root === 'quiz' || root === 'quizzes') && id === 'questions') return { kind: 'quiz-questions' };
  if ((root === 'quiz' || root === 'quizzes') && id === 'reviews') return { kind: 'quiz-reviews' };
  if (root === 'profile') return { kind: 'profile' };
  return null;
}

function managementSubpageMeta(route: ManagementSubpageRoute) {
  const metadata: Record<ManagementSubpageRoute['kind'], { title: string; subtitle: string; section: ManagementSectionKey }> = {
    'problem-create': { title: 'Create problem', subtitle: 'Create the statement, judge limits, languages and initial testcase on port 18082.', section: 'problems' },
    'problem-edit': { title: 'Edit problem', subtitle: 'Edit problem information and judge policy using the live database API.', section: 'problems' },
    'contest-create': { title: 'Create contest', subtitle: 'Configure contest information and its problem set in one workflow.', section: 'contests' },
    'contest-edit': { title: 'Edit contest', subtitle: 'Update contest information, status and assigned problems together.', section: 'contests' },
    'contest-integrity': { title: 'Contest integrity', subtitle: 'Monitor integrity sessions, event history and saved drafts.', section: 'contests' },
    'contest-moss': { title: 'MOSS review', subtitle: 'Run and inspect similarity reports for contest submissions.', section: 'contests' },
    'organization-create': { title: 'Create organization', subtitle: 'Create an organization and configure its owner and visibility.', section: 'organizations' },
    'quiz-create': { title: 'Create quiz', subtitle: 'Create a quiz and select questions from the database question bank.', section: 'quizzes' },
    'quiz-questions': { title: 'Quiz questions', subtitle: 'Create and maintain questions used by quizzes.', section: 'quizzes' },
    'quiz-reviews': { title: 'Quiz reviews', subtitle: 'Review free-text answers and save awarded points.', section: 'quizzes' },
    profile: { title: 'Admin profile', subtitle: 'Review the active administrator identity and entitlement badges.', section: 'dashboard' },
  };
  return metadata[route.kind];
}

type ManagementAction = {
  label: string;
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  icon: React.ReactNode;
};

type ManagementSiteSettings = {
  name: string;
  domain: string;
  frontendUrl: string;
  logoUrl: string;
  faviconUrl: string;
  ogImageUrl: string;
  footerCopyright: string;
  maxTestcasesShown: number | '';
  topbarFeatures: TopbarFeatures;
};

type ManagementSettingsControl = {
  value: ManagementSiteSettings;
  dirty: boolean;
  saving: boolean;
  onPatch: (patch: Partial<ManagementSiteSettings>) => void;
  onToggle: (key: TopbarFeatureKey) => void;
  onSave: () => void;
};

function managementSiteSettingsFromPayload(payload: unknown, data: CpproData): ManagementSiteSettings {
  const source = payload && typeof payload === 'object'
    ? ((payload as Record<string, unknown>).site && typeof (payload as Record<string, unknown>).site === 'object'
      ? (payload as Record<string, unknown>).site as Record<string, unknown>
      : payload as Record<string, unknown>)
    : {};
  const rawFeatures = source.topbarFeatures && typeof source.topbarFeatures === 'object'
    ? source.topbarFeatures as Partial<TopbarFeatures>
    : data.topbarFeatures;
  return {
    name: String(source.name || data.contact.brandName || defaultFooterContactSettings.brandName),
    domain: String(source.domain || data.contact.domainName || ''),
    frontendUrl: String(source.frontendUrl || data.platformFrontendUrl || ''),
    logoUrl: String(source.logoUrl || data.contact.logoUrl || ''),
    faviconUrl: String(source.faviconUrl || ''),
    ogImageUrl: String(source.ogImageUrl || ''),
    footerCopyright: String(source.footerCopyright || data.contact.copyrightText || ''),
    maxTestcasesShown: Number(source.maxTestcasesShown) > 0 ? Number(source.maxTestcasesShown) : '',
    topbarFeatures: Object.fromEntries(
      (Object.keys(defaultTopbarFeatures) as TopbarFeatureKey[]).map((key) => [
        key,
        typeof rawFeatures[key] === 'boolean' ? rawFeatures[key] : defaultTopbarFeatures[key],
      ]),
    ) as TopbarFeatures,
  };
}

function managementActionsForSection(section: ManagementSectionKey): ManagementAction[] {
  const actions: Record<ManagementSectionKey, ManagementAction[]> = {
    dashboard: [
      { label: 'Refresh dashboard', endpoint: '/admin/dashboard', icon: <ChartPie size={17} />, tone: 'primary' },
      { label: 'Inspect queue', endpoint: '/admin/judge/registry', icon: <Terminal size={17} /> },
    ],
    analytics: [
      { label: 'Load 30-day analytics', endpoint: '/admin/analytics?days=30', icon: <ChartColumn size={17} />, tone: 'primary' },
    ],
    announcements: [
      { label: 'Create announcement', endpoint: '/posts', method: 'POST', icon: <Megaphone size={17} />, tone: 'primary' },
    ],
    posts: [
      { label: 'Create post', endpoint: '/posts', method: 'POST', icon: <BookOpen size={17} />, tone: 'primary' },
    ],
    problems: [
      { label: 'Create problem', endpoint: '/problems', method: 'POST', icon: <Code2 size={17} />, tone: 'primary' },
    ],
    'problem-groups': [
      { label: 'Create problem', endpoint: '/problems', method: 'POST', icon: <Code2 size={17} />, tone: 'primary' },
    ],
    tags: [
      { label: 'Create problem tag', endpoint: '/tags', method: 'POST', icon: <Tag size={17} />, tone: 'primary' },
    ],
    languages: [
      { label: 'Load judge languages', endpoint: '/languages', icon: <CodeXml size={17} />, tone: 'primary' },
      { label: 'Import runtime registry', endpoint: '/languages/import', method: 'POST', icon: <Inbox size={17} /> },
    ],
    users: [
      { label: 'Create account', endpoint: '/admin/users', method: 'POST', icon: <User size={17} />, tone: 'primary' },
    ],
    organizations: [
      { label: 'Load organizations', endpoint: '/organizations', icon: <GraduationCap size={17} />, tone: 'primary' },
      { label: 'Create organization', endpoint: '/admin/organizations', method: 'POST', icon: <PenLine size={17} /> },
    ],
    contests: [
      { label: 'Load contests', endpoint: '/contests', icon: <Trophy size={17} />, tone: 'primary' },
      { label: 'Create contest', endpoint: '/contests', method: 'POST', icon: <PenLine size={17} /> },
    ],
    attendance: [
      { label: 'Load contest attendance', endpoint: '/admin/contests/:id/attendance', icon: <CheckCircle2 size={17} />, tone: 'primary' },
      { label: 'Update attendance', endpoint: '/admin/contests/:id/attendance/:userId', method: 'PUT', icon: <PenLine size={17} /> },
    ],
    tickets: [
      { label: 'Load support tickets', endpoint: '/admin/tickets', icon: <Inbox size={17} />, tone: 'primary' },
    ],
    chat: [
      { label: 'Create chat group', endpoint: '/admin/chat-groups', method: 'POST', icon: <MessageSquare size={17} />, tone: 'primary' },
    ],
    comments: [
      { label: 'Load problem comments', endpoint: '/admin/problem-comments', icon: <MessageCircle size={17} />, tone: 'primary' },
    ],
    quizzes: [
      { label: 'Load quizzes', endpoint: '/admin/quizzes', icon: <FileQuestion size={17} />, tone: 'primary' },
      { label: 'Create quiz', endpoint: '/admin/quizzes', method: 'POST', icon: <PenLine size={17} /> },
      { label: 'Review answers', endpoint: '/admin/quiz-reviews', icon: <ListChecks size={17} /> },
    ],
    badges: [
      { label: 'Create badge', endpoint: '/admin/badges', method: 'POST', icon: <Medal size={17} />, tone: 'primary' },
    ],
    cluster: [
      { label: 'Load cluster nodes', endpoint: '/admin/cluster/nodes', icon: <HardDrive size={17} />, tone: 'primary' },
      { label: 'Inspect judge registry', endpoint: '/admin/judge/registry', icon: <Terminal size={17} /> },
      { label: 'Inspect dead letter queue', endpoint: '/admin/judge-jobs/dead-letter?limit=20', icon: <Inbox size={17} />, tone: 'warning' },
    ],
    incidents: [
      { label: 'Load incidents', endpoint: '/admin/incidents', icon: <ShieldCheck size={17} />, tone: 'primary' },
      { label: 'Recalculate submission risk', endpoint: '/admin/submissions/:id/risk/recalculate', method: 'POST', icon: <Zap size={17} />, tone: 'warning' },
    ],
    settings: [
      { label: 'Load platform settings', endpoint: '/admin/platform-settings', icon: <Settings size={17} />, tone: 'primary' },
      { label: 'Save site settings', endpoint: '/admin/platform-settings/site', method: 'PUT', icon: <PenLine size={17} /> },
    ],
    rating: [
      { label: 'Load rating settings', endpoint: '/admin/settings/rating', icon: <Trophy size={17} />, tone: 'primary' },
      { label: 'Save rating settings', endpoint: '/admin/settings/rating', method: 'PUT', icon: <PenLine size={17} /> },
    ],
    smtp: [
      { label: 'Load SMTP settings', endpoint: '/admin/platform-settings', icon: <Mail size={17} />, tone: 'primary' },
      { label: 'Save SMTP settings', endpoint: '/admin/platform-settings/smtp', method: 'PUT', icon: <PenLine size={17} /> },
      { label: 'Test SMTP connection', endpoint: '/admin/platform-settings/smtp/test', method: 'POST', icon: <Send size={17} />, tone: 'success' },
    ],
    'audit-logs': [
      { label: 'Load audit logs', endpoint: '/admin/audit-logs?page=1&limit=100', icon: <Clock size={17} />, tone: 'primary' },
    ],
    submissions: [
      { label: 'Load submissions', endpoint: '/submissions', icon: <Send size={17} />, tone: 'primary' },
      { label: 'Inspect dead letter queue', endpoint: '/admin/judge-jobs/dead-letter?limit=20', icon: <Inbox size={17} />, tone: 'warning' },
    ],
    queue: [
      { label: 'Load judge registry', endpoint: '/admin/judge/registry', icon: <Terminal size={17} />, tone: 'primary' },
      { label: 'Load cluster nodes', endpoint: '/admin/cluster/nodes', icon: <HardDrive size={17} /> },
    ],
  };
  return actions[section] || actions.dashboard;
}

function managementPrimaryReadEndpoint(section: ManagementSectionKey) {
  if (isLcojBackendMode()) return `/admin/management/${section}`;
  const endpoints: Partial<Record<ManagementSectionKey, string>> = {
    dashboard: '/admin/dashboard?range=week&recentPage=1&recentLimit=50',
    analytics: '/admin/analytics?days=30',
    announcements: '/admin/announcements?page=1&limit=100',
    posts: '/admin/announcements?page=1&limit=100',
    problems: '/problems?page=1&limit=100',
    'problem-groups': '/problem-groups',
    tags: '/tags',
    languages: '/languages',
    organizations: '/organizations',
    contests: '/contests',
    tickets: '/admin/tickets?page=1&limit=100',
    chat: '/admin/chat-groups',
    comments: '/admin/problem-comments?page=1&limit=100',
    quizzes: '/admin/quizzes',
    badges: '/admin/badges',
    cluster: '/admin/cluster/nodes',
    incidents: '/admin/incidents?page=1&limit=100',
    smtp: '/admin/platform-settings',
    'audit-logs': '/admin/audit-logs?page=1&limit=100',
    submissions: '/submissions?page=1&limit=100',
    queue: '/admin/judge/registry',
  };
  return endpoints[section] || '';
}

type ManagementDashboardSnapshot = {
  counts: Record<string, unknown>;
  judge: Record<string, unknown>;
  recentRows: Array<Record<string, unknown>>;
};

function managementDashboardSnapshotFromPayload(payload: unknown): ManagementDashboardSnapshot | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const counts = record.counts && typeof record.counts === 'object'
    ? record.counts as Record<string, unknown>
    : {};
  const judge = record.judge && typeof record.judge === 'object'
    ? record.judge as Record<string, unknown>
    : {};
  const recentRows = rowsFromApi<Record<string, unknown>>(record.recent);
  return { counts, judge, recentRows };
}

function managementRowsFromPayload(payload: unknown) {
  const directRows = rowsFromApi<Record<string, unknown>>(payload);
  if (directRows.length) return directRows;
  if (!payload || typeof payload !== 'object') return [];
  const result: Array<Record<string, unknown>> = [];
  Object.entries(payload as Record<string, unknown>).forEach(([group, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        result.push(item && typeof item === 'object'
          ? { group, ...(item as Record<string, unknown>) }
          : { group, index: index + 1, value: item });
      });
      return;
    }
    if (value && typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([metric, metricValue]) => {
        if (Array.isArray(metricValue)) return;
        result.push({ group, metric, value: metricValue });
      });
      return;
    }
    result.push({ group: 'response', metric: group, value });
  });
  return result;
}

type ManagementCard = {
  label: string;
  value: string;
  meta?: string;
  icon: React.ReactNode;
};

type ManagementColumn<T> = {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  render: (row: T, index: number) => React.ReactNode;
};

type ManagementDataset<T> = {
  title: string;
  subtitle: string;
  filterLabel: string;
  queueLabel: string;
  sourceEndpoint?: string;
  cards: ManagementCard[];
  rows: T[];
  columns: Array<ManagementColumn<T>>;
  searchText: (row: T) => string;
  empty: string;
};

const managementViText: Record<string, string> = {
  Dashboard: 'Bảng điều khiển',
  Analytics: 'Phân tích',
  Announcements: 'Thông báo',
  Posts: 'Bài viết',
  Problems: 'Bài tập',
  'Problem groups': 'Nhóm bài tập',
  'Problem tags': 'Nhãn bài tập',
  'Judge languages': 'Ngôn ngữ chấm bài',
  Users: 'Người dùng',
  Organizations: 'Tổ chức',
  Contests: 'Kỳ thi',
  Submissions: 'Bài nộp',
  Attendance: 'Điểm danh',
  'Support tickets': 'Yêu cầu hỗ trợ',
  'Chat groups': 'Nhóm chat',
  Comments: 'Bình luận',
  Quizzes: 'Quizz',
  Badges: 'Huy hiệu',
  Cluster: 'Cụm máy chấm',
  'Judge queue': 'Hàng đợi máy chấm',
  Incidents: 'Sự cố',
  Settings: 'Cài đặt',
  Rating: 'Xếp hạng',
  'SMTP server': 'Máy chủ SMTP',
  'Audit logs': 'Nhật ký kiểm toán',
  Management: 'Quản trị',
  'CPPRO Admin': 'Quản trị CPPRO',
  'Administrator access required': 'Cần quyền quản trị viên',
  'This CPPRO management area stays on port 18082 and uses a separate UI from the legacy admin frontend.': 'Khu quản trị CPPRO chạy riêng trên cổng 18082 và dùng giao diện mới thay cho admin cũ.',
  Login: 'Đăng nhập',
  Status: 'Trạng thái',
  'Back to list': 'Quay lại danh sách',
  'Rating console': 'Bảng điều khiển xếp hạng',
  'Rating settings stay native inside CPPRO management on port 18082.': 'Cài đặt xếp hạng chạy trực tiếp trong khu quản trị CPPRO trên cổng 18082.',
  'CPPRO management UI is active.': 'Giao diện quản trị CPPRO đang hoạt động.',
  'Edit problem': 'Sửa bài tập',
  'Edit contest': 'Sửa kỳ thi',
  'Contest integrity': 'Toàn vẹn kỳ thi',
  'MOSS review': 'Duyệt MOSS',
  'Create organization': 'Tạo tổ chức',
  'Quiz questions': 'Câu hỏi quizz',
  'Quiz reviews': 'Duyệt quizz',
  'Admin profile': 'Hồ sơ quản trị',
  'Create the statement, judge limits, languages and initial testcase on port 18082.': 'Tạo đề bài, giới hạn chấm, ngôn ngữ và testcase ban đầu trên cổng 18082.',
  'Edit problem information and judge policy using the live database API.': 'Sửa thông tin bài tập và chính sách chấm bằng API database trực tiếp.',
  'Configure contest information and its problem set in one workflow.': 'Cấu hình thông tin kỳ thi và danh sách bài trong cùng một quy trình.',
  'Update contest information, status and assigned problems together.': 'Cập nhật thông tin, trạng thái và bài tập của kỳ thi cùng lúc.',
  'Monitor integrity sessions, event history and saved drafts.': 'Theo dõi phiên toàn vẹn, lịch sử sự kiện và bản nháp đã lưu.',
  'Run and inspect similarity reports for contest submissions.': 'Chạy và xem báo cáo tương đồng cho bài nộp kỳ thi.',
  'Create an organization and configure its owner and visibility.': 'Tạo tổ chức và cấu hình chủ sở hữu, phạm vi hiển thị.',
  'Create a quiz and select questions from the database question bank.': 'Tạo quizz và chọn câu hỏi từ ngân hàng câu hỏi database.',
  'Create and maintain questions used by quizzes.': 'Tạo và bảo trì câu hỏi dùng cho quizz.',
  'Review free-text answers and save awarded points.': 'Duyệt câu trả lời tự luận và lưu điểm được chấm.',
  'Review the active administrator identity and entitlement badges.': 'Kiểm tra danh tính quản trị viên hiện tại và huy hiệu quyền hạn.',
  Filter: 'Bộ lọc',
  'Filter current table...': 'Lọc bảng hiện tại...',
  table: 'bảng',
  'rows after filter': 'dòng sau khi lọc',
  Actions: 'Thao tác',
  Edit: 'Sửa',
  Inspect: 'Xem',
  'Edit row': 'Sửa dòng',
  'Inspect row': 'Xem dòng',
  'Only fields supported by this module API will be saved.': 'Chỉ các trường được API module hỗ trợ mới được lưu.',
  'This operational row is read-only; use the module actions above for its workflow.': 'Dòng vận hành này chỉ đọc; hãy dùng thao tác module phía trên cho quy trình đầy đủ.',
  'Structured row data': 'Dữ liệu cấu trúc của dòng',
  Close: 'Đóng',
  'Save changes': 'Lưu thay đổi',
  'Saving...': 'Đang lưu...',
  Unsaved: 'Chưa lưu',
  Enabled: 'Đã bật',
  Saved: 'Đã lưu',
  'Save settings': 'Lưu cài đặt',
  Refresh: 'Làm mới',
  Reset: 'Đặt lại',
  'Badge setup': 'Cài đặt huy hiệu',
  'Delete all badges': 'Xóa toàn bộ huy hiệu',
  'Edit badge': 'Sửa huy hiệu',
  'Save badge': 'Lưu huy hiệu',
  'Add badge': 'Thêm huy hiệu',
  'Database badges': 'Huy hiệu trong database',
  'No badges found in database.': 'Chưa có huy hiệu trong database.',
  'Loading badges': 'Đang tải huy hiệu',
  Name: 'Tên',
  Slug: 'Slug',
  Color: 'Màu',
  Background: 'Nền',
  'Icon URL': 'URL icon',
  'Sort order': 'Thứ tự sắp xếp',
  Description: 'Mô tả',
  'Active badge': 'Huy hiệu đang bật',
  active: 'đang bật',
  inactive: 'đã tắt',
  Delete: 'Xóa',
  Create: 'Tạo',
  Cancel: 'Hủy',
  'Open form': 'Mở biểu mẫu',
  'Create announcement': 'Tạo thông báo',
  'Create post': 'Tạo bài viết',
  'Announcement created.': 'Đã tạo thông báo.',
  'Post created.': 'Đã tạo bài viết.',
  'Problem tag created.': 'Đã tạo nhãn bài tập.',
  'Account created.': 'Đã tạo tài khoản.',
  'Chat group created.': 'Đã tạo nhóm chat.',
  'Create a new announcement and optionally upload an announcement image.': 'Tạo thông báo mới và có thể tải ảnh thông báo.',
  'Create a new community post and optionally attach a cover image.': 'Tạo bài viết cộng đồng mới và có thể đính kèm ảnh bìa.',
  'Create a reusable problem tag with a visible color.': 'Tạo nhãn bài tập dùng lại được kèm màu hiển thị.',
  'Create a verified account directly from the management workspace.': 'Tạo tài khoản đã xác minh trực tiếp trong khu quản trị.',
  'Create a private class or team chat group. Member IDs can be comma separated.': 'Tạo nhóm chat riêng cho lớp hoặc đội. ID thành viên có thể nhập cách nhau bằng dấu phẩy.',
  'Full name': 'Họ và tên',
  Password: 'Mật khẩu',
  Role: 'Vai trò',
  'Membership tier': 'Gói thành viên',
  'Membership expires at': 'Hết hạn gói lúc',
  'Teacher account': 'Tài khoản giáo viên',
  'Post type': 'Loại bài viết',
  Announcement: 'Thông báo',
  Info: 'Thông tin',
  Warning: 'Cảnh báo',
  Success: 'Thành công',
  Error: 'Lỗi',
  Blog: 'Blog',
  Magazine: 'Tạp chí',
  News: 'Tin tức',
  Moderator: 'Điều hành viên',
  Admin: 'Quản trị viên',
  Free: 'Miễn phí',
  Pro: 'Pro',
  Ultra: 'Ultra',
  'Ultra Max': 'Ultra Max',
  Excerpt: 'Tóm tắt',
  Content: 'Nội dung',
  'Image URL': 'URL ảnh',
  'Upload image': 'Tải ảnh lên',
  'Member IDs': 'ID thành viên',
  'Confirm delete': 'Xác nhận xóa',
  'Delete this row?': 'Xóa dòng này?',
  'This action will call the live database API and cannot be undone from this screen.': 'Thao tác này sẽ gọi API database thật và không thể hoàn tác từ màn hình này.',
  'Deleting...': 'Đang xóa...',
  'Row deleted.': 'Đã xóa dòng.',
  'Could not delete this row.': 'Không thể xóa dòng này.',
  'This module does not expose a delete API yet.': 'Module này chưa có API xóa.',
  'Could not create this item.': 'Không thể tạo mục này.',
  'Could not upload image.': 'Không thể tải ảnh lên.',
  'Uploading image...': 'Đang tải ảnh...',
  'Uploaded image URL is saved into the image field.': 'URL ảnh đã tải sẽ được lưu vào trường ảnh.',
  'Contest information': 'Thông tin kỳ thi',
  'Contest code': 'Mã kỳ thi',
  'Start time': 'Thời gian bắt đầu',
  'End time': 'Thời gian kết thúc',
  Format: 'Định dạng',
  Draft: 'Bản nháp',
  Upcoming: 'Sắp diễn ra',
  Live: 'Đang diễn ra',
  Finished: 'Đã kết thúc',
  Public: 'Công khai',
  Private: 'Riêng tư',
  'Allow virtual participation': 'Cho phép thi ảo',
  'Rated contest': 'Kỳ thi tính rating',
  'Allowed languages': 'Ngôn ngữ được phép',
  All: 'Tất cả',
  'All enabled judge languages are allowed.': 'Cho phép tất cả ngôn ngữ chấm bài đang bật.',
  'Select language...': 'Chọn ngôn ngữ...',
  'Add language': 'Thêm ngôn ngữ',
  'Search problem...': 'Tìm bài tập...',
  Selected: 'Đã chọn',
  pts: 'điểm',
  'Save contest and problems': 'Lưu kỳ thi và bài tập',
  'Contest title must contain at least three characters.': 'Tiêu đề kỳ thi cần có ít nhất ba ký tự.',
  'Contest information and problem set updated.': 'Đã cập nhật thông tin và bộ bài của kỳ thi.',
  'Contest created.': 'Đã tạo kỳ thi.',
  'Could not save contest.': 'Không thể lưu kỳ thi.',
  'Unsaved site and topbar changes': 'Có thay đổi site và topbar chưa lưu',
  'Site and topbar settings are saved': 'Cài đặt site và topbar đã được lưu',
  'Source code': 'Mã nguồn',
  'database rows': 'dòng database',
  'judge history': 'lịch sử chấm',
  accounts: 'tài khoản',
  overall: 'tổng quan',
  'last 5 minutes': '5 phút gần đây',
  'traffic counter': 'bộ đếm truy cập',
  workers: 'worker',
  Capability: 'Khả năng',
  Method: 'Phương thức',
  'API endpoint': 'Endpoint API',
  'Database source': 'Nguồn database',
  Period: 'Giai đoạn',
  Metric: 'Chỉ số',
  Value: 'Giá trị',
  Title: 'Tiêu đề',
  Category: 'Danh mục',
  Author: 'Tác giả',
  Date: 'Ngày',
  Group: 'Nhóm',
  Kind: 'Loại',
  Tag: 'Nhãn',
  User: 'Người dùng',
  Solved: 'Đã giải',
  'Role/Tier': 'Vai trò/Gói',
  Code: 'Mã',
  Difficulty: 'Độ khó',
  Score: 'Điểm',
  'AC/Sub': 'AC/Nộp',
  Source: 'Nguồn',
  Setting: 'Cài đặt',
  'Refresh dashboard': 'Làm mới bảng điều khiển',
  'Inspect queue': 'Kiểm tra hàng đợi',
  'Load 30-day analytics': 'Tải phân tích 30 ngày',
  'Load announcements': 'Tải thông báo',
  'Update publication status': 'Cập nhật trạng thái xuất bản',
  'Review community posts': 'Duyệt bài viết cộng đồng',
  'Update post status': 'Cập nhật trạng thái bài viết',
  'Load problem database': 'Tải database bài tập',
  'Create problem': 'Tạo bài tập',
  'Import testcases': 'Nhập testcase',
  'Load problem groups': 'Tải nhóm bài tập',
  'Create problem group': 'Tạo nhóm bài tập',
  'Load problem tags': 'Tải nhãn bài tập',
  'Create problem tag': 'Tạo nhãn bài tập',
  'Load judge languages': 'Tải ngôn ngữ chấm bài',
  'Import runtime registry': 'Nhập registry runtime',
  'Load users': 'Tải người dùng',
  'Create account': 'Tạo tài khoản',
  'Load organizations': 'Tải tổ chức',
  'Load contests': 'Tải kỳ thi',
  'Create contest': 'Tạo kỳ thi',
  'Load contest attendance': 'Tải điểm danh kỳ thi',
  'Update attendance': 'Cập nhật điểm danh',
  'Load support tickets': 'Tải yêu cầu hỗ trợ',
  'Load chat groups': 'Tải nhóm chat',
  'Create chat group': 'Tạo nhóm chat',
  'Load problem comments': 'Tải bình luận bài tập',
  'Load quizzes': 'Tải quizz',
  'Create quiz': 'Tạo quizz',
  'Review answers': 'Duyệt câu trả lời',
  'Load badges': 'Tải huy hiệu',
  'Create badge': 'Tạo huy hiệu',
  'Load cluster nodes': 'Tải node cụm máy',
  'Inspect judge registry': 'Kiểm tra registry máy chấm',
  'Inspect dead letter queue': 'Kiểm tra hàng đợi lỗi',
  'Load incidents': 'Tải sự cố',
  'Recalculate submission risk': 'Tính lại rủi ro bài nộp',
  'Load platform settings': 'Tải cài đặt nền tảng',
  'Save site settings': 'Lưu cài đặt site',
  'Load rating settings': 'Tải cài đặt xếp hạng',
  'Save rating settings': 'Lưu cài đặt xếp hạng',
  'Load SMTP settings': 'Tải cài đặt SMTP',
  'Save SMTP settings': 'Lưu cài đặt SMTP',
  'Test SMTP connection': 'Kiểm tra kết nối SMTP',
  'Could not load SMTP settings.': 'Không thể tải cài đặt SMTP.',
  'Mail delivery settings': 'Cài đặt gửi email',
  'Configure account activation, password reset and notification mail from the database settings table.': 'Cấu hình email kích hoạt tài khoản, đặt lại mật khẩu và thông báo từ bảng cài đặt database.',
  Host: 'Máy chủ',
  Port: 'Cổng',
  Username: 'Tên đăng nhập',
  'Leave blank to keep current password': 'Để trống nếu giữ mật khẩu hiện tại',
  'From email': 'Email gửi đi',
  'EHLO domain': 'Miền EHLO',
  'Use SMTPS / secure port': 'Dùng SMTPS / cổng bảo mật',
  'Require STARTTLS': 'Yêu cầu STARTTLS',
  'Clear saved password': 'Xóa mật khẩu đã lưu',
  Configured: 'Đã cấu hình',
  'Not configured': 'Chưa cấu hình',
  'Test SMTP': 'Test SMTP',
  'Save SMTP': 'Lưu SMTP',
  'SMTP settings saved.': 'Đã lưu cài đặt SMTP.',
  'Could not save SMTP settings.': 'Không thể lưu cài đặt SMTP.',
  'SMTP connection test completed.': 'Đã hoàn tất kiểm tra kết nối SMTP.',
  'SMTP connection test failed.': 'Kiểm tra kết nối SMTP thất bại.',
  'Chat member operations': 'Quản lý thành viên chat',
  'Manage members and download daily chat reports from the legacy admin workflow.': 'Quản lý thành viên và tải báo cáo chat hằng ngày từ quy trình admin cũ.',
  'Could not load chat operations.': 'Không thể tải dữ liệu vận hành chat.',
  'Could not load chat members.': 'Không thể tải thành viên nhóm chat.',
  'Members updated.': 'Đã cập nhật thành viên.',
  'Could not update members.': 'Không thể cập nhật thành viên.',
  'Chat summary downloaded.': 'Đã tải báo cáo chat.',
  'Could not download chat summary.': 'Không thể tải báo cáo chat.',
  'Summary date': 'Ngày tổng hợp',
  'Download daily Excel': 'Tải Excel hằng ngày',
  'Selected group': 'Nhóm đang chọn',
  'Search users to add': 'Tìm người dùng để thêm',
  'Update members': 'Cập nhật thành viên',
  'No chat groups found.': 'Chưa có nhóm chat.',
  'No users match this search.': 'Không có người dùng khớp tìm kiếm.',
  'Loading chat operations': 'Đang tải vận hành chat',
  'Organization requests': 'Yêu cầu tổ chức',
  'Organization review queue': 'Hàng duyệt tổ chức',
  'Payment and resource requests': 'Yêu cầu thanh toán và tài nguyên',
  'Membership join requests': 'Yêu cầu tham gia tổ chức',
  'open requests need review.': 'yêu cầu đang mở cần duyệt.',
  'Could not load organization requests.': 'Không thể tải yêu cầu tổ chức.',
  'Could not load organization join requests.': 'Không thể tải yêu cầu tham gia tổ chức.',
  'Organization request approved.': 'Đã duyệt yêu cầu tổ chức.',
  'Organization request rejected.': 'Đã từ chối yêu cầu tổ chức.',
  'Could not review organization request.': 'Không thể duyệt yêu cầu tổ chức.',
  'Organization join request approved.': 'Đã duyệt yêu cầu tham gia tổ chức.',
  'Organization join request rejected.': 'Đã từ chối yêu cầu tham gia tổ chức.',
  'Could not review organization join request.': 'Không thể duyệt yêu cầu tham gia tổ chức.',
  'Loading organization requests': 'Đang tải yêu cầu tổ chức',
  'Loading organization join requests': 'Đang tải yêu cầu tham gia tổ chức',
  Approve: 'Duyệt',
  Reject: 'Từ chối',
  'No organization payment requests found.': 'Chưa có yêu cầu thanh toán tổ chức.',
  'No organization join requests found.': 'Chưa có yêu cầu tham gia tổ chức.',
  'Judge cluster': 'Cụm máy chấm',
  'Worker operations': 'Vận hành worker',
  'queued jobs': 'job đang chờ',
  'Some cluster data could not be loaded.': 'Một phần dữ liệu cụm máy chấm không tải được.',
  'Fleet drain enabled.': 'Đã bật chế độ drain toàn cụm.',
  'Fleet drain disabled.': 'Đã tắt chế độ drain toàn cụm.',
  'Could not toggle judge drain.': 'Không thể đổi trạng thái drain cụm chấm.',
  'Worker drain enabled.': 'Đã bật drain worker.',
  'Worker drain disabled.': 'Đã tắt drain worker.',
  'Could not toggle worker drain.': 'Không thể đổi drain worker.',
  'Enrollment created.': 'Đã tạo mã kết nối worker.',
  'Could not create judge enrollment.': 'Không thể tạo mã kết nối máy chấm.',
  'Dead-letter job retried.': 'Đã gửi chạy lại job lỗi.',
  'Could not retry dead-letter job.': 'Không thể chạy lại job lỗi.',
  'Workers online': 'Worker online',
  'Dead-letter jobs': 'Job lỗi',
  On: 'Bật',
  Off: 'Tắt',
  'Fleet drain': 'Drain cụm',
  'Enable drain': 'Bật drain',
  'Resume judging': 'Tiếp tục chấm',
  'Enrollment mode': 'Kiểu kết nối',
  'Worker count': 'Số worker',
  'Create enrollment': 'Tạo mã kết nối',
  'Loading judge cluster': 'Đang tải cụm máy chấm',
  'Judge worker': 'Worker chấm',
  Drain: 'Drain',
  Resume: 'Tiếp tục',
  'Dead-letter job': 'Job lỗi',
  Retry: 'Chạy lại',
  Enrollment: 'Mã kết nối',
  'Load audit logs': 'Tải nhật ký kiểm toán',
  'Load submissions': 'Tải bài nộp',
  'Load judge registry': 'Tải registry máy chấm',
  Search: 'Tìm kiếm',
  Problem: 'Bài tập',
  Language: 'Ngôn ngữ',
  Verdict: 'Kết quả',
  Streak: 'Chuỗi',
  Contest: 'Kỳ thi',
  Participants: 'Người tham gia',
  'Checked at': 'Đã kiểm tra lúc',
  Note: 'Ghi chú',
  Organization: 'Tổ chức',
  Visibility: 'Hiển thị',
  Members: 'Thành viên',
  Runtime: 'Runtime',
  Label: 'Nhãn',
  Extension: 'Đuôi file',
  Votes: 'Bình chọn',
  Year: 'Năm',
  Time: 'Thời gian',
  'Total score': 'Tổng điểm',
  Acceptance: 'Tỉ lệ AC',
  'Online users': 'Người online',
  'System health': 'Sức khỏe hệ thống',
  Visits: 'Lượt truy cập',
  'Acceptance rate': 'Tỉ lệ chấp nhận',
  'Judge queue depth': 'Độ dài hàng đợi chấm',
  'Judge queue pressure': 'Áp lực hàng đợi chấm',
  Realtime: 'Thời gian thực',
  'All time': 'Toàn thời gian',
  'Queue depth': 'Độ dài hàng đợi',
  'Queue limit': 'Giới hạn hàng đợi',
  'Queue pressure': 'Áp lực hàng đợi',
  'Queue health': 'Sức khỏe hàng đợi',
  'Database totals and realtime judge signals are presented before the analytics table.': 'Tổng số liệu database và tín hiệu máy chấm thời gian thực được đặt trước bảng phân tích.',
  'Filter by metric, source table or period.': 'Lọc theo chỉ số, bảng nguồn hoặc giai đoạn.',
  'Community post moderation data is loaded directly from the admin API.': 'Dữ liệu duyệt bài cộng đồng được tải trực tiếp từ API quản trị.',
  'Filter by post id, title, status, category or author.': 'Lọc theo ID bài viết, tiêu đề, trạng thái, danh mục hoặc tác giả.',
  'Community post moderation and publication controls stay above the post table.': 'Điều khiển duyệt và xuất bản bài cộng đồng nằm phía trên bảng bài viết.',
  'Filter by title, category, author or publication date.': 'Lọc theo tiêu đề, danh mục, tác giả hoặc ngày xuất bản.',
  'Problem groups are loaded directly from the database API.': 'Nhóm bài tập được tải trực tiếp từ API database.',
  'Filter by group id, name, slug or sort order.': 'Lọc theo ID nhóm, tên, slug hoặc thứ tự sắp xếp.',
  'Problem group controls stay at the top; grouped problem counts remain in the table below.': 'Điều khiển nhóm bài tập nằm phía trên; số lượng bài theo nhóm nằm trong bảng bên dưới.',
  'Filter by group name, group kind or number of problems.': 'Lọc theo tên nhóm, loại nhóm hoặc số lượng bài.',
  'Problem tags are loaded directly from the database API.': 'Nhãn bài tập được tải trực tiếp từ API database.',
  'Filter by tag id, name, slug or color.': 'Lọc theo ID nhãn, tên, slug hoặc màu.',
  'Tag maintenance actions stay first; tag usage counts stay in the table below.': 'Thao tác bảo trì nhãn nằm trước; số lần dùng nhãn nằm trong bảng bên dưới.',
  'Filter by tag name, slug or problem count.': 'Lọc theo tên nhãn, slug hoặc số bài.',
  'User accounts, roles, tiers and moderation state are loaded from the admin API.': 'Tài khoản, vai trò, gói thành viên và trạng thái kiểm duyệt được tải từ API quản trị.',
  'Filter by user id, username, email, role, tier or ban state.': 'Lọc theo ID người dùng, username, email, vai trò, gói hoặc trạng thái khóa.',
  'Filter controls stay above; the user table stays at the bottom with pagination on both ends.': 'Bộ lọc nằm phía trên; bảng người dùng nằm phía dưới với phân trang ở cả hai đầu.',
  'Filter by username, name, role, badge, rating or organization.': 'Lọc theo username, tên, vai trò, huy hiệu, xếp hạng hoặc tổ chức.',
  'Problem filters and queue indicators are first; the problem database table is last.': 'Bộ lọc bài tập và chỉ báo hàng đợi nằm trước; bảng database bài tập nằm cuối.',
  'Filter by title, code, source, tags or difficulty.': 'Lọc theo tiêu đề, mã, nguồn, nhãn hoặc độ khó.',
  'Live metrics, queue health and recent submissions in one management view.': 'Số liệu live, sức khỏe hàng đợi và bài nộp gần đây trong một màn hình quản trị.',
  'Submission filters are above the table; rows stay paginated at the bottom.': 'Bộ lọc bài nộp nằm phía trên; dữ liệu được phân trang phía dưới.',
  'Filter by submission id, problem, user, language or verdict.': 'Lọc theo ID bài nộp, bài tập, người dùng, ngôn ngữ hoặc kết quả.',
  'Contest status controls stay above the contest table.': 'Điều khiển trạng thái kỳ thi nằm phía trên bảng kỳ thi.',
  'Filter by title, status, scope or access type.': 'Lọc theo tiêu đề, trạng thái, phạm vi hoặc kiểu truy cập.',
  'Select a contest before loading and editing its database-backed attendance records.': 'Chọn một kỳ thi trước khi tải và chỉnh sửa dữ liệu điểm danh từ database.',
  'Filter by contest, attendance state, note or participant count.': 'Lọc theo kỳ thi, trạng thái điểm danh, ghi chú hoặc số người tham gia.',
  'Organization controls, billing/access signals and filters stay above the table.': 'Điều khiển tổ chức, tín hiệu thanh toán/truy cập và bộ lọc nằm phía trên bảng.',
  'Filter by name, slug, visibility or role.': 'Lọc theo tên, slug, hiển thị hoặc vai trò.',
  'Judge runtimes and enablement flags are loaded directly from the language registry API.': 'Runtime chấm bài và trạng thái bật/tắt được tải trực tiếp từ API registry ngôn ngữ.',
  'Filter by code, label, runtime, install state or enabled state.': 'Lọc theo mã, nhãn, runtime, trạng thái cài đặt hoặc trạng thái bật.',
  'Language availability for problem setup and submissions.': 'Tình trạng ngôn ngữ dùng cho cấu hình bài tập và nộp bài.',
  'Filter by code, label or runtime.': 'Lọc theo mã, nhãn hoặc runtime.',
  'Announcements and publication state are loaded directly from the admin API.': 'Thông báo và trạng thái xuất bản được tải trực tiếp từ API quản trị.',
  'Filter by id, title, status, category or author.': 'Lọc theo ID, tiêu đề, trạng thái, danh mục hoặc tác giả.',
  'Review signals are shown first; content rows stay at the bottom.': 'Tín hiệu duyệt hiển thị trước; dòng nội dung nằm phía dưới.',
  'Filter by title, category or author.': 'Lọc theo tiêu đề, danh mục hoặc tác giả.',
  'Quiz definitions are loaded directly from the admin quiz API.': 'Định nghĩa quizz được tải trực tiếp từ API quizz quản trị.',
  'Filter by quiz id, title, status or question count.': 'Lọc theo ID quizz, tiêu đề, trạng thái hoặc số câu hỏi.',
  'Quiz administration surface on CPPRO with database-backed navigation.': 'Màn hình quản trị quizz trên CPPRO với điều hướng từ database.',
  'Filter by HSG category, title or status.': 'Lọc theo danh mục HSG, tiêu đề hoặc trạng thái.',
  'Queue and judge indicators stay above the operational table.': 'Chỉ báo hàng đợi và máy chấm nằm phía trên bảng vận hành.',
  'Filter queue metric labels.': 'Lọc nhãn chỉ số hàng đợi.',
  'Support tickets are loaded directly from the database API.': 'Yêu cầu hỗ trợ được tải trực tiếp từ API database.',
  'Filter by ticket id, title, status, priority or requester.': 'Lọc theo ID ticket, tiêu đề, trạng thái, độ ưu tiên hoặc người gửi.',
  'Chat groups are loaded directly from the chat API.': 'Nhóm chat được tải trực tiếp từ API chat.',
  'Filter by group id, title, member count or message count.': 'Lọc theo ID nhóm, tiêu đề, số thành viên hoặc số tin nhắn.',
  'Problem comments are loaded directly from the moderation API.': 'Bình luận bài tập được tải trực tiếp từ API kiểm duyệt.',
  'Filter by comment id, body, author, problem or status.': 'Lọc theo ID bình luận, nội dung, tác giả, bài tập hoặc trạng thái.',
  'Badge definitions and assignment metadata are loaded from the badge API.': 'Định nghĩa huy hiệu và metadata gán huy hiệu được tải từ API huy hiệu.',
  'Filter by badge id, name, slug, tier or status.': 'Lọc theo ID huy hiệu, tên, slug, cấp hoặc trạng thái.',
  'Judge worker and cluster node data is loaded from the operations API.': 'Dữ liệu worker chấm và node cụm được tải từ API vận hành.',
  'Filter by node id, worker state, host or capacity.': 'Lọc theo ID node, trạng thái worker, host hoặc sức tải.',
  'Risk incidents are loaded directly from the moderation API.': 'Sự cố rủi ro được tải trực tiếp từ API kiểm duyệt.',
  'Filter by incident id, status, severity, user or submission.': 'Lọc theo ID sự cố, trạng thái, mức độ, người dùng hoặc bài nộp.',
  'Filter SMTP status, setting names, health or platform counters.': 'Lọc trạng thái SMTP, tên cài đặt, sức khỏe hoặc bộ đếm nền tảng.',
  'Audit logs are loaded directly from the audit API.': 'Nhật ký kiểm toán được tải trực tiếp từ API audit.',
  'Filter by actor, action, target, IP or request id.': 'Lọc theo người thực hiện, hành động, đối tượng, IP hoặc request id.',
};

const managementViTextExtra: Record<string, string> = {
  // Dashboard insights
  'Could not load dashboard insights.': 'Không thể tải thông tin bảng điều khiển.',
  'Workers': 'Worker',
  'Parallel slots': 'Slot song song',
  'Redis queue': 'Hàng đợi Redis',
  'Running': 'Đang chấm',
  'Retries': 'Lần thử lại',
  'Failed / dead letter': 'Lỗi / dead letter',
  'Oldest queued': 'Chờ lâu nhất',
  'Day': 'Ngày',
  'Week': 'Tuần',
  'Month': 'Tháng',
  'Year': 'Năm',
  'Judge capacity': 'Năng lực trình chấm',
  'Live judge and submission insights': 'Thông tin trình chấm và bài nộp thời gian thực',
  'Realtime data': 'Dữ liệu realtime',
  'Live metrics, queue health and submission trends.': 'Chỉ số trực tiếp, sức khỏe hàng đợi và xu hướng bài nộp.',
  'Submissions': 'Bài nộp',
  'Chart range': 'Khoảng biểu đồ',
  'Loading submission chart': 'Đang tải biểu đồ bài nộp',
  'No submissions in this range.': 'Không có bài nộp trong khoảng này.',
  'Needs attention': 'Cần chú ý',
  'No problems need attention.': 'Không có bài tập cần chú ý.',
  'Review required': 'Cần rà soát',
  'testcases': 'testcase',
  'Open': 'Mở',
  // Analytics
  'Could not load analytics.': 'Không thể tải phân tích.',
  'Users': 'Người dùng',
  'active': 'đang hoạt động',
  'Problems': 'Bài tập',
  'contests': 'kỳ thi',
  'last 24h': '24h qua',
  'Acceptance rate': 'Tỷ lệ chấp nhận',
  'accepted': 'được chấp nhận',
  'Analytics': 'Phân tích',
  'Reporting and platform trends': 'Báo cáo và xu hướng nền tảng',
  'Generated': 'Tạo lúc',
  'Distributions, daily trends and top performers.': 'Phân bố, xu hướng theo ngày và top nổi bật.',
  'days': 'ngày',
  'Export CSV': 'Xuất CSV',
  'Loading analytics': 'Đang tải phân tích',
  'Submissions per day': 'Bài nộp mỗi ngày',
  'New users per day': 'Người dùng mới mỗi ngày',
  'Verdict distribution': 'Phân bố kết quả',
  'Languages': 'Ngôn ngữ',
  'Problem types': 'Loại bài tập',
  'Most-attempted problems': 'Bài được nộp nhiều nhất',
  'submissions': 'bài nộp',
  'solvers': 'người giải',
  'Top solvers': 'Top người giải',
  'solved': 'đã giải',
  'No data yet.': 'Chưa có dữ liệu.',
  // Badge award
  'Award badge': 'Trao huy hiệu',
  'Assign badges to users': 'Gán huy hiệu cho người dùng',
  'users hold this badge.': 'người dùng đang có huy hiệu này.',
  'Badge': 'Huy hiệu',
  'Select badge...': 'Chọn huy hiệu...',
  'User': 'Người dùng',
  'Select user...': 'Chọn người dùng...',
  'Award': 'Trao',
  'Filter users': 'Lọc người dùng',
  'Filter by username, name or email...': 'Lọc theo tên đăng nhập, họ tên hoặc email...',
  'Award note (optional)': 'Ghi chú trao thưởng (tùy chọn)',
  'Reason or context for this award': 'Lý do hoặc bối cảnh trao thưởng',
  'No users have this badge yet.': 'Chưa có người dùng nào có huy hiệu này.',
  'Awarded user': 'Người được trao',
  'Remove': 'Gỡ',
  'Badge awarded.': 'Đã trao huy hiệu.',
  'Could not award badge.': 'Không thể trao huy hiệu.',
  'Badge removed.': 'Đã gỡ huy hiệu.',
  'Could not remove badge.': 'Không thể gỡ huy hiệu.',
  // Reason dialog
  'Write an evidence-backed reason for the audit record...': 'Ghi lý do có bằng chứng để lưu vào nhật ký audit...',
  'Confirm': 'Xác nhận',
  // User moderation
  'Ban account': 'Cấm tài khoản',
  'This reason is shown to the account owner when access is blocked.': 'Lý do này hiển thị cho chủ tài khoản khi bị chặn truy cập.',
  'Account banned.': 'Đã cấm tài khoản.',
  'Could not update account status.': 'Không thể cập nhật trạng thái tài khoản.',
  'Account unbanned.': 'Đã gỡ cấm tài khoản.',
  'View as user': 'Xem dưới quyền user',
  'This creates a short admin impersonation session and records an audit log entry.': 'Việc này tạo phiên impersonation ngắn hạn và ghi một audit log.',
  'Enter at least 6 characters for the audit reason.': 'Nhập ít nhất 6 ký tự cho lý do audit.',
  'Could not start impersonation.': 'Không thể bắt đầu impersonation.',
  'Account moderation': 'Kiểm duyệt tài khoản',
  'Ban and impersonation controls': 'Điều khiển cấm và impersonation',
  'Guided ban-with-reason and admin impersonation with audit logging.': 'Cấm kèm lý do và impersonation admin có ghi audit.',
  'Find account': 'Tìm tài khoản',
  'Filter by username, name, email or role...': 'Lọc theo tên đăng nhập, họ tên, email hoặc vai trò...',
  'Loading users': 'Đang tải người dùng',
  'No users match this filter.': 'Không có người dùng phù hợp bộ lọc.',
  'Banned': 'Bị cấm',
  'Impersonate': 'Xem như user',
  'Unban': 'Gỡ cấm',
  'Ban': 'Cấm',
  'Could not load users.': 'Không thể tải người dùng.',
  // Attendance
  'Could not load contests.': 'Không thể tải kỳ thi.',
  'Could not load attendance.': 'Không thể tải điểm danh.',
  'Attendance updated.': 'Đã cập nhật điểm danh.',
  'Could not update attendance.': 'Không thể cập nhật điểm danh.',
  'Attendance note': 'Ghi chú điểm danh',
  'Add an optional note for audit context.': 'Thêm ghi chú tùy chọn để lưu bối cảnh.',
  'Disqualification reason': 'Lý do loại',
  'This reason is stored with the contest action.': 'Lý do này được lưu cùng thao tác kỳ thi.',
  'Contestant disqualified.': 'Đã loại thí sinh.',
  'Could not update contest status.': 'Không thể cập nhật trạng thái kỳ thi.',
  'Disqualification cleared.': 'Đã gỡ loại.',
  'Contest attendance': 'Điểm danh kỳ thi',
  'Mark attendance and disqualifications': 'Điểm danh và xử lý loại thí sinh',
  'contestants loaded.': 'thí sinh đã tải.',
  'Contest': 'Kỳ thi',
  'Select contest': 'Chọn kỳ thi',
  'Find contestant': 'Tìm thí sinh',
  'Select a contest to manage attendance.': 'Chọn một kỳ thi để quản lý điểm danh.',
  'Loading attendance': 'Đang tải điểm danh',
  'No matching contestants found.': 'Không tìm thấy thí sinh phù hợp.',
  'Disqualified': 'Bị loại',
  'Unchecked': 'Chưa điểm danh',
  'Present': 'Có mặt',
  'Late': 'Đi trễ',
  'Absent': 'Vắng',
  'Excused': 'Có phép',
  'All': 'Tất cả',
  'Clear': 'Gỡ',
  'Disqualify': 'Loại',
  // Incident review
  'Could not load incident reviews.': 'Không thể tải danh sách sự cố.',
  'Could not load incident evidence.': 'Không thể tải bằng chứng sự cố.',
  'Risk signals recalculated.': 'Đã tính lại tín hiệu rủi ro.',
  'Could not recalculate risk signals.': 'Không thể tính lại tín hiệu rủi ro.',
  'Write the evidence-backed reason for this decision. The note is stored with the review record.': 'Ghi lý do có bằng chứng cho quyết định này. Ghi chú được lưu cùng bản ghi rà soát.',
  'Incident marked': 'Đã đánh dấu sự cố',
  'Could not update incident review.': 'Không thể cập nhật rà soát sự cố.',
  'Trust and safety': 'An toàn & tin cậy',
  'Submission incident review': 'Rà soát sự cố bài nộp',
  'Risk signals are review hints only. Confirm evidence manually before taking action.': 'Tín hiệu rủi ro chỉ là gợi ý rà soát. Hãy xác nhận bằng chứng thủ công trước khi hành động.',
  'All statuses': 'Tất cả trạng thái',
  'Reviewing': 'Đang rà soát',
  'Cleared': 'Đã bỏ qua',
  'Confirmed': 'Đã xác nhận',
  'Min risk': 'Rủi ro tối thiểu',
  'Any risk score': 'Mọi điểm rủi ro',
  'Search': 'Tìm kiếm',
  'Search user, problem or submission ID': 'Tìm người dùng, bài tập hoặc ID bài nộp',
  'Loading incident reviews': 'Đang tải danh sách sự cố',
  'No incidents match the current filters.': 'Không có sự cố phù hợp bộ lọc.',
  'Submission': 'Bài nộp',
  'Risk': 'Rủi ro',
  'signals': 'tín hiệu',
  'Review': 'Rà soát',
  'Incident review': 'Rà soát sự cố',
  'Review evidence, record a decision, then apply contest action when justified.': 'Rà soát bằng chứng, ghi quyết định, rồi áp dụng hành động kỳ thi khi hợp lý.',
  'Loading evidence': 'Đang tải bằng chứng',
  'Risk score': 'Điểm rủi ro',
  'IP': 'IP',
  'Paste events': 'Lượt dán',
  'Focus events': 'Lượt focus',
  'Editor seconds': 'Giây soạn thảo',
  'Pasted chars': 'Ký tự dán',
  'Risk signals': 'Tín hiệu rủi ro',
  'No current signals.': 'Không có tín hiệu hiện tại.',
  'Submission source': 'Mã nguồn bài nộp',
  'Open full submission': 'Mở bài nộp đầy đủ',
  'Recalculate': 'Tính lại',
  'Mark reviewing': 'Đánh dấu đang rà soát',
  'Clear incident': 'Bỏ qua sự cố',
  'Confirm incident': 'Xác nhận sự cố',
  'Also disqualify this user from the linked contest when confirming.': 'Đồng thời loại người dùng khỏi kỳ thi liên kết khi xác nhận.',
  'Incident': 'Sự cố',
  // Impersonation banner
  'You are viewing the platform as another user.': 'Bạn đang xem nền tảng dưới danh nghĩa người dùng khác.',
  'Return to admin': 'Quay lại admin',
};

const managementViTextExtra2: Record<string, string> = {
  // Platform operations (settings)
  'Could not load platform settings.': 'Không thể tải cấu hình nền tảng.',
  'Platform operations': 'Vận hành nền tảng',
  'Security, judge, backup and system controls': 'Điều khiển bảo mật, trình chấm, sao lưu và hệ thống',
  'Advanced platform settings stored in the database settings table.': 'Cấu hình nâng cao lưu trong bảng settings của database.',
  'Loading platform settings': 'Đang tải cấu hình nền tảng',
  'Judge concurrency': 'Số trình chấm song song',
  'Parallel judges (1-64)': 'Số chấm song song (1-64)',
  'Judge concurrency updated.': 'Đã cập nhật số trình chấm song song.',
  'Failed to update judge concurrency.': 'Không thể cập nhật số trình chấm.',
  'Malware scan': 'Quét mã độc',
  'On': 'Bật',
  'Off': 'Tắt',
  'Body limit': 'Giới hạn body',
  'Package ZIP limit': 'Giới hạn ZIP gói',
  'Cloudflare Turnstile': 'Cloudflare Turnstile',
  'Enable Turnstile challenge': 'Bật thử thách Turnstile',
  'Site key': 'Site key',
  'Secret key': 'Secret key',
  'Leave blank to keep current secret': 'Để trống để giữ secret hiện tại',
  'Clear saved secret': 'Xóa secret đã lưu',
  'Save Turnstile': 'Lưu Turnstile',
  'Turnstile settings saved.': 'Đã lưu cấu hình Turnstile.',
  'Could not save Turnstile settings.': 'Không thể lưu cấu hình Turnstile.',
  'OAuth': 'OAuth',
  'Enable sign-in with': 'Bật đăng nhập bằng',
  'Client ID': 'Client ID',
  'Client secret': 'Client secret',
  'Allow new signups': 'Cho phép đăng ký mới',
  'OAuth provider saved.': 'Đã lưu nhà cung cấp OAuth.',
  'Could not save OAuth provider.': 'Không thể lưu nhà cung cấp OAuth.',
  'Database backups': 'Sao lưu database',
  'Backup health': 'Sức khỏe sao lưu',
  'Healthy': 'Tốt',
  'Degraded': 'Suy giảm',
  'Unavailable': 'Không khả dụng',
  'Retention (days)': 'Lưu giữ (ngày)',
  'Interval (s)': 'Chu kỳ (giây)',
  'Last state': 'Trạng thái gần nhất',
  'Run backup now': 'Sao lưu ngay',
  'Queuing...': 'Đang xếp hàng...',
  'No backups recorded.': 'Chưa có bản sao lưu nào.',
  'Verified': 'Đã kiểm chứng',
  'Unverified': 'Chưa kiểm chứng',
  'Backup queued.': 'Đã xếp hàng sao lưu.',
  'Could not queue a backup.': 'Không thể xếp hàng sao lưu.',
  'System update': 'Cập nhật hệ thống',
  'Configured update command available.': 'Đã cấu hình lệnh cập nhật.',
  'No system update command is configured.': 'Chưa cấu hình lệnh cập nhật hệ thống.',
  'Ready': 'Sẵn sàng',
  'Locked': 'Đã khóa',
  'Run system update': 'Chạy cập nhật hệ thống',
  'Last': 'Gần nhất',
  'System update queued.': 'Đã xếp hàng cập nhật hệ thống.',
  'Could not queue the system update.': 'Không thể xếp hàng cập nhật hệ thống.',
  'Run the platform system update now?': 'Chạy cập nhật hệ thống nền tảng ngay?',
  'Save': 'Lưu',
  'Saving...': 'Đang lưu...',
  'Refresh': 'Làm mới',
  // Audit trail
  'Could not load audit logs.': 'Không thể tải nhật ký hoạt động.',
  'Audit trail': 'Nhật ký hoạt động',
  'Administration and moderation history': 'Lịch sử quản trị và kiểm duyệt',
  'events': 'sự kiện',
  'actors': 'người thực hiện',
  'Search logs': 'Tìm nhật ký',
  'Actor, event, target...': 'Người thực hiện, sự kiện, mục tiêu...',
  'Loading audit logs': 'Đang tải nhật ký hoạt động',
  'No audit logs match the current filter.': 'Không có nhật ký phù hợp bộ lọc hiện tại.',
  'System': 'Hệ thống',
};

function managementText(locale: CpproLocale, value: string | undefined): string {
  const text = String(value || '');
  if (locale !== 'vi' || !text) return text;
  if (managementViText[text]) return managementViText[text];
  if (managementViTextExtra[text]) return managementViTextExtra[text];
  if (managementViTextExtra2[text]) return managementViTextExtra2[text];
  if (text.startsWith('Queue health:')) return text.replace('Queue health:', 'Sức khỏe hàng đợi:');
  if (text.startsWith('No ') && text.endsWith(' database rows are available. Use the module actions above for this workflow.')) {
    const moduleName = text.slice('No '.length, -' database rows are available. Use the module actions above for this workflow.'.length);
    return `Chưa có dòng database ${managementText(locale, moduleName).toLowerCase()}. Hãy dùng thao tác module phía trên cho quy trình này.`;
  }
  if (text.startsWith('No ') && text.endsWith(' rows match this filter.')) {
    const moduleName = text.slice('No '.length, -' rows match this filter.'.length);
    return `Không có dòng ${managementText(locale, moduleName).toLowerCase()} phù hợp bộ lọc này.`;
  }
  if (text.startsWith('No ') && text.endsWith(' match this filter.')) {
    const moduleName = text.slice('No '.length, -' match this filter.'.length);
    return `Không có ${managementText(locale, moduleName).toLowerCase()} phù hợp bộ lọc này.`;
  }
  if (text.startsWith('Loading ') && text.endsWith(' from database')) {
    const moduleName = text.slice('Loading '.length, -' from database'.length);
    return `Đang tải ${managementText(locale, moduleName).toLowerCase()} từ database`;
  }
  if (text.endsWith(' table')) return `${managementText(locale, text.slice(0, -6))} ${managementViText.table}`;
  if (text.endsWith(' rows after filter')) {
    return text.replace('rows after filter', managementViText['rows after filter']);
  }
  return text;
}

function localizeManagementDataset<T>(dataset: ManagementDataset<T>, locale: CpproLocale): ManagementDataset<T> {
  if (locale !== 'vi') return dataset;
  return {
    ...dataset,
    title: managementText(locale, dataset.title),
    subtitle: managementText(locale, dataset.subtitle),
    filterLabel: managementText(locale, dataset.filterLabel),
    queueLabel: managementText(locale, dataset.queueLabel),
    empty: managementText(locale, dataset.empty),
    cards: dataset.cards.map((card) => ({
      ...card,
      label: managementText(locale, card.label),
      meta: managementText(locale, card.meta),
    })),
    columns: dataset.columns.map((column) => ({
      ...column,
      label: managementText(locale, column.label),
    })),
  };
}

function managementCellText(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  try {
    const text = JSON.stringify(value);
    return text.length > 160 ? `${text.slice(0, 157)}...` : text;
  } catch {
    return String(value);
  }
}

function managementDatasetForSection(
  section: ManagementSectionKey,
  data: CpproData,
  remoteRows: Array<Record<string, unknown>> = [],
  go?: (path: string) => void,
): ManagementDataset<any> {
  const queuePressure = Number(data.stats.queuePressure ?? data.stats.queue_pressure ?? 0) || 0;
  const queueDepth = Number(data.stats.queueDepth ?? data.stats.queue_depth ?? 0) || 0;
  const queueLimit = Number(data.stats.queueLimit ?? data.stats.queue_limit ?? 20000) || 20000;
  const queueLabel = `Queue health: ${queueDepth.toLocaleString('vi-VN')} / ${queueLimit.toLocaleString('vi-VN')} (${queuePressure.toFixed(1)}%)`;
  const baseCards: ManagementCard[] = [
    { label: 'Problems', value: Number(data.stats.problems || data.problems.length).toLocaleString('vi-VN'), meta: 'database rows', icon: <Code2 size={18} /> },
    { label: 'Submissions', value: Number(data.stats.submissions || data.submissions.length).toLocaleString('vi-VN'), meta: 'judge history', icon: <Send size={18} /> },
    { label: 'Users', value: Number(data.stats.users || data.users.length).toLocaleString('vi-VN'), meta: 'accounts', icon: <UsersRound size={18} /> },
    { label: 'Acceptance', value: `${Number(data.stats.acceptanceRate ?? data.stats.acceptance_rate ?? 0).toFixed(1)}%`, meta: 'overall', icon: <CheckCircle2 size={18} /> },
    { label: 'Online users', value: Number(data.stats.onlineUsers || 0).toLocaleString('vi-VN'), meta: 'last 5 minutes', icon: <UsersRound size={18} /> },
    { label: 'System health', value: `${Number(data.stats.workersOnline ?? 0).toLocaleString('vi-VN')} workers`, meta: queueLabel, icon: <Terminal size={18} /> },
    { label: 'Visits', value: Number(data.stats.visits || data.stats.pageViews || 0).toLocaleString('vi-VN'), meta: 'traffic counter', icon: <Eye size={18} /> },
  ];
  const endpointDataset = (title: string, subtitle: string, filterLabel: string): ManagementDataset<any> => ({
    title,
    subtitle,
    filterLabel,
    queueLabel,
    cards: baseCards,
    rows: [],
    empty: `No ${title.toLowerCase()} database rows are available. Use the module actions above for this workflow.`,
    searchText: (row: { capability: string; endpoint: string; method: string; status: string }) => `${row.capability} ${row.endpoint} ${row.method} ${row.status}`,
    columns: [
      { key: 'capability', label: 'Capability', render: (row: { capability: string }) => <strong>{row.capability}</strong> },
      { key: 'method', label: 'Method', render: (row: { method: string }) => <span className="management-status">{row.method}</span> },
      { key: 'endpoint', label: 'API endpoint', render: (row: { endpoint: string }) => <code>{row.endpoint}</code> },
      { key: 'status', label: 'Status', render: (row: { status: string }) => <span className={row.status === 'Ready' ? 'management-status management-status-published' : 'management-status management-status-warning'}>{row.status}</span> },
    ],
  });
  const remoteDataset = (title: string, subtitle: string, filterLabel: string): ManagementDataset<any> => {
    if (!remoteRows.length) return endpointDataset(title, subtitle, filterLabel);
    const preferredKeys = [
      'id', 'name', 'title', 'username', 'email', 'code', 'slug', 'status', 'role',
      'priority', 'enabled', 'installed', 'member_count', 'problem_count', 'created_at', 'updated_at',
    ];
    const availableKeys = Array.from(new Set(remoteRows.slice(0, 30).flatMap((row) => Object.keys(row))));
    const keys = [
      ...preferredKeys.filter((key) => availableKeys.includes(key)),
      ...availableKeys.filter((key) => !preferredKeys.includes(key)),
    ].slice(0, 7);
    return {
      title,
      subtitle,
      filterLabel,
      queueLabel,
      sourceEndpoint: managementPrimaryReadEndpoint(section),
      cards: baseCards,
      rows: remoteRows,
      empty: `No ${title.toLowerCase()} rows match this filter.`,
      searchText: (row: Record<string, unknown>) => Object.values(row).map(managementCellText).join(' '),
      columns: keys.map((key, index) => ({
        key,
        label: key.replace(/_/g, ' '),
        render: (row: Record<string, unknown>) => {
          const text = managementCellText(row[key]);
          if (key === 'status' || key === 'role' || key === 'priority') return <span className="management-status">{text}</span>;
          if (index === 0) return <strong>{text}</strong>;
          if (key === 'code' || key === 'slug' || key.endsWith('_id')) return <code>{text}</code>;
          return text;
        },
      })),
    };
  };
  if (section === 'analytics') {
    const rows = [
      { metric: 'Problems', value: Number(data.stats.problems || data.problems.length), source: 'problems', period: 'All time' },
      { metric: 'Submissions', value: Number(data.stats.submissions || data.submissions.length), source: 'submissions', period: 'All time' },
      { metric: 'Users', value: Number(data.stats.users || data.users.length), source: 'users', period: 'All time' },
      { metric: 'Acceptance rate', value: `${Number(data.stats.acceptanceRate ?? data.stats.acceptance_rate ?? 0).toFixed(1)}%`, source: 'submissions', period: 'All time' },
      { metric: 'Judge queue depth', value: queueDepth, source: 'judge_jobs', period: 'Realtime' },
      { metric: 'Judge queue pressure', value: `${queuePressure.toFixed(1)}%`, source: 'judge registry', period: 'Realtime' },
    ];
    return {
      title: 'Analytics',
      subtitle: 'Database totals and realtime judge signals are presented before the analytics table.',
      filterLabel: 'Filter by metric, source table or period.',
      queueLabel,
      cards: baseCards,
      rows,
      empty: 'No analytics metrics match this filter.',
      searchText: (row: { metric: string; value: unknown; source: string; period: string }) => `${row.metric} ${row.value} ${row.source} ${row.period}`,
      columns: [
        { key: 'metric', label: 'Metric', render: (row: { metric: string }) => <strong>{row.metric}</strong> },
        { key: 'value', label: 'Value', align: 'right', render: (row: { value: unknown }) => String(row.value) },
        { key: 'source', label: 'Database source', render: (row: { source: string }) => <code>{row.source}</code> },
        { key: 'period', label: 'Period', render: (row: { period: string }) => <span className="management-status">{row.period}</span> },
      ],
    };
  }
  if (section === 'posts') {
    if (remoteRows.length) {
      return remoteDataset('Posts', 'Community post moderation data is loaded directly from the admin API.', 'Filter by post id, title, status, category or author.');
    }
    return {
      title: 'Posts',
      subtitle: 'Community post moderation and publication controls stay above the post table.',
      filterLabel: 'Filter by title, category, author or publication date.',
      queueLabel,
      cards: baseCards,
      rows: data.posts,
      empty: 'No community posts match this filter.',
      searchText: (row: HomePost) => `${row.title} ${row.category} ${row.user?.username || ''} ${row.user?.fullName || ''} ${row.date}`,
      columns: [
        { key: 'title', label: 'Title', render: (row: HomePost) => <strong>{row.title}</strong> },
        { key: 'category', label: 'Category', render: (row: HomePost) => row.category },
        { key: 'author', label: 'Author', render: (row: HomePost) => row.user?.fullName || row.user?.username || row.author || 'System' },
        { key: 'comments', label: 'Comments', align: 'right', render: (row: HomePost) => Number(row.comments || 0).toLocaleString('vi-VN') },
        { key: 'date', label: 'Date', render: (row: HomePost) => row.date },
      ],
    };
  }
  if (section === 'problem-groups') {
    if (remoteRows.length) {
      return remoteDataset('Problem groups', 'Problem groups are loaded directly from the database API.', 'Filter by group id, name, slug or sort order.');
    }
    const grouped = new Map<string, { name: string; kind: string; problemCount: number; score: number }>();
    data.problems.forEach((problem) => {
      const name = problem.source || problem.difficulty || 'Uncategorized';
      const current = grouped.get(name) || { name, kind: problem.source ? 'Source' : 'Difficulty', problemCount: 0, score: 0 };
      current.problemCount += 1;
      current.score += Number(problem.score || 0);
      grouped.set(name, current);
    });
    const rows = Array.from(grouped.values());
    return {
      title: 'Problem groups',
      subtitle: 'Problem group controls stay at the top; grouped problem counts remain in the table below.',
      filterLabel: 'Filter by group name, group kind or number of problems.',
      queueLabel,
      cards: baseCards,
      rows,
      empty: 'No problem groups match this filter.',
      searchText: (row: { name: string; kind: string; problemCount: number; score: number }) => `${row.name} ${row.kind} ${row.problemCount} ${row.score}`,
      columns: [
        { key: 'name', label: 'Group', render: (row: { name: string }) => <strong>{row.name}</strong> },
        { key: 'kind', label: 'Kind', render: (row: { kind: string }) => <span className="management-status">{row.kind}</span> },
        { key: 'problems', label: 'Problems', align: 'right', render: (row: { problemCount: number }) => row.problemCount.toLocaleString('vi-VN') },
        { key: 'score', label: 'Total score', align: 'right', render: (row: { score: number }) => row.score.toLocaleString('vi-VN') },
      ],
    };
  }
  if (section === 'tags') {
    if (remoteRows.length) {
      return remoteDataset('Problem tags', 'Problem tags are loaded directly from the database API.', 'Filter by tag id, name, slug or color.');
    }
    const tagMap = new Map<string, { id: number; name: string; slug: string; problemCount: number }>();
    data.tags.forEach((tag) => tagMap.set(tag.slug, { ...tag, problemCount: 0 }));
    data.problems.forEach((problem) => problem.tags.forEach((tag) => {
      const current = tagMap.get(tag.slug) || { ...tag, problemCount: 0 };
      current.problemCount += 1;
      tagMap.set(tag.slug, current);
    }));
    const rows = Array.from(tagMap.values());
    return {
      title: 'Problem tags',
      subtitle: 'Tag maintenance actions stay first; tag usage counts stay in the table below.',
      filterLabel: 'Filter by tag name, slug or problem count.',
      queueLabel,
      cards: baseCards,
      rows,
      empty: 'No problem tags match this filter.',
      searchText: (row: { name: string; slug: string; problemCount: number }) => `${row.name} ${row.slug} ${row.problemCount}`,
      columns: [
        { key: 'name', label: 'Tag', render: (row: { name: string }) => <strong>{row.name}</strong> },
        { key: 'slug', label: 'Slug', render: (row: { slug: string }) => <code>{row.slug}</code> },
        { key: 'problems', label: 'Problems', align: 'right', render: (row: { problemCount: number }) => row.problemCount.toLocaleString('vi-VN') },
      ],
    };
  }
  if (section === 'users') {
    if (remoteRows.length) {
      return remoteDataset('Users', 'User accounts, roles, tiers and moderation state are loaded from the admin API.', 'Filter by user id, username, email, role, tier or ban state.');
    }
    return {
      title: 'Users',
      subtitle: 'Filter controls stay above; the user table stays at the bottom with pagination on both ends.',
      filterLabel: 'Filter by username, name, role, badge, rating or organization.',
      queueLabel,
      cards: baseCards,
      rows: data.users,
      empty: 'No users match this filter.',
      searchText: (row: UserRow) => `${row.username} ${row.fullName} ${row.rankName} ${row.tags.join(' ')} ${row.organizationName || ''}`,
      columns: [
        { key: 'username', label: 'User', render: (row: UserRow) => (
          <strong data-management-user-identity>
            @{row.username}
            <small>{row.fullName}</small>
            <UserBadges user={row} />
          </strong>
        ) },
        { key: 'rating', label: 'Rating', align: 'right', render: (row: UserRow) => Number(row.rating || 0).toLocaleString('vi-VN') },
        { key: 'solved', label: 'Solved', align: 'right', render: (row: UserRow) => Number(row.solved || 0).toLocaleString('vi-VN') },
        { key: 'streak', label: 'Streak', align: 'right', render: (row: UserRow) => row.streak ? <span className="management-status management-status-warning"><Flame size={12} />{row.streak}</span> : '0' },
        { key: 'tier', label: 'Role/Tier', render: (row: UserRow) => <span className="management-status">{row.tags.filter(Boolean).join(', ') || row.rankName}</span> },
      ],
    };
  }
  if (section === 'problems') {
    return {
      title: 'Problems',
      subtitle: 'Problem filters and queue indicators are first; the problem database table is last.',
      filterLabel: 'Filter by title, code, source, tags or difficulty.',
      queueLabel,
      cards: baseCards,
      rows: data.problems,
      empty: 'No problems match this filter.',
      searchText: (row: Problem) => `${row.code} ${row.slug} ${row.title} ${row.source} ${row.difficulty} ${row.tags.map((tag) => tag.name).join(' ')}`,
      columns: [
        { key: 'code', label: 'Code', render: (row: Problem) => row.code || row.slug },
        { key: 'title', label: 'Title', render: (row: Problem) => <strong>{row.title}</strong> },
        { key: 'difficulty', label: 'Difficulty', render: (row: Problem) => row.difficulty },
        { key: 'score', label: 'Score', align: 'right', render: (row: Problem) => Number(row.score || 0).toLocaleString('vi-VN') },
        { key: 'accepted', label: 'AC/Sub', align: 'right', render: (row: Problem) => `${row.accepted}/${row.submissions}` },
        { key: 'source', label: 'Source', render: (row: Problem) => row.source || 'Online Judge' },
      ],
    };
  }
  if (section === 'submissions' || section === 'dashboard') {
    const submissionRows = section === 'submissions' && remoteRows.length
      ? remoteRows.map(mapBackendSubmission)
      : data.submissions;
    return {
      title: section === 'dashboard' ? 'Dashboard' : 'Submissions',
      subtitle: section === 'dashboard' ? 'Live metrics, queue health and recent submissions in one management view.' : 'Submission filters are above the table; rows stay paginated at the bottom.',
      filterLabel: 'Filter by submission id, problem, user, language or verdict.',
      queueLabel,
      sourceEndpoint: section === 'submissions' && remoteRows.length ? managementPrimaryReadEndpoint(section) : undefined,
      cards: baseCards,
      rows: submissionRows,
      empty: 'No submissions match this filter.',
      searchText: (row: Submission) => `${row.id} ${row.problemTitle} ${row.problemSlug} ${row.username} ${row.language} ${row.verdict}`,
      columns: [
        { key: 'id', label: 'ID', render: (row: Submission) => {
          const href = `/submissions/${encodeURIComponent(String(row.id))}`;
          return (
            <a className="management-submission-id-link" href={href} onClick={(event) => go ? openInternalLink(event, go, href) : undefined}>
              <strong>#{row.id}</strong>
              <Eye size={13} />
            </a>
          );
        } },
        { key: 'problem', label: 'Problem', render: (row: Submission) => row.problemTitle },
        { key: 'user', label: 'User', render: (row: Submission) => row.username },
        { key: 'language', label: 'Language', render: (row: Submission) => row.language },
        { key: 'verdict', label: 'Verdict', render: (row: Submission) => <span className={`badge ${verdictClass(row.verdict)}`}>{row.verdict}</span> },
        { key: 'score', label: 'Score', align: 'right', render: (row: Submission) => `${row.score}/${row.maxScore}` },
      ],
    };
  }
  if (section === 'contests') {
    return {
      title: 'Contests',
      subtitle: 'Contest status controls stay above the contest table.',
      filterLabel: 'Filter by title, status, scope or access type.',
      queueLabel,
      cards: baseCards,
      rows: data.contests,
      empty: 'No contests match this filter.',
      searchText: (row: Contest) => `${row.slug} ${row.title} ${row.status} ${row.scope || ''} ${row.accessType || ''}`,
      columns: [
        { key: 'title', label: 'Contest', render: (row: Contest) => <strong>{row.title}</strong> },
        { key: 'status', label: 'Status', render: (row: Contest) => <span className="management-status">{row.status}</span> },
        { key: 'format', label: 'Format', render: (row: Contest) => <span className="management-contest-format">{row.formatLabel || row.format || 'Default'}</span> },
        { key: 'freeze', label: 'Freeze', render: (row: Contest) => row.freezeMinutes
          ? <span className="management-contest-freeze" data-active={row.frozen ? 'true' : 'false'}><Snowflake size={13} />{row.freezeMinutes} min</span>
          : <span className="management-muted-value">Off</span> },
        { key: 'participants', label: 'Users', align: 'right', render: (row: Contest) => Number(row.participants || 0).toLocaleString('vi-VN') },
        { key: 'problems', label: 'Problems', align: 'right', render: (row: Contest) => Number(row.problemCount || 0).toLocaleString('vi-VN') },
        { key: 'time', label: 'Time', render: (row: Contest) => formatRange(row.startTime, row.endTime) },
      ],
    };
  }
  if (section === 'attendance') {
    const rows = data.contests.map((contest) => ({
      id: contest.id,
      contest: contest.title,
      slug: contest.slug,
      participants: contest.participants,
      attendance: contest.myAttendance?.status || 'Not loaded',
      checkedAt: contest.myAttendance?.checked_at || '',
      note: contest.myAttendance?.note || '',
    }));
    return {
      title: 'Attendance',
      subtitle: 'Select a contest before loading and editing its database-backed attendance records.',
      filterLabel: 'Filter by contest, attendance state, note or participant count.',
      queueLabel,
      cards: baseCards,
      rows,
      empty: 'No contest attendance rows match this filter.',
      searchText: (row: { contest: string; slug: string; attendance: string; note: string }) => `${row.contest} ${row.slug} ${row.attendance} ${row.note}`,
      columns: [
        { key: 'contest', label: 'Contest', render: (row: { contest: string; slug: string }) => <strong>{row.contest}<small>/{row.slug}</small></strong> },
        { key: 'participants', label: 'Participants', align: 'right', render: (row: { participants: number }) => Number(row.participants || 0).toLocaleString('vi-VN') },
        { key: 'attendance', label: 'Attendance', render: (row: { attendance: string }) => <span className="management-status">{row.attendance}</span> },
        { key: 'checked', label: 'Checked at', render: (row: { checkedAt: string }) => row.checkedAt || '-' },
        { key: 'note', label: 'Note', render: (row: { note: string }) => row.note || '-' },
      ],
    };
  }
  if (section === 'organizations') {
    return {
      title: 'Organizations',
      subtitle: 'Organization controls, billing/access signals and filters stay above the table.',
      filterLabel: 'Filter by name, slug, visibility or role.',
      queueLabel,
      cards: baseCards,
      rows: data.organizations,
      empty: 'No organizations match this filter.',
      searchText: (row: OrganizationRow) => `${row.name} ${row.slug} ${row.visibility} ${row.myRole || ''}`,
      columns: [
        { key: 'name', label: 'Organization', render: (row: OrganizationRow) => <strong>{row.name}<small>/{row.slug}</small></strong> },
        { key: 'visibility', label: 'Visibility', render: (row: OrganizationRow) => <span className="management-status">{row.visibility}</span> },
        { key: 'members', label: 'Members', align: 'right', render: (row: OrganizationRow) => row.memberCount.toLocaleString('vi-VN') },
        { key: 'problems', label: 'Problems', align: 'right', render: (row: OrganizationRow) => row.problemCount.toLocaleString('vi-VN') },
        { key: 'contests', label: 'Contests', align: 'right', render: (row: OrganizationRow) => row.contestCount.toLocaleString('vi-VN') },
      ],
    };
  }
  if (section === 'languages') {
    if (remoteRows.length) {
      return remoteDataset('Judge languages', 'Judge runtimes and enablement flags are loaded directly from the language registry API.', 'Filter by code, label, runtime, install state or enabled state.');
    }
    return {
      title: 'Judge languages',
      subtitle: 'Language availability for problem setup and submissions.',
      filterLabel: 'Filter by code, label or runtime.',
      queueLabel,
      cards: baseCards,
      rows: data.judgeLanguages,
      empty: 'No judge languages match this filter.',
      searchText: (row: JudgeLanguage) => `${row.code} ${row.label} ${row.runtimeLabel || ''}`,
      columns: [
        { key: 'code', label: 'Code', render: (row: JudgeLanguage) => <strong>{row.code}</strong> },
        { key: 'label', label: 'Label', render: (row: JudgeLanguage) => row.label },
        { key: 'runtime', label: 'Runtime', render: (row: JudgeLanguage) => row.runtimeLabel || '-' },
        { key: 'ext', label: 'Extension', render: (row: JudgeLanguage) => row.extension || '-' },
      ],
    };
  }
  if (section === 'announcements') {
    if (remoteRows.length) {
      return remoteDataset('Announcements', 'Announcements and publication state are loaded directly from the admin API.', 'Filter by id, title, status, category or author.');
    }
    const rows = data.notifications.length ? data.notifications : data.posts;
    return {
      title: 'Announcements',
      subtitle: 'Review signals are shown first; content rows stay at the bottom.',
      filterLabel: 'Filter by title, category or author.',
      queueLabel,
      cards: baseCards,
      rows,
      empty: 'No posts match this filter.',
      searchText: (row: HomePost) => `${row.title} ${row.category} ${row.user?.username || ''} ${row.user?.fullName || ''}`,
      columns: [
        { key: 'title', label: 'Title', render: (row: HomePost) => <strong>{row.title}</strong> },
        { key: 'category', label: 'Category', render: (row: HomePost) => row.category },
        { key: 'author', label: 'Author', render: (row: HomePost) => row.user?.fullName || row.user?.username || 'System' },
        { key: 'date', label: 'Date', render: (row: HomePost) => row.date },
        { key: 'votes', label: 'Votes', align: 'right', render: (row: HomePost) => Number(row.reactions || 0).toLocaleString('vi-VN') },
      ],
    };
  }
  if (section === 'quizzes') {
    if (remoteRows.length) {
      return remoteDataset('Quizzes', 'Quiz definitions are loaded directly from the admin quiz API.', 'Filter by quiz id, title, status or question count.');
    }
    return {
      title: 'Quiz',
      subtitle: 'Quiz administration surface on CPPRO with database-backed navigation.',
      filterLabel: 'Filter by HSG category, title or status.',
      queueLabel,
      cards: baseCards,
      rows: data.exams,
      empty: 'No quiz/HSG rows match this filter.',
      searchText: (row: HsgExam) => `${row.title} ${row.contest_slug} ${row.year} ${row.status}`,
      columns: [
        { key: 'code', label: 'Contest', render: (row: HsgExam) => row.contest_slug || `#${row.id}` },
        { key: 'title', label: 'Title', render: (row: HsgExam) => <strong>{row.title}</strong> },
        { key: 'year', label: 'Year', align: 'right', render: (row: HsgExam) => row.year },
        { key: 'status', label: 'Status', render: (row: HsgExam) => row.status },
        { key: 'problems', label: 'Problems', align: 'right', render: (row: HsgExam) => row.total_problems },
      ],
    };
  }
  if (section === 'queue') {
    const rows = [
      { label: 'Queue depth', value: queueDepth, status: queueDepth > queueLimit * 0.8 ? 'warning' : 'ok' },
      { label: 'Queue limit', value: queueLimit, status: 'ok' },
      { label: 'Queue pressure', value: `${queuePressure.toFixed(1)}%`, status: queuePressure > 80 ? 'warning' : 'ok' },
      { label: 'Judge languages', value: data.judgeLanguages.length, status: 'ok' },
    ];
    return {
      title: 'Queue health',
      subtitle: 'Queue and judge indicators stay above the operational table.',
      filterLabel: 'Filter queue metric labels.',
      queueLabel,
      cards: baseCards,
      rows,
      empty: 'No queue metrics match this filter.',
      searchText: (row: { label: string; value: unknown; status: string }) => `${row.label} ${row.value} ${row.status}`,
      columns: [
        { key: 'metric', label: 'Metric', render: (row: { label: string }) => <strong>{row.label}</strong> },
        { key: 'value', label: 'Value', align: 'right', render: (row: { value: unknown }) => String(row.value) },
        { key: 'status', label: 'Status', render: (row: { status: string }) => <span className={row.status === 'warning' ? 'management-status management-status-warning' : 'management-status management-status-published'}>{row.status}</span> },
      ],
    };
  }
  if (section === 'tickets') {
    return remoteDataset('Support tickets', 'Support tickets are loaded directly from the database API.', 'Filter by ticket id, title, status, priority or requester.');
  }
  if (section === 'chat') {
    return remoteDataset('Chat groups', 'Chat groups are loaded directly from the database API.', 'Filter by group id, name, owner or member count.');
  }
  if (section === 'comments') {
    return remoteDataset('Comments', 'Problem comments are loaded directly from the moderation API.', 'Filter by comment id, author, problem or content.');
  }
  if (section === 'badges') {
    return remoteDataset('Badges', 'Badge definitions and assignment metadata are loaded from the badge API.', 'Filter by badge id, name, slug, tier or status.');
  }
  if (section === 'cluster') {
    return remoteDataset('Cluster', 'Judge worker and cluster node data is loaded from the operations API.', 'Filter by node id, worker state, host or capacity.');
  }
  if (section === 'incidents') {
    return remoteDataset('Incidents', 'Risk incidents are loaded directly from the moderation API.', 'Filter by incident id, status, severity, user or submission.');
  }
  if (section === 'smtp') {
    const smtpRows = remoteRows.length
      ? remoteRows.filter((row) => ['smtp', 'security', 'counts', 'backup', 'systemUpdate', 'response'].includes(String(row.group || '')))
      : [
        { group: 'smtp', metric: 'status', value: 'Load SMTP settings to inspect configured host, sender and test status.' },
        { group: 'smtp', metric: 'save', value: 'Use the Save SMTP settings action after editing platform settings.' },
        { group: 'smtp', metric: 'test', value: 'Use Test SMTP connection to validate credentials without sending account mail.' },
      ];
    return {
      title: 'SMTP server',
      subtitle: 'SMTP configuration, health and connection tests stay in one administration module.',
      filterLabel: 'Filter SMTP status, setting names, health or platform counters.',
      queueLabel,
      sourceEndpoint: managementPrimaryReadEndpoint(section),
      cards: baseCards,
      rows: smtpRows,
      empty: 'Load SMTP settings to inspect the current mail configuration.',
      searchText: (row: Record<string, unknown>) => Object.values(row).map(managementCellText).join(' '),
      columns: [
        { key: 'group', label: 'Group', render: (row: Record<string, unknown>) => <span className="management-status">{managementCellText(row.group)}</span> },
        { key: 'metric', label: 'Setting', render: (row: Record<string, unknown>) => <strong>{managementCellText(row.metric ?? row.name ?? row.key)}</strong> },
        { key: 'value', label: 'Value / status', render: (row: Record<string, unknown>) => managementCellText(row.value ?? row.status ?? row.enabled ?? row.configured) },
      ],
    };
  }
  if (section === 'audit-logs') {
    return remoteDataset('Audit logs', 'Administrator activity is loaded directly from the audit database endpoint.', 'Filter by actor, action, resource, IP address or time.');
  }
  const settingsRows = [
    { key: 'Brand name', value: data.contact.brandName, kind: 'text', field: 'name' },
    { key: 'Domain', value: data.contact.domainName, kind: 'text', field: 'domain' },
    { key: 'Frontend URL', value: data.platformFrontendUrl || '', kind: 'text', field: 'frontendUrl' },
    { key: 'Logo URL', value: data.contact.logoUrl || '', kind: 'text', field: 'logoUrl' },
    { key: 'Favicon URL', value: '', kind: 'text', field: 'faviconUrl' },
    { key: 'Social image URL', value: '', kind: 'text', field: 'ogImageUrl' },
    { key: 'Footer copyright', value: data.contact.copyrightText || '', kind: 'text', field: 'footerCopyright' },
    { key: 'Maximum testcase details', value: '', kind: 'number', field: 'maxTestcasesShown' },
    { key: 'Enabled topbar links', value: Object.entries(data.topbarFeatures).filter(([, enabled]) => enabled).map(([key]) => key).join(', '), kind: 'topbar-features', field: 'topbarFeatures' },
  ];
  return {
    title: 'Settings',
    subtitle: 'Brand, domain, logo and topbar feature settings visible in one CPPRO management table.',
    filterLabel: 'Filter setting name or value.',
    queueLabel,
    cards: baseCards,
    rows: settingsRows,
    empty: 'No settings match this filter.',
    searchText: (row: { key: string; value: string; kind: string; field: string }) => `${row.key} ${row.value} ${row.kind} ${row.field}`,
    columns: [
      { key: 'key', label: 'Setting', render: (row: { key: string }) => <strong>{row.key}</strong> },
      { key: 'value', label: 'Value', render: (row: { value: string }) => row.value || '-' },
    ],
  };
}

function CpproManagementPage({
  section,
  data,
  go,
  currentUser,
}: {
  section: string;
  data: CpproData;
  go: (path: string) => void;
  currentUser: StoredCpproUser | null;
}) {
  const isAdmin = isCpproAdminUser(currentUser);
  const managementLocale = parseCpproPath(window.location.pathname).locale || readStoredLocale();
  const sectionKey = normalizeManagementSection(section);
  const subpageRoute = managementSubpageForPath(section);
  const subpageMeta = subpageRoute ? managementSubpageMeta(subpageRoute) : null;
  const [settings, setSettings] = useState<CpproRatingSettings>(defaultCpproRatingSettings);
  const [draft, setDraft] = useState<CpproRatingSettings>(defaultCpproRatingSettings);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(sectionKey === 'rating');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [contestRows, setContestRows] = useState<Array<Record<string, unknown>>>([]);
  const [userRows, setUserRows] = useState<Array<Record<string, unknown>>>([]);
  const [managementUsers, setManagementUsers] = useState<UserRow[]>([]);
  const [siteSettings, setSiteSettings] = useState<ManagementSiteSettings>(() => managementSiteSettingsFromPayload(null, data));
  const [siteSettingsDirty, setSiteSettingsDirty] = useState(false);
  const [siteSettingsSaving, setSiteSettingsSaving] = useState(false);
  const [managementRemoteRows, setManagementRemoteRows] = useState<Array<Record<string, unknown>>>([]);
  const [managementRemoteLoading, setManagementRemoteLoading] = useState(false);
  const [managementDashboard, setManagementDashboard] = useState<ManagementDashboardSnapshot | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!isAdmin || sectionKey !== 'rating') return;
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all(isLcojBackendMode() ? [
      cpproApiFetch<CpproRatingSettings>('/admin/management/rating'),
      cpproApiFetch<unknown>('/admin/management/contests'),
      cpproApiFetch<{ rows?: Array<Record<string, unknown>> }>('/admin/management/users'),
    ] : [
      cpproApiFetch<CpproRatingSettings>('/admin/settings/rating'),
      cpproApiFetch<unknown>('/admin/contest-ratings?limit=80'),
      cpproApiFetch<{ rows?: Array<Record<string, unknown>> }>('/admin/users?page=1&limit=200&withCount=true'),
    ])
      .then(([nextSettings, contests, users]) => {
        if (cancelled) return;
        const normalized = normalizeCpproRatingSettings(nextSettings);
        setSettings(normalized);
        setDraft(normalized);
        setDirty(false);
        setContestRows(rowsFromApi<Record<string, unknown>>(contests));
        setUserRows(Array.isArray(users?.rows) ? users.rows : []);
      })
      .catch((nextError) => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : 'Could not load rating settings.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isAdmin, sectionKey]);

  useEffect(() => {
    if (!isAdmin || sectionKey !== 'users') return;
    let cancelled = false;
    cpproApiFetch<unknown>(isLcojBackendMode() ? '/admin/management/users' : '/admin/users?page=1&limit=200&withCount=true')
      .then((payload) => {
        if (cancelled) return;
        const rawRows = rowsFromApi<Record<string, unknown>>(payload);
        setManagementRemoteRows(rawRows);
        setManagementUsers(rawRows.map((row) => mapBackendUser(row, data.ratingSettings)));
      })
      .catch((nextError) => {
        if (!cancelled) {
          setManagementUsers([]);
          setToast({ tone: 'error', text: nextError instanceof Error ? nextError.message : 'Could not load admin users.' });
        }
      });
    return () => { cancelled = true; };
  }, [data.ratingSettings, isAdmin, sectionKey]);

  useEffect(() => {
    if (!isAdmin || sectionKey !== 'settings') return;
    let cancelled = false;
    cpproApiFetch<unknown>('/admin/platform-settings')
      .then((payload) => {
        if (cancelled) return;
        setSiteSettings(managementSiteSettingsFromPayload(payload, data));
        setSiteSettingsDirty(false);
      })
      .catch((nextError) => {
        if (!cancelled) {
          setToast({ tone: 'error', text: nextError instanceof Error ? nextError.message : 'Could not load platform settings.' });
        }
      });
    return () => { cancelled = true; };
  }, [data, isAdmin, sectionKey]);

  useEffect(() => {
    if (!isAdmin || sectionKey === 'rating' || sectionKey === 'settings' || sectionKey === 'users') {
      setManagementRemoteRows([]);
      setManagementRemoteLoading(false);
      setManagementDashboard(null);
      return;
    }
    const endpoint = managementPrimaryReadEndpoint(sectionKey);
    if (!endpoint) {
      setManagementRemoteRows([]);
      setManagementRemoteLoading(false);
      setManagementDashboard(null);
      return;
    }
    let cancelled = false;
    setManagementRemoteLoading(true);
    setManagementRemoteRows([]);
    cpproApiFetch<unknown>(endpoint)
      .then((payload) => {
        if (cancelled) return;
        if (sectionKey === 'dashboard') {
          const snapshot = managementDashboardSnapshotFromPayload(payload);
          setManagementDashboard(snapshot);
          setManagementRemoteRows(snapshot?.recentRows || []);
          return;
        }
        setManagementDashboard(null);
        setManagementRemoteRows(managementRowsFromPayload(payload));
      })
      .catch((nextError) => {
        if (!cancelled) {
          setManagementDashboard(null);
          setManagementRemoteRows([]);
          setToast({ tone: 'error', text: nextError instanceof Error ? nextError.message : `Could not load ${sectionKey}.` });
        }
      })
      .finally(() => {
        if (!cancelled) setManagementRemoteLoading(false);
      });
    return () => { cancelled = true; };
  }, [isAdmin, sectionKey]);

  const patchDraft = (patch: Partial<CpproRatingSettings>) => {
    setDraft((current) => normalizeCpproRatingSettings({ ...current, ...patch }, { sortBands: false }));
    setDirty(true);
    setError('');
  };
  const updateBand = (index: number, patch: Partial<CpproRatingBand>) => {
    patchDraft({ bands: draft.bands.map((band, bandIndex) => bandIndex === index ? { ...band, ...patch } : band) });
  };
  const addBand = () => {
    const last = draft.bands[draft.bands.length - 1];
    patchDraft({ bands: [...draft.bands, { min: Math.min((last?.min || 0) + 200, 5000), name: 'New band', color: 'primary' }] });
  };
  const save = async () => {
    if (saving || !isAdmin) return;
    setSaving(true);
    setError('');
    try {
      const saved = await cpproApiFetch<CpproRatingSettings>('/admin/settings/rating', {
        method: 'PUT',
        body: JSON.stringify(normalizeCpproRatingSettings(draft)),
      });
      const normalized = normalizeCpproRatingSettings(saved);
      setSettings(normalized);
      setDraft(normalized);
      setDirty(false);
      setToast({ tone: 'success', text: 'Rating settings saved.' });
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : 'Could not save rating settings.';
      setError(message);
      setToast({ tone: 'error', text: message });
    } finally {
      setSaving(false);
    }
  };
  const toggleTopbarFeature = (key: TopbarFeatureKey) => {
    setSiteSettings((current) => ({
      ...current,
      topbarFeatures: {
        ...current.topbarFeatures,
        [key]: !current.topbarFeatures[key],
      },
    }));
    setSiteSettingsDirty(true);
  };
  const patchSiteSettings = (patch: Partial<ManagementSiteSettings>) => {
    setSiteSettings((current) => ({ ...current, ...patch }));
    setSiteSettingsDirty(true);
  };
  const saveSiteSettings = async () => {
    if (!isAdmin || siteSettingsSaving) return;
    setSiteSettingsSaving(true);
    try {
      const saved = await cpproApiFetch<unknown>('/admin/platform-settings/site', {
        method: 'PUT',
        body: JSON.stringify(siteSettings),
      });
      const normalized = managementSiteSettingsFromPayload(saved, {
        ...data,
        contact: {
          ...data.contact,
          brandName: siteSettings.name,
          domainName: siteSettings.domain,
          logoUrl: siteSettings.logoUrl,
          copyrightText: siteSettings.footerCopyright,
        },
        topbarFeatures: siteSettings.topbarFeatures,
      });
      setSiteSettings(normalized);
      setSiteSettingsDirty(false);
      window.dispatchEvent(new CustomEvent('ctoj-site-settings-changed', { detail: normalized }));
      setToast({ tone: 'success', text: 'Topbar and site settings saved.' });
    } catch (nextError) {
      setToast({ tone: 'error', text: nextError instanceof Error ? nextError.message : 'Could not save site settings.' });
    } finally {
      setSiteSettingsSaving(false);
    }
  };
  const invokeManagementAction = async (action: ManagementAction) => {
    const method = action.method || 'GET';
    if (method !== 'GET') {
      setToast({ tone: 'info', text: `${action.label}: use the row Edit action or the module form (${method} ${action.endpoint}).` });
      return;
    }
    if (action.endpoint.includes(':')) {
      setToast({ tone: 'info', text: `${action.label}: select a table row first.` });
      return;
    }
    try {
      const payload = await cpproApiFetch<unknown>(action.endpoint);
      if (sectionKey === 'dashboard' && action.endpoint.startsWith('/admin/dashboard')) {
        const snapshot = managementDashboardSnapshotFromPayload(payload);
        setManagementDashboard(snapshot);
        setManagementRemoteRows(snapshot?.recentRows || []);
      } else if (sectionKey === 'users') {
        const rows = rowsFromApi<Record<string, unknown>>(payload);
        setManagementRemoteRows(rows);
        setManagementUsers(rows.map((row) => mapBackendUser(row, data.ratingSettings)));
      } else if (sectionKey === 'settings') {
        setSiteSettings(managementSiteSettingsFromPayload(payload, data));
        setSiteSettingsDirty(false);
      } else {
        setManagementDashboard(null);
        setManagementRemoteRows(managementRowsFromPayload(payload));
      }
      const rows = rowsFromApi<Record<string, unknown>>(payload);
      const count = rows.length || (payload && typeof payload === 'object' ? Object.keys(payload as Record<string, unknown>).length : 0);
      setToast({ tone: 'success', text: `${managementText(managementLocale, action.label)}${count ? ` (${count.toLocaleString('vi-VN')} records/fields)` : ''}.` });
    } catch (nextError) {
      setToast({ tone: 'error', text: nextError instanceof Error ? nextError.message : `${action.label} failed.` });
    }
  };
  const handleManagementAction = (action: ManagementAction) => {
    if ((action.method || 'GET') !== 'GET') {
      if (action.endpoint === '/problems') {
        go('/management/problems/new');
        return;
      }
      if (sectionKey === 'contests' && action.endpoint === '/contests') {
        go('/management/contests/new');
        return;
      }
      if (sectionKey === 'organizations' && action.endpoint === '/admin/organizations') {
        go('/management/organizations/new');
        return;
      }
      if (sectionKey === 'quizzes' && action.endpoint === '/admin/quizzes') {
        go('/management/quizzes/new');
        return;
      }
      if (sectionKey === 'quizzes' && action.endpoint === '/admin/quiz/questions') {
        go('/management/quiz/questions');
        return;
      }
    }
    void invokeManagementAction(action);
  };
  const saveManagementRow = async (
    targetSection: ManagementSectionKey,
    row: Record<string, unknown>,
    draftRow: Record<string, unknown>,
  ) => {
    let endpoint = '';
    let method: 'PUT' | 'PATCH' = 'PATCH';
    let body: Record<string, unknown> = {};
    if ((targetSection === 'announcements' || targetSection === 'posts') && row.id) {
      endpoint = `/posts/${encodeURIComponent(String(row.id))}`;
      method = 'PUT';
      body = {
        title: String(draftRow.title || row.title || '').trim(),
        excerpt: String(draftRow.excerpt ?? row.excerpt ?? '').trim() || null,
        content: String(draftRow.content || row.content || '').trim(),
        imageUrl: String(draftRow.imageUrl ?? draftRow.image_url ?? row.image_url ?? row.imageUrl ?? '').trim() || null,
        postType: String(draftRow.postType || draftRow.post_type || row.post_type || row.postType || (targetSection === 'announcements' ? 'announcement' : 'blog')),
        turnstileToken: '',
      };
    } else if (targetSection === 'problems' && (row.id || row.slug || row.code)) {
      const difficulty = String(draftRow.difficulty || row.difficulty || 'Easy').toLowerCase();
      const normalizedDifficulty = difficulty === 'hard' ? 'Hard' : difficulty === 'medium' ? 'Medium' : 'Easy';
      const rawTags = draftRow.tags ?? row.tags ?? [];
      const tagNames = Array.isArray(rawTags)
        ? rawTags.map((tag) => typeof tag === 'string' ? tag : String((tag as Record<string, unknown>)?.name || '')).filter(Boolean)
        : String(rawTags || '').split(',').map((tag) => tag.trim()).filter(Boolean);
      endpoint = `/problems/${encodeURIComponent(String(row.id || row.slug || row.code))}`;
      method = 'PUT';
      body = {
        externalId: String(draftRow.code || draftRow.external_id || row.code || '').trim() || undefined,
        title: String(draftRow.title || row.title || '').trim(),
        description: String(draftRow.statement || draftRow.description || row.statement || row.description || row.title || '').trim(),
        difficulty: normalizedDifficulty,
        rating: Math.max(0.1, Math.min(5, Number(draftRow.score ?? draftRow.rating ?? row.score ?? row.rating ?? 1) || 1)),
        timeLimit: Number(draftRow.timeLimitMs ?? draftRow.time_limit ?? row.timeLimitMs ?? row.time_limit ?? 1000) || 1000,
        memoryLimit: Number(draftRow.memoryLimitMb ?? draftRow.memory_limit ?? row.memoryLimitMb ?? row.memory_limit ?? 256) || 256,
        visibility: String(draftRow.visibility || row.visibility || 'public'),
        tags: tagNames,
        allowedLanguages: Array.isArray(draftRow.allowedLanguages || row.allowedLanguages)
          ? (draftRow.allowedLanguages || row.allowedLanguages) as string[]
          : undefined,
        turnstileToken: '',
      };
    } else if (targetSection === 'problem-groups' && row.id) {
      endpoint = `/problem-groups/${encodeURIComponent(String(row.id))}`;
      body = {
        name: String(draftRow.name || row.name || '').trim(),
        description: String(draftRow.description || row.description || ''),
        sortOrder: Number(draftRow.sortOrder ?? draftRow.sort_order ?? row.sortOrder ?? row.sort_order ?? 100),
      };
    } else if (targetSection === 'tags' && row.id) {
      endpoint = `/tags/${encodeURIComponent(String(row.id))}`;
      method = 'PUT';
      body = {
        name: String(draftRow.name || row.name || '').trim(),
        color: String(draftRow.color || row.color || '#f26f21'),
      };
    } else if (targetSection === 'languages' && row.code) {
      endpoint = `/languages/${encodeURIComponent(String(row.code))}`;
      body = {
        ...(typeof draftRow.enabled === 'boolean' ? { enabled: draftRow.enabled } : {}),
        ...(String(draftRow.label || '').trim() ? { label: String(draftRow.label).trim() } : {}),
        ...(Object.prototype.hasOwnProperty.call(draftRow, 'runtimeLabel') || Object.prototype.hasOwnProperty.call(draftRow, 'runtime_label')
          ? { runtimeLabel: draftRow.runtimeLabel ?? draftRow.runtime_label ?? null }
          : {}),
        ...(Number.isFinite(Number(draftRow.sortOrder ?? draftRow.sort_order))
          ? { sortOrder: Number(draftRow.sortOrder ?? draftRow.sort_order) }
          : {}),
      };
    } else if (targetSection === 'users' && row.id) {
      endpoint = `/admin/users/${encodeURIComponent(String(row.id))}`;
      body = {
        ...(draftRow.role ? { role: String(draftRow.role) } : {}),
        ...(typeof draftRow.is_teacher === 'boolean' || typeof draftRow.isTeacher === 'boolean'
          ? { isTeacher: Boolean(draftRow.isTeacher ?? draftRow.is_teacher) }
          : {}),
        ...(draftRow.membership_tier || draftRow.membershipTier
          ? { membershipTier: String(draftRow.membershipTier || draftRow.membership_tier) }
          : {}),
        ...(typeof draftRow.is_banned === 'boolean' || typeof draftRow.isBanned === 'boolean'
          ? { isBanned: Boolean(draftRow.isBanned ?? draftRow.is_banned) }
          : {}),
        ...(draftRow.ban_reason || draftRow.banReason
          ? { banReason: String(draftRow.banReason || draftRow.ban_reason) }
          : {}),
      };
    } else if (targetSection === 'contests' && row.id) {
      endpoint = `/contests/${encodeURIComponent(String(row.id))}`;
      body = {
        title: String(draftRow.title || row.title || '').trim(),
        description: String(draftRow.description || row.description || ''),
        status: String(draftRow.status || row.status || 'draft'),
      };
    } else if (targetSection === 'organizations' && row.id) {
      endpoint = `/organizations/${encodeURIComponent(String(row.id))}`;
      body = {
        name: String(draftRow.name || row.name || '').trim(),
        slug: String(draftRow.slug || row.slug || '').trim(),
        description: String(draftRow.description || row.description || ''),
        visibility: String(draftRow.visibility || row.visibility || 'private'),
      };
    } else if (targetSection === 'tickets' && row.id) {
      endpoint = `/tickets/${encodeURIComponent(String(row.id))}`;
      body = {
        ...(draftRow.status ? { status: String(draftRow.status) } : {}),
        ...(draftRow.priority ? { priority: String(draftRow.priority) } : {}),
        ...(Object.prototype.hasOwnProperty.call(draftRow, 'response') ? { response: String(draftRow.response || '') } : {}),
      };
    } else if (targetSection === 'badges' && row.id) {
      endpoint = `/admin/badges/${encodeURIComponent(String(row.id))}`;
      method = 'PUT';
      body = {
        name: String(draftRow.name || row.name || '').trim(),
        slug: String(draftRow.slug || row.slug || '').trim(),
        description: String(draftRow.description || row.description || ''),
        iconUrl: String(draftRow.iconUrl || draftRow.icon_url || row.icon_url || ''),
        color: String(draftRow.color || row.color || '#f59e0b'),
        backgroundColor: String(draftRow.backgroundColor || draftRow.background_color || row.background_color || ''),
        active: Boolean(draftRow.active ?? row.active ?? true),
        sortOrder: Number(draftRow.sortOrder ?? draftRow.sort_order ?? row.sort_order ?? 100),
      };
    } else if (targetSection === 'incidents' && row.id) {
      endpoint = `/admin/incidents/${encodeURIComponent(String(row.id))}`;
      body = {
        status: String(draftRow.status || row.status || 'reviewing'),
        note: String(draftRow.note || row.note || 'Reviewed from CPPRO management.'),
        disqualify: Boolean(draftRow.disqualify || false),
      };
    } else {
      setToast({ tone: 'info', text: `This ${targetSection} row is review-only in the compact table. Use its module action for the full workflow.` });
      return false;
    }
    try {
      await cpproApiFetch(endpoint, {
        method,
        body: JSON.stringify(body),
      });
      if ((targetSection === 'announcements' || targetSection === 'posts') && row.id && (draftRow.status || row.status)) {
        await cpproApiFetch(`/admin/posts/${encodeURIComponent(String(row.id))}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: String(draftRow.status || row.status || 'draft') }),
        });
      }
      setToast({ tone: 'success', text: `${targetSection} row updated.` });
      return true;
    } catch (nextError) {
      setToast({ tone: 'error', text: nextError instanceof Error ? nextError.message : `Could not update ${targetSection}.` });
      return false;
    }
  };
  const deleteManagementRow = async (targetSection: ManagementSectionKey, row: Record<string, unknown>) => {
    const rowId = row.id ?? row.external_id ?? row.externalId ?? row.code ?? row.slug;
    let endpoint = '';
    if ((targetSection === 'announcements' || targetSection === 'posts') && row.id) {
      endpoint = `/posts/${encodeURIComponent(String(row.id))}`;
    } else if (targetSection === 'problems' && rowId) {
      endpoint = `/problems/${encodeURIComponent(String(rowId))}`;
    } else if (targetSection === 'problem-groups' && row.id) {
      endpoint = `/problem-groups/${encodeURIComponent(String(row.id))}`;
    } else if (targetSection === 'tags' && row.id) {
      endpoint = `/tags/${encodeURIComponent(String(row.id))}`;
    } else if (targetSection === 'users' && row.id) {
      endpoint = `/admin/users/${encodeURIComponent(String(row.id))}`;
    } else if (targetSection === 'contests' && rowId) {
      endpoint = `/contests/${encodeURIComponent(String(rowId))}`;
    } else if (targetSection === 'chat' && row.id) {
      endpoint = `/admin/chat-groups/${encodeURIComponent(String(row.id))}`;
    } else if (targetSection === 'quizzes' && row.id) {
      endpoint = `/admin/quizzes/${encodeURIComponent(String(row.id))}`;
    } else if (targetSection === 'badges' && row.id) {
      endpoint = `/admin/badges/${encodeURIComponent(String(row.id))}`;
    } else if (targetSection === 'comments' && row.id && (row.problem_id || row.problemId)) {
      endpoint = `/problems/${encodeURIComponent(String(row.problem_id ?? row.problemId))}/comments/${encodeURIComponent(String(row.id))}`;
    }
    if (!endpoint) {
      setToast({ tone: 'info', text: managementText(managementLocale, 'This module does not expose a delete API yet.') });
      return false;
    }
    try {
      await cpproApiFetch(endpoint, { method: 'DELETE' });
      const key = String(row.id ?? row.code ?? row.slug ?? '');
      setManagementRemoteRows((current) => current.filter((item) => String(item.id ?? item.code ?? item.slug ?? '') !== key));
      if (targetSection === 'users') {
        setManagementUsers((current) => current.filter((item) => String(item.id ?? item.username) !== key));
      }
      setToast({ tone: 'success', text: managementText(managementLocale, 'Row deleted.') });
      return true;
    } catch (nextError) {
      setToast({ tone: 'error', text: nextError instanceof Error ? nextError.message : managementText(managementLocale, 'Could not delete this row.') });
      return false;
    }
  };

  const topRatedUser = useMemo(() => (
    [...userRows].sort((left, right) => estimateCpproRating(right) - estimateCpproRating(left))[0]
  ), [userRows]);
  const managementData = useMemo(() => {
    let nextData = data;
    if (sectionKey === 'dashboard' && managementDashboard) {
      const counts = managementDashboard.counts;
      const judge = managementDashboard.judge;
      const queueDepth = Number(judge.queueDepth ?? 0) || 0;
      const queueLimit = Number(judge.queueLimit ?? 20000) || 20000;
      const queuePressure = Number(
        judge.queueUtilizationPercent
          ?? (queueLimit > 0 ? (queueDepth / queueLimit) * 100 : 0),
      ) || 0;
      nextData = {
        ...nextData,
        stats: {
          ...nextData.stats,
          problems: Number(counts.problems ?? nextData.stats.problems ?? 0) || 0,
          users: Number(counts.users ?? nextData.stats.users ?? 0) || 0,
          activeUsers: Number(counts.activeUsers ?? counts.active_users ?? 0) || 0,
          submissions: Number(counts.submissions ?? nextData.stats.submissions ?? 0) || 0,
          submissionsToday: Number(counts.submissionsToday ?? counts.submissions_today ?? 0) || 0,
          acceptanceRate: Number(counts.acceptanceRate ?? 0) || 0,
          queueDepth,
          queueLimit,
          queuePressure,
          workersOnline: Number(judge.workersOnline ?? judge.workers_online ?? 0) || 0,
          judgeConcurrency: Number(judge.concurrency ?? 0) || 0,
          judgeRunning: Number(judge.running ?? 0) || 0,
          judgeFailed: Number(judge.failed ?? 0) || 0,
          judgeDeadLetter: Number(judge.deadLetter ?? judge.dead_letter ?? 0) || 0,
        },
        submissions: managementDashboard.recentRows.map(mapBackendSubmission),
      };
    }
    if (sectionKey === 'users' && managementUsers.length > 0) {
      nextData = {
        ...nextData,
        stats: {
          ...nextData.stats,
          users: Math.max(Number(nextData.stats.users || 0), managementUsers.length),
        },
        users: managementUsers,
      };
    }
    if (sectionKey === 'settings') {
      nextData = {
        ...nextData,
        contact: {
          ...nextData.contact,
          brandName: siteSettings.name,
          domainName: siteSettings.domain,
          logoUrl: siteSettings.logoUrl,
          copyrightText: siteSettings.footerCopyright,
        },
        topbarFeatures: siteSettings.topbarFeatures,
      };
    }
    return nextData;
  }, [data, managementDashboard, managementUsers, sectionKey, siteSettings]);
  const dataset = useMemo(
    () => managementDatasetForSection(sectionKey, managementData, managementRemoteRows, go),
    [sectionKey, managementData, managementRemoteRows, go],
  );
  const localizedDataset = useMemo(
    () => localizeManagementDataset(dataset, managementLocale),
    [dataset, managementLocale],
  );
  const ratedContests = contestRows.filter((contest) => Boolean(contest.is_rated));
  const pendingContests = ratedContests.filter((contest) => !(contest.rating_calculated_at || contest.last_rated_at));

  if (!isAdmin) {
    return (
      <div className="cppro-management-shell" data-cppro-management-area="new-frontend">
        <section className="cppro-management-auth">
          <ShieldCheck size={34} />
          <h1>{managementText(managementLocale, 'Administrator access required')}</h1>
          <p>{managementText(managementLocale, 'This CPPRO management area stays on port 18082 and uses a separate UI from the legacy admin frontend.')}</p>
          <button type="button" className="blue-button" onClick={() => go(authPathWithReturn('login'))}>{managementText(managementLocale, 'Login')}</button>
        </section>
      </div>
    );
  }

  return (
    <div className="cppro-management-shell" data-cppro-management-area="new-frontend">
      {toast ? <div className="cppro-management-toast" data-tone={toast.tone}><CheckCircle2 size={17} />{toast.text}</div> : null}
      <aside className="cppro-management-sidebar">
        <span className="home-chip"><ShieldCheck size={14} />{managementText(managementLocale, 'CPPRO Admin')}</span>
        <h1>{managementText(managementLocale, 'Management')}</h1>
        {managementNavItems.map(({ key, label, icon }) => (
          <button
            key={key}
            className={sectionKey === key ? 'active' : ''}
            type="button"
            data-management-nav-key={key}
            onClick={() => go(key === 'dashboard' ? '/management' : `/management/${key}`)}
          >
            {icon}<span>{managementText(managementLocale, label)}</span>
          </button>
        ))}
      </aside>
      <main className="cppro-management-main">
        <PageTitle
          icon={subpageRoute ? <PenLine /> : sectionKey === 'rating' ? <Trophy /> : <ShieldCheck />}
          title={managementText(managementLocale, subpageMeta?.title || (sectionKey === 'rating' ? 'Rating console' : localizedDataset.title))}
          subtitle={managementText(managementLocale, subpageMeta?.subtitle || (sectionKey === 'rating' ? 'Rating settings stay native inside CPPRO management on port 18082.' : localizedDataset.subtitle))}
          right={subpageRoute
            ? <button className="soft-button" type="button" onClick={() => go(subpageMeta?.section === 'dashboard' ? '/management' : `/management/${subpageMeta?.section}`)}><ArrowRight size={15} />{managementText(managementLocale, 'Back to list')}</button>
            : <button className="soft-button" type="button" onClick={() => setToast({ tone: 'info', text: managementText(managementLocale, 'CPPRO management UI is active.') })}>{managementText(managementLocale, 'Status')}</button>}
        />
        {subpageRoute ? (
          <ManagementSubpage route={subpageRoute} data={managementData} go={go} currentUser={currentUser} onToast={setToast} />
        ) : sectionKey !== 'rating' ? (
          <ManagementDataPanel
            dataset={localizedDataset}
            section={sectionKey}
            locale={managementLocale}
            go={go}
            currentUser={currentUser}
            settingsControl={sectionKey === 'settings' ? {
              value: siteSettings,
              dirty: siteSettingsDirty,
              saving: siteSettingsSaving,
              onPatch: patchSiteSettings,
              onToggle: toggleTopbarFeature,
              onSave: () => void saveSiteSettings(),
            } : undefined}
            onAction={handleManagementAction}
            onOpenRow={(row) => {
              const rowId = row.id ?? row.external_id ?? row.externalId;
              if (!rowId) return false;
              if (sectionKey === 'problems') {
                go(`/management/problems/${encodeURIComponent(String(rowId))}`);
                return true;
              }
              if (sectionKey === 'contests') {
                go(`/management/contests/${encodeURIComponent(String(rowId))}`);
                return true;
              }
              if (sectionKey === 'submissions' || sectionKey === 'dashboard') {
                go(`/submissions/${encodeURIComponent(String(rowId))}`);
                return true;
              }
              return false;
            }}
            onSaveRow={(row, draftRow) => saveManagementRow(sectionKey, row, draftRow)}
            onDeleteRow={(row) => deleteManagementRow(sectionKey, row)}
            loading={managementRemoteLoading}
          />
        ) : (
          <section className="cppro-rating-console">
            {error ? <div className="service-message">{error}</div> : null}
            <div className="cppro-rating-metrics">
              <article><strong>{ratedContests.length}</strong><small>Rated contests</small></article>
              <article><strong>{pendingContests.length}</strong><small>Pending jobs</small></article>
              <article><strong>{topRatedUser ? estimateCpproRating(topRatedUser).toLocaleString('vi-VN') : '0'}</strong><small>Top rating</small></article>
            </div>
            <div className="cppro-rating-card">
              <header>
                <div>
                  <h2>Rating settings</h2>
                  <p>Editing keeps the current row order; bands are sorted only after Save.</p>
                </div>
                <span data-dirty={dirty ? 'true' : 'false'}>{dirty ? 'Unsaved' : settings.enabled ? 'Enabled' : 'Saved'}</span>
              </header>
              {loading ? (
                <DataLoadingPanel label="Loading rating settings" rows={4} compact />
              ) : (
                <>
                  <label className="cppro-rating-switch">
                    <span><strong>Enable rating system</strong><small>Allow contests to use rated mode.</small></span>
                    <input type="checkbox" checked={draft.enabled} onChange={(event) => patchDraft({ enabled: event.currentTarget.checked })} />
                  </label>
                  <div className="cppro-rating-fields">
                    {[
                      ['Base rating', 'base_rating'],
                      ['Provisional K', 'k_provisional'],
                      ['Stable K', 'k_stable'],
                      ['Provisional threshold', 'provisional_threshold'],
                    ].map(([label, key]) => (
                      <label key={key}>
                        <span>{label}</span>
                        <input
                          type="number"
                          min={key === 'base_rating' || key === 'provisional_threshold' ? 0 : 1}
                          value={Number(draft[key as keyof CpproRatingSettings])}
                          onChange={(event) => patchDraft({ [key]: Number(event.currentTarget.value || 0) } as Partial<CpproRatingSettings>)}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="cppro-rating-bands">
                    {draft.bands.map((band, index) => (
                      <div className="cppro-rating-band-row" key={`${band.name}-${index}`} data-tone={band.color}>
                        <span><b>{band.min}</b><small>{band.name}</small></span>
                        <label><small>Minimum</small><input type="number" min={0} value={band.min} onChange={(event) => updateBand(index, { min: Number(event.currentTarget.value || 0) })} /></label>
                        <label><small>Name</small><input value={band.name} onChange={(event) => updateBand(index, { name: event.currentTarget.value })} /></label>
                        <label><small>Color</small><select value={band.color} onChange={(event) => updateBand(index, { color: event.currentTarget.value as CpproRatingBand['color'] })}>{cpproRatingColors.map((color) => <option key={color} value={color}>{color}</option>)}</select></label>
                        <button type="button" disabled={draft.bands.length <= 1} onClick={() => patchDraft({ bands: draft.bands.filter((_, bandIndex) => bandIndex !== index) })}>Remove</button>
                      </div>
                    ))}
                  </div>
                  <footer>
                    <button className="soft-button" type="button" onClick={addBand}>+ Add band</button>
                    <button className="blue-button" type="button" disabled={!dirty || saving} onClick={() => void save()}>{saving ? 'Saving...' : 'Save'}</button>
                  </footer>
                </>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

const managementInlineEditableSections = new Set<ManagementSectionKey>([
  'announcements',
  'posts',
  'problems',
  'problem-groups',
  'tags',
  'languages',
  'users',
  'contests',
  'organizations',
  'tickets',
  'badges',
  'incidents',
]);

type ManagementCreateField = {
  key: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'textarea' | 'select' | 'color' | 'checkbox' | 'datetime-local' | 'file';
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  fullWidth?: boolean;
  defaultValue?: string | boolean;
};

type ManagementCreateConfig = {
  title: string;
  description: string;
  endpoint: string;
  method: 'POST';
  fields: ManagementCreateField[];
  success: string;
};

const managementPostTypeOptions = [
  { value: 'announcement', label: 'Announcement' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'success', label: 'Success' },
  { value: 'error', label: 'Error' },
  { value: 'blog', label: 'Blog' },
  { value: 'magazine', label: 'Magazine' },
  { value: 'news', label: 'News' },
];

function managementCreateConfigForSection(section: ManagementSectionKey): ManagementCreateConfig | null {
  if (section === 'announcements' || section === 'posts') {
    const isAnnouncement = section === 'announcements';
    return {
      title: isAnnouncement ? 'Create announcement' : 'Create post',
      description: isAnnouncement
        ? 'Create a new announcement and optionally upload an announcement image.'
        : 'Create a new community post and optionally attach a cover image.',
      endpoint: '/posts',
      method: 'POST',
      success: isAnnouncement ? 'Announcement created.' : 'Post created.',
      fields: [
        { key: 'title', label: 'Title', type: 'text', required: true, placeholder: isAnnouncement ? 'Maintenance notice' : 'New article title', fullWidth: true },
        { key: 'excerpt', label: 'Excerpt', type: 'text', placeholder: 'Short summary', fullWidth: true },
        { key: 'content', label: 'Content', type: 'textarea', required: true, placeholder: 'Write at least 20 characters...', fullWidth: true },
        { key: 'postType', label: 'Post type', type: 'select', defaultValue: isAnnouncement ? 'announcement' : 'blog', options: managementPostTypeOptions },
        { key: 'imageUrl', label: 'Image URL', type: 'text', placeholder: '/api/site-assets/post-...' },
        { key: 'imageFile', label: 'Upload image', type: 'file', fullWidth: true },
      ],
    };
  }
  if (section === 'tags') {
    return {
      title: 'Create problem tag',
      description: 'Create a reusable problem tag with a visible color.',
      endpoint: '/tags',
      method: 'POST',
      success: 'Problem tag created.',
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Dynamic programming' },
        { key: 'color', label: 'Color', type: 'color', defaultValue: '#f26f21' },
      ],
    };
  }
  if (section === 'users') {
    return {
      title: 'Create account',
      description: 'Create a verified account directly from the management workspace.',
      endpoint: '/admin/users',
      method: 'POST',
      success: 'Account created.',
      fields: [
        { key: 'username', label: 'Username', type: 'text', required: true, placeholder: 'student_001' },
        { key: 'email', label: 'Email', type: 'email', required: true, placeholder: 'student@example.com' },
        { key: 'fullName', label: 'Full name', type: 'text', required: true, placeholder: 'Nguyen Van A' },
        { key: 'password', label: 'Password', type: 'password', required: true, placeholder: 'At least 8 characters' },
        { key: 'role', label: 'Role', type: 'select', defaultValue: 'user', options: [{ value: 'user', label: 'User' }, { value: 'moderator', label: 'Moderator' }, { value: 'admin', label: 'Admin' }] },
        { key: 'membershipTier', label: 'Membership tier', type: 'select', defaultValue: 'free', options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }, { value: 'ultra', label: 'Ultra' }, { value: 'ultra_max', label: 'Ultra Max' }] },
        { key: 'membershipExpiresAt', label: 'Membership expires at', type: 'datetime-local' },
        { key: 'isTeacher', label: 'Teacher account', type: 'checkbox', defaultValue: false },
      ],
    };
  }
  if (section === 'chat') {
    return {
      title: 'Create chat group',
      description: 'Create a private class or team chat group. Member IDs can be comma separated.',
      endpoint: '/admin/chat-groups',
      method: 'POST',
      success: 'Chat group created.',
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Lop tin 10A' },
        { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Group purpose...', fullWidth: true },
        { key: 'memberIds', label: 'Member IDs', type: 'text', placeholder: '12, 25, 31', fullWidth: true },
      ],
    };
  }
  return null;
}

function managementCreateDefaultDraft(config: ManagementCreateConfig) {
  return Object.fromEntries(config.fields.map((field) => [field.key, field.defaultValue ?? (field.type === 'checkbox' ? false : '')]));
}

function managementCreatePayload(section: ManagementSectionKey, draft: Record<string, unknown>, imageUrl?: string) {
  if (section === 'announcements' || section === 'posts') {
    return {
      title: String(draft.title || '').trim(),
      excerpt: String(draft.excerpt || '').trim() || null,
      content: String(draft.content || '').trim(),
      imageUrl: imageUrl || String(draft.imageUrl || '').trim() || null,
      postType: String(draft.postType || (section === 'announcements' ? 'announcement' : 'blog')),
      turnstileToken: '',
    };
  }
  if (section === 'tags') {
    return {
      name: String(draft.name || '').trim(),
      color: String(draft.color || '#f26f21'),
    };
  }
  if (section === 'users') {
    const membershipExpiresAt = String(draft.membershipExpiresAt || '').trim();
    return {
      username: String(draft.username || '').trim(),
      email: String(draft.email || '').trim(),
      fullName: String(draft.fullName || '').trim(),
      password: String(draft.password || ''),
      role: String(draft.role || 'user'),
      isTeacher: Boolean(draft.isTeacher),
      membershipTier: String(draft.membershipTier || 'free'),
      membershipExpiresAt: membershipExpiresAt ? new Date(membershipExpiresAt).toISOString() : null,
    };
  }
  if (section === 'chat') {
    const memberIds = String(draft.memberIds || '')
      .split(/[,\s]+/)
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
    return {
      name: String(draft.name || '').trim(),
      description: String(draft.description || '').trim(),
      memberIds,
    };
  }
  return draft;
}

async function uploadManagementPostImage(file: File) {
  const form = new FormData();
  form.append('file', file);
  const uploaded = await cpproApiFetch<{ url?: string }>('/posts/assets', {
    method: 'POST',
    body: form,
    timeoutMs: 60_000,
  });
  return String(uploaded.url || '').trim();
}

function ManagementDataPanel({
  dataset,
  section,
  locale,
  settingsControl,
  go,
  currentUser,
  onAction,
  onOpenRow,
  onSaveRow,
  onDeleteRow,
  loading = false,
}: {
  dataset: ManagementDataset<any>;
  section: ManagementSectionKey;
  locale: CpproLocale;
  settingsControl?: ManagementSettingsControl;
  go: (path: string) => void;
  currentUser: StoredCpproUser | null;
  onAction: (action: ManagementAction) => void;
  onOpenRow?: (row: Record<string, unknown>) => boolean;
  onSaveRow: (row: Record<string, unknown>, draftRow: Record<string, unknown>) => Promise<boolean>;
  onDeleteRow: (row: Record<string, unknown>) => Promise<boolean>;
  loading?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, unknown>>({});
  const [editRowKey, setEditRowKey] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editImageUploading, setEditImageUploading] = useState(false);
  const [editError, setEditError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);
  const [deleteRowKey, setDeleteRowKey] = useState('');
  const [deletingRow, setDeletingRow] = useState(false);
  const [createAction, setCreateAction] = useState<ManagementAction | null>(null);
  const [createDraft, setCreateDraft] = useState<Record<string, unknown>>({});
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [creatingRow, setCreatingRow] = useState(false);
  const [createError, setCreateError] = useState('');
  const [rowOverrides, setRowOverrides] = useState<Record<string, Record<string, unknown>>>({});
  const actions = managementActionsForSection(section);
  const inlineEditable = managementInlineEditableSections.has(section);
  const isDashboard = section === 'dashboard';
  const activeCreateConfig = createAction ? managementCreateConfigForSection(section) : null;
  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return dataset.rows;
    return dataset.rows.filter((row) => dataset.searchText(row).toLowerCase().includes(needle));
  }, [dataset, query]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const mt = (text: string | undefined) => managementText(locale, text);

  useEffect(() => {
    setQuery('');
    setPage(1);
    setEditingRow(null);
    setEditDraft({});
    setEditImageUploading(false);
    setEditError('');
    setDeleteTarget(null);
    setCreateAction(null);
    setCreateDraft({});
    setCreateFile(null);
    setCreateError('');
    setRowOverrides({});
  }, [dataset.title]);

  const rowIdentity = (row: Record<string, unknown>, index: number) => String(
    row.id ?? row.code ?? row.slug ?? row.username ?? row.key ?? `${dataset.title}-${index}`,
  );
  const openRowEditor = (row: Record<string, unknown>, rowKey: string) => {
    const editableDraft = Object.fromEntries(
      Object.entries(row).filter(([, value]) => (
        value === null
        || typeof value === 'string'
        || typeof value === 'number'
        || typeof value === 'boolean'
      )),
    );
    setEditingRow(row);
    setEditDraft(editableDraft);
    setEditRowKey(rowKey);
  };
  const commitRowEdit = async () => {
    if (!editingRow || savingEdit) return;
    setSavingEdit(true);
    setEditError('');
    try {
      const saved = await onSaveRow(editingRow, editDraft);
      if (!saved) return;
      setRowOverrides((current) => ({ ...current, [editRowKey]: editDraft }));
      setEditingRow(null);
      setEditDraft({});
      setEditRowKey('');
    } finally {
      setSavingEdit(false);
    }
  };
  const uploadEditImage = async (file: File | null | undefined) => {
    if (!file || editImageUploading) return;
    setEditImageUploading(true);
    setEditError('');
    try {
      const url = await uploadManagementPostImage(file);
      setEditDraft((current) => ({ ...current, imageUrl: url, image_url: url }));
    } catch (error) {
      setEditError(error instanceof Error ? error.message : mt('Could not upload image.'));
    } finally {
      setEditImageUploading(false);
    }
  };
  const commitRowDelete = async () => {
    if (!deleteTarget || deletingRow) return;
    setDeletingRow(true);
    try {
      const deleted = await onDeleteRow(deleteTarget);
      if (!deleted) return;
      setRowOverrides((current) => {
        const next = { ...current };
        delete next[deleteRowKey];
        return next;
      });
      setDeleteTarget(null);
      setDeleteRowKey('');
    } finally {
      setDeletingRow(false);
    }
  };
  const openCreateDialog = (action: ManagementAction) => {
    const config = managementCreateConfigForSection(section);
    if (!config) {
      onAction(action);
      return;
    }
    setCreateAction(action);
    setCreateDraft(managementCreateDefaultDraft(config));
    setCreateFile(null);
    setCreateError('');
  };
  const commitCreate = async () => {
    if (!activeCreateConfig || creatingRow) return;
    setCreatingRow(true);
    setCreateError('');
    try {
      const uploadedImageUrl = createFile ? await uploadManagementPostImage(createFile) : '';
      const payload = managementCreatePayload(section, createDraft, uploadedImageUrl);
      await cpproApiFetch(activeCreateConfig.endpoint, {
        method: activeCreateConfig.method,
        body: JSON.stringify(payload),
        timeoutMs: 60_000,
      });
      setCreateAction(null);
      setCreateDraft({});
      setCreateFile(null);
      onAction({ label: activeCreateConfig.success, endpoint: managementPrimaryReadEndpoint(section), icon: <RefreshCw size={17} /> });
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : mt('Could not create this item.'));
    } finally {
      setCreatingRow(false);
    }
  };
  const patchEditDraftField = (key: string, value: unknown) => {
    setEditDraft((current) => ({ ...current, [key]: value }));
  };
  const patchCreateDraftField = (key: string, value: unknown) => {
    setCreateDraft((current) => ({ ...current, [key]: value }));
  };

  const pagination = (
    <Pagination
      page={currentPage}
      totalPages={totalPages}
      onPage={setPage}
      totalItems={filteredRows.length}
      pageSize={pageSize}
      onPageSizeChange={(value) => {
        setPageSize(value);
        setPage(1);
      }}
      pageSizeOptions={[5, 10, 20, 50, 100]}
    />
  );

  return (
    <section className="cppro-management-module" data-cppro-management-module={section}>
      {isDashboard ? (
        <section className="cppro-management-dashboard" data-management-control-cards data-management-dashboard-summary>
          {dataset.cards.map((card) => (
            <article key={card.label}>
              <span>{card.icon}</span>
              <strong>{card.value}</strong>
              <small>{mt(card.label)}{card.meta ? ` - ${mt(card.meta)}` : ''}</small>
            </article>
          ))}
        </section>
      ) : null}
      <section className="cppro-management-control-panel" data-management-section-filter={section} data-dashboard={isDashboard ? 'true' : undefined}>
        <div>
          <span className="home-chip"><Search size={14} />{mt('Filter')}</span>
          <strong>{mt(dataset.filterLabel)}</strong>
        </div>
        <label className="search-box small">
          <Search size={16} />
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={mt('Filter current table...')} />
        </label>
        {isDashboard ? (
          <div data-management-queue-health>
            <Terminal size={16} />
            <span>{mt(dataset.queueLabel)}</span>
          </div>
        ) : null}
      </section>
      <section className="cppro-management-action-grid" data-management-action-grid data-management-actions-section={section}>
        {actions.map((action) => (
          <button
            key={`${action.method || 'GET'}-${action.endpoint}`}
            type="button"
            data-tone={action.tone || 'default'}
            onClick={() => {
              if ((action.method || 'GET') !== 'GET') {
                openCreateDialog(action);
                return;
              }
              onAction(action);
            }}
          >
            <span>{action.icon}</span>
            <strong>{mt(action.label)}</strong>
            {(action.method || 'GET') === 'GET'
              ? <small><b>{action.method || 'GET'}</b><code>{action.endpoint}</code></small>
              : <small>{mt('Open form')}</small>}
          </button>
        ))}
      </section>
      {loading ? <DataLoadingPanel label={mt(`Loading ${dataset.title} from database`)} rows={3} compact /> : null}
      {section === 'dashboard' ? <ManagementDashboardInsights locale={locale} go={go} /> : null}
      {section === 'analytics' ? <ManagementAnalyticsPanel locale={locale} /> : null}
      {section === 'chat' ? <ManagementChatOpsPanel locale={locale} /> : null}
      {section === 'smtp' ? <ManagementSmtpPanel locale={locale} /> : null}
      {section === 'organizations' ? <ManagementOrganizationRequestsPanel locale={locale} /> : null}
      {section === 'cluster' ? <ManagementClusterOpsPanel locale={locale} /> : null}
      {section === 'badges' ? <ManagementBadgeSetupPanel locale={locale} /> : null}
      {section === 'users' ? <ManagementUserModerationPanel locale={locale} currentUser={currentUser} /> : null}
      {section === 'attendance' ? <ManagementAttendancePanel locale={locale} /> : null}
      {section === 'incidents' ? <ManagementIncidentReviewPanel locale={locale} go={go} /> : null}
      {section === 'settings' ? <ManagementPlatformOpsPanel locale={locale} /> : null}
      {section === 'audit-logs' ? <ManagementAuditLogPanel locale={locale} go={go} /> : null}
      <section className="cppro-management-table-panel" data-management-table-bottom data-management-table-section={section}>
        <header>
          <div>
            <h2>{mt(`${dataset.title} table`)}</h2>
            <p>{filteredRows.length.toLocaleString('vi-VN')} {mt('rows after filter')}</p>
            {dataset.sourceEndpoint ? <small className="cppro-management-data-source" data-management-data-source><CheckCircle2 size={13} />API: <code>{dataset.sourceEndpoint}</code></small> : null}
          </div>
          {pagination}
        </header>
        <div className="cppro-management-table-scroll">
          <table className="cppro-management-data-table">
            <thead>
              <tr>
                {dataset.columns.map((column) => (
                  <th key={column.key} data-align={column.align || 'left'}>{mt(column.label)}</th>
                ))}
                <th data-align="right">{mt('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={dataset.columns.length + 1}><TableLoadingRows rows={Math.min(pageSize, 8)} columns={Math.min(dataset.columns.length + 1, 7)} /></td>
                </tr>
              ) : pageRows.length ? pageRows.map((row, rowIndex) => (
                (() => {
                  const absoluteIndex = (currentPage - 1) * pageSize + rowIndex;
                  const rowKey = rowIdentity(row, absoluteIndex);
                  const visibleRow = { ...row, ...(rowOverrides[rowKey] || {}) };
                  return (
                    <tr key={`${dataset.title}-${rowKey}`}>
                      {dataset.columns.map((column) => (
                        <td key={column.key} data-align={column.align || 'left'}>
                          {section === 'settings'
                            && column.key === 'value'
                            && settingsControl ? (
                              visibleRow.kind === 'topbar-features' ? (
                                <div className="cppro-management-topbar-switches" data-management-topbar-switches>
                                  {(Object.keys(defaultTopbarFeatures) as TopbarFeatureKey[]).map((key) => (
                                    <label key={key}>
                                      <span>{key.replace(/([A-Z])/g, ' $1')}</span>
                                      <input
                                        type="checkbox"
                                        role="switch"
                                        checked={settingsControl.value.topbarFeatures[key]}
                                        onChange={() => settingsControl.onToggle(key)}
                                      />
                                      <i aria-hidden="true" />
                                    </label>
                                  ))}
                                  <footer>
                                    <small>{settingsControl.dirty ? mt('Unsaved site and topbar changes') : mt('Site and topbar settings are saved')}</small>
                                    <button
                                      className="blue-button"
                                      type="button"
                                      disabled={!settingsControl.dirty || settingsControl.saving}
                                      onClick={settingsControl.onSave}
                                    >
                                      {settingsControl.saving ? mt('Saving...') : mt('Save settings')}
                                    </button>
                                  </footer>
                                </div>
                              ) : (
                                <label className="cppro-management-setting-input" data-management-setting-field={String(visibleRow.field || '')}>
                                  <input
                                    type={visibleRow.kind === 'number' ? 'number' : 'text'}
                                    min={visibleRow.kind === 'number' ? 1 : undefined}
                                    max={visibleRow.kind === 'number' ? 100 : undefined}
                                    value={String(settingsControl.value[String(visibleRow.field) as keyof ManagementSiteSettings] ?? '')}
                                    onChange={(event) => {
                                      const field = String(visibleRow.field) as keyof ManagementSiteSettings;
                                      settingsControl.onPatch({
                                        [field]: visibleRow.kind === 'number'
                                          ? (event.currentTarget.value ? Number(event.currentTarget.value) : '')
                                          : event.currentTarget.value,
                                      } as Partial<ManagementSiteSettings>);
                                    }}
                                  />
                                  {settingsControl.dirty ? <small>{mt('Unsaved')}</small> : null}
                                </label>
                              )
                            ) : column.render(visibleRow, absoluteIndex)}
                        </td>
                      ))}
                      <td data-align="right">
                        <div className="cppro-management-row-actions">
                          <button
                            className="cppro-management-row-action"
                          type="button"
                          data-management-edit-action={inlineEditable ? 'edit' : 'inspect'}
                          onClick={() => {
                            if (!inlineEditable && onOpenRow?.(visibleRow)) return;
                            openRowEditor(visibleRow, rowKey);
                          }}
                          >
                            {inlineEditable ? <PenLine size={15} /> : <Eye size={15} />}
                            {inlineEditable ? mt('Edit') : mt('Inspect')}
                          </button>
                          <button
                            className="cppro-management-row-action cppro-management-row-action-danger"
                            type="button"
                            data-management-delete-action="delete"
                            onClick={() => {
                              setDeleteTarget(visibleRow);
                              setDeleteRowKey(rowKey);
                            }}
                          >
                            <XCircle size={15} />
                            {mt('Delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })()
              )) : (
                <tr>
                  <td colSpan={dataset.columns.length + 1}>{mt(dataset.empty)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer>
          {pagination}
        </footer>
      </section>
      {editingRow ? (
        <BodyPortal>
          <div className="cppro-management-edit-overlay" role="presentation" onMouseDown={(event) => {
            if (event.currentTarget === event.target) setEditingRow(null);
          }}>
            <section className="cppro-management-edit-drawer" role="dialog" aria-modal="true" aria-label={`${inlineEditable ? mt('Edit') : mt('Inspect')} ${dataset.title} row`}>
              <header>
                <div>
                  <span className="home-chip">{inlineEditable ? <PenLine size={14} /> : <Eye size={14} />}{inlineEditable ? mt('Edit row') : mt('Inspect row')}</span>
                  <h2>{dataset.title}</h2>
                  <p>{inlineEditable ? mt('Only fields supported by this module API will be saved.') : mt('This operational row is read-only; use the module actions above for its workflow.')}</p>
                </div>
                <button type="button" aria-label="Close row editor" onClick={() => setEditingRow(null)}><X size={18} /></button>
              </header>
              <div className="cppro-management-edit-fields">
                {Object.entries(editDraft).map(([key, value]) => (
                  <label key={key}>
                    <span>{key.replace(/([A-Z])/g, ' $1')}</span>
                    {typeof value === 'boolean' ? (
                      <input
                        type="checkbox"
                        checked={value}
                        disabled={!inlineEditable}
                        onChange={(event) => patchEditDraftField(key, event.currentTarget.checked)}
                      />
                    ) : (
                      <input
                        type={typeof value === 'number' ? 'number' : 'text'}
                        value={value === null ? '' : String(value)}
                        readOnly={!inlineEditable}
                        onChange={(event) => {
                          const nextValue = event.currentTarget.value;
                          patchEditDraftField(key, typeof value === 'number' ? Number(nextValue) : nextValue);
                        }}
                      />
                    )}
                  </label>
                ))}
                {(section === 'announcements' || section === 'posts') && inlineEditable ? (
                  <label className="cppro-management-field-span">
                    <span>{mt('Upload image')}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      disabled={editImageUploading}
                      onChange={(event) => void uploadEditImage(event.currentTarget.files?.[0])}
                    />
                    <small>{editImageUploading ? mt('Uploading image...') : mt('Uploaded image URL is saved into the image field.')}</small>
                  </label>
                ) : null}
                {editError ? <p className="service-message cppro-management-field-span">{editError}</p> : null}
              </div>
              {Object.entries(editingRow).some(([, value]) => value && typeof value === 'object') ? (
                <details className="cppro-management-edit-json">
                  <summary>{mt('Structured row data')}</summary>
                  <pre>{JSON.stringify(editingRow, null, 2)}</pre>
                </details>
              ) : null}
              <footer>
                <button className="soft-button" type="button" onClick={() => setEditingRow(null)}>{mt('Close')}</button>
                {inlineEditable ? (
                  <button className="blue-button" type="button" disabled={savingEdit} onClick={() => void commitRowEdit()}>
                    {savingEdit ? mt('Saving...') : mt('Save changes')}
                  </button>
                ) : null}
              </footer>
            </section>
          </div>
        </BodyPortal>
      ) : null}
      {deleteTarget ? (
        <BodyPortal>
          <div className="cppro-management-edit-overlay cppro-management-confirm-overlay" role="presentation" onMouseDown={(event) => {
            if (event.currentTarget === event.target && !deletingRow) setDeleteTarget(null);
          }}>
            <section className="cppro-management-confirm-dialog" role="dialog" aria-modal="true" aria-label={mt('Confirm delete')}>
              <header>
                <span className="home-chip"><XCircle size={14} />{mt('Delete')}</span>
                <button type="button" aria-label={mt('Close')} disabled={deletingRow} onClick={() => setDeleteTarget(null)}><X size={18} /></button>
              </header>
              <div>
                <h2>{mt('Delete this row?')}</h2>
                <p>{mt('This action will call the live database API and cannot be undone from this screen.')}</p>
                <code>{String(deleteTarget.title || deleteTarget.name || deleteTarget.username || deleteTarget.slug || deleteTarget.id || deleteTarget.code || dataset.title)}</code>
              </div>
              <footer>
                <button className="soft-button" type="button" disabled={deletingRow} onClick={() => setDeleteTarget(null)}>{mt('Cancel')}</button>
                <button className="management-danger-action" type="button" disabled={deletingRow} onClick={() => void commitRowDelete()}>
                  <XCircle size={15} />{deletingRow ? mt('Deleting...') : mt('Delete')}
                </button>
              </footer>
            </section>
          </div>
        </BodyPortal>
      ) : null}
      {activeCreateConfig ? (
        <BodyPortal>
          <div className="cppro-management-edit-overlay cppro-management-create-overlay" role="presentation" onMouseDown={(event) => {
            if (event.currentTarget === event.target && !creatingRow) setCreateAction(null);
          }}>
            <section className="cppro-management-edit-drawer cppro-management-create-drawer" role="dialog" aria-modal="true" aria-label={mt(activeCreateConfig.title)}>
              <header>
                <div>
                  <span className="home-chip"><PenLine size={14} />{mt('Create')}</span>
                  <h2>{mt(activeCreateConfig.title)}</h2>
                  <p>{mt(activeCreateConfig.description)}</p>
                </div>
                <button type="button" aria-label={mt('Close')} disabled={creatingRow} onClick={() => setCreateAction(null)}><X size={18} /></button>
              </header>
              <div className="cppro-management-edit-fields cppro-management-create-fields">
                {activeCreateConfig.fields.map((field) => (
                  <label key={field.key} className={field.fullWidth ? 'cppro-management-field-span' : undefined}>
                    <span>{mt(field.label)}{field.required ? ' *' : ''}</span>
                    {field.type === 'textarea' ? (
                      <textarea
                        rows={field.key === 'content' ? 8 : 4}
                        value={String(createDraft[field.key] ?? '')}
                        placeholder={field.placeholder ? mt(field.placeholder) : undefined}
                        onChange={(event) => patchCreateDraftField(field.key, event.currentTarget.value)}
                      />
                    ) : field.type === 'select' ? (
                      <select value={String(createDraft[field.key] ?? '')} onChange={(event) => patchCreateDraftField(field.key, event.currentTarget.value)}>
                        {(field.options || []).map((option) => <option key={option.value} value={option.value}>{mt(option.label)}</option>)}
                      </select>
                    ) : field.type === 'checkbox' ? (
                      <input
                        type="checkbox"
                        checked={Boolean(createDraft[field.key])}
                        onChange={(event) => patchCreateDraftField(field.key, event.currentTarget.checked)}
                      />
                    ) : field.type === 'file' ? (
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(event) => setCreateFile(event.currentTarget.files?.[0] || null)}
                      />
                    ) : (
                      <input
                        type={field.type}
                        value={String(createDraft[field.key] ?? '')}
                        placeholder={field.placeholder ? mt(field.placeholder) : undefined}
                        onChange={(event) => patchCreateDraftField(field.key, event.currentTarget.value)}
                      />
                    )}
                  </label>
                ))}
                {createError ? <p className="service-message cppro-management-field-span">{createError}</p> : null}
              </div>
              <footer>
                <button className="soft-button" type="button" disabled={creatingRow} onClick={() => setCreateAction(null)}>{mt('Cancel')}</button>
                <button className="blue-button" type="button" disabled={creatingRow} onClick={() => void commitCreate()}>
                  <Send size={15} />{creatingRow ? mt('Saving...') : mt(activeCreateConfig.title)}
                </button>
              </footer>
            </section>
          </div>
        </BodyPortal>
      ) : null}
    </section>
  );
}

function managementTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function ManagementChatOpsPanel({ locale }: { locale: CpproLocale }) {
  const mt = (text: string | undefined) => managementText(locale, text);
  const [groups, setGroups] = useState<Array<Record<string, unknown>>>([]);
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | number | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  const [summaryDate, setSummaryDate] = useState(managementTodayIsoDate);
  const [loading, setLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState('');

  const selectedGroup = groups.find((group) => String(group.id) === String(selectedGroupId)) || null;
  const selectedMemberSet = useMemo(() => new Set(selectedMembers), [selectedMembers]);
  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    if (!needle) return users;
    return users.filter((user) => (
      String(user.username || '').toLocaleLowerCase(locale).includes(needle)
      || String(user.full_name || user.fullName || '').toLocaleLowerCase(locale).includes(needle)
      || String(user.email || '').toLocaleLowerCase(locale).includes(needle)
    ));
  }, [locale, query, users]);

  const loadMembers = async (groupId: string | number) => {
    setMembersLoading(true);
    setMessage('');
    setSelectedGroupId(groupId);
    try {
      const payload = await cpproApiFetch<unknown>(`/admin/chat-groups/${encodeURIComponent(String(groupId))}/members`);
      const memberRows = rowsFromApi<Record<string, unknown>>(payload);
      const nextMembers: number[] = [];
      memberRows.forEach((member) => {
        const id = Number(member.user_id ?? member.userId ?? member.id);
        if (Number.isInteger(id) && id > 0) nextMembers.push(id);
      });
      setSelectedMembers(nextMembers);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('Could not load chat members.'));
      setSelectedMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  const loadChatOps = async () => {
    setLoading(true);
    setMessage('');
    try {
      const [groupPayload, userPayload] = await Promise.all([
        cpproApiFetch<unknown>('/admin/chat-groups'),
        cpproApiFetch<unknown>('/admin/users?page=1&limit=300&withCount=true'),
      ]);
      const nextGroups = rowsFromApi<Record<string, unknown>>(groupPayload);
      const nextUsers = rowsFromApi<Record<string, unknown>>(userPayload);
      setGroups(nextGroups);
      setUsers(nextUsers);
      const firstGroupId = nextGroups[0]?.id;
      const nextSelected = selectedGroupId && nextGroups.some((group) => String(group.id) === String(selectedGroupId))
        ? selectedGroupId
        : (typeof firstGroupId === 'string' || typeof firstGroupId === 'number' ? firstGroupId : null);
      if (nextSelected !== undefined && nextSelected !== null) {
        await loadMembers(nextSelected);
      } else {
        setSelectedGroupId(null);
        setSelectedMembers([]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('Could not load chat operations.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadChatOps();
  }, []);

  const toggleMember = (userId: number) => {
    setSelectedMembers((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId].sort((left, right) => left - right));
  };

  const saveMembers = async () => {
    if (!selectedGroupId || saving) return;
    setSaving(true);
    setMessage('');
    try {
      await cpproApiFetch(`/admin/chat-groups/${encodeURIComponent(String(selectedGroupId))}/members`, {
        method: 'PUT',
        body: JSON.stringify({ memberIds: selectedMembers }),
      });
      setMessage(mt('Members updated.'));
      await loadChatOps();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('Could not update members.'));
    } finally {
      setSaving(false);
    }
  };

  const downloadSummary = async () => {
    if (downloading) return;
    setDownloading(true);
    setMessage('');
    try {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(summaryDate) ? summaryDate : managementTodayIsoDate();
      const token = localStorage.getItem('oj_platform_token') || localStorage.getItem('cppro_access_token');
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${cpproApiBase()}/admin/chat-groups/daily-summary.xls?date=${encodeURIComponent(date)}`, { headers });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(String(errorPayload?.error || errorPayload?.message || mt('Could not download chat summary.')));
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `itcoder-chat-summary-${date}.xls`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      setSummaryDate(date);
      setMessage(mt('Chat summary downloaded.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('Could not download chat summary.'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="cppro-management-form-card cppro-management-ops-panel" data-management-chat-ops>
      <header>
        <div>
          <span className="home-chip"><MessageSquare size={14} />{mt('Chat member operations')}</span>
          <h3>{mt('Chat groups')}</h3>
          <p>{mt('Manage members and download daily chat reports from the legacy admin workflow.')}</p>
        </div>
        <div className="cppro-management-ops-actions">
          <label className="cppro-management-inline-control">
            <span>{mt('Summary date')}</span>
            <input type="date" value={summaryDate} onChange={(event) => setSummaryDate(event.currentTarget.value)} />
          </label>
          <button className="soft-button" type="button" disabled={downloading} onClick={() => void downloadSummary()}><Download size={14} />{downloading ? mt('Loading...') : mt('Download daily Excel')}</button>
          <button className="soft-button" type="button" disabled={loading} onClick={() => void loadChatOps()}><RefreshCw size={14} />{mt('Refresh')}</button>
        </div>
      </header>
      {loading ? <DataLoadingPanel label={mt('Loading chat operations')} rows={3} compact /> : (
        <div className="cppro-management-chat-ops-grid">
          <div className="cppro-management-record-list">
            <h4>{mt('Chat groups')}</h4>
            {groups.length ? groups.map((group) => (
              <button
                key={String(group.id ?? group.slug ?? group.name)}
                className={String(group.id) === String(selectedGroupId) ? 'active' : undefined}
                type="button"
                onClick={() => group.id !== undefined && void loadMembers(group.id as string | number)}
              >
                <span>
                  <strong>{String(group.name || group.slug || `#${group.id}`)}</strong>
                  <small>{String(group.description || group.slug || '')}</small>
                </span>
                <b>{Number(group.member_count ?? group.memberCount ?? 0).toLocaleString('vi-VN')} {mt('Members')}</b>
              </button>
            )) : <article><span><strong>{mt('No chat groups found.')}</strong><small>{mt('Create chat group')}</small></span></article>}
          </div>
          <div className="cppro-management-member-panel">
            <label className="cppro-management-inline-control">
              <span>{mt('Selected group')}</span>
              <select value={String(selectedGroupId ?? '')} onChange={(event) => event.currentTarget.value && void loadMembers(event.currentTarget.value)}>
                {groups.map((group) => <option key={String(group.id)} value={String(group.id)}>{String(group.name || group.slug || group.id)}</option>)}
              </select>
            </label>
            <label className="search-box small">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder={mt('Search users to add')} />
            </label>
            {membersLoading ? <DataLoadingPanel label={mt('Could not load chat members.')} rows={3} compact /> : (
              <div className="cppro-management-member-picker">
                {filteredUsers.length ? filteredUsers.map((user) => {
                  const userId = Number(user.id);
                  if (!Number.isInteger(userId) || userId <= 0) return null;
                  return (
                    <label key={String(user.id)}>
                      <input type="checkbox" checked={selectedMemberSet.has(userId)} onChange={() => toggleMember(userId)} />
                      <span>
                        <strong>@{String(user.username || user.id)}</strong>
                        <small>{String(user.full_name || user.fullName || user.email || `#${user.id}`)}</small>
                      </span>
                    </label>
                  );
                }) : <p>{mt('No users match this search.')}</p>}
              </div>
            )}
            <footer>
              <span className="management-status"><UsersRound size={12} />{selectedMembers.length.toLocaleString('vi-VN')} {mt('Members')}</span>
              <button className="blue-button" type="button" disabled={!selectedGroup || saving || membersLoading} onClick={() => void saveMembers()}><CheckCircle2 size={14} />{saving ? mt('Saving...') : mt('Update members')}</button>
            </footer>
          </div>
        </div>
      )}
      {message ? <p className="service-message">{message}</p> : null}
    </section>
  );
}

type ManagementSmtpDraft = {
  host: string;
  port: number;
  secure: boolean;
  startTls: boolean;
  username: string;
  password: string;
  clearPassword: boolean;
  from: string;
  ehloDomain: string;
};

function ManagementSmtpPanel({ locale }: { locale: CpproLocale }) {
  const mt = (text: string | undefined) => managementText(locale, text);
  const emptyDraft: ManagementSmtpDraft = {
    host: '',
    port: 587,
    secure: false,
    startTls: true,
    username: '',
    password: '',
    clearPassword: false,
    from: '',
    ehloDomain: 'localhost',
  };
  const [draft, setDraft] = useState<ManagementSmtpDraft>(emptyDraft);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const patchDraft = (patch: Partial<ManagementSmtpDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const loadSmtp = () => {
    setLoading(true);
    setMessage('');
    cpproApiFetch<Record<string, unknown>>('/admin/platform-settings')
      .then((payload) => {
        const smtp = payload.smtp && typeof payload.smtp === 'object' ? payload.smtp as Record<string, unknown> : {};
        setStatus(smtp);
        setDraft({
          host: String(smtp.host || ''),
          port: Number(smtp.port || 587) || 587,
          secure: Boolean(smtp.secure),
          startTls: smtp.startTls === undefined ? true : Boolean(smtp.startTls),
          username: String(smtp.username || ''),
          password: '',
          clearPassword: false,
          from: String(smtp.from || ''),
          ehloDomain: String(smtp.ehloDomain || 'localhost'),
        });
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : mt('Could not load SMTP settings.')))
      .finally(() => setLoading(false));
  };
  useEffect(loadSmtp, []);
  const saveSmtp = async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const saved = await cpproApiFetch<Record<string, unknown>>('/admin/platform-settings/smtp', {
        method: 'PUT',
        body: JSON.stringify(draft),
      });
      setStatus(saved);
      setDraft((current) => ({ ...current, password: '', clearPassword: false }));
      setMessage(mt('SMTP settings saved.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('Could not save SMTP settings.'));
    } finally {
      setBusy(false);
    }
  };
  const testSmtp = async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await cpproApiFetch<Record<string, unknown>>('/admin/platform-settings/smtp/test', { method: 'POST' });
      setMessage(String(result.message || mt('SMTP connection test completed.')));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('SMTP connection test failed.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="cppro-management-form-card cppro-management-ops-panel" data-management-smtp-panel>
      <header>
        <div>
          <span className="home-chip"><Mail size={14} />{mt('SMTP server')}</span>
          <h3>{mt('Mail delivery settings')}</h3>
          <p>{mt('Configure account activation, password reset and notification mail from the database settings table.')}</p>
        </div>
        <button className="soft-button" type="button" disabled={loading} onClick={loadSmtp}><RefreshCw size={14} />{mt('Refresh')}</button>
      </header>
      <div className="cppro-management-fields two-columns">
        <label><span>{mt('Host')}</span><input value={draft.host} onChange={(event) => patchDraft({ host: event.currentTarget.value })} placeholder="smtp.example.com" /></label>
        <label><span>{mt('Port')}</span><input type="number" min="1" max="65535" value={draft.port} onChange={(event) => patchDraft({ port: Number(event.currentTarget.value) || 587 })} /></label>
        <label><span>{mt('Username')}</span><input value={draft.username} onChange={(event) => patchDraft({ username: event.currentTarget.value })} /></label>
        <label><span>{mt('Password')}</span><input type="password" value={draft.password} onChange={(event) => patchDraft({ password: event.currentTarget.value })} placeholder={status?.passwordConfigured ? mt('Leave blank to keep current password') : ''} /></label>
        <label><span>{mt('From email')}</span><input value={draft.from} onChange={(event) => patchDraft({ from: event.currentTarget.value })} placeholder="no-reply@example.com" /></label>
        <label><span>{mt('EHLO domain')}</span><input value={draft.ehloDomain} onChange={(event) => patchDraft({ ehloDomain: event.currentTarget.value })} /></label>
      </div>
      <div className="cppro-management-check-row">
        <label><input type="checkbox" checked={draft.secure} onChange={(event) => patchDraft({ secure: event.currentTarget.checked, port: event.currentTarget.checked && draft.port === 587 ? 465 : draft.port })} /><span>{mt('Use SMTPS / secure port')}</span></label>
        <label><input type="checkbox" checked={draft.startTls} onChange={(event) => patchDraft({ startTls: event.currentTarget.checked })} /><span>{mt('Require STARTTLS')}</span></label>
        <label><input type="checkbox" checked={draft.clearPassword} onChange={(event) => patchDraft({ clearPassword: event.currentTarget.checked, password: event.currentTarget.checked ? '' : draft.password })} /><span>{mt('Clear saved password')}</span></label>
      </div>
      <footer className="cppro-management-ops-actions">
        <span className={status?.configured ? 'management-status management-status-published' : 'management-status management-status-warning'}>
          {status?.configured ? mt('Configured') : mt('Not configured')}
        </span>
        <button className="soft-button" type="button" disabled={busy || loading} onClick={() => void testSmtp()}><Send size={14} />{mt('Test SMTP')}</button>
        <button className="blue-button" type="button" disabled={busy || loading} onClick={() => void saveSmtp()}><CheckCircle2 size={14} />{busy ? mt('Saving...') : mt('Save SMTP')}</button>
      </footer>
      {message ? <p className="service-message">{message}</p> : null}
    </section>
  );
}

function ManagementOrganizationRequestsPanel({ locale }: { locale: CpproLocale }) {
  const mt = (text: string | undefined) => managementText(locale, text);
  const [paymentRows, setPaymentRows] = useState<Array<Record<string, unknown>>>([]);
  const [joinRows, setJoinRows] = useState<Array<Record<string, unknown>>>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const loadPaymentRequests = () => {
    setPaymentLoading(true);
    setMessage('');
    cpproApiFetch<unknown>('/admin/organization-payment-requests?page=1&limit=20&status=all')
      .then((payload) => setPaymentRows(rowsFromApi<Record<string, unknown>>(payload)))
      .catch((error) => setMessage(error instanceof Error ? error.message : mt('Could not load organization requests.')))
      .finally(() => setPaymentLoading(false));
  };
  const loadJoinRequests = () => {
    setJoinLoading(true);
    setMessage('');
    cpproApiFetch<unknown>('/admin/organization-join-requests?page=1&limit=50&status=all')
      .then((payload) => setJoinRows(rowsFromApi<Record<string, unknown>>(payload)))
      .catch((error) => setMessage(error instanceof Error ? error.message : mt('Could not load organization join requests.')))
      .finally(() => setJoinLoading(false));
  };
  const loadRequests = () => {
    loadPaymentRequests();
    loadJoinRequests();
  };
  useEffect(loadRequests, []);
  const reviewPaymentRequest = async (row: Record<string, unknown>, status: 'approved' | 'rejected') => {
    const id = row.id;
    if (!id || busyKey) return;
    setBusyKey(`payment:${id}`);
    setMessage('');
    try {
      const updated = await cpproApiFetch<Record<string, unknown>>(`/admin/organization-payment-requests/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, adminNote: status === 'approved' ? 'Approved from CPPRO management.' : 'Rejected from CPPRO management.' }),
      });
      setPaymentRows((current) => current.map((item) => String(item.id) === String(id) ? { ...item, ...updated, status } : item));
      setMessage(status === 'approved' ? mt('Organization request approved.') : mt('Organization request rejected.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('Could not review organization request.'));
    } finally {
      setBusyKey(null);
    }
  };
  const reviewJoinRequest = async (row: Record<string, unknown>, status: 'approved' | 'rejected') => {
    const id = row.id;
    if (!id || busyKey) return;
    setBusyKey(`join:${id}`);
    setMessage('');
    try {
      const updated = await cpproApiFetch<Record<string, unknown>>(`/admin/organization-join-requests/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setJoinRows((current) => current.map((item) => String(item.id) === String(id) ? { ...item, ...updated, status } : item));
      setMessage(status === 'approved' ? mt('Organization join request approved.') : mt('Organization join request rejected.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('Could not review organization join request.'));
    } finally {
      setBusyKey(null);
    }
  };
  const pendingPaymentCount = paymentRows.filter((row) => String(row.status || '').toLowerCase() === 'pending').length;
  const pendingJoinCount = joinRows.filter((row) => String(row.status || '').toLowerCase() === 'pending').length;
  const loading = paymentLoading || joinLoading;
  return (
    <section className="cppro-management-form-card cppro-management-ops-panel" data-management-organization-requests>
      <header>
        <div>
          <span className="home-chip"><GraduationCap size={14} />{mt('Organization requests')}</span>
          <h3>{mt('Organization review queue')}</h3>
          <p>{(pendingPaymentCount + pendingJoinCount).toLocaleString('vi-VN')} {mt('open requests need review.')}</p>
        </div>
        <button className="soft-button" type="button" disabled={loading} onClick={loadRequests}><RefreshCw size={14} />{mt('Refresh')}</button>
      </header>
      {paymentLoading ? <DataLoadingPanel label={mt('Loading organization requests')} rows={3} compact /> : (
        <div className="cppro-management-record-list">
          <h4>{mt('Payment and resource requests')}</h4>
          {paymentRows.map((row) => {
            const id = row.id;
            const pending = String(row.status || '').toLowerCase() === 'pending';
            return (
              <article key={String(id || `${row.organization_slug}-${row.created_at}`)}>
                <span>
                  <strong>{String(row.organization_name || row.organization_slug || `#${id}`)}</strong>
                  <small>@{String(row.username || row.requested_by || 'user')} · {String(row.product_type || 'resource')} × {String(row.quantity || 1)} · {formatDate(String(row.created_at || ''))}</small>
                </span>
                <b className={pending ? 'management-status management-status-warning' : 'management-status'}>{String(row.status || 'pending')}</b>
                <button className="blue-button" type="button" disabled={!pending || Boolean(busyKey)} onClick={() => void reviewPaymentRequest(row, 'approved')}><CheckCircle2 size={14} />{mt('Approve')}</button>
                <button className="management-danger-action" type="button" disabled={!pending || Boolean(busyKey)} onClick={() => void reviewPaymentRequest(row, 'rejected')}><XCircle size={14} />{mt('Reject')}</button>
              </article>
            );
          })}
          {!paymentRows.length ? <p className="contest-empty">{mt('No organization payment requests found.')}</p> : null}
        </div>
      )}
      {joinLoading ? <DataLoadingPanel label={mt('Loading organization join requests')} rows={3} compact /> : (
        <div className="cppro-management-record-list">
          <h4>{mt('Membership join requests')}</h4>
          {joinRows.map((row) => {
            const id = row.id;
            const pending = String(row.status || '').toLowerCase() === 'pending';
            const note = String(row.note || '').trim();
            return (
              <article key={String(id || `${row.organization_slug}-${row.user_id}-${row.created_at}`)}>
                <span>
                  <strong>{String(row.organization_name || row.organization_slug || `#${row.organization_id || id}`)}</strong>
                  <small>@{String(row.username || row.user_id || 'user')} · {String(row.email || row.full_name || '')} · {formatDate(String(row.created_at || ''))}</small>
                  {note ? <small>{mt('Note')}: {note}</small> : null}
                </span>
                <b className={pending ? 'management-status management-status-warning' : 'management-status'}>{String(row.status || 'pending')}</b>
                <button className="blue-button" type="button" disabled={!pending || Boolean(busyKey)} onClick={() => void reviewJoinRequest(row, 'approved')}><UserCheck size={14} />{mt('Approve')}</button>
                <button className="management-danger-action" type="button" disabled={!pending || Boolean(busyKey)} onClick={() => void reviewJoinRequest(row, 'rejected')}><XCircle size={14} />{mt('Reject')}</button>
              </article>
            );
          })}
          {!joinRows.length ? <p className="contest-empty">{mt('No organization join requests found.')}</p> : null}
        </div>
      )}
      {message ? <p className="service-message">{message}</p> : null}
    </section>
  );
}

function ManagementClusterOpsPanel({ locale }: { locale: CpproLocale }) {
  const mt = (text: string | undefined) => managementText(locale, text);
  const [registry, setRegistry] = useState<Record<string, unknown> | null>(null);
  const [cluster, setCluster] = useState<Record<string, unknown> | null>(null);
  const [deadLetters, setDeadLetters] = useState<Array<Record<string, unknown>>>([]);
  const [mode, setMode] = useState<'remote' | 'local'>('remote');
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const loadCluster = () => {
    setLoading(true);
    setMessage('');
    Promise.allSettled([
      cpproApiFetch<Record<string, unknown>>('/admin/judge/registry'),
      cpproApiFetch<Record<string, unknown>>('/admin/cluster/nodes'),
      cpproApiFetch<unknown>('/admin/judge-jobs/dead-letter?limit=20'),
    ])
      .then(([registryResult, clusterResult, deadLetterResult]) => {
        if (registryResult.status === 'fulfilled') setRegistry(registryResult.value);
        if (clusterResult.status === 'fulfilled') setCluster(clusterResult.value);
        if (deadLetterResult.status === 'fulfilled') setDeadLetters(rowsFromApi<Record<string, unknown>>(deadLetterResult.value));
        const firstError = [registryResult, clusterResult, deadLetterResult].find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined;
        if (firstError) setMessage(firstError.reason instanceof Error ? firstError.reason.message : mt('Some cluster data could not be loaded.'));
      })
      .finally(() => setLoading(false));
  };
  useEffect(loadCluster, []);
  const toggleDrain = async (enabled: boolean) => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await cpproApiFetch('/admin/judge/drain', { method: 'POST', body: JSON.stringify({ enabled }) });
      setMessage(enabled ? mt('Fleet drain enabled.') : mt('Fleet drain disabled.'));
      loadCluster();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('Could not toggle judge drain.'));
    } finally {
      setBusy(false);
    }
  };
  const drainWorker = async (workerId: string, enabled: boolean) => {
    if (busy || !workerId) return;
    setBusy(true);
    setMessage('');
    try {
      await cpproApiFetch(`/admin/judge/workers/${encodeURIComponent(workerId)}/drain`, { method: 'POST', body: JSON.stringify({ enabled }) });
      setMessage(enabled ? mt('Worker drain enabled.') : mt('Worker drain disabled.'));
      loadCluster();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('Could not toggle worker drain.'));
    } finally {
      setBusy(false);
    }
  };
  const createEnrollment = async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const payload = await cpproApiFetch<Record<string, unknown>>('/admin/cluster/enrollments', {
        method: 'POST',
        body: JSON.stringify({ mode, count }),
      });
      const enrollment = payload.enrollment && typeof payload.enrollment === 'object' ? payload.enrollment as Record<string, unknown> : payload;
      setMessage(`${mt('Enrollment created.')} ${String(enrollment.command || enrollment.code || '')}`);
      loadCluster();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('Could not create judge enrollment.'));
    } finally {
      setBusy(false);
    }
  };
  const retryDeadLetter = async (row: Record<string, unknown>) => {
    const id = row.id || row.job_id || row.jobId;
    if (busy || !id) return;
    setBusy(true);
    setMessage('');
    try {
      await cpproApiFetch(`/admin/judge-jobs/${encodeURIComponent(String(id))}/retry`, { method: 'POST' });
      setDeadLetters((current) => current.filter((item) => String(item.id || item.job_id || item.jobId) !== String(id)));
      setMessage(mt('Dead-letter job retried.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('Could not retry dead-letter job.'));
    } finally {
      setBusy(false);
    }
  };
  const workers = rowsFromApi<Record<string, unknown>>({ rows: registry?.workers || [] });
  const enrollments = rowsFromApi<Record<string, unknown>>({ rows: cluster?.enrollments || [] });
  const drain = registry?.drain && typeof registry.drain === 'object' ? registry.drain as Record<string, unknown> : {};
  return (
    <section className="cppro-management-form-card cppro-management-ops-panel" data-management-cluster-ops>
      <header>
        <div>
          <span className="home-chip"><Server size={14} />{mt('Judge cluster')}</span>
          <h3>{mt('Worker operations')}</h3>
          <p>{workers.length.toLocaleString('vi-VN')} {mt('workers')} · {Number(registry?.queueDepth || 0).toLocaleString('vi-VN')} {mt('queued jobs')}</p>
        </div>
        <button className="soft-button" type="button" disabled={loading} onClick={loadCluster}><RefreshCw size={14} />{mt('Refresh')}</button>
      </header>
      <div className="cppro-management-ops-grid">
        <article><strong>{workers.length}</strong><small>{mt('Workers online')}</small></article>
        <article><strong>{Number(registry?.queueDepth || 0)}</strong><small>{mt('Queue depth')}</small></article>
        <article><strong>{deadLetters.length}</strong><small>{mt('Dead-letter jobs')}</small></article>
        <article><strong>{drain.enabled ? mt('On') : mt('Off')}</strong><small>{mt('Fleet drain')}</small></article>
      </div>
      <div className="cppro-management-ops-actions">
        <button className="soft-button" type="button" disabled={busy} onClick={() => void toggleDrain(true)}><Shield size={14} />{mt('Enable drain')}</button>
        <button className="blue-button" type="button" disabled={busy} onClick={() => void toggleDrain(false)}><CheckCircle2 size={14} />{mt('Resume judging')}</button>
        <label><span>{mt('Enrollment mode')}</span><select value={mode} onChange={(event) => setMode(event.currentTarget.value === 'local' ? 'local' : 'remote')}><option value="remote">remote</option><option value="local">local</option></select></label>
        <label><span>{mt('Worker count')}</span><input type="number" min="1" max="50" value={count} onChange={(event) => setCount(Math.max(1, Math.min(50, Number(event.currentTarget.value) || 1)))} /></label>
        <button className="blue-button" type="button" disabled={busy} onClick={() => void createEnrollment()}><Plus size={14} />{mt('Create enrollment')}</button>
      </div>
      {loading ? <DataLoadingPanel label={mt('Loading judge cluster')} rows={3} compact /> : null}
      <div className="cppro-management-record-list">
        {workers.slice(0, 8).map((worker) => {
          const workerId = String(worker.workerId || worker.worker_id || worker.id || '');
          return (
            <article key={workerId || JSON.stringify(worker)}>
              <span>
                <strong>{workerId || mt('Judge worker')}</strong>
                <small>{String(worker.hostname || worker.host || worker.platform || '')} · {Number(worker.runningJobs || worker.running_jobs || 0)} running · {Number(worker.concurrency || 1)} slots</small>
              </span>
              <button className="soft-button" type="button" disabled={busy || !workerId} onClick={() => void drainWorker(workerId, true)}>{mt('Drain')}</button>
              <button className="blue-button" type="button" disabled={busy || !workerId} onClick={() => void drainWorker(workerId, false)}>{mt('Resume')}</button>
            </article>
          );
        })}
        {deadLetters.slice(0, 6).map((job) => (
          <article key={String(job.id || job.job_id || job.jobId)}>
            <span>
              <strong>{mt('Dead-letter job')} #{String(job.id || job.job_id || job.jobId)}</strong>
              <small>{String(job.problem_title || job.problem_id || '')} · {String(job.verdict || job.status || '')}</small>
            </span>
            <button className="management-danger-action" type="button" disabled={busy} onClick={() => void retryDeadLetter(job)}><RefreshCw size={14} />{mt('Retry')}</button>
          </article>
        ))}
        {enrollments.slice(0, 4).map((enrollment) => (
          <article key={String(enrollment.code || enrollment.workerId || enrollment.createdAt)}>
            <span>
              <strong>{String(enrollment.code || enrollment.workerId || mt('Enrollment'))}</strong>
              <small>{String(enrollment.status || '')} · {String(enrollment.mode || '')}</small>
            </span>
            <code>{String(enrollment.command || '')}</code>
          </article>
        ))}
      </div>
      {message ? <p className="service-message">{message}</p> : null}
    </section>
  );
}

function ManagementBadgeSetupPanel({ locale }: { locale: CpproLocale }) {
  const mt = (text: string | undefined) => managementText(locale, text);
  const emptyDraft = {
    name: '',
    slug: '',
    description: '',
    iconUrl: '',
    color: '#0ea5e9',
    backgroundColor: '#e0f2fe',
    sortOrder: 100,
    active: true,
  };
  const [badges, setBadges] = useState<Array<Record<string, unknown>>>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState('');
  const loadBadges = () => {
    setLoading(true);
    setMessage('');
    cpproApiFetch<unknown>('/admin/badges')
      .then((payload) => setBadges(rowsFromApi<Record<string, unknown>>(payload)))
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Could not load badges.'))
      .finally(() => setLoading(false));
  };
  useEffect(loadBadges, []);
  const patchDraft = (patch: Partial<typeof emptyDraft>) => {
    setDraft((current) => {
      const next = { ...current, ...patch };
      if (patch.name !== undefined && !editingId && !current.slug.trim()) {
        next.slug = String(patch.name)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 80);
      }
      return next;
    });
  };
  const resetDraft = () => {
    setDraft(emptyDraft);
    setEditingId(null);
  };
  const editBadge = (badge: Record<string, unknown>) => {
    setEditingId(badge.id as string | number);
    setDraft({
      name: String(badge.name || ''),
      slug: String(badge.slug || ''),
      description: String(badge.description || ''),
      iconUrl: String(badge.icon_url || badge.iconUrl || ''),
      color: String(badge.color || '#0ea5e9'),
      backgroundColor: String(badge.background_color || badge.backgroundColor || '#e0f2fe'),
      sortOrder: Number(badge.sort_order ?? badge.sortOrder ?? 100) || 100,
      active: badge.active === undefined ? true : Boolean(badge.active),
    });
  };
  const saveBadge = async () => {
    if (saving || !draft.name.trim()) return;
    setSaving(true);
    setMessage('');
    const body = {
      name: draft.name.trim(),
      slug: draft.slug.trim() || draft.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      description: draft.description.trim() || null,
      iconUrl: draft.iconUrl.trim() || null,
      color: draft.color,
      backgroundColor: draft.backgroundColor,
      sortOrder: Number(draft.sortOrder) || 100,
      active: draft.active,
    };
    try {
      await cpproApiFetch(editingId ? `/admin/badges/${encodeURIComponent(String(editingId))}` : '/admin/badges', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      });
      setMessage(editingId ? 'Badge updated.' : 'Badge created.');
      resetDraft();
      loadBadges();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save badge.');
    } finally {
      setSaving(false);
    }
  };
  const deleteBadge = async (badge: Record<string, unknown>) => {
    const id = badge.id;
    if (!id || !window.confirm(`Delete badge "${String(badge.name || badge.slug || id)}"?`)) return;
    setMessage('');
    try {
      await cpproApiFetch(`/admin/badges/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
      setBadges((current) => current.filter((item) => String(item.id) !== String(id)));
      setMessage('Badge deleted.');
      if (String(editingId || '') === String(id)) resetDraft();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete badge.');
    }
  };
  const deleteAllBadges = async () => {
    if (clearing || !badges.length) return;
    if (!window.confirm(`Delete all ${badges.length.toLocaleString('vi-VN')} database badge(s)? This also removes every assignment.`)) return;
    setClearing(true);
    setMessage('');
    try {
      await cpproApiFetch('/admin/badges', { method: 'DELETE' });
      setBadges([]);
      resetDraft();
      setMessage('All database badges were deleted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete all badges.');
    } finally {
      setClearing(false);
    }
  };
  return (
    <section className="cppro-management-badge-setup" data-management-badge-setup>
      <header>
        <span><Medal size={18} />{mt('Badge setup')}</span>
        <div>
          <button className="soft-button" type="button" disabled={loading || clearing} onClick={loadBadges}><Loader2 size={14} />{mt('Refresh')}</button>
          <button className="management-danger-action" type="button" disabled={loading || clearing || !badges.length} onClick={() => void deleteAllBadges()}><X size={14} />{clearing ? mt('Deleting...') : mt('Delete all badges')}</button>
        </div>
      </header>
      <div className="cppro-management-badge-crud" data-management-badge-crud>
        <section>
          <h3>{editingId ? mt('Edit badge') : mt('Create badge')}</h3>
          <div className="cppro-management-fields two-columns">
            <label><span>{mt('Name')}</span><input value={draft.name} onChange={(event) => patchDraft({ name: event.currentTarget.value })} placeholder="Ultra Max" /></label>
            <label><span>{mt('Slug')}</span><input value={draft.slug} onChange={(event) => patchDraft({ slug: event.currentTarget.value })} placeholder="ultra-max" /></label>
            <label><span>{mt('Color')}</span><input type="color" value={draft.color} onChange={(event) => patchDraft({ color: event.currentTarget.value })} /></label>
            <label><span>{mt('Background')}</span><input type="color" value={draft.backgroundColor} onChange={(event) => patchDraft({ backgroundColor: event.currentTarget.value })} /></label>
            <label><span>{mt('Icon URL')}</span><input value={draft.iconUrl} onChange={(event) => patchDraft({ iconUrl: event.currentTarget.value })} placeholder="/assets/badges/admin.svg" /></label>
            <label><span>{mt('Sort order')}</span><input type="number" value={draft.sortOrder} onChange={(event) => patchDraft({ sortOrder: Number(event.currentTarget.value) || 0 })} /></label>
          </div>
          <label className="cppro-management-field-wide"><span>{mt('Description')}</span><textarea rows={3} value={draft.description} onChange={(event) => patchDraft({ description: event.currentTarget.value })} /></label>
          <label className="cppro-management-check-field"><input type="checkbox" checked={draft.active} onChange={(event) => patchDraft({ active: event.currentTarget.checked })} /><span>{mt('Active badge')}</span></label>
          <footer>
            <button className="soft-button" type="button" onClick={resetDraft}>{mt('Reset')}</button>
            <button className="blue-button" type="button" disabled={saving || !draft.name.trim()} onClick={() => void saveBadge()}><PenLine size={15} />{saving ? mt('Saving...') : editingId ? mt('Save badge') : mt('Add badge')}</button>
          </footer>
          {message ? <p className="service-message">{message}</p> : null}
        </section>
        <section>
          <h3>{mt('Database badges')} ({badges.length})</h3>
          {loading ? <DataLoadingPanel label={mt('Loading badges')} rows={4} compact /> : (
            <div className="cppro-management-record-list">
              {badges.map((badge) => (
                <article key={String(badge.id || badge.slug)}>
                  <span>
                    <strong>{String(badge.name || badge.slug || 'Badge')}</strong>
                    <small>{String(badge.slug || '')} · {badge.active === false ? mt('inactive') : mt('active')}</small>
                  </span>
                  <button className="soft-button" type="button" onClick={() => editBadge(badge)}><PenLine size={14} />{mt('Edit')}</button>
                  <button className="management-danger-action" type="button" onClick={() => void deleteBadge(badge)}><X size={14} />{mt('Delete')}</button>
                </article>
              ))}
              {!badges.length ? <p className="contest-empty">{mt('No badges found in database.')}</p> : null}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

const MANAGEMENT_VERDICT_ORDER = ['AC', 'CE', 'MLE', 'RE', 'TLE', 'WA'] as const;
type ManagementDashboardRange = 'day' | 'week' | 'month' | 'year';
type ManagementChartPoint = { bucket: string; verdicts: Record<string, number>; total: number };

function managementFormatDuration(seconds: number) {
  const value = Math.max(0, Number(seconds || 0));
  if (value < 60) return `${value}s`;
  if (value < 3600) return `${Math.floor(value / 60)}m`;
  return `${Math.floor(value / 3600)}h ${Math.floor((value % 3600) / 60)}m`;
}

function managementFormatChartBucket(bucket: string, range: ManagementDashboardRange, locale: CpproLocale) {
  const language = locale === 'vi' ? 'vi-VN' : 'en-US';
  const value = String(bucket || '');
  try {
    if (range === 'day') return new Date(value).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
    if (range === 'year') return new Date(`${value}-01T00:00:00Z`).toLocaleDateString(language, { month: 'short', year: '2-digit' });
    return new Date(`${value}T00:00:00Z`).toLocaleDateString(language, { month: '2-digit', day: '2-digit' });
  } catch {
    return value;
  }
}

function ManagementDashboardInsights({ locale, go }: { locale: CpproLocale; go: (path: string) => void }) {
  const mt = (text: string | undefined) => managementText(locale, text);
  const [range, setRange] = useState<ManagementDashboardRange>('week');
  const [points, setPoints] = useState<ManagementChartPoint[]>([]);
  const [judge, setJudge] = useState<Record<string, unknown>>({});
  const [attention, setAttention] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = (background = false) => {
      if (!background) setLoading(true);
      cpproApiFetch<Record<string, unknown>>(`/admin/dashboard?range=${range}&recentPage=1&recentLimit=1`)
        .then((payload) => {
          if (cancelled) return;
          const chart = payload.chart && typeof payload.chart === 'object' ? payload.chart as Record<string, unknown> : {};
          setPoints(Array.isArray(chart.points) ? chart.points as ManagementChartPoint[] : []);
          setJudge(payload.judge && typeof payload.judge === 'object' ? payload.judge as Record<string, unknown> : {});
          setAttention(rowsFromApi<Record<string, unknown>>(payload.attention));
          setLastUpdated(new Date().toLocaleTimeString(locale === 'vi' ? 'vi-VN' : 'en-US'));
          setMessage('');
        })
        .catch((error) => {
          if (!cancelled) setMessage(error instanceof Error ? error.message : mt('Could not load dashboard insights.'));
        })
        .finally(() => {
          if (!cancelled && !background) setLoading(false);
        });
    };
    load();
    const timer = window.setInterval(() => load(true), 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [range, locale]);

  const maxTotal = Math.max(...points.map((point) => Number(point.total || 0)), 1);
  const queueDepth = Number(judge.queueDepth ?? judge.queue_depth ?? 0) || 0;
  const queueLimit = Number(judge.queueLimit ?? judge.queue_limit ?? 0) || 0;
  const judgeMetrics = [
    { icon: <Server size={16} />, label: mt('Workers'), value: Number(judge.workersOnline ?? judge.workers_online ?? 0).toLocaleString('vi-VN') },
    { icon: <Gauge size={16} />, label: mt('Parallel slots'), value: Number(judge.concurrency ?? 0).toLocaleString('vi-VN') },
    { icon: <Send size={16} />, label: mt('Redis queue'), value: `${queueDepth.toLocaleString('vi-VN')} / ${queueLimit ? queueLimit.toLocaleString('vi-VN') : '∞'}` },
    { icon: <RefreshCw size={16} />, label: mt('Running'), value: Number(judge.running ?? 0).toLocaleString('vi-VN') },
    { icon: <TimerReset size={16} />, label: mt('Retries'), value: Number(judge.retries ?? 0).toLocaleString('vi-VN') },
    { icon: <AlertTriangle size={16} />, label: mt('Failed / dead letter'), value: (Number(judge.failed ?? 0) + Number(judge.deadLetter ?? judge.dead_letter ?? 0)).toLocaleString('vi-VN') },
    { icon: <Clock size={16} />, label: mt('Oldest queued'), value: managementFormatDuration(Number(judge.oldestQueuedSeconds ?? judge.oldest_queued_seconds ?? 0)) },
  ];
  const rangeLabels: Record<ManagementDashboardRange, string> = {
    day: mt('Day'), week: mt('Week'), month: mt('Month'), year: mt('Year'),
  };

  return (
    <section className="cppro-management-form-card cppro-management-ops-panel cppro-dash-insights" data-management-dashboard-insights>
      <header>
        <div>
          <span className="home-chip"><Server size={14} />{mt('Judge capacity')}</span>
          <h3>{mt('Live judge and submission insights')}</h3>
          <p>{lastUpdated ? `${mt('Realtime data')} · ${lastUpdated}` : mt('Live metrics, queue health and submission trends.')}</p>
        </div>
      </header>
      <div className="cppro-management-ops-grid cppro-dash-judge-grid">
        {judgeMetrics.map((metric) => (
          <article key={metric.label}><span className="cppro-dash-judge-label">{metric.icon}{metric.label}</span><strong>{metric.value}</strong></article>
        ))}
      </div>
      <div className="cppro-dash-chart-panel">
        <div className="cppro-dash-chart-head">
          <div>
            <ChartColumn size={16} />
            <strong>{mt('Submissions')} — {rangeLabels[range]}</strong>
          </div>
          <div className="cppro-dash-range" role="group" aria-label={mt('Chart range')}>
            {(Object.keys(rangeLabels) as ManagementDashboardRange[]).map((value) => (
              <button key={value} type="button" className={range === value ? 'active' : ''} disabled={loading} onClick={() => setRange(value)}>{rangeLabels[value]}</button>
            ))}
          </div>
        </div>
        <div className="cppro-dash-legend">
          {MANAGEMENT_VERDICT_ORDER.map((verdict) => (
            <span key={verdict}><i data-verdict={verdict.toLowerCase()} />{verdict}</span>
          ))}
        </div>
        {loading ? (
          <DataLoadingPanel label={mt('Loading submission chart')} rows={3} compact />
        ) : points.length === 0 ? (
          <p className="contest-empty">{mt('No submissions in this range.')}</p>
        ) : (
          <div className="cppro-dash-chart-scroll">
            <div className="cppro-dash-chart" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(18px, 1fr))` }}>
              {points.map((point, index) => (
                <div key={`${point.bucket}-${index}`} className="cppro-dash-chart-col">
                  <div className="cppro-dash-chart-stack" title={`${managementFormatChartBucket(point.bucket, range, locale)} · ${Number(point.total || 0)}`}>
                    {MANAGEMENT_VERDICT_ORDER.map((verdict) => {
                      const count = Number(point.verdicts?.[verdict] || 0);
                      if (count <= 0) return null;
                      return <span key={verdict} data-verdict={verdict.toLowerCase()} style={{ height: `${Math.max((count / maxTotal) * 100, 3)}%` }} />;
                    })}
                    {Number(point.total || 0) === 0 ? <span className="cppro-dash-chart-empty" /> : null}
                  </div>
                  <small>{managementFormatChartBucket(point.bucket, range, locale)}</small>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="cppro-dash-attention">
        <div className="cppro-dash-attention-head">
          <AlertTriangle size={15} />
          <strong>{mt('Needs attention')}</strong>
          <span className="management-status management-status-warning">{attention.length}</span>
        </div>
        {attention.length === 0 ? (
          <p className="contest-empty">{mt('No problems need attention.')}</p>
        ) : (
          <div className="cppro-management-record-list">
            {attention.slice(0, 8).map((problem) => {
              const id = problem.id ?? problem.external_id ?? problem.externalId;
              return (
                <article key={String(id)}>
                  <span>
                    <strong>{String(problem.title || problem.external_id || `#${id}`)}</strong>
                    <small>{String(problem.reason || mt('Review required'))} · {Number(problem.testcase_count ?? problem.testcaseCount ?? 0)} {mt('testcases')}</small>
                  </span>
                  <button className="soft-button" type="button" disabled={!id} onClick={() => go(`/management/problems/${encodeURIComponent(String(id))}`)}><Eye size={14} />{mt('Open')}</button>
                </article>
              );
            })}
          </div>
        )}
      </div>
      {message ? <p className="service-message">{message}</p> : null}
    </section>
  );
}

type ManagementAnalyticsDist = { total: number; items: Array<{ label: string; count: number; percent: number }> };
type ManagementAnalyticsDay = { date: string; count: number };
type ManagementAnalyticsData = {
  generatedAt?: string;
  windowDays?: number;
  totals?: Record<string, number>;
  verdictDistribution?: ManagementAnalyticsDist;
  languageBreakdown?: ManagementAnalyticsDist;
  problemKinds?: ManagementAnalyticsDist;
  submissionsByDay?: ManagementAnalyticsDay[];
  newUsersByDay?: ManagementAnalyticsDay[];
  topProblems?: Array<{ id: number; external_id?: string; title: string; submissions: number; accepted: number; solvers: number }>;
  topUsers?: Array<{ id: number; username: string; solved: number; submissions: number }>;
};

function managementCsvEscape(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function ManagementAnalyticsDistPanel({ title, dist }: { title: string; dist?: ManagementAnalyticsDist }) {
  const items = dist?.items || [];
  const max = Math.max(1, ...items.map((item) => Number(item.count || 0)));
  return (
    <div className="cppro-analytics-dist">
      <h4>{title}</h4>
      {items.length === 0 ? <p className="contest-empty">—</p> : (
        <div className="cppro-analytics-dist-list">
          {items.slice(0, 12).map((item) => (
            <div key={item.label} className="cppro-analytics-dist-row">
              <div><code>{item.label}</code><span>{Number(item.count || 0).toLocaleString('vi-VN')} ({item.percent}%)</span></div>
              <i><b style={{ width: `${Math.round((Number(item.count || 0) / max) * 100)}%` }} /></i>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ManagementAnalyticsBarChart({ title, series }: { title: string; series?: ManagementAnalyticsDay[] }) {
  const rows = series || [];
  const max = Math.max(1, ...rows.map((row) => Number(row.count || 0)));
  return (
    <div className="cppro-analytics-bars">
      <h4>{title}</h4>
      <div className="cppro-analytics-bars-track">
        {rows.map((row) => (
          <span key={row.date} title={`${row.date}: ${Number(row.count || 0)}`} style={{ height: `${Math.max(2, Math.round((Number(row.count || 0) / max) * 100))}%` }} />
        ))}
      </div>
      <div className="cppro-analytics-bars-axis"><span>{rows[0]?.date?.slice(5)}</span><span>{rows[rows.length - 1]?.date?.slice(5)}</span></div>
    </div>
  );
}

function ManagementAnalyticsPanel({ locale }: { locale: CpproLocale }) {
  const mt = (text: string | undefined) => managementText(locale, text);
  const [days, setDays] = useState(30);
  const [data, setData] = useState<ManagementAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cpproApiFetch<ManagementAnalyticsData>(`/admin/analytics?days=${days}`)
      .then((payload) => { if (!cancelled) { setData(payload); setMessage(''); } })
      .catch((error) => { if (!cancelled) setMessage(error instanceof Error ? error.message : mt('Could not load analytics.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  const totals = data?.totals || {};
  const exportCsv = () => {
    if (!data) return;
    const lines: string[] = [];
    lines.push('Metric,Value');
    Object.entries(totals).forEach(([key, value]) => lines.push(`${managementCsvEscape(key)},${managementCsvEscape(value)}`));
    lines.push('', 'Verdict,Count,Percent');
    (data.verdictDistribution?.items || []).forEach((item) => lines.push(`${managementCsvEscape(item.label)},${item.count},${item.percent}`));
    lines.push('', 'Language,Count,Percent');
    (data.languageBreakdown?.items || []).forEach((item) => lines.push(`${managementCsvEscape(item.label)},${item.count},${item.percent}`));
    lines.push('', 'Top Problem,Submissions,Accepted,Solvers');
    (data.topProblems || []).forEach((problem) => lines.push(`${managementCsvEscape(problem.title)},${problem.submissions},${problem.accepted},${problem.solvers}`));
    lines.push('', 'Top User,Solved,Submissions');
    (data.topUsers || []).forEach((row) => lines.push(`${managementCsvEscape(row.username)},${row.solved},${row.submissions}`));
    lines.push('', 'Date,Submissions');
    (data.submissionsByDay || []).forEach((row) => lines.push(`${row.date},${row.count}`));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `itcoder-analytics-${(data.generatedAt || new Date().toISOString()).slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const metricCards = [
    { label: mt('Users'), value: Number(totals.users || 0).toLocaleString('vi-VN'), meta: `${Number(totals.active_users_30d || 0).toLocaleString('vi-VN')} ${mt('active')}` },
    { label: mt('Problems'), value: Number(totals.problems || 0).toLocaleString('vi-VN'), meta: `${Number(totals.contests || 0).toLocaleString('vi-VN')} ${mt('contests')}` },
    { label: mt('Submissions'), value: Number(totals.submissions || 0).toLocaleString('vi-VN'), meta: `${Number(totals.submissions_24h || 0).toLocaleString('vi-VN')} ${mt('last 24h')}` },
    { label: mt('Acceptance rate'), value: `${Number(totals.acceptanceRate || 0)}%`, meta: `${Number(totals.accepted || 0).toLocaleString('vi-VN')} ${mt('accepted')}` },
  ];

  return (
    <section className="cppro-management-form-card cppro-management-ops-panel cppro-analytics-panel" data-management-analytics-panel>
      <header>
        <div>
          <span className="home-chip"><ChartColumn size={14} />{mt('Analytics')}</span>
          <h3>{mt('Reporting and platform trends')}</h3>
          <p>{data?.generatedAt ? `${mt('Generated')}: ${new Date(data.generatedAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} · ${data.windowDays || days}d` : mt('Distributions, daily trends and top performers.')}</p>
        </div>
        <div className="cppro-analytics-controls">
          <select value={days} onChange={(event) => setDays(Number(event.currentTarget.value) || 30)}>
            <option value={7}>7 {mt('days')}</option>
            <option value={30}>30 {mt('days')}</option>
            <option value={90}>90 {mt('days')}</option>
          </select>
          <button className="blue-button" type="button" disabled={!data} onClick={exportCsv}><Download size={14} />{mt('Export CSV')}</button>
        </div>
      </header>
      {loading ? <DataLoadingPanel label={mt('Loading analytics')} rows={4} compact /> : (
        <>
          <div className="cppro-management-ops-grid cppro-analytics-cards">
            {metricCards.map((card) => (
              <article key={card.label}><span className="cppro-dash-judge-label">{card.label}</span><strong>{card.value}</strong><small>{card.meta}</small></article>
            ))}
          </div>
          <div className="cppro-analytics-charts">
            <ManagementAnalyticsBarChart title={mt('Submissions per day')} series={data?.submissionsByDay} />
            <ManagementAnalyticsBarChart title={mt('New users per day')} series={data?.newUsersByDay} />
          </div>
          <div className="cppro-analytics-dists">
            <ManagementAnalyticsDistPanel title={mt('Verdict distribution')} dist={data?.verdictDistribution} />
            <ManagementAnalyticsDistPanel title={mt('Languages')} dist={data?.languageBreakdown} />
            <ManagementAnalyticsDistPanel title={mt('Problem types')} dist={data?.problemKinds} />
          </div>
          <div className="cppro-analytics-tops">
            <div className="cppro-analytics-top">
              <h4><ChartColumn size={15} />{mt('Most-attempted problems')}</h4>
              <div className="cppro-management-record-list">
                {(data?.topProblems || []).length === 0 ? <p className="contest-empty">{mt('No data yet.')}</p> : (data?.topProblems || []).map((problem) => (
                  <article key={problem.id}>
                    <span><strong>{problem.title}</strong><small>{Number(problem.submissions || 0).toLocaleString('vi-VN')} {mt('submissions')} · {Number(problem.solvers || 0).toLocaleString('vi-VN')} {mt('solvers')}</small></span>
                  </article>
                ))}
              </div>
            </div>
            <div className="cppro-analytics-top">
              <h4><Trophy size={15} />{mt('Top solvers')}</h4>
              <div className="cppro-management-record-list">
                {(data?.topUsers || []).length === 0 ? <p className="contest-empty">{mt('No data yet.')}</p> : (data?.topUsers || []).map((row, index) => (
                  <article key={row.id}>
                    <span><strong>#{index + 1} @{row.username}</strong><small>{Number(row.submissions || 0).toLocaleString('vi-VN')} {mt('submissions')}</small></span>
                    <b className="management-status management-status-published">{Number(row.solved || 0).toLocaleString('vi-VN')} {mt('solved')}</b>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      {message ? <p className="service-message">{message}</p> : null}
    </section>
  );
}

function ManagementBadgeAwardPanel({ locale }: { locale: CpproLocale }) {
  const mt = (text: string | undefined) => managementText(locale, text);
  const [badges, setBadges] = useState<Array<Record<string, unknown>>>([]);
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);
  const [assignments, setAssignments] = useState<Array<Record<string, unknown>>>([]);
  const [selectedBadgeId, setSelectedBadgeId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      cpproApiFetch<unknown>('/admin/badges'),
      cpproApiFetch<unknown>('/admin/users?page=1&limit=200&withCount=true'),
    ]).then(([badgeResult, userResult]) => {
      if (cancelled) return;
      if (badgeResult.status === 'fulfilled') {
        const rows = rowsFromApi<Record<string, unknown>>(badgeResult.value);
        setBadges(rows);
        setSelectedBadgeId((current) => current || String(rows[0]?.id ?? ''));
      }
      if (userResult.status === 'fulfilled') setUsers(rowsFromApi<Record<string, unknown>>(userResult.value));
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedBadgeId) { setAssignments([]); return; }
    let cancelled = false;
    cpproApiFetch<unknown>(`/admin/badges/${encodeURIComponent(selectedBadgeId)}/assignments`)
      .then((payload) => { if (!cancelled) setAssignments(rowsFromApi<Record<string, unknown>>(payload)); })
      .catch(() => { if (!cancelled) setAssignments([]); });
    return () => { cancelled = true; };
  }, [selectedBadgeId]);

  const filteredUsers = useMemo(() => {
    const needle = userQuery.trim().toLowerCase();
    if (!needle) return users.slice(0, 200);
    return users.filter((row) => `${row.username || ''} ${row.full_name || row.fullName || ''} ${row.email || ''}`.toLowerCase().includes(needle)).slice(0, 200);
  }, [users, userQuery]);
  const selectedBadge = badges.find((badge) => String(badge.id) === selectedBadgeId) || null;

  const reloadAssignments = async () => {
    if (!selectedBadgeId) return;
    try {
      const payload = await cpproApiFetch<unknown>(`/admin/badges/${encodeURIComponent(selectedBadgeId)}/assignments`);
      setAssignments(rowsFromApi<Record<string, unknown>>(payload));
    } catch { /* ignore */ }
  };
  const awardBadge = async () => {
    if (busy || !selectedBadgeId || !selectedUserId) return;
    setBusy(true);
    setMessage('');
    try {
      await cpproApiFetch(`/admin/badges/${encodeURIComponent(selectedBadgeId)}/assignments`, {
        method: 'POST',
        body: JSON.stringify({ userId: Number(selectedUserId), note: note.trim() }),
      });
      setSelectedUserId('');
      setNote('');
      setMessage(mt('Badge awarded.'));
      await reloadAssignments();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('Could not award badge.'));
    } finally {
      setBusy(false);
    }
  };
  const removeAssignment = async (userId: unknown) => {
    if (busy || !selectedBadgeId || !userId) return;
    setBusy(true);
    setMessage('');
    try {
      await cpproApiFetch(`/admin/badges/${encodeURIComponent(selectedBadgeId)}/assignments/${encodeURIComponent(String(userId))}`, { method: 'DELETE' });
      setAssignments((current) => current.filter((item) => String(item.user_id ?? item.userId) !== String(userId)));
      setMessage(mt('Badge removed.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('Could not remove badge.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="cppro-management-form-card cppro-management-ops-panel" data-management-badge-award>
      <header>
        <div>
          <span className="home-chip"><UserPlus size={14} />{mt('Award badge')}</span>
          <h3>{selectedBadge ? String(selectedBadge.name || selectedBadge.slug) : mt('Assign badges to users')}</h3>
          <p>{assignments.length.toLocaleString('vi-VN')} {mt('users hold this badge.')}</p>
        </div>
      </header>
      <div className="cppro-management-ops-actions">
        <label><span>{mt('Badge')}</span>
          <select value={selectedBadgeId} onChange={(event) => setSelectedBadgeId(event.currentTarget.value)}>
            <option value="">{mt('Select badge...')}</option>
            {badges.map((badge) => <option key={String(badge.id)} value={String(badge.id)}>{String(badge.name || badge.slug || badge.id)}</option>)}
          </select>
        </label>
        <label><span>{mt('User')}</span>
          <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.currentTarget.value)}>
            <option value="">{mt('Select user...')}</option>
            {filteredUsers.map((row) => <option key={String(row.id)} value={String(row.id)}>@{String(row.username)}{row.full_name || row.fullName ? ` · ${String(row.full_name || row.fullName)}` : ''}</option>)}
          </select>
        </label>
        <button className="blue-button" type="button" disabled={busy || !selectedBadgeId || !selectedUserId} onClick={() => void awardBadge()}><UserPlus size={14} />{mt('Award')}</button>
      </div>
      <div className="cppro-management-fields">
        <label><span>{mt('Filter users')}</span><input value={userQuery} onChange={(event) => setUserQuery(event.currentTarget.value)} placeholder={mt('Filter by username, name or email...')} /></label>
        <label><span>{mt('Award note (optional)')}</span><input value={note} onChange={(event) => setNote(event.currentTarget.value)} placeholder={mt('Reason or context for this award')} /></label>
      </div>
      <div className="cppro-management-record-list cppro-badge-award-list">
        {assignments.length === 0 ? <p className="contest-empty">{mt('No users have this badge yet.')}</p> : assignments.map((assignment) => (
          <article key={String(assignment.user_id ?? assignment.userId)}>
            <span>
              <strong>@{String(assignment.username || assignment.user_id)}</strong>
              <small>{String(assignment.note || assignment.full_name || assignment.fullName || mt('Awarded user'))}{assignment.awarded_at ? ` · ${formatDate(String(assignment.awarded_at))}` : ''}</small>
            </span>
            <button className="management-danger-action" type="button" disabled={busy} onClick={() => void removeAssignment(assignment.user_id ?? assignment.userId)}><X size={14} />{mt('Remove')}</button>
          </article>
        ))}
      </div>
      {message ? <p className="service-message">{message}</p> : null}
    </section>
  );
}

type ManagementReasonDialogState = { title: string; description: string; tone: 'danger' | 'primary'; note: string; required: boolean; onConfirm: (note: string) => void | Promise<void> } | null;

function ManagementReasonDialog({ state, busy, locale, onClose }: { state: ManagementReasonDialogState; busy: boolean; locale: CpproLocale; onClose: () => void }) {
  const mt = (text: string | undefined) => managementText(locale, text);
  const [note, setNote] = useState('');
  useEffect(() => { setNote(state?.note || ''); }, [state]);
  if (!state) return null;
  return (
    <BodyPortal>
      <div className="cppro-management-edit-overlay cppro-management-confirm-overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) onClose(); }}>
        <section className="cppro-management-confirm-dialog cppro-management-reason-dialog" role="dialog" aria-modal="true" aria-label={mt(state.title)}>
          <header>
            <span className="home-chip">{state.tone === 'danger' ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}{mt(state.title)}</span>
            <button type="button" aria-label={mt('Close')} disabled={busy} onClick={onClose}><X size={18} /></button>
          </header>
          <div>
            <p>{mt(state.description)}</p>
            <textarea autoFocus maxLength={500} value={note} onChange={(event) => setNote(event.currentTarget.value)} placeholder={mt('Write an evidence-backed reason for the audit record...')} />
            <small>{note.trim().length}/500</small>
          </div>
          <footer>
            <button className="soft-button" type="button" disabled={busy} onClick={onClose}>{mt('Cancel')}</button>
            <button className={state.tone === 'danger' ? 'management-danger-action' : 'blue-button'} type="button" disabled={busy || (state.required && !note.trim())} onClick={() => void state.onConfirm(note.trim())}>
              {state.tone === 'danger' ? <ShieldAlert size={15} /> : <ShieldCheck size={15} />}{busy ? mt('Saving...') : mt('Confirm')}
            </button>
          </footer>
        </section>
      </div>
    </BodyPortal>
  );
}

function ManagementUserModerationPanel({ locale, currentUser }: { locale: CpproLocale; currentUser: StoredCpproUser | null }) {
  const mt = (text: string | undefined) => managementText(locale, text);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [message, setMessage] = useState('');
  const [dialog, setDialog] = useState<ManagementReasonDialogState>(null);

  const loadUsers = () => {
    setLoading(true);
    cpproApiFetch<unknown>('/admin/users?page=1&limit=200&withCount=true')
      .then((payload) => { setRows(rowsFromApi<Record<string, unknown>>(payload)); setMessage(''); })
      .catch((error) => setMessage(error instanceof Error ? error.message : mt('Could not load users.')))
      .finally(() => setLoading(false));
  };
  useEffect(loadUsers, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const base = needle ? rows.filter((row) => `${row.username || ''} ${row.full_name || ''} ${row.email || ''} ${row.role || ''}`.toLowerCase().includes(needle)) : rows;
    return base.slice(0, 40);
  }, [rows, query]);

  const banUser = (row: Record<string, unknown>) => {
    setDialog({
      title: 'Ban account', description: `@${String(row.username)} — ${mt('This reason is shown to the account owner when access is blocked.')}`, tone: 'danger', note: String(row.ban_reason || ''), required: true,
      onConfirm: async (note) => {
        setBusyId(row.id as string | number);
        try {
          await cpproApiFetch(`/admin/users/${encodeURIComponent(String(row.id))}`, { method: 'PATCH', body: JSON.stringify({ isBanned: true, banReason: note }) });
          setRows((current) => current.map((item) => String(item.id) === String(row.id) ? { ...item, is_banned: true, ban_reason: note } : item));
          setMessage(mt('Account banned.'));
          setDialog(null);
        } catch (error) {
          setMessage(error instanceof Error ? error.message : mt('Could not update account status.'));
        } finally {
          setBusyId(null);
        }
      },
    });
  };
  const unbanUser = async (row: Record<string, unknown>) => {
    setBusyId(row.id as string | number);
    setMessage('');
    try {
      await cpproApiFetch(`/admin/users/${encodeURIComponent(String(row.id))}`, { method: 'PATCH', body: JSON.stringify({ isBanned: false, banReason: '' }) });
      setRows((current) => current.map((item) => String(item.id) === String(row.id) ? { ...item, is_banned: false, ban_reason: '' } : item));
      setMessage(mt('Account unbanned.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('Could not update account status.'));
    } finally {
      setBusyId(null);
    }
  };
  const impersonateUser = (row: Record<string, unknown>) => {
    setDialog({
      title: 'View as user', description: `@${String(row.username)} — ${mt('This creates a short admin impersonation session and records an audit log entry.')}`, tone: 'primary', note: '', required: true,
      onConfirm: async (note) => {
        if (note.trim().length < 6) { setMessage(mt('Enter at least 6 characters for the audit reason.')); return; }
        setBusyId(row.id as string | number);
        try {
          const data = await cpproApiFetch<{ token: string; user: AuthUser }>(`/admin/users/${encodeURIComponent(String(row.id))}/impersonate`, { method: 'POST', body: JSON.stringify({ reason: note.trim() }) });
          // Preserve the current admin session so it can be restored after impersonation.
          ['oj_platform_token', 'cppro_access_token', 'oj_platform_user', 'cppro_user'].forEach((key) => {
            const value = localStorage.getItem(key);
            if (value !== null) localStorage.setItem(`${key}__admin_restore`, value);
          });
          saveCpproSession(data.token, data.user);
          window.location.assign(withCpproLocale(locale, '/'));
        } catch (error) {
          setMessage(error instanceof Error ? error.message : mt('Could not start impersonation.'));
          setBusyId(null);
        }
      },
    });
  };

  return (
    <section className="cppro-management-form-card cppro-management-ops-panel" data-management-user-moderation>
      <header>
        <div>
          <span className="home-chip"><ShieldCheck size={14} />{mt('Account moderation')}</span>
          <h3>{mt('Ban and impersonation controls')}</h3>
          <p>{mt('Guided ban-with-reason and admin impersonation with audit logging.')}</p>
        </div>
        <button className="soft-button" type="button" disabled={loading} onClick={loadUsers}><RefreshCw size={14} />{mt('Refresh')}</button>
      </header>
      <div className="cppro-management-fields">
        <label><span>{mt('Find account')}</span><input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder={mt('Filter by username, name, email or role...')} /></label>
      </div>
      {loading ? <DataLoadingPanel label={mt('Loading users')} rows={4} compact /> : (
        <div className="cppro-management-record-list">
          {filtered.length === 0 ? <p className="contest-empty">{mt('No users match this filter.')}</p> : filtered.map((row) => {
            const banned = Boolean(row.is_banned ?? row.isBanned);
            const isSelf = currentUser && String(currentUser.username) === String(row.username);
            const canImpersonate = !banned && !isSelf && String(row.role || 'user') === 'user';
            return (
              <article key={String(row.id)}>
                <span>
                  <strong>@{String(row.username)}{banned ? ` · ${mt('Banned')}` : ''}</strong>
                  <small>{String(row.full_name || row.email || '')} · {String(row.role || 'user')}{row.membership_tier && row.membership_tier !== 'free' ? ` · ${String(row.membership_tier).toUpperCase()}` : ''}</small>
                </span>
                <button className="soft-button" type="button" disabled={busyId === row.id || !canImpersonate} title={mt('View as user')} onClick={() => impersonateUser(row)}><UserCheck size={14} />{mt('Impersonate')}</button>
                {banned
                  ? <button className="blue-button" type="button" disabled={busyId === row.id} onClick={() => void unbanUser(row)}><CheckCircle2 size={14} />{mt('Unban')}</button>
                  : <button className="management-danger-action" type="button" disabled={busyId === row.id || Boolean(isSelf)} onClick={() => banUser(row)}><Ban size={14} />{mt('Ban')}</button>}
              </article>
            );
          })}
        </div>
      )}
      {message ? <p className="service-message">{message}</p> : null}
      <ManagementReasonDialog state={dialog} busy={busyId !== null} locale={locale} onClose={() => setDialog(null)} />
    </section>
  );
}

function ManagementAttendancePanel({ locale }: { locale: CpproLocale }) {
  const mt = (text: string | undefined) => managementText(locale, text);
  const attendanceFilters = ['all', 'unchecked', 'present', 'late', 'absent', 'excused', 'disqualified'] as const;
  const [contests, setContests] = useState<Array<Record<string, unknown>>>([]);
  const [contestId, setContestId] = useState('');
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<typeof attendanceFilters[number]>('all');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [message, setMessage] = useState('');
  const [dialog, setDialog] = useState<ManagementReasonDialogState>(null);

  useEffect(() => {
    let cancelled = false;
    cpproApiFetch<unknown>('/contests?limit=100')
      .then((payload) => {
        if (cancelled) return;
        const rowsData = rowsFromApi<Record<string, unknown>>(payload);
        setContests(rowsData);
        setContestId((current) => current || String(rowsData[0]?.id ?? ''));
      })
      .catch((error) => { if (!cancelled) setMessage(error instanceof Error ? error.message : mt('Could not load contests.')); });
    return () => { cancelled = true; };
  }, []);

  const loadAttendance = () => {
    if (!contestId) return;
    setLoading(true);
    setMessage('');
    const params = new URLSearchParams({ page: '1', limit: '100', withCount: 'true' });
    if (query.trim()) params.set('q', query.trim());
    if (filter !== 'all') params.set('status', filter);
    cpproApiFetch<unknown>(`/admin/contests/${encodeURIComponent(contestId)}/attendance?${params.toString()}`)
      .then((payload) => setRows(rowsFromApi<Record<string, unknown>>(payload)))
      .catch((error) => setMessage(error instanceof Error ? error.message : mt('Could not load attendance.')))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    if (!contestId) return;
    const timer = window.setTimeout(loadAttendance, 200);
    return () => window.clearTimeout(timer);
  }, [contestId, query, filter]);

  const markAttendance = (row: Record<string, unknown>, status: string) => {
    setDialog({
      title: 'Attendance note', description: `@${String(row.username)} — ${status}. ${mt('Add an optional note for audit context.')}`, tone: 'primary', note: String(row.note || ''), required: false,
      onConfirm: async (note) => {
        setBusyId(row.user_id as string | number);
        try {
          await cpproApiFetch(`/admin/contests/${encodeURIComponent(contestId)}/attendance/${encodeURIComponent(String(row.user_id))}`, { method: 'PUT', body: JSON.stringify({ status, note }) });
          setRows((current) => current.map((item) => String(item.user_id) === String(row.user_id) ? { ...item, status, note } : item));
          setMessage(mt('Attendance updated.'));
          setDialog(null);
        } catch (error) {
          setMessage(error instanceof Error ? error.message : mt('Could not update attendance.'));
        } finally {
          setBusyId(null);
        }
      },
    });
  };
  const disqualify = (row: Record<string, unknown>) => {
    setDialog({
      title: 'Disqualification reason', description: `@${String(row.username)} — ${mt('This reason is stored with the contest action.')}`, tone: 'danger', note: String(row.disqualification_reason || ''), required: true,
      onConfirm: async (reason) => {
        setBusyId(row.user_id as string | number);
        try {
          await cpproApiFetch(`/admin/contests/${encodeURIComponent(contestId)}/disqualifications/${encodeURIComponent(String(row.user_id))}`, { method: 'PUT', body: JSON.stringify({ disqualified: true, reason }) });
          setRows((current) => current.map((item) => String(item.user_id) === String(row.user_id) ? { ...item, disqualification_reason: reason } : item));
          setMessage(mt('Contestant disqualified.'));
          setDialog(null);
        } catch (error) {
          setMessage(error instanceof Error ? error.message : mt('Could not update contest status.'));
        } finally {
          setBusyId(null);
        }
      },
    });
  };
  const clearDisqualification = async (row: Record<string, unknown>) => {
    setBusyId(row.user_id as string | number);
    setMessage('');
    try {
      await cpproApiFetch(`/admin/contests/${encodeURIComponent(contestId)}/disqualifications/${encodeURIComponent(String(row.user_id))}`, { method: 'PUT', body: JSON.stringify({ disqualified: false, reason: '' }) });
      setRows((current) => current.map((item) => String(item.user_id) === String(row.user_id) ? { ...item, disqualification_reason: '' } : item));
      setMessage(mt('Disqualification cleared.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('Could not update contest status.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="cppro-management-form-card cppro-management-ops-panel" data-management-attendance-panel>
      <header>
        <div>
          <span className="home-chip"><UserCheck size={14} />{mt('Contest attendance')}</span>
          <h3>{mt('Mark attendance and disqualifications')}</h3>
          <p>{rows.length.toLocaleString('vi-VN')} {mt('contestants loaded.')}</p>
        </div>
        <button className="soft-button" type="button" disabled={loading || !contestId} onClick={loadAttendance}><RefreshCw size={14} />{mt('Refresh')}</button>
      </header>
      <div className="cppro-management-ops-actions">
        <label><span>{mt('Contest')}</span>
          <select value={contestId} onChange={(event) => setContestId(event.currentTarget.value)}>
            <option value="">{mt('Select contest')}</option>
            {contests.map((contest) => <option key={String(contest.id)} value={String(contest.id)}>{String(contest.title || contest.slug || contest.id)}</option>)}
          </select>
        </label>
        <label><span>{mt('Status')}</span>
          <select value={filter} onChange={(event) => setFilter(event.currentTarget.value as typeof attendanceFilters[number])}>
            {attendanceFilters.map((value) => <option key={value} value={value}>{mt(value.charAt(0).toUpperCase() + value.slice(1))}</option>)}
          </select>
        </label>
      </div>
      <div className="cppro-management-fields">
        <label><span>{mt('Find contestant')}</span><input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder={mt('Filter by username, name or email...')} /></label>
      </div>
      {!contestId ? <p className="contest-empty">{mt('Select a contest to manage attendance.')}</p> : loading ? <DataLoadingPanel label={mt('Loading attendance')} rows={4} compact /> : (
        <div className="cppro-management-record-list">
          {rows.length === 0 ? <p className="contest-empty">{mt('No matching contestants found.')}</p> : rows.map((row) => {
            const disqualified = Boolean(row.disqualification_reason);
            const status = String(row.status || 'unchecked');
            return (
              <article key={String(row.user_id)} className="cppro-attendance-row">
                <span>
                  <strong>@{String(row.username)}{disqualified ? ` · ${mt('Disqualified')}` : ''}</strong>
                  <small>{String(row.full_name || row.email || '')} · {Number(row.solved ?? 0)} {mt('solved')} · {Number(row.contest_submissions ?? 0)} {mt('submissions')}</small>
                </span>
                <select className="cppro-attendance-select" value={status} disabled={busyId === row.user_id} onChange={(event) => markAttendance(row, event.currentTarget.value)}>
                  <option value="unchecked" disabled>{mt('Unchecked')}</option>
                  <option value="present">{mt('Present')}</option>
                  <option value="late">{mt('Late')}</option>
                  <option value="absent">{mt('Absent')}</option>
                  <option value="excused">{mt('Excused')}</option>
                </select>
                {disqualified
                  ? <button className="blue-button" type="button" disabled={busyId === row.user_id} onClick={() => void clearDisqualification(row)}><CheckCircle2 size={14} />{mt('Clear')}</button>
                  : <button className="management-danger-action" type="button" disabled={busyId === row.user_id} onClick={() => disqualify(row)}><ShieldAlert size={14} />{mt('Disqualify')}</button>}
              </article>
            );
          })}
        </div>
      )}
      {message ? <p className="service-message">{message}</p> : null}
      <ManagementReasonDialog state={dialog} busy={busyId !== null} locale={locale} onClose={() => setDialog(null)} />
    </section>
  );
}

function ManagementIncidentReviewPanel({ locale, go }: { locale: CpproLocale; go: (path: string) => void }) {
  const mt = (text: string | undefined) => managementText(locale, text);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState('open');
  const [minScore, setMinScore] = useState('0');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [dialog, setDialog] = useState<(ManagementReasonDialogState & { disqualify?: boolean }) | null>(null);
  const [dialogDisqualify, setDialogDisqualify] = useState(false);

  const loadIncidents = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: '1', limit: '100', status, minScore });
    if (query.trim()) params.set('q', query.trim());
    cpproApiFetch<unknown>(`/admin/incidents?${params.toString()}`)
      .then((payload) => { setRows(rowsFromApi<Record<string, unknown>>(payload)); setMessage(''); })
      .catch((error) => setMessage(error instanceof Error ? error.message : mt('Could not load incident reviews.')))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const timer = window.setTimeout(loadIncidents, 200);
    return () => window.clearTimeout(timer);
  }, [status, minScore, query]);

  const openDetail = async (id: unknown) => {
    if (!id) return;
    setLoadingDetail(true);
    try {
      const detail = await cpproApiFetch<Record<string, unknown>>(`/admin/incidents/${encodeURIComponent(String(id))}`);
      setSelected(detail);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('Could not load incident evidence.'));
    } finally {
      setLoadingDetail(false);
    }
  };
  const recalculate = async () => {
    if (!selected || busy) return;
    const submissionId = selected.submission_id ?? selected.submissionId;
    setBusy(true);
    try {
      await cpproApiFetch(`/admin/submissions/${encodeURIComponent(String(submissionId))}/risk/recalculate`, { method: 'POST' });
      await openDetail(selected.id);
      loadIncidents();
      setMessage(mt('Risk signals recalculated.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('Could not recalculate risk signals.'));
    } finally {
      setBusy(false);
    }
  };
  const submitDecision = (nextStatus: 'reviewing' | 'cleared' | 'confirmed') => {
    if (!selected) return;
    setDialogDisqualify(false);
    setDialog({
      title: `Review decision: ${nextStatus}`, description: mt('Write the evidence-backed reason for this decision. The note is stored with the review record.'), tone: nextStatus === 'confirmed' ? 'danger' : 'primary', note: String(selected.note || ''), required: true,
      onConfirm: async (note) => {
        setBusy(true);
        try {
          await cpproApiFetch(`/admin/incidents/${encodeURIComponent(String(selected.id))}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus, note, disqualify: nextStatus === 'confirmed' ? dialogDisqualify : false }) });
          setMessage(`${mt('Incident marked')} ${nextStatus}.`);
          setDialog(null);
          await openDetail(selected.id);
          loadIncidents();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : mt('Could not update incident review.'));
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const signals = selected ? rowsFromApi<Record<string, unknown>>({ rows: selected.signals || [] }) : [];
  const metadata = selected?.submission_metadata && typeof selected.submission_metadata === 'object' ? selected.submission_metadata as Record<string, unknown> : {};

  return (
    <section className="cppro-management-form-card cppro-management-ops-panel cppro-incident-panel" data-management-incident-review>
      <header>
        <div>
          <span className="home-chip"><Shield size={14} />{mt('Trust and safety')}</span>
          <h3>{mt('Submission incident review')}</h3>
          <p>{mt('Risk signals are review hints only. Confirm evidence manually before taking action.')}</p>
        </div>
        <button className="soft-button" type="button" disabled={loading} onClick={loadIncidents}><RefreshCw size={14} />{mt('Refresh')}</button>
      </header>
      <div className="cppro-management-ops-actions">
        <label><span>{mt('Status')}</span>
          <select value={status} onChange={(event) => setStatus(event.currentTarget.value)}>
            <option value="all">{mt('All statuses')}</option>
            <option value="open">{mt('Open')}</option>
            <option value="reviewing">{mt('Reviewing')}</option>
            <option value="cleared">{mt('Cleared')}</option>
            <option value="confirmed">{mt('Confirmed')}</option>
          </select>
        </label>
        <label><span>{mt('Min risk')}</span>
          <select value={minScore} onChange={(event) => setMinScore(event.currentTarget.value)}>
            <option value="0">{mt('Any risk score')}</option>
            <option value="40">40+</option>
            <option value="60">60+</option>
            <option value="80">80+</option>
          </select>
        </label>
      </div>
      <div className="cppro-management-fields">
        <label><span>{mt('Search')}</span><input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder={mt('Search user, problem or submission ID')} /></label>
      </div>
      {loading ? <DataLoadingPanel label={mt('Loading incident reviews')} rows={4} compact /> : (
        <div className="cppro-management-record-list">
          {rows.length === 0 ? <p className="contest-empty">{mt('No incidents match the current filters.')}</p> : rows.map((row) => (
            <article key={String(row.id)}>
              <span>
                <strong>{mt('Submission')} #{String(row.submission_id ?? row.submissionId)} · @{String(row.username)}</strong>
                <small>{mt('Risk')} {Number(row.risk_score ?? row.riskScore ?? 0)} · {Number(row.signal_count ?? row.signalCount ?? 0)} {mt('signals')} · {String(row.status || 'open')} · {String(row.problem_title || row.problem_id || '')}</small>
              </span>
              <button className="soft-button" type="button" onClick={() => void openDetail(row.id)}><Eye size={14} />{mt('Review')}</button>
            </article>
          ))}
        </div>
      )}
      {selected ? (
        <BodyPortal>
          <div className="cppro-management-edit-overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) setSelected(null); }}>
          <section className="cppro-management-edit-drawer cppro-incident-drawer" role="dialog" aria-modal="true" aria-label={mt('Incident review')}>
            <header>
              <div>
                <span className="home-chip"><ShieldAlert size={14} />{mt('Incident')} #{String(selected.id)}</span>
                <h2>{mt('Submission')} #{String(selected.submission_id ?? selected.submissionId)} — {String(selected.problem_title || '')}</h2>
                <p>{mt('Review evidence, record a decision, then apply contest action when justified.')}</p>
              </div>
              <button type="button" aria-label={mt('Close')} onClick={() => setSelected(null)}><X size={18} /></button>
            </header>
            {loadingDetail ? <DataLoadingPanel label={mt('Loading evidence')} rows={4} compact /> : (
              <div className="cppro-incident-body">
                <div className="cppro-incident-meta">
                  <div className="cppro-management-ops-grid cppro-incident-meta-grid">
                    <article><span className="cppro-dash-judge-label">{mt('Risk score')}</span><strong>{Number(selected.risk_score ?? selected.riskScore ?? 0)}</strong></article>
                    <article><span className="cppro-dash-judge-label">{mt('IP')}</span><strong>{String(selected.ip_address || '—')}</strong></article>
                    <article><span className="cppro-dash-judge-label">{mt('Paste events')}</span><strong>{Number(selected.paste_events ?? 0)}</strong></article>
                    <article><span className="cppro-dash-judge-label">{mt('Focus events')}</span><strong>{Number(selected.focus_events ?? 0)}</strong></article>
                    <article><span className="cppro-dash-judge-label">{mt('Editor seconds')}</span><strong>{Number(metadata.editorSeconds ?? 0)}</strong></article>
                    <article><span className="cppro-dash-judge-label">{mt('Pasted chars')}</span><strong>{Number(metadata.pastedChars ?? 0)}</strong></article>
                  </div>
                  <h4>{mt('Risk signals')}</h4>
                  <div className="cppro-management-record-list">
                    {signals.length === 0 ? <p className="contest-empty">{mt('No current signals.')}</p> : signals.map((signal) => (
                      <article key={String(signal.id)}>
                        <span>
                          <strong>{String(signal.signal_type || signal.signalType || 'signal').replace(/_/g, ' ')}</strong>
                          <small>{String(signal.severity || 'info')}</small>
                        </span>
                        <b className="management-status management-status-warning">+{Number(signal.score || 0)}</b>
                      </article>
                    ))}
                  </div>
                </div>
                <div className="cppro-incident-source">
                  <div className="cppro-incident-source-head">
                    <h4>{mt('Submission source')}</h4>
                    <button className="soft-button" type="button" onClick={() => go(`/submissions/${encodeURIComponent(String(selected.submission_id ?? selected.submissionId))}`)}><ExternalLink size={14} />{mt('Open full submission')}</button>
                  </div>
                  <pre className="cppro-incident-code">{String(selected.code || '// Source unavailable')}</pre>
                </div>
              </div>
            )}
            <footer className="cppro-incident-actions">
              <button className="soft-button" type="button" disabled={busy} onClick={() => void recalculate()}><RefreshCw size={14} />{mt('Recalculate')}</button>
              <button className="soft-button" type="button" disabled={busy} onClick={() => submitDecision('reviewing')}><Eye size={14} />{mt('Mark reviewing')}</button>
              <button className="blue-button" type="button" disabled={busy} onClick={() => submitDecision('cleared')}><CheckCircle2 size={14} />{mt('Clear incident')}</button>
              <button className="management-danger-action" type="button" disabled={busy} onClick={() => submitDecision('confirmed')}><ShieldAlert size={14} />{mt('Confirm incident')}</button>
            </footer>
            {selected.contest_id ? (
              <label className="cppro-management-check-field cppro-incident-dq">
                <input type="checkbox" checked={dialogDisqualify} onChange={(event) => setDialogDisqualify(event.currentTarget.checked)} />
                <span>{mt('Also disqualify this user from the linked contest when confirming.')}</span>
              </label>
            ) : null}
          </section>
          </div>
        </BodyPortal>
      ) : null}
      {message ? <p className="service-message">{message}</p> : null}
      <ManagementReasonDialog state={dialog} busy={busy} locale={locale} onClose={() => setDialog(null)} />
    </section>
  );
}

const MANAGEMENT_OAUTH_PROVIDERS = ['google', 'github', 'facebook'] as const;
const MANAGEMENT_TURNSTILE_ACTIONS = ['login', 'register', 'password-reset', 'email-change', 'submit', 'post-create', 'post-update', 'bulk-upload', 'rejudge'] as const;
type ManagementTurnstileForm = { enabled: boolean; siteKey: string; secretKey: string; clearSecret: boolean; actions: string[] };
type ManagementOAuthForm = { enabled: boolean; clientId: string; clientSecret: string; clearSecret: boolean; allowSignup: boolean };
const managementBlankOAuthForm: ManagementOAuthForm = { enabled: false, clientId: '', clientSecret: '', clearSecret: false, allowSignup: true };

function managementRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function ManagementPlatformOpsPanel({ locale }: { locale: CpproLocale }) {
  const mt = (text: string | undefined) => managementText(locale, text);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [judgeConcurrency, setJudgeConcurrency] = useState(1);
  const [turnstile, setTurnstile] = useState<ManagementTurnstileForm>({ enabled: false, siteKey: '', secretKey: '', clearSecret: false, actions: [] });
  const [oauth, setOauth] = useState<Record<string, ManagementOAuthForm>>({ google: { ...managementBlankOAuthForm }, github: { ...managementBlankOAuthForm }, facebook: { ...managementBlankOAuthForm } });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const applySettings = (payload: Record<string, unknown>) => {
    setSettings(payload);
    setJudgeConcurrency(Number(payload.judgeConcurrency || 1) || 1);
    const security = managementRecord(payload.security);
    const ts = managementRecord(security.turnstile);
    setTurnstile({ enabled: Boolean(ts.enabled), siteKey: String(ts.siteKey || ''), secretKey: '', clearSecret: false, actions: Array.isArray(ts.actions) ? ts.actions as string[] : [] });
    const oauthRows = Array.isArray(security.oauth) ? security.oauth as Array<Record<string, unknown>> : [];
    const nextOauth: Record<string, ManagementOAuthForm> = {};
    MANAGEMENT_OAUTH_PROVIDERS.forEach((provider) => {
      const row = oauthRows.find((item) => item.provider === provider) || {};
      nextOauth[provider] = { enabled: Boolean(row.enabled), clientId: String(row.clientId || ''), clientSecret: '', clearSecret: false, allowSignup: row.allowSignup === undefined ? true : Boolean(row.allowSignup) };
    });
    setOauth(nextOauth);
  };
  const load = () => {
    setLoading(true);
    cpproApiFetch<Record<string, unknown>>('/admin/platform-settings')
      .then((payload) => { applySettings(payload); setMessage(''); })
      .catch((error) => setMessage(error instanceof Error ? error.message : mt('Could not load platform settings.')))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const saveJudge = async () => {
    if (busy || judgeConcurrency < 1 || judgeConcurrency > 64) return;
    setBusy('judge'); setMessage('');
    try {
      const response = await cpproApiFetch<{ count: number }>('/admin/platform-settings/judge-concurrency', { method: 'PUT', body: JSON.stringify({ count: judgeConcurrency }) });
      setJudgeConcurrency(Number(response.count) || judgeConcurrency);
      setMessage(mt('Judge concurrency updated.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('Failed to update judge concurrency.'));
    } finally { setBusy(''); }
  };
  const saveTurnstile = async () => {
    if (busy) return;
    setBusy('turnstile'); setMessage('');
    try {
      const saved = await cpproApiFetch<Record<string, unknown>>('/admin/platform-settings/turnstile', { method: 'PUT', body: JSON.stringify(turnstile) });
      setTurnstile((current) => ({ ...current, enabled: Boolean(saved.enabled), siteKey: String(saved.siteKey || ''), secretKey: '', clearSecret: false, actions: Array.isArray(saved.actions) ? saved.actions as string[] : current.actions }));
      setMessage(mt('Turnstile settings saved.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('Could not save Turnstile settings.'));
    } finally { setBusy(''); }
  };
  const saveOAuth = async (provider: string) => {
    if (busy) return;
    setBusy(`oauth-${provider}`); setMessage('');
    try {
      const saved = await cpproApiFetch<Record<string, unknown>>(`/admin/platform-settings/oauth/${provider}`, { method: 'PUT', body: JSON.stringify(oauth[provider]) });
      setOauth((current) => ({ ...current, [provider]: { enabled: Boolean(saved.enabled), clientId: String(saved.clientId || ''), clientSecret: '', clearSecret: false, allowSignup: Boolean(saved.allowSignup) } }));
      setMessage(mt('OAuth provider saved.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('Could not save OAuth provider.'));
    } finally { setBusy(''); }
  };
  const runBackup = async () => {
    if (busy) return;
    setBusy('backup'); setMessage('');
    try {
      await cpproApiFetch('/admin/platform-settings/backups', { method: 'POST' });
      setMessage(mt('Backup queued.'));
      window.setTimeout(load, 2500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('Could not queue a backup.'));
    } finally { setBusy(''); }
  };
  const runSystemUpdate = async () => {
    if (busy || !window.confirm(mt('Run the platform system update now?'))) return;
    setBusy('update'); setMessage('');
    try {
      await cpproApiFetch('/admin/platform-settings/system-update', { method: 'POST', body: JSON.stringify({ confirm: 'UPDATE' }) });
      setMessage(mt('System update queued.'));
      window.setTimeout(load, 2500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mt('Could not queue the system update.'));
    } finally { setBusy(''); }
  };
  const toggleAction = (action: string) => setTurnstile((current) => ({ ...current, actions: current.actions.includes(action) ? current.actions.filter((item) => item !== action) : [...current.actions, action] }));
  const patchOAuth = (provider: string, patch: Partial<ManagementOAuthForm>) => setOauth((current) => ({ ...current, [provider]: { ...current[provider], ...patch } }));

  const security = managementRecord(settings?.security);
  const backup = managementRecord(settings?.backup);
  const backupStatus = managementRecord(backup.status);
  const backups = Array.isArray(backup.backups) ? backup.backups as Array<Record<string, unknown>> : [];
  const systemUpdate = managementRecord(settings?.systemUpdate);

  return (
    <section className="cppro-management-form-card cppro-management-ops-panel" data-management-platform-ops>
      <header>
        <div>
          <span className="home-chip"><Settings size={14} />{mt('Platform operations')}</span>
          <h3>{mt('Security, judge, backup and system controls')}</h3>
          <p>{mt('Advanced platform settings stored in the database settings table.')}</p>
        </div>
        <button className="soft-button" type="button" disabled={loading} onClick={load}><RefreshCw size={14} />{mt('Refresh')}</button>
      </header>
      {loading ? <DataLoadingPanel label={mt('Loading platform settings')} rows={4} compact /> : (
        <div className="cppro-platform-ops-grid">
          <section className="cppro-platform-card">
            <h4><Cpu size={15} />{mt('Judge concurrency')}</h4>
            <div className="cppro-management-ops-actions">
              <label><span>{mt('Parallel judges (1-64)')}</span><input type="number" min="1" max="64" value={judgeConcurrency} onChange={(event) => setJudgeConcurrency(Math.max(1, Math.min(64, Number(event.currentTarget.value) || 1)))} /></label>
              <button className="blue-button" type="button" disabled={busy === 'judge'} onClick={() => void saveJudge()}><CheckCircle2 size={14} />{busy === 'judge' ? mt('Saving...') : mt('Save')}</button>
            </div>
            <div className="cppro-platform-posture">
              <span className="management-status">{mt('Malware scan')}: {security.malwareScanEnabled ? mt('On') : mt('Off')}</span>
              <span className="management-status">{mt('Body limit')}: {Number(security.bodyLimitMb || 0)}MB</span>
              <span className="management-status">{mt('Package ZIP limit')}: {Number(security.packageZipMaxMb || 0)}MB</span>
            </div>
          </section>

          <section className="cppro-platform-card">
            <h4><ShieldCheck size={15} />{mt('Cloudflare Turnstile')}</h4>
            <label className="cppro-management-check-field"><input type="checkbox" checked={turnstile.enabled} onChange={(event) => {
              const enabled = event.currentTarget.checked;
              setTurnstile((current) => ({ ...current, enabled }));
            }} /><span>{mt('Enable Turnstile challenge')}</span></label>
            <div className="cppro-management-fields two-columns">
              <label><span>{mt('Site key')}</span><input value={turnstile.siteKey} onChange={(event) => {
                const siteKey = event.currentTarget.value;
                setTurnstile((current) => ({ ...current, siteKey }));
              }} /></label>
              <label><span>{mt('Secret key')}</span><input type="password" value={turnstile.secretKey} onChange={(event) => {
                const secretKey = event.currentTarget.value;
                setTurnstile((current) => ({ ...current, secretKey }));
              }} placeholder={security.turnstile && managementRecord(security.turnstile).secretConfigured ? mt('Leave blank to keep current secret') : ''} /></label>
            </div>
            <div className="cppro-management-check-row cppro-turnstile-actions">
              {MANAGEMENT_TURNSTILE_ACTIONS.map((action) => (
                <label key={action}><input type="checkbox" checked={turnstile.actions.includes(action)} onChange={() => toggleAction(action)} /><span>{action}</span></label>
              ))}
            </div>
            <div className="cppro-management-check-row">
              <label><input type="checkbox" checked={turnstile.clearSecret} onChange={(event) => {
                const clearSecret = event.currentTarget.checked;
                setTurnstile((current) => ({ ...current, clearSecret, secretKey: clearSecret ? '' : current.secretKey }));
              }} /><span>{mt('Clear saved secret')}</span></label>
              <button className="blue-button" type="button" disabled={busy === 'turnstile'} onClick={() => void saveTurnstile()}><CheckCircle2 size={14} />{busy === 'turnstile' ? mt('Saving...') : mt('Save Turnstile')}</button>
            </div>
          </section>

          {MANAGEMENT_OAUTH_PROVIDERS.map((provider) => {
            const form = oauth[provider];
            const providerRow = managementRecord((Array.isArray(security.oauth) ? security.oauth as Array<Record<string, unknown>> : []).find((item) => item.provider === provider));
            return (
              <section className="cppro-platform-card" key={provider}>
                <h4><Globe size={15} />{mt('OAuth')} · {provider}</h4>
                <label className="cppro-management-check-field"><input type="checkbox" checked={form.enabled} onChange={(event) => patchOAuth(provider, { enabled: event.currentTarget.checked })} /><span>{mt('Enable sign-in with')} {provider}</span></label>
                <div className="cppro-management-fields two-columns">
                  <label><span>{mt('Client ID')}</span><input value={form.clientId} onChange={(event) => patchOAuth(provider, { clientId: event.currentTarget.value })} /></label>
                  <label><span>{mt('Client secret')}</span><input type="password" value={form.clientSecret} onChange={(event) => patchOAuth(provider, { clientSecret: event.currentTarget.value })} placeholder={providerRow.secretConfigured ? mt('Leave blank to keep current secret') : ''} /></label>
                </div>
                <div className="cppro-management-check-row">
                  <label><input type="checkbox" checked={form.allowSignup} onChange={(event) => patchOAuth(provider, { allowSignup: event.currentTarget.checked })} /><span>{mt('Allow new signups')}</span></label>
                  <label><input type="checkbox" checked={form.clearSecret} onChange={(event) => patchOAuth(provider, { clearSecret: event.currentTarget.checked, clientSecret: event.currentTarget.checked ? '' : form.clientSecret })} /><span>{mt('Clear saved secret')}</span></label>
                  <button className="blue-button" type="button" disabled={busy === `oauth-${provider}`} onClick={() => void saveOAuth(provider)}><CheckCircle2 size={14} />{busy === `oauth-${provider}` ? mt('Saving...') : mt('Save')}</button>
                </div>
              </section>
            );
          })}

          <section className="cppro-platform-card">
            <h4><Database size={15} />{mt('Database backups')}</h4>
            <div className="cppro-management-ops-grid cppro-analytics-cards">
              <article><span className="cppro-dash-judge-label">{mt('Backup health')}</span><strong>{backup.healthy ? mt('Healthy') : backup.available ? mt('Degraded') : mt('Unavailable')}</strong></article>
              <article><span className="cppro-dash-judge-label">{mt('Retention (days)')}</span><strong>{Number(backup.retentionDays || 0)}</strong></article>
              <article><span className="cppro-dash-judge-label">{mt('Interval (s)')}</span><strong>{Number(backup.intervalSeconds || 0)}</strong></article>
              <article><span className="cppro-dash-judge-label">{mt('Last state')}</span><strong>{String(backupStatus.state || '—')}</strong></article>
            </div>
            <div className="cppro-management-ops-actions">
              <button className="blue-button" type="button" disabled={busy === 'backup'} onClick={() => void runBackup()}><Database size={14} />{busy === 'backup' ? mt('Queuing...') : mt('Run backup now')}</button>
            </div>
            <div className="cppro-management-record-list cppro-backup-list">
              {backups.length === 0 ? <p className="contest-empty">{mt('No backups recorded.')}</p> : backups.slice(0, 8).map((entry) => (
                <article key={String(entry.filename)}>
                  <span>
                    <strong>{String(entry.filename)}</strong>
                    <small>{formatDate(String(entry.createdAt || ''))} · {formatUploadBytes(Number(entry.size || 0))} · {String(entry.reason || '')}</small>
                  </span>
                  <b className={entry.verified ? 'management-status management-status-published' : 'management-status management-status-warning'}>{entry.verified ? mt('Verified') : mt('Unverified')}</b>
                </article>
              ))}
            </div>
          </section>

          <section className="cppro-platform-card">
            <h4><HardDrive size={15} />{mt('System update')}</h4>
            <p className="cppro-platform-note">{systemUpdate.configured ? String(systemUpdate.commandLabel || mt('Configured update command available.')) : mt('No system update command is configured.')}</p>
            {systemUpdate.reason ? <p className="service-message">{String(systemUpdate.reason)}</p> : null}
            <div className="cppro-management-ops-actions">
              <span className={systemUpdate.canRun ? 'management-status management-status-published' : 'management-status management-status-warning'}>{systemUpdate.canRun ? mt('Ready') : mt('Locked')}</span>
              <button className="management-danger-action" type="button" disabled={busy === 'update' || !systemUpdate.canRun} onClick={() => void runSystemUpdate()}><HardDrive size={14} />{busy === 'update' ? mt('Queuing...') : mt('Run system update')}</button>
            </div>
            {systemUpdate.lastStatus ? <p className="cppro-platform-note">{mt('Last')}: {String(managementRecord(systemUpdate.lastStatus).state || '')} · {String(managementRecord(systemUpdate.lastStatus).message || '')}</p> : null}
          </section>
        </div>
      )}
      {message ? <p className="service-message">{message}</p> : null}
    </section>
  );
}

function ManagementAuditLogPanel({ locale, go }: { locale: CpproLocale; go: (path: string) => void }) {
  const mt = (text: string | undefined) => managementText(locale, text);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const load = () => {
    setLoading(true);
    cpproApiFetch<unknown>('/admin/audit-logs?page=1&limit=100')
      .then((payload) => { setRows(rowsFromApi<Record<string, unknown>>(payload)); setMessage(''); })
      .catch((error) => setMessage(error instanceof Error ? error.message : mt('Could not load audit logs.')))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => `${row.actor_username || ''} ${row.action || ''} ${row.problem_id || ''} ${row.contest_id || ''} ${row.target_user_id || ''}`.toLowerCase().includes(needle));
  }, [rows, query]);
  const actorCount = useMemo(() => new Set(rows.map((row) => String(row.actor_username || 'system'))).size, [rows]);

  return (
    <section className="cppro-management-form-card cppro-management-ops-panel" data-management-audit-log>
      <header>
        <div>
          <span className="home-chip"><Clock size={14} />{mt('Audit trail')}</span>
          <h3>{mt('Administration and moderation history')}</h3>
          <p>{filtered.length.toLocaleString('vi-VN')} {mt('events')} · {actorCount} {mt('actors')}</p>
        </div>
        <button className="soft-button" type="button" disabled={loading} onClick={load}><RefreshCw size={14} />{mt('Refresh')}</button>
      </header>
      <div className="cppro-management-fields">
        <label><span>{mt('Search logs')}</span><input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder={mt('Actor, event, target...')} /></label>
      </div>
      {loading ? <DataLoadingPanel label={mt('Loading audit logs')} rows={4} compact /> : (
        <div className="cppro-management-record-list cppro-audit-list">
          {filtered.length === 0 ? <p className="contest-empty">{mt('No audit logs match the current filter.')}</p> : filtered.slice(0, 100).map((row) => (
            <article key={String(row.id)} className="cppro-audit-row">
              <span>
                <strong>{String(row.action || 'event')}</strong>
                <small>{row.actor_username ? `@${String(row.actor_username)}` : mt('System')} · {formatDate(String(row.created_at || ''))}</small>
                <div className="cppro-audit-targets">
                  {row.problem_id ? <button type="button" onClick={() => go(`/management/problems/${encodeURIComponent(String(row.problem_id))}`)}>Problem #{String(row.problem_id)}</button> : null}
                  {row.contest_id ? <button type="button" onClick={() => go(`/management/contests/${encodeURIComponent(String(row.contest_id))}`)}>Contest #{String(row.contest_id)}</button> : null}
                  {row.target_user_id ? <em>User #{String(row.target_user_id)}</em> : null}
                </div>
              </span>
              {row.metadata && typeof row.metadata === 'object' && Object.keys(row.metadata as Record<string, unknown>).length ? <code>{JSON.stringify(row.metadata)}</code> : null}
            </article>
          ))}
        </div>
      )}
      {message ? <p className="service-message">{message}</p> : null}
    </section>
  );
}

type ManagementToast = { tone: 'success' | 'error' | 'info'; text: string };

function ManagementSubpage({
  route,
  data,
  go,
  currentUser,
  onToast,
}: {
  route: ManagementSubpageRoute;
  data: CpproData;
  go: (path: string) => void;
  currentUser: StoredCpproUser | null;
  onToast: (toast: ManagementToast | null) => void;
}) {
  if (route.kind === 'problem-create' || route.kind === 'problem-edit') {
    return <ManagementProblemForm route={route} data={data} go={go} onToast={onToast} />;
  }
  if (route.kind === 'contest-create' || route.kind === 'contest-edit') {
    return <ManagementContestForm route={route} data={data} go={go} onToast={onToast} />;
  }
  if (route.kind === 'organization-create') {
    return <ManagementOrganizationForm data={data} go={go} onToast={onToast} />;
  }
  if (route.kind === 'contest-integrity') {
    return <ManagementContestIntegrity contestId={route.id} onToast={onToast} />;
  }
  if (route.kind === 'contest-moss') {
    return <ManagementContestMoss contestId={route.id} data={data} onToast={onToast} />;
  }
  if (route.kind === 'quiz-create') {
    return <ManagementQuizForm go={go} onToast={onToast} />;
  }
  if (route.kind === 'quiz-questions') {
    return <ManagementQuizQuestions onToast={onToast} />;
  }
  if (route.kind === 'quiz-reviews') {
    return <ManagementQuizReviews onToast={onToast} />;
  }
  return <ManagementProfilePanel currentUser={currentUser} />;
}

type ManagementProblemDraft = {
  externalId: string;
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  rating: number;
  timeLimit: number;
  memoryLimit: number;
  visibility: 'public' | 'private' | 'waiting' | 'organization';
  scoringMode: 'full' | 'partial';
  allowedLanguages: string[];
  sampleInput: string;
  sampleOutput: string;
  testCases: ManagementProblemTestCase[];
  editorial: string;
  checkerCode: string;
  referenceSolutionCode: string;
  referenceSolutionLanguage: string;
  problemType: 'standard' | 'interactive' | 'output_only';
  ioMode: 'standard' | 'file';
  inputFileName: string;
  outputFileName: string;
  statementAssetName?: string | null;
  statementAssetType?: string | null;
  statementAssetData?: string | null;
  statementAssetSize?: number | null;
  adminAttachmentName?: string | null;
  adminAttachmentType?: string | null;
  adminAttachmentData?: string | null;
  adminAttachmentSize?: number | null;
};

type ManagementProblemTestCase = {
  input: string;
  output?: string;
  outputs?: string[];
  explanation?: string;
  isSample?: boolean;
};

const emptyManagementProblemDraft: ManagementProblemDraft = {
  externalId: '',
  title: '',
  description: '',
  difficulty: 'Easy',
  rating: 1,
  timeLimit: 1000,
  memoryLimit: 256,
  visibility: 'private',
  scoringMode: 'full',
  allowedLanguages: [],
  sampleInput: '',
  sampleOutput: '',
  testCases: [],
  editorial: '',
  checkerCode: '',
  referenceSolutionCode: '',
  referenceSolutionLanguage: 'cpp20',
  problemType: 'standard',
  ioMode: 'standard',
  inputFileName: '',
  outputFileName: '',
  statementAssetName: null,
  statementAssetType: null,
  statementAssetData: null,
  statementAssetSize: null,
  adminAttachmentName: null,
  adminAttachmentType: null,
  adminAttachmentData: null,
  adminAttachmentSize: null,
};

function normalizeManagementProblemTestCases(value: unknown): ManagementProblemTestCase[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const outputs = Array.isArray(row.outputs)
      ? row.outputs.map((entry) => String(entry ?? '')).filter((entry) => entry.length > 0)
      : undefined;
    return {
      input: String(row.input ?? row.input_file ?? ''),
      ...(row.output !== undefined || row.output_file !== undefined ? { output: String(row.output ?? row.output_file ?? '') } : {}),
      ...(outputs?.length ? { outputs } : {}),
      ...(row.explanation !== undefined ? { explanation: String(row.explanation ?? '') } : {}),
      isSample: Boolean(row.isSample ?? row.is_sample ?? row.is_pretest),
    };
  }).filter((item) => item.input.length > 0 || String(item.output ?? '').length > 0 || (item.outputs?.length || 0) > 0);
}

function mergeManagementProblemTestCases(current: ManagementProblemTestCase[], incoming: ManagementProblemTestCase[]) {
  const merged = [...current];
  const seen = new Set(merged.map((item) => `${item.input}\n---\n${item.output ?? ''}\n---\n${(item.outputs || []).join('\n')}`));
  let duplicatesSkipped = 0;
  incoming.forEach((item) => {
    const key = `${item.input}\n---\n${item.output ?? ''}\n---\n${(item.outputs || []).join('\n')}`;
    if (seen.has(key)) {
      duplicatesSkipped += 1;
      return;
    }
    seen.add(key);
    merged.push(item);
  });
  return { merged, duplicatesSkipped };
}

function managementProblemDifficulty(value: unknown, fallback: ManagementProblemDraft['difficulty']) {
  const text = String(value || '');
  return ['Easy', 'Medium', 'Hard'].includes(text) ? text as ManagementProblemDraft['difficulty'] : fallback;
}

function managementProblemVisibility(value: unknown, fallback: ManagementProblemDraft['visibility']) {
  const text = String(value || '');
  return ['public', 'private', 'waiting', 'organization'].includes(text) ? text as ManagementProblemDraft['visibility'] : fallback;
}

function managementProblemScoringMode(value: unknown, fallback: ManagementProblemDraft['scoringMode']) {
  const text = String(value || '');
  return text === 'partial' || text === 'full' ? text : fallback;
}

function ManagementProblemForm({
  route,
  data,
  go,
  onToast,
}: {
  route: Extract<ManagementSubpageRoute, { kind: 'problem-create' | 'problem-edit' }>;
  data: CpproData;
  go: (path: string) => void;
  onToast: (toast: ManagementToast | null) => void;
}) {
  const editing = route.kind === 'problem-edit';
  const routeId = route.kind === 'problem-edit' ? route.id : '';
  const [draft, setDraft] = useState<ManagementProblemDraft>(emptyManagementProblemDraft);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [importingPackage, setImportingPackage] = useState(false);
  const [importingTests, setImportingTests] = useState(false);
  const [exportingPackage, setExportingPackage] = useState(false);
  const [testcaseZipMode, setTestcaseZipMode] = useState<'append' | 'replace'>('append');
  const [packageSummary, setPackageSummary] = useState('');
  const [, setExistingTestCases] = useState<ManagementProblemTestCase[]>([]);
  const [existingTestCasesLoading, setExistingTestCasesLoading] = useState(editing);
  const [existingTestCasesError, setExistingTestCasesError] = useState('');
  const [testcaseDirty, setTestcaseDirty] = useState(false);
  const packageInputRef = useRef<HTMLInputElement | null>(null);
  const testcaseZipInputRef = useRef<HTMLInputElement | null>(null);
  const statementAssetInputRef = useRef<HTMLInputElement | null>(null);
  const adminAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const patch = <K extends keyof ManagementProblemDraft>(key: K, value: ManagementProblemDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    if (!editing) {
      setDraft(emptyManagementProblemDraft);
      setExistingTestCases([]);
      setExistingTestCasesLoading(false);
      setExistingTestCasesError('');
      setTestcaseDirty(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setExistingTestCases([]);
    setExistingTestCasesError('');
    setExistingTestCasesLoading(true);
    setTestcaseDirty(false);
    cpproApiFetch<Record<string, unknown>>(`/problems/${encodeURIComponent(routeId)}`)
      .then(async (row) => {
        if (cancelled) return;
        setDraft({
          externalId: String(row.external_id || row.externalId || ''),
          title: String(row.title || ''),
          description: String(row.description || row.statement || ''),
          difficulty: ['Medium', 'Hard'].includes(String(row.difficulty)) ? String(row.difficulty) as 'Medium' | 'Hard' : 'Easy',
          rating: Number(row.rating ?? 1) || 1,
          timeLimit: Number(row.time_limit ?? row.timeLimit ?? row.time_limit_ms ?? row.timeLimitMs ?? 1000) || 1000,
          memoryLimit: Number(row.memory_limit ?? row.memoryLimit ?? row.memory_limit_mb ?? row.memoryLimitMb ?? 256) || 256,
          visibility: ['public', 'waiting', 'organization'].includes(String(row.visibility)) ? String(row.visibility) as ManagementProblemDraft['visibility'] : 'private',
          scoringMode: Boolean(row.judge_run_all ?? row.judgeRunAll) ? 'partial' : 'full',
          allowedLanguages: normalizeStringList(row.allowed_languages ?? row.allowedLanguages, []),
          sampleInput: '',
          sampleOutput: '',
          testCases: [],
          editorial: String(row.editorial || ''),
          checkerCode: String(row.checker_code || row.checkerCode || ''),
          referenceSolutionCode: String(row.reference_solution_code || row.referenceSolutionCode || ''),
          referenceSolutionLanguage: String(row.reference_solution_language || row.referenceSolutionLanguage || 'cpp20'),
          problemType: ['interactive', 'output_only'].includes(String(row.problem_type || row.problemType)) ? String(row.problem_type || row.problemType) as ManagementProblemDraft['problemType'] : 'standard',
          ioMode: String(row.io_mode || row.ioMode) === 'file' ? 'file' : 'standard',
          inputFileName: String(row.input_file_name || row.inputFileName || ''),
          outputFileName: String(row.output_file_name || row.outputFileName || ''),
          statementAssetName: String(row.statement_asset_name || row.statementAssetName || '') || null,
          statementAssetType: String(row.statement_asset_type || row.statementAssetType || '') || null,
          statementAssetData: null,
          statementAssetSize: Number(row.statement_asset_size ?? row.statementAssetSize ?? 0) || null,
          adminAttachmentName: String(row.admin_attachment_name || row.adminAttachmentName || '') || null,
          adminAttachmentType: String(row.admin_attachment_type || row.adminAttachmentType || '') || null,
          adminAttachmentData: null,
          adminAttachmentSize: Number(row.admin_attachment_size ?? row.adminAttachmentSize ?? 0) || null,
        });
        const problemId = String(row.id ?? row.problem_id ?? routeId);
        try {
          const testCasePayload = await cpproApiFetch<unknown>(`/problems/${encodeURIComponent(problemId)}/testcases`);
          if (!cancelled) {
            const testCases = normalizeManagementProblemTestCases(rowsFromApi<Record<string, unknown>>(testCasePayload));
            const firstSample = testCases.find((testCase) => testCase.isSample) || testCases[0];
            setExistingTestCases(testCases);
            setDraft((current) => ({
              ...current,
              testCases,
              sampleInput: firstSample?.input ?? '',
              sampleOutput: firstSample ? String(firstSample.output ?? firstSample.outputs?.[0] ?? '') : '',
            }));
          }
        } catch (error) {
          if (!cancelled) {
            setExistingTestCases([]);
            setExistingTestCasesError(error instanceof Error ? error.message : 'Could not load saved testcase details.');
          }
        } finally {
          if (!cancelled) setExistingTestCasesLoading(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setExistingTestCasesLoading(false);
          onToast({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load problem.' });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editing, routeId]);

  const toggleLanguage = (code: string) => {
    patch('allowedLanguages', draft.allowedLanguages.includes(code)
      ? draft.allowedLanguages.filter((item) => item !== code)
      : [...draft.allowedLanguages, code]);
  };

  const patchSampleTestcase = (field: 'input' | 'output', value: string) => {
    setDraft((current) => {
      const sampleIndex = current.testCases.findIndex((testCase) => testCase.isSample);
      const targetIndex = sampleIndex >= 0 ? sampleIndex : 0;
      const currentSample = current.testCases[targetIndex] || {
        input: current.sampleInput,
        output: current.sampleOutput,
        isSample: true,
      };
      const nextSample = { ...currentSample, [field]: value, isSample: true };
      const testCases = current.testCases.length
        ? current.testCases.map((testCase, index) => index === targetIndex ? nextSample : testCase)
        : [nextSample];
      return {
        ...current,
        testCases,
        sampleInput: field === 'input' ? value : current.sampleInput,
        sampleOutput: field === 'output' ? value : current.sampleOutput,
      };
    });
    setTestcaseDirty(true);
  };

  const importInlineAsset = async (file: File, kind: 'statement' | 'attachment') => {
    const maxBytes = 16 * 1024 * 1024;
    if (file.size > maxBytes) {
      onToast({ tone: 'error', text: 'File is too large for inline upload. Keep it under 16 MB or use a full ZIP package.' });
      return;
    }
    try {
      const data = await readFileAsBase64(file);
      if (kind === 'statement') {
        setDraft((current) => ({
          ...current,
          statementAssetName: file.name,
          statementAssetType: file.type || 'application/octet-stream',
          statementAssetData: data,
          statementAssetSize: file.size,
        }));
        onToast({ tone: 'success', text: 'Statement asset attached.' });
      } else {
        setDraft((current) => ({
          ...current,
          adminAttachmentName: file.name,
          adminAttachmentType: file.type || 'application/octet-stream',
          adminAttachmentData: data,
          adminAttachmentSize: file.size,
        }));
        onToast({ tone: 'success', text: 'Hidden admin attachment attached.' });
      }
    } catch (error) {
      onToast({ tone: 'error', text: error instanceof Error ? error.message : 'Could not read selected file.' });
    }
  };

  const statementAssetHref = draft.statementAssetData
    ? `data:${draft.statementAssetType || 'application/octet-stream'};base64,${draft.statementAssetData}`
    : '';
  const adminAttachmentHref = draft.adminAttachmentData
    ? `data:${draft.adminAttachmentType || 'application/octet-stream'};base64,${draft.adminAttachmentData}`
    : '';

  const importProblemPackage = async (file: File) => {
    if (!/\.zip$/i.test(file.name)) {
      onToast({ tone: 'error', text: 'Upload a .zip problem package.' });
      return;
    }
    setImportingPackage(true);
    setPackageSummary(`Inspecting ${file.name}...`);
    try {
      const form = new FormData();
      form.append('file', file);
      const payload = await cpproApiFetch<Record<string, unknown>>('/problems/package/inspect', {
        method: 'POST',
        body: form,
        timeoutMs: 120000,
      });
      const imported = payload.draft && typeof payload.draft === 'object' ? payload.draft as Record<string, unknown> : {};
      const tests = normalizeManagementProblemTestCases(imported.testCases);
      const firstSample = tests.find((testCase) => testCase.isSample) || tests[0];
      const summary = payload.summary && typeof payload.summary === 'object' ? payload.summary as Record<string, unknown> : {};
      const testSummary = summary.testCases && typeof summary.testCases === 'object' ? summary.testCases as Record<string, unknown> : {};
      setDraft((current) => ({
        ...current,
        externalId: String(imported.externalId ?? imported.external_id ?? current.externalId ?? ''),
        title: String(imported.title ?? current.title ?? ''),
        description: String(imported.description ?? current.description ?? ''),
        difficulty: managementProblemDifficulty(imported.difficulty, current.difficulty),
        rating: Number(imported.rating ?? current.rating) || current.rating,
        timeLimit: Number(imported.timeLimit ?? imported.time_limit ?? current.timeLimit) || current.timeLimit,
        memoryLimit: Number(imported.memoryLimit ?? imported.memory_limit ?? current.memoryLimit) || current.memoryLimit,
        visibility: managementProblemVisibility(imported.visibility, current.visibility),
        scoringMode: managementProblemScoringMode(imported.scoringMode ?? imported.scoring_mode, current.scoringMode),
        sampleInput: firstSample?.input ?? current.sampleInput,
        sampleOutput: firstSample ? String(firstSample.output ?? firstSample.outputs?.[0] ?? '') : current.sampleOutput,
        testCases: tests,
        editorial: String(imported.editorial ?? current.editorial ?? ''),
        checkerCode: String(imported.checkerCode ?? imported.checker_code ?? current.checkerCode ?? ''),
        referenceSolutionCode: String(imported.referenceSolutionCode ?? imported.reference_solution_code ?? current.referenceSolutionCode ?? ''),
        referenceSolutionLanguage: String(imported.referenceSolutionLanguage ?? imported.reference_solution_language ?? current.referenceSolutionLanguage ?? 'cpp20'),
        problemType: ['interactive', 'output_only'].includes(String(imported.problemType ?? imported.problem_type))
          ? String(imported.problemType ?? imported.problem_type) as ManagementProblemDraft['problemType']
          : current.problemType,
        ioMode: String(imported.ioMode ?? imported.io_mode) === 'file' ? 'file' : current.ioMode,
        inputFileName: String(imported.inputFileName ?? imported.input_file_name ?? current.inputFileName ?? ''),
        outputFileName: String(imported.outputFileName ?? imported.output_file_name ?? current.outputFileName ?? ''),
        statementAssetName: String(imported.statementAssetName ?? imported.statement_asset_name ?? current.statementAssetName ?? '') || null,
        statementAssetType: String(imported.statementAssetType ?? imported.statement_asset_type ?? current.statementAssetType ?? '') || null,
        statementAssetData: String(imported.statementAssetData ?? imported.statement_asset_data ?? current.statementAssetData ?? '') || null,
        statementAssetSize: Number(imported.statementAssetSize ?? imported.statement_asset_size ?? current.statementAssetSize ?? 0) || null,
        adminAttachmentName: String(imported.adminAttachmentName ?? imported.admin_attachment_name ?? current.adminAttachmentName ?? '') || null,
        adminAttachmentType: String(imported.adminAttachmentType ?? imported.admin_attachment_type ?? current.adminAttachmentType ?? '') || null,
        adminAttachmentData: String(imported.adminAttachmentData ?? imported.admin_attachment_data ?? current.adminAttachmentData ?? '') || null,
        adminAttachmentSize: Number(imported.adminAttachmentSize ?? imported.admin_attachment_size ?? current.adminAttachmentSize ?? 0) || null,
      }));
      setTestcaseDirty(true);
      const savedCount = Number(testSummary.savedCount ?? testSummary.submittedCount ?? tests.length) || tests.length;
      const sampleCount = Number(testSummary.sampleCount ?? tests.filter((item) => item.isSample).length) || tests.filter((item) => item.isSample).length;
      setPackageSummary(`Loaded ${savedCount.toLocaleString('vi-VN')} testcase(s), ${sampleCount.toLocaleString('vi-VN')} sample(s) from ${file.name}.`);
      onToast({ tone: 'success', text: 'Problem package loaded into the editor.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not inspect problem package.';
      setPackageSummary(message);
      onToast({ tone: 'error', text: message });
    } finally {
      setImportingPackage(false);
      if (packageInputRef.current) packageInputRef.current.value = '';
    }
  };

  const downloadCurrentPackage = async () => {
    if (!editing || !routeId) return;
    setExportingPackage(true);
    try {
      const headers = new Headers();
      const token = localStorage.getItem('oj_platform_token') || localStorage.getItem('cppro_access_token');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      const path = `/problems/${encodeURIComponent(routeId)}/package.zip`;
      const endpoint = isLcojBackendMode() ? `/api/cppro${path}` : `${cpproApiBase()}${path}`;
      const response = await fetch(endpoint, { headers, credentials: 'same-origin' });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || payload?.message || `Download failed with ${response.status}`);
      }
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || `problem-${routeId}-package.zip`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      onToast({ tone: 'success', text: 'Downloaded current problem package.' });
    } catch (error) {
      onToast({ tone: 'error', text: error instanceof Error ? error.message : 'Could not download problem package.' });
    } finally {
      setExportingPackage(false);
    }
  };

  const importTestcaseZip = async (file: File) => {
    if (!/\.zip$/i.test(file.name)) {
      onToast({ tone: 'error', text: 'Upload a .zip testcase archive.' });
      return;
    }
    setImportingTests(true);
    setPackageSummary(`Importing testcase ZIP ${file.name}...`);
    try {
      const form = new FormData();
      form.append('file', file);
      if (editing && routeId) {
        const imported = await cpproApiFetch<Record<string, unknown>>(
          `/problems/${encodeURIComponent(routeId)}/testcases/import?mode=${testcaseZipMode}`,
          {
            method: 'POST',
            body: form,
            timeoutMs: 120000,
          },
        );
        const importedCount = Number(imported.importedCount ?? imported.imported_count ?? 0) || 0;
        const totalCount = Number(imported.totalCount ?? imported.total_count ?? importedCount) || importedCount;
        const duplicatesSkipped = Number(imported.duplicatesSkipped ?? imported.duplicates_skipped ?? 0) || 0;
        setExistingTestCasesLoading(true);
        void cpproApiFetch<unknown>(`/problems/${encodeURIComponent(routeId)}/testcases`)
          .then((testCasePayload) => {
            const testCases = normalizeManagementProblemTestCases(rowsFromApi<Record<string, unknown>>(testCasePayload));
            const firstSample = testCases.find((testCase) => testCase.isSample) || testCases[0];
            setExistingTestCases(testCases);
            setDraft((current) => ({
              ...current,
              testCases,
              sampleInput: firstSample?.input ?? '',
              sampleOutput: firstSample ? String(firstSample.output ?? firstSample.outputs?.[0] ?? '') : '',
            }));
            setTestcaseDirty(false);
            setExistingTestCasesError('');
          })
          .catch((error) => {
            setExistingTestCasesError(error instanceof Error ? error.message : 'Testcase ZIP was imported, but the refreshed preview could not be loaded.');
          })
          .finally(() => setExistingTestCasesLoading(false));
        setPackageSummary(
          `${testcaseZipMode === 'replace' ? 'Replaced with' : 'Added'} ${importedCount.toLocaleString('vi-VN')} testcase(s). `
          + `${totalCount.toLocaleString('vi-VN')} testcase(s) are now saved in database.`
          + (duplicatesSkipped ? ` Skipped ${duplicatesSkipped.toLocaleString('vi-VN')} duplicate(s).` : ''),
        );
        onToast({ tone: 'success', text: 'Testcase ZIP imported into database.' });
        return;
      }

      const payload = await cpproApiFetch<Record<string, unknown>>('/problems/package/inspect', {
        method: 'POST',
        body: form,
        timeoutMs: 120000,
      });
      const imported = payload.draft && typeof payload.draft === 'object' ? payload.draft as Record<string, unknown> : {};
      const tests = normalizeManagementProblemTestCases(imported.testCases);
      if (!tests.length) {
        throw new Error('No paired testcase files were found in this ZIP.');
      }
      const base = testcaseZipMode === 'replace' ? [] : draft.testCases;
      const { merged, duplicatesSkipped } = mergeManagementProblemTestCases(base, tests);
      const firstSample = merged.find((testCase) => testCase.isSample) || merged[0];
      setDraft((current) => ({
        ...current,
        testCases: merged,
        sampleInput: firstSample?.input ?? current.sampleInput,
        sampleOutput: firstSample ? String(firstSample.output ?? firstSample.outputs?.[0] ?? '') : current.sampleOutput,
      }));
      setTestcaseDirty(true);
      setPackageSummary(
        `${testcaseZipMode === 'replace' ? 'Loaded' : 'Added'} ${tests.length.toLocaleString('vi-VN')} testcase(s); `
        + `${merged.length.toLocaleString('vi-VN')} testcase(s) ready.`
        + (duplicatesSkipped ? ` Skipped ${duplicatesSkipped.toLocaleString('vi-VN')} duplicate(s).` : ''),
      );
      onToast({ tone: 'success', text: 'Testcase ZIP loaded into this draft.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not import testcase ZIP.';
      setPackageSummary(message);
      onToast({ tone: 'error', text: message });
    } finally {
      setImportingTests(false);
      if (testcaseZipInputRef.current) testcaseZipInputRef.current.value = '';
    }
  };

  const submit = async () => {
    if (!draft.title.trim() || !draft.description.trim()) {
      onToast({ tone: 'error', text: 'Title and statement are required.' });
      return;
    }
    if (!editing && draft.testCases.length === 0 && !draft.sampleInput.trim() && !draft.sampleOutput.trim()) {
      onToast({ tone: 'error', text: 'Add at least one initial testcase.' });
      return;
    }
    setSaving(true);
    try {
      const fallbackTestCases = [{
        input: draft.sampleInput,
        output: draft.sampleOutput,
        isSample: true,
      }];
      const payload = {
        externalId: draft.externalId.trim() || undefined,
        title: draft.title.trim(),
        description: draft.description,
        difficulty: draft.difficulty,
        rating: draft.rating,
        timeLimit: draft.timeLimit,
        memoryLimit: draft.memoryLimit,
        visibility: draft.visibility,
        scoringMode: draft.scoringMode,
        allowedLanguages: draft.allowedLanguages.length ? draft.allowedLanguages : null,
        editorial: draft.editorial || undefined,
        checkerCode: draft.checkerCode || undefined,
        referenceSolutionCode: draft.referenceSolutionCode || undefined,
        referenceSolutionLanguage: draft.referenceSolutionLanguage || undefined,
        problemType: draft.problemType,
        ioMode: draft.ioMode,
        inputFileName: draft.ioMode === 'file' ? draft.inputFileName : undefined,
        outputFileName: draft.ioMode === 'file' ? draft.outputFileName : undefined,
        statementAssetName: draft.statementAssetName || undefined,
        statementAssetType: draft.statementAssetType || undefined,
        statementAssetData: draft.statementAssetData || undefined,
        statementAssetSize: draft.statementAssetSize || undefined,
        adminAttachmentName: draft.adminAttachmentName || undefined,
        adminAttachmentType: draft.adminAttachmentType || undefined,
        adminAttachmentData: draft.adminAttachmentData || undefined,
        adminAttachmentSize: draft.adminAttachmentSize || undefined,
        ...(!editing
          ? { testCases: draft.testCases.length ? draft.testCases : fallbackTestCases }
          : testcaseDirty && draft.testCases.length ? { testCases: draft.testCases } : {}),
      };
      await cpproApiFetch(editing ? `/problems/${encodeURIComponent(routeId)}` : '/problems', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
        timeoutMs: 60000,
      });
      onToast({ tone: 'success', text: editing ? 'Problem updated.' : 'Problem created.' });
      go('/management/problems');
    } catch (error) {
      onToast({ tone: 'error', text: error instanceof Error ? error.message : 'Could not save problem.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <DataLoadingPanel label="Loading problem editor" rows={7} />;
  const visibleTestCases = draft.testCases;
  return (
    <section className="cppro-management-subpage" data-management-subpage="problem">
      <div className="cppro-management-form-grid">
        <section className="cppro-management-form-card">
          <header><Code2 size={19} /><strong>Problem information</strong></header>
          <div className="cppro-management-package-upload" data-management-problem-package-upload>
            <input
              ref={packageInputRef}
              hidden
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void importProblemPackage(file);
              }}
            />
            <input
              ref={testcaseZipInputRef}
              hidden
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void importTestcaseZip(file);
              }}
            />
            <div className="cppro-management-package-actions">
              <a className="soft-button" href="/problem-package-template.zip" download>
                <Download size={16} />Template
              </a>
              <button className="soft-button" type="button" disabled={importingPackage || importingTests || saving} onClick={() => packageInputRef.current?.click()}>
                <Upload size={16} />{importingPackage ? 'Inspecting...' : 'Full ZIP'}
              </button>
              {editing ? (
                <button className="soft-button" type="button" disabled={exportingPackage || importingPackage || importingTests || saving} onClick={() => void downloadCurrentPackage()}>
                  <Download size={16} />{exportingPackage ? 'Packaging...' : 'Current ZIP'}
                </button>
              ) : null}
            </div>
            <span>
              <strong>{packageSummary || 'Import statement, metadata and testcase files'}</strong>
              <small>Supports problem.json, statement.md, checker/source files and paired .in/.out testcases.</small>
            </span>
          </div>
          <div className="cppro-management-package-upload cppro-management-testcase-upload" data-management-problem-testcase-upload>
            <div className="cppro-management-testcase-mode" role="group" aria-label="Testcase import mode">
              <button type="button" className={testcaseZipMode === 'append' ? 'active' : ''} aria-pressed={testcaseZipMode === 'append'} onClick={() => setTestcaseZipMode('append')}>Append</button>
              <button type="button" className={testcaseZipMode === 'replace' ? 'active' : ''} aria-pressed={testcaseZipMode === 'replace'} onClick={() => setTestcaseZipMode('replace')}>Replace</button>
            </div>
            <span>
              <strong>Testcases only ZIP</strong>
              <small>Upload paired files such as 00.in/00.out. Existing problems save directly to database; new problems keep tests in this draft.</small>
            </span>
            <button className="soft-button" type="button" disabled={importingTests || importingPackage || saving} onClick={() => testcaseZipInputRef.current?.click()}>
              <HardDrive size={16} />{importingTests ? 'Importing...' : 'Upload testcase ZIP'}
            </button>
          </div>
          <div className="cppro-management-fields two-columns">
            <label><span>Problem code</span><input value={draft.externalId} onChange={(event) => patch('externalId', event.currentTarget.value)} placeholder="CTR001" /></label>
            <label><span>Title</span><input value={draft.title} onChange={(event) => patch('title', event.currentTarget.value)} /></label>
            <label><span>Difficulty</span><select value={draft.difficulty} onChange={(event) => patch('difficulty', event.currentTarget.value as ManagementProblemDraft['difficulty'])}><option>Easy</option><option>Medium</option><option>Hard</option></select></label>
            <label><span>Rating (0.1-5)</span><input type="number" min="0.1" max="5" step="0.1" value={draft.rating} onChange={(event) => patch('rating', Number(event.currentTarget.value) || 1)} /></label>
            <label><span>Time limit (ms)</span><input type="number" min="100" max="60000" value={draft.timeLimit} onChange={(event) => patch('timeLimit', Number(event.currentTarget.value) || 1000)} /></label>
            <label><span>Memory limit (MB)</span><input type="number" min="16" max="4096" value={draft.memoryLimit} onChange={(event) => patch('memoryLimit', Number(event.currentTarget.value) || 256)} /></label>
            <label><span>Visibility</span><select value={draft.visibility} onChange={(event) => patch('visibility', event.currentTarget.value as ManagementProblemDraft['visibility'])}><option value="private">Private</option><option value="public">Public</option><option value="waiting">Scheduled</option><option value="organization">Organization</option></select></label>
            <label><span>Scoring</span><select value={draft.scoringMode} onChange={(event) => patch('scoringMode', event.currentTarget.value as ManagementProblemDraft['scoringMode'])}><option value="full">Full score</option><option value="partial">Partial points</option></select></label>
          </div>
          <label className="cppro-management-field-wide"><span>Markdown statement</span><textarea rows={14} value={draft.description} onChange={(event) => patch('description', event.currentTarget.value)} /></label>
          <div className="cppro-management-fields two-columns cppro-management-advanced-fields">
            <label><span>Problem type</span><select value={draft.problemType} onChange={(event) => patch('problemType', event.currentTarget.value as ManagementProblemDraft['problemType'])}><option value="standard">Standard</option><option value="interactive">Interactive</option><option value="output_only">Output only</option></select></label>
            <label><span>I/O mode</span><select value={draft.ioMode} onChange={(event) => patch('ioMode', event.currentTarget.value as ManagementProblemDraft['ioMode'])}><option value="standard">Standard input/output</option><option value="file">File input/output</option></select></label>
            {draft.ioMode === 'file' ? (
              <>
                <label><span>Input file name</span><input value={draft.inputFileName} onChange={(event) => patch('inputFileName', event.currentTarget.value)} placeholder="problem.inp" /></label>
                <label><span>Output file name</span><input value={draft.outputFileName} onChange={(event) => patch('outputFileName', event.currentTarget.value)} placeholder="problem.out" /></label>
              </>
            ) : null}
          </div>
          <div className="cppro-management-asset-grid">
            <div className="cppro-management-asset-card">
              <input
                ref={statementAssetInputRef}
                hidden
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  if (file) void importInlineAsset(file, 'statement');
                }}
              />
              <span>
                <strong>{draft.statementAssetName || 'Statement image/PDF'}</strong>
                <small>{draft.statementAssetSize ? formatUploadBytes(draft.statementAssetSize) : 'Attach statement PDF or image for crawled/original statements.'}</small>
              </span>
              <div>
                <button className="soft-button" type="button" onClick={() => statementAssetInputRef.current?.click()}><Upload size={15} />Upload</button>
                {statementAssetHref && draft.statementAssetName ? <a className="soft-button" href={statementAssetHref} download={draft.statementAssetName}><Download size={15} />Download</a> : null}
                {draft.statementAssetName ? <button className="soft-button danger-soft" type="button" onClick={() => setDraft((current) => ({ ...current, statementAssetName: null, statementAssetType: null, statementAssetData: null, statementAssetSize: null }))}><X size={15} />Remove</button> : null}
              </div>
            </div>
            <div className="cppro-management-asset-card">
              <input
                ref={adminAttachmentInputRef}
                hidden
                type="file"
                accept=".zip,.md,.pdf,.txt,.cpp,.cc,.cxx,.py,.json"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  if (file) void importInlineAsset(file, 'attachment');
                }}
              />
              <span>
                <strong>{draft.adminAttachmentName || 'Hidden admin attachment'}</strong>
                <small>{draft.adminAttachmentSize ? formatUploadBytes(draft.adminAttachmentSize) : 'Private notes, generators, editorial source packs, or checker assets.'}</small>
              </span>
              <div>
                <button className="soft-button" type="button" onClick={() => adminAttachmentInputRef.current?.click()}><Upload size={15} />Upload</button>
                {adminAttachmentHref && draft.adminAttachmentName ? <a className="soft-button" href={adminAttachmentHref} download={draft.adminAttachmentName}><Download size={15} />Download</a> : null}
                {draft.adminAttachmentName ? <button className="soft-button danger-soft" type="button" onClick={() => setDraft((current) => ({ ...current, adminAttachmentName: null, adminAttachmentType: null, adminAttachmentData: null, adminAttachmentSize: null }))}><X size={15} />Remove</button> : null}
              </div>
            </div>
          </div>
          <label className="cppro-management-field-wide"><span>Editorial markdown</span><textarea rows={8} value={draft.editorial} onChange={(event) => patch('editorial', event.currentTarget.value)} /></label>
          <label className="cppro-management-field-wide"><span>Special judge / checker code</span><textarea rows={8} value={draft.checkerCode} onChange={(event) => patch('checkerCode', event.currentTarget.value)} placeholder="Optional checker source code" /></label>
          <div className="cppro-management-fields two-columns cppro-management-advanced-fields">
            <label><span>Reference solution language</span><select value={draft.referenceSolutionLanguage} onChange={(event) => patch('referenceSolutionLanguage', event.currentTarget.value)}>{mergeJudgeLanguages(data.judgeLanguages).map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}</select></label>
          </div>
          <label className="cppro-management-field-wide"><span>Reference solution code</span><textarea rows={10} value={draft.referenceSolutionCode} onChange={(event) => patch('referenceSolutionCode', event.currentTarget.value)} /></label>
        </section>
        <aside className="cppro-management-form-card">
          <header><CodeXml size={19} /><strong>Judge policy</strong></header>
          <div className="cppro-management-language-picker" data-management-language-picker>
            <button type="button" className={draft.allowedLanguages.length === 0 ? 'active' : ''} onClick={() => patch('allowedLanguages', [])}>All enabled languages</button>
            {mergeJudgeLanguages(data.judgeLanguages).map((language) => (
              <button key={language.code} type="button" className={draft.allowedLanguages.includes(language.code) ? 'active' : ''} onClick={() => toggleLanguage(language.code)}>
                <code>{language.code}</code><span>{language.label}</span>
              </button>
            ))}
          </div>
          <div className="cppro-management-sample-test">
            <label><span>{draft.testCases.length ? 'First sample input from package' : 'Sample input'}</span><textarea rows={5} value={draft.sampleInput} onChange={(event) => patchSampleTestcase('input', event.currentTarget.value)} /></label>
            <label><span>{draft.testCases.length ? 'First sample output from package' : 'Sample output'}</span><textarea rows={5} value={draft.sampleOutput} onChange={(event) => patchSampleTestcase('output', event.currentTarget.value)} /></label>
          </div>
          <div className="cppro-management-package-summary" data-management-problem-testcase-summary>
            <ListChecks size={16} />
            <span>
              <strong>{existingTestCasesLoading ? 'Loading testcase details…' : visibleTestCases.length ? `${visibleTestCases.length.toLocaleString('vi-VN')} testcase(s) available` : 'Manual sample testcase mode'}</strong>
              <small>{visibleTestCases.length ? `${visibleTestCases.filter((item) => item.isSample).length.toLocaleString('vi-VN')} sample testcase(s) will be saved.` : 'Upload a ZIP package to import many testcase files at once.'}</small>
            </span>
          </div>
          {existingTestCasesError ? <p className="service-message">{existingTestCasesError}</p> : null}
          {visibleTestCases.length ? (
            <details className="cppro-management-existing-testcases" data-management-existing-testcases>
              <summary><Eye size={16} />View testcase details ({visibleTestCases.length.toLocaleString('vi-VN')})</summary>
              <div className="cppro-management-existing-testcase-list">
                {visibleTestCases.map((testCase, index) => (
                  <article key={`${index}-${testCase.input.slice(0, 32)}`}>
                    <header><strong>Test #{index + 1}</strong>{testCase.isSample ? <span>Sample</span> : <span>Private</span>}</header>
                    <div>
                      <section><small>Input</small><pre>{testCase.input || '∅'}</pre></section>
                      <section><small>Expected output</small><pre>{testCase.output || testCase.outputs?.join('\n') || '∅'}</pre></section>
                    </div>
                    {testCase.explanation ? <p>{testCase.explanation}</p> : null}
                  </article>
                ))}
              </div>
            </details>
          ) : null}
        </aside>
      </div>
      <footer className="cppro-management-form-actions">
        <button className="soft-button" type="button" onClick={() => go('/management/problems')}>Cancel</button>
        <button className="blue-button" type="button" disabled={saving} onClick={() => void submit()}><Send size={16} />{saving ? 'Saving...' : editing ? 'Save problem' : 'Create problem'}</button>
      </footer>
    </section>
  );
}

function toManagementDateTimeLocal(value: unknown) {
  const text = String(value || '').trim();
  if (!text) return '';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function managementProblemIdList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => {
    if (item && typeof item === 'object') {
      const row = item as Record<string, unknown>;
      return Number(row.problem_id ?? row.problemId ?? row.problem ?? row.id);
    }
    return Number(item);
  }).filter((id) => Number.isInteger(id) && id > 0)));
}

type ManagementContestFormat = 'DEFAULT' | 'ICPC' | 'IOI' | 'IOI_LEGACY' | 'ATCODER' | 'ECOO' | 'VNOJ';
type ManagementScoreboardVisibility = 'V' | 'H' | 'C' | 'P';

const managementContestFormats: Array<{
  value: ManagementContestFormat;
  label: string;
  description: string;
  freeze: boolean;
}> = [
  { value: 'DEFAULT', label: 'Default', description: 'Điểm cao nhất, xếp hạng theo điểm và thời gian.', freeze: false },
  { value: 'ICPC', label: 'ICPC', description: 'Xếp hạng theo số bài AC, thời gian và penalty.', freeze: true },
  { value: 'IOI', label: 'IOI (2016+)', description: 'Chấm điểm từng bài, hỗ trợ điểm từng subtask.', freeze: false },
  { value: 'IOI_LEGACY', label: 'IOI legacy', description: 'Thể thức IOI trước 2016 với tùy chọn lần nộp làm đổi điểm cuối.', freeze: false },
  { value: 'ATCODER', label: 'AtCoder', description: 'Tổng điểm và penalty theo số lần nộp sai.', freeze: false },
  { value: 'ECOO', label: 'ECOO', description: 'Điểm, thưởng first AC và thưởng thời gian.', freeze: false },
  { value: 'VNOJ', label: 'VNOJ', description: 'Điểm theo submission cùng penalty và tùy chọn LSO.', freeze: true },
];

function managementContestFormatValue(value: unknown): ManagementContestFormat {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'icpc') return 'ICPC';
  if (normalized === 'ioi16' || normalized === 'ioi-2016') return 'IOI';
  if (normalized === 'ioi' || normalized === 'legacy-ioi' || normalized === 'ioi_legacy') return 'IOI_LEGACY';
  if (normalized === 'atcoder') return 'ATCODER';
  if (normalized === 'ecoo') return 'ECOO';
  if (normalized === 'vnoj') return 'VNOJ';
  return 'DEFAULT';
}

type ManagementContestDraft = {
  externalId: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  status: 'draft' | 'upcoming' | 'live' | 'finished';
  format: ManagementContestFormat;
  visibility: 'public' | 'private' | 'organization';
  allowVirtual: boolean;
  isRated: boolean;
  freezeMinutes: number;
  scoreboardVisibility: ManagementScoreboardVisibility;
  showSubmissionList: boolean;
  penaltyMinutes: number;
  cumtime: boolean;
  firstAcBonus: number;
  timeBonus: number;
  lastScoreAltering: boolean;
  lso: boolean;
  problemIds: number[];
  allowedLanguages: string[];
};

const emptyManagementContestDraft: ManagementContestDraft = {
  externalId: '',
  title: '',
  description: '',
  startTime: '',
  endTime: '',
  status: 'draft',
  format: 'IOI',
  visibility: 'public',
  allowVirtual: false,
  isRated: false,
  freezeMinutes: 0,
  scoreboardVisibility: 'V',
  showSubmissionList: true,
  penaltyMinutes: 20,
  cumtime: false,
  firstAcBonus: 10,
  timeBonus: 5,
  lastScoreAltering: false,
  lso: false,
  problemIds: [],
  allowedLanguages: [],
};

function managementContestFormatConfig(value: unknown) {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function ManagementContestForm({
  route,
  data,
  go,
  onToast,
}: {
  route: Extract<ManagementSubpageRoute, { kind: 'contest-create' | 'contest-edit' }>;
  data: CpproData;
  go: (path: string) => void;
  onToast: (toast: ManagementToast | null) => void;
}) {
  const editing = route.kind === 'contest-edit';
  const routeId = route.kind === 'contest-edit' ? route.id : '';
  const locale = parseCpproPath(window.location.pathname).locale || readStoredLocale();
  const mt = (text: string | undefined) => managementText(locale, text);
  const [draft, setDraft] = useState<ManagementContestDraft>(emptyManagementContestDraft);
  const [problemQuery, setProblemQuery] = useState('');
  const [languageDraft, setLanguageDraft] = useState('');
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const patch = <K extends keyof ManagementContestDraft>(key: K, value: ManagementContestDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const selectedFormat = managementContestFormats.find((item) => item.value === draft.format) || managementContestFormats[0];
  const changeContestFormat = (format: ManagementContestFormat) => {
    setDraft((current) => ({
      ...current,
      format,
      freezeMinutes: managementContestFormats.find((item) => item.value === format)?.freeze ? current.freezeMinutes : 0,
    }));
  };

  useEffect(() => {
    if (!editing) {
      setDraft(emptyManagementContestDraft);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    cpproApiFetch<Record<string, unknown>>(`/contests/${encodeURIComponent(routeId)}`)
      .then((row) => {
        if (cancelled) return;
        const status = String(row.status || 'draft').toLowerCase();
        const format = managementContestFormatValue(row.format || 'default');
        const visibility = String(row.visibility || 'public').toLowerCase();
        const formatConfig = managementContestFormatConfig(row.format_config ?? row.formatConfig);
        setDraft({
          externalId: String(row.external_id || row.externalId || ''),
          title: String(row.title || ''),
          description: String(row.description || ''),
          startTime: toManagementDateTimeLocal(row.start_time ?? row.startTime),
          endTime: toManagementDateTimeLocal(row.end_time ?? row.endTime),
          status: ['upcoming', 'live', 'finished'].includes(status) ? status as ManagementContestDraft['status'] : 'draft',
          format,
          visibility: ['private', 'organization'].includes(visibility) ? visibility as ManagementContestDraft['visibility'] : 'public',
          allowVirtual: Boolean(row.allow_virtual ?? row.allowVirtual),
          isRated: Boolean(row.is_rated ?? row.isRated),
          freezeMinutes: Math.max(0, Number(row.freeze_minutes ?? row.freezeMinutes ?? 0) || 0),
          scoreboardVisibility: ['V', 'H', 'C', 'P'].includes(String(row.scoreboard_visibility ?? row.scoreboardVisibility ?? 'V').toUpperCase())
            ? String(row.scoreboard_visibility ?? row.scoreboardVisibility ?? 'V').toUpperCase() as ManagementScoreboardVisibility
            : 'V',
          showSubmissionList: Boolean(row.show_submission_list ?? row.showSubmissionList),
          penaltyMinutes: Math.max(0, Number(formatConfig.penalty ?? formatConfig.penaltyMinutes ?? 20) || 0),
          cumtime: Boolean(formatConfig.cumtime),
          firstAcBonus: Math.max(0, Number(formatConfig.first_ac_bonus ?? formatConfig.firstAcBonus ?? 10) || 0),
          timeBonus: Math.max(0, Number(formatConfig.time_bonus ?? formatConfig.timeBonus ?? 5) || 0),
          lastScoreAltering: Boolean(formatConfig.last_score_altering ?? formatConfig.lastScoreAltering),
          lso: Boolean(formatConfig.LSO ?? formatConfig.lso),
          problemIds: managementProblemIdList(row.problems ?? row.problem_ids ?? row.problemIds),
          allowedLanguages: normalizeStringList(formatConfig.allowedLanguages ?? formatConfig.allowed_languages, []),
        });
      })
      .catch((error) => {
        if (!cancelled) onToast({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load contest.' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editing, routeId]);

  const filteredProblems = data.problems.filter((problem) => {
    const needle = problemQuery.trim().toLowerCase();
    return !needle || `${problem.code} ${problem.title} ${problem.slug}`.toLowerCase().includes(needle);
  });
  const toggleProblem = (id: number) => {
    patch('problemIds', draft.problemIds.includes(id)
      ? draft.problemIds.filter((problemId) => problemId !== id)
      : [...draft.problemIds, id]);
  };
  const addContestLanguage = (code = languageDraft) => {
    const normalized = String(code || '').trim();
    if (!normalized) return;
    patch('allowedLanguages', Array.from(new Set([...draft.allowedLanguages, normalized])));
    setLanguageDraft('');
  };
  const removeContestLanguage = (code: string) => {
    patch('allowedLanguages', draft.allowedLanguages.filter((item) => item !== code));
  };
  const submit = async () => {
    if (draft.title.trim().length < 3) {
      onToast({ tone: 'error', text: mt('Contest title must contain at least three characters.') });
      return;
    }
    setSaving(true);
    try {
      await cpproApiFetch(editing ? `/contests/${encodeURIComponent(routeId)}` : '/contests', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify({
          externalId: draft.externalId.trim() || undefined,
          title: draft.title.trim(),
          description: draft.description,
          startTime: draft.startTime ? new Date(draft.startTime).toISOString() : null,
          endTime: draft.endTime ? new Date(draft.endTime).toISOString() : null,
          status: draft.status,
          format: draft.format,
          visibility: draft.visibility,
          allowVirtual: draft.allowVirtual,
          isRated: draft.isRated,
          freezeMinutes: draft.freezeMinutes,
          scoreboardVisibility: draft.scoreboardVisibility,
          showSubmissionList: draft.showSubmissionList,
          scoringConfig: {
            penaltyMinutes: draft.penaltyMinutes,
            cumtime: draft.cumtime,
            firstAcBonus: draft.firstAcBonus,
            timeBonus: draft.timeBonus,
            lastScoreAltering: draft.lastScoreAltering,
            lso: draft.lso,
          },
          formatConfig: {
            allowedLanguages: draft.allowedLanguages,
          },
          problemIds: draft.problemIds,
        }),
      });
      onToast({ tone: 'success', text: editing ? mt('Contest information and problem set updated.') : mt('Contest created.') });
      go('/management/contests');
    } catch (error) {
      onToast({ tone: 'error', text: error instanceof Error ? error.message : mt('Could not save contest.') });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <DataLoadingPanel label="Loading contest editor" rows={7} />;
  return (
    <section className="cppro-management-subpage" data-management-subpage="contest">
      <div className="cppro-management-form-grid">
        <section className="cppro-management-form-card">
          <header><Trophy size={19} /><strong>{mt('Contest information')}</strong></header>
          <div className="cppro-management-fields two-columns">
            <label><span>{mt('Contest code')}</span><input value={draft.externalId} onChange={(event) => patch('externalId', event.currentTarget.value)} /></label>
            <label><span>{mt('Title')}</span><input value={draft.title} onChange={(event) => patch('title', event.currentTarget.value)} /></label>
            <label><span>{mt('Start time')}</span><input type="datetime-local" value={draft.startTime} onChange={(event) => patch('startTime', event.currentTarget.value)} /></label>
            <label><span>{mt('End time')}</span><input type="datetime-local" value={draft.endTime} onChange={(event) => patch('endTime', event.currentTarget.value)} /></label>
            <label><span>{mt('Status')}</span><select value={draft.status} onChange={(event) => patch('status', event.currentTarget.value as ManagementContestDraft['status'])}><option value="draft">{mt('Draft')}</option><option value="upcoming">{mt('Upcoming')}</option><option value="live">{mt('Live')}</option><option value="finished">{mt('Finished')}</option></select></label>
            <label><span>{mt('Format')}</span><select data-management-contest-format value={draft.format} onChange={(event) => changeContestFormat(event.currentTarget.value as ManagementContestFormat)}>{managementContestFormats.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label><span>{mt('Visibility')}</span><select value={draft.visibility} onChange={(event) => patch('visibility', event.currentTarget.value as ManagementContestDraft['visibility'])}><option value="public">{mt('Public')}</option><option value="private">{mt('Private')}</option><option value="organization">{mt('Organization')}</option></select></label>
            <label className="cppro-management-check-field"><input type="checkbox" checked={draft.allowVirtual} onChange={(event) => patch('allowVirtual', event.currentTarget.checked)} /><span>{mt('Allow virtual participation')}</span></label>
            <label className="cppro-management-check-field"><input type="checkbox" checked={draft.isRated} onChange={(event) => patch('isRated', event.currentTarget.checked)} /><span>{mt('Rated contest')}</span></label>
          </div>
          <section className="cppro-management-format-picker" aria-label={mt('Format')}>
            <header>
              <span><Gauge size={16} />{mt('Choose scoring format')}</span>
              <small>{mt('The selected format controls scoring, penalty, and scoreboard options below.')}</small>
            </header>
            <div data-management-contest-format-cards>
              {managementContestFormats.map((item) => {
                const active = item.value === draft.format;
                return (
                  <button
                    key={item.value}
                    type="button"
                    data-active={active ? 'true' : 'false'}
                    data-freeze={item.freeze ? 'true' : 'false'}
                    aria-pressed={active}
                    onClick={() => changeContestFormat(item.value)}
                  >
                    <span>
                      <strong>{item.label}</strong>
                      {item.freeze ? <em><Snowflake size={12} />{mt('Freeze')}</em> : null}
                    </span>
                    <small>{item.description}</small>
                  </button>
                );
              })}
            </div>
          </section>
          <section className="cppro-management-contest-policy" data-management-contest-policy>
            <header>
              <span><Gauge size={17} />{mt('Scoring and scoreboard')}</span>
              <em>{selectedFormat.label}</em>
            </header>
            <p>{selectedFormat.description}</p>
            <div className="cppro-management-fields two-columns">
              {['ICPC', 'ATCODER', 'VNOJ'].includes(draft.format) ? <label><span>{mt('Wrong submission penalty (minutes)')}</span><input type="number" min={0} max={360} value={draft.penaltyMinutes} onChange={(event) => patch('penaltyMinutes', Math.max(0, Number(event.currentTarget.value) || 0))} /></label> : null}
              {['IOI', 'IOI_LEGACY', 'ECOO'].includes(draft.format) ? <label className="cppro-management-check-field"><input type="checkbox" checked={draft.cumtime} onChange={(event) => patch('cumtime', event.currentTarget.checked)} /><span>{mt('Use cumulative time as tiebreaker')}</span></label> : null}
              {draft.format === 'ECOO' ? <label><span>{mt('First AC bonus')}</span><input type="number" min={0} max={10000} value={draft.firstAcBonus} onChange={(event) => patch('firstAcBonus', Math.max(0, Number(event.currentTarget.value) || 0))} /></label> : null}
              {draft.format === 'ECOO' ? <label><span>{mt('Time bonus')}</span><input type="number" min={0} max={10000} value={draft.timeBonus} onChange={(event) => patch('timeBonus', Math.max(0, Number(event.currentTarget.value) || 0))} /></label> : null}
              {draft.format === 'IOI_LEGACY' ? <label className="cppro-management-check-field"><input type="checkbox" checked={draft.lastScoreAltering} onChange={(event) => patch('lastScoreAltering', event.currentTarget.checked)} /><span>{mt('Last score-altering submission wins')}</span></label> : null}
              {draft.format === 'VNOJ' ? <label className="cppro-management-check-field"><input type="checkbox" checked={draft.lso} onChange={(event) => patch('lso', event.currentTarget.checked)} /><span>{mt('Enable last submission optimization')}</span></label> : null}
              <label><span>{mt('Freeze last minutes')}</span><input data-management-contest-freeze type="number" min={0} value={draft.freezeMinutes} disabled={!selectedFormat.freeze} onChange={(event) => patch('freezeMinutes', Math.max(0, Number(event.currentTarget.value) || 0))} /></label>
              <label><span>{mt('Scoreboard visibility')}</span><select value={draft.scoreboardVisibility} onChange={(event) => patch('scoreboardVisibility', event.currentTarget.value as ManagementScoreboardVisibility)}><option value="V">{mt('Always visible')}</option><option value="H">{mt('Always hidden')}</option><option value="C">{mt('Hidden during contest')}</option><option value="P">{mt('Hidden during participation')}</option></select></label>
              <label className="cppro-management-check-field"><input type="checkbox" checked={draft.showSubmissionList} onChange={(event) => patch('showSubmissionList', event.currentTarget.checked)} /><span>{mt('Show contest submission list')}</span></label>
            </div>
            <small><Snowflake size={13} />{selectedFormat.freeze ? mt('Freeze hides submissions made after the cutoff from contestants; administrators still see the full board.') : mt('LCOJ supports frozen snapshots for ICPC and VNOJ formats.')}</small>
          </section>
          <label className="cppro-management-field-wide"><span>{mt('Description')}</span><textarea rows={10} value={draft.description} onChange={(event) => patch('description', event.currentTarget.value)} /></label>
        </section>
        <aside className="cppro-management-form-card">
          <header><ListChecks size={19} /><strong>{mt('Problems')} ({draft.problemIds.length})</strong></header>
          <section className="cppro-management-contest-languages" data-management-contest-languages>
            <header>
              <span><CodeXml size={16} />{mt('Allowed languages')}</span>
              <button className="soft-button" type="button" onClick={() => patch('allowedLanguages', [])}>{mt('All')}</button>
            </header>
            <div>
              {draft.allowedLanguages.length ? draft.allowedLanguages.map((code) => (
                <button key={code} type="button" onClick={() => removeContestLanguage(code)}>
                  <code>{code}</code><X size={13} />
                </button>
              )) : <small>{mt('All enabled judge languages are allowed.')}</small>}
            </div>
            <label>
              <select value={languageDraft} onChange={(event) => setLanguageDraft(event.currentTarget.value)}>
                <option value="">{mt('Select language...')}</option>
                {mergeJudgeLanguages(data.judgeLanguages).map((language) => (
                  <option key={language.code} value={language.code}>{language.label} ({language.code})</option>
                ))}
              </select>
              <button className="blue-button" type="button" disabled={!languageDraft} onClick={() => addContestLanguage()}>
                <CodeXml size={15} />{mt('Add language')}
              </button>
            </label>
          </section>
          <label className="search-box small"><Search size={16} /><input value={problemQuery} onChange={(event) => setProblemQuery(event.currentTarget.value)} placeholder={mt('Search problem...')} /></label>
          <div className="cppro-management-problem-picker" data-management-contest-problems>
            {filteredProblems.slice(0, 300).map((problem) => (
              <button key={problem.id} type="button" className={draft.problemIds.includes(problem.id) ? 'active' : ''} onClick={() => toggleProblem(problem.id)}>
                <span><code>{problem.code || problem.slug}</code><strong>{problem.title}</strong></span>
                <b>{draft.problemIds.includes(problem.id) ? mt('Selected') : `${problem.score} ${mt('pts')}`}</b>
              </button>
            ))}
          </div>
        </aside>
      </div>
      <footer className="cppro-management-form-actions">
        {editing ? (
          <>
            <button className="soft-button" type="button" onClick={() => go(`/management/contests/${encodeURIComponent(routeId)}/integrity`)}>
              <ShieldCheck size={16} />Integrity
            </button>
            <button className="soft-button" type="button" onClick={() => go(`/management/contests/${encodeURIComponent(routeId)}/moss`)}>
              <Search size={16} />MOSS
            </button>
          </>
        ) : null}
        <button className="soft-button" type="button" onClick={() => go('/management/contests')}>{mt('Cancel')}</button>
        <button className="blue-button" type="button" disabled={saving} onClick={() => void submit()}><Send size={16} />{saving ? mt('Saving...') : editing ? mt('Save contest and problems') : mt('Create contest')}</button>
      </footer>
    </section>
  );
}

function ManagementOrganizationForm({
  data,
  go,
  onToast,
}: {
  data: CpproData;
  go: (path: string) => void;
  onToast: (toast: ManagementToast | null) => void;
}) {
  const [draft, setDraft] = useState({
    name: '',
    slug: '',
    description: '',
    logoUrl: '',
    visibility: 'private',
    ownerUsername: '',
  });
  const [saving, setSaving] = useState(false);
  const patch = (key: keyof typeof draft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    if (draft.name.trim().length < 2) {
      onToast({ tone: 'error', text: 'Organization name is required.' });
      return;
    }
    setSaving(true);
    try {
      await cpproApiFetch('/admin/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: draft.name.trim(),
          slug: draft.slug.trim() || undefined,
          description: draft.description || null,
          logoUrl: draft.logoUrl.trim() || null,
          visibility: draft.visibility,
          ownerUsername: draft.ownerUsername.trim() || undefined,
        }),
      });
      onToast({ tone: 'success', text: 'Organization created.' });
      go('/management/organizations');
    } catch (error) {
      onToast({ tone: 'error', text: error instanceof Error ? error.message : 'Could not create organization.' });
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="cppro-management-subpage" data-management-subpage="organization">
      <section className="cppro-management-form-card compact">
        <header><GraduationCap size={19} /><strong>Organization details</strong></header>
        <div className="cppro-management-fields two-columns">
          <label><span>Name</span><input value={draft.name} onChange={(event) => patch('name', event.currentTarget.value)} /></label>
          <label><span>Slug</span><input value={draft.slug} onChange={(event) => patch('slug', event.currentTarget.value)} placeholder="organization-slug" /></label>
          <label><span>Owner username</span><input list="management-owner-users" value={draft.ownerUsername} onChange={(event) => patch('ownerUsername', event.currentTarget.value)} /></label>
          <datalist id="management-owner-users">{data.users.map((user) => <option key={user.username} value={user.username}>{user.fullName}</option>)}</datalist>
          <label><span>Visibility</span><select value={draft.visibility} onChange={(event) => patch('visibility', event.currentTarget.value)}><option value="private">Private</option><option value="public">Public</option></select></label>
          <label><span>Logo URL</span><input type="url" value={draft.logoUrl} onChange={(event) => patch('logoUrl', event.currentTarget.value)} /></label>
        </div>
        <label className="cppro-management-field-wide"><span>Description</span><textarea rows={9} value={draft.description} onChange={(event) => patch('description', event.currentTarget.value)} /></label>
      </section>
      <footer className="cppro-management-form-actions">
        <button className="soft-button" type="button" onClick={() => go('/management/organizations')}>Cancel</button>
        <button className="blue-button" type="button" disabled={saving} onClick={() => void submit()}><Send size={16} />{saving ? 'Creating...' : 'Create organization'}</button>
      </footer>
    </section>
  );
}

function ManagementContestIntegrity({
  contestId,
  onToast,
}: {
  contestId: string;
  onToast: (toast: ManagementToast | null) => void;
}) {
  const [sessions, setSessions] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [drafts, setDrafts] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const loadSessions = () => {
    setLoading(true);
    cpproApiFetch<unknown>(`/admin/contests/${encodeURIComponent(contestId)}/integrity-sessions`)
      .then((payload) => setSessions(rowsFromApi<Record<string, unknown>>(payload)))
      .catch((error) => onToast({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load integrity sessions.' }))
      .finally(() => setLoading(false));
  };
  useEffect(loadSessions, [contestId]);
  const inspect = async (session: Record<string, unknown>) => {
    const id = Number(session.id);
    if (!id) return;
    setSelected(session);
    setDetailLoading(true);
    try {
      const [eventPayload, draftPayload] = await Promise.all([
        cpproApiFetch<unknown>(`/admin/integrity-sessions/${id}/events`),
        cpproApiFetch<unknown>(`/admin/integrity-sessions/${id}/drafts`),
      ]);
      setEvents(rowsFromApi<Record<string, unknown>>(eventPayload));
      setDrafts(rowsFromApi<Record<string, unknown>>(draftPayload));
    } catch (error) {
      onToast({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load integrity details.' });
    } finally {
      setDetailLoading(false);
    }
  };
  if (loading) return <DataLoadingPanel label="Loading integrity sessions" rows={6} />;
  return (
    <section className="cppro-management-subpage" data-management-subpage="contest-integrity">
      <div className="cppro-management-ops-grid">
        <section className="cppro-management-form-card">
          <header><ShieldCheck size={19} /><strong>Integrity sessions ({sessions.length})</strong><button className="soft-button" type="button" onClick={loadSessions}><Loader2 size={15} />Refresh</button></header>
          <div className="cppro-management-record-list">
            {sessions.map((session) => (
              <button key={String(session.id)} type="button" className={selected?.id === session.id ? 'active' : ''} onClick={() => void inspect(session)}>
                <span><strong>@{String(session.username || session.user_id || 'user')}</strong><small>{String(session.mode || 'contest')} · {formatDate(String(session.last_heartbeat_at || session.created_at || ''))}</small></span>
                <b data-status={String(session.status || 'active')}>{String(session.status || 'active')}</b>
              </button>
            ))}
            {!sessions.length ? <p className="contest-empty">No integrity sessions found.</p> : null}
          </div>
        </section>
        <section className="cppro-management-form-card">
          <header><Eye size={19} /><strong>Session detail</strong></header>
          {detailLoading ? <DataLoadingPanel label="Loading session detail" rows={5} compact /> : selected ? (
            <div className="cppro-management-integrity-detail">
              <dl>
                <div><dt>Session</dt><dd>#{String(selected.id)}</dd></div>
                <div><dt>User</dt><dd>@{String(selected.username || selected.user_id)}</dd></div>
                <div><dt>Status</dt><dd>{String(selected.status || '')}</dd></div>
                <div><dt>Resume code</dt><dd>{String(selected.resume_code || '—')}</dd></div>
              </dl>
              <h3>Events ({events.length})</h3>
              <div className="cppro-management-mini-table">{events.slice(0, 100).map((event) => <div key={String(event.id)}><code>{String(event.sequence || event.id)}</code><span>{String(event.event_type || event.type || 'event')}</span><small>{formatDate(String(event.occurred_at || event.created_at || ''))}</small></div>)}</div>
              <h3>Drafts ({drafts.length})</h3>
              <div className="cppro-management-mini-table">{drafts.slice(0, 100).map((draft, index) => <div key={`${String(draft.problem_id || index)}`}><code>{String(draft.problem_id || '')}</code><span>{String(draft.title || draft.language || 'draft')}</span><small>{formatDate(String(draft.saved_at || ''))}</small></div>)}</div>
            </div>
          ) : <p className="contest-empty">Select a session to inspect events and drafts.</p>}
        </section>
      </div>
    </section>
  );
}

function ManagementContestMoss({
  contestId,
  data,
  onToast,
}: {
  contestId: string;
  data: CpproData;
  onToast: (toast: ManagementToast | null) => void;
}) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [problemId, setProblemId] = useState('');
  const [language, setLanguage] = useState('cpp17');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const load = () => {
    setLoading(true);
    cpproApiFetch<unknown>(`/contests/${encodeURIComponent(contestId)}/moss`)
      .then((payload) => setRows(rowsFromApi<Record<string, unknown>>(payload)))
      .catch((error) => onToast({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load MOSS results.' }))
      .finally(() => setLoading(false));
  };
  useEffect(load, [contestId]);
  const run = async () => {
    if (!problemId || !language) {
      onToast({ tone: 'error', text: 'Select a problem and language.' });
      return;
    }
    setRunning(true);
    try {
      await cpproApiFetch(`/contests/${encodeURIComponent(contestId)}/moss`, {
        method: 'POST',
        body: JSON.stringify({ problemId: Number(problemId), language }),
      });
      onToast({ tone: 'success', text: 'Similarity scan queued.' });
      load();
    } catch (error) {
      onToast({ tone: 'error', text: error instanceof Error ? error.message : 'Could not start similarity scan.' });
    } finally {
      setRunning(false);
    }
  };
  return (
    <section className="cppro-management-subpage" data-management-subpage="contest-moss">
      <section className="cppro-management-form-card compact">
        <header><Search size={19} /><strong>Start similarity scan</strong></header>
        <div className="cppro-management-fields two-columns">
          <label><span>Problem</span><select value={problemId} onChange={(event) => setProblemId(event.currentTarget.value)}><option value="">Select problem</option>{data.problems.map((problem) => <option key={problem.id} value={problem.id}>{problem.code} · {problem.title}</option>)}</select></label>
          <label><span>Language</span><select value={language} onChange={(event) => setLanguage(event.currentTarget.value)}>{mergeJudgeLanguages(data.judgeLanguages).map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
        </div>
        <footer className="cppro-management-form-actions inline"><button className="blue-button" type="button" disabled={running} onClick={() => void run()}><Shield size={16} />{running ? 'Starting...' : 'Run scan'}</button></footer>
      </section>
      <section className="cppro-management-form-card">
        <header><ListChecks size={19} /><strong>Scan history</strong><button className="soft-button" type="button" onClick={load}>Refresh</button></header>
        {loading ? <DataLoadingPanel label="Loading scan history" rows={5} compact /> : (
          <div className="cppro-management-table-scroll"><table className="cppro-management-data-table"><thead><tr><th>ID</th><th>Problem</th><th>Language</th><th>Status</th><th>Submissions</th><th>Created</th></tr></thead><tbody>{rows.map((row) => <tr key={String(row.id)}><td>#{String(row.id)}</td><td>{String(row.problem_title || row.problem_id || '')}</td><td>{String(row.language || '')}</td><td><span className="management-status">{String(row.status || '')}</span></td><td>{Number(row.submission_count || 0)}</td><td>{formatDate(String(row.created_at || ''))}</td></tr>)}</tbody></table></div>
        )}
      </section>
    </section>
  );
}

function ManagementQuizForm({
  go,
  onToast,
}: {
  go: (path: string) => void;
  onToast: (toast: ManagementToast | null) => void;
}) {
  const [questions, setQuestions] = useState<Array<Record<string, unknown>>>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [draft, setDraft] = useState({ title: '', slug: '', description: '', status: 'draft', timeLimitMinutes: 30, attemptLimit: 1, shuffleQuestions: false, shuffleOptions: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    cpproApiFetch<unknown>('/admin/quiz/questions')
      .then((payload) => setQuestions(rowsFromApi<Record<string, unknown>>(payload)))
      .catch((error) => onToast({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load quiz questions.' }))
      .finally(() => setLoading(false));
  }, []);
  const submit = async () => {
    if (draft.title.trim().length < 3) {
      onToast({ tone: 'error', text: 'Quiz title must contain at least three characters.' });
      return;
    }
    setSaving(true);
    try {
      await cpproApiFetch('/admin/quizzes', {
        method: 'POST',
        body: JSON.stringify({
          ...draft,
          slug: draft.slug.trim() || undefined,
          description: draft.description || null,
          items: selectedIds.map((questionId) => ({ questionId })),
        }),
      });
      onToast({ tone: 'success', text: 'Quiz created.' });
      go('/management/quizzes');
    } catch (error) {
      onToast({ tone: 'error', text: error instanceof Error ? error.message : 'Could not create quiz.' });
    } finally {
      setSaving(false);
    }
  };
  const patchDraft = (patch: Partial<typeof draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };
  return (
    <section className="cppro-management-subpage" data-management-subpage="quiz-create">
      <div className="cppro-management-form-grid">
        <section className="cppro-management-form-card">
          <header><FileQuestion size={19} /><strong>Quiz information</strong></header>
          <div className="cppro-management-fields two-columns">
            <label><span>Title</span><input value={draft.title} onChange={(event) => patchDraft({ title: event.currentTarget.value })} /></label>
            <label><span>Slug</span><input value={draft.slug} onChange={(event) => patchDraft({ slug: event.currentTarget.value })} /></label>
            <label><span>Status</span><select value={draft.status} onChange={(event) => patchDraft({ status: event.currentTarget.value })}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
            <label><span>Time limit (minutes)</span><input type="number" min="1" max="1440" value={draft.timeLimitMinutes} onChange={(event) => patchDraft({ timeLimitMinutes: Number(event.currentTarget.value) || 30 })} /></label>
            <label><span>Attempt limit</span><input type="number" min="1" max="100" value={draft.attemptLimit} onChange={(event) => patchDraft({ attemptLimit: Number(event.currentTarget.value) || 1 })} /></label>
            <label className="cppro-management-check-field"><input type="checkbox" checked={draft.shuffleQuestions} onChange={(event) => patchDraft({ shuffleQuestions: event.currentTarget.checked })} /><span>Shuffle questions</span></label>
            <label className="cppro-management-check-field"><input type="checkbox" checked={draft.shuffleOptions} onChange={(event) => patchDraft({ shuffleOptions: event.currentTarget.checked })} /><span>Shuffle options</span></label>
          </div>
          <label className="cppro-management-field-wide"><span>Description</span><textarea rows={10} value={draft.description} onChange={(event) => patchDraft({ description: event.currentTarget.value })} /></label>
        </section>
        <aside className="cppro-management-form-card">
          <header><ListChecks size={19} /><strong>Question bank ({selectedIds.length})</strong></header>
          {loading ? <DataLoadingPanel label="Loading questions" rows={6} compact /> : <div className="cppro-management-record-list">{questions.map((question) => {
            const id = Number(question.id);
            return <button key={id} type="button" className={selectedIds.includes(id) ? 'active' : ''} onClick={() => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])}><span><strong>{String(question.title || `Question ${id}`)}</strong><small>{String(question.question_type || question.questionType || '')}</small></span><b>{selectedIds.includes(id) ? 'Selected' : String(question.default_points || 1)}</b></button>;
          })}</div>}
        </aside>
      </div>
      <footer className="cppro-management-form-actions"><button className="soft-button" type="button" onClick={() => go('/management/quizzes')}>Cancel</button><button className="blue-button" type="button" disabled={saving} onClick={() => void submit()}><Send size={16} />{saving ? 'Creating...' : 'Create quiz'}</button></footer>
    </section>
  );
}

function ManagementQuizQuestions({ onToast }: { onToast: (toast: ManagementToast | null) => void }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ title: '', prompt: '', questionType: 'single_choice', difficulty: 'Easy', defaultPoints: 1, optionA: '', optionB: '', correctIndex: 0 });
  const load = () => {
    setLoading(true);
    cpproApiFetch<unknown>('/admin/quiz/questions')
      .then((payload) => setRows(rowsFromApi<Record<string, unknown>>(payload)))
      .catch((error) => onToast({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load questions.' }))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  const submit = async () => {
    const shortAnswer = draft.questionType === 'short_answer';
    if (draft.title.trim().length < 3 || !draft.prompt.trim() || (!shortAnswer && (!draft.optionA.trim() || !draft.optionB.trim()))) {
      onToast({ tone: 'error', text: 'Complete the question title, prompt and answer options.' });
      return;
    }
    setSaving(true);
    try {
      await cpproApiFetch('/admin/quiz/questions', {
        method: 'POST',
        body: JSON.stringify({
          title: draft.title.trim(),
          prompt: draft.prompt,
          questionType: draft.questionType,
          difficulty: draft.difficulty,
          defaultPoints: draft.defaultPoints,
          options: shortAnswer ? [] : [
            { content: draft.optionA, isCorrect: draft.correctIndex === 0 },
            { content: draft.optionB, isCorrect: draft.correctIndex === 1 },
          ],
        }),
      });
      setDraft({ title: '', prompt: '', questionType: 'single_choice', difficulty: 'Easy', defaultPoints: 1, optionA: '', optionB: '', correctIndex: 0 });
      onToast({ tone: 'success', text: 'Quiz question created.' });
      load();
    } catch (error) {
      onToast({ tone: 'error', text: error instanceof Error ? error.message : 'Could not create question.' });
    } finally {
      setSaving(false);
    }
  };
  const remove = async (id: number) => {
    if (!window.confirm(`Delete question #${id}?`)) return;
    try {
      await cpproApiFetch(`/admin/quiz/questions/${id}`, { method: 'DELETE' });
      onToast({ tone: 'success', text: 'Question deleted.' });
      load();
    } catch (error) {
      onToast({ tone: 'error', text: error instanceof Error ? error.message : 'Could not delete question.' });
    }
  };
  const patchDraft = (patch: Partial<typeof draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };
  return (
    <section className="cppro-management-subpage" data-management-subpage="quiz-questions">
      <section className="cppro-management-form-card">
        <header><PenLine size={19} /><strong>New question</strong></header>
        <div className="cppro-management-fields two-columns">
          <label><span>Title</span><input value={draft.title} onChange={(event) => patchDraft({ title: event.currentTarget.value })} /></label>
          <label><span>Type</span><select value={draft.questionType} onChange={(event) => patchDraft({ questionType: event.currentTarget.value })}><option value="single_choice">Single choice</option><option value="multiple_choice">Multiple choice</option><option value="true_false">True / false</option><option value="short_answer">Short answer</option></select></label>
          <label><span>Difficulty</span><select value={draft.difficulty} onChange={(event) => patchDraft({ difficulty: event.currentTarget.value })}><option>Easy</option><option>Medium</option><option>Hard</option></select></label>
          <label><span>Points</span><input type="number" min="0.1" value={draft.defaultPoints} onChange={(event) => patchDraft({ defaultPoints: Number(event.currentTarget.value) || 1 })} /></label>
        </div>
        <label className="cppro-management-field-wide"><span>Prompt (Markdown)</span><textarea rows={6} value={draft.prompt} onChange={(event) => patchDraft({ prompt: event.currentTarget.value })} /></label>
        {draft.questionType !== 'short_answer' ? <div className="cppro-management-fields two-columns"><label><span>Option A</span><input value={draft.optionA} onChange={(event) => patchDraft({ optionA: event.currentTarget.value })} /></label><label><span>Option B</span><input value={draft.optionB} onChange={(event) => patchDraft({ optionB: event.currentTarget.value })} /></label><label><span>Correct option</span><select value={draft.correctIndex} onChange={(event) => patchDraft({ correctIndex: Number(event.currentTarget.value) })}><option value={0}>Option A</option><option value={1}>Option B</option></select></label></div> : null}
        <footer className="cppro-management-form-actions inline"><button className="blue-button" type="button" disabled={saving} onClick={() => void submit()}><Send size={16} />{saving ? 'Creating...' : 'Create question'}</button></footer>
      </section>
      <section className="cppro-management-form-card">
        <header><ListChecks size={19} /><strong>Question bank ({rows.length})</strong><button className="soft-button" type="button" onClick={load}>Refresh</button></header>
        {loading ? <DataLoadingPanel label="Loading questions" rows={6} compact /> : <div className="cppro-management-record-list">{rows.map((row) => <article key={String(row.id)}><span><strong>{String(row.title || '')}</strong><small>{String(row.question_type || '')} · {String(row.difficulty || '')}</small></span><button className="management-danger-action" type="button" onClick={() => void remove(Number(row.id))}><X size={14} />Delete</button></article>)}</div>}
      </section>
    </section>
  );
}

function ManagementQuizReviews({ onToast }: { onToast: (toast: ManagementToast | null) => void }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [drafts, setDrafts] = useState<Record<string, { points: number; comment: string }>>({});
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    cpproApiFetch<unknown>('/admin/quiz-reviews')
      .then((payload) => setRows(rowsFromApi<Record<string, unknown>>(payload)))
      .catch((error) => onToast({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load quiz reviews.' }))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  const save = async (row: Record<string, unknown>) => {
    const id = String(row.answer_id || row.id || '');
    const draft = drafts[id] || { points: Number(row.points_awarded || 0), comment: String(row.review_comment || '') };
    try {
      await cpproApiFetch(`/admin/quiz-reviews/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ pointsAwarded: draft.points, reviewComment: draft.comment || null }),
      });
      onToast({ tone: 'success', text: `Review #${id} saved.` });
      load();
    } catch (error) {
      onToast({ tone: 'error', text: error instanceof Error ? error.message : 'Could not save review.' });
    }
  };
  return (
    <section className="cppro-management-subpage" data-management-subpage="quiz-reviews">
      <section className="cppro-management-form-card">
        <header><CheckCircle2 size={19} /><strong>Manual review queue ({rows.length})</strong><button className="soft-button" type="button" onClick={load}>Refresh</button></header>
        {loading ? <DataLoadingPanel label="Loading review queue" rows={6} compact /> : <div className="cppro-management-review-list">{rows.map((row) => {
          const id = String(row.answer_id || row.id || '');
          const draft = drafts[id] || { points: Number(row.points_awarded || 0), comment: String(row.review_comment || '') };
          return <article key={id}><header><span><strong>{String(row.question_title || row.title || `Answer ${id}`)}</strong><small>@{String(row.username || row.user_id || 'user')}</small></span><code>#{id}</code></header><div data-management-review-answer><MarkdownBlock text={String(row.text_answer || row.answer || '')} /></div><div className="cppro-management-fields two-columns"><label><span>Points awarded</span><input type="number" min="0" value={draft.points} onChange={(event) => {
            const points = Number(event.currentTarget.value) || 0;
            setDrafts((current) => ({ ...current, [id]: { ...draft, points } }));
          }} /></label><label><span>Review comment</span><input value={draft.comment} onChange={(event) => {
            const comment = event.currentTarget.value;
            setDrafts((current) => ({ ...current, [id]: { ...draft, comment } }));
          }} /></label></div><button className="blue-button" type="button" onClick={() => void save(row)}>Save review</button></article>;
        })}{!rows.length ? <p className="contest-empty">No answers are waiting for manual review.</p> : null}</div>}
      </section>
    </section>
  );
}

function ManagementProfilePanel({ currentUser }: { currentUser: StoredCpproUser | null }) {
  const user = currentUser ? storedUserToRow(currentUser) : null;
  return (
    <section className="cppro-management-subpage" data-management-subpage="profile">
      <section className="cppro-management-profile-card">
        {user ? <Avatar user={user} large /> : <CircleUserRound size={46} />}
        <div>
          <span className="home-chip"><ShieldCheck size={14} />Administrator</span>
          <h2>{user?.fullName || user?.username || 'Admin'}</h2>
          <p>@{user?.username || 'admin'} · {user?.rankName || 'Admin'}</p>
          {user ? <UserBadges user={user} /> : null}
        </div>
      </section>
    </section>
  );
}

function HomePage({ data, go }: { data: CpproData; go: (path: string) => void }) {
  const topContest = data.contests[0];
  const leader = data.users[0];
  const featuredProblem = data.problems[8] || data.problems[0];
  const fallbackLeader: UserRow = {
    username: 'onlinejudge',
    fullName: data.contact.brandName || defaultFooterContactSettings.brandName,
    rating: 0,
    score: 0,
    solved: 0,
    streak: 1,
    maxStreak: 1,
    rankName: 'Second',
    tags: [],
    proTier: '',
  };
  const quickTiles = [
    { label: 'Bài tập', icon: <Code2 />, tone: 'blue', path: '/problems' },
    { label: 'Khóa học', icon: <GraduationCap />, tone: 'purple', path: '/courses' },
    { label: 'Thành tích', icon: <Trophy />, tone: 'orange', path: `/users/${leader?.username || ''}` },
    { label: 'Bảng vàng', icon: <Award />, tone: 'pink', path: '/users' },
    { label: 'Cập nhật việc', icon: <UsersRound />, tone: 'cyan', path: '/submissions' },
    { label: 'Lịch thi', icon: <CalendarDays />, tone: 'green', path: '/contests' },
  ];
  return (
    <div className="stack">
      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_120px_minmax(0,500px)]" data-home-grid>
        <div className="profile-hero" data-home-profile-card>
          <Avatar user={leader || fallbackLeader} large />
          <div>
            <span className="home-chip">Xin chào</span>
            <h1>{leader?.fullName || data.contact.brandName || defaultFooterContactSettings.brandName}</h1>
            <p>@{leader?.username || 'onlinejudge'} · {leader?.rankName || 'Second'}</p>
            <UserBadges user={leader || fallbackLeader} />
          </div>
        </div>
        <div className="home-notice-card">
          <span className="home-chip hot">Học tích cực</span>
          <strong>{featuredProblem?.title || 'Luyện tập mỗi ngày'}</strong>
          <small>{featuredProblem?.source || data.contact.brandName || defaultFooterContactSettings.brandName} · {Math.round(featuredProblem?.score || 0)} điểm</small>
          <div className="home-progress"><span style={{ width: `${Math.min(100, Math.max(18, featuredProblem ? acRate(featuredProblem) : 18))}%` }} /></div>
        </div>
        <div className="home-streak-tile">
          <Sparkles size={18} />
          <strong>{Math.max(1, leader?.streak || 1)}x</strong>
          <small>ngày liên tiếp</small>
        </div>
        <div className="home-contest-card">
          <div>
            <span className="home-chip">Kỳ thi nổi bật</span>
            <h2>{topContest?.title || 'Tuyển sinh vào 10'}</h2>
            <p>{topContest?.participants || 0} thành viên · {topContest?.problemCount || 0} bài</p>
          </div>
          <button className="blue-button" onClick={() => go(`/contests/${topContest?.slug || ''}`)} type="button">Vào ngay</button>
        </div>
      </section>

      <section className="home-learning-grid">
        <div className="calendar-card">
          <h2>14 ngày gần đây</h2>
          <div className="activity-chart">
            {Array.from({ length: 14 }, (_, index) => {
              const active = index > 9;
              return <span key={index} className={active ? 'active' : ''} style={{ height: `${active ? 28 + index * 3 : 8 + index}px` }} />;
            })}
          </div>
        </div>
        <div className="rank-card">
          <Medal />
          <strong>{leader?.solved || 0}</strong>
          <small>bài đã giải</small>
        </div>
        <div className="quick-tile-grid">
          {quickTiles.map((tile) => (
            <button key={tile.label} type="button" className={`quick-tile ${tile.tone}`} onClick={() => go(tile.path)}>
              <span>{tile.icon}</span>
              <strong>{tile.label}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="two-col">
        <Panel title="Bảng tin cộng đồng" action="Xem bài tập" onAction={() => go('/problems')}>
          <div className="feed-list">
            {data.submissions.slice(0, 6).map((item) => (
              <button key={item.id} className="feed-row" onClick={() => go(`/problems/${item.problemSlug}`)} type="button">
                <span className={verdictClass(item.verdict)}>{item.verdict}</span>
                <span>
                  <strong>{item.problemTitle}</strong>
                  <small>{item.username} · {item.language} · {formatDate(item.submittedAt)}</small>
                </span>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Kỳ thi nổi bật" action="Vào kỳ thi" onAction={() => go(`/contests/${topContest?.slug || ''}`)}>
          <div className="contest-spotlight">
            <Medal size={28} />
            <h3>{topContest?.title}</h3>
            <p>{topContest?.participants} thành viên · {topContest?.problemCount} bài · {formatRange(topContest?.startTime, topContest?.endTime)}</p>
            <button className="blue-button" type="button" onClick={() => go(`/contests/${topContest?.slug || ''}`)}>Vào kỳ thi</button>
          </div>
        </Panel>
      </section>
    </div>
  );
}

function CommunityPostsPage({ data, go, postKey }: { data: CpproData; go: (path: string) => void; postKey?: string }) {
  const decodedPostKey = postKey ? decodeURIComponent(postKey) : '';
  const selectedPost = decodedPostKey
    ? data.posts.find((post) => post.slug === decodedPostKey || String(post.id || '') === decodedPostKey || slugifyTitle(post.title) === decodedPostKey)
    : undefined;

  if (decodedPostKey) {
    return (
      <section className="service-page community-page" data-community-page>
        <div className="service-hero-card">
          <span className="service-hero-icon"><Globe size={26} /></span>
          <h2>{selectedPost?.title || 'Bài viết cộng đồng'}</h2>
          <p>{selectedPost ? `${selectedPost.category} · ${selectedPost.date}` : 'Không tìm thấy bài viết theo liên kết này.'}</p>
          <div className="service-actions">
            <button className="soft-button" type="button" onClick={() => go('/posts')}>Về bảng tin</button>
            <button className="blue-button" type="button" onClick={() => go('/')}>Về trang chủ</button>
          </div>
        </div>
        {selectedPost ? (
          <div className="community-page-feed" data-original-post-list data-community-detail>
            <CommunityPostCard post={selectedPost} go={go} expanded />
          </div>
        ) : (
          <div className="service-empty">Bài viết không còn tồn tại hoặc chưa được đồng bộ từ backend.</div>
        )}
      </section>
    );
  }

  return (
    <section className="service-page community-page" data-community-page>
      <div className="service-hero-card">
        <span className="service-hero-icon"><Globe size={26} /></span>
        <h2>Bảng tin cộng đồng</h2>
        <p>Cập nhật bài viết, cảm xúc học viên và thông báo hệ thống trong một dòng nội dung riêng với khu vực Thông báo.</p>
        <div className="service-actions">
          <button className="blue-button" type="button" onClick={() => go('/notifications')}>Thông báo</button>
          <button className="soft-button" type="button" onClick={() => go('/')}>Về trang chủ</button>
        </div>
      </div>
      <CommunityFeed posts={data.posts} go={go} emptyText="Chưa có bài viết cộng đồng." />
    </section>
  );
}

function HomePageV2({ data, go, currentUser, loading = false }: { data: CpproData; go: (path: string) => void; currentUser: StoredCpproUser | null; loading?: boolean }) {
  if (currentUser) return <SignedInHomePage data={data} go={go} user={currentUser} />;
  const publicActivity = homeActivity(data);
  const homePosts = data.posts;
  const sidebarContests = data.contests.slice(0, 2);
  const sidebarRankUsers = data.users.slice(0, 5);
  const sidebarNotices = data.notifications.slice(0, 2);
  const onlineUsers = Number(data.homeSummary?.presence?.online ?? data.stats.onlineUsers ?? 0) || 0;
  const visitCount = Number(data.homeSummary?.traffic?.visits ?? data.stats.visits ?? 0) || 0;
  const loadingPublicActivity = loading && !publicActivity.some((item) => Number(item.value || 0) > 0 || Number(item.accepted || 0) > 0);
  const aboutTiles = [
    { title: 'Giới thiệu', body: 'Về hệ thống Online Judge', icon: <Shield size={18} />, path: '/about' },
    { title: 'Khóa học', body: 'Lộ trình từ A-Z', icon: <BookOpen size={18} />, path: '/courses' },
    { title: 'Thành tích', body: 'Bảng vàng học viên', icon: <Trophy size={18} />, path: '/achievements' },
    { title: 'Giảng viên', body: 'Đội ngũ chuyên gia', icon: <UsersRound size={18} />, path: '/mentors' },
    { title: 'Cựu học viên', body: 'Gương mặt tiêu biểu', icon: <Award size={18} />, path: '/alumni' },
    { title: 'Liên hệ', body: 'Hỗ trợ & tư vấn', icon: <MessageSquare size={18} />, path: '/contact' },
  ];

  return (
    <div className="home-section" data-original-home>
      <section className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8 w-full rounded-[24px] p-8 shadow-[0_4px_0_0_#0050B3] dark:shadow-[0_4px_0_0_#1e293b] relative overflow-hidden dark:bg-slate-800" data-original-hero>
        <div>
          <h2>Nâng tầm tư duy lập trình cùng {data.contact.brandName || defaultFooterContactSettings.brandName}</h2>
          <p>Đăng nhập ngay để cá nhân hoá lộ trình học tập, theo dõi hoạt động hằng ngày, tham gia các kỳ thi chuyên nghiệp và vươn lên đỉnh vinh quang!</p>
          <div className="home-live-counters" data-home-live-counters>
            <span><UsersRound size={15} />{loading && onlineUsers <= 0 ? 'Đang cập nhật trực tuyến' : `${onlineUsers.toLocaleString('vi-VN')} người trực tuyến`}</span>
            <i aria-hidden="true" />
            <span><Eye size={15} />{visitCount > 0 ? `${visitCount.toLocaleString('vi-VN')} lượt truy cập` : 'Đang cập nhật lượt truy cập'}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3" data-original-hero-actions>
            <button className="hero-primary" type="button" onClick={() => go(authPathWithReturn('login'))}>Đăng nhập ngay</button>
            <button className="hero-secondary" type="button" onClick={() => go('/register')}>Tạo tài khoản mới</button>
          </div>
        </div>
        <img src="/assets/VOI1-DccYHpUA.png" alt="Mascot online judge" />
      </section>
      <section className="home-section grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_120px_minmax(0,500px)] gap-5 mb-8 items-stretch" data-original-learning-strip>
        <article className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-[20px] border-2 border-slate-100 dark:border-slate-700 shadow-[0_4px_0_0_#E5E7EB] dark:shadow-[0_4px_0_0_#1e293b] py-3 px-6 min-h-[140px] h-full flex flex-col z-0" data-original-activity-card>
          <h3>14 ngày gần đây</h3>
          <div className="flex-1 flex items-end gap-2 w-full h-full mt-auto relative z-10" data-original-bars data-original-bars-detailed>
            {loadingPublicActivity ? (
              <span className="home-activity-inline-loading">
                <InlineLoadingText label="Đang tải hoạt động 14 ngày" />
              </span>
            ) : publicActivity.map((item, index) => {
              const missed = Math.max(0, item.value - item.accepted);
              const barHeight = `${Math.max(12, item.value * 7)}px`;
              const acceptedHeight = `${Math.max(0, item.accepted * 7)}px`;
              return (
              <span
                key={`${item.day}-${index}`}
                className={item.value > 3 ? 'done' : ''}
                style={{ '--bar-height': barHeight, '--accepted-height': acceptedHeight } as React.CSSProperties}
              >
                <b>{item.value}</b>
                {missed > 0 ? <small>{missed} Chưa AC</small> : <small aria-hidden="true">&nbsp;</small>}
                {item.accepted > 0 ? <small className="accepted">{item.accepted} AC</small> : <small aria-hidden="true">&nbsp;</small>}
                <i />
                <em>{item.day}</em>
              </span>
              );
            })}
          </div>
          <div className="activity-lock-overlay" data-original-activity-lock>
            <span className="lock-mark">⌘</span>
            <strong>Đăng nhập để xem hoạt động</strong>
            <button type="button" onClick={() => go(authPathWithReturn('login'))}>Đăng nhập</button>
          </div>
        </article>
        <article className="flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-[20px] border-2 border-slate-100 dark:border-slate-700 shadow-[0_4px_0_0_#E5E7EB] dark:shadow-[0_4px_0_0_#1e293b] px-4 py-3 h-full text-center group" data-original-login-card>
          <span className="lock-mark">⌘</span>
          <strong>Đăng nhập để xem lộ trình</strong>
          <button type="button" onClick={() => go(authPathWithReturn('login'))}>Đăng nhập</button>
        </article>
        <article className="flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-[20px] border-2 border-slate-100 dark:border-slate-700 shadow-[0_4px_0_0_#E5E7EB] dark:shadow-[0_4px_0_0_#1e293b] px-4 py-3 h-full text-center group" data-original-login-card data-original-challenge-login>
          <span className="lock-mark">⌘</span>
          <strong>Đăng nhập để mở thử thách hôm nay</strong>
          <button type="button" onClick={() => go(authPathWithReturn('login'))}>Đăng nhập</button>
        </article>
      </section>

      <section className="home-section" data-original-about>
        <h2>Tìm hiểu về {data.contact.brandName || defaultFooterContactSettings.brandName}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" data-original-about-grid>
          {aboutTiles.map((tile) => (
            <a key={tile.title} href={tile.path} onClick={(event) => { event.preventDefault(); go(tile.path); }}>
              <span>{tile.icon}</span>
              <strong>{tile.title}</strong>
              <small>{tile.body}</small>
            </a>
          ))}
        </div>
      </section>

      <section className="home-section grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 items-start" data-original-home-layout>
        <div className="bg-white dark:bg-slate-800 rounded-[20px] border-2 border-slate-100 dark:border-slate-700 shadow-[0_4px_0_0_#E5E7EB] dark:shadow-[0_4px_0_0_#1e293b] p-5" data-original-feed-card>
          <div className="flex items-center justify-between gap-3" data-original-section-head>
            <span data-community-title><Globe size={22} /><h2>Bảng tin cộng đồng</h2></span>
            <button type="button" onClick={() => go('/posts')}>Xem tất cả</button>
          </div>
          {loading && homePosts.length === 0
            ? <DataLoadingPanel label="Đang tải bảng tin cộng đồng" rows={3} compact />
            : <CommunityFeed posts={homePosts} go={go} emptyText="Chưa có thông báo từ backend." />}
        </div>

        <aside className="flex flex-col gap-6 sticky top-6" data-original-sidebar>
          <OriginalSidePanel title="Kì thi" action="Xem tất cả" onAction={() => go('/contests')} icon={<Swords size={20} />} tone="green">
            {loading && sidebarContests.length === 0 ? (
              <InlineLoadingText label="Đang tải kỳ thi" />
            ) : sidebarContests.length ? sidebarContests.map((contest) => (
              <SidebarContestCard key={contest.slug} contest={contest} go={go} />
            )) : (
              <div className="service-empty">Chưa có kỳ thi từ backend.</div>
            )}
          </OriginalSidePanel>
          <OriginalSidePanel title="Bảng xếp hạng" action="Xem đầy đủ" onAction={() => go('/users')} icon={<ChartColumn size={20} />} tone="purple">
            {loading && sidebarRankUsers.length === 0 ? (
              <InlineLoadingText label="Đang tải bảng xếp hạng" />
            ) : sidebarRankUsers.length ? sidebarRankUsers.map((rank, index) => (
              <SidebarRankCard key={rank.username} user={rank} index={index} go={go} />
            )) : (
              <div className="service-empty">Chưa có dữ liệu xếp hạng.</div>
            )}
          </OriginalSidePanel>
          <OriginalSidePanel title="Thông báo" action="Xem tất cả" onAction={() => go('/notifications')} icon={<Shield size={20} />} tone="cyan">
            {loading && sidebarNotices.length === 0 ? (
              <InlineLoadingText label="Đang tải thông báo" />
            ) : sidebarNotices.length ? sidebarNotices.map((notice) => (
              <SidebarNoticeCard key={communityPostKey(notice)} notice={notice} go={go} />
            )) : (
              <div className="service-empty">Chưa có thông báo.</div>
            )}
          </OriginalSidePanel>
        </aside>
      </section>
    </div>
  );
}

function HomePageLoadingSkeleton({ signed = false }: { signed?: boolean }) {
  return (
    <div className="home-section home-loading-skeleton" data-original-home data-home-loading-skeleton>
      <section className="home-loading-hero" data-original-hero data-home-element-loading>
        <div>
          <i className="skeleton-line w-42" />
          <i className="skeleton-line w-82 tall" />
          <i className="skeleton-line w-70" />
          <div className="home-loading-actions">
            <i className="skeleton-pill" />
            <i className="skeleton-pill secondary" />
          </div>
        </div>
        <span className="home-loading-mascot" />
      </section>

      <section className="home-loading-learning" data-original-learning-strip data-home-element-loading>
        <article>
          <i className="skeleton-line w-34" />
          <div className="home-loading-bars">
            {Array.from({ length: 14 }, (_, index) => <i key={index} style={{ '--bar-index': index } as React.CSSProperties} />)}
          </div>
        </article>
        <article><i className="skeleton-icon" /><i className="skeleton-line w-74" /><i className="skeleton-pill" /></article>
        <article><i className="skeleton-icon" /><i className="skeleton-line w-74" /><i className="skeleton-pill" /></article>
      </section>

      <section className="home-loading-about" data-original-about data-home-element-loading>
        <i className="skeleton-line w-44" />
        <div>
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index}>
              <i className="skeleton-icon" />
              <i className="skeleton-line w-74" />
              <i className="skeleton-line w-56" />
            </span>
          ))}
        </div>
      </section>

      <section className="home-loading-layout" data-original-home-layout>
        <div data-original-feed-card data-home-element-loading>
          <header>
            <i className="skeleton-line w-36" />
            <i className="skeleton-pill small" />
          </header>
          {Array.from({ length: signed ? 4 : 3 }, (_, index) => (
            <article key={index}>
              <i className="skeleton-avatar" />
              <span>
                <i className="skeleton-line w-82" />
                <i className="skeleton-line w-64" />
              </span>
            </article>
          ))}
        </div>
        <aside data-original-sidebar>
          {Array.from({ length: 3 }, (_, panelIndex) => (
            <section key={panelIndex} data-home-element-loading>
              <header><i className="skeleton-line w-40" /><i className="skeleton-pill small" /></header>
              {Array.from({ length: 2 }, (_, rowIndex) => (
                <article key={rowIndex}>
                  <i className="skeleton-avatar small" />
                  <span><i className="skeleton-line w-78" /><i className="skeleton-line w-46" /></span>
                </article>
              ))}
            </section>
          ))}
        </aside>
      </section>
    </div>
  );
}

function DailyChallengeCard({
  challenge,
  fallbackProblem,
  go,
  signed = false,
}: {
  challenge: Problem | null;
  fallbackProblem?: Problem;
  go: (path: string) => void;
  signed?: boolean;
}) {
  const problem = challenge || fallbackProblem || null;
  const href = problem?.slug ? `/problems/${problem.slug}` : '/problems';
  const tags = problem?.tags?.slice(0, 2) || [];
  const score = Number(problem?.score || 0);
  const memory = Number(problem?.memoryLimitMb || 256) || 256;
  const acPercent = problem ? Math.max(0, Math.min(100, acRate(problem))) : 0;
  const meta = problem ? `${acPercent.toFixed(0)}% AC · ${memory} MB` : 'Chưa có dữ liệu';

  return (
    <article
      data-original-challenge-card
      data-daily-challenge-card
      data-api-source="home-summary"
      data-signed-source-challenge={signed ? 'true' : undefined}
    >
      <div data-daily-challenge-pattern aria-hidden="true" />
      <div data-daily-challenge-inner>
        <div data-daily-challenge-icon aria-hidden="true">
          <Star size={24} />
        </div>
        <div data-daily-challenge-copy>
          <p>Thử thách hôm nay</p>
          <strong data-daily-challenge-title>{problem?.title || 'Chưa có thử thách'}</strong>
          <div data-challenge-tags data-daily-challenge-tags>
            {tags.length ? tags.map((tag) => (
              <span key={tag.slug || tag.name}>{tag.name}</span>
            )) : (
              <span>{problem?.source || 'Online Judge'}</span>
            )}
            <span>{score.toFixed(2)} điểm</span>
            <span data-daily-challenge-meta>{meta}</span>
          </div>
        </div>
        <a href={href} data-daily-challenge-action onClick={(event) => openInternalLink(event, go, href)}>
          <span>Giải ngay</span>
          <ArrowRight size={16} />
        </a>
      </div>
    </article>
  );
}

function SignedInHomePage({ data, go, user }: { data: CpproData; go: (path: string) => void; user: StoredCpproUser }) {
  const [personalSubmissions, setPersonalSubmissions] = useState<Submission[] | null>(null);
  const userRow = storedUserToRow(user);
  const locale = parseCpproPath(window.location.pathname).locale || readStoredLocale();
  const isEnglish = locale === 'en';
  const homePosts = data.posts;
  const sidebarContests = data.contests.slice(0, 2);
  const sidebarRankUsers = [userRow, ...data.users.filter((item) => item.username !== user.username)].slice(0, 5);
  const sidebarNotices = data.notifications.slice(0, 2);
  const challenge = dailyChallenge(data, 'hdu4085');
  useEffect(() => {
    let cancelled = false;
    setPersonalSubmissions(null);
    cpproApiFetch<unknown>('/submissions?scope=mine&limit=100&withCount=true&sort=created&dir=desc')
      .then((payload) => {
        if (!cancelled) setPersonalSubmissions(rowsFromApi<Record<string, unknown>>(payload).map(mapBackendSubmission));
      })
      .catch(() => {
        if (!cancelled) setPersonalSubmissions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user.username]);
  const activity = useMemo(() => activityFromSubmissions(personalSubmissions, user), [personalSubmissions, user]);
  const maxActivity = Math.max(1, ...activity.map((item) => Number(item.value) || 0));
  const acceptedTotal = activity.reduce((sum, item) => sum + (Number(item.accepted) || 0), 0);
  const submittedTotal = activity.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const todayActivity = activity[activity.length - 1] || { value: 0, accepted: 0 };
  const dailyTarget = Math.max(1, Number(user.target_daily_number || 0) || 1);
  const targetDoneToday = Math.min(dailyTarget, Number(todayActivity.accepted || 0));
  const targetCompleteToday = targetDoneToday >= dailyTarget;
  const targetStreak = Math.max(user.target_streak || 0, currentAcceptedActivityStreak(activity));
  const submitStreak = Math.max(user.streak || 0, currentActivityStreak(activity));
  const maxSubmitStreak = Math.max(user.max_streak || 0, submitStreak);
  const maxTargetStreak = Math.max(1, user.max_target_streak || targetStreak || 1);
  const targetProgress = Math.min(100, Math.round((targetDoneToday / dailyTarget) * 100));
  const totalTargetCompletedDays = Math.max(
    user.total_target_completed_days || 0,
    activity.filter((item) => Number(item.accepted || 0) >= dailyTarget).length,
  );
  const targetText = user.target_text?.trim() || 'Duy trì nhịp luyện tập mỗi ngày';
  const displayScore = user.pp_score ?? user.score ?? userRow.score;
  const rankLabel = user.rank_name || user.roles?.[0] || userRow.rankName;
  const profileName = user.full_name || user.displayName || user.username;
  const profileInitial = (profileName || user.username || 'U').trim()[0]?.toUpperCase() || 'U';
  const profileSchool = String(user.school_name || '').trim();
  const aboutTiles = [
    { title: 'Giới thiệu', body: 'Về hệ thống Online Judge', icon: <Shield size={18} />, path: '/about' },
    { title: 'Khóa học', body: 'Lộ trình từ A-Z', icon: <BookOpen size={18} />, path: '/courses' },
    { title: 'Thành tích', body: 'Bảng vàng học viên', icon: <Trophy size={18} />, path: '/achievements' },
    { title: 'Giảng viên', body: 'Đội ngũ chuyên gia', icon: <UsersRound size={18} />, path: '/mentors' },
    { title: 'Cựu học viên', body: 'Gương mặt tiêu biểu', icon: <Award size={18} />, path: '/alumni' },
    { title: 'Liên hệ', body: 'Hỗ trợ & tư vấn', icon: <MessageSquare size={18} />, path: '/contact' },
  ];
  const activitySummary = isEnglish
    ? `${acceptedTotal}/${submittedTotal} AC in the latest activity streak`
    : `${acceptedTotal}/${submittedTotal} lượt AC trong chuỗi hoạt động gần nhất`;

  return (
    <div className="home-section" data-signed-home>
      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_120px_minmax(0,500px)]" data-signed-source-top>
        <article className="profile-hero" data-signed-profile-card data-signed-source-profile>
          <div data-signed-profile-avatar>
            {userRow.avatarUrl ? <img src={userRow.avatarUrl} alt={user.username} /> : <span>{profileInitial}</span>}
            <b><Zap size={12} /></b>
          </div>
          <div data-signed-profile-copy>
            <span>{timeGreeting()},</span>
            <h2>{profileName}</h2>
            <p>
              <em>@{user.username}</em>
              <i />
              <strong>{rankLabel || 'Unrated'}</strong>
            </p>
            <UserBadges user={userRow} />
            {profileSchool ? <small>{profileSchool}</small> : null}
          </div>
        </article>

        <article className="rounded-2xl border" data-signed-target-card data-signed-source-goal>
          <div className="flex items-center gap-2" data-signed-card-head>
            <span><Sparkles size={16} /></span>
            <strong>{t(locale, 'signed.goalTitle')}</strong>
            <em>{targetDoneToday}</em>
            <em data-hot>Max: {maxTargetStreak}</em>
          </div>
          <div className="overflow-hidden rounded-full" data-signed-progress>
            <i style={{ width: `${targetProgress}%` }} />
          </div>
          <div className="flex items-center justify-between" data-signed-source-goal-copy>
            <strong>{targetCompleteToday ? t(locale, 'signed.goalComplete') : t(locale, 'signed.goalKeepGoing')}</strong>
            <b>{targetDoneToday}/{dailyTarget}</b>
          </div>
          <div data-signed-target-foot>
            <span>{totalTargetCompletedDays} {t(locale, 'signed.goalDaysDone')}</span>
            <span>{targetStreak} {t(locale, 'signed.goalStreakDays')}</span>
          </div>
        </article>

        <article className="grid place-items-center streak-widget" data-signed-source-target-streak>
          <Flame size={22} />
          <strong>{targetStreak}</strong>
          <span>{t(locale, 'signed.targetStreak')}</span>
        </article>

        <article className="grid items-center" data-signed-source-target-banner>
          <img src="/assets/VOI1-DccYHpUA.png" alt="" />
          <div>
            <small>{t(locale, 'signed.targetBanner')}</small>
            <strong>“{targetText}”</strong>
          </div>
        </article>
      </section>

      <section className="grid gap-4" data-signed-source-dashboard>
        <article className="rounded-2xl border" data-signed-activity-card data-signed-source-activity>
          <div data-signed-activity-head>
            <p data-signed-activity-title>{t(locale, 'signed.activityTitle')}</p>
            <div data-signed-activity-legend aria-label={isEnglish ? 'Activity legend' : 'Chú thích hoạt động'}>
              <span data-tone="accepted">{t(locale, 'signed.activityLegendAc')}</span>
              <span data-tone="failed">{t(locale, 'signed.activityLegendNonAc')}</span>
            </div>
          </div>
          <div className="flex items-end gap-1" data-signed-bars>
            {activity.map((item, index) => {
              const value = Number(item.value) || 0;
              const accepted = Math.min(value, Number(item.accepted) || 0);
              const failed = Math.max(0, value - accepted);
              const barHeight = value > 0 ? Math.max(14, (value / maxActivity) * 100) : 4;
              const acceptedHeight = value > 0 ? Math.max(0, (accepted / value) * 100) : 0;
              const failedHeight = value > 0 ? Math.max(0, (failed / value) * 100) : 0;
              const dayLabel = formatActivityDay(item.day);
              const showAxisLabel = index % 3 === 0 || index === activity.length - 1;
              const tooltipLabel = isEnglish
                ? `${dayLabel}: ${accepted} AC / ${value} submissions`
                : `${dayLabel}: ${accepted} lượt AC / ${value} lượt nộp`;
              return (
                <span key={`${item.day}-${index}`} tabIndex={0} title={tooltipLabel} aria-label={tooltipLabel} data-has-activity={value > 0 ? 'true' : 'false'}>
                  <strong data-signed-bar-value>{value > 0 ? value : ''}</strong>
                  <i data-empty={value > 0 ? undefined : 'true'} style={{ height: `${barHeight}%` }}>
                    {failed > 0 ? <b data-failed style={{ height: `${failedHeight}%` }} /> : null}
                    {accepted > 0 ? <b data-accepted style={{ height: `${acceptedHeight}%` }} /> : null}
                  </i>
                  <small>{showAxisLabel ? dayLabel : ''}</small>
                  <em data-signed-activity-tooltip>{tooltipLabel}</em>
                </span>
              );
            })}
          </div>
          <p data-signed-activity-summary>{activitySummary}</p>
        </article>

        <article className="grid place-items-center streak-widget" data-signed-source-submit-streak>
          <div data-submit-streak-main>
            <Flame size={28} />
            <strong>{submitStreak}</strong>
            <span>{t(locale, 'signed.submitStreak')}</span>
          </div>
          <i data-submit-streak-divider aria-hidden="true" />
          <div data-submit-streak-max>
            <b>{maxSubmitStreak}</b>
            <small>{t(locale, 'signed.maxStreak')}</small>
          </div>
        </article>

        <DailyChallengeCard challenge={challenge} go={go} fallbackProblem={data.problems[0]} signed />
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3" data-signed-stat-grid data-signed-stat-grid-source aria-hidden="true">
        <button className="rounded-2xl border" data-signed-stat-card data-tone="blue" type="button" onClick={() => go('/problems')}>
          <Code2 size={20} />
          <strong>{(user.solved || 0).toLocaleString('vi-VN')}</strong>
          <span>Bài đã giải</span>
        </button>
        <button className="rounded-2xl border" data-signed-stat-card data-tone="green" type="button" onClick={() => go(`/users/${user.username}`)}>
          <Trophy size={20} />
          <strong>{displayScore.toLocaleString('vi-VN')}</strong>
          <span>Điểm xếp hạng</span>
        </button>
        <button className="rounded-2xl border" data-signed-stat-card data-tone="orange" type="button" onClick={() => go('/submissions')}>
          <Zap size={20} />
          <strong>{submitStreak.toLocaleString('vi-VN')}</strong>
          <span>Streak hiện tại</span>
        </button>
        <button className="rounded-2xl border" data-signed-stat-card data-tone="purple" type="button" onClick={() => go('/contests')}>
          <Medal size={20} />
          <strong>{maxSubmitStreak.toLocaleString('vi-VN')}</strong>
          <span>Streak tốt nhất</span>
        </button>
      </section>

      <section className="home-section" data-original-about data-signed-about>
        <h2>Tìm hiểu về {data.contact.brandName || defaultFooterContactSettings.brandName}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" data-original-about-grid>
          {aboutTiles.map((tile) => (
            <a key={tile.title} href={tile.path} onClick={(event) => { event.preventDefault(); go(tile.path); }}>
              <span>{tile.icon}</span>
              <strong>{tile.title}</strong>
              <small>{tile.body}</small>
            </a>
          ))}
        </div>
      </section>

      <section className="home-section grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 items-start" data-original-home-layout data-signed-main-layout>
        <div className="bg-white dark:bg-slate-800 rounded-[20px] border-2 border-slate-100 dark:border-slate-700 shadow-[0_4px_0_0_#E5E7EB] dark:shadow-[0_4px_0_0_#1e293b] p-5" data-original-feed-card>
          <div className="flex items-center justify-between gap-3" data-original-section-head>
            <span data-community-title><Globe size={22} /><h2>Bảng tin cộng đồng</h2></span>
            <button type="button" onClick={() => go('/posts')}>Xem tất cả</button>
          </div>
          <CommunityFeed posts={homePosts} go={go} emptyText="Chưa có thông báo từ backend." />
        </div>

        <aside className="flex flex-col gap-6 sticky top-6" data-original-sidebar>
          <OriginalSidePanel title="Kì thi" action="Xem tất cả" onAction={() => go('/contests')} icon={<Swords size={20} />} tone="green">
            {sidebarContests.length ? sidebarContests.map((contest) => (
              <SidebarContestCard key={contest.slug} contest={contest} go={go} />
            )) : (
              <div className="service-empty">Chưa có kỳ thi từ backend.</div>
            )}
          </OriginalSidePanel>
          <OriginalSidePanel title="Bảng xếp hạng" action="Xem đầy đủ" onAction={() => go('/users')} icon={<ChartColumn size={20} />} tone="purple">
            {sidebarRankUsers.length ? sidebarRankUsers.map((rankUser, index) => (
              <SidebarRankCard key={rankUser.username} user={rankUser} index={index} go={go} />
            )) : (
              <div className="service-empty">Chưa có dữ liệu xếp hạng.</div>
            )}
          </OriginalSidePanel>
          <OriginalSidePanel title="Thông báo" action="Xem tất cả" onAction={() => go('/notifications')} icon={<Shield size={20} />} tone="cyan">
            {sidebarNotices.length ? sidebarNotices.map((notice) => (
              <SidebarNoticeCard key={communityPostKey(notice)} notice={notice} go={go} />
            )) : (
              <div className="service-empty">Chưa có thông báo.</div>
            )}
          </OriginalSidePanel>
        </aside>
      </section>
    </div>
  );
}

function OriginalSidePanel({
  title,
  action,
  onAction,
  icon,
  tone = 'blue',
  children,
}: {
  title: string;
  action: string;
  onAction: () => void;
  icon?: React.ReactNode;
  tone?: 'blue' | 'green' | 'purple' | 'cyan';
  children: React.ReactNode;
}) {
  return (
    <article className="bg-white dark:bg-slate-800 rounded-[20px] border-2 border-slate-100 dark:border-slate-700 shadow-[0_4px_0_0_#E5E7EB] dark:shadow-[0_4px_0_0_#1e293b] p-5" data-original-side-panel data-panel-tone={tone}>
      <div className="flex items-center justify-between gap-3" data-original-side-head>
        <h3>{icon ? <span data-side-head-icon>{icon}</span> : null}{title}</h3>
        <button type="button" onClick={onAction}>{action}<ChevronRight size={15} /></button>
      </div>
      <div className="flex flex-col gap-2" data-original-side-body>{children}</div>
    </article>
  );
}




function CommunityFeedTabs({ active, onChange }: { active: CommunityTabKey; onChange: (tab: CommunityTabKey) => void }) {
  return (
    <div className="flex flex-wrap gap-2" data-original-feed-tabs="true" role="tablist" aria-label="Bộ lọc bảng tin cộng đồng">
      {communityTabs.map((tab) => (
        <button
          key={tab.key}
          aria-pressed={active === tab.key}
          className={active === tab.key ? 'active' : ''}
          onClick={() => onChange(tab.key)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function CommunityFeed({ posts, go, emptyText }: { posts: HomePost[]; go: (path: string) => void; emptyText: string }) {
  const [activeTab, setActiveTab] = useState<CommunityTabKey>('all');
  const [page, setPage] = useState(1);
  const visiblePosts = useMemo(
    () => activeTab === 'all' ? posts : posts.filter((post) => post.categoryKey === activeTab),
    [activeTab, posts],
  );
  const pageSize = 2;
  const totalPages = Math.max(1, Math.ceil(visiblePosts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagePosts = visiblePosts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <>
      <CommunityFeedTabs active={activeTab} onChange={setActiveTab} />
      {visiblePosts.length > pageSize ? <CommunityPagination page={currentPage} totalPages={totalPages} onPage={setPage} /> : null}
      <div className="flex flex-col gap-4" data-original-post-list>
        {visiblePosts.length ? pagePosts.map((post) => (
          <CommunityPostCard key={communityPostKey(post)} post={post} go={go} />
        )) : (
          <CommunityEmptyState title={posts.length ? 'Tính năng blog thành viên sẽ được phát triển thêm.' : emptyText} description={posts.length ? 'Bảng tin hiện chỉ hiển thị tin tức hệ thống đã public.' : 'Khi có nội dung mới, bài viết sẽ xuất hiện tại đây.'} />
        )}
      </div>
      {visiblePosts.length > pageSize ? <CommunityPagination page={currentPage} totalPages={totalPages} onPage={setPage} /> : null}
    </>
  );
}

function CommunityPagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  return (
    <div data-community-pagination>
      <Pagination page={page} totalPages={totalPages} onPage={onPage} />
    </div>
  );
}

function CommunityEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div data-community-empty>
      <div data-community-empty-icon><Sparkles size={20} /></div>
      <p>{title}</p>
      <small>{description}</small>
    </div>
  );
}

const communityReactionOptions = [
  { key: 'like', label: 'Thích', icon: Heart },
  { key: 'love', label: 'Yêu thích', icon: Sparkles },
  { key: 'celebrate', label: 'Chúc mừng', icon: Flame },
  { key: 'insightful', label: 'Hay', icon: Star },
  { key: 'wow', label: 'Wow', icon: Zap },
  { key: 'helpful', label: 'Hữu ích', icon: CheckCircle2 },
];

function communityReactionLabel(key: string) {
  return communityReactionOptions.find((item) => item.key === key)?.label || key;
}

function communityReactionOption(key: string) {
  return communityReactionOptions.find((item) => item.key === key) || communityReactionOptions[0];
}

function communityReactionSummary(reactions: Record<string, number>, limit = 3) {
  return Object.entries(reactions)
    .map(([key, count]) => ({ key, count: Number(count) || 0, option: communityReactionOption(key) }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.option.label.localeCompare(right.option.label, 'vi'))
    .slice(0, limit);
}

function CommunityReactionIconStack({
  reactions,
  fallbackCount = 0,
}: {
  reactions: Record<string, number>;
  fallbackCount?: number;
}) {
  const summary = communityReactionSummary(reactions);
  if (!summary.length && fallbackCount <= 0) return null;
  if (!summary.length) {
    return (
      <span data-community-reaction-icons>
        <span data-community-reaction-mini-icon data-reaction-tone="like"><Heart size={12} fill="currentColor" /></span>
      </span>
    );
  }
  return (
    <span data-community-reaction-icons>
      {summary.map(({ key, option }) => {
        const Icon = option.icon;
        return (
          <span key={key} data-community-reaction-mini-icon data-reaction-tone={key} title={option.label}>
            <Icon size={12} fill="currentColor" />
          </span>
        );
      })}
    </span>
  );
}

function CommunityReactionActorsPanel({
  actors,
  reactions,
  canInspect,
}: {
  actors: CommunityReactionActor[];
  reactions: Record<string, number>;
  canInspect: boolean;
}) {
  const reactionEntries = Object.entries(reactions).filter(([, count]) => Number(count) > 0);
  return (
    <div data-community-reaction-people role="status">
      {!canInspect ? (
        <p>Đăng nhập để xem ai đã react.</p>
      ) : actors.length ? (
        actors.slice(0, 8).map((actor) => {
          const option = communityReactionOption(actor.reaction);
          const Icon = option.icon;
          return (
          <span key={`${actor.username}-${actor.reaction}-${actor.updatedAt || ''}`} data-community-reaction-person>
            <span data-community-reaction-avatar>
              {actor.avatarUrl ? <img src={actor.avatarUrl} alt="" /> : actor.fullName.slice(0, 2).toUpperCase()}
            </span>
            <span>
              <strong>{actor.fullName || actor.username}</strong>
              <span data-community-actor-reaction><Icon size={12} fill="currentColor" />{option.label}</span>
              <small>@{actor.username} · {communityReactionLabel(actor.reaction)}</small>
            </span>
          </span>
          );
        })
      ) : reactionEntries.length ? (
        <p>{reactionEntries.map(([key, count]) => `${communityReactionLabel(key)} ${count}`).join(' · ')}</p>
      ) : (
        <p>Chưa có reaction nào.</p>
      )}
    </div>
  );
}

function ReactionPicker({
  activeReaction,
  disabled = false,
  reactions = {},
  onReact,
  triggerLabel = 'Thích',
}: {
  activeReaction?: string | null;
  disabled?: boolean;
  reactions?: Record<string, number>;
  onReact: (reaction: string | null) => void;
  triggerLabel?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pickerRef = useRef<HTMLSpanElement | null>(null);
  const active = communityReactionOptions.find((item) => item.key === activeReaction);
  const TriggerIcon = active?.icon || Heart;

  useEffect(() => {
    if (!menuOpen) return undefined;

    const closeOnOutsidePointer = (event: MouseEvent | TouchEvent) => {
      const node = pickerRef.current;
      if (!node || !(event.target instanceof Node) || node.contains(event.target)) return;
      setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsidePointer);
    document.addEventListener('touchstart', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsidePointer);
      document.removeEventListener('touchstart', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  const chooseReaction = (reaction: string) => {
    onReact(activeReaction === reaction ? null : reaction);
    setMenuOpen(false);
  };
  return (
    <span
      ref={pickerRef}
      className="community-reaction-picker"
      data-active-reaction={activeReaction || undefined}
      data-menu-open={menuOpen ? 'true' : undefined}
    >
      <button
        type="button"
        aria-pressed={Boolean(activeReaction)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        data-community-like-button
        data-liked={activeReaction ? 'true' : undefined}
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault();
          setMenuOpen((open) => !open);
        }}
      >
        <TriggerIcon size={16} fill={activeReaction ? 'currentColor' : 'none'} />
        {active?.label || triggerLabel}
      </button>
      <span
        className="community-reaction-popover"
        role="menu"
        aria-label="Chọn cảm xúc"
        data-open={menuOpen ? 'true' : undefined}
      >
        {communityReactionOptions.map((item) => {
          const Icon = item.icon;
          const count = Number(reactions[item.key] || 0);
          const isActive = activeReaction === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              aria-pressed={isActive}
              data-reaction-option={item.key}
              data-active={isActive ? 'true' : undefined}
              disabled={disabled}
              onClick={(event) => {
                event.preventDefault();
                chooseReaction(item.key);
              }}
            >
              <Icon size={15} fill={isActive ? 'currentColor' : 'none'} />
              <span>{item.label}</span>
              {count > 0 ? <b>{count}</b> : null}
            </button>
          );
        })}
      </span>
    </span>
  );
}

function CommunityCommentComposer({
  value,
  onChange,
  onSubmit,
  onCancel,
  submitting,
  placeholder = 'Viết bình luận...',
  submitLabel = 'Gửi',
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting?: boolean;
  placeholder?: string;
  submitLabel?: string;
}) {
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [imageNotice, setImageNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const appendMarkdown = (snippet: string) => {
    onChange(`${value}${value.endsWith('\n') || !value ? '' : '\n'}${snippet}\n`);
  };
  const handleImageFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setImageUploading(true);
    setImageError('');
    setImageNotice('');
    try {
      const uploaded = await uploadPostImageAsset(file);
      appendMarkdown(`![${uploaded.fileName}](${uploaded.url})`);
      if (uploaded.compressed) {
        setImageNotice(`Đã tự nén ảnh từ ${formatUploadBytes(uploaded.originalSize)} xuống ${formatUploadBytes(uploaded.uploadSize)} trước khi lưu.`);
      }
      setMode('preview');
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'Could not upload image.');
    } finally {
      setImageUploading(false);
    }
  };
  return (
    <div className="community-comment-editor" data-editor-mode={mode} aria-busy={imageUploading ? 'true' : undefined}>
      <div className="community-comment-editor-head">
        <div className="community-comment-editor-tabs">
          <button type="button" className={mode === 'write' ? 'active' : ''} aria-pressed={mode === 'write'} onClick={() => setMode('write')}>
            <PenLine size={14} />Trình soạn thảo
          </button>
          <button type="button" className={mode === 'preview' ? 'active' : ''} aria-pressed={mode === 'preview'} onClick={() => setMode('preview')}>
            <Eye size={14} />Xem trước
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(event) => void handleImageFile(event)} />
        <button type="button" className="community-comment-image-button" disabled={imageUploading} onClick={() => fileInputRef.current?.click()}>
          <ImageIcon size={14} />Ảnh
        </button>
      </div>
      {mode === 'preview' ? (
        <div className="community-comment-preview">
          {value.trim() ? renderMarkdownLite(value) : <span>Chưa có nội dung xem trước.</span>}
        </div>
      ) : (
        <textarea
          rows={4}
          maxLength={5000}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
      <div className="community-comment-editor-foot">
        <span className="community-comment-editor-note" data-error={imageError ? 'true' : undefined}>
          {imageUploading ? 'Đang nén và tải ảnh...' : imageError || imageNotice || `${value.length}/5000`}
        </span>
        <button type="button" className="community-comment-cancel" onClick={onCancel}>Hủy</button>
        <button type="button" className="community-comment-submit" disabled={!value.trim() || value.length > 5000 || submitting || imageUploading} onClick={onSubmit}>
          <Send size={16} />{submitting ? 'Đang gửi...' : submitLabel}
        </button>
      </div>
    </div>
  );
}

function renderMarkdownLite(value: string) {
  return <MarkdownBlock text={value} />;
}

function CommunityPostCard({ post, go, expanded = false }: { post: HomePost; go: (path: string) => void; expanded?: boolean }) {
  const href = postHref(post);
  const userHref = `/users/${encodeURIComponent(post.user.username || 'system')}`;
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommunityComment[]>(() => readCommunityComments(post));
  const [apiCommentTotal, setApiCommentTotal] = useState<number | null>(null);
  const [commentNotice, setCommentNotice] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [reactionCount, setReactionCount] = useState(Number(post.reactions || 0));
  const [myVote, setMyVote] = useState(0);
  const [emotionReactions, setEmotionReactions] = useState<Record<string, number>>(() => normalizeReactionMap(post.emotionReactions));
  const [emotionReactionCount, setEmotionReactionCount] = useState(Number(post.emotionReactionCount || 0));
  const [myEmotion, setMyEmotion] = useState<string | null>(post.myReaction || null);
  const [reactionActors, setReactionActors] = useState<CommunityReactionActor[]>(() => post.reactionActors || []);
  const [reactionActorsOpen, setReactionActorsOpen] = useState(false);
  const [reacting, setReacting] = useState(false);
  const shareTimerRef = useRef<number | null>(null);
  const commentCount = Math.max(apiCommentTotal ?? 0, post.comments || 0, comments.length);
  const shownReactionCount = Math.max(
    emotionReactionCount,
    Object.values(emotionReactions).reduce((sum, value) => sum + Number(value || 0), 0),
    reactionActors.length,
  );
  const canInspectReactionActors = hasCpproAuthToken();

  useEffect(() => {
    let active = true;
    setComments(readCommunityComments(post));
    setApiCommentTotal(null);
    setCommentNotice('');
    setReactionCount(Number(post.reactions || 0));
    setMyVote(0);
    setEmotionReactions(normalizeReactionMap(post.emotionReactions));
    setEmotionReactionCount(Number(post.emotionReactionCount || 0));
    setMyEmotion(post.myReaction || null);
    setReactionActors(post.reactionActors || []);
    setReactionActorsOpen(false);
    loadCommunityCommentsFromApi(post)
      .then(({ comments: apiComments, total }) => {
        if (!active) return;
        setComments(mergeCommunityComments(readStoredCommunityComments(post), apiComments));
        setApiCommentTotal(total);
      })
      .catch(() => {
        if (!active) return;
        setComments(readCommunityComments(post));
      });
    loadCommunityVoteFromApi(post)
      .then((payload) => {
        if (!active) return;
        setReactionCount(payload.totalVotes);
        setMyVote(payload.myVote);
      })
      .catch(() => undefined);
    loadCommunityPostReactionsFromApi(post)
      .then((payload) => {
        if (!active) return;
        setEmotionReactions(payload.reactions);
        setEmotionReactionCount(payload.reactionCount);
        setMyEmotion(payload.myReaction);
        setReactionActors(payload.reactors);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [post.id, post.slug, post.title]);

  useEffect(() => () => {
    if (shareTimerRef.current) window.clearTimeout(shareTimerRef.current);
  }, []);

  const sharePost = async () => {
    const { locale } = parseCpproPath(window.location.pathname);
    const targetUrl = new URL(withCpproLocale(locale, href), window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(targetUrl);
    } catch {
      const input = document.createElement('input');
      input.value = targetUrl;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setShareCopied(true);
    if (shareTimerRef.current) window.clearTimeout(shareTimerRef.current);
    shareTimerRef.current = window.setTimeout(() => setShareCopied(false), 1600);
  };

  const addComment = async (body: string, parentId?: string | number | null) => {
    setCommentNotice('');
    const storedUser = readStoredCpproUser();
    const nextComment: CommunityComment = {
      id: `local-${Date.now()}`,
      parentId: parentId || null,
      author: storedUser?.username || 'guest',
      badge: storedUser?.role === 'admin' || storedUser?.roles?.includes('admin') ? 'Admin' : 'Member',
      body,
      avatarUrl: storedUser?.avatar_url || storedUser?.avatarUrl || null,
      score: 0,
      createdAt: new Date().toISOString(),
    };
    setComments((current) => {
      const next = [nextComment, ...current];
      saveCommunityComments(post, next);
      return next;
    });
    try {
      const savedComment = await createCommunityCommentOnApi(post, body, parentId);
      setComments((current) => {
        const next = mergeCommunityComments([savedComment], current.filter((comment) => comment.id !== nextComment.id));
        saveCommunityComments(post, next);
        return next;
      });
      setApiCommentTotal((current) => Math.max((current ?? post.comments ?? 0) + 1, post.comments || 0, comments.length + 1));
    } catch {
      setCommentNotice(storedUser
        ? 'Chưa đồng bộ được lên máy chủ, bình luận đã được lưu tạm trên trình duyệt.'
        : 'Đã lưu tạm trên trình duyệt. Đăng nhập để đồng bộ bình luận vào hệ thống.');
    }
  };

  const reactToPost = async (reaction: string | null) => {
    if (reacting) return;
    const nextReaction = myEmotion === reaction ? null : reaction;
    const nextVote: 1 | 0 = nextReaction ? 1 : 0;
    const previousVote = myVote;
    const previousCount = reactionCount;
    const previousEmotion = myEmotion;
    const previousEmotionCount = emotionReactionCount;
    const previousReactions = emotionReactions;
    const previousActors = reactionActors;
    setReacting(true);
    setMyVote(nextVote);
    setMyEmotion(nextReaction);
    setEmotionReactions((current) => {
      const next = { ...current };
      if (previousEmotion) next[previousEmotion] = Math.max(0, Number(next[previousEmotion] || 0) - 1);
      if (nextReaction) next[nextReaction] = Number(next[nextReaction] || 0) + 1;
      return next;
    });
    setEmotionReactionCount((current) => Math.max(0, current + (previousEmotion ? -1 : 0) + (nextReaction ? 1 : 0)));
    if (previousVote !== nextVote) {
      setReactionCount((current) => Math.max(0, current + (nextVote === 1 ? 1 : -1)));
    }
    try {
      const [emotionSaved, voteSaved] = await Promise.all([
        setCommunityPostReactionOnApi(post, nextReaction),
        voteCommunityPostOnApi(post, nextVote).catch(() => null),
      ]);
      setEmotionReactions(emotionSaved.reactions);
      setEmotionReactionCount(emotionSaved.reactionCount);
      setMyEmotion(emotionSaved.myReaction);
      setReactionActors(emotionSaved.reactors);
      if (voteSaved) {
        setReactionCount(voteSaved.postVotes);
        setMyVote(voteSaved.myVote);
      }
    } catch {
      setMyVote(previousVote);
      setReactionCount(previousCount);
      setMyEmotion(previousEmotion);
      setEmotionReactionCount(previousEmotionCount);
      setEmotionReactions(previousReactions);
      setReactionActors(previousActors);
      setCommentNotice('Chưa thả reaction được. Vui lòng đăng nhập hoặc thử lại sau.');
    } finally {
      setReacting(false);
    }
  };

  const updateComment = (savedComment: CommunityComment) => {
    setComments((current) => mergeCommunityComments(
      current.map((comment) => String(comment.id) === String(savedComment.id) ? savedComment : comment),
      [savedComment],
    ));
  };

  const voteComment = async (comment: CommunityComment, voteType: -1 | 0 | 1) => {
    if (!comment.id || String(comment.id).startsWith('local-')) return;
    const nextVote = Number(comment.myVote || 0) === voteType ? 0 : voteType;
    try {
      updateComment(await voteCommunityCommentOnApi(post, comment.id, nextVote as -1 | 0 | 1));
    } catch {
      setCommentNotice('Chưa vote bình luận được. Vui lòng đăng nhập hoặc thử lại sau.');
    }
  };

  const reactComment = async (comment: CommunityComment, reaction: string | null) => {
    if (!comment.id || String(comment.id).startsWith('local-')) return;
    const nextReaction = comment.myReaction === reaction ? null : reaction;
    try {
      updateComment(await reactCommunityCommentOnApi(post, comment.id, nextReaction));
    } catch {
      setCommentNotice('Chưa thả reaction bình luận được. Vui lòng đăng nhập hoặc thử lại sau.');
    }
  };

  return (
    <>
    <article className="bg-white dark:bg-slate-800 rounded-[20px] border-2 border-slate-100 dark:border-slate-700 shadow-[0_4px_0_0_#E5E7EB] dark:shadow-[0_4px_0_0_#1e293b] p-5" data-original-post data-community-post-expanded={expanded ? 'true' : undefined}>
      <div className="flex items-center gap-3" data-original-post-author data-community-author-card>
        <Avatar user={post.user} />
        <div data-community-author-copy>
          <div data-community-author-name-row>
            <a href={userHref} data-community-author-name onClick={(event) => openInternalLink(event, go, userHref)}>{post.user.fullName || post.user.username}</a>
            <CheckCircle2 size={16} data-community-verified />
            <UserBadges user={post.user} />
          </div>
          <span>{post.date} · {post.category}</span>
          <div data-community-author-handle>@{post.user.username || 'system'}</div>
        </div>
        <button type="button" aria-label="Tùy chọn bài viết"><Ellipsis size={18} /></button>
      </div>
      <h3><a href={href} onClick={(event) => openInternalLink(event, go, href)}>{post.title}</a></h3>
      <p>{post.body}</p>
      {!expanded ? <button data-read-more type="button" onClick={() => go(href)}>Xem thêm</button> : null}
      {post.image ? <figure data-original-post-media><img src={post.image} alt="" /></figure> : null}
      <div className="flex items-center justify-between gap-3" data-original-post-stats data-community-reaction-summary>
        <span data-community-reaction-left>
          <button
            type="button"
            data-community-reaction-count
            data-open={reactionActorsOpen ? 'true' : undefined}
            aria-expanded={reactionActorsOpen}
            aria-label={`Xem ${shownReactionCount} cảm xúc`}
            onClick={() => setReactionActorsOpen((open) => !open)}
          >
            <CommunityReactionIconStack reactions={emotionReactions} fallbackCount={shownReactionCount} />
            <span data-community-reaction-copy>
              <strong>{shownReactionCount}</strong>
              <small>cảm xúc</small>
            </span>
          </button>
          {reactionActorsOpen ? (
            <CommunityReactionActorsPanel actors={reactionActors} canInspect={canInspectReactionActors} reactions={emotionReactions} />
          ) : null}
        </span>
        <span data-community-comment-count>
          <MessageSquare size={14} />
          <span>
            <strong>{commentCount}</strong>
            <small>bình luận</small>
          </span>
        </span>
      </div>
      <div className="flex items-center gap-1" data-original-post-actions>
        <ReactionPicker
          activeReaction={myEmotion}
          disabled={reacting}
          reactions={emotionReactions}
          onReact={(reaction) => void reactToPost(reaction)}
          triggerLabel="Thích"
        />
        <button type="button" data-community-comment-button onClick={() => setCommentsOpen(true)}><MessageSquare size={16} /> Bình luận</button>
        <button type="button" data-community-share-button data-share-copied={shareCopied ? 'true' : undefined} onClick={() => void sharePost()}>
          {shareCopied ? <CheckCircle2 size={16} /> : <Link2 size={16} />}
          {shareCopied ? 'Đã copy link' : 'Chia sẻ'}
        </button>
      </div>
      <PostComments post={post} comments={comments} onOpen={() => setCommentsOpen(true)} />
    </article>
    {commentsOpen ? (
      <CommunityPostModal
        post={post}
        comments={comments}
        commentCount={commentCount}
        postReactionCount={shownReactionCount}
        postReactions={emotionReactions}
        postReactionActors={reactionActors}
        postMyReaction={myEmotion}
        notice={commentNotice}
        onClose={() => setCommentsOpen(false)}
        onAddComment={addComment}
        onPostReaction={(reaction) => void reactToPost(reaction)}
        onVoteComment={voteComment}
        onReactComment={reactComment}
        go={go}
      />
    ) : null}
    </>
  );
}
function SidebarContestCard({ contest, go }: { contest: Contest; go: (path: string) => void }) {
  return (
    <button data-original-contest-mini type="button" onClick={() => go(`/contests/${contest.slug}`)}>
      <span data-sidebar-mini-icon><Swords size={15} /></span>
      <span data-sidebar-mini-copy>
        <strong>{contest.title}</strong>
        <small>{formatRange(contest.startTime, contest.endTime)}</small>
      </span>
      <em>{contest.status || 'Tham gia'}</em>
    </button>
  );
}

function SidebarRankCard({ user, index, go }: { user: UserRow; index: number; go: (path: string) => void }) {
  const href = `/users/${encodeURIComponent(user.username)}`;
  const rankLabel = user.rating > 0 ? user.rating.toLocaleString('vi-VN') : '—';
  return (
    <a href={href} data-original-rank-mini data-rank-place={index + 1} onClick={(event) => openInternalLink(event, go, href)}>
      <span data-rank-place-icon>{index === 0 ? <Crown size={17} /> : index < 3 ? <Medal size={17} /> : `#${index + 1}`}</span>
      <Avatar user={user} />
      <span data-rank-main>
        <span data-rank-name-row>
          <strong>{user.fullName || user.username}</strong>
          {user.streak > 0 ? <em data-rank-streak><Flame size={12} />{user.streak}</em> : null}
          <UserBadges user={user} />
        </span>
      </span>
      <span data-rank-score>
        <strong>{rankLabel}</strong>
        <small>{user.score.toLocaleString('vi-VN')} điểm</small>
      </span>
    </a>
  );
}

function SidebarNoticeCard({ notice, go }: { notice: HomePost; go: (path: string) => void }) {
  const href = postHref(notice);
  return (
    <a href={href} data-original-notice-mini onClick={(event) => openInternalLink(event, go, href)}>
      <span data-notice-head>
        <strong data-notice-title>{notice.title}</strong>
        <em data-notice-category>{notice.category}</em>
      </span>
      <small data-notice-excerpt>{notice.body}</small>
      <time data-notice-date>{notice.date}</time>
    </a>
  );
}

function userBadgeLabels(user: UserRow) {
  // Only badges explicitly created and assigned by a CPPro administrator are
  // shown here. Roles, streaks and ratings remain profile data, not badges.
  return Array.from(new Set(
    (user.badges || []).map((badge) => String(badge || '').trim()).filter(Boolean),
  )).slice(0, 6);
}

function streakTone(value: number) {
  if (value >= 14) return 'emerald';
  if (value >= 10) return 'cyan';
  if (value >= 5) return 'blue';
  if (value >= 3) return 'violet';
  return 'slate';
}

function badgeTone(label: string) {
  const normalized = label.toLowerCase().replace(/\s+/g, '-');
  if (normalized.includes('admin')) return 'admin';
  if (normalized.includes('staff') || normalized.includes('moderator')) return 'staff';
  if (normalized.includes('teacher')) return 'teacher';
  if (normalized.includes('ultra-max')) return 'ultra-max';
  if (normalized.includes('ultra')) return 'ultra';
  if (normalized.includes('streak')) return 'streak';
  if (normalized.includes('best')) return 'best-streak';
  if (normalized.includes('rating')) return 'rating';
  if (normalized.includes('solved')) return 'solved';
  if (normalized.includes('member')) return 'member';
  return 'pro';
}

function communityCommentBadgeLabels(author: string, badge: string) {
  const normalized = `${author} ${badge}`.toLowerCase();
  const labels = new Set<string>();
  if (normalized.includes('admin')) {
    labels.add('Admin');
    labels.add('Staff');
  } else if (normalized.includes('teacher') || normalized.includes('mentor') || normalized.includes('giảng')) {
    labels.add('Teacher');
  } else if (normalized.includes('ultra_max') || normalized.includes('ultramax') || (normalized.includes('ultra') && normalized.includes('max'))) {
    labels.add('ULTRA MAX');
  } else if (normalized.includes('ultra')) {
    labels.add('ULTRA');
  } else if (normalized.includes('pro')) {
    labels.add('PRO');
  }
  const cleanBadge = String(badge || '').trim();
  if (cleanBadge && cleanBadge.toLowerCase() !== 'member') labels.add(cleanBadge);
  if (!labels.size) {
    labels.add('Member');
    labels.add('Community');
  }
  return [...labels].slice(0, 4);
}

function UserBadges({ user }: { user: UserRow }) {
  const labels = userBadgeLabels(user);
  if (!labels.length) return null;
  return (
    <span className="user-badges" data-user-badges>
      {labels.map((label) => {
        const Icon = label.toLowerCase().startsWith('streak') ? Flame
          : label === 'Admin' ? ShieldCheck
            : label === 'Teacher' ? GraduationCap
              : label.includes('ULTRA') ? Sparkles
                : Award;
        return <em key={label} data-badge-tone={badgeTone(label)}><Icon size={10} />{label}</em>;
      })}
    </span>
  );
}

function communityCommentsStorageKey(post: HomePost) {
  return `cppro-post-comments:${communityPostKey(post)}`;
}

function mergeCommunityComments(...groups: CommunityComment[][]) {
  return normalizeCommunityComments(groups.flat()).filter((comment, index, list) => (
    list.findIndex((item) => String(item.id) === String(comment.id)) === index
  ));
}

function normalizeCommunityComments(comments?: CommunityComment[] | null): CommunityComment[] {
  return (Array.isArray(comments) ? comments : []).map((comment, index) => ({
    id: comment.id ?? `${comment.author}-${index}`,
    parentId: comment.parentId ?? null,
    author: String(comment.author || 'member'),
    badge: String(comment.badge || 'Member'),
    body: String(comment.body || '').trim(),
    avatarUrl: comment.avatarUrl || null,
    score: Number(comment.score ?? 0) || 0,
    voteCount: Number(comment.voteCount ?? 0) || 0,
    myVote: Number(comment.myVote ?? 0) || 0,
    reactions: normalizeReactionMap(comment.reactions),
    reactionCount: Number(comment.reactionCount ?? Object.values(comment.reactions || {}).reduce((sum, value) => sum + Number(value || 0), 0)) || 0,
    myReaction: comment.myReaction || null,
    createdAt: comment.createdAt || new Date(Date.now() - index * 60_000).toISOString(),
  })).filter((comment) => comment.body);
}

function readStoredCommunityComments(post: HomePost) {
  try {
    const stored = localStorage.getItem(communityCommentsStorageKey(post));
    return stored ? normalizeCommunityComments(JSON.parse(stored)) : [];
  } catch {
    return [];
  }
}

function readCommunityComments(post: HomePost) {
  return mergeCommunityComments(readStoredCommunityComments(post), normalizeCommunityComments(post.commentsPreview));
}

function saveCommunityComments(post: HomePost, comments: CommunityComment[]) {
  const localComments = normalizeCommunityComments(comments).filter((comment) => String(comment.id || '').startsWith('local-'));
  localStorage.setItem(communityCommentsStorageKey(post), JSON.stringify(localComments));
}

async function loadCommunityCommentsFromApi(post: HomePost) {
  const key = encodeURIComponent(communityPostKey(post));
  const payload = await cpproApiFetch<unknown>(`/posts/${key}/comments?limit=100`);
  return {
    comments: rowsFromApi<Record<string, unknown>>(payload).map(mapBackendPostComment),
    total: totalFromApi(payload, 0),
  };
}

async function createCommunityCommentOnApi(post: HomePost, body: string, parentId?: string | number | null) {
  const key = encodeURIComponent(communityPostKey(post));
  return mapBackendPostComment(await cpproApiFetch<Record<string, unknown>>(`/posts/${key}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body, parentId: parentId || undefined }),
  }));
}

async function loadCommunityVoteFromApi(post: HomePost) {
  if (!post.id) return { totalVotes: post.reactions || 0, myVote: 0 };
  const payload = await cpproApiFetch<Record<string, unknown>>(`/social/posts/${post.id}/votes`);
  return {
    totalVotes: Number(payload.totalVotes ?? payload.postVotes ?? post.reactions ?? 0) || 0,
    myVote: Number(payload.myVote ?? 0) || 0,
  };
}

async function loadCommunityPostReactionsFromApi(post: HomePost) {
  if (!post.id) {
    return {
      reactions: post.emotionReactions || {},
      reactionCount: Number(post.emotionReactionCount ?? post.reactions ?? 0) || 0,
      myReaction: post.myReaction || null,
      reactors: post.reactionActors || [],
    };
  }
  const payload = await cpproApiFetch<Record<string, unknown>>(`/social/posts/${post.id}/reactions`);
  return {
    reactions: normalizeReactionMap(payload.reactions),
    reactionCount: Number(payload.reactionCount ?? 0) || 0,
    myReaction: payload.myReaction ? String(payload.myReaction) : null,
    reactors: normalizeCommunityReactionActors(payload.reactors),
  };
}

async function setCommunityPostReactionOnApi(post: HomePost, reaction: string | null) {
  if (!post.id) {
    return {
      reactions: post.emotionReactions || {},
      reactionCount: Number(post.emotionReactionCount ?? post.reactions ?? 0) || 0,
      myReaction: reaction,
      reactors: post.reactionActors || [],
    };
  }
  const payload = await cpproApiFetch<Record<string, unknown>>(`/social/posts/${post.id}/reaction`, {
    method: 'POST',
    body: JSON.stringify({ reaction }),
  });
  return {
    reactions: normalizeReactionMap(payload.reactions),
    reactionCount: Number(payload.reactionCount ?? 0) || 0,
    myReaction: payload.myReaction ? String(payload.myReaction) : null,
    reactors: normalizeCommunityReactionActors(payload.reactors),
  };
}

async function voteCommunityCommentOnApi(post: HomePost, commentId: string | number, voteType: -1 | 0 | 1) {
  const key = encodeURIComponent(communityPostKey(post));
  return mapBackendPostComment(await cpproApiFetch<Record<string, unknown>>(`/posts/${key}/comments/${encodeURIComponent(String(commentId))}/vote`, {
    method: 'POST',
    body: JSON.stringify({ voteType }),
  }));
}

async function reactCommunityCommentOnApi(post: HomePost, commentId: string | number, reaction: string | null) {
  const key = encodeURIComponent(communityPostKey(post));
  return mapBackendPostComment(await cpproApiFetch<Record<string, unknown>>(`/posts/${key}/comments/${encodeURIComponent(String(commentId))}/reaction`, {
    method: 'POST',
    body: JSON.stringify({ reaction }),
  }));
}

async function voteCommunityPostOnApi(post: HomePost, voteType: 1 | 0) {
  if (!post.id) return { postVotes: post.reactions || 0, myVote: voteType };
  const payload = await cpproApiFetch<Record<string, unknown>>(`/social/posts/${post.id}/vote`, {
    method: 'POST',
    body: JSON.stringify({ voteType }),
  });
  return {
    postVotes: Number(payload.postVotes ?? payload.totalVotes ?? post.reactions ?? 0) || 0,
    myVote: voteType,
  };
}

function formatCommentTime(value?: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function communityCommentAvatar(comment: CommunityComment) {
  if (comment.avatarUrl) {
    return <img alt={comment.author} className="community-modal-comment-avatar" src={comment.avatarUrl} />;
  }
  return <span className="community-modal-comment-avatar">{comment.author[0]?.toUpperCase() || 'C'}</span>;
}

function PostComments({ post, comments, onOpen }: { post: HomePost; comments: CommunityComment[]; onOpen: () => void }) {
  if (!comments?.length && !post.comments) return null;
  return (
    <div className="mt-3 flex flex-col gap-2.5" data-original-comment-preview>
      {comments.slice(0, 3).map((comment, index) => (
        <div
          className="flex items-start gap-2.5"
          data-original-comment-row
          key={`${post.id || post.title}-${comment.id || `${comment.author}-${comment.createdAt || index}`}`}
        >
          {comment.avatarUrl ? (
            <img className="shrink-0 rounded-full border-2 border-white dark:border-slate-600" data-original-comment-avatar src={comment.avatarUrl} alt={comment.author} />
          ) : (
            <span className="shrink-0 rounded-full border-2 border-white dark:border-slate-600" data-original-comment-avatar>{comment.author[0]?.toUpperCase() || 'C'}</span>
          )}
          <p>
            <strong>{comment.author}</strong>
            <em>{comment.badge}</em>
            <small>{comment.body.startsWith('![image](') ? '![image]' : comment.body}</small>
          </p>
        </div>
      ))}
      <button type="button" onClick={onOpen}>Xem tất cả {Math.max(post.comments || 0, comments.length)} bình luận</button>
    </div>
  );
}

function CommunityPostModal({
  post,
  comments,
  commentCount,
  postReactionCount,
  postReactions,
  postReactionActors,
  postMyReaction,
  notice,
  onClose,
  onAddComment,
  onPostReaction,
  onVoteComment,
  onReactComment,
  go,
}: {
  post: HomePost;
  comments: CommunityComment[];
  commentCount: number;
  postReactionCount: number;
  postReactions: Record<string, number>;
  postReactionActors: CommunityReactionActor[];
  postMyReaction?: string | null;
  notice: string;
  onClose: () => void;
  onAddComment: (body: string, parentId?: string | number | null) => Promise<void> | void;
  onPostReaction: (reaction: string | null) => void;
  onVoteComment: (comment: CommunityComment, voteType: -1 | 0 | 1) => Promise<void> | void;
  onReactComment: (comment: CommunityComment, reaction: string | null) => Promise<void> | void;
  go: (path: string) => void;
}) {
  const [sortMode, setSortMode] = useState<'top' | 'new'>('top');
  const [draft, setDraft] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<string | number | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [reactionActorsOpen, setReactionActorsOpen] = useState(false);
  const userHref = `/users/${encodeURIComponent(post.user.username || 'system')}`;
  const canInspectReactionActors = hasCpproAuthToken();
  const visibleComments = useMemo(() => {
    const sorted = [...comments];
    if (sortMode === 'new') {
      sorted.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else {
      sorted.sort((a, b) => (Number(b.score || 0) - Number(a.score || 0))
        || (new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
    }
    return sorted;
  }, [comments, sortMode]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const submit = async () => {
    const body = draft.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    try {
      await onAddComment(body);
      setDraft('');
      setComposerOpen(false);
      setSortMode('new');
    } finally {
      setSubmitting(false);
    }
  };

  const submitReply = async (comment: CommunityComment) => {
    const body = replyDraft.trim();
    if (!body || replySubmitting) return;
    setReplySubmitting(true);
    try {
      await onAddComment(body, comment.id || null);
      setReplyDraft('');
      setReplyTarget(null);
      setSortMode('new');
    } finally {
      setReplySubmitting(false);
    }
  };

  return (
    <BodyPortal>
      <div className="community-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="community-modal" role="dialog" aria-modal="true" aria-label={`Bài viết của ${post.user.fullName || post.user.username}`}>
        <header className="community-modal-head">
          <div>
            <h2>Bài viết của {post.user.fullName || post.user.username}</h2>
          </div>
          <button type="button" aria-label="Đóng" onClick={onClose}><X size={17} /></button>
        </header>

        <div className="community-modal-scroll">
          <div className="community-modal-author">
            <Avatar user={post.user} />
            <div>
              <a href={userHref} onClick={(event) => openInternalLink(event, go, userHref)}>
                {post.user.fullName || post.user.username}
                <CheckCircle2 size={16} />
              </a>
              <UserBadges user={post.user} />
              <p>{post.date} · {post.category}</p>
            </div>
          </div>

          <article className="community-modal-post">
            <h3>{post.title}</h3>
            <p>{post.body}</p>
            {post.image ? <img src={post.image} alt="" /> : null}
          </article>

          <div className="flex items-center justify-between gap-3" data-original-post-stats data-community-reaction-summary>
            <span data-community-reaction-left>
              <button
                type="button"
                data-community-reaction-count
                data-open={reactionActorsOpen ? 'true' : undefined}
                aria-expanded={reactionActorsOpen}
                aria-label={`Xem ${postReactionCount} cảm xúc`}
                onClick={() => setReactionActorsOpen((open) => !open)}
              >
                <CommunityReactionIconStack reactions={postReactions} fallbackCount={postReactionCount} />
                <span data-community-reaction-copy>
                  <strong>{postReactionCount}</strong>
                  <small>cảm xúc</small>
                </span>
              </button>
              {reactionActorsOpen ? (
                <CommunityReactionActorsPanel actors={postReactionActors} canInspect={canInspectReactionActors} reactions={postReactions} />
              ) : null}
            </span>
            <span data-community-comment-count>
              <MessageSquare size={14} />
              <span>
                <strong>{commentCount}</strong>
                <small>bình luận</small>
              </span>
            </span>
          </div>

          <div className="flex items-center gap-1" data-original-post-actions data-community-modal-actions>
            <ReactionPicker
              activeReaction={postMyReaction}
              reactions={postReactions}
              onReact={onPostReaction}
              triggerLabel="Thích"
            />
            <button type="button" data-community-comment-button onClick={() => setComposerOpen(true)}><MessageSquare size={16} /> Bình luận</button>
          </div>

          <section className="community-modal-comments">
            <div className="community-modal-comments-head">
              <div>
                <MessageSquare size={20} />
                <h3>Bình luận</h3>
                <span>{commentCount}</span>
              </div>
              <div className="community-modal-sort" role="group" aria-label="Sắp xếp bình luận">
                <button type="button" className={sortMode === 'top' ? 'active' : ''} onClick={() => setSortMode('top')}>Nổi bật</button>
                <button type="button" className={sortMode === 'new' ? 'active' : ''} onClick={() => setSortMode('new')}>Mới nhất</button>
              </div>
            </div>

            {!composerOpen ? (
              <button type="button" className="community-comment-open" onClick={() => setComposerOpen(true)}>
                <MessageSquare size={16} />
                <span>Bình luận bài viết này...</span>
              </button>
            ) : (
              <CommunityCommentComposer
                value={draft}
                onChange={setDraft}
                onSubmit={submit}
                onCancel={() => {
                  setDraft('');
                  setComposerOpen(false);
                }}
                submitting={submitting}
                placeholder="Viết bình luận..."
              />
            )}
            {notice ? <p className="community-comment-notice">{notice}</p> : null}

            <div className="community-modal-comment-list">
              {visibleComments.length ? visibleComments.map((comment) => (
                <div
                  className={comment.parentId ? 'community-modal-comment community-modal-comment-reply' : 'community-modal-comment'}
                  id={`comment-${comment.id}`}
                  key={comment.id || `${comment.author}-${comment.createdAt}`}
                >
                  {communityCommentAvatar(comment)}
                  <div>
                    <div className="community-modal-comment-bubble">
                      <div className="community-modal-comment-meta">
                        <span>
                          <a href={`/users/${encodeURIComponent(comment.author)}`} onClick={(event) => openInternalLink(event, go, `/users/${encodeURIComponent(comment.author)}`)}>{comment.author}</a>
                          {communityCommentBadgeLabels(comment.author, comment.badge).map((label) => (
                            <em key={label} data-badge-tone={badgeTone(label)} data-community-role-badge>{label}</em>
                          ))}
                          <small>{formatCommentTime(comment.createdAt)}</small>
                        </span>
                        <span className="community-modal-votes">
                          <button type="button" aria-label="Upvote" data-active={comment.myVote === 1 ? 'true' : undefined} onClick={() => void onVoteComment(comment, 1)}><ChevronUp size={14} /></button>
                          <b>{Number(comment.score || 0)}</b>
                          <button type="button" aria-label="Downvote" data-active={comment.myVote === -1 ? 'true' : undefined} onClick={() => void onVoteComment(comment, -1)}><ChevronDown size={14} /></button>
                        </span>
                      </div>
                      <div className="community-comment-markdown"><MarkdownBlock text={comment.body} /></div>
                    </div>
                    <div className="community-comment-actions-row">
                      <ReactionPicker
                        activeReaction={comment.myReaction}
                        reactions={comment.reactions || {}}
                        onReact={(reaction) => void onReactComment(comment, reaction)}
                        triggerLabel="React"
                      />
                      <button className="community-modal-reply" type="button" onClick={() => {
                        setReplyTarget((current) => current === comment.id ? null : comment.id || null);
                        setReplyDraft('');
                      }}>
                        <Reply size={14} />Trả lời
                      </button>
                    </div>
                    {replyTarget === comment.id ? (
                      <CommunityCommentComposer
                        value={replyDraft}
                        onChange={setReplyDraft}
                        onSubmit={() => void submitReply(comment)}
                        onCancel={() => {
                          setReplyTarget(null);
                          setReplyDraft('');
                        }}
                        submitting={replySubmitting}
                        placeholder={`Trả lời ${comment.author}...`}
                        submitLabel="Gửi"
                      />
                    ) : null}
                  </div>
                </div>
              )) : (
                <div className="community-modal-empty">Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện.</div>
              )}
            </div>
          </section>
        </div>
      </section>
      </div>
    </BodyPortal>
  );
}

function problemStatusForUser(problem: Problem, currentUser: StoredCpproUser | null, submissions: Submission[] = []) {
  if (!currentUser) return 'empty';
  const bestVerdict = String(problem.myBestVerdict || problem.myStatus || '').toUpperCase();
  if (problem.userSolved || bestVerdict === 'AC') return 'accepted';
  if (Number(problem.userAttempts || 0) > 0 || (bestVerdict && bestVerdict !== 'NONE' && bestVerdict !== 'EMPTY')) return 'failed';
  const fallbackAttempts = submissions.filter((item) => {
    if (item.username !== currentUser.username) return false;
    return item.problemSlug === problem.slug || item.problemSlug === String(problem.id) || item.problemTitle === problem.title;
  });
  if (fallbackAttempts.some((item) => item.verdict === 'AC' && Number(item.score || 0) >= 100)) return 'accepted';
  return fallbackAttempts.length ? 'failed' : 'empty';
}

function ProblemsPage({ data, go, currentUser, loading = false }: { data: CpproData; go: (path: string) => void; currentUser: StoredCpproUser | null; loading?: boolean }) {
  type ProblemSortKey = 'status' | 'title' | 'tags' | 'source' | 'score' | 'acRate' | 'accepted' | 'editorial';
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('all');
  const [tag, setTag] = useState('all');
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(3500);
  const [hideSolved, setHideSolved] = useState(false);
  const [hasEditorial, setHasEditorial] = useState(false);
  const [showTags, setShowTags] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortState, setSortState] = useState<SortState<ProblemSortKey>>({ key: 'title', direction: 'asc' });
  const sources = useMemo(() => unique(data.problems.map((p) => p.source)), [data.problems]);
  const visible = data.problems.filter((problem) => {
    const status = problemStatusForUser(problem, currentUser, data.submissions);
    const haystack = `${problem.title} ${problem.slug} ${problem.source} ${problem.tags.map((t) => t.name).join(' ')}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query.toLowerCase());
    const matchesSource = source === 'all' || problem.source === source;
    const matchesTag = tag === 'all' || problem.tags.some((item) => item.slug === tag);
    const matchesSolved = !hideSolved || status !== 'accepted';
    const matchesEditorial = !hasEditorial || Boolean(problem.editorial);
    return matchesQuery && matchesSource && matchesTag && matchesSolved && matchesEditorial && problem.score >= minScore && problem.score <= maxScore;
  }).sort((left, right) => {
    const valueFor = (problem: Problem) => {
      if (sortState.key === 'status') return problemStatusForUser(problem, currentUser, data.submissions);
      if (sortState.key === 'title') return problem.title;
      if (sortState.key === 'tags') return problem.tags.map((item) => item.name).join(', ');
      if (sortState.key === 'source') return problem.source;
      if (sortState.key === 'score') return problem.score;
      if (sortState.key === 'acRate') return acRate(problem);
      if (sortState.key === 'accepted') return problem.accepted;
      if (sortState.key === 'editorial') return problem.editorial ? 1 : 0;
      return problem.title;
    };
    return compareSortValues(valueFor(left), valueFor(right), sortState.direction)
      || left.title.localeCompare(right.title, 'vi', { numeric: true, sensitivity: 'base' });
  });
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showLoadingRows = loading && data.problems.length === 0;
  const rangeStart = Math.max(0, Math.min(100, (minScore / 3500) * 100));
  const rangeEnd = Math.max(0, Math.min(100, (maxScore / 3500) * 100));
  const clampScore = (value: string, fallback: number) => {
    const next = Number(value);
    if (!Number.isFinite(next)) return fallback;
    return Math.max(0, Math.min(3500, Math.round(next)));
  };

  useEffect(() => {
    setPage(1);
  }, [query, source, tag, minScore, maxScore, hideSolved, hasEditorial, sortState.key, sortState.direction, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="problems-shell">
      <header data-problems-hero>
        <span data-problems-hero-icon><ListChecks size={25} /></span>
        <span>
          <h1>Danh sách bài</h1>
          <p>{visible.length} / {data.stats.problems} bài tập</p>
        </span>
        <div data-problems-hero-actions>
          <button type="button" onClick={() => setFilterOpen((open) => !open)}><Search size={16} /> Bộ lọc</button>
          <button
            type="button"
            disabled={visible.length === 0}
            onClick={() => {
              const target = visible[Math.floor(Math.random() * visible.length)];
              if (target) go(`/problems/${target.slug}`);
            }}
          >
            <Sparkles size={16} /> Ngẫu nhiên
          </button>
        </div>
      </header>

      <div className={filterOpen ? 'layout-with-filter is-filter-open' : 'layout-with-filter'} data-problems-layout>
      <section className="content-card" data-problems-table-card>
        <Pagination page={currentPage} totalPages={totalPages} onPage={setPage} totalItems={visible.length} pageSize={pageSize} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} />
        <div className="table-wrap" data-problems-table-wrap>
          <table data-problems-table>
            <thead>
              <tr>
                <th><SortButton label="Trạng thái" sortKey="status" state={sortState} onSort={(key) => setSortState((state) => toggleSort(state, key))} /></th>
                <th><SortButton label="Bài" sortKey="title" state={sortState} onSort={(key) => setSortState((state) => toggleSort(state, key))} /></th>
                <th><SortButton label="Dạng bài" sortKey="tags" state={sortState} onSort={(key) => setSortState((state) => toggleSort(state, key))} /></th>
                <th><SortButton label="Nguồn" sortKey="source" state={sortState} onSort={(key) => setSortState((state) => toggleSort(state, key))} /></th>
                <th><SortButton label="Điểm" sortKey="score" state={sortState} onSort={(key) => setSortState((state) => toggleSort(state, key))} align="right" /></th>
                <th><SortButton label="% AC" sortKey="acRate" state={sortState} onSort={(key) => setSortState((state) => toggleSort(state, key))} align="right" /></th>
                <th><SortButton label="# AC" sortKey="accepted" state={sortState} onSort={(key) => setSortState((state) => toggleSort(state, key))} align="right" /></th>
                <th><SortButton label="Lời giải" sortKey="editorial" state={sortState} onSort={(key) => setSortState((state) => toggleSort(state, key))} align="center" /></th>
              </tr>
            </thead>
            <tbody>
              {showLoadingRows ? (
                <tr data-empty-row>
                  <td colSpan={8}><TableLoadingRows rows={pageSize > 10 ? 8 : pageSize} columns={6} /></td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr data-empty-row>
                  <td colSpan={8} className="contest-empty">Chưa có dữ liệu bài tập phù hợp với bộ lọc hiện tại.</td>
                </tr>
              ) : pageRows.map((problem) => {
                const status = problemStatusForUser(problem, currentUser, data.submissions);
                return (
                <tr key={problem.slug} onClick={() => go(`/problems/${problem.slug}`)}>
                  <td data-problem-status-cell>
                    <span
                      data-problem-status={status}
                      title={status === 'accepted' ? 'Đã AC' : status === 'failed' ? 'Đã thử nhưng chưa AC' : 'Chưa làm'}
                    >
                      {status === 'accepted' ? <CheckCircle2 size={17} aria-label="Đã AC" /> : null}
                      {status === 'failed' ? <CircleMinus className="problem-status-failed-icon" size={20} aria-label="Đã thử nhưng chưa AC" /> : null}
                    </span>
                  </td>
                  <td>
                    <button className="link-button" data-problem-title-button type="button">{problem.title}</button>
                  </td>
                  <td>{showTags ? <TagStack tags={problem.tags} /> : <span className="tag muted-tag">Đã ẩn</span>}</td>
                  <td>{problem.source}</td>
                  <td className="strong">{Math.round(problem.score)}</td>
                  <td className={acRate(problem) >= 60 ? 'ok' : acRate(problem) >= 35 ? 'warn' : 'bad'}>{acRate(problem).toFixed(1)}%</td>
                  <td className="blue-text">{problem.accepted}</td>
                  <td data-editorial-cell>
                    {problem.editorial ? <BookOpen size={17} aria-label="Có lời giải" /> : <BookOpen size={17} aria-label="Chưa có lời giải" />}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={currentPage} totalPages={totalPages} onPage={setPage} totalItems={visible.length} pageSize={pageSize} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} />
      </section>
      <aside className="filter-panel" data-problems-filter data-open={filterOpen ? 'true' : 'false'}>
        <div data-filter-head>
          <span>
            <strong>Tìm kiếm bài tập</strong>
            <small>{visible.length} bài đang hiển thị</small>
          </span>
          <Search size={18} />
        </div>
        <label className="search-box">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên bài, mã bài..." />
        </label>
        <label className="checkline" data-cppro-checkline>
          <input checked={hideSolved} onChange={(event) => setHideSolved(event.target.checked)} type="checkbox" />
          <span data-check-mark>{hideSolved ? <CheckCircle2 size={12} /> : null}</span>
          <span>Ẩn các bài đã AC</span>
        </label>
        <label className="checkline" data-cppro-checkline>
          <input checked={hasEditorial} onChange={(event) => setHasEditorial(event.target.checked)} type="checkbox" />
          <span data-check-mark>{hasEditorial ? <CheckCircle2 size={12} /> : null}</span>
          <span>Có lời giải</span>
        </label>
        <label className="checkline" data-cppro-checkline>
          <input checked={showTags} onChange={(event) => setShowTags(event.target.checked)} type="checkbox" />
          <span data-check-mark>{showTags ? <CheckCircle2 size={12} /> : null}</span>
          <span>Hiện dạng bài</span>
        </label>
        <Select label="Nguồn bài" value={source} onChange={setSource} options={[['all', 'Tất cả'], ...sources.map((item) => [item, item] as [string, string])]} />
        <Select label="Dạng bài" value={tag} onChange={setTag} options={[['all', 'Tất cả'], ...data.tags.map((item) => [item.slug, item.name] as [string, string])]} />
        <div className="range-card">
          <div className="label">Khoảng điểm</div>
          <div className="range-inputs">
            <input type="number" value={minScore} min={0} max={maxScore} onChange={(event) => setMinScore(Math.min(clampScore(event.target.value, minScore), maxScore))} />
            <span>-</span>
            <input type="number" value={maxScore} min={minScore} max={3500} onChange={(event) => setMaxScore(Math.max(clampScore(event.target.value, maxScore), minScore))} />
          </div>
          <div className="range-visual" aria-hidden="true"><span style={{ left: `${rangeStart}%`, right: `${100 - rangeEnd}%` }} /></div>
          <input aria-label="Điểm tối thiểu" type="range" min={0} max={3500} value={minScore} onChange={(event) => setMinScore(Math.min(Number(event.target.value), maxScore))} />
          <input aria-label="Điểm tối đa" type="range" min={0} max={3500} value={maxScore} onChange={(event) => setMaxScore(Math.max(Number(event.target.value), minScore))} />
          <div className="range-labels"><span>0</span><span>3500</span></div>
        </div>
        <div className="filter-actions">
          <button className="blue-button" type="button" onClick={() => setPage(1)}>Tìm</button>
          <button
            className="soft-button"
            type="button"
            disabled={visible.length === 0}
            onClick={() => {
              const target = visible[Math.floor(Math.random() * visible.length)];
              if (target) go(`/problems/${target.slug}`);
            }}
          >
            Ngẫu nhiên
          </button>
        </div>
        <p className="muted">{visible.length} / {data.stats.problems} bài</p>
      </aside>
      </div>
    </div>
  );
}

function ProblemDetail({
  problem: initialProblem,
  problemSlug,
  data,
  go,
  currentUser,
  contestParam,
}: {
  problem?: Problem;
  problemSlug?: string;
  data: CpproData;
  go: (path: string) => void;
  currentUser: StoredCpproUser | null;
  contestParam?: string;
}) {
  const [remoteProblem, setRemoteProblem] = useState<Problem | null>(null);
  const [remoteProblemLoading, setRemoteProblemLoading] = useState(false);
  const problem = initialProblem || remoteProblem || undefined;
  const activeContest = activeJoinedContest(data.contests);
  const [activeContestDetail, setActiveContestDetail] = useState<Contest | null>(null);
  const [contestScopeLoading, setContestScopeLoading] = useState(false);
  const [comments, setComments] = useState<ProblemComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [commentMode, setCommentMode] = useState<'write' | 'preview'>('write');
  const [commentSort, setCommentSort] = useState<'top' | 'new'>('top');
  const [commentMessage, setCommentMessage] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentImageUploading, setCommentImageUploading] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ProblemComment | null>(null);
  const [reactingCommentId, setReactingCommentId] = useState<string | number | null>(null);
  const [submissionStats, setSubmissionStats] = useState<ProblemStatsSummary | null>(null);
  const problemCommentFileInputRef = useRef<HTMLInputElement | null>(null);
  const activeContestKey = activeContest ? `${activeContest.id}:${activeContest.slug}` : '';
  const problemKey = problem?.slug || problemSlug || (problem?.id ? String(problem.id) : '');
  const problemStatsKey = problem?.id || problemKey;

  useEffect(() => {
    let cancelled = false;
    if (initialProblem || !problemSlug) {
      setRemoteProblem(null);
      setRemoteProblemLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setRemoteProblemLoading(true);
    fetchProblemDetail(problemSlug)
      .then((nextProblem) => {
        if (!cancelled) setRemoteProblem(nextProblem);
      })
      .catch(() => {
        if (!cancelled) setRemoteProblem(null);
      })
      .finally(() => {
        if (!cancelled) setRemoteProblemLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialProblem?.id, initialProblem?.slug, problemSlug]);

  useEffect(() => {
    let cancelled = false;
    if (!activeContest) {
      setActiveContestDetail(null);
      setContestScopeLoading(false);
      return () => {
        cancelled = true;
      };
    }
    const existing = data.contestDetails[activeContest.slug] || data.contestDetails[String(activeContest.id)];
    if (existing?.problems?.length) {
      setActiveContestDetail(existing);
      setContestScopeLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setContestScopeLoading(true);
    cpproApiFetch<unknown>(`/contests/${encodeURIComponent(activeContest.slug || String(activeContest.id))}`)
      .then((payload) => {
        if (!cancelled && payload && typeof payload === 'object') {
          setActiveContestDetail(mapBackendContest(payload as Record<string, unknown>));
        }
      })
      .catch(() => {
        if (!cancelled) setActiveContestDetail(null);
      })
      .finally(() => {
        if (!cancelled) setContestScopeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeContestKey, data.contestDetails]);

  useEffect(() => {
    let cancelled = false;
    if (!problemKey) {
      setComments([]);
      setSubmissionStats(null);
      return () => {
        cancelled = true;
      };
    }
    setCommentsLoading(true);
    Promise.all([
      fetchProblemComments(problemKey),
      fetchProblemSubmissionStats(problemStatsKey).catch(() => null),
    ])
      .then(([nextComments, nextStats]) => {
        if (cancelled) return;
        setComments(nextComments);
        setSubmissionStats(nextStats);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [problemKey, problemStatsKey]);

  if (!problem) return remoteProblemLoading ? <DataLoadingPanel label="Đang tải dữ liệu bài tập" rows={5} /> : <Empty title="Không tìm thấy bài tập" />;

  const scopedContest = activeContestDetail || activeContest;
  const belongsToContest = scopedContest ? problemBelongsToContest(problem, scopedContest) : true;
  const contestContextMatches = !contestParam || !scopedContest
    || String(scopedContest.id) === String(contestParam)
    || scopedContest.slug === contestParam;

  if (scopedContest && (!contestContextMatches || belongsToContest === false || (belongsToContest === null && !contestScopeLoading))) {
    return (
      <ContestScopeGuard
        contest={scopedContest}
        problem={problem}
        go={go}
        loading={contestScopeLoading && belongsToContest === null}
      />
    );
  }

  if (scopedContest && belongsToContest === null && contestScopeLoading) {
    return <ContestScopeGuard contest={scopedContest} problem={problem} go={go} loading />;
  }

  const lcojLegacyRoutes = shouldUseLcojLegacyRoutes();
  const problemHref = `/problems/${problem.slug}`;
  const lcojProblemBase = lcojProblemPath(problem.slug || problemSlug || problem.id);
  const problemStatement = stripProblemStatementTitle(problem.statement, problem.title);
  const reportTitle = `Báo lỗi bài tập ${problem.title}`;
  const timeLimit = `${((problem.timeLimitMs || 1000) / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}s`;
  const scoreLabel = `${Number(problem.score || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} (OI)`;
  const problemPdfHref = lcojLegacyRoutes ? `${lcojProblemBase}/pdf` : `${problemHref}/pdf-preview`;
  const problemSubmitHref = lcojLegacyRoutes ? `${lcojProblemBase}/submit` : `${problemHref}/submit${scopedContest ? `?contest=${encodeURIComponent(String(scopedContest.id))}` : ''}`;
  const allSubmissionsHref = lcojLegacyRoutes ? `${lcojProblemBase}/submissions/` : `${problemHref}/submissions`;
  const bestSubmissionsHref = lcojLegacyRoutes ? `${lcojProblemBase}/rank/` : `${problemHref}/rank`;
  const reportProblemHref = lcojLegacyRoutes ? `${lcojProblemBase}/tickets/new` : `/feedback?title=${encodeURIComponent(reportTitle)}&problem=${encodeURIComponent(problem.slug)}`;
  const mySubmissionHref = lcojLegacyRoutes
    ? (currentUser?.username ? `${lcojProblemBase}/submissions/${encodeURIComponent(currentUser.username)}/` : `${lcojProblemBase}/submissions/`)
    : `${problemHref}/submissions/${currentUser?.username || 'me'}`;
  const sortedComments = [...comments].sort((left, right) => {
    if (commentSort === 'new') return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    return (right.reactionCount - left.reactionCount) || (new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  });
  const repliesByParent = new Map<string, ProblemComment[]>();
  const rootComments: ProblemComment[] = [];
  sortedComments.forEach((comment) => {
    const parentKey = comment.parentId ? String(comment.parentId) : '';
    if (!parentKey) {
      rootComments.push(comment);
      return;
    }
    repliesByParent.set(parentKey, [...(repliesByParent.get(parentKey) || []), comment]);
  });
  const problemStatus = problemStatusForUser(problem, currentUser, data.submissions);
  const submitProblemComment = async () => {
    const body = commentBody.trim();
    if (!body) return;
    if (!currentUser) {
      go(authPathWithReturn('login'));
      return;
    }
    setCommentSubmitting(true);
    setCommentMessage('');
    try {
      const nextComments = await createProblemComment(problem.slug || problem.id, body, replyTarget?.id || null);
      setComments(nextComments);
      setCommentBody('');
      setReplyTarget(null);
      setCommentMessage('Đã gửi bình luận.');
    } catch (error) {
      setCommentMessage(error instanceof Error ? error.message : 'Không thể gửi bình luận.');
    } finally {
      setCommentSubmitting(false);
    }
  };
  const insertCommentImage = () => {
    problemCommentFileInputRef.current?.click();
  };
  const handleProblemCommentImageFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setCommentImageUploading(true);
    setCommentMessage('');
    try {
      const uploaded = await uploadPostImageAsset(file);
      setCommentBody((value) => `${value}${value.endsWith('\n') || !value ? '' : '\n'}![${uploaded.fileName}](${uploaded.url})\n`);
      setCommentMode('preview');
      if (uploaded.compressed) {
        setCommentMessage(`Đã tự nén ảnh từ ${formatUploadBytes(uploaded.originalSize)} xuống ${formatUploadBytes(uploaded.uploadSize)} trước khi lưu.`);
      }
    } catch (error) {
      setCommentMessage(error instanceof Error ? error.message : 'Không thể tải ảnh lên.');
    } finally {
      setCommentImageUploading(false);
    }
  };
  const reactProblemComment = async (comment: ProblemComment, reaction: string) => {
    if (!currentUser) {
      go(authPathWithReturn('login'));
      return;
    }
    setReactingCommentId(comment.id);
    setCommentMessage('');
    try {
      const nextReaction = comment.myReaction === reaction ? null : reaction;
      const nextComments = await setProblemCommentReaction(problem.slug || problem.id, comment.id, nextReaction);
      setComments(nextComments);
    } catch (error) {
      setCommentMessage(error instanceof Error ? error.message : 'Không thể react bình luận.');
    } finally {
      setReactingCommentId(null);
    }
  };
  const renderProblemComment = (comment: ProblemComment, isReply = false): React.ReactNode => {
    const replies = repliesByParent.get(String(comment.id)) || [];
    return (
      <article key={String(comment.id)} data-problem-comment-item data-problem-comment-reply={isReply ? 'true' : undefined}>
        <span data-problem-comment-avatar>{comment.avatarUrl ? <img src={comment.avatarUrl} alt="" /> : comment.author.slice(0, 2).toUpperCase()}</span>
        <div>
          <header>
            <strong>{comment.fullName || comment.author}</strong>
            <small>@{comment.author} Â· {formatDate(comment.createdAt)}</small>
          </header>
          <div data-problem-comment-body>
            {comment.isDeleted ? 'Bình luận đã được xóa.' : <MarkdownBlock text={comment.body} />}
          </div>
          <footer>
            {[
              { reaction: 'like', label: 'Thích', icon: <Heart size={14} /> },
              { reaction: 'love', label: 'Yêu thích', icon: <Sparkles size={14} /> },
              { reaction: 'celebrate', label: 'Chúc mừng', icon: <Flame size={14} /> },
              { reaction: 'insightful', label: 'Hay', icon: <Star size={14} /> },
            ].map(({ reaction, label, icon }) => {
              const count = Number(comment.reactions[reaction] || 0);
              const active = comment.myReaction === reaction;
              return (
                <button
                  key={reaction}
                  type="button"
                  className={active ? 'active' : ''}
                  disabled={reactingCommentId === comment.id}
                  onClick={() => void reactProblemComment(comment, reaction)}
                >
                  {icon}
                  {label}
                  <b>{count}</b>
                </button>
              );
            })}
            <button type="button" data-problem-comment-reply-button onClick={() => { setReplyTarget(comment); setCommentMode('write'); }}>
              <Reply size={14} />
              Trả lời
            </button>
          </footer>
          {replies.length ? (
            <div data-problem-comment-replies>
              {replies.map((reply) => renderProblemComment(reply, true))}
            </div>
          ) : null}
        </div>
      </article>
    );
  };

  return (
    <div data-problem-detail-shell>
      <div data-problem-detail-layout>
        <article data-problem-statement-card>
          <header data-problem-titlebar>
            <div data-problem-title-main data-problem-title-status={problemStatus}>
              <span data-problem-title-status-icon>
                {problemStatus === 'accepted'
                  ? <CheckCircle2 size={22} aria-label="Đã giải đúng" />
                  : problemStatus === 'failed'
                    ? <CircleMinus size={22} aria-label="Đã thử nhưng chưa đúng" />
                    : <span className="cppro-problem-title-empty-dot" role="img" aria-label="Chưa làm" />}
              </span>
              <h1>{problem.title}</h1>
            </div>
            <a href={`${problemHref}/pdf-preview`} target="_blank" rel="noreferrer" data-problem-pdf-link>
              <FileText size={16} />
              Xem dạng PDF
            </a>
          </header>
          <div data-problem-markdown>
            {problemStatement ? <MarkdownBlock text={problemStatement} /> : <p className="muted">Nội dung chi tiết chưa có trong dữ liệu hiện tại.</p>}
            {problem.constraints ? <MarkdownBlock text={`## Ràng buộc\n${problem.constraints}`} /> : null}
          </div>
        </article>

        <aside data-problem-sidebar>
          <button data-problem-submit-cta type="button" onClick={() => go(`${problemHref}/submit${scopedContest ? `?contest=${encodeURIComponent(String(scopedContest.id))}` : ''}`)}>
            <Send size={20} />
            Gửi bài giải
          </button>

          <nav data-problem-action-card aria-label="Liên kết bài tập">
            <a href={mySubmissionHref} onClick={(event) => openInternalLink(event, go, mySubmissionHref)}>
              <User size={16} />
              Bài nộp của tôi
              <ChevronRight size={16} />
            </a>
            <a href={`${problemHref}/submissions`} onClick={(event) => openInternalLink(event, go, `${problemHref}/submissions`)}>
              <ListChecks size={16} />
              Danh sách bài nộp
              <ChevronRight size={16} />
            </a>
            <a href={`${problemHref}/rank`} onClick={(event) => openInternalLink(event, go, `${problemHref}/rank`)}>
              <Trophy size={16} />
              Bài nộp tốt nhất
              <ChevronRight size={16} />
            </a>
            <button type="button" onClick={() => go(`/feedback?title=${encodeURIComponent(reportTitle)}&problem=${encodeURIComponent(problem.slug)}`)}>
              <FileQuestion size={16} />
              Hỏi / báo cáo bài
              <ChevronRight size={16} />
            </button>
          </nav>

          <section data-problem-info-card>
            <ProblemInfoRow icon={<FileText size={14} />} label="Điểm" value={scoreLabel} />
            <ProblemInfoRow icon={<Clock size={14} />} label="Giới hạn thời gian" value={timeLimit} />
            <ProblemInfoRow icon={<HardDrive size={14} />} label="Giới hạn bộ nhớ" value={`${problem.memoryLimitMb || 256}M`} />
            <ProblemInfoRow icon={<Terminal size={14} />} label="Input" value="stdin" />
            <ProblemInfoRow icon={<Printer size={14} />} label="Output" value="stdout" />
            <ProblemInfoRow icon={<User size={14} />} label="Tác giả" value={problem.createdBy || problem.source || 'ITCoder'} />
            <ProblemInfoRow icon={<Tag size={14} />} label="Dạng bài">
              <div data-problem-tag-list>
                {problem.tags.length ? problem.tags.map((tag) => <span key={tag.slug}>{tag.name}</span>) : <span>Chưa phân loại</span>}
              </div>
            </ProblemInfoRow>
            <ProblemInfoRow icon={<Globe size={14} />} label="Ngôn ngữ cho phép">
              <div data-problem-tag-list>
                <span>Tất cả ngôn ngữ hỗ trợ</span>
              </div>
            </ProblemInfoRow>
            <ProblemInfoRow icon={<ChartColumn size={14} />} label="Thống kê" value={`${problem.accepted} AC · ${problem.submissions} submissions · ${acRate(problem).toFixed(1)}% AC`} />
          </section>

          <ProblemStatsChart stats={submissionStats} />
        </aside>
      </div>

      <section data-problem-comments-card>
        <div data-problem-comments-head>
          <span>
            <MessageCircle size={20} />
            <h2>Bình luận</h2>
            <b>{comments.length}</b>
          </span>
          <div data-problem-comment-tabs>
            <button type="button" className={commentSort === 'top' ? 'active' : ''} onClick={() => setCommentSort('top')}>Nổi bật</button>
            <button type="button" className={commentSort === 'new' ? 'active' : ''} onClick={() => setCommentSort('new')}>Mới nhất</button>
          </div>
        </div>
        <div data-problem-comment-compose>
          <div data-problem-comment-compose-head>
            <div data-problem-comment-mode-tabs>
              <button type="button" className={commentMode === 'write' ? 'active' : ''} onClick={() => setCommentMode('write')}>
                <PenLine size={14} />
                Trình soạn thảo
              </button>
              <button type="button" className={commentMode === 'preview' ? 'active' : ''} onClick={() => setCommentMode('preview')}>
                <Eye size={14} />
                Xem trước
              </button>
            </div>
            <input
              ref={problemCommentFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(event) => void handleProblemCommentImageFile(event)}
            />
            <button type="button" data-problem-comment-image disabled={commentImageUploading} onClick={insertCommentImage}>
              <ImageIcon size={14} />
              {commentImageUploading ? 'Đang tải...' : 'Ảnh'}
            </button>
          </div>
          {replyTarget ? (
            <button type="button" data-problem-comment-reply-target onClick={() => setReplyTarget(null)}>
              <Reply size={14} />
              <span>Đang trả lời @{replyTarget.author}</span>
              <X size={14} />
            </button>
          ) : null}
          {commentMode === 'preview' ? (
            <div data-problem-comment-preview>
              {commentBody.trim() ? <MarkdownBlock text={commentBody} /> : <span>Chưa có nội dung để xem trước.</span>}
            </div>
          ) : (
            <textarea
              rows={4}
              maxLength={8192}
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder={currentUser ? (replyTarget ? `Trả lời ${replyTarget.fullName || replyTarget.author}...` : 'Viết bình luận...') : 'Đăng nhập để bình luận bài viết này...'}
              disabled={!currentUser || commentSubmitting || commentImageUploading}
            />
          )}
          <div data-problem-comment-compose-foot>
            <span>{commentMessage || (commentImageUploading ? 'Đang nén và tải ảnh...' : commentsLoading ? <InlineLoadingText label="Đang tải bình luận" /> : `${commentBody.trim().length}/8192`)}</span>
            <div>
              <button type="button" data-problem-comment-cancel disabled={!commentBody && !commentMessage && !replyTarget} onClick={() => { setCommentBody(''); setCommentMessage(''); setReplyTarget(null); setCommentMode('write'); }}>Hủy</button>
              <button type="button" data-problem-comment-send disabled={!currentUser || !commentBody.trim() || commentSubmitting || commentImageUploading} onClick={() => void submitProblemComment()}>
                <Send size={16} />
                {commentSubmitting ? 'Đang gửi...' : replyTarget ? 'Gửi trả lời' : 'Gửi'}
              </button>
            </div>
          </div>
        </div>
        {sortedComments.length ? (
          <div data-problem-comment-list>
            {rootComments.map((comment) => renderProblemComment(comment))}
          </div>
        ) : (
          <p data-problem-comments-empty>{commentsLoading ? <InlineLoadingText label="Đang tải bình luận" /> : 'Chưa có bình luận nào.'}</p>
        )}
      </section>
    </div>
  );
}

function ProblemStatsChart({ stats }: { stats: ProblemStatsSummary | null }) {
  const total = Math.max(0, stats?.total ?? 0);
  const accepted = Math.max(0, stats?.accepted ?? 0);
  const tle = Math.max(0, stats?.tle ?? 0);
  const runtime = Math.max(0, stats?.runtime ?? 0);
  const pending = Math.max(0, stats?.pending ?? 0);
  const wrong = Math.max(0, stats?.wrong ?? Math.max(0, total - accepted - tle - runtime - pending));
  const segments = [
    { key: 'ac', label: 'AC', value: accepted, color: '#22c55e' },
    { key: 'wa', label: 'WA', value: wrong, color: '#ef4444' },
    { key: 're', label: 'Runtime error', value: runtime, color: '#f97316' },
    { key: 'tle', label: 'TLE', value: tle, color: '#94a3b8' },
    { key: 'pending', label: 'Đang chấm', value: pending, color: '#38bdf8' },
  ].filter((item) => item.value > 0 || item.key === 'ac' || item.key === 'wa');
  const gradient = total > 0
    ? segments.reduce((parts, item) => {
      const previous = parts.offset;
      const next = previous + (item.value / total) * 100;
      parts.values.push(`${item.color} ${previous}% ${next}%`);
      parts.offset = next;
      return parts;
    }, { values: [] as string[], offset: 0 }).values.join(', ')
    : '#e2e8f0 0% 100%';
  return (
    <section data-problem-stats-chart>
      <div data-problem-stats-donut style={{ background: `conic-gradient(${gradient})` }}>
        <span>{total ? `${Math.round((accepted / total) * 100)}%` : '0%'}</span>
        <small>AC</small>
      </div>
      <div data-problem-stats-bars>
        {segments.map((item) => (
          <div key={item.key} data-problem-stat-segment>
            <span><i style={{ background: item.color }} />{item.label}</span>
            <b>{item.value}</b>
            <em><span style={{ width: `${total ? Math.max(4, (item.value / total) * 100) : 0}%`, background: item.color }} /></em>
          </div>
        ))}
      </div>
      <p>{stats?.avgRuntime ? `Runtime TB ${stats.avgRuntime}ms` : total ? 'Thống kê riêng của bài này từ database.' : 'Chưa có bài nộp cho bài tập này.'}</p>
    </section>
  );
}

function ProblemInfoRow({ icon, label, value, children }: { icon: React.ReactNode; label: string; value?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div data-problem-info-row>
      <span data-problem-info-icon>{icon}</span>
      <div>
        <small>{label}</small>
        {children || <strong>{value}</strong>}
      </div>
    </div>
  );
}

function ContestScopeGuard({ contest, problem, go, loading }: { contest: Contest; problem: Problem; go: (path: string) => void; loading?: boolean }) {
  return (
    <section data-contest-scope-guard>
      <span><ShieldCheck size={28} /></span>
      <h1>{loading ? 'Đang kiểm tra phạm vi kỳ thi' : 'Bạn đang trong kỳ thi'}</h1>
      <p>
        {loading
          ? `Đang xác nhận bài "${problem.title}" có thuộc kỳ thi "${contest.title}" hay không.`
          : `Trong lúc tham gia "${contest.title}", bạn chỉ có thể xem và nộp các bài thuộc kỳ thi này.`}
      </p>
      <button type="button" onClick={() => go(`/contests/${contest.slug}`)}>
        Về kỳ thi đang tham gia
      </button>
    </section>
  );
}

function ProblemSubmissionsPage({
  problem,
  data,
  go,
  currentUser,
  username,
  mode,
}: {
  problem?: Problem;
  data: CpproData;
  go: (path: string) => void;
  currentUser: StoredCpproUser | null;
  username?: string;
  mode: 'all' | 'mine' | 'best';
}) {
  const [status, setStatus] = useState('all');
  const [language, setLanguage] = useState('all');
  const [remoteSubmissions, setRemoteSubmissions] = useState<Submission[] | null>(null);
  const [loading, setLoading] = useState(false);

  const activeContest = problem ? activeJoinedContest(data.contests) : null;
  const locked = problem && activeContest ? problemBelongsToContest(problem, activeContest) === false : false;
  const effectiveUsername = username === 'me' ? currentUser?.username : username;

  useEffect(() => {
    let cancelled = false;
    if (!problem?.id) return () => {
      cancelled = true;
    };
    const params = new URLSearchParams({
      limit: '100',
      withCount: 'true',
      problemId: String(problem.id),
      sort: 'created',
      dir: 'desc',
    });
    if (mode === 'mine' && effectiveUsername) params.set('username', effectiveUsername);
    setLoading(true);
    cpproApiFetch<unknown>(`/submissions?${params.toString()}`)
      .then((payload) => {
        if (!cancelled) setRemoteSubmissions(rowsFromApi<Record<string, unknown>>(payload).map(mapBackendSubmission));
      })
      .catch(() => {
        if (!cancelled) setRemoteSubmissions(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [problem?.id, mode, effectiveUsername]);

  if (!problem) return <Empty title="Không tìm thấy bài tập" />;
  if (locked && activeContest) {
    return <ContestScopeGuard contest={activeContest} problem={problem} go={go} />;
  }

  const baseSubmissions = remoteSubmissions || data.submissions.filter((item) => item.problemSlug === problem.slug || item.problemTitle === problem.title);
  const visibleSubmissions = baseSubmissions
    .filter((item) => {
      const matchesUser = mode !== 'mine' || !effectiveUsername || item.username.toLowerCase() === effectiveUsername.toLowerCase();
      const matchesStatus = status === 'all' || item.verdict === status;
      const matchesLanguage = language === 'all' || item.language === language;
      return matchesUser && matchesStatus && matchesLanguage;
    })
    .sort((a, b) => {
      if (mode === 'best') return Number(b.score || 0) - Number(a.score || 0) || a.timeMs - b.timeMs;
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    });
  const statuses = unique(baseSubmissions.map((item) => item.verdict).filter(Boolean));
  const languages = unique(baseSubmissions.map((item) => item.language).filter(Boolean));
  const acceptedCount = visibleSubmissions.filter((item) => item.verdict === 'AC').length;
  const partialCount = visibleSubmissions.filter((item) => item.verdict !== 'AC' && Number(item.score || 0) > 0).length;
  const failedCount = Math.max(0, visibleSubmissions.length - acceptedCount - partialCount);
  const titlePrefix = mode === 'mine' ? 'Bài nộp của tôi' : mode === 'best' ? 'Bài nộp tốt nhất' : 'Danh sách bài nộp';

  return (
    <div data-problem-submissions-page>
      <header data-problem-submissions-head>
        <h1>
          {titlePrefix} – <a href={`/problems/${problem.slug}`} onClick={(event) => openInternalLink(event, go, `/problems/${problem.slug}`)}>{problem.title}</a>
        </h1>
        <div data-problem-submission-tabs>
          <button className={mode === 'all' ? 'active' : ''} type="button" onClick={() => go(`/problems/${problem.slug}/submissions`)}><ListChecks size={16} />Tất cả</button>
          <button className={mode === 'mine' ? 'active' : ''} type="button" onClick={() => go(`/problems/${problem.slug}/submissions/${currentUser?.username || 'me'}`)}><User size={16} />Bài nộp của tôi</button>
          <button className={mode === 'best' ? 'active' : ''} type="button" onClick={() => go(`/problems/${problem.slug}/rank`)}><Trophy size={16} />Tốt nhất</button>
        </div>
      </header>

      <div data-problem-submissions-layout>
        <section data-problem-submissions-list>
          {loading ? (
            <TableLoadingRows rows={6} columns={5} />
          ) : visibleSubmissions.length === 0 ? (
            <ProblemSubmissionsEmpty label="Không tìm thấy bài nộp nào" />
          ) : (
            <div data-problem-submission-rows>
              {visibleSubmissions.map((item) => (
                <button key={item.id} type="button" data-problem-submission-row onClick={() => go(`/submissions/${item.id}`)}>
                  <span data-submission-score-cell className={item.verdict === 'AC' ? 'accepted' : Number(item.score || 0) > 0 ? 'partial' : 'failed'}>
                    <strong>{Number(item.score || 0).toFixed(0)} / {Number(item.maxScore || 100).toFixed(0)}</strong>
                    <small title={`${item.verdict} | ${item.language}`}>{item.verdict} | {item.language}</small>
                  </span>
                  <span data-submission-main-cell>
                    <strong>{item.problemTitle || problem.title}</strong>
                    <small>
                      <a href={`/users/${item.username}`} onClick={(event) => { event.stopPropagation(); openInternalLink(event, go, `/users/${item.username}`); }}>{item.username}</a>
                      <span>·</span>
                      <span>{formatDate(item.submittedAt)}</span>
                    </small>
                  </span>
                  <span data-submission-view-link>xem</span>
                  <span data-submission-resource-cell>
                    <strong>{formatSubmissionRuntime(item.timeMs)}</strong>
                    <small>{formatSubmissionMemory(item.memoryKb)}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <ProblemSubmissionSidebar
          status={status}
          language={language}
          statuses={statuses}
          languages={languages}
          onStatus={setStatus}
          onLanguage={setLanguage}
          total={visibleSubmissions.length}
          accepted={acceptedCount}
          partial={partialCount}
          failed={failedCount}
        />
      </div>
    </div>
  );
}

function ProblemSubmissionsEmpty({ label }: { label: string }) {
  return (
    <div data-problem-submissions-empty>
      <Search size={48} />
      <p>{label}</p>
    </div>
  );
}

function ProblemSubmissionSidebar({
  status,
  language,
  statuses,
  languages,
  onStatus,
  onLanguage,
  total,
  accepted,
  partial,
  failed,
}: {
  status: string;
  language: string;
  statuses: string[];
  languages: string[];
  onStatus: (value: string) => void;
  onLanguage: (value: string) => void;
  total: number;
  accepted: number;
  partial: number;
  failed: number;
}) {
  return (
    <aside data-problem-submissions-side>
      <section data-problem-submission-filter>
        <div data-problem-submission-side-head>
          <span><SlidersHorizontal size={17} />Lọc bài nộp</span>
        </div>
        <label>
          <small>Trạng thái</small>
          <select value={status} onChange={(event) => onStatus(event.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <small><CodeXml size={14} />Ngôn ngữ</small>
          <select value={language} onChange={(event) => onLanguage(event.target.value)}>
            <option value="all">Tất cả ngôn ngữ</option>
            {languages.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <button type="button">Tìm</button>
      </section>

      <section data-problem-submission-stats>
        <div data-problem-submission-side-head>
          <span>Thống kê</span>
          <ChartPie size={17} />
        </div>
        <SubmissionPie total={total} accepted={accepted} partial={partial} failed={failed} />
        <p>Tổng: {total}</p>
      </section>
    </aside>
  );
}

function SubmissionPie({ total, accepted, partial, failed }: { total: number; accepted: number; partial: number; failed: number }) {
  if (!total) {
    return <div data-submission-empty-pie>0</div>;
  }
  const parts = [
    { value: accepted, color: '#43a047' },
    { value: failed, color: '#e24a2f' },
    { value: partial, color: '#f9aa35' },
  ].filter((item) => item.value > 0);
  let offset = 25;
  return (
    <svg viewBox="0 0 42 42" data-submission-pie role="img" aria-label="Thống kê bài nộp">
      <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#e2e8f0" strokeWidth="8" />
      {parts.map((part) => {
        const dash = (part.value / total) * 100;
        const circle = <circle key={part.color} cx="21" cy="21" r="15.915" fill="transparent" stroke={part.color} strokeWidth="8" strokeDasharray={`${dash} ${100 - dash}`} strokeDashoffset={offset} />;
        offset -= dash;
        return circle;
      })}
    </svg>
  );
}

type SubmissionDetail = Submission & {
  problemId?: number;
  contestId?: number | null;
  code?: string | null;
  canViewSource?: boolean;
  judgeLog?: string | null;
  testCases?: Array<Record<string, unknown>>;
  testcaseCount?: number;
  canViewTestDetails?: boolean;
  visibleTestcaseScope?: string;
  maxTestcasesShown?: number | null;
  sampleOnly?: boolean;
  customRun?: boolean;
  resultHidden?: boolean;
};

function submitLanguageLabel(code: string, languages: JudgeLanguage[] = fallbackJudgeLanguages) {
  return languages.find((item) => item.code === code)?.label || code.toUpperCase();
}

function submitLanguageFamily(code: string) {
  const normalized = String(code || '').toLowerCase();
  if (normalized.startsWith('python')) return 'python';
  if (normalized.startsWith('java')) return 'java';
  if (normalized === 'javascript' || normalized.includes('js')) return 'javascript';
  if (normalized.includes('csharp') || normalized === 'cs') return 'csharp';
  if (normalized.includes('cpp') || normalized.includes('c++') || normalized === 'c') return 'cpp';
  return 'default';
}

function defaultCodeForLanguage(language: string, languages: JudgeLanguage[] = fallbackJudgeLanguages) {
  const configured = languages.find((item) => item.code === language)?.sourceTemplate;
  if (configured) return configured;
  if (language.startsWith('python')) return 'import sys\n\n\ndef solve():\n    data = sys.stdin.read().strip().split()\n    # TODO: implement solution\n\n\nif __name__ == "__main__":\n    solve()\n';
  if (language.startsWith('java')) return 'import java.io.*;\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        FastScanner fs = new FastScanner(System.in);\n        // TODO: implement solution\n    }\n\n    static class FastScanner {\n        private final InputStream in;\n        private final byte[] buffer = new byte[1 << 16];\n        private int ptr = 0, len = 0;\n        FastScanner(InputStream is) { in = is; }\n        int read() throws IOException {\n            if (ptr >= len) { len = in.read(buffer); ptr = 0; if (len <= 0) return -1; }\n            return buffer[ptr++];\n        }\n    }\n}\n';
  if (language === 'javascript') return 'const fs = require("fs");\nconst input = fs.readFileSync(0, "utf8").trim();\n\nfunction solve() {\n  // TODO: implement solution\n}\n\nsolve();\n';
  return '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    return 0;\n}\n';
}

function mapSubmissionDetail(row: Record<string, unknown>): SubmissionDetail {
  const base = mapBackendSubmission(row);
  return {
    ...base,
    problemId: Number(row.problem_id ?? 0) || undefined,
    contestId: row.contest_id === null || row.contest_id === undefined ? null : Number(row.contest_id),
    code: typeof row.code === 'string' ? row.code : null,
    canViewSource: Boolean(row.can_view_source ?? row.canViewSource ?? row.code),
    judgeLog: typeof row.judge_log === 'string' ? row.judge_log : null,
    testCases: Array.isArray(row.testCases) ? row.testCases as Array<Record<string, unknown>> : [],
    testcaseCount: Number(row.testcase_count ?? row.testcaseCount ?? 0) || 0,
    canViewTestDetails: Boolean(row.can_view_test_details ?? row.canViewTestDetails),
    visibleTestcaseScope: String(row.visible_testcase_scope ?? row.visibleTestcaseScope ?? ''),
    maxTestcasesShown: row.max_testcases_shown === null || row.maxTestcasesShown === null
      ? null
      : Number(row.max_testcases_shown ?? row.maxTestcasesShown ?? 0) || 0,
    sampleOnly: Boolean(row.sample_only ?? row.sampleOnly),
    customRun: Boolean(row.custom_run ?? row.customRun),
    resultHidden: Boolean(row.result_hidden ?? row.resultHidden),
  };
}

const STRUCTURED_RESULTS_MARKER = '__OJ_PLATFORM_TEST_RESULTS__=';

function splitSubmissionJudgeLog(raw?: string | null) {
  const judgeLog = raw || '';
  const markerIndex = judgeLog.indexOf(STRUCTURED_RESULTS_MARKER);
  if (markerIndex >= 0) {
    const log = judgeLog.slice(0, markerIndex).trimEnd();
    const jsonText = judgeLog.slice(markerIndex + STRUCTURED_RESULTS_MARKER.length).trim();
    try {
      const parsed = JSON.parse(jsonText);
      return {
        log,
        results: Array.isArray(parsed) ? parsed.filter(isParsedTestResult).map(normalizeParsedTestResult) : [],
      };
    } catch {
      return { log, results: [] as ParsedTestResult[] };
    }
  }
  return { log: judgeLog, results: parseLegacyTestResults(judgeLog) };
}

function isParsedTestResult(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && Number.isFinite(Number((value as Record<string, unknown>).index)) && typeof (value as Record<string, unknown>).verdict === 'string');
}

function normalizeParsedTestResult(value: Record<string, unknown>): ParsedTestResult {
  const runtime = Number(value.runtime);
  const memory = Number(value.memory);
  const point = Number(value.point ?? value.score);
  const caseId = Number(value.caseId ?? value.case_id);
  const order = Number(value.order ?? value.order_idx);
  return {
    index: Math.max(1, Number(value.index) || 1),
    caseId: Number.isFinite(caseId) ? caseId : undefined,
    order: Number.isFinite(order) ? order : undefined,
    verdict: String(value.verdict || 'NOT_RUN').trim().toUpperCase() || 'NOT_RUN',
    runtime: Number.isFinite(runtime) ? runtime : undefined,
    memory: Number.isFinite(memory) ? memory : undefined,
    point: Number.isFinite(point) ? point : undefined,
    message: typeof value.message === 'string' ? value.message : undefined,
    input: typeof value.input === 'string' ? value.input : undefined,
    expected: typeof value.expected === 'string' ? value.expected : undefined,
    actual: typeof value.actual === 'string' ? value.actual : undefined,
    stderr: typeof value.stderr === 'string' ? value.stderr : undefined,
  };
}

function parseLegacyTestResults(log: string): ParsedTestResult[] {
  const accepted = log.match(/Accepted:\s*passed\s+(\d+)\/(\d+)\s+test cases/i);
  if (accepted) {
    const total = Number(accepted[2]) || 0;
    return Array.from({ length: total }, (_, index) => ({ index: index + 1, verdict: 'AC', message: 'Accepted' }));
  }
  const results: ParsedTestResult[] = [];
  for (const match of log.matchAll(/Test\s+(\d+):\s*([^\n]+)/gi)) {
    const message = match[2] || '';
    const lower = message.toLowerCase();
    const verdict = lower.includes('time limit')
      ? 'TLE'
      : lower.includes('runtime')
        ? 'RE'
        : lower.includes('accepted') || lower.includes(' ac')
          ? 'AC'
          : 'WA';
    results.push({ index: Number(match[1]), verdict, message });
  }
  return results;
}

function testcaseRowsForSubmission(detail: SubmissionDetail): ParsedTestResult[] {
  const parsed = splitSubmissionJudgeLog(detail.judgeLog).results;
  const count = Number(detail.testcaseCount || 0);
  const cap = Number(detail.maxTestcasesShown || count || parsed.length) || parsed.length;
  const visibleCount = Math.max(parsed.length, count ? Math.min(count, cap || count) : 0);
  if (parsed.length > 0) {
    const byIndex = new Map(parsed.map((item) => [item.index, item]));
    return Array.from({ length: visibleCount }, (_, index) => {
      const testcaseIndex = index + 1;
      return byIndex.get(testcaseIndex) || {
        index: testcaseIndex,
        verdict: isFinalVerdict(detail.verdict) ? 'HIDDEN' : 'PENDING',
        message: isFinalVerdict(detail.verdict) ? 'Status hidden' : 'Waiting for judge progress',
      };
    }).sort((a, b) => a.index - b.index);
  }
  const tests = Array.isArray(detail.testCases) ? detail.testCases : [];
  if (tests.length > 0) {
    const mapped: ParsedTestResult[] = tests.map((test, index) => normalizeParsedTestResult({
      ...test,
      index: Number(test.index) || index + 1,
      case_id: test.case_id ?? test.caseId ?? test.id,
      verdict: String(test.verdict || test.status || 'NOT_RUN'),
      message: typeof test.message === 'string' && test.message.trim()
        ? test.message
        : String(test.is_sample ? 'Sample testcase' : `Test #${index + 1}`),
      expected: test.expected ?? test.output,
    }));
    if (count > mapped.length && !isFinalVerdict(detail.verdict)) {
      for (let index = mapped.length; index < Math.min(count, cap || count); index += 1) {
        mapped.push({ index: index + 1, caseId: undefined, verdict: 'PENDING', runtime: undefined, memory: undefined, message: 'Waiting for judge progress', input: undefined, expected: undefined });
      }
    }
    return mapped;
  }
  if (!count) return [];
  return Array.from({ length: Math.min(count, Number(detail.maxTestcasesShown || count) || count) }, (_, index) => ({
    index: index + 1,
    verdict: detail.verdict && detail.verdict !== 'PENDING' ? 'HIDDEN' : 'NOT_RUN',
    message: detail.verdict && detail.verdict !== 'PENDING' ? 'Awaiting public testcase status' : 'Queued',
  }));
}

function isFinalVerdict(verdict?: string | null) {
  const normalized = String(verdict || '').toUpperCase();
  return ['AC', 'WA', 'TLE', 'MLE', 'RE', 'CE', 'PE', 'IE', 'CANCELED'].includes(normalized);
}

function verdictTone(verdict?: string | null, score?: unknown, maxScore?: unknown) {
  const normalized = String(verdict || 'PENDING').toUpperCase();
  const numericScore = Number(score ?? 0);
  const max = Number(maxScore ?? 100) || 100;
  if (normalized === 'AC' && numericScore >= max) return 'accepted';
  if (normalized === 'AC') return 'partial';
  if (normalized === 'WA') return 'wrong';
  if (normalized === 'RE' || normalized === 'RUNTIME_ERROR') return 'runtime';
  if (normalized === 'TLE') return 'tle';
  if (normalized === 'CE' || normalized === 'IE') return 'compile';
  return normalized === 'PENDING' || !normalized ? 'pending' : 'wrong';
}

function testcaseTone(verdict?: string | null) {
  const normalized = String(verdict || 'NOT_RUN').toUpperCase();
  if (normalized === 'AC') return 'accepted';
  if (normalized === 'WA') return 'wrong';
  if (normalized === 'RE' || normalized === 'RUNTIME_ERROR') return 'runtime';
  if (normalized === 'TLE') return 'tle';
  if (normalized === 'HIDDEN') return 'hidden';
  if (normalized === 'NOT_RUN' || normalized === 'PENDING') return 'pending';
  return 'wrong';
}

function testcaseScoreLabel(result: ParsedTestResult) {
  if (Number.isFinite(Number(result.point))) {
    const point = Number(result.point);
    return point <= 1 ? `${Math.round(point * 100)}% score` : `${Math.round(point)}% score`;
  }
  if (result.verdict === 'AC') return '100% score';
  if (result.verdict === 'NOT_RUN') return 'Pending';
  if (result.verdict === 'HIDDEN') return 'Status only';
  return '0% score';
}

function testcaseSummaryCounts(tests: ParsedTestResult[]) {
  return tests.reduce((counts, test) => {
    const tone = testcaseTone(test.verdict);
    counts[tone] = (counts[tone] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
}

function testcasePointTotal(tests: ParsedTestResult[], fallbackScore: number) {
  const pointValues = tests
    .map((test) => Number(test.point))
    .filter((value) => Number.isFinite(value));
  if (!pointValues.length) return fallbackScore;
  const total = pointValues.reduce((sum, value) => sum + value, 0);
  return total <= 1 ? total * 100 : total;
}

function formatTestcaseMemory(value?: number) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return 'Memory -';
  return `${value} MB`;
}

async function fetchSubmissionDetail(id: string | number, includePrivateTests = false) {
  const includeTests = includePrivateTests ? 'all' : 'summary';
  const adminContext = includePrivateTests && isLcojBackendMode() ? '&admin=true' : '';
  const path = `/submissions/${encodeURIComponent(String(id))}?includeTests=${includeTests}${adminContext}`;
  return mapSubmissionDetail(await cpproApiFetch<Record<string, unknown>>(path));
}

async function fetchProblemDetail(id: string | number) {
  const payload = await cpproApiFetch<Record<string, unknown>>(`/problems/${encodeURIComponent(String(id))}`);
  const row = payload.problem && typeof payload.problem === 'object'
    ? payload.problem as Record<string, unknown>
    : payload;
  return mapBackendProblem(row);
}

async function fetchUserProfile(id: string | number) {
  const payload = await cpproApiFetch<Record<string, unknown>>(`/users/${encodeURIComponent(String(id))}`, { timeoutMs: 8000 });
  const userRecord = payload.user && typeof payload.user === 'object'
    ? payload.user as Record<string, unknown>
    : payload;
  const stats = payload.stats && typeof payload.stats === 'object'
    ? payload.stats as Record<string, unknown>
    : {};
  const ratingTier = stats.rating_tier ?? userRecord.rating_tier ?? userRecord.rank_name;
  const enrichedRecord = {
    ...userRecord,
    score: stats.score ?? userRecord.score,
    solved: stats.solved ?? userRecord.solved,
    submissions: stats.submissions ?? userRecord.submissions,
    accepted: stats.accepted ?? userRecord.accepted,
    contests_attempted: stats.contests_attempted ?? userRecord.contests_attempted,
    contest_rating_times: stats.contest_rating_times ?? userRecord.contest_rating_times,
    rating: stats.rating ?? stats.contest_rating ?? userRecord.rating ?? userRecord.contest_rating,
    contest_rating: stats.contest_rating ?? userRecord.contest_rating,
    rank_name: ratingTier,
    rating_tier: ratingTier,
    rating_color: stats.rating_color ?? userRecord.rating_color,
    current_streak: stats.current_streak ?? userRecord.current_streak,
    longest_streak: stats.longest_streak ?? userRecord.longest_streak,
  };
  const mapped = mapBackendUser(enrichedRecord);
  const ratingHistory = normalizeProfileRatingHistory(payload.ratingHistory);
  const ratingValues = ratingHistory
    .map((item) => item.rating)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const recentSubmissions = rowsFromApi<Record<string, unknown>>(payload.recentSubmissions)
    .map((row) => mapBackendSubmission({ ...row, username: mapped.username, full_name: mapped.fullName }));
  const maxRating = Math.max(mapped.rating || 0, mapped.maxRating || 0, ...ratingValues);
  return {
    ...mapped,
    score: Number(stats.score ?? mapped.score) || mapped.score,
    solved: Number(stats.solved ?? mapped.solved) || mapped.solved,
    totalSubmissions: Number(stats.submissions ?? mapped.totalSubmissions ?? 0) || mapped.totalSubmissions,
    acceptedSubmissions: Number(stats.accepted ?? 0) || undefined,
    contestCount: Number(stats.contests_attempted ?? mapped.contestCount ?? 0) || mapped.contestCount,
    contestRatingTimes: Number(stats.contest_rating_times ?? mapped.contestRatingTimes ?? 0) || mapped.contestRatingTimes,
    accuracy: Number(stats.accuracy ?? 0) || undefined,
    contestScore: Number(stats.contest_score ?? 0) || undefined,
    virtualScore: Number(stats.virtual_score ?? 0) || undefined,
    maxRating: maxRating || mapped.maxRating,
    ratingHistory,
    activityHeatmap: normalizeProfileActivityHeatmap(payload.activityHeatmap),
    solvedTags: normalizeProfileSolvedTags(payload.solvedTags),
    solvedProblems: normalizeProfileProblemSummaries(payload.solvedProblems, true),
    unfinishedProblems: normalizeProfileProblemSummaries(payload.unfinishedProblems, false),
    recentSubmissions,
    badges: normalizeProfileBadges(payload.badges),
  };
}

async function fetchOrganizationDetail(id: string | number): Promise<OrganizationDetailPayload> {
  const payload = await cpproApiFetch<Record<string, unknown>>(`/organizations/${encodeURIComponent(String(id))}`, { timeoutMs: 8000 });
  const organizationRecord = payload.organization && typeof payload.organization === 'object'
    ? payload.organization as Record<string, unknown>
    : payload;
  return {
    organization: mapBackendOrganization(organizationRecord),
    canAccess: Boolean(payload.canAccess ?? payload.can_access),
    canManage: Boolean(payload.canManage ?? payload.can_manage),
    myJoinRequest: payload.myJoinRequest && typeof payload.myJoinRequest === 'object'
      ? payload.myJoinRequest as Record<string, unknown>
      : null,
    members: rowsFromApi<Record<string, unknown>>(payload.members).map(mapBackendOrganizationMember),
    problems: rowsFromApi<Record<string, unknown>>(payload.problems).map(mapBackendOrganizationProblem),
    contests: rowsFromApi<Record<string, unknown>>(payload.contests).map(mapBackendOrganizationContest),
  };
}

async function requestOrganizationJoin(id: string | number) {
  return cpproApiFetch<{ joined?: boolean; request?: Record<string, unknown>; member?: Record<string, unknown> }>(`/organizations/${encodeURIComponent(String(id))}/join`, {
    method: 'POST',
    body: JSON.stringify({ note: 'Requested from the CPPRO organization page.' }),
  });
}

async function updateCurrentProfileAvatar(avatarUrl: string | null) {
  return cpproApiFetch<AuthUser>('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify({ avatarUrl }),
  });
}

async function fetchProblemComments(id: string | number) {
  const payload = await cpproApiFetch<unknown>(`/problems/${encodeURIComponent(String(id))}/comments`);
  return rowsFromApi<Record<string, unknown>>(payload).map(mapBackendProblemComment);
}

async function createProblemComment(id: string | number, body: string, parentId?: string | number | null) {
  const numericParentId = parentId ? Number(parentId) : null;
  await cpproApiFetch(`/problems/${encodeURIComponent(String(id))}/comments`, {
    method: 'POST',
    body: JSON.stringify(numericParentId ? { body, parentId: numericParentId } : { body }),
  });
  return fetchProblemComments(id);
}

async function setProblemCommentReaction(id: string | number, commentId: string | number, reaction: string | null) {
  await cpproApiFetch(`/problems/${encodeURIComponent(String(id))}/comments/${encodeURIComponent(String(commentId))}/reaction`, {
    method: 'PUT',
    body: JSON.stringify({ reaction }),
  });
  return fetchProblemComments(id);
}

async function fetchProblemSubmissionStats(id: string | number): Promise<ProblemStatsSummary | null> {
  const payload = await cpproApiFetch<Record<string, unknown>>(`/problems/${encodeURIComponent(String(id))}/submissions?limit=1&withCount=true`, { timeoutMs: 8000 });
  const summary = payload.summary && typeof payload.summary === 'object'
    ? payload.summary as Record<string, unknown>
    : {};
  const total = Number(summary.total ?? payload.total ?? 0) || 0;
  const accepted = Number(summary.accepted ?? 0) || 0;
  const partial = Number(summary.partial ?? 0) || 0;
  const pending = Number(summary.pending ?? 0) || 0;
  const runtime = Number(summary.runtime_error ?? summary.re ?? 0) || 0;
  const tle = Number(summary.time_limit ?? summary.tle ?? 0) || 0;
  const wrong = Math.max(0, Number(summary.wrong_answer ?? summary.wrong ?? summary.failed ?? (total - accepted - partial - runtime - tle - pending)) || 0);
  return {
    total,
    accepted,
    partial,
    wrong,
    runtime,
    tle,
    pending,
    avgRuntime: Number(summary.avg_runtime ?? 0) || null,
    fastestRuntime: Number(summary.fastest_ac_runtime ?? summary.fastest_ac_max_runtime ?? 0) || null,
  };
}

function fallbackProblemShell(slug: string, title?: string): Problem {
  const normalizedSlug = normalizeSlug(slug, slug);
  return {
    id: 0,
    code: normalizedSlug,
    slug: normalizedSlug,
    title: title || normalizedSlug.replace(/[-_]+/g, ' '),
    difficulty: 'standard',
    score: 100,
    source: 'ITCoder',
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    accepted: 0,
    submissions: 0,
    solvers: 0,
    tags: [],
  };
}

function codeSizeLabel(code: string) {
  const bytes = new Blob([code]).size;
  if (bytes < 1024) return `${bytes.toLocaleString('vi-VN')} B / 256 KiB`;
  return `${(bytes / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} KiB / 256 KiB`;
}

function CodeEditorShell({
  code,
  onCode,
  language,
  languages,
  height = 460,
}: {
  code: string;
  onCode: (value: string) => void;
  language: string;
  languages: JudgeLanguage[];
  height?: number;
}) {
  const lineCount = Math.max(9, code.split('\n').length);
  const selectedLanguage = languages.find((item) => item.code === language);
  return (
    <div data-cppro-editor-shell data-language={submitLanguageFamily(language)} style={{ minHeight: height }}>
      <section data-cppro-monaco-frame data-language={submitLanguageFamily(language)} style={{ height }}>
        <div data-cppro-editor-toolbar>
          <span>{submitLanguageLabel(language, languages)}</span>
          <b>solution.{selectedLanguage?.extension || (language.startsWith('python') ? 'py' : language.startsWith('java') ? 'java' : language === 'javascript' ? 'js' : 'cpp')}</b>
        </div>
        <div data-cppro-editor-body>
          <div data-cppro-editor-gutter aria-hidden="true">
            {Array.from({ length: lineCount }, (_, index) => <span key={index}>{index + 1}</span>)}
          </div>
          <textarea
            aria-label="Editor content"
            value={code}
            onChange={(event) => onCode(event.target.value)}
            spellCheck={false}
          />
        </div>
      </section>
    </div>
  );
}

function ProblemSubmitPage({
  problem,
  problemSlug,
  data,
  go,
  currentUser,
  contestParam,
  resubmitId,
}: {
  problem?: Problem;
  problemSlug?: string;
  data: CpproData;
  go: (path: string) => void;
  currentUser: StoredCpproUser | null;
  contestParam?: string;
  resubmitId?: string;
}) {
  const [loadedProblem, setLoadedProblem] = useState<Problem | null>(null);
  const [loadingProblem, setLoadingProblem] = useState(Boolean(problemSlug && !problem));
  const [loadedSubmission, setLoadedSubmission] = useState<SubmissionDetail | null>(null);
  const [loadingSubmission, setLoadingSubmission] = useState(Boolean(resubmitId));
  const [language, setLanguage] = useState('cpp17');
  const [code, setCode] = useState(defaultCodeForLanguage('cpp17'));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<'submit' | null>(null);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [verificationChallenge, setVerificationChallenge] = useState<SubmissionVerificationChallenge | null>(null);
  const [verificationAnswer, setVerificationAnswer] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!resubmitId) return () => {
      cancelled = true;
    };
    setLoadingSubmission(true);
    fetchSubmissionDetail(resubmitId)
      .then((detail) => {
        if (cancelled) return;
        setLoadedSubmission(detail);
        setLanguage(detail.language || 'cpp17');
        setCode(detail.code || defaultCodeForLanguage(detail.language || 'cpp17'));
      })
      .catch((error) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Không tải được bài nộp cũ.');
      })
      .finally(() => {
        if (!cancelled) setLoadingSubmission(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resubmitId]);

  useEffect(() => {
    let cancelled = false;
    if (problem || !problemSlug) {
      setLoadedProblem(null);
      setLoadingProblem(false);
      return () => {
        cancelled = true;
      };
    }
    setLoadingProblem(true);
    fetchProblemDetail(problemSlug)
      .then((detail) => {
        if (!cancelled) setLoadedProblem(detail);
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadedProblem(null);
          setMessage(error instanceof Error ? error.message : 'Could not load this problem from the database yet.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProblem(false);
      });
    return () => {
      cancelled = true;
    };
  }, [problem, problemSlug]);

  const effectiveProblem = problem
    || loadedProblem
    || data.problems.find((item) => String(item.id) === String(loadedSubmission?.problemId))
    || (loadedSubmission ? data.problems.find((item) => item.title === loadedSubmission.problemTitle || item.slug === loadedSubmission.problemSlug) : undefined)
    || (problemSlug ? fallbackProblemShell(problemSlug) : undefined)
    || (resubmitId ? fallbackProblemShell(`submission-${resubmitId}`, loadedSubmission?.problemTitle || `Submission #${resubmitId}`) : undefined);
  const activeContest = effectiveProblem ? activeJoinedContest(data.contests) : null;
  const locked = effectiveProblem && activeContest ? problemBelongsToContest(effectiveProblem, activeContest) === false : false;
  const selectedContest = contestParam || (loadedSubmission?.contestId ? String(loadedSubmission.contestId) : undefined);
  const canSubmit = Boolean(effectiveProblem?.id && !locked && code.trim());
  const configuredLanguages = effectiveProblem?.allowedLanguages?.length
    ? new Set(effectiveProblem.allowedLanguages)
    : null;
  const availableLanguages = data.judgeLanguages.filter((item) => !configuredLanguages || configuredLanguages.has(item.code));
  const effectiveLanguages = availableLanguages.length ? availableLanguages : data.judgeLanguages;

  useEffect(() => {
    if (!effectiveLanguages.length || effectiveLanguages.some((item) => item.code === language)) return;
    const nextLanguage = effectiveLanguages[0].code;
    setLanguage(nextLanguage);
    setCode(defaultCodeForLanguage(nextLanguage, effectiveLanguages));
  }, [effectiveLanguages.map((item) => item.code).join('|'), language]);

  const updateLanguage = (nextLanguage: string) => {
    setLanguage(nextLanguage);
    if (!code.trim() || data.judgeLanguages.some((item) => code === defaultCodeForLanguage(item.code, data.judgeLanguages))) {
      setCode(defaultCodeForLanguage(nextLanguage, effectiveLanguages));
    }
  };

  const readSourceFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCode(text);
    setMessage(`Đã nạp ${file.name}.`);
  };

  const loadVerificationChallenge = async () => {
    setVerificationLoading(true);
    setVerificationAnswer('');
    try {
      const challenge = await cpproApiFetch<SubmissionVerificationChallenge>('/submissions/verification-challenge', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setVerificationChallenge(challenge);
      setMessage('');
    } catch (error) {
      setVerificationChallenge(null);
      setMessage(error instanceof Error ? error.message : 'Không thể tạo phép tính xác thực.');
    } finally {
      setVerificationLoading(false);
    }
  };

  const openSubmitVerification = () => {
    if (!currentUser) {
      go(authPathWithReturn('login'));
      return;
    }
    if (!effectiveProblem?.id || locked) return;
    setVerificationOpen(true);
    void loadVerificationChallenge();
  };

  const submit = async () => {
    if (!currentUser || !effectiveProblem?.id || locked || !verificationChallenge) return;
    const numericAnswer = Number(verificationAnswer);
    if (!Number.isInteger(numericAnswer)) {
      setMessage('Vui lòng nhập đáp án phép tính.');
      return;
    }
    setMessage('');
    setBusy('submit');
    try {
      const payload: Record<string, unknown> = {
        problemId: effectiveProblem.id,
        language,
        code,
        verificationChallengeId: verificationChallenge.challengeId,
        verificationAnswer: numericAnswer,
      };
      if (selectedContest) payload.contestId = selectedContest;
      const result = await cpproApiFetch<Record<string, any>>('/submissions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const id = Number(result.submission?.id ?? result.id ?? result.submission_id ?? 0);
      setMessage('Đã nộp bài, đang chuyển sang trang kết quả.');
      setVerificationOpen(false);
      setVerificationChallenge(null);
      setVerificationAnswer('');
      if (id) go(`/submissions/${id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể gửi bài.');
      await loadVerificationChallenge();
    } finally {
      setBusy(null);
    }
  };

  if (loadingSubmission) return <DataLoadingPanel label="Đang tải bài nộp cũ" rows={4} />;
  if (loadingProblem) return <DataLoadingPanel label="Đang tải dữ liệu bài tập" rows={5} />;
  if (!effectiveProblem) return <Empty title={resubmitId ? 'Không tìm thấy bài để nộp lại' : 'Không tìm thấy bài tập'} />;
  if (locked && activeContest) return <ContestScopeGuard contest={activeContest} problem={effectiveProblem} go={go} />;

  const title = resubmitId ? 'Nộp lại bài' : 'Nộp bài giải';
  const backHref = resubmitId ? `/submissions/${resubmitId}` : `/problems/${effectiveProblem.slug}`;

  return (
    <div data-cppro-submit-page>
      <section data-cppro-submit-card data-language={submitLanguageFamily(language)}>
        <header data-cppro-submit-head>
          <div>
            <h1>{title} <a href={`/problems/${effectiveProblem.slug}`} onClick={(event) => openInternalLink(event, go, `/problems/${effectiveProblem.slug}`)}>{effectiveProblem.title}</a></h1>
            <p>{resubmitId ? 'Chỉnh sửa source code hoặc upload file mới.' : 'Viết lời giải và nộp bài để chấm.'}</p>
          </div>
          <button type="button" onClick={() => go(backHref)}>Quay lại</button>
        </header>
        <div data-cppro-submit-toolbar>
          <span>{resubmitId ? `Nguồn từ submission #${resubmitId}` : 'Chỉnh sửa source code hoặc upload file mới:'}</span>
          <button type="button" onClick={() => fileInputRef.current?.click()}><FileText size={15} /> Chọn file</button>
          <input ref={fileInputRef} hidden type="file" accept=".cpp,.cc,.cxx,.py,.java,.js,.txt" onChange={(event) => void readSourceFile(event)} />
        </div>
        <CodeEditorShell code={code} onCode={setCode} language={language} languages={effectiveLanguages} height={resubmitId ? 600 : 460} />
        <footer data-cppro-submit-foot>
          <label>
            <span>Ngôn ngữ</span>
            <select value={language} onChange={(event) => updateLanguage(event.target.value)}>
              {effectiveLanguages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
            </select>
          </label>
          <span data-cppro-code-size>{codeSizeLabel(code)}</span>
          {!effectiveProblem.id ? <b data-cppro-submit-message>Editor đã sẵn sàng. Đang chờ dữ liệu bài tập từ database để gửi bài.</b> : null}
          {message ? <b data-cppro-submit-message>{message}</b> : null}
          <span data-cppro-cloudflare-state><ShieldCheck size={15} /> Bảo vệ hàng đợi</span>
          <button type="button" data-cppro-send-button disabled={Boolean(busy) || !canSubmit} onClick={openSubmitVerification}><Send size={16} />{busy === 'submit' ? 'Đang nộp...' : resubmitId ? 'Nộp lại!' : 'Nộp bài'}</button>
        </footer>
      </section>
      {verificationOpen ? (
        <BodyPortal>
          <div
            data-submit-verification-overlay
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !busy) setVerificationOpen(false);
            }}
          >
          <section role="dialog" aria-modal="true" aria-labelledby="submit-verification-title" data-submit-verification-dialog>
            <header>
              <span><ShieldCheck size={20} /></span>
              <div>
                <h2 id="submit-verification-title">Xác thực trước khi nộp</h2>
                <p>Giải phép tính trong phạm vi 30. Mỗi phép tính chỉ dùng một lần.</p>
              </div>
              <button type="button" aria-label="Đóng" disabled={Boolean(busy)} onClick={() => setVerificationOpen(false)}><X size={17} /></button>
            </header>
            <div data-submit-verification-body>
              <strong>{verificationLoading ? 'Đang tạo phép tính...' : verificationChallenge?.prompt || 'Không thể tạo phép tính.'}</strong>
              <input
                type="number"
                min={0}
                max={30}
                inputMode="numeric"
                autoFocus
                value={verificationAnswer}
                aria-label="Đáp án xác thực"
                placeholder="Nhập đáp án"
                disabled={verificationLoading || !verificationChallenge || Boolean(busy)}
                onChange={(event) => setVerificationAnswer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && verificationChallenge && verificationAnswer.trim()) void submit();
                }}
              />
            </div>
            <footer>
              <button type="button" data-verification-refresh disabled={verificationLoading || Boolean(busy)} onClick={() => void loadVerificationChallenge()}>
                Phép tính khác
              </button>
              <button type="button" data-verification-confirm disabled={!verificationChallenge || !verificationAnswer.trim() || Boolean(busy)} onClick={() => void submit()}>
                <Send size={16} />
                {busy ? 'Đang nộp...' : 'Xác nhận và nộp bài'}
              </button>
            </footer>
          </section>
          </div>
        </BodyPortal>
      ) : null}
    </div>
  );
}

function SubmissionDetailPage({ id, data, go, currentUser }: { id: string; data: CpproData; go: (path: string) => void; currentUser: StoredCpproUser | null }) {
  const [detail, setDetail] = useState<SubmissionDetail | null>(() => {
    const fallback = data.submissions.find((item) => String(item.id) === String(id));
    return fallback ? { ...fallback, canViewSource: false } : null;
  });
  const [loading, setLoading] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [error, setError] = useState('');
  const canViewTestcaseDetails = isCpproAdminUser(currentUser);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    const load = (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      fetchSubmissionDetail(id, canViewTestcaseDetails)
        .then((nextDetail) => {
          if (cancelled) return;
          setDetail(nextDetail);
          setError('');
          if (nextDetail.canViewSource || nextDetail.code) setShowCode(true);
          if (!isFinalVerdict(nextDetail.verdict) || testcaseRowsForSubmission(nextDetail).length > 0) setResultsOpen(true);
          if (!isFinalVerdict(nextDetail.verdict) && timer === null) {
            timer = window.setInterval(() => load(false), 1400);
          }
          if (isFinalVerdict(nextDetail.verdict) && timer !== null) {
            window.clearInterval(timer);
            timer = null;
          }
        })
        .catch((nextError) => {
          if (!cancelled) setError(nextError instanceof Error ? nextError.message : 'Không tải được bài nộp.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load(true);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
    };
  }, [id, canViewTestcaseDetails]);

  useEffect(() => {
    if (detail && !isFinalVerdict(detail.verdict)) setResultsOpen(true);
  }, [detail?.verdict]);

  const problem = data.problems.find((item) => String(item.id) === String(detail?.problemId) || item.title === detail?.problemTitle || item.slug === detail?.problemSlug);
  const code = detail?.code || '';
  const copyCode = async () => {
    if (!code) return;
    const ok = await copyTextToClipboard(code);
    setCopied(ok);
    setCopyFailed(!ok);
    if (!ok) setError('Could not copy the source code in this browser.');
    else window.setTimeout(() => {
      setCopied(false);
      setCopyFailed(false);
    }, 1400);
  };

  if (!detail && loading) return <DataLoadingPanel label="Đang tải bài nộp" rows={5} />;
  if (!detail) return <Empty title={error || 'Không tìm thấy bài nộp'} />;

  const verdict = String(detail.verdict || 'PENDING').toUpperCase();
  const displayVerdict = verdict === 'AC' && Number(detail.score || 0) < Number(detail.maxScore || 100)
    ? 'PARTIAL'
    : verdict;
  const tone = verdictTone(verdict, detail.score, detail.maxScore);
  const tests = testcaseRowsForSubmission(detail);
  const totalTests = Math.max(Number(detail.testcaseCount || 0), tests.length);
  const finishedTests = tests.filter((test) => !['NOT_RUN', 'PENDING', 'HIDDEN'].includes(test.verdict)).length;
  const testcaseCounts = testcaseSummaryCounts(tests);
  const testcasePoint = testcasePointTotal(tests, Number(detail.score || 0));
  const lcojLegacyRoutes = shouldUseLcojLegacyRoutes();
  const resubmitProblemKey = problem?.slug || detail.problemSlug || detail.problemId || '';
  const resubmitHref = lcojLegacyRoutes && resubmitProblemKey
    ? lcojProblemPath(resubmitProblemKey, `/resubmit/${encodeURIComponent(String(detail.id))}`)
    : `/submission/${detail.id}/resubmit`;

  return (
    <div data-submission-detail-page>
      <section data-submission-detail-card data-verdict-tone={tone}>
        <header data-submission-detail-head>
          <div>
            <h1>Submission #{detail.id} <span className={tone}>{displayVerdict}</span></h1>
            <p>{formatSubmissionRuntime(detail.timeMs)} total · {formatSubmissionMemory(detail.memoryKb)} · {Number(detail.score || 0).toFixed(0)}/{Number(detail.maxScore || 100).toFixed(0)} · {finishedTests}/{totalTests || 0} testcase</p>
          </div>
          <div data-submission-detail-actions>
            <button type="button" onClick={() => setShowCode((value) => !value)}><CodeXml size={16} />Xem code</button>
            <button type="button" onClick={() => lcojLegacyRoutes ? openLcojLegacyPath(resubmitHref) : go(resubmitHref)}><Send size={16} />Nộp lại</button>
          </div>
        </header>
        <div data-submission-detail-meta>
          <span><User size={15} />{detail.username}</span>
          <span><CodeXml size={15} />{submitLanguageLabel(detail.language, data.judgeLanguages)}</span>
          <span><Clock size={15} />{formatDate(detail.submittedAt)}</span>
          {problem ? <button type="button" onClick={() => go(`/problems/${problem.slug}`)}>{problem.title}</button> : <span>{detail.problemTitle}</span>}
        </div>
        <div data-submission-summary-strip>
          <span data-summary-tone={tone}>
            <strong>{Number(detail.score || 0).toFixed(0)} / {Number(detail.maxScore || 100).toFixed(0)}</strong>
            <small>Điểm của máy chấm</small>
          </span>
          <span>
            <strong>{finishedTests}/{totalTests || 0}</strong>
            <small>Testcase hiển thị</small>
          </span>
          <span>
            <strong>{formatSubmissionRuntime(detail.timeMs)}</strong>
            <small>Runtime</small>
          </span>
          <span>
            <strong>{formatSubmissionMemory(detail.memoryKb)}</strong>
            <small>Bộ nhớ</small>
          </span>
          {detail.sampleOnly ? <em>Đang hiển thị test mẫu</em> : null}
          {detail.resultHidden ? <em>Kết quả đang được ẩn do freeze</em> : null}
          {detail.customRun ? <em>Chạy thử</em> : null}
        </div>
        {showCode ? (
          <section data-submission-code-panel>
            <header>
              <strong>Source code</strong>
              <button type="button" disabled={!code} onClick={() => void copyCode()}><Copy size={15} />{copied ? 'Đã copy' : copyFailed ? 'Copy failed' : 'Copy'}</button>
            </header>
            {code ? <pre>{code}</pre> : <p>Source code chỉ hiển thị khi bạn có quyền xem.</p>}
          </section>
        ) : null}
        <section data-submission-result-panel>
          <button
            type="button"
            data-submission-result-head
            aria-expanded={resultsOpen}
            aria-controls="submission-testcase-details"
            onClick={() => setResultsOpen((value) => !value)}
          >
            <span>
              <ListChecks size={20} />
              <h2>Điểm của máy chấm</h2>
            </span>
            <span data-submission-result-toggle>
              <b data-submission-live-state={isFinalVerdict(verdict) ? 'done' : 'running'}>
                {isFinalVerdict(verdict) ? 'Đã chấm xong' : 'Đang chấm realtime'}
              </b>
              <ChevronDown size={18} aria-hidden="true" />
            </span>
          </button>
          {resultsOpen ? (
            <div id="submission-testcase-details" data-submission-result-details>
              <div data-submission-result-grid>
                {tests.length ? tests.map((test, index) => (
                  <article key={String(test.caseId || test.index || index)} data-testcase-tone={testcaseTone(test.verdict)} data-testcase-detail>
                    <span>{test.index || index + 1}</span>
                    <div data-testcase-main>
                      <strong>{test.verdict === 'HIDDEN' ? 'Status pending' : test.verdict}</strong>
                      <small>{test.message || `Test #${test.index || index + 1}`}</small>
                      {canViewTestcaseDetails && (test.input || test.expected || test.actual || test.stderr) ? (
                        <details data-testcase-pasted>
                          <summary>Chi tiết testcase</summary>
                          {test.input ? <pre><b>Input</b>{test.input}</pre> : null}
                          {test.expected ? <pre><b>Expected</b>{test.expected}</pre> : null}
                          {test.actual ? <pre><b>Actual</b>{test.actual}</pre> : null}
                          {test.stderr ? <pre><b>Stderr</b>{test.stderr}</pre> : null}
                        </details>
                      ) : null}
                    </div>
                    <em>{testcaseScoreLabel(test)}</em>
                    <small>{typeof test.runtime === 'number' ? formatSubmissionRuntime(test.runtime) : 'Runtime -'} · {formatTestcaseMemory(test.memory)}</small>
                  </article>
                )) : (
                  <article>
                    <span>{detail.testcaseCount || 0}</span>
                    <div>
                      <strong>{detail.judgeLog || 'Đang chờ dữ liệu testcase'}</strong>
                      <small>{loading ? <InlineLoadingText label="Đang tải testcase" /> : 'Judge chưa gửi testcase progress.'}</small>
                    </div>
                  </article>
                )}
              </div>
              <section data-submission-score-summary>
                <div>
                  <span data-summary-tone={tone}>{displayVerdict}</span>
                  <strong>{Math.round(testcasePoint)} / {Number(detail.maxScore || 100).toFixed(0)}</strong>
                  <small>Tổng kết điểm realtime từ {tests.length.toLocaleString('vi-VN')} testcase</small>
                </div>
                <ul>
                  {[
                    ['accepted', 'AC', testcaseCounts.accepted || 0],
                    ['wrong', 'WA', testcaseCounts.wrong || 0],
                    ['runtime', 'RE', testcaseCounts.runtime || 0],
                    ['tle', 'TLE', testcaseCounts.tle || 0],
                    ['pending', isFinalVerdict(verdict) ? 'Ẩn' : 'Chờ', (testcaseCounts.pending || 0) + (testcaseCounts.hidden || 0)],
                  ].map(([summaryTone, label, value]) => (
                    <li key={String(label)} data-testcase-tone={String(summaryTone)}>
                      <b>{String(label)}</b>
                      <span>{Number(value).toLocaleString('vi-VN')}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : null}
        </section>
      </section>
    </div>
  );
}

function formatSubmissionRuntime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0,00 ms';
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} s`;
  }
  return `${value.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ms`;
}

function formatSubmissionMemory(value: number) {
  if (!value) return '0 MB';
  return `${(value / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} MB`;
}

function ContestsPage({ data, go, loading = false }: { data: CpproData; go: (path: string) => void; loading?: boolean }) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'public' | 'course' | 'private'>('all');
  const [runningPage, setRunningPage] = useState(1);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [endedPage, setEndedPage] = useState(1);
  const now = Date.now();
  const contests = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.contests
      .filter((contest) => {
        const haystack = `${contest.title} ${contest.scope || ''} ${contest.accessType || ''} ${contest.format || ''}`.toLowerCase();
        const matchesQuery = !q || haystack.includes(q);
        const matchesScope = scope === 'all'
          || (scope === 'public' && (contest.scope === 'public' || contest.accessType === 'open'))
          || (scope === 'course' && (contest.scope === 'course' || contest.accessType === 'course'))
          || (scope === 'private' && (contest.scope === 'private' || contest.accessType === 'private'));
        return matchesQuery && matchesScope;
      })
      .sort((a, b) => new Date(a.endTime || a.startTime || 0).getTime() - new Date(b.endTime || b.startTime || 0).getTime());
  }, [data.contests, query, scope]);
  const running = contests.filter((contest) => new Date(contest.startTime || 0).getTime() <= now && new Date(contest.endTime || '').getTime() >= now);
  const upcoming = contests.filter((contest) => new Date(contest.startTime || 0).getTime() > now);
  const ended = contests
    .filter((contest) => new Date(contest.endTime || '').getTime() < now)
    .sort((a, b) => new Date(b.endTime || b.startTime || 0).getTime() - new Date(a.endTime || a.startTime || 0).getTime());

  useEffect(() => {
    setRunningPage(1);
    setUpcomingPage(1);
    setEndedPage(1);
  }, [query, scope]);

  return (
    <div className="stack contests-page">
      <PageTitle
        icon={<Trophy />}
        title="Các kỳ thi"
        subtitle={`${running.length} đang diễn ra · ${upcoming.length} sắp tới · ${ended.length} đã qua`}
        right={(
          <div className="contest-toolbar">
            <div className="contest-filter-pills" aria-label="Lọc kỳ thi">
              {[
                ['all', 'Tất cả', <CircleUserRound size={14} />],
                ['public', 'Public', <Search size={14} />],
                ['course', 'Khóa học', <BookOpen size={14} />],
                ['private', 'Riêng tư', <CircleUserRound size={14} />],
              ].map(([nextScope, label, icon]) => (
                <button
                  key={String(nextScope)}
                  className={scope === nextScope ? 'active' : ''}
                  type="button"
                  onClick={() => setScope(nextScope as typeof scope)}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
            <label className="search-box small">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kỳ thi..." />
            </label>
          </div>
        )}
      />
      {loading && data.contests.length === 0 ? <DataLoadingPanel label="Đang tải danh sách kỳ thi" rows={5} /> : null}
      <ContestSection title="Các kỳ thi đang diễn ra" contests={running} go={go} page={runningPage} onPage={setRunningPage} paginated />
      <ContestSection title="Các kỳ thi sắp tới" contests={upcoming} go={go} page={upcomingPage} onPage={setUpcomingPage} paginated />
      <ContestSection title="Các kỳ thi đã qua" contests={ended} go={go} page={endedPage} onPage={setEndedPage} paginated />
    </div>
  );
}

function contestProblemRows(contest: Contest, data: CpproData) {
  const detailProblems = Array.isArray(contest.problems) ? [...contest.problems] : [];
  if (detailProblems.length) {
    return detailProblems
      .sort((a, b) => (a.order_index ?? a.order_idx ?? 0) - (b.order_index ?? b.order_idx ?? 0))
      .map((problem, index) => ({
        key: problem.problem_slug_snapshot || problem.external_id || problem.problem_code || String(problem.id || `${contest.slug}-${index}`),
        slug: problem.problem_slug_snapshot || problem.external_id || problem.problem_code || String(problem.id || ''),
        title: problem.problem_title_snapshot || problem.title || problem.problem_code || `Bài ${index + 1}`,
        score: Number(problem.points ?? problem.rating_points ?? 0),
        difficulty: problem.difficulty_tag || problem.difficulty || '',
        timeLimitMs: problem.time_limit_ms_snapshot,
        memoryLimitMb: problem.memory_limit_mb_snapshot,
        status: problem.my_best_verdict || problem.my_status || (problem.user_solved ? 'AC' : 'none'),
      }));
  }

  const count = Math.max(4, contest.problemCount || 0);
  return data.problems.slice(0, count).map((problem) => ({
    key: problem.slug,
    slug: problem.slug,
    title: problem.title,
    score: problem.score,
    difficulty: problem.difficulty,
    timeLimitMs: problem.timeLimitMs,
    memoryLimitMb: problem.memoryLimitMb,
    status: 'none',
  }));
}

function contestDifficultyLabel(value?: string) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'easy') return 'Dễ';
  if (normalized === 'medium') return 'TB';
  if (normalized === 'hard_mid') return 'Khá';
  if (normalized === 'hard') return 'Khó';
  if (normalized === 'very_hard') return 'Rất khó';
  return value || 'VNOJ';
}

function contestTiming(contest: Contest) {
  const now = Date.now();
  const start = contest.startTime ? new Date(contest.startTime).getTime() : Number.NaN;
  const end = contest.endTime ? new Date(contest.endTime).getTime() : Number.NaN;
  const hasStart = Number.isFinite(start);
  const hasEnd = Number.isFinite(end);
  if (hasStart && now < start) {
    return { label: 'Kỳ thi sắp diễn ra', tone: 'upcoming', remainingMs: start - now, countdownLabel: 'BẮT ĐẦU SAU' };
  }
  if (hasEnd && now > end) {
    return { label: 'Kỳ thi đã kết thúc', tone: 'ended', remainingMs: 0, countdownLabel: 'ĐÃ KẾT THÚC' };
  }
  return { label: 'Kỳ thi đang diễn ra', tone: 'running', remainingMs: hasEnd ? Math.max(0, end - now) : 0, countdownLabel: 'CÒN LẠI' };
}

function formatContestCountdown(ms: number) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} ngày ${hours} giờ ${minutes} phút`;
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  return `${minutes} phút`;
}

function formatContestDuration(contest: Contest) {
  if (!contest.durationMinutes) return 'VNOJ';
  const hours = Math.round(contest.durationMinutes / 60);
  if (hours >= 24 && hours % 24 === 0) return `${hours / 24} ngày`;
  return `${hours} giờ`;
}

function formatContestPoints(value: number) {
  return Number(value || 0).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function contestTabFromPath(value?: string): ContestTabKey {
  const key = decodeURIComponent(String(value || '')).toLowerCase();
  if (key === 'announcements') return 'announcements';
  if (key === 'leaderboard' || key === 'standings') return 'leaderboard';
  if (key === 'join') return 'join';
  if (key === 'submissions') return 'submissions';
  return 'info';
}

function contestTabSegment(tab: ContestTabKey) {
  return tab === 'info' ? '' : `/${tab}`;
}

function OrganizationsPage({
  data,
  go,
  currentUser,
  organizationKey,
}: {
  data: CpproData;
  go: (path: string) => void;
  currentUser: StoredCpproUser | null;
  organizationKey?: string;
}) {
  const [query, setQuery] = useState('');
  const [visibility, setVisibility] = useState<'all' | 'public' | 'protected' | 'private'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [detailPayload, setDetailPayload] = useState<OrganizationDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinMessage, setJoinMessage] = useState('');
  const [joinState, setJoinState] = useState<'idle' | 'pending' | 'joined'>('idle');
  const decodedKey = decodeURIComponent(String(organizationKey || '')).toLowerCase();
  const selectedFromList = decodedKey
    ? data.organizations.find((item) => (
      item.slug.toLowerCase() === decodedKey
      || String(item.id).toLowerCase() === decodedKey
      || item.name.toLowerCase() === decodedKey
    ))
    : null;
  const selected = detailPayload?.organization || selectedFromList;

  useEffect(() => {
    let cancelled = false;
    if (!organizationKey) {
      setDetailPayload(null);
      setDetailError('');
      setDetailLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setDetailLoading(true);
    setDetailError('');
    fetchOrganizationDetail(organizationKey)
      .then((payload) => {
        if (!cancelled) setDetailPayload(payload);
      })
      .catch((error) => {
        if (!cancelled) {
          setDetailPayload(null);
          setDetailError(error instanceof Error ? error.message : 'Could not load organization detail from API.');
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationKey]);

  const filteredOrganizations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.organizations
      .filter((item) => {
        const haystack = `${item.name} ${item.slug} ${item.description || ''} ${item.visibility}`.toLowerCase();
        return (!needle || haystack.includes(needle)) && (visibility === 'all' || item.visibility === visibility);
      })
      .sort((left, right) => (
        right.totalRating - left.totalRating
        || right.memberCount - left.memberCount
        || left.name.localeCompare(right.name, 'vi', { sensitivity: 'base' })
      ));
  }, [data.organizations, query, visibility]);
  const totalPages = Math.max(1, Math.ceil(filteredOrganizations.length / pageSize));
  const pageOrganizations = filteredOrganizations.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const detailMembers = detailPayload?.members || (selected
    ? data.users
      .filter((user) => (
        String(user.organizationSlug || '').toLowerCase() === selected.slug.toLowerCase()
        || String(user.organizationName || '').toLowerCase() === selected.name.toLowerCase()
      ))
      .slice(0, 8)
      .map((user) => ({
        userId: 0,
        username: user.username,
        fullName: user.fullName || user.username,
        role: user.tags[0] || 'member',
        status: 'active',
      }))
    : []);
  const detailProblems = detailPayload?.problems || (selected
    ? data.problems
      .filter((problem) => String(problem.source || '').toLowerCase().includes(selected.name.toLowerCase()))
      .slice(0, 6)
      .map((problem) => ({
        id: problem.id,
        slug: problem.slug,
        title: problem.title,
        difficulty: problem.difficulty,
        visibility: 'public',
      }))
    : []);
  const detailContests = detailPayload?.contests || [];

  useEffect(() => {
    setCurrentPage(1);
  }, [query, visibility, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setJoinMessage('');
    setJoinState('idle');
    setJoinBusy(false);
  }, [organizationKey]);

  if (selected) {
    const currentUsername = String(currentUser?.username || '').toLowerCase();
    const currentMember = currentUsername
      ? detailMembers.find((member) => String(member.username || '').toLowerCase() === currentUsername)
      : undefined;
    const requestStatus = String(detailPayload?.myJoinRequest?.status || selected.myStatus || '').toLowerCase();
    const memberStatus = String(currentMember?.status || selected.myStatus || '').toLowerCase();
    const memberRole = String(currentMember?.role || selected.myRole || '').trim();
    const isMember = joinState === 'joined'
      || memberStatus === 'active'
      || (Boolean(memberRole) && requestStatus !== 'pending' && memberStatus !== 'pending');
    const isPending = joinState === 'pending' || requestStatus === 'pending' || memberStatus === 'pending';
    const joinButtonLabel = !currentUser
      ? 'Sign in to request access'
      : isMember
        ? 'Joined'
        : isPending
          ? 'Request pending'
          : selected.visibility === 'public'
            ? 'Join organization'
            : 'Request access';
    const handleJoinOrganization = async () => {
      if (!currentUser) {
        go('/login');
        return;
      }
      if (joinBusy || isMember || isPending) return;
      setJoinBusy(true);
      setJoinMessage('');
      try {
        const result = await requestOrganizationJoin(selected.slug || selected.id || organizationKey || '');
        const nextState = result.joined ? 'joined' : 'pending';
        setJoinState(nextState);
        setJoinMessage(result.joined ? 'Joined organization.' : 'Join request sent to organization admins.');
        try {
          setDetailPayload(await fetchOrganizationDetail(selected.slug || selected.id || organizationKey || ''));
        } catch {
          // Keep the optimistic state when refresh fails; the join request already succeeded.
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not request organization access.';
        if (message.toLowerCase().includes('already') && message.toLowerCase().includes('member')) {
          setJoinState('joined');
          setJoinMessage('You are already a member of this organization.');
        } else {
          setJoinMessage(message);
        }
      } finally {
        setJoinBusy(false);
      }
    };

    return (
      <div className="stack organizations-page" data-cppro-organizations-page data-organization-detail-source={detailPayload ? 'api' : 'cache'}>
        <PageTitle
          icon={<GraduationCap />}
          title={selected.name}
          subtitle={`${selected.memberCount.toLocaleString('vi-VN')} members - ${selected.problemCount.toLocaleString('vi-VN')} problems - ${selected.contestCount.toLocaleString('vi-VN')} contests`}
          right={<button className="soft-button" type="button" onClick={() => go('/organizations')}>All organizations</button>}
        />
        {detailError ? <div className="service-message">{detailError}</div> : null}
        <section className="organization-detail-hero">
          <div>
            <span className="home-chip"><ShieldCheck size={14} />{detailLoading ? 'Loading API' : detailPayload ? 'API loaded' : selected.visibility}</span>
            <h2>{selected.name}</h2>
            <p>{selected.description || 'This organization has not published a public description yet.'}</p>
            <div className="organization-action-row">
              <button className="blue-button" type="button" disabled={joinBusy || isMember || isPending} onClick={() => void handleJoinOrganization()}><Send size={15} /> {joinBusy ? 'Sending...' : joinButtonLabel}</button>
              <button className="soft-button" type="button" onClick={() => go('/contests')}><Trophy size={15} /> View contests</button>
            </div>
            {joinMessage ? <p className="service-message">{joinMessage}</p> : null}
          </div>
          <div className="organization-score-card">
            <strong>{selected.totalRating.toLocaleString('vi-VN')}</strong>
            <span>Total rating</span>
            <small>{detailPayload?.canManage ? 'You can manage this organization' : selected.myRole ? `Your role: ${selected.myRole}` : currentUser ? 'Signed in' : 'Guest view'}</small>
          </div>
        </section>
        <section className="organization-api-summary">
          <span><strong>{detailMembers.length.toLocaleString('vi-VN')}</strong><small>API members</small></span>
          <span><strong>{detailProblems.length.toLocaleString('vi-VN')}</strong><small>API problems</small></span>
          <span><strong>{detailContests.length.toLocaleString('vi-VN')}</strong><small>API contests</small></span>
          <span><strong>{detailPayload?.canAccess ? 'Yes' : 'No'}</strong><small>Access</small></span>
        </section>
        <div className="organization-detail-grid">
          <ServicePanel title="Members" icon={<UsersRound size={18} />}>
            {detailMembers.length ? detailMembers.map((member) => {
              const memberUser: UserRow = { username: member.username, fullName: member.fullName, rating: 0, score: 0, solved: 0, streak: 0, maxStreak: 0, rankName: member.role, tags: [member.role], proTier: '' };
              return (
              <button key={`${member.username}-${member.role}`} className="organization-member-row" type="button" onClick={() => go(`/users/${member.username}`)}>
                <Avatar user={memberUser} />
                <span>
                  <strong>{member.fullName || member.username}</strong>
                  <small>@{member.username} - {member.role} - {member.status}</small>
                </span>
                <em data-streak-tone="warm">{member.role}</em>
              </button>
              );
            }) : <div className="service-empty">No public members are available yet.</div>}
          </ServicePanel>
          <ServicePanel title="Problems" icon={<Code2 size={18} />}>
            {detailProblems.length ? detailProblems.map((problem) => (
              <button key={problem.slug} className="service-feed-row" type="button" onClick={() => go(`/problems/${problem.slug}`)}>
                <span className="service-mini-icon"><Code2 size={15} /></span>
                <span>
                  <strong>{problem.title}</strong>
                  <small>{problem.difficulty} - {problem.visibility}</small>
                </span>
              </button>
            )) : <div className="service-empty">No public problems are linked to this organization yet.</div>}
          </ServicePanel>
          <ServicePanel title="Contests" icon={<Trophy size={18} />}>
            {detailContests.length ? detailContests.map((contest) => (
              <button key={contest.slug} className="service-feed-row" type="button" onClick={() => go(`/contests/${contest.slug}`)}>
                <span className="service-mini-icon"><Trophy size={15} /></span>
                <span>
                  <strong>{contest.title}</strong>
                  <small>{contest.status} - {contest.visibility}</small>
                </span>
              </button>
            )) : <div className="service-empty">No public contests are linked to this organization yet.</div>}
          </ServicePanel>
        </div>
      </div>
    );
  }

  return (
    <div className="stack organizations-page" data-cppro-organizations-page>
      <PageTitle
        icon={<GraduationCap />}
        title="Organizations"
        subtitle={`${data.organizations.length.toLocaleString('vi-VN')} organizations from database`}
        right={(
          <label className="search-box small">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search organizations..." />
          </label>
        )}
      />
      <div className="contest-filter-pills organizations-filter" aria-label="Filter organizations">
        {(['all', 'public', 'protected', 'private'] as const).map((item) => (
          <button key={item} className={visibility === item ? 'active' : ''} type="button" onClick={() => setVisibility(item)}>
            {item === 'all' ? <Globe size={14} /> : item === 'private' ? <Lock size={14} /> : <ShieldCheck size={14} />}
            {item}
          </button>
        ))}
      </div>
      <div data-organizations-pagination>
        <Pagination page={currentPage} totalPages={totalPages} onPage={setCurrentPage} totalItems={filteredOrganizations.length} pageSize={pageSize} onPageSizeChange={(value) => { setPageSize(value); setCurrentPage(1); }} pageSizeOptions={[6, 9, 12, 24, 48]} />
      </div>
      <section className="organizations-grid">
        {pageOrganizations.length ? pageOrganizations.map((organization) => (
          <article key={organization.id} className="organization-card">
            <button type="button" onClick={() => go(`/organizations/${organization.slug}`)} aria-label={`Open ${organization.name}`}>
              <span className="organization-mark"><GraduationCap size={22} /></span>
              <span>
                <strong>{organization.name}</strong>
                <small>/{organization.slug}</small>
              </span>
              <ChevronRight size={18} />
            </button>
            <p>{organization.description || 'No public description yet.'}</p>
            <div className="organization-card-stats">
              <span><UsersRound size={15} /><b>{organization.memberCount}</b><small>members</small></span>
              <span><Code2 size={15} /><b>{organization.problemCount}</b><small>problems</small></span>
              <span><Trophy size={15} /><b>{organization.contestCount}</b><small>contests</small></span>
            </div>
            <div className="organization-card-footer">
              <em>{organization.visibility}</em>
              <strong>{organization.totalRating.toLocaleString('vi-VN')} rating</strong>
            </div>
          </article>
        )) : (
          <div className="contest-empty organizations-empty">No organizations match the current filters.</div>
        )}
      </section>
      <div data-organizations-pagination data-organizations-pagination-bottom>
        <Pagination page={currentPage} totalPages={totalPages} onPage={setCurrentPage} totalItems={filteredOrganizations.length} pageSize={pageSize} onPageSizeChange={(value) => { setPageSize(value); setCurrentPage(1); }} pageSizeOptions={[6, 9, 12, 24, 48]} />
      </div>
    </div>
  );
}

function contestCommentStorageKey(contest: Contest) {
  return `cppro-contest-comments:${contest.slug || contest.id}`;
}

function readStoredContestComments(key: string): ContestComment[] {
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object').map((item) => ({
      id: String(item.id || `${Date.now()}`),
      author: String(item.author || 'user'),
      fullName: String(item.fullName || item.author || 'User'),
      body: String(item.body || ''),
      createdAt: String(item.createdAt || new Date().toISOString()),
      score: Number(item.score || 0) || 0,
    })).filter((item) => item.body.trim()) : [];
  } catch {
    return [];
  }
}

function storeContestComments(key: string, comments: ContestComment[]) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(comments.slice(0, 100)));
  } catch {
    // localStorage can be full or disabled; keep the in-memory UI state.
  }
}

function submissionTone(item: Submission) {
  const verdict = String(item.verdict || '').toUpperCase();
  const score = Number(item.score || 0);
  const max = Number(item.maxScore || 100) || 100;
  if (verdict === 'AC' && score >= max) return 'accepted';
  if (verdict === 'AC' || (score > 0 && score < max)) return 'partial';
  if (verdict === 'PENDING' || verdict === 'QUEUED') return 'pending';
  if (verdict === 'CE') return 'compile';
  return 'wrong';
}

function submissionScoreLabel(item: Submission) {
  const verdict = String(item.verdict || '').toUpperCase();
  if (!isFinalVerdict(verdict)) return verdict || 'WJ';
  if (verdict === 'CE' || verdict === 'IE') return '---';
  return `${Number(item.score || 0).toFixed(0)} / ${Number(item.maxScore || 100).toFixed(0)}`;
}

function languageDisplay(value: string) {
  return submitLanguageLabel(String(value || '').toLowerCase());
}

function SubmissionListRow({
  item,
  go,
  showProblem = true,
  user,
}: {
  item: Submission;
  go: (path: string) => void;
  showProblem?: boolean;
  user?: UserRow;
}) {
  const tone = submissionTone(item);
  const scoreLabel = submissionScoreLabel(item);
  const languageLabel = languageDisplay(item.language);
  const pending = !isFinalVerdict(item.verdict);
  return (
    <button type="button" data-submission-row-card data-tone={tone} onClick={() => go(`/submissions/${item.id}`)}>
      <span data-submission-row-score>
        {pending ? <i data-submission-row-spinner aria-hidden="true" /> : null}
        <b>{scoreLabel}</b>
        <small title={`${item.verdict} | ${languageLabel}`}>{item.verdict} | {languageLabel}</small>
      </span>
      <span data-submission-row-main>
        {showProblem ? <strong>{item.problemTitle}</strong> : null}
        <em>
          <a href={`/users/${encodeURIComponent(item.username)}`} onClick={(event) => openInternalLink(event, go, `/users/${encodeURIComponent(item.username)}`)}>{item.username}</a>
          {user ? <UserBadges user={user} /> : null}
          <span>·</span>
          <time dateTime={item.submittedAt}>{formatDate(item.submittedAt)}</time>
        </em>
      </span>
      <span data-submission-row-resource>
        <b>{item.timeMs ? `${(item.timeMs / 1000).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}s` : '---'}</b>
        <small>{item.memoryKb ? `${(item.memoryKb / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} MB` : '---'}</small>
      </span>
    </button>
  );
}

function ContestDetail({
  contest,
  data,
  go,
  currentUser,
  activeTab = 'info',
}: {
  contest?: Contest;
  data: CpproData;
  go: (path: string) => void;
  currentUser: StoredCpproUser | null;
  activeTab?: ContestTabKey;
}) {
  const [detailContest, setDetailContest] = useState<Contest | null>(null);
  const [joining, setJoining] = useState(false);
  const [standingsRows, setStandingsRows] = useState<Record<string, unknown>[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [standingsError, setStandingsError] = useState('');
  const [contestSubmissions, setContestSubmissions] = useState<Submission[]>([]);
  const [contestSubmissionsLoading, setContestSubmissionsLoading] = useState(false);
  const [contestSubmissionsError, setContestSubmissionsError] = useState('');
  const contestUsersByUsername = useMemo(() => new Map(data.users.map((user) => [user.username.toLowerCase(), user])), [data.users]);
  const [contestComments, setContestComments] = useState<ContestComment[]>([]);
  const [contestCommentSort, setContestCommentSort] = useState<'top' | 'new'>('top');
  const [contestCommentBody, setContestCommentBody] = useState('');
  const sourceContest = detailContest || contest;
  const contestKey = sourceContest ? (sourceContest.slug || String(sourceContest.id)) : '';
  const contestBase = contestKey ? `/contests/${contestKey}` : '/contests';
  const commentKey = sourceContest ? contestCommentStorageKey(sourceContest) : '';

  useEffect(() => {
    let cancelled = false;
    if (!contest) return () => {
      cancelled = true;
    };
    if (contest.problems?.length) {
      setDetailContest(contest);
      return () => {
        cancelled = true;
      };
    }
    cpproApiFetch<unknown>(`/contests/${encodeURIComponent(contest.slug || String(contest.id))}`)
      .then((payload) => {
        if (!cancelled && payload && typeof payload === 'object') {
          setDetailContest(mapBackendContest(payload as Record<string, unknown>));
        }
      })
      .catch(() => {
        if (!cancelled) setDetailContest(null);
      });
    return () => {
      cancelled = true;
    };
  }, [contest?.id, contest?.slug]);

  useEffect(() => {
    setContestComments(readStoredContestComments(commentKey));
  }, [commentKey]);

  useEffect(() => {
    let cancelled = false;
    if (!contestKey || activeTab !== 'leaderboard') return () => {
      cancelled = true;
    };
    setStandingsLoading(true);
    setStandingsError('');
    cpproApiFetch<unknown>(`/contests/${encodeURIComponent(contestKey)}/standings?page=1&limit=100`)
      .then((payload) => {
        if (!cancelled) setStandingsRows(rowsFromApi<Record<string, unknown>>(payload));
      })
      .catch((error) => {
        if (!cancelled) setStandingsError(error instanceof Error ? error.message : 'Không tải được bảng xếp hạng.');
      })
      .finally(() => {
        if (!cancelled) setStandingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, contestKey]);

  useEffect(() => {
    let cancelled = false;
    if (!contestKey || activeTab !== 'submissions') return () => {
      cancelled = true;
    };
    setContestSubmissionsLoading(true);
    setContestSubmissionsError('');
    cpproApiFetch<unknown>(`/submissions?contestId=${encodeURIComponent(contestKey)}&page=1&limit=50&withCount=true&sort=created&dir=desc`)
      .then((payload) => {
        if (!cancelled) setContestSubmissions(rowsFromApi<Record<string, unknown>>(payload).map(mapBackendSubmission));
      })
      .catch((error) => {
        if (!cancelled) setContestSubmissionsError(error instanceof Error ? error.message : 'Không tải được bài nộp kỳ thi.');
      })
      .finally(() => {
        if (!cancelled) setContestSubmissionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, contestKey]);

  if (!contest || !sourceContest) return <Empty title="Không tìm thấy kỳ thi" />;
  const problems = contestProblemRows(sourceContest, data);
  const timing = contestTiming(sourceContest);
  const problemCount = problems.length || sourceContest.problemCount || 0;
  const joined = isJoinedContest(sourceContest);
  const canJoin = timing.tone !== 'ended' && !joining;
  const sortedContestComments = [...contestComments].sort((left, right) => {
    if (contestCommentSort === 'new') return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    return (right.score - left.score) || (new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  });
  const tabs: Array<{ key: ContestTabKey; label: string; icon: typeof FileQuestion }> = [
    { key: 'info', label: 'Thông tin', icon: FileQuestion },
    { key: 'announcements', label: 'Thông báo', icon: Bell },
    { key: 'leaderboard', label: 'Bảng xếp hạng', icon: Trophy },
    { key: 'join', label: 'Tham gia', icon: UsersRound },
    { key: 'submissions', label: 'Các bài nộp', icon: ListChecks },
  ];

  const handleJoinContest = async () => {
    const token = localStorage.getItem('oj_platform_token') || localStorage.getItem('cppro_access_token');
    if (!token) {
      go(authPathWithReturn('login'));
      return;
    }
    setJoining(true);
    try {
      await cpproApiFetch(`/contests/${encodeURIComponent(sourceContest.slug || String(sourceContest.id))}/attendance/check-in`, {
        method: 'POST',
        body: JSON.stringify({ leaveOtherContests: true }),
      });
      rememberActiveContest(sourceContest);
      const payload = await cpproApiFetch<unknown>(`/contests/${encodeURIComponent(sourceContest.slug || String(sourceContest.id))}`);
      if (payload && typeof payload === 'object') setDetailContest(mapBackendContest(payload as Record<string, unknown>));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Không thể tham gia kỳ thi.');
    } finally {
      setJoining(false);
    }
  };

  const submitContestComment = () => {
    const body = contestCommentBody.trim();
    if (!body) return;
    if (!currentUser) {
      go(authPathWithReturn('login'));
      return;
    }
    const nextComment: ContestComment = {
      id: `${Date.now()}`,
      author: currentUser.username,
      fullName: currentUser.displayName || currentUser.full_name || currentUser.username,
      body,
      createdAt: new Date().toISOString(),
      score: 0,
    };
    const nextComments = [nextComment, ...contestComments];
    setContestComments(nextComments);
    storeContestComments(commentKey, nextComments);
    setContestCommentBody('');
  };

  return (
    <div className="contest-detail-page">
      <section className="contest-detail-head">
        <div>
          <h1>{sourceContest.title}</h1>
          <p>{formatRange(sourceContest.startTime, sourceContest.endTime)} · {formatContestDuration(sourceContest)} · {sourceContest.participants} thí sinh</p>
        </div>
        <button className="contest-join-primary" type="button" disabled={!canJoin || joined} onClick={handleJoinContest}>
          <CheckCircle2 size={18} />
          {joining ? 'Đang tham gia...' : joined ? 'Đã tham gia' : 'Tham gia kỳ thi'}
        </button>
      </section>

      <nav className="contest-tabs" aria-label="Điều hướng kỳ thi">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={activeTab === key ? 'active' : ''}
            type="button"
            onClick={() => go(`${contestBase}${contestTabSegment(key)}`)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>

      <section className={`contest-status-card ${timing.tone}`}>
        <div className="contest-status-main">
          <span><Clock size={20} /></span>
          <div>
            <strong>{timing.label}</strong>
            <p>Kết thúc: {formatDate(sourceContest.endTime)} · {problemCount} bài · {sourceContest.participants} người tham gia</p>
          </div>
        </div>
        <div className="contest-countdown">
          <small>{timing.countdownLabel}</small>
          <strong>{formatContestCountdown(timing.remainingMs)}</strong>
        </div>
      </section>

      {(activeTab === 'info' || activeTab === 'join') ? (
        <section className="contest-join-alert">
          <span><Zap size={22} /></span>
          <div>
            <strong>{timing.tone === 'running' ? 'Kỳ thi đang diễn ra!' : timing.tone === 'upcoming' ? 'Kỳ thi sắp bắt đầu!' : 'Kỳ thi đã kết thúc!'}</strong>
            <p>{timing.tone === 'running' ? 'Tham gia ngay để cùng tranh tài với mọi người.' : timing.tone === 'upcoming' ? 'Theo dõi lịch và chuẩn bị trước giờ mở đề.' : 'Bạn vẫn có thể xem bài, bảng điểm và các bài nộp.'}</p>
          </div>
          <button type="button" disabled={!canJoin || joined} onClick={handleJoinContest}>{timing.tone === 'ended' ? 'Đã kết thúc' : joined ? 'Đã tham gia' : 'Tham gia'}</button>
        </section>
      ) : null}

      {activeTab === 'announcements' ? (
        <section className="contest-panel-card">
          <div className="contest-board-head">
            <div>
              <h2>Thông báo kỳ thi</h2>
              <p>{data.notifications.length} thông báo gần đây</p>
            </div>
            <Megaphone size={22} />
          </div>
          <div className="contest-announcement-list">
            {data.notifications.slice(0, 8).map((item) => (
              <article key={item.id || item.slug || item.title}>
                <strong>{item.title}</strong>
                <small>{formatDate(item.date)}</small>
                <p>{item.body}</p>
              </article>
            ))}
            {data.notifications.length === 0 ? <p className="contest-empty-note">Chưa có thông báo nào.</p> : null}
          </div>
        </section>
      ) : null}

      {activeTab === 'leaderboard' ? (
        <section className="contest-panel-card">
          <div className="contest-board-head">
            <div>
              <h2>Bảng xếp hạng</h2>
              <p>{standingsLoading ? <InlineLoadingText label="Đang tải bảng xếp hạng" /> : `${standingsRows.length} thí sinh`}</p>
            </div>
            <Trophy size={22} />
          </div>
          {standingsError ? <p className="contest-empty-note">{standingsError}</p> : (
            <div className="contest-standing-table">
              <div className="contest-standing-row header"><span>#</span><span>Thành viên</span><span>Điểm</span><span>Đã giải</span><span>Penalty</span></div>
              {standingsRows.map((row, index) => (
                <div className="contest-standing-row" key={`${row.username || index}`}>
                  <span>{Number(row.rank || index + 1)}</span>
                  <span>{String(row.username || row.full_name || 'user')}</span>
                  <span>{Number(row.score || 0).toLocaleString('vi-VN')}</span>
                  <span>{Number(row.solved || row.accepted || 0)}</span>
                  <span>{Number(row.penalty || 0).toLocaleString('vi-VN')}</span>
                </div>
              ))}
              {!standingsLoading && standingsRows.length === 0 ? <p className="contest-empty-note">Chưa có dữ liệu bảng xếp hạng.</p> : null}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === 'submissions' ? (
        <section className="contest-panel-card">
          <div className="contest-board-head">
            <div>
              <h2>Các bài nộp trong kỳ thi</h2>
              <p>Chỉ hiển thị bài nộp thuộc kỳ thi này</p>
            </div>
            <ListChecks size={22} />
          </div>
          <div data-submission-list>
            {contestSubmissions.map((item) => <SubmissionListRow key={item.id} item={item} go={go} user={contestUsersByUsername.get(item.username.toLowerCase())} />)}
            {!contestSubmissionsLoading && contestSubmissions.length === 0 ? <p className="contest-empty-note">{contestSubmissionsError || 'Chưa có bài nộp nào trong kỳ thi.'}</p> : null}
            {contestSubmissionsLoading ? <TableLoadingRows rows={5} columns={5} /> : null}
          </div>
        </section>
      ) : null}

      {(activeTab === 'info' || activeTab === 'join') ? (
        <section className="contest-problem-board">
          <div className="contest-problem-table">
            <div className="contest-problem-row header">
              <span>#</span>
              <span>Bài tập</span>
              <span>Điểm</span>
            </div>
            {problems.map((problem, index) => (
              <button
                key={problem.key}
                className="contest-problem-row"
                type="button"
                onClick={() => problem.slug && go(`/problems/${problem.slug}?contest=${encodeURIComponent(String(sourceContest.id))}`)}
              >
                <span className="contest-index">{index + 1}</span>
                <span className="contest-problem-title">
                  <strong>{problem.title}</strong>
                  <span className={`contest-difficulty ${problem.difficulty || 'vnoj'}`}>
                    {contestDifficultyLabel(problem.difficulty)}
                  </span>
                </span>
                <span className="contest-score">{formatContestPoints(problem.score)}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="contest-comment-card">
        <div className="contest-board-head">
          <div>
            <h2>Bình luận kỳ thi</h2>
            <p>{contestComments.length} bình luận</p>
          </div>
          <div data-contest-comment-tabs>
            <button type="button" className={contestCommentSort === 'top' ? 'active' : ''} onClick={() => setContestCommentSort('top')}>Nổi bật</button>
            <button type="button" className={contestCommentSort === 'new' ? 'active' : ''} onClick={() => setContestCommentSort('new')}>Mới nhất</button>
          </div>
        </div>
        {currentUser ? (
          <div data-contest-comment-compose>
            <textarea value={contestCommentBody} onChange={(event) => setContestCommentBody(event.target.value)} placeholder="Bình luận kỳ thi này..." />
            <button type="button" disabled={!contestCommentBody.trim()} onClick={submitContestComment}><Send size={15} /> Gửi bình luận</button>
          </div>
        ) : (
          <div className="contest-login-prompt">
            <LogIn size={18} />
            Đăng nhập để bình luận và trao đổi trong kỳ thi.
          </div>
        )}
        <div data-contest-comment-list>
          {sortedContestComments.map((comment) => (
            <article key={comment.id}>
              <strong>{comment.fullName || comment.author}</strong>
              <small>{formatDate(comment.createdAt)}</small>
              <p>{comment.body}</p>
            </article>
          ))}
        </div>
        {sortedContestComments.length === 0 ? <p className="contest-empty-note">Chưa có bình luận nào.</p> : null}
      </section>
    </div>
  );
}

function UsersPage({ data, go, loading = false }: { data: CpproData; go: (path: string) => void; loading?: boolean }) {
  type UserSortKey = 'rank' | 'username' | 'rating' | 'score' | 'solved' | 'streak' | 'maxStreak';
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState('all');
  const [sortState, setSortState] = useState<SortState<UserSortKey>>({ key: 'score', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const tiers = useMemo(
    () => unique(data.users.flatMap((user) => [user.proTier, user.rankName].filter(Boolean) as string[])),
    [data.users],
  );
  const users = data.users.filter((user) => {
    const haystack = `${user.username} ${user.fullName} ${user.rankName} ${user.tags.join(' ')}`.toLowerCase();
    const matchesQuery = haystack.includes(query.toLowerCase());
    const userTiers = [user.proTier, user.rankName, ...user.tags].filter(Boolean);
    const matchesTier = tier === 'all' || userTiers.includes(tier);
    return matchesQuery && matchesTier;
  }).sort((a, b) => {
    const valueFor = (user: UserRow) => {
      if (sortState.key === 'rank') return user.score || 0;
      if (sortState.key === 'username') return user.username;
      if (sortState.key === 'rating') return user.rating || 0;
      if (sortState.key === 'score') return user.score || 0;
      if (sortState.key === 'solved') return user.solved || 0;
      if (sortState.key === 'streak') return user.streak || 0;
      if (sortState.key === 'maxStreak') return user.maxStreak || 0;
      return user.score || 0;
    };
    return compareSortValues(valueFor(a), valueFor(b), sortState.direction) || (b.score || 0) - (a.score || 0);
  });
  const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageUsers = users.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showLoadingRows = loading && data.users.length === 0;

  useEffect(() => {
    setPage(1);
  }, [query, tier, sortState.key, sortState.direction, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <section className="content-card leaderboard-page">
      <PageTitle icon={<UsersRound />} title="Thành viên" subtitle={`${users.length} / ${data.stats.users || users.length} thành viên trong database`} />
      <div className="leaderboard-tools">
        <label className="search-box">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm username hoặc họ tên..." />
        </label>
        <select value={tier} onChange={(event) => setTier(event.target.value)} aria-label="Lọc hạng thành viên">
          <option value="all">Tất cả tier</option>
          {tiers.map((item) => <option key={item} value={item}>{tierLabel(item)}</option>)}
        </select>
        <select
          value={sortState.key}
          onChange={(event) => {
            const key = event.target.value as UserSortKey;
            setSortState({ key, direction: key === 'username' ? 'asc' : 'desc' });
          }}
          aria-label="Sắp xếp thành viên"
        >
          <option value="score">Score cao nhất</option>
          <option value="rating">Rating cao nhất</option>
          <option value="solved">Đã giải nhiều nhất</option>
          <option value="streak">Streak hiện tại</option>
          <option value="maxStreak">Streak tốt nhất</option>
          <option value="username">Username A-Z</option>
        </select>
      </div>
      <Pagination page={currentPage} totalPages={totalPages} onPage={setPage} totalItems={users.length} pageSize={pageSize} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} />
      <div className="table-wrap leaderboard-table-wrap">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th><SortButton label="Hạng" sortKey="rank" state={sortState} onSort={(key) => setSortState((state) => toggleSort(state, key))} /></th>
              <th><SortButton label="Thành viên" sortKey="username" state={sortState} onSort={(key) => setSortState((state) => toggleSort(state, key))} /></th>
              <th><SortButton label="Rating" sortKey="rating" state={sortState} onSort={(key) => setSortState((state) => toggleSort(state, key))} align="right" /></th>
              <th><SortButton label="Score" sortKey="score" state={sortState} onSort={(key) => setSortState((state) => toggleSort(state, key))} align="right" /></th>
              <th><SortButton label="Đã giải" sortKey="solved" state={sortState} onSort={(key) => setSortState((state) => toggleSort(state, key))} align="right" /></th>
              <th><SortButton label="Hiện tại" sortKey="streak" state={sortState} onSort={(key) => setSortState((state) => toggleSort(state, key))} align="right" /></th>
              <th><SortButton label="Tốt nhất" sortKey="maxStreak" state={sortState} onSort={(key) => setSortState((state) => toggleSort(state, key))} align="right" /></th>
            </tr>
          </thead>
          <tbody>
            {showLoadingRows ? (
              <tr>
                <td colSpan={7}><TableLoadingRows rows={8} columns={5} /></td>
              </tr>
            ) : pageUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="contest-empty">Chưa có dữ liệu thành viên.</td>
              </tr>
            ) : pageUsers.map((user, index) => {
              const rank = (currentPage - 1) * pageSize + index + 1;
              return (
                <tr key={user.username} className={rank <= 3 ? `top-rank rank-${rank}` : ''} onClick={() => go(`/users/${user.username}`)}>
                  <td><span className="leaderboard-rank">{rank <= 3 ? rankMedal(rank) : rank}</span></td>
                  <td>
                    <div className="leaderboard-user">
                      <Avatar user={user} />
                      <span>
                        <a href={`/users/${encodeURIComponent(user.username)}`} onClick={(event) => openInternalLink(event, go, `/users/${encodeURIComponent(user.username)}`)}>{user.username}</a>
                        <small>{user.fullName || user.rankName}</small>
                        <span className="leaderboard-identity-meta">
                          {user.streak > 0 ? <em className="leaderboard-inline-streak" data-streak-tone={streakTone(user.streak)}><Flame size={11} />{user.streak}</em> : null}
                          <UserBadges user={user} />
                        </span>
                      </span>
                    </div>
                  </td>
                  <td>{user.rating > 0 && ((user.contestRatingTimes || 0) > 0 || user.score > 0) ? user.rating : '—'}</td>
                  <td><strong>{formatCompactScore(user.score)}</strong></td>
                  <td>{user.solved}</td>
                  <td>{user.streak > 0 ? <span className="streak-badge current"><Flame size={13} /> {user.streak}</span> : '—'}</td>
                  <td>{user.maxStreak > 0 ? <span className="streak-badge best"><Zap size={13} /> {user.maxStreak}</span> : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={currentPage} totalPages={totalPages} onPage={setPage} totalItems={users.length} pageSize={pageSize} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} />
    </section>
  );
}

function Profile({
  profile: initialProfile,
  requestedId,
  data,
  go,
  currentUser,
  onUserUpdate,
}: {
  profile?: UserRow;
  requestedId?: string;
  data: CpproData;
  go: (path: string) => void;
  currentUser: StoredCpproUser | null;
  onUserUpdate: (user: StoredCpproUser) => void;
}) {
  const [remoteProfile, setRemoteProfile] = useState<UserRow | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [avatarDraft, setAvatarDraft] = useState('');
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  useEffect(() => {
    let cancelled = false;
    if (!requestedId) {
      setRemoteProfile(null);
      setProfileError('');
      setProfileLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setProfileLoading(!initialProfile);
    setProfileError('');
    fetchUserProfile(requestedId)
      .then((user) => {
        if (!cancelled) setRemoteProfile(user);
      })
      .catch((error) => {
        if (!cancelled) setProfileError(error?.message || 'Không tìm thấy thành viên');
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialProfile, requestedId]);
  const profile = remoteProfile || initialProfile;
  useEffect(() => {
    if (!profile) return;
    setAvatarDraft(profile.avatarUrl || '');
    setAvatarError('');
  }, [profile?.username, profile?.avatarUrl]);
  if (!profile) return profileLoading ? <ProfileLoadingSkeleton /> : <Empty title="Không tìm thấy thành viên" subtitle={profileError || undefined} />;
  const canEditAvatar = Boolean(currentUser && currentUser.username.toLowerCase() === profile.username.toLowerCase());
  const handleAvatarFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
      setAvatarError('Chỉ hỗ trợ PNG, JPEG, WebP hoặc GIF.');
      return;
    }
    setAvatarError('Đang xử lý ảnh đại diện...');
    try {
      const prepared = await compressAvatarFile(file);
      setAvatarDraft(prepared);
      setAvatarError('');
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Không đọc được file ảnh.');
    } finally {
      event.currentTarget.value = '';
    }
  };
  const saveAvatar = async () => {
    if (!canEditAvatar || !currentUser) return;
    setAvatarSaving(true);
    setAvatarError('');
    try {
      const updated = await updateCurrentProfileAvatar(avatarDraft.trim() || null);
      const nextAvatar = updated.avatar_url || null;
      const stored = {
        ...currentUser,
        ...authUserToStored(updated),
        avatar_url: nextAvatar,
        avatarUrl: nextAvatar,
      };
      onUserUpdate(stored);
      setRemoteProfile((existing) => ({
        ...(existing || profile),
        fullName: updated.full_name || profile.fullName,
        avatarUrl: nextAvatar,
        bio: updated.bio ?? profile.bio,
      }));
      setAvatarDraft(nextAvatar || '');
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Không lưu được avatar.');
    } finally {
      setAvatarSaving(false);
    }
  };
  const remoteSubmissions = profile.recentSubmissions?.length ? profile.recentSubmissions : [];
  const localSubmissions = data.submissions
    .filter((item) => item.username.toLowerCase() === profile.username.toLowerCase())
    .slice(0, 12);
  const profileSubmissions = (remoteSubmissions.length ? remoteSubmissions : localSubmissions).slice(0, 12);
  const solvedProblemSummaries = profile.solvedProblems?.length ? profile.solvedProblems : [];
  const solvedSlugs = new Set([
    ...solvedProblemSummaries.map((item) => item.slug),
    ...profileSubmissions
      .filter((item) => String(item.verdict).toUpperCase() === 'AC' || Number(item.score) > 0)
      .map((item) => item.problemSlug),
  ]);
  const solvedProblems = data.problems.filter((problem) => solvedSlugs.has(problem.slug));
  const chartProblems = solvedProblems.length
    ? solvedProblems
    : data.problems.slice(0, Math.max(2, Math.min(8, profile.solved || 4)));
  const tagCounts = new Map<string, number>();
  chartProblems.forEach((problem) => {
    problem.tags.slice(0, 3).forEach((tag) => tagCounts.set(tag.name, (tagCounts.get(tag.name) || 0) + 1));
  });
  const tagRows = profile.solvedTags?.length
    ? profile.solvedTags.map((tag) => [tag.name, tag.count] as [string, number]).slice(0, 5)
    : [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const scoreBuckets = [1000, 1400, 1800, 2200, 2600, 3000, 3400].map((base) => ({
    label: String(base),
    count: chartProblems.filter((problem) => problem.score >= base && problem.score < base + 400).length,
  }));
  const maxBucket = Math.max(1, ...scoreBuckets.map((item) => item.count));
  const activityCells = buildProfileActivityCells(profile.activityHeatmap || [], profileSubmissions);
  const ratingSeries = (profile.ratingHistory || [])
    .filter((item) => typeof item.rating === 'number')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const ratingValues = ratingSeries.map((item) => item.rating as number);
  const ratingMin = ratingValues.length ? Math.max(0, Math.floor((Math.min(...ratingValues) - 140) / 200) * 200) : 1800;
  const ratingMax = ratingValues.length ? Math.ceil((Math.max(...ratingValues) + 140) / 200) * 200 : 3400;
  const ratingSpan = Math.max(1, ratingMax - ratingMin);
  const chart = { left: 50, top: 16, width: 554, height: 218 };
  const ratingPoints = ratingSeries.map((item, index) => {
    const x = chart.left + (ratingSeries.length <= 1 ? chart.width : (index / (ratingSeries.length - 1)) * chart.width);
    const y = chart.top + chart.height - (((item.rating as number) - ratingMin) / ratingSpan) * chart.height;
    return { ...item, x, y };
  });
  const ratingPath = ratingPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const ratingTicks = Array.from({ length: 6 }, (_, index) => {
    const value = Math.round((ratingMin + (ratingSpan / 5) * index) / 100) * 100;
    const y = chart.top + chart.height - ((value - ratingMin) / ratingSpan) * chart.height;
    return { value, y };
  });
  const ratingLegend = [
    ['legendary', 'Legendary'],
    ['grandmaster', 'Grandmaster'],
    ['master', 'Master'],
    ['expert', 'Expert'],
    ['base', 'Base'],
  ] as const;
  const recentContests = (profile.ratingHistory || [])
    .filter((item) => item.contestTitle || item.contestId)
    .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
    .slice(0, 10);
  const joined = formatProfileJoinDate(profile.createdAt);
  const profileTone = profileRankTone(profile);
  const profileRankLabel = profile.rankName || profile.proTier || data.contact.brandName || defaultFooterContactSettings.brandName;
  const legendaryRankLabel = profileTone === 'legendary' && /^legendary/i.test(profileRankLabel);
  const brandMark = compactBrandMark(data.contact.brandName);
  const rankIndex = data.users.findIndex((item) => item.username === profile.username);
  const profileSubmissionsPath = `/submissions?q=${encodeURIComponent(profile.username)}`;

  return (
    <div className="profile-page profile-dashboard">
      <section className="profile-banner" data-profile-rank={profileTone} data-profile-brand={brandMark}>
        <button className="back-link" type="button" onClick={() => go('/users')}>← Cộng đồng</button>
        <div className="profile-identity">
          <Avatar user={profile} large />
          <div>
            <div className="profile-name-row" data-profile-rank={profileTone}>
              <h1>{profile.username}</h1>
              <span>{profile.streak}</span>
            </div>
            <strong data-profile-rank={profileTone}>{profile.fullName || profile.username}</strong>
            <p className={profileRankLineClass(profile)}>
              <Trophy size={15} />
              <span className="profile-rank-label">
                {legendaryRankLabel ? <><span className="profile-rank-initial">L</span>{profileRankLabel.slice(1)}</> : profileRankLabel}
              </span>
            </p>
            <UserBadges user={profile} />
            {(profile.organizationName || joined) ? (
              <div className="profile-meta-row">
                {profile.organizationName ? <span><GraduationCap size={15} />{profile.organizationName}</span> : null}
                {joined ? <span><Clock size={15} />{joined}</span> : null}
              </div>
            ) : null}
            <em>{profile.bio || 'Người dùng này chưa viết gì về bản thân.'}</em>
          </div>
        </div>
        <div className="profile-streak-cards" aria-label="Streak của thành viên">
          <span><Flame size={18} /><b>{profile.streak || 0}</b><small>Hiện tại</small></span>
          <span><Zap size={18} /><b>{profile.maxStreak || profile.streak || 0}</b><small>Kỷ lục</small></span>
          <span><Star size={18} /><b>{Math.max(1, Math.min(9, profile.solved || 1))}</b><small>Mục tiêu</small></span>
          <span><Trophy size={18} /><b>{profile.contestCount || 0}</b><small>Kỷ lục MT</small></span>
        </div>
      </section>

      <div className="profile-dashboard-grid">
        <aside className="profile-side-stack">
          <section className="profile-card-block">
            <h2>Thống kê</h2>
            <div className="profile-mini-stats">
              <span><CheckCircle2 size={18} /><b>{profile.solved}</b><small>Bài đã giải</small></span>
              <span><Send size={18} /><b>{profile.totalSubmissions || profileSubmissions.length || 0}</b><small>Số bài nộp</small></span>
              <span><Trophy size={18} /><b>{formatCompactScore(profile.score)}</b><small>Điểm</small></span>
              <span><Star size={18} /><b>#{Math.max(1, rankIndex + 1)}</b><small>Hạng điểm</small></span>
            </div>
          </section>

          <section className="profile-card-block">
            <h2>Rating</h2>
            <div className="profile-rating-box">
              <span><small>Rating hiện tại</small><b>{profile.rating || '—'}</b></span>
              <span><small>Xếp hạng</small><b>{profile.rating ? `#${Math.max(1, Math.round(profile.rating / 10))}` : '#--'}</b></span>
            </div>
            <div className="profile-rating-mini">
              <span><small>Min.</small><b>{ratingValues.length ? Math.min(...ratingValues) : profile.rating || '—'}</b></span>
              <span><small>Max.</small><b>{profile.maxRating || profile.rating || '—'}</b></span>
            </div>
            <button className="blue-button" type="button" onClick={() => go(profileSubmissionsPath)}>
              <Send size={16} /> Xem các bài nộp
            </button>
          </section>

          {canEditAvatar ? (
            <section className="profile-card-block profile-avatar-editor">
              <h2>Avatar cá nhân</h2>
              <div className="profile-avatar-preview">
                {avatarDraft ? <img src={avatarDraft} alt="Avatar preview" /> : <span>{profile.username.slice(0, 2).toUpperCase()}</span>}
              </div>
              <label>
                <ImageIcon size={16} />
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleAvatarFile} />
              </label>
              <label>
                <span>URL/Data ảnh</span>
                <input value={avatarDraft} onChange={(event) => setAvatarDraft(event.target.value)} placeholder="Dán data URL hoặc để trống để xóa" />
              </label>
              {avatarError ? <p>{avatarError}</p> : null}
              <div className="profile-avatar-actions">
                <button className="soft-button" type="button" onClick={() => setAvatarDraft('')}>Xóa ảnh</button>
                <button className="blue-button" type="button" onClick={saveAvatar} disabled={avatarSaving}>
                  {avatarSaving ? 'Đang lưu...' : 'Lưu avatar'}
                </button>
              </div>
            </section>
          ) : null}

          <section className="profile-card-block">
            <h2>Chuỗi hoạt động</h2>
            <div className="profile-streak-pair">
              <span><Flame size={18} /><b>{profile.streak || 0}</b><small>Hiện tại</small></span>
              <span><Zap size={18} /><b>{profile.maxStreak || profile.streak || 0}</b><small>Kỷ lục</small></span>
            </div>
            <small>30 ngày gần đây</small>
            <div className="profile-day-row">
              {activityCells.slice(-30).map((item) => (
                <i
                  key={item.date}
                  data-hot={item.level > 0 ? 'true' : undefined}
                  data-profile-chart-tip={`${item.date}: ${item.count} submissions`}
                  tabIndex={0}
                />
              ))}
            </div>
          </section>

          <section className="profile-card-block profile-contest-card">
            <h2>Kỳ thi gần đây</h2>
            {recentContests.length ? (
              <div className="profile-contest-list">
                {recentContests.map((item) => (
                  <button key={`${item.contestId || item.contestTitle}-${item.createdAt}`} type="button" onClick={() => item.contestId ? go(`/contests/${item.contestId}`) : undefined} title={`${item.contestTitle}: ${item.rating ?? '—'}${item.rank ? ` - rank #${item.rank}` : ''} - ${formatUtcDateTime(item.createdAt)}`}>
                    <span>
                      <strong>{item.contestTitle || `Contest #${item.contestId}`}</strong>
                      <small>{item.rank ? `#${item.rank} - ` : ''}{formatUtcDateTime(item.createdAt)}</small>
                    </span>
                    <em data-positive={Number(item.delta || 0) >= 0 ? 'true' : 'false'}>{item.delta !== null && item.delta !== undefined ? formatRatingDelta(item.delta) : '—'}</em>
                    <b>{item.rating ?? '—'}</b>
                  </button>
                ))}
              </div>
            ) : (
              <div className="profile-empty-card">
                <CalendarDays size={26} />
                <strong>{profile.contestCount ? `${profile.contestCount} kỳ thi đã tham gia` : 'Chưa có kỳ thi nào'}</strong>
              </div>
            )}
          </section>
        </aside>

        <main className="profile-main-stack">
          <section className="profile-chart-card">
            <div className="profile-card-head">
              <h2><FileQuestion size={18} /> Thống kê bài giải</h2>
              <span>{chartProblems.length} bài có điểm</span>
              <span>{tagRows.length} tag</span>
            </div>
            <div className="profile-solved-grid">
              <div>
                <h3>Phân bố tag</h3>
                <div
                  className="profile-donut"
                  style={{ '--items': tagRows.length || 1 } as React.CSSProperties}
                  data-profile-chart-tip={tagRows.length ? tagRows.map(([name, count]) => `${name}: ${count}`).join(' | ') : 'No tag data'}
                  tabIndex={0}
                  aria-label="Solved problem tag distribution"
                >
                  <b>{tagRows.reduce((sum, item) => sum + item[1], 0)}</b>
                </div>
                <div className="profile-tag-legend">
                  {tagRows.length ? tagRows.map(([name, count], index) => (
                    <span key={name} data-profile-chart-tip={`${name}: ${count} solved problems`} tabIndex={0}><i style={{ '--color-index': index } as React.CSSProperties} />{name}<b>{count}</b></span>
                  )) : <small>Chưa có tag nổi bật</small>}
                </div>
              </div>
              <div className="profile-hsg-empty">
                <h3>Phân bố đề HSG</h3>
                <FileQuestion size={32} />
                <p>Chưa có bài đề HSG nào</p>
              </div>
            </div>
            <div className="profile-score-bars">
              <h3>Phân bố điểm</h3>
              <div>
                {scoreBuckets.map((bucket, index) => (
                  <span key={bucket.label} data-profile-chart-tip={`Rating ${bucket.label}-${Number(bucket.label) + 399}: ${bucket.count} solved problems`} tabIndex={0}>
                    <b style={{ height: `${Math.max(8, (bucket.count / maxBucket) * 118)}px` }} data-bar={index} />
                    <small>{bucket.label}</small>
                    {bucket.count ? <em>{bucket.count}</em> : null}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="profile-chart-card">
            <div className="profile-card-head">
              <h2><CalendarDays size={18} /> Hoạt động nộp bài</h2>
              <span>{profileSubmissions.length} bài nộp gần đây</span>
            </div>
            <div className="profile-heatmap">
              {activityCells.map((item) => (
                <i key={item.date} data-level={item.level} data-profile-chart-tip={`${item.date}: ${item.count} submissions`} tabIndex={0} />
              ))}
            </div>
            <div className="profile-heatmap-label"><span>Ít</span><i /><i /><i /><i /><span>Nhiều</span></div>
          </section>

          <section className="profile-chart-card profile-recent-submissions">
            <div className="profile-card-head">
              <h2><Send size={18} /> Bài nộp gần đây</h2>
              <span>{profile.totalSubmissions || profileSubmissions.length || 0} tổng</span>
            </div>
            <div className="profile-submission-list">
              {profileSubmissions.length ? profileSubmissions.slice(0, 8).map((item) => (
                <button key={item.id || `${item.problemSlug}-${item.submittedAt}`} type="button" onClick={() => go(`/submissions/${item.id}`)}>
                  <span>
                    <strong>{item.problemTitle}</strong>
                    <small>{item.language} · {formatDate(item.submittedAt)}</small>
                  </span>
                  <em className={verdictClass(item.verdict)}>{item.verdict}</em>
                  <b>{item.score}/{item.maxScore}</b>
                </button>
              )) : (
                <p>Chưa có bài nộp gần đây.</p>
              )}
            </div>
          </section>

          <section className="profile-chart-card profile-rating-chart">
            <div className="profile-card-head">
              <h2><Sparkles size={18} /> Lịch sử rating</h2>
              <span>{profile.contestCount || 0} kỳ thi</span>
            </div>
            <div className="profile-rating-zones">
              <div className="profile-rating-legend">
                {ratingLegend.map(([tone, label]) => <span key={tone} data-tone={tone} data-profile-chart-tip={`${label} rating zone`} tabIndex={0}><i />{label}</span>)}
              </div>
              {ratingSeries.length ? (
                <svg viewBox="0 0 620 270" role="img" aria-label="Rating history">
                  <rect x="50" y="16" width="554" height="43.6" className="rating-zone legendary" />
                  <rect x="50" y="59.6" width="554" height="43.6" className="rating-zone grandmaster" />
                  <rect x="50" y="103.2" width="554" height="43.6" className="rating-zone master" />
                  <rect x="50" y="146.8" width="554" height="43.6" className="rating-zone expert" />
                  <rect x="50" y="190.4" width="554" height="43.6" className="rating-zone base" />
                  {ratingTicks.map((tick) => (
                    <g key={tick.value}>
                      <line x1="50" y1={tick.y} x2="604" y2={tick.y} className="rating-grid-line" />
                      <text x="44" y={tick.y + 4} textAnchor="end">{tick.value}</text>
                    </g>
                  ))}
                  <line x1="50" y1="234" x2="604" y2="234" className="rating-axis" />
                  <path d={ratingPath} className="rating-line" />
                  {ratingPoints.map((point) => (
                    <circle key={`${point.contestId || point.contestTitle}-${point.createdAt}`} cx={point.x} cy={point.y} r="4.5">
                      <title>{`${point.contestTitle}: ${point.rating}${point.delta !== null && point.delta !== undefined ? ` (${formatRatingDelta(point.delta)})` : ''}${point.rank ? ` - rank #${point.rank}` : ''} - ${formatUtcDateTime(point.createdAt)}`}</title>
                    </circle>
                  ))}
                </svg>
              ) : (
                <div className="profile-rating-empty">
                  <Sparkles size={30} />
                  <strong>Chưa có lịch sử rating</strong>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function ProfileLoadingSkeleton() {
  return (
    <div className="profile-page profile-dashboard profile-loading-skeleton" data-profile-loading-skeleton>
      <section className="profile-banner" data-profile-rank="admin" data-home-element-loading>
        <i className="skeleton-pill small" />
        <div className="profile-identity">
          <i className="skeleton-avatar profile" />
          <div>
            <i className="skeleton-line w-42 tall" />
            <i className="skeleton-line w-64" />
            <i className="skeleton-line w-48" />
            <i className="skeleton-line w-78" />
          </div>
        </div>
        <div className="profile-streak-cards">
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index}><i className="skeleton-icon" /><b>&nbsp;</b><small>&nbsp;</small></span>
          ))}
        </div>
      </section>
      <div className="profile-dashboard-grid">
        <aside className="profile-side-stack">
          {Array.from({ length: 4 }, (_, index) => (
            <section className="profile-card-block" data-home-element-loading key={index}>
              <i className="skeleton-line w-42" />
              <i className="skeleton-line w-82" />
              <i className="skeleton-line w-64" />
            </section>
          ))}
        </aside>
        <main className="profile-main-stack">
          {Array.from({ length: 3 }, (_, index) => (
            <section className="profile-chart-card" data-home-element-loading key={index}>
              <div className="profile-card-head">
                <i className="skeleton-line w-44" />
                <i className="skeleton-pill small" />
              </div>
              <div className="profile-loading-chart">
                {Array.from({ length: 12 }, (_, barIndex) => <i key={barIndex} style={{ '--bar-index': barIndex } as React.CSSProperties} />)}
              </div>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}

function SubmissionsPage({ data, go, currentUser, initialLoading = false }: { data: CpproData; go: (path: string) => void; currentUser: StoredCpproUser | null; initialLoading?: boolean }) {
  type SubmissionSortKey = 'id' | 'username' | 'problem' | 'language' | 'score' | 'time' | 'memory';
  type SubmissionScope = 'all' | 'mine';
  type SubmissionApiSummary = {
    total: number;
    accepted: number;
    today: number;
    verdicts: Record<string, number>;
    languages: Record<string, number>;
  };
  const initialQuery = (() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('q') || params.get('user') || '';
  })();
  const initialScope: SubmissionScope = (() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('scope') === 'mine' || params.get('mine') === '1' ? 'mine' : 'all';
  })();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState('all');
  const [language, setLanguage] = useState('all');
  const [scope, setScope] = useState<SubmissionScope>(initialScope);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortState, setSortState] = useState<SortState<SubmissionSortKey>>({ key: 'id', direction: 'desc' });
  const [remoteSubmissions, setRemoteSubmissions] = useState<Submission[] | null>(null);
  const [remoteTotal, setRemoteTotal] = useState<number | null>(null);
  const [remoteSummary, setRemoteSummary] = useState<SubmissionApiSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const usersByUsername = useMemo(() => new Map(data.users.map((user) => [user.username.toLowerCase(), user])), [data.users]);
  const sortMap: Record<SubmissionSortKey, string> = {
    id: 'id',
    username: 'user',
    problem: 'problem',
    language: 'language',
    score: 'score',
    time: 'runtime',
    memory: 'memory',
  };
  const buildPath = () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
      withCount: 'true',
      sort: sortMap[sortState.key],
      dir: sortState.direction,
    });
    if (scope === 'mine') params.set('scope', 'mine');
    if (status !== 'all') params.set('verdict', status);
    if (language !== 'all') params.set('language', language);
    if (query.trim()) params.set('q', query.trim());
    return `/submissions?${params.toString()}`;
  };

  useEffect(() => {
    let cancelled = false;
    const load = (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      cpproApiFetch<unknown>(buildPath())
        .then((payload) => {
          if (cancelled) return;
          const rows = rowsFromApi<Record<string, unknown>>(payload).map(mapBackendSubmission);
          const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
          const summary = record.summary && typeof record.summary === 'object' ? record.summary as Record<string, unknown> : {};
          setRemoteSubmissions(rows);
          setRemoteTotal(totalFromApi(payload, rows.length));
          setRemoteSummary({
            total: Number(summary.total ?? totalFromApi(payload, rows.length)) || rows.length,
            accepted: Number(summary.accepted ?? rows.filter((item) => item.verdict === 'AC').length) || 0,
            today: Number(summary.today ?? 0) || 0,
            verdicts: summary.verdicts && typeof summary.verdicts === 'object' ? summary.verdicts as Record<string, number> : {},
            languages: summary.languages && typeof summary.languages === 'object' ? summary.languages as Record<string, number> : {},
          });
          setError('');
        })
        .catch((nextError) => {
          if (!cancelled) {
            setRemoteSubmissions(null);
            setRemoteTotal(null);
            setRemoteSummary(null);
            setError(nextError instanceof Error ? nextError.message : 'Không tải được danh sách bài nộp.');
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load(true);
    const timer = window.setInterval(() => load(false), 3500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [page, pageSize, query, status, language, scope, sortState.key, sortState.direction]);

  const sourceSubmissions = remoteSubmissions || data.submissions;
  const fallbackSubmissions = sourceSubmissions.filter((item) => {
    const haystack = `${item.id} ${item.username} ${item.problemTitle} ${item.problemSlug} ${item.language} ${item.verdict}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query.toLowerCase());
    const matchesStatus = status === 'all' || item.verdict === status;
    const matchesLanguage = language === 'all' || item.language === language;
    const matchesScope = scope === 'all' || (currentUser && item.username.toLowerCase() === currentUser.username.toLowerCase());
    return matchesQuery && matchesStatus && matchesLanguage && matchesScope;
  }).sort((left, right) => {
    const valueFor = (item: Submission) => {
      if (sortState.key === 'id') return item.id;
      if (sortState.key === 'username') return item.username;
      if (sortState.key === 'problem') return item.problemTitle;
      if (sortState.key === 'language') return item.language;
      if (sortState.key === 'score') return Number(item.score || 0);
      if (sortState.key === 'time') return item.timeMs;
      if (sortState.key === 'memory') return item.memoryKb;
      return item.id;
    };
    return compareSortValues(valueFor(left), valueFor(right), sortState.direction) || (right.id - left.id);
  });
  const submissions = remoteSubmissions || fallbackSubmissions;
  const totalItems = remoteTotal ?? fallbackSubmissions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageSubmissions = remoteSubmissions ? submissions : fallbackSubmissions.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showLoadingRows = loading && pageSubmissions.length === 0;
  const verdictOptions = useMemo(() => {
    const summaryKeys = Object.keys(remoteSummary?.verdicts || {});
    return unique([...summaryKeys, ...sourceSubmissions.map((item) => item.verdict)].filter(Boolean));
  }, [remoteSummary, sourceSubmissions]);
  const languageOptions = useMemo(() => {
    const summaryKeys = Object.keys(remoteSummary?.languages || {});
    return unique([...summaryKeys, ...sourceSubmissions.map((item) => item.language)].filter(Boolean));
  }, [remoteSummary, sourceSubmissions]);
  const acceptedCount = remoteSummary?.accepted ?? fallbackSubmissions.filter((item) => item.verdict === 'AC').length;
  const partialCount = Number(remoteSummary?.verdicts?.PARTIAL || 0);
  const failedCount = Math.max(0, totalItems - acceptedCount - partialCount);
  const avgScore = submissions.length
    ? Math.round(submissions.reduce((sum, item) => sum + Number(item.score || 0), 0) / submissions.length)
    : 0;

  useEffect(() => {
    setPage(1);
  }, [query, status, language, scope, sortState.key, sortState.direction, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const changeScope = (nextScope: SubmissionScope) => {
    if (nextScope === 'mine' && !currentUser) {
    go(authPathWithReturn('login'));
      return;
    }
    setScope(nextScope);
  };

  return (
    <div className="submissions-page" data-submissions-page>
      <header data-submissions-hero>
        <span data-submissions-hero-icon><Code2 size={25} /></span>
        <span>
          <h1>Danh sách bài nộp</h1>
          <p>{loading || initialLoading ? <InlineLoadingText label="Đang tải bài nộp từ database" /> : `${totalItems.toLocaleString('vi-VN')} bài nộp từ database`}</p>
        </span>
        <div data-submission-tabs>
          <button className={scope === 'all' ? 'active' : ''} type="button" onClick={() => changeScope('all')}><ListChecks size={16} /> Tất cả</button>
          <button className={scope === 'mine' ? 'active' : ''} type="button" onClick={() => changeScope('mine')}><User size={16} /> Bài nộp của tôi</button>
        </div>
      </header>

      <div data-submissions-layout>
        <section data-submissions-table-card>
          <Pagination page={currentPage} totalPages={totalPages} onPage={setPage} totalItems={totalItems} pageSize={pageSize} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} />
          <div data-submission-list>
            {showLoadingRows ? (
              <TableLoadingRows rows={Math.min(pageSize, 10)} columns={5} />
            ) : pageSubmissions.length === 0 ? (
              <p className="contest-empty">Chưa có dữ liệu bài nộp phù hợp.{error ? ` ${error}` : ''}</p>
            ) : pageSubmissions.map((item) => (
              <SubmissionListRow key={item.id} item={item} go={go} user={usersByUsername.get(item.username.toLowerCase())} />
            ))}
          </div>
          <Pagination page={currentPage} totalPages={totalPages} onPage={setPage} totalItems={totalItems} pageSize={pageSize} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} />
        </section>

        <aside data-submissions-side>
          <section data-submission-filter-card>
            <div data-submission-card-head>
              <strong>Lọc bài nộp</strong>
              <SlidersHorizontal size={17} />
            </div>
            <label className="search-box">
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ID, user, bài..." />
            </label>
            <label data-submission-select>
              <span>Trạng thái</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Lọc trạng thái bài nộp">
                <option value="all">Tất cả trạng thái</option>
                {verdictOptions.map((item) => <option key={item} value={item}>{item} ({Number(remoteSummary?.verdicts?.[item] || 0).toLocaleString('vi-VN')})</option>)}
              </select>
            </label>
            <label data-submission-select>
              <span>Ngôn ngữ</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="Lọc ngôn ngữ bài nộp">
                <option value="all">Tất cả ngôn ngữ</option>
                {languageOptions.map((item) => <option key={item} value={item}>{languageDisplay(item)} ({Number(remoteSummary?.languages?.[item] || 0).toLocaleString('vi-VN')})</option>)}
              </select>
            </label>
            <label data-submission-select>
              <span>Sắp xếp</span>
              <select
                value={`${sortState.key}:${sortState.direction}`}
                onChange={(event) => {
                  const [key, direction] = event.target.value.split(':') as [SubmissionSortKey, SortDirection];
                  setSortState({ key, direction });
                }}
                aria-label="Sắp xếp bài nộp"
              >
                <option value="id:desc">Mới nhất</option>
                <option value="score:desc">Điểm cao nhất</option>
                <option value="time:asc">Chạy nhanh nhất</option>
                <option value="memory:asc">Bộ nhớ thấp nhất</option>
                <option value="problem:asc">Tên bài A-Z</option>
                <option value="username:asc">User A-Z</option>
              </select>
            </label>
            <button className="blue-button" type="button" onClick={() => setPage(1)}>Tìm</button>
          </section>

          <section data-submission-stats-card>
            <div data-submission-card-head>
              <strong>Thống kê</strong>
              <ChartPie size={17} />
            </div>
            <div data-submission-pie-card>
              <SubmissionPie total={totalItems} accepted={acceptedCount} partial={partialCount} failed={failedCount} />
              <p>Tổng: {totalItems.toLocaleString('vi-VN')}</p>
            </div>
            <div data-submission-stat-grid>
              <span><b>{acceptedCount.toLocaleString('vi-VN')}</b><small>AC</small></span>
              <span><b>{partialCount.toLocaleString('vi-VN')}</b><small>Partial</small></span>
              <span><b>{(remoteSummary?.today || 0).toLocaleString('vi-VN')}</b><small>Hôm nay</small></span>
              <span><b>{avgScore}</b><small>Điểm TB trang</small></span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function HsgPage({ data, go }: { data: CpproData; go: (path: string) => void }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [year, setYear] = useState('all');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const hsgCategories = useMemo(() => {
    const byId = new Map<number, HsgCategory>();
    fallbackHsgCategories.forEach((item) => byId.set(item.id, item));
    (data.hsgCategories || []).forEach((item) => byId.set(item.id, { ...byId.get(item.id), ...item }));
    data.exams.forEach((exam) => {
      if (exam.category_detail) {
        byId.set(exam.category_detail.id, { ...byId.get(exam.category_detail.id), ...exam.category_detail });
      } else if (!byId.has(exam.category)) {
        byId.set(exam.category, { id: exam.category, name: 'Khác', description: 'Các đề thi khác', order: 999 });
      }
    });
    return Array.from(byId.values());
  }, [data.exams, data.hsgCategories]);
  const categoryRows = useMemo(() => {
    const examMap = new Map<number, HsgExam[]>();
    data.exams.forEach((exam) => {
      const categoryId = exam.category_detail?.id || exam.category;
      if (!examMap.has(categoryId)) examMap.set(categoryId, []);
      examMap.get(categoryId)!.push(exam);
    });
    return hsgCategories
      .map((item) => ({ category: item, exams: examMap.get(item.id) || [] }))
      .sort((a, b) => (
        b.exams.length - a.exams.length
        || (a.category.order ?? 999) - (b.category.order ?? 999)
        || a.category.id - b.category.id
      ));
  }, [data.exams, hsgCategories]);
  const categories = useMemo(() => categoryRows.map((row) => row.category), [categoryRows]);
  const years = useMemo(() => unique(data.exams.map((exam) => String(exam.year || '')).filter(Boolean)).reverse(), [data.exams]);
  const filteredExams = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.exams.filter((exam) => {
      const haystack = `${exam.title} ${exam.category_detail?.name || ''} ${exam.contest_title || ''}`.toLowerCase();
      const matchesQuery = !q || haystack.includes(q);
      const matchesCategory = category === 'all' || String(exam.category_detail?.id || exam.category) === category;
      const matchesYear = year === 'all' || String(exam.year) === year;
      const matchesCompletion = !hideCompleted || Number(exam.progress_percent || 0) < 100;
      return matchesQuery && matchesCategory && matchesYear && matchesCompletion;
    });
  }, [category, data.exams, hideCompleted, query, year]);
  const totalPages = Math.max(1, Math.ceil(filteredExams.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleExams = filteredExams.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [category, hideCompleted, query, year, pageSize]);

  return (
    <div className="hsg-page stack">
      <PageTitle icon={<BookOpen />} title="Đề Học Sinh Giỏi" subtitle="Tổng hợp đề thi HSG, Olympic và tuyển sinh chuyên Tin từ các kỳ thi trong hệ thống" />
      <div className="hsg-summary">
        <span><CheckCircle2 size={17} />Hoàn thành <strong>{data.exams.filter((exam) => Number(exam.progress_percent || 0) >= 100).length}</strong></span>
        <span><Clock size={17} />Đang làm <strong>{data.exams.filter((exam) => Number(exam.attempted_problems || 0) > 0 && Number(exam.progress_percent || 0) < 100).length}</strong></span>
        <span><BookOpen size={17} />Tổng đề <strong>{data.exams.length}</strong></span>
      </div>

      <div className="hsg-category-grid">
        {categoryRows.length === 0 ? (
          <div className="content-card empty-state hsg-empty-card">
            <FileQuestion size={34} />
            <h2>Chưa có dữ liệu HSG</h2>
            <p className="muted">Import dữ liệu mới để hiển thị nhóm đề, tiến độ và bảng đề thi.</p>
          </div>
        ) : categoryRows.map(({ category: item, exams }) => {
          const completed = exams.filter((exam) => Number(exam.progress_percent || 0) >= 100).length;
          const inProgress = exams.filter((exam) => Number(exam.attempted_problems || 0) > 0 && Number(exam.progress_percent || 0) < 100).length;
          const remaining = Math.max(0, exams.length - completed - inProgress);
          const solvedProblems = exams.reduce((sum, exam) => sum + Number(exam.solved_problems || 0), 0);
          const totalProblems = exams.reduce((sum, exam) => sum + Number(exam.total_problems || 0), 0);
          const completedProgress = exams.length > 0 ? Math.round((completed / exams.length) * 100) : 0;
          const solvedProgress = totalProblems > 0 ? Math.round((solvedProblems / totalProblems) * 100) : 0;
          return (
            <button
              key={item.id}
              className="hsg-category-card"
              style={{ '--hsg-color': item.color_config?.banner || '#2288ff' } as React.CSSProperties}
              type="button"
              onClick={() => setCategory(String(item.id))}
            >
              <span className="hsg-points">{exams.length} đề</span>
              <strong>{item.name}</strong>
              <small>{item.description || 'Học sinh giỏi các cấp'}</small>
              <div className="hsg-progress-line">
                <span>Hoàn thành đề</span>
                <b>{completedProgress}%</b>
              </div>
              <div className="hsg-meter"><i style={{ width: `${Math.min(completedProgress, 100)}%` }} /></div>
              <div className="hsg-progress-line">
                <span>Số bài đã làm</span>
                <b>{solvedProgress}%</b>
              </div>
              <div className="hsg-meter"><i style={{ width: `${Math.min(solvedProgress, 100)}%` }} /></div>
              <div className="hsg-card-stats">
                <span><b>{completed}</b>xong</span>
                <span><b>{inProgress}</b>đang làm</span>
                <span><b>{remaining}</b>chưa làm</span>
              </div>
            </button>
          );
        })}
      </div>

      <section className="hsg-filter-card">
        <label className="search-box">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên đề hoặc kỳ thi..." />
        </label>
        <Select
          label="Loại đề"
          value={category}
          onChange={setCategory}
          options={[['all', 'Tất cả'], ...categories.map((item) => [String(item.id), item.name] as [string, string])]}
        />
        <Select
          label="Năm"
          value={year}
          onChange={setYear}
          options={[['all', 'Tất cả'], ...years.map((item) => [item, item] as [string, string])]}
        />
        <label className="checkline hsg-checkline">
          <input type="checkbox" checked={hideCompleted} onChange={(event) => setHideCompleted(event.target.checked)} />
          Ẩn đề đã hoàn thành
        </label>
        <div className="hsg-filter-actions">
          <button className="ghost-button" type="button" onClick={() => { setQuery(''); setCategory('all'); setYear('all'); setHideCompleted(false); }}>Xóa lọc</button>
          <button className="blue-button" type="button">Lọc đề</button>
        </div>
      </section>

      <div className="hsg-result-head">
        <span>Trang {currentPage}/{totalPages} · {filteredExams.length} đề thi</span>
        <Pagination page={currentPage} totalPages={totalPages} onPage={setPage} totalItems={filteredExams.length} pageSize={pageSize} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} pageSizeOptions={[10, 20, 30, 50, 100]} />
      </div>
      <div className="hsg-table-wrap">
        <table className="hsg-table">
          <thead>
            <tr>
              <th>Đề thi</th>
              <th>Tiến độ của bạn</th>
              <th>Lời giải</th>
            </tr>
          </thead>
          <tbody>
            {visibleExams.length === 0 ? (
              <tr>
                <td colSpan={3} className="contest-empty">Chưa có dữ liệu đề thi.</td>
              </tr>
            ) : visibleExams.map((exam) => (
              <tr key={exam.id} onClick={() => go(`/contests/${exam.contest_slug}`)}>
                <td>
                  <button className="hsg-title-link" type="button">{exam.title}</button>
                  <div className="hsg-exam-meta">
                    <span>{exam.category_detail?.name || 'Đề thi'}</span>
                    <span>{exam.year}</span>
                    <span>{exam.exam_date}</span>
                    <span>{exam.total_problems} bài</span>
                  </div>
                </td>
                <td>
                  <div className="hsg-table-progress">
                    <i><b style={{ width: `${Math.min(Number(exam.progress_percent || 0), 100)}%` }} /></i>
                    <span>{exam.solved_problems}/{exam.total_problems} · {Math.round(Number(exam.progress_percent || 0))}%</span>
                  </div>
                </td>
                <td>{exam.solution_url ? <a href={exam.solution_url}>Xem ngay</a> : 'Chưa có'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={currentPage} totalPages={totalPages} onPage={setPage} totalItems={filteredExams.length} pageSize={pageSize} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} pageSizeOptions={[10, 20, 30, 50, 100]} />
    </div>
  );
}

type ChatGroupRow = {
  id: number;
  name: string;
  slug: string;
  description: string;
  type: string;
  memberCount: number;
  lastMessageAt: string;
  createdAt: string;
};

type ChatAdminRow = {
  id: number;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
};

type ChatMessageRow = {
  id: number;
  groupId: number;
  senderId: number;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  body: string;
  createdAt: string;
};

function mapChatGroup(row: Record<string, unknown>): ChatGroupRow {
  return {
    id: Number(row.id ?? 0) || 0,
    name: String(row.name || row.slug || 'Chat group'),
    slug: String(row.slug || row.id || '').trim(),
    description: String(row.description || '').trim(),
    type: String(row.type || row.kind || '').trim(),
    memberCount: Number(row.member_count ?? row.memberCount ?? 0) || 0,
    lastMessageAt: String(row.last_message_at || row.lastMessageAt || '').trim(),
    createdAt: String(row.created_at || row.createdAt || '').trim(),
  };
}

function mapChatAdmin(row: Record<string, unknown>): ChatAdminRow {
  const username = String(row.username || row.handle || 'admin');
  return {
    id: Number(row.id ?? row.user_id ?? row.userId ?? 0) || 0,
    username,
    fullName: String(row.full_name || row.fullName || username),
    avatarUrl: row.avatar_url || row.avatarUrl ? String(row.avatar_url || row.avatarUrl) : null,
    role: String(row.role || 'admin'),
  };
}

function mapChatMessage(row: Record<string, unknown>): ChatMessageRow {
  const username = String(row.username || row.sender_username || 'member');
  return {
    id: Number(row.id ?? 0) || 0,
    groupId: Number(row.group_id ?? row.groupId ?? 0) || 0,
    senderId: Number(row.sender_id ?? row.senderId ?? 0) || 0,
    username,
    fullName: String(row.full_name || row.fullName || username),
    avatarUrl: row.avatar_url || row.avatarUrl ? String(row.avatar_url || row.avatarUrl) : null,
    body: String(row.body || row.message || '').trim(),
    createdAt: String(row.created_at || row.createdAt || new Date().toISOString()),
  };
}

function formatChatTime(value: string, locale: CpproLocale) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function ChatPage({
  data,
  go,
  currentUser,
}: {
  data: CpproData;
  go: (path: string) => void;
  currentUser: StoredCpproUser | null;
}) {
  const locale = parseCpproPath(window.location.pathname).locale || readStoredLocale();
  const isEnglish = locale === 'en';
  const [groups, setGroups] = useState<ChatGroupRow[]>([]);
  const [admins, setAdmins] = useState<ChatAdminRow[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [chatError, setChatError] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [sending, setSending] = useState(false);
  const [openingAdminId, setOpeningAdminId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [manualMemberIds, setManualMemberIds] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const candidateUsers = data.users
    .filter((user) => user.username !== currentUser?.username && Number(user.id || 0) > 0)
    .slice(0, 24);
  const fallbackAdmins = data.users
    .filter((user) => Number(user.id || 0) > 0)
    .filter((user) => [user.rankName, user.proTier, ...(user.tags || []), ...(user.badges || [])]
      .some((value) => String(value || '').toLowerCase().includes('admin') || String(value || '').toLowerCase().includes('moderator')))
    .map((user) => ({
      id: Number(user.id || 0),
      username: user.username,
      fullName: user.fullName || user.username,
      avatarUrl: user.avatarUrl || null,
      role: user.rankName || 'admin',
    }))
    .slice(0, 24);
  const visibleAdmins = (admins.length ? admins : fallbackAdmins)
    .filter((admin) => admin.username !== currentUser?.username)
    .filter((admin) => {
      const needle = searchTerm.trim().toLowerCase();
      if (!needle) return true;
      return `${admin.username} ${admin.fullName} ${admin.role}`.toLowerCase().includes(needle);
    });
  const communityGroup = groups.find((group) => group.type === 'community' || group.slug === 'community') || groups[0] || null;
  const activeGroup = groups.find((group) => group.id === activeGroupId) || groups[0] || null;

  const loadGroups = async () => {
    if (!currentUser) return;
    setLoadingGroups(true);
    setChatError('');
    try {
      const payload = await cpproApiFetch<{ groups?: Record<string, unknown>[] }>('/social/chat-groups');
      const nextGroups = (Array.isArray(payload.groups) ? payload.groups : []).map(mapChatGroup).filter((group) => group.id > 0);
      setGroups(nextGroups);
      const nextCommunity = nextGroups.find((group) => group.type === 'community' || group.slug === 'community') || nextGroups[0] || null;
      setActiveGroupId((current) => (current && nextGroups.some((group) => group.id === current) ? current : nextCommunity?.id || null));
    } catch (error) {
      setChatError(error instanceof Error ? error.message : (isEnglish ? 'Could not load chat groups.' : 'Không tải được nhóm chat.'));
    } finally {
      setLoadingGroups(false);
    }
  };

  const loadAdmins = async () => {
    if (!currentUser) return;
    setLoadingAdmins(true);
    try {
      const payload = await cpproApiFetch<{ admins?: Record<string, unknown>[] }>('/social/chat-admins');
      setAdmins((Array.isArray(payload.admins) ? payload.admins : []).map(mapChatAdmin).filter((admin) => admin.id > 0));
    } catch {
      setAdmins([]);
    } finally {
      setLoadingAdmins(false);
    }
  };

  const loadMessages = async (groupId: number, silent = false) => {
    if (!currentUser || !groupId) return;
    if (!silent) setLoadingMessages(true);
    try {
      const payload = await cpproApiFetch<{ messages?: Record<string, unknown>[] }>(`/social/chat-groups/${groupId}/messages?limit=80`);
      setMessages((Array.isArray(payload.messages) ? payload.messages : []).map(mapChatMessage).filter((message) => message.id > 0));
    } catch (error) {
      if (!silent) setChatError(error instanceof Error ? error.message : (isEnglish ? 'Could not load messages.' : 'Không tải được tin nhắn.'));
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  useEffect(() => {
    setGroups([]);
    setAdmins([]);
    setMessages([]);
    setActiveGroupId(null);
    setChatError('');
    if (currentUser) {
      void loadGroups();
      void loadAdmins();
    }
  }, [currentUser?.username]);

  useEffect(() => {
    const groupId = activeGroup?.id;
    if (!currentUser || !groupId) {
      setMessages([]);
      return;
    }
    void loadMessages(groupId);
    const timer = window.setInterval(() => void loadMessages(groupId, true), 8000);
    return () => window.clearInterval(timer);
  }, [activeGroup?.id, currentUser?.username]);

  const toggleMember = (memberId: number) => {
    setSelectedMemberIds((current) => (
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]
    ));
  };

  const createGroup = async () => {
    if (creating) return;
    const typedIds = (manualMemberIds.match(/\d+/g) || []).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0);
    const memberIds = Array.from(new Set([...selectedMemberIds, ...typedIds]));
    if (draftName.trim().length < 3) {
      setChatError(isEnglish ? 'Chat group name must contain at least 3 characters.' : 'Tên nhóm chat cần ít nhất 3 ký tự.');
      return;
    }
    if (!memberIds.length) {
      setChatError(isEnglish ? 'Choose at least one member ID.' : 'Chọn ít nhất một ID thành viên.');
      return;
    }
    setCreating(true);
    setChatError('');
    try {
      const payload = await cpproApiFetch<{ group?: Record<string, unknown> }>('/social/chat-groups', {
        method: 'POST',
        body: JSON.stringify({
          name: draftName.trim(),
          description: draftDescription.trim() || undefined,
          memberIds,
        }),
      });
      const group = payload.group ? mapChatGroup(payload.group) : null;
      setDraftName('');
      setDraftDescription('');
      setManualMemberIds('');
      setSelectedMemberIds([]);
      await loadGroups();
      if (group?.id) setActiveGroupId(group.id);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : (isEnglish ? 'Could not create chat group.' : 'Không tạo được nhóm chat.'));
    } finally {
      setCreating(false);
    }
  };

  const openAdminChat = async (admin: ChatAdminRow) => {
    if (!admin.id || openingAdminId) return;
    setOpeningAdminId(admin.id);
    setChatError('');
    try {
      const payload = await cpproApiFetch<{ group?: Record<string, unknown> }>('/social/chat-groups/direct', {
        method: 'POST',
        body: JSON.stringify({ userId: admin.id }),
      });
      const group = payload.group ? mapChatGroup(payload.group) : null;
      if (group?.id) {
        setGroups((current) => {
          const exists = current.some((item) => item.id === group.id);
          return exists ? current.map((item) => (item.id === group.id ? group : item)) : [group, ...current];
        });
        setActiveGroupId(group.id);
        await loadMessages(group.id);
        void loadGroups();
      }
    } catch (error) {
      setChatError(error instanceof Error ? error.message : (isEnglish ? 'Could not open admin chat.' : 'Không mở được chat với admin.'));
    } finally {
      setOpeningAdminId(null);
    }
  };

  const sendMessage = async () => {
    const groupId = activeGroup?.id;
    const body = messageBody.trim();
    if (!groupId || !body || sending) return;
    setSending(true);
    setChatError('');
    try {
      await cpproApiFetch(`/social/chat-groups/${groupId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      setMessageBody('');
      await loadMessages(groupId, true);
      void loadGroups();
    } catch (error) {
      setChatError(error instanceof Error ? error.message : (isEnglish ? 'Could not send message.' : 'Không gửi được tin nhắn.'));
    } finally {
      setSending(false);
    }
  };

  if (!currentUser) {
    return (
      <section className="cppro-chat-page" data-cppro-chat-page>
        <PageTitle
          icon={<MessageCircle />}
          title={isEnglish ? 'Chat' : 'Chat'}
          subtitle={isEnglish ? 'Sign in to join the community room and contact administrators.' : 'Đăng nhập để vào Sảnh chung và nhắn với quản trị viên.'}
          right={<button className="blue-button" type="button" onClick={() => go(authPathWithReturn('login'))}><LogIn size={16} />{t(locale, 'settings.signIn')}</button>}
        />
        <section className="cppro-chat-login">
          <MessageSquare size={36} />
          <h2>{isEnglish ? 'Community chat is ready' : 'Chat cộng đồng đã sẵn sàng'}</h2>
          <p>{isEnglish ? 'Messages are stored in the database. Join the public room or contact the admin list after signing in.' : 'Tin nhắn được lưu trong database. Sau khi đăng nhập bạn có thể vào Sảnh chung hoặc liên hệ danh sách admin.'}</p>
        </section>
      </section>
    );
  }

  return (
    <section className="cppro-chat-page" data-cppro-chat-page>
      <PageTitle
        icon={<MessageCircle />}
        title={isEnglish ? 'Chat' : 'Chat'}
        subtitle={isEnglish ? 'Community room and administrator contacts.' : 'Sảnh chung cộng đồng và danh sách quản trị viên.'}
        right={<button className="soft-button" type="button" onClick={() => { void loadGroups(); void loadAdmins(); }} disabled={loadingGroups || loadingAdmins}><Loader2 size={16} />{isEnglish ? 'Refresh' : 'Làm mới'}</button>}
      />

      <section className="cppro-chat-shell">
        <aside className="cppro-chat-sidebar">
          <div className="cppro-chat-sidebar-head">
            <strong>{isEnglish ? 'Community chat' : 'Chat cộng đồng'}</strong>
            <span>{groups.length}</span>
          </div>
          <label className="cppro-chat-search">
            <Search size={17} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.currentTarget.value)}
              placeholder={isEnglish ? 'Search by name...' : 'Tìm kiếm theo tên...'}
            />
          </label>
          <div className="cppro-chat-group-list">
            {loadingGroups ? <div className="cppro-chat-empty"><Loader2 size={18} />{isEnglish ? 'Loading groups...' : 'Đang tải nhóm...'}</div> : null}
            {!loadingGroups && groups.length === 0 ? (
              <div className="cppro-chat-empty"><Inbox size={20} />{isEnglish ? 'No chat groups yet.' : 'Chưa có nhóm chat.'}</div>
            ) : groups
              .filter((group) => {
                const needle = searchTerm.trim().toLowerCase();
                if (!needle) return true;
                return `${group.name} ${group.description} ${group.slug}`.toLowerCase().includes(needle);
              })
              .map((group) => (
              <button
                key={group.id}
                type="button"
                className={group.id === communityGroup?.id ? 'cppro-chat-community-button' : undefined}
                data-active={activeGroup?.id === group.id ? 'true' : 'false'}
                onClick={() => setActiveGroupId(group.id)}
              >
                <span>{group.id === communityGroup?.id ? <Globe size={17} /> : <MessageSquare size={17} />}</span>
                <strong>{group.id === communityGroup?.id ? (isEnglish ? 'Community lobby' : 'Sảnh chung') : group.name}</strong>
                <small>{group.memberCount} {isEnglish ? 'members' : 'thành viên'}</small>
                {group.lastMessageAt ? <time>{formatChatTime(group.lastMessageAt, locale)}</time> : null}
              </button>
            ))}
          </div>

          <div className="cppro-chat-admin-panel">
            <p><ShieldCheck size={14} />Admin</p>
            {loadingAdmins ? <div className="cppro-chat-empty cppro-chat-inline-loading"><Loader2 size={16} />{isEnglish ? 'Loading admins...' : 'Đang tải admin...'}</div> : null}
            {!loadingAdmins && visibleAdmins.length === 0 ? (
              <div className="cppro-chat-empty"><Inbox size={18} />{isEnglish ? 'No admins found.' : 'Chưa tìm thấy admin.'}</div>
            ) : visibleAdmins.map((admin) => (
              <button
                key={admin.id || admin.username}
                type="button"
                className="cppro-chat-admin-button"
                disabled={openingAdminId === admin.id}
                onClick={() => void openAdminChat(admin)}
              >
                <span className="cppro-chat-avatar">
                  {admin.avatarUrl ? <img src={admin.avatarUrl} alt="" /> : <b>{(admin.fullName || admin.username).trim()[0]?.toUpperCase() || 'A'}</b>}
                </span>
                <strong>{admin.fullName || admin.username}</strong>
                <small>@{admin.username}</small>
                {openingAdminId === admin.id ? <Loader2 size={14} /> : null}
              </button>
            ))}
          </div>

          <div className="cppro-chat-create">
            <strong>{isEnglish ? 'New group' : 'Tạo nhóm mới'}</strong>
            <label>
              <span>{isEnglish ? 'Name' : 'Tên nhóm'}</span>
              <input value={draftName} onChange={(event) => setDraftName(event.currentTarget.value)} placeholder={isEnglish ? 'Study room' : 'Nhóm luyện tập'} />
            </label>
            <label>
              <span>{isEnglish ? 'Description' : 'Mô tả'}</span>
              <input value={draftDescription} onChange={(event) => setDraftDescription(event.currentTarget.value)} placeholder={isEnglish ? 'Optional' : 'Không bắt buộc'} />
            </label>
            {candidateUsers.length ? (
              <div className="cppro-chat-member-picker">
                {candidateUsers.map((user) => {
                  const memberId = Number(user.id || 0);
                  const active = selectedMemberIds.includes(memberId);
                  return (
                    <button key={user.username} type="button" data-active={active ? 'true' : 'false'} onClick={() => toggleMember(memberId)}>
                      <Avatar user={user} />
                      <span>{user.fullName || user.username}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            <label>
              <span>{isEnglish ? 'Member IDs' : 'ID thành viên'}</span>
              <input value={manualMemberIds} onChange={(event) => setManualMemberIds(event.currentTarget.value)} placeholder="12, 25, 31" />
            </label>
            <button className="blue-button" type="button" onClick={() => void createGroup()} disabled={creating}>
              <PenLine size={15} />{creating ? (isEnglish ? 'Creating...' : 'Đang tạo...') : (isEnglish ? 'Create group' : 'Tạo nhóm')}
            </button>
          </div>
        </aside>

        <main className="cppro-chat-room">
          <header>
            <span>{activeGroup?.id === communityGroup?.id ? <Globe size={20} /> : <MessageCircle size={20} />}</span>
            <div>
              <strong>{activeGroup?.id === communityGroup?.id ? (isEnglish ? 'Community lobby' : 'Sảnh chung') : activeGroup?.name || (isEnglish ? 'Select a conversation' : 'Chọn cuộc trò chuyện')}</strong>
              <small>{activeGroup?.description || (activeGroup ? `${activeGroup.memberCount} ${isEnglish ? 'members' : 'thành viên'}` : (isEnglish ? 'Choose the community room or an administrator.' : 'Chọn Sảnh chung hoặc một quản trị viên.'))}</small>
            </div>
          </header>
          {chatError ? <div className="service-message cppro-chat-error">{chatError}</div> : null}
          <div className="cppro-chat-messages" data-chat-messages>
            {loadingMessages ? <div className="cppro-chat-empty"><Loader2 size={18} />{isEnglish ? 'Loading messages...' : 'Đang tải tin nhắn...'}</div> : null}
            {!loadingMessages && activeGroup && messages.length === 0 ? (
              <div className="cppro-chat-empty"><MessageSquare size={22} />{isEnglish ? 'No messages in this group yet.' : 'Nhóm này chưa có tin nhắn.'}</div>
            ) : null}
            {!activeGroup ? (
              <div className="cppro-chat-empty"><Inbox size={24} />{isEnglish ? 'Choose a group from the left.' : 'Chọn một nhóm ở cột trái.'}</div>
            ) : messages.map((message) => {
              const mine = message.username === currentUser.username;
              return (
                <article key={message.id} data-mine={mine ? 'true' : 'false'}>
                  <span className="cppro-chat-avatar">
                    {message.avatarUrl ? <img src={message.avatarUrl} alt="" /> : <b>{(message.fullName || message.username).trim()[0]?.toUpperCase() || 'U'}</b>}
                  </span>
                  <div>
                    <small><strong>{message.fullName || message.username}</strong><time>{formatChatTime(message.createdAt, locale)}</time></small>
                    <p>{message.body}</p>
                  </div>
                </article>
              );
            })}
          </div>
          <footer className="cppro-chat-composer">
            <textarea
              value={messageBody}
              onChange={(event) => setMessageBody(event.currentTarget.value)}
              disabled={!activeGroup || sending}
              rows={3}
              maxLength={2000}
              placeholder={activeGroup ? (isEnglish ? 'Write a message...' : 'Nhập tin nhắn...') : (isEnglish ? 'Select a group first' : 'Chọn nhóm trước')}
            />
            <button className="blue-button" type="button" disabled={!activeGroup || !messageBody.trim() || sending} onClick={() => void sendMessage()}>
              <Send size={16} />{sending ? (isEnglish ? 'Sending...' : 'Đang gửi...') : (isEnglish ? 'Send' : 'Gửi')}
            </button>
          </footer>
        </main>
      </section>
    </section>
  );
}

type ExplorePageKind = 'about' | 'achievements' | 'mentors' | 'alumni' | 'contact' | 'theme';

function userHasExploreBadge(user: UserRow, label: string) {
  const normalized = label.toLowerCase();
  return [...(user.badges || []), ...(user.tags || []), user.rankName, user.proTier]
    .some((value) => String(value || '').toLowerCase().includes(normalized));
}

function ExploreUserGrid({
  users,
  go,
  emptyText,
}: {
  users: UserRow[];
  go: (path: string) => void;
  emptyText: string;
}) {
  if (!users.length) {
    return <div className="content-card empty-state"><UsersRound size={32} /><p>{emptyText}</p></div>;
  }
  return (
    <div className="cppro-explore-people">
      {users.map((user, index) => (
        <button key={user.username} type="button" onClick={() => go(`/users/${user.username}`)}>
          <span className="cppro-explore-rank">{index + 1}</span>
          <Avatar user={user} large />
          <span>
            <strong>{user.fullName || user.username}</strong>
            <small>@{user.username}</small>
            <UserBadges user={user} />
          </span>
          <dl>
            <div><dt>Rating</dt><dd>{Number(user.rating || 0).toLocaleString('vi-VN')}</dd></div>
            <div><dt>Solved</dt><dd>{Number(user.solved || 0).toLocaleString('vi-VN')}</dd></div>
          </dl>
        </button>
      ))}
    </div>
  );
}

function ExplorePage({
  kind,
  data,
  go,
}: {
  kind: ExplorePageKind;
  data: CpproData;
  go: (path: string) => void;
}) {
  const locale = parseCpproPath(window.location.pathname).locale;
  const isEnglish = locale === 'en';
  const brand = data.contact.brandName || defaultFooterContactSettings.brandName;
  const rankedUsers = [...data.users].sort((left, right) => (
    Number(right.rating || 0) - Number(left.rating || 0)
    || Number(right.solved || 0) - Number(left.solved || 0)
  ));
  const mentors = rankedUsers.filter((user) => (
    userHasExploreBadge(user, 'teacher') || userHasExploreBadge(user, 'admin')
  )).slice(0, 18);
  const alumni = [...data.users].filter((user) => Number(user.solved || 0) > 0).sort((left, right) => (
    Number(right.solved || 0) - Number(left.solved || 0)
    || Number(right.rating || 0) - Number(left.rating || 0)
  )).slice(0, 18);
  const pageCopy: Record<ExplorePageKind, { title: string; subtitle: string; icon: React.ReactNode }> = isEnglish ? {
    about: { title: `About ${brand}`, subtitle: 'A focused Online Judge for practice, contests, courses and measurable progress.', icon: <ShieldCheck /> },
    achievements: { title: 'Student achievements', subtitle: 'Live ranking highlights calculated from the current platform database.', icon: <Trophy /> },
    mentors: { title: 'Mentors', subtitle: 'Administrators and teachers who guide the learning community.', icon: <GraduationCap /> },
    alumni: { title: 'Outstanding learners', subtitle: 'Members with strong problem-solving records and consistent practice.', icon: <Award /> },
    contact: { title: 'Contact and support', subtitle: 'Reach the team or create a tracked support request.', icon: <MessageSquare /> },
    theme: { title: 'LQDOJ theme crawl', subtitle: 'A crawl status page for the public LQDOJ theme endpoint and ITCoder theme shortcuts.', icon: <Palette /> },
  } : {
    about: { title: `Giới thiệu ${brand}`, subtitle: 'Online Judge tập trung vào luyện tập, kỳ thi, khóa học và tiến bộ có thể đo lường.', icon: <ShieldCheck /> },
    achievements: { title: 'Thành tích học viên', subtitle: 'Bảng vàng được tính trực tiếp từ dữ liệu hiện tại của hệ thống.', icon: <Trophy /> },
    mentors: { title: 'Đội ngũ giảng viên', subtitle: 'Quản trị viên và giáo viên đồng hành cùng cộng đồng học tập.', icon: <GraduationCap /> },
    alumni: { title: 'Gương mặt tiêu biểu', subtitle: 'Những thành viên có thành tích giải bài và luyện tập nổi bật.', icon: <Award /> },
    contact: { title: 'Liên hệ và hỗ trợ', subtitle: 'Liên hệ đội ngũ hoặc tạo yêu cầu hỗ trợ được theo dõi trong hệ thống.', icon: <MessageSquare /> },
    theme: { title: 'Crawl giao diện LQDOJ', subtitle: 'Trang trạng thái crawl endpoint theme của LQDOJ và lối tắt giao diện ITCoder.', icon: <Palette /> },
  };
  const copy = pageCopy[kind];

  return (
    <section className="cppro-explore-page" data-cppro-explore-page={kind}>
      <PageTitle
        icon={copy.icon}
        title={copy.title}
        subtitle={copy.subtitle}
        right={<button className="soft-button" type="button" onClick={() => go('/')}>{isEnglish ? 'Home' : 'Trang chủ'}</button>}
      />

      {kind === 'about' ? (
        <>
          <section className="cppro-explore-hero">
            <div>
              <span className="home-chip"><Code2 size={15} />Online Judge</span>
              <h2>{isEnglish ? 'Learn deliberately. Compete fairly. Improve every day.' : 'Học có lộ trình. Thi công bằng. Tiến bộ mỗi ngày.'}</h2>
              <p>{isEnglish
                ? `${brand} connects a real judging system with structured practice, contests, community discussion and personal progress.`
                : `${brand} kết nối hệ thống chấm bài thật với lộ trình luyện tập, kỳ thi, thảo luận cộng đồng và tiến bộ cá nhân.`}</p>
              <div>
                <button className="blue-button" type="button" onClick={() => go('/problems')}><CodeXml size={16} />{isEnglish ? 'Explore problems' : 'Khám phá bài tập'}</button>
                <button className="soft-button" type="button" onClick={() => go('/courses')}><BookOpen size={16} />{isEnglish ? 'View courses' : 'Xem khóa học'}</button>
              </div>
            </div>
            <div className="cppro-explore-metrics">
              <article><strong>{Number(data.stats.problems || data.problems.length).toLocaleString('vi-VN')}</strong><small>{isEnglish ? 'Problems' : 'Bài tập'}</small></article>
              <article><strong>{Number(data.stats.contests || data.contests.length).toLocaleString('vi-VN')}</strong><small>{isEnglish ? 'Contests' : 'Kỳ thi'}</small></article>
              <article><strong>{Number(data.stats.users || data.users.length).toLocaleString('vi-VN')}</strong><small>{isEnglish ? 'Learners' : 'Học viên'}</small></article>
              <article><strong>{Number(data.stats.submissions || data.submissions.length).toLocaleString('vi-VN')}</strong><small>{isEnglish ? 'Submissions' : 'Bài nộp'}</small></article>
            </div>
          </section>
          <section className="cppro-explore-feature-grid">
            {[
              [<Terminal size={20} />, isEnglish ? 'Real judge' : 'Máy chấm thật', isEnglish ? 'Detailed verdicts, scores and testcase progress.' : 'Kết quả, điểm và tiến độ testcase rõ ràng.'],
              [<Trophy size={20} />, isEnglish ? 'Contest ready' : 'Sẵn sàng cho kỳ thi', isEnglish ? 'ICPC, IOI and virtual participation workflows.' : 'Luồng thi ICPC, IOI và thi ảo đầy đủ.'],
              [<UsersRound size={20} />, isEnglish ? 'Learning community' : 'Cộng đồng học tập', isEnglish ? 'Threaded discussion, reactions and mentor badges.' : 'Thảo luận nhiều cấp, cảm xúc và huy hiệu giảng viên.'],
              [<ChartColumn size={20} />, isEnglish ? 'Visible progress' : 'Tiến bộ trực quan', isEnglish ? 'Rating, solved problems, streaks and activity history.' : 'Rating, bài đã giải, streak và lịch sử hoạt động.'],
            ].map(([icon, title, body]) => (
              <article key={String(title)}><span>{icon}</span><strong>{title}</strong><p>{body}</p></article>
            ))}
          </section>
        </>
      ) : null}

      {kind === 'theme' ? (
        <section className="cppro-theme-crawl">
          <article className="cppro-theme-crawl-hero">
            <span className="home-chip"><Palette size={15} />LQDOJ</span>
            <h2>{isEnglish ? 'Theme endpoint is protected by login' : 'Endpoint theme đang yêu cầu đăng nhập'}</h2>
            <p>{isEnglish
              ? 'The latest crawl reached the LQDOJ login page instead of the private /theme/ content, so ITCoder stores the crawl status and links back to the source safely.'
              : 'Lượt crawl mới nhất đi tới trang đăng nhập LQDOJ thay vì nội dung riêng của /theme/, nên ITCoder lưu trạng thái crawl và dẫn về nguồn an toàn.'}</p>
            <div>
              <a className="blue-button" href="https://lqdoj.edu.vn/theme/" target="_blank" rel="noreferrer">
                <ExternalLink size={16} />{isEnglish ? 'Open LQDOJ theme' : 'Mở theme LQDOJ'}
              </a>
              <button className="soft-button" type="button" onClick={() => go('/settings')}>
                <Palette size={16} />{isEnglish ? 'ITCoder theme settings' : 'Cài đặt giao diện ITCoder'}
              </button>
            </div>
          </article>
          <aside className="cppro-theme-crawl-status">
            <strong>{isEnglish ? 'Crawl snapshot' : 'Snapshot crawl'}</strong>
            <dl>
              <div><dt>{isEnglish ? 'Source' : 'Nguồn'}</dt><dd>https://lqdoj.edu.vn/theme/</dd></div>
              <div><dt>{isEnglish ? 'Final URL' : 'URL cuối'}</dt><dd>/login?next=/theme/</dd></div>
              <div><dt>{isEnglish ? 'Status' : 'Trạng thái'}</dt><dd>{isEnglish ? 'Login required' : 'Cần đăng nhập'}</dd></div>
              <div><dt>{isEnglish ? 'Saved in crawl branch' : 'Đã lưu ở branch crawl'}</dt><dd>cloned_site/lqdoj.edu.vn/theme</dd></div>
            </dl>
          </aside>
        </section>
      ) : null}

      {kind === 'achievements' ? (
        <ExploreUserGrid users={rankedUsers.slice(0, 18)} go={go} emptyText={isEnglish ? 'No ranking data is available yet.' : 'Chưa có dữ liệu bảng vàng.'} />
      ) : null}
      {kind === 'mentors' ? (
        <ExploreUserGrid users={mentors} go={go} emptyText={isEnglish ? 'No mentor profiles are available yet.' : 'Chưa có hồ sơ giảng viên.'} />
      ) : null}
      {kind === 'alumni' ? (
        <ExploreUserGrid users={alumni} go={go} emptyText={isEnglish ? 'No learner highlights are available yet.' : 'Chưa có dữ liệu học viên tiêu biểu.'} />
      ) : null}

      {kind === 'contact' ? (
        <div className="cppro-explore-contact">
          <section>
            <span><Mail size={22} /></span>
            <h2>{isEnglish ? 'Send a support request' : 'Gửi yêu cầu hỗ trợ'}</h2>
            <p>{isEnglish ? 'Requests are stored in the database so administrators can track and respond to them.' : 'Yêu cầu được lưu vào database để quản trị viên theo dõi và phản hồi.'}</p>
            <button className="blue-button" type="button" onClick={() => go('/feedback')}><Send size={16} />{isEnglish ? 'Create request' : 'Tạo yêu cầu'}</button>
          </section>
          <section className="cppro-explore-contact-list">
            {(data.contact.emails || []).map((email) => <a key={email} href={`mailto:${email}`}><Mail size={17} /><span><small>Email</small><strong>{email}</strong></span></a>)}
            {(data.contact.phones || []).map((phone) => <a key={phone} href={`tel:${phone.replace(/\s+/g, '')}`}><Phone size={17} /><span><small>{isEnglish ? 'Phone' : 'Điện thoại'}</small><strong>{phone}</strong></span></a>)}
            {data.contact.location ? <div><MapPin size={17} /><span><small>{isEnglish ? 'Location' : 'Địa chỉ'}</small><strong>{data.contact.location}</strong></span></div> : null}
            <button type="button" onClick={() => go('/organizations')}><GraduationCap size={17} /><span><small>{isEnglish ? 'Community' : 'Cộng đồng'}</small><strong>{isEnglish ? 'Organizations' : 'Tổ chức'}</strong></span></button>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function CoursesPage({ data }: { data: CpproData }) {
  const courses = data.courses || [];
  return (
    <section className="courses-page">
      <h1>Khóa Học Khác</h1>
      <div className="course-grid">
        {courses.length === 0 ? (
          <div className="content-card empty-state">
            <FileQuestion size={34} />
            <h2>Chưa có dữ liệu khóa học</h2>
            <p className="muted">Import dữ liệu mới để hiển thị khóa học.</p>
          </div>
        ) : courses.map((course, index) => (
          <div key={course.id} className="course-card" data-course-card style={{ '--course-color': course.theme_color } as React.CSSProperties}>
            <div className="course-banner">
              <img src={course.bannerLocal || course.banner} alt="" />
              <span>{`{${compactBrandMark(data.contact.brandName)}}`}</span>
            </div>
            <div className="course-body">
              <strong>{course.name}</strong>
              <p>{course.short_description}</p>
              <div className="course-meta">
                <span><CalendarDays size={18} /><span className="course-meta-text">Lịch học: <b>{course.schedule_note}</b></span></span>
                <span><Clock size={18} /><span className="course-meta-text">Giờ học: <b>19h30 - 21h30</b></span></span>
                <span><Zap size={18} /><span className="course-meta-text">Thời lượng: <b>{course.duration_months} tháng ({course.sessions_per_month} buổi/tháng)</b></span></span>
                <span><Code2 size={18} /><span className="course-meta-text">Thực hành: <b>600+ bài tập</b></span></span>
              </div>
              <a className="course-price-box" href={safeExternalHref(course.url_apply, `/courses/${course.slug}/preview`)} target="_blank" rel="noreferrer">
                <small>Ưu đãi đăng ký sớm</small>
                <div>
                  <strong>{formatPrice(course.price)}</strong>
                  <span>{formatPrice(course.price * 1.2)}</span>
                  <em>/ tháng</em>
                </div>
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

type ServiceKind = 'notifications' | 'settings' | 'payment-history' | 'wardrobe' | 'feedback';

function ServicePage({
  kind,
  data,
  go,
  currentUser,
  onUserUpdate,
}: {
  kind: ServiceKind;
  data: CpproData;
  go: (path: string) => void;
  currentUser: StoredCpproUser | null;
  onUserUpdate: (user: StoredCpproUser) => void;
}) {
  const locale = parseCpproPath(window.location.pathname).locale || readStoredLocale();
  const topUser = data.users.find((user) => user.username.toLowerCase() === currentUser?.username.toLowerCase()) || data.users[0];
  const fallbackUser: UserRow = {
    username: 'member',
    fullName: `${data.contact.brandName || defaultFooterContactSettings.brandName} member`,
    rating: 0,
    score: 0,
    solved: 0,
    streak: 1,
    maxStreak: 1,
    rankName: 'Newbie',
    tags: [],
    proTier: '',
  };
  const recentSubmissions = data.submissions.slice(0, 5);
  const recentContests = data.contests.slice(0, 4);
  const activeCourse = data.courses[0];
  const config = servicePageConfig[kind];
  const Icon = config.icon;
  const feedbackQuery = kind === 'feedback' ? new URLSearchParams(window.location.search) : null;
  const feedbackTitle = feedbackQuery?.get('title') || `Góp ý giao diện ${data.contact.brandName || defaultFooterContactSettings.brandName}`;
  const feedbackProblem = feedbackQuery?.get('problem') || '';
  const feedbackBody = feedbackProblem
    ? `Problem slug: ${feedbackProblem}\n\nMô tả lỗi, kết quả mong đợi và cách tái hiện.`
    : 'Mô tả lỗi, kỳ vọng và đường dẫn cần kiểm tra.';
  const [feedbackTitleValue, setFeedbackTitleValue] = useState(feedbackTitle);
  const [feedbackBodyValue, setFeedbackBodyValue] = useState(feedbackBody);
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [timezoneOptions, setTimezoneOptions] = useState<string[]>([]);
  const [timezoneDraft, setTimezoneDraft] = useState(currentUser?.streak_timezone || 'Asia/Bangkok');
  const [timezoneBusy, setTimezoneBusy] = useState(false);
  const [timezoneMessage, setTimezoneMessage] = useState('');
  const [timezoneNow, setTimezoneNow] = useState(() => new Date());

  useEffect(() => {
    if (kind !== 'feedback') return;
    setFeedbackTitleValue(feedbackTitle);
    setFeedbackBodyValue(feedbackBody);
    setFeedbackMessage('');
  }, [feedbackBody, feedbackTitle, kind]);

  useEffect(() => {
    if (kind !== 'settings') return;
    const timer = window.setInterval(() => setTimezoneNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [kind]);

  useEffect(() => {
    if (kind !== 'settings' || !currentUser) return;
    let cancelled = false;
    setTimezoneDraft(currentUser.streak_timezone || 'Asia/Bangkok');
    setTimezoneMessage('');
    cpproApiFetch<{ timezones?: string[] }>('/auth/timezone-options')
      .then((payload) => {
        if (!cancelled) setTimezoneOptions(Array.isArray(payload.timezones) ? payload.timezones : []);
      })
      .catch((error) => {
        if (!cancelled) setTimezoneMessage(error instanceof Error ? error.message : t(locale, 'settings.timezoneLoadFailed'));
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.streak_timezone, currentUser?.username, kind, locale]);

  const submitFeedback = async () => {
    if (!feedbackTitleValue.trim() || !feedbackBodyValue.trim() || feedbackSending) return;
    setFeedbackSending(true);
    setFeedbackMessage('');
    try {
      await cpproApiFetch('/tickets', {
        method: 'POST',
        body: JSON.stringify({
          title: feedbackTitleValue.trim(),
          body: feedbackBodyValue.trim(),
          category: 'bug_report',
          priority: feedbackProblem ? 'high' : 'normal',
          metadata: {
            source: 'cppro-feedback',
            path: window.location.pathname,
            problem: feedbackProblem || undefined,
          },
        }),
      });
      setFeedbackMessage('Đã gửi phản hồi. Quản trị viên sẽ kiểm tra trong trang quản trị.');
    } catch (error: any) {
      setFeedbackMessage(error?.message || 'Không gửi được phản hồi. Vui lòng đăng nhập rồi thử lại.');
    } finally {
      setFeedbackSending(false);
    }
  };

  const saveTimezone = async () => {
    if (!currentUser || timezoneBusy || !timezoneDraft) return;
    setTimezoneBusy(true);
    setTimezoneMessage('');
    try {
      const updated = await cpproApiFetch<AuthUser>('/auth/streak-timezone', {
        method: 'PATCH',
        body: JSON.stringify({ timezone: timezoneDraft }),
      });
      const stored = {
        ...currentUser,
        streak_timezone: updated.streak_timezone || timezoneDraft,
        streak_timezone_changed_at: updated.streak_timezone_changed_at || currentUser.streak_timezone_changed_at || null,
      };
      onUserUpdate(stored);
      setTimezoneDraft(stored.streak_timezone || timezoneDraft);
      setTimezoneMessage(t(locale, 'settings.timezoneSaved'));
    } catch (error) {
      setTimezoneMessage(error instanceof Error ? error.message : t(locale, 'settings.timezoneSaveFailed'));
    } finally {
      setTimezoneBusy(false);
    }
  };

  return (
    <section className="service-page">
      <PageTitle icon={<Icon size={22} />} title={config.title} subtitle={config.subtitle} />

      <div className="service-grid">
        <article className="service-hero-card">
          <div className="service-hero-icon"><Icon size={30} /></div>
          <span className="home-chip">{config.eyebrow}</span>
          <h2>{config.heading}</h2>
          <p>{config.description}</p>
          <div className="service-actions">
            {config.actions.map((action) => (
              <button key={action.label} className={action.primary ? 'blue-button' : 'soft-button'} type="button" onClick={() => go(action.path)}>
                {action.label}
              </button>
            ))}
          </div>
        </article>

        <aside className="service-profile-card">
          <Avatar user={topUser || fallbackUser} large />
          <strong>{topUser?.fullName || `${data.contact.brandName || defaultFooterContactSettings.brandName} member`}</strong>
          <span>@{topUser?.username || 'cppro'}</span>
          <UserBadges user={topUser || fallbackUser} />
          <div className="service-profile-stats">
            <span><b>{topUser?.solved || 0}</b><small>Đã giải</small></span>
            <span><b>{topUser?.rating || 0}</b><small>Rating</small></span>
            <span><b>{topUser?.streak || 1}</b><small>Streak</small></span>
          </div>
        </aside>
      </div>

      {kind === 'notifications' && (
        <div className="service-two-col">
          <ServicePanel title="Thông báo mới" icon={<Inbox size={18} />}>
            {recentSubmissions.length === 0 ? (
              <div className="service-empty">Chưa có dữ liệu bài nộp.</div>
            ) : recentSubmissions.map((item) => (
              <button key={item.id} className="service-feed-row" type="button" onClick={() => go(`/problems/${item.problemSlug}`)}>
                <span className={`verdict-dot ${item.verdict.toLowerCase()}`}>{item.verdict}</span>
                <span>
                  <strong>{item.problemTitle}</strong>
                  <small>{item.username} · {item.language} · {item.score}/{item.maxScore}</small>
                </span>
              </button>
            ))}
          </ServicePanel>
          <ServicePanel title="Kỳ thi đang theo dõi" icon={<Trophy size={18} />}>
            {recentContests.length === 0 ? (
              <div className="service-empty">Chưa có dữ liệu kỳ thi.</div>
            ) : recentContests.map((contest) => (
              <button key={contest.slug} className="service-feed-row" type="button" onClick={() => go(`/contests/${contest.slug}`)}>
                <span className="service-mini-icon"><CalendarDays size={15} /></span>
                <span>
                  <strong>{contest.title}</strong>
                  <small>{contest.participants} thành viên · {contest.problemCount} bài</small>
                </span>
              </button>
            ))}
          </ServicePanel>
        </div>
      )}

      {kind === 'settings' && (
        <>
        <section className="settings-timezone-card" data-timezone-settings>
          <div className="settings-timezone-head">
            <span><Globe size={21} /></span>
            <div>
              <strong>{t(locale, 'settings.timezoneTitle')}</strong>
              <small>{t(locale, 'settings.timezoneSubtitle')}</small>
            </div>
          </div>
          {currentUser ? (
            <>
              <div className="settings-timezone-grid">
                <label>
                  {t(locale, 'settings.timezoneLabel')}
                  <select value={timezoneDraft} onChange={(event) => {
                    setTimezoneDraft(event.target.value);
                    setTimezoneMessage('');
                  }}>
                    {([...(timezoneOptions.length ? timezoneOptions : defaultTimezoneOptions), currentUser.streak_timezone || 'Asia/Bangkok']
                      .filter((value, index, values) => value && values.indexOf(value) === index)
                      .map((timezone) => <option key={timezone} value={timezone}>{formatTimezoneOptionLabel(timezone, timezoneNow)}</option>))}
                  </select>
                </label>
                <div className="settings-timezone-clock">
                  <span><Clock size={17} />{t(locale, 'settings.timezoneSelected')}</span>
                  <strong>{formatTimeInZone(timezoneDraft, timezoneNow)}</strong>
                  <small>{timezoneDraft}</small>
                </div>
                <div className="settings-timezone-clock">
                  <span><Globe size={17} />{t(locale, 'settings.timezoneUtc')}</span>
                  <strong>{formatTimeInZone('UTC', timezoneNow)}</strong>
                  <small>UTC</small>
                </div>
              </div>
              <div className="settings-timezone-actions">
                <p>
                  {t(locale, 'settings.timezoneLimit')}
                  {currentUser.streak_timezone_changed_at
                    ? t(locale, 'settings.timezoneLastChanged').replace('{time}', formatUtcDateTime(currentUser.streak_timezone_changed_at))
                    : ''}
                </p>
                {timezoneMessage ? <span role="status">{timezoneMessage}</span> : null}
                <button className="blue-button" type="button" disabled={timezoneBusy || timezoneDraft === (currentUser.streak_timezone || 'Asia/Bangkok')} onClick={() => void saveTimezone()}>
                  <CheckCircle2 size={16} />{timezoneBusy ? t(locale, 'settings.timezoneSaving') : t(locale, 'settings.timezoneSave')}
                </button>
              </div>
            </>
          ) : (
            <div className="settings-timezone-login">
              <p>{t(locale, 'settings.timezoneLogin')}</p>
            <button className="blue-button" type="button" onClick={() => go(authPathWithReturn('login'))}><LogIn size={16} />{t(locale, 'settings.signIn')}</button>
            </div>
          )}
        </section>
        <div className="settings-board">
          {[
            ['Hồ sơ', 'Tên hiển thị, ảnh đại diện và hồ sơ công khai.', <CircleUserRound size={18} />],
            ['Bảo mật', 'Mật khẩu, phiên đăng nhập và thiết bị tin cậy.', <ShieldCheck size={18} />],
            ['Giao diện', 'Light, dark và system mode cho không gian luyện tập.', <Palette size={18} />],
            ['Thông báo', 'Email, contest reminder và trạng thái bài nộp.', <Bell size={18} />],
          ].map(([title, body, icon]) => (
            <article key={String(title)} className="settings-tile">
              <span>{icon as React.ReactNode}</span>
              <strong>{title}</strong>
              <p>{body}</p>
              <button className="soft-button" type="button">Cập nhật</button>
            </article>
          ))}
        </div>
        <FooterContactEditor initialContact={data.contact} />
        </>
      )}

      {kind === 'payment-history' && (
        <div className="service-table-card">
          <table>
            <thead>
              <tr>
                <th>Khóa học</th>
                <th>Thời lượng</th>
                <th>Học phí</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {data.courses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="contest-empty">Chưa có dữ liệu khóa học.</td>
                </tr>
              ) : data.courses.map((course) => (
                <tr key={course.id}>
                  <td><strong>{course.name}</strong><small>{course.schedule_note}</small></td>
                  <td>{course.duration_months} tháng</td>
                  <td>{formatPrice(course.price)}</td>
                  <td><span className="status-pill">{course.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {kind === 'wardrobe' && (
        <div className="wardrobe-grid">
          {['Second', 'Expert', 'Specialist', 'Pupil', 'Newbie', 'Legend'].map((rank, index) => (
            <article key={rank} className="wardrobe-item">
              <span className="wardrobe-medal"><Star size={20} /></span>
              <strong>{rank}</strong>
              <p>{index < 2 ? 'Đang mở khóa' : 'Cần thêm điểm luyện tập'}</p>
              <div className="home-progress"><span style={{ width: `${Math.max(18, 92 - index * 13)}%` }} /></div>
            </article>
          ))}
        </div>
      )}

      {kind === 'feedback' && (
        <div className="feedback-board">
          <ServicePanel title="Gửi phản hồi" icon={<Send size={18} />}>
            <label className="service-input">Tiêu đề<input value={feedbackTitleValue} onChange={(event) => setFeedbackTitleValue(event.target.value)} /></label>
            <label className="service-input">Nội dung<textarea value={feedbackBodyValue} onChange={(event) => setFeedbackBodyValue(event.target.value)} /></label>
            {feedbackMessage ? <p className="service-message">{feedbackMessage}</p> : null}
            <button className="blue-button" type="button" disabled={feedbackSending || !feedbackTitleValue.trim() || !feedbackBodyValue.trim()} onClick={() => void submitFeedback()}>
              {feedbackSending ? 'Đang gửi...' : 'Gửi phản hồi'}
            </button>
          </ServicePanel>
          <ServicePanel title="Lối tắt hỗ trợ" icon={<Gift size={18} />}>
            {[
              ['Báo lỗi bài tập', '/problems'],
              ['Kiểm tra bài nộp', '/submissions'],
              ['Hỏi về khóa học', '/courses'],
            ].map(([label, path]) => (
              <button key={label} className="service-feed-row" type="button" onClick={() => go(path)}>
                <span className="service-mini-icon"><ExternalLink size={15} /></span>
                <strong>{label}</strong>
              </button>
            ))}
          </ServicePanel>
        </div>
      )}

      <div className="service-route-strip">
        {serviceLinks.map((item) => (
          <button key={item.path} className={item.path === `/${kind}` ? 'active' : ''} type="button" onClick={() => go(item.path)}>
            <item.icon size={15} />
            {item.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function ServicePanel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <article className="service-panel">
      <h3>{icon}{title}</h3>
      <div className="service-panel-body">{children}</div>
    </article>
  );
}

function FooterContactEditor({ initialContact }: { initialContact: FooterContactSettings }) {
  const [contact, setContact] = useState(() => readFooterContactSettings(initialContact));
  const [saved, setSaved] = useState(false);

  const update = (key: keyof FooterContactSettings, value: string) => {
    setContact((current) => ({
      ...current,
      [key]: key === 'emails' || key === 'phones' ? normalizeStringList(value, []) : value,
    }));
    setSaved(false);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContact(saveFooterContactSettings(contact));
    setSaved(true);
  };

  return (
    <form className="contact-settings-panel" data-contact-settings onSubmit={submit}>
      <div data-contact-settings-head>
        <span><Settings size={19} /></span>
        <div>
          <strong>Liên hệ & thương hiệu</strong>
          <small>Logo, tên web, domain và thông tin footer</small>
        </div>
      </div>
      <div className="contact-settings-grid">
        <label>Tên web<input value={contact.brandName} onChange={(event) => update('brandName', event.target.value)} /></label>
        <label>Domain<input value={contact.domainName} onChange={(event) => update('domainName', event.target.value)} /></label>
        <label>Logo URL<input value={contact.logoUrl} onChange={(event) => update('logoUrl', event.target.value)} /></label>
        <label>Footer copyright<input value={contact.copyrightText} onChange={(event) => update('copyrightText', event.target.value)} /></label>
        <label>Địa chỉ<input value={contact.location} onChange={(event) => update('location', event.target.value)} /></label>
        <label>Email<textarea value={contact.emails.join('\n')} onChange={(event) => update('emails', event.target.value)} /></label>
        <label>Số điện thoại<textarea value={contact.phones.join('\n')} onChange={(event) => update('phones', event.target.value)} /></label>
        <label>Facebook<input value={contact.facebook} onChange={(event) => update('facebook', event.target.value)} /></label>
        <label>YouTube<input value={contact.youtube} onChange={(event) => update('youtube', event.target.value)} /></label>
        <label>TikTok<input value={contact.tiktok} onChange={(event) => update('tiktok', event.target.value)} /></label>
      </div>
      <div data-contact-settings-actions>
        {saved ? <span>Đã lưu</span> : null}
        <button className="blue-button" type="submit">Lưu liên hệ</button>
      </div>
    </form>
  );
}

const serviceLinks = [
  { path: '/notifications', label: 'Thông báo', icon: Bell },
  { path: '/settings', label: 'Cài đặt', icon: Settings },
  { path: '/payment-history', label: 'Thanh toán', icon: CreditCard },
  { path: '/wardrobe', label: 'Tủ đồ', icon: Gift },
  { path: '/feedback', label: 'Phản hồi', icon: Send },
] as const;

const servicePageConfig: Record<ServiceKind, {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  subtitle: string;
  eyebrow: string;
  heading: string;
  description: string;
  actions: Array<{ label: string; path: string; primary?: boolean }>;
}> = {
  notifications: {
    icon: Bell,
    title: 'Thông báo',
    subtitle: 'Theo dõi bài nộp, contest và cập nhật luyện tập.',
    eyebrow: 'Activity center',
    heading: 'Không bỏ lỡ trạng thái quan trọng',
    description: 'Tập trung các cập nhật quan trọng về bài nộp, kỳ thi và hoạt động học tập trong một không gian dễ quét.',
    actions: [{ label: 'Xem bài nộp', path: '/submissions', primary: true }, { label: 'Vào kỳ thi', path: '/contests' }],
  },
  settings: {
    icon: Settings,
    title: 'Cài đặt',
    subtitle: 'Không gian tài khoản, bảo mật và tùy biến giao diện.',
    eyebrow: 'Account',
    heading: 'Cá nhân hóa hệ thống',
    description: 'Các nhóm thiết lập được chia giống trải nghiệm tài khoản: hồ sơ, bảo mật, theme và thông báo.',
    actions: [{ label: 'Đổi giao diện', path: '/settings', primary: true }, { label: 'Xem hồ sơ', path: '/users' }],
  },
  'payment-history': {
    icon: CreditCard,
    title: 'Lịch sử thanh toán',
    subtitle: 'Tổng hợp khóa học và trạng thái học phí.',
    eyebrow: 'Billing',
    heading: activeBillingHeading(),
    description: 'Theo dõi các khóa học đã đăng ký, học phí theo tháng và trạng thái thanh toán gần đây.',
    actions: [{ label: 'Xem khóa học', path: '/courses', primary: true }, { label: 'Hỏi hỗ trợ', path: '/feedback' }],
  },
  wardrobe: {
    icon: Gift,
    title: 'Tủ đồ',
    subtitle: 'Huy hiệu, cấp bậc và vật phẩm thành tích theo phong cách gamified.',
    eyebrow: 'Rewards',
    heading: 'Trang trí hồ sơ bằng thành tích',
    description: 'Mở khóa huy hiệu, cấp bậc và vật phẩm trang trí hồ sơ dựa trên tiến độ luyện tập.',
    actions: [{ label: 'Xem bảng vàng', path: '/users', primary: true }, { label: 'Luyện bài', path: '/problems' }],
  },
  feedback: {
    icon: Send,
    title: 'Phản hồi',
    subtitle: 'Gửi góp ý, báo lỗi bài tập và liên hệ hỗ trợ.',
    eyebrow: 'Support',
    heading: 'Gửi phản hồi cho đội vận hành',
    description: 'Gửi báo lỗi bài tập, góp ý giao diện hoặc câu hỏi về khóa học cho đội hỗ trợ.',
    actions: [{ label: 'Báo lỗi bài tập', path: '/problems', primary: true }, { label: 'Xem bài nộp', path: '/submissions' }],
  },
};

function activeBillingHeading() {
  return 'Theo dõi học phí và đăng ký';
}

function CpproLogoutPage({
  onLogout,
  brandName = defaultFooterContactSettings.brandName,
}: {
  onLogout: () => Promise<void>;
  brandName?: string;
}) {
  useEffect(() => {
    void onLogout();
  }, [onLogout]);

  return (
    <div className="judge-type-scale auth-shell-crawl">
      <div className="relative w-full min-h-screen flex flex-col transition-colors">
        <CpproBackdrop brandName={brandName} />
        <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-10">
          <div className="auth-card w-full max-w-[440px] bg-white dark:bg-slate-800 rounded-[16px] border-2 border-[#1A2B4C] dark:border-slate-600 shadow-[0_4px_0_0_#1A2B4C] dark:shadow-[0_4px_0_0_#1e293b] p-8 text-center">
            <Loader2 className="mx-auto mb-3 animate-spin text-[#1890FF]" size={28} />
            <h1 className="text-xl font-black text-[#1A2B4C] dark:text-white">Đang đăng xuất</h1>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">Đang kết thúc phiên làm việc an toàn…</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthPreviewCrawl({
  mode,
  go,
  onAuth,
  googleEnabled = false,
  brandName = defaultFooterContactSettings.brandName,
}: {
  mode: string;
  go: (path: string) => void;
  onAuth: (result: AuthResult) => void;
  googleEnabled?: boolean;
  brandName?: string;
}) {
  const isLogin = mode === 'login';
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const labelClass = 'block text-sm font-bold text-[#1A2B4C] dark:text-slate-300 mb-1.5';
  const iconClass = 'absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500';
  const inputClass = 'w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-[12px] text-sm font-semibold text-[#1A2B4C] dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#1890FF] dark:focus:border-[#1890FF] transition-colors';
  const passwordClass = 'w-full pl-10 pr-11 py-3 bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-[12px] text-sm font-semibold text-[#1A2B4C] dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#1890FF] dark:focus:border-[#1890FF] transition-colors';
  const showGoogleAuth = googleEnabled;
  const keepPasswordToggleFocus = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };
  const togglePassword = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setShowPassword((value) => !value);
  };
  const toggleConfirmPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setShowConfirmPassword((value) => !value);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice('');
    setError('');
    setSubmitting(true);
    try {
      if (isLogin) {
        const result = await cpproApiFetch<{ user?: AuthUser; token?: string; twoFactorRequired?: boolean; message?: string }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username: username.trim(), password, twoFactorCode: twoFactorCode.trim() }),
        });
        if (result.twoFactorRequired) {
          setTwoFactorRequired(true);
          setNotice(result.message || 'Nhập mã xác thực hai lớp để tiếp tục.');
          return;
        }
        if (!result.user || !result.token) {
          throw new Error(result.message || 'Two-factor code is required for this account.');
        }
        const storedUser = saveCpproSession(result.token, result.user);
        onAuth({ token: result.token, user: storedUser });
        return;
      }

      const response = await cpproApiFetch<{ delivery?: { message?: string }; message?: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          confirmPassword,
          termsAccepted: true,
        }),
      });
      const deliveryMessage = response.delivery?.message ? ` ${response.delivery.message}` : '';
      setNotice(`${response.message || 'Tài khoản đã được tạo. Vui lòng xác minh email trước khi đăng nhập.'}${deliveryMessage} Nếu không thấy email trong hộp thư chính, bạn có thể vào mục SPAM để kiểm tra.`);
      setPassword('');
      setConfirmPassword('');
    } catch (nextError: any) {
      setError(nextError.message || (isLogin ? 'Could not sign in.' : 'Could not create account.'));
    } finally {
      setSubmitting(false);
    }
  };

  const switchPath = isLogin ? '/register' : '/login';

  return (
    <>
      <div className="auth-card w-full max-w-[440px] bg-white dark:bg-slate-800 rounded-[16px] border-2 border-[#1A2B4C] dark:border-slate-600 shadow-[0_4px_0_0_#1A2B4C] dark:shadow-[0_4px_0_0_#1e293b] p-8 transition-colors">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-[#1A2B4C] dark:text-white mb-1">{isLogin ? 'Đăng nhập' : 'Đăng ký tài khoản'}</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {isLogin ? `Chào mừng bạn quay trở lại ${brandName}!` : `Bắt đầu hành trình lập trình cùng ${brandName}!`}
          </p>
        </div>

        {!isLogin && (
          <div className="auth-register-note">
            <p><span>Bước 1:</span> Xác thực tài khoản Google của bạn. Sau đó bạn sẽ tự chọn <strong>Username</strong> và <strong>Mật khẩu</strong> riêng.</p>
          </div>
        )}

        {showGoogleAuth && (
          <>
            <div className="flex justify-center">
              <button className="google-auth-preview" type="button" aria-label={isLogin ? 'Sign in with Google' : 'Sign up with Google'}>
                <span className="google-auth-mark" aria-hidden="true">G</span>
                <span>{isLogin ? 'Sign in with Google' : 'Sign up with Google'}</span>
              </button>
            </div>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-[2px] bg-slate-200 dark:bg-slate-600 rounded-full" />
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">hoặc</span>
              <div className="flex-1 h-[2px] bg-slate-200 dark:bg-slate-600 rounded-full" />
            </div>
          </>
        )}

        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor={`${mode}-username`} className={labelClass}>Tên đăng nhập</label>
            <div className="relative">
              <User className={iconClass} />
              <input
                id={`${mode}-username`}
                autoComplete="username"
                className={inputClass}
                maxLength={15}
                minLength={3}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="username"
                required
                type="text"
                value={username}
              />
            </div>
          </div>

          {isLogin && twoFactorRequired && (
            <div data-auth-two-factor>
              <label htmlFor="login-two-factor" className={labelClass}>Mã xác thực hai lớp</label>
              <div className="relative">
                <ShieldCheck className={iconClass} />
                <input
                  id="login-two-factor"
                  autoComplete="one-time-code"
                  className={inputClass}
                  inputMode="numeric"
                  maxLength={64}
                  onChange={(event) => setTwoFactorCode(event.target.value)}
                  placeholder="Mã ứng dụng hoặc mã khôi phục"
                  required
                  type="text"
                  value={twoFactorCode}
                />
              </div>
            </div>
          )}

          {!isLogin && (
            <>
              <div>
                <label htmlFor="register-full-name" className={labelClass}>Họ và tên</label>
                <div className="relative">
                  <CircleUserRound className={iconClass} />
                  <input
                    id="register-full-name"
                    autoComplete="name"
                    className={inputClass}
                    minLength={2}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Nguyễn Văn A"
                    required
                    type="text"
                    value={fullName}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="register-email" className={labelClass}>Email</label>
                <div className="relative">
                  <Mail className={iconClass} />
                  <input
                    id="register-email"
                    autoComplete="email"
                    className={inputClass}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="email@example.com"
                    required
                    type="email"
                    value={email}
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label htmlFor={`${mode}-password`} className={labelClass}>Mật khẩu</label>
            <div className="relative">
              <Lock className={iconClass} />
              <input
                id={`${mode}-password`}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                className={passwordClass}
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={togglePassword}
                onMouseDown={keepPasswordToggleFocus}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-pressed={showPassword}
                data-auth-password-toggle
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div>
              <label htmlFor="register-confirm-password" className={labelClass}>Nhập lại mật khẩu</label>
              <div className="relative">
                <Lock className={iconClass} />
                <input
                  id="register-confirm-password"
                  autoComplete="new-password"
                  className={passwordClass}
                  minLength={6}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="••••••••"
                  required
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={toggleConfirmPassword}
                  onMouseDown={keepPasswordToggleFocus}
                  aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-pressed={showConfirmPassword}
                  data-auth-password-toggle
                >
                  {showConfirmPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>
          )}

          {error && <div className="auth-message auth-message-error">{error}</div>}
          {notice && <div className="auth-message auth-message-ok">{notice}</div>}

          <button
            type="submit"
            disabled={submitting || (!isLogin && password !== confirmPassword)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1890FF] text-white rounded-[12px] font-black text-sm shadow-[0_4px_0_0_#0050B3] hover:bg-[#096DD9] hover:-translate-y-[2px] hover:shadow-[0_4px_0_0_#0050B3] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-60 disabled:pointer-events-none"
          >
            <LogIn className="w-4.5 h-4.5" />
            {submitting ? 'Đang xử lý...' : isLogin ? (twoFactorRequired ? 'Xác thực và đăng nhập' : 'Đăng nhập') : 'Tạo tài khoản'}
          </button>

          {isLogin && (
            <div className="mt-3 flex justify-center">
              <div className="turnstile-preview" aria-hidden="true">
                <input type="hidden" name="cf-turnstile-response" />
              </div>
            </div>
          )}
        </form>
      </div>

      <div className="auth-switch mt-5 text-sm font-bold text-slate-600 dark:text-slate-400">
        {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
        <a
          className="text-[#1890FF] hover:text-[#096DD9] transition-colors underline underline-offset-2"
          href={switchPath}
          onClick={(event) => {
            event.preventDefault();
            go(switchPath);
          }}
        >
          {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
        </a>
      </div>
    </>
  );
}

function AuthPreview({ mode, go, onAuth }: { mode: string; go: (path: string) => void; onAuth: (result: AuthResult) => void }) {
  const isLogin = mode === 'login';
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice('');
    setError('');
    setSubmitting(true);
    try {
      if (isLogin) {
        const result = await cpproApiFetch<{ user?: AuthUser; token?: string; twoFactorRequired?: boolean; message?: string }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username: username.trim(), password }),
        });
        if (result.twoFactorRequired || !result.user || !result.token) {
          throw new Error(result.message || 'Two-factor code is required for this account.');
        }
        const storedUser = saveCpproSession(result.token, result.user);
        onAuth({ token: result.token, user: storedUser });
        return;
      }

      const response = await cpproApiFetch<{ delivery?: { message?: string }; message?: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          confirmPassword,
          termsAccepted: true,
        }),
      });
      const deliveryMessage = response.delivery?.message ? ` ${response.delivery.message}` : '';
      setNotice(`${response.message || 'Account created. Please verify your email before signing in.'}${deliveryMessage} If you do not see the email in your inbox, check Spam.`);
      setPassword('');
      setConfirmPassword('');
    } catch (nextError: any) {
      setError(nextError.message || (isLogin ? 'Could not sign in.' : 'Could not create account.'));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <form className="auth-card auth-card-polished" onSubmit={submit}>
      <div className="auth-brand-lockup">
        <div className="logo-pill">{`{${compactBrandMark(defaultFooterContactSettings.brandName)}}`}</div>
        <span>{defaultFooterContactSettings.brandName}</span>
      </div>
      <div className="auth-copy">
        <h1>{isLogin ? 'Đăng nhập' : 'Đăng ký'}</h1>
        <p>
          {isLogin
            ? 'Tiếp tục lộ trình luyện tập, theo dõi bài nộp và tham gia các kỳ thi trong hệ thống.'
            : 'Tạo tài khoản để lưu tiến độ, mở khóa bảng xếp hạng và nhận lộ trình luyện tập cá nhân.'}
        </p>
      </div>
      <label>
        <span>{isLogin ? 'Tên đăng nhập hoặc email' : 'Tên đăng nhập'}</span>
        <input
          autoComplete="username"
          minLength={3}
          onChange={(event) => setUsername(event.target.value)}
          placeholder={isLogin ? 'Tên đăng nhập hoặc email' : 'Tên hiển thị trên hệ thống'}
          required
          value={username}
        />
      </label>
      {!isLogin && (
        <>
          <label>
            <span>Họ và tên</span>
            <input autoComplete="name" minLength={2} onChange={(event) => setFullName(event.target.value)} placeholder="Nguyễn Văn A" required value={fullName} />
          </label>
          <label>
            <span>Email</span>
            <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="email@example.com" required type="email" value={email} />
          </label>
        </>
      )}
      <label>
        <span>Mật khẩu</span>
        <input
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          minLength={6}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Mật khẩu"
          required
          type="password"
          value={password}
        />
      </label>
      {!isLogin && (
        <label>
          <span>Nhập lại mật khẩu</span>
          <input
            autoComplete="new-password"
            minLength={6}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Nhập lại mật khẩu"
            required
            type="password"
            value={confirmPassword}
          />
        </label>
      )}
      {isLogin ? (
        <div className="auth-options">
          <label><input type="checkbox" /> Ghi nhớ đăng nhập</label>
          <button type="button">Quên mật khẩu?</button>
        </div>
      ) : null}
      {error && <div className="auth-message auth-message-error">{error}</div>}
      {notice && <div className="auth-message auth-message-ok">{notice}</div>}
      <button className="blue-button auth-submit" disabled={submitting || (!isLogin && password !== confirmPassword)} type="submit">
        {submitting ? 'Đang xử lý...' : isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}
      </button>
      <p className="auth-switch">
        {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
        <button type="button" onClick={() => go(isLogin ? '/register' : '/login')}>
          {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
        </button>
      </p>
    </form>
  );
}

function ContestSection({
  title,
  contests,
  go,
  page = 1,
  onPage,
  paginated = false,
}: {
  title: string;
  contests: Contest[];
  go: (path: string) => void;
  page?: number;
  onPage?: (page: number) => void;
  paginated?: boolean;
}) {
  const pageSize = paginated ? 10 : Math.max(contests.length, 1);
  const totalPages = Math.max(1, Math.ceil(contests.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleContests = contests.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showPagination = paginated && Boolean(onPage);

  return (
    <section className="contest-table-section">
      <h2 className="section-title">{title}</h2>
      {showPagination && onPage && <Pagination page={currentPage} totalPages={totalPages} onPage={onPage} />}
      <div className="contest-table-wrap">
        <table className="contest-table">
          <thead>
            <tr>
              <th>Kỳ thi</th>
              <th>Thành viên</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {visibleContests.length === 0 ? (
              <tr>
                <td colSpan={3} className="contest-empty">Hiện chưa có kỳ thi.</td>
              </tr>
            ) : visibleContests.map((contest) => (
              <tr key={contest.slug} onClick={() => go(`/contests/${contest.slug}`)}>
                <td>
                  <button className="contest-title-link" type="button">
                    {contest.title}
                  </button>
                  <div className="contest-meta-line">{formatContestStatus(contest)} · {formatContestMeta(contest)}</div>
                </td>
                <td className="contest-member-cell">{contest.participants} ({contest.virtualParticipants || 0})</td>
                <td>
                  <button className="contest-join-action" type="button" onClick={(event) => { event.stopPropagation(); go(`/contests/${contest.slug}`); }}>
                    Vào kỳ thi
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showPagination && onPage && <Pagination page={currentPage} totalPages={totalPages} onPage={onPage} />}
    </section>
  );
}

function formatContestStatus(contest: Contest) {
  const end = contest.endTime ? new Date(contest.endTime) : null;
  if (end && end.getTime() < Date.now()) return `Đã kết thúc lúc ${formatDate(contest.endTime)}`;
  return `Kết thúc lúc ${formatDate(contest.endTime)}`;
}

function formatContestMeta(contest: Contest) {
  const started = formatDate(contest.startTime);
  const duration = contest.durationMinutes ? `Thời gian làm bài: ${Math.round(contest.durationMinutes / 60)} giờ` : 'VNOJ';
  const format = contest.format ? contest.format.toUpperCase() : 'VNOJ';
  return `${started} · ${duration} · ${format}`;
}

function PageTitle({ icon, title, subtitle, right }: { icon: React.ReactNode; title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="page-title">
      <span className="title-icon">{icon}</span>
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right && <div className="title-right">{right}</div>}
    </div>
  );
}

function Panel({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        {action && <button type="button" onClick={onAction}>{action}</button>}
      </div>
      {children}
    </section>
  );
}

function Pagination({
  page,
  totalPages,
  onPage,
  totalItems,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);
  const windowStart = Math.max(1, Math.min(safePage - 2, safeTotalPages - 4));
  const pageWindow = Array.from(
    { length: Math.min(5, safeTotalPages) },
    (_, index) => windowStart + index,
  ).filter((item) => item <= safeTotalPages);
  const start = totalItems && pageSize ? Math.min(totalItems, (safePage - 1) * pageSize + 1) : 0;
  const end = totalItems && pageSize ? Math.min(totalItems, safePage * pageSize) : 0;
  return (
    <div className="pagination-row" aria-label="Phân trang">
      {pageSize && onPageSizeChange ? (
        <label className="pagination-size">
          Số dòng
          <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
            {pageSizeOptions.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      ) : null}
      <div className="pagination-pages">
        <button type="button" disabled={safePage <= 1} onClick={() => onPage(1)}>«</button>
        <button type="button" disabled={safePage <= 1} onClick={() => onPage(Math.max(1, safePage - 1))}>‹</button>
        {pageWindow.flatMap((item, index) => {
          const hasGap = index > 0 && item - pageWindow[index - 1] > 1;
          const pageButton = (
            <button
              key={item}
              type="button"
              className={item === safePage ? 'active' : ''}
              aria-current={item === safePage ? 'page' : undefined}
              onClick={() => onPage(item)}
            >
              {item}
            </button>
          );
          return hasGap ? [<span key={`gap-${item}`}>...</span>, pageButton] : [pageButton];
        })}
        <button type="button" disabled={safePage >= safeTotalPages} onClick={() => onPage(Math.min(safeTotalPages, safePage + 1))}>›</button>
        <button type="button" disabled={safePage >= safeTotalPages} onClick={() => onPage(safeTotalPages)}>»</button>
      </div>
      {totalItems !== undefined && pageSize ? (
        <em className="pagination-summary">{totalItems > 0 ? `${start}-${end}` : '0'} / {totalItems}</em>
      ) : null}
    </div>
  );
}

function Stat({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone: string }) {
  return (
    <div className={`stat-card ${tone}`}>
      <span>{icon}</span>
      <strong>{Number(value || 0).toLocaleString('vi-VN')}</strong>
      <small>{label}</small>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return (
    <label className="field-label">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([nextValue, text]) => <option key={nextValue} value={nextValue}>{text}</option>)}
      </select>
    </label>
  );
}

type StatusTab = 'judges' | 'runtimes' | 'matrix';

type CpproJudgeWorker = {
  workerId: string;
  concurrency: number;
  updatedAt: string;
};

type CpproJudgeStatus = {
  queueDepth: number | null;
  queueLimit: number;
  acceptingSubmissions: boolean;
  queueUtilizationPercent: number | null;
  workersOnline: number;
  concurrency: number;
  workers?: CpproJudgeWorker[];
  queued: number;
  running: number;
  failed: number;
  deadLetter: number;
  oldestQueuedSeconds: number;
  checkedAt: string;
};

type StatusRuntimeLanguage = {
  code: string;
  label: string;
  runtimeLabel?: string | null;
  extension?: string | null;
  enabled?: boolean;
  installed?: boolean;
  submissionCount?: number;
};

const statusFallbackLanguages: StatusRuntimeLanguage[] = fallbackJudgeLanguages.map((language) => ({
  code: language.code,
  label: language.label,
  runtimeLabel: language.runtimeLabel || language.label,
  extension: language.extension || null,
  enabled: true,
  installed: true,
  submissionCount: 0,
}));

const statusCopy = {
  vi: {
    title: 'Trạng thái',
    subtitle: 'Theo dõi judge worker, runtime và áp lực hàng đợi theo thời gian thực.',
    refresh: 'Làm mới',
    loading: 'Đang tải trạng thái...',
    loadError: 'Không thể tải trạng thái live.',
    languagesError: 'Không thể tải database runtime.',
    judges: 'Judges',
    runtimes: 'Runtimes',
    matrix: 'Version Matrix',
    workersOnline: 'Worker online',
    concurrency: 'Slot song song',
    queueDepth: 'Độ dài hàng đợi',
    accepting: 'Nhận bài',
    yes: 'Có',
    no: 'Không',
    judge: 'Judge',
    uptime: 'Uptime',
    ping: 'Ping',
    load: 'Load',
    runtimeColumn: 'Runtimes',
    noWorkers: 'Hiện chưa thấy heartbeat live của judge worker.',
    queueUtilization: 'Mức sử dụng hàng đợi',
    queuedJobs: 'Job đang chờ',
    runningJobs: 'Job đang chạy',
    failedJobs: 'Job lỗi',
    deadLetters: 'Dead-letter job',
    oldestQueued: 'Job chờ lâu nhất',
    lastChecked: 'Kiểm tra lúc',
    none: 'không có',
    online: 'online',
    queue: 'hàng đợi',
    language: 'Ngôn ngữ',
    runtime: 'Runtime',
    code: 'Mã',
    extension: 'Đuôi file',
    installed: 'Đã cài',
    enabled: 'Bật',
    submissions: 'Bài nộp',
    status: 'Trạng thái',
    database: 'Database',
    fallback: 'Dự phòng',
    available: 'Khả dụng',
    disabled: 'Đã tắt',
    unavailable: 'Chưa cài',
    runtimeSummary: 'Danh mục runtime',
    runtimeSummaryBody: 'Ngôn ngữ được đọc từ database judge language và trình bày theo kiểu trang status nguồn.',
    matrixSummary: 'Ma trận runtime',
    matrixSummaryBody: 'Nhãn compiler/runtime hiển thị theo từng ngôn ngữ; version chi tiết sẽ hiện khi database có dữ liệu.',
  },
  en: {
    title: 'Status',
    subtitle: 'Live judge workers, runtime availability, and queue pressure.',
    refresh: 'Refresh',
    loading: 'Loading status...',
    loadError: 'Could not load live status.',
    languagesError: 'Could not load runtime database.',
    judges: 'Judges',
    runtimes: 'Runtimes',
    matrix: 'Version Matrix',
    workersOnline: 'Workers online',
    concurrency: 'Concurrency slots',
    queueDepth: 'Queue depth',
    accepting: 'Accepting',
    yes: 'Yes',
    no: 'No',
    judge: 'Judge',
    uptime: 'Uptime',
    ping: 'Ping',
    load: 'Load',
    runtimeColumn: 'Runtimes',
    noWorkers: 'No live judge worker heartbeat is visible right now.',
    queueUtilization: 'Queue utilization',
    queuedJobs: 'Queued jobs',
    runningJobs: 'Running jobs',
    failedJobs: 'Failed jobs',
    deadLetters: 'Dead-letter jobs',
    oldestQueued: 'Oldest queued job',
    lastChecked: 'Last checked',
    none: 'none',
    online: 'online',
    queue: 'queue',
    language: 'Language',
    runtime: 'Runtime',
    code: 'Code',
    extension: 'Extension',
    installed: 'Installed',
    enabled: 'Enabled',
    submissions: 'Submissions',
    status: 'Status',
    database: 'Database',
    fallback: 'Fallback',
    available: 'Available',
    disabled: 'Disabled',
    unavailable: 'Unavailable',
    runtimeSummary: 'Runtime catalog',
    runtimeSummaryBody: 'Languages are read from the judge language database and grouped like the source status page.',
    matrixSummary: 'Runtime matrix',
    matrixSummaryBody: 'Compiler/runtime labels are displayed per language; exact version strings appear when the database provides them.',
  },
} as const;

type StatusCopy = (typeof statusCopy)[CpproLocale];

function SystemStatusPage({ activeTab = 'judges', go }: { activeTab?: StatusTab; go: (path: string) => void }) {
  const locale = parseCpproPath(window.location.pathname).locale;
  const copy = statusCopy[locale];
  const [status, setStatus] = useState<CpproJudgeStatus | null>(null);
  const [languages, setLanguages] = useState<StatusRuntimeLanguage[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [languagesError, setLanguagesError] = useState('');

  const load = async () => {
    setLoading(true);
    setStatusError('');
    setLanguagesError('');
    const [statusResult, languagesResult] = await Promise.allSettled([
      cpproApiFetch<CpproJudgeStatus>('/judges/status', { timeoutMs: 6000 }),
      cpproApiFetch<unknown>('/languages?enabled=true', { timeoutMs: 6000 }),
    ]);

    if (statusResult.status === 'fulfilled') {
      setStatus(normalizeJudgeStatus(statusResult.value));
    } else {
      setStatus(null);
      setStatusError(statusResult.reason?.message || copy.loadError);
    }

    if (languagesResult.status === 'fulfilled') {
      setLanguages(rowsFromApi<Record<string, unknown>>(languagesResult.value).map(mapStatusLanguage));
    } else {
      setLanguages([]);
      setLanguagesError(languagesResult.reason?.message || copy.languagesError);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const runtimeRows = useMemo(() => normalizeStatusLanguages(languages), [languages]);
  const displayedLanguages = runtimeRows.length ? runtimeRows : statusFallbackLanguages;
  const sourceLabel = runtimeRows.length ? copy.database : copy.fallback;
  const runtimeList = displayedLanguages
    .filter((item) => item.enabled !== false && item.installed !== false)
    .map((item) => item.label || item.code);

  return (
    <div className="status-clone-page">
      <header className="status-clone-header">
        <div>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <button type="button" className="status-clone-refresh" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 size={16} className="live-spin" /> : <RefreshCw size={16} />}
          {copy.refresh}
        </button>
      </header>

      <nav className="status-clone-tabs" aria-label={copy.title}>
        <StatusTabLink active={activeTab === 'judges'} path="/status" icon={<Server size={16} />} label={copy.judges} locale={locale} go={go} />
        <StatusTabLink active={activeTab === 'runtimes'} path="/runtimes" icon={<Code2 size={16} />} label={copy.runtimes} locale={locale} go={go} />
        <StatusTabLink active={activeTab === 'matrix'} path="/runtimes/matrix" icon={<Database size={16} />} label={copy.matrix} locale={locale} go={go} />
      </nav>

      {(statusError || languagesError) && (
        <div className="status-clone-alert" role="alert">
          {statusError ? <span>{statusError}</span> : null}
          {languagesError ? <span>{languagesError}</span> : null}
        </div>
      )}

      {loading && !status && activeTab === 'judges' ? (
        <div className="status-clone-loading">
          <Loader2 size={17} className="live-spin" />
          {copy.loading}
        </div>
      ) : activeTab === 'judges' ? (
        <JudgesStatusTab status={status} runtimes={runtimeList} copy={copy} />
      ) : activeTab === 'runtimes' ? (
        <RuntimesStatusTab languages={displayedLanguages} sourceLabel={sourceLabel} copy={copy} />
      ) : (
        <MatrixStatusTab languages={displayedLanguages} sourceLabel={sourceLabel} copy={copy} />
      )}
    </div>
  );
}

function JudgesStatusTab({ status, runtimes, copy }: { status: CpproJudgeStatus | null; runtimes: string[]; copy: StatusCopy }) {
  const loadRatio = status && status.concurrency > 0 ? Math.min(status.running / status.concurrency, 1) : 0;
  const workerRows = normalizeStatusWorkers(status);

  return (
    <>
      <section className="status-clone-metrics">
        <StatusMetric icon={<Server size={19} />} label={copy.workersOnline} value={status?.workersOnline ?? 0} tone={(status?.workersOnline || 0) > 0 ? 'good' : 'warn'} />
        <StatusMetric icon={<Cpu size={19} />} label={copy.concurrency} value={status?.concurrency ?? 0} tone={(status?.concurrency || 0) > 0 ? 'good' : 'idle'} />
        <StatusMetric icon={<Activity size={19} />} label={copy.queueDepth} value={status?.queueDepth ?? '-'} tone={status?.acceptingSubmissions ? 'good' : 'warn'} />
        <StatusMetric icon={<ShieldCheck size={19} />} label={copy.accepting} value={status?.acceptingSubmissions ? copy.yes : copy.no} tone={status?.acceptingSubmissions ? 'good' : 'warn'} />
      </section>

      <section className="status-clone-table-card">
        <div className="status-clone-table-scroll">
          <table className="status-clone-table">
            <thead>
              <tr>
                <th>{copy.judge}</th>
                <th>{copy.uptime}</th>
                <th>{copy.ping}</th>
                <th>{copy.load}</th>
                <th>{copy.runtimeColumn}</th>
              </tr>
            </thead>
            <tbody>
              {workerRows.length ? workerRows.map((worker) => (
                <tr key={worker.workerId}>
                  <td className="status-clone-judge-cell">{worker.workerId}</td>
                  <td>{worker.updatedAt ? relativeStatusAge(worker.updatedAt, copy) : copy.online}</td>
                  <td>{copy.queue} {status?.queueDepth ?? '-'}</td>
                  <td>{statusPercent(loadRatio)}</td>
                  <td><RuntimeCloud runtimes={runtimes} /></td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="status-clone-empty">{copy.noWorkers}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="status-clone-detail">
        <div className="status-clone-progress-panel">
          <strong><Gauge size={16} />{copy.queueUtilization}</strong>
          <span>{status?.queueUtilizationPercent === null || status?.queueUtilizationPercent === undefined ? '-' : `${status.queueUtilizationPercent}% / ${status.queueLimit}`}</span>
          <div className="status-clone-progress"><i style={{ width: `${Math.min(Math.max(status?.queueUtilizationPercent || 0, 0), 100)}%` }} /></div>
        </div>
        <dl>
          <div><dt>{status?.queued ?? 0}</dt><dd>{copy.queuedJobs}</dd></div>
          <div><dt>{status?.running ?? 0}</dt><dd>{copy.runningJobs}</dd></div>
          <div><dt>{status?.failed ?? 0}</dt><dd>{copy.failedJobs}</dd></div>
          <div><dt>{status?.deadLetter ?? 0}</dt><dd>{copy.deadLetters}</dd></div>
        </dl>
        <p>{copy.oldestQueued}: {formatStatusAge(status?.oldestQueuedSeconds || 0, copy)}. {copy.lastChecked}: {status?.checkedAt ? new Date(status.checkedAt).toLocaleString() : '-'}.</p>
      </section>
    </>
  );
}

function RuntimesStatusTab({ languages, sourceLabel, copy }: { languages: StatusRuntimeLanguage[]; sourceLabel: string; copy: StatusCopy }) {
  return (
    <section className="status-clone-table-card">
      <StatusSectionIntro icon={<Code2 size={18} />} title={copy.runtimeSummary} body={copy.runtimeSummaryBody} sourceLabel={sourceLabel} />
      <div className="status-clone-table-scroll">
        <table className="status-clone-table">
          <thead>
            <tr>
              <th>{copy.language}</th>
              <th>{copy.runtime}</th>
              <th>{copy.code}</th>
              <th>{copy.extension}</th>
              <th>{copy.installed}</th>
              <th>{copy.enabled}</th>
              <th>{copy.submissions}</th>
            </tr>
          </thead>
          <tbody>
            {languages.map((language) => (
              <tr key={language.code}>
                <td className="status-clone-language-cell">{language.label || language.code}</td>
                <td>{language.runtimeLabel || '-'}</td>
                <td><code>{language.code}</code></td>
                <td>{language.extension || '-'}</td>
                <td><StatusBooleanPill value={language.installed !== false} copy={copy} /></td>
                <td><StatusBooleanPill value={language.enabled !== false} copy={copy} /></td>
                <td>{Number(language.submissionCount || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MatrixStatusTab({ languages, sourceLabel, copy }: { languages: StatusRuntimeLanguage[]; sourceLabel: string; copy: StatusCopy }) {
  return (
    <section className="status-clone-table-card">
      <StatusSectionIntro icon={<Database size={18} />} title={copy.matrixSummary} body={copy.matrixSummaryBody} sourceLabel={sourceLabel} />
      <div className="status-clone-table-scroll">
        <table className="status-clone-table status-clone-matrix">
          <thead>
            <tr>
              <th>{copy.language}</th>
              <th>{copy.code}</th>
              <th>{copy.runtime}</th>
              <th>{copy.status}</th>
            </tr>
          </thead>
          <tbody>
            {languages.map((language) => {
              const unavailable = language.installed === false;
              const disabled = !unavailable && language.enabled === false;
              return (
                <tr key={language.code}>
                  <td className="status-clone-language-cell">{language.label || language.code}</td>
                  <td><code>{language.code}</code></td>
                  <td>{language.runtimeLabel || '-'}</td>
                  <td>
                    <span className={unavailable ? 'status-clone-pill status-clone-pill-bad' : disabled ? 'status-clone-pill status-clone-pill-warn' : 'status-clone-pill status-clone-pill-good'}>
                      {unavailable ? <XCircle size={13} /> : <CheckCircle2 size={13} />}
                      {unavailable ? copy.unavailable : disabled ? copy.disabled : copy.available}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusTabLink({ active, path, icon, label, locale, go }: { active: boolean; path: string; icon: React.ReactNode; label: string; locale: CpproLocale; go: (path: string) => void }) {
  return (
    <a className={active ? 'status-clone-tab status-clone-tab-active' : 'status-clone-tab'} href={withCpproLocale(locale, path)} aria-current={active ? 'page' : undefined} onClick={(event) => openInternalLink(event, go, path)}>
      {icon}
      {label}
    </a>
  );
}

function StatusMetric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone: 'good' | 'warn' | 'idle' }) {
  return (
    <div className={`status-clone-metric status-clone-metric-${tone}`}>
      <span>{icon}</span>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function StatusSectionIntro({ icon, title, body, sourceLabel }: { icon: React.ReactNode; title: string; body: string; sourceLabel: string }) {
  return (
    <header className="status-clone-section-intro">
      <div>
        <strong>{icon}{title}</strong>
        <p>{body}</p>
      </div>
      <span>{sourceLabel}</span>
    </header>
  );
}

function StatusBooleanPill({ value, copy }: { value: boolean; copy: StatusCopy }) {
  return (
    <span className={value ? 'status-clone-pill status-clone-pill-good' : 'status-clone-pill status-clone-pill-bad'}>
      {value ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
      {value ? copy.yes : copy.no}
    </span>
  );
}

function RuntimeCloud({ runtimes }: { runtimes: string[] }) {
  const visible = runtimes.slice(0, 48);
  return (
    <div className="status-clone-runtime-cloud">
      {visible.map((runtime) => <span key={runtime}>{runtime}</span>)}
    </div>
  );
}

function normalizeJudgeStatus(status: CpproJudgeStatus): CpproJudgeStatus {
  return {
    queueDepth: status.queueDepth === null || status.queueDepth === undefined ? null : Number(status.queueDepth),
    queueLimit: Number(status.queueLimit || 0),
    acceptingSubmissions: Boolean(status.acceptingSubmissions),
    queueUtilizationPercent: status.queueUtilizationPercent === null || status.queueUtilizationPercent === undefined ? null : Number(status.queueUtilizationPercent),
    workersOnline: Number(status.workersOnline || 0),
    concurrency: Number(status.concurrency || 0),
    workers: Array.isArray(status.workers) ? status.workers.map((worker) => ({
      workerId: String(worker.workerId || 'judge'),
      concurrency: Number(worker.concurrency || 1),
      updatedAt: String(worker.updatedAt || status.checkedAt || new Date().toISOString()),
    })) : [],
    queued: Number(status.queued || 0),
    running: Number(status.running || 0),
    failed: Number(status.failed || 0),
    deadLetter: Number(status.deadLetter || 0),
    oldestQueuedSeconds: Number(status.oldestQueuedSeconds || 0),
    checkedAt: String(status.checkedAt || new Date().toISOString()),
  };
}

function mapStatusLanguage(row: Record<string, unknown>): StatusRuntimeLanguage {
  const runtime = row.runtime_label ?? row.runtimeLabel ?? row.runtime ?? row.label;
  const extension = row.extension ? String(row.extension).replace(/^\./, '') : null;
  return {
    code: String(row.code || '').trim().toLowerCase(),
    label: String(row.label || row.code || '').trim(),
    runtimeLabel: runtime ? String(runtime) : null,
    extension,
    enabled: typeof row.enabled === 'boolean' ? row.enabled : undefined,
    installed: typeof row.installed === 'boolean' ? row.installed : undefined,
    submissionCount: Number(row.submission_count ?? row.submissionCount ?? row.submissions ?? 0) || 0,
  };
}

function normalizeStatusLanguages(languages: StatusRuntimeLanguage[]) {
  return languages
    .filter((language) => language.code && language.label)
    .sort((a, b) => Number(a.enabled === false) - Number(b.enabled === false) || String(a.label || a.code).localeCompare(String(b.label || b.code), 'vi', { numeric: true, sensitivity: 'base' }));
}

function normalizeStatusWorkers(status: CpproJudgeStatus | null) {
  if (!status) return [];
  if (Array.isArray(status.workers) && status.workers.length) {
    return [...status.workers].sort((a, b) => String(a.workerId).localeCompare(String(b.workerId)));
  }
  return Array.from({ length: Math.max(0, status.workersOnline || 0) }, (_item, index) => ({
    workerId: `judge${index + 1}`,
    concurrency: Math.max(1, Math.floor((status.concurrency || status.workersOnline || 1) / Math.max(1, status.workersOnline || 1))),
    updatedAt: status.checkedAt,
  }));
}

function statusPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatStatusAge(seconds: number, copy: StatusCopy) {
  if (!seconds || seconds < 0) return copy.none;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function relativeStatusAge(value: string, copy: StatusCopy) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return copy.online;
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  return seconds < 5 ? copy.online : formatStatusAge(seconds, copy);
}

function UserCard({ user, rank, onClick }: { user: UserRow; rank: number; onClick: () => void }) {
  return (
    <button className="user-card" type="button" onClick={onClick}>
      <Avatar user={user} />
      <span>
        <strong>#{rank} {user.fullName}</strong>
        <small>@{user.username} · {user.rankName}</small>
        <UserBadges user={user} />
      </span>
      <em>{user.solved} solved</em>
    </button>
  );
}

function Avatar({ user, large = false }: { user: UserRow; large?: boolean }) {
  return user.avatarUrl ? (
    <img className={large ? 'avatar large' : 'avatar'} src={user.avatarUrl} alt={user.username} />
  ) : (
    <span className={large ? 'avatar avatar-fallback large' : 'avatar avatar-fallback'}>{user.username?.[0]?.toUpperCase() || 'U'}</span>
  );
}

function MarkdownBlock({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

function DataLoadingPanel({
  label = 'Đang tải dữ liệu từ database',
  rows = 4,
  compact = false,
}: {
  label?: string;
  rows?: number;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'data-loading-panel compact' : 'data-loading-panel'} role="status" aria-live="polite" data-api-loading>
      <span className="data-loading-spinner"><Loader2 size={18} /></span>
      <strong>{label}</strong>
      <div className="data-loading-bars" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => <i key={index} />)}
      </div>
    </div>
  );
}

function InlineLoadingText({ label = 'Đang tải dữ liệu' }: { label?: string }) {
  return (
    <span className="inline-loading-text" role="status" aria-live="polite" data-inline-loading>
      <Loader2 size={14} />
      {label}
    </span>
  );
}

function TableLoadingRows({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="table-loading-rows" role="status" aria-live="polite" data-table-loading>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="table-loading-row">
          {Array.from({ length: columns }, (_, columnIndex) => <i key={columnIndex} />)}
        </div>
      ))}
    </div>
  );
}

function TagStack({ tags }: { tags: Problem['tags'] }) {
  if (!tags?.length) return <span className="tag">Chưa phân loại</span>;
  return <span className="tag-stack">{tags.slice(0, 3).map((tag) => <span className="tag" key={tag.slug}>{tag.name}</span>)}</span>;
}

function Empty({ title, subtitle }: { title: string; subtitle?: string }) {
  return <section className="content-card empty-state"><FileQuestion size={44} /><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</section>;
}

function Footer({ contact: initialContact }: { contact: FooterContactSettings }) {
  const [contact, setContact] = useState(() => readFooterContactSettings(initialContact));
  const footerLogoUrl = safeExternalHref(contact.logoUrl, '');
  const lcojLegacyRoutes = shouldUseLcojLegacyRoutes();

  useEffect(() => {
    setContact(readFooterContactSettings(initialContact));
    const sync = () => setContact(readFooterContactSettings(initialContact));
    window.addEventListener('storage', sync);
    window.addEventListener('cppro-contact-settings-changed', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('cppro-contact-settings-changed', sync);
    };
  }, [initialContact]);

  return (
    <footer className="footer">
      <div className="footer-pattern" aria-hidden="true" />
      <img className="footer-mascot footer-mascot-left" src="/assets/VOI2-DR2xWw91.png" alt="" aria-hidden="true" />
      <img className="footer-mascot footer-mascot-right" src="/assets/VOI4-BfYVe9Fk.png" alt="" aria-hidden="true" />
      <div className="footer-grid">
        <section className="footer-brand">
          <div className="footer-logo">
            {footerLogoUrl ? <img src={footerLogoUrl} alt={contact.brandName} /> : <span className="brand-mark" aria-hidden="true">{compactBrandMark(contact.brandName)}</span>}
            <span>{contact.brandName}</span>
          </div>
          <p>Nâng tầm kỹ năng lập trình cùng đội ngũ giảng viên giàu kinh nghiệm.</p>
          <div className="footer-socials" aria-label="Mạng xã hội">
            <a className="social-facebook" href={safeExternalHref(contact.facebook, '#')} target="_blank" rel="noreferrer" aria-label="Facebook">f</a>
            <a className="social-youtube" href={safeExternalHref(contact.youtube, '#')} target="_blank" rel="noreferrer" aria-label="YouTube">▶</a>
            <a className="social-tiktok" href={safeExternalHref(contact.tiktok, '#')} target="_blank" rel="noreferrer" aria-label="TikTok">♪</a>
          </div>
        </section>
        {lcojLegacyRoutes ? (
          <>
            <section className="footer-column">
              <strong>LCOJ</strong>
              <a href="/problems">Bài tập</a>
              <a href="/contests">Kỳ thi</a>
              <a href="/submissions">Bài nộp</a>
              <a href="/users">Thành viên</a>
            </section>
            <section className="footer-column">
              <strong>Hỗ trợ</strong>
              <a href="/posts">Thông báo</a>
              <a href="/status">Trạng thái</a>
              <a href="/runtimes">Ngôn ngữ</a>
              <a href="/login">Đăng nhập</a>
            </section>
          </>
        ) : (
          <>
            <section className="footer-column">
              <strong>Khóa học</strong>
              <a href="/courses">Khóa học Zoom</a>
              <a href="/hsg">Luyện đề HSG</a>
              <a href="/contests">Kỳ thi</a>
              <a href="/problems">Bài tập</a>
            </section>
            <section className="footer-column">
              <strong>Hỗ trợ</strong>
              <a href="/submissions">Bài nộp</a>
              <a href="/users">Bảng xếp hạng</a>
              <a href="/login">Đăng nhập</a>
              <a href="/register">Đăng ký</a>
            </section>
          </>
        )}
        <section className="footer-column footer-contact">
          <strong>Liên hệ</strong>
          {contact.emails.map((email) => <a key={email} href={`mailto:${email}`}><Mail size={16} /> {email}</a>)}
          {contact.phones.map((phone) => <a key={phone} href={`tel:${phone.replace(/[^\d+]/g, '')}`}><Phone size={16} /> {phone}</a>)}
          <span><MapPin size={16} /> {contact.location}</span>
          <span><Globe size={16} /> {contact.domainName}</span>
        </section>
      </div>
      <div className="footer-copyright">{contact.copyrightText}</div>
    </footer>
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function acRate(problem: Problem) {
  return problem.submissions > 0 ? (problem.accepted / problem.submissions) * 100 : 0;
}

function verdictClass(verdict?: string) {
  const key = String(verdict || '').toUpperCase();
  if (key === 'AC') return 'verdict ac';
  if (key === 'WA') return 'verdict wa';
  if (key === 'TLE' || key === 'MLE') return 'verdict warn';
  return 'verdict';
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

function formatUtcDateTime(value?: string) {
  if (!value) return 'UTC —';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'UTC —';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date) + ' UTC';
}

function formatTimeInZone(timezone: string, value = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      dateStyle: 'medium',
      timeStyle: 'medium',
      hour12: false,
    }).format(value);
  } catch {
    return formatUtcDateTime(value.toISOString());
  }
}

function formatTimezoneOffset(timezone: string, value = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(value);
    const raw = parts.find((part) => part.type === 'timeZoneName')?.value || 'GMT';
    const normalized = raw.replace(/^GMT$/, 'UTC').replace(/^GMT/, 'UTC');
    const match = normalized.match(/^UTC([+-])(\d{1,2})(?::?(\d{2}))?$/);
    if (!match) return normalized;
    return `UTC${match[1]}${match[2].padStart(2, '0')}:${match[3] || '00'}`;
  } catch {
    return 'UTC';
  }
}

function formatTimezoneClock(timezone: string, value = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(value);
  } catch {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(value);
  }
}

function formatTimezoneOptionLabel(timezone: string, value = new Date()) {
  return `${timezone} (${formatTimezoneOffset(timezone, value)} · ${formatTimezoneClock(timezone, value)})`;
}

function formatPrice(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(value))}đ`;
}

function formatCompactScore(value: number) {
  return Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 });
}

function rankMedal(rank: number) {
  if (rank === 1) return <Crown size={16} />;
  return <Medal size={16} />;
}

function tierLabel(value?: string) {
  if (!value) return 'member';
  return value.replace(/_/g, ' ').toUpperCase();
}

function tierClass(value?: string) {
  return `tier-badge ${value || 'member'}`;
}

function compactBrandMark(value?: string) {
  const raw = String(value || defaultFooterContactSettings.brandName).trim();
  if (!raw) return 'OJ';
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 8);
  return words.map((word) => word[0]).join('').slice(0, 8).toUpperCase();
}

function dateKey(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function buildProfileActivityCells(activity: UserActivityHeatmapPoint[], submissions: Submission[]) {
  const counts = new Map<string, number>();
  activity.forEach((item) => {
    const key = dateKey(item.date);
    if (key) counts.set(key, (counts.get(key) || 0) + Math.max(0, Number(item.count) || 0));
  });
  if (!counts.size) {
    submissions.forEach((item) => {
      const key = dateKey(item.submittedAt);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
  }
  const max = Math.max(1, ...Array.from(counts.values()));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 91 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (90 - index));
    const key = date.toISOString().slice(0, 10);
    const count = counts.get(key) || 0;
    const level = count ? Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) : 0;
    return { date: key, count, level };
  });
}

function formatProfileJoinDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `Tham gia ${date.toLocaleDateString('vi-VN', { month: 'short', year: 'numeric' })}`;
}

function formatRatingDelta(value: number) {
  if (!Number.isFinite(value) || value === 0) return '0';
  return value > 0 ? `+${value}` : String(value);
}

function profileRankTone(user: UserRow) {
  const label = `${user.proTier || ''} ${user.rankName || ''} ${user.tags.join(' ')}`.toLowerCase();
  const rating = Number(user.rating || 0);
  if (label.includes('admin')) return 'admin';
  if (label.includes('legendary') || rating >= 2900) return 'legendary';
  if (user.rankColor === 'destructive') return 'grandmaster';
  if (user.rankColor === 'warning') return 'master';
  if (user.rankColor === 'caution') return 'specialist';
  if (user.rankColor === 'success') return 'pupil';
  if (user.rankColor === 'muted') return 'newbie';
  if (label.includes('international grandmaster') || label.includes('grandmaster') || rating >= 2400) return 'grandmaster';
  if (label.includes('international master') || label.includes('master') || rating >= 1900) return 'master';
  if (label.includes('expert') || rating >= 1600) return 'expert';
  if (label.includes('specialist') || rating >= 1400) return 'specialist';
  if (label.includes('pupil') || rating >= 1200) return 'pupil';
  return 'newbie';
}

function profileRankLineClass(user: UserRow) {
  return `profile-rank-line profile-rank-${profileRankTone(user)}`;
}

function formatRange(start?: string, end?: string) {
  return `${formatDate(start)} - ${formatDate(end)}`;
}

createRoot(document.getElementById('root')!).render(<App />);
