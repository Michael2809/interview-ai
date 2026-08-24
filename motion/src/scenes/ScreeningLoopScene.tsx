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
import { MountainOutline, MOUNTAIN_HEIGHT, APEX_X, APEX_Y } from "../components/MountainOutline";
import { GoldenFigure } from "../components/GoldenFigure";
import { ChainedCandidate } from "../components/ChainedCandidate";
import { ArtifactVariant } from "../components/CandidateArtifact";
import { cameraTransform } from "../utils/camera";

// 0:13–0:17 — the screening cycle. The recruiter tries to close the
// distance to the mountain; the workload keeps pulling them back. Not
// because they're bad at this — anyone would be overwhelmed by the
// volume. Body language stays determined-but-tired, never comedic.
const CYCLE_LEN = 40;
const CYCLE_COUNT = 3;
const NET_GAIN_PER_CYCLE = 10; // small creep forward — the cycle is not truly hopeless, just exhausting
const PULL_BACK_DISTANCE = 60; // how far each rejection yanks the recruiter back
const MOUNTAIN_OFFSET_X = 560;
const VARIANTS: ArtifactVariant[] = ["resume", "folder", "notes", "envelope"];

// Where this scene leaves the recruiter (world x offset from CENTER_X, at
// ground level — no more vertical climb) so ElevatorRevealScene can pick
// up the camera and figure in the same spot instead of jump-cutting.
export const SCREENING_LOOP_END_X_OFFSET =
  (CYCLE_COUNT - 1) * NET_GAIN_PER_CYCLE + (NET_GAIN_PER_CYCLE + PULL_BACK_DISTANCE) - PULL_BACK_DISTANCE;
export const SCREENING_LOOP_END_ZOOM = 0.62;
export const SCREENING_LOOP_END_FOCAL_X = CENTER_X + 260;

const RejectMark: React.FC<{ x: number; y: number; opacity: number }> = ({ x, y, opacity }) =>
  opacity <= 0.01 ? null : (
    <g transform={`translate(${x} ${y})`} style={{ opacity }} stroke={COLORS.red} strokeWidth={3.4} strokeLinecap="round">
      <line x1={-9} y1={-9} x2={9} y2={9} />
      <line x1={9} y1={-9} x2={-9} y2={9} />
    </g>
  );

export const ScreeningLoopScene: React.FC = () => {
  const frame = useCurrentFrame();

  const cycleIndex = Math.min(Math.floor(frame / CYCLE_LEN), CYCLE_COUNT - 1);
  const cycleLocal = frame - cycleIndex * CYCLE_LEN;
  const t = cycleLocal / CYCLE_LEN;

  // Sub-phases inside one cycle: approach -> evaluate/reject -> pulled back -> settle.
  const approach = interpolate(t, [0, 0.28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const evaluate = interpolate(t, [0.28, 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rejectMark = interpolate(t, [0.42, 0.5, 0.66], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pulledBack = interpolate(t, [0.5, 0.82], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  const completedCycles = cycleIndex;
  const netBase = completedCycles * NET_GAIN_PER_CYCLE;
  const approachGain = approach * (NET_GAIN_PER_CYCLE + PULL_BACK_DISTANCE);
  const pullbackLoss = pulledBack * PULL_BACK_DISTANCE;
  const worldX = CENTER_X + netBase + approachGain - pullbackLoss;
  const walkSwing = Math.sin(t * Math.PI * 2) * (1 - pulledBack) * 14;

  const fatigue = interpolate(cycleIndex, [0, CYCLE_COUNT - 1], [0, 1]);

  const pose: RecruiterPose = {
    spineLean: 10 + fatigue * 8 - pulledBack * 12,
    headTilt: 4 + fatigue * 8,
    headTurn: 0,
    leftLeg: { upper: -walkSwing, lower: Math.max(0, walkSwing) * 0.6 },
    rightLeg: { upper: walkSwing, lower: Math.max(0, -walkSwing) * 0.6 },
    leftArm: { upper: 16 + fatigue * 10, lower: 10 },
    rightArm: { upper: -16 - fatigue * 10, lower: -10 },
  };

  const zoom = interpolate(frame, [0, 120], [0.56, 0.62], { easing: Easing.inOut(Easing.ease) });
  const focalX = CENTER_X + 260;
  const focalY = GROUND_Y - MOUNTAIN_HEIGHT * 0.5;

  const chainSide: "left" | "right" = "right"; // reaching toward the mountain
  const [wristX, wristY] = getWristPoint(pose, chainSide);
  const anchorX = worldX + wristX;
  const anchorY = GROUND_Y - RECRUITER_HIP_HEIGHT + wristY;
  const showCandidate = evaluate > 0 || pulledBack > 0;
  const candidateOpacity = pulledBack > 0.01
    ? interpolate(pulledBack, [0, 1], [1, 0])
    : interpolate(evaluate, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
  const dropFall = interpolate(pulledBack, [0, 1], [0, 90], { easing: Easing.in(Easing.ease) });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <g transform={cameraTransform(focalX, focalY, zoom)}>
          <line x1={CENTER_X - 2000} y1={GROUND_Y} x2={CENTER_X + 2000} y2={GROUND_Y} stroke={COLORS.greyDim} strokeWidth={2} />

          <g transform={`translate(${CENTER_X + MOUNTAIN_OFFSET_X} ${GROUND_Y - MOUNTAIN_HEIGHT})`}>
            <MountainOutline />
            <g transform={`translate(${APEX_X} ${APEX_Y})`}>
              <GoldenFigure />
            </g>
          </g>

          <g transform={`translate(${worldX} ${GROUND_Y - RECRUITER_HIP_HEIGHT})`}>
            <RecruiterCharacter pose={pose} />
          </g>

          {showCandidate && (
            <>
              <ChainedCandidate
                anchorX={anchorX}
                anchorY={anchorY + dropFall}
                length={64}
                swingDeg={12 + dropFall * 0.3}
                variant={VARIANTS[cycleIndex % VARIANTS.length]}
                cardSize={40}
                opacity={candidateOpacity}
              />
              <RejectMark x={anchorX + 34} y={anchorY - 10} opacity={rejectMark} />
            </>
          )}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
