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
`stack4`, `trident`, `tridentsound`, `hitdelay`, `barrows:<npc>`, and `tools/sim/soak.ts` for a
400-tick soak with the full npc population.

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
- **One fight per process.** `%lastcombat` and `%aggressive_npc` survive a fight, and the content's
  own singles rule then refuses the next one. That is correct behaviour, but it is not what you are
  usually measuring.
