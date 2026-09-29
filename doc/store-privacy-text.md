# Store privacy texts — drafted FROM the actual code (verify before submitting)

## Google Play — Data safety form
- **Location**: No collection.
- **Personal info**: email address (account login, Better Auth). Name if provided at sign-up.
- **Photos and videos**: exam snapshots ONLY — short stills captured on proctor flags (no face / extra face / head turned / tab switch), never continuous video. Stored encrypted, auto-deleted 30 days after results are final.
- **Audio**: never collected, no microphone permission requested.
- **App activity**: quiz attempts, topic progress, study plans (in-app functionality).
- **Device IDs**: FCM push token (only if the student allows reminders).
- **Data sharing**: Firebase Cloud Messaging (push delivery), Google Gemini API (tutor answers), Cloudflare R2 (snapshot storage, planned). No advertising, no sale of data.
- **Security**: data in transit encrypted (HTTPS); account auth via Better Auth; deletion on in-app request.

## Google Play — camera-use declaration (foreground service / sensitive permission)
- Camera is used ONLY during proctored exams the student explicitly starts, after school + parent/guardian consent recorded in-app.
- A persistent on-screen indicator (red ● REC + preview) shows while the camera is active.
- Camera turns off the moment the exam ends or the app is backgrounded.
- No background camera use. Flags never auto-fail an exam; teacher review only.

## App Store — privacy details
- Contact Info (email): linked to user, for account functionality.
- User Content (exam snapshots): linked to user, for proctoring review; retained 30 days post-results.
- Identifiers (push token): linked to user, only with consent, for notifications.
- Usage Data (quiz progress, plans): linked to user, for app functionality.
- Diagnostics (anonymous permission-event counts): not linked, for analytics.
- Data Not Collected: precise location, audio, contacts, browsing history.

## Auditor cross-check (do before submitting)
- [ ] Every line above still matches the code (search: getUserMedia, CameraView, takePictureAsync, messaging, device_tokens).
- [ ] No new SDK was added since this was written.
