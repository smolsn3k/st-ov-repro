// Baby care: growth stages, development milestones, age-based care norms and time-of-day needs.
// Ported in concept from delidgi/Pregnancy-and-menstruation (baby-care.js), rewritten in English.
import { S, C, hooks } from './core.js';
import { toDays } from './dates.js';

function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); }
// Stable personal offset, so twins and siblings develop at slightly different paces.
const jitter = (b, key, range) => (range ? (hash(`${b.id}|${b.sex}|${key}`) % (range * 2 + 1)) - range : 0);

export const MILESTONES = [
    { key: 'smile', label: 'first smile', base: 40, range: 12 },
    { key: 'head', label: 'holds head up steadily', base: 75, range: 15 },
    { key: 'roll', label: 'rolls over from back to front', base: 120, range: 20 },
    { key: 'laugh', label: 'laughs out loud', base: 130, range: 20 },
    { key: 'sit', label: 'sits without support', base: 185, range: 25 },
    { key: 'solids', label: 'first solid foods', base: 183, range: 10 },
    { key: 'tooth', label: 'first tooth', base: 195, range: 55 },
    { key: 'crawl', label: 'crawls', base: 250, range: 35 },
    { key: 'stand', label: 'pulls up to stand', base: 290, range: 25 },
    { key: 'babble', label: 'babbles "mama" and "dada"', base: 320, range: 40 },
    { key: 'steps', label: 'first steps', base: 370, range: 40 },
    { key: 'words', label: 'first real words', base: 380, range: 45 },
    { key: 'run', label: 'runs', base: 550, range: 60 },
    { key: 'phrases', label: 'two-word phrases', base: 640, range: 70 },
    { key: 'potty', label: 'starts potty training', base: 660, range: 90 },
];
export const milestoneDay = (b, m) => m.base + jitter(b, m.key, m.range);
const MS = key => MILESTONES.find(m => m.key === key);

export const STAGES = [
    { key: 'newborn', label: 'Newborn', maxDays: 30 },
    { key: 'infant', label: 'Infant', maxDays: 365 },
    { key: 'toddler', label: 'Toddler', maxDays: 1095 },
    { key: 'preschool', label: 'Preschooler', maxDays: 2555 },
    { key: 'school', label: 'School-age', maxDays: 4380 },
    { key: 'teen', label: 'Teen', maxDays: 6570 },
    { key: 'adult', label: 'Adult', maxDays: Infinity },
];
export const stageOf = age => STAGES.find(s => age < s.maxDays) || STAGES[STAGES.length - 1];

export const labelOf = b => b.name || `Baby${b.id}`;
export function ageWords(days) {
    if (days < 60) return `${days} day${days === 1 ? '' : 's'}`;
    if (days < 730) return `${Math.floor(days / 30)} months`;
    return `${Math.floor(days / 365)} years`;
}

export function careNorms(a, b) {
    const c = { feeding: '', sleep: '', diaper: '', teething: null, colic: false, upcoming: null };
    const solids = milestoneDay(b, MS('solids')), potty = milestoneDay(b, MS('potty')), tooth = milestoneDay(b, MS('tooth'));
    if (a < 60) c.feeding = 'milk (breast or formula) every 2-3 hours, 8-12 times a day, including at night';
    else if (a < 120) c.feeding = 'milk about every 3 hours, 7-8 feeds a day';
    else if (a < solids) c.feeding = 'milk every 3.5-4 hours; too early for solids (from about 6 months)';
    else if (a < 240) c.feeding = 'starting solids: purees and cereals by spoon, plus milk';
    else if (a < 365) c.feeding = 'three solid meals a day (purees, cereals, soft pieces) plus milk';
    else if (a < 540) c.feeding = 'family food in small pieces, 4-5 times a day';
    else c.feeding = 'family food, 4 meals a day plus snacks';

    if (a < 90) c.sleep = '16-18 hours of sleep a day, wakes every 2-4 hours at night';
    else if (a < 140) c.sleep = '15-16 hours of sleep; a sleep regression is possible (around 4 months)';
    else if (a < 183) c.sleep = '14-15 hours of sleep with 3 naps';
    else if (a < 365) c.sleep = '13-14 hours of sleep with 2 naps';
    else if (a < 540) c.sleep = 'about 13 hours of sleep with 1-2 naps';
    else c.sleep = '12-13 hours of sleep with 1 nap';

    if (a < 365) c.diaper = 'diapers: 6-10 changes a day';
    else if (a < potty) c.diaper = 'diapers: 4-6 changes a day';
    else c.diaper = 'learning the potty; diaper for naps and outings';

    c.colic = a >= 20 && a <= 105; // from about 3 weeks to 3.5 months, peaking near 6 weeks

    if (a >= tooth - 15 && a < tooth) c.teething = 'swollen gums, drooling, chewing on everything; first tooth coming soon';
    else if (a >= tooth && a < tooth + 80) c.teething = 'front teeth coming in: fussiness, drooling, possible low fever';
    else if (a >= 390 && a < 480) c.teething = 'side incisors coming in';
    else if (a >= 480 && a < 630) c.teething = 'first molars and canines coming in, the most painful stage';
    else if (a >= 630 && a < 850) c.teething = 'second molars coming in';

    let next = null;
    for (const m of MILESTONES) { const d = milestoneDay(b, m); if (d > a && (!next || d < next.d)) next = { d, label: m.label }; }
    if (next && next.d - a <= 45) c.upcoming = next.label;
    return c;
}

// Absolute story time in hours (null when the chat date is unknown).
export function nowHours() {
    const d = C().date, z = toDays(d.current);
    if (z === null) return null;
    const [h, m] = (d.time || '12:00').split(':').map(Number);
    return z * 24 + h + (m || 0) / 60;
}
export const hourOfDay = () => { const t = C().date.time; return t ? Number(t.split(':')[0]) : 12; };

// Needs right now, from age, story time and the last feed/change when known.
export function careNeeds(b) {
    const a = b.age, hour = hourOfDay(), now = nowHours();
    const out = { feeding: null, diaper: null, sleep: null, note: null };
    const off = jitter(b, 'schedule', 1), adj = (hour + 24 - off) % 24;
    const feedEvery = a < 60 ? 2.5 : a < 120 ? 3 : a < 180 ? 3.5 : a < 365 ? 4 : 5;
    const diaperEvery = a < 180 ? 2.5 : 3.5;

    const sinceFed = now !== null && b.lastFedH != null ? now - b.lastFedH : null;
    if (sinceFed !== null && sinceFed >= 0) out.feeding = sinceFed >= feedEvery ? 'hungry' : sinceFed < 0.5 ? 'just fed' : 'fed';
    else { const m = adj % feedEvery; out.feeding = m >= feedEvery - 0.5 ? 'hungry' : m < 0.5 ? 'just fed' : 'fed'; }

    const sinceDiaper = now !== null && b.lastChangedH != null ? now - b.lastChangedH : null;
    if (sinceDiaper !== null && sinceDiaper >= 0) out.diaper = sinceDiaper >= diaperEvery ? 'needs changing' : 'clean';
    else out.diaper = adj % diaperEvery >= diaperEvery - 0.5 ? 'needs changing' : 'clean';

    const night = hour >= 20 || hour < 6;
    if (night) {
        out.sleep = 'asleep';
        if (a < 90 && hour >= 1 && hour < 5) { out.sleep = 'awake'; out.feeding = 'hungry'; out.note = 'night feed'; }
    } else if (hour >= 6 && hour < 8) out.sleep = 'waking up';
    else if (a < 365 && hour >= 10 && hour < 12) out.sleep = 'morning nap';
    else if (a < 540 && hour >= 14 && hour < 16) out.sleep = 'afternoon nap';
    else out.sleep = 'awake';

    if (!out.note) {
        if (hour >= 19 && hour < 20) out.note = 'time for a bath and bedtime routine';
        else if (hour >= 9 && hour < 11 && a > 30) out.note = 'good time for a walk';
        else if (hour >= 16 && hour < 18 && a > 30) out.note = 'evening walk';
        else if (a < 90 && out.feeding === 'hungry') out.note = 'feeds on demand every 2-3 hours';
    }
    return out;
}

const note = (t) => { if (S().notifications) toastr.success(t, 'Omegaverse'); };

// Idempotent: records reached milestones, updates teething/colic flags, archives grown children.
export function updateBabies() {
    const fam = C().family, newly = [];
    for (const b of fam.babies) {
        for (const m of MILESTONES) {
            if (milestoneDay(b, m) > b.age || b.milestones.some(x => x.key === m.key)) continue;
            b.milestones.push({ key: m.key, text: m.label, date: C().date.current });
            newly.push({ b, m });
        }
        const n = careNorms(b.age, b);
        b.teething = !!n.teething; b.colicky = n.colic;
    }
    const limit = S().babyMaxAgeDays;
    const grown = fam.babies.filter(b => b.age >= limit);
    if (grown.length) {
        if (S().graduationDialog && hooks.onGrad) {
            const ask = grown.filter(b => !b.gradAsked);
            ask.forEach(b => { b.gradAsked = true; });
            if (ask.length) hooks.onGrad(ask.map(b => b.id));
        } else archiveBabies(grown.map(b => b.id));
    }
    if (newly.length <= 2) newly.forEach(({ b, m }) => note(`${labelOf(b)}: ${m.label}!`));
    else note(`Development milestones reached: +${newly.length}`);
}

export function ageBabies(days) {
    const fam = C().family;
    for (const b of fam.babies) b.age += days;
    for (const g of fam.grown) g.age += days;
    updateBabies();
}

// Move children to the "older children" list (used by auto-archiving and the graduation dialog).
export function archiveBabies(ids) {
    const fam = C().family;
    for (const id of ids) {
        const i = fam.babies.findIndex(x => x.id === id);
        if (i < 0) continue;
        const [b] = fam.babies.splice(i, 1);
        fam.grown.push({ id: b.id, name: b.name, sex: b.sex, parent: b.parent, age: b.age, personality: b.personality, appearance: b.appearance, otherParent: b.otherParent, milestones: b.milestones.length });
        note(`${labelOf(b)} is now ${ageWords(b.age)} old and moves to the older children`);
    }
}
