# BetterMe

**A free study companion for students preparing for WAEC, TOEFL, SAT, and GRE.**

BetterMe helps students find out where they are weak, practice under real exam conditions, and get help whenever they are stuck. It is built to work for students with limited or unreliable internet.

> **Status:** In development. The first version focuses on multiple-choice questions only.

---

## Why BetterMe?

Students preparing for major exams often:

- Don't know which topics they are weakest in, so they study without direction
- Rarely practice under real exam conditions
- Get little explanation when they answer a question wrongly
- Study alone, with no one to ask when they are stuck
- Struggle with unreliable or expensive internet

BetterMe gives every student a clear starting point, a guided path forward, and support along the way, completely free.

## Supported Exams

| Exam | Who it's for |
|---|---|
| **WAEC** | Secondary school students |
| **TOEFL** | Students applying to study abroad |
| **SAT** | Students applying for university |
| **GRE** | Students applying for postgraduate study |

## Features

### Get started
- Sign up, log in, and choose the exam you're preparing for
- Switch between exams at any time, with progress saved separately for each
- Exam date and target score or grade are optional

### Find your level
- A short, adaptive diagnostic test is the first thing you see
- Take it in one sitting, or pause and continue later
- Get a breakdown of every topic across all subjects and categories

### Practice
- Tap a topic to go straight to practice questions
- Timed practice simulates real exam pressure
- Difficulty adapts: harder as you improve, easier when you struggle
- Every quiz ends with a full breakdown and an explanation for each question
- Report any question that looks wrong or unclear with one tap
- Read short topic notes covering key ideas and formulas

### Full mock exams
- A full-length mock paper for each exam
- Compare each result with your previous mocks to see your improvement

### Stay on track
- A progress screen shows your improvement per topic over time
- A weekly study plan sets clear goals and updates automatically
- Reminders at a time you choose
- Badges and rewards for milestones
- A "Continue where you left off" button on the home screen

### AI tutor
- Ask questions in plain language, such as "explain this again in a simpler way"
- The tutor knows your weak topics, quiz history, and exam date, and suggests what to practice next
- Reach it from any quiz explanation, from its own chat screen, or from the home screen

### Community
- Post a question about a topic and get answers from other students
- Filter by topic or exam
- Compete on a leaderboard based on quiz scores

### Works with low data
- Download quizzes and lessons to practice offline
- Results sync when you're back online
- Built to use very little data

### WAEC syllabus tracker
- Pick a department (Science, Humanities, Business) and see every subject
- Core subjects (English, General Mathematics, Civic Education) always shown
- Per-subject topic checklists with progress bars, exam format, textbooks
- Every subject shows its source with a "confirm against your school's syllabus" notice
- Study plans queue reminders; admins can correct topics and verify sources

## How It Works

1. **Sign up** and choose your exam
2. **Take the diagnostic** to see your strengths and weaknesses topic by topic
3. **Practice your weak topics** under a timer and learn from every explanation
4. **Ask the AI tutor or the community** when you're stuck
5. **Follow your weekly plan** and take full mock exams to track your progress

## Roadmap

**First version**
- Multiple-choice questions for all four exams

**Later**
- Speaking and writing practice with feedback (TOEFL)
- Essay practice with feedback (GRE and WAEC)

## Project Structure

```text
Qubator/
├── README.md
├── docker-compose.yml      # local Postgres (needs Docker; else install Postgres)
├── app/                    # Expo app (Auth → ExamPicker → Home)
├── server/                 # local API + Better Auth + Postgres schema/seed
│   ├── db/curriculum_schema.sql  # syllabus tables (departments→reminders)
│   ├── scripts/import-curriculum.js  # markdown → DB importer
│   └── tests/curriculum.test.js  # node:test suite (npm test)
├── content/                # bulk question CSV imports
└── doc/
    ├── betterme-project-brief.md
    ├── exam-prep-companion-app-features.md
    ├── PRD.md
    └── implementation-plan.md
```

## Documentation

* `doc/betterme-project-brief.md` — overview, problem, solution, scope
* `doc/exam-prep-companion-app-features.md` — full feature list (accounts, diagnostic, practice, notes, mocks, plan, home, tutor, community, offline)
* `doc/PRD.md` — requirements (A1–O3), journey, principles, metrics, risks
* `doc/WAEC_Subjects_and_Curriculum.md` — source WAEC syllabus document
* `doc/curriculum_import_notes.md` — parser decisions, ambiguities, trust model

> **Note on Economics eligibility:** press reports say 2026 guidelines limit
> Economics to Business students, but WAEC has not confirmed this. Department
> eligibility is a configurable `eligible` flag on each department–subject
> link (default: allow), not hard-coded — see `curriculum_dept_subjects`.

## Getting Started

Use a local PostgreSQL database configured in `server/.env`. Docker Compose is
also available if you prefer to run PostgreSQL in Docker.

```sh
# 1. DB (option A: Docker)
docker compose up -d db
# option B: install Postgres locally, create db "betterme"

# 2. Server (local API + Better Auth, http://localhost:3000)
cd server
cp .env.example .env
npm install
npm run db:migrate                  # applies all schema files in order
npm run db:seed                     # seed sample exam content (fresh DB only)
npm run import:waec-mathematics     # add original WAEC Mathematics mock questions
npm run import:curriculum           # idempotently load the WAEC syllabus
npm run dev
```

For an existing database, apply `npm run db:migrate` and
`npm run import:curriculum`; do not re-run `db:seed`, which adds sample
question rows. The WAEC Mathematics importer is safe to re-run and adds the
questions needed for a 50-question standard mock. Other subjects remain
unavailable as full-length mocks until their banks are expanded. Start the API
before running the integration tests:

```sh
# In one terminal, with server/.env configured:
npm run dev
# In another terminal:
npm test
```

Proctored exams remain disabled until an approved, versioned camera-consent
notice is added to `consent_notices`. The wording needs privacy/legal review;
see `doc/privacy_checklist.md` before activating one.

```sh
# 3. App (Expo)
cd ../app
npm install
cp .env.example .env
npx expo start
```

Docs first:

1. Read `doc/betterme-project-brief.md`
2. Read `doc/PRD.md`
3. Confirm open questions in PRD §10 (target student, leaderboard filter, moderation, metric targets) before building.

## Contributing

Contributions, ideas, and feedback are welcome. If you find a bug or have a suggestion, please open an issue. Detailed contribution guidelines will be added soon.

## About

BetterMe is built as a product for the [Qubators](https://www.qubators.org/) bootcamp.

## License

MIT — see [LICENSE](LICENSE). Free for every student, per the product principles.
