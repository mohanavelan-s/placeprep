package dev.placeprep.mobile.ui

import androidx.compose.animation.Crossfade
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ListAlt
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Timelapse
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.placeprep.mobile.data.MentorMessage
import dev.placeprep.mobile.data.ProgressSummary
import dev.placeprep.mobile.data.TaskItem

private val Background = Color(0xFF09090C)
private val SurfaceBase = Color(0xFF111116)
private val SurfaceRaised = Color(0xFF17171E)
private val SurfaceMuted = Color(0xFF1D1D26)
private val Border = Color(0xFF262631)
private val TextPrimary = Color(0xFFF1ECEC)
private val TextSecondary = Color(0xFFAAA4A7)
private val TextMuted = Color(0xFF7E7782)
private val Crimson = Color(0xFF9C2E34)
private val CrimsonSoft = Color(0xFFD96A6D)
private val Lavender = Color(0xFFE9DAF8)
private val Success = Color(0xFF6AB98C)

private val MobileColorScheme =
    darkColorScheme(
        primary = Lavender,
        onPrimary = Background,
        secondary = CrimsonSoft,
        background = Background,
        surface = SurfaceBase,
        surfaceVariant = SurfaceRaised,
        onSurface = TextPrimary,
        onBackground = TextPrimary,
        outline = Border,
        error = CrimsonSoft,
    )

@Composable
fun PlacePrepApp(viewModel: PlacePrepViewModel) {
    val state by viewModel.uiState.collectAsState()

    MaterialTheme(colorScheme = MobileColorScheme) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = Background,
            contentColor = TextPrimary,
        ) {
            BackgroundChrome {
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
}

@Composable
private fun BackgroundChrome(content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFF120D12),
                        Background,
                        Color(0xFF0C0C10),
                    )
                )
            )
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            Crimson.copy(alpha = 0.18f),
                            Color.Transparent,
                        )
                    )
                )
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color.Transparent,
                            Color(0x99111116),
                            Background,
                        )
                    )
                )
        )
        content()
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
            .padding(horizontal = 22.dp, vertical = 28.dp),
        contentAlignment = Alignment.Center,
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(34.dp),
            color = SurfaceBase.copy(alpha = 0.96f),
            tonalElevation = 8.dp,
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 26.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "PlacePrep",
                        color = TextSecondary,
                        letterSpacing = 4.sp,
                        fontSize = 11.sp,
                    )
                    Text(
                        text = "Enter the system.",
                        color = TextPrimary,
                        fontSize = 38.sp,
                        lineHeight = 42.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = "Private command access for placements, live signals, and mentor guidance.",
                        color = TextSecondary,
                        fontSize = 14.sp,
                        lineHeight = 22.sp,
                    )
                }
                AccentStrip(text = "Secure session / Invite-gated / Cloud live")
                PremiumTextField(
                    value = identifier,
                    onValueChange = { identifier = it },
                    label = "Username or email",
                )
                PremiumTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = "Password",
                    password = true,
                )
                if (!errorMessage.isNullOrBlank()) {
                    Surface(
                        shape = RoundedCornerShape(18.dp),
                        color = Crimson.copy(alpha = 0.12f),
                    ) {
                        Text(
                            text = errorMessage,
                            color = CrimsonSoft,
                            fontSize = 13.sp,
                            lineHeight = 20.sp,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                        )
                    }
                }
                Button(
                    onClick = { onLogin(identifier.trim(), password) },
                    enabled = !isLoading && identifier.isNotBlank() && password.isNotBlank(),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(20.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Lavender,
                        contentColor = Background,
                        disabledContainerColor = SurfaceMuted,
                        disabledContentColor = TextMuted,
                    ),
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp,
                            color = Background,
                        )
                    } else {
                        Text("Initialize session", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                    }
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
        containerColor = Color.Transparent,
        topBar = {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                color = SurfaceBase.copy(alpha = 0.94f),
                shape = RoundedCornerShape(28.dp),
                tonalElevation = 8.dp,
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 18.dp, vertical = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            text = "PlacePrep",
                            color = TextSecondary,
                            letterSpacing = 3.sp,
                            fontSize = 11.sp,
                        )
                        Text(
                            text = state.user?.name ?: "Workspace",
                            color = TextPrimary,
                            fontSize = 26.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        PremiumIconAction(
                            icon = Icons.Outlined.Refresh,
                            contentDescription = "Refresh",
                            onClick = onRefresh,
                        )
                        PremiumIconAction(
                            icon = Icons.AutoMirrored.Outlined.Logout,
                            contentDescription = "Logout",
                            tint = CrimsonSoft,
                            onClick = onLogout,
                        )
                    }
                }
            }
        },
        bottomBar = {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(horizontal = 18.dp, vertical = 12.dp),
                contentAlignment = Alignment.Center,
            ) {
                Surface(
                    color = SurfaceBase.copy(alpha = 0.98f),
                    shape = RoundedCornerShape(30.dp),
                    tonalElevation = 10.dp,
                    shadowElevation = 18.dp,
                ) {
                    NavigationBar(
                        containerColor = Color.Transparent,
                        tonalElevation = 0.dp,
                    ) {
                        listOf(
                            MobileTab.Dashboard to Icons.Outlined.BarChart,
                            MobileTab.Tasks to Icons.AutoMirrored.Outlined.ListAlt,
                            MobileTab.Mentor to Icons.Outlined.ChatBubbleOutline,
                        ).forEach { (tab, icon) ->
                            NavigationBarItem(
                                selected = state.currentTab == tab,
                                onClick = { onSwitchTab(tab) },
                                icon = { Icon(icon, contentDescription = null) },
                                label = { Text(tab.name) },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = Background,
                                    selectedTextColor = TextPrimary,
                                    indicatorColor = Lavender,
                                    unselectedIconColor = TextMuted,
                                    unselectedTextColor = TextMuted,
                                ),
                            )
                        }
                    }
                }
            }
        },
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                if (!state.errorMessage.isNullOrBlank()) {
                    Surface(
                        shape = RoundedCornerShape(18.dp),
                        color = Crimson.copy(alpha = 0.12f),
                    ) {
                        Text(
                            text = state.errorMessage,
                            color = CrimsonSoft,
                            fontSize = 13.sp,
                            lineHeight = 20.sp,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                        )
                    }
                }
                Crossfade(
                    targetState = state.currentTab,
                    label = "placeprep-mobile-tab",
                ) { tab ->
                    when (tab) {
                        MobileTab.Dashboard -> DashboardTab(progress = state.progress, tasks = state.tasks)
                        MobileTab.Tasks -> TasksTab(tasks = state.tasks)
                        MobileTab.Mentor -> MentorTab(messages = state.mentorHistory, onSend = onSendMentorMessage)
                    }
                }
            }

            if (state.isLoading) {
                Surface(
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = 6.dp),
                    color = SurfaceRaised.copy(alpha = 0.94f),
                    shape = RoundedCornerShape(999.dp),
                    tonalElevation = 8.dp,
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                            color = Lavender,
                        )
                        Text("Syncing workspace", color = TextSecondary, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun DashboardTab(progress: ProgressSummary?, tasks: List<TaskItem>) {
    LazyColumn(
        contentPadding = PaddingValues(bottom = 96.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Surface(
                shape = RoundedCornerShape(30.dp),
                color = SurfaceRaised.copy(alpha = 0.96f),
                tonalElevation = 8.dp,
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(22.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    AccentStrip(text = "Command chamber / Mission control")
                    Text(
                        text = "Hold the line. Keep the system moving.",
                        color = TextPrimary,
                        fontSize = 30.sp,
                        lineHeight = 34.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = "Track momentum, recover weak spots, and push the next clean win.",
                        color = TextSecondary,
                        fontSize = 14.sp,
                        lineHeight = 22.sp,
                    )
                }
            }
        }
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                MetricCard("Streak", "${progress?.streak ?: 0}", "days", Modifier.weight(1f))
                MetricCard("Consistency", "${progress?.consistencyScore?.toInt() ?: 0}", "%", Modifier.weight(1f))
                MetricCard("Readiness", "${progress?.readinessScore?.toInt() ?: 0}", "%", Modifier.weight(1f))
            }
        }
        item {
            SectionHeader(
                title = "Tonight's work",
                subtitle = "Priority tasks lined up from your live dashboard feed.",
            )
        }
        if (tasks.isEmpty()) {
            item {
                EmptyStateCard(
                    title = "No missions assigned yet.",
                    description = "Pull the latest task plan from the web dashboard and the next sprint will show up here.",
                )
            }
        } else {
            items(tasks.take(4)) { task ->
                TaskCard(task = task)
            }
        }
    }
}

@Composable
private fun MetricCard(
    label: String,
    value: String,
    suffix: String,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier,
        color = SurfaceBase.copy(alpha = 0.95f),
        shape = RoundedCornerShape(24.dp),
        tonalElevation = 6.dp,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(label, color = TextMuted, fontSize = 11.sp, letterSpacing = 1.sp)
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(value, color = TextPrimary, fontSize = 28.sp, fontWeight = FontWeight.SemiBold)
                Text(suffix, color = TextSecondary, fontSize = 12.sp, modifier = Modifier.padding(bottom = 5.dp))
            }
        }
    }
}

@Composable
private fun TasksTab(tasks: List<TaskItem>) {
    LazyColumn(
        contentPadding = PaddingValues(bottom = 96.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            SectionHeader(
                title = "Mission queue",
                subtitle = "Your live task stream with clearer timing, categories, and status.",
            )
        }
        if (tasks.isEmpty()) {
            item {
                EmptyStateCard(
                    title = "No tasks published yet.",
                    description = "Generate a plan or refresh the workspace and PlacePrep will populate the mobile queue.",
                )
            }
        } else {
            items(tasks) { task ->
                TaskCard(task = task, expanded = true)
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

    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Surface(
            shape = RoundedCornerShape(30.dp),
            color = SurfaceRaised.copy(alpha = 0.96f),
            tonalElevation = 8.dp,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                AccentStrip(text = "Nocturne mentor / Live guidance")
                Text(
                    text = "Direct guidance. No noise.",
                    color = TextPrimary,
                    fontSize = 28.sp,
                    lineHeight = 32.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = "Ask for strategy, weak-area recovery, or the next high-value move.",
                    color = TextSecondary,
                    fontSize = 14.sp,
                    lineHeight = 22.sp,
                )
            }
        }

        LazyColumn(
            modifier = Modifier.weight(1f, fill = true),
            contentPadding = PaddingValues(bottom = 8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (messages.isEmpty()) {
                item {
                    EmptyStateCard(
                        title = "No mentor thread yet.",
                        description = "Open with a topic like aptitude, DSA recovery, or system design preparation.",
                    )
                }
            } else {
                items(messages) { item ->
                    MentorMessageCard(message = item)
                }
            }
        }

        Surface(
            shape = RoundedCornerShape(26.dp),
            color = SurfaceBase.copy(alpha = 0.96f),
            tonalElevation = 6.dp,
        ) {
            Column(
                modifier = Modifier.padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                PremiumTextField(
                    value = message,
                    onValueChange = { message = it },
                    label = "Ask Nocturne Mentor",
                    singleLine = false,
                    minLines = 3,
                )
                Button(
                    onClick = {
                        onSend(message.trim())
                        message = ""
                    },
                    enabled = message.isNotBlank(),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(54.dp),
                    shape = RoundedCornerShape(18.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Crimson,
                        contentColor = TextPrimary,
                        disabledContainerColor = SurfaceMuted,
                        disabledContentColor = TextMuted,
                    ),
                ) {
                    Text("Send to mentor", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
private fun MentorMessageCard(message: MentorMessage) {
    val isUser = message.role == "user"

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(if (isUser) 0.8f else 0.92f),
            shape = RoundedCornerShape(
                topStart = 24.dp,
                topEnd = 24.dp,
                bottomEnd = if (isUser) 8.dp else 24.dp,
                bottomStart = if (isUser) 24.dp else 8.dp,
            ),
            color = if (isUser) Crimson.copy(alpha = 0.18f) else SurfaceBase.copy(alpha = 0.95f),
            tonalElevation = 4.dp,
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    text = if (isUser) "You" else "Nocturne Mentor",
                    color = if (isUser) CrimsonSoft else TextSecondary,
                    fontSize = 11.sp,
                    letterSpacing = 1.sp,
                )
                Text(
                    text = message.content,
                    color = TextPrimary,
                    fontSize = 14.sp,
                    lineHeight = 22.sp,
                )
            }
        }
    }
}

@Composable
private fun TaskCard(task: TaskItem, expanded: Boolean = false) {
    Surface(
        shape = RoundedCornerShape(24.dp),
        color = SurfaceBase.copy(alpha = 0.96f),
        tonalElevation = 6.dp,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(
                        text = task.title,
                        color = TextPrimary,
                        fontSize = if (expanded) 19.sp else 17.sp,
                        lineHeight = 24.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = task.category,
                        color = TextSecondary,
                        fontSize = 13.sp,
                    )
                }
                Surface(
                    shape = RoundedCornerShape(999.dp),
                    color = statusColor(task.status).copy(alpha = 0.15f),
                ) {
                    Text(
                        text = task.status.replace('_', ' '),
                        color = statusColor(task.status),
                        fontSize = 11.sp,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                    )
                }
            }

            HorizontalDivider(color = Border)

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                InfoPill(icon = Icons.Outlined.Timelapse, text = formatDurationLabel(task.estimatedMinutes))
                InfoPill(icon = Icons.Outlined.AutoAwesome, text = task.category)
            }
        }
    }
}

@Composable
private fun InfoPill(
    icon: ImageVector,
    text: String,
) {
    Surface(
        shape = RoundedCornerShape(999.dp),
        color = SurfaceMuted,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(icon, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(14.dp))
            Text(text = text, color = TextSecondary, fontSize = 12.sp)
        }
    }
}

@Composable
private fun EmptyStateCard(
    title: String,
    description: String,
) {
    Surface(
        shape = RoundedCornerShape(24.dp),
        color = SurfaceBase.copy(alpha = 0.95f),
        tonalElevation = 5.dp,
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(title, color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Medium)
            Text(description, color = TextSecondary, fontSize = 14.sp, lineHeight = 22.sp)
        }
    }
}

@Composable
private fun SectionHeader(
    title: String,
    subtitle: String,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.SemiBold)
        Text(subtitle, color = TextSecondary, fontSize = 13.sp, lineHeight = 20.sp)
    }
}

@Composable
private fun AccentStrip(text: String) {
    Surface(
        shape = RoundedCornerShape(999.dp),
        color = Crimson.copy(alpha = 0.12f),
    ) {
        Text(
            text = text,
            color = CrimsonSoft,
            fontSize = 11.sp,
            letterSpacing = 1.2.sp,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
        )
    }
}

@Composable
private fun PremiumTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    password: Boolean = false,
    singleLine: Boolean = true,
    minLines: Int = 1,
) {
    TextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label, color = TextSecondary) },
        singleLine = singleLine,
        minLines = minLines,
        visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp)),
        shape = RoundedCornerShape(20.dp),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = SurfaceMuted,
            unfocusedContainerColor = SurfaceMuted,
            disabledContainerColor = SurfaceMuted,
            focusedTextColor = TextPrimary,
            unfocusedTextColor = TextPrimary,
            focusedIndicatorColor = Color.Transparent,
            unfocusedIndicatorColor = Color.Transparent,
            cursorColor = Lavender,
            focusedLabelColor = Lavender,
            unfocusedLabelColor = TextSecondary,
        ),
    )
}

@Composable
private fun PremiumIconAction(
    icon: ImageVector,
    contentDescription: String,
    tint: Color = TextPrimary,
    onClick: () -> Unit,
) {
    Surface(
        shape = CircleShape,
        color = SurfaceMuted,
        tonalElevation = 4.dp,
    ) {
        IconButton(onClick = onClick) {
            Icon(icon, contentDescription = contentDescription, tint = tint)
        }
    }
}

private fun statusColor(status: String): Color =
    when (status.lowercase()) {
        "completed" -> Success
        "in_progress" -> Lavender
        "skipped" -> CrimsonSoft
        else -> TextSecondary
    }

private fun formatDurationLabel(minutes: Int): String {
    if (minutes <= 0) {
        return "Quick block"
    }
    if (minutes < 60) {
        return "$minutes min"
    }

    val hours = minutes / 60.0
    val rounded = if (hours % 1.0 == 0.0) {
        hours.toInt().toString()
    } else {
        String.format("%.1f", hours)
    }
    return "$rounded hrs"
}
