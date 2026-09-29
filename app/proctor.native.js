// Proctor helpers (native side). Web lives in proctor.web.js.
// On-device face detection needs a dev-build native module (ML Kit) — NOT
// installed (see docs/open_questions.md scope). Native sessions therefore run
// with camera indicator + backgrounding detection only, and are marked
// needs_review so a teacher can check them later. Honest, never blocking.
import { Platform, Linking, AppState } from "react-native";
import { getCameraPermissionsAsync, requestCameraPermissionsAsync } from "expo-camera";
import * as ScreenCapture from "expo-screen-capture";

const API = () => process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export const FACE_DETECTION = "unsupported-native";

export async function logPerm(userId, feature, from, to) {
  fetch(`${API()}/api/permission-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_id: userId || "", feature, from_state: from || "", to_state: to, platform: Platform.OS }),
  }).catch(() => {});
}

// granted | denied_once | permanently_denied
export async function cameraStatus() {
  const p = await getCameraPermissionsAsync();
  if (p.granted) return "granted";
  return p.canAskAgain ? "denied_once" : "permanently_denied";
}

export async function requestCamera() {
  const p = await requestCameraPermissionsAsync();
  if (p.granted) return "granted";
  const after = await getCameraPermissionsAsync();
  return after.canAskAgain ? "denied_once" : "permanently_denied";
}

// FLAG_SECURE equivalent: blocks screenshots (and recording on Android).
export async function setSecureScreen(on) {
  try {
    if (on) await ScreenCapture.preventScreenCaptureAsync();
    else await ScreenCapture.allowScreenCaptureAsync();
    return true;
  } catch {
    return false;
  }
}

// Backgrounding detection. Returns unsubscribe.
export function watchAppState(onBackground) {
  const sub = AppState.addEventListener("change", (s) => {
    if (s === "background" || s === "inactive") onBackground("backgrounded");
  });
  return () => sub.remove();
}

export async function detectImage() {
  return null; // Android on-device ML needs a dev-build native module (see docs)
}

export async function captureSnapshot() {
  return null; // snapshot comes from the CameraView ref in the session screen
}

export function openAppSettings() {
  Linking.openSettings().catch(() => {});
}
