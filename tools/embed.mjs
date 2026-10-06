export function embedSnapshot(html, snapshotObj){
  const json = JSON.stringify(snapshotObj);
  const lines = html.split('\n');
  const i = lines.findIndex(l => l.startsWith('const SNAPSHOT = /*__DATA__*/'));
  if(i === -1) throw new Error('SNAPSHOT marker not found');
  lines[i] = `const SNAPSHOT = /*__DATA__*/ ${json};`;
  return lines.join('\n');
}

// Pull the canonical text between two source markers, drop the ESM `export ` so it is browser-safe.
export function extractRegion(src, startMarker, endMarker){
  const s = src.indexOf(startMarker), e = src.indexOf(endMarker);
  if(s === -1 || e === -1) throw new Error(`source marker not found: ${startMarker}`);
  return src.slice(s + startMarker.length, e).replace(/^export\s+/gm, '').trim();
}

// Replace the body between two HTML region markers (markers themselves are preserved), idempotent.
export function injectRegion(html, startMarker, endMarker, code){
  const s = html.indexOf(startMarker), e = html.indexOf(endMarker);
  if(s === -1 || e === -1) throw new Error(`html marker not found: ${startMarker}`);
  return html.slice(0, s + startMarker.length) + '\n' + code + '\n' + html.slice(e);
}

// Single source of truth: inject stalenessTier (score.mjs) and outreach copy (copy.mjs) into the HTML.
export function injectShared(html, { scoreSrc, copySrc }){
  const tier = extractRegion(scoreSrc, '// __SHARED_TIER_START__', '// __SHARED_TIER_END__');
  const copy = extractRegion(copySrc,  '// __SHARED_COPY_START__', '// __SHARED_COPY_END__');
  html = injectRegion(html, '/*__SHARED_TIER_START__*/', '/*__SHARED_TIER_END__*/', tier);
  html = injectRegion(html, '/*__SHARED_COPY_START__*/', '/*__SHARED_COPY_END__*/', copy);
  return html;
}
