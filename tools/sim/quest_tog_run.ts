// TEARS OF GUTHIX, played through on foot - hand-rolled, because the quest is a timed minigame.
//
// Quest 42 of the quest-by-quest pass. Juna wants a story, and the price of admission is
// forty-three quest points - so the run begins by declaring every quest this pass has walked, which
// is what a player standing in front of her would actually have behind them. Then the light
// creatures over the chasm, the blue stone, a chisel, and as long at the weeping walls as the story
// was worth.
//
//   npx tsx tools/sim/quest_tog_run.ts
import * as H from './harness.js';
import { drive } from './a1lib.js';
import { travel } from './questrun.js';

await H.boot();

// Every quest walked by this pass, with the value its own manifest calls complete. Juna counts
// ~count_questpoints off these vars, one at a time, so there is no shortcut to forty-three.
const DONE: [string, number][] = [
    ['ahoy_questvar', 15],
    ['ballquest', 7],
    ['barcrawl', 2],
    ['cogquest', 8],
    ['cookquest', 2],
    ['demonstart', 30],
    ['doricquest', 100],
    ['dragonquest', 10],
    ['druidquest', 4],
    ['drunkmonkquest', 80],
    ['dwarfrock_quest', 110],
    ['fairy_farmers_quest', 100],
    ['feud_var', 62],
    ['fishingcompo', 5],
    ['giantdwarf_quest', 60],
    ['goblinquest', 6],
    ['haunted', 3],
    ['hetty', 3],
    ['hunt', 4],
    ['imp', 2],
    ['mm_main', 20],
    ['phoenixgang', 10],
    ['priestperil', 60],
    ['prieststart', 5],
    ['princequest', 110],
    ['rag_quest', 2],
    ['rjquest', 100],
    ['roving_elves_quest', 10],
    ['runemysteries', 6],
    ['scorpcatcher', 6],
    ['seaslugquest', 12],
    ['sheep', 22],
    ['sheepherderquest', 3],
    ['soulbane_prog', 7],
    ['spy', 4],
    ['squire', 7],
    ['totemquest', 5],
    ['treequest', 9],
    ['twocats_quest', 80],
    ['vampire', 3],
    ['waterfall_quest', 10],
    ['zanaris', 6]
];

const ROCKS_TOP: [number, number] = [3240, 9498];   // beside the climb down to Juna's ledge
const CHASM_NORTH: [number, number] = [3226, 9527];
const TEARS: [number, number] = [3259, 9517];
const WALLS: [number, number][] = [
    [3257, 9514],
    [3258, 9514],
    [3259, 9514],
    [3261, 9516],
    [3261, 9517],
    [3261, 9518],
    [3257, 9520],
    [3258, 9520],
    [3259, 9520]
];

let pass = 0;
let fail = 0;
function check(what: string, ok: boolean, detail = '') {
    if (ok) pass++;
    else fail++;
    console.log('  ' + (what.length > 60 ? what.slice(0, 59) + '~' : what.padEnd(60)) + (ok ? ' ok' : ' FAIL') + (detail ? '  ' + detail : ''));
}

const p: any = H.makePlayer('togrun', 3225, 9542);
H.tick(3);
p.applyDamage = function () {};
H.setVar(p, 'macro_event', 1);
H.maxOut(p);
for (const [v, n] of DONE) {
    try {
        H.setVar(p, v, n);
    } catch {
        try {
            H.setVarBit(p, v, n);
        } catch {
            console.log('  (could not set ' + v + ')');
        }
    }
}
H.give(p, 'bronze_pickaxe');
H.give(p, 'chisel');
H.give(p, 'lit_candle');
H.tick(2);

console.log('');
console.log('TEARS OF GUTHIX');
console.log('  a timed minigame, so this one is hand-rolled rather than a manifest');
console.log('');

const qp = H.runProc(p, '[proc,count_questpoints]')[0];
check('the walked quests add up to Juna’s forty-three', qp >= 43, qp + ' quest points');

// 1. down into the cave from the Lumbridge swamp caves
H.opLoc(p, 3225, 9539, 'tog_cave_down', 1);
H.tick(4);
drive(p, []);
check('down into the cave of Guthix’s tears', p.level === 2, p.x + ',' + p.z + ' L' + p.level);

// 2. Juna first. The creatures will not carry anybody who has not met her, and the way down to
// her ledge is the climbing rocks at the east end of the entrance chamber - she is scenery with
// no ops of her own, so climbing down IS the conversation.
travel(p, 3239, 9524, 2, 48, 1);
const markMeet = H.ifaces.length;
H.opLoc(p, 3240, 9524, 'tog_climbing_rocks_up', 1);
H.tick(8);
drive(p, []);
const met = H.ifaces
    .slice(markMeet)
    .filter(i => i.who === p.username && i.kind === 'text' && i.text)
    .map(i => i.text)
    .join(' ');
check('Juna speaks when you climb down to her ledge', met.includes('Guthix wept'), met.slice(0, 40));
check('and she agrees to hear a story', H.getVarBit(p, 'tog_hacky_fix') === 1, 'tog_hacky_fix ' + H.getVarBit(p, 'tog_hacky_fix'));

// 3. back up, and across the chasm on a light creature
H.opLoc(p, 3240, 9525, 'tog_climbing_rocks_up', 1);
H.tick(6);
drive(p, []);
check('back up to the cave floor', p.level === 2, p.x + ',' + p.z + ' L' + p.level);
travel(p, CHASM_NORTH[0], CHASM_NORTH[1], 2, 48, 2);
const creature = H.npcNear('tog_light_creature', CHASM_NORTH[0], CHASM_NORTH[1], 2);
check('a light creature hangs over the chasm', !!creature, creature ? creature.x + ',' + creature.z : '');
if (creature) {
    const { useOnNpc } = await import('./a1lib.js');
    useOnNpc(p, 'tog_light_creature', 'lit_candle');
    H.tick(8);
    drive(p, []);
    check('it carries you to the blue-stone side', p.z < 9515, p.x + ',' + p.z);
}

// 4. the blue stone, and a chisel to make it into a bowl. The veined rocks are part of the cave
// wall, so the tile to stand on is the one next to them.
travel(p, 3218, 9492, 2, 48, 1);
const ROCKS: [string, number, number][] = [
    ['tog_blue_stone_rocks1', 3217, 9492],
    ['tog_blue_stone_rocks2', 3217, 9491],
    ['tog_blue_stone_rocks1', 3217, 9490],
    ['tog_blue_stone_rocks2', 3216, 9492],
    ['tog_blue_stone_rocks1', 3216, 9491]
];
for (const [name, rx, rz] of ROCKS) {
    if (H.invCount(p, 'tog_stone') > 0) break;
    try {
        H.opLoc(p, rx, rz, name, 1);
    } catch {
        continue;
    }
    H.tick(8);
    drive(p, []);
}
check('a lump of blue stone out of the rocks', H.invCount(p, 'tog_stone') > 0, p.x + ',' + p.z);
if (H.invCount(p, 'tog_stone') > 0) {
    H.useHeldOn(p, 'chisel', 'tog_stone');
    H.tick(4);
    drive(p, []);
}
check('and a chisel makes a bowl of it', H.invCount(p, 'tog_bowl') > 0);

// 5. and down to her with the bowl, which is the story and the run
p.teleport(ROCKS_TOP[0], ROCKS_TOP[1], 2);
H.tick(1);
H.opLoc(p, 3239, 9498, 'tog_climbing_rocks_down', 1);
H.tick(8);
drive(p, []);
check('the story is told and the run starts', H.getVarBit(p, 'tog_minigame_collecting') === 1, 'collecting ' + H.getVarBit(p, 'tog_minigame_collecting'));

// 6. the walls. Each holds one colour for eight ticks, so the run keeps clicking until the timer
// takes the chamber away.
p.teleport(TEARS[0], TEARS[1], 2);
H.tick(1);
const markWalls = H.mesgs.length;
let clicks = 0;
for (let t = 0; t < 140 && H.getVarBit(p, 'tog_minigame_collecting') === 1; t++) {
    const [wx, wz] = WALLS[t % WALLS.length];
    if (Math.max(Math.abs(p.x - wx), Math.abs(p.z - wz)) > 1) {
        travel(p, wx + (wx > 3260 ? -1 : 0), wz, 2, 16, 1);
    }
    try {
        H.opLoc(p, wx, wz, 'tog_weepingwall', 1);
        clicks++;
    } catch {
        // that wall is not there; try the next
    }
    H.tick(2);
    drive(p, []);
}
const wallSaid = H.mesgs.slice(markWalls).filter(x => x.who === p.username).map(x => x.text);
const caught = wallSaid.filter(t => t.includes('run into the bowl')).length;
const spat = wallSaid.filter(t => t.includes('spits')).length;
const dry = wallSaid.filter(t => t.includes('not weeping')).length;
check('blue tears go into the bowl', caught > 0, caught + ' caught, ' + spat + ' lost to green, ' + dry + ' walls dry');
check('the run ends on its own timer', H.getVarBit(p, 'tog_minigame_collecting') === 0, clicks + ' wall clicks');
check('and it ended with the quest finished', H.getVarBit(p, 'tog_juna_stories') >= 1, 'stories ' + H.getVarBit(p, 'tog_juna_stories'));
const prog = H.runProc(p, '[proc,tog_progress]')[0];
check('the quest reads as complete', prog === 4, 'tog_progress ' + prog);

console.log('');
console.log('  ' + pass + ' of ' + (pass + fail) + ' checks passed');
process.exit(fail ? 1 : 0);
