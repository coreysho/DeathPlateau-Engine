// The game-mode drop-rate boost (content gamemodes/scripts/droprate.rs2), on real kills: the drop
// test cheat's own loop (_test/scripts/cheats/cheat_combat.rs2) kills the same monster for a player
// on each rate, and every obj the world adds is counted against who it was dropped for.
//
//   realism  the monster's own table pays ~25% more than on 10x; bones do not change
//   5x       ~10% more
//   rare     a greater abyssal demon's rare-drop-table items come no more often on realism
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

// every obj the world adds, per receiver
const drops = new Map<bigint, Map<string, number>>();
const origAdd = (World as any).addObj.bind(World);
(World as any).addObj = (obj: Obj, receiver64: bigint, duration: number) => {
    const m = drops.get(receiver64) ?? new Map<string, number>();
    const name = ObjType.get(obj.type).debugname!;
    m.set(name, (m.get(name) ?? 0) + 1);
    drops.set(receiver64, m);
    return origAdd(obj, receiver64, duration);
};

// A player per rate, far enough apart that their drops never share a tile.
const RATES: [string, number][] = [['realism', 1], ['5x', 5], ['10x', 10]];
const players = RATES.map(([name, rate], i) => {
    const p: any = H.makePlayer('drop_' + name, 3200 + i * 12, 3230, 60 + i);
    return { name, rate, p };
});
H.tick(2);
for (const { p, rate } of players) {
    H.maxOut(p);
    H.setVar(p, 'xp_rate', rate);
}

const run = (npc: string, kills: number) => {
    drops.clear();
    for (const { p } of players) {
        H.setVar(p, 'debug_droptest_npc', NpcType.getId(npc));
        H.setVar(p, 'debug_droptest_left', kills);
        H.runProc(p, '[proc,debug_droptest_tick]');
    }
    H.tick(kills * 4 + 20);
    return players.map(({ p }) => drops.get(p.hash64) ?? new Map<string, number>());
};
const total = (m: Map<string, number>, skip: (n: string) => boolean) =>
    [...m.entries()].filter(([n]) => !skip(n)).reduce((a, [, c]) => a + c, 0);

const KILLS = 1000;
console.log(`GOBLINS (${KILLS} each)`);
const [gr, g5, g10] = run('goblin', KILLS);
const bones = (n: string) => n === 'bones';
check('every kill leaves exactly one set of bones, whatever the rate', [gr, g5, g10].every(m => m.get('bones') === KILLS),
    [gr, g5, g10].map(m => m.get('bones')));
const [tr, t5, t10] = [gr, g5, g10].map(m => total(m, bones));
check('realism: the table pays about 25% more than on 10x', tr / t10 > 1.17 && tr / t10 < 1.33, [tr, t10, +(tr / t10).toFixed(3)]);
check('5x: about 10% more', t5 / t10 > 1.03 && t5 / t10 < 1.17, [t5, t10, +(t5 / t10).toFixed(3)]);

console.log(`GREATER ABYSSAL DEMONS (${KILLS} each)`);
const [ar, , a10] = run('superior_greater_abyssal', KILLS);
// the shared rare table's own items, which this monster only has through it
const RDT = ['rune_spear', 'dragon_med_helm', 'dragonshield_a', 'rune_javelin', 'rune_kiteshield', 'runite_bar',
    'keyhalf1', 'keyhalf2', 'nature_talisman', 'uncut_sapphire', 'uncut_emerald', 'uncut_ruby', 'uncut_diamond', 'dragon_spear'];
const rare = (m: Map<string, number>) => RDT.reduce((a, n) => a + (m.get(n) ?? 0), 0);
check('the rare drop table is not boosted: its items come about as often on realism as on 10x',
    Math.abs(rare(ar) - rare(a10)) <= 3 * Math.sqrt(rare(ar) + rare(a10) + 1), [rare(ar), rare(a10)]);
const own = (m: Map<string, number>) => total(m, n => n === 'ashes' || RDT.includes(n));
check("but the demon's own table is", own(ar) / own(a10) > 1.15, [own(ar), own(a10), +(own(ar) / own(a10)).toFixed(3)]);

console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
