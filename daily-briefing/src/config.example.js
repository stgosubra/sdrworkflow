// Per-operator configuration - the ONLY place identity and quota are declared.
//
// This dashboard is installed per SDR/SE: same modules, same layout, same
// metric definitions, different owner. Everything that differs between two
// installs lives in this file and nowhere else. `OWNER` used to be declared
// twice (src/lib/palette.js and src/modules/briefing/BriefingModule.jsx) with
// identical literals, which is exactly the kind of duplicate that drifts.
//
// This is the committed TEMPLATE. `npm install` copies it to src/config.js when
// that file is absent, and src/config.js is gitignored - so the repo can be
// public without publishing anyone's real name, email or HubSpot owner id.
//
// The install skill (skill/install/SKILL.md) rewrites the PROFILE block in the
// copy, not here. Editing src/config.js by hand afterwards is fine - nothing
// regenerates it.

// --- rewritten at install -------------------------------------------------
export const PROFILE = {
  name: "__OWNER_NAME__",
  initials: "__INITIALS__",
  title: "__JOB_TITLE__",
  email: "__OWNER_EMAIL__",
  ownerId: 0,
  timezone: "__TIMEZONE__",
};
// --- end install block ----------------------------------------------------

// Shared across every install on the same HubSpot instance. Not per-operator.
export const PORTAL_ID = 6195055;

// Commission quota. Raised 80 -> 90 on 2026-07-22; pacing and attainment are
// computed against this, so a stale value silently misreports attainment.
export const POINTS_QUOTA_PER_MONTH = 90;

// Back-compat alias: `OWNER` is the name the shell and modules already import.
// Kept as a derived view of PROFILE so there is still one source of truth.
export const OWNER = {
  name: PROFILE.name,
  ownerId: PROFILE.ownerId,
  portalId: PORTAL_ID,
  email: PROFILE.email,
};

// Optional: name -> HubSpot owner id for the rest of the team. Used only to
// deep-link a leaderboard row into that person's rejected-deals view; every
// caller guards on a miss, so leaving this empty costs one link and nothing
// else. Deliberately empty in the template - a roster of colleagues' names and
// internal ids does not belong in a public repo. Fill it locally if you want
// the links.
export const OWNER_IDS = {};

// How a phone number becomes a click.
//
// The number as HubSpot stores it is for reading - "+34 673 05 02 38" - and a
// space makes the URI invalid, so the browser drops the click silently. That is
// not a handler problem, it is a malformed-URL problem, and it looked identical
// from the outside. `dialUrl` strips to E.164 first, every time.
//
// `DIAL_SCHEME` then decides who answers:
//   "tel"    - hands off to whatever the OS registered. Works only if something
//              actually claims tel: - the CloudTalk Phone desktop app, FaceTime,
//              or a softphone. Nothing registered means nothing happens.
//   "callto" - the older scheme some softphones claim instead of tel:.
//   "none"   - render the number as plain selectable text and let the CloudTalk
//              browser extension find it. No link, no dead click.
export const DIAL_SCHEME = "tel";

export const toE164 = (phone) => {
  if (!phone) return null;
  const s = String(phone).trim();
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return null;
  return s.startsWith("+") ? `+${digits}` : digits;
};

export const dialUrl = (phone) => {
  const n = toE164(phone);
  if (!n || DIAL_SCHEME === "none") return null;
  return `${DIAL_SCHEME}:${n}`;
};

export const hsContactUrl = (id) =>
  `https://app.hubspot.com/contacts/${PORTAL_ID}/record/0-1/${id}`;
// 0-1 contact, 0-2 company, 0-3 deal.
export const hsDealUrl = (id) =>
  `https://app.hubspot.com/contacts/${PORTAL_ID}/record/0-3/${id}`;
