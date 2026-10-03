// Settings panel (Extensions drawer): global settings, this-chat settings, status cards, children, family tree, history.
import { ctx, S, C, saveS, saveC, PHYS, ERAS, CONTRA, trackedKeys, nameOf, hooks } from './core.js';
import * as E from './engine.js';
import * as H from './health.js';
import * as D from './data.js';
import { profiles } from './analyze.js';
import { pretty, parseISO } from './dates.js';
import { labelOf, ageWords, stageOf, careNeeds, careNorms, nowHours, MILESTONES, archiveBabies } from './baby.js';
import { buildPrompt, updatePrompt } from './prompt.js';
import { renderInfoblock, applyCustomCss } from './infoblock.js';

const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const opts = (obj, cur, labelKey = 'label') => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(v[labelKey])}</option>`).join('');
let showPreview = false;

const SLEEP_OPTS = ['', 'asleep', 'awake', 'drowsy', 'napping'], FEED_OPTS = ['', 'breast', 'formula', 'mixed', 'solids'], HEALTH_OPTS = ['normal', 'fever', 'cold', 'sick', 'injured', 'recovering'];
const sel = (list, cur, attrs) => `<select class="text_pole" ${attrs}>${list.map(v => `<option value="${v}" ${v === cur ? 'selected' : ''}>${v || '(auto)'}</option>`).join('')}</select>`;
const sexWord = x => (x === 'M' ? 'boy' : 'girl');

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

const numField = (key, label, min, max, step = 1) => `<label class="ovr-row"><span>${label}</span><input type="number" class="text_pole" data-g="${key}" min="${min}" max="${max}" step="${step}" value="${S()[key]}"></label>`;
const chk = (key, label) => `<label class="checkbox_label"><input type="checkbox" data-g="${key}" ${S()[key] ? 'checked' : ''}><span>${label}</span></label>`;
const ep = (k, path, type, val, extra = '') => `<input type="${type}" class="text_pole" data-ent="${k}" data-path="${path}" ${type === 'checkbox' ? (val ? 'checked' : '') : `value="${esc(val)}"`} ${extra}>`;

function complicationRows(k) {
    const e = C().entities[k], h = e.health, rows = [];
    h.complications.forEach((c, i) => {
        if (!c.active && !c.resolved) return;
        const d = D.COMPLICATIONS.find(x => x.id === c.id);
        rows.push(`<div class="ovr-row"><small>${esc(d.label)} <b>[${d.severity}]</b> ${c.resolved ? 'resolved' : c.diagnosed ? 'diagnosed' : 'not yet understood in story'}</small>${c.resolved ? '' : `<div class="menu_button ovr-btn" data-act="resolvec" data-k="${k}" data-kind="p" data-i="${i}">Resolve</div>`}</div>`);
    });
    h.eggPlanned.forEach((c, i) => {
        if (!c.active && !c.resolved) return;
        const d = D.EGG_COMPLICATIONS.find(x => x.id === c.id);
        rows.push(`<div class="ovr-row"><small>${esc(d.label)} <b>[${d.severity}]</b> ${c.resolved ? 'resolved' : c.diagnosed ? 'diagnosed' : 'not yet understood in story'}</small>${c.resolved ? '' : `<div class="menu_button ovr-btn" data-act="resolvec" data-k="${k}" data-kind="e" data-i="${i}">Resolve</div>`}</div>`);
    });
    return rows.join('');
}

function card(k) {
    const c = C(), e = c.entities[k], ph = E.phase(k), phys = PHYS[c.physiology[k]], s = S(), h = e.health, prac = H.practitioner(), ep_ = H.era();
    const live = c.repro[k] !== 'oviposition', carrying = E.isCarrying(e);
    const L = [`<div><b>${esc(nameOf(k))}</b> <small>${phys.label}, ${live ? 'live birth' : 'oviposition'}</small></div>`, `<div>${esc(ph.label)}</div>`];
    if (ph.fertility > 0) L.push(`<small>Conception odds per qualifying event: ${Math.round(E.conceptionOdds(k) * 100)}%</small>`);
    if (!carrying && !e.postpartumDays) { const sy = H.phaseSymptoms(k, ph.id, 3); if (sy.length) L.push(`<small>Sensations: ${esc(sy.join('; '))}</small>`); }
    if (e.pregnant) {
        const p = H.pregStatus(k);
        L.push(`<small>Week ${p.week}, trimester ${E.trimester(p.week)}, due ${pretty(E.dueDate(e))}. Baby size: ${esc(p.size)}.</small>`);
        L.push(`<small>Sensations: ${esc(p.symptoms.join('; '))}</small>`);
        L.push(`<small>Movement: ${esc(p.movement)} · position: ${esc(p.position)} · practice contractions: ${esc(p.braxton)} · swelling: ${esc(p.swelling)} · libido: ${esc(p.libido)} · weight gain: ${esc(p.weight)}</small>`);
        L.push(`<small>Advice: ${esc(p.advice)}</small>`);
        L.push(`<small>Babies: <b>${e.fetusCount}</b> (${h.confirm.count ? 'confirmed' : 'not confirmed in story'}) · sex: <b>${esc(e.fetusSex.map(sexWord).join(', '))}</b> (${h.confirm.sex ? 'confirmed' : 'not confirmed'})</small>`);
        if (h.fetal) { const d = D.FETAL_DISEASES.find(x => x.id === h.fetal.id); L.push(`<small>Fetal condition: ${esc(d.label)} (${h.fetal.known ? 'found at an exam' : 'not found yet'})</small>`); }
    }
    if (e.egg.stage !== 'none') {
        L.push(`<small>${e.egg.count} eggs, ${e.egg.laid} laid</small>`);
        e.eggs.forEach((g, i) => { const bits = [g.shell && D.SHELL_DEFECTS.find(x => x.id === g.shell).label, g.embryo && D.EMBRYO_DISEASES.find(x => x.id === g.embryo).label].filter(Boolean); if (bits.length || g.fate === 'fail') L.push(`<small>Egg ${i + 1}: ${esc(bits.join(' + ') || 'ok')}${g.fate === 'fail' ? ' (will not hatch)' : ''} (${g.known ? 'found' : 'not found yet'})</small>`); });
    }
    if (e.postpartumDays > 0) { const st = H.postpartumStage(k); if (st) L.push(`<small>${esc(st.label)}: ${esc(st.sym.slice(0, 3).join('; '))}</small>`); }
    if (carrying) L.push(`<small>Known in story: <b>${e.known ? 'yes' : 'no (hidden)'}</b></small>`);
    L.push(complicationRows(k));
    if (h.visit.date) L.push(`<small>Last visit (${pretty(h.visit.date)}): ${esc(h.visit.note)}</small>`);
    if (h.test.result) L.push(`<small>Last test (${pretty(h.test.date)}): ${esc(h.test.result)}</small>`);
    if (e.disruption) L.push(`<small>Last disruption: ${esc(D.DISRUPTIONS[e.disruption.kind].label)} (${pretty(e.disruption.date)})</small>`);

    const btn = (act, label, extra = '') => `<div class="menu_button menu_button_icon ovr-btn" data-act="${act}" data-k="${k}" ${extra}>${label}</div>`;
    const b = [btn('adv', '+1 day', 'data-n="1"'), btn('adv', '+7 days', 'data-n="7"')];
    if (E.canConceive(k)) b.push(btn('conceive', 'Force conception'));
    if (carrying && !e.known) b.push(btn('reveal', 'Reveal in story'));
    if (e.pregnant) b.push(btn('birth', e.deliveryMethod === 'csection' ? 'Give birth (C-section)' : 'Give birth'));
    if (['gravid', 'laying_due'].includes(e.egg.stage)) b.push(btn('lay', 'Lay all eggs'));
    if (['incubating', 'hatch_due'].includes(e.egg.stage)) b.push(btn('hatch', 'Hatch eggs'));
    if (carrying) { const cd = H.visitCooldownLeft(k); b.push(btn('visit', `Visit ${esc(prac)}${cd ? ` (${cd}d)` : ''}`)); b.push(btn('end', 'End')); }
    if (ep_.test) b.push(btn('test', `Take ${esc(ep_.test.name)}`));

    const fields = [];
    if (!carrying && !e.postpartumDays) fields.push(`<label class="ovr-row"><span>Cycle day</span><input type="number" class="text_pole ovr-small" data-ent="${k}" data-f="cycleDay" min="1" max="${s.cycleLength}" value="${e.cycleDay}"></label>`);
    if (e.pregnant) fields.push(`<label class="ovr-row"><span>Weeks</span><input type="number" class="text_pole ovr-small" data-ent="${k}" data-f="weeks" min="0" max="60" value="${E.weeksOf(e)}"></label>`);
    if (e.pregnant) fields.push(`<label class="ovr-row"><span>Delivery method</span><select class="text_pole" data-ent="${k}" data-path="deliveryMethod"><option value="natural" ${e.deliveryMethod === 'natural' ? 'selected' : ''}>Natural</option><option value="csection" ${e.deliveryMethod === 'csection' ? 'selected' : ''}>C-section</option></select></label>`);
    if (carrying) {
        const n = e.pregnant ? e.fetusCount : e.egg.count;
        for (let i = 0; i < n; i++) fields.push(`<label class="ovr-row"><span>${e.pregnant ? 'Baby' : 'Egg'} ${i + 1} name</span>${ep(k, `babyNames.${i}`, 'text', e.babyNames[i] || '', 'placeholder="unnamed (picked up from chat if discussed)"')}</label>`);
    }
    fields.push(`<label class="ovr-row"><span>Other parent</span>${ep(k, 'second.name', 'text', e.second.name, `placeholder="${esc(H.secondParentName(k))}"`)}</label>`);
    fields.push(`<div class="ovr-row"><span>Other parent eyes / hair</span>${ep(k, 'second.eyes', 'text', e.second.eyes, 'placeholder="eyes"')}${ep(k, 'second.hair', 'text', e.second.hair, 'placeholder="hair"')}</div>`);
    if (s.tryingMode && E.canConceive(k)) fields.push(`<label class="checkbox_label"><input type="checkbox" data-ent="${k}" data-path="trying.on" ${e.trying.on ? 'checked' : ''}><span>Trying for a baby${e.trying.on ? ` (${e.trying.cycles} cycle${e.trying.cycles === 1 ? '' : 's'})` : ''}</span></label>`);
    if (e.postpartumDays > 0) fields.push(`<label class="checkbox_label"><input type="checkbox" data-ent="${k}" data-path="postpartum.lactating" ${e.postpartum.lactating ? 'checked' : ''}><span>Lactating</span></label>`);
    if (!live || carrying && e.egg.stage !== 'none') fields.push(`<label class="ovr-row"><span>Nest</span><select class="text_pole" data-ent="${k}" data-path="nest.state">${Object.keys(D.NEST).map(n => `<option value="${n}" ${e.nest.state === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`);
    if (s.disruptionsEnabled && !carrying) fields.push(`<div class="ovr-row"><span>Cycle disruption</span><select class="text_pole" id="ovr_dis_${k}">${Object.entries(D.DISRUPTIONS).map(([id, d]) => `<option value="${id}">${d.label}</option>`).join('')}</select>${btn('disrupt', 'Apply')}</div>`);
    if (live && E.canConceive(k)) fields.push(`<div class="ovr-row"><span>Manual pregnancy start</span><input type="date" class="text_pole" id="ovr_mp_d_${k}" value="${c.date.current || ''}"><input type="number" class="text_pole ovr-small" id="ovr_mp_n_${k}" min="1" max="4" value="1" title="babies"><input type="text" class="text_pole" id="ovr_mp_p_${k}" placeholder="other parent">${btn('startpreg', 'Start')}</div>`);
    return `<div class="ovr-card">${L.join('')}${fields.join('')}<div class="ovr-btns">${b.join('')}</div></div>`;
}

function tree() {
    const fam = C().family;
    const all = [...fam.babies, ...fam.grown.map(g => ({ ...g, grown: true, milestones: [] }))];
    if (!all.length) return '<small>No children yet.</small>';
    const groups = {};
    for (const b of all) (groups[`${b.parent}|${b.otherParent || H.secondParentName(b.parent)}`] ||= []).push(b);
    return `<ul class="ovr-tree">${Object.entries(groups).map(([key, list]) => {
        const [p, o] = key.split('|');
        return `<li><b>${esc(nameOf(p))}</b> + ${esc(o)}<ul>${list.map(b => `<li>${esc(b.name || `Baby${b.id}`)} <small>${sexWord(b.sex)}, ${ageWords(b.age)}${b.grown ? ', older child' : ''}${b.via === 'hatch' ? ', hatched' : ''}${b.method === 'csection' ? ', C-section' : ''}</small>${(b.milestones || []).slice(-3).map(m => `<span class="ovr-chip">${esc(m.text)}</span>`).join('')}${b.appearance?.length ? `<br><small>${esc(b.appearance.join(', '))}</small>` : ''}</li>`).join('')}</ul></li>`;
    }).join('')}</ul>`;
}

export function render() {
    const body = $('#ovr_body');
    if (!body.length) return;
    const s = S(), c = C(), pf = profiles();
    const profOpts = `<option value="">Main API (current connection)</option>` + pf.map(p => `<option value="${esc(p.id)}" ${p.id === s.apiProfile ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    const physRow = k => `<div class="ovr-row"><span>${esc(nameOf(k))}</span>
        <select class="text_pole" data-c="physiology.${k}">${opts(PHYS, c.physiology[k])}</select>
        <select class="text_pole" data-c="repro.${k}"><option value="live" ${c.repro[k] === 'live' ? 'selected' : ''}>Live birth</option><option value="oviposition" ${c.repro[k] === 'oviposition' ? 'selected' : ''}>Oviposition</option></select></div>`;
    const conRow = k => `<label class="ovr-row"><span>${esc(nameOf(k))}</span><select class="text_pole" data-c="contraception.${k}">${opts(CONTRA, c.contraception[k])}</select></label>`;
    const looksRow = k => `<div class="ovr-row"><span>${esc(nameOf(k))} eyes / hair</span><input type="text" class="text_pole" data-c="looks.${k}.eyes" value="${esc(c.looks[k].eyes)}" placeholder="eyes"><input type="text" class="text_pole" data-c="looks.${k}.hair" value="${esc(c.looks[k].hair)}" placeholder="hair"></div>`;
    body.html(`
    <label class="checkbox_label"><input type="checkbox" data-g="enabled" ${s.enabled ? 'checked' : ''}><span>Enabled</span></label>
    ${chk('notifications', 'Show notifications')}
    <details class="ovr-sec"><summary><h4>Global settings</h4></summary>
    <label class="ovr-row"><span>Track</span><select class="text_pole" data-g="track">
        <option value="user" ${s.track === 'user' ? 'selected' : ''}>User only</option>
        <option value="char" ${s.track === 'char' ? 'selected' : ''}>Bot only</option>
        <option value="both" ${s.track === 'both' ? 'selected' : ''}>Both</option></select></label>
    <label class="ovr-row"><span>API profile</span><select class="text_pole" data-g="apiProfile">${profOpts}</select></label>
    ${pf.length ? '' : '<small>No Connection Manager profiles found; the main API is used.</small>'}
    ${chk('autoAnalyze', 'Analyze messages for events (conception, birth, visits, names, date...)')}
    ${chk('smartFilter', 'Only analyze when the text looks relevant (saves calls)')}
    ${numField('analyzeDepth', 'Messages sent to analyzer', 1, 10)}
    <h5>Cycle and conception</h5>
    ${numField('conceptionChance', 'Conception chance at peak, %', 0, 100)}
    ${numField('cycleLength', 'Heat/rut cycle length, days', 10, 120)}
    ${numField('heatDuration', 'Heat/rut duration, days', 1, 14)}
    ${chk('tryingMode', 'Trying-for-a-baby mode available')}
    ${chk('disruptionsEnabled', 'Cycle disruptions (stress, illness, travel...)')}
    <h5>Pregnancy</h5>
    ${numField('termWeeks', 'Pregnancy length, weeks', 8, 60)}
    ${numField('twinsChance', 'Twins chance, %', 0, 100, 0.1)}
    ${numField('tripletsChance', 'Triplets chance, %', 0, 100, 0.1)}
    ${chk('complicationsEnabled', 'Pregnancy complications')}
    ${numField('complicationChance', 'Complication chance multiplier, %', 0, 300)}
    ${chk('fetalDiseasesEnabled', 'Fetal diseases')}
    ${numField('fetalDiseaseChance', 'Fetal disease chance, %', 0, 100, 0.5)}
    ${numField('doctorCooldown', 'Practitioner visit cooldown, days', 0, 60)}
    <h5>Oviposition</h5>
    ${numField('clutchMin', 'Clutch size, min', 1, 20)}
    ${numField('clutchMax', 'Clutch size, max', 1, 20)}
    ${numField('eggCarryDays', 'Egg carrying, days', 1, 120)}
    ${numField('eggIncubationDays', 'Incubation, days', 1, 200)}
    ${chk('eggComplicationsEnabled', 'Egg complications')}
    ${chk('embryoDiseasesEnabled', 'Embryo diseases')}
    ${numField('embryoChance', 'Embryo disease chance per egg, %', 0, 100, 0.5)}
    ${chk('shellDefectsEnabled', 'Shell defects')}
    ${numField('shellChance', 'Shell defect chance per egg, %', 0, 100, 0.5)}
    ${chk('nestRisk', 'Unprepared nest can cost eggs during incubation')}
    <h5>Postpartum and children</h5>
    ${numField('recoveryDays', 'Postpartum recovery (natural), days', 1, 180)}
    ${chk('lactationDefault', 'Lactation starts after birth by default')}
    ${numField('lactationReturnDays', 'Cycle stays suppressed while lactating, days', 30, 720)}
    ${chk('inheritAppearance', 'Appearance inheritance')}
    ${chk('autoPickNames', 'Pick up baby names from the chat')}
    ${chk('birthDialog', 'Birth dialog (name babies)')}
    ${chk('graduationDialog', 'Graduation dialog')}
    ${numField('babyMaxAgeDays', 'Children are offered "older" after, days', 30, 7300)}
    <h5>Display and history</h5>
    ${chk('infoblock', 'Chat infoblock under the latest message')}
    ${chk('infoblockShowHidden', 'Infoblock shows hidden pregnancies/clutches')}
    <textarea class="text_pole" data-g="infoblockCss" rows="3" placeholder="Custom CSS for .ovr-infoblock">${esc(s.infoblockCss)}</textarea>
    ${numField('historyLimit', 'Undo checkpoints kept', 5, 100)}
    ${numField('injectDepth', 'Injection depth (messages from the end)', 0, 20)}
    <label class="ovr-row"><span>Numeric date order</span><select class="text_pole" data-g="dateOrder"><option value="DMY" ${s.dateOrder === 'DMY' ? 'selected' : ''}>DD/MM/YYYY</option><option value="MDY" ${s.dateOrder === 'MDY' ? 'selected' : ''}>MM/DD/YYYY</option></select></label>
    </details>
    <details class="ovr-sec" open><summary><h4>This chat</h4></summary>
    <div class="ovr-row"><span>Story date</span><b>${c.date.current ? pretty(c.date.current) : 'not detected yet'}</b><small>(${c.date.source})</small></div>
    <div class="ovr-row"><span>Time of day</span><b>${c.date.time || 'unknown'}</b></div>
    <div class="ovr-row"><input type="date" class="text_pole" id="ovr_date_in" value="${c.date.current || ''}">
        <input type="time" class="text_pole" id="ovr_time_in" value="${c.date.time || ''}">
        <div class="menu_button ovr-btn" data-act="date-adv">Set &amp; advance</div>
        <div class="menu_button ovr-btn" data-act="date-only">Set only</div>
        <div class="menu_button ovr-btn" data-act="date-detect">Re-detect</div></div>
    <label class="checkbox_label"><input type="checkbox" id="ovr_date_lock" ${c.date.manual ? 'checked' : ''}><span>Lock date (ignore dates found in chat)</span></label>
    <h5>Physiology and reproduction type</h5>${physRow('user')}${physRow('char')}
    <h5>Contraception</h5>${conRow('user')}${conRow('char')}
    <h5>Appearance (for inheritance)</h5>${looksRow('user')}${looksRow('char')}
    <h5>Reveal Mode</h5>
    <label class="ovr-row"><span>Era</span><select class="text_pole" data-c="reveal.era">${opts(ERAS, c.reveal.era)}</select></label>
    <small>Medical help in this era: ${esc(H.practitioner())}</small>
    ${c.reveal.era === 'custom' ? `<label class="ovr-row"><span>Practitioner</span><input type="text" class="text_pole" data-c="reveal.practitioner" value="${esc(c.reveal.practitioner)}" placeholder="healer, witch doctor, medic..."></label><textarea class="text_pole" data-c="reveal.custom" rows="2" placeholder="How can a pregnancy or clutch be discovered in this setting?">${esc(c.reveal.custom)}</textarea>` : ''}
    </details>
    <details class="ovr-sec" open><summary><h4>Status</h4></summary>${trackedKeys().map(card).join('')}</details>
    <details class="ovr-sec" open><summary><h4>Children</h4></summary>
    ${c.family.babies.map(babyCard).join('') || '<small>No children yet.</small>'}
    ${c.family.grown.length ? `<small>Older children: ${c.family.grown.map(g => esc(g.name || 'unnamed') + ' (' + ageWords(g.age) + ')').join(', ')}</small>` : ''}
    </details>
    <details class="ovr-sec"><summary><h4>Family tree</h4></summary>${tree()}</details>
    <details class="ovr-sec"><summary><h4>Undo history (${c.history.length})</h4></summary>
    ${c.history.length ? c.history.map((h, i) => `<div class="ovr-row"><small>${esc(h.label)}${h.date ? ' · ' + esc(pretty(h.date)) : ''}</small><div class="menu_button ovr-btn" data-act="hist" data-i="${i}">Restore to before this</div></div>`).reverse().join('') : '<small>No checkpoints yet. One is saved before every automatic or manual change.</small>'}
    </details>
    <div class="ovr-btns">
        <div class="menu_button ovr-btn" data-act="undo">Undo last auto change</div>
        <div class="menu_button ovr-btn" data-act="preview">${showPreview ? 'Hide' : 'Show'} injected prompt</div>
        <div class="menu_button ovr-btn" data-act="reset">Reset this chat</div></div>
    ${showPreview ? `<pre class="ovr-pre">${esc(buildPrompt())}</pre>` : ''}`);
}

export function refresh() { updatePrompt(); render(); renderInfoblock(); }

function setPath(obj, path, v) { const p = path.split('.'); const last = p.pop(); p.reduce((o, k) => o[k] ??= (/^\d+$/.test(k) ? [] : {}), obj)[last] = v; }
const val = el => (el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value);
const note = (t, type = 'info') => S().notifications && toastr[type](t, 'Omegaverse');

const LABELS = { adv: 'Advance time', conceive: 'Conception', birth: 'Birth', lay: 'Laying eggs', hatch: 'Hatching', end: 'Ended', startpreg: 'Manual pregnancy start', disrupt: 'Disruption', visit: 'Visit', test: 'Test', reveal: 'Reveal', resolvec: 'Resolved complication', 'date-adv': 'Date change', 'date-only': 'Date change', fed: 'Fed', changed: 'Diaper changed', grow: 'Moved to older', delbaby: 'Removed child' };

export function mount() {
    if ($('#ovr_root').length) return;
    $('#extensions_settings2').append(`<div id="ovr_root" class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b>Omegaverse Reproduction</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div><div class="inline-drawer-content" id="ovr_body"></div></div>`);
    const root = '#ovr_root';
    hooks.onBirth = openBirthDialog;
    hooks.onGrad = openGradDialog;
    applyCustomCss();

    $(document).on('change', `${root} [data-g]`, e => { const el = e.currentTarget; S()[el.dataset.g] = val(el); saveS(); applyCustomCss(); refresh(); });
    $(document).on('change', `${root} [data-c]`, e => { const el = e.currentTarget; setPath(C(), el.dataset.c, val(el)); saveC(); refresh(); });
    $(document).on('change', `${root} [data-ent][data-path]`, e => {
        const el = e.currentTarget; setPath(C().entities[el.dataset.ent], el.dataset.path, val(el));
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
        const c = C(); c.date.manual = e.currentTarget.checked; c.date.manualValue = c.date.manual ? c.date.current : null; c.date.manualTime = c.date.manual ? c.date.time : null;
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
            case 'disrupt': { const kind = $(`#ovr_dis_${k}`).val(), sh = H.disrupt(k, kind); return done(sh ? `${n}: cycle delayed by ${sh} days` : null); }
            case 'startpreg': {
                const d = $(`#ovr_mp_d_${k}`).val(), cnt = Number($(`#ovr_mp_n_${k}`).val()) || 1, p = ($(`#ovr_mp_p_${k}`).val() || '').trim();
                if (!parseISO(d)) return note('Pick a valid conception date', 'warning');
                return done(E.startManualPregnancy(k, d, cnt, [], p) ? `${n}: pregnancy started` : 'Could not start a pregnancy here');
            }
            case 'date-adv': case 'date-only': {
                const v = $('#ovr_date_in').val();
                if (!parseISO(v)) return note('Pick a valid date first', 'warning');
                E.setDate(v, 'manual', act === 'date-adv');
                const tv = $('#ovr_time_in').val();
                if (/^\d{2}:\d{2}$/.test(tv)) c.date.time = tv;
                if (c.date.manual) { c.date.manualValue = v; c.date.manualTime = c.date.time; }
                return done();
            }
            case 'date-detect': { const { refreshDate } = await import('./analyze.js'); if (c.date.manual) { c.date.manual = false; c.date.manualValue = null; } refreshDate(); return done(); }
            case 'fed': case 'changed': {
                const b = c.family.babies.find(x => x.id === +el.dataset.b), now = nowHours();
                if (!b) return;
                if (now === null) return note('Set a story date first so feeding times can be tracked', 'warning');
                if (act === 'fed') b.lastFedH = now; else b.lastChangedH = now;
                return done();
            }
            case 'grow': archiveBabies([+el.dataset.b]); return done();
            case 'delbaby': if (confirm('Remove this child?')) c.family.babies = c.family.babies.filter(x => x.id !== +el.dataset.b); return done();
            case 'hist': return done(E.restoreCheckpoint(+el.dataset.i) ? 'Restored to the selected checkpoint' : 'Checkpoint not found');
            case 'undo': return done(E.restoreSnap() ? 'Last automatic change undone' : 'Nothing to undo');
            case 'preview': showPreview = !showPreview; return render();
            case 'reset': if (confirm('Reset all reproduction data for this chat?')) { const m = ctx().chatMetadata; if (m) delete m.omegaverse_repro; saveC(); } return refresh();
        }
    });
    render();
}
