package dev.placeprep.mobile.util

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent

object OAuthLauncher {
    private const val OAUTH_BASE_URL = "https://placeprep-api-production-2481.up.railway.app/oauth/authorize"
    private const val CLIENT_ID = "placeprep-mobile-app"
    private const val REDIRECT_URI = "placeprep://oauth/callback"
    private const val CODE_CHALLENGE = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    private const val CODE_CHALLENGE_METHOD = "S256"
    private const val SCOPES = "openid profile email placeprep:all"

    fun buildAuthUrl(state: String = "mobile_login"): String {
        return "$OAUTH_BASE_URL?response_type=code&client_id=$CLIENT_ID&redirect_uri=${Uri.encode(REDIRECT_URI)}&scope=${Uri.encode(SCOPES)}&state=${Uri.encode(state)}&code_challenge=$CODE_CHALLENGE&code_challenge_method=$CODE_CHALLENGE_METHOD"
    }

    fun launch(context: Context, state: String = "mobile_login") {
        val authUri = Uri.parse(buildAuthUrl(state))
        try {
            val colorSchemeParams = CustomTabColorSchemeParams.Builder()
                .setToolbarColor(0xFF0F121B.toInt()) // PlacePrep Nocturne card color
                .setNavigationBarColor(0xFF07080D.toInt()) // PlacePrep background color
                .build()

            val customTabsIntent = CustomTabsIntent.Builder()
                .setDefaultColorSchemeParams(colorSchemeParams)
                .setShowTitle(true)
                .setUrlBarHidingEnabled(true)
                .setShareState(CustomTabsIntent.SHARE_STATE_OFF)
                .build()

            customTabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            customTabsIntent.launchUrl(context, authUri)
        } catch (_: Exception) {
            val fallbackIntent = Intent(Intent.ACTION_VIEW, authUri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(fallbackIntent)
        }
    }
}
