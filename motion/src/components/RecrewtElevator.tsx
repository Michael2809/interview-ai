import React from "react";
import { staticFile } from "remotion";
import { COLORS } from "../constants";

// A simple, elegant, slightly industrial elevator — not sci-fi, not
// cartoonish. First real appearance of Recrewt yellow, used sparingly: a
// thin frame accent, a small control panel, and the brand plaque. The
// plaque is a light backing card behind the real logo asset so the logo
// (black wordmark + icon) stays legible on a dark scene without ever
// being redrawn or recolored.
export const RecrewtElevator: React.FC<{
  doorOpen: number; // 0 = closed, 1 = fully open
  glow: number; // 0..1 warmth of the cabin light behind the doors
}> = ({ doorOpen, glow }) => {
  const width = 260;
  const height = 420;
  const doorGap = (width / 2 - 6) * doorOpen;

  return (
    <g>
      {/* outer frame */}
      <rect
        x={-width / 2 - 14}
        y={-height - 14}
        width={width + 28}
        height={height + 28}
        rx={10}
        fill="#1A1815"
        stroke={COLORS.yellowDim}
        strokeWidth={3}
      />
      {/* cabin glow visible in the door gap */}
      <rect
        x={-width / 2 + 6}
        y={-height + 6}
        width={width - 12}
        height={height - 12}
        rx={4}
        fill={COLORS.yellow}
        opacity={0.06 + glow * 0.16}
      />
      {/* doors */}
      <rect
        x={-width / 2 + 6 - doorGap}
        y={-height + 6}
        width={width / 2 - 6}
        height={height - 12}
        fill="#232019"
        stroke={COLORS.greyDim}
        strokeWidth={2}
      />
      <rect
        x={6 + doorGap}
        y={-height + 6}
        width={width / 2 - 6}
        height={height - 12}
        fill="#232019"
        stroke={COLORS.greyDim}
        strokeWidth={2}
      />
      {/* door seam handles */}
      <line
        x1={-doorGap - 4}
        y1={-height / 2 - 6}
        x2={-doorGap - 4}
        y2={-height / 2 + 60}
        stroke={COLORS.grey}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={1 - doorOpen}
      />
      <line
        x1={doorGap + 4}
        y1={-height / 2 - 6}
        x2={doorGap + 4}
        y2={-height / 2 + 60}
        stroke={COLORS.grey}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={1 - doorOpen}
      />

      {/* small call-button panel beside the doors — the detail that keeps
          this an industrial elevator rather than a flat pair of doors */}
      <g transform={`translate(${width / 2 + 24} ${-height / 2})`}>
        <rect x={-13} y={-46} width={26} height={92} rx={5} fill="#201D18" stroke={COLORS.greyDim} strokeWidth={1.6} />
        <circle cx={0} cy={-24} r={6} fill="none" stroke={COLORS.yellow} strokeWidth={1.6} opacity={0.3 + glow * 0.5} />
        <circle cx={0} cy={0} r={6} fill="none" stroke={COLORS.grey} strokeWidth={1.6} />
        <circle cx={0} cy={24} r={6} fill="none" stroke={COLORS.grey} strokeWidth={1.6} />
      </g>

      {/* floor indicator lamp above the doors */}
      <circle
        cx={0}
        cy={-height - 14}
        r={7}
        fill={COLORS.yellow}
        opacity={0.35 + glow * 0.5}
      />

      {/* brand plaque: light backing card + real, undistorted logo asset */}
      <g transform={`translate(0 ${-height - 70})`}>
        <rect
          x={-118}
          y={-34}
          width={236}
          height={68}
          rx={10}
          fill="#F1ECDF"
          stroke={COLORS.yellowDim}
          strokeWidth={2}
        />
        <image
          href={staticFile("recrewt-logo.png")}
          x={-100}
          y={-24.25}
          width={200}
          height={48.5}
          preserveAspectRatio="xMidYMid meet"
        />
      </g>
    </g>
  );
};
