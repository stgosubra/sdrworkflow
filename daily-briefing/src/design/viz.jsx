// Visualization and motion primitives.
//
// ui.jsx holds the chrome - cards, rows, badges. This file holds the things that
// encode a number as a shape: gauges, bullet rows, rings, sparklines, plus the
// two motion helpers everything else leans on.
//
// Motion doctrine, same as tokens.js: animation runs on mount and on transition,
// never on a loop. A dashboard that moves while you read it is a dashboard you
// learn to ignore, and the alert states are the first thing to get tuned out.
// So: reveal, sweep, count up - once, then still.

import { useEffect, useRef, useState } from "react";
import { C, T, TRACK, NUM, SEMANTIC, FONT_SANS, FONT_MONO } from "../lib/tokens.js";

// ---------------------------------------------------------------------------
// Motion helpers
// ---------------------------------------------------------------------------

// Honour the OS "reduce motion" setting. Everything below degrades to its final
// frame rather than disappearing, so a user with the flag set loses the movement
// and keeps all of the information.
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

// Drives a 0 -> 1 progress value once, after `delay`. The single clock behind
// every sweep, draw and count-up here.
export function useMountProgress(duration = 900, delay = 0) {
  const reduced = usePrefersReducedMotion();
  const [p, setP] = useState(reduced ? 1 : 0);
  const raf = useRef(0);
  useEffect(() => {
    if (reduced) { setP(1); return; }
    let start = 0;
    const tick = (t) => {
      if (!start) start = t;
      const e = t - start - delay;
      if (e < 0) { raf.current = requestAnimationFrame(tick); return; }
      // easeOutCubic: fast arrival, soft landing. Values stop moving early
      // enough to be read while the tail of the motion is still finishing.
      const k = Math.min(1, e / duration);
      setP(1 - Math.pow(1 - k, 3));
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [duration, delay, reduced]);
  return p;
}

// Fade + rise on mount. `index` staggers a list without each caller tracking it.
export function Reveal({ children, index = 0, step = 55, y = 10, style }) {
  const reduced = usePrefersReducedMotion();
  const [on, setOn] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setOn(true), index * step);
    return () => clearTimeout(t);
  }, [index, step, reduced]);
  return (
    <div style={{
      opacity: on ? 1 : 0,
      // Settles to `none`, not `translateY(0)`. A lingering transform makes this
      // div a containing block, which would re-anchor any `position: fixed`
      // descendant (the calculator's dropdown scrim) to the card instead of the
      // viewport. CSS interpolates translateY -> none fine, so the motion is
      // unchanged and the side effect disappears once it lands.
      transform: on ? "none" : `translateY(${y}px)`,
      transition: "opacity 420ms ease, transform 420ms cubic-bezier(0.22,1,0.36,1)",
      ...style,
    }}>
      {children}
    </div>
  );
}

// Counts to `value` on mount. Takes a formatter so currency and percentages
// animate as the thing they are rather than as a raw number that reformats at
// the end.
export function CountUp({ value, format = (v) => Math.round(v).toLocaleString(), duration = 900, delay = 0, style }) {
  const p = useMountProgress(duration, delay);
  return <span style={{ ...NUM, ...style }}>{format(value * p)}</span>;
}

// ---------------------------------------------------------------------------
// Gauge - radial attainment dial
// ---------------------------------------------------------------------------
// A 270-degree arc rather than a full ring: the gap at the bottom is where the
// caption goes, and an open arc reads as a dial (a scale with a start and an
// end) where a closed ring reads as a pie.
export function Gauge({
  pct, label, caption, level = "ok", color, size = 168, thickness = 13,
  markerPct, children,
}) {
  const p = useMountProgress(1100);
  const hue = color || SEMANTIC[level].fill;
  const r = (size - thickness) / 2 - 2;
  const cx = size / 2, cy = size / 2;
  const SWEEP = 270, START = 135;           // degrees; 135 -> 405
  const circ = 2 * Math.PI * r;
  const arcLen = circ * (SWEEP / 360);
  const shown = Math.max(0, Math.min(1, (pct || 0) / 100)) * p;

  const pointAt = (deg) => {
    const rad = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const [sx, sy] = pointAt(START);
  const [ex, ey] = pointAt(START + SWEEP);
  const track = `M ${sx} ${sy} A ${r} ${r} 0 1 1 ${ex} ${ey}`;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id={`g-${hue.replace("#", "")}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={hue} stopOpacity="0.55" />
            <stop offset="100%" stopColor={hue} stopOpacity="1" />
          </linearGradient>
          {/* Kept tight. A wide blur turns a low reading - a 4% arc is only a few
              pixels long - into a smudge with no readable end. */}
          <filter id="gauge-bloom" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <path d={track} fill="none" stroke="rgba(255,255,255,0.065)"
          strokeWidth={thickness} strokeLinecap="round" />

        <path
          d={track} fill="none" stroke={`url(#g-${hue.replace("#", "")})`}
          strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={`${arcLen * shown} ${circ}`}
          filter="url(#gauge-bloom)"
        />

        {/* The expected-pace tick, drawn last so it survives a fill that has
            already run past it. A dial with no reference is decoration - this is
            the line that turns "4%" into "4% and you should be at 13%". */}
        {markerPct != null && (() => {
          const rad = (START + SWEEP * Math.max(0, Math.min(1, markerPct / 100))) * Math.PI / 180;
          const ri = r - thickness / 2 - 3, ro = r + thickness / 2 + 3;
          return (
            <line
              x1={cx + ri * Math.cos(rad)} y1={cy + ri * Math.sin(rad)}
              x2={cx + ro * Math.cos(rad)} y2={cy + ro * Math.sin(rad)}
              stroke={C.textMid} strokeWidth="1.5" strokeLinecap="round"
            />
          );
        })()}
      </svg>

      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 2,
        pointerEvents: "none",
      }}>
        {children || (
          <>
            <div style={{ font: `600 ${T.hero}px/1 ${FONT_SANS}`, color: C.text, letterSpacing: TRACK.tighter, ...NUM }}>
              {label}
            </div>
            {caption && (
              <div style={{ font: `400 ${T.micro}px/1.3 ${FONT_SANS}`, color: C.textHint, textAlign: "center", maxWidth: size - 56 }}>
                {caption}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// The bullet chart lives in ui.jsx as ProgressBar - every consumer already held
// a reference to that name, and two components drawing the same three facts is
// how the old palette drift started.

// ---------------------------------------------------------------------------
// Ring - compact countdown / burn-down dial
// ---------------------------------------------------------------------------
// Sized for a card corner. Shows elapsed-against-allowed as a closed ring,
// because here the full circle IS the meaning: the SLA window closing.
export function Ring({ pct, level = "ok", color, size = 30, thickness = 3.5, label }) {
  const p = useMountProgress(800);
  const hue = color || SEMANTIC[level].fill;
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const shown = Math.max(0, Math.min(1, (pct || 0) / 100)) * p;
  return (
    <svg width={size} height={size} style={{ display: "block", flexShrink: 0 }} aria-label={label}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.075)" strokeWidth={thickness} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={hue} strokeWidth={thickness} strokeLinecap="round"
        strokeDasharray={`${circ * shown} ${circ}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sparkline - trend in the space of a word
// ---------------------------------------------------------------------------
export function Sparkline({ points, color, width = 92, height = 24, fill = true, delay = 0 }) {
  const p = useMountProgress(900, delay);
  const hue = color || C.bloom;
  if (!points || points.length < 2) return <div style={{ width, height }} />;

  const max = Math.max(...points), min = Math.min(...points);
  const span = max - min || 1;
  const x = (i) => (i / (points.length - 1)) * width;
  const y = (v) => height - 2 - ((v - min) / span) * (height - 4);
  const line = points.map((v, i) => `${i ? "L" : "M"} ${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(" ");
  const uid = Math.abs(points.reduce((a, b) => a + b, 0) * points.length).toFixed(0);

  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`sp-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={hue} stopOpacity="0.32" />
          <stop offset="100%" stopColor={hue} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && (
        <path d={`${line} L ${width} ${height} L 0 ${height} Z`} fill={`url(#sp-${uid})`} opacity={p} />
      )}
      {/* Draw-on: one dash as long as the path, offset back by the un-drawn
          remainder. Cheaper than animating `d` and it never reflows. */}
      <path d={line} fill="none" stroke={hue} strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round"
        pathLength="1" strokeDasharray="1" strokeDashoffset={1 - p} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// FunnelFlow - proportional stage flow
// ---------------------------------------------------------------------------
// Stacked bars make every stage the same width, which hides the drop. This draws
// each stage as a band whose height IS its share, with the taper between bands
// showing the loss. The shape of the leak is the point.
export function FunnelFlow({ stages, height = 150, format = (v) => String(v) }) {
  const p = useMountProgress(1000);
  if (!stages || stages.length < 2) return null;

  const W = 100, top = stages[0].value || 1;
  const band = W / stages.length;
  const h = (v) => Math.max(2, (v / top) * (height - 26));

  return (
    <div style={{ width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none"
        style={{ width: "100%", height, display: "block" }}>
        <defs>
          <linearGradient id="ff" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={C.bloom} stopOpacity="0.85" />
            <stop offset="100%" stopColor={C.blue} stopOpacity="0.5" />
          </linearGradient>
        </defs>
        {stages.slice(0, -1).map((s, i) => {
          const n = stages[i + 1];
          const x0 = i * band, x1 = (i + 1) * band;
          const y0 = height - 20 - h(s.value) * p, y1 = height - 20 - h(n.value) * p;
          return (
            <path key={i}
              d={`M ${x0} ${y0} L ${x1} ${y1} L ${x1} ${height - 20} L ${x0} ${height - 20} Z`}
              fill="url(#ff)" opacity={0.95 - i * 0.13} />
          );
        })}
      </svg>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${stages.length}, 1fr)`, gap: 4, marginTop: 8 }}>
        {stages.map((s, i) => (
          <div key={i} style={{ minWidth: 0 }}>
            <div style={{ font: `600 ${T.bodyLg}px/1 ${FONT_SANS}`, color: C.text, ...NUM }}>
              {format(s.value)}
            </div>
            <div style={{ font: `400 ${T.label}px/1.3 ${FONT_MONO}`, color: C.textHint, letterSpacing: TRACK.label, textTransform: "uppercase", marginTop: 4 }}>
              {s.label}
            </div>
            {i > 0 && (
              <div style={{ font: `400 ${T.micro}px/1 ${FONT_SANS}`, color: C.textFaint, marginTop: 3, ...NUM }}>
                {stages[i - 1].value ? Math.round((s.value / stages[i - 1].value) * 100) : 0}%
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
