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

    suspend fun generatePrepPlan(
        targetRole: String = "Software Development Engineer",
        companyKey: String = "google",
        customCompanyName: String = "Google",
        durationMonths: Int = 3,
        timePerDay: Int = 120,
    ): PrepPlan {
        return api.generatePrepPlan(
            mapOf(
                "targetRole" to targetRole,
                "companyKey" to companyKey,
                "customCompanyName" to customCompanyName,
                "durationMonths" to durationMonths,
                "timePerDay" to timePerDay,
            )
        ).data
    }

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

    suspend fun generateAssessment(type: String = "mcq", durationMinutes: Int = 20): GenerateAssessmentResponse {
        return api.generateAssessment(
            mapOf(
                "assessmentType" to type,
                "durationMinutes" to durationMinutes,
            )
        ).data
    }

    suspend fun submitAssessment(assessmentId: String, answers: Map<String, String>): AssessmentSessionData {
        return api.submitAssessment(assessmentId, mapOf("answers" to answers)).data
    }

    suspend fun applyPlanUpdate(assessmentId: String): Map<String, Any?> {
        return api.applyPlanUpdate(assessmentId).data
    }

    suspend fun resolveCodingProblem(slugOrTitle: String): CodingProblemSummary {
        return api.resolveCodingProblem(mapOf("query" to slugOrTitle, "slug" to slugOrTitle)).data
    }

    suspend fun runCodingSolution(
        slugOrTitle: String,
        language: String,
        sourceCode: String,
        stdin: String = "",
        expectedOutput: String = "",
    ): CodingRunResult {
        return api.runCode(
            mapOf(
                "slug" to slugOrTitle,
                "title" to slugOrTitle,
                "language" to language,
                "sourceCode" to sourceCode,
                "stdin" to stdin,
                "expectedOutput" to expectedOutput,
            )
        ).data
    }

    suspend fun submitCodingSolution(
        slugOrTitle: String,
        language: String,
        sourceCode: String,
        stdin: String = "",
        expectedOutput: String = "",
    ): CodingRunResult {
        return api.submitCode(
            mapOf(
                "slug" to slugOrTitle,
                "title" to slugOrTitle,
                "language" to language,
                "sourceCode" to sourceCode,
                "stdin" to stdin,
                "expectedOutput" to expectedOutput,
            )
        ).data
    }

    fun saveToken(token: String) {
        sessionStore.saveToken(token)
    }

    suspend fun exchangeOAuthCode(
        code: String,
        clientId: String = "placeprep-mobile-app",
        redirectUri: String = "placeprep://oauth/callback",
        codeVerifier: String = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
    ): MobileUser {
        val resp = api.exchangeOAuthToken(
            mapOf(
                "grant_type" to "authorization_code",
                "code" to code,
                "client_id" to clientId,
                "redirect_uri" to redirectUri,
                "code_verifier" to codeVerifier,
            )
        )
        val token = resp.access_token
        if (!token.isNullOrBlank()) {
            sessionStore.saveToken(token)
        }
        return resp.user ?: api.getMe().data
    }

    suspend fun loadNotifications(): List<NotificationItem> = api.listNotifications().data

    suspend fun syncNotifications(): NotificationSyncResult = api.syncNotifications()

    suspend fun sendTestNotification(): Map<String, Any?> = api.testPushNotification().data

    suspend fun loadUserProfile(): UserProfileData = api.getUserProfile().data

    suspend fun updateUserProfile(updates: Map<String, Any?>): UserProfileData = api.updateUserProfile(updates).data
}
