// ALFRED GRIMHAND'S BARCRAWL, played through on foot.
//
// Quest 38 of the quest-by-quest pass, and a miniquest: the Barbarian Outpost guard will not let a
// non-barbarian through his gate until they have drunk the strongest thing in ten different bars
// and had the card signed in each. Every bar charges for it and every drink takes a bite out of
// several stats, which is the whole joke.
//
//   npx tsx tools/sim/quest_barcrawl_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

await H.boot();

// bar, the bartender who signs for it, a tile beside them, and %barcrawl once they have
const BARS: [string, string, [number, number, number], number, string[]][] = [
    ['the Blue Moon, Varrock', 'bluemoon_bartender', [3226, 3400, 0], 9, ['barcrawl']],
    ['Blurberry’s, the Gnome Stronghold', 'blurberry', [2481, 3490, 1], 25, []],   // the barman sends you to Blurberry himself - he serves the Fire Toad Blast
    ['the Dead Man’s Chest, Brimhaven', 'deadmans_bartender', [2798, 3155, 0], 57, ['barcrawl']],
    ['the Dragon Inn, Yanille', 'dragon_bartender', [2555, 3077, 0], 121, ['barcrawl']],
    ['the Flying Horse Inn, Ardougne', 'flyinghorse_bartender', [2575, 3321, 0], 249, ['barcrawl']],
    ['the Forester’s Arms, Seers’ Village', 'foresters_bartender', [2691, 3494, 0], 505, ['barcrawl']],
    ['the Jolly Boar Inn, north-east of Varrock', 'jollyboar_bartender', [3277, 3488, 0], 1017, ['barcrawl']],
    ['the Karamja Spirits Bar', 'zambo', [2925, 3143, 0], 2041, ['barcrawl']],
    ['the Rising Sun, Falador', 'risingsun_barmaid', [2955, 3374, 0], 4089, ['barcrawl']],
    ['the Rusty Anchor, Port Sarim', 'rustyanchor_bartender', [3049, 3258, 0], 8185, ['barcrawl']]
];

const m: Manifest = {
    quest: "ALFRED GRIMHAND'S BARCRAWL",
    source: 'oldschool.runescape.wiki/w/Alfred_Grimhand%27s_Barcrawl',
    stageVar: 'barcrawl',
    done: 2,   // ^barcrawl_complete
    start: [2544, 3569, 0],
    steps: [
        { note: 'the drinks are not free - about seventy coins a round, ten rounds' },
        { give: 'coins', n: 2000 },

        { note: 'wiki step 1: the guard on the Barbarian Outpost gate, who wants proof you can' },
        { note: 'drink like a barbarian' },
        { talk: 'barbguard1', picks: ['I want to come through this gate', 'Looks can be deceiving'], want: 'hands you a Barcrawl card', why: 'the card' },
        { stage: 1 },
        { has: 'barcrawl_card' }
    ]
};

m.steps.push(
    { note: 'every bar words the round differently, so the signature is read off %barcrawl rather' },
    { note: 'than the text. One ask each, too: Blurberry has no menu at all before the quest and a' },
    { note: 'cocktail job afterwards, so a second ask walks into the wrong conversation, and he' },
    { note: 'serves the Fire Toad Blast with no menu at all.' }
);
for (const [where, npc, at, after, picks] of BARS) {
    m.steps.push(
        { note: 'wiki: ' + where } as Step,
        { setpos: at, why: 'to the bar' } as Step,
        { talk: npc, picks, why: 'drink it and get signed' } as Step,
        { varis: 'barcrawl', to: after } as Step
    );
}

m.steps.push(
    { note: 'wiki: and back to the guard, who lets you in from then on. The completed card is' },
    { note: 'worth nothing afterwards - the bits are cleared and %barcrawl becomes 2.' },
    { setpos: [2544, 3569, 0], why: 'back north to the outpost' },
    { talk: 'barbguard1', want: 'barbarian', why: 'show him the card' },
    { stage: 2 }
);

const p: any = H.makePlayer('barcrawlrun', m.start[0], m.start[1]);
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
