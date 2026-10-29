// THE GRAND TREE, played through on foot.
//
// Quest 91 of the quest-by-quest pass. The Grand Tree is dying, Glough the head tree guardian says
// it is human sabotage, and Glough is the one killing it - for the wood, to build thirty battleships
// and invade Gielinor with them.
//
// Two set pieces have to come out right and both are driven here: the translation of Hazelmere's
// scroll, which is five menus and one wrong answer sends you back to Yanille, and the four twigs
// spelling TUZO on the four pillars of Glough's watchtower, which is what unlocks his trapdoor.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_grandtree_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const NARNODE: [number, number, number] = [2465, 3497, 0];
const HAZELMERE: [number, number, number] = [2677, 3086, 1];
const GLOUGH: [number, number, number] = [2478, 3462, 1];
const ANITA: [number, number, number] = [2390, 3514, 1];
const CUPBOARD: [number, number] = [2476, 3465];
const CHEST: [number, number] = [2482, 3462];
const LADDER: [number, number] = [2466, 3495]; // plane 2, climbing up spawns Charlie
const JAIL: [number, number, number] = [2464, 3496, 3];
const CLIMBTREE: [number, number] = [2484, 3464]; // plane 1, up into the watchtower
const PILLAR_T: [number, number] = [2485, 3467];
const PILLAR_U: [number, number] = [2486, 3467];
const PILLAR_Z: [number, number] = [2487, 3467];
const PILLAR_O: [number, number] = [2488, 3467];
const TRAPDOOR: [number, number] = [2487, 3464]; // plane 2
const GATE: [number, number] = [2945, 3041];
const FOREMAN: [number, number, number] = [3000, 3043, 0];
const KING_UNDER: [number, number, number] = [2466, 9897, 0];
const ROOT: [number, number] = [2457, 9881]; // daconia_coords value 2

const m: Manifest = {
    quest: 'THE GRAND TREE',
    source: 'oldschool.runescape.wiki/w/The_Grand_Tree/Quick_guide',
    stageVar: 'grandtree',
    done: 160, // ^grandtree_complete
    start: NARNODE,
    steps: [
        { note: 'requirements: 25 Agility for the watchtower, and a level 172 Black demon at the' },
        { note: 'end of it. No items.' },

        { note: 'wiki step 1: King Narnode, in the Grand Tree. He takes you down to the roots' },
        { note: 'before he will say what is wrong.' },
        { setpos: NARNODE, why: 'to King Narnode' },
        {
            talk: 'grandtree_narnode',
            picks: ["You seem worried, what's up?", "I'd be happy to help!"],
            want: 'translation book',
            why: 'he shows you the foundations'
        },
        { stage: 10 },
        { has: 'grandtree_barksample' },
        { has: 'grandtree_translationbook' },

        { note: 'wiki step 2: Hazelmere, on the hill on the island east of Yanille' },
        { setpos: HAZELMERE, why: 'to Hazelmere' },
        { talk: 'grandtree_hazelmere', want: 'scroll', why: 'he reads the bark and writes a reply' },
        { stage: 20 },
        { has: 'grandtree_scroll' },
        { hasnt: 'grandtree_barksample' },

        { note: 'wiki step 3: the translation. Five menus, and one wrong answer sends you back to' },
        { note: 'Yanille - the sequence is "none of the above" twice and then the three lines that' },
        { note: 'are actually in the scroll.' },
        { setpos: NARNODE, why: 'back to the King' },
        {
            talk: 'grandtree_narnode',
            picks: [
                'I think so!',
                'None of the above.',
                'None of the above.',
                "A man came to me with the King's seal.",
                'I gave the man Daconia rocks.',
                'And Daconia rocks will kill the tree!'
            ],
            want: 'forged my royal seal',
            why: 'translate the scroll'
        },
        { stage: 30 },

        { note: 'wiki step 4: Glough, in the tree house in front of the Grand Tree' },
        { setpos: GLOUGH, why: 'to Glough' },
        { talk: 'grandtree_glough', want: 'take care of this', why: 'tell him about the rocks' },
        { stage: 40 },

        { note: 'wiki step 5: the King says Glough has caught a human' },
        { setpos: NARNODE, why: 'back to the King' },
        { talk: 'grandtree_narnode', want: 'top level of the tree', why: 'ask to see the prisoner' },
        { stage: 50 },

        { note: 'wiki step 6: Charlie, in the cage at the top of the tree. Climbing the ladder is' },
        { note: 'what puts him there.' },
        { setpos: [LADDER[0] + 1, LADDER[1], 2], why: 'up the tree, to the top ladder' },
        { loc: 'grandtree_laddermiddle', at: LADDER, op: 2, hop: true, soft: true, why: 'climb to the top' },
        { talk: 'grandtree_charlie', want: 'search his home', why: 'he was paid by Glough' },
        { stage: 60 },

        { note: "wiki step 7: Glough's journal is in the cupboard in his house" },
        { setpos: [CUPBOARD[0] + 1, CUPBOARD[1], 1], why: "to Glough's house" },
        { loc: 'grandtree_cupboardclosed', at: CUPBOARD, soft: true, why: 'open the cupboard' },
        { loc: 'grandtree_cupboardopen', at: CUPBOARD, op: 2, want: "Glough's Journal", why: 'and search it' },
        { stage: 70 },
        { has: 'grandtree_journal' },

        { note: 'wiki steps 8-10: accuse him, and he has you arrested. Charlie is your cellmate,' },
        { note: 'the King comes down and lets you out, and tells you to leave on the glider.' },
        { setpos: GLOUGH, why: 'back to Glough' },
        { talk: 'grandtree_glough', want: 'Ka-Lu-Min', why: 'he calls the guards' },
        { stage: 80 },

        { note: 'wiki step 11: the glider pilot is on the platform by the cage' },
        { setpos: [2465, 3500, 3], why: 'out of the cage, onto the glider platform' },
        { nearnpc: 'pilot_grand_tree', r: 3, why: 'he is standing right there' },
        { talk: 'pilot_grand_tree', picks: ['Take me to Karamja please!'], want: 'east of here', why: 'fly to Karamja' },

        { note: 'wiki step 13: the shipyard gate, and the password Ka-Lu-Min' },
        { setpos: [GATE[0] - 1, GATE[1], 0], why: 'east to the Ship Yard gate' },
        {
            loc: 'grandtree_fencegate_l',
            at: GATE,
            picks: ['Glough sent me.', 'Ka.', 'Lu.', 'Min.'],
            hop: true,
            want: 'Sorry to have kept you',
            why: 'talk your way in'
        },

        { note: 'wiki step 14: the foreman, on the southern dock. Three questions about Glough,' },
        { note: 'and the wrong answer to any of them is a fight.' },
        { setpos: FOREMAN, why: 'to the foreman' },
        {
            talk: 'grandtree_foreman',
            picks: [
                'Sadly his wife is no longer with us!',
                'He loves worm holes.',
                'Anita.'
            ],
            want: 'order for the lumber',
            why: 'answer the interrogation'
        },
        { stage: 90 },
        { has: 'grandtree_order' },

        { note: 'wiki step 15: the King will not believe the lumber order' },
        { setpos: NARNODE, why: 'back to the stronghold' },
        { talk: 'grandtree_narnode', want: 'absurd accusation', why: 'show him the order' },

        { note: 'wiki step 16: Charlie knows where Glough keeps his keys' },
        { setpos: [LADDER[0] + 1, LADDER[1], 2], why: 'up the tree again' },
        { loc: 'grandtree_laddermiddle', at: LADDER, op: 2, hop: true, soft: true, why: 'climb to the top' },
        { talk: 'grandtree_charlie', want: "girlfriend's", why: 'he names Anita' },
        { stage: 100 },

        { note: "wiki step 17: Anita hands over Glough's key, thinking you will give it to him" },
        { setpos: ANITA, why: "to Anita's house, west of the toad swamp" },
        { talk: 'grandtree_anita', want: 'gives you a key', why: 'take the key' },
        { has: 'grandtree_gloughskey' },

        { note: "wiki step 18: the key opens the chest in Glough's house" },
        { setpos: [CHEST[0] + 1, CHEST[1], 1], why: "back to Glough's house" },
        { useLoc: 'grandtree_chestclosed', at: CHEST, obj: 'grandtree_gloughskey', want: 'found a scroll', why: 'unlock the chest' },
        { stage: 110 },
        { has: 'grandtree_invasionplans' },

        { note: 'wiki step 19: the King still will not act, but the guards found four odd twigs' },
        { setpos: NARNODE, why: 'back to the King' },
        { talk: 'grandtree_narnode', want: 'odd twigs', why: 'show him the plans' },
        { stage: 120 },
        { has: 'grandtree_twigt' },
        { has: 'grandtree_twigu' },
        { has: 'grandtree_twigz' },
        { has: 'grandtree_twigo' },

        { note: 'wiki step 20: the four pillars of the watchtower in Glough’s house spell TUZO.' },
        { note: 'The twigs are dropped on them, west to east, and the order is what matters - the' },
        { note: 'King hands them over shuffled, on purpose.' },
        { setpos: [CLIMBTREE[0] + 1, CLIMBTREE[1], 1], why: 'to the watchtower tree' },
        { loc: 'grandtree_climbtree', at: CLIMBTREE, hop: true, soft: true, why: 'climb it' },
        { useLoc: 'grandtree_pillart', at: PILLAR_T, obj: 'grandtree_twigt', soft: true, why: 'T on the first pillar' },
        { useLoc: 'grandtree_pillaru', at: PILLAR_U, obj: 'grandtree_twigu', soft: true, why: 'U on the second' },
        { useLoc: 'grandtree_pillarz', at: PILLAR_Z, obj: 'grandtree_twigz', soft: true, why: 'Z on the third' },
        { useLoc: 'grandtree_pillaro', at: PILLAR_O, obj: 'grandtree_twigo', want: 'ancient pulley', why: 'and O on the fourth' },
        { stage: 130 },

        { note: 'wiki steps 21-23: down the trapdoor, and Glough sets a Black demon on you' },
        { go: [TRAPDOOR[0], TRAPDOOR[1] + 1], why: 'to the trapdoor' },
        { note: 'the cutscene under the trapdoor is Glough talking, and the demon is only put on' },
        { note: 'the floor at the end of it - so this clicks through rather than skipping it.' },
        { loc: 'grandtree_trapdoorclosed', at: TRAPDOOR, hop: true, picks: [], soft: true, why: 'down into the roots' },
        { wait: 10, why: 'he fetches his little friend' },
        { fight: 'grandtree_blackdemon', untilvar: 'grandtree', to: 140, tries: 12, r: 16, why: 'kill the demon' },
        { stage: 140 },

        { note: 'wiki step 24: the King is further up the passage, beside a ladder' },
        { setpos: KING_UNDER, why: 'along the passage to the King' },
        { talk: 'grandtree_narnode', want: 'hidden somewhere in the roots', why: 'tell him what Glough did' },
        { stage: 150 },

        { note: 'wiki step 25: one of fifteen roots has the last Daconia rock in it. Which one is' },
        { note: 'rolled when he asks, so the walk pins it rather than searching fifteen roots.' },
        { setvar: 'daconia_rock_root', to: 2, why: 'the root at 2457,9881' },
        { go: [ROOT[0], ROOT[1] - 1], why: 'to that root' },
        { loc: 'largeroot2_gnome', at: ROOT, want: 'Daconia Rock', why: 'search it' },
        { has: 'grandtree_daconiarock' },

        { note: 'wiki step 26: the rock to the King' },
        { setpos: KING_UNDER, why: 'back to the King' },
        { talk: 'grandtree_narnode', want: 'tree', why: 'hand it over' },
        { stage: 160 }
    ]
};

const p: any = H.makePlayer('grandtree', m.start[0], m.start[1]);
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
