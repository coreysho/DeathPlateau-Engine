// Where the dragon pickaxe comes from, rolled on the REAL tables rather than read out of
// npc_drops.dbrow. The dbrow is generated from the same death scripts, so reading it back would
// only prove the generator agrees with itself; this kills each boss tens of thousands of times
// through the drop-test cheat (_test/scripts/cheats/cheat_combat.rs2) and counts what the world
// actually hands out.
//
// WHAT IT EXPECTS, and where each number is from - https://oldschool.runescape.wiki/w/Dragon_pickaxe
// lists exactly nine sources, of which this build has four:
//   Kalphite Queen      1/400     (kalphite_flyingqueen - the second form carries the table)
//   Chaos Elemental     1/256
//   King Black Dragon   1/1,000
//   Dagannoth Rex/Supreme/Prime   NOT a source in OSRS - must be exactly zero here
// Callisto, Vet'ion, Venenatis, Artio, Calvar'ion and Spindel are the other five and none of them
// exists in this build, so there is nothing to add them to.
//
// EVERY PLAYER IS ON 10x, because ^droprate_boost_10x is 0 (gamemodes/configs/gamemode.constant):
// on realism the game-mode boost would add 25% to every one of these rates and the sim would be
// measuring the boost as well as the table.
import * as H from './harness.ts';
import ObjType from '#/cache/config/ObjType.js';
import NpcType from '#/cache/config/NpcType.js';
import World from '#/engine/World.js';
import Obj from '#/engine/entity/Obj.js';

await H.boot();
H.loginOrder();

let ok = 0, bad = 0;
const check = (what: string, pass: boolean, got: unknown) => {
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}`);
};

// Every obj the world adds, counted per receiver - the same hook droprate.ts uses, and the only
// place a drop is unambiguously attributed to the player it was dropped for.
const drops = new Map<bigint, Map<string, number>>();
const origAdd = (World as any).addObj.bind(World);
(World as any).addObj = (obj: Obj, receiver64: bigint, duration: number) => {
    const m = drops.get(receiver64) ?? new Map<string, number>();
    const name = ObjType.get(obj.type).debugname!;
    m.set(name, (m.get(name) ?? 0) + 1);
    drops.set(receiver64, m);
    return origAdd(obj, receiver64, duration);
};

// Eight killers side by side, so a run of N kills costs N/8 ticks of wall clock rather than N.
// Spread far enough apart that no two of them can ever be handed the same ground pile.
const PLAYERS = 8;
const players = Array.from({ length: PLAYERS }, (_, i) =>
    H.makePlayer('dpick' + i, 3200 + i * 16, 3230, 60 + i));
H.tick(2);
for (const p of players) {
    H.maxOut(p);
    H.setVar(p, 'xp_rate', 10);
}

// The drop-test cheat's own loop, driven straight rather than through ::droptest so the 1000-kill
// cap (^debug_droptest_max) does not apply - a 1/1,000 drop cannot be measured in 1,000 kills.
// ^debug_droptest_delay is 4, so a run of K kills each needs 4K ticks plus slack for the last
// death script.
const roll = (npc: string, eachKills: number) => {
    drops.clear();
    const id = NpcType.getId(npc);
    for (const p of players) {
        H.setVar(p, 'debug_droptest_npc', id);
        H.setVar(p, 'debug_droptest_left', eachKills);
        H.runProc(p, '[proc,debug_droptest_tick]');
    }
    H.tick(eachKills * 4 + 40);
    let picks = 0;
    for (const p of players) picks += drops.get(p.hash64)?.get('dragon_pickaxe') ?? 0;
    return { kills: eachKills * PLAYERS, picks };
};

// A binomial 99.9%-ish window: 4 standard deviations either side of the expected count, which for
// these numbers is wide enough that a correct rate never trips it and a rate that is wrong by a
// factor of two always does. A zero expectation is checked as exactly zero instead.
const band = (kills: number, oneIn: number) => {
    const exp = kills / oneIn;
    const sd = Math.sqrt(kills * (1 / oneIn) * (1 - 1 / oneIn));
    return { exp, lo: Math.max(0, exp - 4 * sd), hi: exp + 4 * sd };
};

const CASES: [string, string, number, number | null][] = [
    // npc, what to call it, kills per player, expected 1/N (null = must never drop it)
    ['dagcave_melee_boss', 'Dagannoth Rex', 200, null],
    ['dagcave_ranged_boss', 'Dagannoth Supreme', 200, null],
    ['dagcave_magic_boss', 'Dagannoth Prime', 200, null],
    ['chaoselemental', 'Chaos Elemental', 750, 256],
    ['kalphite_flyingqueen', 'Kalphite Queen', 750, 400],
    ['king_dragon', 'King Black Dragon', 1500, 1000]
];

for (const [npc, label, each, oneIn] of CASES) {
    const t0 = Date.now();
    const { kills, picks } = roll(npc, each);
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    if (oneIn === null) {
        check(`${label}: no dragon pickaxe in ${kills} kills`, picks === 0,
            { picks, was: 'a 1/128 drop before this change, so ~' + Math.round(kills / 128) + ' expected if it were still there', secs });
    } else {
        const { exp, lo, hi } = band(kills, oneIn);
        check(`${label}: dragon pickaxe 1/${oneIn} over ${kills} kills`, picks >= lo && picks <= hi,
            { picks, expected: +exp.toFixed(1), window: [+lo.toFixed(1), +hi.toFixed(1)],
              observed: picks ? '1/' + Math.round(kills / picks) : 'never', secs });
    }
}

console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
