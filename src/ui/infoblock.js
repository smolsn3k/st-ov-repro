// Chat infoblock: compact, collapsible status cards under (or above) the latest message.
// DOM only; never written into the message or the prompt.
import { S, C, trackedKeys, nameOf, PHYS, contraProtection, showDate, dateLabel, hasDate, fertilityWord } from '../core/core.js';
import * as E from '../logic/engine.js';
import * as H from '../logic/health.js';
import * as D from '../core/data.js';
import { labelOf, ageWords, stageOf, careNeeds } from '../logic/baby.js';

const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = n => `<i class="fa-solid fa-${n}"></i>`;
const stat = (icon, color, label, value, wide) => `<div class="ovr-ib-stat${wide ? ' wide' : ''}"><div class="ovr-ib-si ${color}">${ic(icon)}</div><div><div class="ovr-ib-lbl">${esc(label)}</div><div class="ovr-ib-val">${value}</div></div></div>`;
const note = (t, cls = '') => `<div class="ovr-ib-note ${cls}">${t}</div>`;
const hp = (cls, txt) => `<span class="ovr-ib-health ${cls}">${txt}</span>`;
const roleWord = k => (PHYS[C().physiology[k]].role === 'omega' ? 'Omega' : 'Alpha');

// ── Open/closed state per card (everything starts collapsed) ──
const OPEN_KEY = 'ovr_ib_open';
let openSet;
try { openSet = new Set(JSON.parse(localStorage.getItem(OPEN_KEY) || '[]')); } catch { openSet = new Set(); }
const card = (key, iconCls, icon, title, badge, badgeCls, body, extraCls = '') => `<details class="ovr-ib ${extraCls}" data-key="${esc(key)}" ${openSet.has(key) ? 'open' : ''}>
    <summary><div class="ovr-ib-header"><div class="ovr-ib-icon ${iconCls}">${ic(icon)}</div><span class="ovr-ib-title">${title}</span><span class="ovr-ib-badge ${badgeCls}">${badge}</span><div class="ovr-ib-chev">${ic('chevron-down')}</div></div></summary>
    <div class="ovr-ib-c">${body}</div></details>`;

function healthTile(k, reveal) {
    const h = C().entities[k].health;
    let worst = 0, names = [];
    for (const [list, defs] of [[h.complications, D.COMPLICATIONS], [h.eggPlanned, D.EGG_COMPLICATIONS]]) {
        for (const c of list) {
            if (!c.active || c.resolved || !(c.diagnosed || reveal)) continue;
            worst = Math.max(worst, c.severity === 'critical' ? 2 : 1); names.push(defs.find(x => x.id === c.id).label);
        }
    }
    return { html: worst === 2 ? hp('critical', 'Critical') : worst === 1 ? hp('warning', 'Attention') : hp('normal', 'Normal'), names };
}

// ── Cycle (heat/rut) card; also used for hidden pregnancies so the secret stays secret ──
const pctOf = v => +(v * 100).toFixed(1);
function cycleCard(k, hidden) {
    const c = C(), e = c.entities[k], s = S(), L = s.cycleLength, Dn = s.heatDuration;
    const rawDay = hidden ? e.cycleDay + (e.pregnant ? e.days : e.egg.carryDays) : e.cycleDay;
    const info = H.cycleInfo(k, rawDay), day = Math.min(rawDay, L), delay = Math.max(0, rawDay - L);
    const fl = H.feelNow(k, { mood: info.mood, physical: info.physical, libidoText: info.libido });
    const nm = PHYS[c.physiology[k]].role === 'omega' ? 'heat' : 'rut', Nm = nm[0].toUpperCase() + nm.slice(1);
    const fc = H.heatForecast(k), sb = hidden ? null : e.setback, cause = sb ? H.setbackLabel(sb) : '';
    const badge = delay > 0 ? `Late ${delay} d` : `${day}/${L} · ${info.label}`;
    const extra = [];
    if (!hidden) {
        const inWin = e.cycleDay <= Dn && info.sub !== 'suppressed';
        if (inWin) extra.push(stat('calendar-day', 'pink', `${Nm} day`, `${e.cycleDay} of ${Dn}`));
        else if (delay > 0) extra.push(stat('calendar-xmark', 'orange', `${Nm} overdue`, `${delay} d`));
        else extra.push(stat('calendar-day', 'purple', `Next ${nm}`, `in ${fc.visible ? fc.actualIn : fc.expectedIn} d${fc.visible && fc.actualIn !== fc.expectedIn ? ' (delayed)' : ''}`));
        if (sb && !sb.resolved) extra.push(stat('triangle-exclamation', 'orange', 'Setback', esc(sb.known || s.infoblockShowHidden ? `${cause}, +${sb.shift} d${sb.known ? '' : ' (unknown to them)'}` : 'Cause unknown to them'), true));
        else if (sb?.resolved) extra.push(stat('circle-check', 'green', 'Setback over', esc(`${Nm} came ${sb.used} d late${cause && (sb.known || s.infoblockShowHidden) ? ` (${cause})` : ''}`), true));
        const con = c.contraception[k], odds = E.conceptionOdds(k), tryingNow = s.tryingMode && e.trying?.on;
        const why = [con !== 'none' && !tryingNow && `${(D_CON[con] || con).toLowerCase()} −${contraProtection(con)}%`, c.suppressants[k] && 'suppressed', tryingNow && 'trying'].filter(Boolean).join(', ');
        extra.push(stat('seedling', 'green', 'Conception', esc(`${pctOf(odds)}%${why ? ` (${why})` : ''}`)));
        if (con !== 'none') extra.push(stat('shield-heart', 'green', 'Contraception', esc(`${D_CON[con] || con} ${contraProtection(con)}%`)));
        if (c.suppressants[k]) extra.push(stat('pills', 'blue', 'Suppressants', 'On'));
        if (e.trying?.on && s.tryingMode) extra.push(stat('bullseye', 'pink', 'Trying', `${e.trying.cycles} cycle${e.trying.cycles === 1 ? '' : 's'}`));
    } else if (delay > 0) extra.push(stat('calendar-xmark', 'orange', 'Delay', `${delay} d`));
    const t = e.health.test;
    if (t.result && E.phase(k)) extra.push(stat('vial', t.result === 'negative' ? 'blue' : 'pink', 'Test', esc(t.result)));
    const pct = Math.min(100, Math.round((rawDay / L) * 100));
    const lateNote = delay > 0 && !hidden && sb && !sb.resolved ? (sb.known ? `${Nm} is ${delay} day${delay === 1 ? '' : 's'} late: ${cause}.` : `${Nm} is ${delay} day${delay === 1 ? '' : 's'} late and nobody knows why.${s.infoblockShowHidden ? ` (Cause: ${cause}.)` : ''}`) : '';
    const body = `<div class="ovr-ib-bar" style="--zone:${(Dn / L) * 100}%"><div class="ovr-ib-bar-fill cycle" style="width:${pct}%"></div></div>
        <div class="ovr-ib-grid">${stat('droplet', 'green', 'Fertility', esc(hidden ? 'Undetermined' : `${pctOf(E.naturalChance(k))}% (${fertilityWord(E.naturalChance(k) * 100)})`))}${stat('fire', 'pink', 'Libido', esc(fl.libido))}${stat('face-smile', 'purple', 'Mood', esc(fl.mood))}${stat('heart', 'blue', 'Physical', esc(fl.physical))}${extra.join('')}${note(esc(lateNote || info.note))}</div>`;
    return card(`c-${k}`, 'cycle', 'clock', `${esc(nameOf(k))} · ${roleWord(k)}`, esc(badge), 'cycle', body);
}
const D_CON = { condom: 'Barrier', pill: 'Hormonal', iud: 'IUD / implant', sterile: 'Sterile' };

// ── Pregnancy card ──
function pregCard(k, reveal) {
    const c = C(), e = c.entities[k], s = S(), h = e.health, w = E.weeksOf(e), p = H.pregStatus(k), tri = E.trimester(w);
    const pct = Math.min(100, Math.round((w / s.termWeeks) * 100));
    const count = h.confirm.count || reveal ? `${e.fetusCount} ${e.fetusCount > 1 ? 'babies' : 'baby'}` : 'not confirmed';
    const sex = h.confirm.sex || reveal ? e.fetusSex.map(x => (x === 'M' ? 'boy' : 'girl')).join(', ') : 'unknown';
    const ht = healthTile(k, reveal), ds = s.infoblockDetails;
    const second = H.secondParentName(k), fl = H.feelFor(k);
    const tiles = [
        hasDate() ? stat('clock', 'purple', 'Story time', esc(`${dateLabel()}${c.date.time ? ' ' + c.date.time : ''}`)) : '',
        e.conceptionDate ? stat('calendar-day', 'pink', 'Conceived', esc(showDate(e.conceptionDate))) : '',
        stat('calendar', 'purple', 'Due', esc(showDate(E.dueDate(e)))),
        stat('baby', 'pink', 'Fetus', esc(`${count} (${sex})`)),
        stat('user', 'blue', 'Other parent', esc(second)),
        stat('heart-pulse', 'green', 'Health', ht.html),
        ds ? stat('ruler', 'blue', 'Size', esc(p.size)) : '',
        ds ? stat('face-smile', 'purple', 'Mood', esc(fl.mood)) : '',
        ds ? stat('heart', 'blue', 'Physical', esc(fl.physical)) : '',
        ds ? stat('weight-scale', 'orange', 'Weight', esc(p.weight)) : '',
        ds ? stat('fire', 'pink', 'Libido', esc(fl.libido)) : '',
        ds ? stat('hand', 'purple', 'Movement', esc(p.movement)) : '',
        ds ? stat('droplet', 'orange', 'Swelling', esc(p.swelling)) : '',
        ds ? stat('bolt', 'pink', 'Contractions', esc(p.braxton)) : '',
        ds ? stat('baby', 'blue', 'Position', esc(p.position)) : '',
    ].filter(Boolean).join('');
    const notes = (ds ? note(esc(p.symptoms.join(' · '))) : '') + (ht.names.length ? note(`${ic('triangle-exclamation')} ${esc(ht.names.join(', '))}`, 'rec') : '') + (ds ? note(`${ic('lightbulb')} ${esc(p.advice)}`, 'rec') : '');
    const body = `<div class="ovr-ib-bar"><div class="ovr-ib-bar-fill pregnancy" style="width:${pct}%"></div></div><div class="ovr-ib-grid">${tiles}${notes}</div>`;
    return card(`p-${k}`, 'pregnancy', 'heart', `${esc(nameOf(k))} · Pregnancy`, `${w}/${s.termWeeks} wk`, 'pregnancy', body);
}

// ── Clutch / incubation card ──
function eggCard(k, reveal) {
    const c = C(), e = c.entities[k], s = S(), g = e.egg, h = e.health;
    const incub = g.stage === 'incubating' || g.stage === 'hatch_due';
    const cur = incub ? g.incubDays : g.carryDays, max = incub ? s.eggIncubationDays : s.eggCarryDays;
    const ht = healthTile(k, reveal), ds = s.infoblockDetails;
    const tiles = [
        stat('egg', 'pink', 'Eggs', esc(`${h.confirm.count || reveal || g.laid ? g.count : 'several'}${g.laid ? `, ${g.laid} laid` : ''}`)),
        stat('house', 'orange', 'Nest', esc(e.nest.state)),
        stat('user', 'blue', 'Other parent', esc(H.secondParentName(k))),
        stat('heart-pulse', 'green', 'Health', ht.html),
        ds ? stat('flag', 'purple', 'Stage', esc(g.stage.replace('_', ' '))) : '',
        ds && g.stage === 'gravid' ? stat('face-smile', 'purple', 'Mood', 'Restless, nesting') : '',
        ds && incub ? stat('temperature-half', 'orange', 'Needs', 'Warmth, guarding the nest') : '',
    ].filter(Boolean).join('');
    const notes = ht.names.length ? note(`${ic('triangle-exclamation')} ${esc(ht.names.join(', '))}`, 'rec') : '';
    const body = `<div class="ovr-ib-bar"><div class="ovr-ib-bar-fill egg" style="width:${Math.min(100, (cur / max) * 100)}%"></div></div><div class="ovr-ib-grid">${tiles}${notes}</div>`;
    return card(`e-${k}`, 'egg', 'egg', `${esc(nameOf(k))} · ${incub ? 'Incubation' : 'Clutch'}`, `${cur}/${max} d`, 'egg', body);
}

// ── Postpartum / recovery card ──
function postCard(k) {
    const fl = H.feelFor(k);
    const e = C().entities[k], s = S(), len = H.postpartumLength(k), st = H.postpartumStage(k), inRec = e.postpartumDays <= len, ds = s.infoblockDetails;
    const idx = inRec ? Math.max(0, D.POSTPARTUM[e.postpartum.method]?.findIndex(x => x.label === st?.label) ?? 0) : 3;
    const how = e.postpartum.method === 'csection' ? 'C-section' : e.postpartum.method === 'laid' ? 'After laying' : 'Natural birth';
    const tiles = [
        stat('heart-pulse', 'green', 'Recovery', esc(inRec ? (st?.label || 'Recovering') : 'Complete')),
        stat('bandage', 'orange', 'Delivery', esc(how)),
        stat('bottle-droplet', 'blue', 'Lactation', e.postpartum.lactating ? 'Nursing' : 'No'),
        stat('clock-rotate-left', 'purple', 'Cycle', inRec || e.postpartum.lactating ? 'Not returned' : 'Returning'),
        ds ? stat('face-smile', 'purple', 'Mood', esc(fl.mood)) : '',
        ds ? stat('fire', 'pink', 'Libido', esc(fl.libido)) : '',
        ds ? stat('heart', 'blue', 'Physical', esc(fl.physical)) : '',
    ].filter(Boolean).join('');
    const body = `${inRec ? `<div class="ovr-ib-bar"><div class="ovr-ib-bar-fill baby" style="width:${Math.min(100, (e.postpartumDays / len) * 100)}%"></div></div>` : ''}<div class="ovr-ib-grid">${tiles}${ds && inRec && st ? note(esc(st.sym.join(' · '))) : ''}</div>`;
    return card(`r-${k}`, 'cycle', 'heart-pulse', `${esc(nameOf(k))} · Recovery`, inRec ? `Day ${e.postpartumDays}/${len}` : 'Lactating', 'cycle', body);
}

function carrierCard(k) {
    const e = C().entities[k], s = S(), reveal = s.infoblockShowHidden;
    if (e.pregnant) return e.known || reveal ? pregCard(k, reveal && !e.known ? true : reveal) : cycleCard(k, true);
    if (e.egg.stage !== 'none') return e.known || reveal || ['incubating', 'hatch_due'].includes(e.egg.stage) ? eggCard(k, reveal) : cycleCard(k, true);
    if (e.postpartumDays > 0) return postCard(k);
    return cycleCard(k, false);
}

// ── Baby cards ──
function babyCard(b) {
    const need = careNeeds(b), st = stageOf(b.age);
    const sexIcon = b.sex === 'M' ? ic('mars') : ic('venus'), sexCol = b.sex === 'M' ? 'blue' : 'pink';
    const diaperClean = !/chang|dirty|wet/i.test(need.diaper || '');
    const hpHtml = b.health && b.health !== 'normal' ? hp(/injur|sick|fever/i.test(b.health) ? 'warning' : 'normal', esc(b.health)) : hp('normal', 'Normal');
    const feeding = esc(`${need.feeding}${b.feeding ? ` (${b.feeding})` : ''}`);
    const tiles = [
        stat('heart-pulse', 'green', 'Health', hpHtml),
        stat('face-smile', 'purple', 'Mood', esc(b.mood || '—')),
        stat('bottle-water', 'blue', 'Feeding', feeding),
        stat('moon', 'purple', 'Sleep', esc(b.sleep || need.sleep || '—')),
        stat('baby-carriage', diaperClean ? 'green' : 'orange', 'Diaper', diaperClean ? esc(need.diaper) : `<span class="ovr-ib-warn">${esc(need.diaper)}</span>`),
        b.teething ? stat('tooth', 'blue', 'Teeth', 'Coming in') : '',
        b.colicky ? stat('face-sad-tear', 'pink', 'Colic', 'Yes') : '',
        b.otherParent ? stat('user', 'blue', 'Other parent', esc(b.otherParent)) : '',
    ].filter(Boolean).join('');
    const miles = b.milestones.slice(-2).map(m => m.text).join(', ');
    const notes = (b.personality.length ? note(`${ic('brain')} ${esc(b.personality.join(', '))}`) : '')
        + (b.appearance.length ? note(`${ic('eye')} ${esc(b.appearance.join(', '))}`) : '')
        + (b.condition && b.conditionKnown ? note(`${ic('star')} ${esc(b.condition)}`, 'special') : '')
        + (miles ? note(`${ic('star')} ${esc(miles)}`) : '')
        + (need.note ? note(`${ic('lightbulb')} ${esc(need.note)}`, 'rec') : '');
    return card(`b-${b.id}`, 'baby', 'baby', esc(labelOf(b)), `<span class="ovr-ib-${sexCol}">${sexIcon}</span> ${esc(ageWords(b.age))}`, 'baby', `<div class="ovr-ib-grid">${tiles}${notes}</div>`);
}

function brief(k) {
    const e = C().entities[k], s = S(), reveal = s.infoblockShowHidden, n = esc(nameOf(k));
    if (e.pregnant && (e.known || reveal)) return `${n} ${E.weeksOf(e)} wk`;
    if (e.egg.stage !== 'none' && (e.known || reveal)) return `${n} clutch`;
    if (e.postpartumDays > 0) return `${n} recovery`;
    const hidden = E.isCarrying(e) && !e.known;
    const raw = hidden ? e.cycleDay + (e.pregnant ? e.days : e.egg.carryDays) : e.cycleDay, info = H.cycleInfo(k, raw);
    return `${n} ${raw > s.cycleLength ? `late ${raw - s.cycleLength} d` : `${raw}/${s.cycleLength} ${info.label}`}`;
}

function html() {
    const s = S(), fam = C().family, keys = trackedKeys();
    const cards = keys.map(carrierCard);
    const kids = s.infoblockBabies ? fam.babies : [];
    cards.push(...kids.map(babyCard));
    if (!cards.length) return '';
    if (cards.length === 1) return cards[0];
    const items = keys.map(brief); if (kids.length) items.push(`${kids.length} ${kids.length > 1 ? 'children' : 'child'}`);
    const sub = items.map(t => `<span>${t}</span>`).join('');
    return `<details class="ovr-ib ovr-ib-multi" data-key="main" ${openSet.has('main') ? 'open' : ''}>
        <summary><div class="ovr-ib-header"><div class="ovr-ib-icon cycle">${ic('venus-mars')}</div><div class="ovr-ib-titlebox"><span class="ovr-ib-title">Reproduction</span><div class="ovr-ib-subline">${sub}</div></div><div class="ovr-ib-chev">${ic('chevron-down')}</div></div></summary>
        <div class="ovr-ib-c ovr-ib-multi-body">${cards.join('')}</div></details>`;
}

let timer = null;
export function renderInfoblock() {
    clearTimeout(timer);
    timer = setTimeout(() => {
        $('#chat .ovr-ib-wrap').remove();
        if (!S().enabled || !S().infoblock) return;
        const last = $('#chat .mes').not('.smallSysMes').last();
        if (!last.length) return;
        const inner = html();
        if (!inner) return;
        const wrap = `<div class="ovr-ib-wrap pos-${S().infoblockPosition === 'top' ? 'top' : 'bottom'}">${inner}</div>`;
        const text = last.find('.mes_text').first(), block = last.find('.mes_block').first();
        if (text.length) { if (S().infoblockPosition === 'top') text.before(wrap); else text.after(wrap); }
        else (block.length ? block : last).append(wrap);
    }, 60);
}

document.addEventListener('toggle', e => {
    const d = e.target;
    if (!(d instanceof HTMLDetailsElement) || !d.classList.contains('ovr-ib') || !d.dataset.key) return;
    if (d.open) openSet.add(d.dataset.key); else openSet.delete(d.dataset.key);
    try { localStorage.setItem(OPEN_KEY, JSON.stringify([...openSet])); } catch { /* ignore */ }
}, true);

export function applyCustomCss() {
    let el = document.getElementById('ovr_custom_css');
    if (!el) { el = document.createElement('style'); el.id = 'ovr_custom_css'; document.head.appendChild(el); }
    el.textContent = S().infoblockCss || '';
    applyAccent();
}

// Accent color follows the SillyTavern theme by default (live CSS variables), or a custom color.
export function applyAccent() {
    const s = S(), v = { quote: 'var(--SmartThemeQuoteColor, currentColor)', em: 'var(--SmartThemeEmColor, currentColor)', body: 'var(--SmartThemeBodyColor, currentColor)' }[s.accentSource] || (/^#[0-9a-f]{3,8}$/i.test(s.accentColor) ? s.accentColor : 'var(--SmartThemeQuoteColor, currentColor)');
    const root = document.documentElement.style;
    root.setProperty('--ovr-accent-var', v);
    root.setProperty('--ovr-pop-op', String(Math.max(20, Math.min(100, Number(s.popupOpacity) || 95))));
    root.setProperty('--ovr-ib-op', String(Number.isFinite(Number(s.infoblockOpacity)) ? Math.max(0, Math.min(100, Number(s.infoblockOpacity))) : 100));
}
