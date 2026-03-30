# PlacePrep Android

- Kotlin + Jetpack Compose
- Retrofit API client
- EncryptedSharedPreferences for JWT storage
- Screens: Login, Dashboard, Tasks, Nocturne Mentor

Set `PLACEPREP_API_BASE_URL` in `~/.gradle/gradle.properties` or project `gradle.properties`.

Examples:

- Production: `https://placeprep-api-production.up.railway.app/api/`
- Local emulator: `http://10.0.2.2:5000/api/`
- Ngrok: `https://your-ngrok-domain.ngrok-free.app/api/`

Release-ready project properties already live in `android/gradle.properties`:

- `PLACEPREP_VERSION_CODE`
- `PLACEPREP_VERSION_NAME`
- `PLACEPREP_API_BASE_URL_RELEASE`
- `PLACEPREP_API_BASE_URL_DEBUG`

To build a signed APK:

1. Copy `android/keystore.properties.example` to `android/keystore.properties`
2. Fill in your real keystore file, alias, and passwords
3. Open the `android` folder in Android Studio
4. Let Gradle sync
5. Build using `Build > Generate Signed Bundle / APK`
6. Choose `APK`

If `android/keystore.properties` is missing, release builds remain unsigned and Android Studio will prompt you during the signed APK flow.
