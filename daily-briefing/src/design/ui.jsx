// Shared UI primitives. Modules compose these instead of hand-rolling divs.
//
// The point is not brevity, it is that consistency becomes the default rather
// than something each module has to remember. The old UI drifted because every
// module built its own card, its own badge and its own row - so "card inside a
// card inside a card" was the easiest thing to write.
//
// Card enforces that structurally: see NestContext below.

import { Children, createContext, useContext, useEffect, useState } from "react";
import { C, SEMANTIC, R, SHADOW, T, TRACK, NUM, FONT_SANS, FONT_MONO } from "../lib/tokens.js";
import { CountUp, Reveal, useMountProgress } from "./viz.jsx";

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
// A Card rendered inside another Card does NOT draw a second border. It degrades
// to a plain titled section. This is the structural fix for container overload -
// you cannot nest your way back into the old look even by accident.
const NestContext = createContext(false);

export function Card({ title, label, right, pad = 18, children, style, onClick }) {
  const nested = useContext(NestContext);
  const [hover, setHover] = useState(false);

  const header = (title || label || right) ? (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 12, marginBottom: 14,
    }}>
      <div style={{ minWidth: 0 }}>
        {label && <SectionLabel style={{ marginBottom: title ? 6 : 0 }}>{label}</SectionLabel>}
        {title && (
          <div style={{ font: `500 ${T.body}px/1.2 ${FONT_SANS}`, color: C.text }}>{title}</div>
        )}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  ) : null;

  if (nested) {
    return (
      <section style={{ marginTop: 18, ...style }}>
        {header}
        {children}
      </section>
    );
  }

  return (
    <NestContext.Provider value={true}>
      <section
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          background: hover && onClick ? C.cardBgHover : C.cardBg,
          border: `1px solid ${hover && onClick ? C.borderStrong : C.border}`,
          borderRadius: R.xl,
          padding: pad,
          boxShadow: hover && onClick ? SHADOW.cardHover : SHADOW.card,
          cursor: onClick ? "pointer" : undefined,
          // Interactive cards lift; static cards stay put. The transform settles
          // to `none` for the same containing-block reason as Reveal.
          transform: hover && onClick ? "translateY(-2px)" : "none",
          transition: "background 120ms ease, border-color 120ms ease, box-shadow 180ms ease, transform 180ms cubic-bezier(0.22,1,0.36,1)",
          minWidth: 0,
          ...style,
        }}
      >
        {header}
        {children}
      </section>
    </NestContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// SectionLabel
// ---------------------------------------------------------------------------
export function SectionLabel({ children, style }) {
  return (
    <div style={{
      font: `500 ${T.label}px/1 ${FONT_SANS}`,
      letterSpacing: TRACK.label,
      textTransform: "uppercase",
      color: C.textHint,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat
// ---------------------------------------------------------------------------
// label / big number / one line of context. `of` renders the denominator inline
// at a smaller size, which is how "62/90" reads as one figure rather than two.
export function Stat({ label, value, of, note, noteLevel, size = "hero", right, style, valueColor }) {
  const fs = size === "heroLg" ? T.heroLg : size === "sm" ? 24 : T.hero;
  const noteColor = noteLevel ? SEMANTIC[noteLevel].fill : C.textHint;
  return (
    <div style={{ minWidth: 0, ...style }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <SectionLabel>{label}</SectionLabel>
        {right}
      </div>
      <div style={{
        font: `600 ${fs}px/1 ${FONT_SANS}`,
        letterSpacing: TRACK.tighter,
        color: valueColor || C.text,
        ...NUM,
      }}>
        {/* A bare number counts up; anything pre-formatted (€1,933, "47%", MASK)
            is rendered as given. Callers that want an animated currency figure
            pass a CountUp with its own formatter. */}
        {typeof value === "number" ? <CountUp value={value} /> : value}
        {of != null && <span style={{ fontSize: Math.round(fs * 0.47), color: C.textFaint }}>/{of}</span>}
      </div>
      {note && (
        <div style={{ font: `400 ${T.micro}px/1.3 ${FONT_SANS}`, color: noteColor, marginTop: 9 }}>
          {note}
        </div>
      )}
    </div>
  );
}

// StatRow - stats separated by rules rather than each wrapped in its own card.
export function StatRow({ children, cols }) {
  const n = cols || (Array.isArray(children) ? children.length : 1);
  const items = Array.isArray(children) ? children : [children];
  // Rules fade at their ends instead of running edge to edge - the structure
  // stays, the boxed-in feeling goes.
  const hRule = `linear-gradient(90deg, transparent, ${C.border} 10%, ${C.border} 90%, transparent)`;
  const vRule = `linear-gradient(180deg, transparent, ${C.border} 28%, ${C.border} 72%, transparent)`;
  return (
    <div>
      <div style={{ height: 1, background: hRule }} />
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
      }}>
        {items.map((child, i) => (
          <div key={i} style={{
            position: "relative",
            padding: `16px ${i === items.length - 1 ? 0 : 18}px 16px ${i === 0 ? 0 : 18}px`,
            minWidth: 0,
          }}>
            {child}
            {i < items.length - 1 && (
              <span style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 1, background: vRule }} />
            )}
          </div>
        ))}
      </div>
      <div style={{ height: 1, background: hRule }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusDot
// ---------------------------------------------------------------------------
// Replaces most text badges. A 6px dot carries state without shouting; a badge
// that says "Active" is decoration, and decoration is what made real alerts
// invisible.
export function StatusDot({ level = "idle", color, size = 6, title, style }) {
  return (
    <span
      title={title}
      style={{
        width: size, height: size, borderRadius: R.pill,
        background: color || SEMANTIC[level].fill,
        flex: "none", display: "inline-block",
        ...style,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------
// Only for labels where the TEXT is the information ("Behind 72%", "SMB").
// If the text is a state name, use a StatusDot instead.
export function Badge({ children, level = "idle", color, mono, style }) {
  const s = SEMANTIC[level] || SEMANTIC.idle;
  return (
    <span style={{
      font: `500 ${T.label}px/1 ${mono ? FONT_MONO : FONT_SANS}`,
      color: color || s.fill,
      background: s.bg,
      border: `1px solid ${s.border}`,
      padding: "4px 9px",
      borderRadius: R.pill,
      whiteSpace: "nowrap",
      ...style,
    }}>
      {children}
    </span>
  );
}

// Rounded tinted square used as a row leader - the "logo square" pattern.
export function Glyph({ children, level = "idle", color, size = 30, style }) {
  const s = SEMANTIC[level] || SEMANTIC.idle;
  return (
    <span style={{
      width: size, height: size, borderRadius: R.md - 1,
      background: s.bg, border: `1px solid ${s.border}`,
      color: color || s.fill,
      font: `600 ${T.label}px/1 ${FONT_SANS}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flex: "none",
      ...style,
    }}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// DataRow / DataList
// ---------------------------------------------------------------------------
// A list of things is a list, not fifteen bordered rectangles. Rows are divided
// by a rule and tint on hover; they never get their own border.
export function DataList({ children, style }) {
  return <div style={{ borderTop: `1px solid ${C.divider}`, ...style }}>{children}</div>;
}

export function DataRow({ children, onClick, last, style }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "11px 8px", margin: "0 -8px",
        borderBottom: last ? "none" : `1px solid ${C.divider}`,
        background: hover && onClick ? "rgba(255,255,255,0.025)" : "transparent",
        cursor: onClick ? "pointer" : undefined,
        borderRadius: hover && onClick ? R.sm : 0,
        transition: "background 100ms ease",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TabBar
// ---------------------------------------------------------------------------
// Segmented pills in a recessed track.
//
// cycleShortcut: opt-in Tab / Shift+Tab cycling for the module's PRIMARY tab
// bar. Cmd+Tab is reserved by macOS (app switcher) and never reaches the page,
// so plain Tab is the closest reliable equivalent. Only one TabBar per mounted
// module should set this - modules unmount on switch, so no cross-module clash.
// Keystrokes originating in inputs/textareas/selects are left alone so form
// focus traversal keeps working.
export function TabBar({ tabs, value, onChange, size = "md", cycleShortcut = false, style }) {
  const fs = size === "sm" ? T.label : T.micro;
  useEffect(() => {
    if (!cycleShortcut) return;
    const handler = (e) => {
      if (e.key !== "Tab" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      const tag = (t.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || t.isContentEditable) return;
      e.preventDefault();
      const ids = tabs.map((x) => x.id ?? x);
      const i = ids.indexOf(value);
      onChange(ids[(i + (e.shiftKey ? ids.length - 1 : 1)) % ids.length]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cycleShortcut, tabs, value, onChange]);
  return (
    <div style={{
      display: "inline-flex", gap: 3,
      background: C.wellBg,
      border: `1px solid ${C.borderStrong}`,
      borderRadius: R.pill,
      padding: 3,
      ...style,
    }}>
      {tabs.map((t) => {
        const id = t.id ?? t;
        const label = t.label ?? t;
        const on = id === value;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              font: `${on ? 500 : 400} ${fs}px/1 ${FONT_SANS}`,
              color: on ? C.text : C.textHint,
              background: on ? "rgba(255,255,255,0.07)" : "transparent",
              border: "none",
              padding: size === "sm" ? "5px 10px" : "6px 13px",
              borderRadius: R.pill,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "background 120ms ease, color 120ms ease",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProgressBar
// ---------------------------------------------------------------------------
// A bullet chart, not a progress bar: three facts on one line, compared by
// position rather than in your head.
//   the track  = the full target
//   the shade  = the share of the period already spent
//   the bar    = actual
//   the tick   = where you should be by now (`marker`)
// Sweeps in once on mount, then holds - see the motion doctrine in viz.jsx.
export function ProgressBar({ pct, level = "ok", color, height = 4, marker, delay = 0, style }) {
  const p = useMountProgress(850, delay);
  const v = Math.max(0, Math.min(100, pct ?? 0));
  const m = marker == null ? null : Math.max(0, Math.min(100, marker));
  const fill = color || SEMANTIC[level].fill;
  return (
    <div style={{
      // A light overlay, not the well token: on a translucent card a near-black
      // track vanishes, and a bar you cannot see the end of is not a measurement.
      position: "relative", height, borderRadius: R.pill,
      background: "rgba(255,255,255,0.07)", overflow: "visible", ...style,
    }}>
      {m != null && (
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: `${m}%`,
          borderRadius: R.pill, background: "rgba(255,255,255,0.05)",
        }} />
      )}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: `${v * p}%`, borderRadius: R.pill,
        background: `linear-gradient(90deg, ${fill}99, ${fill})`,
        boxShadow: `0 0 10px -2px ${fill}aa`,
      }} />
      {m != null && (
        <div
          title={`target ${marker}%`}
          style={{
            position: "absolute", left: `${m}%`, top: -2,
            width: 1.5, height: height + 4, background: C.textMid, borderRadius: 1,
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty
// ---------------------------------------------------------------------------
// An empty state is a designed state. "Nothing breaching" is information.
export function Empty({ children, level = "ok", style }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "20px 0", ...style,
    }}>
      <StatusDot level={level} />
      <span style={{ font: `400 ${T.body}px/1.4 ${FONT_SANS}`, color: C.textMuted }}>{children}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PageHeader
// ---------------------------------------------------------------------------
export function PageHeader({ num, title, sub, right, style }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", justifyContent: "space-between",
      gap: 16, marginBottom: 22, ...style,
    }}>
      <div style={{ minWidth: 0 }}>
        {num && (
          <div style={{
            font: `500 ${T.label}px/1 ${FONT_SANS}`,
            letterSpacing: TRACK.labelWide, textTransform: "uppercase",
            color: C.textFaint, marginBottom: 8,
          }}>
            {num}
          </div>
        )}
        <h1 style={{
          font: `600 ${T.title}px/1.2 ${FONT_SANS}`,
          letterSpacing: TRACK.tight, color: C.text, margin: 0,
        }}>
          {title}
        </h1>
        {sub && (
          <div style={{ font: `400 ${T.micro + 1}px/1.4 ${FONT_SANS}`, color: C.textHint, marginTop: 6 }}>
            {sub}
          </div>
        )}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

// Page frame - every module's outer wrapper, so padding and max width are set once.
// Page also owns the entry choreography: each top-level section fades and rises
// in sequence. Doing it here rather than per module means a module gets the
// motion by existing, and there is one place to tune the rhythm - the same
// reason Card owns the shadow.
export function Page({ children, style }) {
  return (
    <div style={{
      padding: "26px 28px 56px",
      maxWidth: 1480,
      margin: "0 auto",
      fontFamily: FONT_SANS,
      ...style,
    }}>
      {Children.map(children, (child, i) =>
        child == null ? child : <Reveal index={i}>{child}</Reveal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AreaChart
// ---------------------------------------------------------------------------
// One SVG line chart with a gradient fade, optional dashed reference paths and a
// hover tooltip. Built once here because five modules want the same chart and
// five hand-rolled SVGs would drift apart immediately.
//
//   series    [{ x, y }]            the actual line
//   reference [{ points, color, label }]  dashed overlays (quota pace, projection)
//   format    (y) => string         tooltip value formatting
let chartSeq = 0;

export function AreaChart({
  series = [],
  reference = [],
  color,
  height = 170,
  yMax,
  xLabels = [],
  format = (v) => String(v),
  style,
}) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const [gid] = useState(() => `ac${++chartSeq}`);
  // Draw-on, same dash trick as Sparkline: the line sweeps left to right once,
  // the area and reference overlays fade up behind it.
  const draw = useMountProgress(1000);
  const stroke = color || C.emerald;

  const W = 640, H = height;
  const padT = 10, padB = 8;
  const max = yMax ?? Math.max(1, ...series.map((p) => p.y), ...reference.flatMap((r) => r.points.map((p) => p.y)));
  const n = Math.max(1, series.length - 1);
  const px = (i) => (i / n) * W;
  const py = (y) => H - padB - (y / max) * (H - padT - padB);

  const toPath = (pts, mapX) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${(mapX ? mapX(p, i) : px(i)).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ");

  const linePath = toPath(series);
  const areaPath = series.length
    ? `${linePath} L${px(series.length - 1).toFixed(1)},${H} L0,${H} Z`
    : "";

  const hp = hoverIdx != null ? series[hoverIdx] : null;

  return (
    <div style={{ ...style }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height, display: "block", overflow: "visible" }}
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const rel = ((e.clientX - r.left) / r.width) * W;
          setHoverIdx(Math.max(0, Math.min(series.length - 1, Math.round((rel / W) * n))));
        }}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.30" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.18, 0.44, 0.70, 0.95].map((f) => (
          <line key={f} x1="0" y1={H * f} x2={W} y2={H * f} stroke={C.border} strokeWidth="1" />
        ))}

        {reference.map((r, i) => (
          <path
            key={i}
            d={toPath(r.points, r.mapX)}
            fill="none"
            stroke={r.color || C.textFaint}
            strokeWidth="1.5"
            strokeDasharray={r.dash || "4 5"}
            opacity={(r.opacity ?? 1) * draw}
          />
        ))}

        {areaPath && <path d={areaPath} fill={`url(#${gid})`} opacity={draw} />}
        {linePath && (
          <path d={linePath} fill="none" stroke={stroke} strokeWidth="2.25"
                strokeLinecap="round" strokeLinejoin="round"
                pathLength="1" strokeDasharray="1" strokeDashoffset={1 - draw} />
        )}

        {hp && (
          <>
            <line x1={px(hoverIdx)} y1={py(hp.y)} x2={px(hoverIdx)} y2={H}
                  stroke="rgba(255,255,255,0.14)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={px(hoverIdx)} cy={py(hp.y)} r="4.5" fill={stroke} stroke={C.bg} strokeWidth="2.5" />
          </>
        )}
      </svg>

      {hp && (
        <div style={{
          marginTop: -height + Math.max(0, py(hp.y) - 54),
          marginLeft: `calc(${(hoverIdx / n) * 100}% - 62px)`,
          width: 124, pointerEvents: "none", position: "relative",
          background: C.surfaceAlt, border: `1px solid ${C.borderStrong}`,
          borderRadius: R.md, padding: "8px 10px", boxShadow: SHADOW.card,
        }}>
          <div style={{ font: `400 ${T.label}px/1 ${FONT_SANS}`, color: C.textHint }}>{hp.x}</div>
          <div style={{ font: `600 ${T.body}px/1 ${FONT_SANS}`, color: C.text, marginTop: 5, ...NUM }}>
            {format(hp.y)}
          </div>
        </div>
      )}

      {xLabels.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: hp ? 54 : 8 }}>
          {xLabels.map((l, i) => (
            <span key={i} style={{ font: `400 ${T.label}px/1 ${FONT_MONO}`, color: C.textFaint }}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bars - compact horizontal bar list (sources, segments, stages)
// ---------------------------------------------------------------------------
export function Bars({ items, color, format = (v) => String(v), style }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div style={{ ...style }}>
      {items.map((it, i) => (
        <div key={i} style={{ marginBottom: i === items.length - 1 ? 0 : 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ font: `400 ${T.body - 1}px/1 ${FONT_SANS}`, color: C.textMid }}>{it.label}</span>
            <span style={{ font: `500 ${T.body - 1}px/1 ${FONT_MONO}`, color: C.text, ...NUM }}>
              {format(it.value)}
            </span>
          </div>
          <ProgressBar pct={(it.value / max) * 100} color={it.color || color || C.emerald} height={4} />
        </div>
      ))}
    </div>
  );
}
