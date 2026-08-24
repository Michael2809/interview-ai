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
import { RecruiterCharacter, RecruiterPose, getWristPoint } from "../components/RecruiterCharacter";
import { ChainedCandidate } from "../components/ChainedCandidate";
import { PressureShadow } from "../components/PressureShadow";
import { ARRIVALS } from "./CandidateWorkloadScene";
import { cameraTransform } from "../utils/camera";

// 0:07–0:10 — a dark/red pressure shadow grows behind the recruiter. We
// deliberately do not reveal what it is yet. Opens on the exact framing
// CandidateWorkloadScene ended on (same zoom, same chained candidates
// still hanging) so the cut doesn't pop; the chains dissolve as the
// shadow takes over — the workload IS becoming this pressure.
const CHAIN_FADE_START = 45;
const CHAIN_FADE_END = 78;
const LOOK_UP_START = 60;

export const PressureShadowScene: React.FC = () => {
  const frame = useCurrentFrame();

  const shadowIntensity = interpolate(frame, [0, 85], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  const chainsOpacity = interpolate(frame, [CHAIN_FADE_START, CHAIN_FADE_END], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const lookUp = interpolate(frame, [LOOK_UP_START, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  const zoom = interpolate(frame, [0, 90], [1, 1.06], {
    easing: Easing.inOut(Easing.ease),
  });

  const pose: RecruiterPose = {
    spineLean: interpolate(lookUp, [0, 1], [14, -4]),
    headTilt: interpolate(lookUp, [0, 1], [6, -28]),
    headTurn: 0,
    leftLeg: { upper: interpolate(lookUp, [0, 1], [-14, -6]), lower: interpolate(lookUp, [0, 1], [10, 3]) },
    rightLeg: { upper: interpolate(lookUp, [0, 1], [12, 6]), lower: interpolate(lookUp, [0, 1], [-8, -3]) },
    leftArm: { upper: interpolate(lookUp, [0, 1], [32, 12]), lower: 10 },
    rightArm: { upper: interpolate(lookUp, [0, 1], [-32, -12]), lower: -10 },
  };

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <g transform={cameraTransform(CENTER_X, GROUND_Y - 150, zoom)}>
          <line
            x1={CENTER_X - 700}
            y1={GROUND_Y}
            x2={CENTER_X + 700}
            y2={GROUND_Y}
            stroke={COLORS.greyDim}
            strokeWidth={2}
          />

          <g transform={`translate(${CENTER_X} ${GROUND_Y - 40})`}>
            <PressureShadow intensity={shadowIntensity} />
          </g>

          <g transform={`translate(${CENTER_X} ${GROUND_Y - RECRUITER_HIP_HEIGHT})`}>
            <RecruiterCharacter pose={pose} />
          </g>

          {chainsOpacity > 0 &&
            ARRIVALS.map((a, i) => {
              const sideOrder = ARRIVALS.slice(0, i).filter((p) => p.side === a.side).length;
              const fanOut = a.side === "left" ? -sideOrder * 22 : sideOrder * 22;
              const restAngle = (a.side === "left" ? -32 : 32) + fanOut;
              const [wristX, wristY] = getWristPoint(pose, a.side);
              const anchorX = CENTER_X + wristX + fanOut * 0.6;
              const anchorY = GROUND_Y - RECRUITER_HIP_HEIGHT + wristY;
              return (
                <ChainedCandidate
                  key={i}
                  anchorX={anchorX}
                  anchorY={anchorY}
                  length={a.length}
                  swingDeg={restAngle}
                  variant={a.variant}
                  cardSize={46}
                  opacity={chainsOpacity}
                />
              );
            })}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
