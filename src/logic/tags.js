// Hidden-tag detection (no extra API calls): the roleplay model is asked to end each reply with HTML comments,
// and the tracker reads them locally. Same idea as delidgi/Pregnancy-and-menstruation.
//   <!-- [RP_DATE:...] -->      every reply, the story date in the story's own calendar
//   <!-- [RP_STATUS:{...}] -->  every reply, mood / physical / libido of each tracked character
//   <!-- [RP_ELAPSED:N] -->     only when whole days pass (moves a custom calendar that can't be parsed)
//   one-time event tags        [CONCEPTION_CHECK] [PROTECTION:x] [CYCLE_DAY:n] [PREGNANCY_KNOWN] [TEST] [EXAM] [SEX_REVEAL]
//                              [MISCARRIAGE] [BIRTH] [LAID_EGGS] [HATCHED] [BABY_TRAITS:{...}]   (":CHAR" after the name = {{char}})
// Tags only count inside <!-- ... --> comments, so the model merely writing a tag name in prose does nothing.
import { S, C, ERAS, CONTRA, contraLabel, trackedKeys, nameOf } from '../core/core.js';
import * as E from './engine.js';
import * as H from './health.js';
import { DISRUPTIONS } from '../core/data.js';

const EVENT_NAMES = ['CONCEPTION_CHECK', 'PROTECTION', 'SUPPRESSANTS', 'CYCLE_SETBACK', 'SETBACK_KNOWN', 'CYCLE_DAY', 'PREGNANCY_KNOWN', 'TEST', 'EXAM', 'SEX_REVEAL', 'MISCARRIAGE', 'BIRTH', 'LAID_EGGS', 'HATCHED'];
const ORDER = Object.fromEntries(EVENT_NAMES.map((n, i) => [n, i]));   // the order above is the order they are applied in (protection before conception, birth after discovery...)

// Reasoning models sometimes rehearse the tags inside <think>. Closed blocks and a dangling block in the middle are cut;
// an unclosed block right at the start is a preset's prefill wrapper around the whole reply, so its content is kept.
export function stripThink(text) {
    let t = String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '');
    const i = t.search(/<think>/i);
    if (i > 0) t = t.slice(0, i);
    return t.replace(/<\/?think>/gi, '');
}

function balanced(str, from) {   // the {...} object starting at str[from], string-aware
    let depth = 0, inStr = false;
    for (let i = from; i < str.length; i++) {
        const ch = str[i];
        if (inStr) { if (ch === '\\') i++; else if (ch === '"') inStr = false; continue; }
        if (ch === '"') inStr = true;
        else if (ch === '{') depth++;
        else if (ch === '}' && --depth === 0) return str.slice(from, i + 1);
    }
    return null;
}
function safeJson(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch {
        try { return JSON.parse(raw.replace(/,\s*([}\]])/g, '$1').replace(/'/g, '"')); } catch { return null; }
    }
}

// Parse the tags of one message. Returns null when the message has none.
export function parseTags(raw) {
    const text = stripThink(raw);
    if (!/<!--/.test(text)) return null;
    const res = { date: null, elapsed: 0, status: null, traits: null, events: [] };
    const seen = new Set();
    for (const m of text.matchAll(/<!--([\s\S]*?)-->/g)) {
        const body = m[1];
        const d = /\[(?:RP_)?DATE:\s*([^\]]+?)\s*\]/i.exec(body);
        if (d && !res.date && d[1].length <= 48) res.date = d[1];
        const el = /\[RP_ELAPSED:\s*(\d{1,5})\s*\]/i.exec(body);
        if (el) res.elapsed = Number(el[1]);
        for (const name of ['RP_STATUS', 'BABY_TRAITS']) {
            const at = body.search(new RegExp(`\\[${name}:\\s*\\{`, 'i'));
            if (at < 0) continue;
            const obj = safeJson(balanced(body, body.indexOf('{', at)));
            if (!obj || typeof obj !== 'object') continue;
            if (name === 'RP_STATUS') res.status = { ...(res.status || {}), ...obj }; else res.traits = obj;
        }
        for (const t of body.matchAll(new RegExp(`\\[(${EVENT_NAMES.join('|')})((?::[A-Za-z0-9_ -]+)*)\\]`, 'gi'))) {
            const parts = t[2].split(':').map(x => x.trim()).filter(Boolean);
            const isChar = parts[0]?.toUpperCase() === 'CHAR';
            if (isChar) parts.shift();
            const ev = { name: t[1].toUpperCase(), who: isChar ? 'char' : 'user', arg: parts[0] || '' };
            const key = `${ev.name}|${ev.who}`;
            if (!seen.has(key)) { seen.add(key); res.events.push(ev); }
        }
    }
    res.events.sort((a, b) => ORDER[a.name] - ORDER[b.name]);
    const any = res.date || res.elapsed || res.status || res.traits || res.events.length;
    return any ? res : null;
}

// {mood, physical, libido} for one character from the RP_STATUS object (root = user, partner = char).
export function statusFor(tags, k) {
    const st = tags?.status;
    if (!st) return null;
    const o = k === 'char' ? st.partner : st;
    if (!o || typeof o !== 'object') return null;
    const clean = v => (typeof v === 'string' && !/^(2-4 words|\.{3}|\u2026|null|none|n\/a|unknown|unclear)$/i.test(v.trim()) ? v : '');   // a model copying the template placeholders is not a reading
    const f = { mood: clean(o.mood), physical: clean(o.physical), libido: o.libido };
    return f.mood || f.physical || f.libido ? f : null;
}

const sexOf = v => { const t = String(v || '').toLowerCase(); return /^(m|boy|male|son)/.test(t) ? 'M' : /^(f|girl|female|daughter)/.test(t) ? 'F' : null; };
const list = a => (Array.isArray(a) ? a.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim().slice(0, 40)).slice(0, 4) : []);

// Apply one message's tags to the tracker. `acc` collects: events (text for the toast), justBorn ({user:[ids],char:[ids]}), rolled ({user,char}: conception already rolled).
export function applyTags(tags, acc) {
    if (!tags) return;
    const c = C(), s = S(), keys = trackedKeys(), ev = acc.events;
    // mood / physical / libido: every reply, quietly (no toast, they change constantly)
    if (s.trackFeelings) for (const k of keys) { const f = statusFor(tags, k); if (f) H.setFeel(k, f, { refresh: true }); }

    for (const t of tags.events) {
        const k = t.who;
        if (!keys.includes(k)) continue;
        const e = c.entities[k], n = nameOf(k);
        switch (t.name) {
            case 'PROTECTION': {
                const id = String(t.arg || '').toLowerCase();
                if (id === 'suppressant') { if (!c.suppressants[k]) { c.suppressants[k] = true; ev.push(`${n}: heat/rut suppressants on`); } }   // older wording: suppressants are not contraception
                else if (CONTRA[id] && c.contraception[k] !== id) { c.contraception[k] = id; ev.push(`${n}: protection ${contraLabel(id)}`); }
                break;
            }
            case 'SUPPRESSANTS': {
                const on = !/^(off|stop|stopped|no|false)$/i.test(String(t.arg || 'on'));
                if (c.suppressants[k] !== on) { c.suppressants[k] = on; ev.push(`${n}: heat/rut suppressants ${on ? 'on' : 'off'}`); }
                break;
            }
            case 'CYCLE_SETBACK': {
                const kind = String(t.arg || '').toLowerCase();
                if (DISRUPTIONS[kind] && !E.isCarrying(e) && e.postpartumDays === 0) { const sh = H.disrupt(k, kind); if (sh) ev.push(`${n}: cycle set back (${DISRUPTIONS[kind].label}, +${sh} d)`); }
                break;
            }
            case 'SETBACK_KNOWN': if (H.setSetbackKnown(k, true)) ev.push(`${n}: the cause of the delay is known`); break;
            case 'CYCLE_DAY': {
                const d = Math.floor(Number(t.arg));
                if (!E.isCarrying(e) && e.postpartumDays === 0 && d >= 1 && d <= s.cycleLength && e.cycleDay !== d) {
                    e.cycleDay = d; ev.push(`${n}: cycle day ${d}`);
                    if (d <= s.heatDuration) H.resolveSetback(k);       // the heat/rut finally began
                }
                break;
            }
            case 'PREGNANCY_KNOWN':
                if (E.isCarrying(e) && !e.known) { e.known = true; ev.push(`${n}'s condition was discovered`); }
                break;
            case 'TEST': { const r = H.takeTest(k); if (r.ok) ev.push(`${n}: ${r.msg}`); break; }
            case 'EXAM': if (E.isCarrying(e)) { const v = H.visit(k, { force: true }); if (v.ok) ev.push(`${n}: ${v.msg}`); } break;
            case 'SEX_REVEAL': {
                const era = ERAS[c.reveal.era] || ERAS.modern;
                if (e.pregnant && !e.health.confirm.sex && E.weeksOf(e) >= era.sexWeek) { e.health.confirm.sex = true; e.known = true; ev.push(`${n}: baby sex revealed`); }
                break;
            }
            case 'CONCEPTION_CHECK':
                if (E.canConceive(k)) {
                    const odds = E.conceptionOdds(k);
                    acc.rolled[k] = true;
                    if (E.conceive(k)) ev.push(`${n} conceived (${Math.round(odds * 100)}% odds)`);
                }
                break;
            case 'MISCARRIAGE': if (E.loseOrEnd(k)) ev.push(`${n}: ${e.pregnant ? 'pregnancy' : 'clutch'} lost`); break;
            case 'BIRTH': {
                const m = String(t.arg).toUpperCase() === 'CSECTION' ? 'csection' : undefined;
                const ids = E.giveBirth(k, m);
                if (ids) { acc.justBorn[k].push(...(Array.isArray(ids) ? ids : [])); ev.push(`${n} gave birth${m ? ' (C-section)' : ''}`); }
                break;
            }
            case 'LAID_EGGS': if (E.layEggs(k)) ev.push(`${n} laid eggs`); break;
            case 'HATCHED': {
                const ids = E.hatchEggs(k);
                if (ids) { acc.justBorn[k].push(...(Array.isArray(ids) ? ids : [])); ev.push(`${n} eggs hatched`); }
                break;
            }
        }
    }
    applyTraits(tags.traits, acc);
}

// [BABY_TRAITS:{"owner":"user","babies":[{"name":"","sex":"boy|girl","appearance":[],"personality":[]}]}]: names and traits for the children born in this reply.
function applyTraits(tr, acc) {
    if (!tr || !Array.isArray(tr.babies)) return;
    const fam = C().family.babies;
    const owner = tr.owner === 'char' ? 'char' : (tr.owner === 'user' ? 'user' : (acc.justBorn.user.length ? 'user' : 'char'));
    const ids = acc.justBorn[owner];
    if (!ids.length) return;
    tr.babies.slice(0, ids.length).forEach((it, i) => {
        const b = fam.find(x => x.id === ids[i]);
        if (!b || !it || typeof it !== 'object') return;
        const nm = typeof it.name === 'string' ? it.name.trim().slice(0, 40) : '';
        if (nm && !b.name && nm.toLowerCase() !== 'null') { b.name = nm; acc.events.push(`Baby named ${nm}`); }
        const sx = sexOf(it.sex); if (sx) b.sex = sx;
        for (const t of list(it.appearance)) if (!b.appearance.includes(t)) b.appearance.push(t);
        for (const t of list(it.personality)) if (!b.personality.includes(t)) b.personality.push(t);
        b.appearance = b.appearance.slice(-8); b.personality = b.personality.slice(-8);
    });
}

// ── The instruction block added to the main prompt ──
export function tagInstructions() {
    const s = S(), c = C(), keys = trackedKeys();
    const L = [];
    L.push('[Hidden tags] After the story text, end every reply with the HTML comments below. They are invisible to the reader: never mention, explain or quote them in the prose, and never put them in reasoning. Write text values in the story\'s language.');
    L.push('<!-- [RP_DATE:the current in-story date, written the way the story writes its own dates, for example 12 May, 3rd of Harvestmoon or Day 14; add a year or HH:MM only if the story uses them] -->');
    if (s.trackFeelings) {
        const f = '"mood":"2-4 words","physical":"2-4 words","libido":"very low|low|normal|high|very high"';
        const parts = [keys.includes('user') && f, keys.includes('char') && `"partner":{${f}}`].filter(Boolean);
        L.push(`<!-- [RP_STATUS:{${parts.join(',')}}] -->`);
        L.push(`RP_STATUS is how each person is at the end of this reply${keys.includes('user') ? '; the root object is {{user}}' : ''}${keys.includes('char') ? ', "partner" is {{char}}' : ''}, whoever the narrator is. Leave a field out when unclear.`);
    }
    L.push('<!-- [RP_ELAPSED:N] --> only when one or more whole in-story days pass during this reply (N = days). Otherwise leave it out.');

    const lines = [];
    for (const k of keys) {
        const e = c.entities[k], who = k === 'char' ? '{{char}}' : '{{user}}', carry = E.isCarrying(e);
        const tag = (name, arg) => `[${name}${k === 'char' ? ':CHAR' : ''}${arg ? ':' + arg : ''}]`;
        const it = [];
        if (E.canConceive(k)) it.push(`${tag('CONCEPTION_CHECK')} semen is released inside them (the tracker applies their protection itself)`);
        if (!carry) it.push(`${tag('PROTECTION', 'condom')} when the story states or changes their contraception, which prevents conception (none|condom|pill|iud|sterile)`);
        if (!carry && e.postpartumDays === 0) it.push(`${tag('SUPPRESSANTS', 'on')} when they start taking heat/rut suppressants, which stop the heat/rut itself and are not contraception (${tag('SUPPRESSANTS', 'off')} when they stop)`);
        if (!carry && e.postpartumDays === 0) {
            it.push(`${tag('CYCLE_DAY', '1')} a heat or rut clearly begins`);
            if (s.disruptionsEnabled) it.push(`${tag('CYCLE_SETBACK', 'stress')} something in the story clearly throws their cycle off (stress|illness|starvation|travel|overwork), once, when it happens`);
            if (H.activeSetback(k) && !H.activeSetback(k).known) it.push(`${tag('SETBACK_KNOWN')} the story makes them realize why their heat/rut is late`);
        }
        if (e.pregnant) {
            const era = ERAS[c.reveal.era] || ERAS.modern;
            if (!e.known) {
                it.push(`${tag('PREGNANCY_KNOWN')} the pregnancy is actually discovered in the story`);
                if (era.test) it.push(`${tag('TEST')} a pregnancy test is actually taken`);
            }
            it.push(`${tag('EXAM')} a ${H.practitioner()} actually examines them`);
            if (e.known && !e.health.confirm.sex && E.weeksOf(e) >= era.sexWeek) it.push(`${tag('SEX_REVEAL')} the baby's sex is actually learned`);
            it.push(`${tag('BIRTH')} the delivery is completed (${tag('BIRTH', 'CSECTION')} if by C-section), never for contractions or plans`);
            it.push(`${tag('MISCARRIAGE')} a confirmed loss, never a scare`);
        } else if (carry) {
            const g = e.egg.stage;
            if (!e.known) it.push(`${tag('PREGNANCY_KNOWN')} the clutch is actually discovered in the story`);
            if (g === 'gravid' || g === 'laying_due') it.push(`${tag('LAID_EGGS')} the eggs are actually laid`);
            if (g === 'incubating' || g === 'hatch_due') it.push(`${tag('HATCHED')} the eggs actually hatch`);
            it.push(`${tag('EXAM')} a ${H.practitioner()} actually examines them`);
            it.push(`${tag('MISCARRIAGE')} the clutch is lost`);
        }
        if (it.length) lines.push(`${who}${k === 'char' ? ' (every tag carries :CHAR)' : ''}: ${it.join('; ')}.`);
    }
    if (lines.length) {
        L.push('Event tags go in a comment of their own, once, in the reply where the event actually happens; never for plans, fantasies, memories or events already tagged earlier:');
        L.push(...lines);
        if (keys.some(k => E.isCarrying(c.entities[k]) && (c.entities[k].pregnant || ['incubating', 'hatch_due', 'laying_due'].includes(c.entities[k].egg.stage)))) {
            L.push('With a birth or hatching, also add once: <!-- [BABY_TRAITS:{"owner":"user|char","babies":[{"name":"","sex":"boy|girl","appearance":[],"personality":[]}]}] --> using only facts shown in the scene (owner = the parent who gave birth).');
        }
    }
    return L.join('\n');
}
