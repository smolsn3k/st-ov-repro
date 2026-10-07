// What happens to one chat message: read its hidden tags (free), read the date, optionally ask the analyzer, apply everything, checkpoint.
import { ctx, S, C, saveC, hooks } from '../core/core.js';
import { parseStoryDate, toDays } from '../core/dates.js';
import { refreshDate, analyze, applyResult } from './analyze.js';
import { parseTags, applyTags } from './tags.js';
import { takeSnap, restoreSnap, checkpointFromSnap, dropHistoryFor, shiftDate } from './engine.js';

const fresh = () => ({ events: [], justBorn: { user: [], char: [] }, rolled: { user: false, char: false } });

// Birth dialogs wait until everything (tags, analyzer names) has been applied, then open one after another.
async function withBirthDialogs(fn) {
    const keep = hooks.onBirth, pending = [];
    hooks.onBirth = (ids, k) => { pending.push([ids, k]); };
    try { return await fn(); }
    finally { hooks.onBirth = keep; if (keep) for (const [ids, k] of pending) keep(ids, k); }
}

export async function processMessage(idx) {
    const s = S();
    if (!s.enabled) return;
    const chat = ctx().chat || [];
    const msg = chat[idx];
    if (!msg || msg.is_system) return;
    const c = C();
    // Same message processed again (swipe/regenerate): roll back its earlier effects and checkpoint first.
    if (c.snap && c.snap.idx === idx) { restoreSnap(); dropHistoryFor(idx); } else takeSnap(idx);

    const acc = fresh(), events = acc.events;
    const tags = !msg.is_user && s.detectMode !== 'analyzer' ? parseTags(msg.mes) : null;

    await withBirthDialogs(async () => {
        // 1. Date. A parseable date moves the clock; a custom calendar's text is kept and the clock moves by RP_ELAPSED.
        let timeHandled = false;
        if (!c.date.manual && tags?.elapsed > 0 && tags.elapsed <= s.maxAutoAdvance) {
            const r = tags.date ? parseStoryDate(tags.date, { order: s.dateOrder, ref: toDays(c.date.current) }) : null;
            if (!r || r.day === null) { shiftDate(tags.elapsed, 'chat'); events.push(`+${tags.elapsed} day(s)`); timeHandled = true; }
        }
        const d = refreshDate(idx);
        if (d.found) timeHandled = true;
        if (d.changed) events.push('Date updated from chat');

        // 2. Tags: status every reply, one-time events when they happen
        applyTags(tags, acc);

        // 3. Analyzer (only when the mode and the message call for it)
        const result = await analyze(idx, { tags });
        events.push(...applyResult(result, { timeHandled, justBorn: acc.justBorn, rolled: acc.rolled, skipConception: { ...acc.rolled } }));
    });

    c.proc = { idx, conc: acc.rolled };
    if (events.length) checkpointFromSnap(events.slice(0, 3).join('; '));
    saveC();
    return events;
}

// "Analyze now": run the analyzer on the latest message regardless of mode and filters, without touching the date
// (the date was already read when the message arrived) and without re-rolling a conception that was already rolled for it.
export async function analyzeLatest() {
    const chat = ctx().chat || [];
    let idx = chat.length - 1;
    while (idx >= 0 && chat[idx]?.is_system) idx--;
    if (idx < 0) return { ok: false, msg: 'There is no message to analyze yet' };
    const c = C(), acc = fresh();
    const prior = c.proc?.idx === idx ? c.proc.conc : {};
    const r = await analyze(idx, { force: true });
    if (!r) return { ok: false, msg: 'The analyzer returned nothing usable (see the console for details)' };
    await withBirthDialogs(async () => { acc.events.push(...applyResult(r, { skipDate: true, justBorn: acc.justBorn, rolled: acc.rolled, skipConception: { ...prior } })); });
    c.proc = { idx, conc: { user: !!(prior.user || acc.rolled.user), char: !!(prior.char || acc.rolled.char) } };
    return { ok: true, msg: acc.events.length ? acc.events.slice(0, 4).join('; ') : 'Analyzed: nothing new found in the latest message' };
}
