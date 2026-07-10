// Shared data-shape types and pure constants for the CPPro frontend.
// Extracted from main.tsx (module split); reconstructed from HEAD be98a18.

export type Problem = {
  id: number;
  code: string;
  slug: string;
  title: string;
  difficulty: string;
  score: number;
  source: string;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  accepted: number;
  submissions: number;
  solvers: number;
  userSolved?: boolean;
  userAttempts?: number;
  myStatus?: string | null;
  myBestVerdict?: string | null;
  tags: Array<{ id: number; name: string; slug: string }>;
  statement?: string;
  inputDescription?: string;
  outputDescription?: string;
  constraints?: string;
  editorial?: string;
  createdBy?: string;
  allowedLanguages?: string[] | null;
};

export type JudgeLanguage = {
  code: string;
  label: string;
  runtimeLabel?: string | null;
  extension?: string | null;
  sourceTemplate?: string | null;
};

export type ContestProblem = {
  id?: number;
  external_id?: string;
  title?: string;
  problem?: number;
  problem_code?: string;
  order_index?: number;
  order_idx?: number;
  points?: string | number;
  rating_points?: string | number | null;
  problem_title_snapshot?: string;
  problem_slug_snapshot?: string;
  difficulty_tag?: string;
  difficulty?: string;
  time_limit_ms_snapshot?: number;
  memory_limit_mb_snapshot?: number;
  my_status?: string;
  my_best_verdict?: string | null;
  user_solved?: boolean;
  submissions?: number;
  accepted?: number;
};

export type Contest = {
  id: number;
  slug: string;
  title: string;
  scope?: string;
  accessType?: string;
  format?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  participants: number;
  virtualParticipants: number;
  problemCount: number;
  status: string;
  description?: string;
  problems?: ContestProblem[];
  myAttendance?: { status?: string | null; note?: string | null; checked_at?: string | null } | null;
  myParticipant?: {
    status?: string | null;
    virtual?: number | boolean | null;
    virtual_start?: string | null;
    team_name?: string | null;
    joined_at?: string | null;
    updated_at?: string | null;
  } | null;
};

export type UserRow = {
  id?: number;
  username: string;
  fullName: string;
  avatarUrl?: string | null;
  rating: number;
  score: number;
  solved: number;
  streak: number;
  maxStreak: number;
  rankName: string;
  rankColor?: CpproRatingBand['color'];
  tags: string[];
  proTier: string;
  bio?: string;
  maxRating?: number;
  contestCount?: number;
  totalSubmissions?: number;
  createdAt?: string;
  organizationName?: string | null;
  organizationSlug?: string | null;
  acceptedSubmissions?: number;
  accuracy?: number;
  contestScore?: number;
  virtualScore?: number;
  contestRatingTimes?: number;
  ratingHistory?: UserRatingHistoryPoint[];
  activityHeatmap?: UserActivityHeatmapPoint[];
  solvedTags?: UserSolvedTag[];
  solvedProblems?: UserProblemSummary[];
  unfinishedProblems?: UserProblemSummary[];
  recentSubmissions?: Submission[];
  badges?: string[];
};

export type UserRatingHistoryPoint = {
  contestId?: number;
  contestTitle: string;
  rating: number | null;
  oldRating?: number | null;
  delta?: number | null;
  rank?: number | null;
  performance?: number | null;
  createdAt: string;
  virtual?: boolean;
};

export type UserActivityHeatmapPoint = {
  date: string;
  count: number;
};

export type UserSolvedTag = {
  name: string;
  slug: string;
  count: number;
};

export type UserProblemSummary = {
  id?: number;
  slug: string;
  title: string;
  solvedAt?: string;
  lastAttempt?: string;
};

export type HomeActivityPoint = {
  day: string;
  value: number;
  accepted: number;
  failed?: number;
};

export type HomeSummary = {
  activity: HomeActivityPoint[];
  streak: {
    current: number;
    longest: number;
  };
  challenge: Problem | null;
  presence?: {
    online: number;
    total: number;
  };
  traffic?: {
    visits: number | null;
    pageViews: number | null;
  };
};

export type StoredCpproUser = {
  username: string;
  displayName?: string;
  email?: string;
  full_name?: string;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  school_name?: string | null;
  phone?: string | null;
  roles?: string[];
  role?: string;
  is_teacher?: boolean;
  membership_tier?: 'free' | 'pro' | 'ultra' | 'ultra_max';
  membership_expires_at?: string | null;
  rating?: number;
  rank_name?: string;
  bio?: string | null;
  pro_tier?: string | null;
  streak?: number;
  max_streak?: number;
  activity?: Array<number | { day?: string; value?: number; accepted?: number }>;
  target_text?: string;
  target_daily_number?: number;
  target_streak?: number;
  max_target_streak?: number;
  total_target_completed_days?: number;
  solved?: number;
  score?: number;
  pp_score?: number;
  tags?: string[];
  streak_timezone?: string;
  streak_timezone_changed_at?: string | null;
};

export type Submission = {
  id: number;
  username: string;
  problemTitle: string;
  problemSlug: string;
  contestTitle?: string;
  contestSlug?: string;
  language: string;
  verdict: string;
  score: string;
  maxScore: string;
  passed: number;
  total: number;
  timeMs: number;
  memoryKb: number;
  submittedAt: string;
};

export type ContestTabKey = 'info' | 'announcements' | 'leaderboard' | 'join' | 'submissions';

export type ContestComment = {
  id: string;
  author: string;
  fullName: string;
  body: string;
  createdAt: string;
  score: number;
};

export type SortDirection = 'asc' | 'desc';

export type SortState<Key extends string> = {
  key: Key;
  direction: SortDirection;
};

export type ParsedTestResult = {
  index: number;
  caseId?: number;
  order?: number;
  verdict: string;
  runtime?: number;
  memory?: number;
  point?: number;
  message?: string;
  input?: string;
  expected?: string;
  actual?: string;
  stderr?: string;
};

export type ProblemComment = {
  id: number | string;
  parentId?: number | null;
  author: string;
  fullName: string;
  avatarUrl?: string | null;
  body: string;
  isDeleted: boolean;
  reactions: Record<string, number>;
  reactionCount: number;
  myReaction?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type ProblemStatsSummary = {
  total: number;
  accepted: number;
  partial: number;
  wrong: number;
  runtime: number;
  tle: number;
  pending: number;
  avgRuntime?: number | null;
  fastestRuntime?: number | null;
};

export type SubmissionVerificationChallenge = {
  challengeId: string;
  prompt: string;
  expiresAt: string;
};

export type Course = {
  id: number;
  name: string;
  slug: string;
  short_description: string;
  banner: string;
  bannerLocal?: string;
  theme_color: string;
  url_apply?: string | null;
  price: number;
  duration_months: number;
  sessions_per_month: number;
  schedule_note: string;
  status: string;
  language: string;
};

export type HsgCategory = {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  order?: number;
  paper_count?: number;
  is_default?: boolean;
  color_config?: {
    banner?: string;
    iconBox?: string;
    progress?: string;
    iconBorder?: string;
  };
};

export type HsgExam = {
  id: number;
  title: string;
  category: number;
  category_detail?: HsgCategory;
  contest_slug: string;
  contest_title?: string;
  year: number;
  exam_date: string;
  total_problems: number;
  solved_problems: number;
  attempted_problems: number;
  progress_percent: number;
  status: string;
  solution_url?: string;
};

export type OrganizationRow = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  visibility: string;
  memberCount: number;
  problemCount: number;
  contestCount: number;
  totalRating: number;
  myRole?: string | null;
  myStatus?: string | null;
  createdBy?: string | null;
  updatedAt?: string;
};

export const defaultTopbarFeatures = {
  announcements: true,
  problemset: false,
  problems: true,
  contests: true,
  quizzes: true,
  organizations: true,
  courses: true,
  hsg: true,
  goals: true,
  users: true,
  submissions: true,
  messages: true,
} as const;

export type TopbarFeatureKey = keyof typeof defaultTopbarFeatures;
export type TopbarFeatures = Record<TopbarFeatureKey, boolean>;

export type CpproData = {
  generatedAt: string | null;
  source: string | null;
  crawlManifest?: string | null;
  stats: Record<string, number>;
  problems: Problem[];
  problemDetails: Record<string, Problem>;
  contests: Contest[];
  contestDetails: Record<string, Contest>;
  users: UserRow[];
  profiles: Record<string, UserRow>;
  submissions: Submission[];
  posts: HomePost[];
  notifications: HomePost[];
  exams: HsgExam[];
  organizations: OrganizationRow[];
  hsgCategories?: HsgCategory[];
  tags: Array<{ id: number; name: string; slug: string }>;
  courses: Course[];
  judgeLanguages: JudgeLanguage[];
  homeSummary: HomeSummary | null;
  auth: {
    googleEnabled: boolean;
  };
  contact: FooterContactSettings;
  topbarFeatures: TopbarFeatures;
  ratingSettings?: CpproRatingSettings;
  platformFrontendUrl?: string | null;
};

export type FooterContactSettings = {
  brandName: string;
  domainName: string;
  logoUrl: string;
  copyrightText: string;
  emails: string[];
  phones: string[];
  location: string;
  facebook: string;
  youtube: string;
  tiktok: string;
};

export type AuthUser = {
  id: number;
  username: string;
  email?: string;
  full_name?: string;
  avatar_url?: string | null;
  bio?: string | null;
  role: string;
  is_teacher?: boolean;
  membership_tier?: 'free' | 'pro' | 'ultra' | 'ultra_max';
  membership_expires_at?: string | null;
  streak_timezone?: string;
  streak_timezone_changed_at?: string | null;
};

export type AuthResult = {
  token: string;
  user: StoredCpproUser;
};

export type ThemeMode = 'light' | 'dark' | 'system';
export type CpproLocale = 'vi' | 'en';

export const fallbackJudgeLanguages: JudgeLanguage[] = [
  ['awk', 'AWK', 'awk'], ['c', 'C', 'c'], ['c11', 'C11', 'c'], ['c23', 'C23', 'c'],
  ['cobol', 'Cobol', 'cob'], ['clang', 'Clang', 'c'], ['clang_cpp14', 'Clang C++14', 'cpp'],
  ['clang_cpp17', 'Clang C++17', 'cpp'], ['clang_cpp20', 'Clang C++20', 'cpp'],
  ['clang_cpp23', 'Clang C++23', 'cpp'], ['clang_cpp26', 'Clang C++26', 'cpp'],
  ['cpp03', 'C++03', 'cpp'], ['cpp11', 'C++11', 'cpp'], ['cpp14', 'C++14', 'cpp'],
  ['cpp17', 'C++17', 'cpp'], ['cpp20', 'C++20', 'cpp'], ['cpp23', 'C++23', 'cpp'],
  ['cpp26', 'C++26', 'cpp'], ['d', 'D', 'd'], ['assembly_x64', 'Assembler (x64)', 'asm'],
  ['haskell', 'Haskell', 'hs'], ['java', 'Java', 'java'], ['java8', 'Java 8', 'java'],
  ['java19', 'Java 19', 'java'], ['kotlin', 'Kotlin', 'kt'], ['lua', 'Lua', 'lua'],
  ['csharp', 'C#', 'cs'], ['javascript', 'Node JS', 'js'], ['objective_c', 'Objective-C', 'm'],
  ['ocaml', 'OCaml', 'ml'], ['output_only', 'Output', 'out'], ['pascal', 'Pascal', 'pas'],
  ['perl', 'Perl', 'pl'], ['php', 'PHP', 'php'], ['prolog', 'SWI-Prolog', 'pl'],
  ['python2', 'Python 2', 'py'], ['python', 'Python 3', 'py'], ['pypy2', 'PyPy 2', 'py'],
  ['pypy3', 'PyPy 3', 'py'], ['ruby', 'Ruby', 'rb'], ['rust', 'Rust', 'rs'],
  ['scala', 'Scala', 'scala'], ['scratch', 'Scratch', 'sb3'], ['v8_javascript', 'V8 Javascript', 'js'],
  ['go', 'Go', 'go'], ['typescript', 'TypeScript', 'ts'], ['bash', 'Bash', 'sh'],
].map(([code, label, extension]) => ({ code, label, extension }));

export const emptyStats = {
  problems: 0,
  capturedProblems: 0,
  problemDetails: 0,
  contests: 0,
  users: 0,
  onlineUsers: 0,
  visits: 0,
  pageViews: 0,
  submissions: 0,
  posts: 0,
  notifications: 0,
  exams: 0,
  organizations: 0,
  tags: 0,
  courses: 0,
  hsgCategories: 0,
};

export const footerContactStorageKey = 'cppro_footer_contact_settings';

export const defaultFooterContactSettings: FooterContactSettings = {
  brandName: 'Online Judge',
  // Neutral placeholders only — operators configure real values in footer settings.
  // Never ship a production IP or personal contact details as source defaults (M-12).
  domainName: 'localhost',
  logoUrl: '',
  copyrightText: '',
  emails: ['contact@example.com'],
  phones: [''],
  location: '',
  facebook: 'https://www.facebook.com/',
  youtube: 'https://www.youtube.com/',
  tiktok: 'https://www.tiktok.com/',
};

export const emptyCpproData: CpproData = {
  generatedAt: null,
  source: null,
  crawlManifest: null,
  stats: emptyStats,
  problems: [],
  problemDetails: {},
  contests: [],
  contestDetails: {},
  users: [],
  profiles: {},
  submissions: [],
  posts: [],
  notifications: [],
  exams: [],
  organizations: [],
  hsgCategories: [],
  tags: [],
  courses: [],
  judgeLanguages: fallbackJudgeLanguages,
  homeSummary: null,
  auth: {
    googleEnabled: false,
  },
  contact: defaultFooterContactSettings,
  topbarFeatures: defaultTopbarFeatures,
  platformFrontendUrl: null,
};


export type CommunityTabKey = 'all' | 'news' | 'emotion' | 'blog';

export type CpproRatingBand = {
  min: number;
  name: string;
  color: 'muted' | 'success' | 'caution' | 'primary' | 'warning' | 'destructive';
};

export type CpproRatingSettings = {
  enabled: boolean;
  base_rating: number;
  k_provisional: number;
  k_stable: number;
  provisional_threshold: number;
  bands: CpproRatingBand[];
};

export type HomePost = {
  id?: number;
  slug?: string;
  isRead?: boolean;
  readAt?: string | null;
  categoryKey: CommunityTabKey;
  user: UserRow;
  // Legacy/table-view fields still referenced by the posts management table.
  author?: string;
  votes?: number;
  date: string;
  category: string;
  title: string;
  body: string;
  image?: string;
  reactions: number;
  emotionReactions?: Record<string, number>;
  emotionReactionCount?: number;
  myReaction?: string | null;
  reactionActors?: CommunityReactionActor[];
  comments: number;
  commentsPreview?: CommunityComment[];
};

export type CommunityReactionActor = {
  username: string;
  fullName: string;
  avatarUrl?: string | null;
  reaction: string;
  updatedAt?: string | null;
};

export type CommunityComment = {
  id?: string | number;
  parentId?: string | number | null;
  author: string;
  badge: string;
  body: string;
  avatarUrl?: string | null;
  score?: number;
  voteCount?: number;
  myVote?: number;
  reactions?: Record<string, number>;
  reactionCount?: number;
  myReaction?: string | null;
  createdAt?: string;
};

// Organization detail payload types (reconstructed from the mapBackendOrganization*
// mappers and fetchOrganizationDetail in main.tsx).
export type OrganizationMemberDetail = {
  userId: number;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
  status: string;
  joinedAt?: string;
};

export type OrganizationProblemDetail = {
  id: number;
  slug: string;
  title: string;
  difficulty: string;
  visibility: string;
  updatedAt?: string;
};

export type OrganizationContestDetail = {
  id: number;
  slug: string;
  title: string;
  status: string;
  visibility: string;
  startTime?: string;
  endTime?: string;
};

export type OrganizationDetailPayload = {
  organization: OrganizationRow;
  canAccess: boolean;
  canManage: boolean;
  myJoinRequest: Record<string, unknown> | null;
  members: OrganizationMemberDetail[];
  problems: OrganizationProblemDetail[];
  contests: OrganizationContestDetail[];
};
