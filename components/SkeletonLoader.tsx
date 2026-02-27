import { useEffect } from "react";

const SHIMMER_STYLE_ID = "skeleton-shimmer-keyframes";

function injectKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById(SHIMMER_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = SHIMMER_STYLE_ID;
  style.textContent = `
    @keyframes skeletonShimmer {
      0% { background-position: -200px 0; }
      100% { background-position: calc(200px + 100%) 0; }
    }
  `;
  document.head.appendChild(style);
}

type ColorTheme = "default" | "cycl" | "executable" | "purple";

const THEMES: Record<ColorTheme, { base: string; highlight: string; text: string }> = {
  default:    { base: "#1a1a2e", highlight: "#2a2a4e", text: "#444466" },
  cycl:       { base: "#0a1a10", highlight: "#1a3a20", text: "#224433" },
  executable: { base: "#1a1408", highlight: "#2a2418", text: "#443820" },
  purple:     { base: "#2a1a4a", highlight: "#4a2a6a", text: "#8866bb" },
};

function shimmerStyle(theme: ColorTheme): React.CSSProperties {
  const t = THEMES[theme];
  return {
    background: `linear-gradient(90deg, ${t.base} 25%, ${t.highlight} 50%, ${t.base} 75%)`,
    backgroundSize: "200px 100%",
    animation: "skeletonShimmer 1.5s ease-in-out infinite",
    borderRadius: 3,
  };
}

// ─── Skeleton Code Block ────────────────────────────────────────────────────

const LINE_WIDTHS = [85, 60, 72, 45, 90, 55, 68, 40, 78, 50, 65, 42];

interface SkeletonCodeBlockProps {
  title?: string;
  lineCount?: number;
  theme?: ColorTheme;
}

export function SkeletonCodeBlock({
  title,
  lineCount = 10,
  theme = "default",
}: SkeletonCodeBlockProps) {
  useEffect(injectKeyframes, []);

  const t = THEMES[theme];
  const borderColor = theme === "cycl" ? "#1a2a1a"
    : theme === "executable" ? "#2a2010"
    : "#1f1f2e";

  return (
    <div style={{ marginBottom: 20 }}>
      {title && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 6,
            gap: 8,
          }}
        >
          <div
            style={{
              ...shimmerStyle(theme),
              height: 14,
              width: Math.min(title.length * 8, 200),
            }}
          />
          <div style={{ flex: 1 }} />
          <div style={{ ...shimmerStyle(theme), height: 22, width: 50, borderRadius: 4 }} />
          <div style={{ ...shimmerStyle(theme), height: 22, width: 64, borderRadius: 4 }} />
        </div>
      )}
      <div
        style={{
          background: t.base,
          padding: 12,
          borderRadius: 8,
          border: `1px solid ${borderColor}`,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div
            key={i}
            style={{
              ...shimmerStyle(theme),
              height: 10,
              width: `${LINE_WIDTHS[i % LINE_WIDTHS.length]}%`,
              animationDelay: `${i * 0.08}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Shimmer Bar ────────────────────────────────────────────────────────────

interface ShimmerBarProps {
  label?: string;
  theme?: ColorTheme;
  height?: number;
}

export function ShimmerBar({
  label = "Working...",
  theme = "purple",
  height = 44,
}: ShimmerBarProps) {
  useEffect(injectKeyframes, []);

  const t = THEMES[theme];

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height,
        borderRadius: 6,
        overflow: "hidden",
        ...shimmerStyle(theme),
        backgroundSize: "400px 100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          color: t.text,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 0.5,
          zIndex: 1,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Inline Shimmer (small, for status text) ────────────────────────────────

interface InlineShimmerProps {
  width?: number;
  height?: number;
  theme?: ColorTheme;
}

export function InlineShimmer({
  width = 120,
  height = 12,
  theme = "default",
}: InlineShimmerProps) {
  useEffect(injectKeyframes, []);

  return (
    <span
      style={{
        display: "inline-block",
        width,
        height,
        verticalAlign: "middle",
        ...shimmerStyle(theme),
      }}
    />
  );
}
