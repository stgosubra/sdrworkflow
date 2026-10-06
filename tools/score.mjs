export const SEAT_PTS = {'1':0,'2':0,'1-2':0,'3-10':0.5,'11-20':1.0,'21-50':1.5,'51-100':2.0,'101-250':2.0,'251+':2.0};
export const SEAT_RANK = {'1':1,'2':2,'1-2':2,'3-10':10,'11-20':20,'21-50':50,'51-100':100,'101-250':250,'251+':251};

export const daysSince = (iso, now) => { if(!iso) return null; const t=new Date(iso).getTime(); return isNaN(t)?null:Math.floor((now-t)/86400000); };

export const deriveUrl = (c, freeDomains) => { if(!c.email) return ''; const d=c.email.split('@')[1]?.toLowerCase(); return (!d||freeDomains.has(d))?'':'https://'+d; };

// (single source of truth - injected verbatim into index.html at build; keep browser-safe)
// __SHARED_TIER_START__
export function stalenessTier(d){
  if(d===null) return {tier:'never',label:'never active',penalty:-2.0,cls:'stale-gone'};
  if(d<=7)  return {tier:'fresh',label:d+'d ago',penalty:0,cls:'stale-fresh'};
  if(d<=14) return {tier:'cooling',label:d+'d ago',penalty:-0.8,cls:'stale-cooling'};
  if(d<=21) return {tier:'stale',label:d+'d ago',penalty:-1.5,cls:'stale-stale'};
  if(d<=30) return {tier:'urgent',label:d+'d ago',penalty:-2.0,cls:'stale-urgent'};
  if(d<=45) return {tier:'critical',label:d+'d ago',penalty:-2.5,cls:'stale-critical'};
  return {tier:'gone',label:d+'d ago',penalty:-3.5,cls:'stale-gone'};
}
// __SHARED_TIER_END__

export function scoreBreakdown(c, now, freeDomains){
  const lines=[]; let total=0;
  if(c.hasQual){ lines.push({l:'Qual call held - proposal sent',p:4.0}); total+=4.0; }
  const mqDays = daysSince(c.mqlDate || c.createdate, now);
  let freshPts=0;
  if(mqDays!==null){
    if(mqDays<14) freshPts=3.0;
    else if(mqDays<30) freshPts=2.0;
    else if(mqDays<60) freshPts=1.0;
    else if(mqDays<90) freshPts=0.3;
  }
  lines.push({l:`Lead freshness (${mqDays??'?'}d since MQL)`,p:freshPts}); total+=freshPts;
  const seatPts = SEAT_PTS[c.seatBand] || 0;
  if(seatPts>0){ lines.push({l:`Seat size (${c.seatBand})`,p:seatPts}); total+=seatPts; }
  const src=(c.source||'').toUpperCase();
  const srcMap={DIRECT_TRAFFIC:[1.0,'Direct visit'],REFERRALS:[0.8,'Referral'],ORGANIC_SEARCH:[0.6,'Organic search'],AI_REFERRALS:[0.5,'AI referral'],PAID_SEARCH:[0.3,'Paid search']};
  if(srcMap[src]){ lines.push({l:srcMap[src][1],p:srcMap[src][0]}); total+=srcMap[src][0]; }
  const clickPts=+Math.min((c.emailClick||0)*0.75,1.5).toFixed(1);
  const openPts=+Math.min((c.emailOpen||0)*0.1,0.5).toFixed(1);
  if(clickPts>0){ lines.push({l:`${c.emailClick} link click${c.emailClick>1?'s':''}`,p:clickPts}); total+=clickPts; }
  if(openPts>0){ lines.push({l:`${c.emailOpen} email open${c.emailOpen>1?'s':''}`,p:openPts}); total+=openPts; }
  const convPts=+Math.min((c.convEvents||0)*0.35,1.0).toFixed(1);
  if(convPts>0){ lines.push({l:`${c.convEvents} conversion event${c.convEvents>1?'s':''}`,p:convPts}); total+=convPts; }
  if(deriveUrl(c, freeDomains)){ lines.push({l:'Valid company URL',p:0.3}); total+=0.3; }
  const tier=stalenessTier(c.staleDays);
  if(tier.penalty<0){ lines.push({l:`Staleness (${tier.tier}: ${c.staleDays===null?'never':c.staleDays+'d'})`,p:tier.penalty}); total+=tier.penalty; }
  return {lines, total:+Math.max(0,Math.min(10,total)).toFixed(1)};
}

export const scoreColor = s => s>=6.5?'score-hot':s>=4.5?'score-warm':s>=2.5?'score-cool':'score-cold';

export function enrich(contacts, { now, freeDomains }){
  return contacts.map(c0 => {
    const hasQual = !!c0.qualCallDate && !!c0.hasModjoNote;
    const seatRank = SEAT_RANK[c0.seatBand] || 0;
    // Deal created but lead never marked "qualified" in HubSpot -> manual error, flag it.
    const dealButNotQualified = !!c0.hasDeal && (c0.status || '').toLowerCase() !== 'qualified';
    // Engagement tier: Working = ever booked a meeting; Lukewarm = emailed back but no meeting; Approached = no interaction.
    const hasBookedMeeting = !!(c0.qualCallMeetingSetDate || c0.meetingBookedDefault === 'Yes');
    const hasEmailReply = !!(c0.salesEmailLastReplied);
    const engagementTier = hasBookedMeeting ? 'Working' : hasEmailReply ? 'Lukewarm' : 'Approached';
    const c = { ...c0, hasQual, seatRank, dealButNotQualified, hasBookedMeeting, hasEmailReply, engagementTier };
    const b = scoreBreakdown(c, now, freeDomains);
    const segment = scoreColor(b.total).replace('score-', '');
    const country = (c0.finalCountry ?? c0.country ?? '').toLowerCase();
    const outreachLang = country === 'france' ? 'fr' : country === 'spain' ? 'es' : 'en';
    return { ...c, score: b.total, breakdown: b.lines, segment, outreachLang };
  });
}
