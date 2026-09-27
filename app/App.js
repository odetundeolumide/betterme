import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Button, FlatList, TouchableOpacity, ScrollView } from "react-native";
import { colors, spacing, type, difficultyColor } from "./theme";
import { Btn, Card, Badge, ProgressBar, SectionTitle, ChatBubble, LeaderRow } from "./components";
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
      <View style={{ padding: 24, gap: 8 }}>
        <Text style={{ fontSize: 24, fontWeight: "700" }}>BetterMe</Text>
        <Text>Sign in to start your diagnostic.</Text>
        <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={{ borderWidth: 1, padding: 8 }} />
        <TextInput placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} style={{ borderWidth: 1, padding: 8 }} />
        <Button title="Sign up" onPress={() => callAuth("sign-up")} />
        <Button title="Sign in" onPress={() => callAuth("sign-in")} />
        {msg ? <Text>{msg}</Text> : null}
      </View>
    );
  }

  if (screen === "exams") {
    return (
      <View style={{ padding: 24, gap: 8 }}>
        <Text style={{ fontSize: 20, fontWeight: "700" }}>Choose your exam</Text>
        {EXAMS.map((e) => (
          <Button key={e} title={e} onPress={() => pickExam(e)} />
        ))}
      </View>
    );
  }

  if (screen === "dept") {
    return (
      <View style={{ padding: 24, gap: 8 }}>
        <Text style={{ fontSize: 20, fontWeight: "700" }}>WAEC — choose department</Text>
        <Text style={{ color: colors.muted }}>English, Mathematics + Civic are general for all.</Text>
        {["Science", "Art", "Commerce"].map((d) => (
          <Button key={d} title={d} onPress={() => pickDept(d)} />
        ))}
      </View>
    );
  }

  if (screen === "design") {
    return (
      <ScrollView style={{ backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          <Text style={type.h1}>Design system</Text>
          <Text style={{ color: colors.muted }}>Tokens + components. Tap Home to go back.</Text>
          <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
          <SectionTitle>Colors</SectionTitle>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {[colors.primary, colors.success, colors.warning, colors.danger, colors.tutor].map((c) => (
              <View key={c} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c }} />
            ))}
          </View>
          <SectionTitle>Buttons / Cards / Badges</SectionTitle>
          <Btn title="Primary button" onPress={() => {}} />
          <Btn title="Ghost button" variant="ghost" onPress={() => {}} />
          <Card>
            <Text style={type.h2}>Quiz review card</Text>
            <Text style={{ color: colors.muted }}>Algebra · difficulty <Text style={{ color: difficultyColor(3), fontWeight: "700" }}>hard</Text></Text>
            <ProgressBar value={0.67} />
          </Card>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Badge label="NEW" />
            <Badge label="WEAK" color={colors.danger} />
            <Badge label="TUTOR" color={colors.tutor} />
          </View>
        </View>
      </ScrollView>
    );
  }

  if (screen === "quiz" && quiz[qi]) {
    const q = quiz[qi];
    const opts = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
    return (
      <ScrollView style={{ backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg }}>
          <Text style={type.h2}>Diagnostic {qi + 1}/{quiz.length}</Text>
          <Text style={{ color: colors.muted }}>Level <Text style={{ color: difficultyColor(q.difficulty), fontWeight: "800" }}>{q.difficulty}</Text> · adaptive</Text>
          <Card>
            <Text style={{ fontSize: 16, fontWeight: "700" }}>{q.stem}</Text>
          </Card>
          {opts.map((o, i) => (
            <Btn key={i} title={o} variant="ghost" onPress={() => answerQuiz(i)} />
          ))}
          <Btn title="⏸ Pause & continue later" variant="ghost" onPress={pauseQuiz} />
        </View>
      </ScrollView>
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
      <ScrollView style={{ backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg }}>
          <Text style={type.h1}>Results: {score}/{answers.length}</Text>
          {Object.entries(perTopic).map(([name, v]) => (
            <Card key={name}>
              <Text style={{ fontWeight: "700" }}>{name}: {v.ok}/{v.n}</Text>
              <ProgressBar value={v.ok / v.n} color={v.ok / v.n >= 0.6 ? colors.success : colors.danger} />
            </Card>
          ))}
          {weak ? <Text>Weakest: <Text style={{ fontWeight: "800" }}>{weak[0]}</Text> — practice it next.</Text> : null}
          <Btn title="Practice weakest topic →" onPress={() => { const t = topics.find((x) => x.name === weak[0]); if (t) startPractice(t); }} />
          <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
          {msg ? <Text>{msg}</Text> : null}
        </View>
      </ScrollView>
    );
  }

  if (screen === "practice" && pq[pqi]) {
    const q = pq[pqi];
    const opts = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
    const mm = String(Math.floor(secs / 60)).padStart(2, "0");
    const ss = String(secs % 60).padStart(2, "0");
    return (
      <ScrollView style={{ backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg }}>
          <Text style={type.h2}>{ptopic.name} {pqi + 1}/{pq.length}</Text>
          <Text style={{ fontWeight: "800" }}>⏱ {mm}:{ss}</Text>
          <ProgressBar value={pqi / pq.length} />
          <Card><Text style={{ fontSize: 16, fontWeight: "700" }}>{q.stem}</Text></Card>
          {opts.map((o, i) => (
            <Btn key={i} title={o} variant="ghost" onPress={() => answerPractice(i)} />
          ))}
          <Btn title="📘 Read notes first" variant="ghost" onPress={() => openNotes(ptopic)} />
        </View>
      </ScrollView>
    );
  }

  if (screen === "review") {
    const score = pans.filter((a) => a.correct).length;
    return (
      <ScrollView style={{ backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg }}>
          <Text style={type.h1}>Practice: {score}/{pans.length}</Text>
          {pans.map((a, i) => {
            const opts = typeof a.q.options === "string" ? JSON.parse(a.q.options) : a.q.options;
            return (
              <Card key={i} accent={a.correct ? colors.success : colors.danger}>
                <Text style={{ fontWeight: "700" }}>Q{i + 1}. {a.q.stem}</Text>
                <Text>You: {opts[a.picked]} {a.correct ? "✅" : "❌"}</Text>
                {!a.correct ? <Text>Answer: {opts[a.q.answer_idx]}</Text> : null}
                <Text style={{ color: colors.muted }}>{a.q.explanation}</Text>
                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                  <View style={{ flex: 1 }}><Btn title="✨ Ask tutor" variant="ghost" onPress={() => openTutor(a.q)} /></View>
                  <View style={{ flex: 1 }}><Btn title="🚩 Report" variant="ghost" onPress={() => reportQ(a.q.id)} /></View>
                </View>
              </Card>
            );
          })}
          {msg ? <Text>{msg}</Text> : null}
          <Btn title="📘 Topic notes" onPress={() => openNotes(ptopic)} />
          <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
        </View>
      </ScrollView>
    );
  }

  if (screen === "notes") {
    return (
      <ScrollView style={{ backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg }}>
          <Text style={type.h1}>📘 {ptopic ? ptopic.name : "Notes"}</Text>
          <Card><Text>{note ? note.body_md : "Loading…"}</Text></Card>
          {ptopic ? <Btn title="Practice this topic →" onPress={() => startPractice(ptopic)} /> : null}
          <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
        </View>
      </ScrollView>
    );
  }

  if (screen === "tutor") {
    const sug = tutorCtx?.suggestion;
    const sugTopic = sug ? topics.find((t) => t.id === sug.topic_id) : null;
    return (
      <ScrollView style={{ backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg }}>
          <Text style={type.h1}>✨ AI tutor</Text>
          {tutorCtx ? (
            <Text style={{ color: colors.muted }}>
              Knows: weak {tutorCtx.weakTopics?.map((w) => w.name).join(", ") || "none yet"}
              {tutorCtx.examDate ? ` · exam ${tutorCtx.examDate}` : ""}
            </Text>
          ) : null}
          {tutorQ ? <Card accent={colors.tutor}><Text style={{ fontWeight: "700" }}>About: {tutorQ.stem}</Text></Card> : null}
          {chat.map((m, i) => (
            <ChatBubble key={i} from={m.from} text={m.text} />
          ))}
          {tsending ? <Text style={{ color: colors.muted }}>Tutor is thinking…</Text> : null}
          {sug && sugTopic ? (
            <Card accent={colors.tutor}>
              <Text style={{ fontWeight: "800" }}>Practice next → {sugTopic.name}</Text>
              <Btn title="Start drill" onPress={() => startPractice(sugTopic)} />
            </Card>
          ) : null}
          <TextInput value={tmsg} onChangeText={setTmsg} placeholder="Ask, e.g. explain this again simply" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, marginTop: spacing.sm }} />
          <Btn title="Send" onPress={() => askTutor()} />
          <Btn title="Explain simply" variant="ghost" onPress={() => askTutor("explain this again in a simpler way")} />
          <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
        </View>
      </ScrollView>
    );
  }

  if (screen === "community") {
    return (
      <ScrollView style={{ backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg }}>
          <Text style={type.h1}>Community — {exam}</Text>
          <Text style={{ color: colors.muted }}>One shared feed, filtered by exam.</Text>
          <SectionTitle>Ask a question</SectionTitle>
          <TextInput value={newTitle} onChangeText={setNewTitle} placeholder="Title, e.g. Why is (x−2)(x−3)=0?" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8 }} />
          <TextInput value={newBody} onChangeText={setNewBody} placeholder="Details (optional)" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, marginTop: spacing.sm }} />
          <Btn title="Post" onPress={submitPost} />
          <SectionTitle>Questions</SectionTitle>
          {posts.length === 0 ? <Text style={{ color: colors.muted }}>No questions yet — be the first.</Text> : null}
          {posts.map((p) => (
            <TouchableOpacity key={p.id} onPress={() => openPost(p.id)}>
              <Card>
                <Text style={{ fontWeight: "700" }}>{p.title}</Text>
                <Text style={{ color: colors.muted }}>{p.user_id} · {p.topic_name || p.exam_code} · {p.answers} answers</Text>
              </Card>
            </TouchableOpacity>
          ))}
          <Btn title="🏆 Leaderboard" onPress={loadBoard} />
          <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
        </View>
      </ScrollView>
    );
  }

  if (screen === "post" && postDetail) {
    return (
      <ScrollView style={{ backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg }}>
          <Text style={type.h1}>{postDetail.title}</Text>
          <Text style={{ color: colors.muted }}>{postDetail.user_id} · {postDetail.topic_name || postDetail.exam_code}</Text>
          {postDetail.body ? <Card><Text>{postDetail.body}</Text></Card> : null}
          <SectionTitle>Answers ({postDetail.answers.length})</SectionTitle>
          {postDetail.answers.map((a) => (
            <Card key={a.id} accent={a.is_accepted ? colors.success : colors.border}>
              <Text>{a.is_accepted ? "✅ " : ""}{a.body}</Text>
              <Text style={{ color: colors.muted }}>— {a.user_id}</Text>
              {!a.is_accepted ? <Btn title="Accept ✓" variant="ghost" onPress={() => acceptAnswer(a.id)} /> : null}
            </Card>
          ))}
          <TextInput value={answerBody} onChangeText={setAnswerBody} placeholder="Write your answer…" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8 }} />
          <Btn title="Answer" onPress={submitAnswer} />
          <Btn title="🚩 Report post" variant="ghost" onPress={() => fetch(`${API_URL}/api/posts/${postDetail.id}/report`, { method: "POST" }).then(() => setScreen("community"))} />
          <Btn title="← Back" variant="ghost" onPress={loadPosts} />
        </View>
      </ScrollView>
    );
  }

  if (screen === "board") {
    return (
      <ScrollView style={{ backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg }}>
          <Text style={type.h1}>🏆 Leaderboard — {exam}</Text>
          {board.board.length === 0 ? <Text style={{ color: colors.muted }}>No quiz scores yet. Finish a quiz to rank.</Text> : null}
          {board.board.map((b) => (
            <LeaderRow key={b.rank} rank={b.rank} name={b.user} score={`${b.total} pts · ${b.quizzes} quizzes`} you={b.you} />
          ))}
          <Btn title="← Back" variant="ghost" onPress={() => setScreen("community")} />
        </View>
      </ScrollView>
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
      <ScrollView style={{ backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg }}>
          <Text style={type.h1}>Mock exam — {exam}</Text>
          <Text style={{ color: colors.muted }}>Standard counts. Bank shortfall will be shown.</Text>
          {mockOptions().map((o) => (
            <Btn key={o.label} title={o.label} onPress={() => startMock(o.label, o.count, o.minutes, o.topicId)} />
          ))}
          <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
          {msg ? <Text>{msg}</Text> : null}
        </View>
      </ScrollView>
    );
  }

  if (screen === "mockrun" && mq[mqi]) {
    const q = mq[mqi];
    const opts = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
    const mm = String(Math.floor(msecs / 60)).padStart(2, "0");
    const ss = String(msecs % 60).padStart(2, "0");
    return (
      <ScrollView style={{ backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg }}>
          <Text style={type.h2}>{mockLabel}</Text>
          <Text style={{ fontWeight: "800" }}>Q{mqi + 1}/{mq.length} · ⏱ {mm}:{ss}</Text>
          <ProgressBar value={mqi / mq.length} color={colors.danger} />
          <Card><Text style={{ fontSize: 16, fontWeight: "700" }}>{q.stem}</Text></Card>
          {opts.map((o, i) => (
            <Btn key={i} title={o} variant="ghost" onPress={() => answerMock(i)} />
          ))}
        </View>
      </ScrollView>
    );
  }

  if (screen === "mockresult") {
    const score = mans.filter((a) => a.correct).length;
    const delta = mprev ? score / mans.length - mprev.score / Math.max(mprev.total, 1) : null;
    return (
      <ScrollView style={{ backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg }}>
          <Text style={type.h1}>Mock: {score}/{mans.length}</Text>
          {mprev ? (
            <Card>
              <Text>Previous: {mprev.score}/{mprev.total} ({mprev.label})</Text>
              <Text style={{ fontWeight: "800", color: delta >= 0 ? colors.success : colors.danger }}>
                {delta >= 0 ? "▲ improving" : "▼ slipped"} ({(delta * 100).toFixed(0)} pts)
              </Text>
            </Card>
          ) : <Text style={{ color: colors.muted }}>First mock — this is your baseline.</Text>}
          <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
        </View>
      </ScrollView>
    );
  }

  if (screen === "progress") {
    return (
      <ScrollView style={{ backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg }}>
          <Text style={type.h1}>Progress — {exam}</Text>
          {dash.progress.length === 0 ? <Text style={{ color: colors.muted }}>No attempts yet. Take the diagnostic first.</Text> : null}
          {dash.progress.map((p) => (
            <Card key={p.topic_id}>
              <Text style={{ fontWeight: "700" }}>{p.name} · {p.attempts} tries · avg {(p.avg * 100).toFixed(0)}%</Text>
              <ProgressBar value={p.avg} color={p.avg >= 0.6 ? colors.success : colors.danger} />
            </Card>
          ))}
          <Text style={type.h2}>Mocks</Text>
          {dash.mocks.map((m) => (
            <Text key={m.id}>- {m.label}: {m.score}/{m.total}</Text>
          ))}
          <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
        </View>
      </ScrollView>
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
    <ScrollView style={{ backgroundColor: colors.bg }}>
    <View style={{ padding: 24, gap: 8 }}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>Home — {exam}{exam === "WAEC" && dept ? ` · ${dept}` : ""}</Text>
      {offlineMode ? <Badge label="OFFLINE MODE" color={colors.text} /> : null}
      <Button title="⬇ Download pack for offline" onPress={downloadPack} />
      {pending > 0 ? <Button title={`⬆ Sync ${pending} offline result${pending > 1 ? "s" : ""}`} onPress={syncNow} /> : null}
      {daysLeft !== null ? <Card><Text style={{ fontWeight: "800" }}>⏳ {daysLeft} days to exam{dash.eprog.target ? ` · target ${dash.eprog.target}` : ""}</Text></Card> : null}
      <Button title="Start diagnostic test" onPress={startDiagnostic} />
      <Button title="Full mock exam" onPress={() => setScreen("mocksetup")} />
      <Button title="My progress" onPress={() => setScreen("progress")} />
      {draft ? <Button title="Continue where you left off" onPress={() => { setQuiz(draft.quiz); setQi(draft.qi); setAnswers(draft.answers); setTarget(draft.target); setStreak(draft.streak); setScreen("quiz"); }} /> : null}
      {dash.plan.length > 0 ? (
        <Card accent={colors.success}>
          <Text style={{ fontWeight: "800" }}>This week 🎯 fix weakest:</Text>
          {dash.plan.map((p) => <Text key={p.topic_id}>- {p.name} ×{p.drills} drills</Text>)}
        </Card>
      ) : null}
      {dash.badges.length > 0 ? (
        <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
          {dash.badges.map((b) => <Badge key={b} label={b} />)}
        </View>
      ) : null}
      {dash.prefs.reminder_time ? <Text style={{ color: colors.muted }}>🔔 Reminder at {dash.prefs.reminder_time} ✓</Text> : null}
      {weakNote ? <Button title={`📝 Notes: ${weakNote.name} (weakest)`} onPress={() => openNotes(weakNote)} /> : null}
      <Button title="Ask AI tutor" onPress={() => openTutor(null)} />
      <Button title="Community Q&A" onPress={loadPosts} />
      <Button title="View design system" onPress={() => setScreen("design")} />
      <Button title="⚙ Settings (date, target, reminder)" onPress={() => setScreen("settings")} />
      {msg ? <Text>{msg}</Text> : null}
      <Text style={{ fontWeight: "700" }}>Practice by topic:</Text>
      <FlatList
        data={topics}
        keyExtractor={(t) => String(t.id)}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => startPractice(item)}>
            <Text>- {item.subject}: {item.name} →</Text>
          </TouchableOpacity>
        )}
      />
    </View>
    </ScrollView>
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
    <ScrollView style={{ backgroundColor: colors.bg }}>
      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        <Text style={type.h1}>⚙ Settings</Text>
        <Text>Exam date (YYYY-MM-DD, optional)</Text>
        <TextInput value={examDate} onChangeText={setExamDate} placeholder="2026-11-01" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8 }} />
        <Text>Target score / grade (optional)</Text>
        <TextInput value={target} onChangeText={setTarget} placeholder="A1 / 1300 / 320" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8 }} />
        <Text>Daily reminder time (HH:MM, optional)</Text>
        <TextInput value={rem} onChangeText={setRem} placeholder="18:00" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8 }} />
        <Btn title="Save" onPress={save} />
        <Btn title="← Back home" variant="ghost" onPress={onSaved} />
        {msg ? <Text>{msg}</Text> : null}
      </View>
    </ScrollView>
  );
}
