// MERLIN'S CRYSTAL, played through on foot.
//
// Quest 45 of the quest-by-quest pass. Merlin is inside a crystal in the Camelot tower; getting him
// out takes a trip to Morgan Le Faye's keep inside one of Arhein's delivery crates, a black candle
// nobody wants to make, a spirit bound with four words read off a chaos altar, and Excalibur, which
// the Lady of the Lake will only give to somebody who feeds a beggar.
//
//   npx tsx tools/sim/quest_arthur_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const ARTHUR: [number, number, number] = [2764, 3514, 0];
const SYMBOL: [number, number] = [2780, 3515];   // ^camelot_magic_symbol
const CRYSTAL: [number, number] = [2767, 3493];
const ALTAR: [number, number] = [3259, 3381];
const JEWELLER: [number, number] = [3016, 3246];

const m: Manifest = {
    quest: "MERLIN'S CRYSTAL",
    source: 'oldschool.runescape.wiki/w/Merlin%27s_Crystal',
    stageVar: 'arthur',
    done: 7,   // ^arthur_complete
    start: [2764, 3514, 0],
    steps: [
        { note: 'bats’ bones for the summoning, a bucket of wax for the candle the candle maker' },
        { note: 'does not want to make, a tinderbox to light it, and a loaf for the beggar' },
        { give: 'bat_bones' },
        { give: 'bucket_wax' },
        { give: 'tinderbox' },
        { give: 'bread' },
        { give: 'rune_scimitar' },
        { held: 'rune_scimitar', op: 2, why: 'wield it - Sir Mordred has to be beaten down' },

        { note: 'wiki step 1: King Arthur, at the round table' },
        { talk: 'king_arthur', picks: ['Knight of the Round Table'], want: 'rescue Merlin', why: 'he sets the quest' },
        { stage: 1 },

        { note: 'wiki step 2: Sir Gawain knows who trapped him' },
        { setpos: [2762, 3508, 0], why: 'round the table to Gawain' },
        { talk: 'sir_gawain', picks: ['Do you know how Merlin got trapped', 'Thank you for the information'], want: 'Morgan Le Faye', why: 'the name' },
        { stage: 2 },

        { note: 'wiki step 3: Sir Lancelot knows how the keep takes deliveries' },
        { setpos: [2759, 3516, 1], why: 'upstairs to Lancelot' },
        { talk: 'sir_lancelot', picks: ['get into Morgan Le Faye'], want: 'deliveries by boat from Catherby', why: 'the way in' },
        { stage: 3 },

        { note: 'wiki step 4: Arhein’s crate in Catherby, which is big enough to hide in' },
        { setpos: [2802, 3442, 0], why: 'east to the Catherby docks' },
        { loc: 'merlincrate_empty', at: [2801, 3442], op: 2, picks: ['Yes', 'Yes'], want: 'crate being put down', why: 'climb in and be shipped' },

        { note: 'wiki step 5: Sir Mordred, inside the keep. Beat him down and his mother stops the' },
        { note: 'fight to bargain for him.' },
        { setpos: [2770, 3403, 2], why: 'up through the keep' },
        { fight: 'sir_mordred', untilvar: 'arthur', to: 4, tries: 3, picks: ['Tell me how to untrap Merlin'], why: 'beat him down; his mother stops the fight to bargain' },
        { stage: 4 },

        { note: 'wiki step 6: the candle maker in Catherby will trade a black candle for a bucket' },
        { note: 'of wax, having first explained that black candles are very bad luck' },
        { setpos: [2799, 3440, 0], why: 'back to Catherby' },
        { talk: 'candle_maker', picks: ['Have you got any black candles'], want: 'bucket FULL of wax', why: 'he names his price' },
        { note: 'and the wax goes over by TALKING to him again, not by using it on him - his' },
        { note: 'opnpc1 is where the trade happens' },
        { talk: 'candle_maker', want: 'exchange the wax', why: 'the wax for the candle' },
        { has: 'unlit_black_candle' },

        { note: 'wiki step 7: the words of binding are written on the chaos altar in the Varrock' },
        { note: 'temple - and the altar is op2, Search, not op1' },
        { setpos: [3259, 3382, 0], why: 'east to the Chaos Temple' },
        { loc: 'thrantaxaltar', at: ALTAR, op: 2, want: 'Snarthon Candtrick Termanto', why: 'read the inscription' },

        { note: 'wiki step 8: light the candle, stand on the magic symbol by the tower and drop' },
        { note: 'the bats’ bones. The bones are op5 - Drop - and the symbol is one tile wide.' },
        { setpos: [2780, 3515, 0], why: 'back to Camelot, onto the symbol' },
        { go: SYMBOL, exact: true, why: 'exactly on it' },
        { use: ['tinderbox', 'unlit_black_candle'], why: 'light the candle' },
        { has: 'lit_black_candle' },
        { note: 'and Thrantax asks for the words - three of them are offered and only the one off' },
        { note: 'the altar binds him' },
        { held: 'bat_bones', op: 5, picks: ['Snarthon Candtrick Termanto'], want: 'mighty spirit', why: 'drop the bones and bind Thrantax' },
        { stage: 5 },

        { note: 'wiki step 9: Excalibur. The Lady of the Lake sets a test, and the test is a beggar' },
        { note: 'upstairs at the Port Sarim jeweller’s who wants a loaf of bread.' },
        { setpos: [2925, 3406, 0], why: 'south to the lake' },
        { talk: 'ladyofthelake', picks: ['I seek the sword Excalibur'], want: 'jeweller', why: 'she sets the test' },
        { setpos: [3016, 3245, 0], why: 'to Port Sarim' },
        { loc: 'jewellersdoor', at: JEWELLER, picks: ['Yes certainly'], want: 'Excalibur', why: 'the beggar, who is not a beggar' },
        { has: 'excalibur' },

        { note: 'wiki step 10: Excalibur on the crystal' },
        { setpos: [2768, 3493, 2], why: 'back to the Camelot tower' },
        { useLoc: 'merlins_crystal', at: CRYSTAL, obj: 'excalibur', want: 'set Merlin free', why: 'shatter it' },
        { stage: 6 },

        { note: 'wiki step 11: and tell Arthur' },
        { setpos: ARTHUR, why: 'down to the round table' },
        { talk: 'king_arthur', why: 'the reward' },
        { wait: 4, why: 'the completion is queued' },
        { stage: 7 }
    ]
};

const p: any = H.makePlayer('arthurrun', m.start[0], m.start[1]);
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
