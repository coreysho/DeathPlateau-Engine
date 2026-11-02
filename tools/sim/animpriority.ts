// A MONSTER'S ATTACK OUTRANKS THE BLOCK THAT LANDS ON TOP OF IT.
// Usage: npx tsx tools/sim/animpriority.ts   (exit code is the verdict)
//
// This is a rule about the CLIENT, not the cache. Client.java replaces a running animation whenever
// the new one's priority is >= the current one's, and a monster is sent its block the tick AFTER it
// swings. So at equal priority the block cuts every attack short and plays over it, and the only
// attack a player ever sees in full is the first one - thrown before they had landed a hit and
// started the blocks coming. Reported as Dagannoth Prime "showing its magic attack once, then a
// ranged attack"; it was its own block, every time.
//
// Nothing server-side can see that. The server sends the right animation every swing and is right
// to; the defect lives entirely in two numbers and the client's comparison of them. So the rule is
// asserted here as arithmetic over the whole build, which is the only place it can be checked.
import * as H from './harness.js';
import { check, R } from './a1lib.js';
import NpcType from '#/cache/config/NpcType.js';
import ParamType from '#/cache/config/ParamType.js';
import SeqType from '#/cache/config/SeqType.js';

await H.boot();

// The three where one animation is honestly doing two jobs, so the tie cannot be broken by moving
// one number. Named rather than counted: a fourth must not be able to appear quietly.
const ALLOWED_TIES = new Set([
    'pheasent_ready', // the pheasants' attack AND their block - raising it raises both sides
    '100_jubbly_ogre_kick', // Rantz's attack AND his idle
    'abyssal_attack' // its block is abyssal_demon_teleport, a signature animation its own scripts
    // drive - lowering that would let an attack cut the teleport
]);

const param = (t: NpcType, k: string) => (t as unknown as { params?: Map<number, unknown> }).params?.get(ParamType.getId(k)) as number | undefined;
const pri = (id: number) => (SeqType.get(id) as unknown as { priority: number } | null)?.priority;
const name = (id: number) => SeqType.get(id)?.debugname ?? `seq_${id}`;

console.log('== every fighting npc, and whether its block can cut its attack');
{
    const offenders: string[] = [];
    let checked = 0;
    let safe = 0;
    for (let i = 0; i < NpcType.count; i++) {
        const t = NpcType.get(i);
        if (!t) continue;
        const atks = ['attack_anim', 'magicattack_anim', 'rangeattack_anim'].map(k => param(t, k)).filter((v): v is number => typeof v === 'number' && v >= 0);
        const def = param(t, 'defend_anim');
        if (!atks.length || typeof def !== 'number' || def < 0) continue;
        const d = pri(def);
        if (d === undefined) continue;
        for (const a of atks) {
            const p = pri(a);
            if (p === undefined) continue;
            checked++;
            if (d >= p) {
                if (!ALLOWED_TIES.has(name(a))) offenders.push(`${t.debugname}: ${name(a)}=${p} vs ${name(def)}=${d}`);
            } else {
                safe++;
            }
        }
    }
    console.log(`${checked} attack/block pairs; ${safe} let the attack play`);
    check('nothing outside the three known ties is cut', offenders, []);
}

console.log('\n== and the three known ties are still only three');
{
    // The other direction: a name left in the list above that no longer ties is a name nobody needs
    // to read any more, and leaving it there is how an exception list rots into a wishlist.
    const stillTied = new Set<string>();
    for (let i = 0; i < NpcType.count; i++) {
        const t = NpcType.get(i);
        if (!t) continue;
        const atks = ['attack_anim', 'magicattack_anim', 'rangeattack_anim'].map(k => param(t, k)).filter((v): v is number => typeof v === 'number' && v >= 0);
        const def = param(t, 'defend_anim');
        if (typeof def !== 'number' || def < 0) continue;
        for (const a of atks) {
            const p = pri(a);
            const d = pri(def);
            if (p !== undefined && d !== undefined && d >= p) stillTied.add(name(a));
        }
    }
    check(
        'the exception list has nothing stale in it',
        [...ALLOWED_TIES].filter(n => !stillTied.has(n)),
        []
    );
}

console.log('\n== the convention itself, so a future import follows it');
{
    const counts = new Map<number, number>();
    for (let i = 0; i < NpcType.count; i++) {
        const t = NpcType.get(i);
        if (!t) continue;
        const a = param(t, 'attack_anim') ?? param(t, 'magicattack_anim') ?? param(t, 'rangeattack_anim');
        if (typeof a !== 'number' || a < 0) continue;
        const p = pri(a);
        if (p !== undefined) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    const top = [...counts].sort((x, y) => y[1] - x[1])[0];
    console.log(
        'attack priorities in use:',
        [...counts]
            .sort((x, y) => x[0] - y[0])
            .map(([k, v]) => `${k}:${v}`)
            .join(' ')
    );
    check('6 is what an attack animation carries here', top[0], 6);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
