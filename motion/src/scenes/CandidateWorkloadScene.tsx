import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, WIDTH, HEIGHT, CENTER_X, GROUND_Y, RECRUITER_HIP_HEIGHT } from "../constants";
import { RecruiterCharacter, getWristPoint, RecruiterPose } from "../components/RecruiterCharacter";
import { ChainedCandidate } from "../components/ChainedCandidate";
import { ArtifactVariant } from "../components/CandidateArtifact";
import { cameraTransform } from "../utils/camera";

// 0:03–0:07 — candidates start arriving. Each one adds a chain; the
// recruiter's posture reacts to the accumulating weight. Pace accelerates.
// Exported so MountainRevealScene can pick up the exact same five chained
// candidates at its opening hold — the workload doesn't vanish at the cut,
// it's what the camera pulls back from.
export const ARRIVALS: {
  attachFrame: number;
  side: "left" | "right";
  variant: ArtifactVariant;
  length: number;
}[] = [
  { attachFrame: 4, side: "right", variant: "resume", length: 110 },
  { attachFrame: 26, side: "left", variant: "profile", length: 96 },
  { attachFrame: 46, side: "right", variant: "folder", length: 128 },
  { attachFrame: 63, side: "left", variant: "notes", length: 104 },
  { attachFrame: 78, side: "right", variant: "envelope", length: 118 },
];

export const CandidateWorkloadScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const zoom = interpolate(frame, [0, 120], [1.14, 1], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });

  // Cumulative weight: how many chains have attached by now — drives
  // posture (more forward lean, lower stance) without ever exaggerating
  // into comedy.
  const attachedCount = ARRIVALS.filter((a) => frame >= a.attachFrame).length;
  const weight = interpolate(attachedCount, [0, 5], [0, 1], {
    extrapolateRight: "clamp",
  });

  const pose: RecruiterPose = {
    spineLean: 4 + weight * 10,
    headTilt: weight * 6,
    headTurn: 0,
    leftLeg: { upper: -10 - weight * 4, lower: 6 + weight * 4 },
    rightLeg: { upper: 10 + weight * 2, lower: -6 - weight * 2 },
    leftArm: { upper: 18 + weight * 14, lower: 10 },
    rightArm: { upper: -18 - weight * 14, lower: -10 },
  };

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <g transform={cameraTransform(CENTER_X, GROUND_Y - 140, zoom)}>
          <line
            x1={CENTER_X - 700}
            y1={GROUND_Y}
            x2={CENTER_X + 700}
            y2={GROUND_Y}
            stroke={COLORS.greyDim}
            strokeWidth={2}
          />
          <g transform={`translate(${CENTER_X} ${GROUND_Y - RECRUITER_HIP_HEIGHT})`}>
            <RecruiterCharacter pose={pose} />
          </g>

          {ARRIVALS.map((a, i) => {
            const localFrame = frame - a.attachFrame;
            if (localFrame < 0) return null;
            // How many earlier arrivals share this side — later ones fan
            // further out so the chains clear the body instead of all
            // hanging straight down into the same spot.
            const sideOrder = ARRIVALS.slice(0, i).filter((p) => p.side === a.side).length;
            const fanOut = a.side === "left" ? -sideOrder * 22 : sideOrder * 22;
            // Real spring physics: an underdamped spring naturally
            // overshoots and settles, so the chain reads as physically
            // caught rather than teleported into place.
            const swingSpring = spring({
              frame: localFrame,
              fps,
              config: { damping: 9, stiffness: 90, mass: 0.6 },
            });
            const restAngle = (a.side === "left" ? -32 : 32) + fanOut;
            const kick = a.side === "left" ? -46 : 46;
            const swingDeg = restAngle + kick * (1 - swingSpring);
            const drop = interpolate(localFrame, [0, 14], [-40, 0], {
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.back(1.6)),
            });
            const [wristX, wristY] = getWristPoint(pose, a.side);
            const anchorX = CENTER_X + wristX + fanOut * 0.6;
            const anchorY = GROUND_Y - RECRUITER_HIP_HEIGHT + wristY + drop;
            return (
              <ChainedCandidate
                key={i}
                anchorX={anchorX}
                anchorY={anchorY}
                length={a.length}
                swingDeg={swingDeg}
                variant={a.variant}
                cardSize={46}
              />
            );
          })}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
