// AUREL'S CRATE. The general store in Burgh de Rott has three repairs and the quest only had two:
// the roof and the wall were there, and the third was one line of mes that said the player had
// lifted three crates onto three sets of shelves. The walkthrough's step is "Talk to Aurel to
// receive a crate. Add the items Aurel requests to the crate: 10 bronze axes, 10 raw mackerel or
// 10 snails (whichever is asked), and 3 tinderboxes" - and the cache has the counters for it, sized
// to the job and referenced by nothing:
//
//   burgh_axes_crate       myreque2_multivar bits 9-12    four bits: a count, up to ten
//   burgh_food_crate       myreque2_multivar bits 13-16   four bits: a count, up to ten
//   burgh_tinderbox_crate  myreque2_multivar bits 17-18   two bits: a count, up to three
//   burgh_crate_overseer   myreque2_multivar bits 9-18    the three of them read as one number
//   burgh_food_type        myreque_2_main_var bits 13-14  which of the two foods he asked for
//
// This drives the whole step through the real triggers: the dialogue, the re-roll, the crate, the
// items going in, Search reading it back, and the six locs on burgh_store_stocked at the end.
//
//   npx tsx tools/sim/myrequecrate.ts
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import ObjType from '#/cache/config/ObjType.js';
import NpcType from '#/cache/config/NpcType.js';
import VarBitType from '#/cache/config/VarBitType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToEntity } from '#/engine/GameMap.js';

await H.boot();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const v = (p: Player, n: string) => (VarBitType.getByName(n) ? H.getVarBit(p, n) : H.getVar(p, n));
const set = (p: Player, n: string, val: number) => (VarBitType.getByName(n) ? H.setVarBit(p, n, val) : H.setVar(p, n, val));

function settle(p: Player, picks: number[] = [], max = 250) {
    let idle = 0;
    for (let g = 0; g < max; g++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            idle = 0;
            const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
            const open = p.modalChat === -1 ? '' : Component.get(p.modalChat).comName ?? '';
            const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
            if (multi) {
                const pick = picks.shift();
                if (pick === undefined) throw new Error('unexpected menu: ' + names.join(','));
                H.choose(p, `${multi.split(':')[0]}:com_${pick}`);
                continue;
            }
            p.executeScript(s, true, true);
            continue;
        }
        H.tick(1);
        if (!p.activeScript && !p.target && !p.delayed && p.queue.head() === null) {
            if (++idle >= 3) break;
        } else idle = 0;
    }
    if (picks.length) throw new Error('menus not reached: ' + picks.join(','));
    p.closeModal();
}

const p: any = H.makePlayer('myreqcrate', 3485, 3246);
H.tick(1);
H.maxOut(p);
H.clearInv(p);
H.tick(2);
p.closeModal();

const nearest = (npcName: string): Npc => {
    const id = NpcType.getId(npcName);
    if (id === -1) throw new Error('no npc type ' + npcName);
    let best: Npc | null = null;
    let bestD = Infinity;
    for (const n of World.npcs) {
        if (!n || !n.isActive || n.type !== id) continue;
        const d = Math.max(Math.abs(n.x - p.x), Math.abs(n.z - p.z));
        if (d < bestD) {
            bestD = d;
            best = n;
        }
    }
    if (!best) throw new Error(npcName + ' is not spawned');
    return best;
};

// EVERYTHING THE PLAYER SAYS AND IS TOLD, in one string, so a check can ask whether he named the
// food he rolled - which is the only way to see the roll from outside.
const heard = (fn: () => void): string => {
    const mark = H.mesgs.length;
    const faces = H.ifaces.length;
    fn();
    return H.ifaces.slice(faces).filter(i => i.kind === 'text' && i.text).map(i => i.text!)
        .concat(H.mesgs.slice(mark).map(m => m.text)).join(' ');
};

const talkToAurel = (picks: number[] = []): string => {
    const aurel = nearest('burgh_general_store_owner');
    return heard(() => {
        p.teleport(aurel.x + 1, aurel.z, aurel.level);
        H.tick(1);
        p.clearPendingAction();
        p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, aurel.x, aurel.z, p.width, aurel.width, aurel.length));
        p.setInteraction(Interaction.ENGINE, aurel, ServerTriggerType.APNPC1);
        settle(p, picks);
    });
};
const useOnCrate = (objName: string): string =>
    heard(() => {
        H.useHeldOn(p, objName, 'burgh_generalstore_crate');
        settle(p);
    });
const searchCrate = (): string =>
    heard(() => {
        H.opheld(p, 'burgh_generalstore_crate', 1);
        settle(p);
    });

const counts = () => [v(p, 'burgh_axes_crate'), v(p, 'burgh_food_crate'), v(p, 'burgh_tinderbox_crate')];
const FOOD = ['', 'raw_mackerel', 'snail_corpse1'];

// ------------------------------------------------------------------ what the cache had
console.log('');
console.log('WHAT THE CACHE HAD ALL ALONG');
check('the crate is an obj', ObjType.getId('burgh_generalstore_crate') !== -1, true);
check('and its only inventory option is Search',
    [ObjType.get(ObjType.getId('burgh_generalstore_crate')).iop[0], ObjType.get(ObjType.getId('burgh_generalstore_crate')).iop[4]],
    ['Search', 'Destroy']);
for (const [name, bits] of [['burgh_axes_crate', 4], ['burgh_food_crate', 4], ['burgh_tinderbox_crate', 2], ['burgh_food_type', 2]] as [string, number][]) {
    const b = VarBitType.getByName(name)!;
    check(`${name} is ${bits} bits`, b.endbit - b.startbit + 1, bits);
}
// four bits is a count up to ten with room over, two bits is a count up to three exactly
set(p, 'burgh_axes_crate', 10);
set(p, 'burgh_food_crate', 10);
set(p, 'burgh_tinderbox_crate', 3);
check('and the counters hold what he asks for', counts(), [10, 10, 3]);
check('  with the three of them readable as one number, which is what burgh_crate_overseer is',
    v(p, 'burgh_crate_overseer'), 10 + (10 << 4) + (3 << 8));
set(p, 'burgh_axes_crate', 0);
set(p, 'burgh_food_crate', 0);
set(p, 'burgh_tinderbox_crate', 0);

// ------------------------------------------------------------------ asking for it
console.log('');
console.log('AUREL ASKS, AND WALKING AWAY RE-ROLLS');
set(p, 'myreque_2_quest', 20);          // ^m2_arrived
set(p, 'burgh_store_roof', 0);
set(p, 'burgh_store_wall', 0);
set(p, 'burgh_store_stocked', 0);
set(p, 'burgh_food_type', 0);
let said = talkToAurel();
check('with the roof still open he talks about the roof, not the stock',
    [said.includes('roof is up the ladder'), v(p, 'burgh_food_type')], [true, 0]);
set(p, 'burgh_store_roof', 1);
said = talkToAurel();
check('with the wall still out, the wall', said.includes('open to the street'), true);

set(p, 'burgh_store_wall', 1);
// twenty refusals: every one names a food, every one is one of the two, and both come up
const rolled = new Set<number>();
let namedRight = 0;
for (let i = 0; i < 20; i++) {
    const text = talkToAurel([2]);               // "That is a lot. I will come back."
    const t = v(p, 'burgh_food_type');
    rolled.add(t);
    const name = t === 2 ? 'snails' : 'raw mackerel';
    if (text.includes('Ten bronze axes') && text.includes('Three tinderboxes') && text.includes(name)) namedRight++;
    if (H.invCount(p, 'burgh_generalstore_crate') !== 0) throw new Error('he handed the crate over to a refusal');
}
check('he asks for ten axes, three tinderboxes and ten of a food, every time', namedRight, 20);
check('  and the food is rolled fresh each time: both come up, and nothing else does',
    [...rolled].sort(), [1, 2]);
check('  a refusal leaves you without a crate, which is the re-roll',
    H.invCount(p, 'burgh_generalstore_crate'), 0);

H.fillInv(p);
said = talkToAurel([1]);
check('with no room he says to come back with a hand free',
    [said.includes('hand free'), H.invCount(p, 'burgh_generalstore_crate')], [true, 0]);
H.clearInv(p);
H.tick(1);
said = talkToAurel([1]);                          // "I will fetch all that."
check('accept, and the crate is yours', H.invCount(p, 'burgh_generalstore_crate'), 1);
const want = v(p, 'burgh_food_type');
const food = FOOD[want];
console.log(`  (he asked for ${want === 2 ? 'snails' : 'raw mackerel'} this run)`);

// ------------------------------------------------------------------ filling it
console.log('');
console.log('WHAT GOES IN IT');
H.give(p, 'coins', 50);
said = useOnCrate('coins');
check('the crate does not take what he did not ask for', [counts(), said.includes('Nothing interesting')], [[0, 0, 0], true]);

const other = want === 2 ? 'raw_mackerel' : 'snail_corpse1';
H.give(p, other, 1);
said = useOnCrate(other);
check('nor the other food', [counts(), said.includes('not that')], [[0, 0, 0], true]);

H.give(p, 'bronze_axe', 4);
said = useOnCrate('bronze_axe');
check('four axes go in as four, and it says what is still missing',
    [counts(), H.invCount(p, 'bronze_axe'), said.includes('4 of ten axes')], [[4, 0, 0], 0, true]);
H.give(p, 'bronze_axe', 12);
said = useOnCrate('bronze_axe');
check('twelve more top it up at ten and leave the rest in your hands',
    [counts(), H.invCount(p, 'bronze_axe')], [[10, 0, 0], 6]);
said = useOnCrate('bronze_axe');
check('and it will not take an eleventh', [counts(), said.includes('all the axes')], [[10, 0, 0], true]);

H.give(p, 'tinderbox', 3);
useOnCrate('tinderbox');
check('three tinderboxes', [counts(), H.invCount(p, 'tinderbox')], [[10, 0, 3], 0]);

H.give(p, food, 4);
useOnCrate(food);
check('four of the food', counts(), [10, 4, 3]);
said = searchCrate();
check('Search reads the crate back', said.includes('10 of ten axes') && said.includes('4 of ten'), true);
said = talkToAurel();
check('and he will not take it half full', [said.includes('bring me the crate'), v(p, 'burgh_store_stocked')], [true, 0]);

// the snails are the three from Nature Spirit and any of them counts
if (want === 2) {
    H.give(p, 'snail_corpse2', 3);
    H.give(p, 'snail_corpse3', 3);
    useOnCrate('snail_corpse2');
    useOnCrate('snail_corpse3');
    check('thin, fat and lean snails all count as snails', v(p, 'burgh_food_crate'), 10);
} else {
    H.give(p, food, 6);
    useOnCrate(food);
}
check('ten of the food fills the last of it', counts(), [10, 10, 3]);
said = searchCrate();
check('  and Search says so', said.includes('A full crate'), true);

// ------------------------------------------------------------------ the shelves
console.log('');
console.log('AND THE SHELVES');
const xp = p.stats[2];
said = talkToAurel();
check('he takes the crate, and the shop has stock',
    [v(p, 'burgh_store_stocked'), H.invCount(p, 'burgh_generalstore_crate'), counts()], [1, 0, [0, 0, 0]]);
check('  which is 500 Strength xp, as the wiki has it', (p.stats[2] - xp) / 10, 500);
said = talkToAurel();
check('afterwards he names the three things his shop sells', said.includes('It is not much of a range'), true);

// ------------------------------------------------------------------ the locs that read the bit
console.log('');
console.log('THE SIX LOCS THAT WERE WAITING ON THAT BIT');
check('burgh_store_stocked is a one-bit varbit', (() => {
    const b = VarBitType.getByName('burgh_store_stocked')!;
    return b.endbit - b.startbit + 1;
})(), 1);
check('and the town is only done when all three repairs are',
    H.runProc(p, '[proc,m2_town_done]')[0], 0);     // the bank and the furnace are still broken

console.log('');
console.log(`${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
