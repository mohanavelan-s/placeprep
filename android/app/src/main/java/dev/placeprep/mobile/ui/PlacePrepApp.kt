package dev.placeprep.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.ListAlt
import androidx.compose.material.icons.outlined.Logout
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.placeprep.mobile.data.MentorMessage
import dev.placeprep.mobile.data.ProgressSummary
import dev.placeprep.mobile.data.TaskItem

private val Background = Color(0xFF0A0A0D)
private val SurfaceColor = Color(0xFF111116)
private val TextPrimary = Color(0xFFE6E6E6)
private val TextSecondary = Color(0xFF9A9A9A)
private val Crimson = Color(0xFF8B0000)

@Composable
fun PlacePrepApp(viewModel: PlacePrepViewModel) {
    val state by viewModel.uiState.collectAsState()

    MaterialTheme {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = Background,
            contentColor = TextPrimary,
        ) {
            if (state.user == null) {
                LoginScreen(
                    isLoading = state.isLoading,
                    errorMessage = state.errorMessage,
                    onLogin = viewModel::login,
                )
            } else {
                WorkspaceScreen(
                    state = state,
                    onRefresh = viewModel::refreshWorkspace,
                    onSendMentorMessage = viewModel::sendMentorMessage,
                    onSwitchTab = viewModel::switchTab,
                    onLogout = viewModel::logout,
                )
            }
        }
    }
}

@Composable
private fun LoginScreen(
    isLoading: Boolean,
    errorMessage: String?,
    onLogin: (String, String) -> Unit,
) {
    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Background)
            .padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Card(
            shape = RoundedCornerShape(28.dp),
            colors = CardDefaults.cardColors(containerColor = SurfaceColor),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(modifier = Modifier.padding(24.dp)) {
                Text(
                    text = "PlacePrep",
                    color = TextSecondary,
                    letterSpacing = 4.sp,
                    fontSize = 12.sp,
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "Enter the system.",
                    color = TextPrimary,
                    fontSize = 34.sp,
                    fontWeight = FontWeight.Medium,
                )
                Spacer(modifier = Modifier.height(24.dp))
                OutlinedTextField(
                    value = identifier,
                    onValueChange = { identifier = it },
                    label = { Text("Username or email") },
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(modifier = Modifier.height(16.dp))
                if (!errorMessage.isNullOrBlank()) {
                    Text(text = errorMessage, color = Crimson, fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(12.dp))
                }
                Button(
                    onClick = { onLogin(identifier, password) },
                    enabled = !isLoading && identifier.isNotBlank() && password.isNotBlank(),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(if (isLoading) "Entering..." else "Login")
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WorkspaceScreen(
    state: PlacePrepUiState,
    onRefresh: () -> Unit,
    onSendMentorMessage: (String) -> Unit,
    onSwitchTab: (MobileTab) -> Unit,
    onLogout: () -> Unit,
) {
    Scaffold(
        containerColor = Background,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("PlacePrep", color = TextSecondary, fontSize = 12.sp)
                        Text(
                            text = state.user?.name ?: "Workspace",
                            color = TextPrimary,
                            fontSize = 22.sp,
                        )
                    }
                },
                actions = {
                    TextButton(onClick = onRefresh) {
                        Text("Refresh", color = TextPrimary)
                    }
                    TextButton(onClick = onLogout) {
                        Icon(Icons.Outlined.Logout, contentDescription = null, tint = Crimson)
                    }
                },
            )
        },
        bottomBar = {
            NavigationBar(containerColor = SurfaceColor) {
                listOf(
                    MobileTab.Dashboard to Icons.Outlined.BarChart,
                    MobileTab.Tasks to Icons.Outlined.ListAlt,
                    MobileTab.Mentor to Icons.Outlined.ChatBubbleOutline,
                ).forEach { (tab, icon) ->
                    NavigationBarItem(
                        selected = state.currentTab == tab,
                        onClick = { onSwitchTab(tab) },
                        icon = { Icon(icon, contentDescription = null) },
                        label = { Text(tab.name) },
                    )
                }
            }
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (!state.errorMessage.isNullOrBlank()) {
                Card(colors = CardDefaults.cardColors(containerColor = SurfaceColor)) {
                    Text(
                        text = state.errorMessage,
                        color = Crimson,
                        modifier = Modifier.padding(16.dp),
                    )
                }
            }

            when (state.currentTab) {
                MobileTab.Dashboard -> DashboardTab(progress = state.progress, tasks = state.tasks)
                MobileTab.Tasks -> TasksTab(tasks = state.tasks)
                MobileTab.Mentor -> MentorTab(messages = state.mentorHistory, onSend = onSendMentorMessage)
            }
        }
    }
}

@Composable
private fun DashboardTab(progress: ProgressSummary?, tasks: List<TaskItem>) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Card(colors = CardDefaults.cardColors(containerColor = SurfaceColor)) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Text("Command Chamber", color = TextPrimary, fontSize = 28.sp)
                    Spacer(modifier = Modifier.height(6.dp))
                    Text("Streak, readiness, and mission control.", color = TextSecondary)
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                MetricCard("Streak", "${progress?.streak ?: 0}", Modifier.weight(1f))
                MetricCard("Consistency", "${progress?.consistencyScore?.toInt() ?: 0}%", Modifier.weight(1f))
                MetricCard("Readiness", "${progress?.readinessScore?.toInt() ?: 0}%", Modifier.weight(1f))
            }
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = SurfaceColor)) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Text("Today's tasks", color = TextPrimary, fontSize = 20.sp)
                    Spacer(modifier = Modifier.height(10.dp))
                    tasks.take(4).forEach { task ->
                        Text(
                            text = "${task.title} • ${task.category} • ${task.estimatedMinutes / 60.0} hrs",
                            color = TextSecondary,
                            modifier = Modifier.padding(vertical = 4.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MetricCard(label: String, value: String, modifier: Modifier = Modifier) {
    Card(
        colors = CardDefaults.cardColors(containerColor = SurfaceColor),
        modifier = modifier,
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(label, color = TextSecondary, fontSize = 12.sp)
            Spacer(modifier = Modifier.height(8.dp))
            Text(value, color = TextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
private fun TasksTab(tasks: List<TaskItem>) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items(tasks) { task ->
            Card(colors = CardDefaults.cardColors(containerColor = SurfaceColor)) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(task.title, color = TextPrimary, fontSize = 18.sp)
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        "${task.category} • ${task.status} • ${task.estimatedMinutes / 60.0} hrs",
                        color = TextSecondary,
                    )
                }
            }
        }
    }
}

@Composable
private fun MentorTab(
    messages: List<MentorMessage>,
    onSend: (String) -> Unit,
) {
    var message by remember { mutableStateOf("") }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Card(colors = CardDefaults.cardColors(containerColor = SurfaceColor)) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Nocturne Mentor", color = TextPrimary, fontSize = 24.sp)
                Spacer(modifier = Modifier.height(6.dp))
                Text("Strict placement guidance. No fluff.", color = TextSecondary)
            }
        }

        LazyColumn(
            modifier = Modifier.weight(1f, fill = true),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(messages) { item ->
                Card(colors = CardDefaults.cardColors(containerColor = SurfaceColor)) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text(item.role.uppercase(), color = TextSecondary, fontSize = 12.sp)
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(item.content, color = TextPrimary)
                    }
                }
            }
        }

        OutlinedTextField(
            value = message,
            onValueChange = { message = it },
            label = { Text("Ask Nocturne Mentor") },
            modifier = Modifier.fillMaxWidth(),
        )
        Button(
            onClick = {
                onSend(message)
                message = ""
            },
            enabled = message.isNotBlank(),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Send")
        }
    }
}
