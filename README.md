# Omegaverse Reproduction (SillyTavern extension) v1.1

Heat/rut cycles, conception, pregnancy, oviposition, postpartum with lactation, baby care, family tree. No menstruation. English only.

## Install
Copy the `omegaverse-reproduction` folder into `SillyTavern/data/<user>/extensions/` (or `public/scripts/extensions/third-party/`) and reload. Settings appear in the Extensions drawer. Licensed AGPL-3.0 if you publish it (concepts follow delidgi's and soromolly's extensions).

## Global settings (everything not listed under "per chat")
Tracking (user / bot / both), API profile, analyzer options, conception chance, cycle length, term, twins/triplets, clutch size and timings, recovery and lactation lengths, and an on/off switch for each optional system:
pregnancy complications, fetal diseases, egg complications, embryo diseases, shell defects, nest risk, trying mode, cycle disruptions, appearance inheritance, picking baby names from chat, birth dialog, graduation dialog, chat infoblock (plus custom CSS), undo checkpoints.

## Per chat
- Story date (from the chat, manual override and lock) and time of day.
- Physiology for user and bot (male/female omega/alpha) and live birth or oviposition.
- Contraception, appearance (eyes/hair), Reveal Mode era and its practitioner (doctor, physician or midwife, midwife, healer, medical officer, custom).
- Everything that happens: pregnancies, eggs, children, history.

## Pregnancy
Detailed week-by-week status (baby size, sensations, movement, position, practice contractions, swelling, libido, weight gain, advice). Hidden until discovered or obvious for the era. Fetus count and sex are confirmed only at an exam the era can do. Complications are planned at conception, appear at their week, are diagnosed and treated at visits. Pregnancy tests have week-based reliability and era-specific names. Optional pre-birth baby names, second parent with eyes/hair, manual pregnancy start, delivery method (natural or C-section).

## Oviposition
Clutch formation, carrying, laying, incubation, hatching. Egg complications, embryo diseases (some fatal, some leave a weak hatchling), shell defects (can fail at laying, more often without a prepared nest), and nest state (none, building, ready, disturbed). Visits can find egg problems.

## Postpartum and lactation
Recovery stages differ for natural birth, C-section and laying. Lactation (on by default after birth, toggle per character) keeps the heat/rut cycle suppressed for a configurable time and lowers conception odds.

## Children
Baby cards with care needs by age and time of day, milestones, teething and colic, health, mood, sleep, feeding, personality, appearance (inherited, with manual editing) and other parent. Birth dialog to name babies, graduation dialog when they pass the baby-care age, family tree view.

## API profile
Choose a Connection Manager profile for the background analyzer, or leave it on the main API. It reads the newest messages and returns JSON (date and time, elapsed days, internal release, birth and method, laying, hatching, discovery, visits, tests, baby names, second parent, trying, disruptions, nest, eye/hair colors, baby updates). Conception is rolled locally.

## Undo
A checkpoint is saved before every automatic or manual change (limit configurable). "Restore to before this" in the Undo history list returns to that point. Swipes and regenerations roll back that message's earlier effects.
