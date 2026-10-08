package dev.placeprep.mobile.ui

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.placeprep.mobile.BuildConfig
import dev.placeprep.mobile.data.*
import dev.placeprep.mobile.notification.PlacePrepNotificationManager

// --- PlacePrep Obsidian Palette ---
private val Background = Color(0xFF07080D)
private val SurfaceBase = Color(0xFF0F121B)
private val SurfaceRaised = Color(0xFF141724)
private val SurfaceMuted = Color(0xFF1C1F2E)
private val Border = Color(0x2EFFFFFF)
private val TextPrimary = Color(0xFFF3F4F6)
private val TextSecondary = Color(0xFF9CA3AF)
private val TextMuted = Color(0xFF64748B)
private val Crimson = Color(0xFFE11D48)
private val CrimsonSoft = Color(0xFFFDA4AF)
private val Lavender = Color(0xFFE0E7FF)
private val Success = Color(0xFF10B981)
private val Amber = Color(0xFFD97706)
private val Cyan = Color(0xFF06B6D4)

private val MobileColorScheme = darkColorScheme(
    primary = Crimson,
    onPrimary = TextPrimary,
    secondary = Lavender,
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
                if (state.isBootstrapping) {
                    LoadingScreen(lang = state.uiLanguage)
                } else if (state.user == null) {
                    when (state.authStage) {
                        AuthStage.Landing -> LandingScreen(
                            lang = state.uiLanguage,
                            onLogin = { viewModel.setAuthStage(AuthStage.Login) },
                            onSignup = { viewModel.setAuthStage(AuthStage.Signup) },
                        )
                        AuthStage.Login -> LoginScreen(
                            lang = state.uiLanguage,
                            isLoading = state.isLoading,
                            errorMessage = state.errorMessage,
                            onLogin = viewModel::login,
                            onBack = { viewModel.setAuthStage(AuthStage.Landing) },
                            onSwitchToSignup = { viewModel.setAuthStage(AuthStage.Signup) },
                        )
                        AuthStage.Signup -> SignupScreen(
                            lang = state.uiLanguage,
                            isLoading = state.isLoading,
                            errorMessage = state.errorMessage,
                            onRegister = viewModel::register,
                            onBack = { viewModel.setAuthStage(AuthStage.Landing) },
                            onSwitchToLogin = { viewModel.setAuthStage(AuthStage.Login) },
                        )
                    }
                } else {
                    WorkspaceScreen(
                        state = state,
                        onRefresh = viewModel::refreshWorkspace,
                        onSwitchTab = viewModel::switchTab,
                        onToggleTask = viewModel::toggleTaskStatus,
                        onCreateTask = viewModel::createTask,
                        onDeleteTask = viewModel::deleteTask,
                        onRequestCoach = viewModel::requestCoachHelp,
                        onSubmitReview = viewModel::evaluateDaily,
                        onGeneratePlan = viewModel::generatePrepPlan,
                        onEngagePowerPocket = viewModel::engagePowerPocket,
                        onEndPowerPocket = viewModel::endPowerPocket,
                        onSendMentorMessage = viewModel::sendMentorMessage,
                        onClearMentorHistory = viewModel::clearMentorHistory,
                        onResolveProblem = viewModel::resolveCodingProblem,
                        onSendTestNotification = viewModel::sendTestNotification,
                        onToggleNotification = viewModel::toggleNotificationPreference,
                        onSetLanguage = viewModel::setLanguage,
                        onLogout = viewModel::logout,
                        onClearInfo = viewModel::clearInfoMessage,
                        onClearError = viewModel::clearErrorMessage,
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
                        Color(0xFF0F0B12),
                        Background,
                        Color(0xFF0A0C13),
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
                            Crimson.copy(alpha = 0.08f),
                            Color.Transparent,
                        )
                    )
                )
        )
        content()
    }
}

@Composable
private fun LoadingScreen(lang: String) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = SurfaceBase.copy(alpha = 0.95f),
            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 32.dp, vertical = 28.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                CircularProgressIndicator(color = Crimson, strokeWidth = 3.dp)
                Text(
                    MobileStrings.get("app_title", lang),
                    color = TextPrimary,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    MobileStrings.get("tagline", lang),
                    color = TextSecondary,
                    fontSize = 13.sp,
                )
            }
        }
    }
}

@Composable
private fun LandingScreen(
    lang: String,
    onLogin: () -> Unit,
    onSignup: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 28.dp)
            .statusBarsPadding()
            .navigationBarsPadding()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.Center,
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(32.dp),
            color = SurfaceBase.copy(alpha = 0.96f),
            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 32.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(Crimson.copy(alpha = 0.15f))
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(Crimson))
                    Text("PlacePrep Mobile • Production", color = CrimsonSoft, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }

                Text(
                    text = MobileStrings.get("tagline", lang),
                    color = TextPrimary,
                    fontSize = 32.sp,
                    lineHeight = 38.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = "High-velocity technical interview execution for software engineers. Command chamber, curated DSA tasks, Prep Architect, and Nocturne AI Coach.",
                    color = TextSecondary,
                    fontSize = 14.sp,
                    lineHeight = 22.sp,
                )

                Spacer(modifier = Modifier.height(8.dp))

                Button(
                    onClick = onLogin,
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Crimson, contentColor = TextPrimary),
                ) {
                    Text(MobileStrings.get("sign_in", lang), fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }

                OutlinedButton(
                    onClick = onSignup,
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(16.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Border),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = TextPrimary),
                ) {
                    Text(MobileStrings.get("create_account", lang), fontWeight = FontWeight.Medium, fontSize = 15.sp)
                }
            }
        }
    }
}

@Composable
private fun LoginScreen(
    lang: String,
    isLoading: Boolean,
    errorMessage: String?,
    onLogin: (String, String) -> Unit,
    onBack: () -> Unit,
    onSwitchToSignup: () -> Unit,
) {
    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 28.dp)
            .statusBarsPadding()
            .navigationBarsPadding()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.Center,
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(32.dp),
            color = SurfaceBase.copy(alpha = 0.96f),
            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 28.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text("PlacePrep", color = TextSecondary, letterSpacing = 3.sp, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                Text(MobileStrings.get("sign_in", lang), color = TextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Bold)

                if (!errorMessage.isNullOrBlank()) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Crimson.copy(alpha = 0.15f),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Crimson.copy(alpha = 0.3f)),
                    ) {
                        Text(
                            text = errorMessage,
                            color = CrimsonSoft,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(12.dp),
                        )
                    }
                }

                OutlinedTextField(
                    value = identifier,
                    onValueChange = { identifier = it },
                    label = { Text("Email or Username") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        focusedBorderColor = Crimson,
                        unfocusedBorderColor = Border,
                    ),
                    singleLine = true,
                )

                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    modifier = Modifier.fillMaxWidth(),
                    visualTransformation = PasswordVisualTransformation(),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        focusedBorderColor = Crimson,
                        unfocusedBorderColor = Border,
                    ),
                    singleLine = true,
                )

                Button(
                    onClick = { onLogin(identifier, password) },
                    enabled = !isLoading && identifier.isNotBlank() && password.isNotBlank(),
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Crimson, contentColor = TextPrimary),
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), color = TextPrimary, strokeWidth = 2.dp)
                    } else {
                        Text(MobileStrings.get("sign_in", lang), fontWeight = FontWeight.Bold)
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    TextButton(onClick = onBack) {
                        Text("Back", color = TextSecondary)
                    }
                    TextButton(onClick = onSwitchToSignup) {
                        Text("Create Account", color = Lavender)
                    }
                }
            }
        }
    }
}

@Composable
private fun SignupScreen(
    lang: String,
    isLoading: Boolean,
    errorMessage: String?,
    onRegister: (String, String, String, String, String) -> Unit,
    onBack: () -> Unit,
    onSwitchToLogin: () -> Unit,
) {
    var name by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var inviteCode by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 28.dp)
            .statusBarsPadding()
            .navigationBarsPadding()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.Center,
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(32.dp),
            color = SurfaceBase.copy(alpha = 0.96f),
            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 28.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Text("PlacePrep", color = TextSecondary, letterSpacing = 3.sp, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                Text(MobileStrings.get("create_account", lang), color = TextPrimary, fontSize = 26.sp, fontWeight = FontWeight.Bold)

                if (!errorMessage.isNullOrBlank()) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Crimson.copy(alpha = 0.15f),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Crimson.copy(alpha = 0.3f)),
                    ) {
                        Text(errorMessage, color = CrimsonSoft, fontSize = 13.sp, modifier = Modifier.padding(12.dp))
                    }
                }

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Full Name") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Crimson, unfocusedBorderColor = Border),
                )

                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text("Username") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Crimson, unfocusedBorderColor = Border),
                )

                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email Address") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Crimson, unfocusedBorderColor = Border),
                )

                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    modifier = Modifier.fillMaxWidth(),
                    visualTransformation = PasswordVisualTransformation(),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Crimson, unfocusedBorderColor = Border),
                )

                OutlinedTextField(
                    value = inviteCode,
                    onValueChange = { inviteCode = it },
                    label = { Text("Invite Code") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Crimson, unfocusedBorderColor = Border),
                )

                Button(
                    onClick = { onRegister(name, username, email, password, inviteCode) },
                    enabled = !isLoading && name.isNotBlank() && email.isNotBlank() && password.isNotBlank(),
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Crimson, contentColor = TextPrimary),
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), color = TextPrimary, strokeWidth = 2.dp)
                    } else {
                        Text(MobileStrings.get("create_account", lang), fontWeight = FontWeight.Bold)
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    TextButton(onClick = onBack) { Text("Back", color = TextSecondary) }
                    TextButton(onClick = onSwitchToLogin) { Text("Existing Account", color = Lavender) }
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
    onSwitchTab: (MobileTab) -> Unit,
    onToggleTask: (TaskItem) -> Unit,
    onCreateTask: (String, String?, String, String, Int, String) -> Unit,
    onDeleteTask: (String) -> Unit,
    onRequestCoach: (String, String?, String?) -> Unit,
    onSubmitReview: (String?, Int) -> Unit,
    onGeneratePlan: () -> Unit,
    onEngagePowerPocket: () -> Unit,
    onEndPowerPocket: () -> Unit,
    onSendMentorMessage: (String) -> Unit,
    onClearMentorHistory: () -> Unit,
    onResolveProblem: (String) -> Unit,
    onSendTestNotification: () -> Unit,
    onToggleNotification: (String, Boolean) -> Unit,
    onSetLanguage: (String) -> Unit,
    onLogout: () -> Unit,
    onClearInfo: () -> Unit,
    onClearError: () -> Unit,
) {
    var drawerOpen by remember { mutableStateOf(false) }
    val lang = state.uiLanguage

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = SurfaceBase.copy(alpha = 0.94f),
                    shape = RoundedCornerShape(22.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Border),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            IconButton(onClick = { drawerOpen = true }) {
                                Icon(Icons.Outlined.Menu, contentDescription = "Menu", tint = TextPrimary)
                            }
                            Column {
                                Text("PlacePrep", color = TextSecondary, fontSize = 10.sp, letterSpacing = 2.sp, fontWeight = FontWeight.SemiBold)
                                Text(
                                    text = state.user?.name ?: "Student",
                                    color = TextPrimary,
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                        }

                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            // Streak badge
                            Surface(
                                shape = RoundedCornerShape(999.dp),
                                color = Amber.copy(alpha = 0.15f),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Amber.copy(alpha = 0.35f)),
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                ) {
                                    Text("🔥", fontSize = 12.sp)
                                    Text("${state.progress?.streak ?: 0}d", color = Amber, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                            }

                            IconButton(onClick = onRefresh) {
                                Icon(Icons.Outlined.Refresh, contentDescription = "Refresh", tint = TextSecondary)
                            }
                        }
                    }
                }

                // Offline Notice Banner
                if (state.isOffline) {
                    Surface(
                        modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                        color = Amber.copy(alpha = 0.2f),
                        shape = RoundedCornerShape(12.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Amber.copy(alpha = 0.4f)),
                    ) {
                        Text(
                            text = MobileStrings.get("offline_notice", lang),
                            color = Amber,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        )
                    }
                }

                // Temporary info message toast
                if (!state.infoMessage.isNullOrBlank()) {
                    Surface(
                        modifier = Modifier.fillMaxWidth().padding(top = 6.dp).clickable(onClick = onClearInfo),
                        color = Success.copy(alpha = 0.2f),
                        shape = RoundedCornerShape(12.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Success.copy(alpha = 0.4f)),
                    ) {
                        Text(state.infoMessage, color = Success, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp))
                    }
                }

                // Temporary error message toast
                if (!state.errorMessage.isNullOrBlank()) {
                    Surface(
                        modifier = Modifier.fillMaxWidth().padding(top = 6.dp).clickable(onClick = onClearError),
                        color = Crimson.copy(alpha = 0.2f),
                        shape = RoundedCornerShape(12.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Crimson.copy(alpha = 0.4f)),
                    ) {
                        Text(state.errorMessage, color = CrimsonSoft, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp))
                    }
                }
            }
        },
        bottomBar = {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                color = SurfaceBase.copy(alpha = 0.98f),
                shape = RoundedCornerShape(26.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Border),
                tonalElevation = 8.dp,
            ) {
                NavigationBar(
                    containerColor = Color.Transparent,
                    tonalElevation = 0.dp,
                ) {
                    listOf(
                        MobileTab.Dashboard to Icons.Outlined.Bolt,
                        MobileTab.Tasks to Icons.AutoMirrored.Outlined.ListAlt,
                        MobileTab.Architect to Icons.Outlined.AccountTree,
                        MobileTab.Mentor to Icons.Outlined.ChatBubbleOutline,
                    ).forEach { (tab, icon) ->
                        val label = when (tab) {
                            MobileTab.Dashboard -> MobileStrings.get("chamber", lang)
                            MobileTab.Tasks -> MobileStrings.get("tasks", lang)
                            MobileTab.Architect -> MobileStrings.get("architect", lang)
                            MobileTab.Mentor -> MobileStrings.get("mentor", lang)
                            else -> ""
                        }
                        NavigationBarItem(
                            selected = state.currentTab == tab,
                            onClick = { onSwitchTab(tab) },
                            icon = { Icon(icon, contentDescription = label) },
                            label = { Text(label, fontSize = 11.sp, fontWeight = if (state.currentTab == tab) FontWeight.Bold else FontWeight.Normal) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = TextPrimary,
                                selectedTextColor = Crimson,
                                indicatorColor = Crimson.copy(alpha = 0.25f),
                                unselectedIconColor = TextMuted,
                                unselectedTextColor = TextMuted,
                            ),
                        )
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
            Crossfade(targetState = state.currentTab, label = "mobile_tab_transition") { tab ->
                when (tab) {
                    MobileTab.Dashboard -> DashboardTab(
                        state = state,
                        lang = lang,
                        onToggleTask = onToggleTask,
                        onRequestCoach = onRequestCoach,
                        onSubmitReview = onSubmitReview,
                        onEngagePowerPocket = onEngagePowerPocket,
                        onEndPowerPocket = onEndPowerPocket,
                        onNavigateTasks = { onSwitchTab(MobileTab.Tasks) },
                    )
                    MobileTab.Tasks -> TasksTab(
                        tasks = state.tasks,
                        lang = lang,
                        onToggleTask = onToggleTask,
                        onCreateTask = onCreateTask,
                        onDeleteTask = onDeleteTask,
                        onLaunchCoach = { topic ->
                            onRequestCoach(topic, topic, "Need hints and approach")
                            onSwitchTab(MobileTab.Dashboard)
                        },
                    )
                    MobileTab.Architect -> ArchitectTab(
                        plan = state.prepPlan,
                        lang = lang,
                        onGeneratePlan = onGeneratePlan,
                    )
                    MobileTab.Assessments -> AssessmentsTab(
                        overview = state.assessmentsOverview,
                        lang = lang,
                    )
                    MobileTab.CodingLab -> CodingLabTab(
                        selectedProblem = state.selectedCodingProblem,
                        lang = lang,
                        onResolveProblem = onResolveProblem,
                    )
                    MobileTab.Progress -> ProgressTab(
                        progress = state.progress,
                        user = state.user,
                        lang = lang,
                    )
                    MobileTab.Mentor -> MentorTab(
                        messages = state.mentorHistory,
                        lang = lang,
                        onSend = onSendMentorMessage,
                        onClear = onClearMentorHistory,
                    )
                    MobileTab.Settings -> SettingsTab(
                        user = state.user,
                        profile = state.userProfile,
                        lang = lang,
                        onSendTestNotification = onSendTestNotification,
                        onToggleNotification = onToggleNotification,
                        onSetLanguage = onSetLanguage,
                        onLogout = onLogout,
                    )
                }
            }

            // Universal 8-Domain Command Drawer
            OverlayCommandDrawer(
                isVisible = drawerOpen,
                user = state.user,
                currentTab = state.currentTab,
                lang = lang,
                onDismiss = { drawerOpen = false },
                onSelectTab = { tab ->
                    drawerOpen = false
                    onSwitchTab(tab)
                },
            )
        }
    }
}

@Composable
private fun OverlayCommandDrawer(
    isVisible: Boolean,
    user: MobileUser?,
    currentTab: MobileTab,
    lang: String,
    onDismiss: () -> Unit,
    onSelectTab: (MobileTab) -> Unit,
) {
    AnimatedVisibility(
        visible = isVisible,
        enter = fadeIn(tween(200)) + slideInHorizontally(tween(220), initialOffsetX = { -it / 2 }),
        exit = fadeOut(tween(180)) + slideOutHorizontally(tween(200), targetOffsetX = { -it / 2 }),
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xD907080D))
                    .clickable(onClick = onDismiss)
            )

            Surface(
                modifier = Modifier
                    .fillMaxHeight()
                    .width(300.dp)
                    .statusBarsPadding()
                    .navigationBarsPadding()
                    .padding(12.dp),
                shape = RoundedCornerShape(28.dp),
                color = SurfaceBase,
                border = androidx.compose.foundation.BorderStroke(1.dp, Border),
                tonalElevation = 12.dp,
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(18.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    // Header
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(Crimson),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("P", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        }
                        Column {
                            Text(user?.name ?: "PlacePrep", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                            Text(user?.targetRole ?: "Software Engineer Track", color = TextSecondary, fontSize = 11.sp)
                        }
                    }

                    HorizontalDivider(color = Border)

                    Text("WORKSPACE DOMAINS", color = TextMuted, fontSize = 10.sp, letterSpacing = 2.sp, fontWeight = FontWeight.Bold)

                    listOf(
                        Triple(MobileTab.Dashboard, Icons.Outlined.Bolt, MobileStrings.get("command_chamber", lang)),
                        Triple(MobileTab.Tasks, Icons.AutoMirrored.Outlined.ListAlt, MobileStrings.get("tasks", lang)),
                        Triple(MobileTab.Architect, Icons.Outlined.AccountTree, MobileStrings.get("architect", lang)),
                        Triple(MobileTab.Assessments, Icons.Outlined.Science, MobileStrings.get("assessments", lang)),
                        Triple(MobileTab.CodingLab, Icons.Outlined.Code, MobileStrings.get("coding", lang)),
                        Triple(MobileTab.Progress, Icons.Outlined.BarChart, MobileStrings.get("progress", lang)),
                        Triple(MobileTab.Mentor, Icons.Outlined.ChatBubbleOutline, MobileStrings.get("mentor", lang)),
                        Triple(MobileTab.Settings, Icons.Outlined.Settings, MobileStrings.get("settings", lang)),
                    ).forEach { (tab, icon, label) ->
                        val isSelected = currentTab == tab
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onSelectTab(tab) },
                            shape = RoundedCornerShape(14.dp),
                            color = if (isSelected) Crimson.copy(alpha = 0.15f) else Color.Transparent,
                            border = if (isSelected) androidx.compose.foundation.BorderStroke(1.dp, Crimson.copy(alpha = 0.35f)) else null,
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(icon, contentDescription = null, tint = if (isSelected) Crimson else TextSecondary, modifier = Modifier.size(20.dp))
                                Text(label, color = if (isSelected) TextPrimary else TextSecondary, fontSize = 14.sp, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal)
                            }
                        }
                    }
                }
            }
        }
    }
}

// ==============================================================================
// 1. COMMAND CHAMBER TAB (7-LEVEL HIERARCHY)
// ==============================================================================
@Composable
private fun DashboardTab(
    state: PlacePrepUiState,
    lang: String,
    onToggleTask: (TaskItem) -> Unit,
    onRequestCoach: (String, String?, String?) -> Unit,
    onSubmitReview: (String?, Int) -> Unit,
    onEngagePowerPocket: () -> Unit,
    onEndPowerPocket: () -> Unit,
    onNavigateTasks: () -> Unit,
) {
    var coachTopic by remember { mutableStateOf("") }
    var coachBlocked by remember { mutableStateOf("") }
    var reviewNotes by remember { mutableStateOf("") }
    var reviewScore by remember { mutableStateOf(8) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // --- 1. Today Header ---
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(22.dp),
            color = SurfaceBase,
            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(MobileStrings.get("today_work", lang), color = TextMuted, fontSize = 11.sp, letterSpacing = 1.sp, fontWeight = FontWeight.Bold)
                    Text("Daily Sprint Focus", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                }
                Surface(
                    shape = RoundedCornerShape(999.dp),
                    color = Crimson.copy(alpha = 0.15f),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Crimson.copy(alpha = 0.35f)),
                ) {
                    Text(
                        text = state.user?.targetRole ?: "Tech Track",
                        color = CrimsonSoft,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    )
                }
            }
        }

        // --- 2. Compact 4-Metric Execution Ribbon ---
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            val progress = state.progress
            MetricTile(
                modifier = Modifier.weight(1f),
                label = MobileStrings.get("tasks_completed", lang),
                value = "${progress?.missionsCompleted ?: 0}",
                color = Success,
            )
            MetricTile(
                modifier = Modifier.weight(1f),
                label = MobileStrings.get("minutes_invested", lang),
                value = "${((progress?.totalHoursLogged ?: 0.0) * 60).toInt()}m",
                color = Cyan,
            )
            MetricTile(
                modifier = Modifier.weight(1f),
                label = MobileStrings.get("readiness_score", lang),
                value = "${(progress?.readinessScore ?: 0.0).toInt()}%",
                color = Lavender,
            )
            MetricTile(
                modifier = Modifier.weight(1f),
                label = MobileStrings.get("streak_days", lang),
                value = "${progress?.streak ?: 0}d",
                color = Amber,
            )
        }

        // --- 3. Next Best Action / Power Pocket ---
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(22.dp),
            color = SurfaceRaised,
            border = androidx.compose.foundation.BorderStroke(1.dp, Crimson.copy(alpha = 0.35f)),
        ) {
            Column(
                modifier = Modifier.padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("⚡", fontSize = 14.sp)
                        Text(MobileStrings.get("next_best_action", lang), color = CrimsonSoft, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    if (state.activePowerPocket != null) {
                        Text("Active Sprint", color = Amber, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }

                val topTask = state.todayTasks.firstOrNull { it.status.equals("pending", ignoreCase = true) }
                Text(
                    text = state.activePowerPocket?.title ?: topTask?.title ?: "Review Dynamic Programming Patterns",
                    color = TextPrimary,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "30-min focused interview sprint",
                        color = TextSecondary,
                        fontSize = 12.sp,
                    )
                    Button(
                        onClick = {
                            if (state.activePowerPocket != null) onEndPowerPocket() else onEngagePowerPocket()
                        },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (state.activePowerPocket != null) Amber else Crimson,
                            contentColor = TextPrimary,
                        ),
                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                    ) {
                        Text(if (state.activePowerPocket != null) "Complete Sprint" else "Start Sprint", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // --- 4. Today's Tasks (Content-Adaptive) ---
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(22.dp),
            color = SurfaceBase,
            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(MobileStrings.get("tasks", lang), color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    TextButton(onClick = onNavigateTasks) {
                        Text("View All", color = Lavender, fontSize = 12.sp)
                    }
                }

                if (state.todayTasks.isEmpty()) {
                    Text(
                        text = MobileStrings.get("empty_tasks", lang),
                        color = TextSecondary,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(vertical = 12.dp),
                    )
                } else {
                    state.todayTasks.take(4).forEach { task ->
                        TaskRow(
                            task = task,
                            onToggle = { onToggleTask(task) },
                            onCoach = {
                                coachTopic = task.title
                                coachBlocked = "Need hints for this task"
                                onRequestCoach(task.title, task.title, "Need hints for this task")
                            },
                        )
                    }
                }
            }
        }

        // --- 5. Coach Me Through It Console ---
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(22.dp),
            color = SurfaceBase,
            border = androidx.compose.foundation.BorderStroke(1.dp, Lavender.copy(alpha = 0.25f)),
        ) {
            Column(
                modifier = Modifier.padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("💡", fontSize = 16.sp)
                    Text(MobileStrings.get("coach_me_through_it", lang), color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }

                OutlinedTextField(
                    value = coachTopic,
                    onValueChange = { coachTopic = it },
                    label = { Text(MobileStrings.get("topic_label", lang)) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Crimson, unfocusedBorderColor = Border),
                    singleLine = true,
                )

                OutlinedTextField(
                    value = coachBlocked,
                    onValueChange = { coachBlocked = it },
                    label = { Text(MobileStrings.get("blocked_label", lang)) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Crimson, unfocusedBorderColor = Border),
                    maxLines = 3,
                )

                Button(
                    onClick = { onRequestCoach(coachTopic, coachTopic, coachBlocked) },
                    enabled = !state.isCoachLoading && coachTopic.isNotBlank(),
                    modifier = Modifier.fillMaxWidth().height(46.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Crimson, contentColor = TextPrimary),
                ) {
                    if (state.isCoachLoading) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), color = TextPrimary, strokeWidth = 2.dp)
                    } else {
                        Text(MobileStrings.get("unblock_now", lang), fontWeight = FontWeight.Bold)
                    }
                }

                // Render Coach Output Cards
                state.coachHelp?.let { help ->
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        // Hint Card
                        help.hint?.takeIf { it.isNotBlank() }?.let { hintText ->
                            CoachCard(
                                title = MobileStrings.get("hint_label", lang),
                                content = hintText,
                                accent = Amber,
                            )
                        }

                        // Approach Steps
                        if (help.approachSteps.isNotEmpty()) {
                            Surface(
                                shape = RoundedCornerShape(14.dp),
                                color = SurfaceRaised,
                                border = androidx.compose.foundation.BorderStroke(1.dp, Border),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text(MobileStrings.get("approach_label", lang), color = Cyan, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    help.approachSteps.forEachIndexed { idx, step ->
                                        Text("${idx + 1}. $step", color = TextPrimary, fontSize = 13.sp, lineHeight = 18.sp)
                                    }
                                }
                            }
                        }

                        // Search Keywords
                        if (help.youtubeSearchKeywords.isNotEmpty()) {
                            Surface(
                                shape = RoundedCornerShape(14.dp),
                                color = SurfaceRaised,
                                border = androidx.compose.foundation.BorderStroke(1.dp, Border),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text(MobileStrings.get("search_keywords", lang), color = Lavender, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    Text(help.youtubeSearchKeywords.joinToString(" • "), color = TextSecondary, fontSize = 12.sp)
                                }
                            }
                        }
                    }
                }
            }
        }

        // --- 6. Daily Review & Reflection ---
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(22.dp),
            color = SurfaceBase,
            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
        ) {
            Column(
                modifier = Modifier.padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(MobileStrings.get("evaluate_performance", lang), color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)

                OutlinedTextField(
                    value = reviewNotes,
                    onValueChange = { reviewNotes = it },
                    label = { Text(MobileStrings.get("reflections_label", lang)) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Crimson, unfocusedBorderColor = Border),
                    maxLines = 2,
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("${MobileStrings.get("focus_score", lang)}: $reviewScore/10", color = TextSecondary, fontSize = 13.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        listOf(6, 8, 10).forEach { sc ->
                            FilterChip(
                                selected = reviewScore == sc,
                                onClick = { reviewScore = sc },
                                label = { Text("$sc") },
                            )
                        }
                    }
                }

                Button(
                    onClick = { onSubmitReview(reviewNotes, reviewScore) },
                    enabled = !state.isEvaluating,
                    modifier = Modifier.fillMaxWidth().height(46.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = SurfaceRaised, contentColor = TextPrimary),
                ) {
                    if (state.isEvaluating) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), color = TextPrimary, strokeWidth = 2.dp)
                    } else {
                        Text(MobileStrings.get("submit_review", lang), fontWeight = FontWeight.Bold)
                    }
                }

                state.dailyEvaluation?.let { eval ->
                    Surface(
                        modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                        shape = RoundedCornerShape(14.dp),
                        color = Success.copy(alpha = 0.12f),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Success.copy(alpha = 0.3f)),
                    ) {
                        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Score: ${eval.score}% • ${eval.verdict}", color = Success, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            if (eval.evaluation.isNotBlank()) {
                                Text(eval.evaluation, color = TextPrimary, fontSize = 12.sp, lineHeight = 16.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MetricTile(
    modifier: Modifier = Modifier,
    label: String,
    value: String,
    color: Color,
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        color = SurfaceBase,
        border = androidx.compose.foundation.BorderStroke(1.dp, Border),
    ) {
        Column(
            modifier = Modifier.padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(label, color = TextMuted, fontSize = 9.sp, maxLines = 1)
            Text(value, color = color, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun TaskRow(
    task: TaskItem,
    onToggle: () -> Unit,
    onCoach: () -> Unit,
) {
    val isDone = task.status.equals("completed", ignoreCase = true)
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = SurfaceRaised,
        border = androidx.compose.foundation.BorderStroke(1.dp, if (isDone) Success.copy(alpha = 0.3f) else Border),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Checkbox(
                    checked = isDone,
                    onCheckedChange = { onToggle() },
                    colors = CheckboxDefaults.colors(checkedColor = Success, uncheckedColor = TextMuted),
                )
                Column {
                    Text(
                        text = task.title,
                        color = if (isDone) TextMuted else TextPrimary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 2.dp)) {
                        Text(task.category.uppercase(), color = CrimsonSoft, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        Text("•", color = TextMuted, fontSize = 10.sp)
                        Text("${task.estimatedMinutes}m", color = TextSecondary, fontSize = 10.sp)
                    }
                }
            }

            IconButton(onClick = onCoach, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Outlined.Lightbulb, contentDescription = "Coach", tint = Amber, modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
private fun CoachCard(
    title: String,
    content: String,
    accent: Color,
) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = SurfaceRaised,
        border = androidx.compose.foundation.BorderStroke(1.dp, Border),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, color = accent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            Text(content, color = TextPrimary, fontSize = 13.sp, lineHeight = 19.sp)
        }
    }
}

// ==============================================================================
// 2. TASKS TAB (CRUD + FILTERING)
// ==============================================================================
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TasksTab(
    tasks: List<TaskItem>,
    lang: String,
    onToggleTask: (TaskItem) -> Unit,
    onCreateTask: (String, String?, String, String, Int, String) -> Unit,
    onDeleteTask: (String) -> Unit,
    onLaunchCoach: (String) -> Unit,
) {
    var filter by remember { mutableStateOf("all") }
    var showCreateSheet by remember { mutableStateOf(false) }

    var newTitle by remember { mutableStateOf("") }
    var newCategory by remember { mutableStateOf("dsa") }
    var newMinutes by remember { mutableStateOf("30") }
    var newPriority by remember { mutableStateOf("medium") }

    val filteredTasks = remember(tasks, filter) {
        when (filter) {
            "pending" -> tasks.filter { it.status.equals("pending", ignoreCase = true) }
            "completed" -> tasks.filter { it.status.equals("completed", ignoreCase = true) }
            "dsa" -> tasks.filter { it.category.equals("dsa", ignoreCase = true) }
            "sys" -> tasks.filter { it.category.contains("system", ignoreCase = true) }
            else -> tasks
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // Filter Ribbon
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                listOf(
                    "all" to MobileStrings.get("all", lang),
                    "pending" to MobileStrings.get("pending", lang),
                    "completed" to MobileStrings.get("completed", lang),
                    "dsa" to "DSA",
                ).forEach { (key, label) ->
                    FilterChip(
                        selected = filter == key,
                        onClick = { filter = key },
                        label = { Text(label, fontSize = 12.sp) },
                    )
                }
            }

            if (filteredTasks.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize().padding(top = 60.dp), contentAlignment = Alignment.Center) {
                    Text(MobileStrings.get("empty_tasks", lang), color = TextSecondary, fontSize = 14.sp)
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    contentPadding = PaddingValues(bottom = 80.dp),
                ) {
                    items(filteredTasks, key = { it.id }) { task ->
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = SurfaceBase,
                            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Row(
                                        modifier = Modifier.weight(1f),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        Checkbox(
                                            checked = task.status.equals("completed", ignoreCase = true),
                                            onCheckedChange = { onToggleTask(task) },
                                            colors = CheckboxDefaults.colors(checkedColor = Success, uncheckedColor = TextMuted),
                                        )
                                        Text(
                                            task.title,
                                            color = if (task.status.equals("completed", ignoreCase = true)) TextMuted else TextPrimary,
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.SemiBold,
                                        )
                                    }

                                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                        IconButton(onClick = { onLaunchCoach(task.title) }, modifier = Modifier.size(30.dp)) {
                                            Icon(Icons.Outlined.Lightbulb, contentDescription = "Coach", tint = Amber, modifier = Modifier.size(18.dp))
                                        }
                                        IconButton(onClick = { onDeleteTask(task.id) }, modifier = Modifier.size(30.dp)) {
                                            Icon(Icons.Outlined.Delete, contentDescription = "Delete", tint = TextMuted, modifier = Modifier.size(18.dp))
                                        }
                                    }
                                }

                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Surface(shape = RoundedCornerShape(6.dp), color = Crimson.copy(alpha = 0.15f)) {
                                        Text(task.category.uppercase(), color = CrimsonSoft, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                                    }
                                    Surface(shape = RoundedCornerShape(6.dp), color = SurfaceRaised) {
                                        Text("${task.estimatedMinutes} mins", color = TextSecondary, fontSize = 10.sp, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                                    }
                                    Surface(shape = RoundedCornerShape(6.dp), color = SurfaceRaised) {
                                        Text(task.priority.uppercase(), color = Amber, fontSize = 10.sp, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Add Task Floating Action Button
        FloatingActionButton(
            onClick = { showCreateSheet = true },
            modifier = Modifier.align(Alignment.BottomEnd).padding(end = 16.dp, bottom = 16.dp),
            containerColor = Crimson,
            contentColor = TextPrimary,
        ) {
            Icon(Icons.Outlined.Add, contentDescription = "Add Task")
        }

        // Create Task Dialog / Sheet
        if (showCreateSheet) {
            AlertDialog(
                onDismissRequest = { showCreateSheet = false },
                title = { Text(MobileStrings.get("create_task", lang), color = TextPrimary) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(
                            value = newTitle,
                            onValueChange = { newTitle = it },
                            label = { Text(MobileStrings.get("task_title", lang)) },
                            modifier = Modifier.fillMaxWidth(),
                        )
                        OutlinedTextField(
                            value = newMinutes,
                            onValueChange = { newMinutes = it },
                            label = { Text(MobileStrings.get("estimated_minutes", lang)) },
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("dsa", "system_design", "core_cs").forEach { cat ->
                                FilterChip(
                                    selected = newCategory == cat,
                                    onClick = { newCategory = cat },
                                    label = { Text(cat.uppercase(), fontSize = 10.sp) },
                                )
                            }
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (newTitle.isNotBlank()) {
                                val mins = newMinutes.toIntOrNull() ?: 30
                                onCreateTask(newTitle, null, newCategory, newPriority, mins, "medium")
                                newTitle = ""
                                showCreateSheet = false
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Crimson),
                    ) {
                        Text(MobileStrings.get("save", lang))
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showCreateSheet = false }) {
                        Text(MobileStrings.get("cancel", lang), color = TextSecondary)
                    }
                },
                containerColor = SurfaceBase,
            )
        }
    }
}

// ==============================================================================
// 3. PREP ARCHITECT TAB
// ==============================================================================
@Composable
private fun ArchitectTab(
    plan: PrepPlan?,
    lang: String,
    onGeneratePlan: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(22.dp),
            color = SurfaceBase,
            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
        ) {
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(MobileStrings.get("architect", lang), color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text(
                    text = "Structured multi-week technical preparation plan calibrated to your placement timeline.",
                    color = TextSecondary,
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                )
                Button(
                    onClick = onGeneratePlan,
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Crimson, contentColor = TextPrimary),
                ) {
                    Text(MobileStrings.get("generate_plan", lang), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
            }
        }

        if (plan == null) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                color = SurfaceBase,
                border = androidx.compose.foundation.BorderStroke(1.dp, Border),
            ) {
                Text("No preparation plan generated yet. Tap generate to create your plan.", color = TextSecondary, modifier = Modifier.padding(20.dp))
            }
        } else {
            Text(MobileStrings.get("roadmap_weeks", lang), color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)

            plan.roadmap.forEach { week ->
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    color = SurfaceBase,
                    border = androidx.compose.foundation.BorderStroke(1.dp, Border),
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Week ${week.week}: ${week.title}", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            Text("${week.estimatedHours} hrs", color = Cyan, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                        Text(week.focusTopics.joinToString(" • "), color = TextSecondary, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

// ==============================================================================
// 4. ASSESSMENTS TAB
// ==============================================================================
@Composable
private fun AssessmentsTab(
    overview: AssessmentOverview?,
    lang: String,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(22.dp),
            color = SurfaceBase,
            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
        ) {
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(MobileStrings.get("assessments", lang), color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text("Diagnostic benchmarks across DSA, System Design, and CS Fundamentals.", color = TextSecondary, fontSize = 13.sp)
            }
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            MetricTile(
                modifier = Modifier.weight(1f),
                label = "Average Score",
                value = "${(overview?.averageScore ?: 0.0).toInt()}%",
                color = Success,
            )
            MetricTile(
                modifier = Modifier.weight(1f),
                label = "Completed",
                value = "${overview?.totalCompleted ?: 0}",
                color = Cyan,
            )
            MetricTile(
                modifier = Modifier.weight(1f),
                label = "Readiness Target",
                value = "${(overview?.targetReadiness ?: 85.0).toInt()}%",
                color = Lavender,
            )
        }

        Text("Core Domains", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)

        listOf(
            "Data Structures & Algorithms" to "82% Readiness",
            "System Architecture & Scaling" to "68% Readiness",
            "Core CS (OS, DBMS, Networks)" to "74% Readiness",
            "Behavioral & Leadership Principles" to "90% Readiness",
        ).forEach { (domain, score) ->
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                color = SurfaceBase,
                border = androidx.compose.foundation.BorderStroke(1.dp, Border),
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(domain, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                    Text(score, color = Amber, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

// ==============================================================================
// 5. CODING LAB TAB
// ==============================================================================
@Composable
private fun CodingLabTab(
    selectedProblem: CodingProblemSummary?,
    lang: String,
    onResolveProblem: (String) -> Unit,
) {
    var searchQuery by remember { mutableStateOf("Two Sum") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(22.dp),
            color = SurfaceBase,
            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
        ) {
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(MobileStrings.get("coding", lang), color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text("Search over 4,000+ indexed LeetCode practice problems.", color = TextSecondary, fontSize = 13.sp)

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true,
                        placeholder = { Text(MobileStrings.get("search_problems", lang)) },
                    )
                    Button(
                        onClick = { onResolveProblem(searchQuery) },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Crimson),
                    ) {
                        Text("Search")
                    }
                }
            }
        }

        selectedProblem?.let { problem ->
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                color = SurfaceBase,
                border = androidx.compose.foundation.BorderStroke(1.dp, Border),
            ) {
                Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(problem.title, color = TextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                        Text(problem.difficulty.uppercase(), color = if (problem.difficulty.equals("easy", true)) Success else Amber, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    Text("Category: ${problem.category.uppercase()}", color = TextSecondary, fontSize = 12.sp)
                    if (!problem.description.isNullOrBlank()) {
                        HorizontalDivider(color = Border)
                        Text(problem.description, color = TextPrimary, fontSize = 13.sp, lineHeight = 19.sp)
                    }
                }
            }
        }
    }
}

// ==============================================================================
// 6. PROGRESS TAB
// ==============================================================================
@Composable
private fun ProgressTab(
    progress: ProgressSummary?,
    user: MobileUser?,
    lang: String,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(22.dp),
            color = SurfaceBase,
            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
        ) {
            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(MobileStrings.get("readiness_score", lang), color = TextSecondary, fontSize = 13.sp)
                Text("${(progress?.readinessScore ?: 0.0).toInt()}%", color = Crimson, fontSize = 48.sp, fontWeight = FontWeight.Bold)
                Text(user?.targetRole ?: "Software Engineer Track", color = Lavender, fontSize = 13.sp, fontWeight = FontWeight.Medium)
            }
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            MetricTile(
                modifier = Modifier.weight(1f),
                label = "Consistency",
                value = "${(progress?.consistencyScore ?: 0.0).toInt()}%",
                color = Success,
            )
            MetricTile(
                modifier = Modifier.weight(1f),
                label = "Execution Rate",
                value = "${(progress?.executionRate ?: 0.0).toInt()}%",
                color = Cyan,
            )
            MetricTile(
                modifier = Modifier.weight(1f),
                label = "Total Hours",
                value = "${progress?.totalHoursLogged ?: 0.0}h",
                color = Amber,
            )
        }
    }
}

// ==============================================================================
// 7. NOCTURNE MENTOR TAB
// ==============================================================================
@Composable
private fun MentorTab(
    messages: List<MentorMessage>,
    lang: String,
    onSend: (String) -> Unit,
    onClear: () -> Unit,
) {
    var input by remember { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(MobileStrings.get("mentor", lang), color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            TextButton(onClick = onClear) {
                Text(MobileStrings.get("clear_chat", lang), color = TextSecondary, fontSize = 12.sp)
            }
        }

        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (messages.isEmpty()) {
                item {
                    Text(
                        "Nocturne AI Mentor is ready. Ask anything regarding DSA algorithms, interview rounds, or behavioral preparation.",
                        color = TextSecondary,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(vertical = 24.dp),
                    )
                }
            } else {
                items(messages, key = { it.id }) { msg ->
                    val isUser = msg.role.equals("user", ignoreCase = true)
                    Box(
                        modifier = Modifier.fillMaxWidth(),
                        contentAlignment = if (isUser) Alignment.CenterEnd else Alignment.CenterStart,
                    ) {
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = if (isUser) Crimson.copy(alpha = 0.85f) else SurfaceBase,
                            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
                            modifier = Modifier.widthIn(max = 280.dp),
                        ) {
                            Text(
                                text = msg.content,
                                color = TextPrimary,
                                fontSize = 14.sp,
                                lineHeight = 19.sp,
                                modifier = Modifier.padding(12.dp),
                            )
                        }
                    }
                }
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                modifier = Modifier.weight(1f),
                placeholder = { Text("Ask Nocturne Mentor...") },
                shape = RoundedCornerShape(16.dp),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Crimson, unfocusedBorderColor = Border),
            )
            IconButton(
                onClick = {
                    if (input.isNotBlank()) {
                        onSend(input)
                        input = ""
                    }
                },
                modifier = Modifier.size(48.dp).clip(CircleShape).background(Crimson),
            ) {
                Icon(Icons.AutoMirrored.Outlined.Send, contentDescription = "Send", tint = TextPrimary)
            }
        }
    }
}

// ==============================================================================
// 8. SETTINGS TAB (NOTIFICATIONS, PUSH, PERMISSIONS, I18N, LOGOUT)
// ==============================================================================
@Composable
private fun SettingsTab(
    user: MobileUser?,
    profile: UserProfileData?,
    lang: String,
    onSendTestNotification: () -> Unit,
    onToggleNotification: (String, Boolean) -> Unit,
    onSetLanguage: (String) -> Unit,
    onLogout: () -> Unit,
) {
    val context = LocalContext.current
    var hasPushPermission by remember {
        mutableStateOf(PlacePrepNotificationManager.hasNotificationPermission(context))
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
            .verticalScroll(rememberScrollState())
            .padding(bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // User Profile Summary
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(22.dp),
            color = SurfaceBase,
            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
        ) {
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(user?.name ?: "Student Profile", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text(user?.email ?: "", color = TextSecondary, fontSize = 13.sp)
                Text("Role: ${user?.role?.uppercase() ?: "STUDENT"}", color = CrimsonSoft, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }

        // Push Notifications Section
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(22.dp),
            color = SurfaceBase,
            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
        ) {
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text(MobileStrings.get("notifications", lang), color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)

                // Permission Status Indicator
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column {
                        Text("System Permission", color = TextPrimary, fontSize = 14.sp)
                        Text(
                            text = if (hasPushPermission) MobileStrings.get("permission_granted", lang) else MobileStrings.get("permission_denied", lang),
                            color = if (hasPushPermission) Success else Amber,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }

                    if (!hasPushPermission) {
                        Button(
                            onClick = {
                                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                                    data = Uri.fromParts("package", context.packageName, null)
                                }
                                context.startActivity(intent)
                            },
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Amber),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        ) {
                            Text(MobileStrings.get("grant_permission", lang), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                HorizontalDivider(color = Border)

                // Master Push Switch
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(MobileStrings.get("push_notifications", lang), color = TextPrimary, fontSize = 14.sp)
                    Switch(
                        checked = profile?.notificationBrowserEnabled ?: true,
                        onCheckedChange = { onToggleNotification("notificationBrowserEnabled", it) },
                        colors = SwitchDefaults.colors(checkedThumbColor = TextPrimary, checkedTrackColor = Crimson),
                    )
                }

                // Email Alerts Switch
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(MobileStrings.get("email_notifications", lang), color = TextPrimary, fontSize = 14.sp)
                    Switch(
                        checked = profile?.notificationEmailEnabled ?: false,
                        onCheckedChange = { onToggleNotification("notificationEmailEnabled", it) },
                        colors = SwitchDefaults.colors(checkedThumbColor = TextPrimary, checkedTrackColor = Crimson),
                    )
                }

                // Test Notification Trigger
                Button(
                    onClick = {
                        PlacePrepNotificationManager.showNotification(
                            context = context,
                            title = "PlacePrep Test Signal",
                            message = "Android push notification channel operational.",
                            route = "/tasks",
                            type = "test_signal",
                        )
                        onSendTestNotification()
                    },
                    modifier = Modifier.fillMaxWidth().height(46.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = SurfaceRaised, contentColor = TextPrimary),
                ) {
                    Text(MobileStrings.get("test_notification", lang), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
            }
        }

        // Language Switcher Section
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(22.dp),
            color = SurfaceBase,
            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
        ) {
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(MobileStrings.get("language", lang), color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("en" to "English", "ta" to "தமிழ்", "hi" to "हिंदी").forEach { (code, label) ->
                        FilterChip(
                            selected = lang == code,
                            onClick = { onSetLanguage(code) },
                            label = { Text(label, fontSize = 13.sp, fontWeight = if (lang == code) FontWeight.Bold else FontWeight.Normal) },
                        )
                    }
                }
            }
        }

        // App Info & Logout
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(22.dp),
            color = SurfaceBase,
            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
        ) {
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Application Version", color = TextSecondary, fontSize = 13.sp)
                Text("PlacePrep v${BuildConfig.VERSION_NAME} (Build ${BuildConfig.VERSION_CODE})", color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)

                Button(
                    onClick = onLogout,
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Crimson.copy(alpha = 0.2f), contentColor = CrimsonSoft),
                ) {
                    Text(MobileStrings.get("sign_out", lang), fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
