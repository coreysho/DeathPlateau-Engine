# What is left in the opsweep backlog, and which parts of it are bugs

`tools/sim/opsweep.ts` prints 2,710 dead options and 138 that reach only a global fallback. The
number on its own is not a to-do list: it mixes live bugs a player can hit today with cache slots
Jagex never used and systems nobody has started. This file is the triage, so the next person picks
a bucket instead of picking a line.

Counts are from the 3 November 2026 baseline. Rerun `npx tsx tools/sim/opsweep.ts` for today's.
The report was 4,370 lines before two things came out of it that were not backlog at all: 1,338
`Wear`/`Wield` labels that the global equip code has always handled correctly, and the Destroy bug
below, now fixed.

## Read this second: "not placed on the map" means nothing for an npc
 
The loc and npc sections split on whether the map places one, and for a loc that is the whole story.
For an **npc it can be badly wrong**, because `npc_add` reaches one too and some npcs exist only to
be spawned. Twenty-one woodcutting Ents sat in the "nobody can reach them today" bucket while the
anti-macro event spawned them at every ordinary tree, oak, willow, yew, maple and magic tree in the
game and the player could not chop a single one - the npc carried `op1="Chop down"` and no
`category=macro_event_ent`, so `[opnpc1,_macro_event_ent]` never saw the click. Fixed, and the
report has a third section now: **37 dead options on an npc a .rs2 names**, which is where to read
first. `garden_trolley_king` and `_saradomin` with four options each, `razmire_keelgan`'s two shops
and `cyrisus_dream` are the biggest of them.

## Read this first: what "dead" does and does not prove

opsweep reports an option the cache draws that no specific or category script answers. It also
says, for locs and npcs, whether the map actually places one - which is why the report splits
1,005 "on the map" from 1,729 that are not. **For objs there is no such test**, and that is the
single biggest reason the raw number overstates the problem: an item's dead option only matters if
a player can get the item. 142 of the 144 "dead obj Read" entries are clue scroll variants, and
not one of them is named anywhere in a script, drop table or reward table - nothing hands them out,
so nobody can read them. Teaching opsweep "is this obj ever given to anybody" would cut the obj
section down to what matters; until then, check before treating an obj line as urgent.

## Read this third: `deadcategory.ts` guesses the fix for 286 of these lines

Three of the biggest live buckets in this file turned out to be the same bug wearing different
hats - 175 rocks with an inert Mine, 123 Ape Atoll jungle trees with an inert Chop-down, 21
woodcutting Ents nobody could chop - and in all three the handler was already written, already
dispatching on `category=`, with a working sibling sitting in the same cache family. Each took an
afternoon to find and ten seconds to fix.

**`npx tsx tools/sim/deadcategory.ts --placed`** does that reading. For every dead option it names
the category that would answer it, learned from the locs and npcs that already work: a wired
sibling drawn with the same model, a wired loc whose option at the same slot carries the same
wording, or one sharing a name stem and that wording. 286 of the 588 placed loc lines get a
suggestion, and it prints how many locs already carry each suggested category so a generic category
can be told from a bespoke one - `ladder_up` is on one loc and is still right for a dead Climb-up;
`rashiliyia_tomb_door_opened` is on two and is right for nothing outside Rashiliyia's tomb.

Where the suggestions land, after the mining rocks: **47 ladders** (see below), 26 chests, 10 more
trees, 11 gangplanks, 9 crates. `--category <name>` prints every line one suggestion covers.

### 52 ladders and trapdoors that do nothing - run `deadladders.ts`
The most consequential bucket in the file, because a ladder that does nothing is a room nobody can
get into: Port Sarim jail, Lletya, the Wilderness ladders, Burgh de Rott's hatches, the Rum Deal
ghost ship, the fairy ring winch, the board-game ladders.

`ladders.rs2` has a generic handler - `[oploc1,_ladder_up]` / `[oploc1,_ladder_down]`, used today by
two locs on Lunar Isle - and it does the naive thing: straight up or down from the tile the player
stands on. **`~climb_ladder` does not validate**, it `p_telejump`s, so a wrong destination puts the
player inside a wall. `npx tsx tools/sim/deadladders.ts` sorts them by how safe that would be:

- **4** share a distinctive model with a ladder that has its own trigger - copy that trigger. The
  two Rum Deal ghost-ship ladders are the reason this test exists: a partner sits directly above
  each, so they look like plain vertical links, and their model is `shipladder_angled`, whose
  handler steps TWO TILES OUT in the direction the ladder faces. The category would have dropped
  players in the hull.
- **28** take the generic category: one direction, on op1, with a ladder of the opposite direction
  at the far end of every instance the map places.
- **4** go both ways, or hang the option off op2+. One loc carries one category and the generic
  handler is op1-only, so no category can answer both - these want `[label,ladder_options]`, which
  ladders.rs2 already has.
- **12** have clear ground one level away and no partner there; **4** have nothing standable one
  level away at all, so they go somewhere else entirely and need their destination written out.

**The 25 have NOT been wired, and what is missing is the test, not the diagnosis.** All 25 were
given `category=ladder_up` / `ladder_down` and then taken off again, because a sim that climbs each
one and checks where it lands could not be made to tell a real failure from its own:

- most of these ladders stand in tight indoor spaces, and a sim that teleports the player to a ring
  of tiles around the loc and clicks gets `"I can't reach that!"` from tiles that are open but
  unroutable - eleven of them, which looks exactly like a broken ladder;
- and one landing really is blocked. `loc_11739` climbed from 3050,3355,1 puts the player at
  **3050,3356,2, which is a wall**. One of the 25 is wrong and the naive test cannot say which
  others are.

So the next person needs an approach that uses the engine's own router to pick the tile a player
would actually stand on, and then asserts the landing on that tile. Until then these stay here:
the same-tile partner test is good evidence and it is not proof, and lunar_isle.loc records what
happens when a ladder is put on these categories on evidence alone.

## The buckets, largest first

### 501 npc "Talk-to" - dialogue nobody has written
The biggest bucket and the least surprising one. These are not wiring faults; each is a
conversation to write. Worth attacking by area rather than by list, and worth knowing that the
fuzzer already walks past them, so a bot run will not tell you anything new about them.

### 335 `poh_*` locs - Construction, 211 of them "Remove"
A whole unimplemented system, and the `Remove`/`Remove-room`/`Build` labels are its editing mode.
Not worth picking at one loc at a time: either Construction gets built or these stay.

### 175 locs with a dead "Mine" or "Prospect" - run `deadrocks.ts` before touching these
Placed, clickable rock with an inert Mine option, and the cause is almost always a missing
`category=mining_rock_normal`. **There is a worked precedent**:
`content/scripts/skill_mining/configs/rimmington_rocks.loc`, where the owner moved the whole
loc_9708-9725 run out of the 377 dump and fixed `category=`, `param=next_loc_stage_mining` and the
`mine.dbrow` ore tables, with a long comment explaining how the depleted variants were identified.
`regional_rocks.loc` beside it does the same for four more mines. Follow those two files.

**`npx tsx tools/sim/deadrocks.ts` applies their method for you**, so this bucket does not need
researching from the names. It learns the seam-colour-to-ore mapping from the 119 rocks already in
`mine.dbrow` and reads the unwired rocks against it, and it prints placement counts, so the work
can be done in the order that reaches players. Today, of 175: **99 have their ore settled by seam
colour**, 22 are spent rocks that want `param=mining_rock_empty,1` and no ore at all, 19 carry a
seam colour no wired rock shares, and 35 carry no recolour to go on. `--placed` narrows it to the
47 locs (452 instances) a player can actually walk up to.

**What the tool deliberately will not decide**, and why nothing here is wired yet:

- **Whether a rock depletes.** A depleting rock needs `param=next_loc_stage_mining` pointing at its
  spent partner, and `loc_change` refuses a null type, so wiring one without a partner throws
  rather than failing quietly. A non-depleting rock needs its own `get_ore_*` label in mining.rs2
  instead - rune essence is the precedent: `blankrunestone` carries no next stage and
  `get_ore_essence` just calls `p_oploc(3)` again.
- **The two biggest placed clusters have no colour to go on at all.** `dwarf_gold_mine` / `_l` /
  `_r` (155 instances) and the `loc_4976..4996` / `loc_12941..3` run (110 instances) are "Mineral
  vein" and "A distinctive layer in the rock strata" - no recolour, and no vein mechanic exists in
  this build. Their descriptions are the only evidence, and for the dwarven ones the description
  does name gold.
- **`loc_14850/51/52`** (72 instances, the third largest) are the awkward case worth a look: their
  seam is recoloured to 0, which by regional_rocks.loc's rule ("a rock with no ore colour is a rock
  with no ore in it") makes them spent rocks - but they carry `mapscene=12`, so the map draws a
  mine icon there, and the live rocks of their own family are placed 300 tiles away in the Lava
  Maze. Spent or never-assigned is a judgement call.

**One more trap before wiring anything.** Several of these rocks declare no `op3` at all, including
the whole Lunar Isle `loc474_169xx/170xx` run. mining.rs2 keeps a player swinging with
`p_oploc(3)`, and `P_OPLOC` returns early on a null slot, so such a rock mines once and stops even
once its category and ore are right. Every working rock in the build carries `op3=hidden`.

### 391 dead objs, of which 332 are on an item nobody can hold
The report now says this itself: a section headed "dead on an obj whose name appears NOWHERE in
content". If an obj's name is absent from every file under `content/scripts`, nothing can hand it
out - no script adds it, no drop or reward table lists it, no shop stocks it, nothing degrades or
uncerts into it - so there is no way to be holding one when you click. The test only works in that
direction: being named proves nothing, since a mention in a comment counts, which is why the
heading is "nobody can hold one" and not "unobtainable".

332 objs, 338 option lines, and the families are all cache slots or unfinished tiers: 106
`whoopsie_*` anti-macro stubs, 133 `trail_clue_*` variants, 13 easter eggs, and the Achievement
Diary cloaks and amulets at tiers 1-3, where only tier 4 was ever wired (`diary_teleports.rs2`
names `ardougne_cloak_4` and nothing else, and the vote shop stocks only that one).

That leaves about 53 obj lines worth a human read, which is a very different list from 391.

### Of the dead objs, 112 are not items at all
`9mm_revolver`, `brass_monkey`, `elven_sheep`, `rotten_net`, the `whoopsie_obj30xx` run: every one
is the same stub - `model=obj_priest_robe`, `cost=1`, the same recolour and 2d values, no
`wearpos`, no worn models. They are empty slots in the 377 cache with a joke name, and their
`iop1=Wear` cannot work and should not be made to. Skip them; do not give them an `iop2`.

Finding the real items among them is worth doing by hand, and it pays: `ring_of_third_age` was in
this bucket, with `iop1=Wear` and no `wearpos`, and it is a hard clue reward the collection log
counts. It is fixed. The test that separates the two is whether the obj has real worn data.

### 114 that reach only a global fallback - and only 17 can happen to a player
The report splits this section too, by the same obtainability test: 97 of the lines are on objs
whose names appear nowhere in content. 96 of those are `iop5="Move"` on the `trail_slidingpuzzle*`
and `reinitialisation_*` sprites, which exist so the cache can draw a puzzle inside an interface
and which nothing hands to anybody, so "clicking Move drops it" is not something that can happen.

**The 17 that can**, and what each actually does - measured by clicking it on a real player, not
read off the label:

- **`iop5="Release"` on 6 items** - `poh_toy_cat`, the three wound-up POH toys, and the two
  `100_jubbly_balloon_toad_*`. The item is dropped on the floor with no message at all. Every one
  is `tradeable=true`, so it is recoverable; "Release" plausibly means "put it down" anyway, which
  is roughly what happens. Needs a decision about what releasing is meant to do before it needs
  code.
- **`iop2="Play-With"` on the 3 fishbowl fish** - the item leaves the backpack and does **not**
  appear on the ground: the global `[opheld2,_]` equip code **wears it**, into the weapon slot,
  silently. This is trap 3 happening rather than threatening. It is also not obviously wrong: all
  three carry `wearpos=3`, so the cache does intend them to be held, and a pet fish you hold is a
  pet fish. What is wrong is that the menu says Play-With and the action is equip.
- **7 npc and ground-obj ops**: `op2="Destroy"` on the three Dagannoth weak doors (placed, one
  each), `elid_ranging_target op2="Shoot"` (placed), `templetrek_snake_dead op2="Skin"`,
  `fire_object op3="Study"`, and Talk-To on two npcs the map never places.

### Where the global-fallback section's 1,629 went
Worth recording, because the number moved for three different reasons and only one of them was a
bug being fixed. 1,338 were every `Wear`, `Wield`, `Equip` and `Hold` on `iop2` in the game,
reported because `equip.rs2`'s `[opheld2,_] ~equip(last_slot)` is "only the global fallback" -
true, and completely uninteresting, since that global IS the handler for wearing a helmet and
there is no per-item script to write. opsweep skips those four labels on iop2 now. 160 were the
Destroy bug and 24 the Dismantle bug, both fixed below. 97 of the remaining 114 are on objs nobody
can hold. Seventeen lines are left.

### Fixed: 160 `iop5="Destroy"` items were being dropped on the floor
Kept here because the shape of it is worth remembering. `[opheld5,_] ~dropslot` took every
fifth-option click without looking at the label, so clicking "Destroy" on an untradeable quest item
dropped it - no confirmation, and `^dropslot_duration` then took it away for good, so a misclick
cost the item. The check could not be written because `oc_iop` had been declared in
`ScriptOpcode.ts` since the enum ("official, see cs2") with no handler behind it. It is implemented
now, alongside `oc_op` for the ground menu, and `drop.rs2` branches on the label into a
confirmation built the way `storage_items.rs2` already built one for the herb sack. 171 items go
through it; the 31 that have their own `[opheld5,x]` are untouched. `tools/sim/destroyop.ts`.

### Fixed: 24 `iop5="Dismantle"` had the same shape, one slot over
The 24 ornamented results - `*_or`, `*_g`, `*_t`, the infinity robes - each declare TWO ways to
take the kit off: `iop4=Revert`, this repository's, added with `param=ornament_from`; and
`iop5=Dismantle`, which came in with the item from a modern OSRS cache. Every trigger was on iop4,
so Dismantle fell through to the drop, and every one of these is `tradeable=no` - dropping an
Armadyl godsword (or) was losing it.

`ornament_kit.rs2` answers both slots now, which is the rule that file already states: *every
Revert trigger sits on the slot its item's own iop declares*. Wiring it rather than deleting
`iop5=Dismantle` keeps the imported cache data, and a player clicking either word means the same
thing. The precedent is in that same file - the two Gravedigger helmets have always used
`[opheld5,...]`, because a slayer helmet spends its iop4 on Disassemble.
`tools/sim/ornamentkits.ts` drives all 50 options across 26 items through the real handler.

### The rest
189 `Open` / 102 `Close` (doors), 158 `Search`, 55 `Climb-down` / 39 `Climb-up` / 37 `Climb`,
51 `Inspect`, 50 `Enter`, 35 `Chop down` (the same category story as Mine - see
`mm_bush_kharazi_jungle_tree1`/`2`, 86 and 37 placed instances of unchoppable jungle tree), 29
`Repair`, and a long tail. The `roguesden_*` cluster (21 locs: trap floors, spiked walls, blocking
doors) is the Rogues' Den course, which is one coherent piece of work rather than 21.

## Where to start

1. The mining clusters, in `deadrocks.ts --placed` order, following `rimmington_rocks.loc`. Highest
   placed-instance count per line changed of anything here. The three questions above
   (depletes or not, the two no-recolour families, and `loc_14850/51/52`) are the owner's to answer;
   everything else the tool has already settled.
2. Done: `mm_bush_kharazi_jungle_tree1`/`2`, Ape Atoll's two Jungle Trees, 123 placed instances of
   unchoppable jungle tree - the same missing-category story as Mine. They have `category=tree`, a
   `next_loc_stage` into their own stumps and rows in `woodcutting_trees` now;
   `tools/sim/junglechop.ts` chops one of each on the map and records the cache's own evidence that
   they are ordinary trees rather than the Legends' Quest machete jungle.
3. Done: opsweep now separates the obj lines nobody can hold from the rest, which took the obj
   section from 391 lines to about 53 worth reading, and separates the unplaced npcs a script names
   from the unplaced scenery nothing can reach.
4. The 37 script-spawned npc lines in the section above. They are the only part of this file where
   "the map does not place one" was hiding live bugs rather than describing dead cache slots.
