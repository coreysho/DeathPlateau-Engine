// ONE SMALL FAVOUR, played through on foot.
//
// Quest 98 of the quest-by-quest pass. The tracker had this one down as having "no directory of
// that name" - it is quest_osf, not quest_onesmallfavour, which is why it kept being missed.
//
// It is this server's compressed reading of the quest rather than the twenty-npc chain OSRS has:
// three broken parts, three craftspeople, and one of them wants a favour of their own first - which
// is where the name comes from. Eight stages, four people, eight landing lights.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_osf_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

await H.boot();

// --- Seers' Village: the seer, his tower and the weathervane on the roof
const PHANTUWTI: [number, number, number] = [2705, 3475, 0];
const LADDER_G: [number, number] = [2699, 3476]; // loc_1750, L0 -> L1
const LADDER_1: [number, number] = [2699, 3476]; // laddermiddle, L1, op2 climbs to the roof
const LADDER_3: [number, number] = [2700, 3476]; // favour_seer_laddertop, L3 -> L1 (moved 24 Oct)
const VANE: [number, number] = [2702, 3476]; // osf_weathervane, L3

// --- the three craftspeople
const PRISON_DOOR: [number, number] = [3183, 9611]; // favour_prisondoor, the HAM hideout cell
const JIMMY: [number, number, number] = [3184, 9610, 0];
const TASSIE: [number, number, number] = [3084, 3409, 0];
const HAMMERSPIKE: [number, number, number] = [2965, 9812, 0];

// --- the gnome glider and its eight landing lights
const PILOT: [number, number, number] = [2544, 2974, 0];
const LIGHTS: [string, [number, number], string][] = [
    ['osf_multi_landinglight_sapphire_1', [2545, 2969], 'sapphire'],
    ['osf_multi_landinglight_sapphire_1', [2545, 2974], 'sapphire'],
    ['osf_multi_landinglight_opal_1', [2548, 2969], 'opal'],
    ['osf_multi_landinglight_opal_1', [2548, 2974], 'opal'],
    ['osf_multi_landinglight_redtopaz_1', [2551, 2969], 'red topaz'],
    ['osf_multi_landinglight_redtopaz_1', [2551, 2974], 'red topaz'],
    ['osf_multi_landinglight_jade_1', [2554, 2969], 'jade'],
    ['osf_multi_landinglight_jade_1', [2554, 2974], 'jade']
];

const m: Manifest = {
    quest: 'ONE SMALL FAVOUR',
    source: 'oldschool.runescape.wiki/w/One_Small_Favour/Quick_guide',
    stageVar: 'onesmallfavour',
    done: 70, // ^osf_complete
    start: PHANTUWTI,
    steps: [
        { note: 'items: ten soft clay (five for the ornament and five for the airtight pot), two' },
        { note: 'each of sapphire, opal, red topaz and jade for the eight landing lights, and a' },
        { note: 'lockpick for the H.A.M. cell Jimmy is in.' },
        { give: 'softclay', n: 10 },
        { give: 'sapphire', n: 2 },
        { give: 'opal', n: 2 },
        { give: 'red_topaz', n: 2 },
        { give: 'jade', n: 2 },
        { give: 'lockpick' },

        { note: "wiki step 1: Phantuwti Fanstuwi Farsight, in the Seers' Village tower" },
        { setpos: PHANTUWTI, why: 'to the seer' },
        { talk: 'favour_phantuwti_farsight', picks: ['Why not?'], want: 'one small favour', why: 'take the job' },
        { stage: 5 },
        { has: 'favour_animate_rock' },

        { note: 'wiki step 2: the vane is on the roof, three floors up, and the only way is the' },
        { note: 'ladder behind him and then the one above it' },
        { loc: 'loc_1750', at: LADDER_G, why: 'up to the first floor' },
        { level: 1 },
        { loc: 'laddermiddle', at: LADDER_1, op: 2, why: 'up to the weathervane platform' },
        { level: 3 },
        { loc: 'osf_weathervane', at: VANE, op: 1, want: 'three pieces', why: 'look at the wreck' },
        { loc: 'osf_weathervane', at: VANE, op: 5, want: 'Three pieces come away', why: 'take the pieces' },
        { stage: 10 },
        { has: 'favour_directionals_broken' },
        { has: 'favour_ornament_broken' },
        { has: 'favour_pillar_broken' },
        { loc: 'favour_seer_laddertop', at: LADDER_3, why: 'back down to the first floor' },
        { note: "the climb is a p_arrivedelay and then a telejump, so the floor has not changed" },
        { note: 'by the time the click returns' },
        { wait: 4, why: 'the climb down lands' },
        { level: 1 },

        { note: 'wiki step 3: Jimmy the Chisel does the rotating pillar - but only with the seer\'s' },
        { note: 'scroll, and only once you have picked your way into his cell' },
        { setpos: [PRISON_DOOR[0] + 2, PRISON_DOOR[1], 0], why: 'to the H.A.M. hideout cell' },
        { loc: 'favour_prisondoor', at: PRISON_DOOR, op: 5, tries: 8, soft: true, why: 'pick the lock' },
        { setpos: JIMMY, why: 'to Jimmy' },
        { talk: 'favour_jimmy', want: 'It turns', why: 'the pillar' },
        { stage: 20 },
        { has: 'favour_pillar_fixed' },
        { hasnt: 'favour_animate_rock' },

        { note: 'wiki step 4: Tassie Slipcast does the ornament for five soft clay' },
        { setpos: TASSIE, why: 'to the potter' },
        { talk: 'favour_tassie_slipcast', want: 'Better than it was', why: 'the ornament' },
        { stage: 30 },
        { has: 'favour_ornament_fixed' },
        { note: 'and she is the only person who can make the pot the dwarf wants - the favour' },
        { note: 'inside the favour, and five more clay' },
        { talk: 'favour_tassie_slipcast', want: 'Sealed', why: 'the airtight pot' },
        { has: 'favour_airtight_pot' },
        { hasnt: 'softclay' },

        { note: 'wiki step 5: Hammerspike Stoutbeard does the directionals, for the sealed pot' },
        { setpos: HAMMERSPIKE, why: 'to Hammerspike' },
        { talk: 'favour_hammerspike_stoutbeard', want: 'North is north again', why: 'the directionals' },
        { stage: 40 },
        { has: 'favour_directionals_fixed' },
        { hasnt: 'favour_airtight_pot' },

        { note: 'wiki step 6: all three back on the roof at once - weathervanefixed is one bit and' },
        { note: 'there is no half-mended state for it to show' },
        { setpos: PHANTUWTI, why: 'back to the tower' },
        { loc: 'loc_1750', at: LADDER_G, why: 'up' },
        { loc: 'laddermiddle', at: LADDER_1, op: 2, why: 'and up' },
        { loc: 'osf_weathervane', at: VANE, op: 5, want: 'catches the wind', why: 'rebuild the vane' },
        { stage: 50 },
        { varis: 'weathervanefixed', to: 1 },
        { loc: 'favour_seer_laddertop', at: LADDER_3, why: 'back down' },

        { note: 'wiki step 7: the seer can forecast again, and writes a report' },
        { setpos: PHANTUWTI, why: 'to the seer' },
        { talk: 'favour_phantuwti_farsight', want: 'first accurate forecast', why: 'take the report' },
        { stage: 60 },
        { has: 'favour_weather_report' },

        { note: "wiki step 8: the gnome glider's landing lights in the Feldip Hills. Eight sockets," },
        { note: 'four colours, two of each - and all eight key one rendering bit, so nothing comes' },
        { note: 'on until the last gem is in.' },
        ...(LIGHTS.flatMap(([name, at, colour], i) => [
            { setpos: [at[0], at[1] + (at[1] > 2971 ? 1 : -1), 0], why: 'to the ' + colour + ' light at ' + at[0] + ',' + at[1] },
            {
                loc: name,
                at,
                op: 5,
                want: i === 7 ? 'whole strip comes up at once' : 'seat the gem',
                why: 'seat a ' + colour
            }
        ]) as Step[]),
        { varis: 'all_lights_fixed', to: 1 },
        { varis: 'checklandinglights', to: 255 },

        { note: 'wiki step 9: the pilot takes the report and flies again' },
        { setpos: PILOT, why: 'to Gnormadium Avlafrim' },
        { talk: 'gnormadium_avlafrim', want: 'reads it twice', why: 'hand over the report' },
        { stage: 70 },
        { hasnt: 'favour_weather_report' }
    ]
};

const p: any = H.makePlayer('osfrun', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
p.applyDamage = function () {};
H.setVar(p, 'macro_event', 1);
H.maxOut(p);
H.equip(p, { rhand: 'dragon_scimitar', torso: 'rune_platebody', legs: 'rune_platelegs', hat: 'rune_full_helm' });
H.tick(1);

const res = play(m, p);
const bad = res.filter(r => !r.ok);
console.log('');
if (bad.length) {
    console.log('WHAT WENT WRONG');
    for (const r of bad) console.log('  step ' + r.n + '  ' + r.what + (r.detail ? '  -- ' + r.detail : ''));
}
process.exit(bad.length ? 1 : 0);
