// WHAT A PLAYER IS TOLD WHEN NOBODY WROTE THE CONVERSATION.
//
// `npm run opsweep` counts 307 npcs standing on the live map whose menu offers Talk-to with nothing
// in the content behind it: forty-two fairies in Zanaris, twenty-seven ugthanki in the desert,
// every HAM civilian under Lumbridge, the Mort'ton afflicted, eight of Ahoy's ghost sailors. Every
// one of those clicks used to end at Player.defaultOp and the words "Nothing interesting happens.",
// which reads like a broken game rather than an unwritten one. It now says "<name> is not
// interested in talking." - the sentence the content already writes by hand for Jonny the Beard,
// the bandit camp leaders, Billy Rehnison and the beggar in Camelot.
//
// WHAT IS ACTUALLY AT RISK HERE, and the only reason this sim exists. The obvious way to write this
// was a global [opnpc1,_] in the content, and a global op trigger is NOT a fallback:
// ScriptProvider.getByTrigger resolves type -> category -> global, and Player.interact prefers ANY
// op trigger over an ap trigger once the player is in operable distance. So a global would have
// beaten the fifteen npcs whose Talk-to is written as [apnpc1,x] with no opnpc1 beside it - every
// banker in the game among them - for anybody who clicked from an adjacent tile. The sentence lives
// in Player.defaultOpMessage instead, which can only run when nothing claimed the click at all.
//
// So the checks below are in two halves: the new line appears where there is nothing, and the npcs
// that DO talk are untouched. The second half is the one that would catch a regression.
import * as H from './harness.ts';
import { check, R, player, mark, mesSince } from './a1lib.ts';
import CategoryType from '#/cache/config/CategoryType.js';
import NpcType from '#/cache/config/NpcType.js';
import { isVisibleOp, TALK_TO_OP } from '#/cache/config/OpVisibility.js';
import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import World from '#/engine/World.js';

await H.boot();

const FALLBACK = 'is not interested in talking.';
const BLUNT = 'Nothing interesting happens.';

/** Click op1 on this npc from a tile beside it, and hand back everything the player was told. */
function talkTo(p: Player, npc: Npc): string[] {
    if (!H.standBeside(p, npc)) {
        throw new Error(`nowhere to stand beside ${NpcType.get(npc.type).debugname} at ${npc.x},${npc.z},${npc.level}`);
    }
    const from = mark();
    H.opNpc(p, npc, 1);
    H.tick(5);
    return mesSince(p, from);
}

/** The npc of this type nearest a coord, or a throw naming what the sim was looking for. */
function must(name: string, x: number, z: number, level = 0): Npc {
    const npc = H.npcNear(name, x, z, level);
    if (!npc) {
        throw new Error(`no ${name} is placed near ${x},${z},${level} - the sim's landmark moved`);
    }
    return npc;
}

// ------------------------------------------------------------- the hole this is covering is real

const claimed = (trigger: number, type: number, category: number): boolean => !!ScriptProvider.getByTriggerSpecific(trigger, type, -1) || (category !== -1 && !!ScriptProvider.getByTriggerSpecific(trigger, -1, category));

/**
 * Every npc STANDING IN THE WORLD that offers Talk-to with no script behind it, nearest spawn
 * first.
 *
 * ASKED OF THE RUNNING WORLD RATHER THAN NAMED, and that is this file's own lesson learned the
 * hard way. It used to walk up to a Zanaris fairy, because forty-two of them stood there with
 * nothing written; content #42 then wrote the whole of Zanaris, the fairy answered properly, and
 * the sim reported that the fallback had stopped working. The gap it was built on had been filled,
 * which is the best possible reason for a check to fail and the worst possible message to get.
 *
 * So the example is chosen from whatever is still unwritten today. 268 npc types qualify as this
 * is written; when that number reaches zero the two checks below will say so plainly instead of
 * pointing at a fairy.
 */
function unwritten(capitalised: boolean): Npc[] {
    const out: Npc[] = [];
    for (const npc of World.npcs) {
        if (!npc || !npc.isActive) continue;
        const t = NpcType.get(npc.type);
        const op1 = t?.op?.[0] ?? '';
        if (!t || !t.name || !isVisibleOp(op1) || !TALK_TO_OP.test(op1)) continue;
        if (capitalised !== (op1 === 'Talk-To')) continue;
        if (claimed(ServerTriggerType.OPNPC1, npc.type, t.category) || claimed(ServerTriggerType.APNPC1, npc.type, t.category)) continue;
        out.push(npc);
    }
    return out;
}

console.log('THE SHAPE OF THE PROBLEM, asked of the running world');
{
    // Not a remembered number: counted here so that the day somebody writes the dialogue, this
    // check tells them the sim is now testing a smaller thing rather than silently passing.
    const unanswered = new Set(
        unwritten(false)
            .concat(unwritten(true))
            .map(n => n.type)
    ).size;
    console.log(`  ${unanswered} npc types the map places advertise Talk-to with no script behind it`);
    check('  and there is more than a handful of them', unanswered > 50, true);
}

// ------------------------------------------------------------------------ the new line, where due

/** Walk up to one of them and read what it says back. */
function askOne(who: string, capitalised: boolean): void {
    const candidates = unwritten(capitalised);
    check(`  there is still an unwritten Talk-to npc spelled '${capitalised ? 'Talk-To' : 'Talk-to'}'`, candidates.length > 0, true);
    for (const npc of candidates.slice(0, 8)) {
        const t = NpcType.get(npc.type);
        const p = player(who + npc.type, npc.x, npc.z, npc.level);
        let out: string[];
        try {
            out = talkTo(p, npc);
        } catch {
            continue; // nowhere to stand beside this one; try the next
        }
        console.log(`      (${t.debugname} "${t.name}" at ${npc.x},${npc.z} L${npc.level})`);
        check('  it is told to be not interested, by name', out.includes(`${t.name} is not interested in talking.`), true);
        check('  and is not told nothing interesting happens', out.includes(BLUNT), false);
        return;
    }
    check('  one of them could be stood next to', false, true);
}

console.log('\nAN NPC NOBODY WROTE');
askOne('talkfall_a', false);

console.log('\nTHE SAME, SPELLED "Talk-To"');
// 22 of the 307 capitalise the second word. An exact === 'Talk-to' comparison misses all of them,
// which is why TALK_TO_OP is a case-insensitive regex in one shared place - and why the npc used
// here is picked for carrying that spelling rather than for being a particular character.
askOne('talkfall_b', true);

// ----------------------------------------------------- and NOT where op1 is something else

console.log('\nAN op1 THAT IS NOT A CONVERSATION');
{
    // The five op1s in this build that are not Talk-to, and the reason the label has to be read
    // rather than assumed: a content-side global could not have told these apart.
    const cases: [string, number, number, number, string][] = [
        ['possessed_pickaxe_stationary', 2711, 4436, 0, 'Take'],
        ['wom_bed_inactive', 3087, 3254, 1, 'Kick'],
        ['ics_little_plague_cow1', 3274, 2805, 0, 'Pet']
    ];
    // THE LABELS ARE STILL ASSERTED BY NAME, because that is the claim: these op1s exist in this
    // build and are not conversations, which is what a content-side global could not have told
    // apart.
    for (const [name, x, z, level, label] of cases) {
        const npc = must(name, x, z, level);
        check(`  ${name}'s op1 is still ${label}`, NpcType.get(npc.type).op?.[0], label);
    }
    // THE BEHAVIOUR IS MEASURED ON WHICHEVER OF THEM IS STILL UNANSWERED, for the same reason the
    // two sections above pick their npc from the running world: possessed_pickaxe_stationary was
    // one of these three cases and Haunted Mine's content has since wired it, so "it gets the blunt
    // line instead" failed because the pickaxe now has an answer. A check that reads as a broken
    // fallback whenever somebody writes a script is a check that will be ignored.
    {
        const nonTalk: Npc[] = [];
        for (const npc of World.npcs) {
            if (!npc || !npc.isActive) continue;
            const t = NpcType.get(npc.type);
            const op1 = t?.op?.[0] ?? '';
            if (!t || !isVisibleOp(op1) || TALK_TO_OP.test(op1)) continue;
            if (claimed(ServerTriggerType.OPNPC1, npc.type, t.category) || claimed(ServerTriggerType.APNPC1, npc.type, t.category)) continue;
            nonTalk.push(npc);
        }
        check('  there is an unanswered op1 that is not a conversation', nonTalk.length > 0, true);
        for (const npc of nonTalk.slice(0, 8)) {
            const t = NpcType.get(npc.type);
            const p = player('tfn' + npc.type, npc.x, npc.z, npc.level);
            let out: string[];
            try {
                out = talkTo(p, npc);
            } catch {
                continue;
            }
            console.log(`      (${t.debugname}'s op1 is "${t.op?.[0]}")`);
            check(
                '  clicking it says nothing about talking',
                out.some(m => m.includes(FALLBACK)),
                false
            );
            check('  it gets the blunt line instead', out.includes(BLUNT), true);
            break;
        }
    }
}

// --------------------------------------------------------- the npcs that DO talk, still talking

console.log('\nTHE NPCS THAT WERE ALREADY ANSWERED');
{
    const p = player('talkfall_c', 3207, 3229);
    const hans = must('hans', 3207, 3229);
    const out = talkTo(p, hans);
    check(
        '  Hans, whose Talk-to is [opnpc1,hans], still talks',
        out.some(m => m.includes(FALLBACK)),
        false
    );
    check(
        '  and the engine found a trigger for him',
        out.some(m => m.startsWith('No trigger for')),
        false
    );
}

console.log('\nAND THE ONES ANSWERED ONLY BY AN ap TRIGGER - the regression a global would have caused');
{
    // Every banker in the game is served by [apnpc1,_bank_teller] in banker.rs2 and has no opnpc1
    // of its own. Located by category rather than named, so this keeps testing the right thing when
    // a banker is added or renamed.
    const cat = CategoryType.getId('bank_teller');
    check('  the bank_teller category exists', cat !== -1, true);
    let teller: Npc | null = null;
    for (const npc of World.npcs) {
        if (npc && npc.isActive && NpcType.get(npc.type).category === cat && isVisibleOp(NpcType.get(npc.type).op?.[0])) {
            teller = npc;
            break;
        }
    }
    check('  and the map places one', teller !== null, true);
    if (teller) {
        const t = NpcType.get(teller.type);
        check(`  ${t.debugname} has no opnpc1 of its own`, !!ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPNPC1, teller.type, -1), false);
        check('  nor one on its category', !!ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPNPC1, -1, cat), false);
        check('  only an apnpc1 on the category', !!ScriptProvider.getByTriggerSpecific(ServerTriggerType.APNPC1, -1, cat), true);
        const p = player('talkfall_d', teller.x, teller.z, teller.level);
        const out = talkTo(p, teller);
        check(
            '  and clicking Talk-to from beside it does NOT get the fallback',
            out.some(m => m.includes(FALLBACK)),
            false
        );
        check('  nor the blunt line', out.includes(BLUNT), false);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
