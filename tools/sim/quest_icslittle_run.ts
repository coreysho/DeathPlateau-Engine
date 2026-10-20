// ICTHLARIN'S LITTLE HELPER, played through on foot.
//
// Quest 47 of the quest-by-quest pass. Sophanem has had the plague for eleven years, its gates are
// shut, and its last priest has a predecessor lying unprepared in the tomb under the city. The way
// in is a woman camped outside who wants a tinderbox and a waterskin for it; the way through is an
// embalmer with a book nobody read, a weaver with a sheet he has kept clean for a decade, a
// carpenter who has not had an order since the gates shut, and a Sphinx who wants a number.
//
//   npx tsx tools/sim/quest_icslittle_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const WANDERER: [number, number, number] = [3317, 2849, 0];
const ROCKS: [number, number] = [3323, 2857];
const POND: [number, number] = [3289, 2845];
const SUNTRAP: [number, number] = [3305, 2756];
// The town npcs wander, so these are the middle of each one's beat rather than a tile beside it.
const PRIEST: [number, number, number] = [3280, 2772, 0];
const EMBALMER: [number, number, number] = [3288, 2758, 0];
const SIAMUN: [number, number, number] = [3315, 2786, 0];
const CARPENTER: [number, number, number] = [3313, 2769, 0];
const SPHINX: [number, number, number] = [3297, 2781, 0];
const TEMPLE_DOOR: [number, number] = [3294, 2778];
const JAR_LIVER: [number, number] = [3286, 9194];
const JAR_LUNGS: [number, number] = [3286, 9195];
const JAR_STOMACH: [number, number] = [3286, 9196];
const JAR_INTESTINES: [number, number] = [3286, 9193];

const m: Manifest = {
    quest: "ICTHLARIN'S LITTLE HELPER",
    source: 'oldschool.runescape.wiki/w/Icthlarin%27s_Little_Helper/Quick_guide',
    stageVar: 'ics_little_var',
    done: 26,   // ^icslittle_complete
    start: [3317, 2849, 0],
    steps: [
        { note: 'requirement: Gertrude’s Cat, which the High Priest never checked, and a cat, which' },
        { note: 'is what everything in Sophanem talks to before it talks to you' },
        { setvar: 'fluffs', to: 6, why: '^fluffs_complete' },
        { give: 'growncatobject' },
        { give: 'tinderbox' },
        { give: 'water_skin4' },
        { give: 'willow_logs' },
        { give: 'bucket_empty' },
        { give: 'knife' },

        { note: 'wiki step 1: the Wanderer, camped north-east of the city. She had op1=Talk-to and' },
        { note: 'no conversation at all, and she is the way in.' },
        { talk: 'ics_little_multi_wanderer', picks: ['Why do you have a problem with my cat?'], want: 'through the rocks', why: 'the tinderbox and the waterskin' },
        { hasnt: 'tinderbox' },

        { note: 'and the hole in the rocks behind her tent, which is shut to anybody who has not' },
        { note: 'been shown it' },
        { loc: 'ics_little_entrance_multi', at: ROCKS, want: 'under the wall into Sophanem', why: 'into the city' },

        { note: 'wiki step 9: the High Priest. He is the one still standing and he starts the quest.' },
        { setpos: PRIEST, why: 'west across the city to the temple' },
        { talk: 'ics_little_hipriest_town', picks: ["What's happened to this place?"], want: 'canopic jars', why: 'he asks for help' },
        { stage: 5 },

        { note: 'wiki step 16: the Embalmer, who needs linen, salt and sap' },
        { setpos: EMBALMER, why: 'south to the embalmer’s house' },
        { talk: 'ics_little_embalmer', want: 'Salt to dry him', why: 'he names the three' },
        { stage: 10 },
        { has: 'ics_little_pileofsalt' },
        { has: 'ics_little_sap_bucket' },

        { note: 'the walkthrough’s own fallback for salt - "use an empty bucket on the pond north of' },
        { note: 'Sophanem, then use the full bucket on the suntrap east of the Embalmer" - and the' },
        { note: 'pond, the suntrap and the bucket of salty water were all three in the cache with no' },
        { note: 'trigger between them.' },
        { setpos: [3290, 2845, 0], why: 'north out of the city to the pond' },
        { useLoc: 'icthalarins_waters_edge', at: POND, obj: 'bucket_empty', want: 'water in this pond is salt', why: 'fill the bucket' },
        { has: 'ics_little_saltwaterbucket' },
        { setpos: [3305, 2757, 0], why: 'back to the suntrap' },
        { useLoc: 'icthalarins_suntrap_centre', at: SUNTRAP, obj: 'ics_little_saltwaterbucket', want: 'pile of salt', why: 'the sun does the rest' },
        { has: 'ics_little_pileofsalt', n: 2 },

        { note: 'wiki step 16b: Siamun has the linen - "or from Raetul in Sophanem for 30 coins"' },
        { setpos: SIAMUN, why: 'east to the spinning wheel' },
        { talk: 'ics_little_linen2', want: 'best sheet I have', why: 'the linen' },
        { stage: 15 },
        { has: 'ics_little_linen' },

        { note: 'and back to the priest, who watches the embalming' },
        { setpos: PRIEST, why: 'back to the temple' },
        { talk: 'ics_little_hipriest_town', want: 'Klenter is prepared', why: 'the embalming' },
        { stage: 18 },

        { note: 'wiki step 17: "Go east and talk to the Carpenter. Give him your willow logs to' },
        { note: 'receive a holy symbol." He had a Talk-to option and nothing behind it, and until now' },
        { note: 'nothing in the quest asked anybody for the symbol either.' },
        { setpos: CARPENTER, why: 'east to the carpenter' },
        { talk: 'ics_little_carpenter', want: 'cut from willow', why: 'the holy symbol' },
        { has: 'ics_little_holy_symbol' },
        { hasnt: 'willow_logs' },

        { note: 'wiki steps 7-8: the Sphinx, and the riddle, whose answer is nine. Also silent until' },
        { note: 'now, and two tiles across.' },
        { setpos: SPHINX, why: 'north to the Sphinx' },
        { talk: 'ics_little_sphinx', picks: ['Can you help me with the burial?', 'Nine.'], want: 'Het, Apmeken', why: 'answer the riddle' },

        { note: 'wiki step 3: the temple door, which is Touch or Open, and drops into the tomb' },
        { setpos: [3294, 2781, 0], why: 'to the temple door' },
        { loc: 'icthalarins_temple_door', at: TEMPLE_DOOR, want: 'down into the tomb', why: 'into the tomb' },

        { note: 'wiki step 11-12: "Take the canopic jar. Kill the guardian that appears, then take' },
        { note: 'the jar." ics_little_possessedpriest is the level-91 npc the walkthrough means; he' },
        { note: 'had no stats and no placement, so this quest had no fight in it at all.' },
        { setpos: [3287, 9194, 0], why: 'north-east to the shelves' },
        { loc: 'ics_little_pot_liver_multi', at: JAR_LIVER, want: 'NOT YOURS', why: 'reach for a jar' },
        { fight: 'ics_little_possessedpriest', untilvar: 'ics_sarcophigi_gotstuffcounter', to: 1, tries: 6, r: 20, why: 'the guardian' },

        { note: 'and now all four come off the shelves: man, crocodile, bug and ape' },
        { loc: 'ics_little_pot_liver_multi', at: JAR_LIVER, want: 'off its shelf', why: 'the liver' },
        { loc: 'ics_little_pot_lungs_multi', at: JAR_LUNGS, want: 'off its shelf', why: 'the lungs' },
        { loc: 'ics_little_pot_stomach_multi', at: JAR_STOMACH, want: 'off its shelf', why: 'the stomach' },
        { loc: 'ics_little_pot_intestines_multi', at: JAR_INTESTINES, why: 'the intestines' },
        { stage: 19 },

        { note: 'wiki step 22-24: the ceremony, and what comes to it' },
        { setpos: [3305, 9197, 0], why: 'east past the pit to the ceremony' },
        { talk: 'ics_little_hipriest_ceremony', want: 'face down on the stone', why: 'the jars and the symbol go down' },
        { stage: 24 },
        { hasnt: 'ics_little_holy_symbol' },

        { note: 'and the god of the dead, who is waiting at the foot of the ladder' },
        { setpos: [3278, 9171, 0], why: 'back west to the ladder' },
        { talk: 'ics_little_ic', want: 'Klenter was owed his passage', why: 'Icthlarin' },
        { stage: 25 },

        { note: 'and the last word with the priest, who has watched the Devourer take the body' },
        { setpos: [3305, 9197, 0], why: 'back to the chamber' },
        { talk: 'ics_little_hipriest_ceremony', want: 'Say the name quietly', why: 'the reward' },
        { wait: 4, why: 'the completion is queued' },
        { stage: 26 },
        { has: 'ics_little_amulet_of_catspeak' }
    ]
};

const p: any = H.makePlayer('icsrun', m.start[0], m.start[1]);
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
