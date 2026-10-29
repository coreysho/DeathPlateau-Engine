// ENTER THE ABYSS, played through on foot.
//
// Quest 43 of the quest-by-quest pass, and a miniquest: the Zamorakian mage outside Edgeville wants
// to know how the Order of Wizards moves runecrafters about, and hands over a scrying orb to find
// out. Three different essence teleports fill it - any three of the five - and the reward is the
// first rune pouch and the instruction book that explains the Abyss.
//
//   npx tsx tools/sim/miniquest_abyssal_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const MAGE: [number, number, number] = [3263, 3381, 0];   // inside the Varrock Chaos Temple

const m: Manifest = {
    quest: 'ENTER THE ABYSS',
    source: 'oldschool.runescape.wiki/w/Enter_the_Abyss',
    stageVar: 'abyssal_miniquest',
    done: 4,   // ^miniquest_abyssal_complete
    start: [3263, 3381, 0],
    steps: [
        { note: 'requirement: Rune Mysteries, which quest_runemysteries_run.ts walks in full and' },
        { note: 'which is what gives the essence teleports in the first place' },
        { setvar: 'runemysteries', to: 6, why: '^runemysteries_complete' },

        { note: 'wiki step 1: the Mage of Zamorak out in the Wilderness north of Edgeville. He will' },
        { note: 'not talk there - "Meet me in Varrock’s Chaos Temple" - and that first word with him' },
        { note: 'is what opens the conversation at the temple at all: the temple mage’s own switch has' },
        { note: 'no case for a player who has not met him, so clicking him first does nothing.' },
        { setpos: [3111, 3558, 0], why: 'north into the Wilderness' },
        { talk: 'rcu_zammy_mage1', want: 'Chaos Temple', why: 'he sends you somewhere he can talk' },
        { stage: 1 },

        { note: 'wiki step 2: the mage in the Varrock Chaos Temple. Asking where he gets his runes' },
        { note: 'is what starts it, and saying yes gets the orb.' },
        { setpos: [3263, 3381, 0], why: 'south to the temple, and inside it - the mage stands in the temple, not at its door' },
        { talk: 'rcu_zammy_mage1_edge', picks: ['Where do you get your runes from?', 'Yes'], want: 'orb', why: 'he hands over a scrying orb' },
        { stage: 2 },
        { has: 'scrying_orb_empty' },

        { note: 'wiki step 3: three of the five essence teleports, which the orb listens in on.' },
        { note: 'Aubury is op4 on him rather than op3 - the shop has the third slot.' },
        { setpos: [3254, 3404, 0], why: 'into Aubury’s shop in Varrock' },
        { talk: 'aubury', op: 4, why: 'the first teleport' },
        { varis: 'rcu_essencespot_aubury', to: 1 },

        { setpos: [2686, 3324, 0], why: 'west to Cromperty in Ardougne' },
        { talk: 'ardounge_wizard', op: 3, why: 'the second' },
        { varis: 'rcu_essencespot_cromperty', to: 1 },

        { setpos: [3104, 9570, 0], why: 'south to the head wizard, who is in the Wizards’ Tower BASEMENT' },
        { talk: 'head_wizard', op: 3, why: 'and the third, which fills the orb' },
        { varis: 'rcu_essencespot_wizardstower', to: 1 },
        { has: 'scrying_orb_full' },

        { note: 'wiki step 4: back to the mage with it' },
        { setpos: MAGE, why: 'back to the temple' },
        { talk: 'rcu_zammy_mage1_edge', why: 'hand over the orb - a full orb is taken before any menu opens' },
        { stage: 3 },
        { note: 'and one more word with him for the reward, which is a stage of its own' },
        { talk: 'rcu_zammy_mage1_edge', want: 'pouch', why: 'the pouch and the book' },
        { stage: 4 },
        { has: 'rcu_pouch_small' },
        { has: 'rcu_instruction_book' },
        { hasnt: 'scrying_orb_full' }
    ]
};

const p: any = H.makePlayer('abyssrun', m.start[0], m.start[1]);
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
