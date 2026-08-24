import React from "react";
import { COLORS } from "../constants";

// A small vocabulary of elegant recruitment artifacts so the world never
// reads as "a pile of identical rectangles" — but also never needs to be
// legible as real documents. Each variant keeps the same restrained
// line-art language: thin stroke, a couple of detail marks, no fill
// except a whisper of card surface. The audience only needs to recognize
// "this represents a candidate / recruiting work".
export type ArtifactVariant = "resume" | "profile" | "folder" | "notes" | "envelope";

export const CandidateArtifact: React.FC<{
  variant: ArtifactVariant;
  size?: number;
  color?: string;
  accent?: string;
  opacity?: number;
  rotation?: number;
}> = ({
  variant,
  size = 64,
  color = COLORS.ink,
  accent = COLORS.grey,
  opacity = 1,
  rotation = 0,
}) => {
  const s = size / 64; // local scale so all variants share one 64-unit box
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      style={{
        overflow: "visible",
        opacity,
        rotate: `${rotation}deg`,
      }}
    >
      <g
        fill="none"
        stroke={color}
        strokeWidth={2.4 / s}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {variant === "resume" && (
          <>
            <rect x={10} y={4} width={44} height={56} rx={3} fill={COLORS.bg} />
            <circle cx={22} cy={16} r={5} stroke={accent} />
            <line x1={31} y1={13} x2={46} y2={13} />
            <line x1={31} y1={19} x2={42} y2={19} stroke={accent} />
            <line x1={16} y1={30} x2={48} y2={30} />
            <line x1={16} y1={37} x2={48} y2={37} />
            <line x1={16} y1={44} x2={38} y2={44} />
          </>
        )}
        {variant === "profile" && (
          <>
            <circle cx={32} cy={32} r={22} fill={COLORS.bg} />
            <circle cx={32} cy={25} r={8} />
            <path d="M16 46 Q32 32 48 46" />
          </>
        )}
        {variant === "folder" && (
          <>
            <path
              d="M6 14 h18 l4 6 h30 v34 a3 3 0 0 1 -3 3 h-46 a3 3 0 0 1 -3 -3 v-37 a3 3 0 0 1 3 -3 z"
              fill={COLORS.bg}
            />
            <line x1={14} y1={34} x2={50} y2={34} stroke={accent} />
            <line x1={14} y1={42} x2={44} y2={42} stroke={accent} />
          </>
        )}
        {variant === "notes" && (
          <>
            <rect x={8} y={8} width={48} height={48} rx={2} fill={COLORS.bg} />
            <line x1={16} y1={20} x2={48} y2={20} />
            <line x1={16} y1={28} x2={48} y2={28} />
            <line x1={16} y1={36} x2={36} y2={36} />
            <path d="M40 40 l6 6 12 -14" stroke={accent} strokeWidth={3 / s} />
          </>
        )}
        {variant === "envelope" && (
          <>
            <rect x={6} y={16} width={52} height={36} rx={3} fill={COLORS.bg} />
            <path d="M8 18 L32 38 L56 18" stroke={accent} />
          </>
        )}
      </g>
    </svg>
  );
};
