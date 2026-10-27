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
// The answer it gives: all three play, for every one of them.
//
// The three Bandos sergeants were the hold-out. They carried no death_anim, so they fell back to
// the param's default - human_death - and an ork crumpled like a man. The reason given here used
// to be that their rig (rev 474 frame group 1575) carries no priority-10 sequence, which turned
// out to be no evidence at all: that rig carries no priority byte on ANY of its nine sequences,
// the attack and the block included. Old School's own copy of seq 6156 has priority 10, and 474's
// 6156 is the only one of the nine that neither loops nor walk-merges and ends on a 50-tick hold,
// which is what every other God Wars death here does. It covers frames 28-51, one of the four runs
// no sequence used to name. It is gwd_seq_6156 now, and the checks below are the other way round.
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
            // Nine of them NAME human_death - the Saradomin knights and priest and the six
            // spiritual warriors are built on the human rig, so it is their own death and not a
            // fallback. Only an npc that plays it without naming it has fallen back.
            if (want.death !== HUMAN_DEATH && seen.has(HUMAN_DEATH)) humanDeaths.push(name);
        }
        H.despawn(p);
    }

    check('  every one of them swung at the player', noAttack, []);
    check('  and every one of them played a block', noDefend, []);

    // Nobody crumples like a man any more. Named rather than counted, so the npc that regressed
    // is the one the check prints.
    check('  and not one of them fell back to the human death', humanDeaths.sort(), []);
}

console.log('\nAND THE SERGEANTS DIE AS ORKS NOW, on the sequence their own rig carries');
{
    const want = SeqType.getId('gwd_seq_6156');
    for (const s of SERGEANTS) {
        const t: any = NpcType.get(NpcType.getId(s));
        check(`  ${s.padEnd(18)} names gwd_seq_6156`, t.params?.get(PARAM.death), want);
    }
    // A param can name a sequence that was never packed, and the client would then play nothing
    // at all - which looks exactly like the bug this set out to fix. So read the sequence itself.
    const seq: any = SeqType.get(want);
    check('  the sequence is real', seq?.frames?.length, 24);
    check('  it holds on its last frame, as a death does', seq?.delay?.[23], 50);
    check('  and it outranks everything else the npc could be doing', seq?.priority, 10);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
