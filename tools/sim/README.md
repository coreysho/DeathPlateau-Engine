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
`vengeance[:<case>]`, `lunar`, `lunarspells[:<case>]`, and `tools/sim/soak.ts` for a 400-tick soak
with the full npc population.

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

`tools/sim/beforeafter.sh <scenario>...` runs a scenario against the content at `HEAD~1` and then at
`HEAD`, rebuilding in between, so a fix can be shown rather than asserted.

## Two things that will bite you

- **Warm up past tick 8.** Half the combat guards in the content read
  `if (add(%lastcombat, 8) > map_clock)`. On a world that has only just started `map_clock` is 0-4,
  so an untouched player reads as "in combat two seconds ago" and monsters refuse to engage.
  `boot()` runs 30 ticks for this reason.
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
