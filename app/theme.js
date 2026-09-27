// BetterMe design tokens v0 — light, low-data, high-contrast for low-end devices.
export const colors = {
  primary: "#1a73e8",
  primaryDark: "#1558b0",
  bg: "#f7f9fc",
  card: "#ffffff",
  text: "#17233b",
  muted: "#5f6b7a",
  border: "#e2e8f0",
  success: "#1e9e6a",
  warning: "#b7791f",
  danger: "#d64545",
  tutor: "#6c4dff",
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 6, md: 10, lg: 16 };

export const type = {
  h1: { fontSize: 24, fontWeight: "700" },
  h2: { fontSize: 20, fontWeight: "700" },
  body: { fontSize: 15 },
  small: { fontSize: 13 },
};

export const difficultyColor = (d) =>
  d === 1 ? colors.success : d === 2 ? colors.warning : colors.danger;
