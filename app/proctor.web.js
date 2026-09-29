// Proctor helpers (web side). Native lives in proctor.native.js.
// Detection: MediaPipe Face Landmarker (lazy, runtime model download).
// Visibility/fullscreen via Page Visibility + Fullscreen APIs. HTTPS required
// (localhost excepted for dev).
import { Platform } from "react-native";

const API = () => process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
export const FACE_DETECTION = "mediapipe";

export async function logPerm(userId, feature, from, to) {
  fetch(`${API()}/api/permission-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_id: userId || "", feature, from_state: from || "", to_state: to, platform: "web" }),
  }).catch(() => {});
}

let camAttempts = 0;

// granted | denied_once | permanently_denied | no_camera | in_use
export async function cameraStatus() {
  if (!navigator.mediaDevices?.getUserMedia) return "no_camera";
  return "denied_once";
}

export async function requestCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((t) => t.stop());
    return "granted";
  } catch (e) {
    if (e?.name === "NotFoundError" || e?.name === "OverconstrainedError") return "no_camera";
    if (e?.name === "NotReadableError") return "in_use";
    camAttempts += 1; // NotAllowedError: can't tell once vs permanent
    return camAttempts > 1 ? "permanently_denied" : "denied_once";
  }
}

export async function setSecureScreen() {
  return false; // screenshots can't be blocked on web; sessions note this
}

export function watchAppState(onBackground) {
  const vis = () => {
    if (document.hidden) onBackground("tab_switch");
  };
  const fs = () => {
    if (!document.fullscreenElement) onBackground("fullscreen_exit");
  };
  document.addEventListener("visibilitychange", vis);
  document.addEventListener("fullscreenchange", fs);
  return () => {
    document.removeEventListener("visibilitychange", vis);
    document.removeEventListener("fullscreenchange", fs);
  };
}

let landmarker = null;
async function getLandmarker() {
  if (landmarker) return landmarker;
  // Full URL assembled at runtime (array join) so Metro leaves it alone —
  // the bundler cannot parse this package's .mjs. The browser loads it as
  // native ESM from CDN. Needs internet once for the ~3MB model — no
  // network, no detection; the session simply continues and can be
  // flagged for review.
  const parts = ["https:", "", "cdn.jsdelivr.net", "npm", "@mediapipe", "tasks-vision@1.0.1", "vision_bundle.mjs"];
  const bundleUrl = parts.join("/");
  // Loaded via `new Function` so Metro's parser never sees an import call
  // (it rejects even opaque dynamic imports at parse time). Web-only file,
  // so plain browser ESM handles it.
  const loadModule = new Function("url", "return import(url)");
  const { FilesetResolver, FaceLandmarker } = await loadModule(bundleUrl);
  const fileset = await FilesetResolver.forVisionTasks(
    ["https:", "", "cdn.jsdelivr.net", "npm", "@mediapipe", "tasks-vision@1.0.1", "wasm"].join("/")
  );
  landmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    },
    runningMode: "IMAGE",
    numFaces: 2,
  });
  return landmarker;
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Returns { faces, yawDeg, pitchDeg } or null when unavailable.
export async function detectImage(dataUrl) {
  try {
    const lm = await getLandmarker();
    const img = await loadImage(dataUrl);
    const res = lm.detect(img);
    const faces = res.faceLandmarks?.length || 0;
    let yawDeg = 0;
    let pitchDeg = 0;
    const m = res.facialTransformationMatrixes?.[0]?.data;
    if (m) {
      yawDeg = (Math.atan2(m[8], m[10]) * 180) / Math.PI;
      pitchDeg = (Math.asin(Math.max(-1, Math.min(1, -m[9]))) * 180) / Math.PI;
    }
    return { faces, yawDeg, pitchDeg };
  } catch {
    return null;
  }
}

export async function detectFaces() {
  return null; // use detectImage() with a CameraView snapshot instead
}

export function captureSnapshot(videoEl) {
  try {
    const w = Math.min(320, videoEl.videoWidth || 320);
    const h = Math.round(w * ((videoEl.videoHeight || 240) / (videoEl.videoWidth || 320)));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d").drawImage(videoEl, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.6);
  } catch {
    return null;
  }
}

export function openAppSettings() {}
