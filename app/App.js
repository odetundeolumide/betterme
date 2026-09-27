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

  return (
    <View style={{ padding: 24, gap: 8 }}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>Home — {exam}</Text>
      <Button title="Continue where you left off" onPress={() => setMsg("No draft yet — take the diagnostic first.")} />
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
