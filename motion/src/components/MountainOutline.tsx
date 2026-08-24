import React from "react";
import { COLORS } from "../constants";
import { ArtifactVariant, CandidateArtifact } from "./CandidateArtifact";

// The workload mountain — Revision 2: primarily a clean dark silhouette
// with a restrained red rim-glow, NOT a pile of visible documents. A
// handful of extremely subtle artifact hints remain near the base, low
// enough opacity that the audience reads "mountain" first and only
// notices what it's made of on a second look.
//
// Built from a deterministic seeded generator so every render (and every
// frame) produces the exact same silhouette — no Math.random() in render.

export const MOUNTAIN_WIDTH = 1000;
export const MOUNTAIN_HEIGHT = 760;
const HALF_WIDTH = MOUNTAIN_WIDTH / 2;

// [xFraction -1(left edge)..1(right edge), heightFraction 0(base)..1(apex)]
// The dominant summit sits right of center; a lower shoulder breaks up
// the left flank so the silhouette reads as a real ridge, not a triangle.
const SKYLINE: [number, number][] = [
  [-1, 0.02],
  [-0.86, 0.22],
  [-0.72, 0.16],
  [-0.58, 0.46],
  [-0.44, 0.34],
  [-0.3, 0.62],
  [-0.16, 0.52],
  [-0.04, 0.86],
  [0.08, 1],
  [0.2, 0.7],
  [0.32, 0.8],
  [0.46, 0.5],
  [0.6, 0.58],
  [0.74, 0.32],
  [0.88, 0.4],
  [1, 0.02],
];

const heightAt = (xFrac: number): number => {
  const clamped = Math.max(-1, Math.min(1, xFrac));
  for (let i = 0; i < SKYLINE.length - 1; i++) {
    const [x0, h0] = SKYLINE[i];
    const [x1, h1] = SKYLINE[i + 1];
    if (clamped >= x0 && clamped <= x1) {
      const local = (clamped - x0) / (x1 - x0);
      return h0 + (h1 - h0) * local;
    }
  }
  return 0;
};

const topYAt = (x: number): number => MOUNTAIN_HEIGHT * (1 - heightAt(x / HALF_WIDTH));

const mulberry32 = (seed: number) => {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const rand = mulberry32(88);

const STEPS = 64;
const MICRO_JITTER = 9;

const buildSilhouettePath = (): string => {
  const points: [number, number][] = [];
  for (let i = 0; i <= STEPS; i++) {
    const x = -HALF_WIDTH + (i / STEPS) * MOUNTAIN_WIDTH;
    const jitter = (rand() - 0.5) * 2 * MICRO_JITTER;
    points.push([x, Math.max(0, topYAt(x) + jitter)]);
  }
  const top = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L ");
  return `M ${-HALF_WIDTH},${MOUNTAIN_HEIGHT} L ${top} L ${HALF_WIDTH},${MOUNTAIN_HEIGHT} Z`;
};

const SILHOUETTE_PATH = buildSilhouettePath();

const APEX = SKYLINE.reduce((best, [xFrac, h]) => (h > best[1] ? [xFrac, h] : best), [0, 0] as [number, number]);
export const APEX_X = APEX[0] * HALF_WIDTH;
export const APEX_Y = MOUNTAIN_HEIGHT * (1 - APEX[1]);

// Only a sparse handful of hints, well below the base, at low opacity —
// enough that a close look reveals what the mountain is made of without
// ever dominating the silhouette read.
type Hint = { x: number; y: number; size: number; variant: ArtifactVariant; rotation: number };
const VARIANTS: ArtifactVariant[] = ["resume", "profile", "folder", "notes", "envelope"];

const buildHints = (): Hint[] => {
  const items: Hint[] = [];
  const count = 14;
  for (let i = 0; i < count; i++) {
    const x = (rand() * 2 - 1) * HALF_WIDTH * 0.85;
    const top = topYAt(x);
    const bandTop = top + (MOUNTAIN_HEIGHT - top) * 0.55; // lower half only
    if (MOUNTAIN_HEIGHT - bandTop < 8) continue;
    const y = bandTop + rand() * (MOUNTAIN_HEIGHT - bandTop);
    items.push({
      x,
      y,
      size: 30 + rand() * 20,
      variant: VARIANTS[Math.floor(rand() * VARIANTS.length)],
      rotation: (rand() - 0.5) * 20,
    });
  }
  return items;
};

const HINTS = buildHints();

export const MountainOutline: React.FC = () => {
  return (
    <g>
      <defs>
        <clipPath id="mountain-clip">
          <path d={SILHOUETTE_PATH} />
        </clipPath>
        <filter id="mountain-rim-blur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={10} />
        </filter>
      </defs>

      {/* restrained red rim-glow, offset slightly outward from the true
          edge so it reads as atmosphere, not a neon outline */}
      <path
        d={SILHOUETTE_PATH}
        fill="none"
        stroke={COLORS.red}
        strokeWidth={14}
        opacity={0.22}
        filter="url(#mountain-rim-blur)"
      />

      {/* the silhouette itself — the mountain is primarily this shape */}
      <path d={SILHOUETTE_PATH} fill="#1B1815" stroke={COLORS.greyDim} strokeWidth={2} />

      {/* sparse, low-opacity hints of what the mountain is made of */}
      <g clipPath="url(#mountain-clip)">
        {HINTS.map((item, i) => (
          <g key={i} transform={`translate(${item.x} ${item.y})`} style={{ opacity: 0.16 }}>
            <CandidateArtifact
              variant={item.variant}
              size={item.size}
              rotation={item.rotation}
              color={COLORS.greyDim}
              accent={COLORS.greyDim}
            />
          </g>
        ))}
      </g>
    </g>
  );
};
