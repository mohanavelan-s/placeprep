package dev.placeprep.mobile.data

import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor(
    private val sessionStore: SecureSessionStore,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val requestBuilder = chain.request().newBuilder()
        sessionStore.getToken()?.let { token ->
            requestBuilder.addHeader("Authorization", "Bearer $token")
        }
        return chain.proceed(requestBuilder.build())
    }
}
