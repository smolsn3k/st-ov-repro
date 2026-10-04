// Status card shown with the latest chat message (DOM only; never written into the message or the prompt).
import { S, C, trackedKeys, nameOf, PHYS } from './core.js';
import * as E from './engine.js';
import * as H from './health.js';
import * as D from './data.js';
import { pretty } from './dates.js';
import { labelOf, ageWords, stageOf, careNeeds, careNorms } from './baby.js';

const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BADGE = { heat: 'hot', rut: 'hot', pre: 'warm', quiet: 'calm', suppressed: 'calm', pregnant: 'preg', egg_gravid: 'egg', egg_laying: 'egg', egg_incubating: 'egg', egg_hatching: 'egg', postpartum: 'post', lactating: 'post' };
const ic = n => `<i class="fa-solid fa-${n}"></i>`;
const chip = (t, cls = '') => `<span class="ovr-ib-chip ${cls}">${esc(t)}</span>`;
const bar = (cur, max, cls = '', zone = 0) => `<div class="ovr-ib-bar"${zone ? ` style="--zone:${zone}%"` : ''}><i class="${cls}" style="width:${Math.max(0, Math.min(100, max ? (cur / max) * 100 : 0))}%"></i></div>`;
const kv = rows => `<div class="ovr-ib-kv">${rows.filter(Boolean).map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v)}</b>`).join('')}</div>`;

function cycleBlock(k) {
    const e = C().entities[k], s = S(), r = PHYS[C().physiology[k]].role, nm = r === 'omega' ? 'heat' : 'rut';
    const d = e.cycleDay, L = s.cycleLength, Dn = s.heatDuration, ph = E.phase(k);
    const inHeat = d <= Dn && ph.id !== 'suppressed';
    const sub = inHeat ? `${nm} day ${d} of ${Dn}` : `next ${nm} in ${L - d + 1} day${L - d + 1 === 1 ? '' : 's'}`;
    const extra = [];
    if (C().contraception[k] !== 'none') extra.push(chip(CONTRA_LABEL(k), 'soft'));
    if (e.trying?.on && s.tryingMode) extra.push(chip(`trying · ${e.trying.cycles} cycle${e.trying.cycles === 1 ? '' : 's'}`, 'soft'));
    if (ph.fertility >= 0.8) extra.push(chip('peak fertility', 'hot'));
    return `<div class="ovr-ib-sec"><div class="ovr-ib-line"><span>${ic('rotate')} Cycle day</span><b class="ovr-ib-big">${d}<small>/${L}</small></b></div>${bar(d, L, BADGE[ph.id] || '', (Dn / L) * 100)}<div class="ovr-ib-sub">${esc(sub)}</div>${extra.length ? `<div class="ovr-ib-chips">${extra.join('')}</div>` : ''}</div>`;
}
const CONTRA_LABEL = k => ({ condom: 'barrier', pill: 'hormonal', iud: 'IUD/implant', suppressant: 'suppressants', sterile: 'sterile' }[C().contraception[k]] || '');

function concernChips(k, reveal) {
    const h = C().entities[k].health, out = [];
    for (const [list, defs] of [[h.complications, D.COMPLICATIONS], [h.eggPlanned, D.EGG_COMPLICATIONS]]) {
        for (const c of list) {
            if (!c.active || c.resolved || !(c.diagnosed || reveal)) continue;
            out.push(chip(defs.find(x => x.id === c.id).label + (c.diagnosed ? '' : ' (hidden)'), `sev-${c.severity}`));
        }
    }
    return out.length ? `<div class="ovr-ib-chips">${out.join('')}</div>` : '';
}

function pregBlock(k, detailed, reveal) {
    const e = C().entities[k], s = S(), h = e.health, w = E.weeksOf(e), p = H.pregStatus(k);
    const babies = h.confirm.count || reveal ? `${e.fetusCount} ${e.fetusCount > 1 ? 'babies' : 'baby'}` : null;
    let html = `<div class="ovr-ib-sec"><div class="ovr-ib-line"><span>${ic('baby-carriage')} Pregnancy</span><b class="ovr-ib-big">wk ${w}<small>/${s.termWeeks}</small></b></div>${bar(w, s.termWeeks, 'preg')}<div class="ovr-ib-sub">Trimester ${E.trimester(w)} · due ${esc(pretty(E.dueDate(e)))}${babies ? ` · ${esc(babies)}` : ''}${h.confirm.sex ? ` · ${esc(e.fetusSex.map(x => (x === 'M' ? 'boy' : 'girl')).join(', '))}` : ''}</div>`;
    if (detailed) html += kv([['Baby size', p.size], ['Movement', p.movement], ['Position', p.position], ['Swelling', p.swelling], ['Weight gain', p.weight], ['Libido', p.libido]]) + `<div class="ovr-ib-sub">${esc(p.symptoms.join(' · '))}</div>`;
    html += concernChips(k, reveal);
    return html + '</div>';
}

function eggBlock(k, detailed) {
    const e = C().entities[k], g = e.egg, s = S();
    const incub = g.stage === 'incubating' || g.stage === 'hatch_due';
    const cur = incub ? g.incubDays : g.carryDays, max = incub ? s.eggIncubationDays : s.eggCarryDays;
    let html = `<div class="ovr-ib-sec"><div class="ovr-ib-line"><span>${ic('egg')} ${incub ? 'Incubation' : 'Clutch'}</span><b class="ovr-ib-big">${cur}<small>/${max} d</small></b></div>${bar(cur, max, 'egg')}<div class="ovr-ib-sub">${g.count} eggs${g.laid ? `, ${g.laid} laid` : ''} · nest: ${esc(e.nest.state)}</div>`;
    if (detailed) html += kv([['Stage', g.stage.replace('_', ' ')], ['Nest', e.nest.state]]);
    return html + concernChips(k, false) + '</div>';
}

function postBlock(k, detailed) {
    const e = C().entities[k], len = H.postpartumLength(k), st = H.postpartumStage(k), inRec = e.postpartumDays <= len;
    let html = `<div class="ovr-ib-sec"><div class="ovr-ib-line"><span>${ic('heart-pulse')} ${inRec ? esc(st?.label || 'Recovery') : 'Lactation'}</span><b class="ovr-ib-big">${inRec ? `${e.postpartumDays}<small>/${len} d</small>` : `day ${e.postpartumDays}`}</b></div>${inRec ? bar(e.postpartumDays, len, 'post') : ''}`;
    const chips = [];
    if (e.postpartum.lactating) chips.push(chip('lactating', 'post'));
    if (e.postpartum.method === 'csection') chips.push(chip('C-section recovery', 'soft'));
    if (e.postpartum.method === 'laid') chips.push(chip('after laying', 'soft'));
    if (chips.length) html += `<div class="ovr-ib-chips">${chips.join('')}</div>`;
    if (detailed && inRec && st) html += `<div class="ovr-ib-sub">${esc(st.sym.slice(0, 3).join(' · '))}</div>`;
    return html + '</div>';
}

function entityCard(k) {
    const c = C(), e = c.entities[k], ph = E.phase(k), s = S(), phys = PHYS[c.physiology[k]];
    const carrying = E.isCarrying(e), hide = !s.infoblockShowHidden && carrying && !e.known, reveal = s.infoblockShowHidden;
    const label = hide ? 'No visible changes' : ph.label.replace(/ \(cycle \d+\/\d+\)|, cycle \d+\/\d+/, '');
    let body = '';
    if (hide) body = '';
    else if (e.pregnant) body = pregBlock(k, s.infoblockDetails, reveal);
    else if (e.egg.stage !== 'none') body = eggBlock(k, s.infoblockDetails);
    else if (e.postpartumDays > 0) body = postBlock(k, s.infoblockDetails);
    else body = cycleBlock(k);
    return `<div class="ovr-ib-card"><div class="ovr-ib-head"><div class="ovr-ib-name"><b>${esc(nameOf(k))}</b><span class="ovr-ib-pill">${esc(phys.label)}</span></div><span class="ovr-ib-badge ${hide ? 'calm' : BADGE[ph.id] || 'calm'}">${esc(label)}</span></div>${body}</div>`;
}

function babyCard(b) {
    const need = careNeeds(b), norm = careNorms(b.age, b), st = stageOf(b.age);
    const sleep = b.sleep || need.sleep, feeding = need.feeding, diaper = need.diaper;
    const chips = [chip(`sleep: ${sleep}`), chip(`feeding: ${feeding}${b.feeding ? ` (${b.feeding})` : ''}`, feeding === 'hungry' ? 'warn' : ''), chip(`diaper: ${diaper}`, diaper === 'needs changing' ? 'warn' : '')];
    if (b.mood) chips.push(chip(`mood: ${b.mood}`));
    if (b.teething) chips.push(chip('teething', 'soft'));
    if (b.colicky) chips.push(chip('colic phase', 'soft'));
    const health = b.health && b.health !== 'normal' ? `<span class="ovr-ib-badge hot">${esc(b.health)}</span>` : '';
    const recent = b.milestones.length ? `Latest: ${b.milestones.at(-1).text}` : '';
    const upcoming = norm.upcoming ? `Soon: ${norm.upcoming}` : '';
    return `<div class="ovr-ib-baby ${b.sex === 'M' ? 'boy' : 'girl'}"><div class="ovr-ib-bhead">${ic(b.sex === 'M' ? 'mars' : 'venus')}<b>${esc(labelOf(b))}</b><span class="ovr-ib-dim">${esc(ageWords(b.age))} · ${esc(st.label.toLowerCase())}${b.via === 'hatch' ? ' · hatched' : ''}</span>${health}</div><div class="ovr-ib-chips">${chips.join('')}</div>${b.condition && b.conditionKnown ? `<div class="ovr-ib-sub">${esc(b.condition)}</div>` : ''}${recent || upcoming ? `<div class="ovr-ib-sub">${esc([recent, upcoming].filter(Boolean).join(' · '))}</div>` : ''}${need.note ? `<div class="ovr-ib-sub">${esc(need.note)}</div>` : ''}</div>`;
}

let open = true;
function html() {
    const c = C(), s = S(), fam = c.family;
    const when = c.date.current ? `${ic('calendar-days')} ${esc(pretty(c.date.current))}${c.date.time ? ` ${ic('clock')} ${esc(c.date.time)}` : ''}` : `${ic('calendar-days')} date unknown`;
    const babies = s.infoblockBabies && fam.babies.length ? `<div class="ovr-ib-babies"><div class="ovr-ib-title">${ic('baby')} Children</div>${fam.babies.map(babyCard).join('')}</div>` : '';
    return `<details class="ovr-infoblock pos-${s.infoblockPosition === 'top' ? 'top' : 'bottom'}" ${open ? 'open' : ''}><summary><span class="ovr-ib-when">${when}</span><span class="ovr-ib-label">Reproduction</span></summary><div class="ovr-ib-body">${trackedKeys().map(entityCard).join('')}${babies}</div></details>`;
}

let timer = null;
export function renderInfoblock() {
    clearTimeout(timer);
    timer = setTimeout(() => {
        $('#chat .ovr-infoblock').remove();
        if (!S().enabled || !S().infoblock) return;
        const last = $('#chat .mes').not('.smallSysMes').last();
        if (!last.length) return;
        const text = last.find('.mes_text').first(), block = last.find('.mes_block').first(), h = html();
        if (text.length) { if (S().infoblockPosition === 'top') text.before(h); else text.after(h); }
        else (block.length ? block : last).append(h);
    }, 60);
}

document.addEventListener('toggle', e => { const d = e.target; if (d instanceof HTMLDetailsElement && d.classList.contains('ovr-infoblock')) open = d.open; }, true);

export function applyCustomCss() {
    let el = document.getElementById('ovr_custom_css');
    if (!el) { el = document.createElement('style'); el.id = 'ovr_custom_css'; document.head.appendChild(el); }
    el.textContent = S().infoblockCss || '';
}
