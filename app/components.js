import { useState, useEffect } from "react";
import { TouchableOpacity, Pressable, Text, View, ScrollView, TextInput, Animated } from "react-native";
import { colors, spacing, radius, type, shadow, page } from "./theme";

// Page scaffold: warm bg, safe padding, centered column on web.
// Optional floating action button (bottom-right) via `fab` node.
export const Screen = ({ children, bg, fab }) => (
  <View style={{ flex: 1, backgroundColor: bg || colors.bg, position: "relative" }}>
    <ScrollView style={{ backgroundColor: bg || colors.bg }} contentContainerStyle={{ paddingBottom: spacing.xl }}>
      <View style={{ padding: spacing.lg, gap: spacing.sm, ...page }}>{children}</View>
    </ScrollView>
    {fab ? <View style={{ position: "absolute", right: 16, bottom: 24 }}>{fab}</View> : null}
  </View>
);

// Animated female tutor buddy: bobs gently, speech bubble invites chat.
// Pure views (no assets) so it works identically on web + native.
export const TutorBuddy = ({ onPress }) => {
  const bob = useState(() => new Animated.Value(0))[0];
  const [hideTip, setHideTip] = useState(false);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: -6, duration: 1200, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);
  return (
    <View style={{ alignItems: "flex-end" }}>
      {!hideTip ? (
        <View style={{ backgroundColor: "#fff", borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 6, marginRight: 4, borderWidth: 1.5, borderColor: colors.tutor, ...shadow.card, maxWidth: 160 }}>
          <Text style={{ fontSize: 12, fontWeight: "800", color: colors.text, textAlign: "center" }}>Confused? Let's chat 💬</Text>
          <View style={{ position: "absolute", bottom: -5, right: 22, width: 10, height: 10, backgroundColor: "#fff", borderRightWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.tutor, transform: [{ rotate: "45deg" }] }} />
          <Pressable onPress={() => setHideTip(true)} style={{ position: "absolute", top: -9, right: -7, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>×</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable onPress={onPress} accessibilityLabel="Open AI tutor">
        <Animated.View style={{ transform: [{ translateY: bob }], alignItems: "center" }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#3a2a20", alignItems: "center", justifyContent: "center", ...shadow.hover }}>
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: "#f6c89f", alignItems: "center", overflow: "hidden" }}>
              <View style={{ width: 50, height: 15, backgroundColor: "#3a2a20", borderBottomLeftRadius: 22, borderBottomRightRadius: 22 }} />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 7 }}>
                <View style={{ width: 6, height: 8, borderRadius: 3, backgroundColor: "#14213d" }} />
                <View style={{ width: 6, height: 8, borderRadius: 3, backgroundColor: "#14213d" }} />
              </View>
              <View style={{ width: 16, height: 9, borderBottomWidth: 2.5, borderColor: "#b34a3f", borderBottomLeftRadius: 10, borderBottomRightRadius: 10, marginTop: 1 }} />
              <View style={{ flexDirection: "row", gap: 14, marginTop: 3 }}>
                <View style={{ width: 8, height: 5, borderRadius: 4, backgroundColor: "#f0a080" }} />
                <View style={{ width: 8, height: 5, borderRadius: 4, backgroundColor: "#f0a080" }} />
              </View>
            </View>
          </View>
          <View style={{ width: 46, height: 15, backgroundColor: colors.tutor, borderTopLeftRadius: 11, borderTopRightRadius: 11, marginTop: -9 }} />
        </Animated.View>
      </Pressable>
    </View>
  );
};

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
