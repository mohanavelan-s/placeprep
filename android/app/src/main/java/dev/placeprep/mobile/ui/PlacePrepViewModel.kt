package dev.placeprep.mobile.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import dev.placeprep.mobile.data.MentorMessage
import dev.placeprep.mobile.data.MobileUser
import dev.placeprep.mobile.data.PlacePrepRepository
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
    val currentTab: MobileTab = MobileTab.Dashboard,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
)

enum class MobileTab {
    Dashboard,
    Tasks,
    Mentor,
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
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            runCatching { repository.restoreUser() }
                .onSuccess { user ->
                    if (user == null) {
                        _uiState.update { PlacePrepUiState(isLoading = false) }
                    } else {
                        _uiState.update { it.copy(user = user) }
                        refreshWorkspace()
                    }
                }
                .onFailure { error ->
                    _uiState.update {
                        PlacePrepUiState(
                            isLoading = false,
                            errorMessage = error.message ?: "Unable to restore session.",
                        )
                    }
                }
        }
    }

    fun login(identifier: String, password: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            runCatching { repository.login(identifier, password) }
                .onSuccess { user ->
                    _uiState.update { it.copy(user = user, isLoading = false) }
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

    fun refreshWorkspace() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            runCatching {
                Triple(
                    repository.loadProgress(),
                    repository.loadTasks(),
                    repository.loadMentorHistory(),
                )
            }.onSuccess { (progress, tasks, history) ->
                _uiState.update {
                    it.copy(
                        progress = progress,
                        tasks = tasks,
                        mentorHistory = history,
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

    fun switchTab(tab: MobileTab) {
        _uiState.update { it.copy(currentTab = tab) }
    }

    fun logout() {
        viewModelScope.launch {
            repository.logout()
            _uiState.value = PlacePrepUiState()
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
