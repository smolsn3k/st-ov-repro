import { ctx, S, C, saveC } from './src/core/core.js';
import { refreshDate, analyze, applyResult } from './src/logic/analyze.js';
import { takeSnap, restoreSnap, checkpointFromSnap, dropHistoryFor } from './src/logic/engine.js';
import { mount, refresh } from './src/ui/ui.js';
import { renderInfoblock } from './src/ui/infoblock.js';

let queue = Promise.resolve();

async function processMessage(idx) {
    const s = S();
    if (!s.enabled) return;
    const chat = ctx().chat || [];
    const msg = chat[idx];
    if (!msg || msg.is_system) return;
    const c = C();
    // Same message processed again (swipe/regenerate): roll back its earlier effects and checkpoint first.
    if (c.snap && c.snap.idx === idx) { restoreSnap(); dropHistoryFor(idx); } else takeSnap(idx);

    const events = [];
    if (refreshDate()) events.push('Date updated from chat');
    const result = await analyze(idx);
    events.push(...applyResult(result));

    if (events.length) checkpointFromSnap(events.slice(0, 3).join('; '));
    saveC(); refresh();
    if (s.notifications && events.length) toastr.info(events.join('; '), 'Omegaverse');
}

const enqueue = idx => { queue = queue.then(() => processMessage(idx)).catch(e => console.warn('[omegaverse]', e)); };

jQuery(() => {
    mount();
    const x = ctx(), et = x.eventTypes || x.event_types, on = (ev, fn) => ev && x.eventSource.on(ev, fn);
    on(et.MESSAGE_RECEIVED, idx => enqueue(idx));
    on(et.MESSAGE_SENT, idx => enqueue(idx));
    on(et.CHAT_CHANGED, () => { if (S().enabled) { refreshDate(); saveC(); } refresh(); });
    on(et.MESSAGE_DELETED, () => { if (S().enabled) { refreshDate(); saveC(); } refresh(); });
    for (const ev of [et.CHARACTER_MESSAGE_RENDERED, et.USER_MESSAGE_RENDERED, et.MESSAGE_SWIPED, et.MESSAGE_UPDATED]) on(ev, () => renderInfoblock());
    refresh();
});
