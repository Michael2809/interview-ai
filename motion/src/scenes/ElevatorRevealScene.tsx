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
import { RecrewtElevator } from "../components/RecrewtElevator";
import { cameraTransform } from "../utils/camera";
import {
  SCREENING_LOOP_END_X_OFFSET,
  SCREENING_LOOP_END_ZOOM,
  SCREENING_LOOP_END_FOCAL_X,
} from "./ScreeningLoopScene";

// 0:17–0:20 — discovery. The recruiter stops, looks at the mountain one
// more time, then turns away from it entirely — the elevator is off to
// the other side, a completely different direction. Yellow enters here
// for the first time. No ride, no UI, just the possibility of another way.
const MOUNTAIN_OFFSET_X = 560;
const RECRUITER_X = CENTER_X + SCREENING_LOOP_END_X_OFFSET;
const ELEVATOR_X = RECRUITER_X - 420;

export const ElevatorRevealScene: React.FC = () => {
  const frame = useCurrentFrame();

  // headTurn beats: still facing forward -> look at mountain -> turn away
  // toward the elevator -> hold. Negative = turning toward the elevator
  // (which sits to the left of the recruiter).
  const headTurn = interpolate(
    frame,
    [0, 30, 46, 70, 90],
    [0, 0, -1, -1, -1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.ease) },
  );
  const lookUpMountain = interpolate(frame, [0, 14, 30, 40], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const camPan = interpolate(frame, [30, 68], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
  const zoom = interpolate(camPan, [0, 1], [SCREENING_LOOP_END_ZOOM, 0.66]);
  const focalX = interpolate(camPan, [0, 1], [SCREENING_LOOP_END_FOCAL_X, (RECRUITER_X + ELEVATOR_X) / 2]);
  const focalY = interpolate(camPan, [0, 1], [GROUND_Y - MOUNTAIN_HEIGHT * 0.5, GROUND_Y - 260]);

  const elevatorReveal = interpolate(frame, [40, 64], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });
  const glow = interpolate(frame, [50, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const pose: RecruiterPose = {
    spineLean: 4,
    headTilt: 6 - lookUpMountain * 22,
    headTurn,
    leftLeg: { upper: -8, lower: 4 },
    rightLeg: { upper: 8, lower: -4 },
    leftArm: { upper: 14, lower: 10 },
    rightArm: { upper: -14, lower: -10 },
  };

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

          <g
            transform={`translate(${ELEVATOR_X} ${GROUND_Y})`}
            style={{ opacity: elevatorReveal, scale: interpolate(elevatorReveal, [0, 1], [0.96, 1]) }}
          >
            <RecrewtElevator doorOpen={0} glow={glow} />
          </g>

          <g transform={`translate(${RECRUITER_X} ${GROUND_Y - RECRUITER_HIP_HEIGHT})`}>
            <RecruiterCharacter pose={pose} />
          </g>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
