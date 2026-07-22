import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  Briefcase,
  CheckCircle2,
  LayoutDashboard,
  Loader,
  Plus,
  ScanFace,
  Send,
  Settings,
  Star,
  Users,
} from "lucide-react";
import { colors, fonts, radius } from "../tokens";

type Candidate = {
  name: string;
  role: string;
  score: number;
  summary: string;
};

type PipelineColumn = {
  key: string;
  title: string;
  dot: string;
  badgeBg: string;
  badgeText: string;
  candidates: Candidate[];
};

const stats = [
  { icon: Briefcase, label: "Active Roles", value: "3", color: colors.ink },
  { icon: Users, label: "Candidates Invited", value: "24", color: colors.ink },
  { icon: CheckCircle2, label: "Completed", value: "18", color: colors.green600 },
  { icon: Loader, label: "Ongoing", value: "6", color: colors.violet },
  { icon: Star, label: "Avg Score", value: "7.8", color: colors.ink },
];

const columns: PipelineColumn[] = [
  {
    key: "shortlisted",
    title: "Shortlisted",
    dot: colors.green,
    badgeBg: colors.green100,
    badgeText: colors.green700,
    candidates: [
      {
        name: "Priya Sharma",
        role: "Backend Engineer",
        score: 9,
        summary: "Strong communicator, sharp on system design",
      },
      {
        name: "Arjun Mehta",
        role: "Product Designer",
        score: 8,
        summary: "Confident delivery, great portfolio walkthrough",
      },
    ],
  },
  {
    key: "onhold",
    title: "On Hold",
    dot: colors.yellow400,
    badgeBg: colors.yellow100,
    badgeText: colors.yellow700,
    candidates: [
      {
        name: "Wei Chen",
        role: "Backend Engineer",
        score: 6,
        summary: "Solid fundamentals, light on leadership examples",
      },
      {
        name: "Sara Ali",
        role: "Marketing Lead",
        score: 5,
        summary: "Average pace, several filler words throughout",
      },
    ],
  },
  {
    key: "rejected",
    title: "Rejected",
    dot: colors.red400,
    badgeBg: colors.red100,
    badgeText: colors.red700,
    candidates: [
      {
        name: "Tom Becker",
        role: "Product Designer",
        score: 3,
        summary: "Struggled to answer follow-up questions clearly",
      },
    ],
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function scoreBadgeColors(score: number) {
  if (score >= 7) return { bg: colors.green100, text: colors.green700 };
  if (score >= 4) return { bg: colors.yellow100, text: colors.yellow700 };
  return { bg: colors.red100, text: colors.red700 };
}

const NavItem: React.FC<{
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  active?: boolean;
}> = ({ icon: Icon, label, active }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "12px 16px",
      borderRadius: radius.lg,
      marginBottom: 4,
      fontFamily: fonts.body,
      fontSize: 16,
      fontWeight: active ? 500 : 400,
      color: active ? colors.ink : colors.grayMid,
      background: active ? colors.lavender : "transparent",
    }}
  >
    <Icon size={18} color={active ? colors.ink : colors.grayMid} />
    {label}
  </div>
);

const StatCard: React.FC<(typeof stats)[number]> = ({
  icon: Icon,
  label,
  value,
  color,
}) => (
  <div
    style={{
      background: colors.white,
      borderRadius: radius["2xl"],
      border: `1px solid ${colors.graySoft}`,
      padding: 24,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        color: colors.grayMid,
        fontFamily: fonts.body,
        fontSize: 13,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      <Icon size={15} color={colors.grayMid} />
      {label}
    </div>
    <div
      style={{
        marginTop: 14,
        fontFamily: fonts.heading,
        fontWeight: 700,
        fontSize: 38,
        color,
      }}
    >
      {value}
    </div>
  </div>
);

const CandidateCard: React.FC<{ candidate: Candidate }> = ({ candidate }) => {
  const badge = scoreBadgeColors(candidate.score);
  return (
    <div
      style={{
        background: colors.gray50,
        borderRadius: radius.xl,
        padding: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          minWidth: 0,
          flex: 1,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.full,
            background: colors.lavender,
            color: colors.violet,
            fontFamily: fonts.heading,
            fontWeight: 600,
            fontSize: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {initials(candidate.name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: fonts.body,
              fontWeight: 500,
              fontSize: 17,
              color: colors.ink,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {candidate.name}
          </div>
          <div
            style={{
              marginTop: 2,
              fontFamily: fonts.body,
              fontSize: 13,
              color: colors.grayMid,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {candidate.summary}
          </div>
        </div>
      </div>
      <div
        style={{
          flexShrink: 0,
          marginLeft: 12,
          fontFamily: fonts.body,
          fontWeight: 500,
          fontSize: 13,
          padding: "5px 12px",
          borderRadius: radius.full,
          background: badge.bg,
          color: badge.text,
        }}
      >
        {candidate.score}/10
      </div>
    </div>
  );
};

const PipelineColumnCard: React.FC<{
  column: PipelineColumn;
  frame: number;
  fps: number;
  startFrame: number;
}> = ({ column, frame, fps, startFrame }) => {
  const enter = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 14, mass: 0.7 },
  });
  const translateY = interpolate(enter, [0, 1], [60, 0]);
  const opacity = interpolate(frame, [startFrame, startFrame + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        background: colors.white,
        borderRadius: radius["2xl"],
        border: `1px solid ${colors.graySoft}`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          padding: "20px 24px",
          borderBottom: `1px solid ${colors.graySoft}`,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: radius.full,
            background: column.dot,
          }}
        />
        <div
          style={{
            fontFamily: fonts.heading,
            fontWeight: 600,
            fontSize: 20,
            color: colors.ink,
          }}
        >
          {column.title}
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            fontFamily: fonts.body,
            fontWeight: 600,
            fontSize: 13,
            padding: "4px 12px",
            borderRadius: radius.full,
            background: column.badgeBg,
            color: column.badgeText,
          }}
        >
          {column.candidates.length}
        </div>
      </div>
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        {column.candidates.map((c) => (
          <CandidateCard key={c.name} candidate={c} />
        ))}
      </div>
    </div>
  );
};

export const Scene2Dashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const chromeOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const chromeY = interpolate(frame, [0, 12], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.025]);

  return (
    <AbsoluteFill
      style={{
        background: colors.white,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          transform: `scale(${zoom})`,
          transformOrigin: "50% 50%",
        }}
      >
        {/* Sidebar */}
        <div
          style={{
            width: 300,
            flexShrink: 0,
            background: colors.white,
            borderRight: `1px solid ${colors.graySoft}`,
            padding: "40px 24px",
            display: "flex",
            flexDirection: "column",
            opacity: chromeOpacity,
            transform: `translateY(${chromeY}px)`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 48 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.lg,
                background: colors.ink,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ScanFace size={24} color={colors.yellow} />
            </div>
            <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: 22, color: colors.ink }}>
              Recrewt AI
            </div>
          </div>
          <NavItem icon={LayoutDashboard} label="Dashboard" active />
          <NavItem icon={Briefcase} label="Roles" />
          <NavItem icon={Users} label="Candidates" />
          <NavItem icon={Settings} label="Settings" />
        </div>

        {/* Main */}
        <div
          style={{
            flex: 1,
            background: colors.gray50,
            padding: "56px 64px",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              opacity: chromeOpacity,
              transform: `translateY(${chromeY}px)`,
            }}
          >
            <div>
              <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: 38, color: colors.ink }}>
                Dashboard
              </div>
              <div style={{ marginTop: 8, fontFamily: fonts.body, fontSize: 17, color: colors.grayMid }}>
                Welcome back. Here&apos;s your hiring activity at a glance.
              </div>
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: `1px solid ${colors.ink}`,
                  color: colors.ink,
                  background: colors.white,
                  padding: "12px 24px",
                  borderRadius: radius.lg,
                  fontFamily: fonts.heading,
                  fontWeight: 600,
                  fontSize: 16,
                }}
              >
                <Send size={16} color={colors.ink} />
                Invite
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: colors.violet,
                  color: colors.white,
                  padding: "12px 24px",
                  borderRadius: radius.lg,
                  fontFamily: fonts.heading,
                  fontWeight: 600,
                  fontSize: 16,
                }}
              >
                <Plus size={16} color={colors.white} />
                Create Role
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 36,
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 20,
              opacity: chromeOpacity,
              transform: `translateY(${chromeY}px)`,
            }}
          >
            {stats.map((s) => (
              <StatCard key={s.label} {...s} />
            ))}
          </div>

          <div
            style={{
              marginTop: 44,
              marginBottom: 20,
              fontFamily: fonts.heading,
              fontWeight: 600,
              fontSize: 28,
              color: colors.ink,
              opacity: chromeOpacity,
              transform: `translateY(${chromeY}px)`,
            }}
          >
            Candidate Pipeline
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 24,
            }}
          >
            {columns.map((column, i) => (
              <PipelineColumnCard
                key={column.key}
                column={column}
                frame={frame}
                fps={fps}
                startFrame={30 + i * 18}
              />
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
