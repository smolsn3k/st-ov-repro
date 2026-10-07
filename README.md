# Omegaverse Reproduction (SillyTavern extension) v1.10

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
src/logic/          engine.js, health.js, baby.js, analyze.js, tags.js, pipeline.js, prompt.js
src/ui/             ui.js (panel, popup, wand entry), infoblock.js
```

## v1.5 changes (chat infoblock redo)
The infoblock now follows the layout of delidgi's: one compact "Reproduction" bar that is collapsed when you first see it, with the characters' states in its header (for example `Setsune · Day 20/28 · Luteal`). Open it for one collapsible card per tracked character (and one per baby), each collapsed by default.
- Cycle card: day/length badge and phase, progress bar with the heat/rut window tinted, tiles for Fertility, Libido, Mood and Physical, then next heat/rut (or day of heat), protection, trying and test result, and a short note. Phases are heat/rut (early, peak, late), post-heat, calm, pre-heat and suppressed.
- Pregnancy card: week/term and trimester, conceived, due, fetus count and sex, other parent, health, size, mood, weight, libido, movement, swelling, contractions, position, sensations and advice. A hidden pregnancy keeps showing the running cycle (and "Late N d") until it is discovered.
- Clutch and recovery cards, and a baby card per child (health, mood, feeding, sleep, diaper, teeth, colic, other parent, personality, appearance, milestones, care tip).
- Open/closed state of every card is remembered between messages; the "detailed status" and "baby status" settings still apply.
- Custom CSS classes now start with `.ovr-ib` (old `.ovr-infoblock` rules no longer apply).

## v1.6 changes
- Infoblock on/off and its top/bottom position are now in a "Chat infoblock" box at the top of the panel (and the wand popup), always visible. The other infoblock options remain under Global settings, Display, infoblock and history.
- New chats default to user = male omega and bot = male alpha. Chats that already exist keep the physiology they were saved with; change it under This chat, Physiology and reproduction type.

## v1.7 changes
- Contraception labels show their protection, for example `Condom / barrier (85%)`. Defaults: barrier 85%, hormonal 95%, IUD/implant 98%, suppressants 70%, sterilized 100% (none is 0%). The first four are editable under Global settings, Cycle and conception. The percentage is how much a method lowers the conception chance; it stacks with the phase fertility (peak heat counts fully, suppressed heat is only 5%).
- "Hormonal" is now "Hormonal (pills, patch, injection)".
- The whole extension, panel, popup, family tree and chat infoblock, now follows the SillyTavern theme: one accent taken live from the theme's quote color, theme borders and text color, no hard-coded purple. Under Display, infoblock and history you can switch the accent to the theme's emphasis color, the theme's text color, or a custom color. Health badges keep green/amber/red so they stay readable.

## v1.8 changes (phone fixes)
- Infoblock header: the long bubble is gone. The main bar now shows "Reproduction" with a small plain sub-line (for example `Setsune 12/30 Calm   Satoru 15/30 Calm`). Per-character badges are short and stay on one line (`12/30 · Calm`, `14/40 wk`, `5/14 d`, a sex icon plus age for babies) and are trimmed with an ellipsis if there is still not enough room. Slightly tighter sizing on narrow screens.
- Wand popup: the background was the theme's see-through tint, so the chat showed through. It is now nearly opaque by default (95%), uses the real screen height on phones (no cut-off at the bottom), scrolls inside itself without scrolling the chat behind, closes with a tap outside, and uses smaller controls.
- Opacity: a slider in the popup header changes the popup opacity live (30-100%). Settings, Display, infoblock and history also has Popup opacity and Infoblock background (100% = the theme's own tint, lower = more see-through).
- The panel text size now follows your SillyTavern font size at a slightly smaller scale, so it is not oversized on phones.
- The wand menu entry is now named "OV Reproduction".

## v1.9 changes (reading the story)
- **Mood and physical state** are now read from the chat for each tracked character and shown in the Mood and Physical tiles (infoblock and status card) instead of the generic phase text. They stay valid for a number of story days (setting), then fall back to the phase defaults. You can also type them in by hand on the status card.
- **Libido follows mood and state.** The base comes from the phase (heat is high, calm is normal, pregnancy and recovery are lower). Sad, anxious, angry, exhausted or ill characters are pushed down, aroused or needy ones up, and an explicit libido level stated in the story wins. The libido level is also added to the hidden prompt so the writing stays consistent.
- **Contraception from the chat:** if the story says a condom, pills, an IUD, suppressants or sterilization applies (or that no protection is used), the setting is updated before the conception roll for that same message.
- **Children from the roleplay:** a child born in the story is added (and named onto the baby the tracker just created, instead of duplicating it); children who already exist are added with their age, other parent and derived birth date; children past the baby-care age go straight to the older children list. Unnamed mentions of old children and duplicate names are ignored.
- **Random start:** a new character's cycle starts on a random day instead of always day 12. Existing chats keep their current day.
- New settings (Tracking and API): track mood/physical/libido, check every N messages, and how many story days an observed mood stays valid. Mood needs a regular check, so with the smart filter on, the analyzer now also runs every N messages even when no keyword matched.

## v1.10 changes (tags, free-form dates)

### How to detect (Global settings, Tracking and API)
Three ways to read the story, modeled on delidgi/Pregnancy-and-menstruation for the tag mode:
- **Tags only.** No extra API calls at all. A short instruction is added to the main prompt (about 300 tokens for one tracked character, about 420 for two) and the roleplay model ends each reply with hidden HTML comments that are read locally. It costs a few prompt tokens and only works if the model follows the instruction.
- **Analyzer only.** The previous behavior: a separate model call reads the latest messages. Works with any roleplay model, but each run is an API request.
- **Both** (default). Tags cover date, mood/physical/libido and the common events for free. The analyzer only runs for things tags do not carry (children and names, visits, nests, trying, appearance) and as a backup: its keyword list is narrower than in Analyzer mode, and the mood check only fills in when a reply came without a status tag.

**Analyze now** (same section) runs the analyzer once on the latest message whatever the mode. It leaves the date alone and does not re-roll a conception that was already rolled for that message.
The analyzer's mood interval default went from 2 to 6 messages (existing settings that still had 2 are moved to 6). Messages scanned for a date or tags: 10.

### The tags
Tags only count inside `<!-- ... -->` comments, so the model writing a tag name in prose does nothing. Tags inside `<think>` blocks are ignored. Events are read only from the message being processed (a swipe rolls the earlier result back first), and the tag list in the prompt follows the current state (no BIRTH tag while nobody is pregnant, and so on).
- Every reply: `[RP_DATE:...]` and `[RP_STATUS:{...}]` (root = {{user}}, `partner` = {{char}}; mood, physical, libido).
- Only when whole days pass: `[RP_ELAPSED:N]`.
- One-time events (add `:CHAR` after the name for {{char}}, e.g. `[BIRTH:CHAR]`): `[CONCEPTION_CHECK]`, `[PROTECTION:condom]`, `[CYCLE_DAY:1]`, `[PREGNANCY_KNOWN]`, `[TEST]`, `[EXAM]`, `[SEX_REVEAL]`, `[MISCARRIAGE]`, `[BIRTH]` / `[BIRTH:CSECTION]`, `[LAID_EGGS]`, `[HATCHED]`, and `[BABY_TRAITS:{...}]` (name, sex, appearance of the children born in that reply).
- A conception check rolled from a tag is not rolled again by the analyzer for the same message.

### Free-form story date
The date is a text field: type or let the model write anything (`12 May`, `3rd of Harvestmoon`, `Day 14`, `4 May 1203`). The display shows the text as written. Internally the tracker keeps a day counter, so ages, due dates, recovery and feeding times keep working.
- **A real calendar date** (with or without a year): time moves forward automatically. Without a year, the next year is used when the date wraps (30 Dec then 2 Jan is +3 days); a step of a few days backwards is treated as a flashback.
- **`Day N`:** sets the day counter directly.
- **Anything else (a custom fantasy calendar):** kept as text and cannot be computed, so time moves from `[RP_ELAPSED:N]` in tag mode, from "days passed" read by the analyzer, or from the **+1 / +7 / +30 day** buttons. If the counter has moved since the text was written, it is shown as `3rd of Harvestmoon (+3 d)`.
- With a free-text calendar, other dates (due date, conception, last visit) are shown relative to now ("in 120 days", "5 days ago") because there is no calendar to turn them into names.
- Conception date (manual pregnancy) and birth date (manual child) are now text fields too: blank or `today`, `10 days ago`, `3 weeks ago`, or a date your story uses.
- Existing chats are converted automatically; dates stay as they were. Switching one chat between a real calendar and a free-text one in the middle of a story shifts the counter, so stored dates from before the switch may read oddly.

