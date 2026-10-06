import React, { useState, useMemo } from "react";
import { C } from "../../lib/tokens.js";

// Module 03 / PAYG tab
// Per-minute PAYG rate calculator. No plan, billing type or license pricing.
// Optional call volume inputs; defaults to rate × avg call duration (4 min).
// Bundles deduct covered-country PAYG costs and add their flat monthly price.

// ── Icons ─────────────────────────────────────────────────────────────────────
const Ico = ({ size = 16, color = "currentColor", style, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>{children}</svg>
);
const Phone       = (p) => <Ico {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></Ico>;
const Globe       = (p) => <Ico {...p}><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20" /></Ico>;
const Info        = (p) => <Ico {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></Ico>;
const ChevronDown = (p) => <Ico {...p}><path d="m6 9 6 6 6-6" /></Ico>;
const Check       = (p) => <Ico {...p}><path d="M20 6 9 17l-5-5" /></Ico>;
const Plus        = (p) => <Ico {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Ico>;
const X           = (p) => <Ico {...p}><path d="M18 6 6 18" /><path d="M6 6l12 12" /></Ico>;

// ── Config ────────────────────────────────────────────────────────────────────
const DEFAULT_AVG_DURATION = 1; // minutes/call, editable per row

// ── Rate tables ───────────────────────────────────────────────────────────────
const EEA_RATES = {
  "Austria":        { intraMobile: 0.045, intraLandline: 0.023, intlMobile: 0.452, intlLandline: 0.258 },
  "Belgium":        { intraMobile: 0.037, intraLandline: 0.025, intlMobile: 0.593, intlLandline: 0.202 },
  "Bulgaria":       { intraMobile: 0.126, intraLandline: 0.044, intlMobile: 0.506, intlLandline: 0.076 },
  "Croatia":        { intraMobile: 0.068, intraLandline: 0.051, intlMobile: 0.656, intlLandline: 0.438 },
  "Cyprus":         { intraMobile: 0.048, intraLandline: 0.045, intlMobile: 0.214, intlLandline: 0.117 },
  "Czech Republic": { intraMobile: 0.047, intraLandline: 0.030, intlMobile: 0.234, intlLandline: 0.100 },
  "Denmark":        { intraMobile: 0.039, intraLandline: 0.025, intlMobile: 0.140, intlLandline: 0.055 },
  "Estonia":        { intraMobile: 0.071, intraLandline: 0.033, intlMobile: 0.568, intlLandline: 0.106 },
  "Finland":        { intraMobile: 0.060, intraLandline: 0.086, intlMobile: 0.487, intlLandline: 0.594 },
  "France":         { intraMobile: 0.037, intraLandline: 0.017, intlMobile: 0.314, intlLandline: 0.055 },
  "Germany":        { intraMobile: 0.045, intraLandline: 0.014, intlMobile: 0.307, intlLandline: 0.050 },
  "Greece":         { intraMobile: 0.075, intraLandline: 0.027, intlMobile: 0.177, intlLandline: 0.096 },
  "Hungary":        { intraMobile: 0.059, intraLandline: 0.024, intlMobile: 0.239, intlLandline: 0.171 },
  "Iceland":        { intraMobile: 0.074, intraLandline: 0.036, intlMobile: 0.189, intlLandline: 0.076 },
  "Ireland":        { intraMobile: 0.040, intraLandline: 0.024, intlMobile: 0.179, intlLandline: 0.068 },
  "Italy":          { intraMobile: 0.037, intraLandline: 0.013, intlMobile: 0.356, intlLandline: 0.048 },
  "Latvia":         { intraMobile: 0.069, intraLandline: 0.057, intlMobile: 0.608, intlLandline: 0.429 },
  "Liechtenstein":  { intraMobile: 0.237, intraLandline: 0.237, intlMobile: 0.313, intlLandline: 0.301 },
  "Lithuania":      { intraMobile: 0.040, intraLandline: 0.039, intlMobile: 0.823, intlLandline: 0.326 },
  "Luxembourg":     { intraMobile: 0.078, intraLandline: 0.043, intlMobile: 0.388, intlLandline: 0.346 },
  "Malta":          { intraMobile: 0.160, intraLandline: 0.139, intlMobile: 0.498, intlLandline: 0.322 },
  "Netherlands":    { intraMobile: 0.035, intraLandline: 0.031, intlMobile: 0.345, intlLandline: 0.184 },
  "Norway":         { intraMobile: 0.040, intraLandline: 0.022, intlMobile: 0.214, intlLandline: 0.048 },
  "Poland":         { intraMobile: 0.062, intraLandline: 0.030, intlMobile: 0.299, intlLandline: 0.276 },
  "Portugal":       { intraMobile: 0.039, intraLandline: 0.022, intlMobile: 0.503, intlLandline: 0.054 },
  "Romania":        { intraMobile: 0.043, intraLandline: 0.020, intlMobile: 0.136, intlLandline: 0.046 },
  "Slovakia":       { intraMobile: 0.049, intraLandline: 0.019, intlMobile: 0.239, intlLandline: 0.132 },
  "Slovenia":       { intraMobile: 0.124, intraLandline: 0.059, intlMobile: 0.543, intlLandline: 0.179 },
  "Spain":          { intraMobile: 0.032, intraLandline: 0.022, intlMobile: 0.258, intlLandline: 0.081 },
  "Sweden":         { intraMobile: 0.031, intraLandline: 0.016, intlMobile: 0.154, intlLandline: 0.052 },
  "United Kingdom": { intraMobile: 0.029, intraLandline: 0.014, intlMobile: 0.472, intlLandline: 0.472 },
};

const NONEEA_RATES = {
  "Afghanistan": { mobile: 0.479, landline: 0.476 }, "Albania": { mobile: 0.632, landline: 0.388 }, "Algeria": { mobile: 0.998, landline: 0.211 }, "American Samoa": { mobile: 0.426, landline: 0.426 }, "Andorra": { mobile: 0.566, landline: 0.316 }, "Angola": { mobile: 0.490, landline: 0.375 }, "Anguilla": { mobile: 0.653, landline: 0.525 }, "Antarctica": { mobile: 7.444, landline: 7.444 }, "Antigua and Barbuda": { mobile: 0.649, landline: 0.624 }, "Argentina": { mobile: 0.284, landline: 0.080 }, "Armenia": { mobile: 0.566, landline: 0.431 }, "Aruba": { mobile: 0.610, landline: 0.330 }, "Australia": { mobile: 0.070, landline: 0.040 }, "Azerbaijan": { mobile: 0.733, landline: 0.531 }, "Bahamas": { mobile: 0.559, landline: 0.535 }, "Bahrain": { mobile: 0.269, landline: 0.280 }, "Bangladesh": { mobile: 0.094, landline: 0.104 }, "Barbados": { mobile: 0.552, landline: 0.628 }, "Belarus": { mobile: 0.632, landline: 0.604 }, "Belize": { mobile: 0.587, landline: 0.436 }, "Benin": { mobile: 0.595, landline: 0.592 }, "Bermuda": { mobile: 0.180, landline: 0.159 }, "Bhutan": { mobile: 0.325, landline: 0.325 }, "Bolivia": { mobile: 0.408, landline: 0.377 }, "Bosnia and Herzegovina": { mobile: 0.817, landline: 0.562 }, "Botswana": { mobile: 0.552, landline: 0.412 }, "Brazil": { mobile: 0.071, landline: 0.038 }, "British Indian Ocean Territory": { mobile: 3.000, landline: 3.000 }, "Brunei": { mobile: 0.151, landline: 0.151 }, "Burkina Faso": { mobile: 0.713, landline: 0.713 }, "Burundi": { mobile: 1.088, landline: 0.937 }, "Cambodia": { mobile: 0.168, landline: 0.192 }, "Cameroon": { mobile: 0.832, landline: 0.566 }, "Canada": { mobile: 0.011, landline: 0.018 }, "Cape Verde": { mobile: 0.807, landline: 0.548 }, "Cayman Islands": { mobile: 0.536, landline: 0.368 }, "Central African Republic": { mobile: 0.795, landline: 0.795 }, "Chad": { mobile: 0.972, landline: 0.796 }, "Chile": { mobile: 0.088, landline: 0.058 }, "China": { mobile: 0.465, landline: 0.257 }, "Colombia": { mobile: 0.058, landline: 0.063 }, "Comoros": { mobile: 1.148, landline: 0.981 }, "Congo": { mobile: 1.156, landline: 0.731 }, "Cook Islands": { mobile: 1.944, landline: 1.944 }, "Costa Rica": { mobile: 0.192, landline: 0.127 }, "Cuba": { mobile: 0.905, landline: 0.894 }, "Curacao": { mobile: 0.200, landline: 0.200 }, "DR of the Congo": { mobile: 0.777, landline: 1.107 }, "Djibouti": { mobile: 0.613, landline: 0.613 }, "Dominica": { mobile: 0.602, landline: 0.460 }, "Dominican Republic": { mobile: 0.224, landline: 0.122 }, "Ecuador": { mobile: 0.431, landline: 0.248 }, "Egypt": { mobile: 0.295, landline: 0.331 }, "El Salvador": { mobile: 0.310, landline: 0.412 }, "Equatorial Guinea": { mobile: 0.670, landline: 0.670 }, "Eritrea": { mobile: 0.505, landline: 0.505 }, "Ethiopia": { mobile: 0.600, landline: 0.434 }, "Falkland Islands (Malvinas)": { mobile: 3.370, landline: 3.370 }, "Faroe Islands": { mobile: 0.310, landline: 0.240 }, "Fiji": { mobile: 0.679, landline: 0.642 }, "French Guiana": { mobile: 0.405, landline: 0.058 }, "French Polynesia": { mobile: 0.502, landline: 0.502 }, "French Southern Territories": { mobile: 0.900, landline: 0.900 }, "Gabon": { mobile: 0.677, landline: 0.677 }, "Gambia": { mobile: 0.680, landline: 0.991 }, "Georgia": { mobile: 0.704, landline: 0.513 }, "Ghana": { mobile: 0.501, landline: 0.536 }, "Gibraltar": { mobile: 0.294, landline: 0.294 }, "Greenland": { mobile: 0.628, landline: 0.653 }, "Grenada": { mobile: 0.503, landline: 0.333 }, "Guam": { mobile: 0.132, landline: 0.108 }, "Guatemala": { mobile: 0.284, landline: 0.306 }, "Guernsey": { mobile: 0.200, landline: 0.050 }, "Guinea": { mobile: 0.869, landline: 1.030 }, "Guinea-Bissau": { mobile: 0.869, landline: 0.841 }, "Guyana": { mobile: 0.434, landline: 0.434 }, "Haiti": { mobile: 0.666, landline: 0.598 }, "Honduras": { mobile: 0.483, landline: 0.330 }, "Hong Kong": { mobile: 0.093, landline: 0.061 }, "India": { mobile: 0.070, landline: 0.070 }, "Indonesia": { mobile: 0.135, landline: 0.130 }, "Iran": { mobile: 0.489, landline: 0.410 }, "Iraq": { mobile: 0.440, landline: 0.405 }, "Isle of Man": { mobile: 0.200, landline: 0.050 }, "Israel": { mobile: 0.121, landline: 0.077 }, "Ivory Coast": { mobile: 0.613, landline: 0.789 }, "Jamaica": { mobile: 0.438, landline: 0.417 }, "Japan": { mobile: 0.297, landline: 0.170 }, "Jersey": { mobile: 0.200, landline: 0.050 }, "Jordan": { mobile: 0.375, landline: 0.341 }, "Kazakhstan": { mobile: 0.398, landline: 0.132 }, "Kenya": { mobile: 0.339, landline: 0.270 }, "Kiribati": { mobile: 1.969, landline: 1.969 }, "Kosovo": { mobile: 1.065, landline: 0.685 }, "Kuwait": { mobile: 0.203, landline: 0.164 }, "Kyrgyzstan": { mobile: 0.560, landline: 0.451 }, "Laos": { mobile: 0.213, landline: 0.182 }, "Lebanon": { mobile: 0.442, landline: 0.304 }, "Lesotho": { mobile: 0.742, landline: 0.776 }, "Liberia": { mobile: 0.561, landline: 0.625 }, "Libya": { mobile: 0.778, landline: 0.530 }, "Macao": { mobile: 0.283, landline: 0.283 }, "Macedonia": { mobile: 0.650, landline: 0.661 }, "Madagascar": { mobile: 0.831, landline: 0.831 }, "Malawi": { mobile: 0.921, landline: 0.706 }, "Malaysia": { mobile: 0.105, landline: 0.076 }, "Maldives": { mobile: 3.073, landline: 1.112 }, "Mali": { mobile: 0.594, landline: 0.594 }, "Marshall Islands": { mobile: 0.577, landline: 0.577 }, "Martinique": { mobile: 0.415, landline: 0.071 }, "Mauritania": { mobile: 0.807, landline: 0.807 }, "Mauritius": { mobile: 0.400, landline: 0.312 }, "Mayotte": { mobile: 0.405, landline: 0.215 }, "Mexico": { mobile: 0.090, landline: 0.021 }, "Micronesia": { mobile: 1.063, landline: 1.063 }, "Moldova": { mobile: 0.466, landline: 0.753 }, "Monaco": { mobile: 0.494, landline: 0.172 }, "Mongolia": { mobile: 0.095, landline: 0.096 }, "Montenegro": { mobile: 0.623, landline: 0.687 }, "Morocco": { mobile: 0.677, landline: 0.360 }, "Mozambique": { mobile: 0.569, landline: 0.569 }, "Myanmar": { mobile: 0.438, landline: 0.569 }, "Namibia": { mobile: 0.164, landline: 0.309 }, "Nauru": { mobile: 1.278, landline: 1.278 }, "Nepal": { mobile: 0.572, landline: 0.380 }, "Netherlands Antilles": { mobile: 0.399, landline: 0.515 }, "New Caledonia": { mobile: 1.260, landline: 1.000 }, "New Zealand": { mobile: 0.121, landline: 0.047 }, "Nicaragua": { mobile: 0.470, landline: 0.418 }, "Niger": { mobile: 0.771, landline: 0.771 }, "Nigeria": { mobile: 0.271, landline: 0.287 }, "Niue": { mobile: 2.866, landline: 2.866 }, "North Korea": { mobile: 1.010, landline: 1.010 }, "Northern Mariana Islands": { mobile: 0.609, landline: 0.195 }, "Oman": { mobile: 0.361, landline: 0.473 }, "Pakistan": { mobile: 0.153, landline: 0.273 }, "Palau": { mobile: 1.100, landline: 1.100 }, "Palestine": { mobile: 0.360, landline: 0.529 }, "Panama": { mobile: 0.315, landline: 0.239 }, "Papua New Guinea": { mobile: 1.344, landline: 1.906 }, "Paraguay": { mobile: 0.205, landline: 0.225 }, "Peru": { mobile: 0.080, landline: 0.030 }, "Philippines": { mobile: 0.247, landline: 0.198 }, "Puerto Rico": { mobile: 0.044, landline: 0.032 }, "Qatar": { mobile: 0.373, landline: 0.376 }, "Reunion": { mobile: 0.321, landline: 0.234 }, "Russia": { mobile: 0.486, landline: 0.317 }, "Rwanda": { mobile: 0.534, landline: 0.486 }, "S. Georgia & the S. Sandwich Isl.": { mobile: 3.000, landline: 3.000 }, "Saint Barthelemy": { mobile: 0.300, landline: 0.060 }, "Saint Helena": { mobile: 2.557, landline: 2.557 }, "Saint Kitts and Nevis": { mobile: 0.583, landline: 0.583 }, "Saint Lucia": { mobile: 0.514, landline: 0.518 }, "Saint Martin": { mobile: 0.407, landline: 0.407 }, "Saint Pierre and Miquelon": { mobile: 0.890, landline: 0.890 }, "Saint Vincent and Grenadines": { mobile: 0.452, landline: 0.513 }, "Samoa": { mobile: 2.000, landline: 1.334 }, "San Marino": { mobile: 0.228, landline: 0.228 }, "Sao Tome and Principe": { mobile: 0.893, landline: 0.919 }, "Saudi Arabia": { mobile: 0.309, landline: 0.314 }, "Senegal": { mobile: 0.598, landline: 0.564 }, "Serbia": { mobile: 0.703, landline: 0.470 }, "Seychelles": { mobile: 1.036, landline: 1.036 }, "Sierra Leone": { mobile: 0.769, landline: 0.769 }, "Singapore": { mobile: 0.060, landline: 0.053 }, "Sint Maarten": { mobile: 0.300, landline: 0.300 }, "Solomon Islands": { mobile: 1.626, landline: 1.330 }, "Somalia": { mobile: 1.118, landline: 0.843 }, "South Africa": { mobile: 0.220, landline: 0.180 }, "South Korea": { mobile: 0.151, landline: 0.062 }, "South Sudan": { mobile: 0.938, landline: 0.938 }, "Sri Lanka": { mobile: 0.367, landline: 0.327 }, "Sudan": { mobile: 0.380, landline: 0.380 }, "Suriname": { mobile: 0.622, landline: 0.622 }, "Svalbard & Jan Mayen": { mobile: 0.086, landline: 0.086 }, "Swaziland": { mobile: 0.610, landline: 0.610 }, "Switzerland": { mobile: 0.246, landline: 0.081 }, "Syria": { mobile: 0.535, landline: 0.535 }, "Taiwan": { mobile: 0.247, landline: 0.212 }, "Tajikistan": { mobile: 0.364, landline: 0.372 }, "Tanzania": { mobile: 0.751, landline: 0.554 }, "Thailand": { mobile: 0.136, landline: 0.156 }, "Timor - Leste (East Timor)": { mobile: 0.689, landline: 0.689 }, "Togo": { mobile: 0.603, landline: 0.603 }, "Tokelau": { mobile: 2.866, landline: 2.866 }, "Tonga": { mobile: 2.866, landline: 2.866 }, "Trinidad and Tobago": { mobile: 0.391, landline: 0.167 }, "Tunisia": { mobile: 0.967, landline: 0.925 }, "Turkey": { mobile: 0.342, landline: 0.132 }, "Turkmenistan": { mobile: 0.420, landline: 0.413 }, "Turks and Caicos": { mobile: 0.626, landline: 0.518 }, "Tuvalu": { mobile: 4.488, landline: 4.488 }, "Uganda": { mobile: 0.546, landline: 0.535 }, "Ukraine": { mobile: 0.499, landline: 0.433 }, "United Arab Emirates": { mobile: 0.295, landline: 0.342 }, "United States": { mobile: 0.018, landline: 0.018 }, "Uruguay": { mobile: 0.339, landline: 0.187 }, "Uzbekistan": { mobile: 0.369, landline: 0.254 }, "Vanuatu": { mobile: 2.675, landline: 2.675 }, "Vatican City": { mobile: 0.300, landline: 0.055 }, "Venezuela": { mobile: 0.177, landline: 0.191 }, "Vietnam": { mobile: 0.163, landline: 0.184 }, "Virgin Islands, British": { mobile: 0.778, landline: 0.388 }, "Virgin Islands, US": { mobile: 0.111, landline: 0.087 }, "Wallis and Futuna": { mobile: 2.866, landline: 2.866 }, "Western Sahara": { mobile: 0.807, landline: 0.807 }, "Yemen": { mobile: 0.403, landline: 0.354 }, "Zambia": { mobile: 0.908, landline: 0.704 }, "Zimbabwe": { mobile: 0.764, landline: 0.524 },
};

// minutes: shared pool per seat/mo across all covered destinations (FUP).
// usCanadaMinutes: separate higher pool for US & Canada in World bundle.
const BUNDLES = {
  dach:     { name: "DACH",       price: 5,  minutes: 3000, mobileLandline: ["Austria","Germany","Luxembourg"], landlineOnly: [] },
  europe:   { name: "Europe",     price: 10, minutes: 3000, mobileLandline: ["Austria","Belgium","Croatia","Cyprus","Czech Republic","Denmark","Finland","France","Germany","Greece","Hungary","Ireland","Italy","Lithuania","Netherlands","Norway","Poland","Portugal","Romania","Slovakia","Spain","Sweden","United Kingdom"], landlineOnly: [] },
  latam:    { name: "LATAM",      price: 15, minutes: 3000, mobileLandline: ["Bermuda","Brazil","Chile","Colombia","Costa Rica","Mexico","Peru","Puerto Rico"], landlineOnly: ["Argentina","Dominican Republic","French Guiana","Martinique","Venezuela"] },
  asia:     { name: "Asia",       price: 20, minutes: 3000, mobileLandline: ["Bangladesh","Hong Kong","India","Malaysia","Singapore","South Korea","Thailand"], landlineOnly: ["Japan"] },
  aunzuk:   { name: "AU, NZ, UK", price: 15, minutes: 3000, mobileLandline: ["Australia","New Zealand","United Kingdom"], landlineOnly: [] },
  worldlite:{ name: "World Lite", price: 15, minutes: 3000, mobileLandline: ["Austria","Belgium","Croatia","Cyprus","Czech Republic","Denmark","Finland","France","Germany","Greece","Hungary","Ireland","Italy","Lithuania","Netherlands","Norway","Poland","Portugal","Romania","Slovakia","Spain","Sweden","United Kingdom","Brazil","Colombia","Mexico","Peru","Puerto Rico","Bangladesh","India"], landlineOnly: ["Israel","South Korea","Switzerland"] },
  world:    { name: "World",      price: 25, minutes: 3000, usCanadaMinutes: 10000, mobileLandline: ["Austria","Belgium","Bulgaria","Croatia","Cyprus","Czech Republic","Denmark","Estonia","Finland","France","Germany","Greece","Hungary","Iceland","Ireland","Israel","Italy","Latvia","Lithuania","Luxembourg","Netherlands","Norway","Poland","Portugal","Romania","Slovakia","Slovenia","Spain","Sweden","United Kingdom","United States","Canada","Bermuda","Brazil","Chile","Colombia","Costa Rica","Mexico","Peru","Puerto Rico","Bangladesh","Hong Kong","India","Malaysia","Singapore","South Korea","Thailand","Australia","New Zealand"], landlineOnly: ["Argentina","Dominican Republic","French Guiana","Martinique","Venezuela","Russia","Switzerland","Turkey","Japan"] },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const regionOf = (c) => (EEA_RATES[c] ? "EEA" : "NONEEA");

const ALL_COUNTRIES = [
  ...Object.keys(EEA_RATES).map((c) => ({ name: c, region: "EEA" })),
  ...Object.keys(NONEEA_RATES).map((c) => ({ name: c, region: "NONEEA" })),
].sort((a, b) => a.name.localeCompare(b.name));

function getRate(country, numberType, originEEA) {
  if (EEA_RATES[country]) {
    const r = EEA_RATES[country];
    return originEEA
      ? (numberType === "mobile" ? r.intraMobile : r.intraLandline)
      : (numberType === "mobile" ? r.intlMobile  : r.intlLandline);
  }
  const r = NONEEA_RATES[country];
  return numberType === "mobile" ? r.mobile : r.landline;
}

function bundleCoversRow(bundle, row) {
  if (!bundle) return false;
  if (bundle.mobileLandline.includes(row.country)) return true;
  if (row.numberType === "landline" && bundle.landlineOnly.includes(row.country)) return true;
  return false;
}

const eur     = (n) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const eurRate = (n) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n);

// ── Palette ───────────────────────────────────────────────────────────────────
// Local aliases onto the shared tokens. The names are kept because ~60 style
// objects below reference them; only the values moved onto the design system.
const BG    = "transparent";
const CARD  = C.surface;
const LINE  = C.border;
const BLUE  = C.blue;
const TXT   = C.text;
const MUT   = C.textMuted;
const FAINT = C.textFaint;
const GREEN = C.emerald;

// ── Pill button ───────────────────────────────────────────────────────────────
function Pill({ active, onClick, children, disabled, color = BLUE }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 500, transition: "all .15s",
        background: active ? color : "transparent",
        color: active ? "#fff" : disabled ? FAINT : MUT,
        border: `1px solid ${active ? color : LINE}`,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.38 : 1,
      }}>
      {children}
    </button>
  );
}

// ── Country dropdown ──────────────────────────────────────────────────────────
function CountrySelect({ value, onChange, exclude = [] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = ALL_COUNTRIES.filter(
    (c) => c.name.toLowerCase().includes(q.toLowerCase()) && !exclude.includes(c.name)
  );
  const region = regionOf(value);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 12px", background: "transparent", border: `1px solid ${LINE}`, borderRadius: 10, cursor: "pointer", textAlign: "left" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <span style={{ fontWeight: 500, color: TXT, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
          <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 20, flexShrink: 0, background: region === "EEA" ? "rgba(91,157,255,.15)" : "rgba(251,191,36,.13)", color: region === "EEA" ? C.blue : C.amber }}>{region}</span>
        </span>
        <ChevronDown size={14} color={FAINT} style={{ flexShrink: 0 }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", zIndex: 50, marginTop: 5, width: "100%", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", overflow: "hidden", background: C.surfaceAlt, boxShadow: "0 24px 60px rgba(0,0,0,.65)" }}>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderBottom: `1px solid ${LINE}`, fontSize: 13, color: TXT, outline: "none", background: C.surfaceAlt, border: "none", borderBottomStyle: "solid", borderBottomWidth: 1, borderBottomColor: LINE }} />
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {filtered.map((c) => (
                <button key={c.name} onClick={() => { onChange(c.name); setOpen(false); setQ(""); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", fontSize: 13, textAlign: "left", background: C.surfaceAlt, border: "none", cursor: "pointer", color: TXT }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = C.wellBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = C.surfaceAlt)}>
                  <span style={{ color: C.textMid }}>{c.name}</span>
                  {value === c.name && <Check size={13} color={BLUE} />}
                </button>
              ))}
              {filtered.length === 0 && <div style={{ padding: "10px 12px", fontSize: 13, color: FAINT }}>No match</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Checkbox ──────────────────────────────────────────────────────────────────
function Checkbox({ checked, onChange, label: lbl }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
      onClick={() => onChange(!checked)}>
      <div style={{
        width: 15, height: 15, borderRadius: 4, flexShrink: 0, transition: "all .15s",
        border: `1.5px solid ${checked ? BLUE : LINE}`,
        background: checked ? BLUE : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {checked && <Check size={9} color="#fff" />}
      </div>
      <span style={{ fontSize: 12, color: checked ? TXT : MUT }}>{lbl}</span>
    </label>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
let idSeq = 1;
const mkRow = (country = "Spain") => ({
  id: idSeq++, country, numberType: "mobile",
  calls: "", duration: String(DEFAULT_AVG_DURATION), acrossTeam: false,
});

export default function CostCalc() {
  const [originEEA,    setOriginEEA]    = useState(true);
  const [rows,         setRows]          = useState([mkRow("Spain")]);
  const [teamSize,     setTeamSize]      = useState("3");
  const [activeBundle, setActiveBundle]  = useState(null);
  const [seats,        setSeats]         = useState("1");

  const addRow    = () => setRows((rs) => [...rs, mkRow("Germany")]);
  const removeRow = (id) => setRows((rs) => rs.filter((r) => r.id !== id));
  const updateRow = (id, patch) => setRows((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } : r));
  const reset     = () => { setOriginEEA(true); setActiveBundle(null); setTeamSize("3"); setSeats("1"); setRows([mkRow("Spain")]); };

  const usedCountries = rows.map((r) => r.country);
  const anyAcrossTeam = rows.some((r) => r.acrossTeam);
  const bundle        = activeBundle ? BUNDLES[activeBundle] : null;

  const computed = useMemo(() => {
    const tSize  = Math.max(1, parseInt(teamSize) || 1);
    const nSeats = Math.max(1, parseInt(seats) || 1);

    const perRow = rows.map((r) => {
      const rate       = getRate(r.country, r.numberType, originEEA);
      const d          = Math.max(0, parseFloat(r.duration) || DEFAULT_AVG_DURATION);
      const hasCount   = r.calls !== "" && r.calls !== null;
      const callCount  = hasCount ? Math.max(0, parseInt(r.calls) || 0) : 1;
      const multiplier = r.acrossTeam ? tSize : 1;
      const minutes    = callCount * d * multiplier;
      const cost       = rate * minutes;
      const covered    = bundleCoversRow(bundle, r);
      const region     = regionOf(r.country);
      const usedIntl   = region === "EEA" && !originEEA;
      // US & Canada use a separate higher pool in World bundle
      const isUsCanada = bundle?.usCanadaMinutes && ["United States","Canada"].includes(r.country);
      return { ...r, rate, d, hasCount, callCount, multiplier, minutes, cost, covered, region, usedIntl, isUsCanada };
    });

    const grossTotal      = perRow.reduce((s, r) => s + r.cost, 0);
    const uncoveredCost   = perRow.filter((r) => !r.covered).reduce((s, r) => s + r.cost, 0);

    let bundleSavings = 0, bundleCost = 0, netTotal = grossTotal;
    let poolTotal = 0, usCanadaPoolTotal = 0;
    let totalCoveredMins = 0, totalUsCanadaMins = 0;
    let poolOverage = 0, usCanadaOverage = 0;
    let overageCost = 0;
    let isOverPool = false, isOverUsCanadaPool = false;

    if (bundle) {
      bundleCost = bundle.price * nSeats;

      // Split covered rows into US/Canada pool vs general pool
      const generalCoveredRows = perRow.filter((r) => r.covered && !r.isUsCanada);
      const usCanadaRows       = perRow.filter((r) => r.covered && r.isUsCanada);

      totalCoveredMins   = generalCoveredRows.reduce((s, r) => s + r.minutes, 0);
      totalUsCanadaMins  = usCanadaRows.reduce((s, r) => s + r.minutes, 0);
      poolTotal          = bundle.minutes * nSeats;
      usCanadaPoolTotal  = bundle.usCanadaMinutes ? bundle.usCanadaMinutes * nSeats : 0;

      poolOverage       = Math.max(0, totalCoveredMins - poolTotal);
      usCanadaOverage   = bundle.usCanadaMinutes ? Math.max(0, totalUsCanadaMins - usCanadaPoolTotal) : 0;
      isOverPool        = poolOverage > 0;
      isOverUsCanadaPool = usCanadaOverage > 0;

      // Blended rate for overage: weighted avg of covered rows' rates
      const blendedRate = (rows, totalMins) => {
        if (totalMins === 0) return 0;
        return rows.reduce((s, r) => s + r.cost, 0) / totalMins;
      };
      const genBlended  = blendedRate(generalCoveredRows, totalCoveredMins);
      const usaBlended  = blendedRate(usCanadaRows, totalUsCanadaMins);
      overageCost       = poolOverage * genBlended + usCanadaOverage * usaBlended;

      const totalCoveredCost = perRow.filter((r) => r.covered).reduce((s, r) => s + r.cost, 0);
      bundleSavings = totalCoveredCost - overageCost;
      netTotal      = Math.max(0, uncoveredCost + overageCost + bundleCost);
    }

    return {
      perRow, grossTotal, uncoveredCost, bundleSavings, bundleCost, netTotal, nSeats,
      poolTotal, usCanadaPoolTotal, totalCoveredMins, totalUsCanadaMins,
      poolOverage, usCanadaOverage, overageCost, isOverPool, isOverUsCanadaPool,
    };
  }, [rows, originEEA, activeBundle, teamSize, seats]);

  const anyIntl         = computed.perRow.some((r) => r.usedIntl);
  const hasRefRows      = computed.perRow.some((r) => !r.hasCount);
  const coveredCountries = bundle
    ? rows.filter((r) => bundleCoversRow(bundle, r)).map((r) => r.country)
    : [];

  // Which bundles contain at least one currently-selected country?
  const bundleHints = Object.fromEntries(
    Object.entries(BUNDLES).map(([k, b]) => [
      k,
      rows.some((r) => b.mobileLandline.includes(r.country) || b.landlineOnly.includes(r.country)),
    ])
  );
  // Is any selected country absent from every bundle? → show "No bundle" in red
  const hasUncoveredCountry = rows.some(
    (r) => !Object.values(BUNDLES).some(
      (b) => b.mobileLandline.includes(r.country) || b.landlineOnly.includes(r.country)
    )
  );
  const ORANGE = C.amber;
  const RED    = C.red;

  const inputSt = {
    width: "100%", boxSizing: "border-box", padding: "8px 10px",
    background: "transparent", border: `1px solid ${LINE}`, borderRadius: 9,
    fontSize: 13, fontWeight: 500, color: TXT, outline: "none",
  };
  const lbl = { fontSize: 10.5, fontWeight: 500, color: MUT, textTransform: "uppercase", letterSpacing: ".055em", display: "block", marginBottom: 5 };

  return (
    <div style={{ height: "100%", overflowY: "auto", background: BG, fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif", color: TXT, padding: "28px 20px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: BLUE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Phone size={18} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 19, fontWeight: 500, margin: 0, letterSpacing: "-.01em" }}>PAYG rate calculator</h1>
            <p style={{ fontSize: 13, color: MUT, margin: "2px 0 0" }}>
              Per-minute cost by destination · optional call volume · bundles offset the total
            </p>
          </div>
          <button onClick={reset}
            style={{ fontSize: 12, fontWeight: 500, padding: "7px 14px", borderRadius: 9, border: `1px solid ${LINE}`, background: "transparent", color: MUT, cursor: "pointer", flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.borderHover; e.currentTarget.style.color = C.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = LINE; e.currentTarget.style.color = MUT; }}>
            Clear
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, alignItems: "start" }}>

          {/* ── LEFT ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Call origin */}
            <section style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: MUT, textTransform: "uppercase", letterSpacing: ".06em" }}>Call origin</span>
              <div style={{ display: "flex", gap: 6 }}>
                {[{ label: "EEA number", val: true }, { label: "Non-EEA", val: false }].map(({ label, val }) => {
                  const on = originEEA === val;
                  return (
                    <button key={label} onClick={() => setOriginEEA(val)}
                      style={{
                        padding: "6px 13px", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all .15s",
                        background: on ? (val ? "rgba(91,157,255,.15)" : "rgba(251,191,36,.13)") : "transparent",
                        border: `1px solid ${on ? (val ? "rgba(91,157,255,.38)" : "rgba(251,191,36,.35)") : LINE}`,
                        color: on ? (val ? C.blue : C.amber) : MUT,
                      }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Destinations */}
            <section style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 14, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: MUT, textTransform: "uppercase", letterSpacing: ".06em", display: "flex", alignItems: "center", gap: 5 }}>
                  <Globe size={12} />Destinations
                </span>
                <button onClick={addRow}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 8, fontSize: 12, fontWeight: 500, color: BLUE, background: "rgba(91,157,255,.1)", border: "1px solid rgba(91,157,255,.2)", cursor: "pointer" }}>
                  <Plus size={12} />Add country
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {rows.map((r) => {
                  const rate = getRate(r.country, r.numberType, originEEA);
                  return (
                    <div key={r.id} style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,.022)", border: `1px solid ${LINE}` }}>
                      {/* Country row */}
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <CountrySelect value={r.country} onChange={(c) => updateRow(r.id, { country: c })} exclude={usedCountries.filter((c) => c !== r.country)} />
                        </div>
                        {rows.length > 1 && (
                          <button onClick={() => removeRow(r.id)}
                            style={{ padding: 7, borderRadius: 8, color: FAINT, background: "transparent", border: "none", cursor: "pointer", display: "flex", flexShrink: 0 }}
                            onMouseEnter={(e) => e.currentTarget.style.color = C.red}
                            onMouseLeave={(e) => e.currentTarget.style.color = FAINT}>
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {/* Mobile / Landline + rate */}
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12 }}>
                        <Pill active={r.numberType === "mobile"}   onClick={() => updateRow(r.id, { numberType: "mobile" })}>Mobile</Pill>
                        <Pill active={r.numberType === "landline"} onClick={() => updateRow(r.id, { numberType: "landline" })}>Landline</Pill>
                        <span style={{ marginLeft: "auto", fontSize: 12, color: FAINT, fontVariantNumeric: "tabular-nums" }}>
                          {eurRate(rate)}<span style={{ color: FAINT, fontWeight: 400 }}> / min</span>
                        </span>
                      </div>

                      {/* Optional fields */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                        <div>
                          <label style={lbl}>
                            Calls <span style={{ color: FAINT, textTransform: "none", fontWeight: 400 }}>(optional)</span>
                          </label>
                          <input type="number" min={0} placeholder={`e.g. 200`} value={r.calls}
                            onChange={(e) => updateRow(r.id, { calls: e.target.value })}
                            style={inputSt} />
                        </div>
                        <div>
                          <label style={lbl}>
                            Avg duration <span style={{ color: FAINT, textTransform: "none", fontWeight: 400 }}>(min)</span>
                          </label>
                          <input type="number" min={0} step={0.5} value={r.duration}
                            onChange={(e) => updateRow(r.id, { duration: e.target.value })}
                            style={inputSt} />
                        </div>
                      </div>

                      {/* Across team checkbox */}
                      <Checkbox checked={r.acrossTeam} onChange={(v) => updateRow(r.id, { acrossTeam: v })} label="Across team" />
                    </div>
                  );
                })}
              </div>

              {/* Team size - appears when any row is across-team */}
              {anyAcrossTeam && (
                <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: "rgba(91,157,255,.06)", border: "1px solid rgba(91,157,255,.18)" }}>
                  <label style={{ ...lbl, color: C.blue }}>Team size (agents)</label>
                  <input type="number" min={1} value={teamSize}
                    onChange={(e) => setTeamSize(e.target.value)}
                    style={{ ...inputSt, border: "1px solid rgba(91,157,255,.28)", color: TXT }} />
                </div>
              )}
            </section>

            {/* Bundle add-ons */}
            <section style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 14, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: MUT, textTransform: "uppercase", letterSpacing: ".06em" }}>Bundle add-on</span>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 11, color: FAINT }}>seats</span>
                  <input type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)}
                    style={{ width: 52, padding: "5px 8px", background: "transparent", border: `1px solid ${LINE}`, borderRadius: 7, fontSize: 13, fontWeight: 500, color: TXT, outline: "none" }} />
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                <Pill active={!activeBundle} onClick={() => setActiveBundle(null)}>None</Pill>
                {Object.entries(BUNDLES).map(([k, b]) => {
                  const isActive = activeBundle === k;
                  const hinted   = bundleHints[k] && !isActive;
                  return (
                    <button key={k}
                      onClick={() => setActiveBundle(isActive ? null : k)}
                      style={{
                        padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 500, transition: "all .15s", cursor: "pointer",
                        background: isActive ? BLUE : hinted ? "rgba(251,191,36,.12)" : "transparent",
                        border: `1px solid ${isActive ? BLUE : hinted ? "rgba(251,191,36,.4)" : LINE}`,
                        color: isActive ? "#fff" : hinted ? ORANGE : MUT,
                      }}>
                      {b.name} · €{b.price}/seat
                    </button>
                  );
                })}
                {hasUncoveredCountry && (
                  <span style={{
                    padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 500,
                    background: "rgba(251,94,109,.12)", border: "1px solid rgba(251,94,109,.3)", color: RED,
                  }}>
                    No bundle
                  </span>
                )}
              </div>
              {bundle && coveredCountries.length > 0 && (
                <p style={{ fontSize: 11.5, color: MUT, margin: "10px 0 0", lineHeight: 1.5 }}>
                  Covers: <span style={{ color: GREEN }}>{coveredCountries.join(", ")}</span>
                </p>
              )}
              {bundle && coveredCountries.length === 0 && (
                <p style={{ fontSize: 11.5, color: FAINT, margin: "10px 0 0" }}>
                  None of your selected destinations are covered by this bundle.
                </p>
              )}
            </section>
          </div>

          {/* ── RIGHT ── */}
          <div style={{ position: "sticky", top: 28, display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Net total hero */}
            <div style={{ borderRadius: 13, padding: "13px 16px", border: "1px solid rgba(91,157,255,0.42)", background: "linear-gradient(135deg, rgba(91,157,255,0.16) 0%, rgba(91,157,255,0.05) 100%)", boxShadow: "0 0 22px rgba(91,157,255,0.13)" }}>
              <p style={{ fontSize: 10, fontWeight: 500, color: "rgba(91,157,255,.85)", margin: 0, textTransform: "uppercase", letterSpacing: ".08em" }}>
                {activeBundle ? "Net total · after bundle" : "Estimated total"}
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 26, fontWeight: 600, color: C.blue, letterSpacing: "-.02em" }}>{eur(computed.netTotal)}</span>
                <span style={{ color: "rgba(91,157,255,.7)", fontSize: 13 }}>/ mo</span>
                {hasRefRows && (
                  <span style={{ fontSize: 11, color: "rgba(91,157,255,.45)", marginLeft: 6 }}>· incl. reference rows</span>
                )}
              </div>
              {activeBundle && computed.bundleSavings > 0 && (
                <p style={{ fontSize: 11.5, color: GREEN, margin: "5px 0 0" }}>
                  -{eur(computed.bundleSavings)} PAYG offset · +{eur(computed.bundleCost)} bundle
                </p>
              )}
            </div>

            {/* Breakdown */}
            <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 14, padding: 18 }}>
              <p style={{ fontSize: 11, fontWeight: 500, color: MUT, textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 14px" }}>Breakdown</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {computed.perRow.map((r) => {
                  // Strike through covered rows only when the pool is not exceeded
                  const strike = r.covered && !(r.isUsCanada ? computed.isOverUsCanadaPool : computed.isOverPool);
                  return (
                    <div key={r.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13.5, fontWeight: 500, margin: 0, color: strike ? FAINT : TXT, textDecoration: strike ? "line-through" : "none" }}>
                          {r.country}
                        </p>
                        <p style={{ fontSize: 11.5, margin: "3px 0 0", color: MUT, lineHeight: 1.4 }}>
                          {r.hasCount
                            ? `${r.callCount} calls × ${r.d} min${r.acrossTeam ? ` × ${r.multiplier} agents` : ""} × ${eurRate(r.rate)}`
                            : `ref: 1 call × ${r.d} min × ${eurRate(r.rate)}`
                          }
                        </p>
                        {r.covered && !strike && (
                          <p style={{ fontSize: 11, color: C.amber, margin: "2px 0 0" }}>
                            pool exceeded · partial PAYG applies
                          </p>
                        )}
                        {strike && (
                          <p style={{ fontSize: 11, color: GREEN, margin: "2px 0 0" }}>
                            covered · {bundle.name} bundle
                          </p>
                        )}
                      </div>
                      <span style={{ fontSize: 13.5, fontWeight: 500, color: strike ? FAINT : TXT, flexShrink: 0, textDecoration: strike ? "line-through" : "none" }}>
                        {eur(r.cost)}
                      </span>
                    </div>
                  );
                })}

                <div style={{ height: 1, background: LINE, margin: "4px 0" }} />

                {/* Pool utilization */}
                {bundle && computed.poolTotal > 0 && (() => {
                  const pct = Math.min(100, (computed.totalCoveredMins / computed.poolTotal) * 100);
                  const over = computed.isOverPool;
                  return (
                    <div style={{ padding: "10px 12px", borderRadius: 9, background: "rgba(255,255,255,.022)", border: `1px solid ${LINE}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 6 }}>
                        <span style={{ color: MUT }}>Minute pool · {bundle.name}</span>
                        <span style={{ color: over ? C.amber : GREEN, fontVariantNumeric: "tabular-nums" }}>
                          {Math.round(computed.totalCoveredMins).toLocaleString()} / {computed.poolTotal.toLocaleString()} min
                        </span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,.07)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 2, background: over ? C.amber : GREEN, transition: "width .3s" }} />
                      </div>
                      {over && (
                        <p style={{ fontSize: 11, color: C.amber, margin: "6px 0 0" }}>
                          {Math.round(computed.poolOverage).toLocaleString()} min overage (FUP) · +{eur(computed.overageCost)} at blended PAYG rate
                        </p>
                      )}
                      {bundle.usCanadaMinutes && computed.totalUsCanadaMins > 0 && (() => {
                        const uPct = Math.min(100, (computed.totalUsCanadaMins / computed.usCanadaPoolTotal) * 100);
                        return (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 5 }}>
                              <span style={{ color: MUT }}>US & Canada pool</span>
                              <span style={{ color: computed.isOverUsCanadaPool ? C.amber : GREEN, fontVariantNumeric: "tabular-nums" }}>
                                {Math.round(computed.totalUsCanadaMins).toLocaleString()} / {computed.usCanadaPoolTotal.toLocaleString()} min
                              </span>
                            </div>
                            <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,.07)", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${uPct}%`, borderRadius: 2, background: computed.isOverUsCanadaPool ? C.amber : GREEN, transition: "width .3s" }} />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {/* Gross */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12.5, color: MUT }}>Gross PAYG</span>
                  <span style={{ fontSize: 13, color: MUT }}>{eur(computed.grossTotal)}</span>
                </div>

                {/* Bundle lines */}
                {activeBundle && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12.5, color: GREEN }}>Bundle offsets ({bundle.name})</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: GREEN }}>-{eur(computed.bundleSavings)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12.5, color: MUT }}>{bundle.name} · {computed.nSeats} seat{computed.nSeats > 1 ? "s" : ""} × €{bundle.price}</span>
                      <span style={{ fontSize: 13, color: TXT }}>+{eur(computed.bundleCost)}</span>
                    </div>
                    <div style={{ height: 1, background: LINE, margin: "2px 0" }} />
                  </>
                )}

                {/* Net */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>Net / month</span>
                  <span style={{ fontSize: 19, fontWeight: 600, color: C.blue }}>{eur(computed.netTotal)}</span>
                </div>
              </div>
            </div>

            {/* Intl warning */}
            {anyIntl && (
              <div style={{ display: "flex", gap: 9, padding: 13, background: C.amberBg, borderRadius: 12, border: `1px solid ${C.amberBorder}` }}>
                <Info size={14} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: C.amber, margin: 0, lineHeight: 1.5 }}>
                  International rate applied - non-EEA number calling an EEA destination. Switch to an EEA-based number for the cheaper intra-EEA rate.
                </p>
              </div>
            )}

            {/* Footnote */}
            <div style={{ display: "flex", gap: 9, padding: 13 }}>
              <Info size={13} color={FAINT} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 11, color: FAINT, margin: 0, lineHeight: 1.6 }}>
                Without call count: reference = rate × avg duration (1 call). Bundle = shared minute pool/seat/mo across all covered destinations (FUP). Overage beyond the pool is billed at PAYG. US & Canada: 10,000 min pool (World bundle). Final pricing via sales@cloudtalk.io
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
