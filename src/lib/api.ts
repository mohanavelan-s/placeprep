export interface User {
  id: string;
  name: string;
  username?: string | null;
  role: "admin" | "user";
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

export interface InvitePreview {
  code: string;
  valid: boolean;
  status: "valid" | "used" | "expired" | "missing";
  role?: "admin" | "user";
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
  createdAt?: string;
  updatedAt?: string;
}

export type NotificationType =
  | "daily_inactivity"
  | "pending_tasks"
  | "missed_streak"
  | "countdown_urgency"
  | "motivation";

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

export interface PrepPlanTaskItem {
  title: string;
  type: string;
  estimatedMinutes: number;
  difficulty: string;
  referenceLabel?: string | null;
  referenceUrl?: string | null;
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
  targetRole?: string | null;
  version: number;
  isActive: boolean;
  sourcePlanId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  coachLine?: string;
  usedFallback?: boolean;
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
const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || DEFAULT_API_BASE_URL;
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

function normalizeAssetUrl(url: string | null | undefined) {
  if (!url) {
    return "";
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return new URL(url, window.location.origin).toString();
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

export async function syncNotifications() {
  return request<NotificationSyncResult>("/notifications/sync", {
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

export async function fetchProgressHistory(days = 14) {
  return request<ProgressHistoryItem[]>(`/progress/history?days=${days}`);
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
  return request<PrepPlan | null>("/ai/prep-architect/latest");
}

export async function fetchPrepPlanHistory(limit = 10) {
  return request<PrepPlan[]>(`/ai/prep-architect/history?limit=${limit}`);
}

export async function generatePrepPlan(payload: {
  knownTopics: string[];
  targetTopics: string[];
  timePerDay?: number;
  targetRole?: string;
}) {
  return request<PrepPlan>("/ai/prep-architect", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePrepPlan(payload: {
  planId: string;
  knownTopics: string[];
  targetTopics: string[];
  timePerDay?: number;
  targetRole?: string;
}) {
  return request<PrepPlan>("/ai/prep-architect/update", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
