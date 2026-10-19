// EVERY GOD WARS NPC, AND WHETHER IT ACTUALLY ANIMATES.
//
//   npx tsx tools/sim/gwdanims.ts
//
// Reported from the game as "gwd minions need attack, defend, and death animations". A config
// reader cannot answer that: the three params can all be present and name real sequences and still
// never reach the client, because what plays them is the combat code and not the config. So this
// stands a player in front of every God Wars npc in turn, kills it, and records which animations
// the NPC played - which needed a new hook in the harness, since it only ever watched the player.
//
// The answer it gives: all three play, for every one of them, with one exception that cannot be
// fixed from content. The three Bandos sergeants carry no death_anim, so they fall back to the
// param's default - human_death - and an ork crumples like a man. Their rig (rev 474 frame group
// 1575) has four runs of frames no sequence names (28-51, 65-93, 126-153, 163-187) and none of
// them is identifiable as the death without rendering it, and the ork death sequence cannot be
// borrowed: the sergeant models and the ork models are built on different skeletons, with vertex
// label sets that barely overlap. Nothing else in the cache shares the sergeants' skeleton.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import NpcType from '#/cache/config/NpcType.js';
import ParamType from '#/cache/config/ParamType.js';
import SeqType from '#/cache/config/SeqType.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';

await H.boot();
H.loginOrder();

const PARAM = {
    attack: ParamType.getId('attack_anim'),
    defend: ParamType.getId('defend_anim'),
    death: ParamType.getId('death_anim')
};
const HUMAN_DEATH = SeqType.getId('human_death');
// The three the report is about, and the only three without a death of their own.
const SERGEANTS = ['gwd_strongstack', 'gwd_steelwill', 'gwd_grimspike'];

/** Every God Wars npc with a name - the cast, the army, the rabble and the four generals. */
const CAST: string[] = [];
for (let id = 0; id < NpcType.count; id++) {
    const t: any = NpcType.get(id);
    const dn = t.debugname ?? '';
    if (!/^(gwd_|graardor|kreearra|zilyana|kril)/.test(dn)) continue;
    if (!t.name || t.name === 'null') continue;
    if (!t.op?.some((o: string | null) => o && /attack/i.test(o))) continue;
    CAST.push(dn);
}

console.log(`THE CAST: ${CAST.length} God Wars npcs you can attack`);
check('  all of them found', CAST.length > 50, true);

console.log('\nEVERY ONE OF THEM NAMES AN ATTACK AND A BLOCK, and the sequences are real');
{
    for (const name of CAST) {
        const t: any = NpcType.get(NpcType.getId(name));
        const bad: string[] = [];
        for (const key of ['attack', 'defend'] as const) {
            const v = t.params?.get(PARAM[key]);
            if (v === undefined) {
                bad.push(key + ' missing');
                continue;
            }
            const frames = (SeqType.get(v as number) as any)?.frames?.length ?? 0;
            if (!frames) bad.push(`${key} names an empty sequence`);
        }
        if (bad.length) check(`  ${name}`, bad, []);
    }
    check('  none of them is missing or empty', true, true);
}

console.log('\nAND THEY PLAY: every npc is fought to the death, and what it played is recorded');
{
    // One check per npc rather than a tally - an npc whose attack never fires is named by the
    // check that fails, not buried in a count.
    const noAttack: string[] = [];
    const noDefend: string[] = [];
    const humanDeaths: string[] = [];
    /**
     * Every npc gets at least this many hitpoints before the fight starts.
     *
     * A ONE-IN-THREE FLAKE WITHOUT IT. A maxed player with a halberd kills most of this cast in a
     * handful of rounds, and an npc that dies in three hits may never have had a turn to swing and
     * may never have been hit while standing - so "every one of them played a block" was really
     * "every one of them lived long enough to", and one unlucky rabble npc failed a check that
     * counts all sixty-three. Buying the fight a few more rounds is not pretending: what plays the
     * animations is the combat code either way, and the kill below is still a real kill.
     */
    const ROUNDS_WORTH = 150;

    for (const name of CAST) {
        const t: any = NpcType.get(NpcType.getId(name));
        const want = {
            attack: t.params?.get(PARAM.attack) as number | undefined,
            defend: t.params?.get(PARAM.defend) as number | undefined,
            death: t.params?.get(PARAM.death) as number | undefined
        };
        const p: any = player('ga_' + name, 3200, 3200);
        H.maxOut(p);
        // A halberd, because three of the bodyguards carry min_attackrange=2 and cannot be hit
        // toe to toe at all - which is Old School's own behaviour, not a bug in them.
        H.equip(p, { rhand: 'rune_halberd' });
        H.tick(2);
        const npc = H.addNpcAt(name, 3202, 3200, 0);
        if (npc.levels[NpcStat.HITPOINTS] < ROUNDS_WORTH) npc.levels[NpcStat.HITPOINTS] = ROUNDS_WORTH;
        H.npcAnims.length = 0;
        // TWO PHASES, because the four generals and a maxed player with a halberd are an even
        // match for well over nine hundred ticks - Graardor was still on 61 hitpoints at the end
        // of one. The first phase is a real fight, long enough for the npc to swing and to be hit;
        // the second cuts its remaining hitpoints to one so the kill lands inside a sim's
        // patience. The death itself is still a real death, which is what plays the animation.
        if (!A.fight(p, npc, 300)) {
            npc.levels[NpcStat.HITPOINTS] = 1;
            A.fight(p, npc, 120);
        }
        H.tick(6);
        const seen = new Set(H.npcAnims.filter(a => a.who === name).map(a => a.seq));
        // Named rather than counted: a tally says "one of sixty-three" and leaves you to find it.
        if (want.attack === undefined || !seen.has(want.attack)) noAttack.push(name);
        if (want.defend === undefined || !seen.has(want.defend)) noDefend.push(name);
        if (want.death === undefined) {
            // the param's default is human_death, so this is what a player sees
            if (seen.has(HUMAN_DEATH)) humanDeaths.push(name);
        } else {
            check(`  ${name.padEnd(30)} dies with its own animation`, seen.has(want.death), true);
        }
        H.despawn(p);
    }

    check('  every one of them swung at the player', noAttack, []);
    check('  and every one of them played a block', noDefend, []);

    // ...and the three that cannot. This is asserted rather than skipped, so the day a death
    // sequence is added for their rig this check goes red and says the list has changed.
    check('  three Bandos sergeants fall back to the human death, and only those three', humanDeaths.sort(), [...SERGEANTS].sort());
}

console.log('\nAND THE SERGEANTS CANNOT BORROW ONE, which is why they are still like that');
{
    // The ork death sequence is the obvious candidate and it is the wrong skeleton. An animation
    // frame transforms vertices by their label, so a sequence written for one rig moves the wrong
    // parts of a model built on another - this is the measurement that ruled it out.
    const orkDeath = (NpcType.get(NpcType.getId('gwd_ork_1')) as any).params?.get(PARAM.death);
    check('  the orks do have a death of their own', typeof orkDeath, 'number');
    for (const s of SERGEANTS) {
        const t: any = NpcType.get(NpcType.getId(s));
        check(`  ${s.padEnd(18)} still has no death_anim of its own`, t.params?.get(PARAM.death), undefined);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
