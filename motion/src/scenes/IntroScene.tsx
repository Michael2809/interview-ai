import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { COLORS, WIDTH, HEIGHT, CENTER_X, GROUND_Y, RECRUITER_HIP_HEIGHT } from "../constants";
import { RecruiterCharacter } from "../components/RecruiterCharacter";
import { cameraTransform } from "../utils/camera";

// 0:00–0:03 — the recruiter, alone, calm. Plenty of negative space.
// No UI, no text, no headline. A slow breath before the workload begins.
export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Barely-there idle sway and a breath-like weight shift, plus a
  // near-imperceptible push-in to keep the calm scene from feeling static.
  const sway = interpolate(frame, [0, 45, 90], [-2, 2, -2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });
  const zoom = interpolate(frame, [0, 90], [1, 1.035], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ opacity: fadeIn }}
      >
        <g transform={cameraTransform(CENTER_X, GROUND_Y - 170, zoom)}>
          <line
            x1={CENTER_X - 700}
            y1={GROUND_Y}
            x2={CENTER_X + 700}
            y2={GROUND_Y}
            stroke={COLORS.greyDim}
            strokeWidth={2}
          />
          <g transform={`translate(${CENTER_X} ${GROUND_Y - RECRUITER_HIP_HEIGHT})`}>
            <RecruiterCharacter
              pose={{
                spineLean: sway * 0.4,
                headTilt: 0,
                headTurn: 0,
                leftLeg: { upper: -8, lower: 4 },
                rightLeg: { upper: 8, lower: -4 },
                leftArm: { upper: 14 + sway, lower: 6 },
                rightArm: { upper: -14 - sway, lower: -6 },
              }}
            />
          </g>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
