// Standard exam specs — real-exam question counts & timing.
// Sources: College Board (SAT 2026), ETS (GRE), WAEC timetable + past papers,
// ETS TOEFL iBT (classic; re-verify against any 2026 ETS redesign before launch).
// V1 is MCQ-only, so writing/speaking/essay sections are excluded by design.
export const EXAM_SPECS = {
  WAEC: {
    // Per-subject objective papers (mock = one subject paper at a time)
    subjects: {
      Mathematics: { questions: 50, minutes: 90, verify: false },
      English: { questions: 80, minutes: 60, verify: true },
      "English Language": { questions: 80, minutes: 60, verify: true },
      default: { questions: 50, minutes: 60, verify: true },
    },
    diagnostic: { questions: 15, minutes: 15 },
    practice: { questions: 10, minutes: 10 },
  },
  TOEFL: {
    // MCQ sections only (speaking/writing excluded in V1)
    sections: [
      { name: "Reading", questions: 20, minutes: 35 },
      { name: "Listening", questions: 28, minutes: 36 },
    ],
    total: { questions: 48, minutes: 71, verify: true },
    diagnostic: { questions: 15, minutes: 15 },
    practice: { questions: 10, minutes: 10 },
  },
  SAT: {
    sections: [
      { name: "Reading & Writing", questions: 54, minutes: 64 },
      { name: "Math", questions: 44, minutes: 70 },
    ],
    total: { questions: 98, minutes: 134, verify: false },
    diagnostic: { questions: 15, minutes: 15 },
    practice: { questions: 10, minutes: 12 },
  },
  GRE: {
    // MCQ sections only (Analytical Writing excluded in V1)
    sections: [
      { name: "Verbal Reasoning", questions: 27, minutes: 41 },
      { name: "Quantitative Reasoning", questions: 27, minutes: 47 },
    ],
    total: { questions: 54, minutes: 88, verify: false },
    diagnostic: { questions: 15, minutes: 15 },
    practice: { questions: 10, minutes: 12 },
  },
};
