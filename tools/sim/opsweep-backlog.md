# What is left in the opsweep backlog, and which parts of it are bugs

`tools/sim/opsweep.ts` prints 2,733 dead options and 138 that reach only a global fallback. The
number on its own is not a to-do list: it mixes live bugs a player can hit today with cache slots
Jagex never used and systems nobody has started. This file is the triage, so the next person picks
a bucket instead of picking a line.

Counts are from the 3 November 2026 baseline. Rerun `npx tsx tools/sim/opsweep.ts` for today's.
The report was 4,370 lines before two things came out of it that were not backlog at all: 1,338
`Wear`/`Wield` labels that the global equip code has always handled correctly, and the Destroy bug
below, now fixed.

## Read this first: what "dead" does and does not prove

opsweep reports an option the cache draws that no specific or category script answers. It also
says, for locs and npcs, whether the map actually places one - which is why the report splits
1,005 "on the map" from 1,729 that are not. **For objs there is no such test**, and that is the
single biggest reason the raw number overstates the problem: an item's dead option only matters if
a player can get the item. 142 of the 144 "dead obj Read" entries are clue scroll variants, and
not one of them is named anywhere in a script, drop table or reward table - nothing hands them out,
so nobody can read them. Teaching opsweep "is this obj ever given to anybody" would cut the obj
section down to what matters; until then, check before treating an obj line as urgent.

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

### 391 dead objs, of which 112 are not items at all
`9mm_revolver`, `brass_monkey`, `elven_sheep`, `rotten_net`, the `whoopsie_obj30xx` run: every one
is the same stub - `model=obj_priest_robe`, `cost=1`, the same recolour and 2d values, no
`wearpos`, no worn models. They are empty slots in the 377 cache with a joke name, and their
`iop1=Wear` cannot work and should not be made to. Skip them; do not give them an `iop2`.

Finding the real items among them is worth doing by hand, and it pays: `ring_of_third_age` was in
this bucket, with `iop1=Wear` and no `wearpos`, and it is a hard clue reward the collection log
counts. It is fixed. The test that separates the two is whether the obj has real worn data.

### 138 that reach only a global fallback - small, and all of it wrong
This section used to be 1,629 and most of it was noise: every `Wear`, `Wield`, `Equip` and `Hold`
on `iop2` in the game, reported because `equip.rs2`'s `[opheld2,_] ~equip(last_slot)` is "only the
global fallback". That global IS the handler for wearing a helmet, so opsweep now skips those four
labels on iop2. A further 160 were the Destroy bug, now fixed - see below. What is left is worth
reading line by line:

- **126 `iop5` labels that are not Drop** - 96 `Move`, 24 `Dismantle`, 6 `Release`. There are
  exactly two global opheld triggers in the build, `[opheld2,_] ~equip` and `[opheld5,_]`, so these
  still reach the drop code and get put on the floor. Each wants a feature rather than a branch:
  `Dismantle` should split an ornamented item back into base plus kit (the 24 are the `*_or` and
  `*_t` items), `Release` should put the creature down, and `Move` belongs to the sliding-puzzle
  interfaces (`trail_slidingpuzzlec/d` and the `reinitialisation_*` run). Note that making them
  inert instead would be worse than the drop: `Dismantle` IS the fifth option on an ornamented
  godsword, so there is no `Drop` underneath it and the item would be stuck in the backpack.
- **`iop2` labels the equip code will try to wear** - `Play-With` x3, `Destroy` x3, `Hold`.
- A handful of loc/npc/ground-obj ops: `templetrek_snake_dead op2="Skin"`, `fire_object op3="Study"`,
  `magictraining_guardianstatue op3="Observe"`.

### Fixed: 160 `iop5="Destroy"` items were being dropped on the floor
Kept here because the shape of it is worth remembering. `[opheld5,_] ~dropslot` took every
fifth-option click without looking at the label, so clicking "Destroy" on an untradeable quest item
dropped it - no confirmation, and `^dropslot_duration` then took it away for good, so a misclick
cost the item. The check could not be written because `oc_iop` had been declared in
`ScriptOpcode.ts` since the enum ("official, see cs2") with no handler behind it. It is implemented
now, alongside `oc_op` for the ground menu, and `drop.rs2` branches on the label into a
confirmation built the way `storage_items.rs2` already built one for the herb sack. 171 items go
through it; the 31 that have their own `[opheld5,x]` are untouched. `tools/sim/destroyop.ts`.

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
2. `mm_bush_kharazi_jungle_tree1`/`2` - the same story for woodcutting, 123 placed instances of
   unchoppable jungle tree. `[oploc1,_tree]` in woodcut.rs2 dispatches on category the same way.
3. Teach opsweep whether an obj is obtainable, so the 391-line obj section stops hiding its two
   real entries behind 142 clue scrolls nobody can hold.
