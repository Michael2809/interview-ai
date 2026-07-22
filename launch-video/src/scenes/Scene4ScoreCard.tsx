import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CheckCircle2 } from "lucide-react";
import { colors, fonts, radius } from "../tokens";

const CANDIDATE = {
  name: "Priya Sharma",
  initials: "PS",
  role: "Backend Engineer",
  score: 9,
  summary:
    "Strong communicator with sharp system-design instincts. Walked through trade-offs clearly, even under tough follow-up questions.",
};

export const Scene4ScoreCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardSpring = spring({ frame, fps, config: { damping: 14, mass: 0.9 } });
  const cardTranslateX = interpolate(cardSpring, [0, 1], [520, 0]);
  const cardOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const badgeSpring = spring({
    frame: frame - 35,
    fps,
    config: { damping: 9, mass: 0.6 },
  });
  const badgeScale = interpolate(badgeSpring, [0, 1], [0, 1]);
  const badgeRotate = interpolate(badgeSpring, [0, 1], [-25, -8]);
  const badgeOpacity = interpolate(frame, [35, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glowScale = 1 + Math.sin(frame / 25) * 0.05;

  return (
    <AbsoluteFill
      style={{
        background: colors.ink,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 1400,
          height: 1400,
          borderRadius: radius.full,
          background: `radial-gradient(circle, ${colors.violet}33 0%, transparent 70%)`,
          transform: `scale(${glowScale})`,
        }}
      />

      <div
        style={{
          position: "relative",
          width: 1080,
          background: colors.white,
          borderRadius: radius["2xl"],
          padding: 56,
          opacity: cardOpacity,
          transform: `translateX(${cardTranslateX}px)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -34,
            right: 56,
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: colors.green,
            color: colors.white,
            fontFamily: fonts.heading,
            fontWeight: 700,
            fontSize: 28,
            padding: "16px 36px",
            borderRadius: radius.full,
            boxShadow: "0 16px 40px rgba(34, 197, 94, 0.35)",
            opacity: badgeOpacity,
            transform: `rotate(${badgeRotate}deg) scale(${badgeScale})`,
            transformOrigin: "center",
          }}
        >
          <CheckCircle2 size={28} color={colors.white} />
          Shortlisted
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: radius.full,
                background: colors.lavender,
                color: colors.violet,
                fontFamily: fonts.heading,
                fontWeight: 700,
                fontSize: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {CANDIDATE.initials}
            </div>
            <div>
              <div
                style={{
                  fontFamily: fonts.heading,
                  fontWeight: 700,
                  fontSize: 44,
                  color: colors.ink,
                }}
              >
                {CANDIDATE.name}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontFamily: fonts.body,
                  fontSize: 22,
                  color: colors.grayMid,
                }}
              >
                {CANDIDATE.role}
              </div>
            </div>
          </div>

          <div
            style={{
              fontFamily: fonts.heading,
              fontWeight: 700,
              fontSize: 32,
              color: colors.green700,
              background: colors.green100,
              padding: "14px 32px",
              borderRadius: radius.full,
              flexShrink: 0,
            }}
          >
            {CANDIDATE.score}/10
          </div>
        </div>

        <div
          style={{
            marginTop: 40,
            fontFamily: fonts.body,
            fontSize: 24,
            lineHeight: 1.7,
            color: colors.grayMid,
          }}
        >
          {CANDIDATE.summary}
        </div>
      </div>
    </AbsoluteFill>
  );
};
