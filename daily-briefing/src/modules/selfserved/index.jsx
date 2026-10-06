// Module 05 - Self-Served.
//
// Contacts who activated a CloudTalk account on their own and are not being
// worked. The module's job is to order them by how perishable the opening is,
// not by how big the logo looks - so activation recency leads and the composite
// quality score only breaks ties.
//
// The funnel strip above the list is the audit trail. Every number that was
// filtered out is shown and named, because a cohort you cannot reconstruct is a
// cohort nobody trusts.

import { useState, createContext, useContext, useMemo } from "react";
import { SELFSERVED, isOnboardingAlert, ONBOARD_MIN_DAYS, ONBOARD_MAX_DAYS, GENERATED_AT } from "./data.js";
import {
  Page, PageHeader, Card, SectionLabel, Stat, StatRow, StatusDot, Badge,
  Glyph, DataList, DataRow, TabBar, ProgressBar, Empty,
} from "../../design/ui.jsx";
import { C, R, T, TRACK, NUM, SEMANTIC, FONT_SANS, FONT_MONO } from "../../lib/tokens.js";

// Present mode masks email and phone so the module can go on a shared screen
// without redacting by hand. Context rather than a prop because the mask applies
// to leaf cells several levels down.
const MaskCtx = createContext(false);
const useMasked = () => useContext(MaskCtx);
const MASK = "•••••••";

const TIER_LEVEL = { T1: "ok", T2: "warn", T3: "idle" };

const FLAG = {
  australia: "🇦🇺", sweden: "🇸🇪", spain: "🇪🇸", france: "🇫🇷", germany: "🇩🇪",
  netherlands: "🇳🇱", norway: "🇳🇴", romania: "🇷🇴", portugal: "🇵🇹", pakistan: "🇵🇰",
  cameroon: "🇨🇲", cyprus: "🇨🇾", italy: "🇮🇹", nigeria: "🇳🇬", "united kingdom": "🇬🇧",
  poland: "🇵🇱", ireland: "🇮🇪",
};
const flagOf = (c) => FLAG[(c || "").toLowerCase()] || "🏳";

function daysAgo(iso, today) {
  if (!iso) return null;
  const a = new Date(iso.includes("T") ? iso : iso + "T00:00:00Z");
  const b = new Date(today + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
}

const RECENCY_OPTS = [14, 30, 60, 90];

// ---------------------------------------------------------------------------
// Funnel - how the active cohort narrowed to the eligible one
// ---------------------------------------------------------------------------
// A row of numbers with arrows between them was readable but gave every step the
// same weight. This gives each step a bar proportional to the one before it, so
// the size of each drop is visible rather than something you compute in your head.
function Funnel({ f }) {
  const steps = [
    { n: f.activeInWindow, label: "Active in window", note: "self-served accounts that went live", level: "idle" },
    { n: f.qualified, label: "Already qualified", note: "actively worked - out of this play", level: "idle" },
    { n: f.nonQualified, label: "Not qualified", note: "the pool this module draws from", level: "warn" },
    { n: f.disqualifiedByDeal, label: "Has a won deal", note: "removed - already a customer motion", level: "risk" },
    { n: f.eligible, label: "Eligible", note: "no open or won deal anywhere on the record", level: "ok" },
  ];
  const top = Math.max(...steps.map((s) => s.n), 1);

  return (
    <Card title="How the cohort narrowed" right={<SectionLabel>{f.eligible} eligible</SectionLabel>}>
      <DataList>
        {steps.map((s, i) => (
          <DataRow key={s.label} last={i === steps.length - 1}>
            <div style={{
              width: 48, textAlign: "right", flex: "none",
              font: `600 ${T.bodyLg}px/1 ${FONT_SANS}`,
              color: SEMANTIC[s.level].fill, ...NUM,
            }}>
              {s.n}
            </div>
            <div style={{ width: 170, flex: "none" }}>
              <div style={{ font: `500 ${T.body}px/1.2 ${FONT_SANS}`, color: C.text }}>{s.label}</div>
            </div>
            <div style={{ flex: 1, minWidth: 80 }}>
              <ProgressBar pct={(s.n / top) * 100} level={s.level} />
            </div>
            <div style={{
              width: 260, flex: "none", textAlign: "right",
              font: `400 ${T.micro}px/1.3 ${FONT_SANS}`, color: C.textHint,
            }}>
              {s.note}
            </div>
          </DataRow>
        ))}
      </DataList>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Lead row
// ---------------------------------------------------------------------------
// Expands in place rather than opening a panel. Collapsed, a row carries the
// four things that decide whether to call: how fresh the activation is, how big
// the account could be, where it is, and whether anyone has touched it. The rest
// is detail you only want once you have decided.
const LEAD_COLS = "40px minmax(200px, 1.5fr) 104px 128px 124px 90px";

function LeadRow({ item, today, last, open, onToggle }) {
  const masked = useMasked();
  const active = daysAgo(item.account_became_active, today);
  const lastTouch = daysAgo(item.engagement.notes_last_contacted, today);
  const alert = isOnboardingAlert(item, today);
  const name = `${item.firstname} ${item.lastname}`.trim();
  const seatLabel = item.seats.seat_range || item.seats.seats_indicated__aggregated_ || "?";

  // Fresher activation is a hotter opening. Inside the onboarding window it is
  // also time-boxed, which is why that case outranks plain recency.
  const level = alert ? "risk" : active != null && active <= 14 ? "ok" : "idle";

  return (
    <>
      <DataRow
        last={last && !open}
        onClick={onToggle}
        style={{ display: "grid", gridTemplateColumns: LEAD_COLS, alignItems: "center", padding: "13px 8px" }}
      >
        <Glyph level={level} size={32}>{item.rank_score}</Glyph>

        <div style={{ minWidth: 0, paddingRight: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 13, flex: "none" }}>{flagOf(item.country)}</span>
            <span style={{
              font: `500 ${T.body}px/1.2 ${FONT_SANS}`, color: C.text,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {name}
            </span>
            {item.closedLostFlag && <Badge level="warn" mono>RE-ENGAGE</Badge>}
          </div>
          <div style={{
            font: `400 ${T.micro}px/1.3 ${FONT_SANS}`, color: C.textHint, marginTop: 4,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {item.company?.name || "-"}{item.jobtitle ? ` · ${item.jobtitle}` : ""}
          </div>
        </div>

        <Cell
          value={active != null ? `${active}d` : "-"}
          note="since activation"
          level={alert ? "risk" : active != null && active <= 14 ? "ok" : null}
        />
        <Cell value={seatLabel} note={`seats · ${item.seat_tier}`} />
        <Cell
          value={lastTouch != null ? `${lastTouch}d` : "never"}
          note={`${item.engagement.num_contacted_notes} touch${item.engagement.num_contacted_notes === 1 ? "" : "es"}`}
          level={lastTouch == null ? "warn" : null}
        />

        <div style={{ textAlign: "right" }}>
          {alert ? (
            <Badge level="risk" mono>ONBOARD</Badge>
          ) : (
            <span style={{ font: `400 ${T.micro}px/1 ${FONT_SANS}`, color: C.textFaint }}>
              {open ? "close" : "details"}
            </span>
          )}
        </div>
      </DataRow>

      {open && (
        <div style={{
          padding: "16px 8px 20px 56px",
          borderBottom: last ? "none" : `1px solid ${C.divider}`,
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Badge level={TIER_LEVEL[item.seat_tier]} mono>SEATS {seatLabel} · {item.seat_tier}</Badge>
            <Badge level={TIER_LEVEL[item.geo_tier]} mono>{(item.country || "?").toUpperCase()} · {item.geo_tier}</Badge>
            <Badge level={TIER_LEVEL[item.source_tier]} mono>{(item.lead_source || "?").toUpperCase()} · {item.source_tier}</Badge>
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 18,
          }}>
            <Detail label="Activated" value={item.account_became_active || "-"} sub={active != null ? `${active} days ago` : null} />
            <Detail label="Trial" value={item.active_trial ? "Active" : "-"} sub={item.ct_account_status} />
            <Detail label="Lead status" value={item.hs_lead_status_label || item.hs_lead_status} sub={item.lifecyclestage} />
            <Detail label="Domain" value={item.company?.domain || "-"} />
            <Detail label="Email" value={masked ? MASK : item.email} mono />
            <Detail label="Phone" value={masked ? MASK : item.phone} mono />
          </div>

          {item.hygieneFlag && (
            <div style={{
              font: `400 ${T.micro}px/1.5 ${FONT_SANS}`, color: SEMANTIC.warn.fill,
              background: SEMANTIC.warn.bg, border: `1px solid ${SEMANTIC.warn.border}`,
              borderRadius: R.sm, padding: "9px 12px",
            }}>
              {item.hygieneFlag}
            </div>
          )}

          <a
            href={item.hsLink}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              alignSelf: "flex-start",
              font: `400 ${T.micro}px/1 ${FONT_MONO}`, color: C.emerald,
              textDecoration: "none", padding: "7px 11px", borderRadius: R.sm,
              background: C.emeraldBg, border: `1px solid ${C.emeraldBorder}`,
            }}
          >
            open in HubSpot →
          </a>
        </div>
      )}
    </>
  );
}

function Cell({ value, note, level }) {
  return (
    <div style={{ paddingRight: 12 }}>
      <div style={{
        font: `500 ${T.body}px/1.2 ${FONT_SANS}`,
        color: level ? SEMANTIC[level].fill : C.text, ...NUM,
      }}>
        {value}
      </div>
      {note && (
        <div style={{ font: `400 ${T.label}px/1.3 ${FONT_SANS}`, color: C.textFaint, marginTop: 4 }}>
          {note}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, sub, mono }) {
  return (
    <div style={{ minWidth: 0 }}>
      <SectionLabel>{label}</SectionLabel>
      <div style={{
        font: `400 ${T.micro + 1}px/1.3 ${mono ? FONT_MONO : FONT_SANS}`,
        color: C.textMid, marginTop: 6, wordBreak: "break-word",
      }}>
        {value || "-"}
      </div>
      {sub && (
        <div style={{ font: `400 ${T.label}px/1.3 ${FONT_SANS}`, color: C.textFaint, marginTop: 3 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Excluded tab - the audit trail
// ---------------------------------------------------------------------------
function ExcludedTab({ ne, today, maxDays }) {
  const wonDeal = ne.wonDeal.filter((x) => {
    const a = daysAgo(x.account_became_active, today);
    return a != null && a <= maxDays;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {maxDays >= 90 && (
        <Card title="Already qualified" right={<SectionLabel>{ne.qualifiedCount} contacts</SectionLabel>}>
          <div style={{ font: `400 ${T.micro + 1}px/1.6 ${FONT_SANS}`, color: C.textMuted, maxWidth: "72ch" }}>
            Being actively worked, so by definition out of the self-serve play. They
            are not listed individually because there is nothing to action here - the
            count exists so the funnel above reconciles.
          </div>
        </Card>
      )}

      <Card
        title="Removed for a won deal"
        right={<SectionLabel>{wonDeal.length} within {maxDays}d</SectionLabel>}
      >
        {wonDeal.length === 0 ? (
          <Empty level="ok">No won-deal contacts activated within {maxDays} days.</Empty>
        ) : (
          <DataList>
            {wonDeal.map((x, i) => {
              const active = daysAgo(x.account_became_active, today);
              return (
                <DataRow key={x.hsObjectId} last={i === wonDeal.length - 1}>
                  <Glyph level="ok" size={30}>{flagOf(x.country)}</Glyph>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ font: `500 ${T.body}px/1.2 ${FONT_SANS}`, color: C.text }}>
                      {x.firstname} {x.lastname}
                    </div>
                    <div style={{ font: `400 ${T.micro}px/1.3 ${FONT_SANS}`, color: C.textHint, marginTop: 4 }}>
                      activated {active != null ? `${active}d ago` : "-"} · {x.deal.name}
                    </div>
                  </div>
                  <div style={{
                    font: `500 ${T.body}px/1 ${FONT_SANS}`, color: SEMANTIC.ok.fill, ...NUM,
                  }}>
                    €{x.deal.amount}
                  </div>
                </DataRow>
              );
            })}
          </DataList>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
export default function SelfServedModule() {
  const [present, setPresent] = useState(false);
  const [maxDays, setMaxDays] = useState(90);
  const [tab, setTab] = useState("eligible");
  const [openId, setOpenId] = useState(null);

  const d = SELFSERVED;

  // Recency first, score only to break ties. The composite score is a quality
  // signal, not a priority - a strong lead that activated two months ago has
  // already formed its habits.
  const items = useMemo(() => {
    return d.items
      .filter((it) => {
        const a = daysAgo(it.account_became_active, d.today);
        return a != null && a <= maxDays;
      })
      .sort((a, b) => {
        if (a.account_became_active !== b.account_became_active) {
          return a.account_became_active < b.account_became_active ? 1 : -1;
        }
        return b.rank_score - a.rank_score;
      });
  }, [d.items, d.today, maxDays]);

  const counts = useMemo(() => {
    return RECENCY_OPTS.reduce((m, opt) => {
      m[opt] = d.items.filter((it) => {
        const a = daysAgo(it.account_became_active, d.today);
        return a != null && a <= opt;
      }).length;
      return m;
    }, {});
  }, [d.items, d.today]);

  const onboardCount = items.filter((it) => isOnboardingAlert(it, d.today)).length;
  const untouched = items.filter((it) => !it.engagement.notes_last_contacted).length;

  return (
    <MaskCtx.Provider value={present}>
      <Page>
        <PageHeader
          num="05 · Self-Served"
          title="Untouched self-served accounts"
          sub={`${d.owner} · activated between ${d.windowStart} and ${d.windowEnd} · no open or won deal`}
          right={
            <button
              onClick={() => setPresent((v) => !v)}
              title={present ? "PII hidden for screen-share" : "Hide email and phone for screen-share"}
              style={{
                font: `400 ${T.micro}px/1 ${FONT_SANS}`,
                color: present ? SEMANTIC.warn.fill : C.textHint,
                background: present ? SEMANTIC.warn.bg : C.wellBg,
                border: `1px solid ${present ? SEMANTIC.warn.border : C.borderStrong}`,
                borderRadius: R.pill, padding: "7px 13px", cursor: "pointer",
              }}
            >
              {present ? "PII hidden" : "Present mode"}
            </button>
          }
        />

        <StatRow>
          <Stat
            size="sm" label="Eligible" value={items.length}
            note={maxDays < 90 ? `of ${d.items.length} in the full window` : "nobody is working these"}
          />
          <Stat
            size="sm" label="In onboarding window" value={onboardCount}
            note={`activated ${ONBOARD_MIN_DAYS}-${ONBOARD_MAX_DAYS} days ago`}
            noteLevel={onboardCount > 0 ? "risk" : undefined}
          />
          <Stat
            size="sm" label="Never contacted" value={untouched}
            note="no note on the record at all"
            noteLevel={untouched > 0 ? "warn" : undefined}
          />
          <Stat
            size="sm" label="Filtered out" value={d.funnel.activeInWindow - d.funnel.eligible}
            note="qualified or already a customer"
          />
        </StatRow>

        {onboardCount > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 11,
            marginTop: 20,
            background: SEMANTIC.risk.bg, border: `1px solid ${SEMANTIC.risk.border}`,
            borderRadius: R.md, padding: "12px 15px",
            font: `400 ${T.micro + 1}px/1.5 ${FONT_SANS}`, color: C.textMid,
          }}>
            <StatusDot level="risk" />
            <span>
              <strong style={{ color: SEMANTIC.risk.fill, fontWeight: 500 }}>
                {onboardCount} account{onboardCount === 1 ? "" : "s"} activated {ONBOARD_MIN_DAYS}-{ONBOARD_MAX_DAYS} days ago
              </strong>
              {" - past first touch, before habits set. This is the window where an onboarding call still changes the outcome."}
            </span>
          </div>
        )}

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 16, flexWrap: "wrap", margin: "22px 0 18px",
        }}>
          <TabBar
            value={tab}
            onChange={setTab}
            cycleShortcut
            tabs={[
              { id: "eligible", label: `Eligible · ${items.length}` },
              { id: "funnel", label: "Cohort audit" },
              { id: "excluded", label: "Excluded" },
            ]}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <SectionLabel>Activated within</SectionLabel>
            <TabBar
              size="sm"
              value={maxDays}
              onChange={setMaxDays}
              tabs={RECENCY_OPTS.map((o) => ({
                id: o,
                label: `${o === 90 ? "90d all" : `${o}d`} · ${counts[o]}`,
              }))}
            />
          </div>
        </div>

        {tab === "funnel" ? (
          <Funnel f={d.funnel} />
        ) : tab === "excluded" ? (
          <ExcludedTab ne={d.notEligible} today={d.today} maxDays={maxDays} />
        ) : items.length === 0 ? (
          <Card>
            <Empty level="idle">
              Nothing activated within {maxDays} days. {d.items.length} sit in the full
              90-day window - widen the filter to see them.
            </Empty>
          </Card>
        ) : (
          <Card title="Eligible accounts" right={<SectionLabel>newest activation first</SectionLabel>}>
            <div style={{
              display: "grid", gridTemplateColumns: LEAD_COLS, gap: 12,
              padding: "0 8px 10px", margin: "0 -8px",
              borderBottom: "1px solid transparent",
          borderImage: `linear-gradient(90deg, ${C.border} 70%, transparent) 1`,
            }}>
              <SectionLabel>Score</SectionLabel>
              <SectionLabel>Contact</SectionLabel>
              <SectionLabel>Age</SectionLabel>
              <SectionLabel>Size</SectionLabel>
              <SectionLabel>Last touch</SectionLabel>
              <SectionLabel style={{ textAlign: "right" }}>&nbsp;</SectionLabel>
            </div>
            {items.map((it, i) => (
              <LeadRow
                key={it.hsObjectId}
                item={it}
                today={d.today}
                last={i === items.length - 1}
                open={openId === it.hsObjectId}
                onToggle={() => setOpenId(openId === it.hsObjectId ? null : it.hsObjectId)}
              />
            ))}
          </Card>
        )}

        <div style={{
          marginTop: 32, paddingTop: 18, borderTop: `1px solid ${C.border}`,
          font: `400 ${T.micro}px/1.6 ${FONT_SANS}`, color: C.textHint, maxWidth: "88ch",
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          <p style={{ margin: 0 }}>
            Cohort = contacts owned by {d.owner} (owner {d.ownerId}), lead status not
            Qualified, account activated between {d.windowStart} and {d.windowEnd}, with
            zero open or won deals on the contact or any associated company.
            Closed-lost-only contacts are kept and flagged RE-ENGAGE.
          </p>
          <p style={{ margin: 0 }}>
            Score = seats {Math.round(d.weights.seat * 100)}% · geo {Math.round(d.weights.geo * 100)}%
            {" "}· source {Math.round(d.weights.source * 100)}% (T1 100, T2 66, T3 33). It only
            breaks ties - the list is ordered by activation recency, because that is the
            thing that expires.
            {GENERATED_AT && (
              <span style={{ fontFamily: FONT_MONO, color: C.textFaint }}>
                {" "}HubSpot {d.portalId}, pulled{" "}
                {new Date(GENERATED_AT).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.
              </span>
            )}
          </p>
        </div>
      </Page>
    </MaskCtx.Provider>
  );
}
