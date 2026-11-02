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
        for (let t = 0; t < 40; t++) {
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
    }
}

// BOTH TRIGGERS TEST WHETHER IT CAN REACH YOU. ai_applayer2 breathed at a player it could not
// reach and then fell through into opplayer2 - "go and interact" - so it breathed once, walked into
// melee and stayed in that mode; and opplayer2's three attacks are all close-quarters, so once it
// was there, anything that put you out of reach left it with no branch that attacks at all. The
// safespot the file's own comment describes is exactly that case.
//
// WHAT THIS DOES NOT COVER, and it is worth writing down rather than discovering twice: a player
// who simply RUNS stays un-attacked. Neither trigger fires while the npc is walking after someone
// it has not reached, so no script branch gets a turn. That is a question about npc modes rather
// than about this file, and it is not fixed here.
console.log('\n== the far breath can run from either trigger');
{
    const src = fs.readFileSync('../content/scripts/areas/area_wilderness/scripts/king_black_dragon.rs2', 'utf8');
    check('both triggers test the reach', (src.match(/if \(npc_canreach = false\) \{/g) ?? []).length, 2);
    check('  and both breathe when they cannot', (src.match(/~kbd_dragonfire_far;/g) ?? []).length >= 2, true);
    check('  the approach one stays where it is', /~kbd_dragonfire_far;[\s\S]{0,600}?\n {4}return;\n\}/.test(src), true);
    check('  and the interact one hands back', /npc_setmode\(applayer2\);/.test(src), true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
