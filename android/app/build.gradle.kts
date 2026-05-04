import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val versionCodeValue = (project.findProperty("PLACEPREP_VERSION_CODE") as String?)
    ?.toIntOrNull()
    ?: 1
val versionNameValue = (project.findProperty("PLACEPREP_VERSION_NAME") as String?)
    ?.trim()
    ?.takeIf { it.isNotEmpty() }
    ?: "1.0.0"
val defaultApiBaseUrl = (project.findProperty("PLACEPREP_API_BASE_URL") as String?)
    ?.trim()
    ?.takeIf { it.isNotEmpty() }
    ?: "http://10.0.2.2:5000/api/"
val debugApiBaseUrl = (project.findProperty("PLACEPREP_API_BASE_URL_DEBUG") as String?)
    ?.trim()
    ?.takeIf { it.isNotEmpty() }
    ?: defaultApiBaseUrl
val releaseApiBaseUrl = (project.findProperty("PLACEPREP_API_BASE_URL_RELEASE") as String?)
    ?.trim()
    ?.takeIf { it.isNotEmpty() }
    ?: defaultApiBaseUrl
val appName = (project.findProperty("PLACEPREP_APP_NAME") as String?)
    ?.trim()
    ?.takeIf { it.isNotEmpty() }
    ?: "PlacePrep"
val debugAppName = (project.findProperty("PLACEPREP_DEBUG_APP_NAME") as String?)
    ?.trim()
    ?.takeIf { it.isNotEmpty() }
    ?: "$appName Dev"

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("keystore.properties")
if (keystorePropertiesFile.exists()) {
    keystorePropertiesFile.inputStream().use(keystoreProperties::load)
}

fun keystoreValue(key: String): String? =
    keystoreProperties.getProperty(key)?.trim()?.takeIf { it.isNotEmpty() }

val releaseStoreFilePath = keystoreValue("storeFile")
val releaseStoreFile = releaseStoreFilePath?.let { rootProject.file(it) }
val releaseSigningReady =
    releaseStoreFile?.exists() == true
        && !keystoreValue("storePassword").isNullOrBlank()
        && !keystoreValue("keyAlias").isNullOrBlank()
        && !keystoreValue("keyPassword").isNullOrBlank()

android {
    namespace = "dev.placeprep.mobile"
    compileSdk = 35

    defaultConfig {
        applicationId = "dev.placeprep.mobile"
        minSdk = 26
        targetSdk = 35
        versionCode = versionCodeValue
        versionName = versionNameValue

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        resValue("string", "app_name", appName)
        buildConfigField("String", "APP_ENV", "\"production\"")
        buildConfigField("String", "API_BASE_URL", "\"$releaseApiBaseUrl\"")
    }

    signingConfigs {
        create("release") {
            if (releaseSigningReady) {
                storeFile = releaseStoreFile
                storePassword = keystoreValue("storePassword")
                keyAlias = keystoreValue("keyAlias")
                keyPassword = keystoreValue("keyPassword")
                enableV1Signing = true
                enableV2Signing = true
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".dev"
            versionNameSuffix = "-dev"
            resValue("string", "app_name", debugAppName)
            buildConfigField("String", "APP_ENV", "\"debug\"")
            buildConfigField("String", "API_BASE_URL", "\"$debugApiBaseUrl\"")
        }
        release {
            isMinifyEnabled = false
            if (releaseSigningReady) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.15"
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

if (!releaseSigningReady) {
    println("PlacePrep Android release signing is not configured. Add android/keystore.properties to build a signed APK.")
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.navigation:navigation-compose:2.8.5")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    implementation(composeBom)
    androidTestImplementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("com.google.android.material:material:1.12.0")

    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:okhttp-dnsoverhttps:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
