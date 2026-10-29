// RAT CATCHERS, played through on foot.
//
// Quest 54 of the quest-by-quest pass. Ten chapters across five cities, and the build had three of
// them: Jimmy Dazzler, four rat holes and a party. Everything else - Phingspet and Grimesquit in
// the Varrock sewers, Hooknosed Jack, a poisoned cat, the King rat, Smokin' Joe under Keldagrim,
// the Face in Port Sarim, a snake charmer in Pollnivneach and eight notes on the docks - was in the
// cache, placed, named, and referenced by nothing.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_ratcatch_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const _GERTRUDEGERTRUDE: [number, number, number] = [3152, 3409, 0];
const PHINGSPET: [number, number, number] = [3249, 9869, 0];
const GRIMESQUIT: [number, number, number] = [3239, 9868, 0];
const JIMMY: [number, number, number] = [2563, 3321, 0];
const JACK: [number, number, number] = [3270, 3402, 0];
const POX: [number, number, number] = [3267, 3396, 0];
const LADDER: [number, number] = [3268, 3379];
const HOLE1: [number, number] = [3264, 3378];
const HOLE2: [number, number] = [3273, 3377];
const HOLE3: [number, number] = [3274, 3381];
const HOLE4: [number, number] = [3271, 3384];
const JOE: [number, number, number] = [2928, 10214, 0];
const HOLE5: [number, number] = [2933, 10212];
const FACE: [number, number, number] = [3020, 3228, 0];
const CHARMER: [number, number, number] = [3354, 2953, 0];
const DOCKS: [number, number, number] = [3014, 3219, 0];
const SARIM_MANHOLE: [number, number] = [3018, 3232];
const FELKRASH: [number, number, number] = [2975, 9636, 0];

const m: Manifest = {
    quest: 'RAT CATCHERS',
    source: 'oldschool.runescape.wiki/w/Ratcatchers',
    stageVar: 'ratcatch_var',
    done: 60, // ^ratcatch_complete
    start: [3152, 3409, 0],
    steps: [
        { note: 'requirements: Gertrude’s Cat, Icthlarin’s Little Helper, and The Giant Dwarf' },
        { note: 'started - the third one is for Keldagrim, and there is a Keldagrim chapter now.' },
        { setvar: 'fluffs', to: 6, why: '^fluffs_complete' },
        { setvar: 'ics_little_var', to: 26, why: '^icslittle_complete' },
        { setvar: 'giantdwarf_quest', to: 10, why: 'The Giant Dwarf started' },
        { note: 'a cat, and not an overgrown one - an overgrown cat will not chase anything' },
        { give: 'growncatobject' },
        { give: 'ics_little_amulet_of_catspeak' },

        { note: 'wiki step 1: Gertrude, who does not teach it herself' },
        { talk: 'gertrude', want: 'Phingspet and Grimesquit', why: 'she sets the quest' },
        { stage: 4 },

        { note: 'wiki step 1b: the two of them in the sewers, who both want a smell of the cat' },
        { setpos: PHINGSPET, why: 'down the manhole and east, past the palace' },
        { useNpc: 'vc_phingspet', obj: 'growncatobject', want: 'RAT cat', why: 'the first smell' },
        { setpos: GRIMESQUIT, why: 'along to the other one' },
        { useNpc: 'vc_grimesquit', obj: 'growncatobject', want: 'not been fed today', why: 'the second' },
        { stage: 6 },

        { note: 'and eight rats off the sewer floor. stat_random decides each one, so the roll is' },
        { note: 'pinned for the length of the chapter and put back before anything is fought.' },
        { rng: 0, why: 'every stat_random succeeds' },
        { useNpc: 'rat', obj: 'growncatobject', why: 'one' },
        { useNpc: 'rat', obj: 'growncatobject', why: 'two' },
        { useNpc: 'rat', obj: 'growncatobject', why: 'three' },
        { useNpc: 'rat', obj: 'growncatobject', why: 'four' },
        { useNpc: 'rat', obj: 'growncatobject', why: 'five' },
        { useNpc: 'rat', obj: 'growncatobject', why: 'six' },
        { useNpc: 'rat', obj: 'growncatobject', why: 'seven' },
        { useNpc: 'rat', obj: 'growncatobject', want: 'Eight', why: 'eight' },
        { stage: 8 },
        { talk: 'vc_phingspet', want: 'Jimmy Dazzler', why: 'the rat pole' },
        { stage: 10 },
        { has: 'vc_rat_pole' },

        { note: 'wiki step 2: Jimmy Dazzler, who is on the guest list and cannot be seen with a pole' },
        { setpos: JIMMY, why: 'to Ardougne' },
        { talk: 'vc_jimmy_dazzler', picks: ["What's the job?", 'Take me to the party.'], want: 'manor house', why: 'the party' },
        { stage: 15 },

        { note: 'six rats, six bits. They are spread over both floors of a mansion that has no road' },
        { note: 'to it, which is why Jimmy has to walk you there.' },
        { note: 'the six are in six rooms and the rooms do not all join up - beside.ts gives each' },
        { note: 'rat a pocket and three of them are under fifty tiles, so every one of these is a' },
        { note: 'tile that pocket actually contains' },
        { setpos: [2832, 5097, 1], why: 'to the first rat' },
        { useNpc: 'vc_partyrat_multi1', obj: 'vc_rat_pole', want: 'On the pole', why: 'one' },
        { has: 'vc_rat_pole_1' },
        { setpos: [2858, 5093, 1], why: 'across the upper floor' },
        { useNpc: 'vc_partyrat_multi2', obj: 'vc_rat_pole_1', want: 'On the pole', why: 'two' },
        { has: 'vc_rat_pole_2' },
        { setpos: [2859, 5090, 1], why: 'and the next' },
        { useNpc: 'vc_partyrat_multi3', obj: 'vc_rat_pole_2', want: 'On the pole', why: 'three' },
        { has: 'vc_rat_pole_3' },
        { setpos: [2862, 5097, 0], why: 'down to the ground floor' },
        { useNpc: 'vc_partyrat_multi4', obj: 'vc_rat_pole_3', want: 'On the pole', why: 'four' },
        { has: 'vc_rat_pole_4' },
        { setpos: [2858, 5090, 0], why: 'the ballroom' },
        { useNpc: 'vc_partyrat_multi5', obj: 'vc_rat_pole_4', want: 'On the pole', why: 'five' },
        { has: 'vc_rat_pole_5' },
        { setpos: [2862, 5087, 0], why: 'and the one in the trifle' },
        { useNpc: 'vc_partyrat_multi6', obj: 'vc_rat_pole_5', want: 'Six rats on one pole', why: 'six' },
        { stage: 20 },
        { has: 'vc_rat_pole_6' },
        { rng: null, why: 'there is a fight coming' },

        { note: 'wiki step 2b: back to Jimmy, who names Hooknosed Jack' },
        { setpos: JIMMY, why: 'back out through the gate' },
        { talk: 'vc_jimmy_dazzler', want: 'Hooknosed Jack', why: 'the next name' },
        { stage: 25 },

        { note: 'wiki step 3: Jack, the rat poison, and four cheeses' },
        { setpos: JACK, why: 'to south-east Varrock' },
        { talk: 'vc_hooknosed_jack', want: 'Four cheeses, four holes', why: 'the poison' },
        { stage: 30 },
        { has: 'rat_poison' },
        { give: 'cheese', n: 4 },
        { use: ['rat_poison', 'cheese'], want: 'work the poison into', why: 'poison all four at once' },
        { has: 'ratcatchers_poisonedcheese', n: 4 },

        { note: 'the four holes are upstairs in the warehouse south of the pub, and its ladder had' },
        { note: 'no trigger at all, so none of them could be reached' },
        { note: 'vc_ladder is placed at angle 2, which rotates its forceapproach so that the one' },
        { note: 'side it will NOT take a click from is the north - and the engine\u2019s own approach' },
        { note: 'picks the north tile anyway, so a click sent from up there walks you round to the' },
        { note: 'wrong side and is then refused. tools/sim/opfrom.ts is what found it.' },
        { setpos: [3268, 3377, 0], why: 'into the warehouse, south of the ladder' },
        { loc: 'vc_ladder', at: LADDER, want: 'climb up into the loft', why: 'up' },
        { level: 1 },
        { useLoc: 'ratcatchers_rathole1', at: HOLE1, obj: 'ratcatchers_poisonedcheese', why: 'one' },
        { useLoc: 'ratcatchers_rathole2', at: HOLE2, obj: 'ratcatchers_poisonedcheese', why: 'two' },
        { useLoc: 'ratcatchers_rathole3', at: HOLE3, obj: 'ratcatchers_poisonedcheese', why: 'three' },
        { useLoc: 'ratcatchers_rathole4', at: HOLE4, obj: 'ratcatchers_poisonedcheese', want: 'very quiet', why: 'four' },

        { note: 'wiki step 3b: and Jack’s own cat has eaten one of them' },
        { setpos: JACK, why: 'back down to Jack' },
        { talk: 'vc_hooknosed_jack', want: 'Apothecary', why: 'Pox' },
        { stage: 35 },

        { note: 'wiki step 4: the Apothecary, who is the only person in the game who makes anything' },
        { note: 'for a cat' },
        { give: 'marentill' },
        { give: 'unicorn_horn_dust' },
        { give: 'bucket_milk' },
        { setpos: [3197, 3406, 0], why: 'west across Varrock' },
        { talk: 'apothecary', want: 'do not let it lick its paws', why: 'the antipoison' },
        { has: 'ratcatchers_cat_antipoison' },
        { setpos: POX, why: 'back to the step' },
        { useNpc: 'vc_pox', obj: 'ratcatchers_cat_antipoison', want: 'full recovery', why: 'cure him' },

        { note: 'wiki step 5: there is still something upstairs, and it is not a rat the size of a' },
        { note: 'rat. vc_kingrat is Hidden in the cache with no statblock and placed nowhere.' },
        { setpos: JACK, why: 'ask Jack what is still up there' },
        { talk: 'vc_hooknosed_jack', want: 'be careful', why: 'the King rat' },
        { setpos: [3268, 3377, 0], why: 'back into the warehouse, south of the ladder' },
        { loc: 'vc_ladder', at: LADDER, want: 'climb up into the loft', why: 'up again' },
        { level: 1 },
        { useLoc: 'ratcatchers_rathole1', at: HOLE1, obj: 'growncatobject', picks: ['Be careful!'], want: 'size of a terrier', why: 'put the cat to the hole' },
        { note: 'THE FIGHT IS OVER BEFORE THE NEXT STEP RUNS. He is spawned with huntmode' },
        { note: 'aggressive_melee, so he comes at you inside the same drive that let him out, and a' },
        { note: 'maxed player retaliates and finishes him in a handful of ticks - which is why a' },
        { note: 'fight step after this one reported no King rat anywhere while the quest had already' },
        { note: 'moved on. What proves the kill is the stage, which only his death trigger sets.' },
        { wait: 10, why: 'he is already dead and the death is queued' },
        { stage: 40 },

        { note: 'wiki step 5b: Jack, who did not believe it, and Smokin’ Joe’s name' },
        { setpos: JACK, why: 'down to Jack' },
        { talk: 'vc_hooknosed_jack', want: "Smokin' Joe", why: 'the next name' },
        { stage: 45 },

        { note: 'wiki step 6: Joe, under Keldagrim, and eleven years of rats in a wall' },
        { setpos: JOE, why: 'to Keldagrim' },
        { talk: 'vc_smokin_joe', want: 'Garden weeds', why: 'the pot' },
        { has: 'ratcatchers_weedpot' },
        { give: 'tinderbox' },
        { use: ['tinderbox', 'ratcatchers_weedpot'], want: 'smoulder', why: 'light it' },
        { setpos: [2933, 10213, 0], why: 'along to the hole' },
        { useLoc: 'ratcatchers_rathole5', at: HOLE5, obj: 'ratcatchers_smokey_weedpot', want: 'three places at once', why: 'the pot in, the cat waiting' },
        { stage: 50 },
        { talk: 'vc_smokin_joe', want: 'the Face', why: 'the next name' },

        { note: 'wiki step 7: the Face, by the Port Sarim fishing shop, who runs everything else' },
        { setpos: FACE, why: 'to Port Sarim' },
        { talk: 'vc_face', picks: ["What's the problem here?"], want: 'Pollnivneach', why: 'the docks' },
        { stage: 55 },

        { note: 'wiki step 8: the snake charmer, who will not want to sell the tune and will sell it' },
        { give: 'coins', n: 200 },
        { setpos: CHARMER, why: 'to Pollnivneach' },
        { talk: 'feud_snakecharmer', picks: ["I'll pay for the tune."], want: 'Eight notes', why: 'buy the tune' },
        { has: 'ratcatchers_music' },

        { note: 'wiki step 9: the docks, and eight notes in the scroll’s order - D, G, E, F sharp,' },
        { note: 'high D, B, C sharp, A. The scroll has one inventory option, Read, so reading it and' },
        { note: 'playing it are the same click and where you are standing decides which.' },
        { setpos: DOCKS, why: 'onto the docks' },
        { note: 'a page and then a note, eight times: D G E F# highD B C# A' },
        { held: 'ratcatchers_music', picks: [1, 1, 1, 4, 1, 2, 1, 3, 2, 4, 2, 2, 2, 3, 2, 1], want: 'into the sea', why: 'play it' },
        { stage: 58 },

        { note: 'wiki step 10: Felkrash, down the manhole, who keeps the book' },
        { setpos: [3018, 3233, 0], why: 'to the manhole beside her' },
        { loc: 'vc_manhole_open', at: SARIM_MANHOLE, why: 'down' },
        { setpos: FELKRASH, why: 'across the pits' },
        { nearnpc: 'vc_felkrash_the_bard', r: 20, why: 'he is in the pits' },
        { talk: 'vc_felkrash_the_bard', want: 'every one of them has signed', why: 'the book' },
        { wait: 4, why: 'the completion is queued' },
        { stage: 60 }
    ]
};

const p: any = H.makePlayer('ratcatchrun', m.start[0], m.start[1]);
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
