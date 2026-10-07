// Health layer: planned complications/conditions, visits and tests, fetus confirmation, status/symptoms,
// appearance inheritance, disruptions, trying mode, lactation/postpartum and nest handling.
import { S, C, ERAS, PHYS, nameOf } from '../core/core.js';
import { diffDays, toDays } from '../core/dates.js';
import * as D from '../core/data.js';

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const roll = () => Math.random() * 100;
const ent = k => C().entities[k];
const other = k => (k === 'user' ? 'char' : 'user');
export const era = () => ERAS[C().reveal.era] || ERAS.modern;
export const practitioner = () => { const c = C(); return c.reveal.era === 'custom' ? (c.reveal.practitioner || 'healer') : era().practitioner; };
export const weeksOf = e => Math.floor(e.days / 7);

function log(k, text) { const e = ent(k); e.log.push({ date: C().date.current, text }); if (e.log.length > 40) e.log.shift(); }
function weighted(list) {
    let t = list.reduce((a, x) => a + (x.weight || 1), 0), r = Math.random() * t;
    for (const x of list) { r -= x.weight || 1; if (r <= 0) return x; }
    return list.at(-1);
}
function seedHash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); }
function seededPick(arr, n, seed) {
    const out = [], pool = [...arr];
    let h = seedHash(seed);
    while (out.length < n && pool.length) { out.push(pool.splice(h % pool.length, 1)[0]); h = Math.imul(h, 1103515245) + 12345 >>> 0; }
    return out;
}

export const emptyHealth = () => ({ complications: [], fetal: null, eggPlanned: [], visit: { date: null, note: '' }, test: { result: null, date: null }, confirm: { count: false, sex: false } });

// ── Planning at conception ──
export function planPregnancy(k) {
    const e = ent(k), s = S();
    e.health = emptyHealth();
    if (s.complicationsEnabled) {
        for (const c of D.COMPLICATIONS) {
            if (roll() < c.chance * (s.complicationChance / 100)) {
                e.health.complications.push({ id: c.id, severity: c.severity, week: rnd(c.weeks[0], c.weeks[1]), active: false, diagnosed: false, resolved: false });
            }
        }
    }
    const canSee = era().sexWeek < 999;
    if (s.fetalDiseasesEnabled && roll() < s.fetalDiseaseChance) {
        const d = weighted(D.FETAL_DISEASES);
        e.health.fetal = { id: d.id, baby: rnd(0, e.fetusCount - 1), week: canSee ? rnd(d.detect[0], d.detect[1]) : 999, known: false };
    }
}

export function planEggs(k) {
    const e = ent(k), s = S();
    e.health = emptyHealth();
    e.eggs = Array.from({ length: e.egg.count }, () => ({ shell: null, embryo: null, fate: 'hatch', known: false }));
    for (const g of e.eggs) {
        if (s.embryoDiseasesEnabled && roll() < s.embryoChance) { const d = weighted(D.EMBRYO_DISEASES); g.embryo = d.id; if (d.fatal) g.fate = 'fail'; }
        if (s.shellDefectsEnabled && roll() < s.shellChance) g.shell = weighted(D.SHELL_DEFECTS).id;
    }
    if (s.eggComplicationsEnabled) {
        for (const c of D.EGG_COMPLICATIONS) {
            if (roll() < c.chance * (s.complicationChance / 100)) e.health.eggPlanned.push({ id: c.id, severity: c.severity, stage: c.stage, day: rnd(c.day[0], c.day[1]), active: false, diagnosed: false, resolved: false });
        }
    }
}

// ── Ticking (called after time passes) ──
export function tick(k) {
    const e = ent(k), h = e.health;
    if (e.pregnant) {
        const w = weeksOf(e);
        for (const c of h.complications) if (!c.active && !c.resolved && w >= c.week) { c.active = true; log(k, `Complication began: ${D.COMPLICATIONS.find(x => x.id === c.id)?.label}`); }
    }
    if (e.egg.stage !== 'none') {
        for (const c of h.eggPlanned) {
            const atStage = c.stage === 'gravid' ? ['gravid', 'laying_due'].includes(e.egg.stage) && e.egg.carryDays >= c.day : e.egg.stage === 'laying_due';
            if (!c.active && !c.resolved && atStage) { c.active = true; log(k, `Complication began: ${D.EGG_COMPLICATIONS.find(x => x.id === c.id)?.label}`); }
        }
    }
}

// ── Status and symptom pools ──
export function band(w) { return D.PREG_BANDS.find(b => w <= b.max) || D.PREG_BANDS.at(-1); }
export function pregStatus(k) {
    const e = ent(k), w = weeksOf(e), b = band(w);
    const seed = `${e.conceptionDate}|${k}|${Math.floor(w / 2)}`;
    return {
        week: w, size: b.size, symptoms: seededPick(b.sym, 3, seed), movement: b.move, position: b.pos,
        braxton: b.brax, swelling: b.swell, libido: b.libido, weight: b.weight, advice: b.advice,
    };
}
export function phaseSymptoms(k, id, n = 3) {
    const pool = D.SYMPTOMS[id === 'heat' || id === 'rut' ? id : id];
    if (!pool) return [];
    return seededPick(pool, n, `${id}|${k}|${ent(k).cycleDay}`);
}
export function postpartumStage(k) {
    const e = ent(k), m = e.postpartum?.method || 'natural', table = D.POSTPARTUM[m] || D.POSTPARTUM.natural;
    return table.find(x => e.postpartumDays <= x.max) || null;
}
export const postpartumLength = k => { const e = ent(k); return Math.round(S().recoveryDays * (e.postpartum?.method === 'csection' ? 1.5 : 1)); };

// ── Visits, tests, confirmation ──
export const visitCooldownLeft = k => {
    const e = ent(k), last = e.health.visit.date, cur = C().date.current;
    if (last == null || cur == null) return 0;
    const d = diffDays(last, cur);
    return d === null ? 0 : Math.max(0, S().doctorCooldown - d);
};

export function visit(k, { force = false } = {}) {
    const e = ent(k), h = e.health, ep = era(), n = nameOf(k), out = { ok: false, findings: [], msg: '' };
    if (!(e.pregnant || e.egg.stage !== 'none')) { out.msg = `${n} is not carrying`; return out; }
    if (!force && visitCooldownLeft(k) > 0) { out.msg = `Next visit possible in ${visitCooldownLeft(k)} day(s)`; return out; }
    const f = out.findings;
    if (e.pregnant) {
        const w = weeksOf(e);
        if (w >= ep.confirmWeek) {
            if (!e.known) { e.known = true; f.push('pregnancy confirmed'); }
            if (w >= ep.countWeek && !h.confirm.count) { h.confirm.count = true; f.push(e.fetusCount > 1 ? `${e.fetusCount} babies` : 'a single baby'); }
            if (w >= ep.sexWeek && !h.confirm.sex) { h.confirm.sex = true; f.push(`sex: ${e.fetusSex.map(x => (x === 'M' ? 'boy' : 'girl')).join(', ')}`); }
        } else f.push('too early to tell anything for certain');
        for (const c of h.complications) {
            if (!c.active || c.resolved) continue;
            const def = D.COMPLICATIONS.find(x => x.id === c.id);
            c.diagnosed = true;
            if (roll() < (c.severity === 'critical' ? 50 : 75)) { c.resolved = true; f.push(`${def.label}: treated and under control (${def.care})`); log(k, `${def.label} treated`); }
            else f.push(`${def.label}: diagnosed, still a concern (${def.care})`);
        }
        if (h.fetal && !h.fetal.known && w >= h.fetal.week) {
            h.fetal.known = true; const d = D.FETAL_DISEASES.find(x => x.id === h.fetal.id); f.push(`baby: ${d.label} (${d.note})`);
        }
    } else {
        if (!h.confirm.count) { h.confirm.count = true; f.push(`${e.egg.count} eggs`); }
        e.known = true;
        for (const c of h.eggPlanned) {
            if (!c.active || c.resolved) continue;
            const def = D.EGG_COMPLICATIONS.find(x => x.id === c.id); c.diagnosed = true;
            if (roll() < (c.severity === 'critical' ? 50 : 75)) { c.resolved = true; f.push(`${def.label}: treated (${def.care})`); }
            else f.push(`${def.label}: still a concern (${def.care})`);
        }
        if (e.egg.stage === 'incubating' || e.egg.stage === 'hatch_due') {
            for (const g of e.eggs) {
                if (g.known) continue;
                if (g.shell) { g.known = true; f.push(`an egg with a ${D.SHELL_DEFECTS.find(x => x.id === g.shell).label}`); }
                if (g.embryo) { g.known = true; const d = D.EMBRYO_DISEASES.find(x => x.id === g.embryo); f.push(`an egg with ${d.label} (${d.note})`); }
            }
        }
    }
    h.visit = { date: C().date.current, note: f.join('; ') };
    if (!f.length) h.visit.note = 'everything looks normal';
    out.ok = true; out.msg = `${practitioner()} visit: ${h.visit.note}`;
    log(k, `Visit to the ${practitioner()}`);
    return out;
}

export function testReliability(days) { return days < 7 ? 0 : days < 10 ? 0.3 : days < 14 ? 0.7 : 0.97; }
export function takeTest(k) {
    const e = ent(k), ep = era(), t = ep.test;
    if (!t) return { ok: false, msg: `This era has no pregnancy test; visit the ${practitioner()} instead` };
    const days = e.pregnant ? Math.max(0, e.days) : 0;
    const positive = e.pregnant && Math.random() < testReliability(days) * t.rel;
    const res = positive ? (days < 14 ? 'faint' : 'positive') : 'negative';
    e.health.test = { result: res, date: C().date.current };
    if (positive) e.known = true;
    return { ok: true, result: res, msg: `${t.name}: ${res}` };
}

// ── Appearance inheritance ──
export function inheritedLooks(k) {
    const c = C(), e = ent(k), o = other(k), sec = e.second || {};
    const a = D.parseLook(c.looks[k]?.text), b = D.parseLook(sec.look || (sec.name?.trim() ? '' : c.looks[o]?.text));
    return { eyes: D.inheritTrait(a.eyes, b.eyes, D.EYE_RANK), hair: D.inheritTrait(a.hair, b.hair, D.HAIR_RANK) };
}
export const secondParentName = k => ent(k).second?.name?.trim() || nameOf(other(k));

// ── Disruptions ──
export function disrupt(k, kind) {
    const e = ent(k), d = D.DISRUPTIONS[kind];
    if (!d || !S().disruptionsEnabled) return 0;
    const shift = rnd(d.shift[0], d.shift[1]);
    e.disruption = { kind, shift, date: C().date.current };
    if (!(e.pregnant || e.egg.stage !== 'none' || e.postpartumDays > 0) && e.cycleDay > S().heatDuration) {
        e.cycleDay = Math.max(S().heatDuration + 1, e.cycleDay - shift);
    }
    log(k, `Cycle disrupted by ${d.label} (+${shift} days)`);
    return shift;
}

// ── Trying mode ──
export function tryingMult(k) {
    const e = ent(k);
    if (!S().tryingMode || !e.trying?.on) return 1;
    const m = e.trying.cycles;
    return m < 1 ? 0.85 : m < 3 ? 0.95 : 1.1;
}

// ── Lactation ──
export function setLactating(k, v) { ent(k).postpartum.lactating = !!v; }

// ── Nest ──
export function setNest(k, state) { if (D.NEST[state]) ent(k).nest.state = state; }

// ── Cycle profile for the infoblock tiles (heat/rut position within the cycle) ──
export function cycleInfo(k, dayOverride = null) {
    const c = C(), e = ent(k), s = S(), role = PHYS[c.physiology[k]].role, L = s.cycleLength, Dn = s.heatDuration;
    const d = dayOverride ?? e.cycleDay, nm = role === 'omega' ? 'heat' : 'rut', cap = t => t[0].toUpperCase() + t.slice(1);
    if (d > L) return { day: d, length: L, sub: 'delayed', label: 'Late', ...D.PHASE_INFO.delayed };
    let sub, label;
    if (d <= Dn) {
        if (c.contraception[k] === 'suppressant') { sub = 'suppressed'; label = 'Suppressed'; }
        else { const p = Dn > 1 ? (d - 1) / (Dn - 1) : 0.5; sub = `${nm}_${p < 0.34 ? 'early' : p < 0.67 ? 'peak' : 'late'}`; label = cap(nm); }
    } else if (d > L - 3) { sub = 'pre'; label = `Pre-${nm}`; }
    else if (d <= Dn + 3) { sub = 'post'; label = `Post-${nm}`; }
    else { sub = 'calm'; label = 'Calm'; }
    return { day: d, length: L, sub, label, ...D.PHASE_INFO[role][sub] };
}

// ── Mood, physical state and libido (observed in the story, with phase defaults) ──
export const LIBIDO = ['Very low', 'Low', 'Normal', 'High', 'Very high'];
const LIB_SCORE = { 'very high': 4, 'high, waning': 3, rising: 3, 'slightly raised': 2.5, normal: 2, fading: 1.5, muted: 1, variable: 2, unchanged: 2, lowered: 1, returning: 2, increased: 3, high: 3, fluctuating: 2, low: 1, 'very low': 0, 'low, rising': 1.5, 'undetermined': 2 };
const NEG_MOOD = /\b(sad|depress|griev|grief|mourn|hopeless|numb|anxious|anxiety|scared|afraid|fear|panic|angry|anger|furious|upset|stress|exhaust|tired|drained|lonely|hurt|miserable|ashamed|guilt|disgust|unwell|irritab|annoy|bored|overwhelm|heartbro|despair|withdrawn|worried|tearful|crying|devastat)/i;
const HOT_MOOD = /(aroused|horny|lust|desir|needy|craving|turned on|wanton|passion|yearn|heated|frisky|burning for|wants? (?:him|her|them))/i;
const SOFT_MOOD = /(happy|content|affection|tender|playful|flirt|relaxed|cheerful|loving|warm|giddy|smitten)/i;
const NEG_BODY = /(ill\b|sick|fever|pain|hurt|injur|sore|nause|dizzy|headache|exhaust|weak|ache|migraine|cramp)/i;
const HOT_BODY = /(flushed|panting|trembl|heated|feverish with|overheated|slick)/i;
const moodMod = t => (HOT_MOOD.test(t) ? 1 : NEG_MOOD.test(t) ? -1 : SOFT_MOOD.test(t) ? 0.3 : 0);
const bodyMod = t => (HOT_BODY.test(t) ? 0.8 : NEG_BODY.test(t) ? -1 : 0);

export function feelFresh(k) {
    const st = ent(k).feel?.stamp, cur = toDays(C().date.current);
    if (!st || st.day == null || cur === null) return true;
    return cur - st.day <= S().feelDays;
}
export const touchFeel = k => { ent(k).feel.stamp = { day: toDays(C().date.current) }; };
const clip = (v, n = 40) => (typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'null' ? v.trim().slice(0, n) : '');
export function setFeel(k, { mood, physical, libido } = {}, { refresh = false } = {}) {
    const f = ent(k).feel; let changed = false;
    const m = clip(mood), p = clip(physical), l = LIBIDO.find(x => x.toLowerCase() === String(libido || '').toLowerCase()) || '';
    if (m && m !== f.mood) { f.mood = m; changed = true; if (!l) f.libido = ''; }   // new mood without a stated libido: drop the stale libido reading
    if (p && p !== f.physical) { f.physical = p; changed = true; }
    if (l && l !== f.libido) { f.libido = l; changed = true; }
    if (changed || (refresh && (m || p || l))) touchFeel(k);   // refresh: the same reading repeated in a new reply is still current
    return changed;
}

// Defaults for the character's current state, before anything observed in the story.
export function baseState(k) {
    const e = ent(k);
    if (e.pregnant) { const p = pregStatus(k); return { mood: D.PREG_MOOD[Math.min(2, Math.floor(p.week / 14))], physical: p.symptoms[0], libidoText: p.libido }; }
    if (e.egg.stage !== 'none') return { mood: 'Restless, nesting', physical: 'Warm, heavy', libidoText: 'low' };
    if (e.postpartumDays > 0) { const st = postpartumStage(k); return { mood: D.POST_MOOD[Math.min(3, Math.floor(e.postpartumDays / 14))], physical: st?.sym?.[0] || 'Recovering', libidoText: 'fading' }; }
    const info = cycleInfo(k);
    return { mood: info.mood, physical: info.physical, libidoText: info.libido };
}
export function feelNow(k, base = baseState(k)) {
    const f = ent(k).feel || {}, fresh = S().trackFeelings && feelFresh(k);
    const obsMood = fresh && f.mood ? f.mood : '', obsBody = fresh && f.physical ? f.physical : '';
    let score = LIB_SCORE[String(base.libidoText).toLowerCase()] ?? 2, observed = false;
    const lv = fresh && f.libido ? LIBIDO.indexOf(f.libido) : -1;
    if (lv >= 0) { score = lv; observed = true; }
    else if (obsMood || obsBody) { const d = moodMod(obsMood) + bodyMod(obsBody); if (d) observed = true; score += d; }
    score = Math.max(0, Math.min(4, score));
    return { mood: obsMood || base.mood, physical: obsBody || base.physical, libido: LIBIDO[Math.round(score)], observed: { mood: !!obsMood, physical: !!obsBody, libido: observed } };
}
export const feelFor = k => feelNow(k, baseState(k));
