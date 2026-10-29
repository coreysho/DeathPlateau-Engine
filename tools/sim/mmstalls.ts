// THE FIVE STALLS OF MARIM, which advertised "Steal from" and did nothing.
//
// Ape Atoll has a food stall, a crafting stall, a general stall, a magic stall and a scimitar
// stall, all five in the 377 cache with op2=Steal from, all five placed on m43_43, and not one of
// them had a stealing row or a trigger - so the click was thrown away in silence. The last two are
// 65-Thieving stalls and between them they are what the skill is trained on at that level.
//
// Three things worth checking beyond "does it pay":
//
//   1. THE LEVEL GATE. 5 for the first three, 65 for the magic and scimitar stalls.
//   2. WHAT IT BECOMES WHEN IT IS ROBBED. Every other stall in the game is loc_change'd to
//      `market`, a 2x2 Varrock silver stall. These are 1x1 monkey tables, so each names its own
//      picked-over twin in next_loc_stage, and the generic path had to learn to read it.
//   3. THAT NOBODY ELSE CHANGED. The seven stalls that were already there must still become
//      `market`, which means they must still carry no next_loc_stage of their own.
//
//   npx tsx tools/sim/mmstalls.ts
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToLoc } from '#/engine/GameMap.js';

await H.boot();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const THIEVING = 17;
const NEXT_STAGE = ParamType.getId('next_loc_stage');

type Stall = { key: string; level: number; xp: number; restock: number; loot: string[] };
// restock is the row's respawn_ticks, which ~scale_by_playercount leaves almost untouched on an
// empty world - so waiting that plus a few is waiting exactly long enough, and waiting seventy for
// all five is several thousand ticks of nothing.
const STALLS: Stall[] = [
    { key: 'food', level: 5, xp: 16, restock: 12, loot: ['banana'] },
    { key: 'crafting', level: 5, xp: 20, restock: 16, loot: ['ring_mould', 'necklace_mould', 'amulet_mould', 'chisel', 'gold_bar'] },
    { key: 'general', level: 5, xp: 25, restock: 16, loot: ['pot_empty', 'hammer', 'tinderbox'] },
    { key: 'magic', level: 65, xp: 90, restock: 24, loot: ['airrune', 'earthrune', 'firerune', 'naturerune', 'lawrune'] },
    { key: 'scimitar', level: 65, xp: 210, restock: 64, loot: ['iron_scimitar', 'steel_scimitar', 'mithril_scimitar', 'adamant_scimitar'] }
];

function settle(p: Player, max = 60) {
    for (let g = 0; g < max; g++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            p.executeScript(s, true, true);
            continue;
        }
        H.tick(1);
        if (!p.activeScript && !p.target && !p.delayed && p.queue.head() === null) break;
    }
    p.closeModal();
}

/** The one placement of a Marim stall, found on the map rather than trusted from a coord. */
function findStall(name: string) {
    const id = LocType.getId(name);
    for (let x = 2752; x < 2816; x++) {
        for (let z = 2752; z < 2816; z++) {
            const loc = World.getLoc(x, z, 0, id);
            if (loc) return loc;
        }
    }
    throw new Error('not placed: ' + name);
}

const p: any = H.makePlayer('mmstalls', 2800, 2764);
H.tick(1);
H.maxOut(p);
H.clearInv(p);
H.tick(2);
p.closeModal();

const heard = (fn: () => void): string => {
    const m = H.mesgs.length,
        f = H.ifaces.length;
    fn();
    return H.ifaces
        .slice(f)
        .filter(i => i.kind === 'text' && i.text)
        .map(i => i.text!)
        .concat(H.mesgs.slice(m).map(x => x.text))
        .join(' ');
};
const steal = (loc: any): string =>
    heard(() => {
        const t = LocType.get(loc.type);
        // PathingEntity.teleport is (x, z, level) - mmtraps.ts and seedstall.ts disagree about this and
        // only one of them is right. A level of 2775 is a very long pathfind.
        p.teleport(loc.x, loc.z + 1, 0);
        H.tick(1);
        p.clearPendingAction();
        p.queueWaypoints(findPathToLoc(0, p.x, p.z, loc.x, loc.z, p.width, t.width, t.length, loc.angle, loc.shape, t.forceapproach));
        p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOC2);
        settle(p);
    });

console.log('\nWHAT THE CACHE HAD, AND WHAT ANSWERS IT NOW');
for (const s of STALLS) {
    const name = 'mm_stall_' + s.key;
    const t: any = LocType.get(LocType.getId(name));
    const twin: any = LocType.get(LocType.getId(name + '_stolen'));
    check(`  ${name.padEnd(18)} says "Steal from"`, (t.op ?? [])[1], 'Steal from');
    check(`  ${''.padEnd(18)} and something answers it`, ScriptProvider.getByTrigger(ServerTriggerType.OPLOC2, t.id, t.category) !== null, true);
    check(`  ${''.padEnd(18)} names its picked-over twin`, t.params?.get(NEXT_STAGE), twin.id);
    check(`  ${''.padEnd(18)} and the twin cannot be robbed again`, (twin.op ?? [])[1] ?? null, null);
    check(
        `  ${''.padEnd(18)} its loot all exists`,
        s.loot.every(o => ObjType.getId(o) !== -1),
        true
    );
}

console.log('\nAND NOTHING ELSE CHANGED: the seven that were already here still become `market`');
for (const name of ['tea_stall', 'silk_stall_stealing', 'bakers_stall_stealing', 'gem_stall_stealing', 'fur_stall_stealing', 'spice_stall_stealing', 'silver_stall_stealing', 'seed_stall']) {
    const t: any = LocType.get(LocType.getId(name));
    check(`  ${name.padEnd(22)} names no twin`, t.params?.get(NEXT_STAGE) ?? null, null);
}

console.log('\nTHE LEVEL GATE');
for (const s of STALLS) {
    const loc = findStall('mm_stall_' + s.key);
    p.setLevel(THIEVING, s.level - 1);
    H.tick(1);
    const said = steal(loc);
    check(`  ${s.key.padEnd(9)} refuses at ${s.level - 1}`, [said.includes(String(s.level)), s.loot.some(o => H.invCount(p, o) > 0)], [true, false]);
    H.clearInv(p);
    H.tick(20);
}

// A TICK IS NOT FREE. The world has 12,640 static npcs in it, so sampling a five-item loot table to
// exhaustion across five stalls - sixty thefts each, with the respawn waited out between them - is
// forty thousand world ticks and twenty minutes. Eight thefts is enough to prove that a stall pays,
// that it pays the row's experience, that what comes out is on its own table and that it empties and
// comes back; the table itself is checked above, from the configs.
console.log('\nAND WHAT IT PAYS');
for (const s of STALLS) {
    const loc = findStall('mm_stall_' + s.key);
    const twin = LocType.getId('mm_stall_' + s.key + '_stolen');
    p.setLevel(THIEVING, s.level);
    H.clearInv(p);
    H.tick(2);
    const xp0 = p.stats[THIEVING];
    let got = 0,
        emptied = false;
    const seen = new Set<string>();
    for (let tries = 0; tries < 8 && got < 4; tries++) {
        const before = s.loot.map(o => H.invCount(p, o));
        steal(loc);
        s.loot.forEach((o, n) => {
            const d = H.invCount(p, o) - before[n];
            if (d > 0) {
                got += d;
                seen.add(o);
            }
        });
        if (!emptied) emptied = World.getLoc(loc.x, loc.z, 0, twin) !== null;
        H.tick(s.restock + 4);
    }
    const paid = (p.stats[THIEVING] - xp0) / 10;
    check(`  ${s.key.padEnd(9)} pays out (${got} in 8 attempts)`, got > 0, true);
    check(`  ${''.padEnd(9)} at ${s.xp} experience a time`, got === 0 ? 0 : paid / got, s.xp);
    check(
        `  ${''.padEnd(9)} off its own table`,
        [...seen].every(o => s.loot.includes(o)),
        true
    );
    check(`  ${''.padEnd(9)} empties into its twin, not a Varrock stall`, [emptied, World.getLoc(loc.x, loc.z, 0, LocType.getId('market'))], [true, null]);
    check(`  ${''.padEnd(9)} and is a stall again afterwards`, World.getLoc(loc.x, loc.z, 0, LocType.getId('mm_stall_' + s.key)) !== null, true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
