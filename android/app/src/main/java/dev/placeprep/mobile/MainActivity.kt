package dev.placeprep.mobile

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.core.content.ContextCompat
import dev.placeprep.mobile.notification.PlacePrepNotificationManager
import dev.placeprep.mobile.ui.MobileTab
import dev.placeprep.mobile.ui.PlacePrepApp
import dev.placeprep.mobile.ui.PlacePrepViewModel

class MainActivity : ComponentActivity() {

    private val viewModel by viewModels<PlacePrepViewModel> {
        PlacePrepViewModel.factory((application as PlacePrepApplication).repository, applicationContext)
    }

    private val requestNotificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { _ ->
            // Update workspace once permission is decided
            viewModel.refreshWorkspace()
        }

    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Request notification permission on Android 13+
        checkAndRequestNotificationPermission()

        // Setup network monitoring
        setupNetworkMonitoring()

        // Handle incoming intent (deep link or notification tap)
        handleIntent(intent)

        setContent {
            PlacePrepApp(viewModel = viewModel)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    override fun onDestroy() {
        super.onDestroy()
        networkCallback?.let {
            connectivityManager?.unregisterNetworkCallback(it)
        }
    }

    private fun checkAndRequestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                requestNotificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    private fun setupNetworkMonitoring() {
        connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                runOnUiThread { viewModel.setOfflineState(false) }
            }

            override fun onLost(network: Network) {
                runOnUiThread { viewModel.setOfflineState(true) }
            }
        }

        networkCallback?.let {
            connectivityManager?.registerNetworkCallback(request, it)
        }
    }

    private fun handleIntent(intent: Intent?) {
        if (intent == null) return

        // 1. Notification Tap extras
        val extraRoute = intent.getStringExtra(PlacePrepNotificationManager.EXTRA_ROUTE)
        if (!extraRoute.isNullOrBlank()) {
            routeToTarget(extraRoute)
            return
        }

        // 2. Deep links (placeprep:// or https://mvdev.in)
        val data: Uri? = intent.data
        if (data != null) {
            val scheme = data.scheme
            val host = data.host
            val path = data.path

            if (scheme == "placeprep") {
                when (host) {
                    "tasks" -> viewModel.switchTab(MobileTab.Tasks)
                    "architect" -> viewModel.switchTab(MobileTab.Architect)
                    "assessments" -> viewModel.switchTab(MobileTab.Assessments)
                    "coding" -> viewModel.switchTab(MobileTab.CodingLab)
                    "progress" -> viewModel.switchTab(MobileTab.Progress)
                    "mentor" -> viewModel.switchTab(MobileTab.Mentor)
                    "settings" -> viewModel.switchTab(MobileTab.Settings)
                    "dashboard" -> viewModel.switchTab(MobileTab.Dashboard)
                    "oauth" -> {
                        val token = data.getQueryParameter("token")
                        val code = data.getQueryParameter("code")
                        viewModel.handleOAuthCallback(code, token)
                    }
                }
            } else if (scheme == "https" && (host == "mvdev.in" || host == "placeprep-nine.vercel.app")) {
                if (path?.contains("oauth/callback") == true) {
                    val token = data.getQueryParameter("token")
                    val code = data.getQueryParameter("code")
                    viewModel.handleOAuthCallback(code, token)
                }
            }
        }
    }

    private fun routeToTarget(route: String) {
        when {
            route.contains("tasks") -> viewModel.switchTab(MobileTab.Tasks)
            route.contains("architect") -> viewModel.switchTab(MobileTab.Architect)
            route.contains("assessments") -> viewModel.switchTab(MobileTab.Assessments)
            route.contains("coding") -> viewModel.switchTab(MobileTab.CodingLab)
            route.contains("progress") -> viewModel.switchTab(MobileTab.Progress)
            route.contains("mentor") -> viewModel.switchTab(MobileTab.Mentor)
            route.contains("settings") -> viewModel.switchTab(MobileTab.Settings)
            else -> viewModel.switchTab(MobileTab.Dashboard)
        }
    }
}
