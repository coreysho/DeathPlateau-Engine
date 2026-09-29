# Combat simulation harness

Boots the **real** engine and steps it by hand. Nothing in here models the game: `World.start(false,
false)` loads the real map and the real compiled content, and `World.cycle()` is the server's own
tick. Players are real `Player` objects put into `World.playerLoop`, and the clicks come from
helpers that copy the packet handlers (`OpPlayerHandler`, `OpHeldHandler`, `IfButtonHandler`,
`processClientsIn`) including the parts that throw a click away.

Every hitsplat is recorded at the moment `Player.applyDamage` runs, so the numbers below are the
ticks damage actually landed on, not an estimate.

## Running

```
BUILD_VERIFY=false BUILD_SRC_DIR=/path/to/content npx tsx tools/pack/Build.ts   # once, after content changes
npx tsx tools/sim/run.ts <scenario>
```

Scenarios: `baseline`, `style`, `eat`, `eatmove`, `drink`, `drinkmove`, `stack2`, `stack3`,
`stack4`, `trident`, `tridentsound`, `hitdelay`, `barrows:<npc>`, `pets:<item>`, `clues`, `ranges`,
`vengeance[:<case>]`, `lunar`, `lunarspells[:<case>]`, `comborunes`, and `tools/sim/soak.ts` for a
400-tick soak with the full npc population.

`comborunes` holds the server to what the spellbook buttons count: a combination rune is one of each
of its two elements. Falador, Lumbridge and High Alchemy are clicked; Wind Strike and Smoke Rush call
the requirement and payment procs directly. The checks cover what each cast spends (plain runes
first, and a combination rune spent for one element paying the other too), the rune pouch, a staff
paying one half, the message when you are short, and alching a combination rune the cast would pay
with.

`vengeance` is the Lunar spell's rules against the real queues, as numbered checks that print `ok` or
`FAIL` and a total: hits of chosen sizes (0, 1, 4, 80, 81), a real whip fight, two hits due on one
tick from either side of the victim in the player loop, a fire bolt and a whip stacking in a real
fight with vengeance re-armed every tick, vengeance and recoil on both players, the 50-tick cooldown
shared with Vengeance Other, a black demon, and the hit that kills (and the double kill). Its cases
are `rules`, `melee`, `sametick`, `recoil`, `cooldown`, `npc` and `kill`. `lunar` sails to Lunar Isle
with Lokar, walks to the Astral altar and prays there at 64 and 65 Magic, and sails home;
`lunarspells` casts the rest of the book (`teleports`, `telegroup`, `skilling`, `support`,
`insight`, `contact`, `farming`).

`pets:<item>` puts a pet down, walks the owner up a staircase, then across the map, and reports the
pet's floor, its npc mode and how far behind it ended up. `clues` reads every obj in the game that
carries a trail_desc and reports any that fail to put text on screen. `ranges` asks, for every loc
that calls itself a range, whether a cooking trigger would actually fire on it.

`hitdelay` prints the ticks between the cast animation and the hitsplat at every range the trident
reaches, which is the number to compare against Old School when deciding whether a projectile is
tuned right:

```
   1 tile  apart  ->  2 ticks        5 tiles apart  ->  4 ticks
   2 tiles apart  ->  3 ticks        6 tiles apart  ->  4 ticks
   3 tiles apart  ->  3 ticks        7 tiles apart  ->  4 ticks
   4 tiles apart  ->  3 ticks
```

`npx tsx tools/sim/wearop.ts` holds the Worn Equipment tab's per-item options (obj `wearop1-8`, the
WEAROP packet) to the real `WearOpHandler`: every item with a worn option has a
`[label,wearop<n>_...]` handler, a worn glory's Edgeville teleports and leaves the next charge down
worn, a ring or necklace uses its charge on the finger or neck, bad ops are refused, and the backpack
Rub menus that now share the teleports still work.

`npx tsx tools/sim/packs.ts` covers item packs (content `scripts/item_packs`). Half of it is the
shops: for each of the nine that stock the water-filled vial pack it reads the stock row back out of
the **built** cache and out of the live `Inventory.fromType` container, because a shop that reads
right in `all.inv` and packs wrong is a real failure mode here - a gap in the stock numbering packs
as obj 65535 and shows as a blank square in the shop window. It also prices the pack through the
engine's own `calc_shop_value`: no price is written for the item anywhere, so what it checks is that
each shop's existing multiplier applied to cost 201 lands on the price that shop's OSRS wiki page
prints. Eight of the nine do. Jossik's does not and is meant not to - his store has always sold at
1300 where Old School's sells at 1100, and repricing his 24 lines of 2006 stock to chase one 2014
item is the thing the era rule forbids. The other half is opening: the pack
gives 100 noted vials of water and takes one slot doing it, a completely full 28/28 inventory still
opens one (the pack's own slot is what the contents go into, so there is no "not enough space" case
to hit), a stack of packs opens itself one every 2 ticks without pinning the player, and walking away
stops the run.

Read its verdict off the printed `N ok, M FAIL` line and not off the exit code: this one makes six
players, and any sim here that makes three or more dies in V8's teardown after `process.exit` and
reports 3 whatever it found. That is the harness, not the scenario - a sim that makes three plain
players and touches nothing else does it too, while the same sim with two does not.

`npx tsx tools/sim/bughunt.ts` is the script fault reporter
(`src/engine/script/ScriptFaults.ts`) against the real engine. It poisons a skeleton to death - the
one way a monster dies with an aggressive player and no hero, which is what the live
`.npc_findhero` fault needed - and asserts the death runs clean and the corpse is deleted, then
checks the reporter's own rules: off unless asked for, one signature per distinct fault however
often it fires, a full backtrace, a JSONL file, and a clear that empties both. Revert content
`d2f9bc2a4` and it prints the live backtrace instead, once.

`npx tsx tools/sim/fuzz.ts [ticks] [bots] [seed] [x,z,level]` puts fuzzing bots
(`src/engine/bot/BotFuzzer.ts`) into the real world and lets them click everything in reach, then
prints what the watchers and the fault reporter caught and what the bots actually did. It checks the
safety guard first every time - the fuzzer refuses on a production world and refuses around a player
who is not staff - because that is the part that must never rot. A run that finds nothing prints the
action histogram anyway: if it is all `idle` and `walk`, the finding is about the fuzzer.

The same run prints trigger coverage: how many of the build's triggers have ever run in that
process and how many never have. Pass `noguide` as the fifth argument to turn the coverage steering
off, so the same seed can be run both ways and the difference measured rather than asserted. On a
dev world the same numbers come from `NODE_SCRIPT_COVERAGE=true` and `::coverage` / `::coverage
write`, which is worth doing on its own: the never-reached list is a to-do list, and clearing it
before testing one thing says exactly which triggers that one thing touched.

`tools/sim/beforeafter.sh <scenario>...` runs a scenario against the content at `HEAD~1` and then at
`HEAD`, rebuilding in between, so a fix can be shown rather than asserted.

## Two things that will bite you

- **Warm up past tick 8.** Half the combat guards in the content read
  `if (add(%lastcombat, 8) > map_clock)`. On a world that has only just started `map_clock` is 0-4,
  so an untouched player reads as "in combat two seconds ago" and monsters refuse to engage.
  `boot()` runs 30 ticks for this reason. The PvP half of that rule is the 20-tick PJ timer on
  `%lastcombat_pvp`, which only counts once it has actually been set (`pjtimer.ts`).
- **A sim player has no socket.** To the engine it lost its connection the tick it was made, and
  `World.processLogouts` idle-logs it out 50 ticks later. `tick()` marks every player heard from
  each tick so a longer scenario keeps its players; without that, a click after tick 50 lands on a
  player with no slot and silently does nothing.
- **A click from here lands between ticks.** A real click is read at the start of a cycle; `ifButton`
  and friends run before the next one, so a script's `p_delay(n)` ends one tick later than in game.
  Allow for it before the next click, or the next click is thrown away as "delayed".
- **One fight per process.** `%lastcombat` and `%aggressive_npc` survive a fight, and the content's
  own singles rule then refuses the next one. That is correct behaviour, but it is not what you are
  usually measuring.
