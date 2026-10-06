// Single source of truth for the module registry.
//
// Both consumers read from here:
//   - Shell.jsx      builds the nav rail + command palette, attaching `component`
//   - dashboard/     builds the Constellation tiles, attaching `icon`
//
// Those two fields stay with their consumers because they are not data: one needs
// the module imports, the other needs the inline SVG map. Everything else lives
// here so the list cannot drift between the rail and the tiles again.
//
// Fields:
//   id      stable key, matches the directory under src/modules/ and the Icon key
//   num     two-digit display number; also what the command palette searches
//   label   nav + tile title
//   sub     one-line subtitle
//   accent  palette accent key (see lib/tokens.js)
//   status  "live" - the only value. Kept because the nav renders a live dot from it
//   signal  static one-line metric shown on the tile; null means the tile computes
//           it at render time (module 02 derives it from live briefing data)
//   primary marks the single hero tile on the Constellation

export const MODULES = [
  { id: "dashboard",   num: "01", label: "Dashboard",   sub: "What needs you",   accent: "purple",  status: "live" },
  { id: "briefing",    num: "02", label: "Today",       sub: "Schedule",         accent: "blue",    status: "live", signal: null,                 primary: true },
  { id: "calculator",  num: "03", label: "Calculator",  sub: "Minutes / cost",   accent: "blue",    status: "live", signal: "Cost - Minutes" },
  { id: "performance", num: "04", label: "Performance", sub: "SQL / SQO",        accent: "emerald", status: "live", signal: "SQL / SQO tracker" },
  { id: "selfserved",  num: "05", label: "Self-Served", sub: "Untouched MQLs",   accent: "emerald", status: "live", signal: "Re-engage cohort" },
  { id: "pacing",      num: "06", label: "SDR Pacing",  sub: "Team tracker",     accent: "orange",  status: "live", signal: "SQL / SQO pacing" },
  { id: "deals",       num: "07", label: "Pipeline",    sub: "Qualified to AE",  accent: "amber",   status: "live", signal: "Pipeline stages" },
];

// The Constellation shows every module except itself.
export const TILE_MODULES = MODULES.filter((m) => m.id !== "dashboard");
