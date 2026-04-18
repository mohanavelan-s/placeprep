import type { Task } from "@/lib/api";

function extractAutoVerification(task: Task) {
  const metadata = task?.metadata;
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const verification = (metadata as Record<string, unknown>).autoVerification;
  return verification && typeof verification === "object"
    ? (verification as Record<string, unknown>)
    : null;
}

function isAssignedTask(task: Task) {
  const metadata = task?.metadata;
  const source = metadata && typeof metadata === "object"
    ? String((metadata as Record<string, unknown>).source || "").toLowerCase()
    : "";

  return Boolean(task.aiGenerated) || [
    "prep-architect",
    "ai-coach",
    "admin-practice-link",
    "admin-assignment",
  ].includes(source);
}

function hasDirectProblemReference(task: Task) {
  const referenceUrl = String(task.referenceUrl || "").toLowerCase();
  return (
    referenceUrl.includes("leetcode.com/problems/")
    || referenceUrl.includes("hackerrank.com/challenges/")
    || referenceUrl.includes("codechef.com/problems/")
  );
}

export function getTaskVerificationMode(task: Task) {
  const referenceUrl = String(task.referenceUrl || "").toLowerCase();

  if (referenceUrl.includes("leetcode.com/problems/")) {
    return "leetcode_profile_or_proof" as const;
  }

  if (hasDirectProblemReference(task)) {
    return "proof_upload" as const;
  }

  if (isAssignedTask(task) && ["Core", "Project", "Resume", "MockInterview", "Aptitude"].includes(task.category)) {
    return "proof_upload" as const;
  }

  return "manual" as const;
}

export function allowsManualCompletion(task: Task) {
  const mode = getTaskVerificationMode(task);
  return mode === "manual" || task.status === "completed";
}

export function getTaskVerificationHint(task: Task) {
  const verification = extractAutoVerification(task);
  if (verification?.verified) {
    const provider = String(verification.label || verification.provider || "auto verification");
    return `Verified automatically via ${provider}.`;
  }

  const mode = getTaskVerificationMode(task);
  if (mode === "leetcode_profile_or_proof") {
    return "Auto-checks against the saved LeetCode profile. You can also upload proof for this task.";
  }

  if (mode === "proof_upload") {
    return "Upload linked proof and PlacePrep will verify it before marking this complete.";
  }

  return null;
}
