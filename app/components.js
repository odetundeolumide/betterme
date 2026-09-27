import { TouchableOpacity, Text, View } from "react-native";
import { colors, spacing, radius, type } from "./theme";

export const Btn = ({ title, onPress, variant = "primary" }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      backgroundColor: variant === "ghost" ? colors.card : colors.primary,
      borderWidth: variant === "ghost" ? 2 : 0,
      borderColor: colors.primary,
      padding: spacing.md,
      borderRadius: radius.md,
      marginBottom: spacing.sm,
    }}
  >
    <Text style={{ color: variant === "ghost" ? colors.primary : "#fff", textAlign: "center", fontWeight: "800" }}>
      {title}
    </Text>
  </TouchableOpacity>
);

export const Card = ({ children, accent = colors.border }) => (
  <View style={{ backgroundColor: colors.card, borderColor: accent, borderWidth: 2, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm }}>
    {children}
  </View>
);

export const Badge = ({ label, color = colors.success }) => (
  <View style={{ backgroundColor: color + "22", borderRadius: radius.lg, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignSelf: "flex-start", borderWidth: 1, borderColor: color }}>
    <Text style={{ color, fontSize: 12, fontWeight: "800" }}>{label}</Text>
  </View>
);

export const ProgressBar = ({ value, color = colors.primary }) => (
  <View style={{ height: 10, backgroundColor: "#f1f5f9", borderRadius: 5, overflow: "hidden", marginTop: spacing.xs }}>
    <View style={{ width: `${Math.round(value * 100)}%`, height: 10, backgroundColor: color }} />
  </View>
);

export const SectionTitle = ({ children }) => (
  <Text style={{ ...type.h2, marginTop: spacing.md, marginBottom: spacing.sm }}>{children}</Text>
);

// Section kit: one component per PRD area so every screen looks consistent.
export const SectionBanner = ({ title, subtitle, color }) => (
  <View style={{ backgroundColor: color, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm }}>
    <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>{title}</Text>
    <Text style={{ color: "#fff", opacity: 0.9 }}>{subtitle}</Text>
  </View>
);

export const TimerPill = ({ label }) => (
  <View style={{ backgroundColor: colors.text, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, alignSelf: "flex-start" }}>
    <Text style={{ color: "#fff", fontWeight: "800" }}>⏱ {label}</Text>
  </View>
);

export const ChatBubble = ({ from, text }) => (
  <View style={{
    backgroundColor: from === "tutor" ? colors.tutor + "1a" : "#f1f5f9",
    borderColor: from === "tutor" ? colors.tutor : "#e2e8f0",
    borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.xs,
  }}>
    <Text style={{ fontWeight: "700", color: from === "tutor" ? colors.tutor : colors.muted }}>
      {from === "tutor" ? "AI Tutor" : "You"}
    </Text>
    <Text>{text}</Text>
  </View>
);

export const LeaderRow = ({ rank, name, score, you }) => (
  <View style={{ flexDirection: "row", justifyContent: "space-between", padding: spacing.sm, backgroundColor: you ? colors.accent + "44" : colors.card, borderRadius: radius.sm, marginBottom: spacing.xs, borderWidth: you ? 2 : 0, borderColor: colors.warning }}>
    <Text style={{ fontWeight: "800" }}>{rank}. {name}{you ? " (you)" : ""}</Text>
    <Text style={{ fontWeight: "800" }}>{score}</Text>
  </View>
);
