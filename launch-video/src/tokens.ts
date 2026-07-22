import { loadFont as loadJakarta } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

export const colors = {
  ink: "#111111",
  violet: "#6C5CE7",
  violetDark: "#5546D6",
  yellow: "#FFD43B",
  green: "#22C55E",
  lavender: "#EDEBFF",
  graySoft: "#E8EBED",
  grayMid: "#6B7280",
  white: "#FFFFFF",
  gray50: "#F9FAFB",
  green100: "#DCFCE7",
  green600: "#16A34A",
  green700: "#15803D",
  yellow100: "#FEF9C3",
  yellow400: "#FACC15",
  yellow700: "#A16207",
  red100: "#FEE2E2",
  red400: "#F87171",
  red600: "#DC2626",
  red700: "#B91C1C",
} as const;

export const radius = {
  lg: 8,
  xl: 12,
  "2xl": 16,
  full: 9999,
} as const;

const jakarta = loadJakarta("normal", {
  weights: ["500", "600", "700"],
  subsets: ["latin"],
});

const inter = loadInter("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

export const fonts = {
  heading: jakarta.fontFamily,
  body: inter.fontFamily,
} as const;
