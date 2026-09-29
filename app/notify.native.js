// Push + permission helpers (native side). Web lives in notify.web.js.
// Expo Go supports local scheduling + the full permission UX; remote FCM
// delivery needs a dev build with our google-services.json (see docs).
import { Platform, Linking } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

const API = () => process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export async function logPerm(userId, feature, from, to) {
  fetch(`${API()}/api/permission-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_id: userId || "", feature, from_state: from || "", to_state: to, platform: Platform.OS }),
  }).catch(() => {});
}

export async function setupChannels() {
  await Notifications.setNotificationChannelAsync("study-reminders", {
    name: "Study reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync("exam-alerts", {
    name: "Exam alerts",
    importance: Notifications.AndroidImportance.HIGH,
  });
}

// granted | denied_once | permanently_denied
export async function notifStatus() {
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return "granted";
  if (p.canAskAgain) return "denied_once";
  return "permanently_denied";
}

export async function requestNotifPermission() {
  const p = await Notifications.requestPermissionsAsync();
  if (p.granted) return "granted";
  const after = await Notifications.getPermissionsAsync();
  return after.canAskAgain ? "denied_once" : "permanently_denied";
}

// FCM device token for OUR Firebase project (dev build). In Expo Go this
// throws — callers must degrade to in-app reminders.
export async function registerToken(userId) {
  if (!Device.isDevice) throw new Error("Push tokens need a real device, not a simulator.");
  const { data } = await Notifications.getDevicePushTokenAsync();
  const res = await fetch(`${API()}/api/device-tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, platform: Platform.OS, token: data }),
  });
  if (!res.ok) throw new Error("Token upload failed.");
  return data;
}

export function openAppSettings() {
  Linking.openSettings().catch(() => {});
}

// Local (on-device) reminder. Inexact on Android 12+ by design (see Q3):
// the OS may deliver up to ~15 min late. Never touches the Clock app.
export async function scheduleLocalReminder({ title, body, seconds }) {
  await setupChannels();
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: { seconds: Math.max(seconds, 60), channelId: "study-reminders" },
  });
}
