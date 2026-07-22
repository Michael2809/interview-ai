import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ScanFace } from "lucide-react";
import { colors, fonts } from "../tokens";

export const Scene5EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({ frame, fps, config: { damping: 12, mass: 0.8 } });
  const logoScale = interpolate(logoSpring, [0, 1], [0.5, 1]);
  const logoOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const wordmarkOpacity = interpolate(frame, [15, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wordmarkY = interpolate(frame, [15, 28], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const urlOpacity = interpolate(frame, [40, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const urlY = interpolate(frame, [40, 55], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: colors.ink,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 160,
          height: 160,
          borderRadius: 36,
          background: colors.violet,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
        }}
      >
        <ScanFace size={84} color={colors.yellow} />
      </div>

      <div
        style={{
          marginTop: 40,
          fontFamily: fonts.heading,
          fontWeight: 700,
          fontSize: 88,
          letterSpacing: "-0.02em",
          color: colors.white,
          opacity: wordmarkOpacity,
          transform: `translateY(${wordmarkY}px)`,
        }}
      >
        Recrewt AI
      </div>

      <div
        style={{
          marginTop: 24,
          fontFamily: fonts.heading,
          fontWeight: 600,
          fontSize: 36,
          letterSpacing: "0.05em",
          color: colors.violet,
          opacity: urlOpacity,
          transform: `translateY(${urlY}px)`,
        }}
      >
        recrewtai.com
      </div>
    </AbsoluteFill>
  );
};
