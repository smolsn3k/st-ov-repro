import { ctx, S, C, saveC } from './src/core/core.js';
import { refreshDate } from './src/logic/analyze.js';
import { processMessage } from './src/logic/pipeline.js';
import { mount, refresh } from './src/ui/ui.js';
import { renderInfoblock } from './src/ui/infoblock.js';

let queue = Promise.resolve();

const enqueue = idx => {
    queue = queue.then(async () => {
        const events = await processMessage(idx);
        refresh();
        if (S().notifications && events?.length) toastr.info(events.join('; '), 'Omegaverse');
    }).catch(e => console.warn('[omegaverse]', e));
};

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
