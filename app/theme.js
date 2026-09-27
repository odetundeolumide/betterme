// BetterMe design tokens v1 — BRIGHT, high-energy, youth-friendly.
export const colors = {
  primary: "#ff5a00",
  primaryDark: "#d64a00",
  secondary: "#00b3ff",
  accent: "#ffcf00",
  bg: "#fffdf5",
  card: "#ffffff",
  text: "#14213d",
  muted: "#6b7280",
  border: "#ffe1b3",
  success: "#00c853",
  warning: "#ff9f00",
  danger: "#ff2e63",
  tutor: "#7c4dff",
  gradient: ["#ff5a00", "#ff9f00", "#ffcf00"],
};

export const sectionColor = {
  auth: "#00b3ff",
  exams: "#ff5a00",
  home: "#00c853",
  diagnostic: "#7c4dff",
  practice: "#ff5a00",
  notes: "#00b3ff",
  mock: "#ff2e63",
  progress: "#00c853",
  tutor: "#7c4dff",
  community: "#ff9f00",
  offline: "#14213d",
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 6, md: 12, lg: 20 };

export const type = {
  h1: { fontSize: 26, fontWeight: "800" },
  h2: { fontSize: 20, fontWeight: "800" },
  body: { fontSize: 15 },
  small: { fontSize: 13 },
};

export const difficultyColor = (d) =>
  d === 1 ? colors.success : d === 2 ? colors.warning : colors.danger;
