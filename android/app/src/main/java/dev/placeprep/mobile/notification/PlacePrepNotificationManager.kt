package dev.placeprep.mobile.notification

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import dev.placeprep.mobile.MainActivity
import dev.placeprep.mobile.R

object PlacePrepNotificationManager {

    const val CHANNEL_TASKS = "placeprep_channel_tasks"
    const val CHANNEL_SIGNALS = "placeprep_channel_signals"
    const val CHANNEL_MOTIVATION = "placeprep_channel_motivation"

    const val EXTRA_ROUTE = "extra_route"
    const val EXTRA_TASK_ID = "extra_task_id"
    const val EXTRA_TYPE = "extra_type"

    fun createNotificationChannels(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val tasksChannel = NotificationChannel(
                CHANNEL_TASKS,
                "PlacePrep Task Reminders",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Reminders for scheduled preparation tasks and milestones"
                enableVibration(true)
            }

            val signalsChannel = NotificationChannel(
                CHANNEL_SIGNALS,
                "PlacePrep Signals & Deadlines",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Important streak alerts, daily reviews, and system signals"
                enableVibration(true)
            }

            val motivationChannel = NotificationChannel(
                CHANNEL_MOTIVATION,
                "Daily Motivation & Insights",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Daily quotes, company track tips, and consistency guidance"
            }

            notificationManager.createNotificationChannels(
                listOf(tasksChannel, signalsChannel, motivationChannel)
            )
        }
    }

    fun hasNotificationPermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            NotificationManagerCompat.from(context).areNotificationsEnabled()
        }
    }

    fun showNotification(
        context: Context,
        title: String,
        message: String,
        route: String? = "/tasks",
        taskId: String? = null,
        type: String = "general",
        notificationId: Int = System.currentTimeMillis().toInt()
    ) {
        if (!hasNotificationPermission(context)) {
            return
        }

        createNotificationChannels(context)

        val channelId = when (type.lowercase()) {
            "pending_tasks", "task_reminder", "task" -> CHANNEL_TASKS
            "motivation" -> CHANNEL_MOTIVATION
            else -> CHANNEL_SIGNALS
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_ROUTE, route)
            putExtra(EXTRA_TASK_ID, taskId)
            putExtra(EXTRA_TYPE, type)
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_launcher_p_mark)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setColor(0xFF9C2E34.toInt())
            .build()

        NotificationManagerCompat.from(context).notify(notificationId, notification)
    }

    fun showLoginWelcomeNotification(context: Context, userName: String, streak: Int = 0) {
        val streakText = if (streak > 0) "🔥 $streak-day streak active. " else ""
        showNotification(
            context = context,
            title = "Welcome back, $userName!",
            message = "${streakText}Command Chamber is ready for today's prep execution.",
            route = "chamber",
            type = "login_welcome",
            notificationId = 1001,
        )
    }

    private const val PREFS_NAME = "placeprep_device_prefs"
    private const val KEY_DEVICE_TOKEN = "device_token"
    private const val KEY_FCM_TOKEN = "fcm_token"

    fun maskToken(token: String?): String {
        if (token == null) return "null"
        if (token.length <= 10) return "***"
        return "${token.take(6)}...${token.takeLast(4)}"
    }

    fun getCachedFcmToken(context: Context): String? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_FCM_TOKEN, null)
    }

    fun cacheFcmToken(context: Context, token: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_FCM_TOKEN, token).apply()
    }

    fun clearCachedFcmToken(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().remove(KEY_FCM_TOKEN).apply()
    }

    fun getOrGenerateDeviceToken(context: Context): String {
        val cached = getCachedFcmToken(context)
        if (!cached.isNullOrBlank()) {
            return cached
        }
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        var token = prefs.getString(KEY_DEVICE_TOKEN, null)
        if (token.isNullOrBlank()) {
            token = "android-" + java.util.UUID.randomUUID().toString()
            prefs.edit().putString(KEY_DEVICE_TOKEN, token).apply()
        }
        return token
    }
}
