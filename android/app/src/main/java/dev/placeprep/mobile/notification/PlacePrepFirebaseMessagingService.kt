package dev.placeprep.mobile.notification

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dev.placeprep.mobile.PlacePrepApplication
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class PlacePrepFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        PlacePrepNotificationManager.cacheFcmToken(applicationContext, token)
        Log.i("PlacePrepFCM", "Refreshed FCM token received: ${PlacePrepNotificationManager.maskToken(token)}")

        val app = applicationContext as? PlacePrepApplication ?: return
        val sessionToken = app.sessionStore.getToken()
        if (!sessionToken.isNullOrBlank()) {
            CoroutineScope(Dispatchers.IO).launch {
                runCatching {
                    app.repository.registerDevice(token)
                    Log.i("PlacePrepFCM", "Synchronized refreshed FCM token with authenticated user profile.")
                }.onFailure { err ->
                    Log.w("PlacePrepFCM", "Failed to sync refreshed FCM token: ${err.message}")
                }
            }
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val title = remoteMessage.notification?.title
            ?: remoteMessage.data["title"]
            ?: "PlacePrep"
        val message = remoteMessage.notification?.body
            ?: remoteMessage.data["message"]
            ?: "Preparation update from Command Chamber"
        val route = remoteMessage.data["route"] ?: "/tasks"
        val taskId = remoteMessage.data["taskId"]
        val type = remoteMessage.data["type"] ?: "general"
        val notificationId = (remoteMessage.data["id"] ?: System.currentTimeMillis().toString()).hashCode()

        Log.i("PlacePrepFCM", "Remote message received: type=$type, route=$route")

        PlacePrepNotificationManager.showNotification(
            context = applicationContext,
            title = title,
            message = message,
            route = route,
            taskId = taskId,
            type = type,
            notificationId = notificationId
        )
    }
}
