// TWO WISE OLD MEN IN DRAYNOR, and why a search for him by name found none.
//
//   npx tsx tools/sim/wiseoldman.ts
//
// Reported from the game exactly like that. He was on the map and had been all along, but not under
// his own name: [wom_multi] is a multinpc keyed on %swansong and every step it lists resolves to
// [wise_old_man], so he stands in his house at 3088,3255 as npc type 3820. Grepping the maps for
// 2253 found nothing, a spawn was added at 3088,3251, and Draynor had two of him four tiles apart.
//
// So this checks two things. That there is one of him, and that everything a player or a quest can
// want from him reaches the one who was always there - which means the triggers had to move to
// wom_multi, because Player.getOpTrigger reads NpcType.get(target.type), the SHELL standing in the
// world, and an [opnpc1] on the resolved child never fires.
//
// And then it sweeps the rest of the world for the same mistake: a multinpc shell and a plain spawn
// of a type that shell resolves to, standing close enough together to be two of the same person.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import { World } from './a1lib.js';
import NpcType from '#/cache/config/NpcType.js';

await H.boot();
H.loginOrder();

// %swansong is a varbit on swansong_quest, which is also what wom_multi's multivar names.
const SWANSONG = {
    not_started: 0,
    letter: 20,
    wom: 30, // he leaves for Piscatoris here
    told: 190,
    complete: 200
};

/** Every npc type a spawned npc can present itself as: the shell, plus its multinpc children. */
function presents(t: any): number[] {
    return [t.id, ...t.multinpc.filter((i: number) => i >= 0)];
}

console.log('THERE IS ONE WISE OLD MAN IN DRAYNOR, AND HE IS IN HIS HOUSE');
{
    const wom = NpcType.getId('wise_old_man');
    const found: string[] = [];
    for (const npc of World.npcs) {
        if (!npc || !npc.isActive) continue;
        if (npc.x < 3060 || npc.x > 3120 || npc.z < 3220 || npc.z > 3290) continue;
        const t: any = NpcType.get(npc.type);
        if (!presents(t).includes(wom)) continue;
        // startX/startZ, not x/z: he has a wanderrange and has already taken a step or two.
        found.push(`${t.debugname}@${npc.startX},${npc.startZ},${npc.startLevel}`);
    }
    check('  exactly one npc in Draynor can be the Wise Old Man', found, ['wom_multi@3088,3255,0']);
}

console.log('\nAND TALKING TO HIM REACHES HIS OWN CONVERSATION');
{
    // No quest in progress: what he has always done here is sell the Quest point cape. Read from
    // the choice onwards - his opening ~chatnpc runs before drive() starts recording.
    const p: any = player('womcape', 3088, 3253, 0);
    H.setVarBit(p, 'swansong', SWANSONG.not_started);
    H.tick(2);
    const lines = A.talk(p, 'wom_multi', [1]);
    check('  he offers to talk about the cape he is wearing', A.saw(lines, "cape you're wearing"), true);
    check('  and it is the Quest point cape', A.saw(lines, 'Quest point cape'), true);
    H.despawn(p);
}

console.log('\nSWAN SONG REACHES HIM, AT THE STEP THAT WANTS HIM AND NO OTHER');
{
    const p: any = player('womswan', 3088, 3253, 0);
    H.tick(2);
    H.setVarBit(p, 'swansong', SWANSONG.not_started);
    H.tick(1);
    const idle = A.talk(p, 'wom_multi', [2]);
    check('  swansong=0: he talks about the cape, not the letter', A.saw(idle, "cape you're wearing"), true);
    check('    and says nothing about sea trolls', A.saw(idle, 'sea troll'), false);
    H.setVarBit(p, 'swansong', SWANSONG.letter);
    H.tick(1);
    const letter = A.talk(p, 'wom_multi');
    check("  swansong=20: he has read Herman's letter", A.saw(letter, 'sea troll'), true);
    check('    and wants the runes for it', A.saw(letter, 'Ten mist, ten lava and five'), true);
    H.despawn(p);
}

console.log('\nAND SO DOES GARDEN OF TRANQUILLITY, WHICH WANTS THE RING ENCHANTED');
{
    const p: any = player('womring', 3088, 3253, 0);
    H.setVarBit(p, 'swansong', SWANSONG.not_started);
    H.setVarBit(p, 'garden_quest', 5); // ^garden_started
    H.tick(2);
    const without = A.talk(p, 'wom_multi', [2]);
    check('  without the ring he has nothing to enchant', A.saw(without, 'Seven questions'), false);

    // With it, the conversation is seven p_choice3 questions, so it is read straight off the chat
    // interface rather than driven - drive() has to answer every menu it meets and the questions
    // are the quest's business, not this check's.
    H.give(p, 'ring_of_charos', 1);
    H.tick(1);
    const npc = A.findNpc('wom_multi', p);
    p.teleport(npc.x + 1, npc.z, npc.level);
    H.tick(1);
    const m = H.ifaces.length;
    H.opNpc(p, npc, 1);
    for (let t = 0; t < 20 && !p.activeScript; t++) H.tick(1);
    H.tick(2);
    const said = H.ifaces
        .slice(m)
        .filter(i => i.who === p.username && i.kind === 'text')
        .map(i => i.text ?? '');
    // The first line of [label,garden_wom] and nothing after it: the conversation waits on a
    // continue click, and the seven questions behind it are the quest's business, not this check's.
    check(
        '  with it in the pack, the ring is what he is asked about',
        said.some(l => l.includes('do something with this ring')),
        true
    );
    check(
        '    and the cape never comes up',
        said.some(l => l.includes("cape you're wearing")),
        false
    );
    H.despawn(p);
}

console.log('\nAND HE IS NOT IN DRAYNOR WHILE HE IS AT PISCATORIS');
{
    // wom_multi lists 0, 5, 10, 15, 20, 190 and 200 and nothing between, so from the moment he
    // takes the boat (^swan_wom = 30) until he is back and told (^swan_told = 190) the shell has no
    // child and there is nobody there. That is the quest's own doing, and this holds it.
    const t: any = NpcType.get(NpcType.getId('wom_multi'));
    const wom = NpcType.getId('wise_old_man');
    const steps = t.multinpc
        .map((id: number, i: number) => [i, id])
        .filter(([, id]: number[]) => id === wom)
        .map(([i]: number[]) => i);
    check('  the steps he is standing in Draynor at', steps, [0, 5, 10, 15, 20, 190, 200]);
    check('    which does not include the one he leaves on', steps.includes(SWANSONG.wom), false);
    check('    and does include the one he comes back on', steps.includes(SWANSONG.told), true);
}

console.log('\nNO OTHER NPC IN THE WORLD IS SPAWNED TWICE THIS WAY');
{
    // The same mistake, looked for everywhere: a multinpc shell and a plain spawn of a type that
    // shell resolves to, within 16 tiles of each other on the same floor. One of them is a person
    // the other already is.
    const spawned: any[] = [];
    for (const n of World.npcs) if (n && n.isActive) spawned.push(n);
    const dupes: string[] = [];
    for (const a of spawned) {
        const ta: any = NpcType.get(a.type);
        if (!ta.multinpc.length) continue;
        const children = new Set(ta.multinpc.filter((i: number) => i >= 0));
        for (const b of spawned) {
            if (b === a || b.level !== a.level) continue;
            if (Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z)) > 16) continue;
            const tb: any = NpcType.get(b.type);
            if (tb.multinpc.length) continue; // shell vs shell is not this mistake
            if (!children.has(tb.id)) continue;
            const k = `${ta.debugname}@${a.x},${a.z} and ${tb.debugname}@${b.x},${b.z}`;
            if (!dupes.includes(k)) dupes.push(k);
        }
    }
    check('  no shell stands next to a plain spawn of its own child', dupes.sort(), []);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
