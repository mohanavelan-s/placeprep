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

data class TaskItem(
    val id: String,
    val title: String,
    val category: String,
    val status: String,
    val estimatedMinutes: Int,
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
