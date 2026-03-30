package dev.placeprep.mobile.data

class PlacePrepRepository(
    private val sessionStore: SecureSessionStore,
) {
    private val api = PlacePrepApi.create(sessionStore)

    suspend fun login(identifier: String, password: String): MobileUser {
        val session = api.login(LoginRequest(identifier = identifier, password = password)).data
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

    suspend fun loadTasks(): List<TaskItem> = api.getTodayTasks().data

    suspend fun loadMentorHistory(): List<MentorMessage> = api.getMentorHistory().data

    suspend fun sendMentorMessage(message: String): MentorReply {
        return api.sendMentorMessage(MentorMessageRequest(message)).data
    }
}
