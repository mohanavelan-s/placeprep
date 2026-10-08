package dev.placeprep.mobile.data

class PlacePrepRepository(
    private val sessionStore: SecureSessionStore,
) {
    private val api = PlacePrepApi.create(sessionStore)

    suspend fun register(
        name: String,
        username: String,
        email: String,
        password: String,
        inviteCode: String,
    ): MobileUser {
        val session = api.register(
            RegisterRequest(
                name = name,
                username = username,
                email = email,
                password = password,
                inviteCode = inviteCode,
            )
        ).data
        sessionStore.saveToken(session.token)
        return session.user
    }

    suspend fun login(identifier: String, password: String): MobileUser {
        val session = api.login(LoginRequest(identifier = identifier, password = password)).data
        sessionStore.saveToken(session.token)
        return session.user
    }

    suspend fun googleAuth(idToken: String): MobileUser {
        val session = api.googleAuth(GoogleAuthRequest(idToken = idToken)).data
        sessionStore.saveToken(session.token)
        return session.user
    }

    suspend fun logout() {
        sessionStore.saveToken(null)
    }

    suspend fun restoreUser(): MobileUser? {
        val token = sessionStore.getToken() ?: return null
        if (token.isBlank()) {
            return null
        }
        return api.getMe().data
    }

    suspend fun loadProgress(): ProgressSummary = api.getProgressSummary().data

    suspend fun loadTasks(status: String? = null, category: String? = null): List<TaskItem> {
        return api.getTasks(status, category).data
    }

    suspend fun loadTodayTasks(): List<TaskItem> = api.getTodayTasks().data

    suspend fun createTask(
        title: String,
        description: String? = null,
        category: String = "dsa",
        priority: String = "medium",
        estimatedMinutes: Int = 30,
        difficulty: String = "medium",
    ): TaskItem {
        return api.createTask(
            CreateTaskRequest(
                title = title,
                description = description,
                category = category,
                priority = priority,
                estimatedMinutes = estimatedMinutes,
                difficulty = difficulty,
            )
        ).data
    }

    suspend fun toggleTaskStatus(task: TaskItem): TaskItem {
        val newStatus = if (task.status.equals("completed", ignoreCase = true)) "pending" else "completed"
        return api.updateTask(task.id, mapOf("status" to newStatus)).data
    }

    suspend fun updateTask(taskId: String, updates: Map<String, Any?>): TaskItem {
        return api.updateTask(taskId, updates).data
    }

    suspend fun deleteTask(taskId: String): TaskItem {
        return api.deleteTask(taskId).data
    }

    suspend fun loadLatestPrepPlan(): PrepPlan? = api.getLatestPrepPlan().data

    suspend fun generatePrepPlan(): PrepPlan = api.generatePrepPlan().data

    suspend fun loadActivePowerPocket(): PowerPocketSession? = api.getActivePowerPocket().data

    suspend fun generateQuickTask(): AiQuickTaskResult = api.generateQuickTask().data

    suspend fun startPowerPocket(title: String?, notes: String?): PowerPocketSession {
        return api.startPowerPocket(
            PowerPocketStartRequest(
                title = title,
                notes = notes,
                source = "ai",
            )
        ).data
    }

    suspend fun endPowerPocket(sessionId: String): PowerPocketSession {
        return api.endPowerPocket(sessionId).data
    }

    suspend fun getCoachHelp(topic: String, problem: String?, blockedReason: String?): AiStuckHelpResponse {
        return api.getCoachHelp(
            AiStuckHelpRequest(
                topic = topic,
                problem = problem,
                blockedReason = blockedReason,
            )
        ).data
    }

    suspend fun evaluateDaily(reflections: String?, focusScore: Int): AiDailyEvaluationResponse {
        return api.evaluateDaily(
            AiDailyEvaluationRequest(
                reflections = reflections,
                focusScore = focusScore,
            )
        ).data
    }

    suspend fun loadMentorHistory(): List<MentorMessage> = api.getMentorHistory().data

    suspend fun sendMentorMessage(message: String): MentorReply {
        return api.sendMentorMessage(MentorMessageRequest(message)).data
    }

    suspend fun clearMentorHistory() {
        api.clearMentorHistory()
    }

    suspend fun loadAssessmentsOverview(): AssessmentOverview = api.getAssessmentsOverview().data

    suspend fun resolveCodingProblem(slugOrTitle: String): CodingProblemSummary {
        return api.resolveCodingProblem(mapOf("query" to slugOrTitle, "slug" to slugOrTitle)).data
    }

    suspend fun loadNotifications(): List<NotificationItem> = api.listNotifications().data

    suspend fun syncNotifications(): NotificationSyncResult = api.syncNotifications()

    suspend fun sendTestNotification(): Map<String, Any?> = api.testPushNotification().data

    suspend fun loadUserProfile(): UserProfileData = api.getUserProfile().data

    suspend fun updateUserProfile(updates: Map<String, Any?>): UserProfileData = api.updateUserProfile(updates).data
}
