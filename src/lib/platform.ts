declare global {
  interface Window {
    PlacePrepAndroidShell?: {
      onRouteChanged?: (path?: string, title?: string) => void;
    };
    __PLACEPREP_ANDROID_APP__?: boolean;
  }
}

export function isPlacePrepAndroidApp() {
  if (typeof window === "undefined") {
    return false;
  }

  const bridgeAttached = Boolean(window.PlacePrepAndroidShell || window.__PLACEPREP_ANDROID_APP__);
  const userAgent =
    typeof navigator !== "undefined" && typeof navigator.userAgent === "string"
      ? navigator.userAgent
      : "";

  return bridgeAttached || /PlacePrepAndroid/i.test(userAgent);
}

export {};
