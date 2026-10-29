// THE TOURIST TRAP, played through on foot.
//
// Quest 103 of the quest-by-quest pass. It had no coverage at all - one line in audit3.ts setting
// desertrescue to 30 so Desert Treasure could start - and it is 3,120 lines, most of them dialogue
// trees with a single correct path through them.
//
// The quest is a prison break in three acts: get into the Desert Mining Camp (kill the Mercenary
// Captain for his gate key, then go in unarmed), get down into the mine (trade a slave for his
// robes), and get Ana out of it (a barrel, a mine cart, a lift, a winch, another barrel and a cart
// driver who wants bribing). Every leg of it is a different way of being caught.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_desertrescue_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

await H.boot();

// --- Shantay Pass
const IRENA: [number, number, number] = [3304, 3115, 0];

// --- the Desert Mining Camp, outside
const CAPTAIN: [number, number, number] = [3269, 3027, 0];
const GATE: [number, number] = [3273, 3028]; // miningcampgateclosedR; the L half is at 3273,3029
const GATE_OUT: [number, number] = [3272, 3028];
const GATE_IN: [number, number] = [3274, 3028];

// --- inside the camp
const SLAVE: [number, number, number] = [3287, 3017, 0];
const MINE_DOOR: [number, number] = [3301, 3036];
const MINE_DOOR_STAND: [number, number] = [3301, 3035];
const JAIL_DOOR: [number, number] = [3291, 3031];
const JAIL_OUT: [number, number] = [3291, 3030];
const JAIL_IN: [number, number] = [3291, 3032];
const LADDER: [number, number] = [3290, 3036];
const WINCH: [number, number] = [3279, 3017]; // ropepullthingy, the surface end of the lift
const UPPER_BARREL: [number, number] = [3278, 3017]; // ^desertrescue_upper_barrel_coord
const WOODEN_CART: [number, number] = [3287, 3023]; // loc_2682
const CART_DRIVER: [number, number, number] = [3284, 3021, 0];

// --- Captain Siad's room, one floor up in the jail
const BOOKCASE: [number, number] = [3284, 3032];
const CHEST: [number, number] = [3292, 3033];
const SIAD: [number, number, number] = [3292, 3031, 1];

// --- the Bedabin camp, west
const AL_SHABIM: [number, number, number] = [3172, 3024, 0];
const TENT_DOOR: [number, number] = [3169, 3046];
const ANVIL: [number, number] = [3171, 3048];

// --- underground. The mine door drops you at the west end; the cave at 3283 is the only way east.
const MINE_ARRIVE: [number, number] = [3278, 9426];
const CAVE_GUARD_STAND: [number, number] = [3280, 9414];
const MINECAVE_W: [number, number] = [3281, 9415]; // thminecaveL; the R half of this pair is at 3281,9414
const MINECAVE_E: [number, number] = [3283, 9415]; // and from the east, to come back
const LIFT: [number, number] = [3292, 9423]; // ropepullthingy2
const MINECART_LOWER: [number, number] = [3303, 9417]; // ^desertrescue_lower_minecart_coord
const LOWER_BARRELS: [number, number] = [3304, 9416]; // thminebarrel_empty, three tiles from the cart
const MINECART_UPPER: [number, number] = [3318, 9430];
const ANA: [number, number, number] = [3301, 9465, 0];

const m: Manifest = {
    quest: 'THE TOURIST TRAP',
    source: 'oldschool.runescape.wiki/w/The_Tourist_Trap/Quick_guide',
    stageVar: 'desertrescue',
    done: 30, // ^desertrescue_complete
    start: IRENA,
    steps: [
        { note: 'items: a desert shirt, robe and boots to trade to the slave, a hammer, bronze bars' },
        { note: 'and feathers for the prototype dart, and a weapon for the Mercenary Captain - which' },
        { note: 'has to come OFF before the camp gate, because a guard who sees armour or a weapon' },
        { note: 'in there puts you straight in a cell.' },
        { give: 'desert_shirt' },
        { give: 'desert_robe' },
        { give: 'desert_boots' },
        { give: 'hammer' },
        { give: 'bronze_bar', n: 2 },
        { give: 'feather', n: 15 },

        { note: 'wiki step 1: Irena, by Shantay Pass, whose daughter Ana went into the desert' },
        { go: [IRENA[0], IRENA[1]], why: 'to Irena' },
        { talk: 'irena', picks: [1, 3, 1], want: 'get your daughter back', why: 'take the quest' },
        { stage: 1 },

        { note: 'wiki step 2: the Mercenary Captain, outside the camp gate. He has the gate key on' },
        { note: 'his belt and he will not fight you until you have insulted him in the right order -' },
        { note: 'the only branch of five that ends in ~npc_retaliate is "a funny captain who cannot' },
        { note: 'fight his own battles". Every other branch has the guards shove you into the sand.' },
        { go: [CAPTAIN[0] + 2, CAPTAIN[1]], why: 'to the Mercenary Captain' },
        { talk: 'desertminingcaptain', picks: [1, 2, 2, 2, 1], want: 'get on with it', why: 'goad him into it' },
        { stage: 3 },
        { fight: 'desertminingcaptain', untilvar: 'desertrescue', to: 4, tries: 2500, why: 'kill him for the key' },
        { stage: 4 },
        { has: 'metal_key' },

        { note: 'wiki step 3: and now everything comes off. [timer,mercenary_check] fires every' },
        { note: '25-100 ticks while you are inside the camp and arrests you for a weapon or a' },
        { note: 'single piece of armour, so the scimitar goes in the pack and stays there.' },
        { strip: [], why: 'unequip before the gate - strip keeps what it is given, so nothing' },
        { go: [GATE_OUT[0], GATE_OUT[1]], why: 'to the camp gate' },
        { loc: 'miningcampgateclosedr', at: GATE, hop: true, want: 'sneak past the guards', why: 'unlock it with the metal key' },
        { stage: 5 },

        { note: 'wiki step 4: the slave on the east wall wants his chains picked and then your' },
        { note: 'desert clothes for his own. One conversation, seven menus: arrived, interesting,' },
        { note: "what's that, I can try to undo them, it's funny you should say that, let's give it" },
        { note: 'a go, yes I will trade.' },
        { go: [SLAVE[0], SLAVE[1]], why: 'to the male slave' },
        { rng: 0.0, why: 'the lock is a stat_random(thieving, 111, 250) roll' },
        { talk: 'mining_slave_male', picks: [1, 2, 1, 1, 1, 1, 1], want: 'decomposing boots', why: 'the chains and the trade' },
        { rng: null },
        { stage: 8 },
        { has: 'slave_shirt' },
        { has: 'slave_robe' },
        { has: 'slave_boots' },
        { held: 'slave_shirt', op: 2, why: 'wear it' },
        { held: 'slave_robe', op: 2, why: 'and it' },
        { held: 'slave_boots', op: 2, why: 'and them' },
        { worn: 'slave_shirt' },
        { worn: 'slave_robe' },
        { worn: 'slave_boots' },

        { note: 'wiki step 5: the big wooden doors in the north-east corner, which only open for' },
        { note: 'somebody dressed as a slave' },
        { go: [MINE_DOOR_STAND[0], MINE_DOOR_STAND[1]], why: 'to the mine doors' },
        { loc: 'thttmineentrancel', at: MINE_DOOR, hop: true, want: 'dark, dank and smelly', why: 'into the mine' },
        { stage: 9 },

        { note: 'wiki step 6: the two guards at the cave mouth want a Tenti pineapple, and the only' },
        { note: 'way they say so is "I would like to mine in a different area" and then agreeing' },
        { note: 'with him' },
        { go: [CAVE_GUARD_STAND[0], CAVE_GUARD_STAND[1]], why: 'west to the guarded cave' },
        { talk: 'desertminingmercenary2', picks: [2, 2, 1], want: 'pineapple', why: 'the hint' },
        { stage: 10 },

        { note: 'wiki step 7: back up, and the slave robes come off before the gate - a guard who' },
        { note: 'sees a slave LEAVING raises the alarm' },
        { go: [MINE_ARRIVE[0], MINE_ARRIVE[1] + 1], why: 'back to the mine doors' },
        { loc: 'thttmineexitl', at: MINE_ARRIVE, hop: true, why: 'out of the mine' },
        { strip: [], why: 'out of the slave robes' },
        { go: [GATE_IN[0], GATE_IN[1]], why: 'to the gate' },
        { loc: 'miningcampgateclosedr', at: GATE, hop: true, why: 'out of the camp' },

        { note: 'wiki step 8: Al Shabim of the Bedabin, a hundred squares west, will trade a' },
        { note: "pineapple for the technical plans in Captain Siad's chest - and hands over a copy" },
        { note: 'of the key for it' },
        { go: [AL_SHABIM[0], AL_SHABIM[1]], r: 256, why: 'west to the Bedabin camp' },
        { talk: 'al_shabim', picks: [1, 1], want: 'copy of the key', why: 'take the deal' },
        { stage: 11 },
        { has: 'thbedobinkey' },

        { note: 'wiki steps 10-12: Captain Siad is upstairs in the camp jail. The bookcase on the' },
        { note: 'west wall is what makes the sailing line available, and the sailing line is the only' },
        { note: 'branch of his tree that distracts him without a random roll - the dragon and the' },
        { note: 'fire are random(10) and random(4).' },
        { go: [GATE_OUT[0], GATE_OUT[1]], r: 256, why: 'back to the camp gate' },
        { loc: 'miningcampgateclosedr', at: GATE, hop: true, why: 'in again' },
        { go: [JAIL_OUT[0], JAIL_OUT[1]], why: 'to the jail door' },
        { loc: 'loc_1528', at: JAIL_DOOR, hop: true, soft: true, why: 'open it' },
        { go: [JAIL_IN[0], JAIL_IN[1]], why: 'inside' },
        { loc: 'ladder', at: LADDER, hop: true, why: 'up to the captain' },
        { level: 1 },
        { go: [BOOKCASE[0] + 1, BOOKCASE[1]], why: 'to the bookcase' },
        { loc: 'capt_siad_bookcase', at: BOOKCASE, op: 2, want: 'books on the subject of sailing', why: 'search it' },
        { talk: 'capt_siad', picks: [1, 5, 3, 1], want: 'jib', why: 'get him talking about sailing' },
        { go: [CHEST[0] + 1, CHEST[1]], why: 'to the chest' },
        { useLoc: 'captain_siads_chest_closed', at: CHEST, obj: 'thbedobinkey', want: 'take out the plans', why: 'unlock it' },
        { stage: 12 },
        { has: 'thcaptplans' },
        { held: 'thcaptplans', op: 1, why: 'read them' },

        { note: 'wiki step 13: back to Al Shabim with the plans' },
        { loc: 'laddertop', at: LADDER, hop: true, why: 'down the ladder' },
        { level: 0 },
        { go: [JAIL_OUT[0], JAIL_OUT[1]], why: 'out of the jail' },
        { go: [GATE_IN[0], GATE_IN[1]], why: 'to the gate' },
        { loc: 'miningcampgateclosedr', at: GATE, hop: true, why: 'out of the camp' },
        { go: [AL_SHABIM[0], AL_SHABIM[1]], r: 256, why: 'west to the Bedabin camp' },
        { talk: 'al_shabim', picks: [1, 1], want: 'anvil in the other tent', why: 'show him the plans' },
        { stage: 13 },

        { note: 'wiki step 14: the anvil is in the northern tent, and the tent is SEALED - its' },
        { note: 'walls block every edge, so the only tile inside it a player can reach is the one' },
        { note: 'bedabin_tentdoor teleports you onto. Walking to the anvil from outside looks' },
        { note: 'possible on the collision map (3170,3048 and 3172,3048 are standable) and is not.' },
        { go: [TENT_DOOR[0], TENT_DOOR[1] - 1], why: 'to the tent' },
        { loc: 'bedabin_tentdoor', at: TENT_DOOR, hop: true, want: 'Okay go ahead', why: 'show the guard the plans' },
        { go: [ANVIL[0] - 1, ANVIL[1]], why: 'to the experimental anvil' },
        { rng: 0.0, why: 'the forge is a stat_random(smithing, 61, 245) roll' },
        { useLoc: 'experimental_anvil', at: ANVIL, obj: 'bronze_bar', picks: [1], want: 'dart tip', why: 'forge the tip' },
        { stage: 14 },
        { has: 'thprotodarttip' },
        { use: ['feather', 'thprotodarttip'], want: 'attach the feathers', why: 'ten feathers on the tip' },
        { rng: null },
        { stage: 15 },
        { has: 'thprotodart' },

        { note: 'wiki step 15: and the dart buys the pineapple' },
        { loc: 'bedabin_tentdoor', at: TENT_DOOR, hop: true, want: 'walk out of the tent', soft: true, why: 'out of the tent' },
        { go: [AL_SHABIM[0], AL_SHABIM[1]], why: 'back to Al Shabim' },
        { useNpc: 'al_shabim', obj: 'thprotodart', want: 'here is your pineapple', why: 'hand over the dart' },
        { stage: 16 },
        { has: 'tentipineapple' },
        { has: 'bronze_dart', n: 6 },

        { note: 'wiki step 16: back into the camp, back into the robes, and the guard gets his' },
        { note: 'pineapple' },
        { go: [GATE_OUT[0], GATE_OUT[1]], r: 256, why: 'back to the camp gate' },
        { loc: 'miningcampgateclosedr', at: GATE, hop: true, why: 'in' },
        { held: 'slave_shirt', op: 2, why: 'back into the robes' },
        { held: 'slave_robe', op: 2 },
        { held: 'slave_boots', op: 2 },
        { go: [MINE_DOOR_STAND[0], MINE_DOOR_STAND[1]], why: 'to the mine doors' },
        { loc: 'thttmineentrancel', at: MINE_DOOR, hop: true, why: 'into the mine' },
        { go: [CAVE_GUARD_STAND[0], CAVE_GUARD_STAND[1]], why: 'to the cave guards' },
        { useNpc: 'desertminingmercenary2', obj: 'tentipineapple', want: "a deal's a deal", why: 'the pineapple' },
        { stage: 17 },

        { note: 'wiki step 17: through the cave, and a barrel from the stack by the mine cart' },
        { loc: 'thminecavel', at: MINECAVE_W, hop: true, want: 'different part of this huge underground', why: 'east through the cave' },
        { go: [MINECART_LOWER[0] - 1, MINECART_LOWER[1]], why: 'to the mine cart' },
        { go: [LOWER_BARRELS[0] - 1, LOWER_BARRELS[1]], why: 'to the barrels beside it' },
        { loc: 'thminebarrel_empty', at: LOWER_BARRELS, op: 2, picks: [1], want: 'take the barrel', why: 'take an empty barrel' },
        { has: 'thminebarrel_empty' },

        { note: 'wiki step 18-19: ride the cart down, then the north-west path to Ana - and she goes' },
        { note: 'into the barrel rather than being talked to' },
        { go: [MINECART_LOWER[0] - 1, MINECART_LOWER[1]], why: 'back to the cart' },
        { rng: 0.0, why: 'squeezing in is a stat_random(agility, 100, 250) roll' },
        { loc: 'touristtrap_minecart', at: MINECART_LOWER, op: 2, picks: [1], hop: true, want: 'large open room', why: 'squeeze into the cart' },
        { rng: null },
        { stage: 18 },
        { go: [ANA[0] + 1, ANA[1]], why: 'north-west to Ana' },
        { useNpc: 'ana', obj: 'thminebarrel_empty', want: 'squeeze Ana into the barrel', why: 'Ana in a barrel' },
        { stage: 19 },
        { has: 'thanainabarrel' },

        { note: 'wiki step 21: Ana goes in the cart and then you do' },
        { go: [MINECART_UPPER[0] + 1, MINECART_UPPER[1]], why: 'back to the mine cart' },
        { useLoc: 'touristtrap_minecart', at: MINECART_UPPER, obj: 'thanainabarrel', want: 'cart moves out of sight', why: 'put Ana in the cart' },
        { stage: 20 },
        { rng: 0.0, why: 'the agility roll again' },
        { loc: 'touristtrap_minecart', at: MINECART_UPPER, op: 2, picks: [1], hop: true, want: 'barrel loading room', why: 'ride after her' },
        { rng: null },

        { note: 'wiki step 22: and she is in one of the barrels by the cart - only the ones within' },
        { note: 'three squares of it' },
        { go: [LOWER_BARRELS[0] - 1, LOWER_BARRELS[1]], why: 'to the barrels' },
        { loc: 'thminebarrel_empty', at: LOWER_BARRELS, op: 2, want: 'find Ana', why: 'search them' },
        { stage: 21 },
        { has: 'thanainabarrel' },

        { note: 'wiki steps 23-24: the lift, and a guard who offers to help carry it. Keep his' },
        { note: 'suspicion down: "I said you were very gregarious" is the answer that works.' },
        { go: [LIFT[0] - 1, LIFT[1]], why: 'to the lift' },
        { useLoc: 'ropepullthingy2', at: LIFT, obj: 'thanainabarrel', picks: [1, 1], want: 'on the lift platform', why: 'let the guard load her' },
        { stage: 22 },

        { note: 'wiki steps 25-26: up to the surface the way you came, and work the winch yourself' },
        { go: [MINECAVE_E[0] + 1, MINECAVE_E[1]], why: 'west to the cave' },
        { loc: 'thminecaver', at: MINECAVE_E, hop: true, why: 'back through the cave' },
        { go: [MINE_ARRIVE[0], MINE_ARRIVE[1] + 1], why: 'to the mine doors' },
        { loc: 'thttmineexitl', at: MINE_ARRIVE, hop: true, why: 'out of the mine' },
        { go: [WINCH[0] + 2, WINCH[1]], why: 'to the winch' },
        { loc: 'ropepullthingy', at: WINCH, op: 2, want: 'muffled sound', why: 'haul the barrel up' },
        { stage: 23 },
        { go: [UPPER_BARREL[0] - 1, UPPER_BARREL[1]], why: 'to the barrel beside it' },
        { loc: 'thminebarrel_full', at: UPPER_BARREL, op: 2, want: 'I feel sick', why: 'find Ana again' },
        { stage: 24 },
        { has: 'thanainabarrel' },

        { note: 'wiki steps 27-29: the wooden cart in the middle of the camp, and a cart driver who' },
        { note: 'has to be talked round in eight menus. 2, 2, 1, 3, 3, 3, 1, 2 - the wiki has the' },
        { note: 'same eight.' },
        { go: [WOODEN_CART[0] - 1, WOODEN_CART[1]], why: 'to the wooden cart' },
        { useLoc: 'loc_2682', at: WOODEN_CART, obj: 'thanainabarrel', want: 'carefully on the cart', why: 'load Ana' },
        { stage: 25 },
        { go: [CART_DRIVER[0], CART_DRIVER[1]], why: 'to the cart driver' },
        { talk: 'mining_cart_driver', picks: [2, 2, 1, 3, 3, 3, 1, 2], want: 'jump in the cart', why: 'talk him into leaving' },
        { go: [WOODEN_CART[0] - 1, WOODEN_CART[1]], why: 'back to the cart' },
        { loc: 'loc_2682', at: WOODEN_CART, op: 2, picks: [1], hop: true, want: 'past the gates', why: 'climb on' },
        { stage: 26 },
        { has: 'thanainabarrel' },

        { note: 'wiki step 30: Irena, Ana out of the barrel, and two skills of your choosing' },
        { note: 'IT IS ALL ONE CONVERSATION. Irena takes the barrel, which runs' },
        { note: '@desertrescue_ana_rescued: that adds Ana beside her and then p_opnpc(1) clicks her,' },
        { note: 'so Ana hands over the wrought iron key and vanishes, and Irena goes straight on to' },
        { note: 'the reward with two skill menus. Four answers in one click.' },
        { go: [IRENA[0], IRENA[1]], r: 256, why: 'back to Irena' },
        { talk: 'irena', picks: [1, 2], want: 'skills I can teach you', why: 'hand Ana over, Fletching and Agility' },
        { stage: 30 },
        { has: 'thgoodminekey' },
        { hasnt: 'thanainabarrel' }
    ]
};

const p: any = H.makePlayer('ttrun', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
p.applyDamage = function () {};
H.setVar(p, 'macro_event', 1);
H.maxOut(p);
H.equip(p, { rhand: 'dragon_scimitar' });
H.tick(1);

const res = play(m, p);
const bad = res.filter(r => !r.ok);
console.log('');
if (bad.length) {
    console.log('WHAT WENT WRONG');
    for (const r of bad) console.log('  step ' + r.n + '  ' + r.what + (r.detail ? '  -- ' + r.detail : ''));
}
process.exit(bad.length ? 1 : 0);
