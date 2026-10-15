// THE THINGS NOTHING GAVE OUT, AND THE CLICKS THAT DID NOTHING - five fixes the owner asked for on
// 2026-10-15, against the real engine and the real packed scripts.
//
//   npx tsx tools/sim/newsources.ts
//
// Each of these was found by a report rather than by a failing check, which is why they lasted:
// tools/silentnpcops.py (the npc half of silentops) for the dead clicks, and obtainable.py for the
// items nothing produced. A report is read by a person; a sim fails on its own, so the four that
// can be asserted are asserted here.
//
//   the fishing spots  twelve spot records of the four BUILT kinds carried no category=, so
//                      [opnpc1,_freshfish] and its three siblings could not reach them and Net,
//                      Harpoon, Lure, Bait and Cage did nothing at 56 spawn points. The engine
//                      looks a trigger up on the npc's own type and then its category, which is
//                      what deadNpcOps mirrors, so that is what is asked here - and then one real
//                      click, because "a trigger exists" is not "the click works".
//   the mith grapple   gwd_encampments.rs2 has gated the Armadyl chasse crossing on carrying one
//                      since it was written and nothing in the build produced one. A mithril bar on
//                      a rope at 59 Smithing does now (gwd_grapple.rs2).
//   the flyer          Ali the Leaflet Dropper stood at the Al Kharid gate with two dead clicks and
//                      a flyer obj whose Read was already written.
//   the colonist       a Swan Song colonist was spawned in the Gnome Stronghold, eight map squares
//                      from the colony, by the bulk map import. The spawn is gone; this is the
//                      check that keeps it gone.
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import NpcType from '#/cache/config/NpcType.js';
import ParamType from '#/cache/config/ParamType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();

// THE MARK GOES BEFORE THE CLICK, which is the thing this directory gets wrong most often: a1lib's
// talk() and drive() mark the interface log when THEY start, so the first chatnpc line of a
// conversation - written while the op was still being driven - is already behind their slice. Both
// of the lines read below are first lines, so they are read from a mark taken here instead.
const ifaceMark = () => H.ifaces.length;
const shown = (p: { username: string }, from: number) =>
    H.ifaces
        .slice(from)
        .filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1)
        .map(i => i.text!);

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown, detail?: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
    if (!pass && detail !== undefined) console.log('    saw:', JSON.stringify(detail));
};

// =============================================================================== the fishing spots
console.log('THE TWELVE FISHING SPOTS THAT ANSWERED NOTHING');
// The records, and the kind whose category trigger has to reach each one.
const SPOTS: [string, string][] = [
    ['0_33_51_memberfish', 'memberfish'],
    ['0_34_50_freshfish', 'freshfish'],
    ['0_35_50_freshfish', 'freshfish'],
    ['0_41_57_memberfish', 'memberfish'],
    ['0_41_57_rarefish', 'rarefish'],
    ['0_41_57_saltfish', 'saltfish'],
    ['0_42_42_memberfish', 'memberfish'],
    ['0_43_42_memberfish', 'memberfish'],
    ['0_52_149_freshfish', 'freshfish'],
    ['0_54_49_memberfish', 'memberfish'],
    ['0_55_49_memberfish', 'memberfish'],
    ['52_59_rarefish', 'rarefish']
];
// deadNpcOps is the engine's own dispatch: the trigger on the npc's own type, then its category,
// with a multinpc shell's variants' labels counted as offered. None of the twelve may be in it.
const dead = A.deadNpcOps(0, 0, 16383, 16383);
const stillDead = SPOTS.map(([name]) => name).filter(name => [...dead.keys()].some(k => k.startsWith(name + ' ')));
check('  none of the twelve has an op nothing answers', stillDead, []);
// and the whirlpool the fishing random event changes them into, which is the other half of the fix:
// macro_event_whirlpool_spawn does npc_changetype(npc_param(whirlpool), 60) and throws on a null.
const WHIRLPOOL = ParamType.getId('whirlpool');
const noWhirlpool = SPOTS.filter(([name, kind]) => {
    const t = NpcType.get(NpcType.getId(name));
    return t.params?.get(WHIRLPOOL) !== NpcType.getId('macro_whirlpool_' + kind);
});
check(
    '  and each carries the whirlpool its kind turns into',
    noWhirlpool.map(s => s[0]),
    []
);

// ONE REAL CLICK, at a Brimhaven-coast memberfish spawn (map square 54_49, twelve of them).
{
    const p = A.player('spotfish', 3470, 3199);
    p.setLevel(PlayerStat.FISHING, 99);
    H.give(p, 'big_net', 1); // ~check_fish_equipment(big_net) is what the Net branch asks for
    H.tick(1);
    const spot = A.findNpc('0_54_49_memberfish', p);
    const m = A.mark();
    p.teleport(spot.x + 1, spot.z, 0);
    H.tick(1);
    H.opNpc(p, spot, 1); // Net
    for (let t = 0; t < 20 && !p.activeScript && !A.mesSince(p, m).length; t++) H.tick(1);
    const said = A.mesSince(p, m);
    check('  clicking Net on one is answered at last', said.length > 0, true);
    console.log('    ' + (said[0] ?? '(nothing)'));
    H.despawn(p);
}

// =============================================================================== the mith grapple
console.log('\nTHE MITH GRAPPLE, WHICH NOTHING PRODUCED - OLD SCHOOL AND ITS THREE STAGES');
{
    const p = A.player('grapple', 3222, 3218);
    H.give(p, 'hammer', 1);
    H.give(p, 'mithril_bar', 2);
    H.give(p, 'mithril_bolts', 2);
    H.give(p, 'rope', 2);
    H.tick(1);

    // the tip: 59 Smithing, 50 experience, one mithril bar
    p.setLevel(PlayerStat.SMITHING, 58);
    p.setLevel(PlayerStat.FLETCHING, 99);
    H.tick(1);
    let f = ifaceMark();
    A.useHeld(p, 'hammer', 'mithril_bar');
    H.tick(4);
    check('58 Smithing will not beat the bar into a tip', [H.invCount(p, 'mith_grapple_tip'), shown(p, f).some(t => /Smithing level of 59/.test(t))], [0, true]);
    p.setLevel(PlayerStat.SMITHING, 59);
    H.tick(1);
    let xp0 = p.stats[PlayerStat.SMITHING];
    A.useHeld(p, 'hammer', 'mithril_bar');
    H.tick(6);
    check('59 Smithing makes the tip, for one bar', [H.invCount(p, 'mith_grapple_tip'), H.invCount(p, 'mithril_bar')], [1, 1]);
    check('  and 50 Smithing experience', (p.stats[PlayerStat.SMITHING] - xp0) / 10, 50);
    A.useHeld(p, 'mithril_bar', 'hammer');
    H.tick(6);
    check('  bar on hammer is the same step, the other way round', H.invCount(p, 'mith_grapple_tip'), 2);

    // the unfinished grapple: 59 Fletching, 11 experience, the tip on a mithril bolt
    p.setLevel(PlayerStat.FLETCHING, 58);
    H.tick(1);
    f = ifaceMark();
    A.useHeld(p, 'mith_grapple_tip', 'mithril_bolts');
    H.tick(4);
    check('58 Fletching will not fit the tip to a bolt', [H.invCount(p, 'mith_grapple_unf'), shown(p, f).some(t => /Fletching level of 59/.test(t))], [0, true]);
    p.setLevel(PlayerStat.FLETCHING, 59);
    H.tick(1);
    xp0 = p.stats[PlayerStat.FLETCHING];
    A.useHeld(p, 'mith_grapple_tip', 'mithril_bolts');
    H.tick(6);
    check('59 Fletching fits it, for the tip and one bolt', [H.invCount(p, 'mith_grapple_unf'), H.invCount(p, 'mith_grapple_tip'), H.invCount(p, 'mithril_bolts')], [1, 1, 1]);
    check('  and 11 Fletching experience', (p.stats[PlayerStat.FLETCHING] - xp0) / 10, 11);

    // and the rope: no experience at all, which is the wiki's own 0
    xp0 = p.stats[PlayerStat.FLETCHING];
    A.useHeld(p, 'mith_grapple_unf', 'rope');
    H.tick(6);
    check('the rope finishes it, for the unf and one rope', [H.invCount(p, 'mith_grapple'), H.invCount(p, 'mith_grapple_unf'), H.invCount(p, 'rope')], [1, 0, 1]);
    check('  and no experience for that step', p.stats[PlayerStat.FLETCHING] - xp0, 0);
    // the other order, which one trigger on the half-made piece has to answer
    A.useHeld(p, 'mith_grapple_tip', 'mithril_bolts');
    H.tick(6);
    A.useHeld(p, 'rope', 'mith_grapple_unf');
    H.tick(6);
    check('  rope on the unfinished grapple works too', H.invCount(p, 'mith_grapple'), 2);
    H.despawn(p);
}

// =============================================================================== the leaflet boy
console.log('\nALI THE LEAFLET DROPPER, WHO HANDED OUT NOTHING');
{
    const boy = [...World.npcs].filter((n): n is Npc => !!n && n.type === NpcType.getId('ali_leaflet_dropper'))[0];
    check('he is in the world', !!boy, true);
    if (boy) {
        const p = A.player('flyer', boy.x + 1, boy.z);
        H.tick(1);
        // the mark goes before the click: A.talk marks when it starts, so his first line is behind it
        const f1 = ifaceMark();
        A.talk(p, 'ali_leaflet_dropper', [1]);
        const lines = shown(p, f1);
        check(
            'Talk-to is answered, and taking one is the first option',
            lines.some(t => /free flyers/i.test(t)),
            true,
            lines
        );
        check('  and the flyer is in your hands', H.invCount(p, 'leaflet_dropper_flyer'), 1);
        // Take-flyer, the op that was dead, and no second one while you hold one
        H.opNpc(p, boy, 3);
        for (let t = 0; t < 20 && !p.activeScript; t++) H.tick(1);
        A.drive(p);
        check('  Take-flyer gives no second flyer while you are holding one', H.invCount(p, 'leaflet_dropper_flyer'), 1);
        H.clearInv(p);
        H.tick(1);
        H.opNpc(p, boy, 3);
        for (let t = 0; t < 20 && !p.activeScript; t++) H.tick(1);
        A.drive(p);
        check('  and one again once you have none', H.invCount(p, 'leaflet_dropper_flyer'), 1);
        H.despawn(p);
    }
}

// =============================================================================== the stray colonist
console.log('\nTHE SWAN SONG COLONIST WHO STOOD IN THE GNOME STRONGHOLD');
{
    const placed = [...World.npcs].filter((n): n is Npc => !!n && n.type === NpcType.getId('swan_boat_colonist'));
    check(
        'no swan_boat_colonist is placed anywhere',
        placed.map(n => [n.x, n.z, n.level]),
        []
    );
    // the handler stays, so he works wherever he is properly placed one day
    const shell = NpcType.getId('swan_boat_colonist');
    check('  and the handler on the SHELL is still there, which is the only one the engine would find', ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPNPC1, shell, -1) !== null, true);
}

console.log('');
console.log(`${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
