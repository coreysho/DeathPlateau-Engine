// THE TREASURE TRAIL CLUES ported from PlagueCityRS 349 (DeathPlateau-Content, game_trail): every one
// of the 75 new clues in the drop tables is solved here the way a player would solve it.
//   npx tsx tools/sim/trail_349.ts
// - search clues (param trail_loc): search the crate, drawers, chest or boxes at the clue's coord
// - dig clues (maps and sextant): dig there with a spade; a guarded hard clue brings its wizard first
// - NPC clues: talk to the NPC holding the clue; an anagram hands the next clue over, a hard riddle
//   hands over a puzzle box
// - the two locked drawers open with their keys, and the scorpion book is in the Seers' bookcase
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import { isMapBlocked } from '#/engine/GameMap.js';
import ScriptState from '#/engine/script/ScriptState.js';

const errors: string[] = [];
const origErr = console.error;
console.error = (...a: unknown[]) => {
    const s = a.map(String).join(' ');
    if (/script error/i.test(s)) errors.push(s);
    origErr(...a);
};

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`${pass ? '  ok  ' : 'FAIL  '}${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const NEW_CLUES = [
    'trail_clue_easy_vague006',
    'trail_clue_easy_vague007',
    'trail_clue_easy_vague008',
    'trail_clue_easy_vague009',
    'trail_clue_easy_vague010',
    'trail_clue_easy_vague011',
    'trail_clue_easy_vague013',
    'trail_clue_easy_vague014',
    'trail_clue_easy_vague015',
    'trail_clue_easy_vague016',
    'trail_clue_easy_vague017',
    'trail_clue_easy_vague018',
    'trail_clue_easy_vague019',
    'trail_clue_easy_vague020',
    'trail_clue_easy_vague021',
    'trail_clue_easy_vague022',
    'trail_clue_easy_vague023',
    'trail_clue_easy_vague024',
    'trail_clue_easy_vague025',
    'trail_clue_easy_vague026',
    'trail_clue_easy_vague027',
    'trail_clue_easy_vague030',
    'trail_clue_easy_map004',
    'trail_clue_easy_map005',
    'trail_clue_easy_vague012',
    'trail_clue_medium_sextant014',
    'trail_clue_medium_sextant015',
    'trail_clue_medium_sextant016',
    'trail_clue_medium_sextant017',
    'trail_clue_medium_sextant018',
    'trail_clue_medium_sextant019',
    'trail_clue_medium_sextant020',
    'trail_clue_medium_map003',
    'trail_clue_medium_map004',
    'trail_clue_medium_map005',
    'trail_clue_medium_map006',
    'trail_clue_medium_map007',
    'trail_clue_medium_riddle006',
    'trail_clue_medium_riddle007',
    'trail_clue_medium_riddle008',
    'trail_clue_medium_riddle009',
    'trail_clue_medium_riddle010',
    'trail_clue_medium_anagram014',
    'trail_clue_medium_anagram017',
    'trail_clue_medium_anagram019',
    'trail_clue_hard_map002',
    'trail_clue_hard_map003',
    'trail_clue_hard_map004',
    'trail_clue_hard_map005',
    'trail_clue_hard_sextant014',
    'trail_clue_hard_sextant015',
    'trail_clue_hard_sextant016',
    'trail_clue_hard_sextant017',
    'trail_clue_hard_sextant018',
    'trail_clue_hard_sextant019',
    'trail_clue_hard_sextant020',
    'trail_clue_hard_sextant021',
    'trail_clue_hard_sextant022',
    'trail_clue_hard_sextant023',
    'trail_clue_hard_sextant024',
    'trail_clue_hard_sextant025',
    'trail_clue_hard_sextant027',
    'trail_clue_hard_sextant028',
    'trail_clue_hard_sextant029',
    'trail_clue_hard_sextant030',
    'trail_clue_hard_sextant031',
    'trail_clue_hard_sextant032',
    'trail_clue_hard_riddle022',
    'trail_clue_hard_riddle023',
    'trail_clue_hard_riddle024',
    'trail_clue_hard_riddle027',
    'trail_clue_hard_riddle028',
    'trail_clue_hard_riddle021',
    'trail_clue_hard_riddle025',
    'trail_clue_hard_riddle026'
];

// which NPC answers each NPC clue (trail_npc_clues.rs2), and whether it hands over a puzzle box
const NPC_CLUES: Record<string, { npc: string; puzzle: boolean }> = {
    trail_clue_easy_vague012: { npc: 'captain_tobias', puzzle: false },
    trail_clue_medium_anagram014: { npc: 'gnome_brimstail', puzzle: false },
    trail_clue_medium_anagram017: { npc: 'werewolfinnkeeper', puzzle: false },
    trail_clue_medium_anagram019: { npc: 'kangai_mau', puzzle: false },
    trail_clue_hard_riddle021: { npc: 'pilot_grand_tree', puzzle: true },
    trail_clue_hard_riddle025: { npc: 'gnome_heckelfunch', puzzle: true },
    trail_clue_hard_riddle026: { npc: 'gnometrainer', puzzle: true }
};
// the three that are neither: two drawers locked with a key, and a bookcase
const KEYED: Record<string, { key: string; coord: [number, number, number] }> = {
    trail_clue_medium_riddle007: { key: 'trail_clue_medium_riddle007_key', coord: [1, 2809, 3165] },
    trail_clue_medium_riddle008: { key: 'trail_clue_medium_riddle008_key', coord: [0, 2921, 3577] }
};
const BOOKCASE: Record<string, [number, number, number]> = { trail_clue_hard_riddle022: [1, 2702, 3409] };

const param = (obj: string, name: string): unknown => (ObjType.get(ObjType.getId(obj)) as any).params?.get(ParamType.getId(name));
const unpack = (c: number): [number, number, number] => {
    const u = CoordGrid.unpackCoord(c);
    return [u.level, u.x, u.z];
};
const holds = (p: Player, obj: string) => H.invCount(p, obj) > 0;
const talkThrough = (p: Player, ticks = 30) => {
    for (let i = 0; i < ticks; i++) {
        const sc = p.activeScript;
        if (sc && sc.execution === ScriptState.PAUSEBUTTON) p.executeScript(sc, true, true);
        H.tick(1);
    }
    if (p.modalChat !== -1) p.closeModal();
};
const locsAt = (level: number, x: number, z: number) => [...World.gameMap.getZone(x, z, level).getAllLocsUnsafe()].filter((l: any) => l.x === x && l.z === z && l.level === level).map((l: any) => LocType.get(l.type));

/**
 * Click op `op` on a loc from each open tile beside it in turn, until `done` says it worked (or, with
 * no `done`, until a click does not end in "can't reach"). A tile across a wall can fail silently,
 * so the clue itself is the better test where there is one.
 */
const clickLoc = (p: Player, level: number, x: number, z: number, name: string, op: number, use?: string, done?: () => boolean) => {
    const t = LocType.get(LocType.getId(name));
    for (let dx = -1; dx <= t.width; dx++) {
        for (let dz = -1; dz <= t.length; dz++) {
            const inside = dx >= 0 && dx < t.width && dz >= 0 && dz < t.length;
            if (inside || isMapBlocked(x + dx, z + dz, level)) continue;
            p.teleport(x + dx, z + dz, level);
            H.tick(2);
            const m = H.mesgs.length;
            if (use) H.useHeldOnLoc(p, use, x, z, name);
            else H.opLoc(p, x, z, name, op);
            talkThrough(p, 10);
            if (done ? done() : !H.mesgs.slice(m).some(t => t.who === p.username && /can't reach/.test(t.text))) return true;
        }
    }
    return false;
};

let n = 0;
const fresh = () => {
    const p = H.makePlayer('trail' + n++, 3222, 3222, 100 + n);
    H.maxOut(p);
    H.tick(1);
    return p;
};

const unsolved: string[] = [];
const guardedSeen: string[] = [];
const counts = { loc: 0, dig: 0, npc: 0, keyed: 0 };
for (const clue of NEW_CLUES) {
    const p = fresh();
    H.give(p, clue, 1);
    H.give(p, 'spade', 1);
    let solved = false;
    if (NPC_CLUES[clue]) {
        counts.npc++;
        const want = NPC_CLUES[clue];
        const npc = World.npcs.find(x => x && NpcType.get(x.type).debugname === want.npc);
        if (npc) {
            // an earlier sim player that was despawned beside this npc can leave it facing them, which
            // no real logout does; let it go before talking to it
            npc.clearInteraction();
            H.standBeside(p, npc);
            H.tick(2);
            H.opNpc(p, npc, 1);
            talkThrough(p);
            solved = want.puzzle ? H.invCount(p, `${clue}_puzzlebox`) > 0 : !holds(p, clue);
        }
    } else if (KEYED[clue]) {
        counts.keyed++;
        const k = KEYED[clue];
        H.give(p, k.key, 1);
        const drawer = locsAt(k.coord[0], k.coord[1], k.coord[2]).find(t => t.debugname?.includes('drawer'));
        if (drawer) clickLoc(p, k.coord[0], k.coord[1], k.coord[2], drawer.debugname!, 1, k.key, () => !holds(p, clue));
        solved = !holds(p, clue);
    } else if (BOOKCASE[clue]) {
        counts.keyed++;
        const [lv, x, z] = BOOKCASE[clue];
        const bc = locsAt(lv, x, z)[0];
        if (bc) clickLoc(p, lv, x, z, bc.debugname!, 1, undefined, () => !holds(p, clue));
        solved = !holds(p, clue);
    } else if (param(clue, 'trail_loc') === 1) {
        counts.loc++;
        const [lv, x, z] = unpack(param(clue, 'trail_coord') as number);
        // closed drawers are opened first and then searched, as a player does: twice round is enough
        for (let pass = 0; pass < 2 && holds(p, clue); pass++) {
            for (const t of locsAt(lv, x, z)) {
                const op = (t.op ?? []).findIndex(o => o && /search|open/i.test(o));
                if (op === -1) continue;
                // a closed drawer's Open is done once it has turned into the open one
                clickLoc(p, lv, x, z, t.debugname!, op + 1, undefined, () => !holds(p, clue) || !locsAt(lv, x, z).includes(t));
                if (!holds(p, clue)) break;
            }
        }
        solved = !holds(p, clue);
    } else {
        counts.dig++;
        const [lv, x, z] = unpack(param(clue, 'trail_coord') as number);
        p.teleport(x, z, lv);
        H.tick(2);
        H.opheld(p, 'spade', 1);
        talkThrough(p, 8);
        const guard = param(clue, 'trail_guardian');
        if (guard !== undefined && guard !== -1 && holds(p, clue)) {
            // a guarded clue: the wizard comes first, and the clue is still yours
            const w = World.npcs.find(x => x && (NpcType.get(x.type).debugname === 'trail_hard' || NpcType.get(x.type).debugname === 'trail_hard2') && Math.abs(x.x - p.x) < 6 && Math.abs(x.z - p.z) < 6);
            if (w) {
                guardedSeen.push(NpcType.get(w.type).debugname!);
                solved = true;
            }
        } else {
            solved = !holds(p, clue);
        }
    }
    if (!solved) unsolved.push(clue);
    H.despawn(p);
}

console.log(`    ${NEW_CLUES.length} clues: ${JSON.stringify(counts)}`);
check('every new clue is solved the way a player solves it', unsolved, []);
check('a guarded hard clue brings the Saradomin wizard (trail_hard2) as well as the Zamorak one', guardedSeen.includes('trail_hard2'), true);
check('no script errors', errors, []);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
