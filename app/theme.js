// BetterMe design tokens v2 — standard mobile UI: warm bright palette,
// consistent type scale, spacing rhythm, soft shadows, web max-width.
export const colors = {
  primary: "#ff5a00",
  primaryDark: "#d64a00",
  primarySoft: "#fff1e5",
  secondary: "#00b3ff",
  secondarySoft: "#e5f6ff",
  accent: "#ffcf00",
  bg: "#fff9f0",
  card: "#ffffff",
  text: "#14213d",
  muted: "#6b7280",
  border: "#f3e3cb",
  success: "#00c853",
  successSoft: "#e5f7ee",
  warning: "#ff9f00",
  danger: "#ff2e63",
  dangerSoft: "#ffe9ef",
  tutor: "#7c4dff",
  tutorSoft: "#efe9ff",
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
export const radius = { sm: 8, md: 14, lg: 22 };

export const type = {
  hero: { fontSize: 30, fontWeight: "800", lineHeight: 36 },
  h1: { fontSize: 24, fontWeight: "800", lineHeight: 30 },
  h2: { fontSize: 18, fontWeight: "800", lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  tiny: { fontSize: 11, lineHeight: 15 },
};

export const shadow = {
  card: { shadowColor: "#7a4a00", shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  hover: { shadowColor: "#7a4a00", shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
};

// Centered reading column on web, full-bleed on phones
export const page = { width: "100%", maxWidth: 600, alignSelf: "center" };

export const difficultyColor = (d) =>
  d === 1 ? colors.success : d === 2 ? colors.warning : colors.danger;
