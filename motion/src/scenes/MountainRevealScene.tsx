import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import {
  COLORS,
  WIDTH,
  HEIGHT,
  CENTER_X,
  GROUND_Y,
  RECRUITER_HIP_HEIGHT,
} from "../constants";
import { RecruiterCharacter, RecruiterPose } from "../components/RecruiterCharacter";
import { MountainOutline, MOUNTAIN_HEIGHT, APEX_X, APEX_Y } from "../components/MountainOutline";
import { GoldenFigure } from "../components/GoldenFigure";
import { PressureShadow } from "../components/PressureShadow";
import { cameraTransform } from "../utils/camera";

// 0:10–0:13 — the hero move. Opens on the exact framing PressureShadowScene
// ended on (same zoom, the shadow already at full intensity, recruiter
// mid-look-up) so the cut doesn't pop. A continuous, decelerating
// pull-back resolves the abstract shadow into the outline of a mountain,
// positioned well off-center — the recruiter stays near the left third,
// the mountain fills the right, generous negative space between them.
const PULLBACK_END = 78;
const START_ZOOM = 1.06; // matches PressureShadowScene's resting zoom
const MOUNTAIN_OFFSET_X = 560; // world x offset — asymmetric composition

export const MountainRevealScene: React.FC = () => {
  const frame = useCurrentFrame();

  const pullback = interpolate(frame, [0, PULLBACK_END], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  const zoom = interpolate(pullback, [0, 1], [START_ZOOM, 0.56]);
  const focalX = interpolate(pullback, [0, 1], [CENTER_X, CENTER_X + 260]);
  const focalY = interpolate(
    pullback,
    [0, 1],
    [GROUND_Y - 190, GROUND_Y - MOUNTAIN_HEIGHT * 0.5],
  );

  // The abstract shadow sharpens into the mountain outline — a crossfade,
  // not a shape swap, so it reads as the same mass coming into focus.
  const shadowOpacity = interpolate(pullback, [0, 0.35], [1, 0], { extrapolateRight: "clamp" });
  const mountainOpacity = interpolate(pullback, [0.12, 0.5], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const goldOpacity = interpolate(pullback, [0.55, 0.85], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const pose: RecruiterPose = {
    spineLean: -4,
    headTilt: -28 + pullback * 18, // eases back toward level as the reveal settles
    headTurn: 0,
    leftLeg: { upper: -6, lower: 3 },
    rightLeg: { upper: 6, lower: -3 },
    leftArm: { upper: 12, lower: 10 },
    rightArm: { upper: -12, lower: -10 },
  };

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <g transform={cameraTransform(focalX, focalY, zoom)}>
          <line
            x1={CENTER_X - 2000}
            y1={GROUND_Y}
            x2={CENTER_X + 2000}
            y2={GROUND_Y}
            stroke={COLORS.greyDim}
            strokeWidth={2}
          />

          {shadowOpacity > 0.01 && (
            <g transform={`translate(${CENTER_X + MOUNTAIN_OFFSET_X * pullback} ${GROUND_Y - 40})`} style={{ opacity: shadowOpacity }}>
              <PressureShadow intensity={1} />
            </g>
          )}

          <g
            transform={`translate(${CENTER_X + MOUNTAIN_OFFSET_X} ${GROUND_Y - MOUNTAIN_HEIGHT})`}
            style={{ opacity: mountainOpacity }}
          >
            <MountainOutline />
            <g transform={`translate(${APEX_X} ${APEX_Y})`} style={{ opacity: goldOpacity }}>
              <GoldenFigure />
            </g>
          </g>

          <g transform={`translate(${CENTER_X} ${GROUND_Y - RECRUITER_HIP_HEIGHT})`}>
            <RecruiterCharacter pose={pose} />
          </g>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
