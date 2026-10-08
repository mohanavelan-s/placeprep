package dev.placeprep.mobile.notification

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dev.placeprep.mobile.PlacePrepApplication
import java.util.concurrent.TimeUnit

class NotificationSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        return try {
            val app = applicationContext as? PlacePrepApplication ?: return Result.success()
            val token = app.sessionStore.getToken()
            if (token.isNullOrBlank()) {
                return Result.success()
            }

            if (!PlacePrepNotificationManager.hasNotificationPermission(applicationContext)) {
                return Result.success()
            }

            val syncResult = runCatching { app.repository.syncNotifications() }.getOrNull()
            if (syncResult != null && syncResult.created.isNotEmpty()) {
                for (note in syncResult.created) {
                    val route = note.metadata?.get("route") as? String ?: "/tasks"
                    PlacePrepNotificationManager.showNotification(
                        context = applicationContext,
                        title = "PlacePrep Reminder",
                        message = note.message,
                        route = route,
                        type = note.type,
                        notificationId = note.id.hashCode()
                    )
                }
            }

            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    companion object {
        private const val WORK_NAME = "placeprep_notification_sync_work"

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<NotificationSyncWorker>(
                15, TimeUnit.MINUTES
            ).build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }
}
