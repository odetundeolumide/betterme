import { useState } from "react";
import { View, Text, TextInput, Button, FlatList, TouchableOpacity } from "react-native";

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

  return (
    <View style={{ padding: 24, gap: 8 }}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>Home — {exam}</Text>
      <Button title="Continue where you left off" onPress={() => setMsg("No draft yet — take the diagnostic first.")} />
      <Button title="Ask AI tutor" onPress={() => setMsg("Tutor arrives in Phase 5.")} />
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
