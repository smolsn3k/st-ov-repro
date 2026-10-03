// Calendar helpers that work for any year (medieval, modern, far future) without JS Date quirks.
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
export const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function dfc(y, m, d) { // days from civil
    y -= m <= 2 ? 1 : 0;
    const era = Math.floor(y / 400), yoe = y - era * 400;
    const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
}
export function cfd(z) { // civil from days
    z += 719468;
    const era = Math.floor(z / 146097), doe = z - era * 146097;
    const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    const mp = Math.floor((5 * doy + 2) / 153);
    const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    const m = mp + (mp < 10 ? 3 : -9);
    return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
}
function dim(y, m) { return [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }
export function valid(y, m, d) { return Number.isInteger(y) && y >= 100 && y <= 9999 && m >= 1 && m <= 12 && d >= 1 && d <= dim(y, m); }
export function fmt({ y, m, d }) { return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
export function parseISO(s) {
    const x = /^(\d{3,4})-(\d{1,2})-(\d{1,2})$/.exec(String(s || '').trim());
    if (!x) return null;
    const o = { y: +x[1], m: +x[2], d: +x[3] };
    return valid(o.y, o.m, o.d) ? o : null;
}
export function toDays(iso) { const p = parseISO(iso); return p ? dfc(p.y, p.m, p.d) : null; }
export function addDays(iso, n) { const z = toDays(iso); return z === null ? null : fmt(cfd(z + n)); }
export function diffDays(a, b) { const x = toDays(a), y = toDays(b); return x === null || y === null ? null : y - x; }
export function pretty(iso) {
    const p = parseISO(iso);
    return p ? `${p.d} ${MONTH_LABELS[p.m - 1]} ${p.y}` : 'unknown';
}

const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
function monthNum(w) { const k = w.toLowerCase().slice(0, 3); return MONTHS.findIndex(n => n.startsWith(k)) + 1; }

// Returns the earliest full calendar date (with year) found in text, or null.
// order: 'DMY' or 'MDY' for numeric dates like 04/05/2026.
export function extractDate(text, order = 'DMY') {
    if (!text) return null;
    const t = String(text);
    const hits = [];
    const push = (idx, y, m, d) => { if (valid(y, m, d)) hits.push({ idx, iso: fmt({ y, m, d }) }); };
    let r;
    const iso = /\b(\d{3,4})-(\d{1,2})-(\d{1,2})\b/g;
    while ((r = iso.exec(t))) push(r.index, +r[1], +r[2], +r[3]);
    const num = /\b(\d{1,2})[./](\d{1,2})[./](\d{3,4})\b/g;
    while ((r = num.exec(t))) { const a = +r[1], b = +r[2]; order === 'MDY' ? push(r.index, +r[3], a, b) : push(r.index, +r[3], b, a); }
    const dmy = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MON}\\.?,?\\s+(\\d{3,4})\\b`, 'gi');
    while ((r = dmy.exec(t))) push(r.index, +r[3], monthNum(r[2]), +r[1]);
    const mdy = new RegExp(`\\b${MON}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{3,4})\\b`, 'gi');
    while ((r = mdy.exec(t))) push(r.index, +r[3], monthNum(r[1]), +r[2]);
    if (!hits.length) return null;
    hits.sort((a, b) => a.idx - b.idx);
    return hits[0].iso;
}

// Returns "HH:MM" for the earliest clock time in the text ("14:30", "9 pm", "7:15am"), or null.
export function extractTime(text) {
    const t = String(text || '');
    const hits = [];
    let r;
    const h12 = /\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*([ap])\.?m\.?(?![a-z])/gi;
    while ((r = h12.exec(t))) { let h = +r[1] % 12; if (r[3].toLowerCase() === 'p') h += 12; hits.push({ idx: r.index, v: `${String(h).padStart(2, '0')}:${r[2] || '00'}` }); }
    const h24 = /\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*[ap]\.?m)/gi;
    while ((r = h24.exec(t))) hits.push({ idx: r.index, v: `${String(+r[1]).padStart(2, '0')}:${r[2]}` });
    if (!hits.length) return null;
    hits.sort((a, b) => a.idx - b.idx);
    return hits[0].v;
}
