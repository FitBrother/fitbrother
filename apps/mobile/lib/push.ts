import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerPushToken } from "@/lib/api/achievements";

// Foreground display behaviour: show the banner even with the app open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function resolveProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * Ask for notification permission and register the Expo push token with the
 * backend. Safe to call on every app entry — idempotent (the server upserts on
 * the UNIQUE token). No-ops on simulators (no push token) and on web.
 *
 * Never throws: push is additive, so a failure here must not break app boot.
 */
export async function registerForPushNotificationsAsync(): Promise<void> {
  try {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;
    if (!Device.isDevice) return;

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }
    if (!granted) return;

    const projectId = resolveProjectId();
    if (!projectId) return; // can't mint an Expo token without an EAS project

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerPushToken(token, Platform.OS);
  } catch {
    // swallow — permission denied, offline, missing token, etc.
  }
}
