// Date detection from the active chat + optional LLM event analysis through a chosen API profile.
import { ctx, S, C, trackedKeys, nameOf, CONTRA, contraLabel, hooks, dateLabel, showDate } from '../core/core.js';
import { extractDate, extractTime, extractYearless, placeYearless, parseStoryDate, toDays, addDays } from '../core/dates.js';
import { labelOf, nowHours as nowHoursSafe } from './baby.js';
import * as E from './engine.js';
import * as H from './health.js';
import { DISRUPTIONS, NEST } from '../core/data.js';

const clean = t => String(t || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<!--[\s\S]*?-->/g, m => (/\[(?:RP_)?DATE/i.test(m) ? m : '')).trim();

// Newest date in the last few messages. A [RP_DATE:...] tag wins and may be any text (the model writes the story's own calendar);
// story text only counts when it contains a full calendar date, or, once the chat uses a year-less calendar, "12 May"-style dates.
const DATE_TAG = /\[(?:RP_)?DATE:\s*([^\]]+?)\s*\]/i;
// onlyIdx: look at that one message only (used while processing a new message, so an older date is never re-applied over a newer clock)
function scanRecent(fn, onlyIdx = null) {
    const chat = ctx().chat || [], depth = S().dateScanDepth;
    for (let i = onlyIdx ?? chat.length - 1, n = 0; i >= 0 && n < (onlyIdx === null ? depth : 1); i--, n++) {
        if (chat[i]?.is_system) continue;
        const hit = fn(String(chat[i]?.mes || '').replace(/<think>[\s\S]*?<\/think>/gi, ''), i);
        if (hit) return hit;
    }
    return null;
}
export function scanDate(onlyIdx = null) {
    const c = C(), order = S().dateOrder, ref = toDays(c.date.current);
    return scanRecent((raw, idx) => {
        const tag = DATE_TAG.exec(raw);
        if (tag && tag[1].length <= 48) return { tag: true, text: tag[1], idx };   // longer text is the model echoing the instruction, not a date
        const full = extractDate(raw, order);
        if (full) return { tag: false, day: toDays(full), yearless: false, idx };
        if (c.date.yearless) {
            const yl = extractYearless(raw, order, true);
            if (yl) { const day = placeYearless(yl.m, yl.d, ref); if (day !== null) return { tag: false, day, yearless: true, idx }; }
        }
        return null;
    }, onlyIdx);
}
export function detectChatDate() { const h = scanDate(); return h ? (h.tag ? h.text : dateLabelFor(h.day)) : null; }
const dateLabelFor = day => showDate(day);

export function detectChatTime(onlyIdx = null) {
    return scanRecent(raw => { const tag = DATE_TAG.exec(raw); return extractTime(tag ? tag[1] : raw); }, onlyIdx);
}

// Apply the newest date found in the chat (tag text, or a date in the story text), honoring the manual lock.
// onlyIdx: read just that message (a message being processed); omit it to scan the last few messages (chat load, deleted message).
// Returns { found, changed, idx }: found = the clock was set from a real calendar date or the day counter, idx = the message it came from.
export function refreshDate(onlyIdx = null) {
    const c = C();
    if (c.date.manual) { c.date.source = 'manual'; return { found: false, changed: false, idx: null }; }
    const t = detectChatTime(onlyIdx);
    if (t) c.date.time = t;
    const hit = scanDate(onlyIdx);
    if (!hit) return { found: false, changed: false, idx: null };
    const before = `${c.date.current}|${c.date.text}|${c.date.cal}`;
    let parsed;
    if (hit.tag) parsed = E.applyDateText(hit.text, 'chat', true).parsed;
    else { E.applyFoundDay(hit.day, 'chat', hit.yearless); parsed = true; }
    c.date.source = 'chat';
    return { found: parsed, changed: `${c.date.current}|${c.date.text}|${c.date.cal}` !== before, idx: hit.idx };
}

const BABY_TRIGGER = /baby|babies|infant|newborn|toddler|child|\bfe(?:d|ed|eding)\b|nurs|bottle|diaper|nappy|crib|cradle|\bcr(?:y|ies|ied)\b|colic|teeth|tooth|sleep|\bnap\b|lullaby|milk|first (?:step|word|smile)|fever|sick|named?\b/i;
const TRIGGER = /\bchild|children|\bson\b|daughter|\bkids?\b|condom|protection|contracept|\bpill|nam(?:e|ed|ing)\b|call(?:ed|ing)? (?:him|her|them|it)|trying|nest|c-?section|cesarean|surgery|stress|exhaust|\bill|travel|journey|eyes|hair|father|knot|\btie[sd]?\b|inside|fill(?:ed|s|ing)?|\bcum|came\b|seed|breed|bond|bite|birth|labou?r|deliver|born|\begg|\blay|laid|clutch|hatch|nest|test|pregnan|expect|ultrasound|midwife|healer|doctor|heat|rut\b|scanner/i;

// Narrower trigger for Both mode: tags already cover dates, mood and the common events for free, so the analyzer
// only needs to wake up for things tags don't carry (children and names, visits, trying, nests...) or as a backup for a missed event tag.
const EVENT_TRIGGER = /\bchild|children|\bson\b|daughter|\bkids?\b|condom|protection|contracept|\bpill|nam(?:e|ed|ing)\b|trying|\bnest|c-?section|cesarean|surgery|\bknot|\btie[sd]?\b|\bcum|came\b|seed|breed|birth|labou?r|deliver|born|\begg|laid|clutch|hatch|pregnan|expect|ultrasound|midwife|healer|doctor|scanner/i;

export function profiles() {
    const p = ctx().extensionSettings?.connectionManager?.profiles;
    return Array.isArray(p) ? p.map(x => ({ id: x.id, name: x.name })) : [];
}

function buildMessages(idx) {
    const x = ctx(), chat = x.chat || [], s = S(), c = C();
    const tracked = trackedKeys();
    const recent = [];
    for (let i = Math.min(idx, chat.length - 1); i >= 0 && recent.length < s.analyzeDepth; i--) {
        if (chat[i]?.is_system) continue;
        recent.unshift(`${chat[i].is_user ? nameOf('user') : (chat[i].name || nameOf('char'))}: ${clean(chat[i].mes).slice(0, 1800)}`);
    }
    const fam = c.family.babies;
    const babyBlock = fam.length ? [
        `Children now (labels are identifiers): ${fam.map(b => `${labelOf(b)} (${b.sex === 'M' ? 'boy' : 'girl'}, ${b.age} days old)`).join('; ')}.`,
        ' "baby_updates": [ {"label": "<label above>", "name": "string or null (only if the story gives the child a name)", "mood": "1-3 words or null", "sleep": "asleep|awake|drowsy|napping|null", "feeding": "breast|formula|mixed|solids|null", "fed": bool (was fed in the newest message), "diaper_changed": bool, "health": "normal|fever|cold|sick|injured|recovering|null", "personality": ["short trait"], "appearance": ["short trait"]} ]  // only children actually mentioned in the newest message; use null/false/[] when not stated',
    ] : [];
    const system = 'You are a precise story-state extractor for a fictional roleplay between adult characters. You only classify what the text literally states. Reply with a single JSON object and nothing else.';
    const user = [
        `Characters: "user" = ${nameOf('user')}, "char" = ${nameOf('char')}. Tracked: ${tracked.join(', ')}.`,
        `Known story date so far: ${dateLabel(true) || 'unknown'}.`,
        'Read the NEWEST message in the excerpt (earlier ones are context). Return JSON with exactly these keys:',
        '{"date": "the story\'s current date exactly as the story writes it (any calendar, with or without a year, for example 12 May or 3rd of Harvestmoon), or null if the story does not state one",',
        ' "elapsed_days": integer number of in-story days that passed in the newest message (0 if none),',
        ' "internal_release": {"user": bool, "char": bool}  // true if that character was the one receiving an internal release / knotting that could cause conception in the newest message,',
        ' "birth": {"user": bool, "char": bool}  // that character actually gave birth in the newest message,',
        ' "laid_eggs": {"user": bool, "char": bool}  // that character actually laid eggs,',
        ' "hatched": {"user": bool, "char": bool}  // eggs actually hatched,',
        ' "discovered": {"user": bool, "char": bool},  // it is revealed in the story that this character is pregnant or carrying eggs',
        ' "birth_method": {"user": "natural|csection|null", "char": "natural|csection|null"},  // only if a birth happened',
        ' "visit": {"user": bool, "char": bool},  // a doctor/midwife/healer actually examined this character',
        ' "test": {"user": bool, "char": bool},  // this character actually took a pregnancy test',
        ' "baby_names": {"user": ["name"], "char": ["name"]},  // names the story gives to this character\'s unborn baby/babies (empty list if none)',
        ' "second_parent": {"user": "name or null", "char": "name or null"},  // the other parent of this character\'s pregnancy/clutch if named',
        ' "trying": {"user": true|false|null, "char": true|false|null},  // true if the story says they have begun actively trying for a baby, false if they stopped',
        ' "disruption": {"user": "stress|illness|starvation|travel|overwork|null", "char": "..."},  // a clear event that would disturb the heat/rut cycle',
        ' "nest": {"user": "none|building|ready|disturbed|null", "char": "..."},  // state of this character\'s nest, if the story shows it',
        ' "looks": {"user": "short appearance line like \'brown eyes, black hair\' if the newest message states it, else null", "char": "..."},',
        ' "mood": {"user": "1-3 words for their emotional state in the newest message, or null", "char": "..."},',
        ' "physical": {"user": "short phrase for their physical state (tired, aching, flushed, ill, energetic...) or null", "char": "..."},',
        ' "libido": {"user": "very low|low|normal|high|very high|null", "char": "..."},  // sexual desire shown or implied right now; sadness, grief, fear, anger, illness or exhaustion usually mean low; arousal means high',
        ' "contraception": {"user": "none|condom|pill|iud|suppressant|sterile|null", "char": "..."},  // the method that applies to conception for THIS character (their own method, or their partner\'s such as a condom); \'none\' only if the story says no protection is used; null if not mentioned',
        ' "children": [ {"owner": "user|char", "name": "string", "sex": "M|F|null", "age_days": integer or null (newborn 0, 1 year 365, 3 years 1095), "other_parent": "name or null", "born_now": bool} ],  // every child of user/char that is born in the newest message OR is mentioned as already existing; owner = the parent who bore or hatched the child (the mother/carrier if unclear); [] if none',
        ...babyBlock,
        '}',
        'Use false when unsure. Plans, hypotheticals, memories and fantasies are false. Return valid JSON.',
        '', '--- EXCERPT ---', recent.join('\n\n'),
    ].join('\n');
    return { system, user };
}

function parse(txt) {
    if (!txt) return null;
    const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try { return JSON.parse(txt.slice(a, b + 1)); } catch { return null; }
}

async function call(system, user) {
    const x = ctx(), s = S();
    if (s.apiProfile) {
        const svc = x.ConnectionManagerRequestService;
        if (!svc?.sendRequest) throw new Error('Connection Manager is unavailable');
        const res = await svc.sendRequest(s.apiProfile, [{ role: 'system', content: system }, { role: 'user', content: user }], 500, { stream: false, extractData: true, includePreset: true, includeInstruct: true }, {});
        return typeof res === 'string' ? res : res?.content;
    }
    return await x.generateRaw({ prompt: user, systemPrompt: system, responseLength: 500 });
}

// Decide whether this message is worth an analyzer call (every call is an API request).
//   Tags       never (events come from tags); only the "Analyze now" button runs it
//   Analyzer   keyword matches plus a mood check every feelInterval messages (the original behavior)
//   Both       tags already give date, mood and the common events for free, so keyword matches use a narrower list and the
//              mood check only fills in when this reply carried no status tag
export function shouldAnalyze(idx, { tags = null } = {}) {
    const s = S(), msg = (ctx().chat || [])[idx];
    if (!s.autoAnalyze || !msg || s.detectMode === 'tags') return false;
    if (!s.smartFilter) return true;
    const txt = clean(msg.mes), babies = C().family.babies.length && BABY_TRIGGER.test(txt);
    const every = Math.max(1, Number(s.feelInterval) || 1);
    if (s.detectMode === 'both') {
        const statusMissing = !msg.is_user && s.trackFeelings && !(tags && tags.status);
        return (statusMissing && idx % every === 0) || EVENT_TRIGGER.test(txt) || !!babies;
    }
    const feelTurn = s.trackFeelings && idx % every === 0;
    return feelTurn || TRIGGER.test(txt) || !!babies;
}

export async function analyze(idx, { force = false, tags = null } = {}) {
    if (!force && !shouldAnalyze(idx, { tags })) return null;
    const s = S();
    const { system, user } = buildMessages(idx);
    try { return parse(await call(system, user)); }
    catch (e) {
        console.warn('[omegaverse] analysis failed', e);
        if (s.notifications) toastr.warning(`Reproduction analysis failed: ${e.message || e}`, 'Omegaverse');
        return null;
    }
}

// Apply analyzer output. Returns a list of human-readable events.
// opts.timeHandled: a tag or the story text already settled the date this turn, so the analyzer must not move the clock again
// opts.skipDate: leave the date alone entirely (Analyze now on a message that was already processed)
// opts.skipConception / opts.rolled: conception checks already rolled for this message (tag, earlier run) are not rolled twice
// opts.justBorn: children created earlier in this same turn (by tags), so names from the analyzer land on them
export function applyResult(r, opts = {}) {
    const events = [], c = C(), s = S();
    if (!r) return events;
    const b = (o, k) => o && o[k] === true;
    if (!c.date.manual && !opts.skipDate && !opts.timeHandled) {
        let parsed = false;
        if (typeof r.date === 'string' && r.date.trim() && r.date.trim().toLowerCase() !== 'null') {
            const before = dateLabel(true), res = E.applyDateText(r.date, 'analysis', true);
            parsed = !!res.parsed;
            if (res.changed && dateLabel(true) !== before) events.push(`Date set to ${dateLabel(true)}`);
        }
        if (!parsed && Number.isInteger(r.elapsed_days) && r.elapsed_days > 0 && r.elapsed_days <= s.maxAutoAdvance) {
            E.shiftDate(r.elapsed_days, 'analysis'); events.push(`+${r.elapsed_days} day(s)`);
        }
    }
    applyBabyUpdates(r.baby_updates, events);
    for (const k of ['user', 'char']) applyLooks(k, r.looks?.[k]);
    const keepBirthDialog = hooks.onBirth, pending = [], justBorn = opts.justBorn || { user: [], char: [] };
    hooks.onBirth = (ids, k2) => { pending.push([ids, k2]); };     // show the birth dialog after names from the story are applied
    try {
    for (const k of trackedKeys()) {
        const e = c.entities[k], n = nameOf(k);
        if (typeof r.contraception?.[k] === 'string' && CONTRA[r.contraception[k]] && c.contraception[k] !== r.contraception[k]) {
            c.contraception[k] = r.contraception[k]; events.push(`${n}: protection ${contraLabel(r.contraception[k])}`);
        }
        if (s.trackFeelings && H.setFeel(k, { mood: r.mood?.[k], physical: r.physical?.[k], libido: r.libido?.[k] })) events.push(`${n}: ${[e.feel.mood, e.feel.physical].filter(Boolean).join(', ')}`);
        if (s.tryingMode && typeof r.trying?.[k] === 'boolean' && E.canConceive(k) && e.trying.on !== r.trying[k]) {
            e.trying.on = r.trying[k]; if (!e.trying.on) e.trying.cycles = 0; events.push(`${n} ${e.trying.on ? 'started' : 'stopped'} trying for a baby`);
        }
        if (typeof r.disruption?.[k] === 'string' && DISRUPTIONS[r.disruption[k]] && H.disrupt(k, r.disruption[k])) events.push(`${n}: cycle disrupted (${DISRUPTIONS[r.disruption[k]].label})`);
        if (typeof r.nest?.[k] === 'string' && NEST[r.nest[k]] && e.nest.state !== r.nest[k]) { e.nest.state = r.nest[k]; events.push(`${n}: nest ${r.nest[k]}`); }
        if (typeof r.second_parent?.[k] === 'string' && r.second_parent[k].trim() && !e.second.name && E.isCarrying(e)) { e.second.name = r.second_parent[k].trim().slice(0, 40); events.push(`${n}: other parent is ${e.second.name}`); }
        if (s.autoPickNames && E.isCarrying(e) && Array.isArray(r.baby_names?.[k])) {
            r.baby_names[k].slice(0, 4).forEach((nm, i) => { if (typeof nm === 'string' && nm.trim() && !e.babyNames[i]) { e.babyNames[i] = nm.trim().slice(0, 40); events.push(`Baby ${i + 1} of ${n} named ${e.babyNames[i]}`); } });
        }
        if (b(r.test, k)) { const t = H.takeTest(k); if (t.ok) events.push(`${n}: ${t.msg}`); }
        if (b(r.visit, k) && E.isCarrying(e)) { const v = H.visit(k, { force: true }); if (v.ok) events.push(`${n}: ${v.msg}`); }
        if (b(r.internal_release, k) && E.canConceive(k) && !opts.skipConception?.[k]) {
            const odds = E.conceptionOdds(k);
            if (opts.rolled) opts.rolled[k] = true;
            if (E.conceive(k)) events.push(`${n} conceived (${Math.round(odds * 100)}% odds)`);
        }
        if (b(r.birth, k)) { const m = r.birth_method?.[k] === 'csection' ? 'csection' : (r.birth_method?.[k] === 'natural' ? 'natural' : undefined); const ids = E.giveBirth(k, m); if (ids) { justBorn[k] = [...justBorn[k], ...(Array.isArray(ids) ? ids : [])]; events.push(`${n} gave birth${m === 'csection' ? ' (C-section)' : ''}`); } }
        if (b(r.laid_eggs, k) && E.layEggs(k)) events.push(`${n} laid eggs`);
        if (b(r.hatched, k)) { const ids = E.hatchEggs(k); if (ids) { justBorn[k] = [...justBorn[k], ...(Array.isArray(ids) ? ids : [])]; events.push(`${n} eggs hatched`); } }
        if (b(r.discovered, k) && E.isCarrying(e) && !e.known) { e.known = true; events.push(`${n}'s condition was discovered`); }
    }
    applyChildren(r.children, justBorn, events);
    } finally {
        hooks.onBirth = keepBirthDialog;
        if (keepBirthDialog) for (const [ids, k2] of pending) keepBirthDialog(ids, k2);
    }
    return events;
}

// Children found in the story: newborns (named onto babies the tracker just created) and children who already exist.
function applyChildren(list, justBorn, events) {
    if (!Array.isArray(list)) return;
    const c = C(), fam = c.family, s = S();
    for (const it of list.slice(0, 6)) {
        if (!it || typeof it !== 'object' || !['user', 'char'].includes(it.owner)) continue;
        const name = typeof it.name === 'string' ? it.name.trim().slice(0, 40) : '';
        const sex = it.sex === 'M' || it.sex === 'F' ? it.sex : null;
        const age = Number.isFinite(Number(it.age_days)) && it.age_days !== null ? Math.max(0, Math.round(Number(it.age_days))) : null;
        const other = typeof it.other_parent === 'string' && it.other_parent.trim() && it.other_parent.trim().toLowerCase() !== 'null' ? it.other_parent.trim().slice(0, 40) : '';
        const key = name.toLowerCase();
        if (key && (fam.babies.some(b => (b.name || '').toLowerCase() === key) || fam.grown.some(g => (g.name || '').toLowerCase() === key))) continue;
        const fresh = fam.babies.find(b => justBorn[it.owner].includes(b.id) && !b.name);
        if (fresh && (it.born_now === true || (age !== null && age <= 3))) { if (name) { fresh.name = name; events.push(`Baby named ${name}`); } if (sex) fresh.sex = sex; continue; }
        if (!name && it.born_now !== true) continue;                      // an unnamed mention of an old child is not enough to create one
        if (age !== null && age >= s.babyMaxAgeDays) {                   // already grown: goes straight to the older children list
            fam.grown.push({ id: fam.nextId++, name, sex: sex || 'F', parent: it.owner, age, personality: [], appearance: [], otherParent: other || H.secondParentName(it.owner), milestones: 0 });
            events.push(`Older child added: ${name || 'unnamed'}`); continue;
        }
        const born = age !== null && toDays(c.date.current) !== null ? addDays(c.date.current, -age) : null;
        const b = E.addManualChild({ name, sex: sex || 'F', parent: it.owner, otherParent: other, born, via: 'birth' });
        if (age !== null) b.age = age;
        events.push(`Child added from the story: ${name || 'unnamed baby'}`);
    }
}

const SLEEP = ['asleep', 'awake', 'drowsy', 'napping'], FEED = ['breast', 'formula', 'mixed', 'solids'], HEALTH = ['normal', 'fever', 'cold', 'sick', 'injured', 'recovering'];
const strs = a => (Array.isArray(a) ? a.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim().slice(0, 40)).slice(0, 4) : []);

function applyBabyUpdates(list, events) {
    const fam = C().family.babies;
    if (!Array.isArray(list) || !fam.length) return;
    for (const u of list) {
        if (!u || typeof u !== 'object') continue;
        const key = String(u.label ?? '').toLowerCase();
        const b = fam.find(x => labelOf(x).toLowerCase() === key) || fam.find(x => `baby${x.id}` === key) || (fam.length === 1 ? fam[0] : null);
        if (!b) continue;
        if (typeof u.name === 'string' && u.name.trim() && !b.name) { b.name = u.name.trim().slice(0, 40); events.push(`Baby named ${b.name}`); }
        if (typeof u.mood === 'string' && u.mood.trim()) b.mood = u.mood.trim().slice(0, 30);
        if (SLEEP.includes(u.sleep)) b.sleep = u.sleep;
        if (FEED.includes(u.feeding)) b.feeding = u.feeding;
        if (HEALTH.includes(u.health)) b.health = u.health;
        const now = nowHoursSafe();
        if (u.fed === true && now !== null) b.lastFedH = now;
        if (u.diaper_changed === true && now !== null) b.lastChangedH = now;
        for (const t of strs(u.personality)) if (!b.personality.includes(t)) b.personality.push(t);
        for (const t of strs(u.appearance)) if (!b.appearance.includes(t)) b.appearance.push(t);
        b.personality = b.personality.slice(-8); b.appearance = b.appearance.slice(-8);
    }
}

function applyLooks(k, l) {
    if (!l || !S().inheritAppearance) return;
    const cur = C().looks[k];
    if (typeof l === 'string' && l.trim() && !cur.text) cur.text = l.trim().slice(0, 120);
}

// On-demand: read the character card, persona and recent chat and describe each parent's looks in one line.
export async function analyzeAppearance() {
    const x = ctx(), c = C(), chat = x.chat || [];
    const ch = x.characters?.[x.characterId];
    const card = [ch?.description, ch?.personality].filter(Boolean).join('\n').slice(0, 3000);
    const persona = String(x.powerUserSettings?.persona_description || '').slice(0, 2000);
    const recent = chat.filter(m => !m.is_system).slice(-12).map(m => `${m.is_user ? nameOf('user') : (m.name || nameOf('char'))}: ${clean(m.mes).slice(0, 700)}`).join('\n\n');
    const second = ['user', 'char'].map(k => c.entities[k].second.name).find(Boolean);
    const system = 'You are a precise extractor for a fictional roleplay between adult characters. Only use what the text states. Reply with a single JSON object and nothing else.';
    const user = [
        `Describe the physical appearance of each person in ONE short comma-separated line (eye color, hair color, then at most two other notable traits).`,
        `Return: {"user": "line or null", "char": "line or null"${second ? `, "second": "line for ${second} or null"` : ''}}`,
        `"user" = ${nameOf('user')}, "char" = ${nameOf('char')}${second ? `, "second" = ${second}` : ''}. Use null when the text does not say.`,
        '', `--- ${nameOf('char')} CARD ---`, card || '(none)', '', `--- ${nameOf('user')} PERSONA ---`, persona || '(none)', '', '--- RECENT CHAT ---', recent || '(none)',
    ].join('\n');
    const r = parse(await call(system, user));
    if (!r) throw new Error('No usable answer from the model');
    return r;
}
