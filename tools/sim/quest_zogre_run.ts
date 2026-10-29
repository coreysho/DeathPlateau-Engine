// ZOGRE FLESH EATERS, played through on foot.
//
// Quest 78 of the quest-by-quest pass. The ogres of Jiggig bury their dead and their dead have
// stopped staying buried, because a portrait painter in Yanille sold the way into their burial
// tomb to somebody who went in and took a helm off a stand. The middle act is a police case: three
// things out of Sithik's own bedroom, a drawing of him an innkeeper will swear to, and a potion in
// his tea.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_zogre_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const GRISH: [number, number, number] = [2446, 3048, 0];
const GUARD: [number, number] = [2454, 3047];
const BARRICADE: [number, number] = [2456, 3048];
const JIGGIG_STAIRS: [number, number] = [2485, 3042];
const SKELETON: [number, number] = [2442, 9459];
const LECTURN: [number, number] = [2443, 9459];
const PRISM_COFFIN: [number, number] = [2438, 9458];
const BARTENDER: [number, number, number] = [2556, 3080, 0];
const GUEST_LADDER: [number, number] = [2597, 3107];
const SITHIK_BED: [number, number] = [2591, 3103];
const DRAWERS: [number, number] = [2593, 3103];
const CUPBOARD: [number, number] = [2593, 3104];
const WARDROBE: [number, number] = [2590, 3103];
const TEA: [number, number] = [2592, 3103];
const BELL: [number, number] = [2598, 3085];
const RARVE: [number, number, number] = [2599, 3088, 0]; // beside the one the bell summons, at 2599,3087
const DOOR1: [number, number] = [2442, 9433]; // L2, the first set of ogre stone doors
const DOOR2: [number, number] = [2441, 9426]; // L2, the second set
const CHAMBER_STAIRS: [number, number] = [2443, 9417]; // L2, down into the ceremonial chamber
const STAND: [number, number] = [2483, 9445];

const m: Manifest = {
    quest: 'ZOGRE FLESH EATERS',
    source: 'oldschool.runescape.wiki/w/Zogre_Flesh_Eaters',
    stageVar: 'zogre',
    done: 16, // ^zogre_complete
    start: GRISH,
    steps: [
        { note: 'requirements: Big Chompy Bird Hunting, Jungle Potion, 4 Smithing, 8 Herblore,' },
        { note: '30 Ranged, and a level 111 undead ogre. Items: a knife for the coffin.' },

        { note: 'wiki step 1: Grish, the shaman at Jiggig' },
        { talk: 'zogre_ogre_shaman', picks: ["What's happening here?"], want: 'let you past barricade', why: 'the dead are up' },
        { stage: 2 },

        { note: 'wiki step 2: the guard east of him brings the barricade down' },
        { go: [GUARD[0] - 1, GUARD[1]], exact: true, r: 24, why: 'east to the ogre guard' },
        { talk: 'zogre_ogre_guard', want: 'comes down', why: 'Grish says so' },
        { varis: 'thzfe_blocking_barricade', to: 1 },
        { go: [BARRICADE[0] - 1, BARRICADE[1]], exact: true, r: 24, why: 'to the barricade' },
        { loc: 'zogre_multi_blocking_barricade_l', at: BARRICADE, hop: true, soft: true, why: 'climb over what is left' },

        { note: 'the stairs in the middle of Jiggig are the other way into the tomb - no key needed' },
        { go: [JIGGIG_STAIRS[0], JIGGIG_STAIRS[1] - 1], exact: true, r: 60, why: 'east to the stairs' },
        { loc: 'ogre_stairs_down', at: JIGGIG_STAIRS, hop: true, soft: true, why: 'down into the burial tomb' },
        { stage: 4 },

        { note: 'wiki step 3: Brentle Vahn never got out, and his tankard puts him in the Dragon Inn' },
        { go: [SKELETON[0], SKELETON[1] - 1], exact: true, r: 96, why: 'to the skeleton by the broken lectern' },
        { loc: 'zogre_brentle_skeleton', at: SKELETON, want: 'B.Vahn', why: 'search him' },
        { has: 'zogre_brentle_vahn_backpack' },
        { has: 'zogre_dragon_tankard' },
        { loc: 'zogre_lecturn', at: LECTURN, want: 'half a page', why: 'and the lectern' },
        { has: 'zogre_necromantic_page' },
        { go: [PRISM_COFFIN[0], PRISM_COFFIN[1] - 1], exact: true, r: 24, why: 'to the grand coffin' },
        { loc: 'zogre_coffin_special_entity', at: PRISM_COFFIN, want: 'prism', why: 'open it' },
        { has: 'zogre_black_prism' },
        { stage: 6 },

        { note: 'wiki step 4: the innkeeper knows the tankard' },
        { setpos: BARTENDER, why: 'to the Dragon Inn in Yanille' },
        { useNpc: 'dragon_bartender', obj: 'zogre_dragon_tankard', want: 'one of mine', why: 'show him the tankard' },
        { varis: 'thzfe_innkeepermugshown', to: 1 },

        { note: 'wiki step 5: Sithik is in bed in the guest house, and his room is full of evidence' },
        { setpos: [GUEST_LADDER[0], GUEST_LADDER[1] - 1, 0], why: 'to the guest house ladder' },
        { loc: 'ladder', at: GUEST_LADDER, hop: true, soft: true, why: 'upstairs' },
        { setpos: [SITHIK_BED[0] + 1, SITHIK_BED[1], 1], why: 'into his room' },
        { loc: 'sithiks_drawers', at: DRAWERS, want: 'charcoal', why: 'search the drawers' },
        { has: 'papyrus' },
        { has: 'charcoal' },
        { loc: 'sithiks_cupboard', at: CUPBOARD, want: 'necromantic', why: 'and the cupboard' },
        { has: 'zogre_necrobook' },
        { has: 'zogre_portrait_book' },
        { loc: 'sithiks_wardrobe', at: WARDROBE, want: 'Humans Against Monsters', why: 'and behind the coats' },
        { has: 'zogre_hambook' },

        { note: 'both books, to his face. He denies both, which is what Rarve wants.' },
        { useLoc: 'zogre_sithik_bed_entity', at: SITHIK_BED, obj: 'zogre_necrobook', want: 'not mine', why: 'the necromancy book' },
        { varis: 'thzfe_shownnecrobook', to: 1 },
        { useLoc: 'zogre_sithik_bed_entity', at: SITHIK_BED, obj: 'zogre_hambook', want: 'read what he likes', why: 'and the H.A.M. book' },
        { varis: 'thzfe_shownhambook', to: 1 },

        { note: 'the drawing. The odds climb with Crafting and never reach certain, so the roll is' },
        { note: 'pinned for the one attempt.' },
        { rng: 0, why: 'random(100) < 20 + Crafting' },
        { useLoc: 'zogre_sithik_bed_entity', at: SITHIK_BED, obj: 'papyrus', want: 'classic realist', why: 'draw him' },
        { rng: null },
        { has: 'zogre_sithik_portrait_good' },
        {
            useLoc: 'zogre_sithik_bed_entity',
            at: SITHIK_BED,
            obj: 'zogre_sithik_portrait_good',
            picks: ["It's honest."],
            want: 'honest',
            why: 'and show it to him'
        },

        { note: 'the innkeeper signs it, which in Yanille is a sworn statement' },
        { setpos: BARTENDER, why: 'back to the Dragon Inn' },
        { useNpc: 'dragon_bartender', obj: 'zogre_sithik_portrait_good', want: 'will say so to anybody', why: 'have it signed' },
        { has: 'zogre_sithik_portrait_signed' },

        { note: 'wiki step 6: Rarve wants the whole case, not a hunch. The bell brings him out of' },
        { note: 'the guild, because the guild door wants 66 Magic and this quest does not.' },
        { setpos: [BELL[0], BELL[1] - 1, 0], why: 'to the Wizards’ Guild bell' },
        { loc: 'zogre_outdoor_bell', at: BELL, want: 'comes out of the guild', why: 'ring it' },
        { note: 'there are two Rarves once the bell has rung - the static one inside the guild and' },
        { note: 'the one it summons to the door - so stand beside the summoned one.' },
        { setpos: RARVE, why: 'beside the Rarve at the door' },
        { talk: 'zogre_human_zavistic_rarve', want: 'Sithik Ints', why: 'the prism and the dead man' },
        { talk: 'zogre_human_zavistic_rarve', want: 'strange potion', why: 'and then the four things' },
        { stage: 8 },
        { has: 'zogre_ogre_trans_potion' },

        { note: 'wiki step 6 cont: he will not drink anything you hand him, but there is a cup of' },
        { note: 'cold tea on his drawers.' },
        { setpos: [SITHIK_BED[0] + 1, SITHIK_BED[1], 1], why: 'back to his room' },
        { useObj: 'zogre_cup_of_tea_sithix', at: TEA, obj: 'zogre_ogre_trans_potion', want: 'into the cup', why: 'drug the tea' },
        { stage: 9 },
        { wait: 110, why: 'he drinks it while you are not watching - a minute of game time' },
        { varis: 'thzfe_sithik_transformed', to: 1 },

        { note: 'and then he talks' },
        { loc: 'zogre_sithik_bed_entity', at: SITHIK_BED, want: 'Slash Bash', why: 'the confession' },
        { stage: 10 },
        { varis: 'thzfe_makebrutalarrow', to: 1 },
        { varis: 'thzfe_makecuredisease', to: 1 },

        { note: 'wiki step 7: Grish has had the gate key for three generations' },
        { setpos: GRISH, why: 'back to Grish' },
        { talk: 'zogre_ogre_shaman', want: 'Ceremonial chamber', why: 'tell him who did it' },
        { has: 'zogre_tomb_artefact_key' },

        { note: 'wiki step 11: down into the tomb again, then the chamber under it. The barricade' },
        { note: 'collision comes from the placed shell and never changes with the varbit, so it has' },
        { note: 'to be climbed every trip - the collapsed look is a look, not an open gate.' },
        { go: [BARRICADE[0] - 1, BARRICADE[1]], exact: true, r: 24, why: 'to the barricade' },
        { loc: 'zogre_multi_blocking_barricade_l', at: BARRICADE, hop: true, soft: true, why: 'over it again' },
        { go: [JIGGIG_STAIRS[0], JIGGIG_STAIRS[1] - 1], exact: true, r: 96, why: 'to the Jiggig stairs' },
        { loc: 'ogre_stairs_down', at: JIGGIG_STAIRS, hop: true, soft: true, why: 'into the tomb' },
        { note: 'west to two sets of ogre stone doors, through both, and down the stairs. Those are' },
        { note: 'three separate pockets on plane 2 - 2077, 44 and 123 tiles - and the doors are the' },
        { note: 'only joins.' },
        { go: [DOOR1[0], DOOR1[1]], exact: true, r: 96, why: 'to the first set of doors' },
        { loc: 'ogre_cavedoorl', at: DOOR1, hop: true, soft: true, why: 'through' },
        { go: [DOOR2[0], DOOR2[1]], exact: true, r: 24, why: 'to the second set' },
        { loc: 'ogre_cavedoorl', at: DOOR2, hop: true, soft: true, why: 'and through that' },
        { go: [CHAMBER_STAIRS[0] - 1, CHAMBER_STAIRS[1]], exact: true, r: 96, why: 'to the stairs down' },
        { loc: 'ogre_stairs_down', at: CHAMBER_STAIRS, hop: true, soft: true, why: 'and down into the chamber' },

        { note: 'Slash Bash is spawned by that click, beside the stand at the far end' },
        { go: [STAND[0] - 1, STAND[1]], exact: true, r: 96, why: 'follow the chamber to the end' },
        { loc: 'zogre_stand', at: STAND, want: 'empty stand', why: 'search the stand' },
        { fight: 'zogre_slash_bash', until: 'zogre_artifacts', tries: 4, r: 16, why: 'and the thing that was sitting on it' },
        { stage: 14 },
        { take: 'zogre_artifacts', r: 8, why: 'the ogre artefact' },
        { has: 'zogre_artifacts' },

        { note: 'and back to Grish' },
        { setpos: GRISH, why: 'to Grish' },
        { talk: 'zogre_ogre_shaman', want: 'ogre way of arrows', why: 'hand it over' },
        { stage: 16 },
        { varis: 'thzfe_makecompozogrebow', to: 1 }
    ]
};

const p: any = H.makePlayer('zogrerun', m.start[0], m.start[1]);
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
