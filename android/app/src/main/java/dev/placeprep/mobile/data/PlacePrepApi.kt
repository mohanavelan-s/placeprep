package dev.placeprep.mobile.data

import dev.placeprep.mobile.BuildConfig
import java.net.InetAddress
import java.net.UnknownHostException
import okhttp3.Dns
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.dnsoverhttps.DnsOverHttps
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface PlacePrepApi {

    // --- Authentication ---
    @POST("auth/register")
    suspend fun register(@Body payload: RegisterRequest): ApiEnvelope<AuthSession>

    @POST("auth/login")
    suspend fun login(@Body payload: LoginRequest): ApiEnvelope<AuthSession>

    @POST("auth/google")
    suspend fun googleAuth(@Body payload: GoogleAuthRequest): ApiEnvelope<AuthSession>

    @GET("auth/me")
    suspend fun getMe(): ApiEnvelope<MobileUser>

    // --- Progress & Diagnostics ---
    @GET("progress/summary")
    suspend fun getProgressSummary(): ApiEnvelope<ProgressSummary>

    // --- Tasks ---
    @GET("tasks")
    suspend fun getTasks(
        @Query("status") status: String? = null,
        @Query("category") category: String? = null,
    ): ApiEnvelope<List<TaskItem>>

    @GET("tasks/today")
    suspend fun getTodayTasks(): ApiEnvelope<List<TaskItem>>

    @POST("tasks")
    suspend fun createTask(@Body task: CreateTaskRequest): ApiEnvelope<TaskItem>

    @PATCH("tasks/{id}")
    suspend fun updateTask(
        @Path("id") id: String,
        @Body updates: Map<String, @JvmSuppressWildcards Any?>,
    ): ApiEnvelope<TaskItem>

    @DELETE("tasks/{id}")
    suspend fun deleteTask(@Path("id") id: String): ApiEnvelope<TaskItem>

    // --- Prep Architect & AI Plans ---
    @GET("ai/prep-architect/latest")
    suspend fun getLatestPrepPlan(): ApiEnvelope<PrepPlan?>

    @POST("ai/prep-architect")
    suspend fun generatePrepPlan(@Body payload: Map<String, @JvmSuppressWildcards Any?> = emptyMap()): ApiEnvelope<PrepPlan>

    @POST("ai/quick-task")
    suspend fun generateQuickTask(@Body payload: QuickTaskRequest = QuickTaskRequest()): ApiEnvelope<AiQuickTaskResult>

    // --- Coach Me Through It & Reflection ---
    @POST("ai/help")
    suspend fun getCoachHelp(@Body payload: AiStuckHelpRequest): ApiEnvelope<AiStuckHelpResponse>

    @POST("ai/evaluate")
    suspend fun evaluateDaily(@Body payload: AiDailyEvaluationRequest): ApiEnvelope<AiDailyEvaluationResponse>

    // --- Nocturne Mentor ---
    @GET("ai/chat")
    suspend fun getMentorHistory(): ApiEnvelope<List<MentorMessage>>

    @POST("ai/chat")
    suspend fun sendMentorMessage(@Body payload: MentorMessageRequest): ApiEnvelope<MentorReply>

    @DELETE("ai/chat/history")
    suspend fun clearMentorHistory(): ApiEnvelope<Any?>

    // --- Power Pocket ---
    @GET("power-pocket/active")
    suspend fun getActivePowerPocket(): ApiEnvelope<PowerPocketSession?>

    @POST("power-pocket/start")
    suspend fun startPowerPocket(@Body payload: PowerPocketStartRequest): ApiEnvelope<PowerPocketSession>

    @POST("power-pocket/{id}/end")
    suspend fun endPowerPocket(
        @Path("id") sessionId: String,
        @Body payload: PowerPocketEndRequest = PowerPocketEndRequest(),
    ): ApiEnvelope<PowerPocketSession>

    // --- Assessments ---
    @GET("assessments/overview")
    suspend fun getAssessmentsOverview(): ApiEnvelope<AssessmentOverview>

    @POST("assessments/generate")
    suspend fun generateAssessment(
        @Body payload: Map<String, @JvmSuppressWildcards Any?> = emptyMap()
    ): ApiEnvelope<GenerateAssessmentResponse>

    @POST("assessments/{id}/submit")
    suspend fun submitAssessment(
        @Path("id") id: String,
        @Body payload: Map<String, @JvmSuppressWildcards Any?>
    ): ApiEnvelope<AssessmentSessionData>

    @POST("assessments/{id}/apply-plan-update")
    suspend fun applyPlanUpdate(
        @Path("id") id: String
    ): ApiEnvelope<Map<String, Any?>>

    // --- Coding Lab ---
    @GET("coding/languages")
    suspend fun getCodingLanguages(): ApiEnvelope<List<Map<String, Any?>>>

    @POST("coding/problem/resolve")
    suspend fun resolveCodingProblem(@Body payload: Map<String, @JvmSuppressWildcards Any?>): ApiEnvelope<CodingProblemSummary>

    @POST("coding/runs")
    suspend fun runCode(@Body payload: Map<String, @JvmSuppressWildcards Any?>): ApiEnvelope<CodingRunResult>

    @POST("coding/submissions")
    suspend fun submitCode(@Body payload: Map<String, @JvmSuppressWildcards Any?>): ApiEnvelope<CodingRunResult>

    // --- OAuth 2.1 Token Exchange ---
    @POST("../oauth/token")
    suspend fun exchangeOAuthToken(@Body payload: Map<String, @JvmSuppressWildcards Any?>): OAuthTokenResponse

    // --- Notifications & Profile ---
    @GET("notifications")
    suspend fun listNotifications(@Query("limit") limit: Int = 20): ApiEnvelope<List<NotificationItem>>

    @POST("notifications/sync")
    suspend fun syncNotifications(): NotificationSyncResult

    @POST("notifications/test-push")
    suspend fun testPushNotification(): ApiEnvelope<Map<String, Any?>>

    @GET("user-profile")
    suspend fun getUserProfile(): ApiEnvelope<UserProfileData>

    @PATCH("user-profile")
    suspend fun updateUserProfile(@Body payload: Map<String, @JvmSuppressWildcards Any?>): ApiEnvelope<UserProfileData>

    companion object {
        fun create(sessionStore: SecureSessionStore): PlacePrepApi {
            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            }

            val client = OkHttpClient.Builder()
                .dns(systemDnsWithGoogleFallback())
                .addInterceptor(AuthInterceptor(sessionStore))
                .addInterceptor(logging)
                .build()

            return Retrofit.Builder()
                .baseUrl(BuildConfig.API_BASE_URL)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(PlacePrepApi::class.java)
        }

        private fun systemDnsWithGoogleFallback(): Dns {
            val doh = DnsOverHttps.Builder()
                .client(OkHttpClient.Builder().build())
                .url("https://dns.google/dns-query".toHttpUrl())
                .bootstrapDnsHosts(
                    InetAddress.getByName("8.8.8.8"),
                    InetAddress.getByName("8.8.4.4"),
                )
                .build()

            return object : Dns {
                override fun lookup(hostname: String): List<InetAddress> {
                    return try {
                        Dns.SYSTEM.lookup(hostname)
                    } catch (error: UnknownHostException) {
                        doh.lookup(hostname)
                    }
                }
            }
        }
    }
}
