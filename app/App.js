import { useState } from "react";
import { View, Text, TextInput, Button, FlatList, TouchableOpacity, ScrollView } from "react-native";
import { colors, spacing, type, difficultyColor } from "./theme";
import { Btn, Card, Badge, ProgressBar, SectionTitle } from "./components";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
const EXAMS = ["WAEC", "TOEFL", "SAT", "GRE"];

export default function App() {
  const [screen, setScreen] = useState("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [exam, setExam] = useState(null);
  const [topics, setTopics] = useState([]);
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
    setScreen("exams");
  };

  const pickExam = async (code) => {
    setExam(code);
    const res = await fetch(`${API_URL}/api/topics?exam=${code}`);
    setTopics(res.ok ? await res.json() : []);
    setScreen("home");
  };

  const startDiagnostic = async () => {
    setMsg("");
    const res = await fetch(`${API_URL}/api/questions?exam=${exam}&limit=30`);
    if (!res.ok) return setMsg("Could not load questions — is the server running?");
    const all = await res.json();
    if (!all.length) return setMsg("No questions seeded for this exam yet.");
    const byDiff = (d) => all.filter((q) => q.difficulty === d);
    const ordered = [...byDiff(2), ...byDiff(1), ...byDiff(3)].slice(0, 10);
    setQuiz(ordered); setQi(0); setAnswers([]); setTarget(2); setStreak(0);
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
    if (qi + 1 >= quiz.length) setScreen("results");
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
          <Btn title="Practice weakest topic →" onPress={() => setMsg("Topic practice arrives in Phase 3.")} />
          <Btn title="← Back home" variant="ghost" onPress={() => setScreen("home")} />
          {msg ? <Text>{msg}</Text> : null}
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={{ padding: 24, gap: 8 }}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>Home — {exam}</Text>
      <Button title="Start diagnostic test" onPress={startDiagnostic} />
      {draft ? <Button title="Continue where you left off" onPress={() => { setQuiz(draft.quiz); setQi(draft.qi); setAnswers(draft.answers); setTarget(draft.target); setStreak(draft.streak); setScreen("quiz"); }} /> : null}
      <Button title="Ask AI tutor" onPress={() => setMsg("Tutor arrives in Phase 5.")} />
      <Button title="View design system" onPress={() => setScreen("design")} />
      {msg ? <Text>{msg}</Text> : null}
      <Text style={{ fontWeight: "700" }}>Weakest topics → practice:</Text>
      <FlatList
        data={topics}
        keyExtractor={(t) => String(t.id)}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setMsg(`Practice ${item.name} (Phase 3)`)}>
            <Text>- {item.subject}: {item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
