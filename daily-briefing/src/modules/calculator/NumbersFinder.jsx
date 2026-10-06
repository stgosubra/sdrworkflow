import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { C, SHADOW, R, T, TRACK, FONT_SANS, FONT_MONO } from "../../lib/tokens.js";
import {
  buildModel, fold, fits, whyNot, status, score, rankList, rankExc,
  VERDICT, VOICE_META, NEED_LABELS, FAMILY_ORDER, RULE_ICON,
} from "./numbers-logic.js";

// Local cached CSV (refreshed by the daily-briefing routine or manually via
// the Google Drive MCP tool). The sheet requires org auth, so a direct browser
// fetch to Google Sheets won't work - the cache is the primary source.
const CSV_PATH = "/numbers-data.csv";

// Verdict -> semantic colour mapping (uses token palette)
const VC = {
  open:    { fill: C.emerald, bg: C.emeraldBg, bd: C.emeraldBorder },
  docs:    { fill: C.cyan,    bg: C.cyanBg,    bd: C.cyanBorder },
  address: { fill: C.amber,   bg: C.amberBg,   bd: C.amberBorder },
  check:   { fill: C.amber,   bg: C.amberBg,   bd: C.amberBorder },
  local:   { fill: C.red,     bg: C.redBg,     bd: C.redBorder },
};

// ── Shared inline helpers ──────────────────────────────────────────────────
const seg = (opts, value, onChange, small) => (
  <div style={{
    display: "inline-flex", gap: 3, background: C.wellBg,
    border: `1px solid ${C.borderStrong}`, borderRadius: R.pill, padding: 3,
  }}>
    {opts.map(([v, label]) => {
      const on = v === value;
      return (
        <button key={v} onClick={() => onChange(v)} style={{
          font: `${on ? 500 : 400} ${small ? T.label : T.micro}px/1 ${FONT_SANS}`,
          color: on ? C.text : C.textHint,
          background: on ? "rgba(255,255,255,0.07)" : "transparent",
          border: "none", padding: small ? "5px 10px" : "6px 13px",
          borderRadius: R.pill, cursor: "pointer", whiteSpace: "nowrap",
          transition: "background 120ms ease, color 120ms ease",
        }}>{label}</button>
      );
    })}
  </div>
);

const vDot = (key, size = 7) => (
  <span style={{
    width: size, height: size, borderRadius: "50%", flexShrink: 0,
    background: VC[key]?.fill || C.neutral, display: "inline-block",
  }} />
);

const label = (text, style) => (
  <div style={{
    font: `500 ${T.label}px/1 ${FONT_SANS}`, letterSpacing: TRACK.label,
    textTransform: "uppercase", color: C.textHint, ...style,
  }}>{text}</div>
);

// ── Recent searches (localStorage) ─────────────────────────────────────────
const RK = "nf-recent";
const getRecent = () => { try { return JSON.parse(localStorage.getItem(RK) || "[]"); } catch { return []; } };
const pushRecent = (c) => { try { const r = getRecent().filter(x => x !== c); r.unshift(c); localStorage.setItem(RK, JSON.stringify(r.slice(0, 6))); } catch {} };

// ════════════════════════════════════════════════════════════════════════════
// NumbersFinder component
// ════════════════════════════════════════════════════════════════════════════
export default function NumbersFinder() {
  const [model, setModel] = useState(null);
  const [countries, setCountries] = useState([]);
  const [loadState, setLoadState] = useState("idle"); // idle | loading | ok | error
  const [loadError, setLoadError] = useState("");
  const [loadTime, setLoadTime] = useState(null);

  const [current, setCurrent] = useState(null);
  const [entity, setEntity] = useState("unknown");
  const [need, setNeed] = useState("any");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [suggOpen, setSuggOpen] = useState(false);
  const [panelCard, setPanelCard] = useState(null);

  const inputRef = useRef(null);
  const suggRef = useRef(null);

  // ── data loading ─────────────────────────────────────────────────────────
  const loadCSV = useCallback(async (text) => {
    if (text) {
      try {
        const m = buildModel(text);
        setModel(m);
        setCountries([...m.keys()].sort((a, b) => a.localeCompare(b)));
        setLoadState("ok");
        setLoadTime(new Date());
      } catch (e) {
        setLoadState("error");
        setLoadError(e?.layout ? "Columns not found: " + e.missing.join(", ") : String(e?.message || e));
      }
      return;
    }
    setLoadState("loading");
    try {
      const res = await fetch(CSV_PATH);
      if (!res.ok) throw new Error(`No cached data (${res.status}). Use "Paste CSV" or re-run the numbers refresh.`);
      const csv = await res.text();
      const m = buildModel(csv);
      setModel(m);
      setCountries([...m.keys()].sort((a, b) => a.localeCompare(b)));
      setLoadState("ok");
      setLoadTime(new Date());
    } catch (e) {
      setLoadState("error");
      setLoadError(e?.layout ? "Columns not found: " + e.missing.join(", ") : String(e?.message || e));
    }
  }, []);

  useEffect(() => { loadCSV(); }, [loadCSV]);

  // ── search matching ──────────────────────────────────────────────────────
  const matches = useMemo(() => {
    const f = fold(query.trim());
    if (!f || !countries.length) return [];
    const starts = countries.filter(c => fold(c).startsWith(f));
    const contains = countries.filter(c => !fold(c).startsWith(f) && fold(c).includes(f));
    return starts.concat(contains).slice(0, 8);
  }, [query, countries]);

  const pick = (c) => {
    setCurrent(c); setQuery(c); setSuggOpen(false); setEntity("unknown");
    pushRecent(c); inputRef.current?.blur();
  };

  // ── keyboard nav ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && panelCard) { setPanelCard(null); return; }
      if (e.key === "/" && document.activeElement !== inputRef.current && loadState === "ok" && !panelCard) {
        e.preventDefault(); inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [panelCard, loadState]);

  // ── derived ──────────────────────────────────────────────────────────────
  const list = current && model ? (model.get(current) || []) : [];
  const fitList = list.filter(n => fits(n, need));
  const recent = getRecent().filter(c => model?.has(c));

  // ══════════════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="nfinder">
      <style>{CSS}</style>
      <div className="nf-app">
        {/* ── Topbar ─────────────────────────────────────────────────── */}
        <div className="nf-topbar">
          <div className="nf-brand">
            <span className="nf-mark">#</span>
            <span>Numbers Finder</span>
          </div>
          <div className="nf-status">
            <span className="nf-pill">
              <span className={"nf-dot" + (loadState === "ok" ? " live" : "")} />
              {loadState === "loading" ? "Loading..." :
               loadState === "ok" ? `Live \u00B7 ${loadTime?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} \u00B7 ${countries.length} countries` :
               loadState === "error" ? "Error" : "Ready"}
            </span>
            {loadState === "ok" && (
              <button className="nf-btn" onClick={() => loadCSV()}>Refresh</button>
            )}
          </div>
        </div>

        {/* ── Controls ───────────────────────────────────────────────── */}
        <div className="nf-controls">
          <div className="nf-search-row">
            <div className="nf-search-wrap">
              {label("Country")}
              <div style={{ position: "relative", marginTop: 8 }}>
                <input
                  ref={inputRef}
                  className="nf-input"
                  type="text"
                  autoComplete="off"
                  spellCheck="false"
                  placeholder={loadState === "ok" ? "Start typing a country..." : "Loading data..."}
                  disabled={loadState !== "ok"}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSuggOpen(true); setActive(0); }}
                  onFocus={() => { if (query) setSuggOpen(true); }}
                  onBlur={() => setTimeout(() => setSuggOpen(false), 120)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown" && matches.length) { setActive(a => (a + 1) % matches.length); e.preventDefault(); }
                    else if (e.key === "ArrowUp" && matches.length) { setActive(a => (a - 1 + matches.length) % matches.length); e.preventDefault(); }
                    else if (e.key === "Enter" && matches[active]) pick(matches[active]);
                    else if (e.key === "Escape") { setQuery(""); setSuggOpen(false); }
                  }}
                />
                <span className="nf-kbd">/</span>
                {suggOpen && matches.length > 0 && (
                  <div className="nf-sugg" ref={suggRef}>
                    {matches.map((c, i) => (
                      <button key={c} className={"nf-sugg-item" + (i === active ? " on" : "")}
                        onMouseDown={(e) => { e.preventDefault(); pick(c); }}>
                        <span>{c}</span>
                        <span className="nf-sugg-count">{model.get(c).length} types</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              {label("Local entity?")}
              <div style={{ marginTop: 8 }}>
                {seg([["unknown", "Unknown"], ["yes", "Yes"], ["no", "No"]], entity, setEntity)}
              </div>
            </div>
          </div>
          <div className="nf-need-row">
            {label(<>Customer needs to <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, opacity: 0.7 }}>optional</span></>)}
            <div style={{ marginTop: 6 }}>
              {seg([["any", "Any"], ["both", "Call in + out"], ["receive", "Receive calls"], ["make", "Make calls"], ["sms", "Send SMS"]], need, setNeed, true)}
            </div>
          </div>
          {recent.length > 0 && (
            <div className="nf-recent">
              <span style={{ color: C.textHint, fontSize: T.micro }}>Recent</span>
              {recent.map(c => (
                <button key={c} className="nf-recent-btn" onClick={() => pick(c)}>{c}</button>
              ))}
            </div>
          )}
        </div>

        {/* ── Main content ───────────────────────────────────────────── */}
        <div className="nf-main">
          {loadState === "loading" && (
            <div className="nf-skel-wrap">
              {[0,1,2].map(i => <div key={i} className="nf-skel" />)}
            </div>
          )}
          {loadState === "error" && (
            <div className="nf-msg">
              <h3>Could not load the numbers sheet</h3>
              <p>{loadError}</p>
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button className="nf-btn" onClick={() => loadCSV()}>Try again</button>
                <label className="nf-btn" style={{ cursor: "pointer" }}>
                  Paste CSV
                  <input type="file" accept=".csv,text/csv" hidden onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) f.text().then(t => loadCSV(t));
                  }} />
                </label>
              </div>
            </div>
          )}
          {loadState === "ok" && !current && (
            <div className="nf-empty">
              <h3>Which country is the customer asking about?</h3>
              <p>Type a country, then set whether they have a local entity there.</p>
            </div>
          )}
          {loadState === "ok" && current && list.length === 0 && (
            <div className="nf-msg nf-msg-soft">
              <h3>{current}: no number types listed</h3>
              <p>The country is in the sheet but has no options. Check with the numbers team.</p>
            </div>
          )}
          {loadState === "ok" && current && list.length > 0 && (
            <>
              {/* Header */}
              <div className="nf-rh">
                <h1>{current}</h1>
                <div className="nf-legend">
                  {[["open", "Open"], ["docs", "Docs, any country"], ["address", "Local address / check"], ["local", "Local entity"]].map(([k, t]) => (
                    <span key={k} className="nf-legend-item">{vDot(k)}{t}</span>
                  ))}
                </div>
              </div>

              {/* Stats hero */}
              <StatsHero list={list} need={need} />

              {/* Path hero (entity=no) */}
              {entity === "no" && <PathHero list={list} current={current} need={need} onOpen={setPanelCard} />}

              {/* Cards */}
              {entity === "no" ? (
                <EntityNoView list={list} fitList={fitList} need={need} current={current} onOpen={setPanelCard} />
              ) : (
                <>
                  {need !== "any" && (
                    <div style={{ marginBottom: 12 }}>{label(`${fitList.length} of ${list.length} types can ${NEED_LABELS[need]}`)}</div>
                  )}
                  {fitList.length > 0 ? (
                    <div className="nf-grid">
                      {fitList.map((n, i) => <NumCard key={n.type + i} n={n} i={i} entity={entity} current={current} onClick={() => setPanelCard(n)} />)}
                    </div>
                  ) : (
                    <div className="nf-empty">No number type in {current} can {NEED_LABELS[need]}.</div>
                  )}
                </>
              )}

              {/* No-fit strip */}
              {need !== "any" && (() => {
                const bad = list.filter(n => !fits(n, need));
                if (!bad.length) return null;
                return (
                  <div className="nf-nofit">
                    {label("Doesn't fit \"" + NEED_LABELS[need] + "\"")}
                    {bad.map((n, i) => (
                      <button key={i} className="nf-nofit-btn" onClick={() => setPanelCard(n)}>
                        {n.type} <span className="nf-nofit-why">{whyNot(n, need)}</span>
                      </button>
                    ))}
                  </div>
                );
              })()}

              {/* Country rules */}
              <CountryRules list={list} current={current} onOpen={setPanelCard} />
            </>
          )}
        </div>

        <div className="nf-foot">Prices in EUR per number. Click any card for full details.</div>
      </div>

      {/* ── Side panel ───────────────────────────────────────────────── */}
      {panelCard && (
        <>
          <div className="nf-backdrop" onClick={() => setPanelCard(null)} />
          <DetailPanel n={panelCard} current={current} onClose={() => setPanelCard(null)} />
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════════════════

function StatsHero({ list, need }) {
  const noEntity = list.filter(n => status(n) === "ok").length;
  const open = list.filter(n => n.verdict === "open" && !n.unavailable).length;
  const needLocal = list.filter(n => n.verdict === "local").length;
  const twoWay = list.filter(n => n.voice.mode === "both").length;
  const lim = list.filter(n => n.voice.mode !== "both").length;
  return (
    <div className="nf-hero">
      <div className="nf-stats">
        {[
          ["Number types", list.length, null],
          ["Open to anyone", open, "no requirements"],
          ["Without local entity", noEntity, "possible for foreign companies"],
          ["Need local entity", needLocal, list.some(n => n.verdict === "local" && n.gray) ? "some have internal exceptions" : ""],
          ["Two-way calling", twoWay, lim ? `${lim} with restricted voice` : "all types call in + out"],
        ].map(([lbl, val, sub]) => (
          <div key={lbl} className="nf-stat">
            {label(lbl)}
            <div className="nf-stat-v">{val}</div>
            {sub && <div className="nf-stat-s">{sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PathHero({ list, current, need, onOpen }) {
  const fams = FAMILY_ORDER.filter(f => list.some(n => n.family === f));
  return (
    <div className="nf-hero" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
        <h2 style={{ font: `600 ${T.bodyLg + 2}px/1.2 ${FONT_SANS}`, color: C.text, margin: 0 }}>What a customer without a local entity can get</h2>
        <span style={{ font: `400 ${T.body}px/1 ${FONT_SANS}`, color: C.textHint }}>Best option per number type</span>
      </div>
      {fams.map(f => {
        const famAll = list.filter(n => n.family === f);
        const inFam = famAll.filter(n => fits(n, need));
        const best = rankList(inFam)[0];
        const exc = !best && rankExc(inFam)[0];
        const pick = best || exc;
        return (
          <div key={f} className="nf-prow">
            <div style={{ font: `600 ${T.body}px/1 ${FONT_SANS}`, color: pick ? C.text : C.textHint, minWidth: 130 }}>{f}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {pick ? (
                <>
                  <div style={{ font: `600 ${T.body}px/1.3 ${FONT_SANS}`, color: C.text }}>
                    {pick.type}{pick.format && <span style={{ color: C.textHint }}> - {pick.format}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, font: `400 ${T.micro}px/1 ${FONT_SANS}` }}>
                    {vDot(pick.verdict, 6)}
                    <span style={{ color: VC[pick.verdict].fill }}>
                      {exc ? "Exception possible - confirm with numbers team" : VERDICT[pick.verdict].short}
                      {pick.verdict === "address" && ` in ${current}`}
                    </span>
                  </div>
                </>
              ) : (
                <span style={{ font: `400 ${T.body}px/1 ${FONT_SANS}`, color: C.textHint }}>
                  {!inFam.length ? `No option can ${NEED_LABELS[need]}` : "Not possible without a local entity"}
                </span>
              )}
            </div>
            <div style={{ font: `500 ${T.body}px/1 ${FONT_MONO}`, color: C.textMuted, whiteSpace: "nowrap" }}>
              {pick ? (pick.monthly || "-") + "/mo" : ""}
            </div>
            {pick && <button className="nf-btn" onClick={() => onOpen(pick)}>Details</button>}
          </div>
        );
      })}
    </div>
  );
}

function EntityNoView({ list, fitList, need, current, onOpen }) {
  const ok = rankList(fitList);
  const exc = rankExc(fitList);
  const none = fitList.filter(n => status(n) === "none");
  let i = 0;
  return (
    <>
      {ok.length > 0 && (
        <>
          {label("Possible for this customer - easiest first", { margin: "18px 0 10px" })}
          <div className="nf-grid">{ok.map(n => <NumCard key={n.type + i} n={n} i={i++} entity="no" current={current} best={i === 1} onClick={() => onOpen(n)} />)}</div>
        </>
      )}
      {exc.length > 0 && (
        <>
          {label("Only with an exception - confirm with numbers team", { margin: "18px 0 10px" })}
          <div className="nf-grid">{exc.map(n => <NumCard key={n.type + i} n={n} i={i++} entity="no" current={current} onClick={() => onOpen(n)} />)}</div>
        </>
      )}
      {!ok.length && !exc.length && need !== "any" && (
        <div style={{ margin: "18px 0 10px" }}>{label(`Nothing here can ${NEED_LABELS[need]} for a customer without a local entity`)}</div>
      )}
      {none.length > 0 && (
        <div className="nf-nofit" style={{ marginTop: 18 }}>
          {label("Not possible for this customer")}
          {none.map((n, i) => <button key={i} className="nf-nofit-btn" onClick={() => onOpen(n)}>{n.type}</button>)}
        </div>
      )}
    </>
  );
}

function NumCard({ n, i, entity, current, best, onClick }) {
  const vc = VC[n.verdict];
  const vm = VOICE_META[n.voice.mode];
  return (
    <button className={"nf-card" + (best ? " best" : "")} onClick={onClick}
      style={{ animationDelay: `${Math.min(i * 40, 400)}ms`, borderLeftColor: vc.fill }}>
      {/* Header */}
      <div className="nf-ch">
        <div>
          <h3>{n.type}</h3>
          {n.format && <div className="nf-fmt"><span>Format</span>{n.format}</div>}
        </div>
        <div className="nf-badges">
          {best && <span className="nf-badge blue">Best fit</span>}
          {n.unavailable ? <span className="nf-badge bad">Unavailable</span> : n.beta ? <span className="nf-badge">Beta</span> : null}
        </div>
      </div>

      {/* Verdict */}
      <span className="nf-verdict" style={{ color: vc.fill, background: vc.bg, borderColor: vc.bd }}>
        {vDot(n.verdict, 6)}{VERDICT[n.verdict].label}
      </span>

      {/* Notes */}
      {n.unavailable && <div className="nf-note bad">Do not promise - currently unavailable</div>}
      {!n.unavailable && entity === "no" && n.verdict === "address" && <div className="nf-note">Works without a local entity - customer needs an address in {current}</div>}
      {!n.unavailable && entity === "no" && n.verdict === "check" && <div className="nf-note">May not work without a local entity - read the full requirements</div>}
      {!n.unavailable && entity === "no" && status(n) === "exception" && <div className="nf-note">Exception possible - confirm with numbers team</div>}

      {/* Voice */}
      <div className={"nf-voice " + n.voice.mode}>
        <span className="nf-vi">{vm[0]}</span>
        <span>{vm[1]}</span>
        {vm[2] && <small>- {vm[2]}</small>}
      </div>
      {n.voice.flags.length > 0 && (
        <div className="nf-vflags">
          {n.voice.flags.map((f, fi) => (
            <span key={fi} className={"nf-chip lim" + (f.level === "bad" ? " bad" : "")}>{f.text}</span>
          ))}
        </div>
      )}

      {/* Rules */}
      {n.rules.length > 0 && (
        <div className="nf-rules">
          {n.rules.map((r, ri) => (
            <div key={ri} className={"nf-rule " + r.level}>
              <span className="nf-rule-ico">{RULE_ICON[r.level]}</span>{r.label}
            </div>
          ))}
        </div>
      )}

      {/* Tags */}
      {n.tags.length > 0 ? (
        <div>
          {label("Customer must provide", { marginBottom: 6 })}
          <div className="nf-chips">{n.tags.map((t, ti) => <span key={ti} className="nf-chip">{t}</span>)}</div>
        </div>
      ) : (
        <div style={{ font: `400 ${T.body}px/1 ${FONT_SANS}`, color: C.emerald }}>Nothing required from the customer</div>
      )}

      {/* Caps */}
      <div className="nf-caps">
        {[["SMS", n.sms], ["WhatsApp", n.whatsapp], ["Trial", n.trial], ["Self-serve", n.self]].map(([lbl, val]) => {
          if (val == null) return null;
          const y = val === true || val === "Yes";
          const m = typeof val === "string" && !y && val !== "No";
          return (
            <span key={lbl} className={"nf-cap " + (y ? "y" : m ? "m" : "n")}>
              <i>{y ? "\u2713" : m ? "~" : "\u2013"}</i>{m ? `${lbl}: ${val}` : lbl}
            </span>
          );
        })}
      </div>

      {/* Pricing row */}
      <div className="nf-nums">
        <div>{label("Monthly")}<b>{n.monthly || "n/a"}</b></div>
        <div>{label("Setup")}<b>{n.activation == null ? "n/a" : n.activation}</b></div>
        <div>{label("Lead time")}<b className={n.wait.fast ? "fast" : ""}>{n.wait.fast ? "Now" : n.wait.text.replace(" business days", "d")}</b></div>
      </div>
    </button>
  );
}

function CountryRules({ list, current, onOpen }) {
  const camp = list.filter(n => n.rules.some(r => r.kind === "campaign"));
  const groups = new Map();
  list.forEach(n => n.rules.filter(r => r.kind !== "campaign").forEach(r => {
    const k = r.label; if (!groups.has(k)) groups.set(k, { r, types: [] }); groups.get(k).types.push(n);
  }));
  if (!camp.length && !groups.size) return null;
  const order = { bad: 0, warn: 1, ok: 2, info: 3 };
  return (
    <div className="nf-country-rules">
      <h2 style={{ font: `600 ${T.body + 1}px/1 ${FONT_SANS}`, color: C.text, marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
        Country rules - {current}
      </h2>
      {camp.map((n, i) => {
        const r = n.rules.find(x => x.kind === "campaign");
        return (
          <div key={i} className="nf-crow info">
            <span className="nf-crow-ico">{RULE_ICON.info}</span>
            <div className="nf-crow-body">
              <b>Campaign calling</b>
              <span className="nf-crow-sub">{r.label.replace(/^Designated range: /, "")} - {n.type}</span>
            </div>
            <button className="nf-btn" onClick={() => onOpen(n)}>Details</button>
          </div>
        );
      })}
      {[...groups.values()].sort((a, b) => order[a.r.level] - order[b.r.level]).map((g, i) => (
        <div key={i} className={"nf-crow " + g.r.level}>
          <span className="nf-crow-ico">{RULE_ICON[g.r.level]}</span>
          <div className="nf-crow-body">
            <b>{g.r.label}</b>
            <span className="nf-crow-sub">{g.types.map(n => n.type).join(", ")}</span>
          </div>
          <button className="nf-btn" onClick={() => onOpen(g.types[0])}>Details</button>
        </div>
      ))}
    </div>
  );
}

function DetailPanel({ n, current, onClose }) {
  const [carrierShown, setCarrierShown] = useState(false);
  const [grayShown, setGrayShown] = useState(false);
  const vc = VC[n.verdict];
  const vm = VOICE_META[n.voice.mode];
  return (
    <aside className="nf-panel">
      <div className="nf-ph">
        <div>
          {label(current + " - " + n.family)}
          <h2 style={{ font: `600 ${T.title - 2}px/1.2 ${FONT_SANS}`, color: C.text, marginTop: 6 }}>{n.type}</h2>
          <span className="nf-verdict" style={{ color: vc.fill, background: vc.bg, borderColor: vc.bd, marginTop: 10 }}>
            {vDot(n.verdict, 6)}{VERDICT[n.verdict].label}
          </span>
        </div>
        <button className="nf-close" onClick={onClose}>\u00D7</button>
      </div>
      <div className="nf-pb">
        {/* Key-value grid */}
        <div className="nf-kv">
          {n.format && <><div>{label("Format")}<b className="mono">{n.format}</b></div></>}
          <div>{label("Monthly")}<b className="mono">{n.monthly || "Not listed"}</b></div>
          <div>{label("Setup fee")}<b className="mono">{n.activation == null ? "Not listed" : n.activation}</b></div>
          <div>{label("Lead time")}<b>{n.wait.text}</b></div>
          <div>{label("Free trial")}<b>{n.trial || "Not listed"}</b></div>
          <div>{label("SMS")}<b>{n.sms ? "Yes" : "No"}</b></div>
          <div>{label("WhatsApp")}<b>{n.whatsapp ? "Yes" : "No"}</b></div>
          <div>{label("Self-service")}<b>{n.self || "Not listed"}</b></div>
          <div>{label("Individuals")}<b>{n.individual || "n/a"}</b></div>
          <div style={{ gridColumn: "1 / -1" }}>
            {label(<><span style={{ color: C.amber }}>Carrier - internal</span></>)}
            <button className={"nf-reveal" + (carrierShown ? " on" : "")} disabled={!n.carrier}
              onClick={() => setCarrierShown(v => !v)}>
              {!n.carrier ? "Not listed" : carrierShown ? n.carrier : "Click to reveal"}
            </button>
          </div>
        </div>

        {/* Voice */}
        <div>
          {label("Voice")}
          <div className={"nf-voice " + n.voice.mode} style={{ marginTop: 8 }}>
            <span className="nf-vi">{vm[0]}</span><span>{vm[1]}</span>
            {vm[2] && <small>- {vm[2]}</small>}
          </div>
          {n.voice.flags.length > 0 && (
            <div className="nf-chips" style={{ marginTop: 8 }}>
              {n.voice.flags.map((f, i) => <span key={i} className={"nf-chip lim" + (f.level === "bad" ? " bad" : "")}>{f.text}</span>)}
            </div>
          )}
        </div>

        {/* Rules */}
        {n.rules.length > 0 && (
          <div>
            {label("Usage rules")}
            <div className="nf-panel-rules">
              {n.rules.map((r, i) => (
                <div key={i} className={r.level}>
                  <b>{RULE_ICON[r.level]} {r.label}</b>
                  {r.quote && <q>{r.quote}</q>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full text sections */}
        <div>{label("Requirements (sheet text)")}<div className="nf-txt">{n.compliance || "No requirements"}</div></div>
        {n.calling && <div>{label("Calling")}<div className="nf-txt">{n.calling}</div></div>}
        {n.messaging && <div>{label("Messaging")}<div className="nf-txt">{n.messaging}</div></div>}

        {/* Gray zone (internal) */}
        {n.gray && (
          <div className="nf-internal">
            <button onClick={() => setGrayShown(v => !v)}>Internal workaround - click to reveal (not for screen-share)</button>
            {grayShown && <div className="nf-txt" style={{ borderColor: C.amberBorder, marginTop: 8 }}>{n.gray}</div>}
          </div>
        )}
      </div>
    </aside>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Scoped CSS (same pattern as MinutesCalc)
// ════════════════════════════════════════════════════════════════════════════
const CSS = `
.nfinder{
  --bg:${C.bg};--surf:${C.surface};--surfAlt:${C.surfaceAlt};
  --well:${C.wellBg};--bdr:${C.border};--bdrS:${C.borderStrong};
  --txt:${C.text};--mid:${C.textMid};--muted:${C.textMuted};--hint:${C.textHint};--faint:${C.textFaint};
  height:100%;overflow-y:auto;background:transparent;color:var(--txt);
  font-family:${FONT_SANS};display:flex;justify-content:center;padding:24px 16px;
}
.nfinder *{box-sizing:border-box}
.nf-app{width:100%;max-width:1240px}

/* topbar */
.nf-topbar{display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--bdr)}
.nf-brand{display:flex;align-items:center;gap:10px;font:700 ${T.bodyLg}px/1 ${FONT_SANS};color:var(--txt);letter-spacing:${TRACK.tight}}
.nf-mark{width:22px;height:22px;border-radius:6px;background:${C.blue};display:grid;place-items:center;font-size:12px;color:#fff}
.nf-status{margin-left:auto;display:flex;align-items:center;gap:8px;font-size:${T.micro}px;color:var(--hint)}
.nf-pill{display:inline-flex;align-items:center;gap:7px;padding:4px 10px;border:1px solid var(--bdr);border-radius:${R.pill}px;background:var(--surf)}
.nf-dot{width:7px;height:7px;border-radius:50%;background:var(--hint)}
.nf-dot.live{background:${C.emerald};box-shadow:0 0 0 3px ${C.emeraldBg}}
.nf-btn{border:1px solid var(--bdr);background:transparent;color:var(--muted);border-radius:${R.sm}px;padding:6px 12px;font:500 ${T.micro}px/1 ${FONT_SANS};cursor:pointer;transition:border-color .15s,color .15s;white-space:nowrap}
.nf-btn:hover{border-color:${C.blue};color:var(--txt)}
.nf-btn:active{transform:scale(.98)}

/* controls */
.nf-controls{padding:20px 0}
.nf-search-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:end}
@media(max-width:780px){.nf-search-row{grid-template-columns:1fr}}
.nf-input{width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:${R.lg}px;padding:14px 44px 14px 16px;color:var(--txt);font:600 ${T.title - 2}px/1.2 ${FONT_SANS};letter-spacing:${TRACK.tight};outline:none;transition:border-color .15s,box-shadow .15s}
.nf-input::placeholder{color:var(--hint);font-weight:500}
.nf-input:focus{border-color:${C.blue};box-shadow:0 0 0 3px ${C.blueBg}}
.nf-input:disabled{opacity:.5;cursor:not-allowed}
.nf-kbd{position:absolute;right:12px;top:50%;transform:translateY(-50%);font:500 ${T.label}px ${FONT_MONO};color:var(--hint);border:1px solid var(--bdr);border-radius:5px;padding:2px 7px;pointer-events:none}
.nf-sugg{position:absolute;z-index:15;left:0;right:0;top:calc(100% + 6px);background:var(--surfAlt);border:1px solid var(--bdrS);border-radius:${R.lg}px;padding:4px;box-shadow:${SHADOW.pop}}
.nf-sugg-item{display:flex;justify-content:space-between;align-items:center;width:100%;text-align:left;border:0;background:none;padding:9px 12px;border-radius:${R.sm}px;font:400 ${T.body}px/1 ${FONT_SANS};color:var(--muted);cursor:pointer}
.nf-sugg-item:hover,.nf-sugg-item.on{background:${C.blueBg};color:var(--txt)}
.nf-sugg-count{font:400 ${T.micro}px ${FONT_MONO};color:var(--hint)}
.nf-need-row{margin-top:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.nf-recent{margin-top:12px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:${T.micro}px;color:var(--hint);min-height:24px}
.nf-recent-btn{border:1px solid var(--bdr);background:transparent;border-radius:${R.pill}px;padding:3px 10px;font:400 ${T.micro}px/1 ${FONT_SANS};color:var(--muted);cursor:pointer;transition:border-color .15s}
.nf-recent-btn:hover{border-color:${C.blue}}

/* main */
.nf-main{padding:10px 0 20px}
.nf-rh{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:16px}
.nf-rh h1{font:700 ${T.hero}px/1 ${FONT_SANS};letter-spacing:${TRACK.tighter};color:var(--txt);margin:0}
.nf-legend{margin-left:auto;display:flex;gap:14px;flex-wrap:wrap}
.nf-legend-item{display:inline-flex;align-items:center;gap:6px;font:400 ${T.micro}px/1 ${FONT_SANS};color:var(--hint)}

/* hero */
.nf-hero{background:${C.cardBg};border:1px solid var(--bdr);border-radius:${R.xl}px;padding:20px 24px;box-shadow:${SHADOW.card};margin-bottom:16px}
.nf-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
@media(max-width:900px){.nf-stats{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:560px){.nf-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
.nf-stat-v{font:800 ${T.hero}px/1.1 ${FONT_SANS};letter-spacing:${TRACK.tighter};color:var(--txt);margin-top:6px}
.nf-stat-s{font:400 ${T.micro}px/1.3 ${FONT_SANS};color:var(--hint);margin-top:4px}

/* path rows */
.nf-prow{display:flex;gap:14px;align-items:center;padding:12px 0;border-top:1px solid ${C.divider}}
.nf-prow:first-of-type{border-top:0}

/* cards */
.nf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px}
.nf-card{position:relative;background:${C.cardBg};border:1px solid var(--bdr);border-left:3px solid var(--bdr);border-radius:${R.xl}px;padding:18px 20px;display:flex;flex-direction:column;gap:12px;text-align:left;cursor:pointer;opacity:0;animation:nfIn .4s ease forwards;transition:border-color .15s,background .15s,transform .2s;box-shadow:${SHADOW.card};font-family:${FONT_SANS}}
.nf-card:hover{border-color:${C.borderHover};background:${C.cardBgHover};transform:translateY(-1px);box-shadow:${SHADOW.cardHover}}
.nf-card.best{border-color:${C.blueBorder}}
@keyframes nfIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.nf-ch{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.nf-ch h3{font:600 ${T.bodyLg}px/1.3 ${FONT_SANS};color:var(--txt);margin:0;letter-spacing:${TRACK.tight}}
.nf-badges{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.nf-badge{font:600 ${T.label}px/1 ${FONT_SANS};padding:3px 8px;border-radius:6px;border:1px solid var(--bdr);background:var(--surfAlt);color:var(--muted);white-space:nowrap}
.nf-badge.blue{background:${C.blueBg};color:${C.blue};border-color:${C.blueBorder}}
.nf-badge.bad{background:${C.redBg};color:${C.red};border-color:${C.redBorder}}
.nf-verdict{display:inline-flex;align-items:center;gap:7px;align-self:flex-start;font:600 ${T.body}px/1 ${FONT_SANS};padding:5px 10px;border-radius:${R.pill}px;border:1px solid}
.nf-note{font:500 ${T.micro}px/1.4 ${FONT_SANS};color:${C.amber};background:${C.amberBg};border:1px solid ${C.amberBorder};border-radius:${R.sm}px;padding:7px 10px}
.nf-note.bad{color:${C.red};background:${C.redBg};border-color:${C.redBorder}}
.nf-chips{display:flex;flex-wrap:wrap;gap:6px}
.nf-chip{font:400 ${T.micro}px/1 ${FONT_SANS};padding:3px 9px;border-radius:${R.pill}px;border:1px solid var(--bdr);color:var(--muted)}
.nf-chip.lim{color:${C.amber};border-color:${C.amberBorder}}
.nf-chip.lim.bad{color:${C.red};border-color:${C.redBorder}}

/* voice */
.nf-voice{display:flex;flex-wrap:wrap;align-items:center;column-gap:8px;row-gap:2px;font:600 ${T.body}px/1 ${FONT_SANS};border-radius:${R.sm}px;padding:8px 10px;border:1px solid ${C.divider};color:var(--muted)}
.nf-voice.both{border-color:transparent;padding:0;font-weight:500}
.nf-voice.both .nf-vi{color:${C.emerald}}
.nf-voice.inbound,.nf-voice.outbound,.nf-voice.unknown{color:${C.amber};background:${C.amberBg};border-color:${C.amberBorder}}
.nf-voice.none{color:${C.red};background:${C.redBg};border-color:${C.redBorder}}
.nf-voice small{font-weight:500;opacity:.85;white-space:nowrap}
.nf-vi{font:600 14px ${FONT_MONO};width:18px;text-align:center}
.nf-vflags{display:flex;flex-wrap:wrap;gap:6px;margin-top:-4px}

/* rules */
.nf-rules{display:flex;flex-direction:column;gap:5px}
.nf-rule{display:flex;gap:6px;align-items:flex-start;font:600 ${T.micro}px/1.35 ${FONT_SANS}}
.nf-rule-ico{flex:none;width:16px;text-align:center}
.nf-rule.info{color:${C.blue}}.nf-rule.bad{color:${C.red}}.nf-rule.warn{color:${C.amber}}.nf-rule.ok{color:${C.emerald}}

/* caps */
.nf-caps{display:flex;gap:12px;flex-wrap:wrap;font-size:${T.micro}px}
.nf-cap{display:inline-flex;align-items:center;gap:5px;color:var(--muted)}
.nf-cap i{font-style:normal;font-weight:700;width:14px;text-align:center}
.nf-cap.y i{color:${C.emerald}}.nf-cap.n{color:var(--hint)}.nf-cap.n i{color:var(--hint)}.nf-cap.m i{color:${C.amber}}

/* nums */
.nf-nums{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding-top:12px;border-top:1px solid ${C.divider};margin-top:auto}
.nf-nums b{display:block;font:500 ${T.bodyLg}px ${FONT_MONO};color:var(--txt);margin-top:2px}
.nf-nums b.fast{color:${C.emerald}}

/* fmt */
.nf-fmt{display:inline-flex;align-items:center;gap:6px;font:500 ${T.micro}px ${FONT_MONO};color:var(--txt);background:var(--bg);border:1px solid var(--bdr);border-radius:6px;padding:2px 8px;margin-top:4px}
.nf-fmt span{font:600 ${T.label}px ${FONT_SANS};letter-spacing:.08em;text-transform:uppercase;color:var(--hint)}

/* nofit */
.nf-nofit{margin-top:14px;background:transparent;border:1px dashed var(--bdr);border-radius:${R.lg}px;padding:12px 18px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.nf-nofit-btn{border:1px solid ${C.redBorder};background:${C.redBg};color:${C.red};border-radius:${R.pill}px;padding:4px 11px;font:400 ${T.micro}px/1 ${FONT_SANS};cursor:pointer;transition:border-color .15s}
.nf-nofit-btn:hover{border-color:${C.red}}
.nf-nofit-why{font-size:${T.label}px;opacity:.75;margin-left:4px}

/* country rules */
.nf-country-rules{background:${C.cardBg};border:1px solid var(--bdr);border-left:3px solid ${C.blue};border-radius:${R.xl}px;padding:16px 20px;margin-top:20px;box-shadow:${SHADOW.card}}
.nf-crow{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 0;border-top:1px solid ${C.divider}}
.nf-crow:first-of-type{border-top:0}
.nf-crow-ico{text-align:center}
.nf-crow-body b{display:block;font:600 ${T.body}px/1 ${FONT_SANS};color:var(--txt)}
.nf-crow-sub{display:block;font:400 ${T.micro}px/1.3 ${FONT_SANS};color:var(--muted);margin-top:2px}
.nf-crow.info b{color:${C.blue}}.nf-crow.bad b{color:${C.red}}.nf-crow.warn b{color:${C.amber}}.nf-crow.ok b{color:${C.emerald}}

/* states */
.nf-empty{margin-top:40px;border:1px dashed var(--bdr);border-radius:${R.xl}px;padding:48px 24px;text-align:center;color:var(--hint)}
.nf-empty h3{font:600 ${T.bodyLg + 2}px/1 ${FONT_SANS};color:var(--muted);margin:0 0 6px}
.nf-empty p{margin:0;font:400 ${T.body}px/1.4 ${FONT_SANS}}
.nf-msg{margin-top:28px;background:var(--surf);border:1px solid ${C.redBorder};border-radius:${R.lg}px;padding:24px 26px}
.nf-msg.nf-msg-soft{border-color:var(--bdr)}
.nf-msg h3{font:600 ${T.bodyLg + 2}px/1 ${FONT_SANS};color:var(--txt);margin:0 0 6px}
.nf-msg p{font:400 ${T.body}px/1.4 ${FONT_SANS};color:var(--muted);margin:0}
.nf-skel-wrap{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px;margin-top:36px}
.nf-skel{height:230px;border-radius:${R.lg}px;background:linear-gradient(90deg,var(--surf) 0%,var(--surfAlt) 50%,var(--surf) 100%);background-size:200% 100%;animation:nfSh 1.2s infinite linear}
@keyframes nfSh{to{background-position:-200% 0}}
.nf-foot{margin-top:40px;font:400 ${T.micro}px/1 ${FONT_SANS};color:var(--hint)}

/* side panel */
.nf-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:30;animation:nfFadeIn .2s ease}
@keyframes nfFadeIn{from{opacity:0}to{opacity:1}}
.nf-panel{position:fixed;top:0;right:0;bottom:0;width:min(460px,100vw);background:var(--surf);border-left:1px solid var(--bdr);z-index:31;display:flex;flex-direction:column;animation:nfSlideIn .25s cubic-bezier(.4,0,.2,1)}
@keyframes nfSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
.nf-ph{padding:20px 24px 16px;border-bottom:1px solid var(--bdr);display:flex;gap:12px;align-items:flex-start}
.nf-close{margin-left:auto;border:1px solid var(--bdr);background:transparent;width:32px;height:32px;border-radius:${R.sm}px;font-size:18px;line-height:1;color:var(--muted);flex:none;cursor:pointer;transition:border-color .15s}
.nf-close:hover{border-color:${C.blue}}
.nf-pb{padding:20px 24px 32px;overflow-y:auto;display:flex;flex-direction:column;gap:20px;flex:1;min-height:0}
.nf-pb>*{flex:none}

/* kv grid */
.nf-kv{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:${C.divider};border:1px solid ${C.divider};border-radius:${R.md}px;overflow:hidden}
.nf-kv>div{background:var(--surf);padding:10px 12px}
.nf-kv b{display:block;color:var(--txt);font-weight:500;margin-top:2px}
.nf-kv b.mono{font-family:${FONT_MONO}}
.nf-reveal{display:block;margin-top:4px;border:1px dashed ${C.amberBorder};background:${C.amberBg};color:${C.amber};border-radius:6px;padding:5px 10px;font:500 ${T.body}px ${FONT_SANS};text-align:left;width:100%;cursor:pointer;transition:border-color .15s}
.nf-reveal:hover:not(:disabled){border-color:${C.amber}}
.nf-reveal.on{border-style:solid;font-family:${FONT_MONO};color:var(--txt)}
.nf-reveal:disabled{cursor:default;opacity:.6;border-color:var(--bdr);background:transparent;color:var(--hint)}
.nf-txt{white-space:pre-wrap;word-break:break-word;color:var(--muted);background:var(--bg);border:1px solid ${C.divider};border-radius:${R.md}px;padding:12px 14px;margin-top:8px;font:400 ${T.body}px/1.5 ${FONT_SANS}}
.nf-panel-rules{display:flex;flex-direction:column;gap:10px;margin-top:8px}
.nf-panel-rules>div{border-left:2px solid var(--bdr);padding-left:10px}
.nf-panel-rules b{display:block;font:600 ${T.body}px/1 ${FONT_SANS};margin-bottom:2px}
.nf-panel-rules .info b{color:${C.blue}}.nf-panel-rules .bad b{color:${C.red}}.nf-panel-rules .warn b{color:${C.amber}}.nf-panel-rules .ok b{color:${C.emerald}}
.nf-panel-rules q{quotes:none;color:var(--muted);font:400 ${T.body}px/1.4 ${FONT_SANS}}
.nf-internal{border:1px solid ${C.amberBorder};border-radius:${R.md}px;padding:12px 14px}
.nf-internal button{border:0;background:none;padding:0;text-align:left;width:100%;color:${C.amber};font:600 ${T.body}px/1 ${FONT_SANS};cursor:pointer}
`;
