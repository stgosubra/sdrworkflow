// Tiny localStorage wrapper with namespacing and JSON.
const NS = "ct.";

export function getItem(key, fallback = null) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(NS + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setItem(key, value) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
  } catch {
    // quota or disabled
  }
}

export function removeItem(key) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(NS + key);
}
