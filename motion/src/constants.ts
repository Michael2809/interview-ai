// Centralized timing, sizing and color constants for the 20-second
// Recrewt AI motion test. Keep all scene durations here so the overall
// story beats can be retimed from one place.

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Shared world-space anchor so the recruiter sits in the same screen
// position across scene cuts.
export const CENTER_X = 960;
export const GROUND_Y = 760;
// RecruiterCharacter's local origin is the HIP, with legs hanging down
// ~88px to the feet in a relaxed stance. Translate the figure to this
// height above GROUND_Y so its feet land on the ground line, not below it.
export const RECRUITER_HIP_HEIGHT = 88;

// --- Scene durations (in frames) — Revision 2 ---------------------------
// 0:00–0:03  Intro — the recruiter, alone, calm.
export const INTRO_DURATION = 3 * FPS; // 90
// 0:03–0:07  Candidates arrive, chains attach, workload accumulates.
export const WORKLOAD_DURATION = 4 * FPS; // 120
// 0:07–0:10  A dark/red pressure shadow grows behind the recruiter.
export const PRESSURE_DURATION = 3 * FPS; // 90
// 0:10–0:13  Hero pull-back: the shadow resolves into a mountain outline.
export const MOUNTAIN_DURATION = 3 * FPS; // 90
// 0:13–0:17  Screening cycle — approach, evaluate, reject, repeat.
export const SCREENING_DURATION = 4 * FPS; // 120
// 0:17–0:20  Discovery of the Recrewt elevator. Yellow enters.
export const ELEVATOR_DURATION = 3 * FPS; // 90

export const TOTAL_DURATION =
  INTRO_DURATION +
  WORKLOAD_DURATION +
  PRESSURE_DURATION +
  MOUNTAIN_DURATION +
  SCREENING_DURATION +
  ELEVATOR_DURATION; // 600 = exactly 20s at 30fps

// --- Color system --------------------------------------------------------
// Dark charcoal SaaS film. Red = pressure/workload. Yellow = Recrewt/relief.
export const COLORS = {
  bg: "#141311", // near-black warm charcoal (never pure #000)
  bgVignette: "#0b0a09",
  ink: "#F2EEE4", // warm off-white linework (the recruiter, structure)
  inkDim: "#C9C4B8", // dimmer off-white for recessed linework
  grey: "#6E6A60", // muted grey secondary elements
  greyDim: "#48453D",
  red: "#B8483C", // restrained workload/pressure red (never neon)
  redDim: "#7A362E",
  redShadow: "#5A2620", // deep red-black for the abstract pressure shadow
  yellow: "#F5A520", // Recrewt brand amber — introduced sparingly
  yellowDim: "#8C5F1C",
  gold: "#E8C06B", // small golden summit silhouette, subtle warm highlight
} as const;
