export function historyEntry(date, enriched){
  return {
    date,
    contacts: enriched.map(c => ({
      id: c.id, segment: c.segment, hasQual: c.hasQual, score: c.score, staleDays: c.staleDays
    }))
  };
}

export function diffRuns(prevContacts, currContacts){
  if(!prevContacts) return { newlyHot: [], newlyStale: [], dropped: [] };
  const prevMap = new Map(prevContacts.map(c => [String(c.id), c]));
  const newlyHot = [], newlyStale = [];
  for(const c of currContacts){
    const p = prevMap.get(String(c.id));
    if(!p) continue;
    if(c.segment === 'hot' && p.segment !== 'hot') newlyHot.push(c.id);
    if(c.staleDays >= 7 && !(p.staleDays >= 7)) newlyStale.push(c.id);
  }
  const currIds = new Set(currContacts.map(c => String(c.id)));
  const dropped = prevContacts.filter(p => !currIds.has(String(p.id))).map(p => p.id);
  return { newlyHot, newlyStale, dropped };
}
