// Pure date derivations for the daily-brief refresh. No I/O, no dependencies.
//
// The refresh generator (Option A: agent-orchestrated) calls these with the run
// date - normally the system clock - so every module's date scaffolding is
// stamped consistently at pull time. These are deliberately NOT wired into the
// app's render path: data and its date stamp are written together by the same
// refresh, so a stale pull can never show a misleading "today". Updating the run
// date here is the single knob that moves TODAY_ISO, WEEK_DAYS, the week label,
// the funnel months, and the 90-day Self-Served window in lockstep.
//
// All arithmetic is done on a UTC-pinned copy of the run date's calendar Y/M/D,
// so results never drift with the host timezone.

const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DAY_MS = 86400000;
const pad2 = (n) => String(n).padStart(2, "0");

// Accepts a Date or a "YYYY-MM-DD" string. Returns a Date pinned to UTC midnight
// of the intended calendar day, so getUTC* reads and day arithmetic are stable.
function normalize(input = new Date()) {
  if (typeof input === "string") {
    const [y, m, d] = input.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  return new Date(Date.UTC(input.getFullYear(), input.getMonth(), input.getDate()));
}

// iso string from an already UTC-pinned Date (no re-normalize). Internal use so
// that Dates produced by week/window arithmetic are read in the same UTC frame
// they were built in, never reinterpreted through the host timezone.
function isoUTC(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

// "YYYY-MM-DD"
export function isoFor(input) {
  return isoUTC(normalize(input));
}

// "Tuesday, 30 June 2026"
export function longLabel(input) {
  const d = normalize(input);
  return `${WEEKDAY_LONG[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// "Tue 30 Jun 2026"
export function shortStamp(input) {
  const d = normalize(input);
  return `${WEEKDAY_SHORT[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// "Tue 30 Jun 2026 09:00 CEST - Live HubSpot + Calendar pull"
// time/tz are pull-time values supplied by the generator; note is the source tag.
export function refreshedAt(input, note, { time, tz } = {}) {
  const head = shortStamp(input);
  const clock = [time, tz].filter(Boolean).join(" ");
  const left = clock ? `${head} ${clock}` : head;
  return note ? `${left} - ${note}` : left;
}

// Monday of the run date's ISO week, UTC-pinned.
function mondayOf(input) {
  const d = normalize(input);
  const day = d.getUTCDay();                  // 0=Sun..6=Sat
  const offset = day === 0 ? -6 : 1 - day;    // back to Monday
  return new Date(d.getTime() + offset * DAY_MS);
}

// Mon..Fri of the run date's week, matching the WEEK_DAYS shape used by module 01.
// [{ iso, name, short, dayNum, monthShort }]
//
// Working week only. Saturday used to be included and was always an empty column -
// no prospect ever books one, so it cost a fifth of the grid to render nothing.
// Note weekLabel below still spans Mon-Sun: that is module 03's reporting window,
// a different concern, and deliberately not narrowed with this.
export function weekDays(input) {
  const mon = mondayOf(input);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(mon.getTime() + i * DAY_MS);
    return {
      iso: isoUTC(d),
      name: WEEKDAY_LONG[d.getUTCDay()],
      short: WEEKDAY_SHORT[d.getUTCDay()],
      dayNum: pad2(d.getUTCDate()),
      monthShort: MONTH_SHORT[d.getUTCMonth()],
    };
  });
}

// "Mon 29 Jun - Sun 5 Jul" (full Mon-Sun ISO week, day numbers not padded).
export function weekLabel(input) {
  const mon = mondayOf(input);
  const sun = new Date(mon.getTime() + 6 * DAY_MS);
  const part = (d) => `${WEEKDAY_SHORT[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
  return `${part(mon)} - ${part(sun)}`;
}

// "June 2026"
export function monthLabel(input) {
  const d = normalize(input);
  return `${MONTH_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Rolling window ending on the run date. `days` = count of distinct calendar
// dates covered, both endpoints inclusive - so a 90-day window spans exactly 90
// dates (start = end - (days - 1)), not 91.
// { start: "YYYY-MM-DD", end: "YYYY-MM-DD", days }
export function rollingWindow(input, days = 90) {
  const end = normalize(input);
  const start = new Date(end.getTime() - (days - 1) * DAY_MS);
  return { start: isoUTC(start), end: isoUTC(end), days };
}

// Year-to-date month keys, January of the run date's year through its month.
// ["2026-01", ..., "2026-06"]
export function ytdMonths(input) {
  const d = normalize(input);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  return Array.from({ length: month }, (_, i) => `${year}-${pad2(i + 1)}`);
}
