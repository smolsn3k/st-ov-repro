# Omegaverse Reproduction (SillyTavern extension) v1.4

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

## v1.2 changes
- Every section is collapsible and remembers whether you left it open or closed, so toggling a setting no longer collapses anything or jumps the scroll position.
- Cleaner look: switches for on/off options, grids for numbers, progress bars and colored phase badges on status cards, severity chips for complications.
- Pregnancy (live birth) and Oviposition settings are separate collapsible groups; pregnancy and clutch details inside each status card collapse too.
- Manual "Add a child" form (name, sex, who carried, other parent, birth date, born or hatched, delivery).
- Appearance for inheritance is now one free-text line per person (eye and hair color are read from it). A button asks the AI to fill it in from the character card, your persona and the recent chat.
- The family tree is now a real tree: couples at the top, connector lines down to each child, boys and girls color-coded, older children dimmed. Children of the same couple share one branch no matter who carried them.

## v1.3 changes (chat infoblock)
- Redesigned card with a themed header, one card per tracked character, colored phase badges and progress bars.
- Position setting: top or bottom of the latest message.
- Cycle shown as day/length (for example 4/30) following your cycle settings, with the heat/rut window tinted on the bar and a "next heat in N days" line.
- Pregnancy status when pregnant (week out of term, trimester, due date, baby count and sex once confirmed, size, movement, position, swelling, weight gain, sensations, diagnosed concerns). Hidden pregnancies stay hidden unless "Show hidden pregnancies" is on.
- Clutch and incubation progress for oviposition, recovery and lactation status after birth.
- Baby status once a baby is born: sleep, feeding, diaper, mood, health, teething and colic, latest and upcoming milestone.
- New toggles: detailed pregnancy/clutch status, baby status.

## v1.4 changes
- A new entry in the magic wand menu ("Omegaverse Reproduction") opens the whole panel in a popup. Click outside, press Esc or use the close button to dismiss it. The panel in the Extensions drawer still works too; while the popup is open the panel is shown there instead.
- Files are organized into folders:

```
index.js            entry point (must stay at the root)
manifest.json       (must stay at the root)
style.css           (must stay at the root)
src/core/           core.js (settings, state), dates.js, data.js (content pools)
src/logic/          engine.js, health.js, baby.js, analyze.js, prompt.js
src/ui/             ui.js (panel, popup, wand entry), infoblock.js
```
