// Module 06 - SDR Pacing.
//
// Three tabs at three different altitudes, deliberately. The team tab is a
// forecast: where the month lands if nothing changes, with no individual named.
// Naming people on a whole-team view invites ranking them, and a team forecast
// is not a leaderboard - it answers "does the office make the number", which is
// a different question from "who is behind". The two office tabs are where
// individuals live, because that is the altitude at which a name is actionable.
//
// The September tab is a frozen snapshot from pacing.config.js, not a pull.

import { useState, useMemo } from "react";
import { PACING, GENERATED_AT } from "./data.js";
import { PREVIOUS_MONTH } from "../../pacing.config.js";
import { PROFILE } from "../../config.js";
import {
  Page, PageHeader, Card, SectionLabel, Stat, StatRow, StatusDot,
  Glyph, DataList, DataRow, TabBar, ProgressBar, Empty,
} from "../../design/ui.jsx";
import { C, R, T, TRACK, NUM, SEMANTIC, FONT_SANS, FONT_MONO } from "../../lib/tokens.js";

const eur = (n) => "€" + Math.round(n).toLocaleString("en-US");
const eurK = (n) =>
  Math.abs(n) >= 10000 ? "€" + (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : eur(n);

// Pacing index: booked / expected-by-now. 100 means exactly on the line.
// The bands are the ones the team already reads in the Monday review, so they
// are not re-derived here - they are restated.
function levelFor(pct) {
  if (pct == null) return "idle";
  if (pct >= 100) return "ok";
  if (pct >= 80) return "warn";
  return "risk";
}
const VERDICT = { ok: "On pace", warn: "Slightly behind", risk: "Needs attention", idle: "No data" };

// ---------------------------------------------------------------------------
// Maths
// ---------------------------------------------------------------------------
// Every figure below is derived from two numbers the pull provides - the
// month-to-date actual and the member's own working-day calendar. Nothing is
// interpolated and nothing is smoothed; a projection here is a flat run-rate
// extrapolation and is labelled as such on screen.
function metric(actual, target, cal, deals) {
  const share = cal.total ? cal.elapsed / cal.total : 0;
  const expected = target * share;
  const pct = expected > 0 ? (actual / expected) * 100 : null;
  const projected = share > 0 ? actual / share : null;
  const gap = Math.max(0, target - actual);
  const perDay = cal.left > 0 ? gap / cal.left : 0;
  const runRate = cal.elapsed > 0 ? actual / cal.elapsed : 0;
  return {
    actual, target, deals, expected, pct, projected, gap, perDay, runRate,
    attain: target > 0 ? (actual / target) * 100 : 0,
    expectedPct: target > 0 ? (expected / target) * 100 : 0,
    level: levelFor(pct),
    daysLeft: cal.left,
  };
}

// Aggregate a group. Targets and calendars differ per member (time off, a team
// lead on half quota), so the group's expected line is the sum of individual
// expected lines - not the group target times some single office-wide share.
function aggregate(members, actuals) {
  let sqlA = 0, sqoA = 0, sqlT = 0, sqoT = 0, sqlE = 0, sqoE = 0;
  let sqlD = 0, sqoD = 0, sqlNeed = 0, sqoNeed = 0, elapsed = 0, missing = 0;

  for (const m of members) {
    const share = m.cal.total ? m.cal.elapsed / m.cal.total : 0;
    sqlT += m.sql; sqoT += m.sqo;
    sqlE += m.sql * share; sqoE += m.sqo * share;
    elapsed = Math.max(elapsed, m.cal.elapsed);

    const a = actuals[m.id];
    const sa = a ? Number(a.sqlMrr) || 0 : 0;
    const oa = a ? Number(a.sqoMrr) || 0 : 0;
    if (m.cal.left > 0) {
      sqlNeed += Math.max(0, m.sql - sa) / m.cal.left;
      sqoNeed += Math.max(0, m.sqo - oa) / m.cal.left;
    }
    if (!a) { missing++; continue; }
    sqlA += sa; sqoA += oa;
    sqlD += Number(a.sqlDeals) || 0;
    sqoD += Number(a.sqoDeals) || 0;
  }

  const left = Math.max(...members.map((m) => m.cal.left), 0);
  const mk = (actual, target, expected, deals, need) => ({
    actual, target, expected, deals, perDay: need,
    pct: expected > 0 ? (actual / expected) * 100 : null,
    projected: expected > 0 ? (actual / expected) * target : null,
    gap: Math.max(0, target - actual),
    runRate: elapsed > 0 ? actual / elapsed : 0,
    attain: target > 0 ? (actual / target) * 100 : 0,
    expectedPct: target > 0 ? (expected / target) * 100 : 0,
    level: levelFor(expected > 0 ? (actual / expected) * 100 : null),
    daysLeft: left,
  });

  return {
    sql: mk(sqlA, sqlT, sqlE, sqlD, sqlNeed),
    sqo: mk(sqoA, sqoT, sqoE, sqoD, sqoNeed),
    hasData: missing < members.length,
    missing,
    size: members.length,
    daysLeft: left,
  };
}

function fmtDate(iso) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

// ---------------------------------------------------------------------------
// Forecast panel - the team tab's unit
// ---------------------------------------------------------------------------
// Reads top-down: where this lands, how far that is from the target, and what
// per-day rate closes the difference. The bar shows booked-against-target with a
// tick where "expected today" sits, so being behind is visible as a gap between
// the fill and the tick rather than as a percentage you have to interpret.
function Forecast({ title, note, m, hasData }) {
  const s = SEMANTIC[m.level];
  const landsShort = m.projected != null && m.projected < m.target;

  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: R.lg,
      background: C.cardBg,
      padding: "20px 20px 18px",
      display: "flex", flexDirection: "column", gap: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <SectionLabel>{title}</SectionLabel>
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <StatusDot level={m.level} />
          <span style={{ font: `400 ${T.micro}px/1 ${FONT_SANS}`, color: s.fill }}>
            {hasData ? VERDICT[m.level] : "Not loaded"}
          </span>
        </span>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{
            font: `600 ${T.hero}px/1 ${FONT_SANS}`,
            letterSpacing: TRACK.tighter, color: C.text, ...NUM,
          }}>
            {hasData && m.projected != null ? eurK(m.projected) : "-"}
          </span>
          <span style={{ font: `400 ${T.body}px/1 ${FONT_SANS}`, color: C.textFaint, ...NUM }}>
            / {eurK(m.target)}
          </span>
        </div>
        <div style={{ font: `400 ${T.micro}px/1.4 ${FONT_SANS}`, color: C.textHint, marginTop: 8 }}>
          projected month-end at the current run rate
        </div>
      </div>

      <div>
        <ProgressBar
          pct={hasData ? m.attain : 0}
          level={m.level}
          height={5}
          marker={m.expectedPct}
        />
        <div style={{
          display: "flex", justifyContent: "space-between",
          font: `400 ${T.micro}px/1 ${FONT_SANS}`, color: C.textHint,
          marginTop: 9, ...NUM,
        }}>
          <span>{hasData ? eur(m.actual) : "-"} booked{hasData ? ` · ${m.deals} deal${m.deals === 1 ? "" : "s"}` : ""}</span>
          <span>{eur(m.expected)} expected today</span>
        </div>
      </div>

      <div style={{
        borderTop: `1px solid ${C.divider}`, paddingTop: 13,
        display: "flex", flexDirection: "column", gap: 6,
        font: `400 ${T.micro}px/1.5 ${FONT_SANS}`, color: C.textMuted, ...NUM,
      }}>
        {m.gap <= 0 && hasData ? (
          <span style={{ color: SEMANTIC.ok.fill }}>Target already reached.</span>
        ) : (
          <>
            <span>
              <strong style={{ color: C.text, fontWeight: 500 }}>{eur(m.gap)}</strong> still to book
              {" · "}{m.daysLeft} day{m.daysLeft === 1 ? "" : "s"} left
            </span>
            <span>
              Needs <strong style={{ color: C.text, fontWeight: 500 }}>{eur(m.perDay)}</strong>/day
              {hasData && m.runRate > 0 && (
                <> · currently running {eur(m.runRate)}/day</>
              )}
            </span>
          </>
        )}
        {note && <span style={{ color: C.textHint }}>{note}</span>}
      </div>

      {hasData && landsShort && (
        <div style={{ font: `400 ${T.micro}px/1.4 ${FONT_SANS}`, color: s.fill }}>
          Lands {eur(m.target - m.projected)} short unless the rate changes.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cumulative curve - the month as a line
// ---------------------------------------------------------------------------
// Needs PACING.daily (per-day team SQL MRR); refreshes before the day-grain
// query landed in the spec do not carry it, so the card degrades to a note
// rather than an empty chart. Actual cumulates to today, a dashed flat-run-rate
// projection carries on to month-end, the straight line is the target path, and
// the wash between them is the runway still to make up.
function CumulativeCurve({ daily, target, monthLabel, todayIso }) {
  const built = useMemo(() => {
    if (!Array.isArray(daily) || daily.length === 0 || !todayIso) return null;
    const [y, m] = todayIso.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const byDate = new Map(daily.map((d) => [d.date, Number(d.sqlMrr) || 0]));
    const todayDom = Number(todayIso.split("-")[2]);

    let run = 0;
    const actual = [];
    for (let d = 1; d <= Math.min(todayDom, daysInMonth); d++) {
      const iso = `${todayIso.slice(0, 8)}${String(d).padStart(2, "0")}`;
      run += byDate.get(iso) || 0;
      actual.push({ day: d, y: run });
    }
    const rate = todayDom > 0 ? run / todayDom : 0;
    const projEnd = run + rate * (daysInMonth - todayDom);
    return { actual, daysInMonth, todayDom, booked: run, projEnd };
  }, [daily, todayIso]);

  if (!built) {
    return (
      <Empty level="idle">
        Day-by-day series arrives with the next refresh - the curve draws itself from there.
      </Empty>
    );
  }

  const { actual, daysInMonth, todayDom, booked, projEnd } = built;
  const W = 640, H = 180, padT = 12, padB = 20;
  const max = Math.max(target, projEnd, booked, 1) * 1.08;
  const px = (day) => ((day - 1) / (daysInMonth - 1)) * W;
  const py = (v) => H - padB - (v / max) * (H - padT - padB);

  const actualPath = actual.map((p, i) => `${i === 0 ? "M" : "L"}${px(p.day).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ");
  const areaPath = `${actualPath} L${px(todayDom).toFixed(1)},${H - padB} L0,${H - padB} Z`;
  const targetEndY = py(target);
  const projShort = projEnd < target;
  // Runway band: projection vs target path, from today to month-end.
  const targetAtToday = (target * todayDom) / daysInMonth;
  const band = [
    `M${px(todayDom).toFixed(1)},${py(booked).toFixed(1)}`,
    `L${px(daysInMonth).toFixed(1)},${py(projEnd).toFixed(1)}`,
    `L${px(daysInMonth).toFixed(1)},${targetEndY.toFixed(1)}`,
    `L${px(todayDom).toFixed(1)},${py(targetAtToday).toFixed(1)}`,
    "Z",
  ].join(" ");

  const bandColor = projShort ? SEMANTIC.risk.fill : SEMANTIC.ok.fill;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
           style={{ width: "100%", height: H, display: "block", overflow: "visible" }}>
        {[0.2, 0.5, 0.8].map((f) => (
          <line key={f} x1="0" y1={H * f} x2={W} y2={H * f} stroke={C.border} strokeWidth="1" />
        ))}
        {/* target path */}
        <line x1={px(1)} y1={py(0)} x2={px(daysInMonth)} y2={targetEndY}
              stroke={C.amber} strokeWidth="1.5" strokeDasharray="4 5" opacity="0.6" />
        {/* runway band */}
        <path d={band} fill={bandColor} opacity="0.08" />
        {/* projection */}
        <line x1={px(todayDom)} y1={py(booked)} x2={px(daysInMonth)} y2={py(projEnd)}
              stroke={bandColor} strokeWidth="1.5" strokeDasharray="2 5" opacity="0.8" />
        {/* actual */}
        <path d={areaPath} fill={C.cyan} opacity="0.07" />
        <path d={actualPath} fill="none" stroke={C.cyan} strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={px(todayDom)} cy={py(booked)} r="3.5" fill={C.cyan} />
        {/* today marker */}
        <line x1={px(todayDom)} y1={padT} x2={px(todayDom)} y2={H - padB}
              stroke={C.textFaint} strokeWidth="1" strokeDasharray="2 4" opacity="0.5" />
      </svg>
      <div style={{
        display: "flex", justifyContent: "space-between", marginTop: 8,
        font: `400 ${T.micro}px/1 ${FONT_SANS}`, color: C.textHint, ...NUM,
      }}>
        <span>{monthLabel} day 1</span>
        <span>
          <span style={{ color: C.cyan }}>— booked {eurK(booked)}</span>
          {"  ·  "}
          <span style={{ color: bandColor }}>- - projects {eurK(projEnd)}</span>
          {"  ·  "}
          <span style={{ color: C.amber }}>- - target {eurK(target)}</span>
        </span>
        <span>day {daysInMonth}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Strip plot - where everyone stands
// ---------------------------------------------------------------------------
// One axis: SQO pace (booked vs expected-by-now). Every SDR is a badge on it,
// ringed by office, current user lit. This deliberately puts names on the team tab -
// position on a shared axis is a snapshot, not a leaderboard ranking.
function StripPlot({ roster, actuals }) {
  const rows = useMemo(() => {
    const out = [];
    for (const m of roster) {
      const a = actuals[m.id];
      if (!a) continue;
      const pct = metric(Number(a.sqoMrr) || 0, m.sqo, m.cal, 0).pct;
      if (pct == null) continue;
      out.push({ name: m.name, office: m.office, pct });
    }
    return out.sort((a, b) => a.pct - b.pct);
  }, [roster, actuals]);

  if (rows.length === 0) return <Empty level="idle">No SDR data loaded yet.</Empty>;

  const lo = Math.min(0, ...rows.map((r) => r.pct));
  const hi = Math.max(120, Math.ceil(Math.max(...rows.map((r) => r.pct)) / 10) * 10 + 10);
  const x = (pct) => ((Math.min(Math.max(pct, lo), hi) - lo) / (hi - lo)) * 100;

  // Greedy lane assignment: badges within 4% of an occupied spot drop a lane.
  // Positions clamp a badge-radius in from the edges so 0% is not half-clipped.
  const lanes = [];
  const placed = rows.map((r) => {
    const xr = Math.min(97.5, Math.max(2.5, x(r.pct)));
    let lane = 0;
    while (lanes[lane] != null && xr - lanes[lane] < 4.5) lane++;
    lanes[lane] = xr;
    return { ...r, x: xr, lane };
  });
  const laneCount = Math.max(...placed.map((p) => p.lane)) + 1;
  const bands = [
    { from: lo, to: 80, label: "At risk", color: SEMANTIC.risk.fill },
    { from: 80, to: 100, label: "Behind", color: SEMANTIC.warn.fill },
    { from: 100, to: hi, label: "On pace", color: SEMANTIC.ok.fill },
  ];
  const BADGE = 30, LANE_H = 36;

  return (
    <div>
      <div style={{ position: "relative", height: laneCount * LANE_H + 26 }}>
        {/* band washes + boundaries */}
        {bands.map((b) => (
          <div key={b.label} style={{
            position: "absolute", top: 0, bottom: 26,
            left: `${x(b.from)}%`, width: `${x(b.to) - x(b.from)}%`,
            background: `${b.color}0d`, borderLeft: b.from === lo ? "none" : `1px dashed ${C.border}`,
            borderRadius: b.from === lo ? `${R.sm}px 0 0 ${R.sm}px` : b.to === hi ? `0 ${R.sm}px ${R.sm}px 0` : 0,
          }} />
        ))}
        {/* badges */}
        {placed.map((p) => {
          const me = p.name === PROFILE.name;
          const ring = p.office === "BCN" ? C.cyan : C.purple;
          return (
            <span
              key={p.name}
              title={`${p.name} · ${p.office === "BCN" ? "Barcelona" : "Toronto"} · ${Math.round(p.pct)}% of pace`}
              style={{
                position: "absolute",
                left: `calc(${p.x}% - ${BADGE / 2}px)`,
                top: 6 + p.lane * LANE_H,
                width: BADGE, height: BADGE, borderRadius: "50%",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                font: `600 ${T.label}px/1 ${FONT_SANS}`, letterSpacing: TRACK.label,
                color: me ? C.text : C.textMid,
                background: me ? C.bloomBg : C.cardBg,
                border: `2px solid ${me ? C.bloom : ring}`,
                boxShadow: me ? C.bloomGlow : "none",
                zIndex: me ? 2 : 1, cursor: "default",
              }}
            >
              {initials(p.name)}
            </span>
          );
        })}
        {/* band labels */}
        {bands.map((b) => (
          <span key={b.label} style={{
            position: "absolute", bottom: 0, left: `${x(b.from)}%`, paddingLeft: 8,
            font: `500 ${T.label}px/1 ${FONT_SANS}`, letterSpacing: TRACK.label,
            textTransform: "uppercase", color: b.color,
          }}>
            {b.label}{b.from > lo ? ` · ${b.from}%` : ""}
          </span>
        ))}
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 16, marginTop: 12,
        font: `400 ${T.micro}px/1 ${FONT_SANS}`, color: C.textHint,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${C.cyan}` }} /> Barcelona
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${C.purple}` }} /> Toronto
        </span>
        <span style={{ marginLeft: "auto" }}>axis is SQO pace - booked vs expected by today</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team tab - forecast first, then the month as a line, then the people on it
// ---------------------------------------------------------------------------
function TeamTab({ roster, actuals, bcn, tor }) {
  const all = useMemo(() => aggregate(roster, actuals), [roster, actuals]);
  const bcnAgg = useMemo(() => aggregate(bcn, actuals), [bcn, actuals]);
  const torAgg = useMemo(() => aggregate(tor, actuals), [tor, actuals]);

  const groups = [
    { key: "BCN", label: "Barcelona", region: "EMEA", agg: bcnAgg },
    { key: "TOR", label: "Toronto", region: "NA", agg: torAgg },
  ];

  // The drag: whichever office sits further behind its own expected line, in €.
  // One derived sentence, shown only when someone actually is behind.
  const drag = useMemo(() => {
    if (!all.hasData) return null;
    const deltas = groups.map((g) => ({
      label: g.label, delta: g.agg.sqo.actual - g.agg.sqo.expected,
    }));
    const worst = deltas.sort((a, b) => a.delta - b.delta)[0];
    return worst && worst.delta < 0 ? worst : null;
  }, [all.hasData, bcnAgg, torAgg]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Forecast title="SQL created" m={all.sql} hasData={all.hasData} />
        <Forecast title="SQO accepted" m={all.sqo} hasData={all.hasData} />
      </div>

      {drag && (
        <div style={{
          border: `1px solid ${SEMANTIC.warn.border}`, borderRadius: R.lg,
          background: SEMANTIC.warn.bg, padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 9,
          font: `400 ${T.body - 1}px/1.4 ${FONT_SANS}`, color: C.textMid,
        }}>
          <StatusDot level="warn" />
          <span>
            <strong style={{ color: C.text, fontWeight: 500 }}>{drag.label} is the drag</strong>
            {" - "}{eurK(Math.abs(drag.delta))} behind where today expects on SQO.
          </span>
        </div>
      )}

      <Card title="The month as a line" right={<SectionLabel>SQL created · cumulative</SectionLabel>}>
        <CumulativeCurve
          daily={PACING.daily}
          target={all.sql.target}
          monthLabel={PACING.monthLabel}
          todayIso={PACING.todayIso}
        />
      </Card>

      <Card title="Where everyone stands" right={<SectionLabel>SQO pace</SectionLabel>}>
        <StripPlot roster={roster} actuals={actuals} />
      </Card>

      <Card title="Office split" right={<SectionLabel>{all.size} SDRs</SectionLabel>}>
        <DataList>
          {groups.map((g, i) => {
            const a = g.agg;
            return (
              <DataRow key={g.key} last={i === groups.length - 1}>
                <Glyph level={a.sqo.level} size={32}>{g.key}</Glyph>
                <div style={{ minWidth: 150 }}>
                  <div style={{ font: `500 ${T.body}px/1.2 ${FONT_SANS}`, color: C.text }}>
                    {g.label}
                  </div>
                  <div style={{ font: `400 ${T.micro}px/1.3 ${FONT_SANS}`, color: C.textHint, marginTop: 3 }}>
                    {g.region} · {a.size} SDRs · {a.daysLeft} days left
                  </div>
                </div>

                <MiniMetric label="SQL" m={a.sql} />
                <MiniMetric label="SQO" m={a.sqo} />

                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{
                    font: `600 ${T.bodyLg}px/1 ${FONT_SANS}`,
                    color: SEMANTIC[a.sqo.level].fill, ...NUM,
                  }}>
                    {a.sqo.pct == null ? "-" : `${Math.round(a.sqo.pct)}%`}
                  </div>
                  <div style={{ font: `400 ${T.label}px/1 ${FONT_SANS}`, color: C.textFaint, marginTop: 5, letterSpacing: TRACK.label, textTransform: "uppercase" }}>
                    SQO pace
                  </div>
                </div>
              </DataRow>
            );
          })}
        </DataList>
      </Card>

      <div style={{
        font: `400 ${T.micro}px/1.6 ${FONT_SANS}`, color: C.textHint, maxWidth: "70ch",
      }}>
        This tab is the forecast only - no individual is named on it. A team number
        answers whether the office makes the month; who is behind is a conversation
        that belongs on the office tab, next to that person's own calendar and time off.
      </div>
    </div>
  );
}

function MiniMetric({ label, m }) {
  return (
    <div style={{ width: 148, flex: "none" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        font: `400 ${T.micro}px/1 ${FONT_SANS}`, marginBottom: 7, ...NUM,
      }}>
        <span style={{ color: C.textHint }}>{label}</span>
        <span style={{ color: C.textMid }}>{eurK(m.actual)} / {eurK(m.target)}</span>
      </div>
      <ProgressBar pct={m.attain} level={m.level} marker={m.expectedPct} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Office tab - per-SDR, with momentum
// ---------------------------------------------------------------------------
const SDR_COLS = "minmax(170px, 1.3fr) 1fr 1fr 96px";

function OfficeTab({ label, region, members, actuals, workingDays }) {
  const agg = useMemo(() => aggregate(members, actuals), [members, actuals]);

  // Sorted by SQO pace ascending - the person who needs the conversation is at
  // the top, which is the only ordering that makes a list like this useful.
  const rows = useMemo(() => {
    return members
      .map((m) => {
        const a = actuals[m.id];
        const has = !!a;
        const sql = metric(has ? Number(a.sqlMrr) || 0 : 0, m.sql, m.cal, has ? Number(a.sqlDeals) || 0 : 0);
        const sqo = metric(has ? Number(a.sqoMrr) || 0 : 0, m.sqo, m.cal, has ? Number(a.sqoDeals) || 0 : 0);
        return { m, has, sql, sqo };
      })
      .sort((a, b) => (a.sqo.pct ?? 1e9) - (b.sqo.pct ?? 1e9));
  }, [members, actuals]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <StatRow>
        <Stat
          size="sm" label="SQL booked" value={eurK(agg.sql.actual)} of={eurK(agg.sql.target)}
          note={`${agg.sql.pct == null ? "-" : Math.round(agg.sql.pct) + "% of pace"}`}
          noteLevel={agg.sql.level}
        />
        <Stat
          size="sm" label="SQO accepted" value={eurK(agg.sqo.actual)} of={eurK(agg.sqo.target)}
          note={`${agg.sqo.pct == null ? "-" : Math.round(agg.sqo.pct) + "% of pace"}`}
          noteLevel={agg.sqo.level}
        />
        <Stat
          size="sm" label="Still to book" value={eurK(agg.sqo.gap)}
          note={`${eur(agg.sqo.perDay)}/day across the team`}
        />
        <Stat
          size="sm" label="Days left" value={agg.daysLeft} of={workingDays}
          note={`${region} · ${agg.size} SDRs`}
        />
      </StatRow>

      <Card title={`${label} SDRs`} right={<SectionLabel>sorted by SQO pace</SectionLabel>}>
        <div style={{
          display: "grid", gridTemplateColumns: SDR_COLS, gap: 12,
          padding: "0 8px 10px", margin: "0 -8px",
          borderBottom: "1px solid transparent",
          borderImage: `linear-gradient(90deg, ${C.border} 70%, transparent) 1`,
        }}>
          <SectionLabel>SDR</SectionLabel>
          <SectionLabel>SQL created</SectionLabel>
          <SectionLabel>SQO accepted</SectionLabel>
          <SectionLabel style={{ textAlign: "right" }}>Pace</SectionLabel>
        </div>

        {rows.length === 0 ? (
          <Empty level="idle">No SDRs assigned to this office this month.</Empty>
        ) : (
          rows.map((r, i) => (
            <SdrRow key={r.m.id} row={r} last={i === rows.length - 1} />
          ))
        )}
      </Card>
    </div>
  );
}

function SdrRow({ row, last }) {
  const { m, has, sql, sqo } = row;
  const sub = [m.note, `${m.cal.total} working days`].filter(Boolean).join(" · ");

  return (
    <DataRow last={last} style={{ display: "grid", gridTemplateColumns: SDR_COLS, alignItems: "center", padding: "14px 8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
        <Glyph level={sqo.level} size={30}>{initials(m.name)}</Glyph>
        <div style={{ minWidth: 0 }}>
          <div style={{
            font: `500 ${T.body}px/1.2 ${FONT_SANS}`, color: C.text,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {m.name}
          </div>
          <div style={{ font: `400 ${T.label}px/1.3 ${FONT_SANS}`, color: C.textFaint, marginTop: 3 }}>
            {sub}
          </div>
        </div>
      </div>

      <CellMetric m={sql} has={has} />
      <CellMetric m={sqo} has={has} />

      <div style={{ textAlign: "right" }}>
        <div style={{
          font: `600 ${T.bodyLg}px/1 ${FONT_SANS}`,
          color: has ? SEMANTIC[sqo.level].fill : C.textFaint, ...NUM,
        }}>
          {has && sqo.pct != null ? `${Math.round(sqo.pct)}%` : "-"}
        </div>
        <div style={{ font: `400 ${T.label}px/1.3 ${FONT_SANS}`, color: C.textFaint, marginTop: 5, ...NUM }}>
          {has && sqo.gap > 0 ? `${eur(sqo.perDay)}/day` : has ? "done" : "no data"}
        </div>
      </div>
    </DataRow>
  );
}

function CellMetric({ m, has }) {
  const delta = m.actual - m.expected;
  return (
    <div style={{ paddingRight: 16 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        font: `400 ${T.micro}px/1 ${FONT_SANS}`, marginBottom: 7, ...NUM,
      }}>
        <span style={{ color: C.text, fontWeight: 500 }}>{has ? eur(m.actual) : "-"}</span>
        <span style={{ color: C.textFaint }}>of {eur(m.target)}</span>
      </div>
      <ProgressBar pct={has ? m.attain : 0} level={m.level} marker={m.expectedPct} />
      <div style={{
        font: `400 ${T.label}px/1 ${FONT_SANS}`, color: C.textHint,
        marginTop: 7, ...NUM,
      }}>
        {has
          ? `${delta >= 0 ? "+" : "-"}${eur(Math.abs(delta))} vs expected · ${m.deals} deal${m.deals === 1 ? "" : "s"}`
          : "not loaded"}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Previous month - frozen snapshot, final numbers only
// ---------------------------------------------------------------------------
function PreviousTab() {
  const prev = PREVIOUS_MONTH;
  if (!prev) return <Empty level="idle">No previous month on file.</Empty>;

  const groups = [
    { label: "Whole team", data: prev.team },
    { label: "Barcelona", data: prev.BCN },
    { label: "Toronto", data: prev.TOR },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <StatRow cols={3}>
        {groups.map(({ label, data }) => {
          const sp = Math.round((data.sqlMrr / data.sqlTarget) * 100);
          const op = Math.round((data.sqoMrr / data.sqoTarget) * 100);
          return (
            <Stat
              key={label}
              size="sm"
              label={label}
              value={`${op}%`}
              note={`SQO ${eurK(data.sqoMrr)} of ${eurK(data.sqoTarget)} · SQL finished ${sp}%`}
              noteLevel={levelFor(op)}
            />
          );
        })}
      </StatRow>

      {prev.people && (
        <Card title="Where the month finished" right={<SectionLabel>{prev.people.length} SDRs</SectionLabel>}>
          <div style={{
            display: "grid", gridTemplateColumns: SDR_COLS, gap: 12,
            padding: "0 8px 10px", margin: "0 -8px",
            borderBottom: "1px solid transparent",
          borderImage: `linear-gradient(90deg, ${C.border} 70%, transparent) 1`,
          }}>
            <SectionLabel>SDR</SectionLabel>
            <SectionLabel>SQL created</SectionLabel>
            <SectionLabel>SQO accepted</SectionLabel>
            <SectionLabel style={{ textAlign: "right" }}>Final</SectionLabel>
          </div>

          {prev.people
            .map(([office, name, sa, st, oa, ot]) => ({
              office, name, sa, st, oa, ot,
              sp: Math.round((sa / st) * 100),
              op: Math.round((oa / ot) * 100),
            }))
            .sort((a, b) => a.op - b.op)
            .map((p, i, arr) => (
              <DataRow
                key={p.name}
                last={i === arr.length - 1}
                style={{ display: "grid", gridTemplateColumns: SDR_COLS, alignItems: "center", padding: "14px 8px" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <Glyph level={levelFor(p.op)} size={30}>{initials(p.name)}</Glyph>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ font: `500 ${T.body}px/1.2 ${FONT_SANS}`, color: C.text }}>{p.name}</div>
                    <div style={{ font: `400 ${T.label}px/1.3 ${FONT_SANS}`, color: C.textFaint, marginTop: 3 }}>
                      {p.office === "BCN" ? "Barcelona" : "Toronto"}
                    </div>
                  </div>
                </div>

                <FinalCell actual={p.sa} target={p.st} pct={p.sp} />
                <FinalCell actual={p.oa} target={p.ot} pct={p.op} />

                <div style={{
                  textAlign: "right", font: `600 ${T.bodyLg}px/1 ${FONT_SANS}`,
                  color: SEMANTIC[levelFor(p.op)].fill, ...NUM,
                }}>
                  {p.op}%
                </div>
              </DataRow>
            ))}
        </Card>
      )}
    </div>
  );
}

function FinalCell({ actual, target, pct }) {
  return (
    <div style={{ paddingRight: 16 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        font: `400 ${T.micro}px/1 ${FONT_SANS}`, marginBottom: 7, ...NUM,
      }}>
        <span style={{ color: C.text, fontWeight: 500 }}>{eur(actual)}</span>
        <span style={{ color: C.textFaint }}>of {eur(target)}</span>
      </div>
      <ProgressBar pct={pct} level={levelFor(pct)} />
      <div style={{ font: `400 ${T.label}px/1 ${FONT_SANS}`, color: C.textHint, marginTop: 7, ...NUM }}>
        finished at {pct}%
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export default function PacingModule() {
  const [period, setPeriod] = useState("current");
  const [tab, setTab] = useState("team");

  const { roster, actuals, offices, todayIso, monthLabel } = PACING;
  const bcn = useMemo(() => roster.filter((r) => r.office === "BCN"), [roster]);
  const tor = useMemo(() => roster.filter((r) => r.office === "TOR"), [roster]);

  const bcnCal = bcn.find((m) => !m.off?.length)?.cal;
  const torCal = tor.find((m) => !m.off?.length)?.cal;

  const isPrev = period === "previous";

  const sub = isPrev
    ? `Month closed · ${PREVIOUS_MONTH?.sdrCount ?? "-"} SDRs${PREVIOUS_MONTH?.note ? ` · ${PREVIOUS_MONTH.note}` : ""}`
    : `${fmtDate(todayIso)} · Barcelona ${bcnCal ? `${bcnCal.elapsed}/${bcnCal.total}` : "-"} · Toronto ${torCal ? `${torCal.elapsed}/${torCal.total}` : "-"} working days done`;

  return (
    <Page>
      <PageHeader
        num="06 · SDR Pacing"
        title={isPrev ? `${PREVIOUS_MONTH?.label} pacing, final` : `${monthLabel} pacing`}
        sub={sub}
        right={
          <TabBar
            size="sm"
            value={period}
            onChange={setPeriod}
            tabs={[
              { id: "current", label: monthLabel || "Current" },
              { id: "previous", label: PREVIOUS_MONTH?.label || "Previous" },
            ]}
          />
        }
      />

      {!isPrev && (
        <div style={{ marginBottom: 22 }}>
          <TabBar
            value={tab}
            onChange={setTab}
            cycleShortcut
            tabs={[
              { id: "team", label: "Team forecast" },
              { id: "bcn", label: `Barcelona · ${bcn.length}` },
              { id: "tor", label: `Toronto · ${tor.length}` },
            ]}
          />
        </div>
      )}

      {isPrev ? (
        <PreviousTab />
      ) : tab === "team" ? (
        <TeamTab roster={roster} actuals={actuals} bcn={bcn} tor={tor} />
      ) : tab === "bcn" ? (
        <OfficeTab
          label="Barcelona" region="EMEA" members={bcn} actuals={actuals}
          workingDays={offices?.BCN?.workingDays ?? "-"}
        />
      ) : (
        <OfficeTab
          label="Toronto" region="NA" members={tor} actuals={actuals}
          workingDays={offices?.TOR?.workingDays ?? "-"}
        />
      )}

      <div style={{
        marginTop: 32, paddingTop: 18, borderTop: `1px solid ${C.border}`,
        font: `400 ${T.micro}px/1.6 ${FONT_SANS}`, color: C.textHint, maxWidth: "76ch",
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        <p style={{ margin: 0 }}>
          Each target is that SDR's daily rate multiplied by their own working days
          this month, so time off and a reduced quota are already in the number.
          Pace compares what is booked to what is expected after the days completed
          so far; the tick on every bar is where expected sits. Today counts as a
          day still to be worked.
        </p>
        <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <StatusDot level="ok" /> on pace, 100%+
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <StatusDot level="warn" /> slightly behind, 80-99%
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <StatusDot level="risk" /> needs attention, under 80%
          </span>
          {GENERATED_AT && (
            <span style={{ marginLeft: "auto", fontFamily: FONT_MONO, color: C.textFaint }}>
              pulled {new Date(GENERATED_AT).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </p>
      </div>
    </Page>
  );
}
