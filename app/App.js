import React, { useState, useEffect } from "react";
import { View, Text } from "react-native";
import { colors, spacing, type } from "./theme";
import { Btn, Card, Badge, ProgressBar, SectionTitle, ChatBubble, LeaderRow, Screen, PageHeader, HoverCard, MenuRow, EmptyState, Field } from "./components";
import { savePack, loadPack, queueAttempt, pendingAttempts, dropQueued, pendingCount, uuid } from "./offline";

// Shows errors on screen instead of a blank page
class Boundary extends React.Component {
  state = { err: null };
  static getDerivedStateFromError(e) { return { err: e }; }
  render() {
    if (this.state.err) {
      return (
        <View style={{ padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: "700" }}>Something broke:</Text>
          <Text>{String(this.state.err?.message || this.state.err)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
const EXAMS = ["WAEC", "TOEFL", "SAT", "GRE"];

export default function App() {
  return (
    <Boundary>
      <AppInner />
    </Boundary>
  );
}

function AppInner() {
  const [screen, setScreen] = useState("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [exam, setExam] = useState(null);
  const [dept, setDept] = useState(null);
  const [topics, setTopics] = useState([]);
  const [userId, setUserId] = useState(null);
  const [spec, setSpec] = useState(null);
  // Home dashboard data (Phase 4: H3/H4/H5, G1-G5)
  const [dash, setDash] = useState({ progress: [], plan: [], badges: [], mocks: [], prefs: {}, eprog: {}, lastScore: null });
  const [msg, setMsg] = useState("");
  // Diagnostic state (PRD D1–D6, adaptive D3, pause/resume D4)
  const [quiz, setQuiz] = useState([]);
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [target, setTarget] = useState(2);
  const [streak, setStreak] = useState(0);
  const [draft, setDraft] = useState(null);

  const callAuth = async (mode) => {
    setMsg("");
    const res = await fetch(`${API_URL}/api/auth/${mode}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: email }),
    });
    if (!res.ok) return setMsg(`Auth failed (${res.status})`);
    setUserId(email);
    setScreen("exams");
  };

  const pickExam = async (code) => {
    setExam(code);
    setDept(null);
    const [tr, sr] = await Promise.all([
      fetch(`${API_URL}/api/topics?exam=${code}`),
      fetch(`${API_URL}/api/specs/${code}`),
    ]);
    const all = tr.ok ? await tr.json() : [];
    setSpec(sr.ok ? await sr.json() : null);
    if (code === "WAEC") {
      setTopics(all);
      setScreen("dept");
    } else {
      setTopics(all);
      setScreen("home");
    }
  };

  const pickDept = (d) => {
    setDept(d);
    setTopics(topics.filter((t) => t.department === "General" || t.department === d));
    setScreen("home");
  };

  // Practice state (PRD P1–P7, N1–N2) — 10Q standard drill, timed
  const [ptopic, setPtopic] = useState(null);
  const [pq, setPq] = useState([]);
  const [pqi, setPqi] = useState(0);
  const [pans, setPans] = useState([]);
  const [secs, setSecs] = useState(0);
  const [note, setNote] = useState(null);

  useEffect(() => {
    if (screen !== "practice" || secs <= 0) return;
    const t = setTimeout(() => {
      if (secs === 1) setScreen("review");
      else setSecs(secs - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [screen, secs]);

  const startPractice = async (topic) => {
    setMsg(""); setOfflineMode(false);
    let qs = null;
    try {
      const res = await fetch(`${API_URL}/api/questions?exam=${exam}&topic=${topic.id}&limit=10`);
      if (!res.ok) throw new Error();
      qs = await res.json();
    } catch {
      qs = packQuestions(topic.id, 10);
    }
    if (!qs || !qs.length) return setMsg(`No questions for ${topic.name} (bank growing).`);
    setPtopic(topic); setPq(qs); setPqi(0); setPans([]);
    setSecs(10 * 60); // standard 10Q drill, 10 min
    setStartedAt(Date.now());
    setScreen("practice");
  };

  const answerPractice = (idx) => {
    const q = pq[pqi];
    const next = [...pans, { q, picked: idx, correct: idx === q.answer_idx }];
    setPans(next);
    if (pqi + 1 >= pq.length) { saveAttempt("practice", ptopic.id, pq, next); setScreen("review"); }
    else setPqi(pqi + 1);
  };

  const openNotes = async (topic) => {
    try {
      const res = await fetch(`${API_URL}/api/notes?topic=${topic.id}`);
      if (!res.ok) throw new Error();
      setNote(await res.json());
    } catch {
      const pack = loadPack(`pack:${exam}`);
      const n = pack?.notes?.find((x) => x.topic_id === topic.id);
      setNote(n || { body_md: "Notes for this topic are being written." });
      setOfflineMode(true);
    }
    setPtopic(topic);
    setScreen("notes");
  };

  const reportQ = async (qid) => {
    await fetch(`${API_URL}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_id: qid, reason: "flagged from app review" }),
    });
    setMsg("Reported — thank you. Our reviewers will check it.");
    trackEvent("report_create", { question_id: qid });
  };

  // Phase 4: persist attempts, load dashboard
  const [startedAt, setStartedAt] = useState(null);
  const [pending, setPending] = useState(0);
  const [offlineMode, setOfflineMode] = useState(false);

  const trackEvent = (name, props) => {
    fetch(`${API_URL}/api/events`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, exam_code: exam, name, props: props || {} }),
    }).catch(() => {});
  };

  const saveAttempt = (kind, topicId, qs, ans) => {
    if (!userId) return;
    const score = ans.filter((a) => a.correct).length;
    const payload = {
      user_id: userId, exam_code: exam, topic_id: topicId,
      question_ids: qs.map((q) => q.id), answers: ans.map((a) => a.picked),
      score, duration_s: startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0,
      status: kind, client_uuid: uuid(),
    };
    fetch(`${API_URL}/api/attempts`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(() => setPending(pendingCount())).catch(() => {
      queueAttempt(payload); // O2: queue offline, sync later
      setPending(pendingCount());
      setMsg("Saved offline — will sync when you're back online.");
    });
    trackEvent(kind === "diagnostic" ? "diagnostic_finish" : kind === "mock" ? "mock_finish" : "quiz_finish", { score, total: qs.length });
    return score;
  };

  const downloadPack = async () => {
    setMsg("");
    try {
      const res = await fetch(`${API_URL}/api/pack?exam=${exam}`);
      if (!res.ok) throw new Error();
      const pack = await res.json();
      savePack(`pack:${exam}`, pack);
      setMsg(`Pack saved: ${pack.questions.length}Q + ${pack.notes.length} notes. Practice offline ✓`);
    } catch {
      setMsg("Download failed — connect once, then practice offline.");
    }
  };

  const syncNow = async () => {
    const items = pendingAttempts();
    let ok = 0;
    for (const p of items) {
      try {
        const res = await fetch(`${API_URL}/api/attempts`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        });
        if (res.ok) { dropQueued(p.client_uuid); ok += 1; }
      } catch { break; }
    }
    setPending(pendingCount());
    setMsg(ok ? `Synced ${ok} offline result${ok > 1 ? "s" : ""} ✓` : "Still offline — kept safely on device.");
    if (ok) loadHome();
  };

  // Pack fallback: use downloaded questions when the network fails (O1)
  const packQuestions = (topicId, limit) => {
    const pack = loadPack(`pack:${exam}`);
    if (!pack) return null;
    let qs = pack.questions;
    if (topicId) qs = qs.filter((q) => q.topic_id === topicId);
    if (exam === "WAEC" && topics.length) {
      const ids = new Set(topics.map((t) => t.id));
      qs = qs.filter((q) => ids.has(q.topic_id));
    }
    if (!qs.length) return null;
    setOfflineMode(true);
    return qs.slice(0, limit);
  };

  const loadHome = async () => {
    if (!userId || !exam) return;
    setPending(pendingCount());
    const q = `user=${encodeURIComponent(userId)}&exam=${exam}`;
    const [pr, pl, ba, mo, pf, ep] = await Promise.all([
      fetch(`${API_URL}/api/progress?${q}`), fetch(`${API_URL}/api/plan?${q}`),
      fetch(`${API_URL}/api/badges?${q}`), fetch(`${API_URL}/api/mocks?${q}`),
      fetch(`${API_URL}/api/prefs?user=${encodeURIComponent(userId)}`),
      fetch(`${API_URL}/api/exam-progress?${q}`),
    ]);
    setDash({
      progress: pr.ok ? await pr.json() : [],
      plan: pl.ok ? await pl.json() : [],
      badges: ba.ok ? await ba.json() : [],
      mocks: mo.ok ? await mo.json() : [],
      prefs: pf.ok ? await pf.json() : {},
      eprog: ep.ok ? await ep.json() : {},
      lastScore: null,
    });
  };

  useEffect(() => { if (screen === "home") loadHome(); }, [screen]);

  // Tutor state (T1–T4)
  const [tutorQ, setTutorQ] = useState(null);
  const [chat, setChat] = useState([]);
  const [tutorCtx, setTutorCtx] = useState(null);
  const [tmsg, setTmsg] = useState("");
  const [tsending, setTsending] = useState(false);

  const openTutor = async (question) => {
    setTutorQ(question || null);
    setChat([]); setTmsg("");
    const q = `user=${encodeURIComponent(userId)}&exam=${exam}`;
    const res = await fetch(`${API_URL}/api/tutor/context?${q}`);
    setTutorCtx(res.ok ? await res.json() : null);
    setScreen("tutor");
  };

  const askTutor = async (preset) => {
    const text = (preset || tmsg).trim();
    if (!text || tsending) return;
    setTsending(true);
    setChat((c) => [...c, { from: "you", text }]);
    setTmsg("");
    const res = await fetch(`${API_URL}/api/tutor/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, exam_code: exam, question_id: tutorQ ? tutorQ.id : null, message: text }),
    });
    const data = res.ok ? await res.json() : { answer: "Tutor is unreachable — try your notes for now.", suggestion: null, source: "error" };
    setChat((c) => [...c, { from: "tutor", text: data.answer }]);
    trackEvent("tutor_ask", { source: data.source });
    if (data.suggestion) setTutorCtx((ctx) => ({ ...(ctx || {}), suggestion: data.suggestion }));
    setTsending(false);
  };
  // Community state (C1–C3)
  const [posts, setPosts] = useState([]);
  const [postDetail, setPostDetail] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [answerBody, setAnswerBody] = useState("");
  const [board, setBoard] = useState({ board: [], me: null });

  const loadPosts = async () => {
    const res = await fetch(`${API_URL}/api/posts?exam=${exam}`);
    setPosts(res.ok ? await res.json() : []);
    setScreen("community");
  };

  const openPost = async (id) => {
    const res = await fetch(`${API_URL}/api/posts/${id}`);
    if (res.ok) { setPostDetail(await res.json()); setScreen("post"); }
  };

  const submitPost = async () => {
    if (!newTitle.trim()) return;
    await fetch(`${API_URL}/api/posts`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, exam_code: exam, title: newTitle, body: newBody }),
    });
    setNewTitle(""); setNewBody("");
    loadPosts();
  };

  const submitAnswer = async () => {
    if (!answerBody.trim()) return;
    await fetch(`${API_URL}/api/posts/${postDetail.id}/answers`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, body: answerBody }),
    });
    setAnswerBody("");
    openPost(postDetail.id);
  };

  const acceptAnswer = async (aid) => {
    await fetch(`${API_URL}/api/posts/${postDetail.id}/accept`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer_id: aid, user_id: userId }),
    });
    openPost(postDetail.id);
  };

  const loadBoard = async () => {
    const res = await fetch(`${API_URL}/api/leaderboard?exam=${exam}&user=${encodeURIComponent(userId)}`);
    if (res.ok) setBoard(await res.json());
    setScreen("board");
  };

  const [mockLabel, setMockLabel] = useState("");
  const [mq, setMq] = useState([]);
  const [mqi, setMqi] = useState(0);
  const [mans, setMans] = useState([]);
  const [msecs, setMsecs] = useState(0);
  const [mprev, setMprev] = useState(null);

  useEffect(() => {
    if (screen !== "mockrun" || msecs <= 0) return;
    const t = setTimeout(() => {
      if (msecs === 1) finishMock(mans);
      else setMsecs(msecs - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [screen, msecs]);

  const startMock = async (label, count, minutes, topicId) => {
    setOfflineMode(false);
    let qs = null;
    try {
      const url = topicId
        ? `${API_URL}/api/questions?exam=${exam}&topic=${topicId}&limit=${count}`
        : `${API_URL}/api/questions?exam=${exam}&limit=${count}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      qs = await res.json();
    } catch {
      qs = packQuestions(topicId, count);
    }
    if (!qs || !qs.length) return setMsg("No questions banked yet.");
    setMockLabel(label); setMq(qs); setMqi(0); setMans([]);
    setMsecs(minutes * 60); setStartedAt(Date.now());
    setScreen("mockrun");
  };

  const answerMock = (idx) => {
    const q = mq[mqi];
    const next = [...mans, { q, picked: idx, correct: idx === q.answer_idx }];
    setMans(next);
    if (mqi + 1 >= mq.length) finishMock(next);
    else setMqi(mqi + 1);
  };

  const finishMock = async (ans) => {
    const score = ans.filter((a) => a.correct).length;
    const prev = dash.mocks[0] || null;
    setMprev(prev);
    if (userId) {
      await fetch(`${API_URL}/api/mocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId, exam_code: exam, label: mockLabel,
          score, total: ans.length,
          breakdown: { perQuestion: ans.map((a) => (a.correct ? 1 : 0)) },
        }),
      }).catch(() => {});
      saveAttempt("mock", ans[0] ? ans[0].q.topic_id : null, ans.map((a) => a.q), ans);
    }
    setScreen("mockresult");
  };

  const startDiagnostic = async () => {
    setMsg(""); setOfflineMode(false);
    let all = null;
    try {
      const res = await fetch(`${API_URL}/api/questions?exam=${exam}&limit=60`);
      if (!res.ok) throw new Error();
      all = await res.json();
    } catch {
      all = packQuestions(null, 60);
      if (!all) return setMsg("No connection and no downloaded pack — download once to practice offline.");
    }
    if (exam === "WAEC") {
      const ids = new Set(topics.map((t) => t.id));
      all = all.filter((q) => ids.has(q.topic_id));
    }
    if (!all.length) return setMsg("No questions seeded for this exam yet.");
    const byDiff = (d) => all.filter((q) => q.difficulty === d);
    const ordered = [...byDiff(2), ...byDiff(1), ...byDiff(3)].slice(0, 10);
    setQuiz(ordered); setQi(0); setAnswers([]); setTarget(2); setStreak(0);
    setStartedAt(Date.now());
    setScreen("quiz");
  };

  const answerQuiz = (idx) => {
    const q = quiz[qi];
    const correct = idx === q.answer_idx;
    const s = correct ? streak + 1 : 0;
    let t = target;
    if (s >= 2 && t < 3) { t = t + 1; setStreak(0); } else setStreak(s);
    if (!correct && t > 1) t = t - 1;
    setTarget(t);
    const next = [...answers, { q, picked: idx, correct }];
    setAnswers(next);
    if (qi + 1 >= quiz.length) { saveAttempt("diagnostic", null, quiz, next); setScreen("results"); }
    else setQi(qi + 1);
  };

  const pauseQuiz = () => {
    setDraft({ quiz, qi, answers, target, streak });
    setScreen("home");
    setMsg("Diagnostic paused — tap Continue to resume.");
  };

  if (screen === "auth") {
    return (
      <Screen>
        <PageHeader title="🎓 BetterMe" subtitle="Free WAEC · TOEFL · SAT · GRE prep" color={colors.secondary} />
        <Card>
          <Text style={{ ...type.body, color: colors.muted }}>Sign in to start your diagnostic and find your weak topics.</Text>
        </Card>
        <Field label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Field label="Password" placeholder="••••••••" secureTextEntry value={password} onChangeText={setPassword} />
        <Btn title="Create free account" onPress={() => callAuth("sign-up")} />
        <Btn title="Sign in" variant="ghost" onPress={() => callAuth("sign-in")} />
        {msg ? <Card accent={colors.danger}><Text style={{ color: colors.danger }}>{msg}</Text></Card> : null}
        <Text style={{ ...type.tiny, color: colors.muted, textAlign: "center" }}>build 2026-09-29c · free forever · works offline</Text>
      </Screen>
    );
  }

  const EXAM_META = {
    WAEC: { icon: "📚", desc: "Secondary school · Science / Art / Commerce" },
    TOEFL: { icon: "✈️", desc: "Study abroad · Reading + Listening" },
    SAT: { icon: "🎓", desc: "US college · 98Q full paper" },
    GRE: { icon: "📊", desc: "Postgraduate · 54Q + writing excluded" },
  };

  if (screen === "exams") {
    return (
      <Screen>
        <PageHeader title="Choose your exam" subtitle="Progress is saved separately per exam" color={colors.primary} />
        {EXAMS.map((e) => (
          <MenuRow key={e} icon={EXAM_META[e].icon} title={e} subtitle={EXAM_META[e].desc} color={colors.primary} onPress={() => pickExam(e)} />
        ))}
      </Screen>
    );
  }

  const DEPT_META = {
    Science: { icon: "🔬", desc: "Physics · Chemistry · Biology + 2" },
    Art: { icon: "🎭", desc: "Literature · Government · History + 2" },
    Commerce: { icon: "💼", desc: "Economics · Accounting · Marketing + 2" },
  };

  if (screen === "dept") {
    return (
      <Screen>
        <PageHeader title="Your department?" subtitle="English, Mathematics + Civic come free with all" color={colors.primary} />
        {Object.entries(DEPT_META).map(([d, m]) => (
          <MenuRow key={d} icon={m.icon} title={d} subtitle={m.desc} color={colors.primary} onPress={() => pickDept(d)} />
        ))}
      </Screen>
    );
  }

  if (screen === "design") {
    return (
      <Screen>
        <PageHeader title="Design system" subtitle="Tokens + components" color={colors.text} />
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
        <SectionTitle>Colors</SectionTitle>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {[colors.primary, colors.secondary, colors.accent, colors.success, colors.danger, colors.tutor].map((c) => (
            <View key={c} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c, ...shadow.card }} />
          ))}
        </View>
        <SectionTitle>Hover me 👇</SectionTitle>
        <HoverCard onPress={() => {}}>
          <Text style={type.h2}>Hover card</Text>
          <Text style={{ color: colors.muted }}>Lifts + deepens shadow on hover (web).</Text>
          <ProgressBar value={0.67} />
        </HoverCard>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Badge label="NEW" />
          <Badge label="WEAK" color={colors.danger} />
          <Badge label="TUTOR" color={colors.tutor} />
        </View>
      </Screen>
    );
  }

  if (screen === "quiz" && quiz[qi]) {
    const q = quiz[qi];
    const opts = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
    return (
      <Screen>
        <PageHeader title={`Diagnostic ${qi + 1}/${quiz.length}`} subtitle={`Adaptive · level ${q.difficulty}`} color={colors.tutor} />
        <ProgressBar value={qi / quiz.length} color={colors.tutor} />
        <HoverCard>
          <Text style={{ fontSize: 17, fontWeight: "700", lineHeight: 24 }}>{q.stem}</Text>
        </HoverCard>
        {opts.map((o, i) => (
          <Btn key={i} title={o} variant="ghost" onPress={() => answerQuiz(i)} />
        ))}
        <Btn title="⏸ Pause & continue later" variant="ghost" onPress={pauseQuiz} />
      </Screen>
    );
  }

  if (screen === "results") {
    const score = answers.filter((a) => a.correct).length;
    const perTopic = {};
    answers.forEach((a) => {
      const t = topics.find((x) => x.id === a.q.topic_id);
      const name = t ? t.name : `Topic ${a.q.topic_id}`;
      perTopic[name] = perTopic[name] || { ok: 0, n: 0 };
      perTopic[name].n += 1;
      if (a.correct) perTopic[name].ok += 1;
    });
    const weak = Object.entries(perTopic).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)[0];
    return (
      <Screen>
        <PageHeader title={`Results: ${score}/${answers.length}`} subtitle={weak ? `Weakest: ${weak[0]} — practice it next` : "Diagnostic complete"} color={score / Math.max(answers.length, 1) >= 0.6 ? colors.success : colors.warning} />
        {Object.entries(perTopic).map(([name, v]) => (
          <HoverCard key={name}>
            <Text style={{ fontWeight: "800", fontSize: 15 }}>{name}: {v.ok}/{v.n}</Text>
            <ProgressBar value={v.ok / v.n} color={v.ok / v.n >= 0.6 ? colors.success : colors.danger} />
          </HoverCard>
        ))}
        <Btn title="Practice weakest topic →" onPress={() => { const t = topics.find((x) => x.name === weak[0]); if (t) startPractice(t); }} />
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
        {msg ? <Text>{msg}</Text> : null}
      </Screen>
    );
  }

  if (screen === "practice" && pq[pqi]) {
    const q = pq[pqi];
    const opts = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
    const mm = String(Math.floor(secs / 60)).padStart(2, "0");
    const ss = String(secs % 60).padStart(2, "0");
    return (
      <Screen>
        <PageHeader title={`${ptopic.name} ${pqi + 1}/${pq.length}`} subtitle="Standard 10Q drill" color={colors.primary} />
        <TimerPill label={`${mm}:${ss}`} />
        <ProgressBar value={pqi / pq.length} />
        <HoverCard>
          <Text style={{ fontSize: 17, fontWeight: "700", lineHeight: 24 }}>{q.stem}</Text>
        </HoverCard>
        {opts.map((o, i) => (
          <Btn key={i} title={o} variant="ghost" onPress={() => answerPractice(i)} />
        ))}
        <Btn title="📘 Read notes first" variant="ghost" onPress={() => openNotes(ptopic)} />
      </Screen>
    );
  }

  if (screen === "review") {
    const score = pans.filter((a) => a.correct).length;
    return (
      <Screen>
        <PageHeader title={`Practice: ${score}/${pans.length}`} subtitle={score / Math.max(pans.length, 1) >= 0.7 ? "Solid work 🎉" : "Review the misses below"} color={score / Math.max(pans.length, 1) >= 0.7 ? colors.success : colors.primary} />
        {pans.map((a, i) => {
          const opts = typeof a.q.options === "string" ? JSON.parse(a.q.options) : a.q.options;
          return (
            <HoverCard key={i} accent={a.correct ? colors.success : colors.danger}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs }}>
                <Badge label={a.correct ? "✓ CORRECT" : "✗ MISSED"} color={a.correct ? colors.success : colors.danger} />
                <Text style={{ ...type.small, color: colors.muted }}>Q{i + 1}</Text>
              </View>
              <Text style={{ fontWeight: "700", fontSize: 15 }}>{a.q.stem}</Text>
              <Text style={{ ...type.small }}>You: {opts[a.picked]}</Text>
              {!a.correct ? <Text style={{ ...type.small, fontWeight: "800", color: colors.success }}>Answer: {opts[a.q.answer_idx]}</Text> : null}
              <Text style={{ ...type.small, color: colors.muted, marginTop: spacing.xs }}>{a.q.explanation}</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                <View style={{ flex: 1 }}><Btn title="✨ Tutor" variant="ghost" onPress={() => openTutor(a.q)} /></View>
                <View style={{ flex: 1 }}><Btn title="🚩 Report" variant="ghost" onPress={() => reportQ(a.q.id)} /></View>
              </View>
            </HoverCard>
          );
        })}
        {msg ? <Card accent={colors.success}><Text>{msg}</Text></Card> : null}
        <Btn title="📘 Topic notes" onPress={() => openNotes(ptopic)} />
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
      </Screen>
    );
  }

  if (screen === "notes") {
    return (
      <Screen>
        <PageHeader title={`📘 ${ptopic ? ptopic.name : "Notes"}`} subtitle="Key ideas & formulas" color={colors.secondary} />
        <HoverCard><Text style={{ ...type.body }}>{note ? note.body_md : "Loading…"}</Text></HoverCard>
        {ptopic ? <Btn title="Practice this topic →" onPress={() => startPractice(ptopic)} /> : null}
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
      </Screen>
    );
  }

  if (screen === "tutor") {
    const sug = tutorCtx?.suggestion;
    const sugTopic = sug ? topics.find((t) => t.id === sug.topic_id) : null;
    return (
      <Screen>
        <PageHeader title="✨ AI tutor" subtitle={tutorCtx ? `Knows your weak spots${tutorCtx.examDate ? ` · exam ${tutorCtx.examDate}` : ""}` : "Ask anything"} color={colors.tutor} />
        {tutorQ ? <Card accent={colors.tutor}><Text style={{ fontWeight: "700" }}>About: {tutorQ.stem}</Text></Card> : null}
        {chat.length === 0 ? <EmptyState icon="💬" text="Ask e.g. “explain this again in a simpler way”" /> : null}
        {chat.map((m, i) => (
          <ChatBubble key={i} from={m.from} text={m.text} />
        ))}
        {tsending ? <Text style={{ color: colors.muted }}>Tutor is thinking…</Text> : null}
        {sug && sugTopic ? (
          <HoverCard accent={colors.tutor}>
            <Text style={{ fontWeight: "800" }}>Practice next → {sugTopic.name}</Text>
            <Btn title="Start drill" onPress={() => startPractice(sugTopic)} />
          </HoverCard>
        ) : null}
        <Field label="Your question" value={tmsg} onChangeText={setTmsg} placeholder="Ask, e.g. explain this again simply" />
        <Btn title="Send" onPress={() => askTutor()} />
        <Btn title="Explain simply" variant="ghost" onPress={() => askTutor("explain this again in a simpler way")} />
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
      </Screen>
    );
  }

  if (screen === "community") {
    return (
      <Screen>
        <PageHeader title={`Community — ${exam}`} subtitle="One shared feed, filtered by exam" color={colors.warning} />
        <SectionTitle>Ask a question</SectionTitle>
        <Field label="Title" value={newTitle} onChangeText={setNewTitle} placeholder="e.g. Why is (x−2)(x−3)=0?" />
        <Field label="Details (optional)" value={newBody} onChangeText={setNewBody} placeholder="Show your working…" />
        <Btn title="Post question" onPress={submitPost} />
        <SectionTitle>Questions</SectionTitle>
        {posts.length === 0 ? <EmptyState icon="💭" text="No questions yet — be the first." /> : null}
        {posts.map((p) => (
          <HoverCard key={p.id} onPress={() => openPost(p.id)}>
            <Text style={{ fontWeight: "800", fontSize: 15 }}>{p.title}</Text>
            <Text style={{ ...type.small, color: colors.muted }}>{p.user_id} · {p.topic_name || p.exam_code} · {p.answers} answers ›</Text>
          </HoverCard>
        ))}
        <Btn title="🏆 Leaderboard" variant="blue" onPress={loadBoard} />
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
      </Screen>
    );
  }

  if (screen === "post" && postDetail) {
    return (
      <Screen>
        <PageHeader title="Question" subtitle={`${postDetail.user_id} · ${postDetail.topic_name || postDetail.exam_code}`} color={colors.warning} />
        <HoverCard><Text style={{ ...type.h2 }}>{postDetail.title}</Text>{postDetail.body ? <Text style={{ ...type.body, marginTop: spacing.xs }}>{postDetail.body}</Text> : null}</HoverCard>
        <SectionTitle>Answers ({postDetail.answers.length})</SectionTitle>
        {postDetail.answers.map((a) => (
          <HoverCard key={a.id} accent={a.is_accepted ? colors.success : colors.border}>
            <Text style={{ ...type.body }}>{a.is_accepted ? "✅ " : ""}{a.body}</Text>
            <Text style={{ ...type.small, color: colors.muted }}>— {a.user_id}</Text>
            {!a.is_accepted ? <Btn title="Accept ✓" variant="ghost" onPress={() => acceptAnswer(a.id)} /> : null}
          </HoverCard>
        ))}
        <Field label="Your answer" value={answerBody} onChangeText={setAnswerBody} placeholder="Write your answer…" />
        <Btn title="Answer" onPress={submitAnswer} />
        <Btn title="🚩 Report post" variant="ghost" onPress={() => fetch(`${API_URL}/api/posts/${postDetail.id}/report`, { method: "POST" }).then(() => setScreen("community"))} />
        <Btn title="← Back" variant="ghost" onPress={loadPosts} />
      </Screen>
    );
  }

  if (screen === "board") {
    return (
      <Screen>
        <PageHeader title={`🏆 Leaderboard`} subtitle={`${exam} · by quiz scores`} color={colors.warning} />
        {board.board.length === 0 ? <EmptyState icon="🏁" text="No quiz scores yet. Finish a quiz to rank." /> : null}
        {board.board.map((b) => (
          <LeaderRow key={b.rank} rank={b.rank} name={b.user} score={`${b.total} pts · ${b.quizzes} quizzes`} you={b.you} />
        ))}
        <Btn title="← Back" variant="ghost" onPress={() => setScreen("community")} />
      </Screen>
    );
  }

  if (screen === "mocksetup") {
    const mockOptions = () => {
      if (!spec) return [];
      if (exam === "WAEC") {
        const per = spec.subjects || {};
        return topics.map((t) => {
          const s = per[t.subject] || per.default || { questions: 50, minutes: 60 };
          return { label: `${t.name} · ${s.questions}Q standard`, count: s.questions, minutes: s.minutes, topicId: t.id };
        });
      }
      const total = spec.total || { questions: 20, minutes: 30 };
      return [{ label: `Full paper · ${total.questions}Q in ${total.minutes} min`, count: total.questions, minutes: total.minutes, topicId: null }];
    };
    return (
      <Screen>
        <PageHeader title={`Mock — ${exam}`} subtitle="Standard counts · real timing" color={colors.danger} />
        {mockOptions().map((o) => (
          <MenuRow key={o.label} icon="📝" title={o.label} subtitle={`${o.minutes} min on the clock`} color={colors.danger} onPress={() => startMock(o.label, o.count, o.minutes, o.topicId)} />
        ))}
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
        {msg ? <Card accent={colors.danger}><Text style={{ color: colors.danger }}>{msg}</Text></Card> : null}
      </Screen>
    );
  }

  if (screen === "mockrun" && mq[mqi]) {
    const q = mq[mqi];
    const opts = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
    const mm = String(Math.floor(msecs / 60)).padStart(2, "0");
    const ss = String(msecs % 60).padStart(2, "0");
    return (
      <Screen>
        <PageHeader title={mockLabel} subtitle={`Q${mqi + 1}/${mq.length}`} color={colors.danger} />
        <TimerPill label={`${mm}:${ss}`} />
        <ProgressBar value={mqi / mq.length} color={colors.danger} />
        <HoverCard>
          <Text style={{ fontSize: 17, fontWeight: "700", lineHeight: 24 }}>{q.stem}</Text>
        </HoverCard>
        {opts.map((o, i) => (
          <Btn key={i} title={o} variant="ghost" onPress={() => answerMock(i)} />
        ))}
      </Screen>
    );
  }

  if (screen === "mockresult") {
    const score = mans.filter((a) => a.correct).length;
    const delta = mprev ? score / mans.length - mprev.score / Math.max(mprev.total, 1) : null;
    return (
      <Screen>
        <PageHeader title={`Mock: ${score}/${mans.length}`} subtitle={mprev ? "vs your last mock" : "Baseline set — beat it next time"} color={mprev && delta >= 0 ? colors.success : colors.danger} />
        {mprev ? (
          <HoverCard accent={delta >= 0 ? colors.success : colors.danger}>
            <Text style={{ ...type.small, color: colors.muted }}>Previous: {mprev.score}/{mprev.total} ({mprev.label})</Text>
            <Text style={{ ...type.h1, color: delta >= 0 ? colors.success : colors.danger }}>
              {delta >= 0 ? "▲ improving" : "▼ slipped"} ({(delta * 100).toFixed(0)} pts)
            </Text>
          </HoverCard>
        ) : <EmptyState icon="📝" text="First mock — this is your baseline." />}
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
      </Screen>
    );
  }

  if (screen === "progress") {
    return (
      <Screen>
        <PageHeader title={`Progress — ${exam}`} subtitle="Per-topic averages across all attempts" color={colors.success} />
        {dash.progress.length === 0 ? <EmptyState icon="📈" text="No attempts yet. Take the diagnostic first." /> : null}
        {dash.progress.map((p) => (
          <HoverCard key={p.topic_id}>
            <Text style={{ fontWeight: "800", fontSize: 15 }}>{p.name}</Text>
            <Text style={{ ...type.small, color: colors.muted }}>{p.attempts} tries · avg {(p.avg * 100).toFixed(0)}%</Text>
            <ProgressBar value={p.avg} color={p.avg >= 0.6 ? colors.success : colors.danger} />
          </HoverCard>
        ))}
        <SectionTitle>Mock history</SectionTitle>
        {dash.mocks.length === 0 ? <Text style={{ ...type.small, color: colors.muted }}>No mocks yet.</Text> : null}
        {dash.mocks.map((m) => (
          <Text key={m.id} style={{ ...type.small }}>• {m.label}: {m.score}/{m.total}</Text>
        ))}
        <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
      </Screen>
    );
  }

  if (screen === "settings") {
    return <SettingsScreen api={API_URL} userId={userId} exam={exam} dash={dash} onSaved={() => setScreen("home")} />;
  }

  const daysLeft = (() => {
    if (!dash.eprog.exam_date) return null;
    return Math.ceil((new Date(dash.eprog.exam_date) - new Date()) / 86400000);
  })();
  const weakNote = dash.plan[0] ? topics.find((t) => t.id === dash.plan[0].topic_id) : null;

  return (
    <Screen>
      <PageHeader title={`👋 ${exam}${exam === "WAEC" && dept ? ` · ${dept}` : ""}`} subtitle={daysLeft !== null ? `⏳ ${daysLeft} days to exam${dash.eprog.target ? ` · target ${dash.eprog.target}` : ""}` : "Pick a drill below to keep improving"} color={colors.success} />
      {offlineMode ? <Badge label="OFFLINE MODE" color={colors.text} /> : null}
      {msg ? <Card accent={colors.primary}><Text>{msg}</Text></Card> : null}

      {draft ? (
        <HoverCard accent={colors.primary} onPress={() => { setQuiz(draft.quiz); setQi(draft.qi); setAnswers(draft.answers); setTarget(draft.target); setStreak(draft.streak); setScreen("quiz"); }}>
          <Text style={{ fontWeight: "800", fontSize: 15 }}>▶ Continue where you left off</Text>
          <Text style={{ ...type.small, color: colors.muted }}>Resume your paused diagnostic ›</Text>
        </HoverCard>
      ) : null}

      <SectionTitle>Start</SectionTitle>
      <MenuRow icon="🎯" title="Diagnostic test" subtitle="15Q adaptive · find your level" color={colors.tutor} onPress={startDiagnostic} />
      <MenuRow icon="📝" title="Full mock exam" subtitle="Standard counts · real timing" color={colors.danger} onPress={() => setScreen("mocksetup")} />
      <MenuRow icon="📈" title="My progress" subtitle="Per-topic trends + mock history" color={colors.success} onPress={() => setScreen("progress")} />

      {dash.plan.length > 0 ? (
        <HoverCard accent={colors.success}>
          <Text style={{ fontWeight: "800", fontSize: 15 }}>This week 🎯 — fix weakest</Text>
          {dash.plan.map((p) => <Text key={p.topic_id} style={{ ...type.small }}>• {p.name} ×{p.drills} drills</Text>)}
        </HoverCard>
      ) : null}

      <SectionTitle>Help & community</SectionTitle>
      <MenuRow icon="✨" title="Ask AI tutor" subtitle="Knows your weak topics" color={colors.tutor} onPress={() => openTutor(null)} />
      <MenuRow icon="💬" title="Community Q&A" subtitle="Ask peers · leaderboard inside" color={colors.warning} onPress={loadPosts} />
      {weakNote ? <MenuRow icon="📘" title={`Notes: ${weakNote.name}`} subtitle="Your weakest topic" color={colors.secondary} onPress={() => openNotes(weakNote)} /> : null}

      {dash.badges.length > 0 ? (
        <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", marginVertical: spacing.xs }}>
          {dash.badges.map((b) => <Badge key={b} label={b} />)}
        </View>
      ) : null}
      {dash.prefs.reminder_time ? <Text style={{ ...type.small, color: colors.muted }}>🔔 Reminder at {dash.prefs.reminder_time} ✓</Text> : null}

      <SectionTitle>Practice by topic</SectionTitle>
      {topics.map((t) => (
        <MenuRow key={t.id} icon="📖" title={t.name} subtitle={t.subject} color={colors.primary} onPress={() => startPractice(t)} />
      ))}

      <SectionTitle>Offline</SectionTitle>
      <MenuRow icon="⬇" title="Download pack" subtitle="Questions + notes for offline" color={colors.text} onPress={downloadPack} />
      {pending > 0 ? <MenuRow icon="⬆" title={`Sync ${pending} result${pending > 1 ? "s" : ""}`} subtitle="Waiting on device" color={colors.text} onPress={syncNow} /> : null}
      <MenuRow icon="⚙" title="Settings" subtitle="Exam date · target · reminder" color={colors.muted} onPress={() => setScreen("settings")} />
      <MenuRow icon="🎨" title="Design system" subtitle="Tokens + components" color={colors.muted} onPress={() => setScreen("design")} />
    </Screen>
  );
}

function SettingsScreen({ api, userId, exam, dash, onSaved }) {
  const [examDate, setExamDate] = useState(dash.eprog.exam_date || "");
  const [target, setTarget] = useState(dash.eprog.target || "");
  const [rem, setRem] = useState(dash.prefs.reminder_time || "");
  const [msg, setMsg] = useState("");
  const save = async () => {
    await fetch(`${api}/exam-progress`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, exam_code: exam, exam_date: examDate || null, target }),
    });
    await fetch(`${api}/prefs`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, reminder_time: rem }),
    });
    setMsg("Saved ✓");
    onSaved();
  };
  return (
    <Screen>
      <PageHeader title="⚙ Settings" subtitle="Exam date · target · reminder" color={colors.text} />
      <Field label="Exam date (YYYY-MM-DD, optional)" value={examDate} onChangeText={setExamDate} placeholder="2026-11-01" />
      <Field label="Target score / grade (optional)" value={target} onChangeText={setTarget} placeholder="A1 / 1300 / 320" />
      <Field label="Daily reminder time (HH:MM, optional)" value={rem} onChangeText={setRem} placeholder="18:00" />
      <Btn title="Save" onPress={save} />
      <Btn title="← Back home" variant="ghost" onPress={onSaved} />
      {msg ? <Card accent={colors.success}><Text>{msg}</Text></Card> : null}
    </Screen>
  );
}
