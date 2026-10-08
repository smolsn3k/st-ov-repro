// Reproduction logic: heat/rut cycle, conception, pregnancy, oviposition, postpartum/lactation. No menstruation.
import { S, C, PHYS, ERAS, contraMult, trackedKeys, nameOf, newBaby, hooks } from '../core/core.js';
import { ageBabies } from './baby.js';
import { addDays, diffDays, toDays, parseStoryDate, extractTime, FREE_BASE } from '../core/dates.js';
import * as H from './health.js';
import * as D from '../core/data.js';

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const ent = k => C().entities[k];
const role = k => PHYS[C().physiology[k]]?.role || 'omega';
export { hooks };

export const weeksOf = e => Math.floor(e.days / 7);
export const trimester = w => (w < 14 ? 1 : w < 28 ? 2 : 3);
export const isCarrying = e => e.pregnant || e.egg.stage !== 'none';
export const dueDate = e => (e.conceptionDate ? addDays(e.conceptionDate, S().termWeeks * 7) : null);

function log(k, text) {
    const e = ent(k);
    e.log.push({ date: C().date.current, text });
    if (e.log.length > 40) e.log.shift();
}

export function phase(k) {
    const c = C(), e = ent(k), s = S();
    if (e.pregnant) return { id: 'pregnant', label: `Pregnant, week ${weeksOf(e)}`, fertility: 0 };
    const g = e.egg;
    if (g.stage === 'gravid') return { id: 'egg_gravid', label: `Carrying eggs, day ${g.carryDays}/${s.eggCarryDays}`, fertility: 0 };
    if (g.stage === 'laying_due') return { id: 'egg_laying', label: 'Ready to lay', fertility: 0 };
    if (g.stage === 'incubating') return { id: 'egg_incubating', label: `Incubating, day ${g.incubDays}/${s.eggIncubationDays}`, fertility: 0 };
    if (g.stage === 'hatch_due') return { id: 'egg_hatching', label: 'Hatching due', fertility: 0 };
    if (e.postpartumDays > 0) {
        const len = H.postpartumLength(k), st = H.postpartumStage(k);
        if (e.postpartumDays <= len) return { id: 'postpartum', label: `Recovering (${st?.label || 'recovery'}), day ${e.postpartumDays}/${len}`, fertility: 0 };
        if (e.postpartum.lactating) return { id: 'lactating', label: `Lactating, cycle suppressed (day ${e.postpartumDays})`, fertility: 0.05 };
    }
    const r = role(k), name = r === 'omega' ? 'Heat' : 'Rut';
    const d = e.cycleDay, Dn = s.heatDuration, L = s.cycleLength;
    const suppressed = !!c.suppressants?.[k];
    if (d > L) return { id: 'late', label: `${name} late by ${d - L} d`, fertility: 0.03 };
    if (d <= Dn) {
        if (suppressed) return { id: 'suppressed', label: `${name} (suppressed), cycle ${d}/${L}`, fertility: 0.05 };
        return { id: r === 'omega' ? 'heat' : 'rut', label: `${name}, day ${d}/${Dn} (cycle ${d}/${L})`, fertility: r === 'omega' ? 1 : 0.8 };
    }
    if (d > L - 3) return { id: 'pre', label: `Pre-${name.toLowerCase()}, cycle ${d}/${L}`, fertility: 0.15 };
    return { id: 'quiet', label: `Between ${name.toLowerCase()}s, cycle ${d}/${L}`, fertility: 0.03 };
}

// Fertility as a number: the chance of conceiving per qualifying event with no protection at all.
export function naturalChance(k) {
    const p = phase(k);
    if (!p.fertility) return 0;                                       // pregnant, carrying eggs or recovering
    const sub = p.id === 'lactating' ? 'calm' : H.cycleInfo(k).sub.replace(/^rut_/, 'heat_');     // the cycle stage (a rut uses the heat/rut values)
    const v = Number(S().stageChance?.[sub] ?? S().stageChance?.calm ?? 0);
    return Math.max(0, Math.min(1, v / 100));
}

// Conception: the chance that actually applies, after contraception (or trying for a baby).
export function conceptionOdds(k) {
    const p = phase(k), e = ent(k);
    const base = naturalChance(k);
    if (!base) return 0;
    let mult = contraMult(C().contraception[k]);
    if (S().tryingMode && e.trying?.on && mult > 0) mult = 1;     // actively trying: protection set aside (sterile stays 0)
    return Math.max(0, Math.min(1, base * mult * H.tryingMult(k)));
}

function updateKnown(k) {
    const e = ent(k), era = ERAS[C().reveal.era] || ERAS.modern;
    if (e.known) return;
    if (e.pregnant && weeksOf(e) >= era.obviousWeek) { e.known = true; log(k, 'Pregnancy became obvious'); }
    if (e.egg.stage === 'laying_due') { e.known = true; log(k, 'Clutch became obvious'); }
}

export function advance(k, days) {
    const e = ent(k), s = S();
    if (!(days > 0)) return;
    if (e.pregnant) {
        e.days += days;
        updateKnown(k);
    } else if (e.egg.stage === 'gravid') {
        e.egg.carryDays += days;
        if (e.egg.carryDays >= s.eggCarryDays) { e.egg.stage = 'laying_due'; log(k, 'Eggs ready to be laid'); }
        updateKnown(k);
    } else if (e.egg.stage === 'incubating') {
        e.egg.incubDays += days;
        if (s.nestRisk && e.nest.state !== 'ready') e.egg.chill = (e.egg.chill || 0) + days;
        if (e.egg.incubDays >= s.eggIncubationDays) { e.egg.stage = 'hatch_due'; log(k, 'Eggs ready to hatch'); }
    } else if (e.postpartumDays > 0) {
        e.postpartumDays += days;
        const len = H.postpartumLength(k), end = e.postpartum.lactating ? Math.max(len, s.lactationReturnDays) : len;
        if (e.postpartumDays > end) {
            e.postpartumDays = 0; e.postpartum.lactating = false; e.cycleDay = 1 + Math.floor(Math.random() * 10);
            log(k, 'Recovered; cycle resumed');
        }
    } else if (e.egg.stage === 'none') {
        const L = s.cycleLength;
        for (let i = 0; i < days; i++) {
            if (e.cycleDay >= L) {
                const sb = H.activeSetback(k);
                if (sb && sb.used < sb.shift) { e.cycleDay += 1; sb.used += 1; }          // the heat/rut is late: the cycle keeps counting past its end
                else { e.cycleDay = 1; if (e.trying?.on) e.trying.cycles += 1; H.resolveSetback(k); }
            } else e.cycleDay += 1;
        }
    }
    H.tick(k);
}
export const advanceAll = days => { if (!(days > 0)) return; for (const k of trackedKeys()) advance(k, days); ageBabies(days); };

export function canConceive(k) {
    const e = ent(k);
    return !isCarrying(e) && (e.postpartumDays === 0 || (e.postpartum.lactating && e.postpartumDays > H.postpartumLength(k)));
}

function startTracking(k) {
    const e = ent(k);
    e.known = false; e.babyNames = []; e.postpartumDays = 0; e.postpartum.lactating = false;
    if (e.trying) { e.trying.on = false; e.trying.cycles = 0; }
}

export function conceive(k, force = false) {
    if (!canConceive(k)) return false;
    if (!force && Math.random() >= conceptionOdds(k)) return false;
    const e = ent(k), c = C(), s = S();
    startTracking(k);
    if (c.repro[k] === 'oviposition') {
        const lo = Math.min(s.clutchMin, s.clutchMax), hi = Math.max(s.clutchMin, s.clutchMax);
        e.egg = { stage: 'gravid', count: rnd(lo, hi), laid: 0, carryDays: 0, incubDays: 0, chill: 0 };
        e.conceptionDate = c.date.current;
        H.planEggs(k);
        log(k, `Eggs formed (${e.egg.count})`);
    } else {
        const roll = Math.random() * 100;
        e.fetusCount = roll < s.tripletsChance ? 3 : roll < s.tripletsChance + s.twinsChance ? 2 : 1;
        e.fetusSex = Array.from({ length: e.fetusCount }, () => (Math.random() < 0.5 ? 'M' : 'F'));
        e.pregnant = true; e.days = 0; e.conceptionDate = c.date.current;
        H.planPregnancy(k);
        log(k, `Conceived (${e.fetusCount})`);
    }
    return true;
}

// Manual start with a chosen conception date, number of babies and optional sexes / second parent.
export function startManualPregnancy(k, iso, count = 1, sexes = [], secondName = '') {
    const e = ent(k), c = C();
    if (isCarrying(e) || c.repro[k] === 'oviposition' || toDays(iso) === null) return false;
    startTracking(k);
    const n = Math.max(1, Math.min(4, Math.floor(count) || 1));
    e.fetusCount = n;
    e.fetusSex = Array.from({ length: n }, (_, i) => (sexes[i] === 'M' || sexes[i] === 'F' ? sexes[i] : Math.random() < 0.5 ? 'M' : 'F'));
    e.pregnant = true; e.conceptionDate = iso;
    const d = toDays(c.date.current) !== null ? diffDays(iso, c.date.current) : 0;
    e.days = Math.max(0, d ?? 0);
    if (secondName) e.second.name = secondName;
    H.planPregnancy(k);
    H.tick(k); updateKnown(k);
    log(k, `Pregnancy started manually (${n})`);
    return true;
}

function addChildren(k, items, via, method) {
    const fam = C().family, e = ent(k), ids = [];
    const other = H.secondParentName(k);
    items.forEach((it, i) => {
        const b = newBaby(fam, { sex: it.sex || (Math.random() < 0.5 ? 'M' : 'F'), parent: k, via, born: C().date.current, name: (it.name || e.babyNames[i] || '').trim().slice(0, 40), otherParent: other, method, condition: it.condition || '', conditionKnown: !!it.conditionKnown });
        if (S().inheritAppearance) {
            const l = H.inheritedLooks(k);
            if (l.eyes) b.appearance.push(`${l.eyes} eyes`);
            if (l.hair) b.appearance.push(`${l.hair} hair`);
        }
        fam.babies.push(b); ids.push(b.id);
    });
    return ids;
}

function finishBirth(k, method, lactating) {
    const e = ent(k);
    Object.assign(e, { pregnant: false, days: 0, conceptionDate: null, fetusCount: 1, fetusSex: [], known: false, postpartumDays: 1, babyNames: [], eggs: [] });
    e.egg = { stage: 'none', count: 0, laid: 0, carryDays: 0, incubDays: 0, chill: 0 };
    e.postpartum = { method, lactating };
    e.health = H.emptyHealth();
}

// Manually add a child (any birth date; age is derived from the chat date).
export function addManualChild({ name = '', sex = 'F', parent = 'user', otherParent = '', born = null, via = 'birth', method = 'natural' } = {}) {
    const fam = C().family, cur = C().date.current;
    const b = newBaby(fam, { name: String(name).trim().slice(0, 40), sex: sex === 'M' ? 'M' : 'F', parent, via: via === 'hatch' ? 'hatch' : 'birth', born: born || cur, otherParent: otherParent || H.secondParentName(parent), method });
    const age = b.born != null && cur != null ? diffDays(b.born, cur) : 0;
    b.age = Math.max(0, age ?? 0);
    if (S().inheritAppearance) {
        const l = H.inheritedLooks(parent);
        if (l.eyes) b.appearance.push(`${l.eyes} eyes`);
        if (l.hair) b.appearance.push(`${l.hair} hair`);
    }
    fam.babies.push(b);
    ageBabies(0);
    return b;
}

export function giveBirth(k, method) {
    const e = ent(k);
    if (!e.pregnant) return false;
    method = method || e.deliveryMethod || 'natural';
    const f = e.health.fetal, d = f ? D.FETAL_DISEASES.find(x => x.id === f.id) : null;
    const items = e.fetusSex.slice(0, e.fetusCount).map((sex, i) => ({ sex, condition: d && f.baby === i ? d.born : '', conditionKnown: !!(f && f.known) }));
    const ids = addChildren(k, items, 'birth', method);
    log(k, `Gave birth (${e.fetusCount}${method === 'csection' ? ', C-section' : ''})`);
    finishBirth(k, method, S().lactationDefault);
    if (S().birthDialog && hooks.onBirth) hooks.onBirth(ids, k);
    return ids;
}

export function loseOrEnd(k) {
    const e = ent(k);
    if (!isCarrying(e)) return false;
    log(k, e.pregnant ? 'Pregnancy ended' : 'Clutch lost');
    finishBirth(k, 'natural', false);
    return true;
}

export function layEggs(k, n = Infinity) {
    const e = ent(k), g = e.egg;
    if (g.stage !== 'gravid' && g.stage !== 'laying_due') return false;
    g.laid = Math.min(g.count, g.laid + n);
    e.known = true;
    if (g.laid >= g.count) {
        g.stage = 'incubating'; g.incubDays = 0;
        const ready = e.nest.state === 'ready';
        let lost = 0;
        for (const egg of e.eggs) {
            const def = D.SHELL_DEFECTS.find(x => x.id === egg.shell);
            if (def && egg.fate === 'hatch' && Math.random() < (ready ? def.failReady : Math.min(0.8, def.failReady + 0.35))) { egg.fate = 'fail'; lost++; }
        }
        log(k, `Laid ${g.count} eggs${ready ? '' : ' without a prepared nest'}`);
        if (!e.postpartum) e.postpartum = { method: 'laid', lactating: false };
        e.postpartum.method = 'laid';
    }
    return true;
}

export function hatchEggs(k) {
    const e = ent(k);
    if (e.egg.stage !== 'incubating' && e.egg.stage !== 'hatch_due') return false;
    const chill = S().nestRisk ? Math.min(0.5, (e.egg.chill || 0) * 0.04) : 0;
    const source = e.eggs.length ? e.eggs : Array.from({ length: e.egg.count }, () => ({ fate: 'hatch' }));
    const items = [];
    let failed = 0;
    for (const g of source) {
        if (g.fate !== 'hatch' || Math.random() < chill) { failed++; continue; }
        const emb = D.EMBRYO_DISEASES.find(x => x.id === g.embryo);
        items.push({ condition: emb?.born || '', conditionKnown: !!g.known });
    }
    const ids = addChildren(k, items, 'hatch', 'hatch');
    log(k, `${items.length} eggs hatched${failed ? `, ${failed} did not` : ''}`);
    finishBirth(k, 'laid', false);
    if (S().birthDialog && ids.length && hooks.onBirth) hooks.onBirth(ids, k);
    return ids.length ? ids : true;
}

// Move the story clock to a day (counter or ISO string); entities advance by the number of days passed when the move is forward.
export function setDate(day, source, doAdvance) {
    const c = C(), prev = toDays(c.date.current), z = toDays(day);
    if (z === null) return;
    c.date.current = z; c.date.source = source;
    if (c.date.cal === 'none') c.date.cal = 'iso';
    if (doAdvance && prev !== null) {
        const diff = z - prev;
        if (diff > 0 && diff <= S().maxAutoAdvance) advanceAll(diff);
    }
}
export function shiftDate(days, source = 'chat') {
    const c = C(), cur = toDays(c.date.current);
    if (cur !== null) setDate(cur + days, source, true);
    else advanceAll(days);
}

// Set the date from free text ("12 May", "4 May 1203", "Day 14", "3rd of Harvestmoon").
// Anything with a calendar meaning moves the clock; text that can't be read as a date is kept as it is and the clock stays
// where it was (time then moves from "N days later" in the story or from the +1 / +7 day buttons).
export function applyDateText(raw, source = 'manual', doAdvance = true) {
    const c = C(), d = c.date;
    const text = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!text) return { ok: false, parsed: false, changed: false };
    const prevDay = toDays(d.current), prevText = d.text;
    const r = parseStoryDate(text, { order: S().dateOrder, ref: prevDay });
    const t = extractTime(text);
    if (t) d.time = t;
    if (r.day !== null) {
        setDate(r.day, source, doAdvance);
        d.cal = r.kind === 'day' ? 'free' : 'iso'; d.yearless = r.kind === 'yearless';
        d.text = text; d.textDay = r.day;
        return { ok: true, parsed: true, kind: r.kind, changed: r.day !== prevDay || text !== prevText };
    }
    if (prevDay === null) d.current = FREE_BASE;
    d.cal = 'free'; d.yearless = false; d.source = source;
    const changed = text !== prevText;
    if (changed || d.textDay == null) { d.text = text; d.textDay = toDays(d.current); }   // an unchanged text keeps its "+N d" note
    return { ok: true, parsed: false, kind: 'text', changed };
}
// A date found in story text as a full calendar date (no manual text involved).
export function applyFoundDay(day, source = 'chat', yearless = false) {
    const c = C(), prev = toDays(c.date.current);
    setDate(day, source, true);
    c.date.cal = 'iso'; c.date.yearless = yearless;
    if (day !== prev) { c.date.text = ''; c.date.textDay = null; }
    return day !== prev;
}
export const validIso = s => toDays(s) !== null;

// ── Snapshots (swipe rollback) and undo checkpoint history ──
const STATE_KEYS = ['entities', 'date', 'family', 'looks'];
const snapState = () => JSON.stringify(Object.fromEntries(STATE_KEYS.map(key => [key, C()[key]])));
function applyState(json) { const st = JSON.parse(json), c = C(); for (const key of STATE_KEYS) if (st[key] !== undefined) c[key] = st[key]; }

export function takeSnap(idx) { C().snap = { idx, state: snapState() }; }
export function restoreSnap() { const c = C(); if (!c.snap) return false; applyState(c.snap.state); return true; }

function pushHistory(label, state, idx = null) {
    const c = C();
    c.history.push({ label: String(label).slice(0, 120), t: Date.now(), date: c.date.current, idx, state });
    while (c.history.length > S().historyLimit) c.history.shift();
}
export const checkpoint = label => pushHistory(label, snapState());
export const checkpointFromSnap = label => { const c = C(); if (c.snap) pushHistory(label, c.snap.state, c.snap.idx); };
export const dropHistoryFor = idx => { const c = C(); c.history = c.history.filter(h => h.idx !== idx); };
export function restoreCheckpoint(i) {
    const c = C(), h = c.history[i];
    if (!h) return false;
    applyState(h.state);
    c.history.splice(i);
    return true;
}
export { nameOf };
