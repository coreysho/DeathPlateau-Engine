# Decisions waiting on the owner

Everything here is a question I could not answer by reading the code, because the answer is a
choice about the game rather than a fact about the build. Each one says what the evidence is, what
the options are, and what it costs to get it wrong. None of it is blocked on more analysis.

The detail lives in the tools and files named; this page exists so the open questions are in one
place instead of scattered through commit messages.

---

## 1. Two shops that print money — RESOLVED, all four loops closed

Fixed: Blandebir and Metarialus given explicit multipliers (their prices were on the pre-migration
per-cent scale), Irksol raised to 750 above Grum's 700 buy, and the karambwan stall to 650 above
taxfree's 600. `shoparbitrage.py` now reports no profitable loop across 854 pairs and 6 currencies.
`brewing.ts` asserts the two multipliers so a future scale change cannot repeat it.

`python3 tools/shoparbitrage.py` in the content repo. Both verified by hand.

| item | buy from | at | sell to | at | profit |
|---|---|---|---|---|---|
| `ruby_ring` | Irksol, `cheapringshop` | 500 (~1,012gp of its 2,025 cost) | Grum, `goldshop` | 700 (~1,417gp) | ~405gp a ring |
| `ale_yeast` | Blandebir, `blandebir_shop` | effectively 100 (2gp of its 25gp cost) | Noterazzo, `taxfree` | 600 (15gp) | 13gp a yeast |

Both in coins, both shops restock, so both repeat. `~price_mod` damps it as stock drifts, so each
loop is finite rather than infinite — but the early trades pay, which is enough.

**The ruby ring** is a straight price disagreement between two counters: Irksol sells jewellery at
half cost and Grum buys it at seven tenths. Either number alone is defensible. Together they are a
loop. Pick which one moves.

**The ale yeast** has a different cause worth separating. Blandebir's npc block carries
`owned_shop` and `shop_title` **and no multipliers at all** — he is the only one of 199 keepers who
omits both — so he inherits the params' declared defaults of 100 and 60. Those defaults are on the
scale from before `~calc_shop_value` ended in `scale($int5, 1000, $base_cost)`, where 1000 is par,
so they now mean 10% and 6%.

Two fixes, not equivalent:

- give Blandebir explicit multipliers like the other 198 keepers — fixes this shop, leaves the trap
  for the next keeper added without them;
- move the params' own defaults to 1000 and 600 — fixes this shop and the next one, and also fixes
  the one other keeper that omits only `shop_buy_multiplier`. Changes nothing else, because nobody
  else relies on the defaults.

I did not pick, because both change a price.

## 2. Fareed respawns after you kill him — RESOLVED, it was not a decision at all

`python3 tools/varpstates.py` in the content repo, its only finding.

`%fd_killed_firewarrior` is tested at `dt_smoke.rs2:227` and set nowhere. The guard is there to stop
Fareed being spawned again when the player re-enters his arena having already killed him, and the
comment directly beneath it says the spawn-on-demand design exists "so he cannot be farmed before
the quest". As written, he respawns every time.

The reason is already written down in this repo, for the twin varp: *"an `ai_queue` trigger starts
with neither the protected active player nor a player pointer at all, so `%fd_killed_ninja` cannot
be set from a death hook"* (`quest_deserttreasure.rs2:564`). Fareed's kill is handled by exactly
such a hook, `[ai_queue3,firediamond_firewarrior]`.

**That engine question has an answer, and it made this a bug fix rather than a judgement call.**
`npc_findhero` does set `state.activePlayer` and add the `ActivePlayer` pointer, which is enough to
*read* a varp and not enough to write one. `POP_VARBIT` additionally demands `ProtectedActivePlayer`
whenever the basevar is protected — and `VarPlayerType.protect` **defaults to `true`**
(`VarPlayerType.ts:84`; the 216 `protect=no` lines in the content are explicit opt-outs), which
`deserttreasurevarbit2` takes by declaring nothing. Only `P_FINDUID` sets that pointer.

So the fix is a `p_finduid` guard and one assignment — and that is **Kamil's own pattern one file
over**: `[ai_queue3,icediamond_icewarrior]` in `dt_ice.rs2` already does exactly this, and its
comment records the same reasoning, naming `[ai_queue3,san_tojalon]` in Legends' Quest as where the
shape came from. Fareed's hook simply never got it.

Done, with `tools/sim/fareedrespawn.ts` asserting the kill is recorded. `varpstates.py` now reports
**0** findings where it reported this one. No belt-and-braces fallback as Kamil has, because
protected access is only refused while a modal is open and the cost of that is Fareed being
fightable again — the behaviour up to now, so a safe failure rather than a stuck quest.

## 3. The three mining clusters — RESOLVED, all three

The dwarven gold veins are wired and mineable (155 instances). The Haunted Mine's walls have Mine
and Prospect hidden (110) and the Wilderness rocks are marked deliberately empty (72).
`deadrocks.ts` went from 452 reachable dead instances to 115 — the rest are rocks no player can
walk up to. Details in each subsection below.

`npx tsx tools/sim/deadrocks.ts`, and the long section in `opsweep-backlog.md`.

**Correcting what this section used to say.** It read "the tool settles the ore for 99 of 175 rocks
from seam colour, so most of this bucket needs no decision". That is true of the loc *list* and
badly misleading about the game, because **93 of those 99 are not placed on the map at all**. Of the
452 instances a player can walk up to, the split is:

| bucket | locs | placed locs | placed instances |
|---|---|---|---|
| ore settled by seam colour | 99 | 6 | **12** |
| spent rocks, want `param=mining_rock_empty,1` | 22 | 3 | **72** |
| seam colour matches no wired rock — needs a decision | 19 | 12 | **101** |
| no recolour at all — description is the only evidence | 35 | 26 | **267** |

So **under 3% of reachable instances have their ore settled**, and those twelve are the Lunar Isle
run, which also needs `op3=hidden` and a depletion call before it would work. The three placed
"spent" rocks are `loc_14850/51/52`, which is the contested cluster below rather than a free win.

There is no decision-free remainder here. Anyone coming to this bucket expecting mechanical work
will find a judgement in front of every rock a player can reach.

The single question that unblocks the most is the first cluster below: its description names gold,
and a yes to that is 155 instances.

Three clusters have no colour to go on:

- ~~**`dwarf_gold_mine` / `_l` / `_r`** — 155 instances, "Mineral vein", no recolour. The description
  names gold, which is the only evidence there is.~~ **DONE.** The owner confirmed gold, and
  confirmed it depletes. Wired on `rimmington_rocks.loc`'s shape — `category=mining_rock_normal`,
  `param=next_loc_stage_mining,dwarf_gold_depleted`, and three rows in `mine.dbrow`'s
  `gold_rock_table`. The spent partner was already in the cache with a model named for the job, and
  it is a *different* model from the live veins, so `rockspent.ts`'s same-model rule does not reach
  it; these have no seam at all, so the model name is the evidence instead. `tools/sim/dwarfgold.ts`
  mines one of each: 12 ok, 0 FAIL. deadrocks drops from 452 reachable instances to **297**, and the
  opsweep baseline is rebanked 2,809 → 2,803 for the six options that came alive.
- **`loc_4976..4996` / `loc_12941..3`** — 110 instances, "A distinctive layer in the rock strata".
  No vein mechanic exists in this build. **Located:** they are all inside the **Haunted Mine**
  (x 2712–2804, z 4426–4493), which the npcs placed around them settle —
  `possessed_pickaxe_stationary`, `skeletal_miner_sitting`, `hauntedmine_boss_cart`,
  `crane_posessed_mine`, `hauntedmine_boss_key`. And `rockore.ts` already states the rule that
  classifies them: *"A rock with no 6342 slot at all is mine-wall scenery, not an ore rock."* These
  have no recolour slot at all. So they are a quest dungeon's walls with a vestigial Mine option,
  not an ore source.
- **`loc_14850/51/52`** — 72 instances. Their seam is recoloured to 0, which by
  `regional_rocks.loc`'s own rule ("a rock with no ore colour is a rock with no ore in it") makes
  them spent — but they carry `mapscene=12`, so the map draws a mine icon there, and the live rocks
  of their family sit 300 tiles away in the Lava Maze. **Located:** the **Wilderness** by the Dark
  Warriors' Fortress (3011–3013, 3593–3596), from `dark_warrior`, `young_dark_wizard`,
  `bearded_dark_wizard`, `green_dragon`, `skeleton_unagressive` and `wilderness_capeseller_10`
  around them.

**Neither of these needs an ore or a depletion decision, which is the useful part.** Both are rock
with no ore in it by the project's own two rules, so there is nothing to choose about what they
give. What is left is a smaller question about 182 instances of a dead option, and it has exactly
two sensible answers:

1. `category=mining_rock_normal` + `param=mining_rock_empty,1`. The click then says *"There is no
   ore currently available in this rock."* (`mining.rs2`'s own line for an empty rock) instead of
   *"Nothing interesting happens."* Truthful, creates no ore, changes no economy, and is what
   `deadrocks.ts` already recommends for its spent bucket.
2. Hide `op1`/`op2` so the client never offers Mine or Prospect on a wall at all, which is what
   "mine-wall scenery" argues for and what the original game does with decorative rock faces.

(1) is more informative, (2) is more faithful. Neither needs any further research; it wants one
answer covering both clusters, or one each.

**DONE — the owner chose one each**, which is the split the evidence argues for. The Haunted Mine's
110 wall instances have `op1`/`op2` hidden, so no client draws Mine or Prospect on a decorative rock
face. The Wilderness 72 are marked `param=mining_rock_empty,1`, because `mapscene=12` draws a mine
icon and a player who has been told to come and look should be answered rather than left hunting:
`mining.rs2` says *"There is no ore currently available in this rock."*

`tools/sim/rockempty.ts` holds both halves — 54 ok, 0 FAIL — asserting the walls through the
engine's own `isHiddenOp` and the Wilderness rocks by making the click and reading the reply.
**`deadrocks.ts` now reports 115 reachable instances against the 452 it started at**, and the
opsweep baseline is rebanked for the 54 options that stopped being dead.

So the whole mining bucket is closed bar the rocks nobody can reach.

Each also needs a yes/no on **whether the rock depletes**, which is not cosmetic: a depleting rock
needs `param=next_loc_stage_mining` pointing at a spent partner and `loc_change` **throws** on a
null type, so wiring one without a partner fails loudly. A non-depleting rock needs its own
`get_ore_*` label instead — `blankrunestone` and `get_ore_essence` are the precedent.

And the trap, before anything is wired: several declare no `op3`, including the whole Lunar Isle
run. `mining.rs2` keeps a player swinging with `p_oploc(3)` and `P_OPLOC` returns early on a null
slot, so such a rock mines once and stops even with the category and ore right. Every working rock
carries `op3=hidden`.

## 4. The dead ladders — ALL BUT THREE DONE, and the three left are deliberate

**Current state: `tools/sim/ladderclimb.ts` reports 120 ok, 0 FAIL, 2 untested**, and
`tools/sim/ahoyladders.ts` 49 climbs worked with no landing inside scenery. Every ladder wired in
this bucket is climbed at every placed instance, in every direction it offers, with two assertions
each: the player changed level the right way, and the tile they arrived on is standable. The two
untested are board-games instances with no routable approach tile, which is a property of the room
rather than of the ladder.

**What is left: the three Lunar Isle locs** (`loc474_16732`/`16733`/`16734`), which are the
cautionary case the backlog records - wired on tool evidence once and reverted, and `lunar_isle.loc`
says so in the file. They stay dead until somebody who knows the island says where they go.

**`regicide_voyage_temple_well1` is done, and it is the case where the backlog's own recipe gives
the wrong answer.** The recipe for a dead loc that shares a distinctive model with a wired one is
"copy that trigger". Here the model-mate is `regicide_voyage_temple_well2`, whose body teleports to
`0_37_151_4_54` - the blood well's tile - so copying it would take a player standing in Iban's
temple and move them *backwards* along the Underground Pass. The two wells that share a model are
the two **ends** of the voyage, not two copies of one end.

What settled it was reading the third well rather than the matching one. `bloodwell_upass` is not a
voyage well at all: its description is "It doesn't look like water in there...", its model is
`cave_well`, and `quest_upass` owns both its triggers for filling Iban's doll. What it carries is
the Well of Voyage *inscription*, which is why Regicide hangs the voyage off it and why well2
returns there. So well1 goes the way its own name and description say - west, into the voyage temple
under Isafdar, landing beside well2, which already brings you back - reusing
`[label,regicide_well_of_voyage]` rather than a copy of it, and carrying the same gate
`bloodwell_upass` has so it is a second way west for somebody who has earned the first rather than a
shortcut into Tirannwn.

`tools/sim/voyagewells.ts` asserts all three directionally - where each well puts you, not merely
that it does something - and checks the gate as well: **10 ok, 0 FAIL**. `quest_regicide_run.ts`
stays green at 73 of 73.

**So the general lesson, alongside the one below about evidence:** a shared model says these two
locs are the same *kind* of thing. It does not say they point the same way.

**The last two mechanical entries are done.** `wild_ladder_middle` and `elf_village_ladder_mid`
carry Climb / Climb-up / Climb-down, so neither can take a category — the `ladder_up` and
`ladder_down` categories each dispatch exactly one op, and the ends of both stacks already used
them. Both are plain vertical stacks on a single tile, which is what makes the generic one-level
offset right here rather than guesswork, and `ladderclimb.ts` grew an `op` field to drive 2 and 3
directly: their op1 opens a "Climb up or down?" box that a headless player never answers, and the
dialogue only chooses between the two destinations the other ops reach anyway. Twenty new
assertions, all green.

**The ghost ship's angled pair is done, with weaker evidence, and the enum says so.**
`ahoy_ghostshipladder_angled` and `ahoy_ghostshipladder_top_angled` route through the ship's
existing table like its other twelve placements. But **decks 1 and 2 of that ship carry no
collision data at all** — a 17x13 sweep of both floors comes back open but for the ladder locs
themselves — so the "is the arrival tile standable" check that justifies every other row in that
table cannot fail there and cannot choose between candidates. The offset therefore comes from the
model: these are `shipladder_angled` and `shipladder_top_angled`, whose own handler steps two tiles
out in the facing direction, which is where the top of the lean is. That is derivation, not
measurement, and it is labelled as such in `ahoy_ladders.enum` so nobody later mistakes those four
numbers for the measured ones beside them.

That is also the general lesson this bucket ends on: **a sim that cannot fail is not evidence.**
The standable check is what made every other ladder here safe to wire, and on one ship it silently
had no teeth. Worth checking the next time a landing assertion looks green.

### How it got here (original entry)


**Lletya and the Port Sarim jail are done** — the owner said where each goes (up into the tree
walkways; down to the cells) and both are the plain vertical link, so `elf_village_ladder`,
`elf_village_ladder_top`, `prison_ladder_up` and `prison_laddertop` now carry
`category=ladder_up`/`ladder_down`. `tools/sim/ladderclimb.ts` climbs **every** placed instance of
each and checks the player changed level the right way and landed somewhere standable: **34 ok,
0 FAIL, 0 untested** across all seventeen.

`prison_ladder_up` turns out to be placed beyond the jail as well, at 2948,3213 and 2915,3323, and
the link lands standably in those too — so the category is right wherever the loc sits rather than
only where the hint was about.

That sim is the thing the previous attempt at this bucket lacked, and it generalises: **given a
hint about where a ladder goes, climbing every instance and checking the landing is a sound test**
— it is only the *guessing* of the destination that could not be made to work. Each area's hint is
wired and verified the same way, and `ladderclimb.ts` gains a row per area as the hints arrive:
Lletya, the Port Sarim jail, the Wilderness dungeon and Burgh de Rott's cellars so far — **48 ok,
0 FAIL, 0 untested** across all seven locs.

**That sim lied once and it is worth knowing how.** Its inner loop destructured the tile offset as
`[dx, dz]`, shadowing the ladder's own `dz`, so `dz !== 0` tested the offset rather than the ladder
kind. Every ladder took whichever branch its first standable tile happened to pick, and the
Wilderness check collapsed to `p.level === 0` — trivially true, verifying nothing about the 6400
move it exists to check. It reported 36 ok while testing the wrong thing. The offsets are `odx`/`odz`
now and the header says why.

**The Wilderness one was a different shape, and worth reading before the next hint.**
`wild_laddertop_dungeon` is Climb-down on level 0, so there is no level below and a category
would have dropped a player into the ground — `climbladders` had already flagged exactly that.
Dungeon ladders in `ladders.rs2` are all explicit instead (`loc_1767` into the Lava Maze,
`loc_1765` to the KBD lair), and the destination here needed no arithmetic: `loc_1755` sits at
the same x and z, 6400 south, and its own handler is
`~climb_ladder(movecoord(coord(), 0, 0, -6400), true)`. This is that mirrored, so the two ends
agree by construction.

So **a hint names the destination, not the mechanism** — some of the remaining nineteen will be
plain vertical links and some will be teleports, and which one is a question for the map once
you know where it goes.

`elf_village_ladder_mid` is left: Climb-up on op2 and Climb-down on op3, and the generic handler
is op1-only, so no category answers both. It wants `[label,ladder_options]`, which `ladders.rs2`
already has. *(Done — see the head of this section.)*


`npx tsx tools/sim/deadladders.ts`. These need somebody who knows the areas; three approaches have
already failed and are written up in `opsweep-backlog.md`. The specific trap, found the hard way:
three Lunar Isle ladders whose other half is one tile off had **already been wired and reverted**
once, and `lunar_isle.loc` says so. 28 were wired on tool evidence and all 28 reverted.

`climbladders.ts` exists and its calibration proves it cannot decide this — a working ladder manages
6 of 13 interaction tiles landing on open ground and a deliberately unwired one manages 4 of 7. One
rule survived: a ladder solid from *every* interaction tile cannot be a vertical link, which rules
out 10 and leaves the rest to judgement.

**A fourth tool was considered and deliberately not written.** The technique that cracked the two
mining clusters was not a rule but identifying the *place* from the npcs standing in it — and here
that adds nothing, because the names already say it: `elf_village_ladder` is Lletya,
`prison_ladder_up` is the Port Sarim jail, `wild_ladder` the Wilderness, `burgh_floorboard_hatch`
Burgh de Rott, `boardgames_ladderdown` the board games. `deadladders.ts` already prints each one's
placement and names its partner.

What is missing is not context, it is whether each *landing* is safe, and `loc_11739` is the proof
that cannot be computed: `deadladders` finds it a same-tile partner at 3050,3355,2 on 7 of 7
instances — about as strong as the evidence gets — and climbing it still puts the player at
3050,3356,2, which is a wall. The generic handler telejumps from the tile the PLAYER stands on, not
the ladder's own tile, so the landing depends on the side they approached from, and nothing in the
map says which side that is.

**Two more angles tried since, both dead**, listed so they are not tried a third time:

- *Identify the area from the npcs standing in it* — the technique that cracked both mining
  clusters. Adds nothing here: the names already say it (`elf_village_ladder` is Lletya,
  `prison_ladder_up` the Port Sarim jail, `wild_ladder` the Wilderness, `burgh_floorboard_hatch`
  Burgh de Rott), and `deadladders.ts` already prints each one's placement and partner.
- *Read the destination out of a quest runner's `JUMPED to` steps* — a jump often exists because
  a link is missing, so the manifest might name where the ladder should go. It does not: the
  Mourning's End runner has Lletya only at level 0 and never goes up, which is true of the other
  areas too. The runners route around these ladders rather than across them.

The blocker is unchanged and is not about destinations at all. `deadladders` finds `loc_11739` a
same-tile partner on **7 of 7** instances — the strongest evidence this gets — and climbing it
still lands the player at 3050,3356,2, a wall. The handler telejumps from the tile the PLAYER
stands on, so the landing depends on the side they approached from, and nothing in the map says
which side that is.

So this stays as the backlog has it: 24 one-line `category=` additions, each wanting someone who
knows where its ladder goes. A hint by area ("the Lletya ones go up to the tree walkways") is worth
more here than any amount of further analysis.

## 5. `Release` and `Play-With` intent — RESOLVED, every part of it, and none needed a choice

All four pieces of this entry are written and tested. What makes it worth keeping is that **every
one of them was answered by the repository rather than by a decision**: three unused animations for
the fishbowls, a `Release-all` sibling for the balloon toads, and for the POH toys a complete
feature in the cache with only the three verbs missing. The four options originally listed as
needing a choice were all answerable from the build, so none of them was ever taken.

Two separate decisions, both now researched down to a one-word answer. Nothing here needs more
digging; it needs a choice.

**`iop2="Play-With"` on the 3 fishbowl fish** — DONE, and the cache answered it.

The option fell through to the global `[opheld2,_]` equip code and silently wore the bowl. What
settles what it should do instead is that the cache carries three animations nothing plays:
`human_play_with_pet_fish_blue`/`_green`/`_spine`, one per bowl. A one-to-one match with the three
objs is not a coincidence, and the shape is Diango's toy horseys — `[opheld1,horsey_brown]`
`@toy_horsey_say(human_playhorsey_brown)` does `p_stopaction`, `anim` and a line. Play-with plays
an animation there, so it plays one here.

The four options I listed as needing a choice were all answerable from the repo, so none of them
was taken. Claiming the option was safe because **nothing reads a fishbowl out of `worn`** — that
mislabelled click was the only route to the slot, and no script wanted it. The bowl stops being
holdable, which `equipcycle --unwearable` now reports about it truthfully.

**`iop5="Release"` on 6 items** — PARTLY DONE, and the file answered most of it.

Six more Release items are already wired and they establish the pattern: `[opheld5,ferret]` is
`inv_del` plus *"You let the ferret go. It scampers off into the undergrowth."*, and
`bloated_toad` the same with a `~release_toad` effect. **So this project does destroy on Release,
without a confirmation** — my earlier note that deleting "would want a confirmation dialog too"
was wrong about this codebase.

**The two `100_jubbly_balloon_toad_*` are done**, and needed no decision at all. They carry three
options, two already working: `iop1` Drop runs `@hundred_place_toad`, and `iop4` Release-all
answers with a message and deletes nothing. The singular Release is now that line in the
singular, so the two differ only in number — which is what their labels say.

**The four POH toys — DONE.** The cache specified the whole feature and it is now written, in
`content/scripts/skill_construction/scripts/poh_toys.rs2`.

Three verbs were dead, not one: `Wind` on the unwound objs, `Release` on the wound ones and on
`poh_toy_cat`, and `Pick-up` on the npcs. Everything else already existed — the npcs with
`vislevel=hide` and their own `walkanim`/`readyanim`, and `[proc,release_toad]` as the precedent
for turning an item into a creature and letting it go.

The two things the cache did not settle were decided and written down: **Pick-up returns the
unwound obj**, because `Wind` exists and returning the wound one would make it unreachable; and
the npc **lives 500 ticks**, where the toad's 10 is right for something hopping into the
undergrowth and wrong for something you mean to pick up again.

`tools/sim/pohtoys.ts` walks the whole loop for all four toys — 25 ok, 0 FAIL — asserting the
round trip and the count rather than the steps, because a Wind that eats the toy and a Pick-up
that hands back the wrong obj both pass a "did it say something" check. opsweep went 0 new / 11
fixed, which is exactly three Winds, four Releases and four Pick-ups.

## 6. Script-spawned npcs with a dead `Talk-to` — RESOLVED, and it split in two

**The earlier entry below was wrong on its central claim.** It said none of the eleven is
referenced by name anywhere in any script. Every one of them is, each in its own quest file, and a
word-boundary grep finds them in one pass. The mistake was the same shape as the one that entry
itself warns about with `hazeel`: a loose search that answers confidently either way. The correction
matters because the context it said was missing is exactly what decided every case below.

**The real question turned out to be reachability, not dialogue.** Six of the eleven are on their
feet while the player is free to click, and six needed writing. The other five are spawned inside
an unbroken `p_delay`/dialogue chain, where the player never gets a click to spend, so there is
nothing to write and writing it would be dead code:

| npc | verdict |
| --- | --- |
| `burgh_gadderanks_attackable` | reachable — a real three-on-one fight. Narrated line. |
| `cyrisus_dream` | reachable — stands at the arena edge for 2000 ticks. |
| `morgan_le_faye` | reachable — stands for 50 ticks after the bargain. |
| `regicide_evil_elf1` (Essyllt) | reachable — on the path for 500 ticks either side of the scene. |
| `regicide_evil_elf2` (Morvran) | reachable — the same. |
| `ungadulu_bad` | reachable — on his feet for 100 ticks, and attackable. |
| `hazeel` | **unreachable** — `npc_add`, `p_delay(5)`, then an unbroken chat chain, and `[queue,hazeel_leave]` opens with `if_close` and deletes him. |
| `zadimus_ghost` | **unreachable** — `npc_add`, one `~chatnpc`, `npc_del`, all inside one script. |
| `route_vanstrom_klause_normal` | **unreachable** — the whole reveal is a `p_delay` chain. |
| `route_vanstrom_klause_vamp` | **unreachable** — same chain, one `npc_changetype_keepall` later. |
| `route_vanstrom_klause_vamp_wingsgrow` | **unreachable** — same. |

So the honest answer to five of these is **"the option is never offered to a player who can act"**,
and that is a finding about the cache rather than a gap in the writing. It is worth keeping as a
rule for the 501-npc bucket this was carved out of: *before writing dialogue for a script-spawned
npc, check whether the script ever hands the player a tick in which to click it.*

**Where the lines came from.** Each of the six is in the voice its own file already uses, and three
were answerable from the file rather than invented. Essyllt and Morvran reuse the two things they
say in the cutscene — one challenges, one quotes the law — and the file had already confirmed their
names from `[name=]`. Gadderanks is narrated rather than given a chat box because he has a real
conversation twenty lines further down on `burgh_gadderanks_wounded`, and because a dialogue window
in the middle of a three-on-one is not a kindness. Cyrisus shouts with `npc_say` for the reason his
own file writes down at length: there is a level 343 fear in that room. Morgan Le Faye gives back
the three questions she already answers, because a player who closed the window had no other way to
hear the Excalibur instructions again.

**And clearing one dead op uncovered the next.** With his Talk-to written, `cyrisus_dream` came back
with `op3="Inspect"` instead — dead on all three of his forms. That one was fully specified by the
build: `%dm_armament` is a five-slot bitfield that `~dm_pick` fills one slot at a time out of Jack's
account, and a player half-way through recovering it had no way at all to see which slots they
already held, since Astral Contact only confirms the last guess. Inspect now lists what is still
missing. Expect this shape again in the 501: the first dead op on an npc is often not the only one.

### How it got here (original entry, including the claim that was wrong)


Dialogue nobody has written, for npcs a script spawns rather than the map placing. **Checked, and
the repo does not answer this one** — unlike the balloon toads, the pet fish and the POH toys,
where it did. The eleven `opsweep` lists with `<- npc_add` are `burgh_gadderanks_attackable`,
`cyrisus_dream`, `hazeel`, `morgan_le_faye`, `regicide_evil_elf1`/`2`,
`route_vanstrom_klause_normal`/`_vamp`/`_vamp_wingsgrow`, `ungadulu_bad` and `zadimus_ghost`, and
**not one of them is referenced by name anywhere in any script**.

A first pass suggested `hazeel` had thirteen lines of dialogue already written and `ungadulu_bad`
one. Both were substring noise — the thirteen all belong to `hazeel_cultist`,
`clivet_hazeel_cultist` and `butler_jones_hazeel_cultist`, which are different npcs. Matching the
names exactly returns nothing at all. Same shape as the `$fail_coord` false positive in
`deaddata.py`: a name that is a prefix of other names will lie to a loose grep.

So this one really does need writing. The larger bucket is 501 npc `Talk-to` options in the same
state (`opsweep-backlog.md`); these are separated only because a script spawns them, so a player
meets them in a specific moment that suggests what they would say.

## 7. Three test assertions I rewrote — RESOLVED, the owner reviewed the diffs and kept all three

Each asserted an option was **absent** and now asserts the guarantee instead: the two barrows
broken-piece checks (`~barrows_broken_refuse` claims the Wear) and the `maxcape` `iop3`.

**The pattern is the part worth keeping.** In all three cases the absence being asserted was what
silently disabled a handler someone had already written — `~barrows_broken_refuse` never ran for any
of the 24 broken pieces, so a player holding a broken helm was told nothing, and
`~avas_attract_toggle` sat in `avas_device.rs2` with nothing able to fire it. `orphans.ts` found both
sets. An "option absent" assertion can lock in a dead handler and look like passing coverage, which
is a shape to watch for rather than a one-off.

Note for anyone reverting these later: putting an assertion back is only half the job. The
assertion was true *because* the obj carried no `iop`, so restoring it means taking the
`iop2`/`iop3` off the objs again — which re-breaks the three handlers.

---

## Two questions from the equip sweep — BOTH RESOLVED, and they had one cause

`npx tsx tools/sim/equipcycle.ts`. No second duplication exists among wearable items.

Neither was a content question in the end. **Both were the probe player: max stats, empty inventory,
and no quest progress at all.**

- ~~**93 objs have a `wearpos` and no Wear, Wield or Equip option**~~ — the tool was wrong to call
  these unreachable. It matched three label words, and the route need not be spelled any of them:
  `trollromance_toboggon_waxed` is `iop2=Ride` with `~can_ride_sled`, and the Monkey Madness
  greegrees are `iop2=Hold` answered by a **category** trigger, `[opheld2,_mm_greegree]`, which a
  per-obj grep misses too. Troll Romance *requires* that sled worn, so if it were truly unequippable
  the quest could not be finished. `equipcycle.ts` now finds the route by clicking each option and
  seeing which one lands something in the worn tab, so these go through the same conservation cycle
  as everything else. Only 4 of the 93 were recovered, because the greegree and sled handlers want
  quest state this player does not have — so the remaining list means "nothing equipped it for a
  fresh maxed player", not "unequippable".
- ~~**21 would not go on at all**~~ — **every one is quest-gated**, read straight off the triggers
  rather than guessed:

  | obj | gate |
  |---|---|
  | `rune_platebody_h1..h5`, `saradomin`/`ancient`/`armadyl`/`bandos_platebody`, `dragonfire_shield`(+uncharged) | `@levelrequire_dragon_slayer_quest_defence` |
  | `gilded_dhide_body` | `@levelrequire_dragon_slayer_quest_ranged_and_defence` |
  | `dragon_scimitar_or` | `@levelrequire_mm_quest_attack` |
  | `dragon_sq_shield_g` | `@levelrequire_legends_quest_defence` |
  | `viking_helmet`/`_sword`/`_shield` | `@levelrequire_viking_quest_defence` |
  | `avas_attractor`, `avas_accumulator` | `@avas_wear` |
  | `quest_point_cape`, `toxic_blowpipe` | own trigger |

  A wear option that refuses a player with every stat is exactly right when the gate is a quest and
  the player has done none. Nothing to fix.

**The lesson worth keeping** is that both of these looked like content bugs and were artefacts of the
test's own player. Any future sweep that reports "cannot be done" should say *by whom* — a maxed
character with no quest progress is a narrow lens, and twice now it has made correct content look
broken.

## Not a decision, just the measurement

The first nightly on the merged engine (run 40, `9d29cbde`) was **green**, and it answers the one
thing that was unmeasured. The fuzz job took **512s against its 90-minute cap** — and it is *faster*
on a hosted runner than the 881s measured on the development box, which is the opposite of what I
predicted when setting that cap. The ratchets job took 98s. Runs 38 and 39, before the merge, had
both failed.

One night is not variance, so the cap is worth leaving alone until there are a few more; if it is
ever tightened, 512s is the number to start from and not the 881s in `fuzz.ts`'s header.

## Tried and not viable: a world connectivity flood fill

The idea was to flood walkable tiles from Lumbridge and find content placed where no player can
walk. `isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED)` from `GameMap` is the right primitive and
a breadth-first fill over level 0 runs fine, so the attempt failed on its meaning rather than its
mechanics.

It reached **3,000,000 tiles and stopped there because that was the cap**, inside a bounding box of
about 4.35M. That makes the run inconclusive as it stands - "Varrock square not reached" came out of
it, and Varrock is plainly walkable from Lumbridge, so that is the truncation and not a finding.

The reason it got that far is the thing to fix before trying again: `WALK_BLOCKED` is set where
something blocks, so a tile with **no map data at all** is not flagged and reads as open. The fill
leaks through void instead of stopping at the edge of the world, which is why the number is
implausibly large for the walkable surface of a 377 map. A usable version needs a "does this tile
have map data" test - a loaded-zone check - and not just the collision flag.

Worth knowing even then: the honest signal is small. Entrana and Ape Atoll correctly came back
unreachable, and so would every island, dungeon and instance that a player reaches by boat, ladder
or teleport. Those are correct answers and useless ones, which is the shape `climbladders.ts` is
already in. Any second attempt should decide up front how it tells "unreachable on foot, as
designed" from "unreachable, which is a bug", because the first flood fill cannot.
