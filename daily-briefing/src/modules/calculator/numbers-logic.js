// Numbers Finder - pure logic layer.
// Extracted from the standalone Numbers Finder artifact. Zero DOM, zero React.
// Every function is deterministic: CSV text in, structured model out.

export function parseCSV(text) {
  const rows = []; let row = []; let f = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const clean = s => (s || '').replace(/\s+/g, ' ').trim();
export const fold = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const COLS = {
  whatsapp: /whats\s*app/i,
  country: /^country$/i,
  type: /^number type$/i,
  compliance: /compliance/i,
  wait: /wait time/i,
  calling: /calling functionality/i,
  messaging: /messaging functionality/i,
  monthly: /^monthly price$/i,
  activation: /^one-time activation$/i,
  trial: /free trial/i,
  lar: /in-country address/i,
  individual: /individual allocation/i,
  gray: /gray zone/i,
  self: /self service/i,
  carrier: /^carrier$/i,
};

export function buildModel(csvText) {
  const rows = parseCSV(csvText);
  const hi = rows.findIndex(r => r.some(c => /^country$/i.test(clean(c))) && r.some(c => /number type/i.test(clean(c))));
  if (hi < 0) throw { layout: true, missing: ['header row (Country / Number Type)'] };
  const head = rows[hi].map(clean);
  const idx = {}; const missing = [];
  for (const [k, re] of Object.entries(COLS)) {
    const j = head.findIndex(h => re.test(h));
    if (j < 0) missing.push(k); else idx[k] = j;
  }
  if (missing.length) throw { layout: true, missing };
  const byCountry = new Map();
  for (const r of rows.slice(hi + 1)) {
    const g = k => (r[idx[k]] || '').trim();
    const country = clean(g('country'));
    if (!country) continue;
    if (!byCountry.has(country)) byCountry.set(country, []);
    const type = clean(g('type'));
    if (!type) continue;
    byCountry.get(country).push(toCard(country, {
      type, compliance: g('compliance'), wait: g('wait'), calling: g('calling'), messaging: g('messaging'),
      monthly: g('monthly'), activation: g('activation'), trial: g('trial'), lar: g('lar'),
      individual: g('individual'), gray: g('gray'), self: g('self'), whatsapp: g('whatsapp'), carrier: g('carrier'),
    }));
  }
  for (const [k, list] of byCountry) {
    const base = t => t.replace(/\(?\s*option\s*\d+[^)]*\)?/ig, '').replace(/\s+/g, ' ').trim().toLowerCase();
    const opt = t => { const m = t.match(/option\s*(\d+)/i); return m ? +m[1] : 0; };
    const first = new Map(); list.forEach((c, i) => { const b = base(c.type); if (!first.has(b)) first.set(b, i); });
    byCountry.set(k, list.map((c, i) => ({ c, i })).sort((a, b) =>
      (first.get(base(a.c.type)) - first.get(base(b.c.type))) || (opt(a.c.type) - opt(b.c.type)) || (a.i - b.i)).map(x => x.c));
  }
  return byCountry;
}

const DEMONYM = {
  'France': 'French', 'Netherlands': 'Dutch', 'Poland': 'Polish', 'Switzerland': 'Swiss', 'Ireland': 'Irish',
  'United Kingdom': 'British|UK', 'Denmark': 'Danish', 'Finland': 'Finnish', 'Germany': 'German', 'Spain': 'Spanish',
  'Philippines': 'Filipino|Philippine', 'United States': 'US|American', 'China': 'Chinese', 'Japan': 'Japanese',
  'Chile': 'Chilean', 'Peru': 'Peruvian', 'Portugal': 'Portuguese', 'Sweden': 'Swedish', 'Norway': 'Norwegian',
  'Belgium': 'Belgian', 'Austria': 'Austrian', 'Australia': 'Australian', 'Italy': 'Italian', 'Mexico': 'Mexican',
  'Brazil': 'Brazilian', 'Canada': 'Canadian', 'Czech Republic': 'Czech', 'Greece': 'Greek', 'Hungary': 'Hungarian',
  'Turkey': 'Turkish', 'Israel': 'Israeli', 'Argentina': 'Argentin\\w*', 'Colombia': 'Colombian', 'Romania': 'Romanian',
  'New Zealand': 'New Zealand|NZ', 'South Africa': 'South African', 'Croatia': 'Croatian', 'Slovakia': 'Slovak',
  'Slovenia': 'Slovenian', 'Lithuania': 'Lithuanian', 'Latvia': 'Latvian', 'Estonia': 'Estonian', 'Bulgaria': 'Bulgarian',
  'Luxembourg': 'Luxembourg\\w*', 'India': 'Indian', 'Singapore': 'Singapore\\w*', 'Hong Kong': 'Hong Kong',
};
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function localSignal(raw, country) {
  const text = raw
    .replace(/(does not|doesn't|do not|don't|not)\s+(have|need)\s+to\s+be\s+(located\s+|based\s+|registered\s+)?in\s+[^,.;\n]*/gi, ' ')
    .replace(/anywhere in the world|anywhere globally|from any country( in the world)?|in any country|can be anywhere/gi, ' ');
  if (/must be in|same (city|country|area|region|state|province)|in the same|in-country|within the country|local (address|business|entity|company|registration|presence)|\b(registered|based|located|resident|established) in\b|service address in|businesses must/i.test(text)) return true;
  if (new RegExp('\\bin (the )?' + esc(country) + '\\b', 'i').test(text)) return true;
  const dem = DEMONYM[country];
  if (dem && new RegExp('\\b(' + dem + ')\\s+(business registration|business|fiscal|tax|registration|address|entity|resident|citizen|VAT)\\b', 'i').test(text)) return true;
  return false;
}

const TAGS = [
  ['Business registration', /registration|registry|register\b|extract|kbis|handelsregister|incorporat|chamber of commerce|record of/i],
  ['Representative ID', /passport|national id|id card|\bID of\b|representative/i],
  ['Tax / VAT ID', /\bvat\b|\btax\b|fiscal|\bnif\b|\bcif\b|\babn\b|\bacn\b|\bein\b|siret|siren|cnpj|\brfc\b|\bgst\b|\brut\b|\bcuit\b/i],
  ['Address', /address/i],
  ['Proof of address', /proof of address|utility bill|bank statement/i],
  ['Website', /website|\burl\b|http/i],
  ['Signed authorization', /letter of authori|authori[sz]ation form|\bLOA\b|must be signed|needs to be signed/i],
  ['Use-case description', /service description|use case|describe|description/i],
  ['Contact details', /contact (name|email|phone|number)|email|phone number/i],
  ['Letter of intent', /letter of intent|\bLOI\b/i],
  ['Special order process', /special order process/i],
  ['Usage restrictions', /policy|terms of service|licensed for|designated by|permis+ible use/i],
];

export function complianceTags(text, isLocal, verdict) {
  if (!text || verdict === 'open') return [];
  const scoped = /for [A-Z][a-z]+ (companies|businesses),? a special order/.test(text);
  const tags = TAGS.filter(([n, re]) => re.test(text) && !(scoped && n === 'Special order process')).map(([n]) => n === 'Address' && isLocal ? 'Local address' : n);
  return tags.length ? tags : ['See full requirements'];
}

const FOREIGN_OK = /(can|may) be (from|in) (a different|another|any) country|\bnon-[A-Z][a-z]+ (registered|based) (businesses|companies)|(registration|company|business)[^.,;]{0,60}(does not|doesn't) (have|need) to be in|foreign (companies|businesses) (are|can)/;
export function verdict(c) {
  const text = c.compliance;
  const lar = /^yes/i.test(c.lar);
  const local = text ? localSignal(text, c.country) : false;
  if (lar && (FOREIGN_OK.test(text) || /\bnon-[a-z]+ based/i.test(c.type))) return { key: 'address', local: true };
  if (lar) return { key: 'local', local: true };
  if (!text || /^(none|no requirements?\.?|n\/?a|-)$/i.test(clean(text))) return { key: 'open', local: false };
  if (local) return { key: 'check', local: true };
  const onlyNoReq = /no requirements?/i.test(text) && !TAGS.some(([n, re]) => n !== 'Usage restrictions' && re.test(text));
  if (onlyNoReq) return { key: 'open', local: false };
  return { key: 'docs', local: false };
}

export function parseWait(w) {
  const t = clean(w);
  if (!t || t === '-' || t === '0') return { text: 'On demand', fast: true };
  if (/^\d+\s*(-\s*\d+)?$/.test(t)) return { text: t.replace(/\s*-\s*/, '-') + ' business days', fast: false };
  return { text: t, fast: false };
}

export function parsePrice(p) {
  const t = clean(p);
  if (!t) return null;
  const n = t.replace(/[€$\s]|eur/gi, '');
  return /^\d+([.,]\d+)?$/.test(n) ? '\u20AC' + n.replace(',', '.') : t;
}

export function family(type) {
  const t = type.toLowerCase();
  if (/toll/.test(t)) return 'Toll Free';
  if (/mobile/.test(t)) return 'Mobile';
  if (/shared/.test(t)) return 'Shared Cost';
  if (/national/.test(t)) return 'National';
  if (/fixed|local|geographic|landline/.test(t)) return 'Fixed / landline';
  return 'Other';
}

export function voiceClassify(calling, type, messaging, country) {
  const t = (calling || '').replace(/\s+/g, ' ');
  const ty = type || '';
  const all = t + ' ' + ty + ' ' + (messaging || '');
  let mode = 'both';
  if (/sms[- ]only|cannot make calls|not call capable/i.test(all) && !/calling[- ]only|voice[- ]only/i.test(all)) mode = 'none';
  else if (/inbound[- ]only|inbound calling only|only inbound calls|can only receive inbound|outbound call(s|ing)?[^.,]{0,30}(not supported|not permitted|not possible|forbidden|\bno\b)|not (allowed|capable) (to make|of) outbound calls|cannot make outbound calls|restricted from making outbound/i.test(t + ' ' + ty)) mode = 'inbound';
  else if (/outbound only|cannot receive inbound|not capable of inbound|inbound calls?:? not supported/i.test(t + ' ' + ty)) mode = 'outbound';
  else if (/^unknown|new beta option|contact our carrier operations/i.test(t.trim())) mode = 'unknown';
  const flags = [];
  const lc = t.match(/not capable of outbound local calls(?: to ([A-Z][a-z]+))?/i);
  if (lc) flags.push({ text: 'No outbound calls within ' + (lc[1] || country), level: 'bad' });
  if (mode !== 'inbound' && mode !== 'none' && /outbound call(s|ing)?( to [A-Z][\w ]+)?:?\s*(is |are )?not gua\w*teed|outbound calling from [^.]{0,25}not gua\w*teed|cannot guarantee outbound|limited outbound reachability/i.test(t)) flags.push({ text: 'Outbound not guaranteed', level: 'warn' });
  if (mode !== 'outbound' && mode !== 'none' && /reachable only nationally|not reachable internationally|international (inbound calls|reachability)[^.]{0,40}not guaranteed|international inbound calls[^.]{0,60}not guaranteed/i.test(t)) flags.push({ text: 'Not reachable from abroad', level: 'warn' });
  const cc = t.match(/only (\d+) (?:concurr?ent |simultaneous )?inbound calls?/i);
  const ca = !cc && t.match(/only capable of (\d+) concurr?ent calls?/i);
  if (ca) flags.push({ text: 'Max ' + ca[1] + ' call' + (ca[1] === '1' ? '' : 's') + ' at once', level: 'warn' });
  if (cc) flags.push({ text: 'Max ' + cc[1] + ' inbound call' + (cc[1] === '1' ? '' : 's') + ' at once' + (/extended/i.test(t) && !/not extendable/i.test(t) ? ' (extendable, extra fee)' : ''), level: 'warn' });
  if (/caller id (cannot be guaranteed|not guaranteed|will be overwritten|will be hidden|can be hidden)/i.test(t)) flags.push({ text: 'Caller ID not guaranteed', level: 'warn' });
  if (/inbound reachability issues/i.test(t)) flags.push({ text: 'Inbound reachability issues reported', level: 'warn' });
  if (/post-dial-delay/i.test(t)) flags.push({ text: 'Occasional post-dial delay', level: 'warn' });
  return { mode, flags };
}

const tidyFmt = f => f.replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-').replace(/X/g, 'x').replace(/^\+ /, '+').trim();
export function numberFormat(type, text) {
  let m;
  if ((m = type.match(/\((\+?\d[\d\sxX]*?)\s*format\)/i))) return tidyFmt(m[1]);
  if ((m = type.match(/\+(\d{2})(\d) and \+\d{2}(\d) format/i))) return '+' + m[1] + ' ' + m[2] + ' / +' + m[1] + ' ' + m[3];
  const t = text.replace(/\s+/g, ' ');
  if ((m = t.match(/ranges designated[^()]*((?:\(\d{3}\),?\s*)+)/i))) return 'Ranges ' + m[1].match(/\d{3}/g).join(' \u00B7 ');
  if ((m = t.match(/format(?: for [^.,]{0,30})? is (\+?\d[\d\sxX-]{2,20}[\dxX])/i))) return tidyFmt(m[1]);
  if ((m = t.match(/format:?\s+(\+\s?\d[\d\sxX()-]{1,22}[\dxX])/i))) return tidyFmt(m[1]);
  if ((m = t.match(/(\+\s?\d[\d\sxX-]{2,22}[\dxX])\s*format/i))) return tidyFmt(m[1]);
  if ((m = t.match(/\b(\d{2} \d[\dxX]{1,6}) format/i))) return '+' + tidyFmt(m[1]);
  if ((m = t.match(/dialing format:?\s*([\dxX][\dxX-]{6,20}[\dxX])/i))) return tidyFmt(m[1]);
  return null;
}

const RULES = [
  { id: 'camp-cold', kind: 'campaign', level: 'info', label: 'Designated range: cold calls / unsolicited sales', re: /(designated|range)[^.]{0,140}(cold call|unsoli+cit|unknown contacts)/i },
  { id: 'camp-optin', kind: 'campaign', level: 'info', label: 'Designated range: automated calls to opted-in contacts', re: /designated[^.]{0,140}(opted-in|known)/i },
  { id: 'camp', kind: 'campaign', level: 'info', label: 'Designated range: campaign / automated commercial calls', re: /designated[^.]{0,100}(automated commercial|marketing|telemarketing)/i },
  { id: 'p2p', level: 'bad', label: 'Person-to-person only - no marketing or automated use', re: /only licensed for (interpersonal|person)|licensed for person to person|may only be used for two-way person-to-person|should not be used for any type of marketing/i },
  { id: 'dialer', level: 'bad', label: 'No parallel or AI dialer', re: /parallel dial|ai sales dial/i },
  { id: 'callcentre', level: 'bad', label: 'Call-centre rule: disclose agent location (fines apply)', re: /geographic location of the agent/i },
  { id: 'industries', level: 'bad', label: null, re: /can ?not be used for ([^.;]+)/i },
  { id: 'forex', level: 'warn', label: 'Forex use not supported', re: /forex use case is not supported/i },
  { id: 'business', level: 'warn', label: 'Business use only', re: /private use is not allowed|business use (is )?required/i },
  { id: 'commit', level: 'warn', label: null, re: /minimum commitment period[^.]{0,80}?(\d+)\s*months/i },
  { id: 'a2p', level: 'warn', label: 'SMS to the US needs A2P registration', re: /a2p[^.]{0,25}registration|10dlc/i },
  { id: 'queues', level: 'warn', label: 'Hold queues / waiting loops restricted', re: /waiting loops|holding queues/i },
  { id: 'a2p-ok', level: 'ok', label: 'Licensed for commercial / A2P use', re: /licensed for broader range of uses/i },
  { id: 'voip', level: 'warn', label: 'Standard mobile prefix not usable on VoIP', re: /not available for use on VoIP/i },
];
const chunkOf = (text, idx) => {
  const start = Math.max(text.lastIndexOf('\n', idx), text.lastIndexOf('. ', idx) + 1, text.lastIndexOf('* ', idx) + 1, 0);
  let end = text.slice(idx).search(/\n|\.\s|$/); end = end < 0 ? text.length : idx + end + 1;
  return text.slice(start, end).replace(/\s+/g, ' ').replace(/^[\s*.-]+/, '').trim().slice(0, 280);
};
export function extractRules(type, text) {
  const out = []; const seen = new Set();
  for (const r of RULES) {
    let all = text, m = text.match(r.re);
    if (!m) { all = type; m = type.match(r.re); }
    if (!m) continue;
    if (r.kind === 'campaign' && [...seen].some(x => x.startsWith('camp'))) continue;
    let label = r.label;
    if (r.id === 'industries') label = 'Not allowed for: ' + m[1].replace(/\s+/g, ' ').trim().replace(/\s*services$/i, '');
    if (r.id === 'commit') label = m[1] + '-month minimum commitment';
    seen.add(r.id);
    out.push({ id: r.id, kind: r.kind || 'rule', level: r.level, label, quote: chunkOf(all, m.index) });
  }
  if (!out.some(x => x.kind === 'campaign') && /telemarketing/i.test(type)) out.unshift({ id: 'camp', kind: 'campaign', level: 'info', label: 'Campaign / telemarketing number', quote: '' });
  return out;
}

export function toCard(country, raw) {
  const c = { country, ...raw };
  const v = verdict(c);
  const msg = c.messaging; const call = c.calling;
  const sms = /not sms[- ]capable|cannot send sms|not sms/i.test(msg + ' ' + call) ? false : (/sms/i.test(msg) || /sms/i.test(call)) ? true : false;
  const voice = voiceClassify(c.calling, c.type, c.messaging, country);
  const trial = clean(c.trial);
  const self = clean(c.self);
  const ind = clean(c.individual);
  return {
    country, type: c.type, family: family(c.type),
    verdict: v.key,
    tags: complianceTags(c.compliance, v.local, v.key),
    compliance: c.compliance,
    wait: parseWait(c.wait),
    monthly: parsePrice(c.monthly), activation: parsePrice(c.activation),
    sms, whatsapp: /^yes/i.test(clean(c.whatsapp)),
    trial: !trial ? null : /^yes,? on a sales request/i.test(trial) ? 'On sales request' : /^yes/i.test(trial) ? 'Yes' : /^no/i.test(trial) ? 'No' : trial,
    self: !self ? null : /^yes/i.test(self) ? 'Yes' : /^pending/i.test(self) ? 'Pending' : 'No',
    individual: /no local address requirement/i.test(ind) || !ind ? null : /^yes/i.test(ind) ? 'Yes' : 'No',
    voice,
    format: numberFormat(c.type, [c.compliance, c.calling, c.messaging].join('\n')),
    rules: extractRules(c.type, [c.compliance, c.calling, c.messaging].join('\n')),
    calling: c.calling, messaging: c.messaging,
    gray: c.gray,
    carrier: clean(c.carrier),
    beta: /beta/i.test(c.type.toLowerCase()),
    unavailable: /temporarily unavailable|not available/i.test(c.type.toLowerCase()),
  };
}

// Verdict labels
export const VERDICT = {
  open:    { label: 'Open to anyone',                              short: 'No requirements' },
  docs:    { label: 'Docs from any country',                       short: 'Docs from any country' },
  address: { label: 'Local address only - foreign company OK',     short: 'Foreign company OK, needs a local address' },
  check:   { label: 'Check - may need local entity',               short: 'May need a local entity - check requirements' },
  local:   { label: 'Local entity required',                       short: 'Needs a local entity' },
};

export const VOICE_META = {
  both:     ['\u21C5', 'Calls in + out',     ''],
  inbound:  ['\u2193', 'Inbound only',       'cannot make calls'],
  outbound: ['\u2191', 'Outbound only',      'cannot receive calls'],
  none:     ['\u2715', 'No voice - SMS only', 'cannot make or receive calls'],
  unknown:  ['?',      'Voice not confirmed', 'ask the numbers team'],
};

export const NEED_LABELS = { any: '', both: 'call in + out', receive: 'receive calls', make: 'make calls', sms: 'send SMS' };

export function fits(n, need) {
  const m = n.voice.mode;
  if (need === 'both')    return m === 'both';
  if (need === 'receive') return m === 'both' || m === 'inbound';
  if (need === 'make')    return m === 'both' || m === 'outbound';
  if (need === 'sms')     return n.sms === true;
  return true;
}

export function whyNot(n, need) {
  if (need === 'sms') return 'no SMS';
  return { inbound: 'inbound only', outbound: 'outbound only', none: 'SMS only', unknown: 'voice unconfirmed', both: '' }[n.voice.mode];
}

export function status(n) {
  if (n.unavailable) return 'none';
  if (n.verdict === 'local') return n.gray ? 'exception' : 'none';
  return 'ok';
}

export function score(n) {
  const base = { open: 40, docs: 30, address: 20, check: 10, local: 0 }[n.verdict];
  const lim = { both: 0, inbound: 8, outbound: 8, unknown: 6, none: 25 }[n.voice.mode] + (n.voice.flags.some(f => f.level === 'bad') ? 6 : 0);
  return base + (n.wait.fast ? 3 : 0) + (n.self === 'Yes' ? 2 : 0) - (n.beta ? 5 : 0) - lim;
}

export function rankList(list) { return list.filter(n => status(n) === 'ok').sort((a, b) => score(b) - score(a)); }
export function rankExc(list) { return list.filter(n => status(n) === 'exception').sort((a, b) => score(b) - score(a)); }

export const FAMILY_ORDER = ['Fixed / landline', 'Mobile', 'National', 'Toll Free', 'Shared Cost', 'Other'];
export const RULE_ICON = { info: '\uD83D\uDCE3', bad: '\uD83D\uDEAB', warn: '\u26A0', ok: '\u2713' };
