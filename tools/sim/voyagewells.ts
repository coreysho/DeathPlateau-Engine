// THE THREE WELLS OF THE VOYAGE, and which way each one sends you.
//
//   npx tsx tools/sim/voyagewells.ts
//
// Regicide's way west runs through wells that look alike and are not alike, and the one that was
// dead is dead no longer - so this pins down what each of the three does, because the cheapest way
// to get this wrong is to notice that two of them share a model.
//
//   bloodwell_upass               the blood well, deep in the Underground Pass. Model cave_well,
//                                 description "It doesn't look like water in there...", and
//                                 quest_upass owns both its triggers for filling Iban's doll. It
//                                 also carries the Well of Voyage INSCRIPTION, which is why
//                                 Regicide hangs the voyage off it.
//   regicide_voyage_temple_well1  Iban's temple, level 1, beside the ibanmonk. Shares its model and
//                                 its "Well of voyage." description with well2. Was dead.
//   regicide_voyage_temple_well2  the voyage temple under Isafdar. Goes back east.
//
// WHY THAT MATTERS, and what this file is really guarding. The standing recipe for a dead loc that
// shares a distinctive model with a wired one is to copy that trigger. Here that recipe gives the
// WRONG ANSWER: well2's body teleports to the blood well's tile, so copying it onto well1 would
// take a player standing in Iban's temple and move them backwards along the pass. The two wells
// that share a model are the two ENDS of the voyage, not two copies of one end. So the assertion
// below is directional - each well is checked for where it puts you, not merely that it does
// something - and the gate is checked too, because a well that works before the quest starts is a
// shortcut into Tirannwn rather than a fix.
import * as H from './harness.js';
import { isFlagged } from '#/engine/GameMap.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';

await H.boot();

let ok = 0;
let bad = 0;
const check = (what: string, good: boolean, detail = ''): void => {
    if (good) {
        ok++;
        console.log('  ok   ' + what);
    } else {
        bad++;
        console.log('  FAIL ' + what + (detail ? ' - ' + detail : ''));
    }
};
const standable = (level: number, x: number, z: number): boolean => !isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED);

// 0_36_150_36_22, the voyage temple floor beside well2; and 0_37_151_4_54, the blood well's.
const TEMPLE: [number, number, number] = [2340, 9622, 0];
const BLOODWELL: [number, number, number] = [2372, 9718, 0];

const WELLS: { name: string; x: number; z: number; level: number; to: [number, number, number]; choose: boolean }[] = [
    { name: 'regicide_voyage_temple_well1', x: 2008, z: 4711, level: 1, to: TEMPLE, choose: true },
    { name: 'bloodwell_upass', x: 2373, z: 9718, level: 0, to: TEMPLE, choose: true },
    // well2 climbs straight down with no menu on it.
    { name: 'regicide_voyage_temple_well2', x: 2341, z: 9622, level: 0, to: BLOODWELL, choose: false }
];

const p = H.makePlayer('voyager', 3222, 3218) as unknown as { x: number; z: number; level: number };
H.tick(2);
H.maxOut(p as never);

// A well is 2x2, so stand off its corner rather than on it.
const beside = (x: number, z: number, level: number): [number, number] | null => {
    for (const [dx, dz] of [
        [-1, 0],
        [2, 0],
        [0, -1],
        [0, 2],
        [-1, -1],
        [2, 2],
        [-1, 2],
        [2, -1],
        [-2, 0],
        [3, 0]
    ]) {
        if (standable(level, x + dx, z + dz)) return [x + dx, z + dz];
    }
    return null;
};

for (const { name, x, z, level, to, choose } of WELLS) {
    console.log('');
    console.log(`-- ${name} at ${x},${z},${level}`);
    const spot = beside(x, z, level);
    if (!spot) {
        check(`${name} has a tile to stand on`, false, 'nothing standable within two tiles');
        continue;
    }

    // ---------------------------------------------------------------- the gate, where there is one
    if (choose) {
        H.setVar(p as never, 'upass', 0);
        H.setVar(p as never, 'regicide_quest', 0);
        (p as never as { teleport: (x: number, z: number, l: number) => void }).teleport(spot[0], spot[1], level);
        H.tick(1);
        H.clearLogs();
        H.opLoc(p as never, x, z, name, 1);
        for (let t = 0; t < 8; t++) H.tick(1);
        check('  before the quest it reads the inscription and does not move you', p.level === level && p.x === spot[0] && p.z === spot[1], `ended at ${p.x},${p.z},${p.level}`);
    }

    // ---------------------------------------------------------------- the voyage itself
    H.setVar(p as never, 'upass', 10); // ^upass_complete
    H.setVar(p as never, 'regicide_quest', 1); // ^regicide_started
    (p as never as { teleport: (x: number, z: number, l: number) => void }).teleport(spot[0], spot[1], level);
    H.tick(1);
    H.clearLogs();
    H.opLoc(p as never, x, z, name, 1);
    H.tick(1);
    if (choose) {
        // "Climb into the well." is option 1 of the two.
        const picked = H.choose(p as never, 'multi2:com_1');
        check('  offers the climb-or-search menu', picked, 'no p_choice2 was waiting');
    }
    for (let t = 0; t < 10; t++) H.tick(1);

    const [tx, tz, tl] = to;
    check(`  lands at ${tx},${tz},${tl}`, p.x === tx && p.z === tz && p.level === tl, `ended at ${p.x},${p.z},${p.level}`);
    check('  and that tile is standable', standable(p.level, p.x, p.z), `${p.x},${p.z},${p.level} is solid`);
}

console.log('');
console.log(`${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
