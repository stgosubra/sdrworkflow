// Monoline module icons - 18px, single stroke weight. Keys match module ids so
// lookups need no special cases. Shared by the Shell rail and the dashboard
// tiles; one glyph set, one file.

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" };

export const ModuleIcon = {
  dashboard: <svg viewBox="0 0 24 24" width="18" height="18" {...S}><path d="M4 11l8-7 8 7" /><path d="M6 9.5V20h12V9.5" /></svg>,
  briefing: <svg viewBox="0 0 24 24" width="18" height="18" {...S}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  calculator: <svg viewBox="0 0 24 24" width="18" height="18" {...S}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h8M8 19h8" /></svg>,
  performance: <svg viewBox="0 0 24 24" width="18" height="18" {...S}><path d="M3 18l5-6 4 3 6-9" /><path d="M14 6h4v4" /></svg>,
  selfserved: <svg viewBox="0 0 24 24" width="18" height="18" {...S}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /><path d="M18 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" /></svg>,
  pacing: <svg viewBox="0 0 24 24" width="18" height="18" {...S}><path d="M4 18h16" /><rect x="4" y="14" width="4" height="4" rx="1" /><rect x="10" y="10" width="4" height="8" rx="1" /><rect x="16" y="6" width="4" height="12" rx="1" /></svg>,
  deals: <svg viewBox="0 0 24 24" width="18" height="18" {...S}><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
};
