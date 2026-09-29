import { useState } from "react";
import { TouchableOpacity, Pressable, Text, View, ScrollView, TextInput } from "react-native";
import { colors, spacing, radius, type, shadow, page } from "./theme";

// Page scaffold: warm bg, safe padding, centered column on web
export const Screen = ({ children, bg }) => (
  <ScrollView style={{ backgroundColor: bg || colors.bg }} contentContainerStyle={{ paddingBottom: spacing.xl }}>
    <View style={{ padding: spacing.lg, gap: spacing.sm, ...page }}>{children}</View>
  </ScrollView>
);

// Gradient-feel header band per section
export const PageHeader = ({ title, subtitle, color }) => (
  <View style={{ backgroundColor: color || colors.primary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm }}>
    <Text style={{ ...type.h1, color: "#fff" }}>{title}</Text>
    {subtitle ? <Text style={{ color: "#fff", opacity: 0.92, ...type.small }}>{subtitle}</Text> : null}
  </View>
);

// Card that lifts + deepens shadow on hover (web) / press (native)
export const HoverCard = ({ children, onPress, accent }) => {
  const [hover, setHover] = useState(false);
  const Inner = onPress ? Pressable : View;
  return (
    <Inner
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{
        backgroundColor: colors.card,
        borderColor: accent || colors.border,
        borderWidth: 1.5,
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
        ...(hover ? shadow.hover : shadow.card),
        ...(hover && onPress ? { transform: [{ translateY: -2 }] } : null),
      }}
    >
      {children}
    </Inner>
  );
};

export const Btn = ({ title, onPress, variant = "primary" }) => {
  const [hover, setHover] = useState(false);
  const bg = variant === "ghost" ? colors.card : variant === "dark" ? colors.text : variant === "blue" ? colors.secondary : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{
        backgroundColor: bg,
        borderWidth: variant === "ghost" ? 2 : 0,
        borderColor: colors.primary,
        padding: spacing.md,
        borderRadius: radius.md,
        marginBottom: spacing.sm,
        ...(hover ? shadow.hover : shadow.card),
        ...(hover ? { transform: [{ translateY: -1 }], opacity: 0.96 } : null),
      }}
    >
      <Text style={{ color: variant === "ghost" ? colors.primary : "#fff", textAlign: "center", fontWeight: "800", fontSize: 15 }}>
        {title}
      </Text>
    </Pressable>
  );
};

export const Card = ({ children, accent }) => (
  <View style={{ backgroundColor: colors.card, borderColor: accent || colors.border, borderWidth: 1.5, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, ...shadow.card }}>
    {children}
  </View>
);

// Tappable row: icon chip + title + subtitle + chevron
export const MenuRow = ({ icon, title, subtitle, color, onPress }) => (
  <HoverCard onPress={onPress}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: (color || colors.primary) + "1c", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...type.body, fontWeight: "800" }}>{title}</Text>
        {subtitle ? <Text style={{ ...type.small, color: colors.muted }}>{subtitle}</Text> : null}
      </View>
      <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
    </View>
  </HoverCard>
);

export const Badge = ({ label, color = colors.success }) => (
  <View style={{ backgroundColor: color + "1c", borderColor: color, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignSelf: "flex-start" }}>
    <Text style={{ color, fontSize: 12, fontWeight: "800" }}>{label}</Text>
  </View>
);

export const ProgressBar = ({ value, color = colors.primary }) => (
  <View style={{ height: 10, backgroundColor: "#f1e8d8", borderRadius: 5, overflow: "hidden", marginTop: spacing.xs }}>
    <View style={{ width: `${Math.round(value * 100)}%`, height: 10, backgroundColor: color, borderRadius: 5 }} />
  </View>
);

export const SectionTitle = ({ children }) => (
  <Text style={{ ...type.h2, color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs }}>{children}</Text>
);

export const EmptyState = ({ icon, text }) => (
  <View style={{ alignItems: "center", padding: spacing.lg, gap: spacing.xs }}>
    <Text style={{ fontSize: 36 }}>{icon}</Text>
    <Text style={{ ...type.small, color: colors.muted, textAlign: "center" }}>{text}</Text>
  </View>
);

export const Field = ({ label, ...props }) => (
  <View style={{ marginBottom: spacing.sm }}>
    <Text style={{ ...type.small, fontWeight: "700", color: colors.text, marginBottom: spacing.xs }}>{label}</Text>
    <TextInput
      {...props}
      placeholderTextColor={colors.muted}
      style={{ backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md, fontSize: 15, color: colors.text }}
    />
  </View>
);

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
    backgroundColor: from === "tutor" ? colors.tutorSoft : "#f4efe4",
    borderColor: from === "tutor" ? colors.tutor : colors.border,
    borderWidth: 1.5, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.xs,
    ...(from === "you" ? { alignSelf: "flex-end", maxWidth: "88%" } : { alignSelf: "flex-start", maxWidth: "92%" }),
  }}>
    <Text style={{ fontWeight: "800", fontSize: 12, color: from === "tutor" ? colors.tutor : colors.muted }}>
      {from === "tutor" ? "✨ AI Tutor" : "You"}
    </Text>
    <Text style={{ ...type.body }}>{text}</Text>
  </View>
);

export const LeaderRow = ({ rank, name, score, you }) => (
  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.sm, backgroundColor: you ? colors.accent + "55" : colors.card, borderColor: you ? colors.warning : colors.border, borderWidth: you ? 2 : 1.5, borderRadius: radius.sm, marginBottom: spacing.xs }}>
    <Text style={{ fontWeight: "800" }}>{rank}. {name}{you ? " (you)" : ""}</Text>
    <Text style={{ fontWeight: "800", color: colors.primaryDark }}>{score}</Text>
  </View>
);
