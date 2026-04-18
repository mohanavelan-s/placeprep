/**
 * Platform detection utilities
 */

/**
 * Check if the app is running in the PlacePrep Android app
 */
export function isPlacePrepAndroidApp(): boolean {
  // Check for Android-specific user agent or injected interface
  if (typeof window === "undefined") {
    return false;
  }

  // Check for Android user agent
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isAndroid = userAgent.includes("android");

  // Check if running in the PlacePrep Android app
  // The Android app might inject a specific interface or set a flag
  const hasAndroidInterface = "PlacePrepAndroid" in window;

  return isAndroid && hasAndroidInterface;
}
