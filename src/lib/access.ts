import type { User } from "@/lib/api";

export const OBSERVER_ALLOWED_PATHS = [
  "/dashboard",
  "/tasks",
  "/ai-mentor",
] as const;

const observerAllowedPathSet = new Set<string>(OBSERVER_ALLOWED_PATHS);
const ANDROID_PUBLISHER_EMAILS = new Set([
  "mohanavelan2006@gmail.com",
  "mohanavelan200@gmail.com",
]);

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

export function getUserAccessTier(user?: Pick<User, "accessTier" | "role"> | null) {
  if (!user) {
    return "standard";
  }

  if (user.role !== "admin" && user.accessTier === "observer") {
    return "observer";
  }

  return "standard";
}

export function isObserverUser(user?: Pick<User, "accessTier" | "role"> | null) {
  return getUserAccessTier(user) === "observer";
}

export function canAccessAppPath(user: Pick<User, "accessTier" | "role"> | null | undefined, pathname: string) {
  if (!user) {
    return false;
  }

  if (!isObserverUser(user)) {
    return true;
  }

  return observerAllowedPathSet.has(pathname);
}

export function isAndroidPublisherUser(user?: Pick<User, "email" | "coachMetadata"> | null) {
  if (!user) {
    return false;
  }

  return ANDROID_PUBLISHER_EMAILS.has(normalizeEmail(user.email))
    || user.coachMetadata?.androidPublisher === true;
}
