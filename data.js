// Content pools: symptoms per phase, pregnancy stages, complications, fetal/egg/embryo/shell conditions,
// postpartum stages by delivery method, nest states, disruptions, appearance genetics.

export const SYMPTOMS = {
    heat: ['burning warmth and flushed skin', 'an aching, restless need for closeness', 'hypersensitivity to touch and scent', 'trouble concentrating, hazy thoughts', 'a strong pull toward an alpha\'s scent', 'waves of sweating and chills', 'trembling hands and weak knees', 'low tolerance for being alone', 'nesting urges: gathering soft things', 'slick, heavy-limbed drowsiness between surges'],
    rut: ['restless, coiled energy', 'sharpened sense of smell and territorial instincts', 'an urge to protect and provide', 'short temper and low patience', 'intense focus on a mate\'s scent', 'raised body temperature', 'trouble sleeping, pacing', 'strong appetite and aggression held in check', 'possessive impulses', 'heavy, hot restlessness that is hard to ignore'],
    pre: ['an itchy restlessness', 'warmth creeping in and a heightened scent awareness', 'clumsiness and distraction', 'mild irritability', 'craving closeness and comfort', 'light headaches and tiredness'],
    suppressed: ['muted, faint echoes of the usual symptoms', 'dulled scent and mild fatigue', 'occasional breakthrough warmth', 'a flat mood from the medication'],
    quiet: ['steady energy and a calm mood', 'a normal appetite', 'stable temperature and scent', 'ordinary day-to-day sensations'],
};

// Pregnancy bands by completed week. size/movement/position/braxton/swelling/libido/weight/advice are shown in status and prompt.
export const PREG_BANDS = [
    { max: 3, size: 'a cluster of cells', sym: ['no outward signs', 'faint tiredness', 'a vague sense that something is different'], move: 'none', pos: 'n/a', brax: 'none', swell: 'none', libido: 'unchanged', weight: 'none yet', advice: 'nothing special yet' },
    { max: 6, size: 'a sesame seed to a lentil', sym: ['mild nausea', 'tender chest', 'unusual tiredness', 'sensitivity to smells', 'mood swings', 'frequent urination'], move: 'none', pos: 'n/a', brax: 'none', swell: 'none', libido: 'variable', weight: '0-1 kg', advice: 'rest, small meals, avoid alcohol and strong medicines' },
    { max: 9, size: 'a blueberry to a grape', sym: ['morning sickness', 'food aversions and cravings', 'exhaustion', 'tender, swollen chest', 'headaches', 'emotional ups and downs'], move: 'none', pos: 'n/a', brax: 'none', swell: 'none', libido: 'lowered', weight: '0-2 kg', advice: 'hydration, ginger or similar remedies, plenty of sleep' },
    { max: 13, size: 'a plum to a lemon', sym: ['nausea starting to ease', 'bloating', 'dizziness when standing', 'slight softening of the belly', 'mood swings', 'visible veins'], move: 'none yet', pos: 'n/a', brax: 'none', swell: 'none', libido: 'returning', weight: '1-3 kg', advice: 'gentle activity, iron-rich food' },
    { max: 17, size: 'an avocado to a pear', sym: ['rising energy', 'a small visible bump', 'round-ligament twinges', 'increased appetite', 'stuffy nose', 'occasional dizziness'], move: 'faint flutters possible', pos: 'free-floating', brax: 'none', swell: 'none', libido: 'increased', weight: '2-5 kg', advice: 'comfortable clothes, steady meals, light exercise' },
    { max: 22, size: 'a banana to a papaya', sym: ['a clear bump', 'definite kicks and rolls', 'back aches', 'heartburn', 'itchy stretching skin', 'leg cramps at night'], move: 'regular kicks and rolls', pos: 'moving freely', brax: 'rare, painless tightening', swell: 'mild at day\'s end', libido: 'high', weight: '4-7 kg', advice: 'sleep on the side, stretch, moisturize skin' },
    { max: 27, size: 'an eggplant to a cauliflower', sym: ['a prominent belly', 'strong, noticeable movements', 'backache and pelvic pressure', 'shortness of breath on stairs', 'swollen ankles', 'trouble finding a sleeping position'], move: 'strong and frequent', pos: 'often head-down, still turning', brax: 'occasional', swell: 'ankles and feet in the evening', libido: 'fluctuating', weight: '6-10 kg', advice: 'elevate feet, drink water, pace activities' },
    { max: 31, size: 'a squash to a pineapple', sym: ['a heavy, large belly', 'baby\'s kicks visible through the skin', 'heartburn and indigestion', 'frequent bathroom trips', 'tiredness and poor sleep', 'swollen hands and feet'], move: 'vigorous, with hiccups', pos: 'usually head-down', brax: 'regular, irregular timing', swell: 'noticeable feet and hands', libido: 'low', weight: '8-12 kg', advice: 'rest often, small meals, watch for warning signs' },
    { max: 35, size: 'a honeydew melon', sym: ['a very large belly and slow movement', 'pelvic pressure', 'breathlessness', 'insomnia', 'swollen feet', 'nesting urges beginning', 'leaking sensations from the chest'], move: 'firm shoves, less room to turn', pos: 'head-down for most', brax: 'frequent', swell: 'pronounced', libido: 'low', weight: '10-14 kg', advice: 'prepare the birth place and supplies, rest' },
    { max: 39, size: 'a watermelon-sized belly, baby near full size', sym: ['baby dropped low', 'intense nesting', 'strong practice contractions', 'pressure on the pelvis', 'waddling walk', 'difficulty sleeping', 'emotional anticipation and nerves'], move: 'slower but strong', pos: 'head-down, engaged', brax: 'frequent and stronger', swell: 'pronounced', libido: 'very low', weight: '11-16 kg', advice: 'keep everything ready; labor may begin any day' },
    { max: 999, size: 'overdue and heavy', sym: ['extreme heaviness and impatience', 'strong practice contractions', 'anxious waiting', 'exhaustion', 'swelling'], move: 'slower but strong', pos: 'head-down, engaged', brax: 'frequent', swell: 'pronounced', libido: 'very low', weight: '12-17 kg', advice: 'seek the practitioner\'s advice; labor is overdue' },
];

export const COMPLICATIONS = [
    { id: 'hyperemesis', label: 'severe morning sickness (hyperemesis)', severity: 'warning', chance: 8, weeks: [6, 12], desc: 'constant vomiting, dehydration, weight loss and exhaustion', care: 'rest, fluids, tiny frequent meals, soothing remedies' },
    { id: 'early_bleeding', label: 'early bleeding scare', severity: 'warning', chance: 6, weeks: [5, 10], desc: 'spotting and cramping that causes worry', care: 'bed rest, avoiding exertion, monitoring' },
    { id: 'low_hormones', label: 'low pregnancy hormones', severity: 'warning', chance: 5, weeks: [6, 12], desc: 'fatigue, faintness and weak symptoms; the pregnancy needs support', care: 'supportive treatment and rest' },
    { id: 'heat_surge', label: 'heat-like hormone surges', severity: 'warning', chance: 6, weeks: [8, 30], desc: 'unexpected flushes of heat, scent spikes and an overwhelming need for closeness despite the pregnancy', care: 'a calm, cool space, a trusted mate nearby, rest' },
    { id: 'bond_distress', label: 'separation distress from mate', severity: 'warning', chance: 8, weeks: [10, 36], desc: 'anxiety, tearfulness and physical unease whenever the mate is away', care: 'closeness, reassurance, shared scent items' },
    { id: 'anemia', label: 'anemia', severity: 'warning', chance: 12, weeks: [14, 26], desc: 'paleness, dizziness, breathlessness and deep tiredness', care: 'iron-rich food and supplements, rest' },
    { id: 'gest_diabetes', label: 'gestational diabetes', severity: 'warning', chance: 8, weeks: [24, 28], desc: 'unusual thirst, tiredness and high blood sugar', care: 'careful diet, monitoring, light exercise' },
    { id: 'low_placenta', label: 'low-lying placenta', severity: 'warning', chance: 5, weeks: [18, 28], desc: 'risk of bleeding; activity must be limited', care: 'reduced activity, regular checks' },
    { id: 'pelvic_pain', label: 'pelvic girdle pain', severity: 'warning', chance: 12, weeks: [16, 30], desc: 'sharp pain in the hips and pelvis when walking or turning', care: 'support belts, rest, gentle stretching' },
    { id: 'polyhydramnios', label: 'excess amniotic fluid', severity: 'warning', chance: 3, weeks: [28, 36], desc: 'a very large, tight belly, breathlessness and discomfort', care: 'monitoring and rest' },
    { id: 'preterm_contractions', label: 'early contractions', severity: 'warning', chance: 6, weeks: [28, 35], desc: 'regular tightening and pressure before term', care: 'rest, fluids, close monitoring' },
    { id: 'cholestasis', label: 'severe itching (cholestasis)', severity: 'warning', chance: 3, weeks: [30, 37], desc: 'intense itching of palms and soles, especially at night', care: 'medication, monitoring' },
    { id: 'breech', label: 'baby in breech position', severity: 'warning', chance: 10, weeks: [32, 37], desc: 'the baby lies feet-first, making the birth harder', care: 'position exercises, planning for the birth' },
    { id: 'preeclampsia', label: 'preeclampsia', severity: 'critical', chance: 4, weeks: [30, 38], desc: 'swelling, headaches, blurred vision and high blood pressure', care: 'strict rest, close monitoring, possibly early delivery' },
    { id: 'abruption', label: 'placental trouble', severity: 'critical', chance: 1, weeks: [30, 39], desc: 'sudden pain and bleeding; an emergency', care: 'immediate expert care' },
];

// Fetal conditions. detect: weeks the practitioner can find it in eras that can examine the fetus; otherwise found at birth.
export const FETAL_DISEASES = [
    { id: 'growth_restriction', label: 'slow fetal growth', weight: 3, detect: [24, 32], note: 'the baby measures small and needs close monitoring', born: 'small and light at birth, needs extra feeding and warmth' },
    { id: 'heart_murmur', label: 'minor heart murmur', weight: 3, detect: [20, 30], note: 'a small heart irregularity that is likely to be treatable', born: 'a minor heart murmur, needs check-ups' },
    { id: 'cleft', label: 'cleft lip or palate', weight: 2, detect: [18, 26], note: 'a facial difference that can be repaired later', born: 'a cleft lip or palate, feeding needs special care' },
    { id: 'clubfoot', label: 'clubfoot', weight: 2, detect: [20, 28], note: 'a foot position that can be corrected after birth', born: 'clubfoot, treated with gentle corrective casting' },
    { id: 'hydronephrosis', label: 'mild kidney swelling', weight: 2, detect: [20, 30], note: 'a mild swelling that is monitored', born: 'mild kidney swelling, monitored with check-ups' },
    { id: 'neural_mild', label: 'mild neural tube difference', weight: 1, detect: [18, 24], note: 'a serious but manageable difference needing specialist care', born: 'needs specialist care from the start' },
];

// Oviposition: carrier-side complications.
export const EGG_COMPLICATIONS = [
    { id: 'calcium_low', label: 'calcium deficiency', severity: 'warning', chance: 10, stage: 'gravid', day: [3, 10], desc: 'weak, aching muscles and cramps, a risk of soft shells', care: 'calcium-rich food and rest' },
    { id: 'egg_infection', label: 'clutch infection', severity: 'warning', chance: 4, stage: 'gravid', day: [4, 12], desc: 'fever, foul discharge and lethargy', care: 'medicine, clean warm rest' },
    { id: 'nesting_stress', label: 'nesting distress', severity: 'warning', chance: 8, stage: 'gravid', day: [3, 12], desc: 'frantic restlessness and refusal to eat until a nest feels safe', care: 'a safe, quiet, prepared nest' },
    { id: 'weak_contractions', label: 'weak laying contractions', severity: 'warning', chance: 8, stage: 'laying', day: [0, 0], desc: 'laying is slow and exhausting, with long pauses', care: 'warmth, patience, gentle massage' },
    { id: 'egg_binding', label: 'a stuck egg', severity: 'critical', chance: 4, stage: 'laying', day: [0, 0], desc: 'an egg will not pass, causing sharp pain and distress', care: 'urgent expert help, warmth and lubrication' },
];

export const EMBRYO_DISEASES = [
    { id: 'infertile', label: 'infertile egg', fatal: true, weight: 4, note: 'no embryo develops' },
    { id: 'failed_dev', label: 'embryo stopped developing', fatal: true, weight: 3, note: 'the embryo stopped growing mid-incubation' },
    { id: 'malformed', label: 'severe malformation', fatal: true, weight: 1, note: 'the embryo is badly malformed and will not hatch' },
    { id: 'weak_hatchling', label: 'weak embryo', fatal: false, weight: 3, note: 'will hatch small and weak, needing extra warmth', born: 'a small, weak hatchling needing extra warmth and feeding' },
    { id: 'slow_dev', label: 'slow development', fatal: false, weight: 2, note: 'will hatch late and tired', born: 'hatched late and tired, needs gentle care' },
];

// failAt: chance the egg fails at laying when the nest is ready; fails more without a nest.
export const SHELL_DEFECTS = [
    { id: 'thin', label: 'thin shell', failReady: 0.15, weight: 3 },
    { id: 'soft', label: 'soft, leathery shell', failReady: 0.2, weight: 3 },
    { id: 'crack', label: 'hairline crack', failReady: 0.3, weight: 2 },
    { id: 'misshapen', label: 'misshapen shell', failReady: 0.1, weight: 2 },
    { id: 'chalky', label: 'rough chalky patches', failReady: 0.1, weight: 2 },
];

export const POSTPARTUM = {
    natural: [
        { max: 3, label: 'acute recovery', sym: ['sore, aching body', 'heavy bleeding and cramping', 'exhaustion', 'tender and swollen chest', 'tearful, overwhelmed emotions'] },
        { max: 14, label: 'early recovery', sym: ['ongoing soreness', 'lighter bleeding', 'fatigue from broken sleep', 'milk coming in with fullness and leaks', 'mood swings'] },
        { max: 42, label: 'healing', sym: ['healing but still tender', 'tiredness', 'tentative return to light activity', 'emotional closeness to the baby'] },
        { max: 84, label: 'late recovery', sym: ['mostly recovered, still tired', 'returning strength', 'adjusting to the new routine'] },
    ],
    csection: [
        { max: 5, label: 'surgical recovery', sym: ['sharp pain at the incision', 'cannot lift or bend', 'dizziness and nausea', 'needs help moving', 'fatigue'] },
        { max: 14, label: 'incision healing', sym: ['a tight, sore incision', 'no lifting heavier than the baby', 'stiffness when standing', 'tiredness', 'milk coming in'] },
        { max: 42, label: 'deep healing', sym: ['the incision itches and pulls', 'avoiding strain', 'slow return of strength', 'tiredness'] },
        { max: 84, label: 'late recovery', sym: ['scar tenderness at times', 'returning strength', 'getting back to normal activity'] },
    ],
    laid: [
        { max: 3, label: 'post-laying exhaustion', sym: ['deep tiredness', 'soreness', 'strong urge to guard the eggs', 'hunger and thirst'] },
        { max: 10, label: 'recovering', sym: ['aching muscles', 'protective vigilance', 'frequent hunger', 'a need for warmth and rest'] },
        { max: 21, label: 'regaining strength', sym: ['strength returning', 'still tired', 'attentive to the nest'] },
        { max: 42, label: 'late recovery', sym: ['mostly recovered', 'calm settling'] },
    ],
};

export const LACTATION = {
    producing: 'is producing milk: engorgement, leaking, night feeds, milk letdown when the baby cries',
    drying: 'milk supply is tapering off: less fullness, fewer feeds',
};

export const NEST = {
    none: 'has no nest yet',
    building: 'is building a nest: gathering soft materials, rearranging, guarding the spot',
    ready: 'has a safe, warm, well-prepared nest',
    disturbed: 'has a disturbed or damaged nest and is anxious, trying to repair it',
};

export const DISRUPTIONS = {
    stress: { label: 'severe stress', shift: [3, 10] },
    illness: { label: 'illness', shift: [2, 7] },
    starvation: { label: 'poor nutrition', shift: [5, 14] },
    travel: { label: 'travel and disrupted rhythm', shift: [1, 5] },
    overwork: { label: 'exhaustion and overwork', shift: [3, 9] },
};

export const EYE_RANK = { brown: 3, amber: 3, hazel: 2, green: 2, gray: 1, blue: 1 };
export const HAIR_RANK = { black: 4, 'dark brown': 3, brown: 3, red: 2, auburn: 2, blond: 1, silver: 1 };
export function normTrait(v, ranks) {
    const low = String(v || '').toLowerCase().trim();
    if (!low) return null;
    if (ranks[low] !== undefined) return low;
    if (ranks === HAIR_RANK) { if (/blon/.test(low)) return 'blond'; if (/dark/.test(low)) return 'dark brown'; }
    return Object.keys(ranks).find(k => low.includes(k)) || null;
}
export function inheritTrait(a, b, ranks, rnd = Math.random) {
    const na = normTrait(a, ranks), nb = normTrait(b, ranks);
    if (!na && !nb) return null;
    if (!na || !nb || na === nb) return na || nb;
    const dom = ranks[na] >= ranks[nb] ? na : nb, rec = dom === na ? nb : na;
    return rnd() < 0.7 ? dom : rec;
}
