# BetterMe — Implementation Plan (Phased)

Source: `doc/exam-prep-companion-app-prd.md` (Draft v1, Sep 20 2026), `doc/exam-prep-companion-app-features.md`, `doc/betterme-project-brief.md`.
Repo state: docs-only. This plan covers all requirements A1–O3.

## 0. Decisions & Stack (confirm before Phase 1)

- **Primary launch exam:** WAEC-first recommended (largest low-data need). TOEFL/SAT/GRE content follows the same schema.
- **Open Qs (PRD §10):** leaderboard defaults to exam-filtered; tutor links to notes; home order = Continue > This-week plan > Progress > Tutor; community = report + hide after N reports + maintainer review.
- **Stack:** Expo React Native (Android/iOS/Web, one codebase) + Supabase (Postgres, Auth, Storage) + expo-sqlite offline queue + LLM API for tutor. All free-tier compatible (PRD A7).
- **Adaptive v1:** rule-based, not ML. Start at difficulty 2/3; +1 after 2 correct in a row, −1 after 2 wrong. Applies to D3 and P3.

## Data model v1

```text
users(id, email, reminder_time)
exam_progress(user_id, exam, exam_date, target, diagnostic_done)
exams(code) topics(exam_code, subject, name) 
questions(id, exam_code, topic, stem, options[4], answer_idx, explanation, difficulty 1-3)
notes(topic_id, body_md)
attempts(id, user_id, exam_code, topic, question_ids, answers, score, duration_s, offline_created_at, synced_at)
mock_results(id, user_id, exam_code, score, breakdown_json, taken_at)
plans(user_id, exam_code, week, goals_json, status)
badges(user_id, code, awarded_at) posts(id, user_id, exam_tag, topic_tag, title, body, created_at)
answers(post_id, user_id, body, is_accepted) reports(question_id|post_id, reason, status)
```

## Phase 0 — Foundations (1 wk)

- Monorepo layout: `app/`, `supabase/` (migrations, seeds), `content/` (CSV → seed scripts).
- Design tokens, nav shell, CI (lint + typecheck + unit), analytics events for PRD §8 (diagnostic_finish, quiz_finish, mock_finish, tutor_ask, report_create).
- Seed: 50 questions + 5 notes for WAEC to unblock Phases 1–3.
- Exit: `npx expo start` runs; login → empty home renders.

## Phase 1 — Accounts, Exams, Home shell (A1–A7, H skeleton)

- A1 signup/login (Supabase Auth). A2 exam picker (WAEC/TOEFL/SAT/GRE). A3 switcher. A4 per-exam progress isolation (`exam_progress`). A5/A6 optional date/target. A7 no paywall checks.
- Home skeleton: Continue (H1), tutor shortcut (H2), recent progress stub (H3), badges/reminder status (H4), countdown iff date set (H5), weakest-topic link stub (H6 → filled in Phase 3).
- Acceptance: new user → picker → diagnostic prompt (D1). Switch exam keeps separate progress.
- Screens: Auth, ExamPicker, Home.

## Phase 2 — Diagnostic + Results (D1–D6)

- D1 diagnostic is first after exam pick. D2 ~15Q short test. D3 adaptive (rule above). D4 one-sitting default + pause/resume via local draft (`attempts` with `status=draft`).
- D5 results: per-topic % across subjects. D6 tap topic → practice filtered by topic.
- Acceptance: finish rate instrumented; results render even with 1 attempt; resume restores index + timer.
- Screens: Diagnostic, DiagnosticResults.

## Phase 3 — Practice + Notes + Quality loop (P1–P7, N1–N3)

- P1 topic practice. P2 per-quiz timer (exam-realistic default per exam). P3 adaptive difficulty. P4 post-quiz breakdown (score, per-topic, time). P5 explanation per question. P6 Report button → `reports` queue. P7 Ask-tutor button (stub → Phase 5).
- N1 notes per topic (Markdown). N2 readable pre/post quiz. N3 + H6 home weakest-topic note link.
- Acceptance: wrong answer always shows explanation; report creates row; topic delta diagnostic → practice computable.
- Screens: Practice, QuizReview, Notes.

## Phase 4 — Mocks, Progress, Plan, Motivation (M1–M2, G1–G5, H full)

- M1 one full mock per exam (verify official lengths for SAT/TOEFL/GRE before seeding — PRD §9 risk). M2 mock-vs-previous comparison chart.
- G1 progress per topic across attempts. G2 weekly "fix 3 weakest" plan. G3 auto-update on new scores. G4 reminders at chosen time (expo-notifications, in-app fallback). G5 badges (finish topic, first mock, score milestone — no streak punishments).
- Home full: Continue resumes draft/plan item; This-week plan card; progress summary (latest score / most-improved).
- Acceptance: 2 mocks → delta shown; plan regenerates weekly; reminder fires at set time.

## Phase 5 — AI Tutor (T1–T4)

- T4 three entries: explanation button, chat tab, home shortcut. T1 plain-language Q&A. T2 context injection: weak topics + recent attempts + exam date. T3 suggests next practice (deep-link to topic).
- Guardrails: answers grounded to question + note excerpt; "Flag answer" → `reports`; offline → suggest notes + queue question.
- Acceptance: tutor suggestion deep-links; flagged answers reviewable; usage events logged (§8 Tutor usefulness).

## Phase 6 — Community + Leaderboard (C1–C3)

- C1 single feed, exam/topic tags + filters. C2 post question + peer answers + accept. C3 leaderboard by quiz scores, exam-filtered by default.
- Moderation v1: report post/answer, rate limit, auto-hide after N reports, maintainer queue.
- Acceptance: filter by exam returns only tagged items; answered-share measurable (§8 Community).

## Phase 7 — Offline, Low-data, Launch (O1–O3, polish)

- O1 download packs (exam → topics → questions + notes, compressed JSON + cached images). O2 offline attempts saved locally, sync on reconnect with idempotency key (`offline_created_at` + uuid). O3 bundle audit (<5MB first load), lazy routes, text-first UI.
- QA: timer + backgrounding, sync conflicts, airplane-mode practice, empty states, accessibility pass.
- Launch checklist: content review (all explanations filled), mock lengths verified, metrics dashboard (§8), report SLA defined, license chosen.
- Non-goals (out of scope): TOEFL speaking/writing, GRE/WAEC essays, paid plans.

## Build order & milestones

0 Foundations → 1 Auth/Home → 2 Diagnostic → 3 Practice/Notes → 4 Mocks/Plan → 5 Tutor → 6 Community → 7 Offline/Launch.
Demoable after every phase. MVP = Phases 0–4 (usable without tutor/community).
