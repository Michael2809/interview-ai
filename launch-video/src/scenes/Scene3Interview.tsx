import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Mic, Video } from "lucide-react";

const QUESTION =
  "Tell me about a time you solved a difficult bug under pressure.";

const TYPING_START = 20;
const TYPING_END = 120;

export const Scene3Interview: React.FC = () => {
  const frame = useCurrentFrame();

  const labelOpacity = interpolate(frame, [10, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const visibleChars = Math.floor(
    interpolate(frame, [TYPING_START, TYPING_END], [0, QUESTION.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const isTyping = frame < TYPING_END;
  const showCursor = frame < TYPING_END + 10 && Math.floor(frame / 10) % 2 === 0;

  const cameraScale = 1 + Math.sin(frame / 20) * 0.01;

  const answerOpacity = interpolate(frame, [TYPING_END + 10, TYPING_END + 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const placeholderOpacity = interpolate(frame, [TYPING_END + 10, TYPING_END + 25], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const micPulse = 1 + Math.sin(frame / 5) * 0.15;

  return (
    <AbsoluteFill
      style={{
        background: "#000",
        color: "#fff",
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "row",
      }}
    >
      {/* Left: camera panel */}
      <div
        style={{
          width: "40%",
          flexShrink: 0,
          background: "#111",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 56,
        }}
      >
        <div
          style={{
            width: "100%",
            aspectRatio: "4 / 3",
            background: "#0a0a0a",
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${cameraScale})`,
          }}
        >
          <Video size={72} color="#3a3a3a" />
        </div>
        <div style={{ marginTop: 28, fontSize: 18, color: "#666" }}>
          Question 1 of 5
        </div>
      </div>

      {/* Right: question + answer */}
      <div
        style={{
          flex: 1,
          padding: 80,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: 20,
            color: "#666",
            textTransform: "uppercase",
            letterSpacing: "2px",
            marginBottom: 28,
            opacity: labelOpacity,
          }}
        >
          {isTyping ? "Interviewer is speaking..." : "Interviewer"}
        </div>

        <div
          style={{
            fontSize: 44,
            lineHeight: 1.5,
            color: isTyping ? "#fff" : "#ccc",
          }}
        >
          {QUESTION.slice(0, visibleChars)}
          <span
            style={{
              display: "inline-block",
              width: 4,
              height: 40,
              marginLeft: 6,
              background: "#fff",
              opacity: showCursor ? 1 : 0,
              verticalAlign: "text-bottom",
            }}
          />
        </div>

        <div style={{ flex: 1, marginTop: 48, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#111",
              borderRadius: 12,
              padding: 32,
              display: "flex",
              alignItems: "center",
              fontSize: 28,
              color: "#444",
              opacity: placeholderOpacity,
            }}
          >
            Your answer will appear here as you speak...
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#111",
              borderRadius: 12,
              padding: 32,
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 28,
              color: "#888",
              opacity: answerOpacity,
            }}
          >
            <Mic
              size={28}
              color="#e74c3c"
              style={{ transform: `scale(${micPulse})` }}
            />
            Listening...
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
