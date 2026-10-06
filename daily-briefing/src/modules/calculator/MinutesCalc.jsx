import { useState, useMemo } from "react";
import { C, SHADOW } from "../../lib/tokens.js";

// Module 03 - CloudTalk Minutes Calculator.
// Ported from the standalone HTML/vanilla-JS abacus tool into a React module.
// Self-contained blue palette (scoped under .mcalc) - this palette is the
// reference that module 02 (Pre-Call SE) is also reskinned to match.

const DAYS = { D: 1, W: 5, M: 22, A: 264 };

const fmt = (n) =>
  n >= 1000 ? Math.round(n).toLocaleString() : n >= 10 ? Math.round(n) : parseFloat(n.toFixed(1));
const fmtH = (n) => parseFloat(n.toFixed(2));

const PERIODS = ["D", "W", "M", "A"];

export default function MinutesCalc() {
  const [users, setUsers] = useState("");
  const [cPd, setCPd] = useState("D");
  const [isTeamTotal, setIsTeamTotal] = useState(false);
  const [dir, setDir] = useState("inbound");
  const [callsIb, setCallsIb] = useState("");
  const [callsOb, setCallsOb] = useState("");
  const [mPd, setMPd] = useState("D");
  const [totalMins, setTotalMins] = useState("");
  const [avgDur, setAvgDur] = useState("");
  const [pickup, setPickup] = useState("");

  const reset = () => {
    setUsers(""); setCPd("D"); setIsTeamTotal(false); setDir("inbound");
    setCallsIb(""); setCallsOb(""); setMPd("D"); setTotalMins("");
    setAvgDur(""); setPickup("");
  };

  const r = useMemo(() => {
    const usersN = parseFloat(users) || 0;
    const ib = parseFloat(callsIb) || 0;
    const ob = parseFloat(callsOb) || 0;
    const tmRaw = parseFloat(totalMins);
    const avgD = parseFloat(avgDur) || 3;

    let ibD = 0, obD = 0;
    if (dir === "inbound") ibD = ib / DAYS[cPd];
    else if (dir === "outbound") obD = ob / DAYS[cPd];
    else { ibD = ib / DAYS[cPd]; obD = ob / DAYS[cPd]; }

    if (!isTeamTotal && usersN > 0) { ibD *= usersN; obD *= usersN; }
    const totalD = ibD + obD;

    let mD = 0;
    if (!isNaN(tmRaw) && tmRaw > 0) mD = tmRaw / DAYS[mPd];
    else if (totalD > 0) mD = totalD * avgD;

    const show = usersN > 0 && (mD > 0 || totalD > 0);
    if (!show) return { show: false };

    const puD = mD / usersN;
    const puW = puD * DAYS.W;
    const puM = puD * DAYS.M;
    const puA = puD * DAYS.A;
    const ibMinsM = (usersN > 0 ? (ibD * avgD) / usersN : 0) * DAYS.M;
    const obMinsM = (usersN > 0 ? (obD * avgD) / usersN : 0) * DAYS.M;

    const rows = [];
    if (dir === "inbound" || dir === "both") rows.push(["Inbound calls / day (total)", fmt(ibD)]);
    if (dir === "outbound" || dir === "both") rows.push(["Outbound calls / day (total)", fmt(obD)]);
    rows.push(["Total calls / day", fmt(totalD)]);
    rows.push(["Avg duration applied", fmtH(avgD) + " min"]);
    rows.push(["Total minutes / day", fmt(mD) + " min"]);
    rows.push(["Calls per user / day", fmt(totalD / usersN)]);
    rows.push(["Calls per user / month", fmt((totalD / usersN) * DAYS.M)]);
    if (dir === "inbound" || dir === "both") rows.push(["Inbound min / user / month", fmt(ibMinsM) + " min"]);
    if (dir === "outbound" || dir === "both") rows.push(["Outbound min / user / month", fmt(obMinsM) + " min"]);
    rows.push(["Annual minutes / user", fmt(puA) + " min"]);
    rows.push(["Annual hours / user", fmtH(puA / 60) + " h"]);

    const pk = parseFloat(pickup);
    const pickupShow = !isNaN(pk) && pk > 0 && pk <= 100;

    return {
      show: true, puD, puW, puM, puA, rows,
      pickupShow, pk, effectiveMins: pickupShow ? puM * (pk / 100) : 0,
    };
  }, [users, cPd, isTeamTotal, dir, callsIb, callsOb, mPd, totalMins, avgDur, pickup]);

  const inputStyle = "g-input";

  return (
    <div className="mcalc">
      <style>{CSS}</style>
      <div className="app">
        {/* TOPBAR */}
        <div className="topbar">
          <div className="logo-wrap">
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="50" fill="#1347ff" />
              <path d="M50 15C30.1 15 14 31.1 14 51C14 59.8 17.1 67.9 22.3 74.2L16 87L30.2 81.5C36.2 85.2 43.4 87.4 51 87.4C70.9 87.4 87 71.3 87 51.4C87 31.5 70.9 15 51 15H50Z" fill="white" />
              <path d="M50 24C34.5 24 22 36.5 22 52C22 58.8 24.4 65 28.5 69.8L24 80L35.2 75.8C40 78.8 45.8 80.5 52 80.5C67.5 80.5 80 68 80 52.5C80 37 67.5 24 52 24H50Z" fill="#1347ff" />
              <circle cx="37" cy="52" r="4.5" fill="white" />
              <circle cx="50" cy="52" r="4.5" fill="white" />
              <circle cx="63" cy="52" r="4.5" fill="white" />
            </svg>
          </div>
          <div className="topbar-info">
            <div className="t-title">CloudTalk · minutes calculator</div>
            <div className="t-sub">Per-user calling time estimator</div>
          </div>
          <div className="live-pip"><div className="live-dot" />live</div>
          <button type="button" className="clear-btn" onClick={reset} title="Reset all inputs">Clear</button>
          <div className="badge">BETA</div>
        </div>

        {/* BODY */}
        <div className="body">
          {/* LEFT: INPUTS */}
          <div className="left">
            <div className="fblock">
              <div className="slabel">Agents</div>
              <div className="flabel">Number of users</div>
              <input className={inputStyle} type="number" min="1" placeholder="e.g. 10"
                value={users} onChange={(e) => setUsers(e.target.value)} />
            </div>

            <div className="divline" />

            <div className="fblock">
              <div className="slabel">Calls volume</div>
              <div className="flabel">Period</div>
              <div className="seg">
                {PERIODS.map((p) => (
                  <button key={p} type="button" className={`seg-btn${cPd === p ? " on" : ""}`}
                    onClick={() => setCPd(p)}>{p}</button>
                ))}
              </div>
              <button type="button" onClick={() => setIsTeamTotal((v) => !v)}
                style={{ marginTop: -4, marginBottom: 10, display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                <div style={{
                  width: 14, height: 14, borderRadius: 4, border: "1px solid var(--bdr3)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10,
                  color: "var(--acc2)", flexShrink: 0, transition: "all .15s",
                  background: isTeamTotal ? "var(--acc3)" : "none",
                }}>{isTeamTotal ? "✓" : ""}</div>
                <span style={{ fontSize: 10, color: isTeamTotal ? "var(--acc2)" : "var(--muted2)", transition: "color .15s" }}>
                  across the team
                </span>
              </button>
              <div className="flabel">Direction</div>
              <div className="dir-row">
                {[["inbound", "Inbound"], ["outbound", "Outbound"], ["both", "Both"]].map(([d, lbl]) => (
                  <button key={d} type="button" className={`dir-btn${dir === d ? " on" : ""}`}
                    onClick={() => setDir(d)}>{lbl}</button>
                ))}
              </div>
              {dir !== "outbound" && (
                <div className="sub-in">
                  <label>Inbound</label>
                  <input type="number" min="0" placeholder="0" value={callsIb} onChange={(e) => setCallsIb(e.target.value)} />
                </div>
              )}
              {dir !== "inbound" && (
                <div className="sub-in">
                  <label>Outbound</label>
                  <input type="number" min="0" placeholder="0" value={callsOb} onChange={(e) => setCallsOb(e.target.value)} />
                </div>
              )}
            </div>

            <div className="divline" />

            <div className="fblock">
              <div className="slabel">Minutes</div>
              <div className="flabel">Period</div>
              <div className="seg">
                {PERIODS.map((p) => (
                  <button key={p} type="button" className={`seg-btn${mPd === p ? " on" : ""}`}
                    onClick={() => setMPd(p)}>{p}</button>
                ))}
              </div>
              <div className="flabel">Total minutes <span>(blank = auto)</span></div>
              <input className={inputStyle} type="number" min="0" placeholder="auto-calculated"
                value={totalMins} onChange={(e) => setTotalMins(e.target.value)} />
            </div>

            <div className="divline" />

            <div className="fblock">
              <div className="slabel">Duration</div>
              <div className="flabel">Avg call duration (min) <span>· default 3</span></div>
              <input className={inputStyle} type="number" min="0" step="0.5" placeholder="3"
                value={avgDur} onChange={(e) => setAvgDur(e.target.value)} />
            </div>

            <div className="divline" />

            <div className="fblock">
              <div className="slabel">Pick-up rate</div>
              <div className="flabel">Pick-up rate <span>(% of calls answered)</span></div>
              <input className={inputStyle} type="number" min="0" max="100" step="1" placeholder="e.g. 75"
                value={pickup} onChange={(e) => setPickup(e.target.value)} />
            </div>
          </div>

          {/* RIGHT: RESULTS */}
          <div className="right">
            {!r.show ? (
              <div className="empty">
                <div className="empty-ring">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
                  </svg>
                </div>
                <div className="empty-txt">Enter agents &amp; call volume<br />to see the per-user breakdown</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                <div className="glass-hero">
                  <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
                    <div>
                      <div className="hero-label">Per user · daily</div>
                      <div className="hero-val">{fmt(r.puD)}</div>
                      <div className="hero-unit">min / day</div>
                    </div>
                    <div style={{ borderLeft: "1px solid var(--bdr)", paddingLeft: 28 }}>
                      <div className="hero-label">Per user · monthly</div>
                      <div className="hero-val" style={{ fontSize: 36 }}>{fmt(r.puM)}</div>
                      <div className="hero-unit">min / month</div>
                    </div>
                  </div>
                </div>

                <div className="grid2">
                  <div className="mc"><div className="mc-label">Hours / day per user</div><div className="mc-val">{fmtH(r.puD / 60)}</div><div className="mc-unit">h</div></div>
                  <div className="mc"><div className="mc-label">Hours / month per user</div><div className="mc-val">{fmtH(r.puM / 60)}</div><div className="mc-unit">h</div></div>
                  <div className="mc"><div className="mc-label">Per user / week</div><div className="mc-val">{fmt(r.puW)}</div><div className="mc-unit">min</div></div>
                  <div className="mc"><div className="mc-label">Per user / year</div><div className="mc-val">{fmt(r.puA)}</div><div className="mc-unit">min</div></div>
                </div>

                <div className="bk">
                  <div className="slabel" style={{ marginBottom: 10 }}>Full breakdown</div>
                  <div>
                    {r.rows.map(([l, v], i) => (
                      <div className="brow" key={i}><span>{l}</span><span>{v}</span></div>
                    ))}
                  </div>
                </div>

                {r.pickupShow && (
                  <div style={{ border: "1px solid rgba(59,130,246,0.24)", borderRadius: 12, padding: "14px 16px", background: "linear-gradient(135deg,rgba(59,130,246,0.11) 0%,rgba(59,130,246,0.03) 100%)" }}>
                    <div className="slabel" style={{ marginBottom: 8 }}>Effective talking time · pick-up adjusted</div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                      <div style={{ fontSize: 32, fontWeight: 600, color: "var(--txt)", letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums" }}>{fmt(r.effectiveMins)}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", paddingBottom: 5 }}>min / user / month</div>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted2)", marginTop: 6 }}>
                      {r.pk}% pick-up rate applied to {fmt(r.puM)} min/user/month
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.mcalc{
  /* Interpolated from src/lib/tokens.js, not copied from it. The variable names
     are kept (--acc, --glow, ...) because ~70 rules below reference them; only
     the values move. An earlier pass pasted the token values in as literals,
     which looked token-backed and silently froze the module at the old palette. */
  --bg:${C.bg};--bg2:${C.surface};
  --surf:${C.surfaceAlt};--surf2:${C.wellBg};
  --bdr:${C.border};--bdr2:${C.borderStrong};--bdr3:${C.blueBorder};
  --acc:${C.blue};--acc2:${C.cyan};--acc3:${C.blueBg};--glow:${C.bloomBg};
  --txt:${C.text};--muted:${C.textMuted};--muted2:${C.textHint};
  height:100%;overflow-y:auto;background:transparent;color:var(--txt);
  font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  display:flex;align-items:flex-start;justify-content:center;padding:24px 16px;
}
.mcalc *{box-sizing:border-box}
.mcalc .app{width:100%;max-width:860px;background:${C.cardBg};border-radius:16px;overflow:hidden;border:1px solid var(--bdr);display:flex;flex-direction:column;box-shadow:${SHADOW.card}}
.mcalc .topbar{display:flex;align-items:center;gap:13px;padding:14px 22px;background:var(--surf2);border-bottom:1px solid var(--bdr);backdrop-filter:blur(24px)}
.mcalc .logo-wrap{width:38px;height:38px;border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--acc);flex-shrink:0}
.mcalc .logo-wrap svg{width:30px;height:30px}
.mcalc .topbar-info{flex:1}
.mcalc .t-title{font-size:13px;font-weight:500;color:var(--txt);letter-spacing:-0.01em}
.mcalc .t-sub{font-size:11px;color:var(--muted);margin-top:1px}
.mcalc .live-pip{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--acc2);letter-spacing:0.04em}
.mcalc .live-dot{width:6px;height:6px;border-radius:50%;background:var(--acc2)}
.mcalc .badge{font-size:10px;padding:3px 10px;border-radius:20px;border:1px solid var(--bdr3);color:var(--acc2);background:var(--acc3);letter-spacing:0.07em}
.mcalc .clear-btn{font-size:11px;font-weight:500;padding:5px 12px;border-radius:8px;border:1px solid var(--bdr2);background:var(--surf);color:var(--muted);cursor:pointer;transition:all .15s}
.mcalc .clear-btn:hover{border-color:var(--bdr3);color:var(--acc2);background:var(--acc3)}
.mcalc .body{display:grid;grid-template-columns:280px 1fr;min-height:620px}
.mcalc .left{padding:20px 17px;border-right:1px solid var(--bdr);background:rgba(10,10,12,0.45);display:flex;flex-direction:column;gap:0;overflow-y:auto}
.mcalc .slabel{font-size:9px;font-weight:500;color:var(--muted2);letter-spacing:0.14em;text-transform:uppercase;margin-bottom:7px}
.mcalc .fblock{margin-bottom:15px}
.mcalc .flabel{font-size:11px;color:var(--muted);margin-bottom:5px;line-height:1.5}
.mcalc .flabel span{color:var(--muted2)}
.mcalc .g-input{width:100%;height:35px;background:var(--surf2);border:1px solid var(--bdr2);border-radius:11px;padding:0 13px;font-size:13px;color:var(--txt);outline:none;transition:border-color .18s,box-shadow .18s;-webkit-appearance:none;appearance:none}
.mcalc .g-input:focus{border-color:var(--bdr3);box-shadow:0 0 0 3px var(--glow)}
.mcalc .g-input::placeholder{color:var(--muted2)}
.mcalc .seg{display:flex;gap:3px;margin-bottom:10px;background:var(--surf);border:1px solid var(--bdr);border-radius:999px;padding:3px}
.mcalc .seg-btn{flex:1;height:24px;border-radius:999px;border:none;background:transparent;color:var(--muted);font-size:12px;font-weight:500;cursor:pointer;transition:all .15s}
.mcalc .seg-btn:hover{color:var(--acc2)}
.mcalc .seg-btn.on{background:var(--acc3);color:var(--acc2);box-shadow:inset 0 0 0 1px var(--bdr3)}
.mcalc .dir-row{display:flex;gap:3px;margin-bottom:9px;background:var(--surf);border:1px solid var(--bdr);border-radius:999px;padding:3px}
.mcalc .dir-btn{flex:1;height:24px;border-radius:999px;border:none;background:transparent;color:var(--muted);font-size:11px;font-weight:500;cursor:pointer;transition:all .15s}
.mcalc .dir-btn:hover{color:var(--acc2)}
.mcalc .dir-btn.on{background:var(--acc3);color:var(--acc2);box-shadow:inset 0 0 0 1px var(--bdr3)}
.mcalc .sub-in{display:flex;align-items:center;gap:8px;margin-top:5px}
.mcalc .sub-in label{font-size:11px;color:var(--muted);min-width:64px;flex-shrink:0}
.mcalc .sub-in input{flex:1;height:30px;background:var(--surf);border:1px solid var(--bdr2);border-radius:10px;padding:0 10px;font-size:12px;color:var(--txt);outline:none;transition:border-color .15s;-webkit-appearance:none;appearance:none}
.mcalc .sub-in input:focus{border-color:var(--bdr3)}
.mcalc .sub-in input::placeholder{color:var(--muted2)}
.mcalc .divline{height:1px;background:linear-gradient(90deg,transparent,var(--bdr) 12%,var(--bdr) 88%,transparent);margin:13px 0}
.mcalc .right{padding:20px 18px;background:var(--bg2);display:flex;flex-direction:column;gap:11px}
.mcalc .glass-hero{border:1px solid rgba(59,130,246,0.24);border-radius:14px;padding:20px 22px;position:relative;overflow:hidden;background:linear-gradient(135deg,rgba(59,130,246,0.11) 0%,rgba(59,130,246,0.03) 100%)}
.mcalc .glass-hero::after{content:'';position:absolute;top:-50px;right:-50px;width:160px;height:160px;border-radius:50%;background:rgba(59,130,246,0.05);pointer-events:none}
.mcalc .hero-label{font-size:10px;color:var(--muted2);letter-spacing:0.14em;text-transform:uppercase;margin-bottom:10px}
.mcalc .hero-val{font-size:42px;font-weight:600;color:var(--txt);line-height:1;letter-spacing:-0.03em;font-variant-numeric:tabular-nums}
.mcalc .hero-unit{font-size:11px;color:var(--muted);margin-top:7px}
.mcalc .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.mcalc .mc{background:var(--surf);border:1px solid var(--bdr);border-radius:12px;padding:13px 15px}
.mcalc .mc-label{font-size:10px;color:var(--muted2);letter-spacing:0.14em;text-transform:uppercase;margin-bottom:5px}
.mcalc .mc-val{font-size:24px;font-weight:600;color:var(--txt);letter-spacing:-0.025em;font-variant-numeric:tabular-nums}
.mcalc .mc-unit{font-size:10px;color:var(--muted2);margin-top:3px}
.mcalc .bk{background:var(--surf);border:1px solid var(--bdr);border-radius:12px;padding:14px 16px;flex:1}
.mcalc .brow{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(44,44,52,0.45);font-size:12px}
.mcalc .brow:last-child{border-bottom:none}
.mcalc .brow span:first-child{color:var(--muted)}
.mcalc .brow span:last-child{color:var(--txt);font-weight:500}
.mcalc .empty{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:13px;min-height:400px}
.mcalc .empty-ring{width:56px;height:56px;border-radius:50%;border:1px solid var(--bdr);display:flex;align-items:center;justify-content:center;color:var(--muted2)}
.mcalc .empty-txt{font-size:12px;color:var(--muted2);text-align:center;line-height:1.8}
.mcalc input[type=number]::-webkit-inner-spin-button,.mcalc input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none}
.mcalc input[type=number]{-moz-appearance:textfield}
`;
