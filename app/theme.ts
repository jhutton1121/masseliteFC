import { createTheme } from "@mui/material/styles";

const darkPalette = {
  primary: {
    main: "#5B8DEF",
    dark: "#3A6CD4",
    light: "#7BA7F7",
  },
  background: {
    default: "#0B0F19",
    paper: "#111827",
  },
  text: {
    primary: "#E2E8F0",
    secondary: "#94A3B8",
    disabled: "#64748B",
  },
  divider: "#1E293B",
  success: { main: "#10B981" },
  error: { main: "#EF4444" },
  warning: { main: "#F59E0B" },
  info: { main: "#3B82F6" },
};

const lightPalette = {
  primary: {
    main: "#3A6CD4",
    dark: "#2B54A8",
    light: "#5B8DEF",
  },
  background: {
    default: "#F8FAFC",
    paper: "#FFFFFF",
  },
  text: {
    primary: "#0F172A",
    secondary: "#334155",
    disabled: "#94A3B8",
  },
  divider: "#E2E8F0",
  success: { main: "#10B981" },
  error: { main: "#EF4444" },
  warning: { main: "#F59E0B" },
  info: { main: "#3B82F6" },
};

const sharedComponents = {
  MuiButton: {
    styleOverrides: {
      root: { textTransform: "none" as const, borderRadius: 8 },
    },
  },
  MuiCard: {
    defaultProps: { variant: "outlined" as const },
  },
  MuiChip: {
    styleOverrides: {
      root: { borderRadius: 6 },
    },
  },
  MuiTextField: {
    defaultProps: {
      InputLabelProps: { shrink: true },
    },
  },
  MuiInputLabel: {
    defaultProps: { shrink: true },
  },
  MuiOutlinedInput: {
    defaultProps: { notched: true },
  },
};

const sharedTypography = {
  fontFamily: "'DM Sans', sans-serif",
  h1: { fontWeight: 700 },
  h2: { fontWeight: 700 },
  h3: { fontWeight: 600 },
  h4: { fontWeight: 600 },
  h5: { fontWeight: 600 },
  h6: { fontWeight: 600 },
  body1: { fontWeight: 400 },
  body2: { fontWeight: 400 },
};

export const darkTheme = createTheme({
  palette: { mode: "dark", ...darkPalette },
  typography: sharedTypography,
  components: sharedComponents,
  shape: { borderRadius: 8 },
});

export const lightTheme = createTheme({
  palette: { mode: "light", ...lightPalette },
  typography: sharedTypography,
  components: sharedComponents,
  shape: { borderRadius: 8 },
});
