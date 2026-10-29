// ELEMENTAL WORKSHOP I, played through on foot.
//
// Quest 57 of the quest-by-quest pass. A battered book in a Seers' Village house, a key sewn into
// its spine, and a workshop the magi of the fifth age bricked up because the ore in it made weapons
// they could not live with. Nobody in this quest speaks: every step is a loc, which makes it the
// first one in the pass with no dialogue at all and the easiest one to leave half-wired.
//
// The cache names the progress bits itself - elemental_workshop_book, _key, _gate1, _gate2,
// _switch, _bellows, _fire, _bellows_switch, _stairs, _leather, _finished - so for once the varbit
// names ARE the quest, and every one of them is asserted below.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_elemental_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const BOOKCASE: [number, number] = [2716, 3481];
const ODDWALL: [number, number] = [2709, 3495];
const STAIRS_TOP: [number, number] = [2710, 3497];
const VALVE_EAST: [number, number] = [2726, 9908];
const VALVE_WEST: [number, number] = [2713, 9908];
const WATER_LEVER: [number, number] = [2722, 9906];
const BOX_NEEDLE: [number, number] = [2700, 9887];
const BOX_LEATHER: [number, number] = [2724, 9894];
const BOX_BOWL: [number, number] = [2717, 9894];
const BELLOWS: [number, number] = [2734, 9882];
const AIR_LEVER: [number, number] = [2734, 9887];
const ROCK: [number, number] = [2693, 9906];
const TROUGH: [number, number] = [2706, 9876];
const FURNACE: [number, number] = [2724, 9874];
const WORKBENCH: [number, number] = [2717, 9887];

const m: Manifest = {
    quest: 'ELEMENTAL WORKSHOP I',
    source: 'oldschool.runescape.wiki/w/Elemental_Workshop_I',
    stageVar: 'elemental_workshop_finished',
    done: 1,
    start: [2713, 3484, 0],
    steps: [
        { note: 'requirements are three skill levels and no quests: Mining 20, Smithing 20 and' },
        { note: 'Crafting 20, none of them needed to START. The needle and the leather are both in' },
        { note: 'the workshop boxes, so the shopping list is shorter than it looks.' },
        { give: 'knife' },
        { give: 'bronze_pickaxe' },
        { give: 'thread' },
        { give: 'hammer' },
        { give: 'coal', n: 4 },

        { note: 'wiki step 1: the bookcase on the east wall of the house south-west of the bank.' },
        { note: 'The house is a sealed 34-tile pocket with one shut door, so the door comes first -' },
        { note: 'questrun walks on canTravel and canTravel does not open doors.' },
        { go: [2713, 3483], exact: true, why: 'the tile the house door stands on' },
        { loc: 'loc_1530', at: [2713, 3483], why: 'open it; the only way into the house' },
        { go: [2715, 3481], exact: true, why: 'in, and beside the bookcase' },
        { loc: 'elemental_workshop_bookcase', at: BOOKCASE, want: 'The elemental shield', why: 'search it' },
        { has: 'elemental_workshop_shield_book' },

        { note: 'and straight back out, because the door shuts itself after a few hundred ticks and' },
        { note: 'there is no second way out of the room. Reading the book and cutting it open are' },
        { note: 'both inventory ops, so they happen on the street.' },
        { go: [2713, 3484], exact: true, why: 'out while the door is still open' },
        { held: 'elemental_workshop_shield_book', want: 'introduction', why: 'reading it is what starts the quest' },
        { varis: 'elemental_workshop_book', to: 1 },

        { note: 'wiki step 2: the key is sewn into the spine, and a knife or any slash weapon opens' },
        { note: 'it. The 377 cache has no slashed-book obj, so the book survives the cut - which it' },
        { note: 'has to, because the workbench at the end still wants the instructions.' },
        { use: ['knife', 'elemental_workshop_shield_book'], want: 'battered key', why: 'cut the spine' },
        { has: 'elemental_workshop_key' },
        { varis: 'elemental_workshop_key', to: 1 },

        { note: 'wiki step 3: the odd-looking wall in the Seers smithy. It is a wall-straight pair,' },
        { note: 'so it takes a click from exactly the two tiles it separates and from nowhere else.' },
        { go: [2709, 3495], exact: true, why: 'the smithy side of the wall' },
        { loc: 'elemental_workshop_oddwall_l', at: ODDWALL, want: 'no way to open it', why: 'pushing it is refused, and says why' },
        { useLoc: 'elemental_workshop_oddwall_l', at: ODDWALL, obj: 'elemental_workshop_key', why: 'the key off the book' },
        { go: [2710, 3496], why: 'through the wall' },
        { loc: 'elemental_workshop_spiralstairstop', at: STAIRS_TOP, why: 'down the spiral stairs' },
        { varis: 'elemental_workshop_stairs', to: 1 },

        { note: 'wiki step 4: the water wheel in the northern chamber. The wiki says to turn the' },
        { note: 'east valve first and that the order matters; it does not here, and that is' },
        { note: 'deliberate - neither valve is a multiloc and neither has any visible state, so an' },
        { note: 'order rule would be invisible. Both gates open, then the lever.' },
        { go: [2726, 9907], why: 'to the eastern valve' },
        { loc: 'elemental_workshop_valve_1', at: VALVE_EAST, want: 'water runs through it', why: 'turn it' },
        { varis: 'elemental_workshop_gate2', to: 1 },
        { go: [2713, 9907], why: 'and across to the western one' },
        { loc: 'elemental_workshop_valve_2', at: VALVE_WEST, want: 'Both gates are open', why: 'turn it; it calls out that the pair is done' },
        { varis: 'elemental_workshop_gate1', to: 1 },
        { loc: 'elemental_workshop_water_lever', at: WATER_LEVER, want: 'water wheel starting up', why: 'start the wheel' },
        { varis: 'elemental_workshop_switch', to: 1 },

        { note: 'wiki step 5: the needle in a crate in the western room and the leather in one of' },
        { note: 'the northern boxes. Both boxes flag themselves as emptied, so taking either one on' },
        { note: 'a full inventory used to lose it for good.' },
        { go: [2700, 9888], why: 'the western room' },
        { loc: 'elemental_workshop_box_2', at: BOX_NEEDLE, want: 'find a needle', why: 'search it' },
        { has: 'needle' },
        { go: [2724, 9893], why: 'the boxes north of the stairs' },
        { loc: 'elemental_workshop_box_4', at: BOX_LEATHER, want: 'find some leather', why: 'search it' },
        { has: 'leather' },
        { varis: 'elemental_workshop_leather', to: 1 },

        { note: 'wiki step 8, taken here because it is the same row of boxes: the stone bowl' },
        { loc: 'elemental_workshop_box_1', at: BOX_BOWL, want: 'find a stone bowl', why: 'search it' },
        { has: 'elemental_workshop_lava_bowl' },

        { note: 'wiki step 6: the bellows in the eastern chamber, then the lever beside them. The' },
        { note: 'lever needs the wheel turning AND the bellows stitched, and pulling the water lever' },
        { note: 'a second time stops the wheel and clears the air with it.' },
        { go: [2735, 9881], why: 'to the bellows' },
        { loc: 'elemental_workshop_bellows_l', at: BELLOWS, want: 'stitch the leather', why: '20 Crafting, needle, leather and thread' },
        { varis: 'elemental_workshop_bellows', to: 1 },
        { go: [2734, 9886], why: 'to the lever beside them' },
        { loc: 'elemental_workshop_air_lever', at: AIR_LEVER, want: 'pump air down the pipe', why: 'set them pumping' },
        { varis: 'elemental_workshop_bellows_switch', to: 1 },

        { note: 'wiki step 7: an elemental rock in the western cavern wakes up and attacks, and only' },
        { note: 'that one drops ore - the four elementals that wander the workshop do not.' },
        { go: [2694, 9906], why: 'to the rocks' },
        { note: 'the elemental it wakes lives for 500 ticks, so this click is `brief`: drive() would' },
        { note: 'spend its whole 600-tick guard on a fight neither an immune sim player nor the' },
        { note: 'elemental can finish, and the step would come back to find nothing there.' },
        { loc: 'elemental_workshop_rock', at: ROCK, brief: 8, why: 'mine it; it stops being a rock' },
        { nearnpc: 'earth_elemental_rock_version', r: 10, why: 'it spawns on top of you' },
        { fight: 'earth_elemental_rock_version', until: 'elemental_workshop_ore', r: 10, tries: 8, why: 'it drops the ore' },
        { take: 'elemental_workshop_ore', r: 10, why: 'off the floor' },

        { note: 'wiki step 9: lava from the trough in the southern chamber lights the furnace' },
        { go: [2706, 9877], why: 'to the lava trough' },
        { useLoc: 'elemental_workshop_trough', at: TROUGH, obj: 'elemental_workshop_lava_bowl', want: 'fill the bowl with hot lava', why: 'fill it' },
        { has: 'elemental_workshop_lava_bowl_full' },
        { go: [2724, 9875], why: 'east to the furnace' },
        { useLoc: 'elemental_workshop_furnace', at: FURNACE, obj: 'elemental_workshop_lava_bowl_full', want: 'bursts in to life', why: 'light it' },
        { varis: 'elemental_workshop_fire', to: 1 },

        { note: 'wiki step 10: the ore and four coal. The lava is only half of it - the ore also' },
        { note: 'needs the bellows feeding air up the pipe, which is five things in three rooms.' },
        { useLoc: 'elemental_workshop_furnace', at: FURNACE, obj: 'elemental_workshop_ore', want: 'bar of elemental metal', why: '20 Smithing and four coal' },
        { has: 'elemental_workshop_bar' },
        { hasnt: 'elemental_workshop_ore' },

        { note: 'wiki step 11: the workbench, with the book still in the pack' },
        { go: [2717, 9888], why: 'back to the workbench' },
        { useLoc: 'elemental_workshop_workbench', at: WORKBENCH, obj: 'elemental_workshop_bar', want: 'Elemental Shield', why: 'hammer it out' },
        { has: 'elemental_shield' },
        { wait: 6, why: 'the completion is queued' },
        { stage: 1 }
    ]
};

const p: any = H.makePlayer('ewrun', m.start[0], m.start[1]);
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
