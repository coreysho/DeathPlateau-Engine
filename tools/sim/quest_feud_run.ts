// THE FEUD, played through on foot. Nothing here teleports except the magic carpet between Al
// Kharid and Pollnivneach, which is world travel and says so.
//
// This is the REBUILT quest - the one the wiki describes - after tools/questgaps.py ranked The Feud
// first of 111 quest directories and the audit found a different quest standing on the real one's
// parts. Each `note` gives the wiki's step number.
//
//   npx tsx tools/sim/quest_feud_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const m: Manifest = {
    quest: 'THE FEUD',
    source: 'oldschool.runescape.wiki/w/The_Feud/Quick_guide (2005 quest, unchanged in OSRS)',
    stageVar: 'feud_var',
    done: 62,
    start: [3304, 3214, 0],
    steps: [
        { give: 'coins', n: 2000 },
        { give: 'leather_gloves' },
        { give: 'bucket_empty' },

        { note: 'wiki step 1: Ali Morrisane, east of the gem trader in Al Kharid' },
        { go: [3304, 3213], why: 'the bazaar' },
        { talk: 'feud_ali_m', picks: [1, 1, 3], why: 'why not, I could look, nothing yet' },
        { stage: 4 },

        { note: 'wiki step 2: buy the headpiece and the beard, and put them together' },
        { talk: 'feud_ali_m', picks: [1], why: 'the headpiece' },
        { has: 'feud_karidian_turban' },
        { talk: 'feud_ali_m', picks: [2], why: 'the beard' },
        { has: 'feud_karidian_fakebeard' },
        { use: ['feud_karidian_turban', 'feud_karidian_fakebeard'] },
        { has: 'feud_desert_disguise' },

        { note: 'wiki step 3: travel to Pollnivneach' },
        { setpos: [3360, 2960, 0], why: 'the magic carpet from Shantay Pass - world travel, not this quest' },

        { note: 'wiki step 4: three beers on Drunken Ali, one at a time, with the talk after each' },
        { go: [3361, 2956], r: 64, why: 'the bar' },
        { talk: 'feud_ali_the_barman', picks: [1], why: 'a beer' },
        { has: 'beer' },
        { useNpc: 'feud_drunken_ali', obj: 'beer', why: 'the first' },
        { talk: 'feud_ali_the_barman', picks: [1] },
        { useNpc: 'feud_drunken_ali', obj: 'beer', why: 'the second' },
        { talk: 'feud_ali_the_barman', picks: [1] },
        { useNpc: 'feud_drunken_ali', obj: 'beer', why: 'the third' },
        { varis: 'feud_var_drink', to: 3 },
        { stage: 8 },

        { note: 'wiki steps 5-6: ask the bandits about the Menaphites, and the Menaphites about the bandits' },
        { go: [3355, 2989], r: 64, why: 'a bandit guard post' },
        { talk: 'feud_arabian_guard_multi', why: 'the bandits' },
        { go: [3347, 2956], r: 64, why: 'a Menaphite doorman' },
        { talk: 'feud_egyptian_doorman_multi', why: 'the Menaphites' },
        { varis: 'feud_var_talk_gangs', to: 2 },
        { stage: 12 },

        { note: 'wiki steps 7-8: both camels, 500 coins, and a receipt to each gang' },
        { go: [3350, 2968], r: 64, why: 'the camel seller' },
        { talk: 'feud_ali_the_discount_camel_seller', picks: [1] },
        { has: 'feud_camel_receipt', n: 2 },
        { stage: 16 },
        { go: [3347, 2956], r: 64 },
        { talk: 'feud_egyptian_doorman_multi', why: 'a receipt for the Menaphites' },
        { go: [3355, 2989], r: 64 },
        { talk: 'feud_arabian_guard_multi', why: 'and one for the bandits' },
        { varis: 'feud_var_comp_gangs', to: 2 },
        { varis: 'feud_boss_vis', to: 1 },

        { note: 'wiki step 9: Ali the Operator, in the big tent' },
        { go: [3332, 2953], r: 64, why: 'the tent' },
        { talk: 'feud_menap_boss', picks: [1], why: 'ask to join' },
        { stage: 20 },

        { note: 'wiki step 10: pickpocket a villager, badly, and go back' },
        { go: [3355, 2958], r: 64, why: 'a villager' },
        { talk: 'feud_villager_multi_2', op: 3, why: 'and he feels it' },
        { varis: 'feud_talk_villager', to: 1 },
        { go: [3332, 2953], r: 64 },
        { talk: 'feud_menap_boss' },
        { stage: 24 },
        { varis: 'feud_npc_multi', to: 1 },

        { note: 'wiki steps 11-12: the urchin for 10 coins, then the villager he is pestering' },
        { go: [3351, 2959], r: 64, why: 'the urchin by the well' },
        { talk: 'feud_street_urchin', picks: [1], why: 'ten coins' },
        { varis: 'feud_var_urchin', to: 2 },
        { go: [3356, 2958], r: 64, why: 'find the one being pestered' },
        { talk: 'feud_villager_multi_2', op: 3, tries: 3, soft: true },
        { go: [3359, 2968], r: 64 },
        { talk: 'feud_villager_multi_1', op: 3, tries: 3, soft: true },
        { go: [3359, 2976], r: 64 },
        { talk: 'feud_villager_multi_3', op: 3, tries: 3, soft: true },
        { varis: 'feud_var_urchin', to: 3 },
        { go: [3332, 2953], r: 64 },
        { talk: 'feud_menap_boss' },
        { stage: 28 },

        { note: 'wiki step 14: the blackjack, a villager on his own, and a quiet knock on the head' },
        { go: [3353, 2972], r: 64, why: 'the blackjack seller' },
        { talk: 'feud_black_jack_seller_multi', picks: [2] },
        { has: 'blackjack_oak' },
        { held: 'blackjack_oak', op: 2, why: 'wield it' },
        { go: [3359, 2976], r: 64, why: 'a villager' },
        { talk: 'feud_villager_multi_3', op: 4, why: 'lure him round the corner' },
        { talk: 'feud_villager_multi_3', op: 5, why: 'and put him down' },
        { varis: 'feud_found_trait', to: 1 },
        { go: [3332, 2953], r: 64 },
        { talk: 'feud_menap_boss', why: 'he has a job that is not a test' },
        { stage: 36 },
        { has: 'feud_mayors_house_keys' },

        { note: 'wiki steps 16-21: the disguise, the cactus, the door, the picture and the dial' },
        { held: 'feud_desert_disguise', op: 2, why: 'wear the disguise' },
        { worn: 'feud_desert_disguise' },
        { held: 'leather_gloves', op: 2, why: 'and the gloves' },
        { worn: 'leather_gloves' },
        { go: [3363, 2968], r: 64, why: "the cactus by the Mayor's house" },
        { loc: 'feud_cactus_row', at: [3363, 2967], why: 'wait for the guard' },
        { varis: 'feud_var_mayorsdoor', to: 1 },
        { go: [3369, 2971], r: 64, why: 'the street outside the front door' },
        { loc: 'feud_closed_door_left', at: [3370, 2971], why: 'the keys fit' },
        { go: [3373, 2977], r: 32, exact: true, why: 'the stairs' },
        { loc: 'feud_insidestairs_base', at: [3373, 2978], why: 'up' },
        { level: 1 },
        { loc: 'feud_mayors_picture', at: [3374, 2974], picks: [3], why: 'search it, and the dial' },
        { has: 'feud_mayors_jewels' },
        { stage: 40 },

        { note: 'wiki steps 22-26: hand them over, and find out what the gang is for' },
        { loc: 'feud_insidestairs_top', at: [3373, 2978], why: 'back down' },
        { level: 0 },
        // AND BACK OUT THROUGH THE DOOR YOU CAME IN BY. A walking runner has to leave the way a
        // player leaves: the front door is a closed-door loc, so there is no route out of the house
        // at all until it is clicked again, and the handler works out which side you are on.
        { go: [3371, 2971], r: 32, exact: true, why: 'the inside of the front door' },
        { loc: 'feud_closed_door_left', at: [3370, 2971], why: 'and out into the street' },
        { go: [3332, 2953], r: 96 },
        { talk: 'feud_menap_boss', why: 'the jewels' },
        { stage: 44 },
        { go: [3335, 2950], r: 64, why: 'a thug who cannot keep anything in' },
        { talk: 'feud_egyptian_minder' },
        { varis: 'feud_report_drink', to: 1 },
        { go: [3332, 2953], r: 64 },
        { talk: 'feud_menap_boss', why: 'the well' },
        { varis: 'feud_report_drink', to: 2 },
        { go: [3361, 2956], r: 64, why: 'the barman' },
        { talk: 'feud_ali_the_barman', why: 'which table' },
        { varis: 'feud_var_drink_found', to: 1 },

        { note: 'wiki steps 27-29: the red hot sauce, the trough, and what comes out of a camel' },
        { go: [3352, 2976], r: 64, why: 'the kebab seller' },
        { talk: 'feud_kebabman', picks: [1] },
        { has: 'superhot_kebab_sauce' },
        { go: [3340, 2962], r: 64, why: 'the camel trough' },
        { useLoc: 'feud_foodtrough', at: [3339, 2962], obj: 'superhot_kebab_sauce' },
        { varis: 'feud_used_sauce', to: 1 },
        { go: [3347, 2967], r: 64, why: 'behind the shop' },
        { loc: 'feud_ugthanki_pooh_poisoned', at: [3347, 2966], why: 'a bucket of it' },
        { has: 'feud_camel_poison_pooh_bucket' },

        { note: 'wiki steps 30-31: a coin in the money pot, and a snake' },
        { go: [3355, 2954], r: 64, why: "the charmer's money pot" },
        { useLoc: 'feud_money_bowl', at: [3355, 2953], obj: 'coins' },
        { has: 'snake_flute' },
        { has: 'basket_for_snake' },
        { go: [3328, 2956], r: 200, why: 'a desert snake' },
        { useNpc: 'feud_desert_snake', obj: 'snake_flute' },
        { has: 'basket_with_snake' },

        { note: 'wiki step 32: Ali the Hag wants both' },
        { go: [3348, 2988], r: 200, why: 'the hag' },
        { talk: 'feud_hag', why: 'she names the two' },
        { talk: 'feud_hag', why: 'the snake' },
        { talk: 'feud_hag', why: 'and the dung' },
        { has: 'poison_from_hag' },
        { stage: 48 },

        { note: 'wiki step 33: the beer on the table by the door' },
        { go: [3356, 2958], r: 64, why: 'the bar' },
        { useLoc: 'feud_poison_beer_table', at: [3356, 2957], obj: 'poison_from_hag' },
        { stage: 52 },
        { varis: 'feud_boss_vis2', to: 1 },

        { note: 'wiki steps 35-36: the Menaphite leader, and their tough guy' },
        { go: [3333, 2954], r: 64, why: 'outside the tent' },
        { talk: 'feud_menap_boss2', tries: 10 },
        { fight: 'feud_menap_toughguy' },
        { stage: 56 },

        { note: 'wiki steps 37-39: tell a villager, then the bandit leader, then his champion' },
        { go: [3359, 2968], r: 64 },
        { talk: 'feud_villager_multi_1', why: 'tell him' },
        { go: [3349, 3001], r: 200, why: 'the bandit leader' },
        { talk: 'feud_bandit_boss', tries: 10 },
        { fight: 'feud_bandit_toughguy' },
        { stage: 58 },

        { note: 'wiki steps 40-42: a villager, Ali the Mayor, and back to Morrisane' },
        { go: [3359, 2968], r: 200 },
        { talk: 'feud_villager_multi_1' },
        { go: [3362, 2966], r: 64, why: 'the Mayor by the well' },
        { talk: 'feud_mayor', tries: 10 },
        { stage: 60 },
        { setpos: [3304, 3214, 0], why: 'the carpet back to Al Kharid' },
        { go: [3304, 3213], r: 64 },
        { talk: 'feud_ali_m', why: 'his goods will travel' },
        { stage: 62 },
        { has: 'blackjack_oak' }
    ]
};

const p: any = H.makePlayer('feudrun', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
// No damage and no random events, for the same reasons the other two runs give: the desert and two
// champions kill a walking player, a death loses the pack, and a random event teleports you out of
// a two-hundred-tile walk. Damage going the other way is untouched, so both champions still have to
// die. 30 Thieving is a real requirement and maxOut covers it.
(p as any).applyDamage = function () {};
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
