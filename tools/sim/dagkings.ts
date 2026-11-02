// THE DAGANNOTH KINGS' ATTACKS SURVIVE BEING HIT, AND THROW THEIR OWN PROJECTILES.
// Usage: npx tsx tools/sim/dagkings.ts   (exit code is the verdict)
//
// Prime was reported as "shows the magic attack animation when it first attacks you, then it does a
// ranging attack animation". It was its own BLOCK, every time. Client.java replaces a running
// animation whenever the new one's priority is >= the current one's, a king is sent its block the
// tick after it swings, and all six dagannoth sequences sat on the cache default of 5 - so the only
// attack ever seen in full was the first one, thrown before the player had landed a hit.
//
// That is invisible to every server-side assertion: the server sends the right animation every time,
// and this file's first run proved exactly that while the bug was live. So what is asserted here is
// the PRIORITY RELATION the client arbitrates on, against the convention the rest of the cache
// already follows.
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import NpcType from '#/cache/config/NpcType.js';
import ParamType from '#/cache/config/ParamType.js';
import SeqType from '#/cache/config/SeqType.js';
import SpotanimType from '#/cache/config/SpotanimType.js';

await H.boot();

const nparam = (nm: string, key: string): unknown => (NpcType.get(NpcType.getId(nm)) as unknown as { params?: Map<number, unknown> }).params?.get(ParamType.getId(key));
const pri = (nm: string) => (SeqType.get(SeqType.getId(nm)) as unknown as { priority: number }).priority;
const spotName = (v: unknown) => (typeof v === 'number' && v >= 0 ? (SpotanimType.get(v)?.debugname ?? `spot_${v}`) : String(v));

const KINGS: [string, string, string][] = [
    ['dagcave_melee_boss', 'Rex', 'dagannoth_meganoth_attack_melee'],
    ['dagcave_magic_boss', 'Prime', 'dagannoth_meganoth_attack_mage'],
    ['dagcave_ranged_boss', 'Supreme', 'dagannoth_meganoth_attack_range']
];

console.log('== an attack outranks the block that lands on top of it');
{
    const block = pri('dagannoth_meganoth_defend');
    check('the block is the usual 5', block, 5);
    for (const [, who, anim] of KINGS) {
        check(`${who}'s attack outranks it`, pri(anim) > block, true);
    }
}

console.log("\n== and that is the cache's own convention, not a number picked here");
{
    // Every npc in the build that has both. The client arbitrates on exactly this relation, so the
    // sweep is the evidence that 6-over-5 is the house rule and the kings were the exception.
    let cut = 0;
    let safe = 0;
    for (let i = 0; i < NpcType.count; i++) {
        const t = NpcType.get(i);
        if (!t) continue;
        const p = (k: string) => (t as unknown as { params?: Map<number, unknown> }).params?.get(ParamType.getId(k)) as number | undefined;
        const atk = p('attack_anim') ?? p('magicattack_anim') ?? p('rangeattack_anim');
        const def = p('defend_anim');
        if (atk === undefined || def === undefined || atk < 0 || def < 0) continue;
        const a = (SeqType.get(atk) as unknown as { priority: number })?.priority;
        const d = (SeqType.get(def) as unknown as { priority: number })?.priority;
        if (a === undefined || d === undefined) continue;
        if (d >= a) cut++;
        else safe++;
    }
    console.log(`of the npcs with both: ${safe} let the attack play, ${cut} let the block cut it`);
    check('the overwhelming majority let the attack play', safe > cut * 3, true);
    // Named rather than counted: these three must be on the right side of it.
    for (const [nm, who] of KINGS.map(k => [k[0], k[1]])) {
        const t = NpcType.get(NpcType.getId(nm));
        const p = (k: string) => (t as unknown as { params?: Map<number, unknown> }).params?.get(ParamType.getId(k)) as number | undefined;
        const atk = p('attack_anim') ?? p('magicattack_anim')!;
        check(`  ${who} is among them`, (SeqType.get(atk) as any).priority > 5, true);
    }
}

console.log('\n== Supreme throws a dagannoth spine, not the common mob arrow');
{
    check('its projectile', spotName(nparam('dagcave_ranged_boss', 'proj_travel')), 'dagannoth_spine_spotanim_travel');
    // The arrow is the rank and file's: Horror from the Deep's dagannoths and the lighthouse ones
    // all throw it, so a king doing the same is what "supreme has a coloured arrow" meant.
    const commoners = ['dungeon_dagganoth_lighter_deeper'];
    for (const nm of commoners) {
        if (NpcType.getId(nm) === -1) continue;
        check(`  and ${nm} still has the arrow`, spotName(nparam(nm, 'proj_travel')), 'dagannoth_arrow_spotanim_travel');
    }
}

console.log("\n== and each king swings with its own animation, not another one's");
{
    for (const [nm, who, anim] of KINGS) {
        const p: any = player('dk' + who, 2900, 4449, 0);
        H.maxOut(p);
        const npc = H.npcNear(nm, p.x, p.z, 0);
        if (!npc) {
            check(`${who} is in the cave`, false, true);
            continue;
        }
        // ONE SWING IS WHAT THIS ASKS FOR, deliberately. All three kings share a room and together
        // out-damage a 99 in a single tick - fifty from Prime alone - so the player dies partway
        // through and respawns in Lumbridge, and how many swings fit before that is luck. An
        // earlier version asked for two and failed one run in four, which teaches people to re-run
        // a test rather than read it. What the fight is here to prove is WHICH animation goes out,
        // and one swing proves that; that it keeps going out on every swing afterwards is the
        // priority relation above, which is arithmetic and does not need a fight at all.
        H.clearLogs();
        H.attackNpc(p, npc);
        for (let t = 0; t < 60; t++) {
            H.tick(1);
            if (p.levels[3] < 50) p.levels[3] = 99;
            if (npc.levels[3] < 100) npc.levels[3] = 255;
        }
        const swings = H.npcAnims.filter(a => a.who === nm && a.seq === SeqType.getId(anim)).length;
        check(`${who} swings with its own animation`, swings > 0, true);
        const foreign = [...new Set(H.npcAnims.filter(a => a.who === nm).map(a => a.seq))].filter(s => s !== SeqType.getId(anim) && s !== SeqType.getId('dagannoth_meganoth_defend')).map(s => SeqType.get(s)?.debugname ?? s);
        check('  and plays nothing but that and its block', foreign, []);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
