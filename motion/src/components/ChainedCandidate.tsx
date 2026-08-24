import React from "react";
import { COLORS } from "../constants";
import { ArtifactVariant, CandidateArtifact } from "./CandidateArtifact";
import { Chain, chainEndPoint } from "./Chain";

// A candidate artifact hanging from a proper illustrated chain attached
// to the recruiter's wrist. The chain is a simple pendulum: anchored at
// (anchorX, anchorY), hanging at `swingDeg` from vertical, `length` long.
export const ChainedCandidate: React.FC<{
  anchorX: number;
  anchorY: number;
  length: number;
  swingDeg: number;
  variant: ArtifactVariant;
  cardSize?: number;
  opacity?: number;
  color?: string;
}> = ({
  anchorX,
  anchorY,
  length,
  swingDeg,
  variant,
  cardSize = 40,
  opacity = 1,
  color = COLORS.red,
}) => {
  const [endX, endY] = chainEndPoint(anchorX, anchorY, length, swingDeg);

  return (
    <g style={{ opacity }}>
      <Chain anchorX={anchorX} anchorY={anchorY} length={length} swingDeg={swingDeg} color={color} />
      <g transform={`translate(${endX - cardSize / 2} ${endY - cardSize / 2})`}>
        <CandidateArtifact variant={variant} size={cardSize} />
      </g>
    </g>
  );
};

export { chainEndPoint };
