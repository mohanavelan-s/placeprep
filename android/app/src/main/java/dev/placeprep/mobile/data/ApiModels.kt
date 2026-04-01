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
    val knownTopics: List<String>,
    val targetTopics: List<String>,
    val roadmap: List<PrepRoadmapWeek>,
    val tasks: List<PrepPlanDay>,
    val timePerDay: Double?,
    val targetRole: String?,
)

data class TaskItem(
    val id: String,
    val title: String,
    val category: String,
    val status: String,
    val estimatedMinutes: Int,
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
