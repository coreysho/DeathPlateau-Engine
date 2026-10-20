// THE GIANT DWARF, played through on foot.
//
// Quest 40 of the quest-by-quest pass, and the way into Keldagrim. Hammerspike runs the cart; the
// Consortium will not hear an outsider, so one of the seven companies that wants the King Alvis
// commission makes you a temporary director; Blasidar wants a model built before he will touch the
// statue; and the Red Axe loses a plinth it has held for four hundred years.
//
//   npx tsx tools/sim/quest_giantdwarf_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const m: Manifest = {
    quest: 'THE GIANT DWARF',
    source: 'oldschool.runescape.wiki/w/The_Giant_Dwarf',
    stageVar: 'giantdwarf_quest',
    done: 60,   // ^gd_complete
    start: [2966, 9811, 0],
    steps: [
        { note: 'wiki step 1: Hammerspike Stoutbeard, in the tunnels between the dwarven mine and' },
        { note: 'the city. Keldagrim has no entrance loc at all - his cart IS the door.' },
        { talk: 'favour_hammerspike_stoutbeard', picks: ["What's down it?"], want: 'Keldagrim', why: 'he explains the city' },
        { stage: 5 },
        { talk: 'favour_hammerspike_stoutbeard', picks: ['Take me to Keldagrim'], want: 'goes down', why: 'and takes the cart down' },

        { note: 'wiki step 2: the trade floor referee, who explains why nobody will talk to you and' },
        { note: 'what to do about it' },
        { setpos: [2882, 10198, 1], why: 'up to the trade floor' },
        { note: 'one conversation covers both halves of it - the refusal and the way round it - so' },
        { note: 'the quest goes 5 to 15 in one go and never sits at 10' },
        { talk: 'dwarf_city_trader_referee', want: 'offer yourself to any of the seven', why: 'he names the way in' },
        { stage: 15 },

        { note: 'wiki step 3: any one of the seven companies will take you on as a temporary' },
        { note: 'director, because they all want the commission the Red Axe is holding' },
        { setpos: [2865, 10202, 1], why: 'along the floor to Blue Opal' },
        { talk: 'dwarf_city_director_blue_opal', want: 'director', why: 'sponsorship' },

        { note: 'wiki step 4: Blasidar the sculptor, who wants a model before he will argue about' },
        { note: 'a head with anybody' },
        { setpos: [2907, 10205, 0], why: 'east to the sculptor' },
        { talk: 'dwarf_city_shop_sculpture', want: 'Boots, torso and axe', why: 'the commission' },
        { stage: 20 },

        { note: 'wiki step 5: the model takes three pieces, in any order' },
        { setpos: [2904, 10206, 0], why: 'over to the frame' },
        { talk: 'dwarf_city_shop_sculpture_model_multi', picks: ['Add the boots'], want: 'fit the piece', why: 'the boots' },
        { talk: 'dwarf_city_shop_sculpture_model_multi', picks: ['Add the torso'], want: 'fit the piece', why: 'the torso' },
        { talk: 'dwarf_city_shop_sculpture_model_multi', picks: ['Add the axe'], want: 'fit the piece', why: 'and the axe' },
        { varis: 'giantdwarf_model_state', to: 7 },

        { note: 'wiki step 6: Blasidar takes the statue down and puts it back up with the right head' },
        { setpos: [2907, 10205, 0], why: 'back to Blasidar' },
        { note: 'and the same here: showing him the finished model and the statue coming down are' },
        { note: 'one conversation, so 20 goes straight to 40' },
        { talk: 'dwarf_city_shop_sculpture', want: 'Stand well back', why: 'show him the model; he starts work' },
        { stage: 40 },

        { note: 'wiki step 7: and the Red Axe director, who is the one who loses by it' },
        { setpos: [2874, 10187, 1], why: 'to the Red Axe office' },
        { talk: 'dwarf_city_director_red_axe_multi', want: 'Get out', why: 'he is expelled from the Consortium' },
        { stage: 50 },

        { note: 'wiki step 8: the Black Guard commander signs it off' },
        { setpos: [2827, 10213, 1], why: 'west to the Black Guard' },
        { talk: 'dwarf_city_black_guard_supreme_leader', why: 'report it' },
        { stage: 60 }
    ]
};

const p: any = H.makePlayer('giantdwarfrun', m.start[0], m.start[1]);
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
