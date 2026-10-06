// Deals module (07) configuration.
//
// Stage IDs, timezone mapping and constants for the deal-outcome tracker.
// Not generated. Edited by hand when pipelines, target or roster change.

// HubSpot deal stage IDs (pipeline-specific)
export const WON_STAGES = new Set(["6607659", "9474198", "24316488"]);
export const LOST_STAGES = new Set(["6607660", "9474199", "24316489"]);

// Office timezones used for local-time rendering and speed-to-demo calc
export const TZ = { BCN: "Europe/Madrid", TOR: "America/Toronto" };
export const HOME_TZ = "Europe/Madrid";

// Roster - replace with your own HubSpot owner ID and name from config.js.
// The cohort is "deals I created", so there is exactly one SDR here; the key
// stays a map because the HubSpot pull filters on deal_creator__sdr_only_ and
// the lookup wants the id as the key.
export const ROSTER = { "__OWNER_ID__": { name: "__OWNER_NAME__", office: "__OFFICE__" } };

// The AE SLA. An AE has this long from the demo to accept or reject. Past it the
// deal is breaching and the module says so in red - that is the single number the
// whole module is built to surface, so it lives here and nowhere else.
export const SLA_HOURS = 48;

// The official quota is points, not euros - 90 accepted-deal points a month.
// That number is verified and is what commission actually pays on.
export const POINTS_QUOTA = 90;

// Monthly accepted-MRR benchmark (EUR). This is NOT an official target - it is a
// hand-set run-rate line, currently the trailing three-month average of accepted
// MRR (Jul-Sep 2026: 12.3k / 10.2k / 11.9k). It exists so the euro bar has
// something to read against. Edit it when the real number is known; do not treat
// the progress bar as attainment against a quota.
export const MONTHLY_TARGET_EUR = 12000;

// Segment brackets on amount_in_home_currency (EUR MRR)
export function segOf(amt) {
  if (amt == null || isNaN(amt)) return "none";
  if (amt < 500) return "micro";
  if (amt <= 1500) return "smb";
  return "mm";
}
export const SEG_LABEL = { micro: "Micro", smb: "SMB", mm: "Mid-Market", none: "No amount" };

// The four outcome columns, in the order they are shown. Left to right is the
// deal's actual journey, so a column that is filling up tells you where the
// month is stuck without reading a single number.
export const COLUMNS = [
  { id: "upcoming", label: "Upcoming",         hint: "Demo booked, not yet held" },
  { id: "pending",  label: "Awaiting decision", hint: "Demo held, AE has not ruled" },
  { id: "accepted", label: "Accepted",          hint: "AE took the deal" },
  { id: "rejected", label: "Rejected",          hint: "AE sent it back" },
];

export const OUTCOME_LEVEL = {
  upcoming: "idle",
  pending: "warn",
  accepted: "ok",
  rejected: "risk",
};

// No-show status classification
export function noShowState(s) {
  if (!s) return "ok";
  if (s.indexOf("Demo Rescheduled") >= 0) return "rescheduled";
  if (s.indexOf("Demo No Show") >= 0 || s.indexOf("Demo Not Rescheduled") >= 0) return "noshow";
  return "ok";
}
