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
// A story day is a plain integer day counter. Older chats stored ISO strings ("2026-05-04"); every helper accepts both.
export const FREE_BASE = 100000;   // counter value a free-text calendar starts from ("Day 1" = FREE_BASE + 1), keeps it clear of 0 and of real dates
export function toDays(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null;
    const p = parseISO(v);
    return p ? dfc(p.y, p.m, p.d) : null;
}
export function addDays(v, n) { const z = toDays(v); return z === null ? null : z + n; }
export function diffDays(a, b) { const x = toDays(a), y = toDays(b); return x === null || y === null ? null : y - x; }
export const toISO = v => { const z = toDays(v); return z === null ? '' : fmt(cfd(z)); };
export function pretty(v) {
    const z = toDays(v);
    if (z === null) return 'unknown';
    const p = cfd(z);
    return `${p.d} ${MONTH_LABELS[p.m - 1]} ${p.y}`;
}
export function prettyNoYear(v) {
    const z = toDays(v);
    if (z === null) return 'unknown';
    const p = cfd(z);
    return `${p.d} ${MONTH_LABELS[p.m - 1]}`;
}

const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const MON_CAP = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
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


// ── Free-form story dates ──
// Month and day without a year: "12 May", "May 12th", "12th of May", "12.05" / "05/12" (order follows DMY / MDY).
// prose=true is stricter (capitalized month names only, no numeric forms) because it runs on story text, not on a date field.
export function extractYearless(text, order = 'DMY', prose = false) {
    const t = String(text || '');
    const hits = [];
    let r;
    const push = (idx, m, d) => { if (m >= 1 && m <= 12 && d >= 1 && d <= dim(2000, m)) hits.push({ idx, m, d }); };
    const fl = prose ? 'g' : 'gi';
    const mon = prose ? MON_CAP : MON;
    const dm = new RegExp(`(?<![\\d:])(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${mon}(?![a-z])\\.?(?!\\s*,?\\s*\\d{3,4}\\b)`, fl);
    while ((r = dm.exec(t))) push(r.index, monthNum(r[2]), +r[1]);
    const md = new RegExp(`\\b${mon}(?![a-z])\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?![\\d:])(?!\\s*,?\\s*\\d{3,4}\\b)`, fl);
    while ((r = md.exec(t))) push(r.index, monthNum(r[1]), +r[2]);
    if (!prose) {
        const num = /(?<![\d./:])(\d{1,2})[./](\d{1,2})(?![\d./:])/g;
        while ((r = num.exec(t))) {
            const a = +r[1], b = +r[2];
            const first = order === 'MDY' ? [a, b] : [b, a], second = order === 'MDY' ? [b, a] : [a, b];   // [month, day]
            if (first[0] >= 1 && first[0] <= 12 && first[1] >= 1 && first[1] <= dim(2000, first[0])) push(r.index, first[0], first[1]);
            else push(r.index, second[0], second[1]);
        }
    }
    if (!hits.length) return null;
    hits.sort((a, b) => a.idx - b.idx);
    return { m: hits[0].m, d: hits[0].d };
}

// First counter value for month/day on or after the reference day, rolling into the next year when the date wraps around.
// A date more than half a year behind the reference counts as a wrap; a smaller step back is a flashback and stays in the same year.
// With past=true the latest occurrence on or before the reference is returned instead (used for "when did this happen").
export function placeYearless(m, d, ref = null, past = false) {
    const baseYear = ref === null ? 2000 : cfd(ref).y;
    const firstValid = y => { for (let i = 0; i < 9; i++) if (valid(y + i, m, d)) return dfc(y + i, m, d); return null; };
    const lastValid = y => { for (let i = 0; i < 9; i++) if (valid(y - i, m, d)) return dfc(y - i, m, d); return null; };
    if (ref === null) return firstValid(baseYear);
    if (past) { const v = lastValid(baseYear); return v !== null && v > ref ? lastValid(baseYear - 1) : v; }
    let v = firstValid(baseYear);
    if (v !== null && v < ref - 183) v = firstValid(baseYear + 1);
    return v;
}

// Interprets whatever the person (or the model's date tag) wrote.
//   full      a date with a year          -> counter from the calendar
//   yearless  day and month only          -> counter, year added when the date wraps
//   day       "Day 14"                    -> counter FREE_BASE + 14 (free calendar)
//   text      anything else (fantasy ...) -> no counter, the text is kept as is
export function parseStoryDate(text, { order = 'DMY', ref = null } = {}) {
    const t = String(text || '').trim();
    if (!t) return { kind: 'none', day: null };
    const full = extractDate(t, order);
    if (full) return { kind: 'full', day: toDays(full) };
    const dn = /^\s*day\s*#?\s*(\d{1,6})\b/i.exec(t);
    if (dn) return { kind: 'day', day: FREE_BASE + Number(dn[1]) };
    const yl = extractYearless(t, order, false);
    if (yl) { const day = placeYearless(yl.m, yl.d, ref); if (day !== null) return { kind: 'yearless', day }; }
    return { kind: 'text', day: null };
}

// "when did it happen" fields (conception date, birth date): blank / "today", "10 days ago", "3 weeks ago", or any date the story uses.
export function resolveWhen(text, cur, order = 'DMY') {
    const t = String(text || '').trim();
    if (!t || /^(today|now)$/i.test(t)) return cur;
    const rel = /^(\d{1,5})\s*(d|day|days|w|wk|week|weeks|month|months)\s+ago$/i.exec(t);
    if (rel) {
        if (cur === null || cur === undefined) return null;
        const u = rel[2].toLowerCase(), mult = u[0] === 'w' ? 7 : u.startsWith('mon') ? 30 : 1;
        return toDays(cur) - Number(rel[1]) * mult;
    }
    const full = extractDate(t, order);
    if (full) return toDays(full);
    const dn = /^\s*day\s*#?\s*(\d{1,6})\b/i.exec(t);
    if (dn) return FREE_BASE + Number(dn[1]);
    const yl = extractYearless(t, order, false);
    if (yl && cur !== null && cur !== undefined) return placeYearless(yl.m, yl.d, toDays(cur), true);
    return null;
}
