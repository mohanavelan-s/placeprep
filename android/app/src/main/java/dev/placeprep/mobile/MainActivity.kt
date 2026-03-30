package dev.placeprep.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import dev.placeprep.mobile.ui.PlacePrepApp
import dev.placeprep.mobile.ui.PlacePrepViewModel

class MainActivity : ComponentActivity() {
    private val viewModel by viewModels<PlacePrepViewModel> {
        PlacePrepViewModel.factory((application as PlacePrepApplication).repository)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            PlacePrepApp(viewModel = viewModel)
        }
    }
}
