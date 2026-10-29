// SHIELD OF ARRAV, played through on foot, by the Phoenix Gang.
//
// Quest 18 of the full quest-by-quest pass. Reldo's book, Baraek's twenty coins, Straven in the
// Phoenix hideout, Jonny the Beard in the Blue Moon, the hideout's chest, the Curator and King
// Roald.
//
// The gangs are mutually exclusive and one account can only ever reach one half of the shield, so
// this walks one half and the half reward - which is what the Curator pays for one half here, after
// an earlier fix: the two-certificate path needs a second player and is left exactly as it was.
//
//   npx tsx tools/sim/quest_arrav_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const m: Manifest = {
    quest: 'SHIELD OF ARRAV (PHOENIX GANG)',
    source: 'oldschool.runescape.wiki/w/Shield_of_Arrav',
    stageVar: 'phoenixgang',
    done: 10,   // ^phoenixgang_complete
    start: [3211, 3493, 0],
    steps: [
        { note: "wiki: twenty coins for Baraek, and something to kill Jonny the Beard with" },
        { give: 'coins', n: 50 },
        { give: 'rune_scimitar' },
        { held: 'rune_scimitar', op: 2, why: 'wield it' },

        { note: 'wiki step 1: Reldo in the Varrock palace library' },
        { talk: 'reldo', picks: ['in search of a quest'], why: 'he points at a book' },
        { stage: 1 },

        { note: 'wiki step 2: the book itself, in the library bookcase' },
        { loc: 'questbookcase', at: [3212, 3493], op: 2, want: 'take the book', why: 'search the case for it' },
        { has: 'the_shield_of_arrav' },
        { held: 'the_shield_of_arrav', op: 1, why: 'and read it - reading it is the step, not taking it' },
        { stage: 2 },

        { note: 'wiki step 3: back to Reldo, who names Baraek' },
        { talk: 'reldo', tries: 3, why: 'he names Baraek the fur trader - no menu, he jumps straight to it' },
        { stage: 3 },

        { note: 'wiki step 4: Baraek in the market, for twenty coins' },
        { setpos: [3219, 3436, 0], why: 'south to the market place' },
        { talk: 'baraek', picks: ['Phoenix Gang', 'Ok'], tries: 3, why: 'he sells the hideout for 20 coins' },
        { stage: 4 },

        { note: 'wiki step 5: Straven, in the hideout under south-east Varrock' },
        { setpos: [3248, 9779, 0], why: 'down into the hideout' },
        { loc: 'phoenixdoor', at: [3247, 9779], why: 'the hideout door', soft: true },
        { talk: 'straven', picks: ['I know who you are', 'offer you my services'], why: 'kill Jonny the Beard and bring the report' },
        { stage: 8 },

        { note: 'wiki step 6: Jonny the Beard, in the Blue Moon Inn' },
        { setpos: [3224, 3397, 0], why: 'up and west to the Blue Moon' },
        { fight: 'jonny_the_beard', until: 'intelligence_report', why: 'he drops the report' },
        { take: 'intelligence_report', r: 10, why: 'off the floor' },
        { has: 'intelligence_report' },

        { note: 'wiki step 7: the report to Straven, who lets you in' },
        { setpos: [3248, 9779, 0], why: 'back down to the hideout' },
        { loc: 'phoenixdoor', at: [3247, 9779], why: 'the hideout door', soft: true },
        { talk: 'straven', why: 'he takes the report' },
        { stage: 9 },
        { hasnt: 'intelligence_report' },

        { note: "wiki step 8: the chest in the hideout, and half the shield in it" },
        { setpos: [3236, 9761, 0], why: 'west through the hideout to the chest room' },
        { loc: 'phoenixshutchest', at: [3235, 9761], why: 'open the chest' },
        { wait: 4, why: 'opening it is its own action' },
        { loc: 'phoenixopenchest', at: [3235, 9761], until: 'arravshield1', tries: 3, why: 'and search it' },
        { has: 'arravshield1' },

        { note: 'wiki step 9: the Curator at the Varrock museum writes the certificate' },
        { setpos: [3258, 3446, 0], why: 'east to the museum' },
        { talk: 'curator', want: 'certificate', why: 'he takes the half shield' },
        { has: 'arravcertificate' },
        { hasnt: 'arravshield1' },

        { note: 'wiki step 10: and the certificate to King Roald' },
        { setpos: [3220, 3477, 0], why: 'west to the palace' },
        { talk: 'king_roald', why: 'the reward' },
        { stage: 10 },
        { hasnt: 'arravcertificate' },
        { has: 'coins', n: 600 }
    ]
};

const p: any = H.makePlayer('arravrun', m.start[0], m.start[1]);
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
