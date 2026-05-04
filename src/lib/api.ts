import {
  clearDemoMode,
  handleDemoRequest,
  isDemoModeEnabled,
} from "@/lib/demo-mode";

export interface User {
  id: string;
  name: string;
  username?: string | null;
  role: "admin" | "user";
  accessTier?: "standard" | "observer";
  email: string;
  weakAreas: string[];
  strongTopics: string[];
  targetRole?: string | null;
  placementDate?: string | null;
  timezone: string;
  solvedProblems: number;
  averageTimePerProblem: number;
  failedAttempts: number;
  mistakeCount: number;
  consistencyScore: number;
  currentStreak: number;
  readinessScore: number;
  preferredLanguage?: "english" | "tamil" | "hindi" | null;
  coachMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string | null;
  userId: string;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  leetcodeUrl?: string | null;
  portfolioUrl?: string | null;
  resumeUrl?: string | null;
  avatarUrl?: string | null;
  notificationsEnabled?: boolean;
  notificationEmailEnabled?: boolean;
  notificationBrowserEnabled?: boolean;
  notificationBrowserPermission?: "default" | "granted" | "denied" | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface WebPushConfig {
  enabled: boolean;
  publicKey: string;
}

export interface InvitePreview {
  code: string;
  valid: boolean;
  status: "valid" | "used" | "expired" | "missing";
  role?: "admin" | "user" | "observer";
  accessTier?: "standard" | "observer";
  persistent?: boolean;
  expiresAt?: string | null;
  inviteLink?: string;
  message: string;
}

export interface InviteRecord {
  id: string;
  code: string;
  role: "admin" | "user";
  createdBy?: string | null;
  expiresAt: string;
  used: boolean;
  usedBy?: string | null;
  usedAt?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  status: "valid" | "used" | "expired" | "missing";
  inviteLink: string;
}

export interface ApkVersion {
  id: string;
  version: string;
  fileName: string;
  fileUrl: string;
  publicId?: string | null;
  mimeType?: string | null;
  bytes: number;
  storageProvider: string;
  uploadedBy?: string | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
  downloadPath: string;
}

export interface UploadedImage {
  id: string;
  userId?: string;
  taskId?: string | null;
  dailyLogId?: string | null;
  secureUrl: string;
  publicId: string;
  assetId?: string | null;
  mimeType?: string | null;
  format?: string | null;
  bytes?: number;
  width?: number | null;
  height?: number | null;
  storageProvider?: string | null;
  proofDate?: string | null;
  caption?: string | null;
  verification?: {
    attempted: boolean;
    verified: boolean;
    method: string;
    reason: string;
    confidence?: number;
    taskId?: string;
    taskStatus?: TaskStatus;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface PracticeCapsuleItem {
  taskId: string;
  title: string;
  description?: string | null;
  category: string;
  status: TaskStatus;
  referenceLabel?: string | null;
  referenceUrl?: string | null;
  capsuleType: string;
  dueAt?: string | null;
  scheduledFor: string;
  createdAt: string;
}

export interface PracticeCapsule {
  bundleId: string;
  title: string;
  note?: string | null;
  studentUserId: string;
  assignedById?: string | null;
  assignedByName?: string | null;
  assignmentId?: string | null;
  dueAt?: string | null;
  scheduledFor: string;
  createdAt: string;
  items: PracticeCapsuleItem[];
}

export interface StudentOversightRecord {
  student: User;
  invitedBy: {
    id?: string | null;
    name?: string | null;
    username?: string | null;
    inviteCode?: string | null;
    invitedAt: string;
  };
  progress: {
    streak: number;
    consistencyScore: number;
    readinessScore: number;
    solvedProblems: number;
    averageTimePerProblem: number;
    failedAttempts: number;
    totalHours: number;
    tasksCompleted: number;
    statDate?: string | null;
    weeklyProgress: WeeklyProgressPoint[];
    topicStrength: TopicStrengthPoint[];
  };
  taskSummary: {
    userId: string;
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    skipped: number;
    overdue: number;
  };
  recentProofs: UploadedImage[];
  progressHistory: ProgressHistoryItem[];
  practiceCapsules: PracticeCapsule[];
}

export interface CoachGroupMember {
  groupId: string;
  userId: string;
  name: string;
  username?: string | null;
  role: "admin" | "user";
  email: string;
  targetRole?: string | null;
  readinessScore: number;
  accessTier?: "standard" | "observer";
  addedBy?: string | null;
  addedByName?: string | null;
  createdAt: string;
}

export interface CoachGroupCandidate {
  id: string;
  name: string;
  username?: string | null;
  role: "admin" | "user";
  email: string;
  targetRole?: string | null;
  accessTier?: "standard" | "observer";
}

export interface CoachGroup {
  id: string;
  name: string;
  description?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  assignmentRecipientCount?: number;
  members: CoachGroupMember[];
}

export interface PracticeCapsuleDispatchResult {
  dispatchId: string;
  targetKind: "student" | "group";
  targetId: string;
  targetLabel: string;
  recipientsCount: number;
  notificationsCreated: number;
  capsules: PracticeCapsule[];
}

export interface ResumeSectionCoverage {
  summary?: boolean;
  education?: boolean;
  experience?: boolean;
  projects?: boolean;
  skills?: boolean;
  achievements?: boolean;
  [key: string]: boolean | undefined;
}

export interface ResumeAnalysisRecord {
  id: string;
  userId: string;
  fileName: string;
  mimeType?: string | null;
  secureUrl?: string | null;
  publicId?: string | null;
  storageProvider?: string | null;
  sizeBytes: number;
  extractedText?: string | null;
  analysisSummary?: string | null;
  score: number;
  strengths: string[];
  improvements: string[];
  keywords: string[];
  sections: ResumeSectionCoverage;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType =
  | "daily_inactivity"
  | "pending_tasks"
  | "missed_streak"
  | "countdown_urgency"
  | "motivation"
  | "coach_capsule";

export interface PrepNotification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  sentAt: string;
  read: boolean;
  readAt?: string | null;
  deliveryChannels: string[];
  metadata: Record<string, unknown>;
  dedupeKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSyncResult {
  created: PrepNotification[];
  emailAttempted: boolean;
  emailSent: boolean;
  emailReason: string;
  emailReady: boolean;
}

export interface PushNotificationTestResult {
  notification: PrepNotification | null;
  attempted: boolean;
  sentCount: number;
  failedCount: number;
  reason: string;
  browserReady: boolean;
  pushReady: boolean;
}

export interface HistoryClearResult {
  deleted: number;
  clearedAt: string;
}

export interface ScopedHistoryClearResult extends HistoryClearResult {
  affectedUsers?: number;
  scope?: "selected" | "student" | "group";
}

export type TaskStatus = "pending" | "in_progress" | "completed" | "skipped";

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  category: string;
  subcategory?: string | null;
  status: TaskStatus;
  priority: "low" | "medium" | "high";
  intensity?: string | null;
  referenceLabel?: string | null;
  referenceUrl?: string | null;
  dueDate?: string | null;
  dueAt?: string | null;
  scheduledFor: string;
  estimatedMinutes: number;
  actualMinutes: number;
  difficulty?: number | null;
  weakArea?: string | null;
  aiGenerated: boolean;
  metadata: Record<string, unknown>;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PowerPocketSession {
  id: string;
  userId: string;
  taskId?: string | null;
  title?: string | null;
  notes?: string | null;
  status: "active" | "completed" | "abandoned";
  source: "manual" | "suggested" | "ai";
  startedAt: string;
  endedAt?: string | null;
  durationMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyProgressPoint {
  date: string;
  day: string;
  missions: number;
  hours: number;
}

export interface TopicStrengthPoint {
  topic: string;
  strength: number;
}

export interface CoachProfile {
  solvedProblems: number;
  weakTopics: string[];
  strongTopics: string[];
  averageTimePerProblem: number;
  consistencyScore: number;
  streak: number;
  readinessScore: number;
  failedAttempts: number;
  mistakeCount: number;
  focusArea: string;
  trackedDays: number;
  commandLine: string;
  lastRefreshedAt: string;
}

export interface ProgressSummary {
  focusScore: number;
  disciplineIndex: number;
  executionRate: number;
  totalHoursLogged: number;
  missionsCompleted: number;
  streak: number;
  bonusStreak: number;
  consistencyScore: number;
  readinessScore: number;
  weeklyProgress: WeeklyProgressPoint[];
  topicStrength: TopicStrengthPoint[];
  coachProfile: CoachProfile;
  stat: {
    id: string;
    statDate: string;
  };
}

export interface AiTaskPlan {
  motivationLine: string;
  tasks: Task[];
  profile: CoachProfile;
  profileLinks?: UserProfile;
  totalEstimatedMinutes: number;
  persisted: boolean;
  replacedCount: number;
  usedFallback: boolean;
}

export interface AiHelpResult {
  hint: string;
  approachSteps: string[];
  similarProblems: string[];
  youtubeSearchKeywords: string[];
  profile: CoachProfile;
  profileLinks?: UserProfile;
  usedFallback: boolean;
}

export interface AiEvaluationResult {
  productivityScore: number;
  weakAreas: string[];
  tomorrowImprovements: string[];
  verdict: string;
  profile: CoachProfile;
  profileLinks?: UserProfile;
  usedFallback: boolean;
}

export interface QuickTaskSuggestion {
  title: string;
  category: string;
  estimatedMinutes: number;
  difficulty: string;
  referenceLabel?: string | null;
  referenceUrl?: string | null;
  reason: string;
}

export interface AiQuickTaskResult {
  task: QuickTaskSuggestion;
  suggestionLine: string;
  profile: CoachProfile;
  profileLinks?: UserProfile;
  usedFallback: boolean;
}

export interface AiStatus {
  aiEnabled: boolean;
  reason: "working" | "quota_exceeded" | "no_key" | string;
  provider: string;
  model: string;
  fallbackMode: boolean;
  lastCheckedAt?: string | null;
  lastError?: string | null;
}

export interface ProgressHistoryItem {
  id: string;
  userId: string;
  statDate: string;
  streak: number;
  bonusStreak: number;
  consistencyScore: number;
  readinessScore: number;
  executionRate: number;
  totalHours: number;
  tasksCompleted: number;
  powerPocketMinutes: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PrepRoadmapWeek {
  week: number;
  title: string;
  focusTopics: string[];
  estimatedHours: number;
  goals: string[];
}

export type PrepLanguage = "english" | "tamil" | "hindi";

export interface PrepPlanTaskItem {
  title: string;
  type: string;
  estimatedMinutes: number;
  difficulty: string;
  referenceLabel?: string | null;
  referenceUrl?: string | null;
  summary?: string | null;
}

export interface PrepPlanDay {
  day: string;
  theme: string;
  totalEstimatedMinutes: number;
  items: PrepPlanTaskItem[];
}

export interface PrepResourceItem {
  title: string;
  type: string;
  url: string;
}

export interface PrepResourceGroup {
  topic: string;
  items: PrepResourceItem[];
}

export interface Flashcard {
  topic: string;
  question: string;
  answer: string;
}

export interface PrepPlan {
  id: string;
  userId: string;
  knownTopics: string[];
  targetTopics: string[];
  roadmap: PrepRoadmapWeek[];
  tasks: PrepPlanDay[];
  resources: PrepResourceGroup[];
  flashcards: Flashcard[];
  timePerDay: number;
  durationMonths: number;
  targetRole?: string | null;
  preferredLanguage?: PrepLanguage;
  version: number;
  isActive: boolean;
  sourcePlanId?: string | null;
  metadata: Record<string, unknown>;
  title?: string;
  autoTitle?: string;
  titleSource?: "generated" | "custom";
  createdAt: string;
  updatedAt: string;
  coachLine?: string;
  usedFallback?: boolean;
}

export type AssessmentType = "mcq" | "fill_blank" | "coding";
export type AssessmentScope = "daily" | "weekly";
export type AssessmentPhase = "pre" | "post" | "surprise";

export interface AssessmentQuestionChoice {
  id: string;
  label: string;
  text: string;
}

export interface AssessmentQuestion {
  id: string;
  topic: string;
  prompt: string;
  type: AssessmentType;
  averageTimeMinutes: number;
  referenceLabel?: string | null;
  referenceUrl?: string | null;
  choices?: AssessmentQuestionChoice[];
  placeholder?: string | null;
  taskTitle?: string | null;
  contextTitle?: string | null;
  contextSummary?: string | null;
  benchmarkLabel?: string | null;
  benchmarkTargetScore?: number;
  benchmarkChecks?: string[];
  expectedTimeComplexity?: string | null;
  expectedSpaceComplexity?: string | null;
}

export interface AssessmentQuestionResult {
  questionId: string;
  topic: string;
  score: number;
  correct: boolean;
  feedback: string;
  strengths?: string[];
  weaknesses?: string[];
  timeComplexity?: string | null;
  spaceComplexity?: string | null;
  industryComparison?: string | null;
  benchmarkScore?: number;
  recommendation?: string | null;
}

export interface AssessmentRecommendation {
  topic: string;
  reason: string;
  action: string;
  resourceLabel?: string | null;
  resourceUrl?: string | null;
  problemLabel?: string | null;
  problemUrl?: string | null;
}

export interface AssessmentSubmission {
  answers?: Record<string, string>;
  questionResults?: AssessmentQuestionResult[];
  submittedAt?: string | null;
  timedOut?: boolean;
}

export interface AssessmentReport {
  summary?: string;
  benchmarkScore?: number;
  benchmarkStatus?: string;
  benchmarkComparison?: string;
  phaseAverageScore?: number;
  phaseDeltaScore?: number;
  attemptsInPhase?: number;
  strongSpots?: string[];
  weakSpots?: string[];
  strongSignals?: string[];
  gapSignals?: string[];
  fixPlan?: string[];
  motivation?: string;
  consistencyLine?: string;
}

export interface AssessmentPlanSummary {
  id: string;
  title?: string | null;
  targetRole?: string | null;
  targetTopics: string[];
  knownTopics: string[];
  timePerDay: number;
  durationMonths: number;
  version: number;
  isActive: boolean;
}

export interface AssessmentSession {
  id: string;
  userId: string;
  planId?: string | null;
  status: "draft" | "started" | "completed" | "skipped";
  assessmentType: AssessmentType;
  assessmentScope?: AssessmentScope;
  assessmentPhase?: AssessmentPhase;
  durationMinutes: number;
  weakSpots: string[];
  recommendations: AssessmentRecommendation[];
  questions: AssessmentQuestion[];
  submission: AssessmentSubmission;
  score: number;
  expiresAt?: string | null;
  report?: AssessmentReport | null;
  metadata: Record<string, unknown>;
  startedAt?: string | null;
  submittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentOverview {
  activePlan: AssessmentPlanSummary | null;
  currentSession: AssessmentSession | null;
  recentSessions: AssessmentSession[];
}

export interface AssessmentGenerationResult {
  activePlan: AssessmentPlanSummary;
  session: AssessmentSession;
}

export interface AssessmentPlanUpdateResult {
  session: AssessmentSession;
  updatedPlan: PrepPlan;
}

export interface ResumeJobMatchResult {
  targetRole?: string | null;
  atsScore: number;
  jobMatchScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  benchmarkHighlights: string[];
  tailoredSuggestions: string[];
  summary: string;
}

export interface MentorMessage {
  id: string;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface MentorReply {
  reply: string;
  usedFallback: boolean;
  message: MentorMessage;
  history: MentorMessage[];
}

export interface AuthResult {
  token: string;
  user: User;
}

interface RegisterPayload {
  name: string;
  username?: string;
  email: string;
  password: string;
  inviteCode?: string;
  weakAreas?: string[];
  targetRole?: string;
  placementDate?: string;
}

const DEFAULT_API_BASE_URL = "/api";
const KNOWN_ENDPOINT_SUFFIXES = [
  "/api/health",
  "/health",
  "/healthz",
  "/auth/login",
  "/auth/register",
  "/auth/me",
] as const;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function looksLikeBareHostnameApiUrl(value: string) {
  return /^(localhost(?::\d+)?|127(?:\.\d{1,3}){3}(?::\d+)?|[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?)(?:\/.*)?$/i.test(value);
}

function withImpliedProtocol(value: string) {
  const trimmedValue = value.trim();
  if (!looksLikeBareHostnameApiUrl(trimmedValue)) {
    return trimmedValue;
  }

  const usesHttp = /^(localhost(?::\d+)?|127(?:\.\d{1,3}){3}(?::\d+)?)(?:\/.*)?$/i.test(trimmedValue);
  return `${usesHttp ? "http" : "https"}://${trimmedValue}`;
}

function stripKnownEndpointSuffix(pathname: string) {
  const normalizedPath = trimTrailingSlash(pathname || "") || "/";

  for (const suffix of KNOWN_ENDPOINT_SUFFIXES) {
    if (normalizedPath === suffix) {
      return "/";
    }

    if (normalizedPath.endsWith(suffix)) {
      return normalizedPath.slice(0, -suffix.length) || "/";
    }
  }

  return normalizedPath;
}

function normalizeRelativeApiBaseUrl(value: string) {
  let normalizedPath = trimTrailingSlash(value.trim());
  if (!normalizedPath) {
    return DEFAULT_API_BASE_URL;
  }

  if (!normalizedPath.startsWith("/")) {
    normalizedPath = `/${normalizedPath}`;
  }

  normalizedPath = stripKnownEndpointSuffix(normalizedPath);

  if (normalizedPath === "/") {
    return DEFAULT_API_BASE_URL;
  }

  if (normalizedPath === "/functions/v1") {
    return "/functions/v1/api";
  }

  return normalizedPath;
}

function normalizeAbsoluteApiBaseUrl(value: string) {
  const parsed = new URL(value);
  let normalizedPath = stripKnownEndpointSuffix(parsed.pathname);

  if (normalizedPath === "/") {
    normalizedPath = "/api";
  } else if (normalizedPath === "/functions/v1") {
    normalizedPath = "/functions/v1/api";
  }

  parsed.pathname = normalizedPath;
  return trimTrailingSlash(parsed.toString());
}

function normalizeConfiguredApiBaseUrl(rawValue?: string) {
  const configuredValue = withImpliedProtocol(String(rawValue || "").trim());
  if (!configuredValue) {
    return DEFAULT_API_BASE_URL;
  }

  if (/^https?:\/\//i.test(configuredValue)) {
    try {
      return normalizeAbsoluteApiBaseUrl(configuredValue);
    } catch (error) {
      console.warn("[API] Failed to parse the configured absolute API URL. Falling back to the raw value.", error);
      return trimTrailingSlash(configuredValue);
    }
  }

  return normalizeRelativeApiBaseUrl(configuredValue);
}

function resolveApiBaseUrl() {
  return normalizeConfiguredApiBaseUrl(import.meta.env.VITE_API_URL);
}

const API_BASE_URL = resolveApiBaseUrl();
const TOKEN_STORAGE_KEY = "placeprep.token";
const USER_STORAGE_KEY = "placeprep.user";

function shouldAttachNgrokBypassHeader() {
  return /ngrok-free\.(app|dev)/i.test(API_BASE_URL);
}

type RequestOptions = RequestInit & {
  skipAuth?: boolean;
};

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

function buildHeaders(options: RequestOptions, token: string | null) {
  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!options.skipAuth && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (shouldAttachNgrokBypassHeader()) {
    headers.set("ngrok-skip-browser-warning", "1");
  }

  return headers;
}

async function request<T>(path: string, options: RequestOptions = {}) {
  try {
    if (typeof window !== "undefined" && isDemoModeEnabled()) {
      return await handleDemoRequest<T>(path, options);
    }

    const token = getStoredToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: buildHeaders(options, token),
    });

    const contentType = response.headers.get("content-type") || "";
    let payload: Envelope<T> | { message?: string } | null = null;

    if (contentType.includes("application/json")) {
      try {
        payload = (await response.json()) as Envelope<T> | { message?: string };
      } catch (error) {
        console.error(`[API] Failed to parse JSON for ${options.method || "GET"} ${path}.`, error);
      }
    }

    if (!response.ok) {
      const errorMessage =
        (payload && "message" in payload && payload.message) ||
        `Request failed with status ${response.status}`;
      const error = new Error(errorMessage);
      console.error(`[API] ${options.method || "GET"} ${path} failed with ${response.status}.`, {
        status: response.status,
        payload,
      });
      throw error;
    }

    if (!payload || !("data" in payload)) {
      const error = new Error("Unexpected response from server.");
      console.error(`[API] ${options.method || "GET"} ${path} returned an unexpected payload.`, payload);
      throw error;
    }

    return payload.data;
  } catch (error) {
    console.error(`[API] ${options.method || "GET"} ${path} threw an exception.`, error);
    throw error instanceof Error ? error : new Error("Network request failed.");
  }
}

export function getStoredToken() {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function getStoredUser() {
  const storedValue = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!storedValue) {
    return null;
  }

  try {
    return JSON.parse(storedValue) as User;
  } catch {
    return null;
  }
}

export function persistSession(session: AuthResult) {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, session.token);
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session.user));
}

export function clearStoredSession() {
  clearDemoMode();
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
}

export async function login(payload: { identifier: string; password: string }) {
  return request<AuthResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
    skipAuth: true,
  });
}

export async function register(payload: RegisterPayload) {
  return request<AuthResult>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
    skipAuth: true,
  });
}

export async function fetchInvitePreview(code: string) {
  const encodedCode = encodeURIComponent(code);
  return request<InvitePreview>(`/invites/preview?code=${encodedCode}`, {
    skipAuth: true,
  });
}

export async function fetchInvites(limit = 25) {
  return request<InviteRecord[]>(`/invites?limit=${limit}`);
}

export async function clearInviteHistory() {
  return request<HistoryClearResult>("/invites/history", {
    method: "DELETE",
  });
}

export async function createInvite(payload: {
  role: "admin" | "user";
  expiresInDays?: number;
  label?: string;
}) {
  return request<InviteRecord>("/invites", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createInviteBatch(payload: {
  role: "admin" | "user";
  expiresInDays?: number;
  label?: string;
  quantity?: number;
}) {
  return request<InviteRecord[]>("/invites/bulk", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchProfile() {
  return request<User>("/auth/me");
}

export async function updateAccount(payload: {
  name?: string;
  username?: string;
  weakAreas?: string[];
  targetRole?: string;
  placementDate?: string | null;
  timezone?: string;
  preferredLanguage?: "english" | "tamil" | "hindi";
}) {
  return request<User>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchUserProfile() {
  return request<UserProfile>("/profile");
}

export async function saveUserProfile(payload: {
  linkedinUrl?: string;
  githubUrl?: string;
  leetcodeUrl?: string;
  portfolioUrl?: string;
  resumeUrl?: string;
  avatarUrl?: string;
  notificationsEnabled?: boolean;
  notificationEmailEnabled?: boolean;
  notificationBrowserEnabled?: boolean;
  notificationBrowserPermission?: "default" | "granted" | "denied";
}) {
  return request<UserProfile>("/profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchWebPushConfig() {
  return request<WebPushConfig>("/profile/web-push/config");
}

export async function savePushSubscription(payload: {
  subscription: {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
}) {
  return request("/profile/push-subscriptions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deletePushSubscription(endpoint: string) {
  return request("/profile/push-subscriptions", {
    method: "DELETE",
    body: JSON.stringify({ endpoint }),
  });
}

function normalizeAssetUrl(url: string | null | undefined) {
  if (!url) {
    return "";
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return new URL(url, window.location.origin).toString();
}

function normalizeResumeRecord(record: ResumeAnalysisRecord): ResumeAnalysisRecord {
  return {
    ...record,
    secureUrl: record.secureUrl ? normalizeAssetUrl(record.secureUrl) : null,
  };
}

function toArray<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return trimmed.includes(",")
        ? (trimmed.split(",").map((entry) => entry.trim()).filter(Boolean) as T[])
        : ([trimmed] as T[]);
    }
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, T>);
  }

  return [];
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeStringList(value: unknown, limit = 8) {
  return Array.from(
    new Set(
      toArray<string>(value)
        .map((entry) => String(entry || "").trim())
        .filter(Boolean),
    ),
  ).slice(0, limit);
}

function normalizePrepPlan(plan: PrepPlan | null): PrepPlan | null {
  if (!plan) {
    return null;
  }

  const metadata = normalizeRecord(plan.metadata);
  const targetTopics = normalizeStringList(plan.targetTopics, 8);
  const knownTopics = normalizeStringList(plan.knownTopics, 8);

  return {
    ...plan,
    preferredLanguage: String(
      (plan as PrepPlan & { preferredLanguage?: string | null }).preferredLanguage
      || metadata.preferredLanguage
      || "english",
    ).trim().toLowerCase() as PrepLanguage,
    knownTopics,
    targetTopics,
    roadmap: toArray<Record<string, unknown>>(plan.roadmap).map((week, index) => ({
      week: Number(week?.week || index + 1),
      title: String(week?.title || `Week ${index + 1}`).trim(),
      focusTopics: normalizeStringList(week?.focusTopics || week?.topics, 4),
      estimatedHours: Number(week?.estimatedHours || 0),
      goals: normalizeStringList(week?.goals, 4),
    })),
    tasks: toArray<Record<string, unknown>>(plan.tasks).map((day, index) => ({
      day: String(day?.day || `Day ${index + 1}`).trim(),
      theme: String(day?.theme || "Focused prep").trim(),
      totalEstimatedMinutes: Number(day?.totalEstimatedMinutes || 0),
      items: toArray<Record<string, unknown>>(day?.items).map((item) => ({
        title: String(item?.title || "").trim(),
        type: String(item?.type || "DSA").trim(),
        estimatedMinutes: Number(item?.estimatedMinutes || 0),
        difficulty: String(item?.difficulty || "Medium").trim(),
        referenceLabel: item?.referenceLabel ? String(item.referenceLabel).trim() : null,
        referenceUrl: item?.referenceUrl ? String(item.referenceUrl).trim() : null,
        summary: item?.summary ? String(item.summary).trim() : null,
      })).filter((item) => item.title),
    })),
    resources: toArray<Record<string, unknown>>(plan.resources).map((group) => ({
      topic: String(group?.topic || "").trim(),
      items: toArray<Record<string, unknown>>(group?.items).map((item) => ({
        title: String(item?.title || "").trim(),
        type: String(item?.type || "article").trim(),
        url: String(item?.url || "").trim(),
      })).filter((item) => item.title && item.url),
    })).filter((group) => group.topic),
    flashcards: toArray<Record<string, unknown>>(plan.flashcards).map((card) => ({
      topic: String(card?.topic || "").trim(),
      question: String(card?.question || "").trim(),
      answer: String(card?.answer || "").trim(),
    })).filter((card) => card.topic && card.question && card.answer),
    durationMonths: Number(plan.durationMonths || metadata.durationMonths || 1),
    title: typeof plan.title === "string"
      ? plan.title
      : typeof metadata.title === "string"
        ? metadata.title
        : undefined,
    autoTitle: typeof plan.autoTitle === "string"
      ? plan.autoTitle
      : typeof metadata.autoTitle === "string"
        ? metadata.autoTitle
        : undefined,
    titleSource: plan.titleSource === "custom" ? "custom" : "generated",
    coachLine: typeof plan.coachLine === "string"
      ? plan.coachLine
      : typeof metadata.coachLine === "string"
        ? metadata.coachLine
        : undefined,
    metadata,
  };
}

function normalizeAssessmentQuestion(question: AssessmentQuestion): AssessmentQuestion {
  return {
    ...question,
    id: String(question?.id || "").trim(),
    topic: String(question?.topic || "").trim(),
    prompt: String(question?.prompt || "").trim(),
    type: (String(question?.type || "mcq").trim() as AssessmentType),
    averageTimeMinutes: Number(question?.averageTimeMinutes || 0),
    referenceLabel: question?.referenceLabel ? String(question.referenceLabel).trim() : null,
    referenceUrl: question?.referenceUrl ? String(question.referenceUrl).trim() : null,
    choices: toArray<AssessmentQuestionChoice>(question?.choices).map((choice, index) => ({
      id: String(choice?.id || `${question?.id || "choice"}-${index + 1}`).trim(),
      label: String(choice?.label || String.fromCharCode(65 + index)).trim(),
      text: String(choice?.text || "").trim(),
    })).filter((choice) => choice.text),
    placeholder: question?.placeholder ? String(question.placeholder).trim() : null,
    taskTitle: question?.taskTitle ? String(question.taskTitle).trim() : null,
    contextTitle: question?.contextTitle ? String(question.contextTitle).trim() : null,
    contextSummary: question?.contextSummary ? String(question.contextSummary).trim() : null,
    benchmarkLabel: question?.benchmarkLabel ? String(question.benchmarkLabel).trim() : null,
    benchmarkTargetScore: Number(question?.benchmarkTargetScore || 0),
    benchmarkChecks: normalizeStringList(question?.benchmarkChecks, 6),
    expectedTimeComplexity: question?.expectedTimeComplexity ? String(question.expectedTimeComplexity).trim() : null,
    expectedSpaceComplexity: question?.expectedSpaceComplexity ? String(question.expectedSpaceComplexity).trim() : null,
  };
}

function normalizeAssessmentReport(report: AssessmentReport | null | undefined): AssessmentReport | null {
  if (!report) {
    return null;
  }

  return {
    summary: report.summary ? String(report.summary).trim() : "",
    benchmarkScore: Number(report.benchmarkScore || 0),
    benchmarkStatus: report.benchmarkStatus ? String(report.benchmarkStatus).trim() : "",
    benchmarkComparison: report.benchmarkComparison ? String(report.benchmarkComparison).trim() : "",
    phaseAverageScore: Number(report.phaseAverageScore || 0),
    phaseDeltaScore: Number(report.phaseDeltaScore || 0),
    attemptsInPhase: Number(report.attemptsInPhase || 0),
    strongSpots: normalizeStringList(report.strongSpots, 6),
    weakSpots: normalizeStringList(report.weakSpots, 6),
    strongSignals: normalizeStringList(report.strongSignals, 6),
    gapSignals: normalizeStringList(report.gapSignals, 6),
    fixPlan: normalizeStringList(report.fixPlan, 6),
    motivation: report.motivation ? String(report.motivation).trim() : "",
    consistencyLine: report.consistencyLine ? String(report.consistencyLine).trim() : "",
  };
}

function normalizeAssessmentRecommendation(recommendation: AssessmentRecommendation): AssessmentRecommendation {
  return {
    ...recommendation,
    topic: String(recommendation?.topic || "").trim(),
    reason: String(recommendation?.reason || "").trim(),
    action: String(recommendation?.action || "").trim(),
    resourceLabel: recommendation?.resourceLabel ? String(recommendation.resourceLabel).trim() : null,
    resourceUrl: recommendation?.resourceUrl ? String(recommendation.resourceUrl).trim() : null,
    problemLabel: recommendation?.problemLabel ? String(recommendation.problemLabel).trim() : null,
    problemUrl: recommendation?.problemUrl ? String(recommendation.problemUrl).trim() : null,
  };
}

function normalizeAssessmentPlanSummary(plan: AssessmentPlanSummary | null): AssessmentPlanSummary | null {
  if (!plan) {
    return null;
  }

  return {
    ...plan,
    title: plan.title ? String(plan.title).trim() : null,
    targetRole: plan.targetRole ? String(plan.targetRole).trim() : null,
    targetTopics: normalizeStringList(plan.targetTopics, 8),
    knownTopics: normalizeStringList(plan.knownTopics, 8),
    timePerDay: Number(plan.timePerDay || 120),
    durationMonths: Number(plan.durationMonths || 1),
    version: Number(plan.version || 1),
    isActive: Boolean(plan.isActive),
  };
}

function normalizeAssessmentSession(session: AssessmentSession | null): AssessmentSession | null {
  if (!session) {
    return null;
  }

  const submission = normalizeRecord(session.submission);
  const answers = normalizeRecord(submission.answers);

  return {
    ...session,
    assessmentScope: String(session.assessmentScope || session.metadata?.scope || "daily").trim().toLowerCase() as AssessmentScope,
    assessmentPhase: String(
      session.assessmentPhase
      || session.metadata?.assessmentPhase
      || session.metadata?.phase
      || "pre",
    ).trim().toLowerCase() as AssessmentPhase,
    weakSpots: normalizeStringList(session.weakSpots, 8),
    recommendations: toArray<AssessmentRecommendation>(session.recommendations)
      .map(normalizeAssessmentRecommendation)
      .filter((recommendation) => recommendation.topic && recommendation.action),
    questions: toArray<AssessmentQuestion>(session.questions)
      .map(normalizeAssessmentQuestion)
      .filter((question) => question.id && question.prompt),
    submission: {
      answers: Object.fromEntries(
        Object.entries(answers).map(([key, value]) => [key, String(value || "")]),
      ),
      questionResults: toArray<AssessmentQuestionResult>(submission.questionResults).map((result) => ({
        questionId: String(result?.questionId || "").trim(),
        topic: String(result?.topic || "").trim(),
        score: Number(result?.score || 0),
        correct: Boolean(result?.correct),
        feedback: String(result?.feedback || "").trim(),
        strengths: normalizeStringList(result?.strengths, 4),
        weaknesses: normalizeStringList(result?.weaknesses, 4),
        timeComplexity: result?.timeComplexity ? String(result.timeComplexity).trim() : null,
        spaceComplexity: result?.spaceComplexity ? String(result.spaceComplexity).trim() : null,
        industryComparison: result?.industryComparison ? String(result.industryComparison).trim() : null,
        benchmarkScore: Number(result?.benchmarkScore || 0),
        recommendation: result?.recommendation ? String(result.recommendation).trim() : null,
      })).filter((result) => result.questionId),
      submittedAt: submission.submittedAt ? String(submission.submittedAt) : (session.submittedAt || null),
      timedOut: submission.timedOut === true,
    },
    score: Number(session.score || 0),
    expiresAt: session.expiresAt ? String(session.expiresAt) : (session.metadata?.expiresAt ? String(session.metadata.expiresAt) : null),
    report: normalizeAssessmentReport((session.report as AssessmentReport | null | undefined) || (session.metadata?.report as AssessmentReport | null | undefined)),
    metadata: normalizeRecord(session.metadata),
  };
}

function normalizeAssessmentOverview(overview: AssessmentOverview): AssessmentOverview {
  return {
    activePlan: normalizeAssessmentPlanSummary(overview?.activePlan || null),
    currentSession: normalizeAssessmentSession(overview?.currentSession || null),
    recentSessions: toArray<AssessmentSession>(overview?.recentSessions).map((session) =>
      normalizeAssessmentSession(session),
    ).filter((session): session is AssessmentSession => Boolean(session)),
  };
}

export async function uploadImage(
  file: File,
  payload: {
    taskId?: string;
    dailyLogId?: string;
    proofDate?: string;
    caption?: string;
  } = {},
) {
  const formData = new FormData();
  formData.append("image", file);

  if (payload.taskId) {
    formData.append("taskId", payload.taskId);
  }
  if (payload.dailyLogId) {
    formData.append("dailyLogId", payload.dailyLogId);
  }
  if (payload.proofDate) {
    formData.append("proofDate", payload.proofDate);
  }
  if (payload.caption) {
    formData.append("caption", payload.caption);
  }

  const uploaded = await request<UploadedImage>("/uploads/images", {
    method: "POST",
    body: formData,
  });

  return {
    ...uploaded,
    secureUrl: normalizeAssetUrl(uploaded.secureUrl),
  };
}

export async function fetchUploadedImages(filters: {
  date?: string;
  limit?: number;
} = {}) {
  const params = new URLSearchParams();
  if (filters.date) {
    params.set("date", filters.date);
  }
  if (filters.limit !== undefined) {
    params.set("limit", String(filters.limit));
  }

  const queryString = params.toString();
  const images = await request<UploadedImage[]>(`/uploads/images${queryString ? `?${queryString}` : ""}`);

  return images.map((image) => ({
    ...image,
    secureUrl: normalizeAssetUrl(image.secureUrl),
  }));
}

export async function uploadResumeForAnalysis(
  payload: {
    file?: File | null;
    resumeText?: string;
    targetRole?: string;
    jobDescription?: string;
  } = {},
) {
  const formData = new FormData();

  if (payload.file) {
    formData.append("resume", payload.file);
  }
  if (payload.resumeText) {
    formData.append("resumeText", payload.resumeText);
  }
  if (payload.targetRole) {
    formData.append("targetRole", payload.targetRole);
  }
  if (payload.jobDescription) {
    formData.append("jobDescription", payload.jobDescription);
  }

  const uploaded = await request<ResumeAnalysisRecord>("/resume", {
    method: "POST",
    body: formData,
  });

  return normalizeResumeRecord(uploaded);
}

export async function fetchLatestResumeAnalysis() {
  try {
    const resume = await request<ResumeAnalysisRecord>("/resume/latest");
    return normalizeResumeRecord(resume);
  } catch (error) {
    if (error instanceof Error && /resume not found/i.test(error.message)) {
      return null;
    }

    throw error;
  }
}

export async function fetchResumeAnalysisHistory() {
  const resumes = await request<ResumeAnalysisRecord[]>("/resume");
  return resumes.map(normalizeResumeRecord);
}

export async function clearResumeAnalysisHistory() {
  return request<HistoryClearResult>("/resume/history", {
    method: "DELETE",
  });
}

export async function fetchLatestApk() {
  return request<ApkVersion | null>("/apk/latest");
}

export async function fetchApkVersions(limit = 10) {
  return request<ApkVersion[]>(`/apk/versions?limit=${limit}`);
}

export async function uploadApk(file: File, payload: { version?: string } = {}) {
  const formData = new FormData();
  formData.append("apk", file);
  if (payload.version) {
    formData.append("version", payload.version);
  }

  return request<ApkVersion>("/apk", {
    method: "POST",
    body: formData,
  });
}

export async function downloadApkVersion(versionId: string) {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE_URL}/apk/${versionId}/download`, {
    headers: {
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
      ...(shouldAttachNgrokBypassHeader()
        ? {
            "ngrok-skip-browser-warning": "1",
          }
        : {}),
    },
  });

  if (!response.ok) {
    const error = new Error(`APK download failed with status ${response.status}`);
    console.error("[API] APK download failed.", { versionId, status: response.status });
    throw error;
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("content-disposition") || "";
  const fileNameMatch = /filename="?([^"]+)"?/i.exec(contentDisposition);

  return {
    blob,
    fileName: fileNameMatch?.[1] || "placeprep-android.apk",
  };
}

export async function fetchProgressSummary() {
  return request<ProgressSummary>("/progress/summary");
}

export async function fetchCoachStudents() {
  const students = await request<StudentOversightRecord[]>("/coach/students");
  return students.map((entry) => ({
    ...entry,
    recentProofs: (entry.recentProofs || []).map((image) => ({
      ...image,
      secureUrl: normalizeAssetUrl(image.secureUrl),
    })),
  }));
}

export async function fetchCoachGroups() {
  return request<CoachGroup[]>("/coach/groups");
}

export async function fetchCoachGroupCandidates() {
  return request<CoachGroupCandidate[]>("/coach/group-candidates");
}

export async function createCoachGroup(payload: {
  name: string;
  description?: string;
  studentUserIds?: string[];
}) {
  return request<CoachGroup>("/coach/groups", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function addCoachGroupMembers(groupId: string, studentUserIds: string[]) {
  return request<CoachGroup>(`/coach/groups/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({ studentUserIds }),
  });
}

export async function removeCoachGroupMember(groupId: string, studentUserId: string) {
  return request<CoachGroup>(`/coach/groups/${groupId}/members/${studentUserId}`, {
    method: "DELETE",
  });
}

export async function clearCoachStudentProofHistory(studentUserId: string) {
  return request<HistoryClearResult>(`/coach/students/${studentUserId}/proofs`, {
    method: "DELETE",
  });
}

export async function clearCoachProgressHistory(payload: {
  scope?: "selected" | "student" | "group";
  studentUserId?: string;
  groupId?: string;
  entryIds?: string[];
}) {
  return request<ScopedHistoryClearResult>("/coach/progress/history", {
    method: "DELETE",
    body: JSON.stringify(payload),
  });
}

export async function clearCoachPracticeCapsuleHistory(payload: {
  studentUserId?: string;
  groupId?: string;
  assignmentIds: string[];
}) {
  return request<ScopedHistoryClearResult>("/coach/practice-capsules/history", {
    method: "DELETE",
    body: JSON.stringify(payload),
  });
}

export async function createPracticeCapsule(payload: {
  studentUserId?: string;
  groupId?: string;
  title?: string;
  note?: string;
  scheduledFor?: string;
  deadlineAt?: string;
  items?: Array<{
    title: string;
    description?: string;
    category?: string;
    subcategory?: string;
    referenceLabel?: string;
    referenceUrl?: string;
    estimatedMinutes?: number;
    difficulty?: number;
    weakArea?: string;
    type?: string;
  }>;
  leetcodeOneUrl?: string;
  leetcodeTwoUrl?: string;
  verbalUrl?: string;
  aptitudeUrl?: string;
  leetcodeOneLabel?: string;
  leetcodeTwoLabel?: string;
  verbalLabel?: string;
  aptitudeLabel?: string;
}) {
  return request<PracticeCapsuleDispatchResult>("/coach/practice-capsules", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchNotifications(filters: {
  unread?: boolean;
  limit?: number;
} = {}) {
  const params = new URLSearchParams();
  if (filters.unread !== undefined) {
    params.set("unread", String(filters.unread));
  }
  if (filters.limit !== undefined) {
    params.set("limit", String(filters.limit));
  }

  const queryString = params.toString();
  return request<PrepNotification[]>(`/notifications${queryString ? `?${queryString}` : ""}`);
}

export async function syncNotifications(payload: { deliverEmail?: boolean } = {}) {
  return request<NotificationSyncResult>("/notifications/sync", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function testPushNotification() {
  return request<PushNotificationTestResult>("/notifications/test-push", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function markNotificationRead(notificationId: string) {
  return request<PrepNotification>(`/notifications/${notificationId}/read`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function markAllNotificationsRead() {
  return request<{ updated: number }>("/notifications/read-all", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function clearNotificationHistory() {
  return request<HistoryClearResult>("/notifications/history", {
    method: "DELETE",
  });
}

export async function fetchProgressHistory(days = 14) {
  return request<ProgressHistoryItem[]>(`/progress/history?days=${days}`);
}

export async function clearProgressHistory(entryIds?: string[]) {
  return request<HistoryClearResult>("/progress/history", {
    method: "DELETE",
    body: JSON.stringify(entryIds?.length ? { entryIds } : {}),
  });
}

export async function fetchTodayTasks() {
  return request<Task[]>("/tasks/today");
}

export async function fetchTasks(filters: {
  date?: string;
  status?: string;
  category?: string;
} = {}) {
  const params = new URLSearchParams();
  if (filters.date) {
    params.set("date", filters.date);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.category) {
    params.set("category", filters.category);
  }

  const queryString = params.toString();
  return request<Task[]>(`/tasks${queryString ? `?${queryString}` : ""}`);
}

export async function createTask(payload: Partial<Task> & { title: string }) {
  return request<Task>("/tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTask(taskId: string, updates: Partial<Task>) {
  return request<Task>(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteTask(taskId: string) {
  return request<Task>(`/tasks/${taskId}`, {
    method: "DELETE",
  });
}

export async function generateAiTasks(payload: {
  availableMinutes?: number;
  weakTopics?: string[];
  strongTopics?: string[];
  persist?: boolean;
  replaceExisting?: boolean;
}) {
  return request<AiTaskPlan>("/ai/generate-tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function requestAiHelp(payload: {
  problemName?: string;
  problem?: string;
  topic?: string;
  attempt?: string;
  notes?: string;
}) {
  return request<AiHelpResult>("/ai/help", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function evaluateAiDay(payload: {
  tasks?: Array<Pick<Task, "title" | "status" | "weakArea" | "subcategory" | "category">>;
  totalTasks?: number;
  tasksCompleted?: number;
  timeSpentMinutes?: number;
  struggles?: string;
  notes?: string;
  persistLog?: boolean;
}) {
  return request<AiEvaluationResult>("/ai/evaluate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function generatePowerPocketTask(payload: { availableMinutes?: number } = {}) {
  return request<AiQuickTaskResult>("/ai/quick-task", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchAiStatus() {
  return request<AiStatus>("/ai/status");
}

export async function fetchLatestPrepPlan() {
  return normalizePrepPlan(await request<PrepPlan | null>("/ai/prep-architect/latest"));
}

export async function fetchPrepPlanHistory(limit = 10) {
  const plans = await request<PrepPlan[]>(`/ai/prep-architect/history?limit=${limit}`);
  return plans.map((plan) => normalizePrepPlan(plan)).filter((plan): plan is PrepPlan => Boolean(plan));
}

export async function clearPrepPlanHistory(planIds?: string[]) {
  return request<HistoryClearResult>("/ai/prep-architect/history", {
    method: "DELETE",
    body: JSON.stringify(planIds?.length ? { planIds } : {}),
  });
}

export async function activatePrepPlan(planId: string) {
  return normalizePrepPlan(await request<PrepPlan>("/ai/prep-architect/activate", {
    method: "POST",
    body: JSON.stringify({ planId }),
  })) as PrepPlan;
}

export async function renamePrepPlan(payload: {
  planId: string;
  title: string;
}) {
  return normalizePrepPlan(await request<PrepPlan>("/ai/prep-architect/rename", {
    method: "POST",
    body: JSON.stringify(payload),
  })) as PrepPlan;
}

export async function generatePrepPlan(payload: {
  knownTopics: string[];
  targetTopics: string[];
  timePerDay?: number;
  durationMonths?: number;
  targetRole?: string;
  preferredLanguage?: PrepLanguage;
}) {
  return normalizePrepPlan(await request<PrepPlan>("/ai/prep-architect", {
    method: "POST",
    body: JSON.stringify(payload),
  })) as PrepPlan;
}

export async function updatePrepPlan(payload: {
  planId: string;
  knownTopics: string[];
  targetTopics: string[];
  timePerDay?: number;
  durationMonths?: number;
  targetRole?: string;
  preferredLanguage?: PrepLanguage;
}) {
  return normalizePrepPlan(await request<PrepPlan>("/ai/prep-architect/update", {
    method: "POST",
    body: JSON.stringify(payload),
  })) as PrepPlan;
}

export async function fetchMentorHistory() {
  return request<MentorMessage[]>("/ai/chat");
}

export async function sendMentorMessage(payload: { message: string }) {
  return request<MentorReply>("/ai/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function clearMentorHistory() {
  return request<HistoryClearResult>("/ai/chat/history", {
    method: "DELETE",
  });
}

export async function fetchActivePowerPocket() {
  return request<PowerPocketSession | null>("/power-pocket/active");
}

export async function startPowerPocket(payload: {
  taskId?: string;
  title?: string;
  notes?: string;
  source?: "manual" | "suggested" | "ai";
}) {
  return request<PowerPocketSession>("/power-pocket/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function endPowerPocket(
  sessionId: string,
  payload: {
    notes?: string;
    status?: "completed" | "abandoned";
  } = {}
) {
  return request<PowerPocketSession>(`/power-pocket/${sessionId}/end`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function clearUploadedProofHistory() {
  return request<HistoryClearResult>("/uploads/images/history", {
    method: "DELETE",
  });
}

export async function fetchAssessmentOverview() {
  return normalizeAssessmentOverview(await request<AssessmentOverview>("/assessments/overview"));
}

export async function generateAssessment(payload: {
  assessmentType: AssessmentType;
  durationMinutes?: number;
  assessmentScope?: AssessmentScope;
  assessmentPhase?: AssessmentPhase;
}) {
  const result = await request<AssessmentGenerationResult>("/assessments/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return {
    activePlan: normalizeAssessmentPlanSummary(result.activePlan) as AssessmentPlanSummary,
    session: normalizeAssessmentSession(result.session) as AssessmentSession,
  };
}

export async function submitAssessment(
  assessmentId: string,
  payload: { answers: Record<string, string>; timedOut?: boolean },
) {
  return normalizeAssessmentSession(await request<AssessmentSession>(`/assessments/${assessmentId}/submit`, {
    method: "POST",
    body: JSON.stringify(payload),
  })) as AssessmentSession;
}

export async function applyAssessmentPlanUpdate(assessmentId: string) {
  const result = await request<AssessmentPlanUpdateResult>(`/assessments/${assessmentId}/apply-plan-update`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  return {
    session: normalizeAssessmentSession(result.session) as AssessmentSession,
    updatedPlan: normalizePrepPlan(result.updatedPlan) as PrepPlan,
  };
}

export async function scoreResumeAgainstJobDescription(payload: {
  jobDescription: string;
  targetRole?: string;
  resumeText?: string;
}) {
  return request<ResumeJobMatchResult>("/resume/match", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
