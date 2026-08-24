import React from "react";
import { COLORS } from "../constants";

// The destination: a tiny golden human silhouette at the summit. Must
// read clearly as a person — head, shoulders, tapered body, a hint of
// legs — never a trophy, a capsule, or a glowing letter. The highlight
// behind it is small and warm, not a dramatic god-ray.
export const GoldenFigure: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => {
  return (
    <g style={{ opacity }}>
      <defs>
        <radialGradient id="golden-figure-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={COLORS.gold} stopOpacity={0.45} />
          <stop offset="100%" stopColor={COLORS.gold} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={0} cy={-20} r={30} fill="url(#golden-figure-glow)" />
      <g fill={COLORS.gold}>
        <circle cx={0} cy={-34} r={6} />
        <path d="M -7,-26 C -7,-30 -3,-32 0,-32 C 3,-32 7,-30 7,-26 L 6,-10 C 6,-7 3,-5 0,-5 C -3,-5 -6,-7 -6,-10 Z" />
        <path d="M -6,-6 L -9,10 L -4,10 L 0,-3 L 4,10 L 9,10 L 6,-6 Z" />
      </g>
    </g>
  );
};
