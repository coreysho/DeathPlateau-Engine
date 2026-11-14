// THE KING BLACK DRAGON ATTACKS FROM WHERE IT IS, AND BITES WITH ITS OWN FACE.
// Usage: npx tsx tools/sim/kbd.ts   (exit code is the verdict)
//
// Two things were reported and they are unrelated to each other.
//
// It "only attacks when it is within melee range". ai_applayer2 breathed at a player it could not
// reach and then fell through into npc_setmode(opplayer2) - "go and interact" - so it breathed
// exactly once, walked into melee, and from then on only ever acted when it could reach you.
//
// And it bit with the wrong animation: ~dragon_melee played dragon_attack or dragon_head_attack
// whatever the dragon was. That pair was drawn for the 377 mesh; the KBD is Old School's art and
// carries osrs_seq_91, and the baby dragons carry bdrag_attack.
import fs from 'fs';
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import NpcType from '#/cache/config/NpcType.js';
import ParamType from '#/cache/config/ParamType.js';
import SeqType from '#/cache/config/SeqType.js';

await H.boot();

const nparam = (nm: string, k: string) => (NpcType.get(NpcType.getId(nm)) as unknown as { params?: Map<number, unknown> }).params?.get(ParamType.getId(k)) as number | undefined;
const seqName = (id?: number) => (typeof id === 'number' && id >= 0 ? (SeqType.get(id)?.debugname ?? `seq_${id}`) : '-');

console.log('== it bites with the animation its own config names');
{
    // The shared proc used to ignore this entirely.
    check('the KBD carries an Old School bite', seqName(nparam('king_dragon', 'attack_anim')), 'osrs_seq_91');
    const src = fs.readFileSync('../content/scripts/npc/scripts/dragon.rs2', 'utf8');
    check('~dragon_melee plays it', /npc_anim\(npc_param\(attack_anim\), 0\);/.test(src), true);
    // And the 377 pair is still a pair, for the mesh it was drawn for.
    check('  the 377 dragon keeps both of its bites', /npc_param\(attack_anim\) = dragon_attack/.test(src), true);
    check('  which is what every ordinary dragon carries', seqName(nparam('green_dragon', 'attack_anim')), 'dragon_attack');
    // The babies were wrong for the same reason and are fixed by the same line.
    check('  and a baby dragon bites like a baby', seqName(nparam('babydragon', 'attack_anim')), 'bdrag_attack');
}

console.log("\n== and in a real fight it uses its own bite, not the 377 dragon's");
{
    // The behavioural half. Everything above is the config and the script; this is the animation
    // that actually goes out over the wire during a fight.
    const MINE = SeqType.getId('osrs_seq_91');
    const OLD = [SeqType.getId('dragon_attack'), SeqType.getId('dragon_head_attack')];
    const p: any = player('kbdfight', 3069, 10254, 0);
    H.maxOut(p);
    H.equip(p, { rhand: 'abyssal_whip' });
    p.applyDamage = () => {
        p.levels[3] = 99;
    };
    const npc: any = H.npcNear('king_dragon', p.x, p.z, 0);
    check('the KBD is in its lair', npc !== null, true);
    if (npc) {
        p.teleport(npc.x + 5, npc.z, npc.level);
        H.tick(1);
        H.clearLogs();
        H.attackNpc(p, npc);
        // LONG ENOUGH THAT THE DICE DO NOT DECIDE IT. ~kbd_random_attack rolls random(3) and only
        // one of its three faces is the bite, and the dragon acts once every five ticks
        // (%npc_action_delay = add(map_clock, 5) on every branch), so a forty-tick fight was about
        // seven attacks - a one-in-seventeen chance of never rolling a melee at all and failing a
        // check about an animation the dragon simply never got round to playing. That is what went
        // red in the nightly on a content commit that touched nothing in this file: the dice moved,
        // the dragon did not. At fifty attacks a false failure is (2/3)^50, and the extra samples
        // make the "never the 377 dragon's" check below stronger rather than weaker. Ticks are
        // cheap - this is the same fight, watched for long enough to mean something.
        for (let t = 0; t < 250; t++) {
            H.tick(1);
            p.levels[3] = 99;
            if (npc.levels[3] < 150) npc.levels[3] = 240;
        }
        const played = H.npcAnims.filter(a => a.who === 'king_dragon').map(a => a.seq);
        check('it attacked at all', played.length > 0, true);
        check('  it bit with its own animation', played.includes(MINE), true);
        check(
            "  and never with the 377 dragon's",
            played.some(s2 => OLD.includes(s2)),
            false
        );
        // THE DRAGON STAYS LOCKED ON until its target leaves the world, and the next section times
        // how it treats a DIFFERENT player running away. Leaving this one logged in made the timer
        // below find the old target, measure the distance to wherever they were standing, and
        // correctly decline to breathe - which read as the fix not working at all.
        H.despawn(p);
    }
}

// BOTH TRIGGERS TEST WHETHER IT CAN REACH YOU. ai_applayer2 breathed at a player it could not
// reach and then fell through into opplayer2 - "go and interact" - so it breathed once, walked into
// melee and stayed in that mode; and opplayer2's three attacks are all close-quarters, so once it
// was there, anything that put you out of reach left it with no branch that attacks at all. The
// safespot the file's own comment describes is exactly that case.
//
// WHAT THESE TWO DO NOT COVER: a player who simply KEEPS MOVING. Neither trigger fires while the
// npc is walking after someone it has not reached, so no script branch gets a turn at all. That
// is the [ai_timer] in the two sections below, and the reason it exists.
console.log('\n== the far breath can run from either trigger');
{
    const src = fs.readFileSync('../content/scripts/areas/area_wilderness/scripts/king_black_dragon.rs2', 'utf8');
    check('both triggers test the reach', (src.match(/if \(npc_canreach = false\) \{/g) ?? []).length, 2);
    // Three calls now, not two: the timer below breathes through the same proc.
    check('  and both breathe when they cannot', (src.match(/~kbd_dragonfire_far;/g) ?? []).length >= 2, true);
    check('  the approach one stays where it is', /~kbd_dragonfire_far;[\s\S]{0,600}?\n {4}return;\n\}/.test(src), true);
    check('  and the interact one hands back', /npc_setmode\(applayer2\);/.test(src), true);
}

// ---------------------------------------------------------------------------------------------
// AND IT BREATHES AT SOMEBODY RUNNING AWAY. Neither ai_applayer2 nor ai_opplayer2 fires while the
// npc is walking after a player it has not reached, so a moving player used to be chased in
// silence. [ai_timer,king_dragon] gets a turn every tick whatever mode the chase has put it in.
//
// THE TIMER IS A CONFIG FIELD AND HAS TO BE. An npc_settimer in an [ai_spawn,king_dragon] is the
// obvious way to arm it and it does not work: Npc.resetDefaults writes timerInterval back to the
// TYPE's timer, and it runs the moment the dragon gives up on a target it cannot reach - a couple
// of ticks into the chase. Measured that way the timer fired twice in a sixty-tick kite and then
// went quiet, and the dragon landed nothing. Hence the first check here.
console.log('\n== the timer that lets it do that outlives a lost target');
{
    check('the dragon carries a tick timer on its type', NpcType.get(NpcType.getId('king_dragon')).timer, 1);
    // Comments stripped, because the explanation above the trigger names the shape being ruled out
    // and would satisfy the assertion by itself.
    const src = fs.readFileSync('../content/scripts/areas/area_wilderness/scripts/king_black_dragon.rs2', 'utf8').replace(/\/\/.*/g, '');
    check('  and the trigger that reads it exists', /\[ai_timer,king_dragon\]/.test(src), true);
    // The shape that does not survive resetDefaults. If this ever comes back, the kite below is the
    // only thing that would notice, and only by its hit count.
    check('  and is not armed from an ai_spawn instead', /\[ai_spawn,king_dragon\]/.test(src), false);
}

// Pinned eight tiles out every tick: always beyond melee, always inside the breath's 15-tile range.
// An earlier version of this stepped away only when the gap closed, which measured wherever the
// dragon happened to drift to rather than what it does at a fixed distance.
//
// Measured against Dagannoth Supreme, which never hands over to opplayer2 and so keeps its own
// trigger firing - the best this build does at range. Over the same sixty ticks: Supreme 17, the
// dragon 0 before the timer and 11 after. Twelve is the ceiling (a 5-tick attack cadence), so the
// dragon is now attacking at very nearly its full rate.
console.log('\n== and it breathes at a player who keeps running');
{
    const kite = (nm: string, who: string): number => {
        const p: any = player('kbdkite' + who, 2900, 4449, 0);
        H.maxOut(p);
        H.equip(p, { rhand: 'abyssal_whip' });
        let dmg = 0;
        p.applyDamage = () => {
            dmg++;
            p.levels[3] = 99;
        };
        const npc: any = H.npcNear(nm, p.x, p.z, 0);
        if (!npc) return -1;
        p.teleport(npc.x + 3, npc.z, npc.level);
        H.tick(1);
        H.attackNpc(p, npc);
        for (let t = 0; t < 20; t++) {
            H.tick(1);
            p.levels[3] = 99;
            if (npc.levels[3] < 200) npc.levels[3] = 240;
        }
        dmg = 0; // from here on, the player is out of reach
        for (let t = 0; t < 60; t++) {
            p.teleport(npc.x + 8, npc.z, npc.level);
            H.tick(1);
            p.levels[3] = 99;
            if (npc.levels[3] < 200) npc.levels[3] = 240;
        }
        H.despawn(p);
        return dmg;
    };
    const supreme = kite('dagcave_ranged_boss', 'Sup');
    const kbd = kite('king_dragon', 'Kbd');
    console.log(`kited for 60 ticks: Supreme landed ${supreme}, the KBD landed ${kbd}`);
    // 0 was the number before the timer existed, and 0 again with the timer armed from an ai_spawn.
    check('the KBD attacks a player it cannot reach', kbd > 0, true);
    check('  and keeps doing it rather than once', kbd > 4, true);
    // Supreme is the ceiling: a ranged npc that never stops attacking. The dragon should be in the
    // same order of magnitude rather than a tenth of it.
    check('  within reach of a proper ranged attacker', kbd * 2 > supreme, true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
