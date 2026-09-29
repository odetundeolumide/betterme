// Push + permission helpers (web side). Native lives in notify.native.js.
const API = () => process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export async function logPerm(userId, feature, from, to) {
  fetch(`${API()}/api/permission-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_id: userId || "", feature, from_state: from || "", to_state: to, platform: "web" }),
  }).catch(() => {});
}

export async function setupChannels() {}

// granted | denied_once | permanently_denied | unsupported
export async function notifStatus() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "permanently_denied";
  return "denied_once"; // "default" — can still ask (once, after a tap)
}

// iPhone web push only works installed to the home screen.
export function iosNeedsInstall() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent || "");
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
  return ios && !standalone;
}

export async function requestNotifPermission() {
  const r = await Notification.requestPermission();
  return r === "granted" ? "granted" : "permanently_denied";
}

// FCM token via Firebase JS SDK + our minimal service worker (/sw.js).
// Background messages additionally need public/firebase-messaging-sw.js
// filled with the web config (see .env.example FIREBASE_*).
export async function registerToken(userId) {
  await navigator.serviceWorker.register("/sw.js");
  const { initializeApp } = await import("firebase/app");
  const { getMessaging, getToken, onMessage } = await import("firebase/messaging");
  const app = initializeApp({
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  });
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: process.env.EXPO_PUBLIC_FCM_VAPID_KEY });
  if (!token) throw new Error("No push token issued.");
  const res = await fetch(`${API()}/api/device-tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, platform: "web", token }),
  });
  if (!res.ok) throw new Error("Token upload failed.");
  onMessage(messaging, () => {});
  return token;
}

export function openAppSettings() {}

export async function scheduleLocalReminder() {
  throw new Error("Local scheduling is Android-only; web uses push or in-app reminders.");
}
