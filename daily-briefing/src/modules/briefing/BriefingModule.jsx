import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, SectionLabel, Page, PageHeader, Stat, StatRow } from "../../design/ui.jsx";
import { C, R, SHADOW, T, TRACK, FONT_SANS, FONT_MONO, FONT_DISPLAY, OWNER } from "../../lib/tokens.js";
import { dialUrl, toE164 } from "../../config.js";
import {
  TODAY_LABEL,
  REFRESHED_AT,
  TODAY_ISO,
  WEEK_DAYS,
  LAST_WEEK_PROSPECTS,
  TWO_WEEKS_AGO_PROSPECTS,
  WEEK_PROSPECTS,
  WEEK_OTHER_EVENTS,
} from "./data.js";

const FIRST_NAME = OWNER.name.split(" ")[0];


const WORK_START = 9 * 60;
const WORK_END = 18 * 60;
const MIN_SLOT = 15;
const NOTIFY_LEAD = 5;

const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fromMin = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// ============ CULT UI DESIGN TOKENS ============
const CARD_SHADOW = SHADOW.card;
const CARD_SHADOW_HOVER = SHADOW.cardHover;

// Palette, type scale and fonts all come from lib/tokens.js now. This module
// used to carry its own violet/glass `C`, which is why Today looked like a
// different product from every other module.

// Phase 3 motion - elastic fade-up used for staggered reveal on day mode mount.
const FADE_UP = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.16, 1.2, 0.3, 1] } },
};

// ── Prospect qualification status (qualified / working / qualified_out)
// Persisted as one localStorage entry keyed by prospect email. Read by the
// agenda for dim/strike treatment, and by the tally header for a live count.
// A future "Working" module can subscribe to MODULE_01_QUAL_KEY directly.
const MODULE_01_QUAL_KEY = "module01.qualStatus";
const QUAL_STATUSES = [
  { id: "qualified",     label: "Demo",    title: "Qualified - moves to demo with AE",                       color: C.emerald, bg: C.emeraldBg, border: C.emeraldBorder },
  { id: "working",       label: "Working", title: "Working - interested, timing off; needs follow-up",       color: C.amber,   bg: C.amberBg,   border: C.amberBorder },
  { id: "qualified_out", label: "Out",     title: "Qualified Out - wrong ICP / pricing / timing / product",  color: C.red,     bg: C.redBg,     border: C.redBorder },
];

function useQualStatus() {
  const [map, setMap] = useState(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(MODULE_01_QUAL_KEY) || "{}"); }
    catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(MODULE_01_QUAL_KEY, JSON.stringify(map)); } catch {}
  }, [map]);
  const set = (key, status) => setMap((prev) => {
    const next = { ...prev };
    if (!status || prev[key] === status) delete next[key];
    else next[key] = status;
    return next;
  });
  return [map, set];
}

function QualStatusPills({ value, onChange }) {
  return (
    <div role="group" aria-label="Qualification status" style={{ display: "inline-flex", gap: 4, marginLeft: 6 }}>
      {QUAL_STATUSES.map((s) => {
        const on = value === s.id;
        return (
          <button key={s.id} type="button" title={s.title}
            onClick={(e) => { e.stopPropagation(); onChange(s.id); }}
            style={{
              fontFamily: FONT_MONO, fontSize: 9, fontWeight: on ? 700 : 500,
              padding: "1px 7px", borderRadius: 10, cursor: "pointer",
              background: on ? s.bg : "transparent",
              color: on ? s.color : C.textMuted,
              border: `1px solid ${on ? s.border : C.border}`,
              letterSpacing: 0.2, transition: "all 0.12s",
            }}>
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

// Join-link provider, from the URL alone. The refresh pulls meetLink for EVERY
// calendar event that has one, not just HubSpot-booked Google Meets, so the button
// must not label a Zoom or Teams URL "Join Google Meet". Unknown providers get a
// neutral link glyph rather than a wrong-but-confident one.
//
// Shared by both render sites (prospect card + other event) so the two cannot drift.
function meetProvider(url) {
  if (/zoom\.us/i.test(url))                     return { initials: "Z",  color: C.blue,    label: "Join Zoom" };
  if (/meet\.google\.com/i.test(url))            return { initials: "GM", color: C.meet,    label: "Join Google Meet" };
  if (/teams\.(microsoft|live)\.com/i.test(url)) return { initials: "T",  color: C.cyan,    label: "Join Microsoft Teams" };
  if (/whereby\.com/i.test(url))                 return { initials: "W",  color: C.purple,  label: "Join Whereby" };
  return { initials: "↗", color: C.textMuted, label: "Join meeting" };
}

// Circular monogram action button: futuristic, minimal, ≥36px tap target.
// Used in ProspectCard's action row to replace rectangular HubSpot/Meet/Notes buttons.
// `as="a"` for hrefs, plain button otherwise. Optional `count` shows a corner badge.
// Solid handset, not an outline. Its neighbours in the action row are bold mono
// letterforms (`H`, `GM`); a 2px-stroke outline next to them reads as a lighter
// weight from a different family, and at 15px the hollow centre just looks like
// a gap in the row. A filled glyph carries the same optical mass as a letter.
// Sized 17 in a 38 button so the diagonal handset spans the width the caps do -
// matching the nominal font-size leaves it visibly small.
const PhoneIcon = ({ size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
  </svg>
);

// The call affordance, which has to cope with the fact that CloudTalk Phone 4.5.1
// declares no CFBundleURLTypes - it claims no URL scheme at all, so no `tel:` link
// can ever hand off to it. Click-to-call on the desktop goes through CloudTalk's
// browser extension, which reads phone numbers out of the DOM.
//
// So: with a DIAL_SCHEME set, this is a link and the OS decides. With "none", the
// button copies the E.164 number instead of dying silently - one click, then paste
// into the dialer. A button that visibly does nothing is worse than no button.
function DialButton({ phone }) {
  const href = dialUrl(phone);
  const [copied, setCopied] = useState(false);
  if (href) {
    return <MonogramButton glyph={<PhoneIcon />} color={C.cyan} href={href}
      ariaLabel="Call prospect" title={`Call ${phone}`} />;
  }
  return <MonogramButton glyph={<PhoneIcon />} color={copied ? C.emerald : C.cyan}
    ariaLabel="Copy number" title={copied ? "Copied" : `Copy ${phone}`}
    onClick={() => {
      navigator.clipboard?.writeText(toE164(phone) || phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }} />;
}

// A circular action button. Normally carries 1-2 letters, but `glyph` swaps in an
// icon node instead - a phone is a phone in every language, "PH" is a riddle.
function MonogramButton({ initials, glyph, color, ariaLabel, title, href, onClick, count, size = 38 }) {
  const [hov, setHov] = useState(false);
  const [focus, setFocus] = useState(false);
  const glow = hov || focus;
  const baseStyle = {
    position: "relative",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: size, height: size, minWidth: size, borderRadius: "50%",
    flexShrink: 0,
    fontFamily: FONT_MONO,
    fontSize: initials && initials.length > 1 ? 11 : 13,
    fontWeight: 700, letterSpacing: 0.4,
    color: color,
    background: glow ? `${color}22` : "transparent",
    border: `1.5px solid ${color}`,
    boxShadow: glow
      ? `0 0 0 3px ${color}1A, 0 6px 18px -6px ${color}55, inset 0 0 12px -6px ${color}66`
      : `inset 0 0 10px -8px ${color}55`,
    cursor: "pointer",
    textDecoration: "none",
    transition: "background 0.18s, box-shadow 0.18s, transform 0.12s",
    transform: glow ? "translateY(-1px)" : "translateY(0)",
    outline: "none",
    whiteSpace: "nowrap",
  };
  const inner = (
    <>
      <span style={{ pointerEvents: "none", display: "inline-flex", alignItems: "center" }}>{glyph || initials}</span>
      {count > 0 && (
        <span aria-hidden="true" style={{
          position: "absolute", top: -3, right: -3,
          minWidth: 16, height: 16, padding: "0 4px",
          borderRadius: 8, background: color, color: C.bg,
          fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 0 2px ${C.bg}`,
        }}>{count}</span>
      )}
    </>
  );
  const handlers = {
    onMouseEnter: () => setHov(true),
    onMouseLeave: () => setHov(false),
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
  };
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer"
        aria-label={ariaLabel} title={title}
        style={baseStyle} {...handlers}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick}
      aria-label={ariaLabel} title={title}
      style={baseStyle} {...handlers}>
      {inner}
    </button>
  );
}

function qualTally(prospects, qualMap) {
  const t = { qualified: 0, working: 0, qualified_out: 0, pending: 0 };
  for (const p of prospects) {
    const s = qualMap[p.email];
    if (s === "qualified" || s === "working" || s === "qualified_out") t[s]++;
    else t.pending++;
  }
  return t;
}

// Compact stat tile used inside the right-rail "Today" card.
function RailStat({ label, value, tone = "iris" }) {
  const c = tone === "cyan" ? C.cyan : C.blue;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 70 }}>
      <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase", color: C.textHint }}>
        {label}
      </span>
      <span style={{
        fontFamily: FONT_MONO,
        fontSize: 24,
        fontVariantNumeric: "tabular-nums",
        color: c,
        textShadow: `0 0 14px ${c}40`,
      }}>
        {value}
      </span>
    </div>
  );
}

const SCHEDULER_URL = "https://scheduler.default.com/833/member/01d4ab6d-fbb1-4437-8545-938e2057c5de";

// Language of the "are you joining?" Gmail draft, from the contact's country.
//
// Keyed on COUNTRY, not on COUNTRY_MAP's `region`. Those regions are sales
// territories and would mistranslate: Portugal is region ES but not Spanish-
// speaking, Morocco and Belgium are region FR. Only Spain and France get a
// localised draft; everything else defaults to English, which is the honest
// fallback - a machine-translated Dutch or Italian draft reads worse than a
// clean English one.
function draftLang(country) {
  const c = (country || "").trim().toLowerCase();
  if (c === "spain") return "es";
  if (c === "france") return "fr";
  return "en";
}

// One copy set per language, written natively rather than translated from the
// English: FR uses vouvoiement and French question/colon spacing, ES uses tuteo,
// which is the norm in Spanish B2B SaaS. Edit copy here, not at the call site.
const DRAFT_COPY = {
  en: {
    subject: "Following up on our scheduled call - CloudTalk",
    greeting: (n) => `Hi ${n},`,
    joining: "I am connected in the meeting right now - will you be joining?",
    reschedule: "If you'd like to reschedule, please let me know what works for you, or feel free to book a new time directly here:",
    closing: "Look forward to speaking with you.",
    signoff: "Thanks,",
  },
  fr: {
    subject: "Notre rendez-vous du jour - CloudTalk",
    greeting: (n) => `Bonjour ${n},`,
    joining: "Je suis connecté à la réunion en ce moment - allez-vous nous rejoindre ?",
    reschedule: "Si vous préférez reporter, indiquez-moi vos disponibilités, ou réservez directement un nouveau créneau ici :",
    closing: "Au plaisir d'échanger avec vous.",
    signoff: "Bien à vous,",
  },
  es: {
    subject: "Nuestra reunión de hoy - CloudTalk",
    greeting: (n) => `Hola ${n},`,
    joining: "Estoy conectado en la reunión ahora mismo, ¿te unes?",
    reschedule: "Si prefieres reprogramarla, dime qué horario te viene bien, o reserva directamente un nuevo hueco aquí:",
    closing: "Quedo a la espera de hablar contigo.",
    signoff: "Un saludo,",
  },
};

// Gmail compose deep-link for the "I'm on the call, are you?" nudge.
function composeUrl(m, firstName) {
  const t = DRAFT_COPY[draftLang(m.country)];
  const body = [
    t.greeting(firstName),
    "",
    t.joining,
    m.meetLink ? "" : null,
    m.meetLink ? m.meetLink : null,
    "",
    t.reschedule,
    "",
    SCHEDULER_URL,
    "",
    t.closing,
    "",
    t.signoff,
  ].filter((l) => l !== null).join("\n");
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(m.email)}&su=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(body)}`;
}

const COUNTRY_MAP = {
  "france": { flag: "🇫🇷", region: "FR" },
  "netherlands": { flag: "🇳🇱", region: "NL" },
  "the netherlands": { flag: "🇳🇱", region: "NL" },
  "sweden": { flag: "🇸🇪", region: "NORDIC" },
  "morocco": { flag: "🇲🇦", region: "FR" },
  "pakistan": { flag: "🇵🇰", region: "MEA" },
  "serbia": { flag: "🇷🇸", region: "DACH" },
  "south africa": { flag: "🇿🇦", region: "APAC" },
  "algeria": { flag: "🇩🇿", region: "MEA" },
  "spain": { flag: "🇪🇸", region: "ES" },
  "united kingdom": { flag: "🇬🇧", region: "EN" },
  "lithuania": { flag: "🇱🇹", region: "EU" },
  "hungary": { flag: "🇭🇺", region: "DACH" },
  "united arab emirates": { flag: "🇦🇪", region: "MEA" },
  "belgium": { flag: "🇧🇪", region: "FR" },
  "ireland": { flag: "🇮🇪", region: "EN" },
  "australia": { flag: "🇦🇺", region: "APAC" },
  "slovenia": { flag: "🇸🇮", region: "EU" },
  "georgia": { flag: "🇬🇪", region: "INTL" },
  "bangladesh": { flag: "🇧🇩", region: "APAC" },
  "india": { flag: "🇮🇳", region: "APAC" },
  "portugal": { flag: "🇵🇹", region: "ES" },
  "singapore": { flag: "🇸🇬", region: "APAC" },
  "north macedonia": { flag: "🇲🇰", region: "EU" },
  "canada": { flag: "🇨🇦", region: "INTL" },
  "kenya": { flag: "🇰🇪", region: "APAC" },
  "italy": { flag: "🇮🇹", region: "EU" },
  "hong kong": { flag: "🇭🇰", region: "APAC" },
  "germany": { flag: "🇩🇪", region: "DACH" },
  "united states": { flag: "🇺🇸", region: "INTL" },
  "jordan": { flag: "🇯🇴", region: "MEA" },
  "denmark": { flag: "🇩🇰", region: "NORDIC" },
  "israel": { flag: "🇮🇱", region: "MEA" },
  "thailand": { flag: "🇹🇭", region: "APAC" },
  "nigeria": { flag: "🇳🇬", region: "APAC" },
  "czech republic": { flag: "🇨🇿", region: "EU" },
  "ukraine": { flag: "🇺🇦", region: "EU" },
  "malta": { flag: "🇲🇹", region: "EU" },
  "belize": { flag: "🇧🇿", region: "INTL" },
  "latvia": { flag: "🇱🇻", region: "EU" },
  "bulgaria": { flag: "🇧🇬", region: "EU" },
  "luxembourg": { flag: "🇱🇺", region: "FR" },
  "cyprus": { flag: "🇨🇾", region: "EU" },
  "turkey": { flag: "🇹🇷", region: "INTL" },
  "slovakia": { flag: "🇸🇰", region: "EU" },
  "albania": { flag: "🇦🇱", region: "INTL" },
  "switzerland": { flag: "🇨🇭", region: "DACH" },
  "philippines": { flag: "🇵🇭", region: "APAC" },
  "estonia": { flag: "🇪🇪", region: "EU" },
  "poland": { flag: "🇵🇱", region: "EU" },
};

const STATUS_MAP = {
  "IN_PROGRESS": { label: "In progress", bg: C.blueBg, color: C.blue, border: C.blueBorder },
  "Unable to Contact": { label: "Unable to contact", bg: C.redBg, color: C.red, border: C.redBorder },
  "ATTEMPTED_TO_CONTACT": { label: "Attempted contact", bg: C.amberBg, color: C.amber, border: C.amberBorder },
  "NEW": { label: "New", bg: C.purpleBg, color: C.purple, border: C.purpleBorder },
  "Qualified": { label: "Qualified", bg: C.emeraldBg, color: C.emerald, border: C.emeraldBorder },
  "OPEN": { label: "Open", bg: C.cyanBg, color: C.cyan, border: C.cyanBorder },
};

// Country -> IANA timezone for live local-time badge per prospect.
const TZ_BY_COUNTRY = {
  "france": "Europe/Paris",
  "belgium": "Europe/Brussels",
  "morocco": "Africa/Casablanca",
  "algeria": "Africa/Algiers",
  "netherlands": "Europe/Amsterdam",
  "the netherlands": "Europe/Amsterdam",
  "sweden": "Europe/Stockholm",
  "spain": "Europe/Madrid",
  "portugal": "Europe/Lisbon",
  "united kingdom": "Europe/London",
  "ireland": "Europe/Dublin",
  "germany": "Europe/Berlin",
  "denmark": "Europe/Copenhagen",
  "italy": "Europe/Rome",
  "slovenia": "Europe/Ljubljana",
  "north macedonia": "Europe/Skopje",
  "lithuania": "Europe/Vilnius",
  "hungary": "Europe/Budapest",
  "czech republic": "Europe/Prague",
  "serbia": "Europe/Belgrade",
  "georgia": "Asia/Tbilisi",
  "united arab emirates": "Asia/Dubai",
  "jordan": "Asia/Amman",
  "israel": "Asia/Jerusalem",
  "pakistan": "Asia/Karachi",
  "india": "Asia/Kolkata",
  "bangladesh": "Asia/Dhaka",
  "singapore": "Asia/Singapore",
  "hong kong": "Asia/Hong_Kong",
  "thailand": "Asia/Bangkok",
  "south africa": "Africa/Johannesburg",
  "kenya": "Africa/Nairobi",
  "nigeria": "Africa/Lagos",
  "australia": "Australia/Sydney",
  "united states": "America/New_York",
  "canada": "America/Toronto",
  "ukraine": "Europe/Kyiv",
  "malta": "Europe/Malta",
  "belize": "America/Belize",
  "latvia": "Europe/Riga",
  "bulgaria": "Europe/Sofia",
  "luxembourg": "Europe/Luxembourg",
  "cyprus": "Asia/Nicosia",
  "turkey": "Europe/Istanbul",
  "slovakia": "Europe/Bratislava",
  "estonia": "Europe/Tallinn",
  "poland": "Europe/Warsaw",
};


const HOUR = new Date().getHours();
const PERIOD_EN = HOUR < 12 ? "morning" : HOUR < 18 ? "afternoon" : "evening";
const PERIOD_FR = HOUR < 12 ? "Bonne matinée" : HOUR < 18 ? "Bon après-midi" : "Bonne soirée";
const PERIOD_ES = HOUR < 12 ? "Buenos días" : HOUR < 18 ? "Buenas tardes" : "Buenas noches";
const GREETINGS = [
  { lang: "EN", text: `Good ${PERIOD_EN}, ${FIRST_NAME}` },
  { lang: "FR", text: `${PERIOD_FR}, ${FIRST_NAME}` },
  { lang: "ES", text: `${PERIOD_ES}, ${FIRST_NAME}` },
];

// ============ ATOMIC COMPONENTS ============

function Greeting() {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(true);
  useEffect(() => {
    // Rotate through EN/FR/ES once, then settle - an interval with no stop
    // condition kept re-triggering this fade forever, showing up as a
    // recurring UI twitch every ~2.8s for as long as the module stayed open.
    let ticks = 0;
    const id = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % GREETINGS.length);
        setFade(true);
      }, 320);
      ticks += 1;
      if (ticks >= GREETINGS.length) clearInterval(id);
    }, 2800);
    return () => clearInterval(id);
  }, []);
  const g = GREETINGS[idx];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 1.5, color: C.blue, background: C.blueBg, border: `1px solid ${C.blueBorder}`, padding: "2px 9px", borderRadius: 4, flexShrink: 0 }}>{g.lang}</span>
      <span style={{ fontSize: 28, fontWeight: 600, color: C.text, opacity: fade ? 1 : 0, transform: fade ? "translateY(0)" : "translateY(5px)", transition: "opacity 0.32s,transform 0.32s", lineHeight: 1, letterSpacing: "-0.02em" }}>{g.text}</span>
    </div>
  );
}

function CopyEmail({ email }) {
  const [copied, setCopied] = useState(false);
  const [hov, setHov] = useState(false);
  const copy = (e) => {
    e.stopPropagation();
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };
  return (
    <button onClick={copy} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      title={copied ? "Copied" : `Copy ${email}`}
      style={{ fontFamily: FONT_MONO, fontSize: 9, padding: "2px 8px", borderRadius: 4, border: `1px solid ${copied ? C.blueBorder : (hov ? C.borderHover : C.border)}`, background: copied ? C.blueBg : (hov ? C.surfaceAlt : C.surface), color: copied ? C.blue : C.textMuted, cursor: "pointer", transition: "all 0.12s", marginLeft: 8 }}>
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

function LocalTimeBadge({ country }) {
  const tz = country ? TZ_BY_COUNTRY[country.toLowerCase()] : null;
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    if (!tz) return;
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, [tz]);
  if (!tz) return null;
  let display;
  try {
    display = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(now);
  } catch {
    return null;
  }
  const tzShort = tz.split("/").pop().replace(/_/g, " ");
  return (
    <span title={`Their local time (${tz})`} style={{ fontFamily: FONT_MONO, fontSize: 9, background: C.cyanBg, color: C.cyan, border: `1px solid ${C.cyanBorder}`, borderRadius: 10, padding: "1px 7px" }}>
      🕐 {display} {tzShort}
    </span>
  );
}

function RsvpBadge({ rsvp }) {
  const map = {
    needsAction: { label: "No reply", bg: C.amberBg, color: C.amber, border: C.amberBorder },
    declined: { label: "Declined", bg: C.redBg, color: C.red, border: C.redBorder },
  };
  const s = map[rsvp];
  if (!s) return null;
  return <span style={{ fontFamily: FONT_MONO, fontSize: 9, background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 10, padding: "1px 7px", marginLeft: 5 }}>{s.label}</span>;
}

const MEDDPICC_ITEMS = [
  { key: "metrics", label: "Metrics", hint: "What quantified outcome would justify this purchase? (e.g., +20% connect rate, -30% admin time)" },
  { key: "economicBuyer", label: "Economic Buyer", hint: "Who owns the budget? Is it our contact or 2 levels up?" },
  { key: "decisionCriteria", label: "Decision Criteria", hint: "What features/integrations are non-negotiable vs nice-to-have?" },
  { key: "decisionProcess", label: "Decision Process", hint: "Who else evaluates? What's the timeline? Any procurement step?" },
  { key: "paperProcess", label: "Paper Process", hint: "Legal review? Security questionnaire? DPA/GDPR sign-off?" },
  { key: "identifyPain", label: "Identify Pain", hint: "What breaks today? What does the status quo cost them?" },
  { key: "champion", label: "Champion", hint: "Is the contact someone who can sell this internally on our behalf?" },
  { key: "competition", label: "Competition", hint: "Are they evaluating Aircall / RingCentral / Twilio / Five9 / nothing?" },
];



function HSPanel({ p, notes, setNotes }) {
  const cd = p.country ? COUNTRY_MAP[p.country.toLowerCase()] : null;
  const sd = p.leadStatus ? STATUS_MAP[p.leadStatus] : null;
  const [briefOpen, setBriefOpen] = useState(false);
  const [qualifyOpen, setQualifyOpen] = useState(false);
  const meddpiccState = (notes && notes[`${p.email}::meddpicc`]) || {};
  const toggleMeddpicc = (key) => {
    if (!setNotes) return;
    setNotes((prev) => ({
      ...prev,
      [`${p.email}::meddpicc`]: { ...(prev[`${p.email}::meddpicc`] || {}), [key]: !((prev[`${p.email}::meddpicc`] || {})[key]) },
    }));
  };
  const checkedCount = Object.values(meddpiccState).filter(Boolean).length;
  const qualifierItems = (p.qualifierQuestions && p.qualifierQuestions.length > 0) ? p.qualifierQuestions : MEDDPICC_ITEMS;
  return (
    <div style={{ marginTop: 10, padding: "13px 15px", background: C.surfaceAlt, borderRadius: 9, border: `1px solid ${C.border}`, display: "flex", flexWrap: "wrap", gap: 18 }}>
      <div style={{ minWidth: 0, flex: (briefOpen || qualifyOpen) ? "1 1 100%" : "0 0 auto" }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: 0.6, color: C.textHint, textTransform: "uppercase", marginBottom: 4 }}>Role & company</div>
        {p.jobtitle ? (
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{p.jobtitle}</div>
        ) : (
          <div style={{ fontSize: 12, fontStyle: "italic", color: C.textHint }}>Role unknown</div>
        )}
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.textMuted, marginTop: 3 }}>{p.company || "-"}</div>
        {p.companyUrl && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
            <a href={p.companyUrl} target="_blank" rel="noreferrer" style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.blue, textDecoration: "none" }}>
              {p.companyUrl.replace("https://www.", "")} ↗
            </a>
            <button
              onClick={() => setBriefOpen((o) => !o)}
              title={briefOpen ? "Hide company brief" : "Show 5-line company brief + CloudTalk fit"}
              style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 500, padding: "1px 7px", borderRadius: 10, border: `1px solid ${briefOpen ? C.purpleBorder : C.border}`, background: briefOpen ? C.purpleBg : C.surface, color: briefOpen ? C.purple : C.textMuted, cursor: "pointer", transition: "all 0.12s", lineHeight: 1.3 }}
            >
              {briefOpen ? "▾ Brief" : "▸ Brief"}
            </button>
            <button
              onClick={() => setQualifyOpen((o) => !o)}
              title={qualifyOpen ? "Hide MEDDPICC checklist" : "Open MEDDPICC qualification checklist + Challenger insight"}
              style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 500, padding: "1px 7px", borderRadius: 10, border: `1px solid ${qualifyOpen ? C.emeraldBorder : C.border}`, background: qualifyOpen ? C.emeraldBg : C.surface, color: qualifyOpen ? C.emerald : C.textMuted, cursor: "pointer", transition: "all 0.12s", lineHeight: 1.3 }}
            >
              {qualifyOpen ? "▾" : "▸"} Qualify {checkedCount > 0 && `(${checkedCount}/${qualifierItems.length})`}
            </button>
          </div>
        )}
        {briefOpen && (
          <div style={{ marginTop: 8, padding: "10px 12px", background: C.purpleBg, border: `1px solid ${C.purpleBorder}`, borderRadius: 8, fontSize: 11, lineHeight: 1.6, color: C.text, whiteSpace: "pre-line" }}>
            {p.companyBrief || <span style={{ fontStyle: "italic", color: C.textHint }}>Brief not generated yet - will be added in next refresh.</span>}
          </div>
        )}
        {qualifyOpen && (
          <div style={{ marginTop: 8, padding: "11px 13px", background: C.emeraldBg, border: `1px solid ${C.emeraldBorder}`, borderRadius: 8, fontSize: 11, lineHeight: 1.5, color: C.text, overflow: "hidden", wordBreak: "break-word" }}>
            {p.challengerInsight ? (
              <div style={{ marginBottom: 10, padding: "6px 8px", background: C.surface, border: `1px solid ${C.emeraldBorder}`, borderRadius: 4 }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: 1, color: C.emerald, textTransform: "uppercase", marginBottom: 3, fontWeight: 600 }}>⚡ Challenger insight - lead with this</div>
                <div style={{ fontSize: 11, color: C.text, lineHeight: 1.5, wordBreak: "break-word" }}>{p.challengerInsight}</div>
              </div>
            ) : (
              <div style={{ marginBottom: 10, fontStyle: "italic", color: C.textHint, fontSize: 10 }}>Challenger insight not generated yet - will be added in next refresh.</div>
            )}
            <div style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: 1, color: C.emerald, textTransform: "uppercase", marginBottom: 6, fontWeight: 600 }}>{p.qualifierQuestions ? "Tailored discovery - tick as you discover" : "MEDDPICC checklist - tick as you discover"}</div>
            {qualifierItems.map((item) => {
              const checked = !!meddpiccState[item.key];
              return (
                <label key={item.key} onClick={(e) => { e.preventDefault(); toggleMeddpicc(item.key); }} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "4px 6px", borderRadius: 4, cursor: "pointer", background: checked ? C.surface : "transparent", marginBottom: 2 }}>
                  <span style={{ marginTop: 1, fontSize: 12, color: checked ? C.emerald : C.textHint, fontFamily: FONT_MONO, lineHeight: 1, userSelect: "none" }}>
                    {checked ? "☑" : "☐"}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: checked ? C.emerald : C.text, textDecoration: checked ? "line-through" : "none" }}>{item.label}</span>
                    <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 6, wordBreak: "break-word" }}>· {item.hint}</span>
                    {item.why && <span style={{ display: "block", fontSize: 9, color: C.textHint, fontStyle: "italic", marginTop: 1, wordBreak: "break-word" }}>{item.why}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
      {p.seats && (
        <div style={{ minWidth: 90 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: 0.6, color: C.textHint, textTransform: "uppercase", marginBottom: 4 }}>Seats (agg.)</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.cyan, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{p.seats}</div>
        </div>
      )}
      {p.leadSource && (
        <div style={{ minWidth: 110 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: 0.6, color: C.textHint, textTransform: "uppercase", marginBottom: 4 }}>Lead source</div>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, background: C.purpleBg, color: C.purple, border: `1px solid ${C.purpleBorder}`, borderRadius: 4, padding: "2px 7px" }}>{p.leadSource}</span>
        </div>
      )}
      {cd && (
        <div style={{ minWidth: 80 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: 0.6, color: C.textHint, textTransform: "uppercase", marginBottom: 4 }}>Market</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 16 }}>{cd.flag}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 500, color: C.cyan, background: C.cyanBg, border: `1px solid ${C.cyanBorder}`, padding: "1px 6px", borderRadius: 4 }}>{cd.region}</span>
          </div>
        </div>
      )}
      {sd && (
        <div style={{ minWidth: 110 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: 0.6, color: C.textHint, textTransform: "uppercase", marginBottom: 4 }}>HS status</div>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, background: sd.bg, color: sd.color, border: `1px solid ${sd.border}`, borderRadius: 10, padding: "2px 8px" }}>{sd.label}</span>
        </div>
      )}
      {p.phone && (
        <div style={{ minWidth: 130 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: 0.6, color: C.textHint, textTransform: "uppercase", marginBottom: 4 }}>Phone</div>
          {/* Shows the number as HubSpot formats it; dials the E.164 form. The
              two differ by spaces, and a space is what made the old href a dead
              link. `select-all`-ish behaviour is kept for the no-scheme case:
              with DIAL_SCHEME "none" this degrades to plain copyable text for
              the CloudTalk extension to pick up. */}
          {dialUrl(p.phone)
            ? <a href={dialUrl(p.phone)} title={`Call ${p.phone}`} style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.blue, textDecoration: "none" }}>{p.phone}</a>
            : <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.textMid, userSelect: "all" }}>{p.phone}</span>}
        </div>
      )}
      {p.multiAttendee && <span style={{ alignSelf: "center", fontFamily: FONT_MONO, fontSize: 9, background: C.purpleBg, color: C.purple, border: `1px solid ${C.purpleBorder}`, borderRadius: 10, padding: "1px 7px" }}>👥 Multi-attendee</span>}
    </div>
  );
}

function NotesPanel({ id, notes, setNotes }) {
  const val = notes[id] || "";
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 110 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: 1.5, color: C.textHint, textTransform: "uppercase", marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}>
        <span>Notes</span>
        {val && <span style={{ color: C.blue, fontSize: 10 }}>●</span>}
      </div>
      <textarea
        value={val}
        onChange={(e) => setNotes((n) => ({ ...n, [id]: e.target.value }))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Quick note..."
        style={{ flex: 1, fontFamily: FONT_MONO, fontSize: 11, padding: "9px 11px", borderRadius: 7, border: `1px solid ${focused ? C.blue : C.border}`, background: C.surfaceAlt, color: C.text, outline: "none", resize: "vertical", minHeight: 96, lineHeight: 1.5, transition: "border-color 0.12s" }}
      />
    </div>
  );
}

// ============ CARDS (Daily + Weekly) ============

function ProspectCard({ m, notes, setNotes, index, qualStatus, setQualStatus }) {
  const [exp, setExp] = useState(false);
  const cd = m.country ? COUNTRY_MAP[m.country.toLowerCase()] : null;
  const isAlert = m.leadStatus === "Unable to Contact";
  const qual = qualStatus || null;
  const isOut = qual === "qualified_out";
  const accent = qual === "qualified" ? C.emerald
              : qual === "working"    ? C.amber
              : qual === "qualified_out" ? C.red
              : (isAlert ? C.red : C.blue);
  const rawFirstName = (m.name || "there").split(/\s+/)[0];
  const firstName = rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1);
  const gmailComposeUrl = composeUrl(m, firstName);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (index || 0) * 0.07, type: "spring", stiffness: 100, damping: 18 }}
      whileHover={{ y: -3, boxShadow: `${CARD_SHADOW_HOVER}, -6px 0 20px -12px ${accent}` }}
      style={{ padding: "16px 18px 16px 19px", background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${accent}`, borderRadius: 12, marginBottom: 10, boxShadow: CARD_SHADOW, cursor: "default", opacity: isOut ? 0.5 : 1, transition: "opacity 0.18s" }}>
      <div style={{ display: "grid", gridTemplateColumns: "52px 1fr 200px", gap: 14 }}>
        <div style={{ paddingTop: 2 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: C.blue, lineHeight: 1, marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>{m.start}</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textHint }}>{m.end}</div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 5, marginBottom: 4 }}>
            {cd && <span style={{ fontSize: 14 }}>{cd.flag}</span>}
            <span style={{ fontSize: 15, fontWeight: 600, color: C.text, lineHeight: 1.2, textDecoration: isOut ? "line-through" : "none" }}>{m.name}</span>
            {setQualStatus && <QualStatusPills value={qual} onChange={(s) => setQualStatus(m.email, s)} />}
            <RsvpBadge rsvp={m.rsvp} />
            <LocalTimeBadge country={m.country} />
            {isAlert && <span style={{ fontFamily: FONT_MONO, fontSize: 9, background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`, borderRadius: 10, padding: "1px 7px" }}>⚠ Hard to reach</span>}
            {m.seats && <span style={{ fontFamily: FONT_MONO, fontSize: 9, background: C.cyanBg, color: C.cyan, border: `1px solid ${C.cyanBorder}`, borderRadius: 10, padding: "1px 7px" }}>{m.seats} seats</span>}
            {m.leadSource && <span style={{ fontFamily: FONT_MONO, fontSize: 9, background: C.purpleBg, color: C.purple, border: `1px solid ${C.purpleBorder}`, borderRadius: 10, padding: "1px 7px" }}>{m.leadSource}</span>}
            {m.multiAttendee && <span style={{ fontFamily: FONT_MONO, fontSize: 9, background: C.purpleBg, color: C.purple, border: `1px solid ${C.purpleBorder}`, borderRadius: 10, padding: "1px 7px" }}>👥</span>}
          </div>
          {m.jobtitle && (
            <div style={{ fontSize: 12, fontWeight: 500, color: C.textMid, marginBottom: 4 }}>{m.jobtitle} · <span style={{ color: C.textMuted, fontWeight: 400 }}>{m.company}</span></div>
          )}
          {!m.jobtitle && (
            <div style={{ marginBottom: 6 }}>
              {m.companyUrl ? (
                <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.textMuted }}>
                  web: <a href={m.companyUrl} target="_blank" rel="noreferrer" style={{ color: C.textMid, textDecoration: "underline" }}>{m.companyUrl.replace("https://www.", "")}</a>
                </span>
              ) : (
                <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.textHint }}>{m.company}</span>
              )}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
            <a href={gmailComposeUrl} target="_blank" rel="noreferrer"
              title="Compose new Gmail to this contact"
              style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.blue, textDecoration: "none", borderBottom: `1px dotted ${C.blueBorder}` }}>
              ✉ {m.email}
            </a>
            <CopyEmail email={m.email} />
          </div>
          {m.lastEmail && (
            <div style={{ marginBottom: 10, padding: "8px 10px", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: 0.6, color: C.textHint, textTransform: "uppercase" }}>Last email</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textMuted }}>{m.lastEmail.date}</span>
                {m.lastEmail.threadUrl && (
                  <a href={m.lastEmail.threadUrl} target="_blank" rel="noreferrer"
                    style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.blue, textDecoration: "none" }}>
                    open in Gmail →
                  </a>
                )}
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: C.text, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.lastEmail.subject}</div>
              {m.lastEmail.snippet && (
                <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.textMuted, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.lastEmail.snippet}</div>
              )}
            </div>
          )}
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" }}>
            {m.hsLink ? (
              <MonogramButton initials="H" color={C.orange}
                href={m.hsLink} ariaLabel="Open in HubSpot" title="Open in HubSpot" />
            ) : (
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textHint }}>Not in HubSpot</span>
            )}
            {m.meetLink && (() => {
              const p = meetProvider(m.meetLink);
              return (
                <MonogramButton initials={p.initials} color={p.color}
                  href={m.meetLink} ariaLabel={p.label} title={p.label} />
              );
            })()}
            {m.phone && <DialButton phone={m.phone} />}
            <button onClick={() => setExp((e) => !e)}
              style={{ fontFamily: FONT_MONO, fontSize: 9, padding: "3px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.textMuted, cursor: "pointer", transition: "all 0.12s", letterSpacing: 0.3 }}>
              {exp ? "▲ Less" : "▼ Details"}
            </button>
          </div>
          {exp && <HSPanel p={m} notes={notes} setNotes={setNotes} />}
        </div>
        <NotesPanel id={m.email} notes={notes} setNotes={setNotes} />
      </div>
    </motion.div>
  );
}

function WeekCard({ m }) {
  const [hov, setHov] = useState(false);
  const cd = m.country ? COUNTRY_MAP[m.country.toLowerCase()] : null;
  const isAlert = m.leadStatus === "Unable to Contact";
  const accent = m.canceled ? C.textHint : (isAlert ? C.red : C.blue);
  const opacity = m.canceled ? 0.55 : 1;
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ padding: "10px 12px", background: C.surface, border: `1px solid ${hov ? C.borderHover : C.border}`, borderLeft: `3px solid ${accent}`, borderRadius: 8, marginBottom: 6, transition: "all 0.14s", opacity, boxShadow: hov ? SHADOW.card : "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 600, color: C.text, fontVariantNumeric: "tabular-nums" }}>{m.start}</span>
        <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {m.hsLink && <span title="In HubSpot" style={{ width: 6, height: 6, borderRadius: "50%", background: C.orange, display: "inline-block" }} />}
          {m.meetLink && <span title="Meet link" style={{ width: 6, height: 6, borderRadius: "50%", background: C.meet, display: "inline-block" }} />}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginBottom: 3 }}>
        {cd && <span style={{ fontSize: 11 }}>{cd.flag}</span>}
        <span style={{ fontSize: 12, fontWeight: 600, color: C.text, lineHeight: 1.2, wordBreak: "break-word" }}>{m.name}</span>
      </div>
      {(m.jobtitle || m.company) && (
        <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textMuted, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {m.jobtitle || m.company}
        </div>
      )}
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {m.canceled && <span style={{ fontFamily: FONT_MONO, fontSize: 8, background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`, borderRadius: 8, padding: "1px 5px" }}>cancelled</span>}
        {isAlert && <span style={{ fontFamily: FONT_MONO, fontSize: 8, background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`, borderRadius: 8, padding: "1px 5px" }}>⚠</span>}
        {m.leadSource && <span style={{ fontFamily: FONT_MONO, fontSize: 8, background: C.purpleBg, color: C.purple, border: `1px solid ${C.purpleBorder}`, borderRadius: 8, padding: "1px 5px" }}>{m.leadSource}</span>}
        {m.seats && <span style={{ fontFamily: FONT_MONO, fontSize: 8, background: C.cyanBg, color: C.cyan, border: `1px solid ${C.cyanBorder}`, borderRadius: 8, padding: "1px 5px" }}>{m.seats}</span>}
        {m.multiAttendee && <span style={{ fontFamily: FONT_MONO, fontSize: 8, background: C.purpleBg, color: C.purple, border: `1px solid ${C.purpleBorder}`, borderRadius: 8, padding: "1px 5px" }}>👥</span>}
      </div>
    </div>
  );
}

// `ev.emoji` arrives as a category token - "gym", "team", "focus" - not a glyph.
// The live pull classifies the event and names the kind; picking the picture is
// a render decision and belongs here. The previous map was keyed on emoji
// shortcodes ("muscle", "fork_and_knife") that the pull has never emitted, so
// every token fell through the `|| code` escape and the card rendered the literal
// word "gym" next to its own title.
//
// One token always maps to one glyph, so an internal team call looks the same on
// every row of every day - that consistency is the whole point of the column.
const EVENT_GLYPHS = {
  gym: "🏋️", lunch: "🍽️", focus: "🎧", ooo: "🌴", commute: "🚗",
  team: "👥", oneone: "🤝", company: "🏢", product: "🧩", dev: "🛠️",
  interview: "💼", training: "🎓", admin: "🗂️", social: "☕", personal: "📌",
};

// Fallback for a token the pull invents later. Reads the event title rather than
// giving up to a bare word - a wrong-but-plausible glyph still parses as "this is
// not a prospect call", which is all this column has to say.
const NAME_HINTS = [
  [/\b(gym|workout|training session|run|padel|yoga)\b/i, "🏋️"],
  [/\b(lunch|breakfast|dinner|coffee coffee)\b/i, "🍽️"],
  [/\b(focus|deep work|transition|prep|blocked?)\b/i, "🎧"],
  [/\b(ooo|out of office|holiday|pto|vacation|leave)\b/i, "🌴"],
  [/\b(commute|travel|flight|train)\b/i, "🚗"],
  [/\b(1:?1|one[- ]?on[- ]?one|catch[- ]?up)\b/i, "🤝"],
  [/\b(all[- ]?hands|town ?hall|company|kick[- ]?off)\b/i, "🏢"],
  [/\b(product|roadmap|release|launch)\b/i, "🧩"],
  [/\b(interview|hiring|candidate)\b/i, "💼"],
  [/\b(workshop|enablement|onboarding|academy|course)\b/i, "🎓"],
  [/\b(huddle|standup|stand[- ]?up|sync|weekly|team|squad)\b/i, "👥"],
];

function emojiGlyph(code, name = "") {
  if (EVENT_GLYPHS[code]) return EVENT_GLYPHS[code];
  // Already a literal glyph (nothing ASCII in it) - trust it and pass through.
  if (code && !/^[\w-]+$/.test(code)) return code;
  const hit = NAME_HINTS.find(([re]) => re.test(name));
  return hit ? hit[1] : "📅";
}

function OtherCard({ ev, index }) {
  const palMap = { amber: C.amber, purple: C.purple, cyan: C.cyan, emerald: C.emerald, red: C.red };
  const accent = palMap[ev.color] || C.purple;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: (index || 0) * 0.04, duration: 0.2 }}
      whileHover={{ x: 2, boxShadow: CARD_SHADOW_HOVER }}
      style={{ display: "grid", gridTemplateColumns: "52px 1fr", gap: 14, padding: "11px 16px", background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${accent}`, borderRadius: 10, marginBottom: 8, boxShadow: CARD_SHADOW }}>
      <div style={{ paddingTop: 2 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, lineHeight: 1, marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>{ev.start}</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textHint }}>{ev.end}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 16 }}>{emojiGlyph(ev.emoji, ev.name)}</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{ev.name}</span>
        {ev.note && <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textHint }}>{ev.note}</span>}
        {ev.meetLink && (() => {
          const p = meetProvider(ev.meetLink);
          return (
            <MonogramButton initials={p.initials} color={p.color} size={30}
              href={ev.meetLink} ariaLabel={p.label} title={p.label} />
          );
        })()}
      </div>
    </motion.div>
  );
}

// ============ HELPERS (prop-driven) ============

function NowIndicator({ prospects }) {
  const [now, setNow] = useState(new Date());
  const [expanded, setExpanded] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const active = prospects.filter((m) => !m.canceled);
  const cur = active.find((m) => toMin(m.start) <= nowMin && nowMin < toMin(m.end));
  const nxt = active.find((m) => toMin(m.start) > nowMin);
  if (!cur && !nxt) return null;
  const isLive = !!cur;
  const label = cur ? `● ${cur.name}` : `↗ Next: ${nxt.name}`;
  const sub = cur ? `${cur.start}-${cur.end}` : `at ${nxt.start}`;
  const dotColor = isLive ? C.red : C.blue;
  const bgColor = isLive ? C.redBg : C.blueBg;
  const borderColor = isLive ? C.redBorder : C.blueBorder;
  const textColor = isLive ? C.red : C.blue;
  return (
    <button onClick={() => setExpanded((e) => !e)}
      style={{ display: "inline-flex", alignItems: "center", gap: expanded ? 10 : 0, marginBottom: 18, padding: "6px 14px 6px 11px", background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 24, cursor: "pointer", overflow: "hidden", boxShadow: CARD_SHADOW, whiteSpace: "nowrap", outline: "none" }}>
      <div
        style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0, boxShadow: `0 0 8px ${dotColor}` }} />
      <AnimatePresence>
        {expanded && (
          <motion.div key="content" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.22 }}
            style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, color: textColor }}>{label}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textMuted, paddingLeft: 4, borderLeft: `1px solid ${borderColor}` }}>{sub}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

function Progress({ prospects }) {
  const active = prospects.filter((m) => !m.canceled);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const done = active.filter((m) => toMin(m.end) <= nowMin).length;
  const total = Math.max(active.length, 1);
  const pct = Math.round((done / total) * 100);
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 0.7, textTransform: "uppercase", color: C.textHint }}>Discovery calls</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: pct === 100 ? C.emerald : C.textMuted, fontVariantNumeric: "tabular-nums", transition: "color 0.3s" }}>
          {done}/{active.length} done{pct === 100 ? " ✓" : ""}
        </span>
      </div>
      <div style={{ height: 5, background: C.border, overflow: "hidden", borderRadius: 3 }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 80, damping: 18, delay: 0.1 }}
          style={{ height: "100%", background: `linear-gradient(90deg, ${C.blue} 0%, ${C.emerald} 100%)`, borderRadius: 3 }} />
      </div>
    </div>
  );
}

function Timeline({ prospects, otherEvents }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const DAY_START = 7 * 60, DAY_END = 18 * 60, DAY_SPAN = DAY_END - DAY_START;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowPct = Math.min(100, Math.max(0, ((nowMin - DAY_START) / DAY_SPAN) * 100));
  const hours = Array.from({ length: 12 }, (_, i) => 7 + i);
  const pct = (t) => Math.max(0, Math.min(100, ((toMin(t) - DAY_START) / DAY_SPAN) * 100));
  const wPct = (s, e) => Math.max(0.5, pct(e) - pct(s));
  const calls = prospects.filter((m) => !m.canceled).map((m) => ({ name: m.name.split(" ")[0], start: m.start, end: m.end, color: C.blue }));
  const palMap = { amber: C.amber, purple: C.purple, cyan: C.cyan, emerald: C.emerald, red: C.red };
  const others = otherEvents.map((e) => ({ name: e.name.split(" ")[0], start: e.start, end: e.end, color: palMap[e.color] || C.purple }));

  // State-aware pill: past events recede, the live one glows, upcoming sit
  // ready. The timeline reads as "where am I in the day" at a glance instead
  // of a flat row of identical rectangles.
  const Block = ({ b, lane, i }) => {
    const s = toMin(b.start), e = toMin(b.end);
    const live = nowMin >= s && nowMin < e;
    const past = e <= nowMin;
    return (
      <motion.div
        title={`${b.name} ${b.start}-${b.end}`}
        initial={{ opacity: 0, scaleY: 0.4 }}
        animate={{ opacity: 1, scaleY: 1 }}
        transition={{ delay: 0.12 + i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "absolute", top: lane === 0 ? 4 : 28,
          left: `${pct(b.start)}%`, width: `${wPct(b.start, b.end)}%`,
          height: 18, borderRadius: 9, overflow: "hidden",
          background: past
            ? `linear-gradient(180deg, ${b.color}33, ${b.color}1F)`
            : `linear-gradient(180deg, ${b.color}E6, ${b.color}8C)`,
          border: `1px solid ${past ? `${b.color}40` : `${b.color}B3`}`,
          boxShadow: live ? `0 0 14px -2px ${b.color}CC` : "none",
          animation: live ? "ct-pulse 2.4s ease-in-out infinite" : "none",
        }}
      >
        <span style={{
          fontFamily: FONT_MONO, fontSize: 8.5, fontWeight: 600,
          color: past ? C.textHint : C.bg,
          padding: "0 6px", lineHeight: "17px", whiteSpace: "nowrap",
          overflow: "hidden", textOverflow: "ellipsis", display: "block",
        }}>
          {b.name}
        </span>
      </motion.div>
    );
  };

  return (
    <div style={{ marginBottom: 24, background: C.surface, border: `1px solid ${C.border}`, padding: "14px 16px", borderRadius: 10, boxShadow: CARD_SHADOW }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 0.7, textTransform: "uppercase", color: C.textHint, marginBottom: 10 }}>Day timeline</div>
      <div style={{ position: "relative", height: 66 }}>
        {/* Elapsed part of the day recedes behind a faint wash, so "now" splits
            the strip visually before you even find the marker. */}
        {nowMin > DAY_START && (
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 16,
            width: `${nowPct}%`, borderRadius: 6,
            background: "rgba(255,255,255,0.025)",
          }} />
        )}
        {hours.map((h) => {
          const p = ((h * 60 - DAY_START) / DAY_SPAN) * 100;
          return (
            <div key={h} style={{ position: "absolute", left: `${p}%`, top: 0, bottom: 16 }}>
              <div style={{ position: "absolute", top: 0, bottom: 0, borderLeft: `1px dashed ${C.border}`, opacity: 0.45 }} />
              <span style={{ position: "absolute", bottom: -14, fontFamily: FONT_MONO, fontSize: 8, color: C.textFaint, transform: "translateX(-50%)" }}>{h}h</span>
            </div>
          );
        })}
        {calls.map((b, i) => <Block key={`c${i}`} b={b} lane={0} i={i} />)}
        {others.map((b, i) => <Block key={`o${i}`} b={b} lane={1} i={calls.length + i} />)}
        {nowMin >= DAY_START && nowMin <= DAY_END && (
          <div style={{
            position: "absolute", left: `${nowPct}%`, top: -2, bottom: 14, zIndex: 10,
            width: 2, borderRadius: 1,
            background: `linear-gradient(180deg, ${C.red}, ${C.red}26)`,
            boxShadow: `0 0 8px ${C.red}80`,
          }}>
            <div style={{
              position: "absolute", top: -3, left: -2.5, width: 7, height: 7,
              borderRadius: "50%", background: C.red,
              boxShadow: `0 0 8px ${C.red}CC`,
              animation: "ct-pulse 2s ease-in-out infinite",
            }} />
          </div>
        )}
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 16, alignItems: "center" }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textMuted, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 5, borderRadius: 3, background: C.blue }} /> Calls
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textMuted, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 5, borderRadius: 3, background: C.purple }} /> Other
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.red, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.red, boxShadow: `0 0 6px ${C.red}` }} /> Now
        </span>
      </div>
    </div>
  );
}

function OpenSlots({ prospects, otherEvents }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const blocks = [
    ...prospects.filter((p) => !p.canceled).map((p) => [toMin(p.start), toMin(p.end)]),
    ...otherEvents.map((e) => [toMin(e.start), toMin(e.end)]),
  ].sort((a, b) => a[0] - b[0]);

  const merged = [];
  for (const [s, e] of blocks) {
    const start = Math.max(s, WORK_START);
    const end = Math.min(e, WORK_END);
    if (start >= end) continue;
    if (merged.length && merged[merged.length - 1][1] >= start) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], end);
    } else {
      merged.push([start, end]);
    }
  }

  const gaps = [];
  let cursor = WORK_START;
  for (const [s, e] of merged) {
    if (s > cursor && s - cursor >= MIN_SLOT) gaps.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < WORK_END && WORK_END - cursor >= MIN_SLOT) gaps.push([cursor, WORK_END]);

  const upcoming = gaps.filter(([, e]) => e > nowMin);

  return (
    <div style={{ marginBottom: 24, background: C.surface, border: `1px solid ${C.border}`, padding: "14px 16px", borderRadius: 10, boxShadow: CARD_SHADOW }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 0.7, textTransform: "uppercase", color: C.textHint }}>Open booking slots · 09:00-18:00</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.blue, fontVariantNumeric: "tabular-nums" }}>{upcoming.length} bookable</span>
      </div>
      {upcoming.length === 0 ? (
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.textHint }}>Fully booked. Lunch and AFK blocked off.</span>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {upcoming.map(([s, e], i) => {
            const dur = e - s;
            const live = s <= nowMin && nowMin < e;
            return (
              <span key={i} style={{ fontFamily: FONT_MONO, fontSize: 10, padding: "4px 10px", borderRadius: 4, background: live ? C.blueBg : C.surfaceAlt, border: `1px solid ${live ? C.blue : C.blueBorder}`, color: live ? C.blue : C.textMid, fontVariantNumeric: "tabular-nums" }}>
                {fromMin(s)}-{fromMin(e)} <span style={{ color: C.textHint, marginLeft: 4 }}>{dur}m</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NotificationToggle({ prospects }) {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [perm, setPerm] = useState(supported ? Notification.permission : "unsupported");
  const [hov, setHov] = useState(false);
  const timersRef = useRef([]);

  const enable = async () => {
    if (!supported) return;
    if (perm === "denied") {
      alert("Notifications blocked. Re-enable in chrome://settings/content/notifications then refresh this page.");
      return;
    }
    const result = await Notification.requestPermission();
    setPerm(result);
  };

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (perm !== "granted") return;
    const now = new Date();
    const nowMs = now.getTime();
    const todayBase = new Date(now);
    todayBase.setHours(0, 0, 0, 0);
    prospects.filter((p) => !p.canceled).forEach((p) => {
      const fireMin = toMin(p.start) - NOTIFY_LEAD;
      const fireTs = todayBase.getTime() + fireMin * 60 * 1000;
      const delay = fireTs - nowMs;
      if (delay <= 0) return;
      const t = setTimeout(() => {
        try {
          new Notification(`📞 ${p.name} in ${NOTIFY_LEAD} min`, {
            body: `${p.start} · ${p.company || ""}${p.meetLink ? "\nClick the dashboard tab to join" : ""}`,
            tag: p.email,
          });
        } catch (e) { /* noop */ }
      }, delay);
      timersRef.current.push(t);
    });
    return () => timersRef.current.forEach(clearTimeout);
  }, [perm, prospects]);

  const upcomingCount = useMemo(() => {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return prospects.filter((p) => !p.canceled && (toMin(p.start) - NOTIFY_LEAD) > nowMin).length;
  }, [prospects]);

  if (!supported) return null;
  const label = perm === "granted" ? `🔔 Alerts on · ${upcomingCount} pending` : perm === "denied" ? "🔕 Alerts blocked" : "🔔 Enable alerts";
  const color = perm === "granted" ? C.blue : perm === "denied" ? C.red : C.textMuted;
  const bg = perm === "granted" ? C.blueBg : perm === "denied" ? C.redBg : C.surface;
  const border = perm === "granted" ? C.blueBorder : perm === "denied" ? C.redBorder : C.border;
  return (
    <button onClick={enable} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      title={perm === "granted" ? "Browser will alert 5 min before each call (tab must stay open)" : "Click to enable browser alerts 5 min before each call"}
      style={{ fontFamily: FONT_MONO, fontSize: 10, padding: "4px 10px", borderRadius: 5, border: `1px solid ${hov ? color : border}`, background: bg, color, cursor: perm === "denied" ? "not-allowed" : "pointer", transition: "all 0.12s" }}>
      {label}
    </button>
  );
}

function DayStats({ prospects }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const active = prospects.filter((m) => !m.canceled);
  const done = active.filter((m) => toMin(m.end) <= nowMin).length;
  const alerts = active.filter((m) => m.leadStatus === "Unable to Contact").length;
  const multi = active.filter((m) => m.multiAttendee).length;
  const noReply = active.filter((m) => m.rsvp === "needsAction").length;
  // Colour is earned, not decorative: a count only takes a semantic tone once it
  // actually means something. Zero alerts reads neutral, not red.
  const stats = [
    { label: "Calls",    val: active.length, of: null,           note: active.length ? "briefed" : "clear calendar" },
    { label: "Done",     val: done,          of: active.length,  note: done === active.length && active.length ? "day closed" : "elapsed" },
    { label: "Alerts",   val: alerts,        of: null,           note: alerts ? "unable to contact" : "none",     level: alerts ? "risk" : "ok" },
    { label: "Multi",    val: multi,         of: null,           note: multi ? "multi-attendee" : "single-threaded" },
    { label: "No reply", val: noReply,       of: null,           note: noReply ? "RSVP pending" : "all answered", level: noReply ? "warn" : "ok" },
  ];
  return (
    <div style={{ marginTop: 28 }}>
      <StatRow cols={5}>
        {stats.map((s, i) => (
          <Stat key={i} label={s.label} value={s.val} of={s.of} size="sm" note={s.note} noteLevel={s.level} />
        ))}
      </StatRow>
    </div>
  );
}


// ============ VIEW NAVIGATION ============

function ViewToggle({ mode, setMode }) {
  const tabs = [
    { id: "day",      label: "Day",       icon: "📅" },
    { id: "week",     label: "Week",      icon: "🗓️" },
    { id: "reengage", label: "Re-engage", icon: "↩" },
  ];
  return (
    <div style={{ display: "inline-flex", padding: 3, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 11, gap: 2, boxShadow: CARD_SHADOW }}>
      {tabs.map(({ id, label, icon }) => {
        const active = mode === id;
        return (
          <button key={id} onClick={() => setMode(id)}
            style={{ position: "relative", fontFamily: FONT_SANS, fontSize: 11, fontWeight: 600, padding: "5px 14px", borderRadius: 8, border: "none", background: "transparent", color: active ? C.blue : C.textMuted, cursor: "pointer", zIndex: 1, transition: "color 0.18s", display: "inline-flex", alignItems: "center", gap: 5 }}>
            {active && (
              <motion.span layoutId="view-pill"
                style={{ position: "absolute", inset: 0, borderRadius: 8, background: `linear-gradient(135deg, ${C.blue}2E, ${C.blue}12)`, border: `1px solid ${C.blueBorder}`, zIndex: -1 }}
                transition={{ type: "spring", bounce: 0.18, duration: 0.34 }} />
            )}
            <span>{icon}</span> {label}
          </button>
        );
      })}
    </div>
  );
}

function DayNavigator({ selectedDayIso, setSelectedDayIso }) {
  return (
    <div style={{ display: "flex", gap: 0, marginBottom: 24, padding: 4, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, width: "fit-content", boxShadow: CARD_SHADOW }}>
      {WEEK_DAYS.map((d) => {
        const active = d.iso === selectedDayIso;
        const isToday = d.iso === TODAY_ISO;
        const callCount = (WEEK_PROSPECTS[d.iso] || []).filter((p) => !p.canceled).length;
        return (
          <button key={d.iso} onClick={() => setSelectedDayIso(d.iso)}
            style={{ position: "relative", fontFamily: FONT_SANS, padding: "9px 18px", borderRadius: 10, border: "none", background: "transparent", color: active ? C.text : C.textMuted, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 76, zIndex: 1, transition: "color 0.2s ease" }}>
            {active && (
              <motion.span layoutId="day-nav-pill"
                style={{ position: "absolute", inset: 0, borderRadius: 10, background: `linear-gradient(135deg, ${C.blue}2E, ${C.blue}12)`, border: `1px solid ${C.blueBorder}`, zIndex: -1 }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }} />
            )}
            <span style={{ fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
              {d.short}
              {isToday && <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.emerald, display: "inline-block" }} />}
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, opacity: 0.75, fontVariantNumeric: "tabular-nums" }}>
              {d.dayNum} · {callCount}c
            </span>
          </button>
        );
      })}
    </div>
  );
}

function WeekDayColumn({ day, prospects, isToday }) {
  const sorted = [...prospects].sort((a, b) => toMin(a.start) - toMin(b.start));
  const active = sorted.filter((p) => !p.canceled);
  const multi = active.filter((p) => p.multiAttendee).length;
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ padding: "10px 12px", background: isToday ? C.blueBg : C.surfaceAlt, border: `1px solid ${isToday ? C.blueBorder : C.border}`, borderRadius: "6px 6px 0 0", borderBottom: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: isToday ? C.blue : C.text }}>{day.name}</span>
          {isToday && <span style={{ fontFamily: FONT_MONO, fontSize: 8, fontWeight: 700, background: C.blue, color: C.bg, padding: "1px 6px", borderRadius: 6, letterSpacing: 0.6 }}>TODAY</span>}
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: isToday ? C.blue : C.textMuted, marginBottom: 6 }}>
          {day.dayNum} {day.monthShort}
        </div>
        <div style={{ display: "flex", gap: 8, fontFamily: FONT_MONO, fontSize: 9, color: C.textMuted, flexWrap: "wrap" }}>
          <span><b style={{ color: C.blue }}>{active.length}</b> calls</span>
          {multi > 0 && <span><b style={{ color: C.purple }}>{multi}</b> 👥</span>}
        </div>
      </div>
      <div style={{ flex: 1, padding: 8, background: C.surfaceAlt, border: `1px solid ${isToday ? C.blueBorder : C.border}`, borderTop: "none", borderRadius: "0 0 6px 6px", minHeight: 200 }}>
        {sorted.length === 0 ? (
          <div style={{ padding: "20px 8px", textAlign: "center", fontFamily: FONT_MONO, fontSize: 10, color: C.textHint }}>No calls scheduled</div>
        ) : (
          sorted.map((m, i) => <WeekCard key={i} m={m} />)
        )}
      </div>
    </div>
  );
}

function WeeklyView() {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(180px, 1fr))", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
        {WEEK_DAYS.map((d) => (
          <WeekDayColumn
            key={d.iso}
            day={d}
            prospects={WEEK_PROSPECTS[d.iso] || []}
            isToday={d.iso === TODAY_ISO}
          />
        ))}
      </div>
      <div style={{ marginTop: 14, padding: "10px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: FONT_MONO, fontSize: 9, color: C.textHint, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: C.orange, marginRight: 5, verticalAlign: "middle" }} /> In HubSpot</span>
        <span><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: C.meet, marginRight: 5, verticalAlign: "middle" }} /> Meet link</span>
        <span><span style={{ display: "inline-block", width: 8, height: 2, background: C.blue, marginRight: 5, verticalAlign: "middle" }} /> standard</span>
        <span><span style={{ display: "inline-block", width: 8, height: 2, background: C.emerald, marginRight: 5, verticalAlign: "middle" }} /> SQL / has deal</span>
        <span><span style={{ display: "inline-block", width: 8, height: 2, background: C.red, marginRight: 5, verticalAlign: "middle" }} /> hard-to-reach</span>
        <span>Click <b>Day</b> toggle to drill in.</span>
      </div>
    </div>
  );
}

// ============ RE-ENGAGE TAB ============

function ReEngageCard({ m, doneSet, onToggleDone }) {
  const [hov, setHov] = useState(false);
  const [hovHS, setHovHS] = useState(false);

  // Days since meeting - meetingIso is the calendar date of the meeting
  const meetingMs = new Date((m.meetingIso || TODAY_ISO) + "T" + (m.start || "09:00") + ":00");
  const daysSince = Math.max(0, Math.floor((Date.now() - meetingMs) / 86400000));

  // Heat colors: yellow=fresh(<3d), orange(3-7d), red(8-14d), gray(>14d)
  const heat =
    daysSince < 3  ? { color: C.amber,   bg: C.amberBg,   border: C.amberBorder,   label: "HOT"   } :
    daysSince < 8  ? { color: C.orange,  bg: C.orangeBg,  border: C.orangeBorder,  label: "WARM"  } :
    daysSince < 15 ? { color: C.red,     bg: C.redBg,     border: C.redBorder,     label: "COLD"  } :
                     { color: C.textMuted, bg: C.surfaceAlt, border: C.border,      label: "STALE" };

  const isDone = doneSet.has(m.email);
  const countryData = m.country ? COUNTRY_MAP[m.country.toLowerCase()] : null;
  const statusStyle = m.leadStatus ? (STATUS_MAP[m.leadStatus] || null) : null;

  // Meeting date display: "Tue 19 May · 09:30"
  const meetingDateObj = new Date((m.meetingIso || TODAY_ISO) + "T12:00:00");
  const meetingDateStr = meetingDateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    + " · " + (m.start || "");

  return (
    <div style={{
      background: isDone ? C.surfaceAlt : C.surface,
      border: `1px solid ${isDone ? C.border : (hov ? C.borderHover : C.border)}`,
      borderRadius: 10, padding: "11px 14px", marginBottom: 7,
      opacity: isDone ? 0.55 : 1, transition: "all 0.15s",
      display: "flex", alignItems: "center", gap: 12,
    }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    >
      {/* Heat badge */}
      <div style={{ textAlign: "center", minWidth: 42, flexShrink: 0 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 600, background: heat.bg, color: heat.color, border: `1px solid ${heat.border}`, borderRadius: 10, padding: "2px 6px", marginBottom: 2 }}>{daysSince}d</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: heat.color, letterSpacing: 0.5 }}>{heat.label}</div>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3 }}>
          {m.name}
          {countryData && <span style={{ fontSize: 12, marginLeft: 6 }}>{countryData.flag}</span>}
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 400, color: C.textMuted, marginLeft: 8 }}>· {m.company}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.textHint }}>{meetingDateStr}</span>
          {statusStyle && (
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, padding: "1px 7px", borderRadius: 8, background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }}>{statusStyle.label}</span>
          )}
          {m.seats && (
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, padding: "1px 7px", borderRadius: 8, background: C.surfaceAlt, color: C.textMuted, border: `1px solid ${C.border}` }}>{m.seats} seats</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
        {m.hsLink && (
          <a href={m.hsLink} target="_blank" rel="noreferrer"
            onMouseEnter={() => setHovHS(true)} onMouseLeave={() => setHovHS(false)}
            style={{ fontFamily: FONT_MONO, fontSize: 10, padding: "3px 10px", borderRadius: 5, border: `1px solid ${hovHS ? C.borderHover : C.border}`, background: hovHS ? C.surfaceAlt : C.surface, color: C.textMid, textDecoration: "none", transition: "all 0.12s", display: "inline-block" }}>
            HS →
          </a>
        )}
        <button onClick={() => onToggleDone(m.email)}
          style={{ fontFamily: FONT_MONO, fontSize: 10, padding: "3px 10px", borderRadius: 5, border: `1px solid ${isDone ? C.emeraldBorder : C.border}`, background: isDone ? C.emeraldBg : C.surface, color: isDone ? C.emerald : C.textMuted, cursor: "pointer", transition: "all 0.12s" }}>
          {isDone ? "✓ Done" : "Done"}
        </button>
      </div>
    </div>
  );
}

function ReEngageTab() {
  const todayKey = "re-engage-done-" + TODAY_ISO;
  const [done, setDone] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(todayKey) || "[]")); }
    catch { return new Set(); }
  });

  const toggleDone = (email) => {
    setDone(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email); else next.add(email);
      try { localStorage.setItem(todayKey, JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const EXCLUDED = new Set(["Qualified"]);
  const filterAndSort = (arr) =>
    arr
      .filter(m => m.leadStatus && !EXCLUDED.has(m.leadStatus))
      .slice()
      .sort((a, b) => {
        const da = Math.max(0, Math.floor((Date.now() - new Date((a.meetingIso || TODAY_ISO) + "T" + (a.start || "09:00") + ":00")) / 86400000));
        const db = Math.max(0, Math.floor((Date.now() - new Date((b.meetingIso || TODAY_ISO) + "T" + (b.start || "09:00") + ":00")) / 86400000));
        return da - db; // freshest first
      });

  const getWeekRange = (arr) => {
    if (!arr.length) return "";
    const isos = arr.map(m => m.meetingIso).filter(Boolean).sort();
    if (!isos.length) return "";
    const fmt = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return isos[0] === isos[isos.length - 1] ? fmt(isos[0]) : fmt(isos[0]) + " – " + fmt(isos[isos.length - 1]);
  };

  const w1 = filterAndSort(LAST_WEEK_PROSPECTS);
  const w2 = filterAndSort(TWO_WEEKS_AGO_PROSPECTS);
  const hasAny = w1.length > 0 || w2.length > 0;

  const SectionHeader = ({ label, dateRange, arr }) => {
    const pending = arr.filter(m => !done.has(m.email)).length;
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, marginTop: 4 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 0.7, textTransform: "uppercase", color: C.textHint }}>{label}{dateRange ? " · " + dateRange : ""}</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 9, padding: "1px 9px", borderRadius: 8, background: C.blueBg, color: C.blue, border: `1px solid ${C.blueBorder}` }}>{pending} to reach out</span>
      </div>
    );
  };

  if (!hasAny) return (
    <div style={{ padding: "40px 20px", textAlign: "center", background: C.surface, border: `1px dashed ${C.border}`, borderRadius: 8 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.textMuted, marginBottom: 6 }}>No prospects to re-engage yet.</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.textHint, lineHeight: 1.6 }}>This tab fills after the first morning refresh that pulls W-1 data.<br />Run "refresh my daily briefing" in Cowork to trigger it now.</div>
    </div>
  );

  return (
    <div>
      {w1.length > 0 && (
        <>
          <SectionHeader label="Last week" dateRange={getWeekRange(LAST_WEEK_PROSPECTS)} arr={w1} />
          {w1.map((m, i) => <ReEngageCard key={i} m={m} doneSet={done} onToggleDone={toggleDone} />)}
        </>
      )}
      {w1.length > 0 && w2.length > 0 && (
        <div style={{ height: 1, borderTop: `1px dashed ${C.border}`, margin: "20px 0" }} />
      )}
      {w2.length > 0 && (
        <>
          <SectionHeader label="Two weeks ago" dateRange={getWeekRange(TWO_WEEKS_AGO_PROSPECTS)} arr={w2} />
          {w2.map((m, i) => <ReEngageCard key={i} m={m} doneSet={done} onToggleDone={toggleDone} />)}
        </>
      )}
    </div>
  );
}

// ============ AGENDA SPINE ============
// Proposal 01: vertical time-rail with NOW line, faded done events, emerald
// next-glow. Merges prospects + other events chronologically, then bins them
// into done / live / next / upcoming based on the wall clock.
function AgendaSpine({ prospects, otherEvents, isToday, notes, setNotes, qualMap, setQualStatus }) {
  const [nowMin, setNowMin] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    }, 30000);
    return () => clearInterval(id);
  }, [isToday]);

  const items = useMemo(() => {
    const a = prospects.map((m) => ({
      type: "prospect", start: m.start, end: m.end,
      startMin: toMin(m.start), endMin: toMin(m.end), data: m,
    }));
    const b = otherEvents.map((ev) => ({
      type: "other", start: ev.start, end: ev.end,
      startMin: toMin(ev.start), endMin: toMin(ev.end), data: ev,
    }));
    return [...a, ...b].sort((x, y) => x.startMin - y.startMin);
  }, [prospects, otherEvents]);

  // First non-done item is the "next" (only meaningful when not currently live).
  let nextIdx = -1;
  if (isToday) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].startMin > nowMin) { nextIdx = i; break; }
    }
  } else if (items.length > 0) {
    nextIdx = 0;
  }

  function statusOf(item, idx) {
    if (!isToday) return idx === 0 ? "next" : "upcoming";
    if (item.endMin <= nowMin) return "done";
    if (item.startMin <= nowMin && nowMin < item.endMin) return "live";
    if (idx === nextIdx) return "next";
    return "upcoming";
  }

  // Where to slot the horizontal NOW line: right after the last done item,
  // unless we're currently inside a live one (then the live card carries the glow).
  let nowInsertIdx = -1;
  if (isToday && items.length > 0) {
    let liveExists = false;
    let lastDone = -1;
    for (let i = 0; i < items.length; i++) {
      if (items[i].startMin <= nowMin && nowMin < items[i].endMin) { liveExists = true; break; }
      if (items[i].endMin <= nowMin) lastDone = i;
    }
    if (!liveExists) {
      if (lastDone === -1 && items[0].startMin > nowMin) nowInsertIdx = 0;
      else if (lastDone >= 0 && lastDone < items.length - 1) nowInsertIdx = lastDone + 1;
    }
  }

  const nowHHMM = String(Math.floor(nowMin / 60)).padStart(2, "0") + ":" + String(nowMin % 60).padStart(2, "0");

  if (items.length === 0) {
    return (
      <div style={{ padding: "24px 16px", background: C.surface, border: `1px dashed ${C.border}`, borderRadius: 6, fontFamily: FONT_MONO, fontSize: 11, color: C.textHint, textAlign: "center" }}>
        Nothing scheduled.
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={items.map((i) => i.start + i.type).join("|")}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22 }}
        style={{ marginTop: 8 }}
      >
        {items.map((item, i) => {
          const status = statusOf(item, i);
          const isProspect = item.type === "prospect";
          const dotColor =
            status === "live" || status === "next" ? C.emerald :
            status === "done" ? C.textHint : C.blue;
          const timeColor =
            status === "done" ? C.textHint :
            status === "live" || status === "next" ? C.emerald : C.textMid;
          const glow = status === "live" ? `0 0 14px ${C.emerald}` :
                       status === "next" ? `0 0 8px ${C.emerald}AA` : "none";

          return (
            <div key={`${item.type}-${item.start}-${i}`}>
              {nowInsertIdx === i && (
                <div style={{ display: "grid", gridTemplateColumns: "62px 1fr", gap: 0, alignItems: "center", margin: "10px 0 18px" }}>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.emerald, textAlign: "right", paddingRight: 14, fontWeight: 700, letterSpacing: 1.4 }}>NOW</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                      style={{ width: 7, height: 7, borderRadius: "50%", background: C.emerald, boxShadow: `0 0 10px ${C.emerald}` }}
                    />
                    <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${C.emerald} 0%, ${C.emeraldBorder} 60%, transparent 100%)` }} />
                    <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.emerald, fontWeight: 600, letterSpacing: 0.5 }}>{nowHHMM}</span>
                  </div>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "62px 1fr", gap: 14, alignItems: "stretch", position: "relative" }}>
                <div style={{ position: "relative", paddingTop: 16, borderRight: `1px solid ${status === "done" ? C.border : C.borderHover}` }}>
                  <div style={{
                    position: "absolute", top: 20, right: -5,
                    width: 10, height: 10, borderRadius: "50%",
                    background: dotColor, boxShadow: glow,
                    border: `2px solid ${C.bg}`, zIndex: 2,
                  }} />
                  <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: timeColor, textAlign: "right", paddingRight: 16, fontWeight: 600, letterSpacing: 0.5 }}>
                    {item.start}
                  </div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: C.textHint, textAlign: "right", paddingRight: 16, marginTop: 2, letterSpacing: 0.3 }}>
                    {item.end}
                  </div>
                </div>
                <div style={{
                  opacity: status === "done" ? 0.42 : 1,
                  filter: status === "done" ? "saturate(0.55)" : "none",
                  transition: "opacity 0.25s, filter 0.25s",
                }}>
                  {isProspect
                    ? <ProspectCard m={item.data} notes={notes} setNotes={setNotes} index={i} qualStatus={qualMap?.[item.data.email]} setQualStatus={setQualStatus} />
                    : <OtherCard ev={item.data} index={i} />}
                </div>
              </div>
            </div>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}

// ============ ROOT ============

export default function DailyBriefing() {
  const [notes, setNotes] = useState({});
  const [mode, setMode] = useState("day");
  const [selectedDayIso, setSelectedDayIso] = useState(TODAY_ISO);
  const [qualMap, setQualStatus] = useQualStatus();

  const dayMeta = WEEK_DAYS.find((d) => d.iso === selectedDayIso) || WEEK_DAYS[0];
  const dayProspects = WEEK_PROSPECTS[selectedDayIso] || [];
  const dayOtherEvents = WEEK_OTHER_EVENTS[selectedDayIso] || [];
  const active = dayProspects.filter((m) => !m.canceled);
  const tally = qualTally(active, qualMap);
  const other = [...dayOtherEvents].sort((a, b) => toMin(a.start) - toMin(b.start));
  const isToday = selectedDayIso === TODAY_ISO;

  return (
    <div style={{
      fontFamily: FONT_SANS,
      minHeight: "100vh",
      background: "transparent",
      color: C.text,
      position: "relative",
      overflowX: "clip",
    }}>
      <div style={{
        position: "relative",
        maxWidth: mode === "week" ? 1280 : 1180,
        margin: "0 auto",
        padding: "30px 28px 80px",
        transition: "max-width 0.2s ease",
      }}>

        <div style={{
          display: "flex", alignItems: "flex-end", justifyContent: "space-between",
          flexWrap: "wrap", gap: 14, marginBottom: 24,
          paddingBottom: 18, borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ minWidth: 0 }}>
            <SectionLabel>02 · Today</SectionLabel>
            <div style={{ marginTop: 10 }}><Greeting /></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <ViewToggle mode={mode} setMode={setMode} />
            {mode === "day" && <NotificationToggle prospects={dayProspects} />}
            <button
              onClick={() => window.location.reload()}
              style={{
                background: C.wellBg, border: `1px solid ${C.border}`, color: C.textMuted,
                borderRadius: R.sm, padding: "7px 12px", cursor: "pointer",
                fontFamily: FONT_MONO, fontSize: T.micro,
              }}
            >↻ Reload</button>
          </div>
        </div>

        {/* DAY MODE - cockpit two-column bento */}
        {mode === "day" && (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } }}
            style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 26 }}
          >
            {/* MAIN COLUMN */}
            <motion.div variants={FADE_UP} style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <DayNavigator selectedDayIso={selectedDayIso} setSelectedDayIso={setSelectedDayIso} />

              {isToday && (
                <>
                  <NowIndicator prospects={dayProspects} />
                  <Timeline prospects={dayProspects} otherEvents={dayOtherEvents} />
                </>
              )}

              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14, marginTop: 4, flexWrap: "wrap", gap: 8 }}>
                <SectionLabel>Agenda spine</SectionLabel>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.emerald }}>{tally.qualified} demo</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.amber }}>{tally.working} working</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.red }}>{tally.qualified_out} out</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.textMuted }}>{tally.pending} pending</span>
                  <SectionLabel>
                    {active.length} discovery {other.length > 0 ? `· ${other.length} other` : ""}
                  </SectionLabel>
                </div>
              </div>
              <AgendaSpine
                key={selectedDayIso}
                prospects={active}
                otherEvents={other}
                isToday={isToday}
                notes={notes}
                setNotes={setNotes}
                qualMap={qualMap}
                setQualStatus={setQualStatus}
              />

              {isToday && <DayStats prospects={dayProspects} />}
            </motion.div>

            {/* RIGHT RAIL - sticky */}
            <motion.div variants={FADE_UP} style={{ minWidth: 0 }}>
              <div style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Day status card (hero in the rail) */}
              <Card label={isToday ? "Today" : "Selected day"} pad={20}>
                <div style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: T.title,
                  fontWeight: 600,
                  color: C.text,
                  letterSpacing: TRACK.tight,
                }}>
                  {dayMeta.name} {dayMeta.dayNum} {dayMeta.monthShort}
                </div>
                <div style={{ marginTop: 14, display: "flex", gap: 18, flexWrap: "wrap" }}>
                  <RailStat label="Discovery" value={active.length} tone="iris" />
                  <RailStat label="Other"     value={other.length}  tone="cyan" />
                </div>
                {!isToday && (
                  <div style={{ marginTop: 12, fontFamily: FONT_MONO, fontSize: T.micro, fontStyle: "italic", color: C.textHint }}>
                    HubSpot enrichment runs the morning of
                  </div>
                )}
              </Card>

              {isToday && <Progress prospects={dayProspects} />}
              {isToday && <OpenSlots prospects={dayProspects} otherEvents={dayOtherEvents} />}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* WEEK MODE */}
        {mode === "week" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
              <SectionLabel>
                Week of {WEEK_DAYS[0].dayNum}-{WEEK_DAYS[WEEK_DAYS.length - 1].dayNum} {WEEK_DAYS[0].monthShort} · {Object.values(WEEK_PROSPECTS).reduce((acc, arr) => acc + arr.filter((p) => !p.canceled).length, 0)} calls
              </SectionLabel>
              <span style={{ fontFamily: FONT_MONO, fontSize: T.micro, color: C.textHint }}>Toggle to Day for live timeline + notes</span>
            </div>
            <WeeklyView />
          </>
        )}

        {/* RE-ENGAGE MODE */}
        {mode === "reengage" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
              <SectionLabel>Re-engage · W-1 + W-2 · unqualified only</SectionLabel>
              <span style={{ fontFamily: FONT_MONO, fontSize: T.micro, color: C.textHint }}>Yellow = freshest. Mark Done once you've reached out.</span>
            </div>
            <ReEngageTab />
          </>
        )}

        {/* Footer */}
        <div style={{ marginTop: 40, marginBottom: 16, borderTop: `1px solid ${C.border}` }} />
        <div style={{ fontFamily: FONT_MONO, fontSize: T.micro, color: C.textFaint, letterSpacing: 1, lineHeight: 1.6 }}>
          {REFRESHED_AT} · {OWNER.email} · Auto-refresh weekdays at 07:30
        </div>
      </div>

    </div>
  );
}
