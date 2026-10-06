import { Fragment, useState } from "react";
import { PERFORMANCE } from "./data.js";
import { PORTAL_ID, POINTS_QUOTA_PER_MONTH } from "../../config.js";
import {
  Page, PageHeader, Card, SectionLabel, Stat, StatRow, StatusDot,
  AreaChart,
} from "../../design/ui.jsx";
import { Gauge, FunnelFlow, CountUp, Sparkline, useMountProgress } from "../../design/viz.jsx";
import { C, R, T, TRACK, NUM, SEMANTIC, FONT_SANS, FONT_MONO } from "../../lib/tokens.js";

// Module 04 - Performance. One question: am I going to hit quota this month,
// and what is standing between me and that. Everything here answers it or
// earns its place by flagging something that threatens it.
//
// Present mode masks the contractual figures (commission, point value, quota)
// so the module can be screen-shared in a team setting without putting the
// comp plan on a projector. It defaults ON - the safe state is the one you
// land on, not the one you have to remember to switch to.
const MASK = "•••";

const eur = (n) => "€" + Math.round(n).toLocaleString("en-US");

// Charts below start at February - January is a 4-SQO ramp month whose tiny
// denominator distorts every rate. Render-time filter only; the data keeps Jan.
const SINCE = "2026-02";

// ---------------------------------------------------------------------------
// Qualification quality - acceptance rate and SQO->Won rate, monthly
// ---------------------------------------------------------------------------
// Two rates, one chart, because they are the same question: do my quals
// survive contact with an AE and then with the market. Acceptance buckets on
// decision month (accepted_deal__date_time_ / rejected_deal_timestamp), so
// history is effectively append-only; the current month still moves as
// pending deals get decided.
function QualityCard({ accByMonth, sqoWonByMonth, accYtd, sqoWonYtd }) {
  const acc = accByMonth.filter((m) => m.month >= SINCE);
  const won = sqoWonByMonth.filter((m) => m.month >= SINCE);
  const accSeries = acc.map((m) => {
    const decided = m.accepted + m.rejected;
    return { x: m.label, y: decided > 0 ? (m.accepted / decided) * 100 : 0 };
  });
  const wonLine = won.map((m) => ({ x: m.label, y: m.sqo > 0 ? (m.won / m.sqo) * 100 : 0 }));
  const accYtdDecided = accYtd.accepted + accYtd.rejected;
  const accYtdRate = accYtdDecided > 0 ? Math.round((accYtd.accepted / accYtdDecided) * 100) : null;
  const wonYtdRate = sqoWonYtd.sqo > 0 ? Math.round((sqoWonYtd.won / sqoWonYtd.sqo) * 100) : null;
  return (
    <Card title="Qualification quality · since Feb" right={<SectionLabel>monthly rates</SectionLabel>} style={{ marginTop: 18 }}>
      <AreaChart
        series={accSeries}
        reference={[{ points: wonLine, color: C.blue, dash: "4 5", opacity: 0.8 }]}
        color={SEMANTIC.ok.fill}
        height={170}
        yMax={100}
        xLabels={acc.map((m) => m.label)}
        format={(v) => `${Math.round(v)}%`}
      />
      <div style={{ font: `400 ${T.micro}px/1.6 ${FONT_SANS}`, color: C.textHint, marginTop: 10 }}>
        Solid line is AE acceptance ({accYtdRate == null ? "-" : `${accYtdRate}% YTD`}), dashed is
        SQO to Won ({wonYtdRate == null ? "-" : `${wonYtdRate}% YTD`}). Both bucket on decision
        month - the current month is still deciding, so its points will move.
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Attainment dial
// ---------------------------------------------------------------------------
// Thin wrapper over the shared Gauge: this module's only job is deciding what
// the dial means. Colour tracks pace, not raw attainment - 40% of quota on day
// 4 is fine, the same 40% on day 18 is not - so `pacePct` carries that context
// and `markerPct` plants the tick you are racing.
function AttainmentDial({ earned, target, pacePct, expected, masked }) {
  const pct = target > 0 ? (earned / target) * 100 : 0;
  const level = pacePct == null ? "idle" : pacePct >= 100 ? "ok" : pacePct >= 80 ? "warn" : "risk";
  return (
    <Gauge
      pct={pct}
      level={level}
      size={212}
      thickness={15}
      markerPct={target > 0 ? (expected / target) * 100 : null}
    >
      <div style={{ font: `600 ${T.heroLg}px/1 ${FONT_SANS}`, color: SEMANTIC[level].fill, letterSpacing: TRACK.tightest, ...NUM }}>
        <CountUp value={pct} duration={1100} format={(v) => `${Math.round(v)}%`} />
      </div>
      <div style={{ font: `400 ${T.micro}px/1 ${FONT_MONO}`, color: C.textMuted, marginTop: 8, ...NUM }}>
        {earned} / {masked ? MASK : target} pts
      </div>
    </Gauge>
  );
}

// ---------------------------------------------------------------------------
// Segment mix - SQO value by seat segment, monthly stacked bars
// ---------------------------------------------------------------------------
// Where the euros come from. Deliberately NOT masked by present mode: segment
// MRR is deal data, not comp-plan data.
const SEG = [
  { key: "micro", label: "Micro", color: C.cyan },
  { key: "smb", label: "SMB", color: C.blue },
  { key: "midmarket", label: "Mid-market", color: C.bloom },
];

function SegmentBars({ months }) {
  // Bars grow from the baseline once on mount - same clock as every other
  // draw-in, so the card animates as one piece.
  const p = useMountProgress(900);
  const totals = months.map((m) => SEG.reduce((a, s) => a + (m.sqo[s.key]?.value || 0), 0));
  const max = Math.max(...totals, 1);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 150 }}>
        {months.map((m, i) => (
          <div
            key={m.month}
            title={SEG.map((s) => `${s.label} ${eur(m.sqo[s.key]?.value || 0)}`).join(" · ")}
            style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}
          >
            <div style={{
              display: "flex", flexDirection: "column-reverse",
              height: `${Math.max((totals[i] / max) * 100, totals[i] > 0 ? 2 : 0) * p}%`,
              borderRadius: 3, overflow: "hidden",
            }}>
              {SEG.map((s) => {
                const v = m.sqo[s.key]?.value || 0;
                if (v <= 0 || totals[i] <= 0) return null;
                return <div key={s.key} style={{ height: `${(v / totals[i]) * 100}%`, background: s.color, opacity: 0.72 }} />;
              })}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 7 }}>
        {months.map((m) => (
          <div key={m.month} style={{ flex: 1, textAlign: "center", font: `400 ${T.micro}px/1 ${FONT_MONO}`, color: C.textHint }}>
            {m.label}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 12 }}>
        {SEG.map((s) => (
          <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, font: `400 ${T.micro}px/1 ${FONT_SANS}`, color: C.textMuted }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, opacity: 0.72 }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function SegmentMixCard({ segmentMonthly, segmentSplit }) {
  const months = segmentMonthly.filter((m) => m.month >= SINCE);
  const sqoYtd = segmentSplit.sqo;
  const totCount = SEG.reduce((a, s) => a + (sqoYtd[s.key]?.count || 0), 0);
  const totValue = SEG.reduce((a, s) => a + (sqoYtd[s.key]?.value || 0), 0);
  const mmValuePct = totValue > 0 ? Math.round(((sqoYtd.midmarket?.value || 0) / totValue) * 100) : 0;
  const mmCountPct = totCount > 0 ? Math.round(((sqoYtd.midmarket?.count || 0) / totCount) * 100) : 0;
  return (
    <Card
      title="Segment mix · SQO value by month"
      right={<SectionLabel>MM is {mmValuePct}% of value on {mmCountPct}% of deals</SectionLabel>}
      style={{ marginTop: 18 }}
    >
      <SegmentBars months={months} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Present-mode toggle
// ---------------------------------------------------------------------------
function PresentToggle({ on, set }) {
  return (
    <button
      onClick={() => set(!on)}
      title={on ? "Commission and quota hidden - safe to screen-share" : "Commission and quota visible"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7, flexShrink: 0,
        padding: "6px 11px", borderRadius: R.sm, cursor: "pointer",
        font: `500 ${T.micro}px/1 ${FONT_SANS}`,
        background: on ? C.amberBg : "transparent",
        border: `1px solid ${on ? C.amberBorder : C.border}`,
        color: on ? C.amber : C.textMuted,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {on ? (
          <>
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
            <line x1="2" y1="2" x2="22" y2="22" />
          </>
        ) : (
          <>
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </>
        )}
      </svg>
      Present mode
    </button>
  );
}

// ---------------------------------------------------------------------------
// Monthly progression - the MQL -> SQL -> SQO ladder in counts and euros
// ---------------------------------------------------------------------------
const PROG_COLS = "48px 1fr 1fr 1.3fr 1fr 1.3fr 0.8fr";

function ProgressionCard({ rows }) {
  const data = rows.filter((r) => r.month >= SINCE);
  const head = { font: `500 ${T.micro}px/1 ${FONT_MONO}`, color: C.textHint, textTransform: "uppercase", letterSpacing: 0.4 };
  const cell = { font: `400 ${T.body - 1}px/1 ${FONT_MONO}`, color: C.textMid, ...NUM };
  const right = { textAlign: "right" };
  return (
    <Card title="Monthly progression" right={<SectionLabel>since Feb</SectionLabel>} style={{ marginTop: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: PROG_COLS, gap: "10px 14px", alignItems: "baseline" }}>
        <span style={head}>Month</span>
        <span style={{ ...head, ...right }}>MQL</span>
        <span style={{ ...head, ...right }}>SQL</span>
        <span style={{ ...head, ...right }}>SQL MRR</span>
        <span style={{ ...head, ...right }}>SQO</span>
        <span style={{ ...head, ...right }}>SQO MRR</span>
        <span style={{ ...head, ...right }}>Rej.</span>
        {data.map((r) => (
          <Fragment key={r.month}>
            <span style={{ ...cell, color: C.textMuted }}>{r.label}</span>
            <span style={{ ...cell, ...right }}>{r.mqlCount.toLocaleString("en-US")}</span>
            <span style={{ ...cell, ...right }}>{r.sqlCount}</span>
            <span style={{ ...cell, ...right }}>{eur(r.sqlValue)}</span>
            <span style={{ ...cell, ...right }}>{r.sqoCount}</span>
            <span style={{ ...cell, ...right, color: C.text }}>{eur(r.sqoValue)}</span>
            <span style={{ ...cell, ...right, color: r.rejectedCount > 0 ? SEMANTIC.risk.fill : C.textHint }}>{r.rejectedCount}</span>
          </Fragment>
        ))}
      </div>
      <div style={{ font: `400 ${T.micro}px/1.6 ${FONT_SANS}`, color: C.textHint, marginTop: 12 }}>
        Values are MRR in home currency (EUR). SQO MRR is the slice of SQL MRR an AE accepted.
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Workday maths
// ---------------------------------------------------------------------------
// Workdays (Mon-Fri) elapsed and total for the month containing `todayIso`.
// Run-rate on calendar days flatters a Monday and punishes a Friday, so pace is
// always computed on workdays. UTC-anchored to dodge DST.
function deriveWorkdays(todayIso) {
  if (!todayIso) return null;
  const today = new Date(todayIso + "T00:00:00Z");
  if (isNaN(today)) return null;
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const dom = today.getUTCDate();
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  let elapsed = 0, total = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(Date.UTC(y, m, d)).getUTCDay();
    if (dow < 1 || dow > 5) continue;
    total += 1;
    if (d <= dom) elapsed += 1;
  }
  return { elapsed, total };
}

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------
// Stalled pending SQLs used to be listed here; they now live in module 07 as
// the first stage of the pipeline, scoped to the current month.
export default function PerformanceModule() {
  const [present, setPresent] = useState(true);
  const p = PERFORMANCE;
  const masked = present;

  const {
    target, earned, pointValue, fullCommission,
    dayOfMonth, daysInMonth, today, workdaysElapsed, workdaysTotal,
  } = p.pacing;

  const commission = target > 0 ? (earned / target) * fullCommission : 0;

  const derived = deriveWorkdays(today);
  const wkElapsed = Math.max(workdaysElapsed ?? derived?.elapsed ?? dayOfMonth, 1);
  const wkTotal = workdaysTotal ?? derived?.total ?? daysInMonth;
  const perDay = earned / wkElapsed;
  const requiredPace = wkTotal > 0 ? target / wkTotal : 0;
  const projected = Math.round(perDay * wkTotal);
  const projectedComm = target > 0 ? (projected / target) * fullCommission : 0;
  const remaining = target - earned;
  const daysLeft = Math.max(wkTotal - wkElapsed, 0);
  const ahead = remaining <= 0;
  // Pace = earned vs what the month should have delivered by today. This is the
  // number that decides the gauge colour and the headline verdict.
  const expected = requiredPace * wkElapsed;
  const pacePct = expected > 0 ? (earned / expected) * 100 : null;
  const paceLevel = pacePct == null ? "idle" : pacePct >= 100 ? "ok" : pacePct >= 80 ? "warn" : "risk";

  const acc = p.acceptance;
  const accTotal = acc.accepted.count + acc.rejected.count + acc.pending.count;
  const accPts = acc.accepted.points + acc.rejected.points + acc.pending.points;
  const decided = acc.accepted.count + acc.rejected.count;
  const accRate = decided > 0 ? (acc.accepted.count / decided) * 100 : null;

  // Year-to-date funnel. Taken from the reconciled rollups rather than re-summed
  // from the per-seat blocks - two routes to the same number is two numbers.
  const fn = p.mqlToSql, sw = p.sqoToWonYtd;
  const funnelStages = fn && sw ? [
    { label: "MQL", value: fn.mqlContacts },
    { label: "SQL", value: fn.sqlContacts },
    { label: "SQO", value: sw.sqo },
    { label: "Won", value: sw.won },
  ] : null;
  // Monthly MQL volume behind the top of that funnel - the trend the ratios sit on.
  const mqlTrend = Object.entries(p.funnel?.mql || {})
    .filter(([k]) => k !== "ytd")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);

  const ytd = p.points.reduce((a, m) => a + m.points, 0);
  const series = p.points.map((m) => ({ x: m.label, y: m.points }));
  const targetLine = p.points.map((m) => ({ x: m.label, y: target }));

  return (
    <Page>
      <PageHeader
        num="04"
        title="Performance"
        sub={`${p.owner} · live from HubSpot · ${p.refreshedAt.split(" - ")[0]}`}
        right={<PresentToggle on={present} set={setPresent} />}
      />

      <StatRow cols={4}>
        <Stat
          label={`Points · ${p.monthLabel}`}
          value={earned}
          of={masked ? null : `of ${target}`}
          note={ahead ? `${Math.abs(remaining)} over target` : `${remaining} to go · ${daysLeft} workdays left`}
          noteLevel={paceLevel}
          size="sm"
        />
        <Stat
          label="Commission earned"
          value={masked ? MASK : eur(commission)}
          note={masked ? "hidden in present mode" : `${earned} pts × ${eur(pointValue)}`}
          size="sm"
        />
        <Stat
          label="Pts / workday"
          value={perDay.toFixed(1)}
          note={`need ${requiredPace.toFixed(1)}`}
          noteLevel={perDay >= requiredPace ? "ok" : "warn"}
          size="sm"
        />
        <Stat
          label="Projected month-end"
          value={projected}
          note={masked ? "at current pace" : `${eur(projectedComm)} at current pace`}
          noteLevel={projected >= target ? "ok" : "warn"}
          size="sm"
        />
      </StatRow>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(330px, 0.85fr) 1fr", gap: 18, marginTop: 22 }}>
        <Card title="Month attainment" right={<SectionLabel>vs pace</SectionLabel>}>
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 6 }}>
            <AttainmentDial earned={earned} target={target} pacePct={pacePct} expected={expected} masked={masked} />
          </div>
          <div style={{
            marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.divider}`,
            display: "flex", alignItems: "center", gap: 9,
          }}>
            <StatusDot level={paceLevel} />
            <span style={{ font: `400 ${T.body - 1}px/1.5 ${FONT_SANS}`, color: C.textMid }}>
              {pacePct == null
                ? "No target set for this month."
                : pacePct >= 100
                  ? `Running ${Math.round(pacePct - 100)}% ahead of where the month should be by now.`
                  : `Sitting at ${Math.round(pacePct)}% of the ${Math.round(expected)} pts this month should have delivered by today.`}
            </span>
          </div>
          <div style={{ font: `400 ${T.micro}px/1.6 ${FONT_SANS}`, color: C.textHint, marginTop: 8, paddingLeft: 15 }}>
            The tick on the dial marks pace. Fill past it means ahead.
          </div>
        </Card>

        <Card
          title={`SQL acceptance · ${acc.month}`}
          right={<SectionLabel>{accTotal} deals · {accPts} pts</SectionLabel>}
        >
          <StatRow cols={3}>
            <Stat label="Accepted" value={acc.accepted.count} note={`${acc.accepted.points} pts`} noteLevel="ok" size="sm" />
            <Stat label="Pending" value={acc.pending.count} note={`${acc.pending.points} pts riding`} noteLevel={acc.pending.count ? "warn" : "idle"} size="sm" />
            <Stat label="Rejected" value={acc.rejected.count} note={`${acc.rejected.points} pts lost`} noteLevel={acc.rejected.count ? "risk" : "idle"} size="sm" />
          </StatRow>
          <div style={{ marginTop: 18 }}>
            <SectionLabel>Acceptance rate</SectionLabel>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
              <span style={{ font: `600 ${T.title}px/1 ${FONT_SANS}`, color: C.text, letterSpacing: TRACK.tight, ...NUM }}>
                {accRate == null ? "-" : `${Math.round(accRate)}%`}
              </span>
              <span style={{ font: `400 ${T.micro}px/1 ${FONT_SANS}`, color: C.textHint }}>
                {decided === 0
                  ? "nothing decided yet this month"
                  : `${acc.accepted.count} of ${decided} decided · ${acc.pending.count} still open`}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {funnelStages && (
        <Card
          title="Pipeline funnel · year to date"
          right={
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <SectionLabel>MQL / month</SectionLabel>
              <Sparkline points={mqlTrend} color={C.bloom} width={88} height={22} delay={200} />
            </div>
          }
          style={{ marginTop: 18 }}
        >
          <FunnelFlow stages={funnelStages} height={170} format={(v) => Math.round(v).toLocaleString("en-US")} />
          <div style={{ font: `400 ${T.micro}px/1.6 ${FONT_SANS}`, color: C.textHint, marginTop: 12 }}>
            Band height is volume, so the taper is the loss. {fn.ratePct}% of MQLs reach SQL;{" "}
            {Math.round((sw.won / fn.mqlContacts) * 100)}% of them end up won.
          </div>
        </Card>
      )}

      <QualityCard
        accByMonth={p.acceptanceByMonth}
        sqoWonByMonth={p.sqoToWonByMonth}
        accYtd={p.acceptanceYtd}
        sqoWonYtd={p.sqoToWonYtd}
      />

      <SegmentMixCard segmentMonthly={p.segmentMonthly} segmentSplit={p.segmentSplit} />

      <ProgressionCard rows={p.progression} />

      <Card title="Points per month" right={<SectionLabel>{ytd} pts YTD</SectionLabel>} style={{ marginTop: 18 }}>
        <AreaChart
          series={series}
          reference={target > 0 ? [{ points: targetLine, color: C.amber, dash: "4 5", opacity: 0.55 }] : []}
          color={C.blue}
          height={186}
          yMax={Math.max(target, ...p.points.map((m) => m.points), 1) * 1.15}
          xLabels={p.points.map((m) => m.label)}
          format={(v) => `${v} pts`}
        />
        <div style={{ font: `400 ${T.micro}px/1 ${FONT_SANS}`, color: C.textHint, marginTop: 10 }}>
          Dashed line is the {masked ? "monthly" : `${target}-point`} target. Hover a month for the exact figure.
        </div>
      </Card>

      <div style={{
        font: `400 ${T.micro}px/1.7 ${FONT_MONO}`, color: C.textFaint,
        marginTop: 26, paddingTop: 14, borderTop: `1px solid ${C.divider}`,
      }}>
        SQL = deals where deal_creator = {p.owner} (ownerId {p.ownerId}), by create date. SQO = deal_accepted_by_ae = Yes.<br />
        Points = deal_sdr_points_number. {POINTS_QUOTA_PER_MONTH} pts/month = 100% = {masked ? MASK : eur(fullCommission)}. Source: HubSpot {PORTAL_ID}.
      </div>
    </Page>
  );
}
