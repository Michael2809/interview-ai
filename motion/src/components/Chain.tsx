import React from "react";
import { COLORS } from "../constants";

// A premium illustrated chain — alternating interlocked links, not a
// squiggle of ovals. Anchored at (anchorX, anchorY), hanging at
// `swingDeg` from vertical, `length` long. Each link is a rounded stadium
// shape; consecutive links rotate 90° and overlap slightly so they read
// as physically interlinked, with a dark-red inset for a touch of
// dimensionality and a single fine highlight so it doesn't go flat.
const LINK_SHORT = 13; // thickness axis
const LINK_LONG = 24; // length axis
const OVERLAP = 0.62; // fraction of LINK_LONG each link advances by

export const Chain: React.FC<{
  anchorX: number;
  anchorY: number;
  length: number;
  swingDeg: number;
  color?: string;
  darkColor?: string;
  opacity?: number;
}> = ({
  anchorX,
  anchorY,
  length,
  swingDeg,
  color = COLORS.red,
  darkColor = COLORS.redDim,
  opacity = 1,
}) => {
  const step = LINK_LONG * OVERLAP;
  const linkCount = Math.max(2, Math.round(length / step));

  return (
    <g
      transform={`translate(${anchorX} ${anchorY}) rotate(${swingDeg})`}
      style={{ opacity }}
    >
      {Array.from({ length: linkCount }).map((_, i) => {
        const cy = step * i + LINK_LONG / 2;
        const vertical = i % 2 === 0;
        const w = vertical ? LINK_SHORT : LINK_LONG;
        const h = vertical ? LINK_LONG : LINK_SHORT;
        return (
          <g key={i}>
            <rect
              x={-w / 2}
              y={cy - h / 2}
              width={w}
              height={h}
              rx={LINK_SHORT / 2}
              fill={COLORS.bg}
              stroke={color}
              strokeWidth={2.6}
            />
            {/* dark-red inset reads as depth inside the open link */}
            <rect
              x={-w / 2 + 3.4}
              y={cy - h / 2 + 3.4}
              width={Math.max(0, w - 6.8)}
              height={Math.max(0, h - 6.8)}
              rx={Math.max(0, LINK_SHORT / 2 - 3.4)}
              fill="none"
              stroke={darkColor}
              strokeWidth={1.4}
              opacity={0.7}
            />
          </g>
        );
      })}
    </g>
  );
};

export const chainEndPoint = (
  anchorX: number,
  anchorY: number,
  length: number,
  swingDeg: number,
): [number, number] => {
  const rad = (swingDeg * Math.PI) / 180;
  return [anchorX + length * Math.sin(rad), anchorY + length * Math.cos(rad)];
};
