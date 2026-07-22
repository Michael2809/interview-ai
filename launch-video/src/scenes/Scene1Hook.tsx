import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, fonts } from "../tokens";

export const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const line1Opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const line1TranslateY = interpolate(frame, [0, 20], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const line2Spring = spring({
    frame: frame - 55,
    fps,
    config: { damping: 12, mass: 0.5 },
  });
  const line2Opacity = interpolate(frame, [55, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const line2Scale = interpolate(line2Spring, [0, 1], [0.85, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.ink,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ maxWidth: 1400, textAlign: "center", padding: "0 80px" }}>
        <div
          style={{
            fontFamily: fonts.heading,
            fontWeight: 700,
            fontSize: 88,
            lineHeight: 1.25,
            letterSpacing: "-0.02em",
            color: colors.white,
            opacity: line1Opacity,
            transform: `translateY(${line1TranslateY}px)`,
          }}
        >
          Screening candidates takes hours.
        </div>
        <div
          style={{
            fontFamily: fonts.heading,
            fontWeight: 700,
            fontSize: 88,
            lineHeight: 1.25,
            letterSpacing: "-0.02em",
            color: colors.violet,
            marginTop: 16,
            opacity: line2Opacity,
            transform: `scale(${line2Scale})`,
          }}
        >
          It shouldn&apos;t.
        </div>
      </div>
    </AbsoluteFill>
  );
};
