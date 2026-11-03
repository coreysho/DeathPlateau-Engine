# What is left in the opsweep backlog, and which parts of it are bugs

`tools/sim/opsweep.ts` prints 2,734 dead options and 298 that reach only a global fallback. The
number on its own is not a to-do list: it mixes live bugs a player can hit today with cache slots
Jagex never used and systems nobody has started. This file is the triage, so the next person picks
a bucket instead of picking a line.

Counts are from the 3 November 2026 baseline. Rerun `npx tsx tools/sim/opsweep.ts` for today's.

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

### 174 locs with a dead "Mine" or "Prospect" - and these ARE bugs
Placed, clickable rock with an inert Mine option, and the cause is almost always a missing
`category=mining_rock_normal`. **There is a worked precedent**:
`content/scripts/skill_mining/configs/rimmington_rocks.loc`, where the owner moved the whole
loc_9708-9725 run out of the 377 dump and fixed `category=`, `param=next_loc_stage_mining` and the
`mine.dbrow` ore tables, with a long comment explaining how the depleted variants were identified.
Follow that file.

The clusters, by placed instance count: `dwarf_gold_mine` / `_l` / `_r` (95 + 30 + 30 - the
Dwarven mineral veins, "distinctly like gold", referenced by nothing at all), `loc_10944..10946`
(~32 each), the `loc474_169xx/170xx` run, and the `burgh_rubble_*` set.

**Each one needs a decision this tool cannot make**: which ore, and whether the rock depletes. The
gold veins are unambiguous from their own description; `loc_10946` carries `recol2d=16706`, which
is not one of the five ore colours rimmington_rocks.loc documents, so its ore is a guess until
somebody decides. Do not infer an ore from a recolour alone.

### 391 dead objs, of which 112 are not items at all
`9mm_revolver`, `brass_monkey`, `elven_sheep`, `rotten_net`, the `whoopsie_obj30xx` run: every one
is the same stub - `model=obj_priest_robe`, `cost=1`, the same recolour and 2d values, no
`wearpos`, no worn models. They are empty slots in the 377 cache with a joke name, and their
`iop1=Wear` cannot work and should not be made to. Skip them; do not give them an `iop2`.

Finding the real items among them is worth doing by hand, and it pays: `ring_of_third_age` was in
this bucket, with `iop1=Wear` and no `wearpos`, and it is a hard clue reward the collection log
counts. It is fixed. The test that separates the two is whether the obj has real worn data.

### 298 that reach only a global fallback - small, and all of it wrong
This section used to be 1,629 and most of it was noise: every `Wear`, `Wield`, `Equip` and `Hold`
on `iop2` in the game, reported because `equip.rs2`'s `[opheld2,_] ~equip(last_slot)` is "only the
global fallback". That global IS the handler for wearing a helmet, so opsweep now skips those four
labels on iop2 and the section is down to 298. What is left is worth reading line by line:

- **286 `iop5` labels that are not Drop** - 160 `Destroy`, 96 `Move`, 24 `Dismantle`, 6 `Release`.
  There are exactly two global opheld triggers in the build: `[opheld2,_] ~equip` and
  `[opheld5,_] ~dropslot`. So clicking "Destroy" on an untradeable does not destroy it, it **drops
  it on the floor**, and `~dropslot` has no label check to stop it. This is one systemic bug, not
  286 - and the fix is one proc, because `oc_iop` is already in `ScriptOpcode.ts` (`OC_IOP`,
  "official, see cs2") and merely unimplemented, so the engine side is a handler in ObjOps and the
  content side is a branch in `~dropslot`. Destroy wants a confirmation dialog; Move, Dismantle and
  Release each want a decision about what they should do.
- **`iop2` labels the equip code will try to wear** - `Play-With` x3, `Destroy` x3, `Hold`.
- A handful of loc/npc/ground-obj ops: `templetrek_snake_dead op2="Skin"`, `fire_object op3="Study"`,
  `magictraining_guardianstatue op3="Observe"`.

### The rest
189 `Open` / 102 `Close` (doors), 158 `Search`, 55 `Climb-down` / 39 `Climb-up` / 37 `Climb`,
51 `Inspect`, 50 `Enter`, 35 `Chop down` (the same category story as Mine - see
`mm_bush_kharazi_jungle_tree1`/`2`, 86 and 37 placed instances of unchoppable jungle tree), 29
`Repair`, and a long tail. The `roguesden_*` cluster (21 locs: trap floors, spiked walls, blocking
doors) is the Rogues' Den course, which is one coherent piece of work rather than 21.

## Where to start

1. The `[opheld5,_]` label bug. One systemic fix, 286 items, and today the game silently drops
   things players meant to destroy.
2. The mining categories, cluster by cluster, following `rimmington_rocks.loc`. Highest
   placed-instance count per line changed of anything here.
3. `mm_bush_kharazi_jungle_tree1`/`2` - the same fix for woodcutting, 123 placed instances.
4. Teach opsweep whether an obj is obtainable, so the 391-line obj section stops hiding its two
   real entries behind 142 clue scrolls nobody can hold.
