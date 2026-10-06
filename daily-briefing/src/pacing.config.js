// EXAMPLE ROSTER - replace with your team's real names and HubSpot owner IDs
//
// SDR Pacing module configuration - monthly finance input.
//
// Updated at the start of each month with targets, roster changes, and holidays.
// Targets come from one team pool divided by working days, with Toronto's daily
// rate set 10% above Barcelona's. SDR Name 12 runs at half quota (Team Lead).
//
// This file is NOT generated. It is edited by hand when:
//   - A new month starts (new MONTH block, archive the old one)
//   - The roster changes (someone joins, leaves, or switches office)
//   - Holiday calendars are confirmed
//
// Contains no customer data. Safe to commit.

// ── Current month ────────────────────────────────────────────────────────────

export const CURRENT_MONTH = {
  year: 2026,
  month: 10, // 1-indexed (10 = October)
  label: "October",

  // Shared holidays (both offices closed)
  offAll: ["2026-10-12"], // Fiesta Nacional (ES) + Thanksgiving (CA)

  // Team pool targets (EUR MRR)
  pool: {
    sql: 313248,
    sqo: 222519,
  },

  // Office split
  offices: {
    BCN: { label: "Barcelona", region: "EMEA", workingDays: 21 },
    TOR: { label: "Toronto",   region: "NA",   workingDays: 21 },
  },

  // Roster: id = HubSpot owner ID, sql/sqo = individual monthly target (EUR MRR)
  roster: [
    { id: "100000001",  name: "SDR Name 1",   office: "BCN", sql: 26746, sqo: 18999, off: [] },
    { id: "100000002",  name: "SDR Name 2",   office: "BCN", sql: 20378, sqo: 14476, off: ["2026-10-01","2026-10-02","2026-10-05","2026-10-06","2026-10-07"], note: "5 days off" },
    { id: "100000003",  name: "SDR Name 3",   office: "BCN", sql: 26746, sqo: 18999, off: [] },
    { id: "100000004",  name: "SDR Name 4",   office: "BCN", sql: 26746, sqo: 18999, off: [] },
    { id: "100000005",  name: "SDR Name 5",   office: "BCN", sql: 26746, sqo: 18999, off: [] },
    { id: "100000006",  name: "SDR Name 6",   office: "BCN", sql: 26746, sqo: 18999, off: [] },
    { id: "100000007",  name: "SDR Name 7",   office: "BCN", sql: 26746, sqo: 18999, off: [] },
    { id: "100000008",  name: "SDR Name 8",   office: "TOR", sql: 29421, sqo: 20899, off: [] },
    { id: "100000009",  name: "SDR Name 9",   office: "TOR", sql: 29421, sqo: 20899, off: [] },
    { id: "100000010",  name: "SDR Name 10",  office: "TOR", sql: 29421, sqo: 20899, off: [] },
    { id: "100000011",  name: "SDR Name 11",  office: "TOR", sql: 29421, sqo: 20899, off: [] },
    { id: "100000012",  name: "SDR Name 12",  office: "TOR", sql: 14710, sqo: 10450, off: [], note: "Team Lead, half quota" },
  ],
};

// ── Previous month (frozen snapshot, rendered on the history tab) ─────────────

export const PREVIOUS_MONTH = {
  year: 2026,
  month: 9,
  label: "September",
  sdrCount: 13,
  note: "SDR Name 13 included",

  team: { sqlMrr: 216039, sqlTarget: 313248, sqoMrr: 175577, sqoTarget: 222519, sqlDeals: 686, sqoDeals: 557 },
  BCN:  { sqlMrr: 120288, sqlTarget: 157861, sqoMrr: 101768, sqoTarget: 112141, sqlDeals: 413, sqoDeals: 342 },
  TOR:  { sqlMrr: 95751,  sqlTarget: 155387, sqoMrr: 73808,  sqoTarget: 110378, sqlDeals: 273, sqoDeals: 215 },

  // [office, name, sqlActual, sqlTarget, sqoActual, sqoTarget]
  people: [
    ["BCN", "SDR Name 5",   22508, 22374, 20524, 15894],
    ["BCN", "SDR Name 6",   16905, 19888, 12860, 14128],
    ["BCN", "SDR Name 4",   20672, 24860, 13670, 17660],
    ["BCN", "SDR Name 3",   19322, 24860, 16144, 17660],
    ["BCN", "SDR Name 7",   12471, 16159, 11736, 11479],
    ["BCN", "SDR Name 1",   16224, 24860, 13574, 17660],
    ["BCN", "SDR Name 2",   12187, 24860, 13261, 17660],
    ["TOR", "SDR Name 8",   24871, 28497, 19944, 20244],
    ["TOR", "SDR Name 10",  22919, 28497, 13857, 20244],
    ["TOR", "SDR Name 12",  10667, 14259,  7154, 10122],
    ["TOR", "SDR Name 13",  19066, 28497, 18770, 20244],
    ["TOR", "SDR Name 11",  14357, 27140, 10616, 19280],
    ["TOR", "SDR Name 9",    3869, 28497,  3467, 20244],
  ],
};

// ── Working-day calculator ───────────────────────────────────────────────────
// Returns { total, elapsed, left } for a given person in the current month.
// "today" is not counted as elapsed (it is a day still to be worked).

export function calFor(person, todayIso, cfg = CURRENT_MONTH) {
  const offAll = new Set(cfg.offAll || []);
  const offPersonal = new Set(person.off || []);
  const [ty, tm, td] = todayIso.split("-").map(Number);
  const today = new Date(Date.UTC(ty, tm - 1, td));

  let total = 0, elapsed = 0;
  const year = cfg.year;
  const month = cfg.month - 1; // 0-indexed for Date

  for (let d = new Date(Date.UTC(year, month, 1)); d.getUTCMonth() === month; d.setUTCDate(d.getUTCDate() + 1)) {
    const w = d.getUTCDay();
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    if (w === 0 || w === 6 || offAll.has(iso) || offPersonal.has(iso)) continue;
    total++;
    if (d < today) elapsed++;
  }
  return { total, elapsed, left: total - elapsed };
}
