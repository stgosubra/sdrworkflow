import { useState, useEffect, useRef } from "react";
import { C, R, SHADOW, T, TRACK, FONT_SANS, FONT_MONO, FONT_DISPLAY } from "./lib/tokens.js";
import { PROFILE } from "./config.js";
import { MODULES } from "./lib/modules.js";
import { CloudTalkBadge } from "./design/brand.jsx";
import { ModuleIcon } from "./design/icons.jsx";
import { staleModules, declaredGaps } from "./lib/freshness.js";

import DashboardModule from "./modules/dashboard/index.jsx";
import BriefingModule from "./modules/briefing/index.jsx";
import CalculatorModule from "./modules/calculator/index.jsx";
import PerformanceModule from "./modules/performance/index.jsx";
import SelfServedModule from "./modules/selfserved/index.jsx";
import PacingModule from "./modules/pacing/index.jsx";
import DealsModule from "./modules/deals/index.jsx";
import { onboardingAlertCount } from "./modules/selfserved/data.js";

// Module metadata comes from lib/modules.js; only the component binding lives
// here, because that is the one field that needs the imports above.
const COMPONENTS = {
  dashboard: DashboardModule,
  briefing: BriefingModule,
  calculator: CalculatorModule,
  performance: PerformanceModule,
  selfserved: SelfServedModule,
  pacing: PacingModule,
  deals: DealsModule,
};

const NAV = MODULES.map((m) => ({ ...m, component: COMPONENTS[m.id] }));

const STORAGE_KEY = "ct.shell.activeModule";
const RAIL_COLLAPSED_KEY = "ct.shell.railCollapsed";

export default function Shell() {
  const [activeId, setActiveId] = useState(() => {
    if (typeof window === "undefined") return "dashboard";
    return localStorage.getItem(STORAGE_KEY) || "dashboard";
  });
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(RAIL_COLLAPSED_KEY) === "1";
  });

  const [paletteOpen, setPaletteOpen] = useState(false);

  // Radial fan: when the rail is collapsed, hovering it deploys the modules as
  // a circular arc of icon buttons. Closes on leave or when the rail expands.
  // The arc is anchored to the vertical center of the numbers list, measured on
  // open, so the fan sits in line with the numbers instead of mid-viewport.
  const [fanOpen, setFanOpen] = useState(false);
  const [fanY, setFanY] = useState(null);
  const navRef = useRef(null);
  const asideRef = useRef(null);
  useEffect(() => { if (!collapsed) setFanOpen(false); }, [collapsed]);
  const openFan = () => {
    if (!collapsed) return;
    if (navRef.current && asideRef.current) {
      const navRect = navRef.current.getBoundingClientRect();
      const asideRect = asideRef.current.getBoundingClientRect();
      // Center of the rendered nav buttons, not the flex-grown nav element -
      // the <nav> stretches to fill the rail, the buttons sit at its top.
      const buttons = navRef.current.querySelectorAll("button");
      if (buttons.length) {
        const first = buttons[0].getBoundingClientRect();
        const last = buttons[buttons.length - 1].getBoundingClientRect();
        setFanY((first.top + last.bottom) / 2 - asideRect.top);
      } else {
        setFanY(navRect.top + navRect.height / 2 - asideRect.top);
      }
    }
    setFanOpen(true);
  };

  // Count of triggered self-served onboarding/upsell alerts (3-30 day band).
  const ssAlertCount = onboardingAlertCount();

  useEffect(() => { localStorage.setItem(STORAGE_KEY, activeId); }, [activeId]);
  useEffect(() => { localStorage.setItem(RAIL_COLLAPSED_KEY, collapsed ? "1" : "0"); }, [collapsed]);

  // Keyboard shortcuts:
  //   Cmd/Ctrl + K  -> command palette (primary, scales past 9 modules)
  //   Cmd/Ctrl + 1-9, 0 (10), - (11), = (12) -> direct jump (best-effort; the
  //                browser also binds Cmd+1-8 to tab switching, so the palette
  //                is the reliable path)
  //   Cmd/Ctrl + B  -> collapse rail
  useEffect(() => {
    const handler = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      const map = { "1":0, "2":1, "3":2, "4":3, "5":4, "6":5, "7":6, "8":7, "9":8, "0":9, "-":10, "=":11 };
      if (map[e.key] !== undefined) {
        e.preventDefault();
        const item = NAV[map[e.key]];
        if (item) setActiveId(item.id);
      }
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        setCollapsed((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // intent = a one-shot sub-view hint passed to the module being opened
  // (e.g. {module:"calculator", tab:"cost"}). The module reads it on mount.
  const [intent, setIntent] = useState(null);
  const goTo = (id, intentObj = null) => {
    setActiveId(id);
    setIntent(intentObj && intentObj.module === id ? intentObj : null);
    setPaletteOpen(false);
  };

  const active = NAV.find((n) => n.id === activeId) || NAV[0];
  const ActiveComponent = active.component;

  const railWidth = collapsed ? 64 : 232;

  return (
    <div style={{
      display: "flex", minHeight: "100vh", background: C.bgGlow, color: C.text,
      fontFamily: FONT_SANS,
    }}>
      {/* LEFT RAIL */}
      <aside
        ref={asideRef}
        onMouseEnter={openFan}
        onMouseLeave={() => setFanOpen(false)}
        style={{
          width: railWidth,
          flexShrink: 0,
          background: C.surface,
          borderRight: `1px solid ${C.border}`,
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
          transition: "width 160ms ease",
          zIndex: 20,
        }}>
        {/* Brand */}
        <div style={{
          padding: collapsed ? "18px 0" : "18px 16px",
          display: "flex",
          flexDirection: collapsed ? "column" : "row",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: collapsed ? 12 : 8,
        }}>
          {collapsed && <CloudTalkBadge size={28} radius={R.md} />}
          {!collapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <CloudTalkBadge size={28} radius={R.md} />
              <div style={{ lineHeight: 1.25 }}>
                <div style={{
                  fontFamily: FONT_DISPLAY, fontSize: T.body, fontWeight: 600,
                  letterSpacing: TRACK.tight, color: C.text,
                }}>
                  CloudTalk
                </div>
                <div style={{
                  fontFamily: FONT_MONO, fontSize: 9, letterSpacing: TRACK.labelWide,
                  color: C.textFaint,
                }}>
                  COCKPIT
                </div>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expand (Cmd+B)" : "Collapse (Cmd+B)"}
            style={{
              background: C.wellBg,
              border: `1px solid ${C.border}`,
              color: C.textMuted,
              width: 26, height: 26, borderRadius: R.sm,
              cursor: "pointer",
              fontFamily: FONT_MONO, fontSize: 11,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>

        {/* Nav */}
        <nav ref={navRef} style={{ flex: 1, overflowY: "auto", padding: collapsed ? "6px 8px" : "6px 10px" }}>
          {NAV.map((item) => {
            const isActive = item.id === activeId;
            const accent = C[item.accent] || C.blue;
            // Self-served onboarding/upsell alert: surface a warning on the nav label
            // so a triggered alert is visible even when module 05 isn't open.
            const navAlert =
              item.id === "selfserved" && !isActive && ssAlertCount > 0;
            return (
              <button
                key={item.id}
                onClick={() => setActiveId(item.id)}
                title={collapsed ? `${item.label} - ${item.sub}` : ""}
                style={{
                  position: "relative",
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: collapsed ? 0 : 11,
                  padding: collapsed ? "9px 0" : "9px 11px",
                  marginBottom: 2,
                  justifyContent: collapsed ? "center" : "flex-start",
                  // The active item is a filled gradient pill, not a border tick.
                  // It is the single loudest thing in the rail, which is what makes
                  // "where am I" readable at a glance in a seven-module list.
                  background: isActive
                    ? `linear-gradient(135deg, ${accent}2E, ${accent}12)`
                    : "transparent",
                  border: `1px solid ${isActive ? `${accent}4D` : "transparent"}`,
                  borderRadius: R.md,
                  color: isActive ? C.text : C.textMuted,
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: FONT_SANS,
                  transition: "background 110ms ease, color 110ms ease",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = C.surfaceAlt;
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "transparent";
                }}
              >
                <span style={{
                  fontFamily: FONT_MONO, fontSize: T.label,
                  color: isActive ? accent : C.textFaint,
                  letterSpacing: 0.5,
                  minWidth: collapsed ? 0 : 17,
                }}>
                  {item.num}
                </span>
                {!collapsed && ModuleIcon[item.id] && (
                  <span style={{
                    display: "flex", alignItems: "center", flexShrink: 0,
                    color: isActive ? accent : C.textFaint,
                  }}>
                    {ModuleIcon[item.id]}
                  </span>
                )}
                {!collapsed && (
                  <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: T.body, fontWeight: 500 }}>{item.label}</span>
                    <span style={{ fontSize: 10, color: C.textFaint, fontFamily: FONT_MONO, letterSpacing: 0.3 }}>
                      {item.sub}
                    </span>
                  </span>
                )}
                {navAlert && (
                  <span
                    title={`${ssAlertCount} self-served onboarding alert${ssAlertCount === 1 ? "" : "s"} - open Self-Served`}
                    style={{
                      fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700,
                      color: C.amber, lineHeight: 1,
                      background: C.amberBg,
                      border: `1px solid ${C.amberBorder}`,
                      borderRadius: R.sm,
                      padding: "3px 6px",
                      ...(collapsed
                        ? { position: "absolute", top: 3, right: 3, padding: "2px 4px" }
                        : {}),
                    }}
                  >
                    +{ssAlertCount}
                  </span>
                )}
                {isActive && (
                  <span style={{
                    position: "absolute", right: -1,
                    top: 8, bottom: 8, width: 3,
                    background: accent, borderRadius: "2px 0 0 2px",
                    boxShadow: `0 0 8px ${accent}99`,
                  }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        <div style={{
          margin: collapsed ? "0 8px 12px" : "0 10px 12px",
          padding: collapsed ? "10px 0" : "10px 11px",
          borderRadius: R.md,
          background: C.wellBg,
          border: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", gap: 10,
          justifyContent: collapsed ? "center" : "flex-start",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: R.sm,
            background: `linear-gradient(140deg, ${C.blue}, ${C.purple})`,
            color: "#fff", fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            {PROFILE.initials}
          </div>
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{PROFILE.name}</div>
              <div style={{ fontSize: 10, color: C.textFaint, fontFamily: FONT_MONO }}>{PROFILE.title}</div>
            </div>
          )}
        </div>

        {collapsed && (
          <RadialNav
            nav={NAV}
            activeId={activeId}
            open={fanOpen}
            anchorY={fanY}
            onSelect={(id) => { setActiveId(id); setFanOpen(false); }}
            alertCount={ssAlertCount}
          />
        )}
      </aside>

      {/* CONTENT */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <StalenessBanner />
        <DataGapsBanner />
        <ActiveComponent intent={intent} onNavigate={(id) => setActiveId(id)} />
      </main>

      {paletteOpen && (
        <CommandPalette nav={NAV} activeId={activeId} onSelect={goTo} onClose={() => setPaletteOpen(false)} />
      )}
    </div>
  );
}

// Radial module fan for the collapsed rail. Icons deploy on an arc opening into
// the content area, staggered outward on open and folding back inward on close.
// Pure CSS transitions - no animation deps in the shell. Buttons are children of
// the sticky aside, so hovering them keeps the aside's mouseleave from firing.
function RadialNav({ nav, activeId, open, anchorY, onSelect, alertCount }) {
  const n = nav.length;
  const START = -68, END = 68; // degrees; 0 points right, into the content
  const RADIUS = 148;
  const SIZE = 50;
  return (
    <div style={{ position: "absolute", left: 32, top: anchorY ?? "50%", zIndex: 150 }}>
      {/* scrim: lifts the fan off the module content underneath. It is also the
          hover-keeper - while the fan is open it accepts pointer events, so the
          aside's mouseleave never fires as the cursor crosses the gap between
          the rail and the fan buttons. Clicks on it just fold the fan. */}
      <span
        onClick={() => onSelect(activeId)}
        style={{
          position: "absolute", left: -120, top: -260, width: 480, height: 520,
          borderRadius: "50%",
          pointerEvents: open ? "auto" : "none",
          background: "radial-gradient(closest-side, rgba(8,5,14,0.88), rgba(8,5,14,0.55) 55%, transparent)",
          opacity: open ? 1 : 0,
          transition: "opacity 220ms ease",
        }} />
      {/* hub node the arc visually emanates from */}
      <span style={{
        position: "absolute", left: -5, top: -5, width: 10, height: 10,
        borderRadius: "50%",
        background: `linear-gradient(140deg, ${C.blue}, ${C.purple})`,
        boxShadow: `0 0 12px ${C.purple}99`,
        opacity: open ? 1 : 0,
        transform: open ? "scale(1)" : "scale(0.4)",
        transition: "opacity 180ms ease, transform 180ms ease",
        pointerEvents: "none",
      }} />
      {nav.map((item, i) => {
        const deg = START + (END - START) * (n === 1 ? 0.5 : i / (n - 1));
        const rad = (deg * Math.PI) / 180;
        const x = Math.cos(rad) * RADIUS;
        const y = Math.sin(rad) * RADIUS;
        const isActive = item.id === activeId;
        const accent = C[item.accent] || C.blue;
        const alert = item.id === "selfserved" && alertCount > 0;
        // Stagger: fan out hub-first, fold back tips-first.
        const delay = open ? i * 26 : (n - 1 - i) * 14;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            title={`${item.num} ${item.label} - ${item.sub}`}
            onMouseEnter={(e) => { e.currentTarget.style.transform = `translate(${x}px, ${y}px) scale(1.12)`; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = `translate(${x}px, ${y}px) scale(1)`; }}
            style={{
              position: "absolute",
              left: -SIZE / 2, top: -SIZE / 2,
              width: SIZE, height: SIZE, borderRadius: "50%",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 1,
              background: isActive
                ? `linear-gradient(135deg, ${accent}33, ${C.surface})`
                : C.surface,
              border: `1px solid ${isActive ? `${accent}66` : C.borderStrong}`,
              boxShadow: isActive
                ? `0 0 18px -4px ${accent}B3, 0 12px 32px -12px rgba(0,0,0,0.85)`
                : `0 12px 32px -12px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.05)`,
              color: isActive ? accent : C.textMuted,
              cursor: "pointer",
              padding: 0,
              pointerEvents: open ? "auto" : "none",
              opacity: open ? 1 : 0,
              transform: open
                ? `translate(${x}px, ${y}px) scale(1)`
                : "translate(0px, 0px) scale(0.3)",
              transition: `transform 300ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, opacity 200ms ease ${delay}ms, box-shadow 160ms ease`,
            }}
          >
            <span style={{ display: "flex" }}>{ModuleIcon[item.id]}</span>
            <span style={{
              fontFamily: FONT_MONO, fontSize: 7.5, letterSpacing: 0.5, lineHeight: 1,
              color: isActive ? accent : C.textFaint,
            }}>
              {item.num}
            </span>
            {alert && (
              <span style={{
                position: "absolute", top: 2, right: 3,
                width: 7, height: 7, borderRadius: "50%",
                background: C.amber, boxShadow: `0 0 6px ${C.amber}`,
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// The daily refresh is a scheduled Claude task that fires on machine wake, so a
// missed or failed morning is possible. When that happens the dashboard would
// otherwise show yesterday's numbers with no visible difference - which is the
// dangerous case, because the numbers still look plausible. This makes it loud.
function StalenessBanner() {
  const stale = staleModules();
  if (stale.length === 0) return null;

  const describe = (m) => {
    if (m.days == null) return `${m.num} ${m.label} (age unknown)`;
    return `${m.num} ${m.label} (${m.days === 1 ? "1 day" : `${m.days} days`} old)`;
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 28px",
      background: C.redBg,
      borderBottom: `1px solid ${C.redBorder}`,
      fontSize: T.micro, color: C.textMid,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
        background: C.red, boxShadow: `0 0 8px ${C.red}99`,
        animation: "ct-pulse 2s ease-in-out infinite",
      }} />
      <span style={{
        fontFamily: FONT_MONO, fontSize: T.label, color: C.red,
        letterSpacing: TRACK.label, flexShrink: 0,
      }}>
        STALE
      </span>
      <span>
        Not refreshed today: {stale.map(describe).join(", ")}. Run the{" "}
        <code style={{ fontFamily: FONT_MONO, fontSize: 11 }}>briefing-daily</code> refresh.
      </span>
    </div>
  );
}

// Gaps a refresh chose to declare instead of inventing a value for. Amber, not
// red: the data is current, one figure just carries a caveat. Separate banner so a
// declared caveat is never mistaken for a stale module.
//
// Collapsed to one line by default. The full list is four dense sentences of
// methodology that do not change from day to day, and printing them above every
// module trained the eye to skip the whole banner strip - including the red one
// underneath it, which is the one that matters. A caveat you have already read
// should cost one line until you ask for it again.
function DataGapsBanner() {
  const gaps = declaredGaps();
  const [open, setOpen] = useState(false);
  if (gaps.length === 0) return null;

  const mods = [...new Set(gaps.map((g) => g.num))].sort();

  return (
    <div style={{
      padding: "9px 28px",
      background: C.amberBg,
      borderBottom: `1px solid ${C.amberBorder}`,
      fontSize: T.micro, color: C.textMid,
    }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "none", border: "none", padding: 0,
          font: `400 ${T.micro}px/1.4 ${FONT_SANS}`, color: C.textMid,
          cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{
          fontFamily: FONT_MONO, fontSize: T.label, color: C.amber,
          letterSpacing: TRACK.label, flexShrink: 0,
        }}>
          GAPS
        </span>
        <span>
          {gaps.length} declared caveat{gaps.length === 1 ? "" : "s"} on{" "}
          <span style={{ fontFamily: FONT_MONO, color: C.textFaint }}>{mods.join(" ")}</span>
          {" - "}
          <span style={{ color: C.textHint }}>{open ? "hide" : "show"}</span>
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 8, paddingLeft: 44, display: "flex", flexDirection: "column", gap: 4 }}>
          {gaps.map((g, i) => (
            <span key={i}>
              <span style={{ fontFamily: FONT_MONO, fontSize: T.label, color: C.textFaint }}>{g.num}</span>{" "}
              {g.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Quick actions deep-link into a module's sub-view via an intent the module
// reads on mount. Navigation-level (real + instant) - no agent work triggered.
const ACTIONS = [
  { kind: "action", id: "calculator", label: "Estimate a cost / quote",   sub: "Calculator", accent: "blue",   intent: { module: "calculator", tab: "cost" } },
  { kind: "action", id: "calculator", label: "Minutes calculator",        sub: "Calculator", accent: "blue",   intent: { module: "calculator", tab: "minutes" } },
];

function CommandPalette({ nav, activeId, onSelect, onClose }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);

  const modules = nav.map((n) => ({ kind: "module", ...n }));
  const all = [...modules, ...ACTIONS];

  const results = (() => {
    const query = q.trim().toLowerCase();
    if (!query) return modules; // default list = modules only, keep it clean
    if (/^\d+$/.test(query)) {
      const byNum = modules.filter((n) => String(parseInt(n.num, 10)).startsWith(query));
      if (byNum.length) return byNum;
    }
    return all.filter((n) =>
      n.label.toLowerCase().includes(query) ||
      (n.sub || "").toLowerCase().includes(query) ||
      (n.num || "").includes(query)
    );
  })();

  useEffect(() => { setIdx(0); }, [q]);

  const pick = (item) => onSelect(item.id, item.intent || null);
  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (results[idx]) pick(results[idx]); }
  };

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(8,5,14,0.72)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh",
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 92vw)", background: C.surface,
          border: `1px solid ${C.borderStrong}`, borderRadius: R.xl,
          boxShadow: SHADOW.pop, overflow: "hidden",
        }}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder="Jump to module - type a name or number..."
          style={{
            width: "100%", boxSizing: "border-box", padding: "15px 18px",
            background: "transparent", border: "none", borderBottom: `1px solid ${C.border}`,
            color: C.text, fontFamily: FONT_SANS, fontSize: T.bodyLg, outline: "none",
          }}
        />
        <div style={{ maxHeight: 360, overflowY: "auto", padding: "6px 0" }}>
          {results.length === 0 && (
            <div style={{ padding: "14px 18px", color: C.textHint, fontSize: T.body }}>No match for "{q}"</div>
          )}
          {results.map((n, i) => {
            const accent = C[n.accent] || C.blue;
            const sel = i === idx;
            const isAction = n.kind === "action";
            const isActive = !isAction && n.id === activeId;
            return (
              <button
                key={(isAction ? "a:" + n.label : "m:" + n.id)}
                onMouseEnter={() => setIdx(i)}
                onClick={() => pick(n)}
                style={{
                  width: "calc(100% - 12px)", display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", margin: "0 6px", textAlign: "left", cursor: "pointer",
                  borderRadius: R.sm,
                  background: sel ? `linear-gradient(135deg, ${accent}24, ${accent}0D)` : "transparent",
                  border: `1px solid ${sel ? `${accent}40` : "transparent"}`,
                }}
              >
                <span style={{ fontFamily: FONT_MONO, fontSize: T.micro, color: sel ? accent : C.textFaint, minWidth: 20 }}>{isAction ? "▸" : n.num}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: T.body, color: C.text, fontWeight: 500 }}>{n.label}</span>
                  <span style={{ fontSize: T.micro, color: C.textFaint, fontFamily: FONT_MONO, marginLeft: 8 }}>{n.sub}</span>
                </span>
                {isActive && <span style={{ fontSize: T.label, fontFamily: FONT_MONO, color: C.emerald }}>current</span>}
              </button>
            );
          })}
        </div>
        <div style={{ padding: "8px 18px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 14, fontFamily: FONT_MONO, fontSize: T.label, color: C.textFaint }}>
          <span>↑↓ navigate</span><span>↵ open</span><span>esc close</span><span style={{ marginLeft: "auto" }}>⌘K</span>
        </div>
      </div>
    </div>
  );
}
