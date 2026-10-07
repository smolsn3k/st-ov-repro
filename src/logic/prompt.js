// Builds the hidden context block injected into every generation.
import { ctx, S, C, PHYS, ERAS, CONTRA, PROMPT_KEY, trackedKeys, showDate, dateLabel, hasDate } from '../core/core.js';
import { tagInstructions } from './tags.js';
import { phase, weeksOf, trimester, dueDate, isCarrying } from './engine.js';
import { diffDays } from '../core/dates.js';
import * as H from './health.js';
import * as D from '../core/data.js';
import { labelOf, ageWords, stageOf, careNeeds, careNorms } from './baby.js';

const M = k => (k === 'user' ? '{{user}}' : '{{char}}');

const recent = (date, days) => { const c = C().date.current; if (date == null || c == null) return false; const d = diffDays(date, c); return d !== null && d >= 0 && d <= days; };
const sexWord = x => (x === 'M' ? 'boy' : 'girl');

function complicationLines(k, known) {
    const e = C().entities[k], out = [];
    for (const c of e.health.complications) {
        if (!c.active || c.resolved) continue;
        const d = D.COMPLICATIONS.find(x => x.id === c.id);
        out.push(c.diagnosed
            ? `Diagnosed with ${d.label} (${d.severity}): ${d.desc}. Care: ${d.care}.`
            : `Experiencing troubles: ${d.desc}. The cause is not yet understood by the characters${known ? '; it is a warning sign worth examining' : ''}.`);
    }
    for (const c of e.health.eggPlanned) {
        if (!c.active || c.resolved) continue;
        const d = D.EGG_COMPLICATIONS.find(x => x.id === c.id);
        out.push(c.diagnosed ? `Diagnosed with ${d.label} (${d.severity}): ${d.desc}. Care: ${d.care}.` : `Experiencing troubles: ${d.desc}. The cause is not yet understood by the characters.`);
    }
    return out;
}

// A hidden pregnancy or clutch means the expected heat/rut does not come: the characters notice it is late.
function lateHint(k, daysIn) {
    const e = C().entities[k], L = S().cycleLength, late = e.cycleDay + daysIn - L;
    if (late <= 0) return '';
    const nm = PHYS[C().physiology[k]].role === 'omega' ? 'heat' : 'rut';
    return ` The expected ${nm} is ${late} day${late === 1 ? '' : 's'} late; ${M(k)} and people who know their rhythm notice, and may wonder why (stress, illness, medication or something else).`;
}

function line(k) {
    const c = C(), e = c.entities[k], s = S(), ph = phase(k), phys = PHYS[c.physiology[k]];
    const era = ERAS[c.reveal.era] || ERAS.modern, h = e.health, prac = H.practitioner();
    const who = `${M(k)} (${phys.label.toLowerCase()})`;
    const out = [];
    const known = e.known;
    const second = H.secondParentName(k);

    if (e.pregnant) {
        const w = weeksOf(e), st = H.pregStatus(k);
        const babies = h.confirm.count ? (e.fetusCount > 1 ? `${e.fetusCount} babies` : 'one baby') : 'a baby';
        if (!known) {
            out.push(`${who} is secretly ${w} weeks pregnant. Nobody in the story knows yet, including ${M(k)}; never state or hint at it outright.${lateHint(k, w * 7)} Subtle symptoms may show naturally (${st.symptoms.join('; ')}) and may be misread as something else. ${w >= era.confirmWeek ? `It can now be confirmed if someone checks (${prac}).` : 'It is too early for this era\'s methods to confirm it.'}`);
        } else {
            out.push(`${who} is ${w} weeks pregnant with ${babies} (trimester ${trimester(w)}, due ${showDate(dueDate(e))}); baby size: ${st.size}. Current sensations: ${st.symptoms.join('; ')}. Baby movement: ${st.movement}; position: ${st.position}; practice contractions: ${st.braxton}; swelling: ${st.swelling}; weight gain about ${st.weight}. Advice: ${st.advice}. Heat/rut does not occur while pregnant.`);
            if (!h.confirm.count && e.fetusCount > 1) out.push(`Secret from the characters: the true number of babies is ${e.fetusCount}. Do not reveal it before an exam confirms the count (${prac}); characters assume one.`);
            if (h.confirm.sex) out.push(`Baby sex confirmed: ${e.fetusSex.map(sexWord).join(', ')}.`);
            else if (w >= era.sexWeek) out.push('The baby\'s sex can now be learned at an exam, but has not been yet; do not state it.');
            if (h.fetal?.known) { const d = D.FETAL_DISEASES.find(x => x.id === h.fetal.id); out.push(`Exam finding about the baby: ${d.label} (${d.note}).`); }
        }
        out.push(...complicationLines(k, known));
        if (e.babyNames.some(Boolean)) out.push(`Names chosen for the baby/babies: ${e.babyNames.filter(Boolean).join(', ')}.`);
        out.push(`The other parent is ${second}.`);
        if (h.test.result && recent(h.test.date, 3)) out.push(`Pregnancy test result (${showDate(h.test.date)}): ${h.test.result}.`);
        if (recent(h.visit.date, 3)) out.push(`Recent visit to the ${prac} (${showDate(h.visit.date)}): ${h.visit.note}.`);
    } else if (e.egg.stage !== 'none') {
        const g = e.egg;
        if (g.stage === 'gravid') {
            out.push(known
                ? `${who} is carrying a clutch of ${h.confirm.count ? g.count : 'several'} eggs (day ${g.carryDays}/${s.eggCarryDays}): growing roundness, nesting instinct, appetite and warmth-seeking.`
                : `${who} is secretly carrying a developing clutch; no one knows yet, including ${M(k)}.${lateHint(k, g.carryDays)} Only subtle signs (appetite, warmth-seeking, restlessness) may appear. Never state it outright.`);
        } else if (g.stage === 'laying_due') {
            out.push(`${who} is carrying ${g.count} eggs and is ready to lay (${g.laid} laid so far): strong nesting drive, rhythmic internal pressure, needs a safe warm nest.`);
        } else if (g.stage === 'incubating') {
            out.push(`${who} has laid a clutch of ${g.count} eggs, incubating (day ${g.incubDays}/${s.eggIncubationDays}): protective of the nest, needs warmth and food, reluctant to leave.`);
        } else out.push(`${who}'s ${g.count} eggs are ready to hatch.`);
        out.push(`${M(k)} ${D.NEST[e.nest.state]}.`);
        const defects = e.eggs.filter(x => x.known);
        if (defects.length) out.push(`Known egg problems: ${defects.map(x => [x.shell && D.SHELL_DEFECTS.find(y => y.id === x.shell)?.label, x.embryo && D.EMBRYO_DISEASES.find(y => y.id === x.embryo)?.label].filter(Boolean).join(' + ')).join('; ')}.`);
        out.push(...complicationLines(k, known));
        out.push(`The other parent is ${second}.`);
        if (recent(h.visit.date, 3)) out.push(`Recent visit to the ${prac} (${showDate(h.visit.date)}): ${h.visit.note}.`);
    } else if (e.postpartumDays > 0) {
        const len = H.postpartumLength(k), st = H.postpartumStage(k), m = e.postpartum.method;
        if (e.postpartumDays <= len && st) {
            const sym = H.postpartumStage(k).sym.slice(0, 3);
            const how = m === 'csection' ? 'after a C-section' : m === 'laid' ? 'after laying eggs' : 'after giving birth';
            out.push(`${who} is recovering ${how} (${st.label}, day ${e.postpartumDays}): ${sym.join('; ')}. No heat/rut yet.`);
        } else out.push(`${who} is still lactating; the heat/rut cycle has not returned yet.`);
        if (e.postpartum.lactating) out.push(`${M(k)} ${e.postpartumDays > 120 ? D.LACTATION.drying : D.LACTATION.producing}.`);
    } else {
        const nm = phys.role === 'omega' ? 'heat' : 'rut', info = H.cycleInfo(k), fc = H.heatForecast(k), plural = n => `${n} day${n === 1 ? '' : 's'}`;
        const sym = H.phaseSymptoms(k, info.pool, 3);
        out.push(`${who} is ${info.story}. How they come across: ${info.act}.${sym.length ? ` Typical sensations right now: ${sym.join('; ')}.` : ''} Others around them notice: ${info.others}.`);
        if (info.sub === 'pre') out.push(`They expect the ${nm} within about ${plural(fc.expectedIn)}.`);
        const sb = e.setback;
        if (sb) {
            const cause = H.setbackLabel(sb), late = fc.late;
            if (sb.resolved) { if (recent(sb.resolvedDate, 5)) out.push(`${M(k)}'s ${nm} finally came ${plural(sb.used)} late${sb.known ? ` (${cause})` : ''}; the delay is still fresh in their mind.`); }
            else if (late > 0) out.push(sb.known
                ? `${M(k)}'s ${nm} is ${plural(late)} late and they know why: ${cause}. It is on their mind and may come up in conversation.`
                : `${M(k)}'s ${nm} is ${plural(late)} overdue and nobody knows why. This raises questions: ${M(k)} is uneasy and people close to them may notice and ask. (The real cause is ${cause}; do not state it as fact, let them wonder: stress, illness, medication, even pregnancy.)`);
            else out.push(sb.known
                ? `${cause} has thrown ${M(k)}'s cycle off: the next ${nm} will come about ${plural(sb.shift)} later than usual.`
                : `(Hidden) ${cause} is throwing ${M(k)}'s cycle off: the next ${nm} will come about ${plural(sb.shift)} later than the character expects. They do not know yet; do not mention it, just do not start the ${nm} on schedule.`);
        }
        if (s.tryingMode && e.trying.on) out.push(`${M(k)} and ${second} are actively trying for a baby (${e.trying.cycles} cycle${e.trying.cycles === 1 ? '' : 's'} so far)${e.trying.cycles >= 3 ? '; longing and some anxiety about it may show' : ''}.`);
    }
    if (!(isCarrying(e) && !known)) {
        const fl = H.feelFor(k);
        out.push(`${M(k)}'s libido right now: ${fl.libido.toLowerCase()}${fl.observed.libido ? ' (it follows the current mood and physical state)' : ''}.`);
    }
    return out.join(' ');
}

export function buildPrompt() {
    const c = C(), era = ERAS[c.reveal.era] || ERAS.modern;
    const keys = trackedKeys();
    const lines = [
        '[Omegaverse reproduction tracker: hidden background state. Keep the story consistent with it. Never quote this block, its labels or numbers; show effects only through in-character behavior and sensations.]',
        'Setting: alpha/beta/omega dynamics apply. Omegas go through heat and alphas through rut, which are periodic, intense, and the time of peak fertility. There is no menstruation in this world.',
    ];
    const methods = c.reveal.era === 'custom' ? c.reveal.custom : era.methods;
    lines.push(`Era: ${era.label}. Pregnancy and clutches can only be discovered through ${methods || 'means appropriate to the setting'}. Do not use medical knowledge or technology beyond this era.`);
    lines.push(`Medical help in this setting comes from a ${H.practitioner()}.`);
    if (hasDate()) lines.push(`Current story date: ${dateLabel(true)}.`);
    for (const k of keys) lines.push(line(k));
    const fam = familyBlock();
    if (fam) lines.push(fam);
    if (S().detectMode !== 'analyzer') lines.push(tagInstructions());
    return lines.join('\n');
}

function familyBlock() {
    const fam = C().family;
    if (!fam.babies.length && !fam.grown.length) return '';
    const out = ['[Children] Use age-appropriate behavior and the needs of the current moment. Labels like Baby1 are identifiers, not names.'];
    for (const b of fam.babies) {
        const n = careNorms(b.age, b), need = careNeeds(b);
        const parts = [`${labelOf(b)} (${b.sex === 'M' ? 'boy' : 'girl'}, ${M(b.parent)}'s ${b.via === 'hatch' ? 'hatchling' : 'child'}): ${ageWords(b.age)} old, ${stageOf(b.age).label.toLowerCase()}`];
        parts.push(`health ${b.health}`);
        if (b.mood) parts.push(`mood ${b.mood}`);
        parts.push(`${b.sleep || need.sleep}`);
        parts.push(`feeding: ${b.feeding || 'not specified'}, currently ${need.feeding}`);
        parts.push(`diaper ${need.diaper}`);
        if (b.teething && n.teething) parts.push(`teething (${n.teething})`);
        if (b.colicky) parts.push('colicky evenings are likely');
        if (need.note) parts.push(need.note);
        if (n.upcoming) parts.push(`may soon: ${n.upcoming}`);
        let l = parts.join('; ') + '.';
        if (b.personality.length) l += ` Personality: ${b.personality.join(', ')}.`;
        if (b.appearance.length) l += ` Appearance: ${b.appearance.join(', ')}.`;
        if (b.otherParent) l += ` Other parent: ${b.otherParent}.`;
        if (b.condition) l += ` Born with: ${b.condition}.`;
        if (b.method === 'csection') l += ' Born by C-section.';
        const recent = b.milestones.slice(-3).map(x => x.text);
        if (recent.length) l += ` Already achieved: ${recent.join('; ')}.`;
        out.push(l);
    }
    if (fam.grown.length) out.push('Older children: ' + fam.grown.map(g => `${g.name || 'unnamed'} (${g.sex === 'M' ? 'boy' : 'girl'}, ${ageWords(g.age)}, ${M(g.parent)}'s)`).join('; ') + '.');
    return out.join('\n');
}

export function updatePrompt() {
    const x = ctx(), s = S();
    try { x.setExtensionPrompt(PROMPT_KEY, s.enabled ? buildPrompt() : '', 1, s.injectDepth, false, 0); }
    catch (e) { console.warn('[omegaverse] prompt update failed', e); }
}
export { isCarrying, CONTRA };
