package dev.placeprep.mobile.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import dev.placeprep.mobile.data.AiQuickTaskResult
import dev.placeprep.mobile.data.MentorMessage
import dev.placeprep.mobile.data.MobileUser
import dev.placeprep.mobile.data.PrepPlan
import dev.placeprep.mobile.data.PlacePrepRepository
import dev.placeprep.mobile.data.PowerPocketSession
import dev.placeprep.mobile.data.ProgressSummary
import dev.placeprep.mobile.data.TaskItem
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class PlacePrepUiState(
    val user: MobileUser? = null,
    val progress: ProgressSummary? = null,
    val tasks: List<TaskItem> = emptyList(),
    val mentorHistory: List<MentorMessage> = emptyList(),
    val prepPlan: PrepPlan? = null,
    val activePowerPocket: PowerPocketSession? = null,
    val quickTask: AiQuickTaskResult? = null,
    val currentTab: MobileTab = MobileTab.Dashboard,
    val authStage: AuthStage = AuthStage.Landing,
    val isBootstrapping: Boolean = true,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
)

enum class AuthStage {
    Landing,
    Login,
    Signup,
}

enum class MobileTab {
    Dashboard,
    Tasks,
    Mentor,
    Settings,
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

    fun refreshWorkspace() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            runCatching {
                WorkspacePayload(
                    progress = repository.loadProgress(),
                    tasks = repository.loadTasks(),
                    history = repository.loadMentorHistory(),
                    prepPlan = repository.loadLatestPrepPlan(),
                    activePowerPocket = repository.loadActivePowerPocket(),
                )
            }.onSuccess { result ->
                _uiState.update {
                    it.copy(
                        progress = result.progress,
                        tasks = result.tasks,
                        mentorHistory = result.history,
                        prepPlan = result.prepPlan,
                        activePowerPocket = result.activePowerPocket,
                        isLoading = false,
                    )
                }
            }.onFailure { error ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = error.message ?: "Unable to load workspace.",
                    )
                }
            }
        }
    }

    private data class WorkspacePayload(
        val progress: ProgressSummary,
        val tasks: List<TaskItem>,
        val history: List<MentorMessage>,
        val prepPlan: PrepPlan?,
        val activePowerPocket: PowerPocketSession?,
    )

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

    fun switchTab(tab: MobileTab) {
        _uiState.update { it.copy(currentTab = tab) }
    }

    fun logout() {
        viewModelScope.launch {
            repository.logout()
            _uiState.value =
                PlacePrepUiState(
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
