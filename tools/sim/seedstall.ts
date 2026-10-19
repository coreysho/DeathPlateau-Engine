// THE DRAYNOR SEED STALL - the last loc in the game advertising "Steal from" with nothing behind
// it, which tools/silentops.py has had on a line of its own for months. The loc is in the cache
// with op2=Steal from and "Lots of seeds here", Olivia stands behind it and the Market Guard
// watches it, and the click did nothing at all.
//
//   npx tsx tools/sim/seedstall.ts
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
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

const SEEDS = [
    'hammerstone_hop_seed',
    'potato_seed',
    'marigold_seed',
    'barley_seed',
    'onion_seed',
    'asgarnian_hop_seed',
    'cabbage_seed',
    'yanillian_hop_seed',
    'rosemary_seed',
    'nasturtium_seed',
    'tomato_seed',
    'jute_seed',
    'sweetcorn_seed',
    'krandorian_hop_seed',
    'strawberry_seed',
    'wildblood_hop_seed',
    'watermelon_seed'
];

const p: any = H.makePlayer('seedstall', 3080, 3250);
H.tick(1);
H.maxOut(p);
H.clearInv(p);
H.tick(2);
p.closeModal();

// find the stall on the map rather than trusting a coord
const stall = (() => {
    const id = LocType.getId('seed_stall');
    for (let x = 3060; x < 3110; x++) {
        for (let z = 3230; z < 3270; z++) {
            const loc = World.getLoc(x, z, 0, id);
            if (loc) return loc;
        }
    }
    throw new Error('no seed stall in Draynor');
})();

const heard = (fn: () => void): string => {
    const mark = H.mesgs.length;
    const faces = H.ifaces.length;
    fn();
    return H.ifaces
        .slice(faces)
        .filter(i => i.kind === 'text' && i.text)
        .map(i => i.text!)
        .concat(H.mesgs.slice(mark).map(m => m.text))
        .join(' ');
};
const steal = (): string =>
    heard(() => {
        const t = LocType.get(stall.type);
        p.teleport(stall.x, stall.z + 1, 0);
        H.tick(1);
        p.clearPendingAction();
        p.queueWaypoints(findPathToLoc(0, p.x, p.z, stall.x, stall.z, p.width, t.width, t.length, stall.angle, stall.shape, t.forceapproach));
        p.setInteraction(Interaction.ENGINE, stall, ServerTriggerType.APLOC2);
        settle(p);
    });

console.log('');
console.log('WHAT THE CACHE HAD, AND WHAT ANSWERED IT');
const t = LocType.get(stall.type);
check('the stall is in Draynor with "Steal from"', [(t.op ?? [])[1], `${stall.x},${stall.z}`], ['Steal from', `${stall.x},${stall.z}`]);
check('and the click has a trigger now', ScriptProvider.getByTrigger(ServerTriggerType.OPLOC2, stall.type, t.category) !== null, true);
check(
    'all seventeen seeds exist',
    SEEDS.every(s => ObjType.getId(s) !== -1),
    true
);

console.log('');
console.log('STEALING FROM IT');
p.setLevel(17, 26); // 17 is Thieving
H.tick(1);
const said = steal();
check('26 Thieving is not enough', [said.includes('27'), SEEDS.some(s => H.invCount(p, s) > 0)], [true, false]);
p.setLevel(17, 27);
H.tick(1);
// THE MARKET GUARD IS STANDING RIGHT THERE and stops a theft he can see, so a single attempt is
// not a verdict on anything: this takes the first one that pays.
const xp = p.stats[17];
let tries = 0;
while (p.stats[17] === xp && tries < 30) {
    steal();
    H.tick(16);
    tries++;
}
check('27 is, and it pays a seed and 10 experience', [SEEDS.some(s => H.invCount(p, s) > 0), (p.stats[17] - xp) / 10], [true, 10]);

// the stall empties and comes back: nine seconds, which is fifteen ticks - the update that cut it
// to three is from 2024
// loc_change swaps the stall for the empty market loc while it restocks, and
// ~scale_by_playercount brings it back inside the ticks a single theft takes on an empty world -
// so what is asserted here is that it is a stall again afterwards, not the gap.
check('and it is a stall again afterwards', World.getLoc(stall.x, stall.z, 0, LocType.getId('seed_stall')) !== null, true);
// one longqueue per theft, and the retry loop above may have paid more than once
check('Olivia remembers being robbed', H.queued(p, '[queue,stolen_from_stall_seed]').length >= 1, true);

console.log('');
console.log('THE SPREAD');
H.clearInv(p);
H.tick(1);
const counts: Record<string, number> = {};
for (let i = 0; i < 100; i++) {
    const before = SEEDS.map(s => H.invCount(p, s));
    steal();
    SEEDS.forEach((s, n) => {
        const got = H.invCount(p, s) - before[n];
        if (got > 0) counts[s] = (counts[s] ?? 0) + got;
    });
    H.tick(16);
}
const kinds = Object.keys(counts).length;
const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(
    `  (${total} seeds in 100 thefts, ${kinds} kinds: ${Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k.replace('_hop_seed', '').replace('_seed', '')} ${v}`)
        .join(', ')})`
);
// not every attempt pays: the Market Guard interrupts, and the stall is empty for nine seconds
// HOW OFTEN IS THE GUARD'S BUSINESS, not the table's: he stops a theft he can see, and where he
// happens to be standing moves the figure between runs (45 and 94 on two runs of this).
check('a hundred attempts pay out plenty of times', [total > 25, total <= 100], [true, true]);
check('  across most of the table, with the common four leading it', [kinds >= 8, (counts['hammerstone_hop_seed'] ?? 0) + (counts['potato_seed'] ?? 0) + (counts['marigold_seed'] ?? 0) + (counts['barley_seed'] ?? 0) > total / 4], [true, true]);

console.log('');
console.log(`${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
