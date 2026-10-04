// Constants, settings (global) and chat-bound data.
export const NAME = 'omegaverse_repro';
export const PROMPT_KEY = 'omegaverse_repro';
import { diffDays } from './dates.js';
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
    none: { label: 'None', mult: 1 },
    condom: { label: 'Condom / barrier', mult: 0.15 },
    pill: { label: 'Hormonal contraceptive', mult: 0.05 },
    iud: { label: 'IUD / implant', mult: 0.02 },
    suppressant: { label: 'Heat/rut suppressants', mult: 0.3 },
    sterile: { label: 'Sterilized / infertile', mult: 0 },
};

export const DEFAULTS = {
    enabled: true,
    notifications: true,
    track: 'user',             // user | char | both
    apiProfile: '',            // '' = main API, otherwise Connection Manager profile id
    autoAnalyze: true,
    smartFilter: true,         // only call the analyzer when the text looks relevant
    analyzeDepth: 3,           // messages sent to the analyzer
    dateScanDepth: 8,          // messages scanned for a date
    dateOrder: 'DMY',
    injectDepth: 1,
    cycleLength: 30,           // days from one heat/rut start to the next
    heatDuration: 5,
    conceptionChance: 40,      // % at peak fertility with no protection
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
    cycleDay: 12,
    pregnant: false, days: 0, conceptionDate: null, fetusCount: 1, fetusSex: [],
    egg: { stage: 'none', count: 0, laid: 0, carryDays: 0, incubDays: 0 },
    known: false,
    postpartumDays: 0,
    postpartum: { method: 'natural', lactating: false },
    deliveryMethod: 'natural',
    babyNames: [],
    second: { name: '', look: '' },                 // second parent (blank name = the other tracked character); look = one free-text appearance line
    trying: { on: false, cycles: 0 },
    disruption: null,                                // { kind, shift, date }
    nest: { state: 'none' },
    eggs: [],                                        // per-egg { shell, embryo, fate, known }
    health: { complications: [], fetal: null, eggPlanned: [], visit: { date: null, note: '' }, test: { result: null, date: null }, confirm: { count: false, sex: false } },
    log: [],
});

export const CHAT_DEFAULTS = () => ({
    physiology: { user: 'm-omega', char: 'm-alpha' },
    repro: { user: 'live', char: 'live' },          // live | oviposition
    contraception: { user: 'none', char: 'none' },
    reveal: { era: 'modern', custom: '', practitioner: '' },
    date: { current: null, time: null, source: 'none', manual: false, manualValue: null, manualTime: null },
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
    fill(es[NAME], DEFAULTS);
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
