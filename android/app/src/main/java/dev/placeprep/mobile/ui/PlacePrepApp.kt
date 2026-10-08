package dev.placeprep.mobile.ui

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.compose.animation.*
import androidx.compose.animation.core.*
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
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

// ==============================================================================
// SHIMMER & SKELETON LOADING SYSTEM
// ==============================================================================
@Composable
fun Modifier.shimmer(): Modifier {
    val transition = rememberInfiniteTransition(label = "shimmer_transition")
    val translateAnim by transition.animateFloat(
        initialValue = -350f,
        targetValue = 1300f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmer_translate"
    )
    val shimmerColors = listOf(
        Color(0xFF0F121B),
        Color(0xFF222938),
        Color(0xFF0F121B),
    )
    val brush = Brush.linearGradient(
        colors = shimmerColors,
        start = Offset(translateAnim - 350f, translateAnim - 350f),
        end = Offset(translateAnim, translateAnim)
    )
    return this.background(brush)
}

@Composable
fun SkeletonBox(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(10.dp),
) {
    Box(
        modifier = modifier
            .clip(shape)
            .shimmer()
    )
}

@Composable
private fun ChamberSkeleton() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth().height(160.dp),
            shape = RoundedCornerShape(26.dp),
            color = SurfaceBase,
            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                SkeletonBox(modifier = Modifier.size(70.dp), shape = CircleShape)
                Spacer(modifier = Modifier.height(10.dp))
                SkeletonBox(modifier = Modifier.width(140.dp).height(16.dp))
            }
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            SkeletonBox(modifier = Modifier.weight(1f).height(80.dp), shape = RoundedCornerShape(16.dp))
            SkeletonBox(modifier = Modifier.weight(1f).height(80.dp), shape = RoundedCornerShape(16.dp))
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            SkeletonBox(modifier = Modifier.weight(1f).height(80.dp), shape = RoundedCornerShape(16.dp))
            SkeletonBox(modifier = Modifier.weight(1f).height(80.dp), shape = RoundedCornerShape(16.dp))
        }

        SkeletonBox(modifier = Modifier.fillMaxWidth().height(110.dp), shape = RoundedCornerShape(20.dp))

        repeat(3) {
            SkeletonBox(modifier = Modifier.fillMaxWidth().height(70.dp), shape = RoundedCornerShape(16.dp))
        }
    }
}

@Composable
private fun TasksSkeleton() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SkeletonBox(modifier = Modifier.width(70.dp).height(36.dp), shape = RoundedCornerShape(999.dp))
            SkeletonBox(modifier = Modifier.width(80.dp).height(36.dp), shape = RoundedCornerShape(999.dp))
            SkeletonBox(modifier = Modifier.width(90.dp).height(36.dp), shape = RoundedCornerShape(999.dp))
        }
        repeat(4) {
            SkeletonBox(modifier = Modifier.fillMaxWidth().height(85.dp), shape = RoundedCornerShape(18.dp))
        }
    }
}

@Composable
private fun ArchitectSkeleton() {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        SkeletonBox(modifier = Modifier.fillMaxWidth().height(140.dp), shape = RoundedCornerShape(22.dp))
        repeat(3) {
            SkeletonBox(modifier = Modifier.fillMaxWidth().height(100.dp), shape = RoundedCornerShape(18.dp))
        }
    }
}

@Composable
private fun AssessmentsSkeleton() {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        SkeletonBox(modifier = Modifier.fillMaxWidth().height(120.dp), shape = RoundedCornerShape(22.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            SkeletonBox(modifier = Modifier.weight(1f).height(75.dp), shape = RoundedCornerShape(16.dp))
            SkeletonBox(modifier = Modifier.weight(1f).height(75.dp), shape = RoundedCornerShape(16.dp))
            SkeletonBox(modifier = Modifier.weight(1f).height(75.dp), shape = RoundedCornerShape(16.dp))
        }
        repeat(3) {
            SkeletonBox(modifier = Modifier.fillMaxWidth().height(65.dp), shape = RoundedCornerShape(14.dp))
        }
    }
}

@Composable
private fun CodingLabSkeleton() {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        SkeletonBox(modifier = Modifier.fillMaxWidth().height(100.dp), shape = RoundedCornerShape(20.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SkeletonBox(modifier = Modifier.width(90.dp).height(32.dp), shape = RoundedCornerShape(999.dp))
            SkeletonBox(modifier = Modifier.width(110.dp).height(32.dp), shape = RoundedCornerShape(999.dp))
            SkeletonBox(modifier = Modifier.width(100.dp).height(32.dp), shape = RoundedCornerShape(999.dp))
        }
        SkeletonBox(modifier = Modifier.fillMaxWidth().height(220.dp), shape = RoundedCornerShape(18.dp))
        SkeletonBox(modifier = Modifier.fillMaxWidth().height(180.dp), shape = RoundedCornerShape(18.dp))
    }
}

@Composable
private fun ProgressSkeleton() {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        SkeletonBox(modifier = Modifier.fillMaxWidth().height(150.dp), shape = RoundedCornerShape(22.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            SkeletonBox(modifier = Modifier.weight(1f).height(80.dp), shape = RoundedCornerShape(16.dp))
            SkeletonBox(modifier = Modifier.weight(1f).height(80.dp), shape = RoundedCornerShape(16.dp))
            SkeletonBox(modifier = Modifier.weight(1f).height(80.dp), shape = RoundedCornerShape(16.dp))
        }
    }
}

@Composable
fun GoogleLogoIcon(modifier: Modifier = Modifier) {
    androidx.compose.foundation.Canvas(modifier = modifier) {
        val width = size.width
        val height = size.height
        val center = Offset(width / 2f, height / 2f)
        val stroke = width * 0.18f

        drawArc(
            color = Color(0xFFEA4335),
            startAngle = 180f,
            sweepAngle = 105f,
            useCenter = false,
            style = androidx.compose.ui.graphics.drawscope.Stroke(stroke)
        )
        drawArc(
            color = Color(0xFFFBBC05),
            startAngle = 135f,
            sweepAngle = 45f,
            useCenter = false,
            style = androidx.compose.ui.graphics.drawscope.Stroke(stroke)
        )
        drawArc(
            color = Color(0xFF34A853),
            startAngle = 45f,
            sweepAngle = 90f,
            useCenter = false,
            style = androidx.compose.ui.graphics.drawscope.Stroke(stroke)
        )
        drawArc(
            color = Color(0xFF4285F4),
            startAngle = -45f,
            sweepAngle = 90f,
            useCenter = false,
            style = androidx.compose.ui.graphics.drawscope.Stroke(stroke)
        )
        drawLine(
            color = Color(0xFF4285F4),
            start = center,
            end = Offset(width * 0.95f, height / 2f),
            strokeWidth = stroke
        )
    }
}

// ==============================================================================
// MAIN APP COMPOSABLE
// ==============================================================================
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
                        onSetCodingLanguage = viewModel::setCodingLanguage,
                        onUpdateCodingSourceCode = viewModel::updateCodingSourceCode,
                        onRunCodingSolution = viewModel::runCodingSolution,
                        onSubmitCodingSolution = viewModel::submitCodingSolution,
                        onGenerateAssessment = viewModel::generateAssessment,
                        onSubmitAssessment = viewModel::submitAssessment,
                        onApplyPlanUpdate = viewModel::applyAssessmentPlanUpdate,
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
    val context = LocalContext.current

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

                Spacer(modifier = Modifier.height(4.dp))

                // OAuth / Google Direct Button
                OutlinedButton(
                    onClick = {
                        val oauthUrl = "https://placeprep-api-production-2481.up.railway.app/oauth/authorize?response_type=code&client_id=placeprep-mobile-app&redirect_uri=placeprep://oauth/callback&scope=openid%20profile%20email%20placeprep:all&state=mobile_landing&code_challenge=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk&code_challenge_method=S256"
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(oauthUrl))
                        context.startActivity(intent)
                    },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(16.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Border),
                    colors = ButtonDefaults.outlinedButtonColors(containerColor = SurfaceRaised, contentColor = TextPrimary),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        GoogleLogoIcon(modifier = Modifier.size(20.dp))
                        Text("Continue with Google / OAuth", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    }
                }

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
    val context = LocalContext.current

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
                Text(MobileStrings.get("sign_in", lang), color = TextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Bold)

                // Google / OAuth Button
                OutlinedButton(
                    onClick = {
                        val oauthUrl = "https://placeprep-api-production-2481.up.railway.app/oauth/authorize?response_type=code&client_id=placeprep-mobile-app&redirect_uri=placeprep://oauth/callback&scope=openid%20profile%20email%20placeprep:all&state=mobile_login&code_challenge=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk&code_challenge_method=S256"
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(oauthUrl))
                        context.startActivity(intent)
                    },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    shape = RoundedCornerShape(14.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Border),
                    colors = ButtonDefaults.outlinedButtonColors(containerColor = SurfaceRaised, contentColor = TextPrimary),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        GoogleLogoIcon(modifier = Modifier.size(18.dp))
                        Text("Continue with Google / OAuth", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    HorizontalDivider(modifier = Modifier.weight(1f), color = Border)
                    Text("or with email", color = TextMuted, fontSize = 11.sp)
                    HorizontalDivider(modifier = Modifier.weight(1f), color = Border)
                }

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
    val context = LocalContext.current

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

                // Google / OAuth Button
                OutlinedButton(
                    onClick = {
                        val oauthUrl = "https://placeprep-api-production-2481.up.railway.app/oauth/authorize?response_type=code&client_id=placeprep-mobile-app&redirect_uri=placeprep://oauth/callback&scope=openid%20profile%20email%20placeprep:all&state=mobile_signup&code_challenge=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk&code_challenge_method=S256"
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(oauthUrl))
                        context.startActivity(intent)
                    },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    shape = RoundedCornerShape(14.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Border),
                    colors = ButtonDefaults.outlinedButtonColors(containerColor = SurfaceRaised, contentColor = TextPrimary),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        GoogleLogoIcon(modifier = Modifier.size(18.dp))
                        Text("Continue with Google / OAuth", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    HorizontalDivider(modifier = Modifier.weight(1f), color = Border)
                    Text("or create account", color = TextMuted, fontSize = 11.sp)
                    HorizontalDivider(modifier = Modifier.weight(1f), color = Border)
                }

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
                    label = { Text("Invite Code (Optional)") },
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
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    TextButton(onClick = onBack) {
                        Text("Back", color = TextSecondary)
                    }
                    TextButton(onClick = onSwitchToLogin) {
                        Text("Sign In Instead", color = Lavender)
                    }
                }
            }
        }
    }
}

// ==============================================================================
// WORKSPACE CONTAINER & NAVIGATION
// ==============================================================================
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
    onSetCodingLanguage: (String) -> Unit,
    onUpdateCodingSourceCode: (String) -> Unit,
    onRunCodingSolution: () -> Unit,
    onSubmitCodingSolution: () -> Unit,
    onGenerateAssessment: (String) -> Unit,
    onSubmitAssessment: (String, Map<String, String>) -> Unit,
    onApplyPlanUpdate: (String) -> Unit,
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
                        MobileTab.Assessments to Icons.Outlined.Science,
                        MobileTab.CodingLab to Icons.Outlined.Code,
                    ).forEach { (tab, icon) ->
                        val label = when (tab) {
                            MobileTab.Dashboard -> MobileStrings.get("chamber", lang)
                            MobileTab.Tasks -> MobileStrings.get("tasks", lang)
                            MobileTab.Architect -> MobileStrings.get("architect", lang)
                            MobileTab.Assessments -> MobileStrings.get("assessments", lang)
                            MobileTab.CodingLab -> MobileStrings.get("coding", lang)
                            else -> ""
                        }
                        val isSelected = state.currentTab == tab

                        NavigationBarItem(
                            selected = isSelected,
                            onClick = { onSwitchTab(tab) },
                            icon = {
                                Icon(
                                    imageVector = icon,
                                    contentDescription = label,
                                    tint = if (isSelected) Crimson else TextSecondary,
                                )
                            },
                            label = {
                                Text(
                                    label,
                                    fontSize = 10.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                    color = if (isSelected) TextPrimary else TextSecondary,
                                )
                            },
                            colors = NavigationBarItemDefaults.colors(
                                indicatorColor = Crimson.copy(alpha = 0.16f),
                            ),
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            Crossfade(
                targetState = state.currentTab,
                animationSpec = tween(durationMillis = 250),
                label = "mobile_tab_transition"
            ) { tab ->
                when (tab) {
                    MobileTab.Dashboard -> {
                        if (state.isLoading && state.progress == null) {
                            ChamberSkeleton()
                        } else {
                            DashboardTab(
                                state = state,
                                lang = lang,
                                onToggleTask = onToggleTask,
                                onRequestCoach = onRequestCoach,
                                onSubmitReview = onSubmitReview,
                                onEngagePowerPocket = onEngagePowerPocket,
                                onEndPowerPocket = onEndPowerPocket,
                                onNavigateTasks = { onSwitchTab(MobileTab.Tasks) },
                            )
                        }
                    }
                    MobileTab.Tasks -> {
                        if (state.isLoading && state.tasks.isEmpty()) {
                            TasksSkeleton()
                        } else {
                            TasksTab(
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
                        }
                    }
                    MobileTab.Architect -> {
                        if (state.isLoading && state.prepPlan == null) {
                            ArchitectSkeleton()
                        } else {
                            ArchitectTab(
                                plan = state.prepPlan,
                                lang = lang,
                                onGeneratePlan = onGeneratePlan,
                            )
                        }
                    }
                    MobileTab.Assessments -> {
                        if (state.isLoading && state.assessmentsOverview == null && state.activeAssessment == null) {
                            AssessmentsSkeleton()
                        } else {
                            AssessmentsTab(
                                overview = state.assessmentsOverview,
                                activeAssessment = state.activeAssessment,
                                isAssessmentLoading = state.isAssessmentLoading,
                                lang = lang,
                                onGenerateAssessment = onGenerateAssessment,
                                onSubmitAssessment = onSubmitAssessment,
                                onApplyPlanUpdate = onApplyPlanUpdate,
                            )
                        }
                    }
                    MobileTab.CodingLab -> {
                        if (state.isLoading && state.selectedCodingProblem == null) {
                            CodingLabSkeleton()
                        } else {
                            CodingLabTab(
                                selectedProblem = state.selectedCodingProblem,
                                codingLanguage = state.codingLanguage,
                                codingSourceCode = state.codingSourceCode,
                                codingRunResult = state.codingRunResult,
                                isCodingRunning = state.isCodingRunning,
                                lang = lang,
                                onResolveProblem = onResolveProblem,
                                onSetCodingLanguage = onSetCodingLanguage,
                                onUpdateCodingSourceCode = onUpdateCodingSourceCode,
                                onRunCodingSolution = onRunCodingSolution,
                                onSubmitCodingSolution = onSubmitCodingSolution,
                            )
                        }
                    }
                    MobileTab.Progress -> {
                        if (state.isLoading && state.progress == null) {
                            ProgressSkeleton()
                        } else {
                            ProgressTab(
                                progress = state.progress,
                                user = state.user,
                                lang = lang,
                            )
                        }
                    }
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

            // Navigation Drawer
            if (drawerOpen) {
                NavigationDrawerOverlay(
                    currentTab = state.currentTab,
                    lang = lang,
                    onSelectTab = { tab ->
                        onSwitchTab(tab)
                        drawerOpen = false
                    },
                    onDismiss = { drawerOpen = false },
                    onLogout = onLogout,
                )
            }
        }
    }
}

// ==============================================================================
// NAVIGATION DRAWER OVERLAY
// ==============================================================================
@Composable
private fun NavigationDrawerOverlay(
    currentTab: MobileTab,
    lang: String,
    onSelectTab: (MobileTab) -> Unit,
    onDismiss: () -> Unit,
    onLogout: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.65f))
            .clickable(onClick = onDismiss)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxHeight()
                .width(290.dp)
                .clickable(enabled = false) {},
            color = SurfaceBase,
            tonalElevation = 16.dp,
            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp)
                    .statusBarsPadding()
                    .navigationBarsPadding(),
                verticalArrangement = Arrangement.SpaceBetween,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text("PlacePrep", color = Crimson, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    Text("Technical Interview Systems", color = TextSecondary, fontSize = 12.sp)

                    HorizontalDivider(color = Border)

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
                            shape = RoundedCornerShape(12.dp),
                            color = if (isSelected) Crimson.copy(alpha = 0.15f) else Color.Transparent,
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (isSelected) Crimson.copy(alpha = 0.35f) else Color.Transparent
                            ),
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(icon, contentDescription = label, tint = if (isSelected) Crimson else TextSecondary)
                                Text(
                                    label,
                                    color = if (isSelected) TextPrimary else TextSecondary,
                                    fontSize = 14.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                )
                            }
                        }
                    }
                }

                Button(
                    onClick = onLogout,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Crimson.copy(alpha = 0.15f), contentColor = Crimson),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Crimson.copy(alpha = 0.3f)),
                ) {
                    Text(MobileStrings.get("sign_out", lang), fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

// ==============================================================================
// 1. COMMAND CHAMBER (DASHBOARD TAB)
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
    var eveningReflections by remember { mutableStateOf("") }
    var focusScore by remember { mutableFloatStateOf(8f) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // LEVEL 2: READINESS HERO GAUGE
        ReadinessHero(
            score = state.progress?.readinessScore ?: 0.0,
            targetRole = state.user?.targetRole ?: "Software Engineer Track",
            lang = lang,
        )

        // LEVEL 3: ACTION MATRIX (4-TILE OPERATIONAL GRID)
        ActionMatrix(
            progress = state.progress,
            lang = lang,
        )

        // LEVEL 4: NEXT BEST ACTION CARD
        NextBestActionCard(
            tasks = state.todayTasks,
            lang = lang,
            onAction = { topic ->
                onRequestCoach(topic, topic, "Immediate action guidance requested")
            },
        )

        // LEVEL 5: PRIMARY WORKSPACE — TODAY'S EXECUTION TASKS
        TodayTasksWorkspace(
            tasks = state.todayTasks,
            lang = lang,
            onToggle = onToggleTask,
            onViewAll = onNavigateTasks,
        )

        // LEVEL 6: COACH CONSOLE (COACH ME THROUGH IT)
        CoachConsole(
            coachHelp = state.coachHelp,
            isLoading = state.isCoachLoading,
            topic = coachTopic,
            blocked = coachBlocked,
            lang = lang,
            onTopicChange = { coachTopic = it },
            onBlockedChange = { coachBlocked = it },
            onRequest = { onRequestCoach(coachTopic, coachTopic, coachBlocked) },
        )

        // LEVEL 7: EVENING DEBRIEF & DAILY EVALUATION
        EveningDebriefCard(
            evaluation = state.dailyEvaluation,
            isEvaluating = state.isEvaluating,
            reflections = eveningReflections,
            focusScore = focusScore.toInt(),
            lang = lang,
            onReflectionsChange = { eveningReflections = it },
            onScoreChange = { focusScore = it },
            onSubmit = { onSubmitReview(eveningReflections, focusScore.toInt()) },
        )

        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
private fun ReadinessHero(
    score: Double,
    targetRole: String,
    lang: String,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(26.dp),
        color = SurfaceBase,
        border = androidx.compose.foundation.BorderStroke(1.dp, Border),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = MobileStrings.get("readiness_score", lang).uppercase(),
                    color = TextSecondary,
                    fontSize = 11.sp,
                    letterSpacing = 1.5.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        text = "${score.toInt()}",
                        color = Crimson,
                        fontSize = 46.sp,
                        fontWeight = FontWeight.Bold,
                        lineHeight = 46.sp,
                    )
                    Text(
                        text = "%",
                        color = CrimsonSoft,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(bottom = 6.dp, start = 2.dp),
                    )
                }
                Text(
                    text = targetRole,
                    color = Lavender,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                )
            }

            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(CircleShape)
                    .background(Crimson.copy(alpha = 0.12f))
                    .border(2.dp, Crimson.copy(alpha = 0.35f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text("🔥", fontSize = 34.sp)
            }
        }
    }
}

@Composable
private fun ActionMatrix(
    progress: ProgressSummary?,
    lang: String,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
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
                color = Amber,
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            MetricTile(
                modifier = Modifier.weight(1f),
                label = "Execution Rate",
                value = "${(progress?.executionRate ?: 0.0).toInt()}%",
                color = Cyan,
            )
            MetricTile(
                modifier = Modifier.weight(1f),
                label = "Consistency",
                value = "${(progress?.consistencyScore ?: 0.0).toInt()}%",
                color = Lavender,
            )
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
        shape = RoundedCornerShape(18.dp),
        color = SurfaceBase,
        border = androidx.compose.foundation.BorderStroke(1.dp, Border),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(label, color = TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Medium)
            Text(value, color = color, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun NextBestActionCard(
    tasks: List<TaskItem>,
    lang: String,
    onAction: (String) -> Unit,
) {
    val pendingTask = tasks.firstOrNull { !it.status.equals("completed", true) }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        color = SurfaceRaised,
        border = androidx.compose.foundation.BorderStroke(1.dp, Crimson.copy(alpha = 0.45f)),
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = MobileStrings.get("next_best_action", lang).uppercase(),
                    color = CrimsonSoft,
                    fontSize = 11.sp,
                    letterSpacing = 1.5.sp,
                    fontWeight = FontWeight.Bold,
                )
                Surface(
                    shape = RoundedCornerShape(999.dp),
                    color = Crimson.copy(alpha = 0.15f),
                ) {
                    Text(
                        text = "PRIORITY 1",
                        color = CrimsonSoft,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                    )
                }
            }

            Text(
                text = pendingTask?.title ?: "Review Dynamic Programming Patterns",
                color = TextPrimary,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
            )

            Text(
                text = pendingTask?.description ?: "Run 45m deep focus session on two-pointer & sliding window constraints.",
                color = TextSecondary,
                fontSize = 12.sp,
                lineHeight = 18.sp,
            )

            Button(
                onClick = { onAction(pendingTask?.title ?: "DSA Preparation") },
                modifier = Modifier.fillMaxWidth().height(44.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Crimson, contentColor = TextPrimary),
            ) {
                Text(MobileStrings.get("unblock_now", lang), fontWeight = FontWeight.Bold, fontSize = 13.sp)
            }
        }
    }
}

@Composable
private fun TodayTasksWorkspace(
    tasks: List<TaskItem>,
    lang: String,
    onToggle: (TaskItem) -> Unit,
    onViewAll: () -> Unit,
) {
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
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = MobileStrings.get("today_work", lang),
                    color = TextPrimary,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                )
                TextButton(onClick = onViewAll) {
                    Text("View all (${tasks.size})", color = Lavender, fontSize = 12.sp)
                }
            }

            if (tasks.isEmpty()) {
                Text(
                    text = MobileStrings.get("empty_tasks", lang),
                    color = TextMuted,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(vertical = 8.dp),
                )
            } else {
                tasks.take(4).forEach { task ->
                    TaskRow(task = task, onToggle = { onToggle(task) })
                }
            }
        }
    }
}

@Composable
private fun TaskRow(
    task: TaskItem,
    onToggle: () -> Unit,
) {
    val isDone = task.status.equals("completed", ignoreCase = true)

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggle),
        shape = RoundedCornerShape(14.dp),
        color = if (isDone) SurfaceRaised.copy(alpha = 0.5f) else SurfaceRaised,
        border = androidx.compose.foundation.BorderStroke(1.dp, Border),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Checkbox(
                checked = isDone,
                onCheckedChange = { onToggle() },
                colors = CheckboxDefaults.colors(
                    checkedColor = Crimson,
                    checkmarkColor = TextPrimary,
                    uncheckedColor = TextSecondary,
                ),
            )

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = task.title,
                    color = if (isDone) TextMuted else TextPrimary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = task.category.uppercase(),
                        color = Lavender,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Text("•", color = TextMuted, fontSize = 10.sp)
                    Text(
                        text = "${task.estimatedMinutes}m",
                        color = TextSecondary,
                        fontSize = 11.sp,
                    )
                }
            }
        }
    }
}

@Composable
private fun CoachConsole(
    coachHelp: AiStuckHelpResponse?,
    isLoading: Boolean,
    topic: String,
    blocked: String,
    lang: String,
    onTopicChange: (String) -> Unit,
    onBlockedChange: (String) -> Unit,
    onRequest: () -> Unit,
) {
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
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = MobileStrings.get("coach_me_through_it", lang),
                    color = TextPrimary,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text("AI Mentor", color = Cyan, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }

            OutlinedTextField(
                value = topic,
                onValueChange = onTopicChange,
                label = { Text(MobileStrings.get("topic_label", lang)) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Crimson, unfocusedBorderColor = Border),
                singleLine = true,
            )

            OutlinedTextField(
                value = blocked,
                onValueChange = onBlockedChange,
                label = { Text(MobileStrings.get("blocked_label", lang)) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Crimson, unfocusedBorderColor = Border),
            )

            Button(
                onClick = onRequest,
                enabled = !isLoading && topic.isNotBlank(),
                modifier = Modifier.fillMaxWidth().height(46.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Crimson, contentColor = TextPrimary),
            ) {
                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), color = TextPrimary, strokeWidth = 2.dp)
                } else {
                    Text(MobileStrings.get("unblock_now", lang), fontWeight = FontWeight.Bold)
                }
            }

            // Results Display
            coachHelp?.let { result ->
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    color = SurfaceRaised,
                    border = androidx.compose.foundation.BorderStroke(1.dp, Border),
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        if (!result.hint.isNullOrBlank()) {
                            Text(MobileStrings.get("hint_label", lang), color = Amber, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            Text(result.hint, color = TextPrimary, fontSize = 13.sp, lineHeight = 19.sp)
                        }

                        if (result.approachSteps.isNotEmpty()) {
                            Text(MobileStrings.get("approach_label", lang), color = Cyan, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            result.approachSteps.forEachIndexed { i, step ->
                                Text("${i + 1}. $step", color = TextPrimary, fontSize = 12.sp, lineHeight = 18.sp)
                            }
                        }

                        if (result.similarProblems.isNotEmpty()) {
                            Text(MobileStrings.get("similar_problems", lang), color = Lavender, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            Text(result.similarProblems.joinToString(", "), color = TextSecondary, fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EveningDebriefCard(
    evaluation: AiDailyEvaluationResponse?,
    isEvaluating: Boolean,
    reflections: String,
    focusScore: Int,
    lang: String,
    onReflectionsChange: (String) -> Unit,
    onScoreChange: (Float) -> Unit,
    onSubmit: () -> Unit,
) {
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
            Text(
                text = MobileStrings.get("evaluate_performance", lang),
                color = TextPrimary,
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
            )

            Text(
                text = "${MobileStrings.get("focus_score", lang)}: $focusScore",
                color = TextSecondary,
                fontSize = 13.sp,
            )

            Slider(
                value = focusScore.toFloat(),
                onValueChange = onScoreChange,
                valueRange = 1f..10f,
                steps = 8,
                colors = SliderDefaults.colors(thumbColor = Crimson, activeTrackColor = Crimson),
            )

            OutlinedTextField(
                value = reflections,
                onValueChange = onReflectionsChange,
                label = { Text(MobileStrings.get("reflections_label", lang)) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Crimson, unfocusedBorderColor = Border),
                maxLines = 4,
            )

            Button(
                onClick = onSubmit,
                enabled = !isEvaluating,
                modifier = Modifier.fillMaxWidth().height(46.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Crimson, contentColor = TextPrimary),
            ) {
                if (isEvaluating) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), color = TextPrimary, strokeWidth = 2.dp)
                } else {
                    Text(MobileStrings.get("submit_review", lang), fontWeight = FontWeight.Bold)
                }
            }

            evaluation?.let { eval ->
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    color = SurfaceRaised,
                    border = androidx.compose.foundation.BorderStroke(1.dp, Border),
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Text("VERDICT: ${eval.verdict.uppercase()}", color = Success, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Text("Score: ${eval.score}/100", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                        if (eval.evaluation.isNotBlank()) {
                            Text(eval.evaluation, color = TextSecondary, fontSize = 12.sp, lineHeight = 18.sp)
                        }
                    }
                }
            }
        }
    }
}

// ==============================================================================
// 2. TASKS TAB
// ==============================================================================
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
    var showCreateDialog by remember { mutableStateOf(false) }

    val filteredTasks = remember(tasks, filter) {
        when (filter) {
            "pending" -> tasks.filter { !it.status.equals("completed", true) }
            "completed" -> tasks.filter { it.status.equals("completed", true) }
            else -> tasks
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        // Top Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(MobileStrings.get("tasks", lang), color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Bold)
            Button(
                onClick = { showCreateDialog = true },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Crimson),
            ) {
                Text(MobileStrings.get("quick_add_task", lang), fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
        }

        // Filters
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            listOf("all" to MobileStrings.get("all", lang), "pending" to MobileStrings.get("pending", lang), "completed" to MobileStrings.get("completed", lang)).forEach { (key, label) ->
                val isSelected = filter == key
                Surface(
                    modifier = Modifier.clickable { filter = key },
                    shape = RoundedCornerShape(999.dp),
                    color = if (isSelected) Crimson else SurfaceRaised,
                    border = androidx.compose.foundation.BorderStroke(1.dp, if (isSelected) Crimson else Border),
                ) {
                    Text(
                        text = label,
                        color = TextPrimary,
                        fontSize = 12.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                    )
                }
            }
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(filteredTasks, key = { it.id }) { task ->
                TaskCard(
                    task = task,
                    onToggle = { onToggleTask(task) },
                    onDelete = { onDeleteTask(task.id) },
                    onCoach = { onLaunchCoach(task.title) },
                )
            }
        }
    }

    if (showCreateDialog) {
        CreateTaskDialog(
            lang = lang,
            onDismiss = { showCreateDialog = false },
            onConfirm = { title, desc, cat, prio, mins, diff ->
                onCreateTask(title, desc, cat, prio, mins, diff)
                showCreateDialog = false
            },
        )
    }
}

@Composable
private fun TaskCard(
    task: TaskItem,
    onToggle: () -> Unit,
    onDelete: () -> Unit,
    onCoach: () -> Unit,
) {
    val isDone = task.status.equals("completed", true)

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = SurfaceBase,
        border = androidx.compose.foundation.BorderStroke(1.dp, Border),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
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
                        colors = CheckboxDefaults.colors(checkedColor = Crimson),
                    )
                    Text(
                        task.title,
                        color = if (isDone) TextMuted else TextPrimary,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }

                IconButton(onClick = onDelete) {
                    Icon(Icons.Outlined.Delete, contentDescription = "Delete", tint = TextMuted, modifier = Modifier.size(20.dp))
                }
            }

            if (!task.description.isNullOrBlank()) {
                Text(task.description, color = TextSecondary, fontSize = 12.sp, lineHeight = 18.sp)
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = SurfaceRaised,
                    ) {
                        Text(
                            task.category.uppercase(),
                            color = Lavender,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        )
                    }
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = SurfaceRaised,
                    ) {
                        Text(
                            "${task.estimatedMinutes}m",
                            color = TextSecondary,
                            fontSize = 10.sp,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        )
                    }
                }

                TextButton(onClick = onCoach) {
                    Text("Coach", color = Cyan, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
private fun CreateTaskDialog(
    lang: String,
    onDismiss: () -> Unit,
    onConfirm: (String, String?, String, String, Int, String) -> Unit,
) {
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("dsa") }
    var minutes by remember { mutableIntStateOf(30) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SurfaceBase,
        title = { Text(MobileStrings.get("create_task", lang), color = TextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text(MobileStrings.get("task_title", lang)) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                )
                OutlinedTextField(
                    value = minutes.toString(),
                    onValueChange = { minutes = it.toIntOrNull() ?: 30 },
                    label = { Text(MobileStrings.get("estimated_minutes", lang)) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (title.isNotBlank()) {
                        onConfirm(title, description.ifBlank { null }, category, "medium", minutes, "medium")
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = Crimson),
            ) {
                Text(MobileStrings.get("save", lang))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(MobileStrings.get("cancel", lang), color = TextSecondary)
            }
        },
    )
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
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(MobileStrings.get("architect", lang), color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text(
                    "Algorithmic preparation curriculum tailored to your target interview track.",
                    color = TextSecondary,
                    fontSize = 13.sp,
                )
                Button(
                    onClick = onGeneratePlan,
                    modifier = Modifier.fillMaxWidth().height(44.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Crimson),
                ) {
                    Text(MobileStrings.get("generate_plan", lang), fontWeight = FontWeight.Bold)
                }
            }
        }

        if (plan == null) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                color = SurfaceRaised,
                border = androidx.compose.foundation.BorderStroke(1.dp, Border),
            ) {
                Text(
                    "No curriculum generated yet. Tap 'Generate Plan' above to build your roadmap.",
                    color = TextSecondary,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(20.dp),
                )
            }
        } else {
            plan.roadmap.forEach { week ->
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp),
                    color = SurfaceBase,
                    border = androidx.compose.foundation.BorderStroke(1.dp, Border),
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Week ${week.week}", color = CrimsonSoft, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Text(week.title, color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        }
                        Text(week.focusTopics.joinToString(", "), color = TextSecondary, fontSize = 12.sp)
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
    activeAssessment: AssessmentSessionData?,
    isAssessmentLoading: Boolean,
    lang: String,
    onGenerateAssessment: (String) -> Unit,
    onSubmitAssessment: (String, Map<String, String>) -> Unit,
    onApplyPlanUpdate: (String) -> Unit,
) {
    var selectedQuestionIdx by remember { mutableIntStateOf(0) }
    val answers = remember { mutableStateMapOf<String, String>() }

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
                Text(MobileStrings.get("assessments", lang), color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text("Diagnostic benchmarks and adaptive assessments for targeted preparation.", color = TextSecondary, fontSize = 13.sp)

                Button(
                    onClick = { onGenerateAssessment("mcq") },
                    enabled = !isAssessmentLoading,
                    modifier = Modifier.fillMaxWidth().height(44.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Crimson),
                ) {
                    if (isAssessmentLoading) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), color = TextPrimary, strokeWidth = 2.dp)
                    } else {
                        Text("Start Diagnostic Assessment", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // Active Assessment Quiz if session exists and is started
        if (activeAssessment != null && activeAssessment.questions.isNotEmpty() && !activeAssessment.status.equals("completed", true)) {
            val questions = activeAssessment.questions
            val currentQ = questions.getOrNull(selectedQuestionIdx) ?: questions.first()

            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                color = SurfaceBase,
                border = androidx.compose.foundation.BorderStroke(1.dp, Crimson.copy(alpha = 0.5f)),
            ) {
                Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "Question ${selectedQuestionIdx + 1} of ${questions.size}",
                            color = CrimsonSoft,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                        currentQ.topic?.let {
                            Text(it, color = TextMuted, fontSize = 11.sp)
                        }
                    }

                    Text(currentQ.question, color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Medium, lineHeight = 22.sp)

                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        currentQ.options.forEach { optText ->
                            val isSelected = answers[currentQ.id] == optText
                            Surface(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { answers[currentQ.id] = optText },
                                shape = RoundedCornerShape(12.dp),
                                color = if (isSelected) Crimson.copy(alpha = 0.15f) else SurfaceRaised,
                                border = androidx.compose.foundation.BorderStroke(
                                    1.dp,
                                    if (isSelected) Crimson else Border
                                ),
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                                ) {
                                    RadioButton(
                                        selected = isSelected,
                                        onClick = { answers[currentQ.id] = optText },
                                        colors = RadioButtonDefaults.colors(selectedColor = Crimson)
                                    )
                                    Text(optText, color = TextPrimary, fontSize = 13.sp)
                                }
                            }
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Button(
                            onClick = { if (selectedQuestionIdx > 0) selectedQuestionIdx-- },
                            enabled = selectedQuestionIdx > 0,
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = SurfaceRaised)
                        ) {
                            Text("Previous")
                        }

                        if (selectedQuestionIdx < questions.size - 1) {
                            Button(
                                onClick = { selectedQuestionIdx++ },
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Crimson)
                            ) {
                                Text("Next")
                            }
                        } else {
                            Button(
                                onClick = { onSubmitAssessment(activeAssessment.id, answers.toMap()) },
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Success)
                            ) {
                                Text("Submit Quiz")
                            }
                        }
                    }
                }
            }
        }

        // Completed Assessment Results Card
        if (activeAssessment != null && activeAssessment.status.equals("completed", true)) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                color = SurfaceBase,
                border = androidx.compose.foundation.BorderStroke(1.dp, Success.copy(alpha = 0.5f)),
            ) {
                Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Assessment Completed!", color = Success, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    Text("Score: ${(activeAssessment.score ?: 0.0).toInt()}%", color = TextPrimary, fontSize = 32.sp, fontWeight = FontWeight.Bold)

                    if (activeAssessment.weakSpots.isNotEmpty()) {
                        Text("Identified Weak Spots:", color = TextSecondary, fontSize = 13.sp)
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            activeAssessment.weakSpots.forEach { spot ->
                                Surface(
                                    shape = RoundedCornerShape(999.dp),
                                    color = Amber.copy(alpha = 0.15f),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, Amber.copy(alpha = 0.3f)),
                                ) {
                                    Text(spot, color = Amber, fontSize = 11.sp, modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp))
                                }
                            }
                        }
                    }

                    Button(
                        onClick = { onApplyPlanUpdate(activeAssessment.id) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Crimson)
                    ) {
                        Text("Apply Findings to Prep Architect Plan")
                    }
                }
            }
        }

        // Overall stats metrics
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
                value = "${overview?.completedCount ?: overview?.totalAssessments ?: 0}",
                color = Cyan,
            )
            MetricTile(
                modifier = Modifier.weight(1f),
                label = "Target",
                value = "${(overview?.targetReadiness ?: 85.0).toInt()}%",
                color = Lavender,
            )
        }

        // Identified weak spots
        if (!overview?.identifiedWeakSpots.isNullOrEmpty()) {
            Text("Focus Recommendations", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            overview?.identifiedWeakSpots?.forEach { spot ->
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    color = SurfaceBase,
                    border = androidx.compose.foundation.BorderStroke(1.dp, Border),
                ) {
                    Row(modifier = Modifier.padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(spot, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                        Text("Needs Focus", color = Amber, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        Text("Core Benchmark Domains", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)

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
    codingLanguage: String,
    codingSourceCode: String,
    codingRunResult: CodingRunResult?,
    isCodingRunning: Boolean,
    lang: String,
    onResolveProblem: (String) -> Unit,
    onSetCodingLanguage: (String) -> Unit,
    onUpdateCodingSourceCode: (String) -> Unit,
    onRunCodingSolution: () -> Unit,
    onSubmitCodingSolution: () -> Unit,
) {
    var searchQuery by remember { mutableStateOf("") }

    val curatedProblems = listOf(
        "1" to "Two Sum",
        "20" to "Valid Parentheses",
        "21" to "Merge Lists",
        "53" to "Max Subarray",
        "121" to "Stock Timing",
        "206" to "Reverse List",
    )

    val supportedLanguages = listOf("python", "java", "cpp", "typescript", "go", "rust")

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
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
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
                        onClick = { if (searchQuery.isNotBlank()) onResolveProblem(searchQuery) },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Crimson),
                    ) {
                        Text("Search")
                    }
                }

                // Curated problem chips
                Text("Popular Practice Problems", color = TextMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    curatedProblems.take(3).forEach { (num, title) ->
                        Surface(
                            modifier = Modifier.clickable { onResolveProblem(num) },
                            shape = RoundedCornerShape(999.dp),
                            color = SurfaceRaised,
                            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
                        ) {
                            Text(
                                "#$num $title",
                                color = Lavender,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                            )
                        }
                    }
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    curatedProblems.drop(3).forEach { (num, title) ->
                        Surface(
                            modifier = Modifier.clickable { onResolveProblem(num) },
                            shape = RoundedCornerShape(999.dp),
                            color = SurfaceRaised,
                            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
                        ) {
                            Text(
                                "#$num $title",
                                color = Lavender,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                            )
                        }
                    }
                }
            }
        }

        // Problem Definition card
        selectedProblem?.let { problem ->
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                color = SurfaceBase,
                border = androidx.compose.foundation.BorderStroke(1.dp, Border),
            ) {
                Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            problem.number?.let {
                                Text("Problem #$it", color = CrimsonSoft, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                            Text(problem.title.ifBlank { "Problem Details" }, color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        }
                        val diffColor = when (problem.difficulty.lowercase()) {
                            "easy" -> Success
                            "hard" -> Crimson
                            else -> Amber
                        }
                        Surface(
                            shape = RoundedCornerShape(999.dp),
                            color = diffColor.copy(alpha = 0.15f),
                            border = androidx.compose.foundation.BorderStroke(1.dp, diffColor.copy(alpha = 0.3f)),
                        ) {
                            Text(
                                problem.difficulty.uppercase(),
                                color = diffColor,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                            )
                        }
                    }

                    Text("Category: ${(problem.category ?: "DSA").uppercase()}", color = TextSecondary, fontSize = 12.sp)

                    if (!problem.description.isNullOrBlank()) {
                        HorizontalDivider(color = Border)
                        Text(problem.description, color = TextPrimary, fontSize = 13.sp, lineHeight = 20.sp)
                    }

                    if (problem.examples.isNotEmpty()) {
                        Text("Examples:", color = TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        problem.examples.take(2).forEach { ex ->
                            Surface(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(10.dp),
                                color = SurfaceRaised,
                            ) {
                                Text(ex, color = TextPrimary, fontSize = 12.sp, modifier = Modifier.padding(10.dp))
                            }
                        }
                    }
                }
            }

            // Code Editor & Runner section
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                color = SurfaceBase,
                border = androidx.compose.foundation.BorderStroke(1.dp, Border),
            ) {
                Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Solution Runner", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)

                    // Language Selector Chips
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        supportedLanguages.forEach { langName ->
                            val isSelected = codingLanguage.equals(langName, ignoreCase = true)
                            Surface(
                                modifier = Modifier.clickable { onSetCodingLanguage(langName) },
                                shape = RoundedCornerShape(8.dp),
                                color = if (isSelected) Crimson else SurfaceRaised,
                                border = androidx.compose.foundation.BorderStroke(1.dp, if (isSelected) Crimson else Border),
                            ) {
                                Text(
                                    langName.uppercase(),
                                    color = TextPrimary,
                                    fontSize = 10.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }

                    // Editable code editor
                    OutlinedTextField(
                        value = codingSourceCode,
                        onValueChange = onUpdateCodingSourceCode,
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 180.dp, max = 320.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary,
                            focusedContainerColor = Color(0xFF0A0D14),
                            unfocusedContainerColor = Color(0xFF0A0D14),
                            focusedBorderColor = Crimson,
                            unfocusedBorderColor = Border,
                        ),
                        textStyle = TextStyle(
                            fontFamily = FontFamily.Monospace,
                            fontSize = 12.sp,
                            lineHeight = 18.sp,
                        ),
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = onRunCodingSolution,
                            enabled = !isCodingRunning,
                            modifier = Modifier.weight(1f).height(46.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Cyan),
                        ) {
                            if (isCodingRunning) {
                                CircularProgressIndicator(modifier = Modifier.size(18.dp), color = TextPrimary, strokeWidth = 2.dp)
                            } else {
                                Text("Run Solution", color = Color.Black, fontWeight = FontWeight.Bold)
                            }
                        }

                        Button(
                            onClick = onSubmitCodingSolution,
                            enabled = !isCodingRunning,
                            modifier = Modifier.weight(1f).height(46.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Crimson),
                        ) {
                            Text("Submit", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // Results Card
            codingRunResult?.let { res ->
                val isSuccess = res.status.equals("ACCEPTED", ignoreCase = true) || (res.score ?: 0.0) >= 70.0
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp),
                    color = SurfaceBase,
                    border = androidx.compose.foundation.BorderStroke(1.dp, if (isSuccess) Success else Crimson),
                ) {
                    Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = res.status.ifBlank { if (isSuccess) "ACCEPTED" else "EXECUTION FINISHED" },
                                color = if (isSuccess) Success else Crimson,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                            res.score?.let {
                                Text("Score: ${it.toInt()}/100", color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                            }
                        }

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            res.time?.let {
                                Text("Time: ${it}s", color = TextSecondary, fontSize = 12.sp)
                            }
                            res.memory?.let {
                                Text("Memory: ${it}KB", color = TextSecondary, fontSize = 12.sp)
                            }
                        }

                        if (res.stdout.isNotBlank()) {
                            Text("Output:", color = TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                            Surface(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(10.dp),
                                color = Color(0xFF0A0D14),
                            ) {
                                Text(res.stdout, color = TextPrimary, fontSize = 12.sp, fontFamily = FontFamily.Monospace, modifier = Modifier.padding(10.dp))
                            }
                        }
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
            Text(MobileStrings.get("mentor", lang), color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            TextButton(onClick = onClear) {
                Text(MobileStrings.get("clear_chat", lang), color = TextMuted, fontSize = 12.sp)
            }
        }

        LazyColumn(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(messages, key = { it.id }) { msg ->
                val isUser = msg.role.equals("user", true)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
                ) {
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = if (isUser) Crimson.copy(alpha = 0.2f) else SurfaceRaised,
                        border = androidx.compose.foundation.BorderStroke(1.dp, if (isUser) Crimson.copy(alpha = 0.4f) else Border),
                        modifier = Modifier.widthIn(max = 280.dp),
                    ) {
                        Text(
                            text = msg.content,
                            color = TextPrimary,
                            fontSize = 13.sp,
                            lineHeight = 19.sp,
                            modifier = Modifier.padding(12.dp),
                        )
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
                placeholder = { Text(MobileStrings.get("send_message", lang)) },
                shape = RoundedCornerShape(14.dp),
                maxLines = 3,
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
// 8. SETTINGS & PROFILE TAB
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
                Text(user?.name ?: "Student Profile", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text(user?.email ?: "", color = TextSecondary, fontSize = 13.sp)
                Text("Role: ${user?.targetRole ?: "Software Engineer Track"}", color = Lavender, fontSize = 12.sp)
            }
        }

        // Notification Controls
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(22.dp),
            color = SurfaceBase,
            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
        ) {
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text(MobileStrings.get("notifications", lang), color = TextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(MobileStrings.get("push_notifications", lang), color = TextPrimary, fontSize = 13.sp)
                    Switch(
                        checked = profile?.notificationBrowserEnabled ?: true,
                        onCheckedChange = { onToggleNotification("notificationBrowserEnabled", it) },
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(MobileStrings.get("email_notifications", lang), color = TextPrimary, fontSize = 13.sp)
                    Switch(
                        checked = profile?.notificationEmailEnabled ?: false,
                        onCheckedChange = { onToggleNotification("notificationEmailEnabled", it) },
                    )
                }

                Button(
                    onClick = onSendTestNotification,
                    modifier = Modifier.fillMaxWidth().height(44.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Crimson),
                ) {
                    Text(MobileStrings.get("test_notification", lang), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }

                TextButton(
                    onClick = {
                        val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                            putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                        }
                        context.startActivity(intent)
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Android System Notification Settings", color = Lavender, fontSize = 12.sp)
                }
            }
        }

        // Language Selector
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(22.dp),
            color = SurfaceBase,
            border = androidx.compose.foundation.BorderStroke(1.dp, Border),
        ) {
            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(MobileStrings.get("language", lang), color = TextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    listOf("en" to "English", "ta" to "தமிழ்", "hi" to "हिंदी").forEach { (code, name) ->
                        val isSelected = lang == code
                        Surface(
                            modifier = Modifier.weight(1f).clickable { onSetLanguage(code) },
                            shape = RoundedCornerShape(12.dp),
                            color = if (isSelected) Crimson else SurfaceRaised,
                            border = androidx.compose.foundation.BorderStroke(1.dp, if (isSelected) Crimson else Border),
                        ) {
                            Text(
                                text = name,
                                color = TextPrimary,
                                fontSize = 13.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                modifier = Modifier.padding(vertical = 10.dp),
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            )
                        }
                    }
                }
            }
        }

        Button(
            onClick = onLogout,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Crimson.copy(alpha = 0.15f), contentColor = Crimson),
            border = androidx.compose.foundation.BorderStroke(1.dp, Crimson.copy(alpha = 0.3f)),
        ) {
            Text(MobileStrings.get("sign_out", lang), fontWeight = FontWeight.Bold)
        }
    }
}
