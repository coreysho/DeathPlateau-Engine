// THE ANIMATIONS THAT HIDE YOUR EQUIPMENT UNTIL SOMETHING LETS THEM GO.
// Usage: npx tsx tools/sim/heldanims.ts   (exit code is the verdict)
//
// Corey: "when casting god spells some of your equipment dissapear". The server never takes worn
// items off during a cast - a full set of rune and a god staff is byte-identical in the worn
// inventory before and after, and no inventory or appearance message is written - so whatever
// vanishes, vanishes on the client. Seq config is the only thing that can do that: replaceheldleft
// and replaceheldright swap the model in the player's hands for the length of the animation, and
// "hide" means show nothing at all.
//
// EVERY 377 CAST ANIMATION HIDES BOTH HANDS. human_caststrike, human_castwave, human_castzap (the
// three god spells' own) and the rest all carry replaceheldleft=hide replaceheldright=hide, and
// they last one to three ticks, so a staff and shield flicker out while the hands do the casting.
// That is the cache's own behaviour and god spells are no different from fire strike.
//
// WHAT IS NOT NORMAL is a hold-the-last-frame animation left running. Twenty-one animations in this
// cache end with a frame held for 20000 client ticks - 400 seconds - and hide both hands for all of
// it: the teleports, the deaths, human_shrink, human_unconscious, the agility arena handholds. They
// are meant to be ended by the script that started them. A teleport gets away with forgetting,
// because the long hop makes the client drop the player from the scene and re-add them; a flourish
// with no teleport behind it does not, and walking cannot end one. Three triggers were in that
// state, and the staff ritual in Lunar Diplomacy is the one to feel: enchant a staff at an altar
// and the staff in your hand is invisible for the next four hundred seconds.
import fs from 'fs';
import path from 'path';
import * as H from './harness.js';
import { check, R } from './a1lib.js';
import SeqType from '#/cache/config/SeqType.js';

await H.boot();

// Long enough that a player would see it and not think it a flicker.
const HOLD_TICKS = 20;
const held: string[] = [];
for (const [name, id] of SeqType.configNames) {
    const t = SeqType.get(id) as unknown as { replaceheldleft: number; replaceheldright: number; duration: number };
    if (t.replaceheldleft < 0 && t.replaceheldright < 0) continue;
    if (t.duration < HOLD_TICKS * 30) continue;
    held.push(name);
}

console.log('== the cast animations hide both hands, and always have');
{
    const dur = (n: string) => (SeqType.get(SeqType.getId(n)) as unknown as { duration: number }).duration;
    const hides = (n: string) => {
        const t = SeqType.get(SeqType.getId(n)) as unknown as { replaceheldleft: number; replaceheldright: number };
        return t.replaceheldleft === 0 && t.replaceheldright === 0;
    };
    // The god spells' animation, and an ordinary spell's, treated the same by the cache.
    check('human_castzap hides both hands', hides('human_castzap'), true);
    check('  and so does human_caststrike', hides('human_caststrike'), true);
    // ...and both are over in a couple of ticks, which is the difference that matters.
    check("  the god spells' animation is under 3 ticks", dur('human_castzap') < 90, true);
    check('  and no cast animation holds its last frame', Math.max(dur('human_castzap'), dur('human_caststrike'), dur('human_castwave'), dur('human_castcurse')) < HOLD_TICKS * 30, true);
}

console.log('\n== and the hold-the-last-frame ones are all accounted for');
{
    check('the cache has a family of them', held.length > 10, true);
    check('  human_castteleport is one', held.includes('human_castteleport'), true);
    check('  and so is human_death', held.includes('human_death'), true);

    // Every content trigger that starts one on the PLAYER. A trigger is clear if it calls anim(null)
    // itself, or hands the ending to one of the two procs that do it for their callers.
    const DELEGATES = ['p_telejump_safe', 'rcu_teleport_to_abyss'];
    const root = '../content';
    const files: string[] = [];
    const walk = (d: string) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const f = path.join(d, e.name);
            if (e.isDirectory()) {
                if (!f.includes('_unpack')) walk(f);
            } else if (e.name.endsWith('.rs2')) files.push(f);
        }
    };
    walk(root);
    const open: string[] = [];
    for (const f of files) {
        for (const block of fs.readFileSync(f, 'utf8').split(/\n(?=\[)/)) {
            // Comments stripped: the notes written above these fixes name the animations.
            const code = block
                .split('\n')
                .map(l => l.split('//')[0])
                .join('\n');
            const played = held.filter(n => new RegExp(`(?<!npc_)anim\\(${n}\\b`).test(code));
            if (!played.length) continue;
            if (/anim\(null/.test(code)) continue;
            if (DELEGATES.some(d => code.includes('~' + d) || code.includes('@' + d))) continue;
            open.push(`${f.replace('../content/', '')}: ${block.split(']')[0]}] plays ${played.join(', ')}`);
        }
    }
    for (const o of open) console.log('  left open: ' + o);
    // THREE REMAIN, and each is safe for a reason rather than by accident:
    //
    //   [proc,player_death]            human_death, and the respawn hop is far enough that the
    //                                  client drops the player from the scene and re-adds them.
    //   [label,ikov_winelda_teleport]  human_smokepuff_tele_disappear, replaced two ticks later by
    //                                  human_smokepuff_tele_appear at the same priority.
    //   [opnpc1,partyroom_barmaid]     partyroom_dance, 36 ticks and priority 5, so it ends on its
    //                                  own and any attack replaces it.
    //
    // Anything NEW in this list is a flourish nobody ended, and a player's weapon disappears for
    // four hundred seconds because of it.
    check('nothing else plays one and walks away', open.length, 3);
    const names = open.map(o => o.split(': ')[1].split(']')[0] + ']').sort();
    check('  and they are the three that are safe for a reason', names, ['[label,ikov_winelda_teleport]', '[opnpc1,partyroom_barmaid]', '[proc,player_death]']);
}

console.log('\n== the three that were left open are closed');
{
    // Comments stripped before matching: the notes written above each fix are longer than the gap
    // being measured, and they name the animation and anim(null) both.
    const src = (f: string) =>
        fs
            .readFileSync('../content/' + f, 'utf8')
            .split('\n')
            .map(l => l.split('//')[0])
            .join('\n');
    const lunar = src('scripts/quests/quest_lunar/scripts/lunar_island.rs2');
    // The staff ritual: no teleport at all behind the animation, so it was stuck for the full hold.
    check('the Lunar staff enchant lets its animation go', /anim\(human_castteleport, 0\);[\s\S]{0,400}?anim\(null, 0\);/.test(lunar), true);
    const malak = src('scripts/quests/quest_deserttreasure/scripts/dt_blood.rs2');
    check('  Malak lets go of the death pose', /anim\(human_death, 0\);[\s\S]{0,400}?anim\(null, 0\);/.test(malak), true);
    const seal = src('scripts/quests/quest_lunar/scripts/quest_lunar.rs2');
    check('  and the Moon Clan rejection lets go of the teleport', /p_telejump\(\^lunar_isle_rellekka_pier\);[\s\S]{0,400}?anim\(null, 0\);/.test(seal), true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
