import { TouchableOpacity, Text, View } from "react-native";
import { colors, spacing, radius, type } from "./theme";

export const Btn = ({ title, onPress, variant = "primary" }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      backgroundColor: variant === "ghost" ? colors.card : colors.primary,
      borderWidth: variant === "ghost" ? 1 : 0,
      borderColor: colors.border,
      padding: spacing.md,
      borderRadius: radius.md,
      marginBottom: spacing.sm,
    }}
  >
    <Text style={{ color: variant === "ghost" ? colors.text : "#fff", textAlign: "center", fontWeight: "600" }}>
      {title}
    </Text>
  </TouchableOpacity>
);

export const Card = ({ children }) => (
  <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm }}>
    {children}
  </View>
);

export const Badge = ({ label, color = colors.success }) => (
  <View style={{ backgroundColor: color + "1a", borderRadius: radius.lg, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignSelf: "flex-start" }}>
    <Text style={{ color, fontSize: 12, fontWeight: "700" }}>{label}</Text>
  </View>
);

export const ProgressBar = ({ value }) => (
  <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden", marginTop: spacing.xs }}>
    <View style={{ width: `${Math.round(value * 100)}%`, height: 8, backgroundColor: colors.primary }} />
  </View>
);

export const SectionTitle = ({ children }) => (
  <Text style={{ ...type.h2, marginTop: spacing.md, marginBottom: spacing.sm }}>{children}</Text>
);
