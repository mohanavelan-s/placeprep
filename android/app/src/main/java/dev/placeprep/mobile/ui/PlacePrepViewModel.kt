package dev.placeprep.mobile.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import dev.placeprep.mobile.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class PlacePrepUiState(
    val user: MobileUser? = null,
    val progress: ProgressSummary? = null,
    val tasks: List<TaskItem> = emptyList(),
    val todayTasks: List<TaskItem> = emptyList(),
    val prepPlan: PrepPlan? = null,
    val activePowerPocket: PowerPocketSession? = null,
    val quickTask: AiQuickTaskResult? = null,
    val mentorHistory: List<MentorMessage> = emptyList(),
    val coachHelp: AiStuckHelpResponse? = null,
    val isCoachLoading: Boolean = false,
    val dailyEvaluation: AiDailyEvaluationResponse? = null,
    val isEvaluating: Boolean = false,
    val assessmentsOverview: AssessmentOverview? = null,
    val notifications: List<NotificationItem> = emptyList(),
    val userProfile: UserProfileData? = null,
    val selectedCodingProblem: CodingProblemSummary? = null,
    val currentTab: MobileTab = MobileTab.Dashboard,
    val authStage: AuthStage = AuthStage.Landing,
    val isBootstrapping: Boolean = true,
    val isLoading: Boolean = false,
    val isOffline: Boolean = false,
    val errorMessage: String? = null,
    val infoMessage: String? = null,
    val uiLanguage: String = "en",
)

enum class AuthStage {
    Landing,
    Login,
    Signup,
}

enum class MobileTab {
    Dashboard,      // Command Chamber
    Tasks,          // Tasks
    Architect,      // Prep Architect
    Assessments,    // Assessments
    CodingLab,      // Coding Lab
    Progress,       // Analytics
    Mentor,         // Nocturne Mentor
    Settings,       // Settings & Profile
}

class PlacePrepViewModel(
    private val repository: PlacePrepRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(PlacePrepUiState(isLoading = true))
    val uiState: StateFlow<PlacePrepUiState> = _uiState.asStateFlow()

    init {
        restoreSession()
    }

    fun restoreSession() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, isBootstrapping = true, errorMessage = null) }
            runCatching { repository.restoreUser() }
                .onSuccess { user ->
                    if (user == null) {
                        _uiState.update {
                            PlacePrepUiState(
                                isLoading = false,
                                isBootstrapping = false,
                                authStage = AuthStage.Landing,
                            )
                        }
                    } else {
                        _uiState.update { it.copy(user = user, isBootstrapping = false) }
                        refreshWorkspace()
                    }
                }
                .onFailure { error ->
                    _uiState.update {
                        PlacePrepUiState(
                            isLoading = false,
                            isBootstrapping = false,
                            authStage = AuthStage.Landing,
                            errorMessage = error.message ?: "Unable to restore session.",
                        )
                    }
                }
        }
    }

    fun setAuthStage(stage: AuthStage) {
        _uiState.update {
            it.copy(
                authStage = stage,
                errorMessage = null,
                isLoading = false,
            )
        }
    }

    fun login(identifier: String, password: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            runCatching { repository.login(identifier, password) }
                .onSuccess { user ->
                    _uiState.update {
                        it.copy(
                            user = user,
                            isLoading = false,
                            authStage = AuthStage.Login,
                        )
                    }
                    switchTab(MobileTab.Dashboard)
                    refreshWorkspace()
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = error.message ?: "Unable to sign in.",
                        )
                    }
                }
        }
    }

    fun register(
        name: String,
        username: String,
        email: String,
        password: String,
        inviteCode: String,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            runCatching { repository.register(name, username, email, password, inviteCode) }
                .onSuccess { user ->
                    _uiState.update {
                        it.copy(
                            user = user,
                            isLoading = false,
                            authStage = AuthStage.Signup,
                        )
                    }
                    switchTab(MobileTab.Dashboard)
                    refreshWorkspace()
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = error.message ?: "Unable to create the account.",
                        )
                    }
                }
        }
    }

    fun googleAuth(idToken: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            runCatching { repository.googleAuth(idToken) }
                .onSuccess { user ->
                    _uiState.update {
                        it.copy(
                            user = user,
                            isLoading = false,
                        )
                    }
                    switchTab(MobileTab.Dashboard)
                    refreshWorkspace()
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = error.message ?: "Google sign-in failed.",
                        )
                    }
                }
        }
    }

    fun refreshWorkspace() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            runCatching {
                val progress = runCatching { repository.loadProgress() }.getOrNull()
                val todayTasks = runCatching { repository.loadTodayTasks() }.getOrDefault(emptyList())
                val allTasks = runCatching { repository.loadTasks() }.getOrDefault(emptyList())
                val history = runCatching { repository.loadMentorHistory() }.getOrDefault(emptyList())
                val prepPlan = runCatching { repository.loadLatestPrepPlan() }.getOrNull()
                val activePowerPocket = runCatching { repository.loadActivePowerPocket() }.getOrNull()
                val assessments = runCatching { repository.loadAssessmentsOverview() }.getOrNull()
                val notifications = runCatching { repository.loadNotifications() }.getOrDefault(emptyList())
                val profile = runCatching { repository.loadUserProfile() }.getOrNull()

                WorkspaceBundle(
                    progress = progress,
                    todayTasks = todayTasks,
                    allTasks = allTasks,
                    history = history,
                    prepPlan = prepPlan,
                    activePowerPocket = activePowerPocket,
                    assessments = assessments,
                    notifications = notifications,
                    profile = profile,
                )
            }.onSuccess { result ->
                _uiState.update {
                    it.copy(
                        progress = result.progress ?: it.progress,
                        todayTasks = result.todayTasks,
                        tasks = result.allTasks,
                        mentorHistory = result.history,
                        prepPlan = result.prepPlan ?: it.prepPlan,
                        activePowerPocket = result.activePowerPocket,
                        assessmentsOverview = result.assessments,
                        notifications = result.notifications,
                        userProfile = result.profile ?: it.userProfile,
                        isLoading = false,
                        isOffline = false,
                    )
                }
            }.onFailure { error ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = error.message ?: "Unable to sync workspace.",
                    )
                }
            }
        }
    }

    private data class WorkspaceBundle(
        val progress: ProgressSummary?,
        val todayTasks: List<TaskItem>,
        val allTasks: List<TaskItem>,
        val history: List<MentorMessage>,
        val prepPlan: PrepPlan?,
        val activePowerPocket: PowerPocketSession?,
        val assessments: AssessmentOverview?,
        val notifications: List<NotificationItem>,
        val profile: UserProfileData?,
    )

    fun createTask(
        title: String,
        description: String? = null,
        category: String = "dsa",
        priority: String = "medium",
        estimatedMinutes: Int = 30,
        difficulty: String = "medium",
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            runCatching {
                repository.createTask(title, description, category, priority, estimatedMinutes, difficulty)
            }.onSuccess { created ->
                _uiState.update {
                    it.copy(
                        tasks = listOf(created) + it.tasks,
                        todayTasks = listOf(created) + it.todayTasks,
                        isLoading = false,
                        infoMessage = "Task created: ${created.title}",
                    )
                }
            }.onFailure { error ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = error.message ?: "Failed to create task.",
                    )
                }
            }
        }
    }

    fun toggleTaskStatus(task: TaskItem) {
        viewModelScope.launch {
            // Optimistic update
            val toggledStatus = if (task.status.equals("completed", ignoreCase = true)) "pending" else "completed"
            val optimistic = task.copy(status = toggledStatus)
            _uiState.update { state ->
                state.copy(
                    tasks = state.tasks.map { if (it.id == task.id) optimistic else it },
                    todayTasks = state.todayTasks.map { if (it.id == task.id) optimistic else it },
                )
            }
            runCatching { repository.toggleTaskStatus(task) }
                .onSuccess { updated ->
                    _uiState.update { state ->
                        state.copy(
                            tasks = state.tasks.map { if (it.id == updated.id) updated else it },
                            todayTasks = state.todayTasks.map { if (it.id == updated.id) updated else it },
                        )
                    }
                }
                .onFailure {
                    // Rollback
                    _uiState.update { state ->
                        state.copy(
                            tasks = state.tasks.map { if (it.id == task.id) task else it },
                            todayTasks = state.todayTasks.map { if (it.id == task.id) task else it },
                            errorMessage = "Failed to update task status.",
                        )
                    }
                }
        }
    }

    fun deleteTask(taskId: String) {
        viewModelScope.launch {
            _uiState.update { state ->
                state.copy(
                    tasks = state.tasks.filterNot { it.id == taskId },
                    todayTasks = state.todayTasks.filterNot { it.id == taskId },
                )
            }
            runCatching { repository.deleteTask(taskId) }
                .onFailure {
                    refreshWorkspace()
                }
        }
    }

    fun requestCoachHelp(topic: String, problem: String?, blockedReason: String?) {
        viewModelScope.launch {
            _uiState.update { it.copy(isCoachLoading = true, errorMessage = null) }
            runCatching {
                repository.getCoachHelp(topic, problem, blockedReason)
            }.onSuccess { coachResult ->
                _uiState.update {
                    it.copy(
                        coachHelp = coachResult,
                        isCoachLoading = false,
                    )
                }
            }.onFailure { error ->
                _uiState.update {
                    it.copy(
                        isCoachLoading = false,
                        errorMessage = error.message ?: "Coach guidance unavailable right now.",
                    )
                }
            }
        }
    }

    fun evaluateDaily(reflections: String?, focusScore: Int) {
        viewModelScope.launch {
            _uiState.update { it.copy(isEvaluating = true, errorMessage = null) }
            runCatching {
                repository.evaluateDaily(reflections, focusScore)
            }.onSuccess { eval ->
                _uiState.update {
                    it.copy(
                        dailyEvaluation = eval,
                        isEvaluating = false,
                        infoMessage = "Daily evaluation complete: Score ${eval.score}",
                    )
                }
            }.onFailure { error ->
                _uiState.update {
                    it.copy(
                        isEvaluating = false,
                        errorMessage = error.message ?: "Daily evaluation failed.",
                    )
                }
            }
        }
    }

    fun generatePrepPlan() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            runCatching { repository.generatePrepPlan() }
                .onSuccess { newPlan ->
                    _uiState.update {
                        it.copy(
                            prepPlan = newPlan,
                            isLoading = false,
                            infoMessage = "Fresh prep plan generated.",
                        )
                    }
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = error.message ?: "Failed to generate prep plan.",
                        )
                    }
                }
        }
    }

    fun engagePowerPocket() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            runCatching {
                val suggestion = repository.generateQuickTask()
                val session = repository.startPowerPocket(
                    title = suggestion.task.title,
                    notes = suggestion.suggestionLine,
                )
                suggestion to session
            }.onSuccess { (suggestion, session) ->
                _uiState.update {
                    it.copy(
                        quickTask = suggestion,
                        activePowerPocket = session,
                        isLoading = false,
                    )
                }
            }.onFailure { error ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = error.message ?: "Unable to engage Power Pocket.",
                    )
                }
            }
        }
    }

    fun endPowerPocket() {
        val activeSession = _uiState.value.activePowerPocket ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            runCatching { repository.endPowerPocket(activeSession.id) }
                .onSuccess {
                    _uiState.update {
                        it.copy(
                            activePowerPocket = null,
                            isLoading = false,
                        )
                    }
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = error.message ?: "Unable to end Power Pocket.",
                        )
                    }
                }
        }
    }

    fun sendMentorMessage(message: String) {
        viewModelScope.launch {
            if (message.isBlank()) return@launch
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            runCatching { repository.sendMentorMessage(message) }
                .onSuccess { reply ->
                    _uiState.update {
                        it.copy(
                            mentorHistory = reply.history,
                            isLoading = false,
                        )
                    }
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = error.message ?: "Unable to contact Nocturne Mentor.",
                        )
                    }
                }
        }
    }

    fun clearMentorHistory() {
        viewModelScope.launch {
            runCatching { repository.clearMentorHistory() }
            _uiState.update { it.copy(mentorHistory = emptyList()) }
        }
    }

    fun resolveCodingProblem(slugOrTitle: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            runCatching { repository.resolveCodingProblem(slugOrTitle) }
                .onSuccess { problem ->
                    _uiState.update {
                        it.copy(
                            selectedCodingProblem = problem,
                            isLoading = false,
                        )
                    }
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = error.message ?: "Could not resolve coding problem.",
                        )
                    }
                }
        }
    }

    fun sendTestNotification() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            runCatching { repository.sendTestNotification() }
                .onSuccess {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            infoMessage = "Test notification signal dispatched.",
                        )
                    }
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = error.message ?: "Failed to dispatch test notification.",
                        )
                    }
                }
        }
    }

    fun toggleNotificationPreference(field: String, enabled: Boolean) {
        viewModelScope.launch {
            runCatching {
                repository.updateUserProfile(mapOf(field to enabled))
            }.onSuccess { updated ->
                _uiState.update { it.copy(userProfile = updated) }
            }
        }
    }

    fun setLanguage(lang: String) {
        _uiState.update { it.copy(uiLanguage = lang) }
    }

    fun switchTab(tab: MobileTab) {
        _uiState.update { it.copy(currentTab = tab, errorMessage = null, infoMessage = null) }
    }

    fun clearInfoMessage() {
        _uiState.update { it.copy(infoMessage = null) }
    }

    fun clearErrorMessage() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    fun setOfflineState(offline: Boolean) {
        _uiState.update { it.copy(isOffline = offline) }
    }

    fun logout() {
        viewModelScope.launch {
            repository.logout()
            _uiState.value = PlacePrepUiState(
                authStage = AuthStage.Landing,
                isBootstrapping = false,
            )
        }
    }

    companion object {
        fun factory(repository: PlacePrepRepository): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    return PlacePrepViewModel(repository) as T
                }
            }
    }
}
