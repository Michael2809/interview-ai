import React from "react";
import { COLORS } from "../constants";

// An abstract, soft-edged dark/red mass that grows behind the recruiter
// before we know what it is. Deliberately not a mountain yet — no ridge
// line, no hard silhouette — just pressure becoming visible. Its rough
// proportions echo the mountain it will resolve into (wide base, tapering
// up) so the later reveal feels like this same mass sharpening into
// focus, not a shape swap.
const BLOB_PATH =
  "M -420,0 " +
  "C -430,-90 -360,-160 -300,-220 " +
  "C -230,-290 -160,-320 -70,-430 " +
  "C -20,-490 30,-520 70,-470 " +
  "C 110,-420 90,-360 160,-320 " +
  "C 260,-260 340,-230 380,-140 " +
  "C 420,-60 430,-10 420,0 " +
  "Z";

export const PressureShadow: React.FC<{
  intensity: number; // 0..1 — how much the pressure has grown
}> = ({ intensity }) => {
  if (intensity <= 0) return null;
  const scale = 0.55 + intensity * 0.85;
  const opacity = Math.min(0.82, intensity * 0.9);

  return (
    <g>
      <defs>
        <radialGradient id="pressure-grad" cx="50%" cy="70%" r="65%">
          <stop offset="0%" stopColor={COLORS.redShadow} stopOpacity={0.95} />
          <stop offset="55%" stopColor={COLORS.redShadow} stopOpacity={0.6} />
          <stop offset="100%" stopColor={COLORS.redShadow} stopOpacity={0} />
        </radialGradient>
        <filter id="pressure-blur" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={34} />
        </filter>
      </defs>
      <g style={{ opacity }} transform={`scale(${scale})`}>
        <path d={BLOB_PATH} fill="url(#pressure-grad)" filter="url(#pressure-blur)" />
      </g>
    </g>
  );
};
