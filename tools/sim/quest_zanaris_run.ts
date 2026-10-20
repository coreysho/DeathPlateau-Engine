// LOST CITY, played through on foot.
//
// Quest 29 of the quest-by-quest pass. A warrior camped in the Lumbridge swamp lets slip that a
// leprechaun in one of the trees knows where Zanaris is; the leprechaun wants you to fetch a
// dramen branch from the cave under Entrana, which is guarded by a tree spirit. The monks' ship
// allows no weapons and no armour, so the spirit is fought with an axe-and-knife inventory and
// bare hands - which is the authentic way round it, not a shortcut.
//
//   npx tsx tools/sim/quest_zanaris_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const TREE: [number, number] = [2860, 9734];
const SHED: [number, number] = [3202, 3169];

const m: Manifest = {
    quest: 'LOST CITY',
    source: 'oldschool.runescape.wiki/w/Lost_City',
    stageVar: 'zanaris',
    done: 6,   // ^zanaris_complete
    start: [3145, 3206, 0],
    steps: [
        { note: 'requirements: 31 Crafting to carve the staff, 36 Woodcutting to cut the branch.' },
        { note: 'An axe and a knife are all you can take to Entrana anyway - the monks turn away' },
        { note: 'weapons and armour at the gangplank.' },
        { give: 'bronze_axe' },
        { give: 'knife' },

        { note: 'wiki step 1: the warrior in the swamp camp, who gives it away by denying it' },
        { talk: 'warrioradventurerpg', picks: ['What are you camped here for', "What makes you think it's out here", "If it's hidden how are you planning to find it", "Looks like you don't know either"], want: 'leprechaun', why: 'he admits there is a leprechaun' },
        { stage: 1 },

        { note: 'wiki step 2: chop at the trees until the leprechaun comes out of one. The op needs' },
        { note: 'an axe in the inventory and spawns him on the tile west of the tree.' },
        { go: [3139, 3212], why: 'to the leprechaun’s tree' },
        { loc: 'leprechauntree', at: [3138, 3212], why: 'chop it' },
        { nearnpc: 'zanarisleprechaun', r: 12, why: 'Shamus comes out and runs for it' },
        { talk: 'zanarisleprechaun', picks: ['How does it fit in a shed then'], want: 'Dramen tree', why: 'he names the staff and the island' },
        { stage: 2 },

        { note: 'wiki step 3: the Dramen tree is in the cave under Entrana, and a tree spirit stands' },
        { note: 'in front of it. The first chop summons it; it has 85 hitpoints and 80 defence, and' },
        { note: 'on Entrana you have no weapon.' },
        { setpos: [2861, 9735, 0], why: 'the monks’ ship to Entrana and down into the cave' },
        { loc: 'dramentree', at: TREE, why: 'first chop wakes the spirit' },
        { note: 'it says "You must defeat me before touching the tree!" with npc_say, which is an' },
        { note: 'overhead line and not a mesbox, so there is nothing for `want` to match. It also' },
        { note: 'attacks immediately and the player retaliates, so the fight is usually over before' },
        { note: 'the chop step has settled - which is why the kill below reports no ticks of its own.' },
        { fight: 'tree_spirit', untilvar: 'zanaris', to: 3, tries: 3, why: 'bare hands' },
        { stage: 3 },

        { note: 'wiki step 4: now the tree can be cut' },
        { loc: 'dramentree', at: TREE, want: 'cut a branch', why: 'chop it' },
        { stage: 4 },
        { has: 'dramen_branch' },

        { note: 'wiki step 5: carve the branch with a knife' },
        { use: ['knife', 'dramen_branch'], want: 'carve the branch into a staff', why: 'make the staff' },
        { stage: 5 },
        { has: 'dramen_staff' },

        { note: 'wiki step 6: the shed in the middle of the swamp. The door only teleports you on' },
        { note: 'the way OUT, with the staff WORN - walking in while holding it does nothing.' },
        { held: 'dramen_staff', op: 2, why: 'wield it' },
        { worn: 'dramen_staff' },
        { note: 'the shed is solid inside - barrels, sacks and shelves on every tile - so nobody' },
        { note: 'ever walks into it. Clicking its door from the swamp IS the portal.' },
        { setpos: [3201, 3169, 0], why: 'back east to the swamp shed' },
        { loc: 'zanarisdoor', at: SHED, want: 'world starts to shimmer', why: 'the door, which is the portal' },
        { wait: 6, why: 'the teleport and the queued completion' },
        { stage: 6 },
        { nearnpc: 'fairy_nuff', r: 64, why: 'arrived in Zanaris - the Fairy Queen’s own nurse is 30 tiles away' }
    ]
};

const p: any = H.makePlayer('zanarisrun', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
p.applyDamage = function () {};
H.setVar(p, 'macro_event', 1);
H.maxOut(p);
H.tick(1);

const res = play(m, p);
const bad = res.filter(r => !r.ok);
console.log('');
if (bad.length) {
    console.log('WHAT WENT WRONG');
    for (const r of bad) console.log('  step ' + r.n + '  ' + r.what + (r.detail ? '  -- ' + r.detail : ''));
}
process.exit(bad.length ? 1 : 0);
