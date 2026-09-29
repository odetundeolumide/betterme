# Privacy checklist — READ BEFORE LAUNCH

This file lists what needs legal review. **It does not claim compliance**
with any law. Owner for every item below: TBD (pre-launch decision).

## Nigeria Data Protection Act 2023 (NDPA)
- [ ] Confirm BetterMe's role (controller vs processor) for student data, quiz data, snapshots, device tokens.
- [ ] Age of consent handling: users are secondary-school minors — parental/guardian consent flow reviewed by counsel.
- [ ] Data Protection Impact Assessment (DPIA) completed for camera snapshots + minors' data. Owner: TBD.
- [ ] Registration/filing with the Nigeria Data Protection Commission (NDPC), if applicable to our scale. Owner: TBD.
- [ ] Data subject rights path tested end-to-end: access, correction, deletion (in-app form → controller action → confirmation).
- [ ] Cross-border transfer note: Firebase (Google), Gemini API, Cloudflare R2 — where is data stored/processed? Disclose in the notice.

## Consent wording (needs reviewer, not an engineer)
- [ ] Camera notice text (what is captured, who sees it, how long kept) reviewed.
- [ ] Parent/guardian in-app checkbox wording reviewed — is a student-ticked box sufficient evidence of parental consent?
- [ ] Notification pre-prompt wording reviewed (honest, no dark patterns).

## Data minimisation (engineered, to verify)
- [ ] No audio collected anywhere (client + server). Verified by code search.
- [ ] Snapshots only on flag trigger, never continuous video. Verified.
- [ ] Permission events carry no personal data (student_id is the app id; confirm acceptable).
- [ ] Device tokens pruned on invalid-token FCM errors.
- [ ] Snapshots auto-deleted per retention setting; purge log reviewed.
- [ ] `last_verified_at`-style audit: snapshot views logged (when teacher review ships).

## Store forms (drafted from actual code in Part C)
- [ ] Google Play data-safety form text matches collected data (location? No. contacts? No. photos? snapshots-on-flag only. personal info? email + study data).
- [ ] Play camera-use declaration: foreground exam proctoring only, indicator shown, consent-gated.
- [ ] App Store privacy details ("nutrition labels") filled from the same inventory.

## Controller contact (set)
- Odetunde Olumide, odetundeolumide94@gmail.com — shown in the privacy notice and deletion screen.
