// Eadgar's Ruse as ported from PlagueCityRS 349, start to finish on the real engine: Sanfew, Mad
// Eadgar, Burntmeat (both orders), Parroty Pete, alco-chunks both ways, the aviary hatch, the parrot
// under the prison rack, the scarecrow items handed in piecemeal, Tegid, the troll thistle (picked,
// dried on a fire, ground both ways, mixed into the ranarr potion), the parrot fetched back, the fake
// man, Burntmeat's burnt meat, the key in the kitchen drawers, the storeroom door, the goutweed crate
// and the guard's club, Sanfew's reward and his post-quest goutweed exchange - with the journal
// opened at every stage. Then the save migration from this server's old version of the quest.
// Usage: BUILD_SRC_DIR=<content> npx tsx tools/sim/port349_eadgar.ts
import { R, check, player, lastMes, mark, said, drive, saw, talk as talk0, useOn, useHeld, op, walkable, H, World, LocType, findNpc, addLoc, runProcProtected } from './a1lib.js';
import InvType from '#/cache/config/InvType.js';
import Player from '#/engine/entity/Player.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';

// every runtime script error, from any script, anywhere
const errors: string[] = [];
const origErr = console.error;
console.error = (...a: unknown[]) => {
    const s = a.map(String).join(' ');
    if (/script error|error/i.test(s)) errors.push(s);
    origErr(...a);
};

await H.boot();
H.loginOrder();

const gv = (p: Player, name: string): number => (VarPlayerType.getByName(name) ? H.getVar(p, name) : H.getVarBit(p, name));
const sv = (p: Player, name: string, v: number) => (VarPlayerType.getByName(name) ? H.setVar(p, name, v) : H.setVarBit(p, name, v));
const stage = (p: Player) => gv(p, 'eadgar_quest');
function standBy(p: Player, x: number, z: number, level: number) {
    for (let r = 1; r < 6; r++)
        for (let dx = -r; dx <= r; dx++)
            for (let dz = -r; dz <= r; dz++) {
                if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || !walkable(level, x + dx, z + dz)) continue;
                p.teleport(x + dx, z + dz, level);
                H.tick(1);
                return;
            }
    throw new Error(`nowhere to stand near ${x},${z},${level}`);
}
/** Open the quest journal: the stage's text must render without a script error. */
function journal(p: Player, what: string, has: string) {
    const from = H.ifaces.length;
    const errs = errors.length;
    H.ifButton(p, 'questlist:eadgar');
    H.tick(1);
    const t = H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text).map(i => i.text!).join(' ');
    check(`  journal (${what}) mentions "${has}", no error`, [t.includes(has), errors.length - errs], [true, 0]);
    p.closeModal();
}
/** talk(), but every chat line since the click - the first page is drawn before drive() starts. */
function talk(p: Player, npcName: string, picks: (number | string)[] = []): string[] {
    const from = H.ifaces.length;
    talk0(p, npcName, picks);
    return H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1).map(i => i.text!);
}
const SANFEW = [2897, 3427, 1] as const;
const EADGAR_HOME = [2890, 10086, 2] as const;
const toSanfew = (p: Player) => standBy(p, ...SANFEW);
const toEadgar = (p: Player) => standBy(p, ...EADGAR_HOME);

// =============================================================================== the quest
console.log("EADGAR'S RUSE (349)");
const p = player('eadgar349', ...SANFEW);
journal(p, 'not started', 'Sanfew');

sv(p, 'druidquest', 4);
talk(p, 'sanfew', ['more work']);
check('Druidic Ritual only: Sanfew has no more work, not started', stage(p), 0);
sv(p, 'death_equiproom', 80);
sv(p, 'troll_quest', 50);
talk(p, 'sanfew', ['more work', "I'll do it"]);
check('Death Plateau and Troll Stronghold done, 31+ Herblore: Sanfew starts it (10)', stage(p), 10);
journal(p, 'started', 'Mad Eadgar');
toSanfew(p);
let lines = talk(p, 'sanfew', ['What was I meant']);
check('  Sanfew reminds you', saw(lines, 'Journey to the north'), true);

toEadgar(p);
talk(p, 'troll_eadgar', ['goutweed']);
check('Eadgar first: ask the troll cook (15)', stage(p), 15);
journal(p, 'spoken to Eadgar', 'Troll');
lines = talk(p, 'troll_eadgar', ['No thanks']);
check('  Eadgar again: "Have you talked to the troll cook yet?"', saw(lines, 'talked to the troll'), true);

talk(p, 'eadgar_troll_chief_cook');
check('Burntmeat wants a tasty human (25)', stage(p), 25);
journal(p, 'Burntmeat second', 'tasty human');
lines = talk(p, 'eadgar_troll_chief_cook');
check('  Burntmeat again: "Did you find tasty human?"', saw(lines, 'Did you find tasty human'), true);

toEadgar(p);
talk(p, 'troll_eadgar', ['No thanks']);
check('Eadgar has a plan: he needs a parrot (30)', stage(p), 30);
journal(p, 'needs parrot', 'parrot');
lines = talk(p, 'troll_eadgar', ['Okay', 'No thanks']);
check('  no parrot yet: "go see if the zoo have one"', saw(lines, 'zoo have one'), true);

// the other order: Burntmeat before Eadgar
const o = player('eadgarcook', ...SANFEW);
sv(o, 'eadgar_quest', 10);
talk(o, 'eadgar_troll_chief_cook');
check('Burntmeat first (20)', stage(o), 20);
toEadgar(o);
talk(o, 'troll_eadgar', ['No thanks']);
check('  then Eadgar: straight to his plan (30)', stage(o), 30);
H.despawn(o);

// Parroty Pete and the alco-chunks
H.give(p, 'pineapple_chunks', 2);
H.give(p, 'vodka');
H.give(p, 'gin');
useHeld(p, 'vodka', 'pineapple_chunks');
check('chunks and vodka before Pete has said anything: "Why would you want to do that?"', [H.invCount(p, 'eadgar_alco_chunks'), lastMes(p)], [0, 'Why would you want to do that?']);
talk(p, 'eadgar_zoo_keeper_aviary', ['When did you add it']);
check('Parroty Pete: the vodka story', gv(p, 'eadgar_pete_dialog_1'), 1);
talk(p, 'eadgar_zoo_keeper_aviary', ['What do you feed them']);
check('Parroty Pete: pineapple chunks', gv(p, 'eadgar_pete_dialog_2'), 1);
useHeld(p, 'vodka', 'pineapple_chunks');
check('vodka on the chunks: alco-chunks', [H.invCount(p, 'eadgar_alco_chunks'), H.invCount(p, 'vodka'), H.invCount(p, 'pineapple_chunks')], [1, 0, 1]);
useHeld(p, 'pineapple_chunks', 'gin');
check('chunks on the gin: alco-chunks', [H.invCount(p, 'eadgar_alco_chunks'), H.invCount(p, 'gin')], [2, 0]);

standBy(p, 2610, 3287, 0);
H.give(p, 'pineapple_chunks');
useOn(p, 2611, 3287, 'eadgar_aviary_wall_hatch', 'pineapple_chunks');
check('plain chunks through the hatch: the parrot flies off, chunks gone', [H.invCount(p, 'eadgar_drunk_parrot'), H.invCount(p, 'pineapple_chunks')], [0, 0]);
lines = useOn(p, 2611, 3287, 'eadgar_aviary_wall_hatch', 'eadgar_alco_chunks');
check('alco-chunks through the hatch: a drunk parrot', [H.invCount(p, 'eadgar_drunk_parrot'), H.invCount(p, 'eadgar_alco_chunks')], [1, 1]);
check('  and Parroty Pete catches you at it', saw(lines, 'NEVER feed alcohol'), true);
const m0 = mark();
useOn(p, 2611, 3287, 'eadgar_aviary_wall_hatch', 'eadgar_alco_chunks');
check('  a second parrot: "You\'ve already caught one."', [said(p, m0, "already caught one"), H.invCount(p, 'eadgar_drunk_parrot')], [true, 1]);

toEadgar(p);
talk(p, 'troll_eadgar', ['No thanks']);
check('Eadgar sees the parrot and explains the plan (50)', stage(p), 50);
journal(p, 'explained plan', 'hide the parrot');
standBy(p, 2828, 10096, 0);
useOn(p, 2828, 10096, 'eadgar_rack', 'eadgar_drunk_parrot');
check('the parrot hidden under the prison rack (60)', [stage(p), H.invCount(p, 'eadgar_drunk_parrot')], [60, 0]);
journal(p, 'hid parrot', 'rest of Mad Eadgar');
lines = op(p, 2828, 10096, 'eadgar_rack', 1);
check('  searching the rack: "I don\'t think it\'s done yet."', saw(lines, "done yet"), true);

toEadgar(p);
lines = talk(p, 'troll_eadgar', ['No thanks']);
check('Eadgar wants the scarecrow items (70)', stage(p), 70);
check('  "You now need the logs, 5 chickens, 10 bundles of grain and the dirty clothes."', saw(lines, 'You now need the logs, 5 chickens, 10 bundles of grain') && saw(lines, 'and the dirty clothes.'), true);
journal(p, 'needs items', '10 sheaves of grains');

// part of the items
H.give(p, 'logs', 2);
H.give(p, 'raw_chicken', 3);
H.give(p, 'grain', 4);
lines = talk(p, 'troll_eadgar', ['No thanks']);
check('part of them: one log, 3 chickens, 4 grain taken', [H.invCount(p, 'logs'), H.invCount(p, 'raw_chicken'), H.invCount(p, 'grain'), gv(p, 'eadgar_chickens'), gv(p, 'eadgar_grain')], [1, 0, 0, 3, 4]);
check('  "You now need no logs, 2 chickens, 6 bundles of grain and the dirty clothes."', saw(lines, 'You now need no logs, 2 chickens, 6 bundles of grain') && saw(lines, 'and the dirty clothes.'), true);

// the robe: Sanfew points at Tegid, and Tegid hands one over
toSanfew(p);
lines = talk(p, 'sanfew');
check('Sanfew: ask Tegid for a dirty robe', saw(lines, 'Tegid'), true);
lines = talk(p, 'eadgar_druid_washing', ["Sanfew won't be happy"]);
check('Tegid lends a dirty robe', H.invCount(p, 'eadgar_dirty_druid_robe'), 1);
lines = talk(p, 'eadgar_druid_washing');
check('  and does not offer a second', [H.invCount(p, 'eadgar_dirty_druid_robe'), saw(lines, 'spare any of those dirty robes')], [1, false]);

H.give(p, 'raw_chicken', 3);
H.give(p, 'grain', 7);
toEadgar(p);
lines = talk(p, 'troll_eadgar', ['No thanks']);
check('the rest: exactly 2 chickens and 6 grain taken, the robe, needs potion (80)', [stage(p), H.invCount(p, 'raw_chicken'), H.invCount(p, 'grain'), H.invCount(p, 'eadgar_dirty_druid_robe'), H.invCount(p, 'logs')], [80, 1, 1, 0, 1]);
check('  Eadgar: dry it in a fire, grind it, Ranarr weed', saw(lines, 'Ranarr weed'), true);
journal(p, 'needs potion', 'troll truth potion');

// the thistle
const thistle = findNpc('eadgar_troll_thistle', p);
const tx = thistle.x, tz = thistle.z;
standBy(p, tx, tz, thistle.level);
H.opNpc(p, thistle, 1);
drive(p);
check('a troll thistle picked, and the plant moves on', [H.invCount(p, 'eadgar_troll_thistle'), thistle.x !== tx || thistle.z !== tz], [1, true]);
H.give(p, 'ranarrvial');
useHeld(p, 'eadgar_troll_thistle', 'ranarrvial');
check('  fresh thistle into the potion: "dry it over a fire first"', lastMes(p), 'I need to dry it over a fire first.');
const fx = p.x + 1, fz = p.z;
addLoc('fire', fx, fz, p.level);
useOn(p, fx, fz, 'fire', 'eadgar_troll_thistle');
check('dried over a fire', [H.invCount(p, 'eadgar_troll_thistle'), H.invCount(p, 'eadgar_dried_troll_thistle')], [0, 1]);
H.give(p, 'pestle_and_mortar');
useHeld(p, 'eadgar_dried_troll_thistle', 'pestle_and_mortar');
check('dried thistle on the pestle: ground', [H.invCount(p, 'eadgar_dried_troll_thistle'), H.invCount(p, 'eadgar_ground_troll_thistle')], [0, 1]);
H.give(p, 'eadgar_dried_troll_thistle');
useHeld(p, 'pestle_and_mortar', 'eadgar_dried_troll_thistle');
check('pestle on the dried thistle: ground too', [H.invCount(p, 'eadgar_dried_troll_thistle'), H.invCount(p, 'eadgar_ground_troll_thistle')], [0, 2]);
const hb = p.stats[15];
useHeld(p, 'eadgar_ground_troll_thistle', 'ranarrvial');
check('into the ranarr potion: the troll potion, 77.5 xp', [H.invCount(p, 'eadgar_ground_troll_thistle_potion'), H.invCount(p, 'ranarrvial'), p.stats[15] - hb], [1, 0, 775]);
journal(p, 'potion made', 'give it to');

toEadgar(p);
talk(p, 'troll_eadgar');
check('Eadgar takes the potion: fetch the parrot back (85)', [stage(p), H.invCount(p, 'eadgar_ground_troll_thistle_potion')], [85, 0]);
journal(p, 'parrot back', 'prison rack');
H.give(p, 'ranarrvial');
useHeld(p, 'ranarrvial', 'eadgar_ground_troll_thistle');
check('  no second potion: "You don\'t need to make any more."', [lastMes(p), H.invCount(p, 'eadgar_ground_troll_thistle')], ["You don't need to make any more.", 1]);
lines = talk(p, 'troll_eadgar');
check('  Eadgar: "Did you get that parrot back?"', saw(lines, 'Did you get that parrot back'), true);

standBy(p, 2828, 10096, 0);
op(p, 2828, 10096, 'eadgar_rack', 1);
check('the parrot from under the rack (86)', [stage(p), H.invCount(p, 'eadgar_drunk_parrot')], [86, 1]);
journal(p, 'got parrot back', 'tell Eadgar');

toEadgar(p);
lines = talk(p, 'troll_eadgar', ['No thanks']);
check('Eadgar makes the fake man (87)', [stage(p), H.invCount(p, 'eadgar_fake_man'), H.invCount(p, 'eadgar_drunk_parrot')], [87, 1, 0]);
journal(p, 'fake man', 'Troll cook');

talk(p, 'eadgar_troll_chief_cook', ['where can I get some goutweed']);
check('Burntmeat takes the fake man: burnt meat, the key is in the drawers (90)', [stage(p), H.invCount(p, 'eadgar_fake_man'), H.invCount(p, 'burnt_meat')], [90, 0, 1]);
journal(p, 'burnt meat', 'key to the storeroom');

// the kitchen drawers
standBy(p, 2852, 10049, 1);
op(p, 2852, 10049, 'eadgar_kitchen_drawers', 1);
check('the kitchen drawers open', World.getLoc(2852, 10049, 1, LocType.getId('eadgar_kitchen_drawers_open')) !== null, true);
op(p, 2852, 10049, 'eadgar_kitchen_drawers_open', 2);
check('the fake bottom: the storeroom key', H.invCount(p, 'eadgar_troll_storeroom_key'), 1);
op(p, 2852, 10049, 'eadgar_kitchen_drawers_open', 2);
check('  searched again: no second key', H.invCount(p, 'eadgar_troll_storeroom_key'), 1);

// the storeroom door
// The storeroom is north of its door (the door's own tile is inside); the way in is from the south.
const q = player('eadgarnokey', 2869, 10083);
op(q, 2869, 10085, 'eadgar_storeroomdoor', 1);
check('the storeroom door without the key: still outside', [q.z < 10085, lastMes(q)], [true, 'You need to find the right key to open this door.']);
H.despawn(q);
p.teleport(2869, 10083, 0);
H.tick(1);
op(p, 2869, 10085, 'eadgar_storeroomdoor', 1);
check('with the key: unlocked (100), the key taken, and into the storeroom', [stage(p), H.invCount(p, 'eadgar_troll_storeroom_key'), p.z >= 10085], [100, 0, true]);
op(p, 2869, 10085, 'eadgar_storeroomdoor', 1);
check('  out again without the key', p.z < 10085, true);
op(p, 2869, 10085, 'eadgar_storeroomdoor', 1);
check('  and in again: unlocked for good', p.z >= 10085, true);
journal(p, 'unlocked', 'sneak in');

// the guards patrol
const g = findNpc('troll_sguard1', p);
const g0 = [g.x, g.z];
H.tick(20);
check('the storeroom guards patrol', g.x !== g0[0] || g.z !== g0[1], true);

// the goutweed crate and the club
standBy(p, 2856, 10074, 0);
const hp = p.levels[3];
op(p, 2856, 10074, 'eadgar_crate_goutweed', 1);
H.tick(6);
check('goutweed from the crate', H.invCount(p, 'eadgar_goutweed_herb'), 1);
check('  the guard wakes, throws his club and you come round by the storeroom door, out of the guards\' hall', [p.x, p.z, p.level], [2865, 10088, 0]);
check('  and it hurt no more than 6', hp - p.levels[3] <= 6, true);
journal(p, 'has goutweed', 'collect my reward');

// Sanfew
const herb = p.stats[15];
runProcProtected(p, '[proc,update_questpoints]');
const qp0 = gv(p, 'qp');
toSanfew(p);
talk(p, 'sanfew');
H.tick(3);
check("Sanfew takes the goutweed: complete (110), 11,000 Herblore xp", [stage(p), H.invCount(p, 'eadgar_goutweed_herb'), p.stats[15] - herb], [110, 0, 110000]);
check('  one quest point', gv(p, 'qp') - qp0, 1);
journal(p, 'complete', 'QUEST COMPLETE');
H.give(p, 'eadgar_goutweed_herb', 2);
talk(p, 'sanfew', ['more goutweed']);
check('post-quest: Sanfew swaps goutweed for herbs', [H.invCount(p, 'eadgar_goutweed_herb'), p.getInventory(InvType.INV)!.freeSlotCount < 28], [0, true]);
H.give(p, 'pineapple_chunks');
H.give(p, 'vodka');
useHeld(p, 'vodka', 'pineapple_chunks');
check('post-quest: no more alco-chunks', lastMes(p), "You don't need to make any more.");

// =============================================================================== save migration
console.log('MIGRATION (old invented stages onto the original)');
// [old stage, scarecrow flag, carry an old fake man] -> [new stage]
const cases: [number, number, boolean, number][] = [
    [0, 0, false, 0],
    [10, 0, false, 10],
    [20, 0, false, 15],
    [30, 0, true, 15],
    [40, 1, true, 15],
    [50, 1, false, 90],
    [60, 1, false, 100],
    [70, 1, false, 110],
];
let n = 0;
for (const [old, flag, fake, want] of cases) {
    const m = H.makePlayer(`eadgarmig${n++}`, 3222, 3218, 60 + n);
    // what an old save carries, set before the login script runs
    H.setVar(m, 'eadgar_quest', old);
    H.setVarBit(m, 'eadgar_scarecrow_items', flag);
    H.setVarBit(m, 'port349_eadgar', 0);
    if (fake) H.give(m, 'eadgar_fake_man');
    if (old === 50) H.give(m, 'eadgar_troll_storeroom_key');
    if (old === 60) H.give(m, 'eadgar_goutweed_herb');
    H.tick(2);
    const got = [stage(m), gv(m, 'eadgar_scarecrow_items'), gv(m, 'port349_eadgar'), H.invCount(m, 'eadgar_fake_man')];
    check(`old ${old}${flag ? ' (guard distracted)' : ''}${fake ? ' with a fake man' : ''} -> ${want}`, got, [want, 0, 1, 0]);
    if (old === 0) check('  fresh player: nothing else touched', [gv(m, 'eadgar_bits'), gv(m, 'eadgar_grain'), gv(m, 'eadgar_chickens')], [0, 0, 0]);
    if (old === 50) check('  keeps the storeroom key (the door takes it at 90)', H.invCount(m, 'eadgar_troll_storeroom_key'), 1);
    if (old === 60) {
        m.teleport(...SANFEW);
        H.tick(1);
        talk(m, 'sanfew');
        H.tick(3);
        check('  with the goutweed, Sanfew completes it', stage(m), 110);
    }
    if (old === 70) {
        const qp = gv(m, 'qp');
        check('  complete counts its quest point', qp >= 1 && H.runProc(m, '[proc,count_questpoints]')[0] === qp, true);
    }
    // the login again changes nothing
    const before = [stage(m), gv(m, 'eadgar_bits'), gv(m, 'port349_migrated')];
    runProcProtected(m, '[proc,port349_login]');
    check('  a second login changes nothing', [stage(m), gv(m, 'eadgar_bits'), gv(m, 'port349_migrated')], before);
    H.despawn(m);
}
// a player already on the new stages (migrated once) is never re-mapped, even at a value that
// meant something else in the old version
const r = H.makePlayer('eadgarnew', 3222, 3218, 90);
H.setVar(r, 'eadgar_quest', 50);
H.setVarBit(r, 'port349_eadgar', 1);
H.tick(2);
check('already migrated: stage 50 (explained plan) stays 50', stage(r), 50);

check('no runtime script errors', errors.length, 0);
console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
if (errors.length) console.log('script errors:\n  ' + errors.slice(0, 20).join('\n  '));
process.exit(R.bad ? 1 : 0);
