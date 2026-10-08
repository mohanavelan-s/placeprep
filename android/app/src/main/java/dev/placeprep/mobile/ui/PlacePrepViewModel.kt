package dev.placeprep.mobile.ui

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import dev.placeprep.mobile.data.*
import dev.placeprep.mobile.notification.PlacePrepNotificationManager
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
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
    val activeAssessment: AssessmentSessionData? = null,
    val isAssessmentLoading: Boolean = false,
    val notifications: List<NotificationItem> = emptyList(),
    val userProfile: UserProfileData? = null,
    val selectedCodingProblem: CodingProblemSummary? = null,
    val codingRunResult: CodingRunResult? = null,
    val isCodingRunning: Boolean = false,
    val codingLanguage: String = "python",
    val codingSourceCode: String = "",
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
    private val appContext: Context? = null,
) : ViewModel() {

    private val _uiState = MutableStateFlow(PlacePrepUiState(isLoading = true))
    val uiState: StateFlow<PlacePrepUiState> = _uiState.asStateFlow()

    private var hasWelcomedInSession = false

    init {
        restoreSession()
    }

    private fun triggerWelcomeNotification(user: MobileUser, streak: Int = 0) {
        if (!hasWelcomedInSession && appContext != null) {
            hasWelcomedInSession = true
            PlacePrepNotificationManager.showLoginWelcomeNotification(appContext, user.name, streak)
        }
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
                        triggerWelcomeNotification(user)
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
                    triggerWelcomeNotification(user)
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
                    triggerWelcomeNotification(user)
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
                    triggerWelcomeNotification(user)
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

    fun handleOAuthCallback(code: String?, token: String?) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            if (!token.isNullOrBlank()) {
                repository.saveToken(token)
                restoreSession()
            } else if (!code.isNullOrBlank()) {
                runCatching { repository.exchangeOAuthCode(code) }
                    .onSuccess { user ->
                        _uiState.update { it.copy(user = user, isLoading = false) }
                        triggerWelcomeNotification(user)
                        switchTab(MobileTab.Dashboard)
                        refreshWorkspace()
                    }
                    .onFailure { error ->
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                errorMessage = error.message ?: "OAuth token exchange failed.",
                            )
                        }
                    }
            }
        }
    }

    fun refreshWorkspace() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            runCatching {
                coroutineScope {
                    val progressDeferred = async { runCatching { repository.loadProgress() }.getOrNull() }
                    val todayTasksDeferred = async { runCatching { repository.loadTodayTasks() }.getOrDefault(emptyList()) }
                    val allTasksDeferred = async { runCatching { repository.loadTasks() }.getOrDefault(emptyList()) }
                    val historyDeferred = async { runCatching { repository.loadMentorHistory() }.getOrDefault(emptyList()) }
                    val prepPlanDeferred = async { runCatching { repository.loadLatestPrepPlan() }.getOrNull() }
                    val activePowerPocketDeferred = async { runCatching { repository.loadActivePowerPocket() }.getOrNull() }
                    val assessmentsDeferred = async { runCatching { repository.loadAssessmentsOverview() }.getOrNull() }
                    val notificationsDeferred = async { runCatching { repository.loadNotifications() }.getOrDefault(emptyList()) }
                    val profileDeferred = async { runCatching { repository.loadUserProfile() }.getOrNull() }

                    val progress = progressDeferred.await()
                    val todayTasks = todayTasksDeferred.await()
                    val allTasks = allTasksDeferred.await()
                    val history = historyDeferred.await()
                    val prepPlan = prepPlanDeferred.await()
                    val activePowerPocket = activePowerPocketDeferred.await()
                    val assessments = assessmentsDeferred.await()
                    val notifications = notificationsDeferred.await()
                    val profile = profileDeferred.await()

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
                }
            }.onSuccess { result ->
                _uiState.update {
                    it.copy(
                        progress = result.progress ?: it.progress,
                        todayTasks = result.todayTasks,
                        tasks = result.allTasks,
                        mentorHistory = result.history,
                        prepPlan = result.prepPlan ?: it.prepPlan,
                        activePowerPocket = result.activePowerPocket,
                        assessmentsOverview = result.assessments ?: it.assessmentsOverview,
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

    // --- Assessments ---
    fun generateAssessment(type: String = "mcq") {
        viewModelScope.launch {
            _uiState.update { it.copy(isAssessmentLoading = true, errorMessage = null) }
            runCatching { repository.generateAssessment(type) }
                .onSuccess { resp ->
                    _uiState.update {
                        it.copy(
                            activeAssessment = resp.session,
                            isAssessmentLoading = false,
                            infoMessage = "Diagnostic assessment session generated."
                        )
                    }
                }
                .onFailure { err ->
                    _uiState.update {
                        it.copy(
                            isAssessmentLoading = false,
                            errorMessage = err.message ?: "Create a Prep Architect plan first to generate assessments."
                        )
                    }
                }
        }
    }

    fun submitAssessment(assessmentId: String, answers: Map<String, String>) {
        viewModelScope.launch {
            _uiState.update { it.copy(isAssessmentLoading = true, errorMessage = null) }
            runCatching { repository.submitAssessment(assessmentId, answers) }
                .onSuccess { session ->
                    _uiState.update {
                        it.copy(
                            activeAssessment = session,
                            isAssessmentLoading = false,
                            infoMessage = "Assessment completed! Score: ${session.score?.toInt() ?: 0}%"
                        )
                    }
                    runCatching { repository.loadAssessmentsOverview() }.getOrNull()?.let { overview ->
                        _uiState.update { it.copy(assessmentsOverview = overview) }
                    }
                }
                .onFailure { err ->
                    _uiState.update {
                        it.copy(
                            isAssessmentLoading = false,
                            errorMessage = err.message ?: "Failed to submit assessment."
                        )
                    }
                }
        }
    }

    fun applyAssessmentPlanUpdate(assessmentId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isAssessmentLoading = true, errorMessage = null) }
            runCatching { repository.applyPlanUpdate(assessmentId) }
                .onSuccess {
                    _uiState.update {
                        it.copy(
                            isAssessmentLoading = false,
                            infoMessage = "Prep Architect plan adapted with diagnostic findings."
                        )
                    }
                    refreshWorkspace()
                }
                .onFailure { err ->
                    _uiState.update {
                        it.copy(
                            isAssessmentLoading = false,
                            errorMessage = err.message ?: "Failed to apply plan updates."
                        )
                    }
                }
        }
    }

    // --- Coding Lab ---
    fun resolveCodingProblem(slugOrTitle: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            runCatching { repository.resolveCodingProblem(slugOrTitle) }
                .onSuccess { problem ->
                    val lang = _uiState.value.codingLanguage
                    val starter = problem.starterCode[lang]
                        ?: problem.starterCode["python"]
                        ?: "class Solution:\n    def solve(self, *args):\n        pass\n"
                    _uiState.update {
                        it.copy(
                            selectedCodingProblem = problem,
                            codingSourceCode = starter,
                            codingRunResult = null,
                            isLoading = false,
                        )
                    }
                }
                .onFailure { error ->
                    // Fallback so Coding Lab never crashes even if offline or problem unknown!
                    val fallbackProblem = CodingProblemSummary(
                        number = "1",
                        title = slugOrTitle.ifBlank { "Two Sum" },
                        slug = "two-sum",
                        difficulty = "Easy",
                        category = "DSA",
                        description = "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
                        starterCode = mapOf(
                            "python" to "class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        # Hash map approach\n        seen = {}\n        for i, n in enumerate(nums):\n            diff = target - n\n            if diff in seen:\n                return [seen[diff], i]\n            seen[n] = i\n        return []\n",
                            "java" to "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Your implementation\n        return new int[]{};\n    }\n}\n"
                        )
                    )
                    _uiState.update {
                        it.copy(
                            selectedCodingProblem = fallbackProblem,
                            codingSourceCode = fallbackProblem.starterCode["python"] ?: "",
                            codingRunResult = null,
                            isLoading = false,
                            infoMessage = "Loaded problem profile."
                        )
                    }
                }
        }
    }

    fun setCodingLanguage(language: String) {
        val problem = _uiState.value.selectedCodingProblem
        val code = problem?.starterCode?.get(language)
            ?: _uiState.value.codingSourceCode
        _uiState.update {
            it.copy(
                codingLanguage = language,
                codingSourceCode = code,
            )
        }
    }

    fun updateCodingSourceCode(code: String) {
        _uiState.update { it.copy(codingSourceCode = code) }
    }

    fun runCodingSolution() {
        val problem = _uiState.value.selectedCodingProblem ?: return
        val lang = _uiState.value.codingLanguage
        val code = _uiState.value.codingSourceCode
        viewModelScope.launch {
            _uiState.update { it.copy(isCodingRunning = true, errorMessage = null) }
            runCatching {
                repository.runCodingSolution(
                    slugOrTitle = problem.slug.ifBlank { problem.title },
                    language = lang,
                    sourceCode = code
                )
            }.onSuccess { runResult ->
                _uiState.update {
                    it.copy(
                        codingRunResult = runResult,
                        isCodingRunning = false,
                        infoMessage = "Execution complete: ${runResult.status}"
                    )
                }
            }.onFailure { error ->
                _uiState.update {
                    it.copy(
                        isCodingRunning = false,
                        errorMessage = error.message ?: "Failed to execute code run."
                    )
                }
            }
        }
    }

    fun submitCodingSolution() {
        val problem = _uiState.value.selectedCodingProblem ?: return
        val lang = _uiState.value.codingLanguage
        val code = _uiState.value.codingSourceCode
        viewModelScope.launch {
            _uiState.update { it.copy(isCodingRunning = true, errorMessage = null) }
            runCatching {
                repository.submitCodingSolution(
                    slugOrTitle = problem.slug.ifBlank { problem.title },
                    language = lang,
                    sourceCode = code
                )
            }.onSuccess { subResult ->
                _uiState.update {
                    it.copy(
                        codingRunResult = subResult,
                        isCodingRunning = false,
                        infoMessage = "Submission evaluated: Score ${subResult.score?.toInt() ?: 0}/100"
                    )
                }
                refreshWorkspace()
            }.onFailure { error ->
                _uiState.update {
                    it.copy(
                        isCodingRunning = false,
                        errorMessage = error.message ?: "Submission failed."
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
            hasWelcomedInSession = false
            _uiState.value = PlacePrepUiState(
                authStage = AuthStage.Landing,
                isBootstrapping = false,
            )
        }
    }

    companion object {
        fun factory(repository: PlacePrepRepository, context: Context? = null): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    return PlacePrepViewModel(repository, context?.applicationContext) as T
                }
            }
    }
}
