package dev.placeprep.mobile.data

import dev.placeprep.mobile.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface PlacePrepApi {
    @POST("auth/register")
    suspend fun register(@Body payload: RegisterRequest): ApiEnvelope<AuthSession>

    @POST("auth/login")
    suspend fun login(@Body payload: LoginRequest): ApiEnvelope<AuthSession>

    @GET("auth/me")
    suspend fun getMe(): ApiEnvelope<MobileUser>

    @GET("progress/summary")
    suspend fun getProgressSummary(): ApiEnvelope<ProgressSummary>

    @GET("tasks/today")
    suspend fun getTodayTasks(): ApiEnvelope<List<TaskItem>>

    @GET("ai/prep-architect/latest")
    suspend fun getLatestPrepPlan(): ApiEnvelope<PrepPlan?>

    @POST("ai/quick-task")
    suspend fun generateQuickTask(@Body payload: QuickTaskRequest = QuickTaskRequest()): ApiEnvelope<AiQuickTaskResult>

    @GET("power-pocket/active")
    suspend fun getActivePowerPocket(): ApiEnvelope<PowerPocketSession?>

    @POST("power-pocket/start")
    suspend fun startPowerPocket(@Body payload: PowerPocketStartRequest): ApiEnvelope<PowerPocketSession>

    @POST("power-pocket/{id}/end")
    suspend fun endPowerPocket(
        @Path("id") sessionId: String,
        @Body payload: PowerPocketEndRequest = PowerPocketEndRequest(),
    ): ApiEnvelope<PowerPocketSession>

    @GET("ai/chat")
    suspend fun getMentorHistory(): ApiEnvelope<List<MentorMessage>>

    @POST("ai/chat")
    suspend fun sendMentorMessage(@Body payload: MentorMessageRequest): ApiEnvelope<MentorReply>

    companion object {
        fun create(sessionStore: SecureSessionStore): PlacePrepApi {
            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            }

            val client = OkHttpClient.Builder()
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
    }
}
