// Rohak vanishes when you hand him the ale (reported: "he disappears, had to relog for him to
// respawn"). He is two spawned npcs sharing one varbit - hundred_dwarf_dad_multi, states 0 and 1,
// and hundred_dwarf_drunk_multi, state 2 - so handing over the ale is meant to be a swap on the
// spot. This measures how far apart the two of them actually drift.
import * as HH from './harness.ts';
import { World, NpcType, player, check, R } from './a1lib.ts';
await HH.boot();

const id = (n: string) => NpcType.getId(n);
const find = (n: string) => World.npcs.find(x => x && x.type === id(n)) ?? null;

const spawn = { dad: [2865, 9876], drunk: [2865, 9877] };
const p = player('rohak', 2866, 9876);

const dad = find('hundred_dwarf_dad_multi')!;
const drunk = find('hundred_dwarf_drunk_multi')!;
const gap = () => Math.max(Math.abs(dad.x - drunk.x), Math.abs(dad.z - drunk.z));
const off = (n: typeof dad, s: number[]) => Math.max(Math.abs(n.x - s[0]), Math.abs(n.z - s[1]));

console.log(`# at boot: sober ${dad.x},${dad.z} (${off(dad, spawn.dad)} off spawn), ` +
            `drunk ${drunk.x},${drunk.z} (${off(drunk, spawn.drunk)} off spawn), gap ${gap()}`);

let worst = gap(), worstDad = off(dad, spawn.dad), worstDrunk = off(drunk, spawn.drunk);
for (let i = 0; i < 300; i++) {
    HH.tick(1);
    worst = Math.max(worst, gap());
    worstDad = Math.max(worstDad, off(dad, spawn.dad));
    worstDrunk = Math.max(worstDrunk, off(drunk, spawn.drunk));
}
console.log(`# over 300 ticks: sober wandered ${worstDad} tiles, drunk ${worstDrunk}, ` +
            `worst gap between the two shells ${worst}`);

// And the swap itself: what the client resolves the two shells to at each state. A state that
// nobody draws is the same disappearance by another route.
const draws = (name: string, state: number) => {
    const kids = NpcType.get(id(name)).multinpc ?? [];
    const kid = kids[state];
    return kid === undefined || kid === -1 ? null : NpcType.get(kid).debugname;
};
for (const s of [0, 1, 2]) {
    console.log(`#   state ${s}: sober -> ${draws('hundred_dwarf_dad_multi', s)}, ` +
        `drunk -> ${draws('hundred_dwarf_drunk_multi', s)}`);
}
check('  somebody is drawn at every state',
    [0, 1, 2].map(s => draws('hundred_dwarf_dad_multi', s) ?? draws('hundred_dwarf_drunk_multi', s)),
    ['hundred_dwarf_dad', 'hundred_dwarf_dad_rohak', 'hundred_dwarf_dad_drunk']);
check('  both shells are still alive', [dad.isActive, drunk.isActive], [true, true]);
check('  the sober shell stays on its tile', worstDad, 0);
check('  the drunk shell stays on its tile', worstDrunk, 0);
check('  the swap happens where you are standing (<=1 tile)', worst <= 1, true);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
