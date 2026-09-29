// Minimal service worker so FCM can issue a token on web.
// Background-message handling lives in firebase-messaging-sw.js (needs the
// web firebaseConfig — see .env.example FIREBASE_*).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => self.clients.claim());
