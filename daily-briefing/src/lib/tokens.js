// Design tokens - the single source of truth for every colour, radius, shadow
// and type step in the app.
//
// Before this file there were four palettes: lib/palette.js, design/tokens.js and
// a local `C` inside briefing, performance and selfserved. Switching modules
// changed the canvas colour, which made one app look like three. Nothing may
// define a colour outside this file.
//
// Palette direction: warm charcoal canvas lit by a magenta/violet ambient, with
// translucent card surfaces that carry a lit top edge. Depth comes from layered
// translucency rather than flat fills.
//
// Colour is still spent on state, not decoration - see SEMANTIC below. The
// ambient is deliberately kept under 0.10 alpha and pushed to the page margins so
// it never sits behind a number: a tinted field under red and amber is exactly
// how an alert stops reading as an alert.

// ---------------------------------------------------------------------------
// Canvas and surfaces
// ---------------------------------------------------------------------------
const CANVAS = "#0B0910";

export const C = {
  bg: CANVAS,
  // Three washes, all off-centre: fuchsia bleeding from the top-left, violet
  // answering from the right, and a deep plum floor. Together they give the
  // canvas a direction of light, which is the single biggest difference between
  // "dark theme" and "looks expensive".
  // Positions are tuned to the content column, not the viewport - the rail
  // occupies the first ~15% and a wash centred there is a wash nobody sees.
  bgGlow: [
    "radial-gradient(1100px 620px at 26% -8%, rgba(217,70,239,0.20), transparent 62%)",
    "radial-gradient(1000px 560px at 82% 2%, rgba(124,58,237,0.17), transparent 64%)",
    "radial-gradient(1400px 900px at 55% 112%, rgba(91,33,182,0.14), transparent 70%)",
    CANVAS,
  ].join(", "),

  // Solid surfaces - rail, popovers, anything that must occlude what is behind it.
  surface: "#100D16",
  surfaceAlt: "#17131F",

  // Card fill. Translucent and warm so the ambient reads through it, with the lit
  // top edge supplied by SHADOW.card's inset rather than a second border.
  cardBg: "linear-gradient(152deg, rgba(58,44,78,0.40), rgba(22,17,32,0.26))",
  cardBgHover: "linear-gradient(152deg, rgba(74,56,98,0.52), rgba(28,22,40,0.34))",
  // Recessed track - segmented toggles, progress rails, input wells.
  wellBg: "rgba(14,11,20,0.72)",

  border: "rgba(142,116,180,0.18)",
  borderStrong: "rgba(165,140,205,0.34)",
  borderHover: "rgba(190,165,230,0.46)",
  // Row dividers sit lighter than card borders so a list inside a card does not
  // read as a stack of boxes.
  divider: "rgba(142,116,180,0.14)",

  // Bloom - the violet/fuchsia light used behind active and primary elements.
  // Not a module accent and never a state; purely the glow of the chrome.
  bloom: "#C084FC",
  bloomBg: "rgba(192,132,252,0.14)",
  bloomBorder: "rgba(192,132,252,0.34)",
  bloomGlow: "0 0 0 1px rgba(192,132,252,0.22), 0 8px 28px -10px rgba(192,132,252,0.55)",

  // ---------------------------------------------------------------------------
  // Text ramp
  // ---------------------------------------------------------------------------
  // Warmed a few degrees toward lavender so the ramp sits on the plum canvas
  // rather than on top of it. Pure neutral greys read faintly green here.
  text: "#F7F4FB",
  textMid: "#D3CBE2",
  textMuted: "#A79DBC",
  textHint: "#7B7194",
  textFaint: "#5A5272",

  // ---------------------------------------------------------------------------
  // Module accents - identity only, never state
  // ---------------------------------------------------------------------------
  // Each is a trio: fill / tint background / border. Mapped to modules in
  // lib/modules.js. A module keeps its accent whatever is happening inside it.
// Each sits a step brighter than the neutral-canvas set it replaces. A mid-
// saturation hue that read fine on near-black goes muddy over a plum ambient,
// and a state colour that has gone muddy has stopped doing its job.
  blue:    "#5B9DFF", blueBg:    "rgba(91,157,255,0.14)",  blueBorder:    "rgba(91,157,255,0.30)",
  emerald: "#2DD4A7", emeraldBg: "rgba(45,212,167,0.14)",  emeraldBorder: "rgba(45,212,167,0.30)",
  meet:    "#4ADE9B", meetBg:    "rgba(74,222,155,0.14)",  meetBorder:    "rgba(74,222,155,0.30)",
  orange:  "#FF8A3D", orangeBg:  "rgba(255,138,61,0.14)",  orangeBorder:  "rgba(255,138,61,0.30)",
  purple:  "#A78BFA", purpleBg:  "rgba(167,139,250,0.14)", purpleBorder:  "rgba(167,139,250,0.30)",
  cyan:    "#38E0F0", cyanBg:    "rgba(56,224,240,0.14)",  cyanBorder:    "rgba(56,224,240,0.30)",
  amber:   "#FBBF24", amberBg:   "rgba(251,191,36,0.14)",  amberBorder:   "rgba(251,191,36,0.30)",
  red:     "#FB5E6D", redBg:     "rgba(251,94,109,0.14)",  redBorder:     "rgba(251,94,109,0.30)",
  neutral: "#6B6383", neutralBg: "rgba(107,99,131,0.14)",  neutralBorder: "rgba(107,99,131,0.32)",
};

// ---------------------------------------------------------------------------
// Semantic state - deliberately separate from accent
// ---------------------------------------------------------------------------
// A breaching deal is `risk` red even though Deals is an amber module. Tangling
// these two is why the old UI looked permanently alarmed: amber meant both
// "pacing module" and "something is wrong", so nothing stood out.
//
// Discipline:
//   risk - a deadline that has ALREADY passed. Nothing else may use it.
//   warn - a deadline approaching, still actionable.
//   ok   - explicitly good, worth confirming.
//   idle - no state. The default. Most things should be idle.
//
// No pulsing, no flashing, no animation on any of these. Urgency comes from
// position on the page, not motion.
export const SEMANTIC = {
  risk: { fill: C.red,     bg: C.redBg,     border: C.redBorder },
  warn: { fill: C.amber,   bg: C.amberBg,   border: C.amberBorder },
  ok:   { fill: C.emerald, bg: C.emeraldBg, border: C.emeraldBorder },
  idle: { fill: C.neutral, bg: C.neutralBg, border: C.neutralBorder },
};

export const LEVEL_ORDER = { risk: 0, warn: 1, ok: 2, idle: 3 };

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------
export const R = {
  xs: 4,    // inline chips
  sm: 8,    // small controls
  md: 10,   // logo squares, nav items
  lg: 14,   // inner panels
  xl: 16,   // cards
  xxl: 18,  // page frames
  pill: 999,
};

// The leading `inset` on the card shadows is the glass edge - a one-pixel lit
// line along the top of every card. It is what makes a translucent surface read
// as a pane of something rather than as a hole in the page, and because Card
// already consumes SHADOW.card every module inherits it with no edit.
export const SHADOW = {
  card: "inset 0 1px 0 rgba(255,255,255,0.055), 0 1px 2px rgba(0,0,0,0.38), 0 10px 32px -14px rgba(0,0,0,0.70)",
  cardHover: "inset 0 1px 0 rgba(255,255,255,0.085), 0 1px 2px rgba(0,0,0,0.42), 0 18px 44px -16px rgba(0,0,0,0.78)",
  pop: "inset 0 1px 0 rgba(255,255,255,0.07), 0 28px 80px rgba(0,0,0,0.70)",
};

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------
export const FONT_SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export const FONT_MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace";
export const FONT_DISPLAY = "'Rubik', 'Inter', sans-serif";

// The jump from label to hero is deliberately violent. The old scale ran 9-14px
// for everything, so a page of numbers had no entry point - every value competed
// with every other one.
export const T = {
  label: 10,   // uppercase section labels, tracked
  micro: 11,   // captions, deltas, metadata
  body: 13,    // table cells, row text
  bodyLg: 15,  // action lines, emphasised rows
  title: 21,   // module heading
  hero: 32,    // panel headline number
  heroLg: 42,  // page headline number
};

export const TRACK = {
  label: "0.14em",
  labelWide: "0.16em",
  tight: "-0.015em",
  tighter: "-0.025em",
  tightest: "-0.03em",
};

// Every numeric in the app is tabular so columns of figures align and a changing
// value does not reflow its row.
export const NUM = { fontVariantNumeric: "tabular-nums" };

// Identity stays declared in exactly one place.
export { OWNER } from "../config.js";
