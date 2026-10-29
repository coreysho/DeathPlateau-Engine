// DREAM MENTOR, played through on foot.
//
// Quest 60 of the quest-by-quest pass. Cyrisus has 99 in every combat skill and has never once made
// himself fight anything, so he has crawled into the Lunar Isle mine to die of it. You feed him,
// talk him round, fetch his kit out of his own bank account, and then go into his dream and kill the
// four things he is afraid of while he watches.
//
// Post-2006 content, so this is OSRS's version of the quest by the era rule, and it was built that
// way: the wiki's requirements, its four bosses and its rewards, on the 474 npcs that came in with
// Lunar Diplomacy.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_dreammentor_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const MINE_TOP: [number, number] = [2142, 3944];
const MINE_BOTTOM: [number, number] = [2330, 10353];
const CYRISUS_FALLEN: [number, number] = [2340, 10333];
const JACK: [number, number] = [2102, 3925];
const ONEIROMANCER: [number, number] = [2155, 3864];
const SINK: [number, number] = [2075, 3922];
const BRAZIER: [number, number] = [2072, 3911];
const CYRISUS: [number, number] = [2076, 3908];
const BOOK: [number, number] = [1824, 5166];
// Both mine ladders sit in a recess and take a click from their west side only, so every climb
// walks to that tile first - the engine's own route for a loc interaction gives up long before the
// bank, and "player stuck at 2129,3941" is what that looks like.
const MINE_TOP_SIDE: [number, number] = [2141, 3944];
const MINE_BOTTOM_SIDE: [number, number] = [2329, 10353];
// "Fill the vial with water. The nearest source is the house west of the bank" - and that house is
// an 18-tile pocket behind one door, loc474_16778 on 2076,3920.
const HOUSE_DOOR: [number, number] = [2076, 3920];
// The Dream Hall is another pocket - 89 tiles - behind one door, loc474_16776 on 2082,3913. Cyrisus
// stands at 2075,3908 inside its south-west corner, so he cannot be reached from the street even
// though two of his four stand tiles are out there.
const HALL_DOOR: [number, number] = [2082, 3913];

const m: Manifest = {
    quest: 'DREAM MENTOR',
    source: 'oldschool.runescape.wiki/w/Dream_Mentor',
    stageVar: 'dreammentor',
    done: 70,
    start: [MINE_TOP[0], MINE_TOP[1] + 1, 0],
    steps: [
        { note: 'requirements are Lunar Diplomacy, Eadgar\'s Ruse and combat level 85, and no skills.' },
        { note: 'Everyone on Lunar Isle wants the seal of passage, Cyrisus included - he is a' },
        { note: 'mainlander lying in the Moon Clan mine, but Jack and the Oneiromancer are not.' },
        { setvar: 'lunar_quest', to: 150, why: 'Lunar Diplomacy complete' },
        { setvar: 'eadgar_quest', to: 70, why: "Eadgar's Ruse complete" },
        { give: 'lunar_seal_of_passage' },
        { give: 'bread', n: 7 },
        { give: 'trout', n: 7 },
        { give: 'lobster', n: 6 },
        { give: 'eadgar_goutweed_herb' },
        { give: 'hammer' },
        { give: 'pestle_and_mortar' },
        { give: 'astralrune' },
        { give: 'tinderbox' },

        { note: 'wiki step 1: down the mine ladder and through to the small cave' },
        { go: [MINE_TOP_SIDE[0], MINE_TOP_SIDE[1]], exact: true, r: 120, why: 'west of the mine ladder' },
        { loc: 'loc_10708', at: MINE_TOP, want: 'climb down', why: '474 brought this ladder in with no handler' },
        { go: [CYRISUS_FALLEN[0], CYRISUS_FALLEN[1] - 1], r: 120, why: 'through the passage to the fallen man' },
        { talk: 'cyrisus_fallen', want: 'came in here to die', why: 'he sets the quest' },
        { stage: 10 },

        { note: 'wiki step 3: twenty pieces of food, and he refuses whatever he had last - so three' },
        { note: 'kinds, rotated. Seven, seven and six.' },
        { useNpc: 'cyrisus_fallen', obj: 'bread', want: 'less like a corpse', why: '1' },
        { useNpc: 'cyrisus_fallen', obj: 'trout', why: '2' },
        { useNpc: 'cyrisus_fallen', obj: 'lobster', why: '3' },
        { useNpc: 'cyrisus_fallen', obj: 'bread', why: '4' },
        { useNpc: 'cyrisus_fallen', obj: 'trout', why: '5' },
        { useNpc: 'cyrisus_fallen', obj: 'lobster', why: '6' },
        { useNpc: 'cyrisus_fallen', obj: 'bread', why: '7' },
        { useNpc: 'cyrisus_fallen', obj: 'trout', why: '8' },
        { useNpc: 'cyrisus_fallen', obj: 'lobster', why: '9' },
        { useNpc: 'cyrisus_fallen', obj: 'bread', why: '10' },
        { useNpc: 'cyrisus_fallen', obj: 'trout', why: '11' },
        { useNpc: 'cyrisus_fallen', obj: 'lobster', why: '12' },
        { useNpc: 'cyrisus_fallen', obj: 'bread', why: '13' },
        { useNpc: 'cyrisus_fallen', obj: 'trout', why: '14' },
        { useNpc: 'cyrisus_fallen', obj: 'lobster', why: '15' },
        { useNpc: 'cyrisus_fallen', obj: 'bread', why: '16' },
        { useNpc: 'cyrisus_fallen', obj: 'trout', why: '17' },
        { useNpc: 'cyrisus_fallen', obj: 'lobster', why: '18' },
        { useNpc: 'cyrisus_fallen', obj: 'bread', why: '19' },
        { useNpc: 'cyrisus_fallen', obj: 'trout', want: 'I can sit up', why: '20, and he can sit up' },
        { varis: 'dm_health', to: 20 },

        { note: 'wiki step 6: his kit is in his own bank account and Jack will open it. Which set is' },
        { note: 'in there depends on the combat skill YOU are strongest in, which is the joke - a' },
        { note: 'maxed player is read as melee, so the first of the three answers is his every time.' },
        { go: [MINE_BOTTOM_SIDE[0], MINE_BOTTOM_SIDE[1]], exact: true, r: 120, why: 'west of the ladder out' },
        { loc: 'loc_10707', at: MINE_BOTTOM, want: 'climb up', why: 'back up the ladder' },
        { go: [JACK[0], JACK[1]], r: 120, why: 'to the bank' },
        { talk: 'birdseye_jack', picks: [1, 1, 1, 1, 1], want: "That's the lot", why: 'five slots, five right answers' },
        { varis: 'dm_armament', to: 31 },

        { note: 'wiki step 4: ten encouraging things, which he only listens to once he is fed and' },
        { note: 'armed. The tenth is the one where he says who he is and what he is afraid of.' },
        { go: [MINE_TOP_SIDE[0], MINE_TOP_SIDE[1]], exact: true, r: 120, why: 'back to the mine ladder' },
        { loc: 'loc_10708', at: MINE_TOP, why: 'back down the mine' },
        { go: [CYRISUS_FALLEN[0], CYRISUS_FALLEN[1] - 1], r: 120, why: 'back to Cyrisus' },
        { talk: 'cyrisus_fallen', picks: [1], want: 'He is listening', why: '1' },
        { talk: 'cyrisus_fallen', picks: [1], why: '2' },
        { talk: 'cyrisus_fallen', picks: [1], why: '3' },
        { talk: 'cyrisus_fallen', picks: [1], why: '4' },
        { talk: 'cyrisus_fallen', picks: [1], why: '5' },
        { talk: 'cyrisus_fallen', picks: [1], why: '6' },
        { talk: 'cyrisus_fallen', picks: [1], why: '7' },
        { talk: 'cyrisus_fallen', picks: [1], why: '8' },
        { talk: 'cyrisus_fallen', picks: [1], why: '9' },
        { talk: 'cyrisus_fallen', picks: [1], want: 'My name is Cyrisus', why: '10, and he tells you' },
        { varis: 'dm_spirit', to: 10 },
        { stage: 20 },

        { note: 'wiki step 9: the Oneiromancer, south-east by the Astral Altar' },
        { go: [MINE_BOTTOM_SIDE[0], MINE_BOTTOM_SIDE[1]], exact: true, r: 120, why: 'back to the ladder out' },
        { loc: 'loc_10707', at: MINE_BOTTOM, why: 'up out of the mine' },
        { go: [ONEIROMANCER[0], ONEIROMANCER[1]], r: 120, why: 'south-east to the Oneiromancer' },
        { talk: 'oneiromancer', want: 'dream vial', why: 'she sets the potion' },
        { stage: 30 },
        { has: 'dream_vial_empty' },

        { note: 'wiki steps 11-14: water, goutweed, and an astral rune smashed and ground' },
        { go: [HOUSE_DOOR[0], HOUSE_DOOR[1]], exact: true, r: 120, why: 'the door of the house west of the bank' },
        { loc: 'loc474_16778', at: HOUSE_DOOR, soft: true, why: 'open it' },
        { go: [SINK[0], SINK[1] - 1], exact: true, why: 'in, beside the sink' },
        { useLoc: 'loc474_16704', at: SINK, obj: 'dream_vial_empty', want: 'You fill the', why: 'fill it' },
        { has: 'dream_vial_water' },
        { use: ['eadgar_goutweed_herb', 'dream_vial_water'], want: 'goutweed into the dream vial', why: 'the herb' },
        { use: ['hammer', 'astralrune'], want: 'smash the astral rune', why: 'the hammer' },
        { use: ['pestle_and_mortar', 'astral_rune_shards'], want: 'fine, cold powder', why: 'the pestle' },
        { use: ['ground_astral_rune', 'dream_vial_herb'], want: 'shared dreaming', why: 'and the potion' },
        { stage: 40 },
        { has: 'dream_potion' },

        { note: 'wiki step 16: the Dream Hall, the potion on the brazier, and a tinderbox' },
        { go: [HOUSE_DOOR[0] - 1, HOUSE_DOOR[1]], exact: true, why: 'back to the house door' },
        { loc: 'loc474_16778', at: HOUSE_DOOR, soft: true, why: 'open it again; it shuts itself' },
        { go: [HALL_DOOR[0], HALL_DOOR[1]], exact: true, r: 120, why: 'round to the Dream Hall door' },
        { loc: 'loc474_16776', at: HALL_DOOR, soft: true, why: 'open it' },
        { go: [CYRISUS[0] + 1, CYRISUS[1]], exact: true, r: 60, why: 'in, beside Cyrisus' },
        { useNpc: 'cyrisus', obj: 'dream_potion', want: 'tips the potion', why: 'onto the brazier' },
        { varis: 'dm_brazier', to: 1 },
        { go: [BRAZIER[0] + 1, BRAZIER[1]], why: 'to the brazier' },
        { useLoc: 'loc474_16810', at: BRAZIER, obj: 'tinderbox', want: 'cold white flame', why: 'light it' },
        { go: [CYRISUS[0] + 1, CYRISUS[1]], why: 'back to Cyrisus' },
        { talk: 'cyrisus', picks: ["Let's go."], want: 'does not come down', why: 'into the dream' },
        { stage: 50 },

        { note: 'wiki steps 17-20: the four fears, one after another, in the arena on 474\'s m28_80.' },
        { note: 'All four have zero magic defence, which is what makes this a magic fight for a real' },
        { note: 'player; a maxed sim player does it with its hands. %dm_boss is the proof each time,' },
        { note: 'because only the death trigger moves it on.' },
        { nearnpc: 'the_inadequacy', r: 16, why: 'something very large is walking towards you' },
        { note: 'ONE fight step for all four, not four. Each one is aggressive and spawned in the' },
        { note: 'same breath as the last one dies, so a step per boss reported "none of' },
        { note: 'the_inadequacy is spawned anywhere near" while the player was killing it two tiles' },
        { note: 'away - the same thing the hunt step was written for in A Souls Bane. %dm_boss going' },
        { note: 'to 5 is what proves all four went down, because only their death triggers move it.' },
        { fight: ['the_inadequacy', 'the_everlasting', 'the_untouchable', 'the_illusive'], untilvar: 'dm_boss', to: 5, tries: 16, r: 24, why: 'levels 343, 223, 274 and 108' },
        { stage: 60 },

        { note: 'wiki step 22: the book at the north end of the arena is the only way out' },
        { go: [BOOK[0], BOOK[1] - 1], r: 40, why: 'north to the lectern' },
        { loc: 'loc474_11398', at: BOOK, picks: ['Read and return to reality.'], want: 'only one of them had ever been afraid', why: 'wake up' },

        { note: 'wiki step 23: and back to the Oneiromancer, who felt it from there. The book puts' },
        { note: 'you back at the brazier, which is inside the hall, so the door again.' },
        { go: [HALL_DOOR[0] - 1, HALL_DOOR[1]], exact: true, r: 60, why: 'back to the hall door' },
        { loc: 'loc474_16776', at: HALL_DOOR, soft: true, why: 'open it' },
        { go: [ONEIROMANCER[0], ONEIROMANCER[1]], r: 120, why: 'back south-east' },
        { talk: 'oneiromancer', want: 'deeper magic', why: 'the quest' },
        { stage: 70 },
        { has: 'dreamy_lamp' }
    ]
};

const p: any = H.makePlayer('dmrun', m.start[0], m.start[1]);
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
