package dev.placeprep.mobile.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SecureSessionStore(context: Context) {
    private val prefs: SharedPreferences =
        runCatching {
            EncryptedSharedPreferences.create(
                context,
                "placeprep.secure.session",
                MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build(),
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        }.getOrElse {
            context.getSharedPreferences("placeprep.session.fallback", Context.MODE_PRIVATE)
        }

    fun getToken(): String? = runCatching { prefs.getString("token", null) }.getOrNull()

    fun saveToken(token: String?) {
        runCatching {
            prefs.edit().putString("token", token).apply()
        }
    }
}
