package dev.placeprep.mobile

import android.app.Application
import dev.placeprep.mobile.data.PlacePrepRepository
import dev.placeprep.mobile.data.SecureSessionStore
import dev.placeprep.mobile.notification.NotificationSyncWorker
import dev.placeprep.mobile.notification.PlacePrepNotificationManager

class PlacePrepApplication : Application() {
    val sessionStore by lazy { SecureSessionStore(this) }
    val repository by lazy { PlacePrepRepository(sessionStore) }

    override fun onCreate() {
        super.onCreate()
        PlacePrepNotificationManager.createNotificationChannels(this)
        NotificationSyncWorker.schedule(this)
    }
}
