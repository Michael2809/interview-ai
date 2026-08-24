import React from "react";
import { COLORS } from "../constants";

// The recruiter — a deliberately designed minimalist brand character, not
// a classroom stickman. Pure forward-kinematics rig, all in local space
// with the HIP at the local origin (0, 0). Renders a bare <g> so it can be
// dropped straight into the shared world <svg> that every scene shares.
//
// Design decisions that separate this from a generic wireframe figure:
//  - a small head relative to the body (proportion, not childlike)
//  - a defined shoulder line (arms hang from two points, not one)
//  - simplified rounded hands and small grounded feet
//  - one consistent, slightly heavier stroke weight throughout
//
// Angle convention: every joint angle is measured clockwise from a
// natural "at rest" direction — DOWN (0deg) for legs and arms, UP
// (180deg) for the spine and head.
export type LimbAngles = {
  upper: number;
  lower: number;
};

export type RecruiterPose = {
  spineLean: number; // degrees, offset from straight-up. + = leaning forward
  headTilt: number; // degrees, additional to spine. + = looking down, - = looking up
  headTurn: number; // -1..1, chin turning left/right (foreshortens head)
  leftLeg: LimbAngles; // offset from straight-down
  rightLeg: LimbAngles;
  leftArm: LimbAngles; // offset from straight-down (180 = raised overhead)
  rightArm: LimbAngles;
};

const project = (
  originX: number,
  originY: number,
  length: number,
  angleDeg: number,
): [number, number] => {
  const rad = (angleDeg * Math.PI) / 180;
  return [originX + length * Math.sin(rad), originY + length * Math.cos(rad)];
};

const SPINE_LEN = 82;
const HEAD_GAP = 26; // head center distance from shoulder line
const HEAD_R = 15; // deliberately small relative to the body
const SHOULDER_WIDTH = 15; // half-width — subtle, not blocky
const THIGH = 47;
const SHIN = 45;
const UPPER_ARM = 35;
const LOWER_ARM = 31;
const FOOT_LEN = 15;

const rig = (pose: RecruiterPose) => {
  const spine = project(0, 0, SPINE_LEN, 180 + pose.spineLean);
  const head = project(
    spine[0],
    spine[1],
    HEAD_GAP,
    180 + pose.spineLean + pose.headTilt,
  );
  // Two shoulder points, offset perpendicular to the spine, so arms read
  // as attached to a shoulder line rather than a single hinge.
  const spineAngle = ((180 + pose.spineLean) * Math.PI) / 180;
  const perpX = Math.cos(spineAngle);
  const perpY = -Math.sin(spineAngle);
  const shoulderL: [number, number] = [spine[0] - perpX * SHOULDER_WIDTH, spine[1] - perpY * SHOULDER_WIDTH];
  const shoulderR: [number, number] = [spine[0] + perpX * SHOULDER_WIDTH, spine[1] + perpY * SHOULDER_WIDTH];

  const knee = (side: "left" | "right") => {
    const a = side === "left" ? pose.leftLeg : pose.rightLeg;
    return project(0, 0, THIGH, a.upper);
  };
  const foot = (side: "left" | "right") => {
    const a = side === "left" ? pose.leftLeg : pose.rightLeg;
    const [kx, ky] = knee(side);
    return project(kx, ky, SHIN, a.upper + a.lower);
  };
  const elbow = (side: "left" | "right") => {
    const a = side === "left" ? pose.leftArm : pose.rightArm;
    const shoulder = side === "left" ? shoulderL : shoulderR;
    return project(shoulder[0], shoulder[1], UPPER_ARM, a.upper);
  };
  const hand = (side: "left" | "right") => {
    const a = side === "left" ? pose.leftArm : pose.rightArm;
    const [ex, ey] = elbow(side);
    return project(ex, ey, LOWER_ARM, a.upper + a.lower);
  };
  return { spine, head, shoulderL, shoulderR, knee, foot, elbow, hand };
};

export const RecruiterCharacter: React.FC<{
  pose: RecruiterPose;
  color?: string;
  strokeWidth?: number;
  opacity?: number;
}> = ({ pose, color = COLORS.ink, strokeWidth = 9, opacity = 1 }) => {
  const { spine, head, shoulderL, shoulderR } = rig(pose);
  const [headCx, headCy] = head;
  const [lKneeX, lKneeY] = rig(pose).knee("left");
  const [lFootX, lFootY] = rig(pose).foot("left");
  const [rKneeX, rKneeY] = rig(pose).knee("right");
  const [rFootX, rFootY] = rig(pose).foot("right");
  const [lElbowX, lElbowY] = rig(pose).elbow("left");
  const [lHandX, lHandY] = rig(pose).hand("left");
  const [rElbowX, rElbowY] = rig(pose).elbow("right");
  const [rHandX, rHandY] = rig(pose).hand("right");

  // Small foot ticks, perpendicular to each shin, so the figure reads as
  // grounded rather than trailing off into a bare line.
  const footTick = (footX: number, footY: number, kneeX: number, kneeY: number) => {
    const shinAngle = Math.atan2(footX - kneeX, footY - kneeY);
    const px = Math.cos(shinAngle) * FOOT_LEN;
    const py = -Math.sin(shinAngle) * FOOT_LEN;
    return `${footX - px * 0.3},${footY - py * 0.3} ${footX + px * 0.7},${footY + py * 0.7}`;
  };

  return (
    <g style={{ opacity }} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {/* back leg drawn first so the front leg overlaps it */}
      <polyline points={`0,0 ${rKneeX},${rKneeY} ${rFootX},${rFootY}`} />
      <polyline points={footTick(rFootX, rFootY, rKneeX, rKneeY)} strokeWidth={strokeWidth * 0.8} />
      <polyline points={`0,0 ${lKneeX},${lKneeY} ${lFootX},${lFootY}`} />
      <polyline points={footTick(lFootX, lFootY, lKneeX, lKneeY)} strokeWidth={strokeWidth * 0.8} />

      {/* hip + shoulder line give the torso a defined, non-wireframe shape */}
      <line x1={-13} y1={0} x2={13} y2={0} strokeWidth={strokeWidth * 0.85} />
      <line x1={0} y1={0} x2={spine[0]} y2={spine[1]} />
      <line x1={shoulderL[0]} y1={shoulderL[1]} x2={shoulderR[0]} y2={shoulderR[1]} strokeWidth={strokeWidth * 0.85} />

      <polyline points={`${shoulderR[0]},${shoulderR[1]} ${rElbowX},${rElbowY} ${rHandX},${rHandY}`} />
      <circle cx={rHandX} cy={rHandY} r={strokeWidth * 0.62} fill={color} stroke="none" />
      <polyline points={`${shoulderL[0]},${shoulderL[1]} ${lElbowX},${lElbowY} ${lHandX},${lHandY}`} />
      <circle cx={lHandX} cy={lHandY} r={strokeWidth * 0.62} fill={color} stroke="none" />

      {/* small head, deliberately understated — no face, posture carries emotion */}
      <circle
        cx={headCx + pose.headTurn * 8}
        cy={headCy}
        r={HEAD_R}
        transform={`scale(${1 - Math.abs(pose.headTurn) * 0.35}, 1)`}
        style={{ transformOrigin: `${headCx}px ${headCy}px` }}
      />
    </g>
  );
};

// World-space wrist position, for attaching a chain or reading a hand-hold
// during the climb. Matches the rig math above exactly.
export const getWristPoint = (
  pose: RecruiterPose,
  side: "left" | "right",
): [number, number] => rig(pose).hand(side);
