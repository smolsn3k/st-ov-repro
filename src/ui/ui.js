// Settings panel (Extensions drawer): global settings, this-chat settings, status cards, children, family tree, history.
import { ctx, S, C, saveS, saveC, PHYS, ERAS, CONTRA, contraLabel, contraProtection, trackedKeys, nameOf, hooks, showDate, dateLabel, hasDate } from '../core/core.js';
import * as E from '../logic/engine.js';
import * as H from '../logic/health.js';
import * as D from '../core/data.js';
import { profiles, analyzeAppearance } from '../logic/analyze.js';
import { resolveWhen, toDays } from '../core/dates.js';
import { analyzeLatest } from '../logic/pipeline.js';
import { labelOf, ageWords, stageOf, careNeeds, careNorms, nowHours, MILESTONES, archiveBabies } from '../logic/baby.js';
import { buildPrompt, updatePrompt } from '../logic/prompt.js';
import { renderInfoblock, applyCustomCss } from './infoblock.js';

const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const opts = (obj, cur, labelKey = 'label') => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(v[labelKey])}</option>`).join('');
let showPreview = false;

const SLEEP_OPTS = ['', 'asleep', 'awake', 'drowsy', 'napping'], FEED_OPTS = ['', 'breast', 'formula', 'mixed', 'solids'], HEALTH_OPTS = ['normal', 'fever', 'cold', 'sick', 'injured', 'recovering'];
const sel = (list, cur, attrs) => `<select class="text_pole" ${attrs}>${list.map(v => `<option value="${v}" ${v === cur ? 'selected' : ''}>${v || '(auto)'}</option>`).join('')}</select>`;
const sexWord = x => (x === 'M' ? 'boy' : 'girl');

// ── Open/closed state of collapsible sections survives re-renders ──
const OPEN_KEY = 'ovr_open_sections';
let openSecs;
try { openSecs = new Set(JSON.parse(localStorage.getItem(OPEN_KEY) || 'null') || ['chat', 'status', 'children']); } catch { openSecs = new Set(['chat', 'status', 'children']); }
const saveOpen = () => { try { localStorage.setItem(OPEN_KEY, JSON.stringify([...openSecs])); } catch { /* ignore */ } };
const sec = (id, title, body, cls = '') => `<details class="ovr-sec ${cls}" data-sec="${id}" ${openSecs.has(id) ? 'open' : ''}><summary>${title}</summary><div class="ovr-sec-body">${body}</div></details>`;
function scrollParent(el) {
    for (let p = el?.parentElement; p; p = p.parentElement) {
        const oy = getComputedStyle(p).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    }
    return null;
}
const bar = (cur, max, cls = '') => `<div class="ovr-bar"><div class="ovr-bar-fill ${cls}" style="width:${Math.max(0, Math.min(100, max ? (cur / max) * 100 : 0))}%"></div></div>`;
const BADGE = { heat: 'hot', rut: 'hot', pre: 'warm', quiet: 'calm', suppressed: 'calm', pregnant: 'preg', egg_gravid: 'egg', egg_laying: 'egg', egg_incubating: 'egg', egg_hatching: 'egg', postpartum: 'post', lactating: 'post' };


// ── Modal dialogs ──
function modal(title, body, buttons) {
    $('.ovr-modal').remove();
    const m = $(`<div class="ovr-modal"><div class="ovr-modal-box"><h4>${title}</h4><div class="ovr-modal-body">${body}</div><div class="ovr-btns ovr-modal-btns"></div></div></div>`);
    buttons.forEach(b => {
        const el = $(`<div class="menu_button ovr-btn">${b.label}</div>`);
        el.on('click', () => { b.onClick?.(m); m.remove(); saveC(); refresh(); });
        m.find('.ovr-modal-btns').append(el);
    });
    $('body').append(m);
}

function openBirthDialog(ids, k) {
    const fam = C().family, list = ids.map(id => fam.babies.find(b => b.id === id)).filter(Boolean);
    if (!list.length || list.every(b => b.name)) return;
    const rows = list.map(b => `<label class="ovr-row"><span>${sexWord(b.sex)}${b.condition ? ' <small>(special care needed)</small>' : ''}</span><input type="text" class="text_pole" data-bid="${b.id}" value="${esc(b.name)}" placeholder="name (optional)"></label>`).join('');
    modal(`${esc(nameOf(k))}: ${list.length > 1 ? 'the babies are here' : 'the baby is here'}`, `<small>Name the ${list.length > 1 ? 'babies' : 'baby'} now, or leave blank to name later.</small>${rows}`,
        [{ label: 'Save names', onClick: m => m.find('[data-bid]').each((_, el) => { const b = fam.babies.find(x => x.id === +el.dataset.bid); if (b) b.name = el.value.trim().slice(0, 40); }) }, { label: 'Skip' }]);
}

function openGradDialog(ids) {
    const fam = C().family, list = ids.map(id => fam.babies.find(b => b.id === id)).filter(Boolean);
    if (!list.length) return;
    const rows = list.map(b => `<label class="checkbox_label"><input type="checkbox" data-gid="${b.id}" checked><span>${esc(labelOf(b))} (${ageWords(b.age)}, ${stageOf(b.age).label.toLowerCase()})</span></label>`).join('');
    modal('Children growing up', `<small>These children are past the baby-care age. Move them to the older children list? They will stop receiving baby-care details in the prompt.</small>${rows}`,
        [{ label: 'Move selected', onClick: m => archiveBabies(m.find('[data-gid]:checked').map((_, el) => +el.dataset.gid).get()) }, { label: 'Keep as children' }]);
}

// ── Cards ──
function babyCard(b) {
    const need = careNeeds(b), norm = careNorms(b.age, b), st = stageOf(b.age);
    const row = (label, html) => `<label class="ovr-row"><span>${label}</span>${html}</label>`;
    const f = key => `data-baby="${b.id}" data-f="${key}"`;
    const chips = b.milestones.map(m => `<span class="ovr-chip">${esc(m.text)}</span>`).join('') || '<small>none yet</small>';
    return `<div class="ovr-card"><div><b>${esc(labelOf(b))}</b> <small>${sexWord(b.sex)}, ${esc(nameOf(b.parent))}'s ${b.via === 'hatch' ? 'hatchling' : 'child'}${b.otherParent ? ` with ${esc(b.otherParent)}` : ''}, ${ageWords(b.age)} (${st.label})${b.method === 'csection' ? ', C-section' : ''}</small></div>
    ${b.condition ? `<small>Born with: ${esc(b.condition)}${b.conditionKnown ? '' : ' (not yet noticed in story)'}</small>` : ''}
    <small>Now: ${need.sleep}, feeding ${need.feeding}, diaper ${need.diaper}${need.note ? ', ' + esc(need.note) : ''}</small>
    <small>Typical for this age: ${esc(norm.feeding)}; ${esc(norm.sleep)}.${b.teething ? ' Teething.' : ''}${b.colicky ? ' Colic phase.' : ''}${norm.upcoming ? ' Soon: ' + esc(norm.upcoming) + '.' : ''}</small>
    ${row('Name', `<input type="text" class="text_pole" ${f('name')} value="${esc(b.name)}" placeholder="unnamed">`)}
    ${row('Health', sel(HEALTH_OPTS, b.health, f('health')))}
    ${row('Mood', `<input type="text" class="text_pole" ${f('mood')} value="${esc(b.mood)}" placeholder="calm, fussy...">`)}
    ${row('Sleep', sel(SLEEP_OPTS, b.sleep, f('sleep')))}
    ${row('Feeding', sel(FEED_OPTS, b.feeding, f('feeding')))}
    ${row('Personality', `<input type="text" class="text_pole" ${f('personality')} value="${esc(b.personality.join(', '))}" placeholder="comma separated">`)}
    ${row('Appearance', `<input type="text" class="text_pole" ${f('appearance')} value="${esc(b.appearance.join(', '))}" placeholder="comma separated">`)}
    <div><small>Milestones (${b.milestones.length}/${MILESTONES.length}):</small> ${chips}</div>
    <div class="ovr-btns">
        <div class="menu_button ovr-btn" data-act="fed" data-b="${b.id}">Fed</div>
        <div class="menu_button ovr-btn" data-act="changed" data-b="${b.id}">Diaper changed</div>
        <div class="menu_button ovr-btn" data-act="grow" data-b="${b.id}">Move to older children</div>
        <div class="menu_button ovr-btn" data-act="delbaby" data-b="${b.id}">Remove</div></div></div>`;
}

const numField = (key, label, min, max, step = 1) => `<label class="ovr-field"><span>${label}</span><input type="number" class="text_pole" data-g="${key}" min="${min}" max="${max}" step="${step}" value="${S()[key]}"></label>`;
const chk = (key, label) => `<label class="ovr-switch"><input type="checkbox" data-g="${key}" ${S()[key] ? 'checked' : ''}><span class="ovr-slider"></span><span class="ovr-switch-label">${label}</span></label>`;
const rng = (key, label, min, max, step = 5) => `<label class="ovr-field"><span>${label}: <b data-rv="${key}">${S()[key]}%</b></span><input type="range" data-gr="${key}" min="${min}" max="${max}" step="${step}" value="${S()[key]}"></label>`;
const grid = (...f) => `<div class="ovr-grid">${f.join('')}</div>`;
const ep = (k, path, type, val, extra = '') => `<input type="${type}" class="text_pole" data-ent="${k}" data-path="${path}" ${type === 'checkbox' ? (val ? 'checked' : '') : `value="${esc(val)}"`} ${extra}>`;

function complicationRows(k) {
    const e = C().entities[k], h = e.health, rows = [];
    h.complications.forEach((c, i) => { if (c.active && !c.resolved) rows.push(`<div class="menu_button ovr-btn" data-act="resolvec" data-k="${k}" data-kind="p" data-i="${i}">Resolve: ${esc(D.COMPLICATIONS.find(x => x.id === c.id).label)}</div>`); });
    h.eggPlanned.forEach((c, i) => { if (c.active && !c.resolved) rows.push(`<div class="menu_button ovr-btn" data-act="resolvec" data-k="${k}" data-kind="e" data-i="${i}">Resolve: ${esc(D.EGG_COMPLICATIONS.find(x => x.id === c.id).label)}</div>`); });
    return rows.length ? `<div class="ovr-btns">${rows.join('')}</div>` : '';
}

function card(k) {
    const c = C(), e = c.entities[k], ph = E.phase(k), phys = PHYS[c.physiology[k]], s = S(), h = e.health, prac = H.practitioner(), ep_ = H.era();
    const live = c.repro[k] !== 'oviposition', carrying = E.isCarrying(e);
    // progress toward the next milestone of the current phase
    let prog = null;
    if (e.pregnant) prog = [E.weeksOf(e), s.termWeeks, `week ${E.weeksOf(e)} of ${s.termWeeks}`];
    else if (e.egg.stage === 'gravid') prog = [e.egg.carryDays, s.eggCarryDays, `day ${e.egg.carryDays} of ${s.eggCarryDays}`];
    else if (e.egg.stage === 'incubating') prog = [e.egg.incubDays, s.eggIncubationDays, `day ${e.egg.incubDays} of ${s.eggIncubationDays}`];
    else if (e.postpartumDays > 0 && e.postpartumDays <= H.postpartumLength(k)) prog = [e.postpartumDays, H.postpartumLength(k), `day ${e.postpartumDays} of ${H.postpartumLength(k)}`];
    else if (!carrying && !e.postpartumDays) prog = [e.cycleDay, s.cycleLength, `cycle day ${e.cycleDay} of ${s.cycleLength}`];

    const head = `<div class="ovr-card-head"><div><b>${esc(nameOf(k))}</b> <span class="ovr-pill">${phys.label}</span> <span class="ovr-pill soft">${live ? 'live birth' : 'oviposition'}</span></div><span class="ovr-badge ${BADGE[ph.id] || 'calm'}">${esc(ph.label)}</span></div>`;
    const top = [];
    if (prog) top.push(`${bar(prog[0], prog[1], BADGE[ph.id] || '')}<small class="ovr-dim">${prog[2]}</small>`);
    if (ph.fertility > 0) top.push(`<small>Conception odds per qualifying event: <b>${Math.round(E.conceptionOdds(k) * 100)}%</b></small>`);
    if (!carrying && !e.postpartumDays) { const sy = H.phaseSymptoms(k, ph.id, 3); if (sy.length) top.push(`<small class="ovr-dim">${esc(sy.join(' · '))}</small>`); }
    if (e.postpartumDays > 0) { const st = H.postpartumStage(k); if (st) top.push(`<small class="ovr-dim">${esc(st.label)}: ${esc(st.sym.slice(0, 3).join(' · '))}</small>`); }
    if (!(carrying && !e.known)) { const fl = H.feelFor(k); top.push(`<small>Mood: <b>${esc(fl.mood)}</b> · Physical: <b>${esc(fl.physical)}</b> · Libido: <b>${esc(fl.libido)}</b>${fl.observed.mood || fl.observed.physical || fl.observed.libido ? ' <span class="ovr-dim">(from the story)</span>' : ''}</small>`); }
    if (carrying) top.push(`<small>Known in story: <b>${e.known ? 'yes' : 'no (hidden)'}</b></small>`);

    const chips = [];
    h.complications.forEach(cc => { if (cc.active || cc.resolved) { const d = D.COMPLICATIONS.find(x => x.id === cc.id); chips.push(`<span class="ovr-chip sev-${cc.resolved ? 'ok' : d.severity}">${esc(d.label)}${cc.resolved ? ' ✓' : ''}</span>`); } });
    h.eggPlanned.forEach(cc => { if (cc.active || cc.resolved) { const d = D.EGG_COMPLICATIONS.find(x => x.id === cc.id); chips.push(`<span class="ovr-chip sev-${cc.resolved ? 'ok' : d.severity}">${esc(d.label)}${cc.resolved ? ' ✓' : ''}</span>`); } });
    const healthBox = (chips.length ? `<div>${chips.join('')}</div>` : '') + complicationRows(k)
        + (h.visit.date ? `<small class="ovr-dim">Last visit (${showDate(h.visit.date)}): ${esc(h.visit.note)}</small>` : '')
        + (h.test.result ? `<small class="ovr-dim">Last test (${showDate(h.test.date)}): ${esc(h.test.result)}</small>` : '')
        + (e.setback ? `<small>Setback: <b>${esc(H.setbackLabel(e.setback))}</b>${e.setback.resolved ? ` · the heat/rut came ${e.setback.used} d late` : ` · +${e.setback.shift} d${e.setback.used ? ` · overdue ${e.setback.used} d` : ''}`} · cause <b>${e.setback.known ? 'known to the characters' : 'not known to the characters'}</b></small>` : '')
        + (e.disruption && !e.setback ? `<small class="ovr-dim">Last disruption: ${esc(D.DISRUPTIONS[e.disruption.kind].label)} (${showDate(e.disruption.date)})</small>` : '');

    let pregBox = '';
    if (e.pregnant) {
        const p = H.pregStatus(k);
        const fetal = h.fetal ? `<small>Fetal condition: ${esc(D.FETAL_DISEASES.find(x => x.id === h.fetal.id).label)} (${h.fetal.known ? 'found at an exam' : 'not found yet'})</small>` : '';
        pregBox = sec(`card-${k}-preg`, 'Pregnancy details', `<div class="ovr-kv"><span>Due</span><b>${showDate(E.dueDate(e))}</b><span>Trimester</span><b>${E.trimester(p.week)}</b><span>Baby size</span><b>${esc(p.size)}</b><span>Movement</span><b>${esc(p.movement)}</b><span>Position</span><b>${esc(p.position)}</b><span>Practice contractions</span><b>${esc(p.braxton)}</b><span>Swelling</span><b>${esc(p.swelling)}</b><span>Libido</span><b>${esc(p.libido)}</b><span>Weight gain</span><b>${esc(p.weight)}</b></div>
            <small>Sensations: ${esc(p.symptoms.join('; '))}</small><small>Advice: ${esc(p.advice)}</small>
            <small>Babies: <b>${e.fetusCount}</b> (${h.confirm.count ? 'confirmed' : 'not confirmed in story'}) · sex: <b>${esc(e.fetusSex.map(sexWord).join(', '))}</b> (${h.confirm.sex ? 'confirmed' : 'not confirmed'})</small>${fetal}`, 'ovr-inner');
    }
    let eggBox = '';
    if (e.egg.stage !== 'none') {
        const rows = e.eggs.map((g, i) => { const bits = [g.shell && D.SHELL_DEFECTS.find(x => x.id === g.shell).label, g.embryo && D.EMBRYO_DISEASES.find(x => x.id === g.embryo).label].filter(Boolean); return `<small>Egg ${i + 1}: ${esc(bits.join(' + ') || 'healthy')}${g.fate === 'fail' ? ' (will not hatch)' : ''} <span class="ovr-dim">(${g.known ? 'found' : 'not found yet'})</span></small>`; }).join('');
        eggBox = sec(`card-${k}-egg`, 'Clutch details', `<small>${e.egg.count} eggs, ${e.egg.laid} laid · nest: ${esc(e.nest.state)}</small>${rows}`, 'ovr-inner');
    }

    const btn = (act, label, extra = '') => `<div class="menu_button menu_button_icon ovr-btn" data-act="${act}" data-k="${k}" ${extra}>${label}</div>`;
    const b = [btn('adv', '+1 day', 'data-n="1"'), btn('adv', '+7 days', 'data-n="7"')];
    if (E.canConceive(k)) b.push(btn('conceive', 'Force conception'));
    if (carrying && !e.known) b.push(btn('reveal', 'Reveal in story'));
    if (e.pregnant) b.push(btn('birth', e.deliveryMethod === 'csection' ? 'Give birth (C-section)' : 'Give birth'));
    if (['gravid', 'laying_due'].includes(e.egg.stage)) b.push(btn('lay', 'Lay all eggs'));
    if (['incubating', 'hatch_due'].includes(e.egg.stage)) b.push(btn('hatch', 'Hatch eggs'));
    if (carrying) { const cd = H.visitCooldownLeft(k); b.push(btn('visit', `Visit ${esc(prac)}${cd ? ` (${cd}d)` : ''}`)); b.push(btn('end', 'End')); }
    if (ep_.test) b.push(btn('test', `Take ${esc(ep_.test.name)}`));

    const f = [];
    if (!carrying && !e.postpartumDays) f.push(`<label class="ovr-field"><span>Cycle day</span><input type="number" class="text_pole" data-ent="${k}" data-f="cycleDay" min="1" max="${s.cycleLength}" value="${e.cycleDay}"></label>`);
    if (e.pregnant) {
        f.push(`<label class="ovr-field"><span>Weeks</span><input type="number" class="text_pole" data-ent="${k}" data-f="weeks" min="0" max="60" value="${E.weeksOf(e)}"></label>`);
        f.push(`<label class="ovr-field"><span>Delivery method</span><select class="text_pole" data-ent="${k}" data-path="deliveryMethod"><option value="natural" ${e.deliveryMethod === 'natural' ? 'selected' : ''}>Natural</option><option value="csection" ${e.deliveryMethod === 'csection' ? 'selected' : ''}>C-section</option></select></label>`);
    }
    f.push(`<label class="ovr-field"><span>Other parent</span>${ep(k, 'second.name', 'text', e.second.name, `placeholder="${esc(H.secondParentName(k))}"`)}</label>`);
    f.push(`<label class="ovr-field"><span>Other parent appearance</span>${ep(k, 'second.look', 'text', e.second.look, 'placeholder="e.g. blue eyes, blond hair"')}</label>`);
    if (carrying) {
        const n = e.pregnant ? e.fetusCount : e.egg.count;
        for (let i = 0; i < n; i++) f.push(`<label class="ovr-field"><span>${e.pregnant ? 'Baby' : 'Egg'} ${i + 1} name</span>${ep(k, `babyNames.${i}`, 'text', e.babyNames[i] || '', 'placeholder="unnamed (picked up from chat)"')}</label>`);
    }
    if (!live || e.egg.stage !== 'none') f.push(`<label class="ovr-field"><span>Nest</span><select class="text_pole" data-ent="${k}" data-path="nest.state">${Object.keys(D.NEST).map(n => `<option value="${n}" ${e.nest.state === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`);
    f.push(`<label class="ovr-field"><span>Mood (from chat or manual)</span>${ep(k, 'feel.mood', 'text', e.feel.mood, 'placeholder="auto"')}</label>`);
    f.push(`<label class="ovr-field"><span>Physical state</span>${ep(k, 'feel.physical', 'text', e.feel.physical, 'placeholder="auto"')}</label>`);
    f.push(`<label class="ovr-field"><span>Libido</span><select class="text_pole" data-ent="${k}" data-path="feel.libido"><option value="">Auto (from mood and phase)</option>${H.LIBIDO.map(l => `<option value="${l}" ${e.feel.libido === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`);
    const tog = [];
    if (s.tryingMode && E.canConceive(k)) tog.push(`<label class="ovr-switch"><input type="checkbox" data-ent="${k}" data-path="trying.on" ${e.trying.on ? 'checked' : ''}><span class="ovr-slider"></span><span class="ovr-switch-label">Trying for a baby${e.trying.on ? ` (${e.trying.cycles} cycle${e.trying.cycles === 1 ? '' : 's'})` : ''}</span></label>`);
    if (e.postpartumDays > 0) tog.push(`<label class="ovr-switch"><input type="checkbox" data-ent="${k}" data-path="postpartum.lactating" ${e.postpartum.lactating ? 'checked' : ''}><span class="ovr-slider"></span><span class="ovr-switch-label">Lactating</span></label>`);
    if (e.setback && !e.setback.resolved) tog.push(`<label class="ovr-switch"><input type="checkbox" data-ent="${k}" data-path="setback.known" ${e.setback.known ? 'checked' : ''}><span class="ovr-slider"></span><span class="ovr-switch-label">Characters know the cause of the delay</span></label>`);
    const extra = [];
    if (e.setback) extra.push(`<div class="ovr-inline">${btn('clearsb', 'Clear setback')}</div>`);
    if (s.disruptionsEnabled && !carrying) extra.push(`<div class="ovr-inline"><select class="text_pole" id="ovr_dis_${k}">${Object.entries(D.DISRUPTIONS).map(([id, d]) => `<option value="${id}">${d.label}</option>`).join('')}</select>${btn('disrupt', 'Apply disruption')}</div>`);
    if (live && E.canConceive(k)) extra.push(`<div class="ovr-inline"><input type="text" class="text_pole" id="ovr_mp_d_${k}" placeholder="conceived: today, 10 days ago, 12 May..." title="When it happened: blank or today, '10 days ago', or a date your story uses"><input type="number" class="text_pole ovr-small" id="ovr_mp_n_${k}" min="1" max="4" value="1" title="babies"><input type="text" class="text_pole" id="ovr_mp_p_${k}" placeholder="other parent">${btn('startpreg', 'Start pregnancy')}</div>`);
    const opts_ = sec(`card-${k}-opts`, 'Details and options', `${grid(...f)}${tog.length ? `<div class="ovr-switches">${tog.join('')}</div>` : ''}${extra.join('')}`, 'ovr-inner');

    return `<div class="ovr-card">${head}${top.join('')}${healthBox ? `<div class="ovr-health">${healthBox}</div>` : ''}${pregBox}${eggBox}${opts_}<div class="ovr-btns">${b.join('')}</div></div>`;
}

// Visual family tree: couples at the top, connector lines down to each child.
function tree() {
    const fam = C().family;
    const kids = [...fam.babies, ...fam.grown.map(g => ({ ...g, grown: true, milestones: [] }))];
    if (!kids.length) return '<small>No children yet.</small>';
    const groups = new Map();
    for (const b of kids) {
        const a = nameOf(b.parent), o = b.otherParent || H.secondParentName(b.parent), key = [a, o].sort().join('\u0000');
        if (!groups.has(key)) groups.set(key, { couple: [a, o], kids: [] });
        groups.get(key).kids.push(b);
    }
    const kid = b => `<div class="ovr-ft-kid"><div class="ovr-ft-node ${b.sex === 'M' ? 'boy' : 'girl'} ${b.grown ? 'old' : ''}" title="${esc((b.appearance || []).join(', '))}"><b>${esc(b.name || `Baby${b.id}`)}</b><small>${sexWord(b.sex)}, ${ageWords(b.age)}${b.via === 'hatch' ? ', hatched' : ''}${b.method === 'csection' ? ', C-section' : ''}${b.grown ? ', older' : ''}</small>${(b.milestones || []).length ? `<small class="ovr-dim">${b.milestones.slice(-1)[0].text}</small>` : ''}</div></div>`;
    return `<div class="ovr-ft-wrap">${[...groups.values()].map(g => `<div class="ovr-ft"><div class="ovr-ft-couple"><span class="ovr-ft-node par">${esc(g.couple[0])}</span><span class="ovr-ft-heart">&hearts;</span><span class="ovr-ft-node par">${esc(g.couple[1])}</span></div><div class="ovr-ft-stem"></div><div class="ovr-ft-kids">${g.kids.map(kid).join('')}</div></div>`).join('')}</div>`;
}

function addChildForm() {
    const c = C();
    return `<div class="ovr-grid">
        <label class="ovr-field"><span>Name</span><input type="text" class="text_pole" id="ovr_ac_name" placeholder="optional"></label>
        <label class="ovr-field"><span>Sex</span><select class="text_pole" id="ovr_ac_sex"><option value="F">Girl</option><option value="M">Boy</option></select></label>
        <label class="ovr-field"><span>Carried by</span><select class="text_pole" id="ovr_ac_parent"><option value="user">${esc(nameOf('user'))}</option><option value="char">${esc(nameOf('char'))}</option></select></label>
        <label class="ovr-field"><span>Other parent</span><input type="text" class="text_pole" id="ovr_ac_other" placeholder="default: the other character"></label>
        <label class="ovr-field"><span>Born (blank = today)</span><input type="text" class="text_pole" id="ovr_ac_born" placeholder="today, 3 weeks ago, 12 May..."></label>
        <label class="ovr-field"><span>Origin</span><select class="text_pole" id="ovr_ac_via"><option value="birth">Born</option><option value="hatch">Hatched</option></select></label>
        <label class="ovr-field"><span>Delivery</span><select class="text_pole" id="ovr_ac_method"><option value="natural">Natural</option><option value="csection">C-section</option></select></label></div>
        <div class="ovr-btns"><div class="menu_button ovr-btn" data-act="addchild">Add child</div></div>`;
}

export function render() {
    const body = $('#ovr_body');
    if (!body.length) return;
    const s = S(), c = C(), pf = profiles();
    const profOpts = `<option value="">Main API (current connection)</option>` + pf.map(p => `<option value="${esc(p.id)}" ${p.id === s.apiProfile ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    const physRow = k => `<div class="ovr-row"><span>${esc(nameOf(k))}</span>
        <select class="text_pole" data-c="physiology.${k}">${opts(PHYS, c.physiology[k])}</select>
        <select class="text_pole" data-c="repro.${k}"><option value="live" ${c.repro[k] === 'live' ? 'selected' : ''}>Live birth</option><option value="oviposition" ${c.repro[k] === 'oviposition' ? 'selected' : ''}>Oviposition</option></select></div>`;
    const conOpts = cur => Object.keys(CONTRA).map(id => `<option value="${id}" ${id === cur ? 'selected' : ''}>${esc(contraLabel(id))}</option>`).join('');
    const conRow = k => `<label class="ovr-row"><span>${esc(nameOf(k))}</span><select class="text_pole" data-c="contraception.${k}">${conOpts(c.contraception[k])}</select></label>`;
    const looksRow = k => `<label class="ovr-row"><span>${esc(nameOf(k))}</span><input type="text" class="text_pole" data-c="looks.${k}.text" value="${esc(c.looks[k].text)}" placeholder="e.g. brown eyes, black hair, tall"></label>`;

    const g = {
        api: `<label class="ovr-field wide"><span>How to detect</span><select class="text_pole" data-g="detectMode"><option value="both" ${s.detectMode === 'both' ? 'selected' : ''}>Both: tags for date, mood and events, analyzer as backup</option><option value="tags" ${s.detectMode === 'tags' ? 'selected' : ''}>Tags only: free, no extra API calls</option><option value="analyzer" ${s.detectMode === 'analyzer' ? 'selected' : ''}>Analyzer only: a separate model reads the chat</option></select></label>
            <small class="ovr-dim">${{ tags: 'The roleplay model ends each reply with hidden comment tags (date, mood and status, one-time events) that are read locally. No extra API calls, costs a few prompt tokens, and only works if the model follows the instruction.', analyzer: 'A separate model call reads the latest messages. Works with any roleplay model but each run is an API request.', both: 'Tags give date, mood and the common events for free. The analyzer only runs for things tags do not carry (children and names, visits, nests...) and as a backup when a reply has no tags.' }[s.detectMode] || ''}</small>
            <div class="ovr-btns"><div class="menu_button ovr-btn" data-act="analyzenow" title="Run the analyzer once on the latest message, whatever the mode">Analyze now</div></div>
            <label class="ovr-field wide"><span>Track</span><select class="text_pole" data-g="track"><option value="user" ${s.track === 'user' ? 'selected' : ''}>User only</option><option value="char" ${s.track === 'char' ? 'selected' : ''}>Bot only</option><option value="both" ${s.track === 'both' ? 'selected' : ''}>Both</option></select></label>
            <label class="ovr-field wide"><span>API profile</span><select class="text_pole" data-g="apiProfile">${profOpts}</select></label>
            ${pf.length ? '' : '<small class="ovr-dim">No Connection Manager profiles found; the main API is used.</small>'}
            <div class="ovr-switches">${chk('autoAnalyze', 'Analyze messages for events')}${chk('smartFilter', 'Only analyze when the text looks relevant')}${chk('trackFeelings', 'Track mood, physical state and libido from the chat')}</div>${grid(numField('analyzeDepth', 'Messages sent to analyzer', 1, 10), numField('feelInterval', s.detectMode === 'both' ? 'Backup mood check every N messages (only when a reply has no tags)' : 'Mood check every N messages', 1, 50), numField('feelDays', 'Mood stays valid, story days', 1, 30), numField('dateScanDepth', 'Messages scanned for tags and dates', 1, 30))}`,
        cycle: `${grid(numField('conceptionChance', 'Conception chance at peak, %', 0, 100), numField('cycleLength', 'Cycle length, days', 10, 120), numField('heatDuration', 'Heat/rut duration, days', 1, 14))}
            <small class="ovr-dim">Protection of each contraception method (how much it lowers conception chance):</small>
            ${grid(...['condom', 'pill', 'iud', 'suppressant'].map(id => `<label class="ovr-field"><span>${esc(CONTRA[id].label)}, %</span><input type="number" class="text_pole" data-prot="${id}" min="0" max="100" value="${contraProtection(id)}"></label>`))}
            <div class="ovr-switches">${chk('tryingMode', 'Trying-for-a-baby mode')}${chk('disruptionsEnabled', 'Cycle disruptions')}</div>`,
        live: `${grid(numField('termWeeks', 'Pregnancy length, weeks', 8, 60), numField('twinsChance', 'Twins chance, %', 0, 100, 0.1), numField('tripletsChance', 'Triplets chance, %', 0, 100, 0.1), numField('doctorCooldown', 'Visit cooldown, days', 0, 60), numField('complicationChance', 'Complication multiplier, %', 0, 300), numField('fetalDiseaseChance', 'Fetal disease chance, %', 0, 100, 0.5))}
            <div class="ovr-switches">${chk('complicationsEnabled', 'Pregnancy complications')}${chk('fetalDiseasesEnabled', 'Fetal diseases')}</div>`,
        ovi: `${grid(numField('clutchMin', 'Clutch size, min', 1, 20), numField('clutchMax', 'Clutch size, max', 1, 20), numField('eggCarryDays', 'Egg carrying, days', 1, 120), numField('eggIncubationDays', 'Incubation, days', 1, 200), numField('embryoChance', 'Embryo disease chance, %', 0, 100, 0.5), numField('shellChance', 'Shell defect chance, %', 0, 100, 0.5))}
            <div class="ovr-switches">${chk('eggComplicationsEnabled', 'Egg complications')}${chk('embryoDiseasesEnabled', 'Embryo diseases')}${chk('shellDefectsEnabled', 'Shell defects')}${chk('nestRisk', 'Unprepared nest can cost eggs')}</div>`,
        post: `${grid(numField('recoveryDays', 'Recovery (natural), days', 1, 180), numField('lactationReturnDays', 'Lactation suppresses cycle, days', 30, 720), numField('babyMaxAgeDays', 'Offer "older" after, days', 30, 7300))}
            <div class="ovr-switches">${chk('lactationDefault', 'Lactation after birth by default')}${chk('inheritAppearance', 'Appearance inheritance')}${chk('autoPickNames', 'Pick up baby names from chat')}${chk('birthDialog', 'Birth dialog')}${chk('graduationDialog', 'Graduation dialog')}</div>`,
        disp: `<div class="ovr-switches">${chk('infoblockDetails', 'Detailed pregnancy / clutch status')}${chk('infoblockBabies', 'Baby status')}${chk('infoblockShowHidden', 'Show hidden pregnancies')}</div>
            ${grid(rng('popupOpacity', 'Popup opacity', 30, 100), rng('infoblockOpacity', 'Infoblock background', 0, 100))}
            ${grid(`<label class="ovr-field"><span>Accent color</span><select class="text_pole" data-g="accentSource"><option value="quote" ${s.accentSource === 'quote' ? 'selected' : ''}>Theme quote color (default)</option><option value="em" ${s.accentSource === 'em' ? 'selected' : ''}>Theme emphasis color</option><option value="body" ${s.accentSource === 'body' ? 'selected' : ''}>Theme text color</option><option value="custom" ${s.accentSource === 'custom' ? 'selected' : ''}>Custom color</option></select></label>`, s.accentSource === 'custom' ? `<label class="ovr-field"><span>Custom accent</span><input type="color" class="text_pole" data-g="accentColor" value="${esc(s.accentColor)}"></label>` : '')}
            <textarea class="text_pole" data-g="infoblockCss" rows="3" placeholder="Custom CSS for the infoblock (classes start with .ovr-ib)">${esc(s.infoblockCss)}</textarea>
            ${grid(numField('historyLimit', 'Undo checkpoints kept', 5, 100), numField('injectDepth', 'Injection depth', 0, 20), `<label class="ovr-field"><span>Numeric date order</span><select class="text_pole" data-g="dateOrder"><option value="DMY" ${s.dateOrder === 'DMY' ? 'selected' : ''}>DD/MM/YYYY</option><option value="MDY" ${s.dateOrder === 'MDY' ? 'selected' : ''}>MM/DD/YYYY</option></select></label>`)}`,
    };

    const sp = scrollParent(body[0]), top = sp ? sp.scrollTop : 0;
    body.html(`
    <div class="ovr-switches top">${chk('enabled', 'Enabled')}${chk('notifications', 'Notifications')}</div>
    <div class="ovr-quick"><div class="ovr-quick-title"><i class="fa-solid fa-message"></i> Chat infoblock</div>
        <div class="ovr-quick-row">${chk('infoblock', 'Show under messages')}
        <select class="text_pole" data-g="infoblockPosition" title="Where the infoblock sits in the latest message"><option value="bottom" ${s.infoblockPosition === 'bottom' ? 'selected' : ''}>Bottom of the message</option><option value="top" ${s.infoblockPosition === 'top' ? 'selected' : ''}>Top of the message</option></select></div>
        <small class="ovr-dim">More infoblock options (details, baby status, hidden pregnancies, custom CSS) are under Global settings, Display and history.</small></div>
    ${sec('settings', 'Global settings', `
        ${sec('g-api', 'Tracking and API', g.api, 'ovr-sub')}${sec('g-cycle', 'Cycle and conception', g.cycle, 'ovr-sub')}
        ${sec('g-live', 'Pregnancy (live birth)', g.live, 'ovr-sub')}${sec('g-ovi', 'Oviposition', g.ovi, 'ovr-sub')}
        ${sec('g-post', 'Postpartum and children', g.post, 'ovr-sub')}${sec('g-disp', 'Display, infoblock and history', g.disp, 'ovr-sub')}`)}
    ${sec('chat', 'This chat', `
        <div class="ovr-kv"><span>Story date</span><b>${hasDate() ? esc(dateLabel()) : 'not detected yet'} <small class="ovr-dim">(${c.date.source})</small></b><span>Time of day</span><b>${c.date.time || 'unknown'}</b><span>Calendar</span><b>${c.date.cal === 'free' ? 'Free text' : c.date.cal === 'iso' ? (c.date.yearless ? 'Real calendar, no year' : 'Real calendar') : 'not set'}</b></div>
        <div class="ovr-inline"><input type="text" class="text_pole" id="ovr_date_in" value="${esc(dateLabel(true))}" placeholder="Any date: 12 May, 3rd of Harvestmoon, Day 14, 4 May 1203"><input type="time" class="text_pole" id="ovr_time_in" value="${c.date.time || ''}">
            <div class="menu_button ovr-btn" data-act="date-adv">Set &amp; advance</div><div class="menu_button ovr-btn" data-act="date-only">Set only</div><div class="menu_button ovr-btn" data-act="date-detect">Re-detect</div></div>
        <div class="ovr-inline"><div class="menu_button ovr-btn" data-act="shift" data-n="1">+1 day</div><div class="menu_button ovr-btn" data-act="shift" data-n="7">+7 days</div><div class="menu_button ovr-btn" data-act="shift" data-n="30">+30 days</div></div>
        <small class="ovr-dim">${c.date.cal === 'free' ? 'This date is free text, so it cannot move time by itself. Time moves from "N days later" in the story or from the + day buttons.' : 'Dates with a day and month (a year is optional) move time forward automatically. Anything else is kept as you wrote it and the + day buttons move time.'}</small>
        <div class="ovr-switches">${`<label class="ovr-switch"><input type="checkbox" id="ovr_date_lock" ${c.date.manual ? 'checked' : ''}><span class="ovr-slider"></span><span class="ovr-switch-label">Lock date (ignore dates found in chat)</span></label>`}</div>
        ${sec('c-phys', 'Physiology and reproduction type', physRow('user') + physRow('char'), 'ovr-sub')}
        ${sec('c-con', 'Contraception', conRow('user') + conRow('char'), 'ovr-sub')}
        ${sec('c-look', 'Appearance for inheritance', `<small class="ovr-dim">One line per person. Eye and hair colors are read from it.</small>${looksRow('user')}${looksRow('char')}<div class="ovr-btns"><div class="menu_button ovr-btn" data-act="analyzelooks">Analyze parents' appearance with AI</div></div>`, 'ovr-sub')}
        ${sec('c-reveal', 'Reveal Mode', `<label class="ovr-row"><span>Era</span><select class="text_pole" data-c="reveal.era">${opts(ERAS, c.reveal.era)}</select></label><small class="ovr-dim">Medical help in this era: ${esc(H.practitioner())}</small>
            ${c.reveal.era === 'custom' ? `<label class="ovr-row"><span>Practitioner</span><input type="text" class="text_pole" data-c="reveal.practitioner" value="${esc(c.reveal.practitioner)}" placeholder="healer, witch doctor, medic..."></label><textarea class="text_pole" data-c="reveal.custom" rows="2" placeholder="How can a pregnancy or clutch be discovered in this setting?">${esc(c.reveal.custom)}</textarea>` : ''}`, 'ovr-sub')}`)}
    ${sec('status', 'Status', trackedKeys().map(card).join(''))}
    ${sec('children', 'Children', `${c.family.babies.map(babyCard).join('') || '<small>No children yet.</small>'}
        ${c.family.grown.length ? `<small class="ovr-dim">Older children: ${c.family.grown.map(x => esc(x.name || 'unnamed') + ' (' + ageWords(x.age) + ')').join(', ')}</small>` : ''}
        ${sec('add-child', 'Add a child manually', addChildForm(), 'ovr-sub')}`)}
    ${sec('tree', 'Family tree', tree())}
    ${sec('history', `Undo history (${c.history.length})`, c.history.length ? c.history.map((h, i) => `<div class="ovr-row"><small>${esc(h.label)}${h.date ? ' · ' + esc(showDate(h.date)) : ''}</small><div class="menu_button ovr-btn" data-act="hist" data-i="${i}">Restore to before this</div></div>`).reverse().join('') : '<small class="ovr-dim">No checkpoints yet. One is saved before every automatic or manual change.</small>')}
    <div class="ovr-btns">
        <div class="menu_button ovr-btn" data-act="undo">Undo last auto change</div>
        <div class="menu_button ovr-btn" data-act="preview">${showPreview ? 'Hide' : 'Show'} injected prompt</div>
        <div class="menu_button ovr-btn" data-act="reset">Reset this chat</div></div>
    ${showPreview ? `<pre class="ovr-pre">${esc(buildPrompt())}</pre>` : ''}`);
    if (sp) sp.scrollTop = top;
}

export function refresh() { updatePrompt(); render(); renderInfoblock(); }

function setPath(obj, path, v) { const p = path.split('.'); const last = p.pop(); p.reduce((o, k) => o[k] ??= (/^\d+$/.test(k) ? [] : {}), obj)[last] = v; }
const val = el => (el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value);
const note = (t, type = 'info') => S().notifications && toastr[type](t, 'Omegaverse');
const syncLock = c => { c.date.manualValue = c.date.manual ? c.date.current : null; c.date.manualText = c.date.manual ? c.date.text : ''; c.date.manualTime = c.date.manual ? c.date.time : null; };

const LABELS = { clearsb: 'Cleared setback', analyzenow: 'Analyze now', shift: 'Date shift', addchild: 'Added child', analyzelooks: 'Appearance analysis', adv: 'Advance time', conceive: 'Conception', birth: 'Birth', lay: 'Laying eggs', hatch: 'Hatching', end: 'Ended', startpreg: 'Manual pregnancy start', disrupt: 'Disruption', visit: 'Visit', test: 'Test', reveal: 'Reveal', resolvec: 'Resolved complication', 'date-adv': 'Date change', 'date-only': 'Date change', fed: 'Fed', changed: 'Diaper changed', grow: 'Moved to older', delbaby: 'Removed child' };

export function mount() {
    if ($('#ovr_root').length) return;
    $('#extensions_settings2').append(`<div id="ovr_root" class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b>Omegaverse Reproduction</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div><div class="inline-drawer-content ovr-scope" id="ovr_body"></div></div>`);
    const root = '#ovr_body';     // handlers are scoped to the body so the panel also works inside the popup
    hooks.onBirth = openBirthDialog;
    hooks.onGrad = openGradDialog;
    applyCustomCss();
    document.addEventListener('toggle', e => {
        const d = e.target;
        if (!(d instanceof HTMLDetailsElement) || !d.dataset.sec || !d.closest('.ovr-scope')) return;
        if (d.open) openSecs.add(d.dataset.sec); else openSecs.delete(d.dataset.sec);
        saveOpen();
    }, true);

    $(document).on('change', `${root} [data-g]`, e => { const el = e.currentTarget; S()[el.dataset.g] = val(el); saveS(); applyCustomCss(); refresh(); });
    $(document).on('input change', `${root} [data-gr]`, e => {
        const el = e.currentTarget; S()[el.dataset.gr] = Number(el.value); applyCustomCss();
        $(`${root} [data-rv="${el.dataset.gr}"]`).text(`${el.value}%`);
        if (e.type === 'change') saveS();
    });
    $(document).on('change', `${root} [data-prot]`, e => {
        const el = e.currentTarget, v = Math.max(0, Math.min(100, Math.round(Number(el.value) || 0)));
        (S().protection ||= {})[el.dataset.prot] = v; saveS(); refresh();
    });
    $(document).on('change', `${root} [data-c]`, e => { const el = e.currentTarget; setPath(C(), el.dataset.c, val(el)); saveC(); refresh(); });
    $(document).on('change', `${root} [data-ent][data-path]`, e => {
        const el = e.currentTarget; setPath(C().entities[el.dataset.ent], el.dataset.path, val(el));
        if (/^feel\./.test(el.dataset.path)) H.touchFeel(el.dataset.ent);
        if (/^babyNames\./.test(el.dataset.path)) { const a = C().entities[el.dataset.ent].babyNames; for (let i = 0; i < a.length; i++) a[i] = a[i] || ''; }
        saveC(); refresh();
    });
    $(document).on('change', `${root} [data-ent][data-f]`, e => {
        const el = e.currentTarget, ent = C().entities[el.dataset.ent], n = Math.max(0, Math.floor(Number(el.value) || 0));
        if (el.dataset.f === 'cycleDay') ent.cycleDay = Math.min(S().cycleLength, Math.max(1, n));
        if (el.dataset.f === 'weeks') ent.days = n * 7;
        saveC(); refresh();
    });
    $(document).on('change', `${root} [data-baby]`, e => {
        const el = e.currentTarget, b = C().family.babies.find(x => x.id === +el.dataset.baby);
        if (!b) return;
        const f = el.dataset.f, v = el.value.trim();
        if (f === 'personality' || f === 'appearance') b[f] = v.split(',').map(x => x.trim()).filter(Boolean).slice(0, 8);
        else b[f] = v;
        saveC(); refresh();
    });
    $(document).on('change', '#ovr_date_lock', e => {
        const c = C(); c.date.manual = e.currentTarget.checked; syncLock(c);
        if (c.date.manual) c.date.source = 'manual'; saveC(); refresh();
    });
    $(document).on('click', `${root} [data-act]`, async e => {
        const el = e.currentTarget, k = el.dataset.k, act = el.dataset.act, c = C(), n = nameOf(k || 'user');
        const done = msg => { if (msg) note(msg); saveC(); refresh(); };
        if (LABELS[act]) E.checkpoint(`${LABELS[act]}${k ? ' (' + n + ')' : ''}`);
        switch (act) {
            case 'adv': E.advanceAll(+el.dataset.n); return done();
            case 'conceive': return done(E.conceive(k, true) ? `${n}: conception` : null);
            case 'reveal': c.entities[k].known = true; return done(`${n}: condition revealed in story`);
            case 'birth': return done(E.giveBirth(k) ? `${n} gave birth` : null);
            case 'lay': return done(E.layEggs(k) ? `${n} laid eggs` : null);
            case 'hatch': return done(E.hatchEggs(k) ? `${n}: eggs hatched` : null);
            case 'end': return done(E.loseOrEnd(k) ? `${n}: ended` : null);
            case 'visit': { const r = H.visit(k); return done(r.msg); }
            case 'test': { const r = H.takeTest(k); return done(r.msg); }
            case 'resolvec': { const h = c.entities[k].health, x = (el.dataset.kind === 'e' ? h.eggPlanned : h.complications)[+el.dataset.i]; if (x) { x.resolved = true; x.diagnosed = true; } return done(); }
            case 'clearsb': return done(H.clearSetback(k) ? `${n}: setback cleared` : null);
            case 'disrupt': { const kind = $(`#ovr_dis_${k}`).val(), sh = H.disrupt(k, kind); return done(sh ? `${n}: cycle delayed by ${sh} days` : null); }
            case 'startpreg': {
                const raw = ($(`#ovr_mp_d_${k}`).val() || '').trim(), cnt = Number($(`#ovr_mp_n_${k}`).val()) || 1, p = ($(`#ovr_mp_p_${k}`).val() || '').trim();
                const day = resolveWhen(raw, toDays(c.date.current), S().dateOrder);
                if (day === null) return note(hasDate() ? 'Could not read that conception date. Try "today", "10 days ago" or a date your story uses' : 'Set the story date first', 'warning');
                return done(E.startManualPregnancy(k, day, cnt, [], p) ? `${n}: pregnancy started` : 'Could not start a pregnancy here');
            }
            case 'date-adv': case 'date-only': {
                const v = ($('#ovr_date_in').val() || '').trim();
                if (!v) return note('Type a date first, any text works', 'warning');
                const r = E.applyDateText(v, 'manual', act === 'date-adv');
                if (!r.ok) return note('Type a date first', 'warning');
                const tv = $('#ovr_time_in').val();
                if (/^\d{2}:\d{2}$/.test(tv)) c.date.time = tv;
                syncLock(c);
                return done(r.parsed ? null : 'Saved as free text: time will not move by itself. Use the + day buttons or "N days later" in the story.');
            }
            case 'shift': { E.shiftDate(+el.dataset.n, 'manual'); syncLock(c); return done(); }
            case 'date-detect': { const { refreshDate } = await import('../logic/analyze.js'); if (c.date.manual) { c.date.manual = false; syncLock(c); } refreshDate(); return done(); }
            case 'analyzenow': {
                note('Analyzing the latest message...');
                try { const r = await analyzeLatest(); return r.ok ? done(r.msg) : note(r.msg, 'warning'); }
                catch (err) { return note(`Analysis failed: ${err.message || err}`, 'warning'); }
            }
            case 'fed': case 'changed': {
                const b = c.family.babies.find(x => x.id === +el.dataset.b), now = nowHours();
                if (!b) return;
                if (now === null) return note('Set a story date first so feeding times can be tracked', 'warning');
                if (act === 'fed') b.lastFedH = now; else b.lastChangedH = now;
                return done();
            }
            case 'grow': archiveBabies([+el.dataset.b]); return done();
            case 'delbaby': if (confirm('Remove this child?')) c.family.babies = c.family.babies.filter(x => x.id !== +el.dataset.b); return done();
            case 'addchild': {
                const v = id => $(`#ovr_ac_${id}`).val();
                const bornText = (v('born') || '').trim(), born = bornText ? resolveWhen(bornText, toDays(c.date.current), S().dateOrder) : null;
                if (bornText && born === null) return note('Could not read that birth date. Try "today", "3 weeks ago" or a date your story uses', 'warning');
                const b = E.addManualChild({ name: v('name'), sex: v('sex'), parent: v('parent'), otherParent: (v('other') || '').trim(), born, via: v('via'), method: v('method') });
                return done(`Added ${labelOf(b)}`);
            }
            case 'analyzelooks': {
                note('Analyzing appearance...');
                try {
                    const r = await analyzeAppearance(), put = (o, key, x) => { if (typeof x === 'string' && x.trim() && x.toLowerCase() !== 'null') o[key] = x.trim().slice(0, 120); };
                    put(c.looks.user, 'text', r.user); put(c.looks.char, 'text', r.char);
                    for (const k2 of ['user', 'char']) if (c.entities[k2].second.name) put(c.entities[k2].second, 'look', r.second);
                    return done('Appearance filled in');
                } catch (err) { return note(`Appearance analysis failed: ${err.message || err}`, 'warning'); }
            }
            case 'hist': return done(E.restoreCheckpoint(+el.dataset.i) ? 'Restored to the selected checkpoint' : 'Checkpoint not found');
            case 'undo': return done(E.restoreSnap() ? 'Last automatic change undone' : 'Nothing to undo');
            case 'preview': showPreview = !showPreview; return render();
            case 'reset': if (confirm('Reset all reproduction data for this chat?')) { const m = ctx().chatMetadata; if (m) delete m.omegaverse_repro; saveC(); } return refresh();
        }
    });
    addWandButton();
    render();
}

// ── Wand menu entry + popup ──
let popupOpen = false;
export function closePopup() {
    const pop = $('#ovr_popup');
    if (!pop.length) return;
    const body = $('#ovr_body'), prev = pop.data('prevDisplay');
    body.css('display', prev ?? '');
    $('#ovr_root').append(body);
    pop.remove();
    document.removeEventListener('keydown', escClose, true);
    popupOpen = false;
}
const escClose = e => { if (e.key === 'Escape' && !$('.ovr-modal').length) { e.stopPropagation(); closePopup(); } };

export function openPopup() {
    if (popupOpen) return closePopup();
    const body = $('#ovr_body');
    if (!body.length) return;
    const pop = $(`<div id="ovr_popup" class="ovr-popup"><div class="ovr-popup-box"><div class="ovr-popup-head"><b><i class="fa-solid fa-venus-mars"></i> Omegaverse Reproduction</b><label class="ovr-popup-op" title="Popup opacity"><i class="fa-solid fa-droplet"></i><input type="range" id="ovr_pop_op" min="30" max="100" step="5" value="${S().popupOpacity}"></label><div class="ovr-popup-close menu_button" title="Close">&times;</div></div><div class="ovr-popup-body"></div></div></div>`);
    pop.data('prevDisplay', body[0].style.display);
    pop.find('.ovr-popup-body').append(body);
    body.css('display', 'block');
    pop.on('pointerdown', e => { if (e.target === pop[0]) closePopup(); });
    pop.find('#ovr_pop_op').on('input', e => { S().popupOpacity = Number(e.target.value); applyCustomCss(); }).on('change', () => saveS());
    pop.find('.ovr-popup-close').on('click', closePopup);
    $('body').append(pop);
    document.addEventListener('keydown', escClose, true);
    popupOpen = true;
    render();
}

function addWandButton(tries = 0) {
    if ($('#ovr_wand').length) return;
    const menu = $('#extensionsMenu');
    if (!menu.length) { if (tries < 20) setTimeout(() => addWandButton(tries + 1), 500); return; }
    const item = $(`<div id="ovr_wand" class="list-group-item flex-container flexGap5 interactable" tabindex="0" role="listitem" title="Open Omegaverse Reproduction"><div class="fa-solid fa-venus-mars extensionsMenuExtensionIcon"></div><span>OV Reproduction</span></div>`);
    item.on('click', openPopup).on('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPopup(); } });
    menu.append(item);
}
