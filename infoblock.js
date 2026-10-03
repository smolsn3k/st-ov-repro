// Status card shown under the latest chat message (DOM only; never written into the message or the prompt).
import { S, C, trackedKeys, nameOf, PHYS } from './core.js';
import * as E from './engine.js';
import * as H from './health.js';
import { pretty } from './dates.js';
import { labelOf, ageWords, stageOf } from './baby.js';

const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function entityLine(k) {
    const c = C(), e = c.entities[k], ph = E.phase(k), s = S();
    const hide = !s.infoblockShowHidden && E.isCarrying(e) && !e.known;
    let st = ph.label;
    if (hide) st = 'No visible changes';
    else if (e.pregnant) {
        const p = H.pregStatus(k);
        st = `Pregnant, week ${p.week}, due ${pretty(E.dueDate(e))}${c.entities[k].health.confirm.count ? `, ${e.fetusCount} ${e.fetusCount > 1 ? 'babies' : 'baby'}` : ''}`;
    }
    const act = hide ? [] : [...e.health.complications, ...e.health.eggPlanned].filter(x => x.active && !x.resolved).length;
    const extra = [];
    if (!hide && e.postpartum?.lactating && e.postpartumDays > 0) extra.push('lactating');
    if (!hide && act) extra.push(`${act} health concern${act > 1 ? 's' : ''}`);
    if (e.trying?.on && s.tryingMode) extra.push('trying for a baby');
    return `<div class="ovr-ib-row"><b>${esc(nameOf(k))}</b> <small>${PHYS[c.physiology[k]].label}</small><div>${esc(st)}${extra.length ? ` <small>(${esc(extra.join(', '))})</small>` : ''}</div></div>`;
}

function html() {
    const c = C(), fam = c.family;
    const kids = fam.babies.map(b => `${esc(labelOf(b))} (${ageWords(b.age)}, ${stageOf(b.age).label.toLowerCase()})`).join(', ');
    return `<details class="ovr-infoblock" open><summary>Reproduction${c.date.current ? ` · ${esc(pretty(c.date.current))}${c.date.time ? ' ' + esc(c.date.time) : ''}` : ''}</summary>
        ${trackedKeys().map(entityLine).join('')}${kids ? `<div class="ovr-ib-row"><b>Children</b><div>${kids}</div></div>` : ''}</details>`;
}

let timer = null;
export function renderInfoblock() {
    clearTimeout(timer);
    timer = setTimeout(() => {
        $('#chat .ovr-infoblock').remove();
        if (!S().enabled || !S().infoblock) return;
        const last = $('#chat .mes').not('.smallSysMes').last();
        if (!last.length) return;
        const target = last.find('.mes_block').first();
        (target.length ? target : last).append(html());
    }, 60);
}

export function applyCustomCss() {
    let el = document.getElementById('ovr_custom_css');
    if (!el) { el = document.createElement('style'); el.id = 'ovr_custom_css'; document.head.appendChild(el); }
    el.textContent = S().infoblockCss || '';
}
