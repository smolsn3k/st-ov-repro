// Constants, settings (global) and chat-bound data.
export const NAME = 'omegaverse_repro';
export const PROMPT_KEY = 'omegaverse_repro';
import { diffDays, toDays, pretty, prettyNoYear, FREE_BASE } from './dates.js';
export const ctx = () => SillyTavern.getContext();
export const hooks = { onBirth: null, onGrad: null };   // set by the UI (dialogs)

export const PHYS = {
    'm-omega': { label: 'Male omega', sex: 'male', role: 'omega' },
    'f-omega': { label: 'Female omega', sex: 'female', role: 'omega' },
    'm-alpha': { label: 'Male alpha', sex: 'male', role: 'alpha' },
    'f-alpha': { label: 'Female alpha', sex: 'female', role: 'alpha' },
};

// Reveal Mode: how a pregnancy / clutch can be discovered in the story's era.
export const ERAS = {
    modern: {
        label: 'Modern', confirmWeek: 4, obviousWeek: 14, sexWeek: 18, countWeek: 8, practitioner: 'doctor', test: { name: 'home pregnancy test', rel: 1 },
        methods: 'home tests, blood tests, ultrasound and doctors',
    },
    victorian: {
        label: 'Victorian / early industrial', confirmWeek: 10, obviousWeek: 18, sexWeek: 999, countWeek: 30, practitioner: 'physician or midwife', test: null,
        methods: 'a physician or midwife examining physical signs, missed heats/ruts and quickening; no lab tests or imaging; the baby\'s sex is unknowable before birth',
    },
    medieval: {
        label: 'Medieval', confirmWeek: 12, obviousWeek: 20, sexWeek: 999, countWeek: 32, practitioner: 'midwife', test: { name: 'folk test', rel: 0.55 },
        methods: 'midwives, healers and wise-women reading physical signs, folk tests and quickening; no tests or imaging; the baby\'s sex is unknowable before birth (only folk guesses)',
    },
    fantasy: {
        label: 'High fantasy', confirmWeek: 6, obviousWeek: 16, sexWeek: 12, countWeek: 8, practitioner: 'healer', test: { name: 'alchemical test', rel: 0.85 },
        methods: 'healers, alchemists, herbalists, divination charms and potions; magic may reveal things, but only in ways that fit the setting',
    },
    scifi: {
        label: 'Sci-fi', confirmWeek: 2, obviousWeek: 12, sexWeek: 8, countWeek: 4, practitioner: 'medical officer', test: { name: 'bio-scan', rel: 1 },
        methods: 'bio-scanners, medical nanites, genetic panels and onboard medical systems',
    },
    custom: {
        label: 'Custom', confirmWeek: 4, obviousWeek: 16, sexWeek: 18, countWeek: 10, practitioner: 'healer', test: { name: 'test', rel: 0.9 }, methods: '',
    },
};

export const CONTRA = {
    none: { label: 'None', prot: 0 },
    condom: { label: 'Condom / barrier', prot: 85 },
    pill: { label: 'Hormonal (pills, patch, injection)', prot: 95 },
    iud: { label: 'IUD / implant', prot: 98 },
    sterile: { label: 'Sterilized / infertile', prot: 100 },
};
// Protection percentage per method: editable in settings (none is always 0, sterile always 100).
export const contraProtection = id => {
    if (id === 'none' || !CONTRA[id]) return 0;
    if (id === 'sterile') return 100;
    const v = Number(S().protection?.[id]);
    return Math.max(0, Math.min(100, Number.isFinite(v) ? v : CONTRA[id].prot));
};
export const contraMult = id => 1 - contraProtection(id) / 100;
export const contraLabel = id => (id === 'none' || !CONTRA[id] ? CONTRA.none.label : S().fertilityMode === 'simple' ? CONTRA[id].label : `${CONTRA[id].label} (${contraProtection(id)}%)`);

export const DEFAULTS = {
    enabled: true,
    notifications: true,
    track: 'user',             // user | char | both
    schema: 2,
    detectMode: 'both',        // tags | analyzer | both : how events, dates and mood are read from the chat
    apiProfile: '',            // '' = main API, otherwise Connection Manager profile id
    autoAnalyze: true,
    trackFeelings: true,       // read mood, physical state and libido from the chat
    feelInterval: 6,           // analyzer: check feelings every N messages when the smart filter would skip them (in Both: only when the reply has no status tag)
    feelDays: 2,               // story days an observed mood/physical state stays valid
    smartFilter: true,         // only call the analyzer when the text looks relevant
    analyzeDepth: 3,           // messages sent to the analyzer
    dateScanDepth: 10,         // messages scanned for a date tag or date
    dateOrder: 'DMY',
    injectDepth: 1,
    cycleLength: 30,           // days from one heat/rut start to the next
    heatDuration: 5,
    // Fertility: % chance of conceiving per qualifying event with NO protection, for each stage of the cycle.
    // Conception = fertility lowered by the contraception's protection (see `protection`). Suppressed and late heats use their own values.
    stageChance: { heat_early: 90, heat_peak: 99, heat_late: 90, post: 5, calm: 1, pre: 4, delayed: 2, suppressed: 2 },   // omega: heat stages
    stageChanceRut: { rut_early: 10, rut_peak: 15, rut_late: 10, post: 1, calm: 1, pre: 2, delayed: 1, suppressed: 1 },     // alpha: rut stages (only matters if an alpha carries)
    fertilityMode: 'detailed', // detailed = percentages everywhere; simple = words (high chance in heat, low outside)
    termWeeks: 40,
    twinsChance: 3,            // %
    tripletsChance: 0.3,       // %
    clutchMin: 2,
    clutchMax: 5,
    eggCarryDays: 14,
    eggIncubationDays: 21,
    recoveryDays: 42,
    maxAutoAdvance: 3650,
    babyMaxAgeDays: 730,       // children older than this move to the "older children" list
    // Pregnancy and health
    complicationsEnabled: true, complicationChance: 100,   // chance multiplier, %
    fetalDiseasesEnabled: true, fetalDiseaseChance: 4,     // % per pregnancy
    doctorCooldown: 3,         // story days between visits
    protection: { condom: 85, pill: 95, iud: 98 },   // % protection per contraception method
    popupOpacity: 95,          // % opacity of the wand popup background
    infoblockOpacity: 100,     // % of the theme's own background tint for the chat infoblock
    accentSource: 'quote',     // quote | em | body | custom : which theme color drives the accent
    accentColor: '#9b87f5',    // used when accentSource is custom
    tryingMode: true,          // enables the "trying for a baby" control
    disruptionsEnabled: true,  // stress, illness etc. delay the next heat/rut
    inheritAppearance: true,
    autoPickNames: true,       // take unborn-baby names from the chat
    birthDialog: true, graduationDialog: true,
    // Oviposition
    eggComplicationsEnabled: true,
    embryoDiseasesEnabled: true, embryoChance: 6,          // % per egg
    shellDefectsEnabled: true, shellChance: 8,             // % per egg
    nestRisk: false,           // a disturbed nest while incubating can cost eggs
    // Postpartum
    lactationDefault: true, lactationReturnDays: 180,
    // Infoblock and history
    infoblock: true, infoblockShowHidden: false, infoblockCss: '',
    infoblockPosition: 'bottom',   // top | bottom of the message
    infoblockDetails: true,        // detailed pregnancy / clutch / postpartum status
    infoblockBabies: true,         // baby status once children are born
    historyLimit: 25,
};

export const newEntity = () => ({
    cycleDay: 1 + Math.floor(Math.random() * Math.max(1, S().cycleLength || 30)),   // random start day for every new character
    feel: { mood: '', physical: '', libido: '', stamp: null },                       // mood / physical / libido picked up from the story
    pregnant: false, days: 0, conceptionDate: null, fetusCount: 1, fetusSex: [],
    egg: { stage: 'none', count: 0, laid: 0, carryDays: 0, incubDays: 0 },
    known: false,
    postpartumDays: 0,
    postpartum: { method: 'natural', lactating: false },
    deliveryMethod: 'natural',
    babyNames: [],
    second: { name: '', look: '', fertility: 100 },                 // second parent (blank name = the other tracked character); look = one free-text appearance line
    trying: { on: false, cycles: 0 },
    disruption: null,                                // last disruption { kind, shift, date }
    setback: null,                                   // heat/rut pushed back: { kind, kinds, shift, used, date, known, resolved, resolvedDate }
    nest: { state: 'none' },
    eggs: [],                                        // per-egg { shell, embryo, fate, known }
    health: { complications: [], fetal: null, eggPlanned: [], visit: { date: null, note: '' }, test: { result: null, date: null }, confirm: { count: false, sex: false } },
    log: [],
});

export const CHAT_DEFAULTS = () => ({
    physiology: { user: 'm-omega', char: 'm-alpha' },
    fertility: { user: 100, char: 100 },              // personal fertility %: 100 is normal, lower means fertility problems; the partner's counts too
    repro: { user: 'live', char: 'live' },          // live | oviposition
    contraception: { user: 'none', char: 'none' },   // none | condom | pill | iud | sterile : prevents conception
    suppressants: { user: false, char: false },       // heat/rut suppressants: stop the heat/rut itself (separate from contraception)
    reveal: { era: 'modern', custom: '', practitioner: '' },
    // current = day counter (integer). text = the date exactly as written; textDay = counter when that text was set.
    // cal: none (no date yet) | iso (real calendar, counter follows the date) | free (custom text, counter moves by days only)
    date: { current: null, text: '', textDay: null, cal: 'none', yearless: false, time: null, source: 'none', manual: false, manualValue: null, manualText: '', manualTime: null },
    proc: null,                                    // { idx, conc } last processed message and which conception checks were already rolled for it
    family: { babies: [], grown: [], nextId: 1 },
    looks: { user: { text: '' }, char: { text: '' } },   // one free-text appearance line per character, used for inheritance
    history: [],
    entities: { user: newEntity(), char: newEntity() },
    snap: null,
});

function fill(target, defaults) {
    for (const k of Object.keys(defaults)) {
        if (target[k] === undefined) target[k] = structuredClone(defaults[k]);
        else if (defaults[k] && typeof defaults[k] === 'object' && !Array.isArray(defaults[k])) fill(target[k], defaults[k]);
    }
}

export function S() {
    const es = ctx().extensionSettings;
    if (!es[NAME]) es[NAME] = {};
    const legacy = es[NAME].schema === undefined && Object.keys(es[NAME]).length > 0;
    const st = es[NAME].stageChance;      // the first stage defaults (30/40/30...) were far too low for an omegaverse heat: replace them if never edited
    if (st && ['heat_early:30', 'heat_peak:40', 'heat_late:30', 'post:3', 'calm:2', 'pre:4', 'delayed:2', 'suppressed:2'].every(p => st[p.split(':')[0]] === Number(p.split(':')[1]))) es[NAME].stageChance = { ...DEFAULTS.stageChance };
    if (es[NAME].stageChance === undefined) {       // earlier versions had one chance for the heat/rut and one for outside it
        const H = Number.isFinite(es[NAME].conceptionHeat) ? es[NAME].conceptionHeat : Number.isFinite(es[NAME].conceptionChance) ? es[NAME].conceptionChance : null;
        const O = Number.isFinite(es[NAME].conceptionOutside) ? es[NAME].conceptionOutside : null;
        if (H !== null || O !== null) {
            const h = H ?? 40, o = O ?? 2, r = x => Math.round(x * 2) / 2;
            es[NAME].stageChance = { heat_early: r(h * 0.75), heat_peak: h, heat_late: r(h * 0.75), post: r(o * 1.5), calm: o, pre: r(o * 2), delayed: o, suppressed: o };
        }
    }
    fill(es[NAME], DEFAULTS);
    if (legacy) {   // v1.0 saved settings: analyzer mood check was every 2 messages; the new default is lower-frequency
        if (es[NAME].feelInterval === 2) es[NAME].feelInterval = 6;
        if (es[NAME].dateScanDepth === 8) es[NAME].dateScanDepth = 10;
        ctx().saveSettingsDebounced?.();
    }
    return es[NAME];
}
export const saveS = () => ctx().saveSettingsDebounced();

export function newBaby(fam, props) {
    return { id: fam.nextId++, name: '', sex: 'F', parent: 'user', via: 'birth', born: null, age: 0, health: 'normal', mood: '', sleep: '', feeding: '',
        teething: false, colicky: false, milestones: [], personality: [], appearance: [], lastFedH: null, lastChangedH: null,
        otherParent: '', condition: '', conditionKnown: false, method: 'natural', gradAsked: false, ...props };
}

// v1.0.0 stored children per parent; they now live in the shared family list.
function migrate(d) {
    for (const k of ['user', 'char']) {          // suppressants used to be one of the contraception choices
        if (d.contraception?.[k] === 'suppressant') { d.contraception[k] = 'none'; (d.suppressants ||= {})[k] = true; }
    }
    const dt = d.date;
    if (typeof dt.current === 'string') {      // v1.0 stored ISO strings; the story day is now a counter
        const z = toDays(dt.current);
        dt.current = z; dt.cal = z === null ? 'none' : 'iso'; dt.text = ''; dt.textDay = null;
    }
    if (typeof dt.manualValue === 'string') dt.manualValue = toDays(dt.manualValue);
    for (const k of ['user', 'char']) {
        const l = d.looks?.[k];
        if (l && !l.text && (l.eyes || l.hair)) l.text = [l.eyes && `${l.eyes} eyes`, l.hair && `${l.hair} hair`].filter(Boolean).join(', ');
        const sec = d.entities?.[k]?.second;
        if (sec && !sec.look && (sec.eyes || sec.hair)) sec.look = [sec.eyes && `${sec.eyes} eyes`, sec.hair && `${sec.hair} hair`].filter(Boolean).join(', ');
    }
    for (const k of ['user', 'char']) {
        const kids = d.entities?.[k]?.children;
        if (!Array.isArray(kids)) continue;
        for (const ch of kids) {
            const age = ch.born && d.date.current ? Math.max(0, diffDays(ch.born, d.date.current) ?? 0) : 0;
            d.family.babies.push(newBaby(d.family, { sex: ch.sex || 'F', parent: k, via: ch.via || 'birth', born: ch.born || null, name: ch.name || '', age }));
        }
        delete d.entities[k].children;
    }
}

let transient = null;
export function C() {
    const m = ctx().chatMetadata;
    if (!m) { transient = transient || CHAT_DEFAULTS(); return transient; }
    if (!m[NAME]) m[NAME] = CHAT_DEFAULTS();
    fill(m[NAME], CHAT_DEFAULTS());
    migrate(m[NAME]);
    return m[NAME];
}
export function saveC() {
    const c = ctx();
    (c.saveMetadataDebounced || c.saveMetadata)?.call(c);
}

export const trackedKeys = () => (S().track === 'both' ? ['user', 'char'] : [S().track === 'char' ? 'char' : 'user']);
export const nameOf = k => (k === 'user' ? ctx().name1 || 'User' : ctx().name2 || 'Character');

// ── Showing story dates ──
// Calendar dates show as "12 May 2026" (or "12 May" when the story has no year). With a free-text calendar there is nothing to
// compute a calendar date from, so other dates (due date, conception, last visit) are shown relative to now.
export function showDate(v) {
    const z = toDays(v);
    if (z === null) return 'unknown';
    const d = C().date, cur = toDays(d.current);
    if (d.cal === 'free' && cur !== null) {
        const n = z - cur;
        return n === 0 ? 'today' : n > 0 ? `in ${n} day${n === 1 ? '' : 's'}` : `${-n} day${n === -1 ? '' : 's'} ago`;
    }
    return d.yearless ? prettyNoYear(z) : pretty(z);
}
// The current story date as the reader sees it: the text as written while it is still accurate, otherwise derived from the counter.
// plain=true leaves out the "(+N d)" note a free-text date gets when time has moved since the text was written.
export function dateLabel(plain = false) {
    const d = C().date, z = toDays(d.current);
    if (z === null) return '';
    if (d.cal === 'free') {
        if (!d.text) return `Day ${z - FREE_BASE}`;
        const n = z - (toDays(d.textDay) ?? z);
        return plain || n <= 0 ? d.text : `${d.text} (+${n} d)`;
    }
    return d.text && toDays(d.textDay) === z ? d.text : (d.yearless ? prettyNoYear(z) : pretty(z));
}
export const hasDate = () => toDays(C().date.current) !== null;

// Stages of the cycle that have their own fertility percentage, in cycle order.
export const STAGES = [
    ['heat_early', 'Heat: start'], ['heat_peak', 'Heat: peak'], ['heat_late', 'Heat: end'],
    ['post', 'Post-heat'], ['calm', 'Between heats'], ['pre', 'Pre-heat'],
    ['delayed', 'Late heat (overdue)'], ['suppressed', 'Suppressed heat'],
];
// A word for a fertility percentage, so the label can never disagree with the number.
export const fertilityWord = pct => (pct <= 0 ? 'None' : pct >= 35 ? 'Peak' : pct >= 15 ? 'High' : pct >= 5 ? 'Moderate' : pct >= 1.5 ? 'Low' : 'Very low');

export const RUT_STAGES = [
    ['rut_early', 'Rut: start'], ['rut_peak', 'Rut: peak'], ['rut_late', 'Rut: end'],
    ['post', 'Post-rut'], ['calm', 'Between ruts'], ['pre', 'Pre-rut'],
    ['delayed', 'Late rut (overdue)'], ['suppressed', 'Suppressed rut'],
];
// Simplified mode: one level for "in heat/rut" and one for "outside", each stored as a percentage in the stage tables.
export const LEVELS = [['very_high', 'Very high', 99], ['high', 'High', 85], ['moderate', 'Moderate', 50], ['low', 'Low', 15], ['very_low', 'Very low', 3], ['none', 'None', 0]];
export const nearestLevel = pct => LEVELS.reduce((best, l) => (Math.abs(l[2] - pct) < Math.abs(best[2] - pct) ? l : best), LEVELS[0])[0];
export const chanceWord = pct => (pct <= 0 ? 'None' : pct < 3 ? 'Very low' : pct < 12 ? 'Low' : pct < 35 ? 'Moderate' : pct < 70 ? 'High' : 'Very high');
