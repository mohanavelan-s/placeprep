package dev.placeprep.mobile.data

data class ApiEnvelope<T>(
    val success: Boolean,
    val data: T,
    val message: String? = null,
)

data class LoginRequest(
    val identifier: String,
    val password: String,
)

data class RegisterRequest(
    val name: String,
    val username: String,
    val email: String,
    val password: String,
    val inviteCode: String,
)

data class GoogleAuthRequest(
    val idToken: String,
)

data class QuickTaskRequest(
    val availableMinutes: Int = 30,
)

data class PowerPocketStartRequest(
    val title: String? = null,
    val notes: String? = null,
    val source: String = "ai",
)

data class PowerPocketEndRequest(
    val status: String = "completed",
)

data class MentorMessageRequest(
    val message: String,
)

data class AuthSession(
    val token: String,
    val user: MobileUser,
)

data class MobileUser(
    val id: String,
    val name: String,
    val username: String?,
    val role: String,
    val email: String,
    val targetRole: String?,
    val placementDate: String?,
)

data class ProgressSummary(
    val streak: Int,
    val consistencyScore: Double,
    val readinessScore: Double,
    val executionRate: Double,
    val totalHoursLogged: Double,
    val missionsCompleted: Int,
)

data class PrepRoadmapWeek(
    val week: Int,
    val title: String,
    val focusTopics: List<String>,
    val estimatedHours: Double,
)

data class PrepPlanTaskItem(
    val title: String,
    val type: String,
    val estimatedMinutes: Int,
    val difficulty: String,
)

data class PrepPlanDay(
    val day: String,
    val theme: String,
    val totalEstimatedMinutes: Int,
    val items: List<PrepPlanTaskItem>,
)

data class PrepPlan(
    val id: String,
    val knownTopics: List<String> = emptyList(),
    val targetTopics: List<String> = emptyList(),
    val roadmap: List<PrepRoadmapWeek> = emptyList(),
    val tasks: List<PrepPlanDay> = emptyList(),
    val timePerDay: Double? = null,
    val targetRole: String? = null,
)

data class TaskItem(
    val id: String,
    val title: String,
    val description: String? = null,
    val category: String = "dsa",
    val priority: String = "medium",
    val status: String = "pending",
    val estimatedMinutes: Int = 30,
    val actualMinutes: Int? = null,
    val difficulty: String? = "medium",
    val scheduledFor: String? = null,
    val dueDate: String? = null,
    val weakArea: Boolean = false,
)

data class CreateTaskRequest(
    val title: String,
    val description: String? = null,
    val category: String = "dsa",
    val priority: String = "medium",
    val estimatedMinutes: Int = 30,
    val difficulty: String = "medium",
)

data class QuickTaskSuggestion(
    val title: String,
    val category: String,
    val estimatedMinutes: Int,
    val difficulty: String,
    val reason: String,
)

data class AiQuickTaskResult(
    val task: QuickTaskSuggestion,
    val suggestionLine: String,
)

data class PowerPocketSession(
    val id: String,
    val title: String?,
    val notes: String?,
    val status: String,
    val source: String,
    val startedAt: String,
    val durationMinutes: Int,
)

data class MentorMessage(
    val id: String,
    val role: String,
    val content: String,
    val createdAt: String,
)

data class MentorReply(
    val reply: String,
    val usedFallback: Boolean,
    val history: List<MentorMessage>,
)

data class AiStuckHelpRequest(
    val topic: String,
    val problem: String? = null,
    val blockedReason: String? = null,
)

data class AiStuckHelpResponse(
    val hint: String? = null,
    val approachSteps: List<String> = emptyList(),
    val similarProblems: List<String> = emptyList(),
    val youtubeSearchKeywords: List<String> = emptyList(),
    val topic: String? = null,
    val usedFallback: Boolean = false,
)

data class AiDailyEvaluationRequest(
    val reflections: String? = null,
    val focusScore: Int = 8,
)

data class AiDailyEvaluationResponse(
    val score: Int = 80,
    val verdict: String = "Consistent Execution",
    val evaluation: String = "",
    val weakAreas: List<String> = emptyList(),
    val tomorrowImprovements: List<String> = emptyList(),
    val usedFallback: Boolean = false,
)

data class AssessmentOverview(
    val averageScore: Double = 0.0,
    val completedCount: Int = 0,
    val totalAssessments: Int = 0,
    val targetReadiness: Double = 85.0,
    val currentSession: AssessmentSessionData? = null,
    val recentSessions: List<AssessmentSessionData> = emptyList(),
    val recentAssessments: List<AssessmentSessionData> = emptyList(),
    val identifiedWeakSpots: List<String> = emptyList(),
    val activePlan: Map<String, Any?>? = null,
)

data class AssessmentSessionData(
    val id: String = "",
    val status: String = "draft",
    val assessmentType: String = "mcq",
    val durationMinutes: Int = 20,
    val score: Double? = 0.0,
    val weakSpots: List<String> = emptyList(),
    val questions: List<AssessmentQuestion> = emptyList(),
    val recommendations: List<Map<String, Any?>> = emptyList(),
    val startedAt: String? = null,
    val submittedAt: String? = null,
    val createdAt: String? = null,
)

data class AssessmentQuestion(
    val id: String = "",
    val question: String = "",
    val options: List<String> = emptyList(),
    val topic: String? = null,
    val type: String? = "mcq",
)

data class GenerateAssessmentResponse(
    val session: AssessmentSessionData? = null,
    val activePlan: Map<String, Any?>? = null,
)

data class CodingProblemSummary(
    val id: String? = null,
    val number: String? = null,
    val title: String = "",
    val slug: String = "",
    val difficulty: String = "Medium",
    val category: String? = "DSA",
    val description: String? = null,
    val platform: String? = "leetcode",
    val url: String? = null,
    val examples: List<String> = emptyList(),
    val constraints: List<String> = emptyList(),
    val starterCode: Map<String, String> = emptyMap(),
    val testCases: List<Map<String, String>> = emptyList(),
    val extractionStatus: String? = null,
    val extractionMessage: String? = null,
)

data class CodingRunResult(
    val id: String? = null,
    val status: String = "ACCEPTED",
    val stdout: String = "",
    val stderr: String = "",
    val compileOutput: String = "",
    val time: Double? = null,
    val memory: Int? = null,
    val score: Double? = null,
    val rubric: Map<String, Any?>? = null,
    val analysis: Map<String, Any?>? = null,
    val testResults: List<Map<String, Any?>> = emptyList(),
)

data class OAuthTokenResponse(
    val access_token: String? = null,
    val token_type: String? = null,
    val expires_in: Long? = null,
    val scope: String? = null,
    val user: MobileUser? = null,
)

data class NotificationItem(
    val id: String,
    val type: String,
    val message: String,
    val read: Boolean = false,
    val sentAt: String? = null,
    val metadata: Map<String, Any?>? = null,
)

data class NotificationSyncResult(
    val success: Boolean,
    val synced: Boolean,
    val created: List<NotificationItem> = emptyList(),
    val unreadCount: Int = 0,
)

data class UserProfileData(
    val userId: String? = null,
    val notificationsEnabled: Boolean = true,
    val notificationEmailEnabled: Boolean = false,
    val notificationBrowserEnabled: Boolean = true,
    val targetCompanyTrack: String? = null,
    val targetRole: String? = null,
    val dailyGoalMinutes: Int = 120,
)
