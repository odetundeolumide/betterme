# Product Requirements Document: BetterMe

| | |
|---|---|
| **Product** | BetterMe, an exam prep companion app |
| **Status** | Draft v1 |
| **Date** | September 20, 2026 |
| **Context** | Product built for the Qubators bootcamp |
| **Exams covered** | WAEC, TOEFL, SAT, GRE |

> Sections marked **(proposed)** or **(to confirm)** are drafted suggestions, not decisions already made. Everything else reflects choices made while defining the features.

---

## 1. Summary

BetterMe is a free app that helps students prepare for WAEC, TOEFL, SAT, and GRE. A student signs up, picks an exam, and takes a short diagnostic test that shows exactly where they are strong and weak. From there they practice by topic under timed conditions, read short notes, take full mock exams, and get help from a personalized AI tutor and a community of other students. The app works on low data and offline, and keeps students on track with a weekly study plan, reminders, and rewards.

The first version focuses on **multiple-choice questions only**.

## 2. Problem Statement (proposed)

Students preparing for these exams often:

- Don't know which topics they are weakest in, so they study without direction
- Have no easy way to practice under real exam conditions such as time pressure
- Get little explanation when they get a question wrong
- Study alone, with no one to ask when they are stuck
- Struggle with unreliable or expensive internet

This app gives every student a clear starting point, a guided path forward, and support along the way, at no cost.

## 3. Goals and Non-Goals

### Goals

1. Show every student where they stand, topic by topic, within their first session
2. Help students improve measurably through targeted practice and clear explanations
3. Prepare students for real exam conditions with timed practice and full mock exams
4. Keep students consistent and motivated over weeks or months
5. Be usable by students with limited or no internet
6. Stay completely free and open to every student

### Non-Goals for the First Version

- Non-multiple-choice sections, such as TOEFL speaking and writing, the GRE essay, and WAEC theory or essay questions
- Paid plans, subscriptions, or premium features

## 4. Target Users (to confirm)

- **Students preparing for WAEC:** typically secondary school students
- **Students preparing for TOEFL, SAT, or GRE:** typically students applying for university or postgraduate study, including abroad
- **Students preparing for more than one exam:** for example WAEC first, then SAT or TOEFL later

Key needs across all groups: a clear picture of their weak areas, exam-style practice, help when stuck, and a study routine they can stick to, all at low data cost.

## 5. Core User Journey

1. **Sign up and log in**
2. **Select an exam** (WAEC, TOEFL, SAT, or GRE), optionally entering an exam date and target score or grade
3. **Take the diagnostic test:** short, adaptive, in one sitting by default, with the option to pause and resume
4. **See the results:** a breakdown of every topic across all subjects and categories
5. **Tap a weak topic:** go straight to timed practice questions for that topic
6. **Finish a quiz:** see a full breakdown with an explanation for every question
7. **Get help:** read topic notes, ask the AI tutor about a question, or post in the community
8. **Follow the weekly plan:** goals such as "This week: fix your three weakest topics", updated automatically
9. **Take full mock exams:** compare results with previous mocks
10. **Return regularly:** reminders, badges, and a "Continue where you left off" button bring students back

## 6. Functional Requirements

### 6.1 Accounts and Exams

| ID | Requirement |
|---|---|
| A1 | Students can sign up for an account and log in |
| A2 | After logging in, students select the exam they are preparing for: WAEC, TOEFL, SAT, or GRE |
| A3 | Students can switch between exams at any time |
| A4 | Progress for each exam is saved separately |
| A5 | Entering an exam date is optional |
| A6 | Entering a target score or grade is optional |
| A7 | The app is completely free, with all features open to every student |

### 6.2 Diagnostic Test

| ID | Requirement |
|---|---|
| D1 | The diagnostic is the first thing a student sees after picking an exam |
| D2 | It is a short test that finds the student's current level and weak areas |
| D3 | Question difficulty adapts to the student's answers |
| D4 | It is taken in one sitting by default, and students can pause and continue later |
| D5 | Results show a breakdown of every topic across all subjects and categories |
| D6 | Tapping a topic in the results goes straight to practice questions for that topic |

### 6.3 Practice and Quizzes

| ID | Requirement |
|---|---|
| P1 | Students can practice questions topic by topic |
| P2 | Practice is timed to simulate real exam pressure |
| P3 | Difficulty is adaptive: harder as the student improves, easier when they struggle |
| P4 | After each quiz, the student sees a total breakdown of their performance |
| P5 | Every question has a written explanation, especially valuable for wrong answers |
| P6 | Every question has a **"Report this question"** button to flag mistakes or confusing wording |
| P7 | Every explanation has an **"Ask the tutor about this question"** button |

### 6.4 Topic Notes

| ID | Requirement |
|---|---|
| N1 | Every topic has short written notes covering key ideas and formulas |
| N2 | Students can read notes before or after practicing |
| N3 | The home screen links to the notes for the student's weakest topic |

### 6.5 Full Mock Exams

| ID | Requirement |
|---|---|
| M1 | Each exam has a full-length mock paper that mirrors the real exam |
| M2 | Mock results include a comparison with the student's previous mocks so they can see whether they are improving |

### 6.6 Progress, Planning, and Motivation

| ID | Requirement |
|---|---|
| G1 | A progress screen shows improvement per topic across many quizzes |
| G2 | A weekly study plan sets clear goals, such as "This week: fix your three weakest topics" |
| G3 | The weekly plan updates automatically as the student improves or falls behind |
| G4 | Reminders nudge students to study at a time they choose |
| G5 | Badges and rewards mark milestones, such as finishing a topic or reaching a score |

### 6.7 Home Screen

| ID | Requirement |
|---|---|
| H1 | A **"Continue where you left off"** button |
| H2 | A shortcut to the AI tutor |
| H3 | A summary of recent progress, such as the latest quiz score or the most-improved topic |
| H4 | Badges and reminder status |
| H5 | A countdown to the exam date, shown only if the student entered one |
| H6 | A link to the notes for the student's weakest topic |

### 6.8 AI Tutor

| ID | Requirement |
|---|---|
| T1 | Students can ask questions in plain language, such as "explain this again in a simpler way" |
| T2 | The tutor is personalized: it knows the student's weak topics, quiz history, and exam date |
| T3 | The tutor suggests what the student should practice next |
| T4 | It is reachable from quiz explanations ("Ask the tutor about this question"), from its own chat screen, and from a home screen shortcut |

### 6.9 Community

| ID | Requirement |
|---|---|
| C1 | One shared community, open to everyone, with topics and exams as tags or filters |
| C2 | Students can post a question about a topic and get answers from other students |
| C3 | A leaderboard ranks students by quiz scores |

### 6.10 Offline and Low Data

| ID | Requirement |
|---|---|
| O1 | Students can download quizzes and lessons to practice offline |
| O2 | Results from offline practice sync when the student is back online |
| O3 | The app is kept light so it uses very little data |

## 7. Product Principles

- **Free and open:** no student is locked out of any feature
- **Personal, not generic:** every student's path starts from their own diagnostic results
- **Exam-realistic:** timing, structure, and mock papers should feel like the real thing
- **Learn from mistakes:** every wrong answer should teach something through explanations, notes, and the tutor
- **Works where students are:** low data use and offline practice are core, not extras

## 8. Success Metrics (proposed)

| Area | Example metric |
|---|---|
| Activation | Share of new students who finish the diagnostic test |
| Engagement | Students practicing at least a few times per week; average quizzes per student per week |
| Retention | Students still active after 4 and 8 weeks |
| Learning outcome | Improvement in topic scores between the diagnostic and later quizzes; improvement across mock exams |
| Tutor usefulness | Share of students who use the tutor, and how often they return to it |
| Content quality | Number of reported questions and how quickly they are resolved |
| Community | Questions posted and the share that receive an answer |

Targets for these metrics still need to be set.

## 9. Risks and Mitigations (proposed)

| Risk | Mitigation |
|---|---|
| Incorrect or unclear questions or explanations harm student trust | "Report this question" button on every question; review of reported questions |
| The AI tutor gives a wrong or confusing explanation | Tutor answers tied to the question and topic; students can flag problems |
| Exam formats change, especially SAT, TOEFL, and GRE | Check each exam's current official structure before setting mock exam lengths; review content regularly |
| Poor internet limits usage | Offline downloads, low data use, and later syncing of results |
| Students lose motivation over long preparation periods | Weekly plans, reminders, streak-free rewards through badges, and visible progress |
| Community quality: wrong answers from other students | Tags and filters help students find relevant discussions; report and moderation approach to be decided |

## 10. Open Questions

- [ ] Can the leaderboard be filtered by exam, like the community?
- [ ] Can the AI tutor point students to the right topic notes when they are stuck?
- [ ] Which item should students see first on the home screen?
- [ ] Should this week's study plan and goals also appear on the home screen?
- [ ] Who is the primary target student, and is the first release aimed at one exam group before the others?
- [ ] How will community answers be moderated?
- [ ] What targets should each success metric have?

## 11. Out of Scope for Now, Possible Later

- Speaking and writing practice with feedback (TOEFL)
- Essay practice with feedback (GRE and WAEC)
- Paid plans or sponsorship models
