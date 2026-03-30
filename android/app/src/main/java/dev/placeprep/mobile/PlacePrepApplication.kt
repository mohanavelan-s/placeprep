package dev.placeprep.mobile

import android.app.Application
import dev.placeprep.mobile.data.PlacePrepRepository
import dev.placeprep.mobile.data.SecureSessionStore

class PlacePrepApplication : Application() {
    val sessionStore by lazy { SecureSessionStore(this) }
    val repository by lazy { PlacePrepRepository(sessionStore) }
}
