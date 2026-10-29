// DRAGON SLAYER, played through on foot.
//
// Quest 11 of the full quest-by-quest pass, and the big one: three map pieces in three different
// places, Melzar's Maze with six keyed doors and six things to kill for the keys, a ship to buy and
// patch, a crew to hire, and Elvarg.
//
// This is the 2006 quest, not the Old School rework. Oziach hands out the maze key and the three map
// piece locations; the Guild Master only points you at Oziach. The modern wiki has the Guild Master
// doing all of it, which is later content - see the note in oziach.rs2, which is sourced from RSC
// transcripts.
//
//   npx tsx tools/sim/quest_dragon_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const m: Manifest = {
    quest: 'DRAGON SLAYER',
    source: 'oldschool.runescape.wiki/w/Dragon_Slayer_I',
    stageVar: 'dragonquest',
    done: 10,   // ^dragon_complete
    start: [3191, 3365, 0],   // OUTSIDE the guild: 3191,3362 is already in it
    steps: [
        { note: 'wiki: 32 quest points to get in the door, and then a shopping list - silk, an' },
        { note: "unfired bowl, a lobster pot and a wizard's mind bomb for Thalzar's door, 10,000" },
        { note: "coins for Wormbrain, 2,000 for the ship, and a hammer, 3 planks and 90 steel nails" },
        { note: 'to patch it. The anti-dragon shield comes from the Duke.' },
        { setvar: 'qp', to: 32, why: 'the 32 quest points are thirty-two other quests, not this one' },
        { give: 'coins', n: 12000 },
        { give: 'silk' },
        { give: 'bowl_unfired' },
        { give: 'lobster_pot' },
        { give: 'wizards_mind_bomb' },
        { give: 'hammer' },
        { give: 'woodplank', n: 3 },
        { give: 'nails', n: 90 },
        { note: 'and a weapon, which the wiki lists as combat gear: Melzar has 44 hitpoints and' },
        { note: '34 Defence, and a bare-handed run never got through him in 900 ticks.' },
        { give: 'rune_scimitar' },
        { held: 'rune_scimitar', op: 2, why: 'wield it' },
        { worn: 'rune_scimitar' },

        { note: "wiki step 1: the Guild Master, in the Champions' Guild south of Varrock" },
        { loc: 'championdoor', at: [3191, 3363], why: "the guild door, which wants 32 quest points" },
        { wait: 4, why: 'the door greets you with a chat window of its own, and a click on a busy player is binned' },
        { go: [3191, 3360], why: 'in out of the doorway' },
        { talk: 'guildmaster', picks: ['Rune Plate mail body'], tries: 3, why: 'he points you at Oziach' },
        { stage: 1 },

        { note: 'wiki step 2: Oziach, in his hut west of Edgeville. In 2006 he is the one who sets' },
        { note: 'the task AND tells you where all three map pieces are, and hands over the maze key.' },
        { setpos: [3069, 3516, 0], why: 'the road north-west out of Varrock to Edgeville' },
        { talk: 'oziach', picks: ['sell me some Rune plate mail', 'guildmaster of the', 'how am I meant to prove', 'will I need anything', 'where can I find this dragon', 'first piece', 'second piece', 'third piece', "I'll try and get everything together"], why: 'the task, the three pieces and the maze key' },
        { stage: 2 },
        { has: 'melzarkey' },
        { varis: 'dragon_oracle', to: 1 },
        { varis: 'dragon_goblin', to: 1 },

        { note: "wiki step 3: the anti-dragon shield, free from Duke Horacio on Lumbridge Castle's" },
        { note: 'first floor. Oziach has to have told you about it first.' },
        { talk: 'oziach', picks: ['antidragon shield', "I'll try and get everything together"], why: 'ask him where to get one' },
        { varis: 'dragon_shield', to: 1 },
        { setpos: [3205, 3209, 0], why: 'south through Varrock and Lumbridge to the castle' },
        { loc: 'loc_1738', at: [3204, 3207], why: 'the castle staircase' },
        { go: [3207, 3221, 1], why: 'north up the first-floor corridor' },
        { loc: 'loc_1536', at: [3207, 3222], why: "the door into the Duke's room", soft: true },
        { talk: 'duke_of_lumbridge', picks: ['shield that will protect me'], why: 'he hands over the anti-dragon shield' },
        { has: 'antidragonbreathshield' },

        { note: "wiki step 4, piece 1: Melzar's Maze, north-west of Rimmington" },
        { setpos: [2942, 3248, 0], why: 'across Asgarnia to the maze' },
        { useLoc: 'melzardoor', at: [2941, 3248], obj: 'melzarkey', why: 'the maze key opens the front door' },
        { go: [2935, 3252], why: 'into the first room' },
        { fight: 'dragonslayer_giantrat', until: 'redkey', why: 'the rat with the long tail has the red key' },
        { take: 'redkey', r: 14, why: 'off the floor' },
        { has: 'redkey' },

        { note: 'wiki: the NORTH-WESTERN red door, then the ladder in that room' },
        { useLoc: 'reddoor', at: [2926, 3253], obj: 'redkey', why: 'the key disintegrates' },
        { loc: 'ladder', at: [2928, 3256], why: 'up to the first floor' },
        { fight: 'dragonslayer_ghost', until: 'orangekey', why: 'the hooded ghost has the orange key' },
        { take: 'orangekey', r: 14, why: 'off the floor' },

        { note: 'wiki: the second most northern orange door, then the ladder in the middle of that room' },
        { useLoc: 'orangedoor', at: [2931, 3253], obj: 'orangekey', why: 'through it' },
        { loc: 'ladder', at: [2934, 3254], why: 'up to the second floor' },
        { fight: 'dragonslayer_skeleton', until: 'yellowkey', why: 'the skeleton with the round shield has the yellow key' },
        { take: 'yellowkey', r: 14, why: 'off the floor' },

        { note: 'wiki: the south-western yellow door, then three ladders down to the basement' },
        { useLoc: 'yellowdoor', at: [2924, 3249], obj: 'yellowkey', why: 'through it' },
        { loc: 'laddertop', at: [2940, 3240], why: "the ladder at the corridor's end, down to the first floor" },
        { loc: 'laddertop', at: [2937, 3240], why: 'down to the ground floor' },
        { loc: 'funladdertop', at: [2932, 3240], why: 'and down into the basement' },

        { note: 'wiki: zombies drop the blue key' },
        { fight: 'dragonslayer_zombie', until: 'bluekey', why: 'the zombies have the blue key' },
        { take: 'bluekey', r: 14, why: 'off the floor' },
        { useLoc: 'bluedoor', at: [2931, 9643], obj: 'bluekey', why: 'through it' },

        { note: 'wiki: Melzar the Mad himself, and the magenta key' },
        { fight: 'melzar_the_mad', until: 'magentakey', why: 'he drops the magenta key' },
        { take: 'magentakey', r: 14, why: 'off the floor' },
        { useLoc: 'magentadoor', at: [2929, 9652], obj: 'magentakey', why: 'through it' },

        { note: 'wiki: a lesser demon guards the green key' },
        { fight: 'dragonslayer_demon', until: 'greenkey', why: 'the lesser demon has the green key' },
        { take: 'greenkey', r: 14, why: 'off the floor' },
        { useLoc: 'greendoor', at: [2936, 9655], obj: 'greenkey', why: 'through it' },
        { loc: 'funchestshut', at: [2935, 9657], why: 'open the chest' },
        { wait: 4, why: 'opening it is its own action' },
        { loc: 'funchestopen', at: [2935, 9657], want: 'map piece', why: 'and search it' },
        { has: 'mappart1' },

        { note: 'wiki step 4, piece 2: the Oracle on Ice Mountain, then the magic door in the mine' },
        { setpos: [3013, 3504, 0], why: 'north-west out of the maze and up Ice Mountain' },
        { talk: 'oracle', picks: ['piece of the map to the island of Crandor'], why: 'her riddle is the four items' },
        { varis: 'dragon_oracle', to: 2 },
        { setpos: [3050, 9840, 0], why: 'down the mountain and into the Dwarven Mine' },
        { loc: 'dragon_slayer_magic_door', at: [3051, 9840], want: 'strange glow', why: 'the four items open it' },
        { loc: 'oraclechestshut', at: [3057, 9841], why: 'open the chest' },
        { wait: 4, why: 'opening it is its own action' },
        { loc: 'oraclechestopen', at: [3057, 9841], want: 'map piece', why: 'and search it' },
        { has: 'mappart3' },

        { note: 'wiki step 4, piece 3: Wormbrain, in the Port Sarim jail. Paying him is 10,000 coins' },
        { note: 'and the alternative is killing him through the bars, which needs Telekinetic Grab.' },
        { setpos: [3013, 3189, 0], why: 'south across Asgarnia to the jail' },
        { talk: 'wormbrain', picks: ['piece of map that I need', 'pay you for the map piece', 'Alright then, 10,000'], why: 'buy it off him' },
        { has: 'mappart2' },

        { note: 'wiki step 4: the three pieces make the map' },
        { use: ['mappart1', 'mappart2'], want: 'join the three pieces', why: 'one use assembles all three' },
        { has: 'dragonmap' },
        { hasnt: 'mappart1' },

        { note: 'wiki step 6: Klarense, on the Port Sarim dock, sells the Lady Lumbridge for 2,000' },
        { setpos: [3045, 3203, 0], why: 'north up the Port Sarim waterfront and out onto his dock' },
        { talk: 'klarense', picks: ['could buy it', 'sounds good'], tries: 3, why: 'buy the ship for 2,000' },
        { stage: 3 },

        { note: 'wiki step 6: aboard, down the ladder, and three planks into the hull' },
        { loc: 'dragonshipgangplank_on', at: [3047, 3205], why: 'board her' },
        { loc: 'dragonshipladdertop', at: [3049, 3208], why: 'down into the hold' },
        { useLoc: 'shiphole', at: [3047, 9639], obj: 'woodplank', why: 'first plank' },
        { useLoc: 'shiphole', at: [3047, 9639], obj: 'woodplank', why: 'second plank' },
        { useLoc: 'shiphole', at: [3047, 9639], obj: 'woodplank', want: 'patched the holes', why: 'third plank' },
        { stage: 7 },

        { note: 'wiki step 6: Ned in Draynor will crew her, once the map is in his hands' },
        { setpos: [3101, 3257, 0], why: 'east to Draynor Village' },
        { talk: 'ned', picks: ['take me to the island of Crandor'], why: 'hire him' },
        { talk: 'ned', picks: ['take me to Crandor Island now'], want: 'give the map to Ned', why: 'and hand over the map' },
        { stage: 8 },
        { hasnt: 'dragonmap' },

        { note: 'wiki step 6: back aboard, and Ned sails' },
        { setpos: [3046, 3204, 0], why: 'back to Port Sarim' },
        { loc: 'dragonshipgangplank_on', at: [3047, 3205], why: 'board her again' },
        { loc: 'dragonshipladdertop', at: [3049, 3208], why: 'down to the cabin, which is where Ned waits once he has the map' },
        { talk: 'dragonslayer_ned', picks: ['Yep lets go'], why: 'cast off' },
        { stage: 9 },

        { note: 'wiki step 7: up the volcano and into the hole' },
        { setpos: [2833, 3256, 0], why: 'north across Crandor to the volcano, past everything on it' },
        { loc: 'crandor_rock_opening', at: [2833, 3255], why: 'into the volcano' },

        { note: 'wiki step 8: Elvarg, behind the gates' },
        { setpos: [2846, 9636, 0], why: 'along the corridor past the skeletons, up to her gates' },
        { held: 'antidragonbreathshield', op: 2, why: 'the shield goes on BEFORE the gate - she breathes the moment you are in' },
        { worn: 'antidragonbreathshield' },
        { loc: 'elvarg_gate_right', at: [2847, 9636], why: 'the gate into her chamber' },
        { worn: 'rune_scimitar' },
        { go: [2850, 9636], why: 'in among the stalagmites' },
        { fight: 'elvarg', why: 'and that is the quest' },
        { stage: 10 },
        { note: 'no head: Elvarg dropping her own head is the Old School rework, not 2006' }
    ]
};

const p: any = H.makePlayer('dragonrun', m.start[0], m.start[1]);
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
