// ZULRAH, on the real engine - run with `npx tsx tools/sim/zulrah.ts`. Content:
// content/scripts/areas/area_zulrah/**.
//
//   getting there   Regicide gates the High Priestess; volunteering opens the boat; the boat builds
//                   the shrine instance and puts Zulrah in the middle; the boat at the shrine rows
//                   you back and takes the instance with it; the Zul-andra teleport lands in the
//                   village
//   the rotations   all four of the wiki's tables, phase for phase: the colour, the place and the
//                   number of beats, read back off a live fight
//   the fight       3 ticks a beat; 41 max; Protect from Missiles stops the green form dead and
//                   Protect from Magic does not; snakelings spawn from the orb runs and die with
//                   the snake; a venom cloud burns you while you stand in it
//   dying there     everything goes to Priestess Zul-Gwenwynig, free for the first fifty kills and
//                   100,000 after; dying in the world afterwards loses the lot
//   the drops       20,000 kills against the wiki's own rates, uniques included
//   the trackers    a real kill in each of the three colours counting once each, to the player the
//                   loot went to, and its uniques landing on the collection log's Zulrah page
//   the pet         through ~bosspet_roll and the follower slot, put down and picked back up
//   the blowpipe    the four objs tools/nosourcespec.json used to excuse now have a source
//   the helm        52 Crafting to carve, 75 Defence to wear, scales to charge, ten a fight, and
//                   immunity to poison and venom while it holds any
//   the trident     59 Crafting to fang, 78 Magic to wield, scales in its charges, two harder
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import World from '#/engine/World.js';
import ObjType from '#/cache/config/ObjType.js';
import NpcType from '#/cache/config/NpcType.js';
import EnumType from '#/cache/config/EnumType.js';
import Obj from '#/engine/entity/Obj.js';
import InvType from '#/cache/config/InvType.js';
import SpotanimType from '#/cache/config/SpotanimType.js';
import SeqType from '#/cache/config/SeqType.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import * as fs from 'fs';

await H.boot();
H.loginOrder();
let ok = 0, bad = 0, n = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const near = (what: string, got: number, want: number, tol: number) => {
    const pass = Math.abs(got - want) <= tol;
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${got}${pass ? ` (~${want})` : `   (want ${want} +-${tol})`}`);
};
const HP = 3, DEF = 1, CRAFT = 12, MAGIC = 6;
const REGICIDE_COMPLETE = 15;
// The Sacrificial boat on the Zul-Andra shore: m34_47 local (31,47).
const DOCK_BOAT = [34 * 64 + 31, 47 * 64 + 47];

const fresh = (x = 3222 + (n % 8) * 4, z = 3218 + Math.floor(n / 8) * 4) => {
    const p: any = H.makePlayer('zul' + n, x, z, 90 + n); n++;
    H.tick(2); H.maxOut(p); H.clearInv(p); H.setVar(p, 'tutorial', 1000); H.tick(1);
    return p;
};
const enumVal = (name: string, key: number): number => {
    const e = EnumType.getByName(name)!;
    const v = (e as any).values?.get?.(key);
    return v === undefined ? (e as any).defaultInt : v;
};
const npcsOfType = (...names: string[]) => {
    const ids = new Set(names.map(x => NpcType.getId(x)));
    const out: any[] = [];
    for (const npc of (World as any).npcs) {
        if (npc && npc.isActive && ids.has(npc.type)) out.push(npc);
    }
    return out;
};
const theSnake = () => npcsOfType('zulrah', 'zulrah_magma', 'zulrah_tanzanite')[0] ?? null;
const colourOf = (npc: any) => ({ zulrah: 'green', zulrah_magma: 'red', zulrah_tanzanite: 'blue' }
    [NpcType.get(npc.type).debugname!] ?? '?');

// ------------------------------------------------------------------ the rotation tables
console.log('THE FOUR ROTATIONS, as data');
{
    check('four rotations, of 11, 11, 12 and 13 phases',
        [1, 2, 3, 4].map(r => enumVal('zulrah_rotation_length', r)), [11, 11, 12, 13]);
    check('  and they sit end to end: 0, 11, 22, 34',
        [1, 2, 3, 4].map(r => enumVal('zulrah_rotation_start', r)), [0, 11, 22, 34]);
    const form = (i: number) => NpcType.get(enumVal('zulrah_phase_form', i)).debugname;
    const pos = (i: number) => ['middle', 'south', 'west', 'east'][enumVal('zulrah_phase_pos', i)];
    // The wiki's own phase 2, which is what a player reads to tell the rotations apart.
    check('phase 2 tells them apart: crimson, crimson, green, tanzanite',
        [0, 11, 22, 34].map(s => form(s + 1)),
        ['zulrah_magma', 'zulrah_magma', 'zulrah', 'zulrah_tanzanite']);
    check('rotation 1, colours in order',
        [...Array(11)].map((_, i) => form(i)),
        ['zulrah', 'zulrah_magma', 'zulrah_tanzanite', 'zulrah', 'zulrah_magma', 'zulrah_tanzanite',
         'zulrah', 'zulrah_tanzanite', 'zulrah', 'zulrah_magma', 'zulrah']);
    check('rotation 1, places in order',
        [...Array(11)].map((_, i) => pos(i)),
        ['middle', 'middle', 'middle', 'south', 'middle', 'west', 'south', 'south', 'west',
         'middle', 'middle']);
    check('rotation 4, places in order',
        [...Array(13)].map((_, i) => pos(34 + i)),
        ['middle', 'east', 'south', 'west', 'middle', 'east', 'south', 'west', 'middle', 'middle',
         'east', 'middle', 'middle']);
    // Every rotation's Jad phase, by the run kind that only a Jad phase uses (7 ranged-first,
    // 8 magic-first).
    const jad: number[] = [];
    for (let ph = 0; ph < 47; ph++) {
        const s = enumVal('zulrah_phase_run_start', ph);
        const c = enumVal('zulrah_phase_run_count', ph);
        for (let r = s; r < s + c; r++) {
            if (enumVal('zulrah_run_kind', r) >= 7) jad.push(enumVal('zulrah_run_count', r));
        }
    }
    check('one Jad phase per rotation, 10, 10, 10 and 8 attacks long', jad, [10, 10, 10, 8]);
}

// ------------------------------------------------------------------ getting there
console.log('ZUL-ANDRA');
let shrinePlayer: any = null;
{
    const p = fresh();
    H.setVar(p, 'regicide_quest', 0);
    let lines = A.talk(p, 'zulandra_high_priestess', ['I want to face Zulrah.']);
    check('without Regicide she turns you away', A.saw(lines, 'without finishing'), true);
    check('  and you are not a volunteer', H.getVar(p, 'zulrah_volunteered'), 0);

    H.setVar(p, 'regicide_quest', REGICIDE_COMPLETE);
    lines = A.talk(p, 'zulandra_high_priestess', ['I want to face Zulrah.', 'Then give me to it.']);
    check('with Regicide done you can volunteer', H.getVar(p, 'zulrah_volunteered'), 1);

    // The boat itself - OSRS loc 46241, "Sacrificial boat", placed on the Zul-Andra shore at
    // m34_47 (31,47). Boarding it is the only way out to the shrine.
    A.op(p, DOCK_BOAT[0], DOCK_BOAT[1], 'osrsloc_46241', 1);
    H.tick(8);
    const snake = theSnake();
    check('the boat builds the shrine and Zulrah is in it', snake !== null, true);
    check('  500 hitpoints, green, and it does not move',
        snake ? [snake.levels[HP], colourOf(snake),
                 NpcType.get(snake.type).moverestrict === NpcType.get(NpcType.getId('kraken')).moverestrict] : null,
        [500, 'green', true]);
    check('  the player is inside the instance, not on the dock', p.x > 6000 || p.z > 6000, true);
    const inst = H.getVar(p, 'zulrah_instance');
    check('  and %zulrah_instance points at it', inst > 0, true);

    // Out again, and it is the same loc with the same word on it: the handler reads where you are.
    const base = [p.x - 12, p.z - 13];
    A.op(p, base[0] + 11, base[1] + 9, 'osrsloc_46241', 1);
    H.tick(8);
    check('rowing back empties the instance', theSnake(), null);
    check('  and puts you on the dock at Zul-Andra', [p.x, p.z], [2176 + 29, 3008 + 48]);
    check('  with %zulrah_instance cleared', H.getVar(p, 'zulrah_instance'), -1);

    // The teleport scroll, which is 15/249 of the table and the way most people get back.
    H.give(p, 'zul_andra_teleport', 4);
    A.held(p, 'zul_andra_teleport', 1);
    H.tick(6);
    check('the Zul-andra teleport lands in the village', [p.x, p.z], [2176 + 26, 3008 + 53]);
    check('  and one scroll of the four is gone', H.invCount(p, 'zul_andra_teleport'), 3);
    shrinePlayer = p;
}

// ------------------------------------------------------------------ the fight
// ONE ARENA, READ IN ORDER, and the order is the point: the prayer and the cloud checks come before
// anything that puts a snakeling on the island, because a snakeling hits for fifteen through any
// prayer and would read as Protect from Missiles failing when it is doing its job.
console.log('THE FIGHT');
{
    const p = shrinePlayer;
    H.setVar(p, 'zulrah_volunteered', 1);
    A.op(p, DOCK_BOAT[0], DOCK_BOAT[1], 'osrsloc_46241', 1);
    H.tick(10);
    const snake = theSnake()!;
    p.levels[HP] = 990; p.baseLevels[HP] = 990;
    // It is parked before it has taken a single beat of its own: Zulrah surfaces with a six-tick
    // rise on it, and a rotation left to itself would have spat snakelings out before any of the
    // checks below started.

    // Ticks with both of them topped up, and remembers the most snakelings alive at once. The
    // player auto-retaliates: left alone a maxed one kills a 500-hitpoint snake inside a rotation,
    // and kills every one-hitpoint snakeling the tick it arrives.
    let sawSnakelings = 0;
    // The SNAKE is topped up, the player is not: what the player loses over the window is the
    // measurement. (The rotation walk below tops the player up itself - it is four hundred ticks
    // long and reads colours, not damage.)
    const run = (ticks: number) => {
        for (let i = 0; i < ticks; i++) {
            (p as any).clearPendingAction();
            // The harness keeps every hit, anim, message and sound of the whole run, and nothing in
            // this sim reads them. Over tens of thousands of ticks that is all the memory there is.
            if (i % 50 === 0) H.clearLogs();
            H.tick(1);
            const s = theSnake();
            if (s) s.levels[HP] = s.baseLevels[HP];
            sawSnakelings = Math.max(sawSnakelings,
                npcsOfType('zulrah_snakeling', 'zulrah_snakeling_mage').length);
        }
    };
    const tookOver = (ticks: number) => {
        const before = p.levels[HP];
        run(ticks);
        const took = before - p.levels[HP];
        p.levels[HP] = 990;
        return took;
    };
    // Put it on a chosen phase of a chosen rotation, mid-fight, with the prayers of your choice.
    // SETTLING IS DONE WITH THE SNAKE FROZEN, and both halves of that matter. Every rotation's own
    // phase 1 is four venom cloud barrages, so a snake left to itself for a few ticks has dropped a
    // cloud that burns for twenty-five more, straight through whatever is measured next; and a
    // snake left running for thirty ticks walks out of the phase it was parked on and into the next
    // one. Pushing its beat clock past the settle does neither.
    const park = (rotation: number, phase: number, prayer13: number, prayer12: number, settle = 0) => {
        if (settle > 0) {
            H.setNpcVar(snake, 'npc_action_delay', (World as any).currentTick + settle + 5);
            run(settle);
        }
        H.setNpcVar(snake, 'zulrah_rotation', rotation);
        H.setNpcVar(snake, 'zulrah_phase', phase);
        H.setNpcVar(snake, 'zulrah_run', enumVal('zulrah_phase_run_start', phase));
        H.setNpcVar(snake, 'zulrah_run_at', 0);
        H.setNpcVar(snake, 'zulrah_submerged', 0);
        H.setNpcVar(snake, 'npc_action_delay', 0);
        H.setVar(p, 'prayer13', prayer13);
        H.setVar(p, 'prayer12', prayer12);
        H.setVar(p, 'venom', 0);
        p.levels[HP] = 990;
    };

    // Rotation 2's phase 7 (index 17) is the one phase in the four tables that is nothing but
    // ranged - "East, Green, ranged 5 times", no orbs and no barrages - so nothing else can touch
    // the count.
    park(2, 17, 1, 0, 30);   // Protect from Missiles UP, and thirty ticks to burn off the cloud
                             // the snake's own opening phase dropped before it was parked
    check('Protect from Missiles stops the green form dead', tookOver(18), 0);
    park(2, 17, 0, 1);       // the WRONG prayer
    check('  Protect from Magic does not', tookOver(18) > 0, true);

    // Phase 1 of rotation 1 is four venom cloud barrages and nothing else.
    sawSnakelings = 0;
    park(1, 0, 1, 1);        // both prayers up: a cloud is not an attack and neither stops it
    check('standing in a venom cloud burns you through both prayers', tookOver(20) > 0, true);
    // "[the clouds] do not envenom players directly" - and nothing else in that window can.
    check('  and it does not envenom - the clouds never do', H.getVar(p, 'venom'), 0);
    check('  no snakeling has been out yet, so nothing else was hitting', sawSnakelings, 0);

    // The whole of rotation 1, colour by colour and place by place.
    park(1, 0, 1, 0, 0);
    // ...and put the colour back to the one phase 1 wears. A colour only changes when the snake
    // surfaces, so whatever it was wearing when the sim parked it is left over from the checks
    // above; changeType is the engine's own call, with keep-all, exactly as ~zulrah_surface uses it.
    (snake as any).changeType(NpcType.getId('zulrah'), 30000, false);
    const seen: string[] = [];
    const places: number[][] = [];
    for (let t = 0; t < 460; t++) {
        (p as any).clearPendingAction();
        if (t % 50 === 0) H.clearLogs();
        H.tick(1);
        const s = theSnake();
        if (!s) break;
        const tag = colourOf(s) + '@' + s.x + ',' + s.z;
        if (seen[seen.length - 1] !== tag) { seen.push(tag); places.push([s.x, s.z]); }
        p.levels[HP] = 990;
        s.levels[HP] = s.baseLevels[HP];
        sawSnakelings = Math.max(sawSnakelings,
            npcsOfType('zulrah_snakeling', 'zulrah_snakeling_mage').length);
    }
    check('it walks rotation 1 the way the table has it, phase after phase',
        seen.map(x => x.split('@')[0]).slice(0, 11),
        ['green', 'red', 'blue', 'green', 'red', 'blue', 'green', 'blue', 'green', 'red', 'green']);
    // Rotation 1 never uses the east: middle, south and west is the whole of it.
    check('  over the three places rotation 1 uses, and no others',
        new Set(places.slice(0, 11).map(c => c.join(','))).size, 3);
    check('  and its orb runs put snakelings on the island', sawSnakelings > 0, true);
}

console.log('WHAT A KILL CLEARS UP');
{
    // The last thing the death table does is ~zulrah_clear_snakelings: "[the snakelings] will
    // automatically die off with Zulrah when it is killed". The kill itself and everything it
    // drops is the drop-table section below - real kills, through the drop-test loop.
    const p = shrinePlayer;
    // Put some out to clear: phase 12 of rotation 3 is four snakeling orbs and nothing else.
    const s = theSnake();
    if (s) {
        H.setNpcVar(s, 'zulrah_rotation', 3);
        H.setNpcVar(s, 'zulrah_phase', 32);
        H.setNpcVar(s, 'zulrah_run', enumVal('zulrah_phase_run_start', 32));
        H.setNpcVar(s, 'zulrah_run_at', 0);
        H.setNpcVar(s, 'zulrah_submerged', 0);
        H.setNpcVar(s, 'npc_action_delay', 0);
    }
    let out = 0;
    for (let i = 0; i < 40; i++) {
        (p as any).clearPendingAction();
        H.tick(1);
        const t = theSnake();
        if (t) t.levels[HP] = t.baseLevels[HP];
        p.levels[HP] = 990;
        out = Math.max(out, npcsOfType('zulrah_snakeling', 'zulrah_snakeling_mage').length);
    }
    check('snakelings are out before it', out > 0, true);
    check('  and a snakeling has one hitpoint, as the wiki says',
        NpcType.get(NpcType.getId('zulrah_snakeling')).stats[HP], 1);
    A.runProcProtected(p, '[proc,zulrah_clear_snakelings]');
    H.tick(2);
    check('the sweep takes the snake', theSnake(), null);
    check('  and every snakeling with it',
        npcsOfType('zulrah_snakeling', 'zulrah_snakeling_mage').length, 0);
    A.runProcProtected(p, '[proc,zulrah_end]');
    H.tick(2);
}

// ------------------------------------------------------------------ the fight ENDS
// WHAT THE 125 CHECKS ABOVE COULD NOT SEE, and why the owner had to ::~kill a boss he had already
// emptied. Every fight check in this file tops the snake back up to full on every tick
// (s.levels[HP] = s.baseLevels[HP]), because they are measuring what the PLAYER loses; and the only
// kills in it were ::~debug_kill_active on a freshly-added snake standing in the open world, never
// on the one in the shrine and never with the rotation running. So a fight that could not be
// finished in the shrine passed all of them. These do the opposite: nothing is topped up, and the
// snake in the instance is the snake that has to die.
console.log('THE FIGHT ENDS');
{
    const p = fresh(DOCK_BOAT[0] - 2, DOCK_BOAT[1] + 1);
    H.setVar(p, 'regicide_quest', REGICIDE_COMPLETE);
    H.setVar(p, 'zulrah_volunteered', 1);
    A.op(p, DOCK_BOAT[0], DOCK_BOAT[1], 'osrsloc_46241', 1);
    H.tick(10);
    p.levels[HP] = 990; p.baseLevels[HP] = 990;
    const snake = theSnake()!;
    const packed = (who: any) => (who.level << 28) | (who.x << 14) | who.z;
    // Hold the rotation still so nothing in this block is racing the snake's own beat.
    const park = () => H.setNpcVar(theSnake()!, 'npc_action_delay', World.currentTick + 900);
    park();

    // THE SHRINE IS MULTI-WAY, and that is the whole of the unkillable boss. maps/multiway.csv is a
    // list of real map-square zones and the shrine is an instance copied out of m36_79, so the
    // lookup could never match it and the arena was single-way: [proc,npc_check_notcombat] refused
    // every snakeling while Zulrah held the player, and [proc,player_in_combat_check] refused the
    // player a re-attack on Zulrah for eight ticks whenever %aggressive_npc was not Zulrah's CURRENT
    // uid - which is every phase change, because npc_changetype_keepall gives it a new one. Between
    // the lockouts and ordinary npc stat regen the snake healed faster than it could be hit.
    check('the shrine is multi-way combat, through the zone it was copied from',
        World.gameMap.isMulti(packed(p)), true);
    check('  and so is the water Zulrah surfaces in',
        World.gameMap.isMulti(packed(snake)), true);
    check('  the template square m36_79 is what carries it',
        World.gameMap.isMulti((36 * 64 + 28) << 14 | (79 * 64 + 29)), true);
    check('  and Lumbridge still is not', World.gameMap.isMulti(3222 << 14 | 3218), false);

    // AND THAT IS WHAT LETS A SNAKELING BITE. ~npc_check_notcombat is the gate its attack proc opens
    // with: asked as the snakeling on a tick when Zulrah already has the player, it has to say yes.
    const ling = H.addNpc('zulrah_snakeling', p.x + 1, p.z + 1);
    H.tick(1);
    H.setVar(p, 'lastcombat', World.currentTick);
    H.setVar(p, 'aggressive_npc', snake.uid);
    check('a snakeling may attack while Zulrah already has you',
        H.runNpcProc(ling, '[proc,npc_check_notcombat]', p), [1]);
    // And the other half of the same gate, which is the half that stopped the boss dying: the player
    // going back to Zulrah while something else has hit them. Single-way answered "I'm already under
    // attack" and threw the click away.
    H.setVar(p, 'aggressive_npc', ling.uid);
    H.setVar(p, 'lastcombat', World.currentTick);
    const said = A.mark();
    (p as any).clearPendingAction();
    H.attackNpc(p, theSnake()!);
    H.tick(2);
    check('  and you may still attack Zulrah while a snakeling has you',
        A.mesSince(p, said).filter(m => m.includes('already under attack')), []);
    World.removeNpc(ling, -1);
    H.tick(1);
    park();

    // HITPOINTS DO NOT COME BACK ACROSS A PHASE CHANGE. npc_changetype_keepall is keep-all for
    // exactly this reason, and a colour change that reset them would be a boss healing itself three
    // times a rotation.
    // Rotation 1's phase 1 is green and its phase 2 is red (zulrah.enum), so this dive is a colour
    // change whichever way the dice fall - a phase picked at random can surface in the colour it
    // went down in, which would prove nothing either way.
    (theSnake() as any).changeType(NpcType.getId('zulrah'), 30000, false);
    H.setNpcVar(theSnake()!, 'zulrah_rotation', 1);
    H.setNpcVar(theSnake()!, 'zulrah_phase', 0);
    theSnake()!.levels[HP] = 137;
    H.setNpcVar(theSnake()!, 'zulrah_run', 9999);   // the run is spent: the next beat is the dive
    H.setNpcVar(theSnake()!, 'zulrah_submerged', 0);
    H.setNpcVar(theSnake()!, 'npc_action_delay', 0);
    let wearing = '';
    for (let i = 0; i < 25 && wearing !== 'zulrah_magma'; i++) {
        H.tick(1); p.levels[HP] = 990;
        const s = theSnake();
        if (s) wearing = NpcType.get(s.type).debugname!;
    }
    check('it goes down green and comes back up red, as rotation 1 has it', wearing, 'zulrah_magma');
    check('  with the hitpoints it went down with, not with 500',
        theSnake() ? theSnake().levels[HP] : null, 137);
    park();

    // IT DIES AT ZERO, IN EACH OF ITS THREE COLOURS, in its own shrine with the rotation live.
    // The last hit is queued the way every weapon in the game queues one - npc_queue(2, damage,
    // delay), which is [ai_queue2,_] -> ~npc_default_damage -> npc_damage -> npc_queue(3) ->
    // [ai_queue3,zulrah] -> @zulrah_death_table - so the whole death path runs, and it runs on the
    // snake that is standing in the instance rather than on a fresh one added beside the player.
    const AI_QUEUE2 = ServerTriggerType.AI_QUEUE1 + 1;
    const rebuild = () => {
        A.runProcProtected(p, '[proc,zulrah_end]'); H.tick(2);
        A.op(p, DOCK_BOAT[0], DOCK_BOAT[1], 'osrsloc_46241', 1); H.tick(10);
        p.levels[HP] = 990; H.clearLogs(); park();
    };
    const emptyIt = (colour: string) => {
        const s = theSnake();
        if (!s) return 'no snake to kill';
        (s as any).changeType(NpcType.getId(colour), 30000, false);
        (s as any).heroPoints.addHero(p.uid, 500);
        s.levels[HP] = 9;
        (s as any).enqueueScript(AI_QUEUE2, 0, 9);
        for (let t = 0; t < 15; t++) {
            H.tick(1); p.levels[HP] = 990;
            if (!theSnake()) return 'dead';
        }
        return 'alive on ' + theSnake()!.levels[HP];
    };
    check('emptied as the green form, it dies', emptyIt('zulrah'), 'dead');
    rebuild();
    check('  as the red form, it dies', emptyIt('zulrah_magma'), 'dead');
    rebuild();
    check('  as the blue form, it dies', emptyIt('zulrah_tanzanite'), 'dead');
    rebuild();

    // AND ONCE THE WHOLE WAY WITH A REAL WEAPON AND NO STAFF COMMAND, which is the check the owner's
    // report is actually about: a player, a bow and arrows, shooting until the snake is gone. Its
    // hitpoints are cut first so this is a last stretch rather than a twenty-minute fight, but every
    // roll from the bowstring to the drop table is the game's own, and the rotation is left running.
    p.invSet(InvType.WORN, ObjType.getId('magic_shortbow'), 1, 3);
    p.invSet(InvType.WORN, ObjType.getId('rune_arrow'), 30000, 13);
    H.tick(1);
    H.setNpcVar(theSnake()!, 'npc_action_delay', 0);
    theSnake()!.levels[HP] = 20;
    let shotDead = false;
    H.attackNpc(p, theSnake()!);
    for (let t = 0; t < 600 && !shotDead; t++) {
        if (t % 50 === 0) H.clearLogs();
        H.tick(1); p.levels[HP] = 990;
        const cur = theSnake();
        if (!cur) { shotDead = true; break; }
        if (!(p as any).target) H.attackNpc(p, cur);
    }
    check('and a player with a bow kills it outright, no staff command', shotDead, true);
    if (theSnake()) { A.runProcProtected(p, '[proc,zulrah_end]'); H.tick(2); }
    H.despawn(p);
}

// ------------------------------------------------------------------ where it surfaces
// THE FOUR PLACES, AGAINST THE MAP RATHER THAN AGAINST A LIST. zulrah.constant states the rule that
// picked them - "the four 5x5 blocks of open water NEAREST the walkway in each of those
// directions" - and two of the four did not obey it: west and east sat one tile off the walkway,
// which is as close as a 5x5 block of water gets before it overlaps the walkway itself, while
// middle and south sat at two. Nothing in the old checks looked at the map at all; they compared the
// enum against itself.
console.log('WHERE ZULRAH SURFACES');
{
    const BX = 36 * 64, BZ = 79 * 64;
    const plat: [number, number][] = [];
    for (let x = 16; x < 48; x++) {
        for (let z = 16; z < 48; z++) {
            if (A.walkable(0, BX + x, BZ + z)) plat.push([x, z]);
        }
    }
    check('the shrine has a walkway to stand on', plat.length > 0, true);
    // Zulrah is 5x5 and moverestrict=nomove, so a block with a walkable tile in it would drop the
    // snake onto the walkway and block the player's own path round it.
    const allWater = (sx: number, sz: number) => {
        for (let x = sx; x < sx + 5; x++) {
            for (let z = sz; z < sz + 5; z++) {
                if (A.walkable(0, BX + x, BZ + z)) return false;
            }
        }
        return true;
    };
    // The shortest distance from the 5x5 block to a tile a player can stand on.
    const gap = (sx: number, sz: number) => {
        let best = 99;
        for (const [px, pz] of plat) {
            best = Math.min(best, Math.max(Math.max(sx - px, 0, px - (sx + 4)), Math.max(sz - pz, 0, pz - (sz + 4))));
        }
        return best;
    };
    // Read out of the shipped constants the way the fight reads them, so a coord that moves here
    // moves the check with it.
    const SPOT = ['zulrah_pos_middle', 'zulrah_pos_south', 'zulrah_pos_west', 'zulrah_pos_east'];
    const local = SPOT.map(name => {
        const c = enumVal('zulrah_pos_coord', SPOT.indexOf(name));
        return [((c >> 14) & 0x3fff) - BX, (c & 0x3fff) - BZ];
    });
    check('all four are 5x5 blocks of water, so the snake never lands on the walkway',
        local.map(([x, z]) => allWater(x, z)), [true, true, true, true]);
    check('  and all four are as close to the walkway as a block of water gets',
        local.map(([x, z]) => gap(x, z)), [1, 1, 1, 1]);
    check('  and they are four different places', new Set(local.map(c => c.join(','))).size, 4);
}

// ------------------------------------------------------------------ the venom clouds, on screen
// A CLOUD IS ONLY REAL IF THE CLIENT IS TOLD ABOUT IT. The old check proved a barrage HURT - that
// standing in one costs hitpoints - which the queue does whether or not anything is ever drawn. It
// was not: a MapSpotAnim plays its sequence once and is then dropped, the cloud's six frames came to
// twelve 20ms client cycles (a quarter of a second) and the queue re-played it every fifth tick, so
// a cloud was on screen for 8% of its life. This watches World.animMap, which is where spotanim_map
// ends up.
console.log('THE VENOM CLOUDS ARE DRAWN');
{
    const p = fresh(DOCK_BOAT[0] - 2, DOCK_BOAT[1] + 1);
    H.setVar(p, 'regicide_quest', REGICIDE_COMPLETE);
    H.setVar(p, 'zulrah_volunteered', 1);
    A.op(p, DOCK_BOAT[0], DOCK_BOAT[1], 'osrsloc_46241', 1);
    H.tick(10);
    p.levels[HP] = 990; p.baseLevels[HP] = 990;
    // Park the snake and let every cloud its opening phase already dropped burn out: phase 1 of
    // every rotation is four barrages, and a cloud lives ^zulrah_cloud_ticks = 25 ticks.
    H.setNpcVar(theSnake()!, 'npc_action_delay', World.currentTick + 900);
    for (let t = 0; t < 40; t++) { (p as any).clearPendingAction(); H.tick(1); p.levels[HP] = 990; }
    H.clearLogs();

    const CLOUD = SpotanimType.getId('zulrah_venom_cloud');
    const drawn: { tick: number; x: number; z: number }[] = [];
    const origAnimMap = World.animMap.bind(World);
    (World as any).animMap = (level: number, x: number, z: number, spotanim: number, height: number, delay: number) => {
        if (spotanim === CLOUD) drawn.push({ tick: World.currentTick, x, z });
        origAnimMap(level, x, z, spotanim, height, delay);
    };
    const where = [p.x, p.z];
    H.runNpcProc(theSnake()!, '[proc,zulrah_venom_barrage]', p);
    for (let t = 0; t < 30; t++) { (p as any).clearPendingAction(); H.tick(1); p.levels[HP] = 990; }
    (World as any).animMap = origAnimMap;
    check('a barrage draws a cloud', drawn.length > 0, true);
    check('  on the tile the player was standing on', drawn.length ? [drawn[0].x, drawn[0].z] : null, where);
    // ^zulrah_cloud_ticks is 25 and the re-timed graphic is one tick long, so a cloud that is
    // continuously visible is 25 draws on 25 consecutive ticks. Five - which is what a draw every
    // fifth tick gave - is the flicker the owner could not see.
    check('  and on every tick it burns, so it is continuously on screen', drawn.length, 25);
    const ticks = drawn.map(d => d.tick);
    check('  with no gap between one graphic and the next',
        ticks.every((t, i) => i === 0 || t === ticks[i - 1] + 1), true);
    // The graphic itself has to cover a whole 600ms tick or the gaps come back: six frames of five
    // 20ms client cycles each is thirty, which is one tick exactly.
    check('  because the graphic is one tick long, not a quarter of a second',
        [...(SeqType.get(SpotanimType.get(CLOUD).anim).delay ?? [])].reduce((a, b) => a + b, 0), 30);
    A.runProcProtected(p, '[proc,zulrah_end]');
    H.tick(2);
    H.despawn(p);
}

// ------------------------------------------------------------------ where the loot lands
console.log('EVERY DROP LANDS WHERE THE PLAYER CAN STAND');
{
    // "Zulrah dies in the water of its own pool, where nobody can walk", so its own table puts
    // everything under the player - and it does, except for the one drop that is NOT in its table.
    // [proc,droprate_bonus] hangs off [proc,npc_death] for every monster in the game and asks
    // [proc,droprate_coord] where to put its item; that proc knew about the Kraken's two and not
    // about Zulrah, so a boosted kill left one of its four items on npc_coord, out in the pool.
    const p = fresh(DOCK_BOAT[0] - 2, DOCK_BOAT[1] + 1);
    H.setVar(p, 'regicide_quest', REGICIDE_COMPLETE);
    H.setVar(p, 'zulrah_volunteered', 1);
    A.op(p, DOCK_BOAT[0], DOCK_BOAT[1], 'osrsloc_46241', 1);
    H.tick(10);
    p.levels[HP] = 990; p.baseLevels[HP] = 990;
    const snake = theSnake()!;
    H.setNpcVar(snake, 'npc_action_delay', World.currentTick + 900);
    const at = (p.level << 28) | (p.x << 14) | p.z;
    check('the bonus drop asks for the player\'s tile, not the water Zulrah died in',
        H.runNpcProc(snake, '[proc,droprate_coord]', p), [at]);
    check('  and the snake itself is standing somewhere nobody can walk',
        A.walkable(0, snake.x, snake.z), false);

    // And then the whole table, through a real kill, every obj checked against the collision map.
    const landed: { name: string; x: number; z: number }[] = [];
    const origAdd = World.addObj.bind(World);
    (World as any).addObj = (obj: Obj, receiver: unknown, duration: number) => {
        landed.push({ name: ObjType.get(obj.type).debugname!, x: obj.x, z: obj.z });
        origAdd(obj as any, receiver as any, duration);
    };
    // THE PLAYER IS HELD STILL FOR THE DEATH, and it has to be for this to mean anything.
    // [proc,npc_death] spends an npc_arrivedelay and an npc_delay before the table reads `coord`,
    // and [proc,droprate_coord] reads it again a moment later, so a player who retaliates and walks
    // two steps towards the pool in that window leaves the pile spread over the tiles they crossed.
    // That is the player moving, not the table choosing badly, and it is not what is under test.
    const stood = [p.x, p.z];
    H.runNpcProc(snake, '[proc,debug_kill_active]', p);
    for (let t = 0; t < 8; t++) { (p as any).clearPendingAction(); p.x = stood[0]; p.z = stood[1]; H.tick(1); }
    (World as any).addObj = origAdd;
    check('a kill drops something', landed.length > 0, true);
    check('  and every last item of it is on a tile the player can walk on',
        landed.filter(o => !A.walkable(0, o.x, o.z)).map(o => o.name + '@' + o.x + ',' + o.z), []);
    check('  all of it on the one tile, the one the player was standing on',
        landed.filter(o => o.x !== stood[0] || o.z !== stood[1]).map(o => o.name + '@' + o.x + ',' + o.z), []);
    A.runProcProtected(p, '[proc,zulrah_end]');
    H.tick(2);
    H.despawn(p);
}

// ------------------------------------------------------------------ dying there
console.log('DYING AT THE SHRINE');
{
    const p = fresh(DOCK_BOAT[0] - 2, DOCK_BOAT[1] + 1);
    H.setVar(p, 'regicide_quest', REGICIDE_COMPLETE);
    H.setVar(p, 'zulrah_volunteered', 1);
    H.give(p, 'shark', 10);
    H.give(p, 'coins', 200000);
    H.equip(p, { rhand: 'rune_scimitar' });
    A.op(p, DOCK_BOAT[0], DOCK_BOAT[1], 'osrsloc_46241', 1);
    H.tick(8);
    const carried = H.invCount(p, 'shark');
    // The real death path: the guard at the top of [queue,player_death_default] is what sends a
    // death at the shrine to Zulrah's own.
    A.enqueue(p, '[queue,player_death_default]');
    H.tick(14);
    check('dying there drops nothing on the floor', H.invCount(p, 'shark'), 0);
    check('  the priestess is holding it', H.getVar(p, 'zulrah_items_held'), 1);
    check('  and you are back on the dock', [p.x, p.z], [2176 + 29, 3008 + 48]);
    check('  the shrine went with you', theSnake(), null);

    // Free for the first fifty kills.
    H.setVar(p, 'zulrah_kills', 3);
    A.talk(p, 'zulandra_priestess', ['Are you holding anything of mine?']);
    H.tick(2);
    check('under fifty kills she gives it back for nothing',
        [H.invCount(p, 'shark'), H.getVar(p, 'zulrah_items_held')], [carried, 0]);
    check('  and the equipment too', H.invCount(p, 'rune_scimitar'), 1);

    // And after fifty she charges.
    H.setVar(p, 'zulrah_kills', 50);
    H.setVar(p, 'zulrah_items_held', 1);
    H.clearInv(p);
    H.give(p, 'shark', 1);
    A.runProcProtected(p, '[proc,zulrah_stash_items]');
    H.tick(1);
    H.give(p, 'coins', 99999);
    A.talk(p, 'zulandra_priestess', ['Are you holding anything of mine?']);
    check('past fifty kills 99,999 coins is not enough',
        [H.invCount(p, 'shark'), H.getVar(p, 'zulrah_items_held')], [0, 1]);
    H.give(p, 'coins', 1);
    A.talk(p, 'zulandra_priestess', ['Are you holding anything of mine?']);
    check('  100,000 is', [H.invCount(p, 'shark'), H.invCount(p, 'coins')], [1, 0]);

    // An ordinary death while she is still holding something loses it.
    H.give(p, 'shark', 5);
    A.runProcProtected(p, '[proc,zulrah_stash_items]');
    H.tick(1);
    check('she is holding it again', H.getVar(p, 'zulrah_items_held'), 1);
    A.runProcProtected(p, '[proc,zulrah_deathbank_lost]');
    check('an unsafe death anywhere else destroys the lot',
        [H.getVar(p, 'zulrah_items_held'), H.invCount(p, 'shark')], [0, 0]);
    H.despawn(p);
}

// ------------------------------------------------------------------ the drop table
console.log('THE DROP TABLE, at the wiki\'s rates');
{
    // TWO HUNDRED THOUSAND ROLLS, NOT TEN THOUSAND KILLS. ~zulrah_roll is the whole of one of the
    // two rolls a kill gets - the unique table at 1/256, or else the main table out of 249 - and
    // calling it directly costs no game tick at all, where a kill costs four. So this reads a
    // hundred thousand kills' worth of table in seconds rather than a hundred thousand kills in an
    // hour, and every rate below is tight enough to catch a weight that is one out.
    //
    // The three things NOT in ~zulrah_roll - the 100% scales, the clue, the jar and the pet - are
    // read off the table the game itself shows, further down.
    const drops = new Map<string, number>();
    const origAdd = (World as any).addObj.bind(World);
    (World as any).addObj = (obj: Obj) => {
        const name = ObjType.get(obj.type).debugname!;
        drops.set(name, (drops.get(name) ?? 0) + 1);
    };
    const p = fresh();
    // Run as the SNAKE with the player active, which is what a death table is: a unique writes an
    // adventure log line and a broadcast, and both of those want npc_name.
    const snake = H.addNpc('zulrah', p.x + 8, p.z);
    const ROLLS = 200000, KILLS = ROLLS / 2;
    const at = (p.level << 28) | (p.x << 14) | p.z;
    for (let i = 0; i < ROLLS; i++) {
        if (i % 2000 === 0) H.clearLogs();
        H.runNpcProc(snake, '[proc,zulrah_roll]', p, [at]);
    }
    (World as any).addObj = origAdd;
    const got = (o: string) => drops.get(o) ?? 0;
    const rate = (o: string) => got(o) === 0 ? Infinity : Math.round(KILLS / got(o));
    console.log(`  ${ROLLS} rolls = ${KILLS} kills' worth; ${[...drops.values()].reduce((a, b) => a + b, 0)} objs`);

    // THE UNIQUES. "It's 1/256 per roll, you get two rolls per kill" - so the table hits about one
    // kill in 128, and each of its four items about one kill in 512.
    const UNI = ['tanzanite_fang', 'magic_fang', 'serpentine_visage', 'uncut_onyx'];
    const uniques = UNI.reduce((a, o) => a + got(o), 0);
    // The tolerances are three standard deviations of the count at this many rolls, not a guess:
    // about 780 uniques in all and 195 of each, so the table's rate moves by ~5 and one item's by
    // ~37 just from the dice. Anything wider than that is a weight that is actually wrong - a
    // missing item reads as no drops at all, and a doubled one as 1 in 256.
    near('the unique table, 1 kill in 128', Math.round(KILLS / uniques), 128, 14);
    for (const o of UNI) {
        near(`  ${o}, 1 kill in 512`, rate(o), 512, 110);
    }
    // THE MAIN TABLE, two rolls of 249, so an n/249 row comes 1 kill in 249/(2n).
    const want249 = (o: string, w: number, tol: number) =>
        near(`  ${o}, ${w}/249 twice`, rate(o), Math.round(249 / (2 * w)), tol);
    want249('cert_flax', 10, 1);
    want249('cert_battlestaff', 10, 1);
    want249('dragon_med_helm', 2, 8);
    want249('dragon_halberd', 2, 8);
    want249('deathrune', 12, 2);      // the rare drop table pays death runes too
    want249('lawrune', 12, 2);
    want249('chaosrune', 12, 1);
    want249('cert_unidentified_snapdragon', 2, 8);
    want249('cert_unidentified_dwarf_weed', 2, 8);
    want249('cert_unidentified_toadflax', 2, 8);
    want249('cert_unidentified_torstol', 2, 8);
    want249('palm_tree_seed', 6, 3);
    want249('papaya_tree_seed', 6, 3);
    want249('calquat_tree_seed', 6, 3);
    want249('magic_tree_seed', 4, 4);
    want249('cert_runite_ore', 11, 1);
    want249('cert_blankrune_high', 10, 1);
    want249('cert_yew_logs', 10, 1);
    want249('cert_adamantite_bar', 8, 2);
    want249('cert_coal', 8, 2);
    want249('cert_dragon_bones', 8, 2);
    want249('cert_mahogany_logs', 8, 2);
    want249('cert_raw_shark', 4.5, 4);   // the shark table's own 3:3:2 - 4.5 of the 249
    want249('cert_mantaray', 3, 5);
    want249('zul_andra_teleport', 15, 1);
    want249('cert_4dose2antipoison', 9, 2);
    want249('dragon_bolttips', 8, 2);
    want249('cert_grapes', 6, 3);
    want249('cert_coconut', 6, 3);
    want249('swamp_tar', 5, 3);
    // And the three the table cannot give, whose weights are in it as nothing: snakeskin, the
    // shark lure and the spirit seed. Nothing else should be missing.
    check('nothing from the rare drop table is missing either', got('nature_talisman') > 0, true);
    H.despawn(p);
}

console.log('THE TABLE THE GAME SHOWS');
{
    // The 100% drop and the three tertiaries are not in ~zulrah_roll - they are in the death table
    // itself. tools/gennpcdrops.py reads that same script and writes what the drop viewer shows, so
    // the shipped table is where to read them, and gennpcdrops --check is what keeps it honest.
    const row = fs.readFileSync('../content/scripts/drop_tables/configs/npc_drops.dbrow', 'utf8')
        .split(/\[npc_drops_/).find(b => b.startsWith('zulrah]')) ?? '';
    const has = (s: string) => row.includes(s);
    check('Zulrah\'s scales, 100-299, always', has('data=drop,zulrahs_scales,Zulrah\'s scales,100-299,Always'), true);
    check('  a clue at 1 in 75', has(',1/75'), true);
    check('  the jar at 1 in 3,000', has('data=drop,jar_of_swamp,Jar of Swamp,1,1/3000'), true);
    check('  the pet at 1 in 4,000', has('data=drop,bosspet_snakeling_item,Pet Snakeling,1,1/4000'), true);
    check('  and the four uniques at 1 in 512 each',
        ['tanzanite_fang', 'magic_fang', 'serpentine_visage', 'uncut_onyx']
            .every(o => row.includes(`data=drop,${o},`) && row.includes('1/512')), true);
}

// ------------------------------------------------------------------ the two trackers
// THE KILL COUNT AND THE COLLECTION LOG, the two player-facing trackers Zulrah was missing.
//
// WHY THIS IS A REAL KILL AND NOT A PROC CALL. Zulrah is the one boss whose [ai_queue3] is its own
// death script rather than an engine drop table, and the only thing that carries the kill to
// ~boss_kill_record is the gosub(npc_death) that script opens with. Calling ~boss_kill_record
// directly would pass whatever that line does or does not do, so every kill here goes through
// ::~debug_kill_active - hero points, damage to zero, npc_queue(3) - which is the same path a
// player's last hit takes.
//
// AND ONCE PER KILL, NOT ONCE PER COLOUR. Zulrah wears three npc records and the fight moves
// between them with npc_changetype_keepall, so all three map to the one slot in boss_kill_index.
// Three kills in three colours must read three, which is the number a mapping that double-counted
// a colour change could not produce.
console.log('THE KILL COUNT AND THE COLLECTION LOG');
{
    const ZULRAH_SLOT = 13;
    const COLOURS = ['zulrah', 'zulrah_magma', 'zulrah_tanzanite'];
    // The log is a perm inv of stackall slots, one per distinct item ever obtained
    // (content/scripts/collection_log/configs/collection_log.inv).
    const logCount = (who: any, name: string) => {
        const inv = who.getInventory(InvType.getId('collection_log'));
        if (!inv) return 0;
        const id = ObjType.getId(name);
        let c = 0;
        for (let s = 0; s < inv.capacity; s++) {
            const o = inv.get(s);
            if (o && o.id === id) c += o.count;
        }
        return c;
    };
    const p = fresh();
    // A second player standing beside the fight who never lands a hit. The count is credited on
    // npc_findhero, not on who was nearby, so this one must end on nothing.
    const bystander = fresh();
    const killOne = (colour: string, at: number) => {
        const snake = H.addNpc(colour, p.x + at, p.z + 6);
        H.runNpcProc(snake, '[proc,debug_kill_active]', p);
        // npc_death spends an npc_arrivedelay of up to two ticks and an npc_delay(1) of its own,
        // and the kill count's message is a player queue on top of that.
        H.tick(8);
    };
    const said = A.mark();
    COLOURS.forEach((c, i) => killOne(c, 2 + i * 8));
    check('three kills, one in each of Zulrah\'s three colours, count three',
        H.getVar(p, 'boss_kc_zulrah'), 3);
    check('  and the window\'s own read-back agrees, on slot 13',
        H.runProc(p, '[proc,boss_kill_get]', [ZULRAH_SLOT]), [3]);
    check('  the player who never hit it is credited with none',
        H.getVar(bystander, 'boss_kc_zulrah'), 0);
    // One message per kill, counting up - two for one kill would be the double count showing.
    check('  and the player is told the running count once per kill, by name',
        A.mesSince(p, said).filter(m => m.startsWith('Your Zulrah kill count is:')),
        ['Your Zulrah kill count is: 1.', 'Your Zulrah kill count is: 2.',
         'Your Zulrah kill count is: 3.']);
    // The three colours are three npc records against the ONE slot - read back off the shipped
    // enum, which is what the game reads.
    const idx = EnumType.getByName('boss_kill_index')!;
    check('all three colours map to that one slot in boss_kill_index',
        COLOURS.map(c => (idx as any).values?.get?.(NpcType.getId(c))), [13, 13, 13]);

    // THE COLLECTION LOG. ~zulrah_unique is the real unique path - it picks one of the four, drops
    // it through ~zulrah_rare_at and announces it, and ~broadcast_drop is where ~collection_log_add
    // hangs. Forty rolls of a one-in-four leaves any one item out about four times in a hundred
    // thousand, which is far below the rate of anything else here going wrong.
    const snake = H.addNpc('zulrah', p.x + 2, p.z + 12);
    const at = (p.level << 28) | (p.x << 14) | p.z;
    for (let i = 0; i < 40; i++) {
        if (i % 10 === 0) H.clearLogs();
        H.runNpcProc(snake, '[proc,zulrah_unique]', p, [at]);
    }
    H.runNpcProc(snake, '[proc,zulrah_rare_at]', p, [at, ObjType.getId('jar_of_swamp'), 1]);
    H.tick(2);
    check('every unique Zulrah drops lands in the collection log',
        ['tanzanite_fang', 'magic_fang', 'serpentine_visage', 'uncut_onyx']
            .map(o => logCount(p, o) > 0), [true, true, true, true]);
    check('  and so does the jar of swamp', logCount(p, 'jar_of_swamp'), 1);
    // The pet comes through ~broadcast_pet rather than ~broadcast_drop, so it is its own path.
    A.runProcProtected(p, '[proc,bosspet_roll]', [ObjType.getId('bosspet_snakeling_item'), 1]);
    H.tick(3);
    check('  and the snakeling, which arrives through the pet system', logCount(p, 'bosspet_snakeling_item'), 1);

    // THE PAGE ITSELF is a dbrow written by tools/gencollectionlog.py, and the window reads that
    // and nothing else - so the shipped dbrow is where to read what the page carries.
    const page = fs.readFileSync('../content/scripts/collection_log/configs/collection_log.dbrow', 'utf8')
        .split(/\[collection_log_/).find(b => b.startsWith('zulrah]')) ?? '';
    check('the log has a Zulrah page', page.includes('data=name,"Zulrah"'), true);
    check('  carrying its six collectables and nothing common',
        (page.match(/^data=items,(\S+)$/gm) ?? []).map(l => l.split(',')[1]),
        ['bosspet_snakeling_item', 'tanzanite_fang', 'magic_fang', 'serpentine_visage',
         'uncut_onyx', 'jar_of_swamp']);
    check('  no clue on it - a clue belongs to the Clues tab by its tier, as every other boss page here has it',
        /clue/i.test(page), false);
    check('  and the kill count on it is Zulrah\'s slot',
        page.includes(`data=counters,"Zulrah kills",${ZULRAH_SLOT}`), true);
    check('  which the log reads back as the three kills above',
        H.runProc(p, '[proc,collection_log_counter_get]', [ZULRAH_SLOT]), [3]);
    H.despawn(p, bystander);
}


console.log('THE PET, through the pet system');
{
    const p = fresh();
    const ITEM = ObjType.getId('bosspet_snakeling_item');
    check('the pet is a follower npc with the flag the petfix round asks for',
        NpcType.get(NpcType.getId('bosspet_snakeling')).follower, true);
    // ~bosspet_roll(pet, 1) is random(1) = 0, so it always hits: the roll itself, not a shortcut.
    // Old School's pet never hits the floor - with an empty follower slot it walks out beside you.
    A.runProcProtected(p, '[proc,bosspet_roll]', [ITEM, 1]);
    H.tick(3);
    const pet = H.followerOf(p);
    check('a roll that hits puts the pet at your heel (~pet_receive)',
        pet ? NpcType.get(pet.type).debugname : null, 'bosspet_snakeling');
    if (pet) H.opNpc(p, pet, 1);
    H.tick(3);
    check('  Pick-up puts it in the pack', H.invCount(p, 'bosspet_snakeling_item'), 1);
    check('  and the follower slot is free again', H.followerOf(p), null);
    A.held(p, 'bosspet_snakeling_item', 5);   // Drop = put it down
    H.tick(3);
    check('  Drop puts it back down', H.followerOf(p) !== null, true);
    check('  and it is out of the pack', H.invCount(p, 'bosspet_snakeling_item'), 0);
    // Owning one already refuses a second, which is what makes the 1/4,000 a real 1/4,000.
    A.runProcProtected(p, '[proc,bosspet_roll]', [ITEM, 1]);
    H.tick(3);
    check('  a second roll while you own one gives you nothing',
        H.invCount(p, 'bosspet_snakeling_item'), 0);
    H.despawn(p);
}

console.log('THE TOXIC BLOWPIPE HAS A SOURCE NOW');
{
    const spec = JSON.parse(fs.readFileSync('../content/tools/nosourcespec.json', 'utf8'));
    const objs = spec.objs;
    const listed = ['tanzanite_fang', 'toxic_blowpipe', 'toxic_blowpipe_empty', 'zulrahs_scales']
        .filter(o => o in objs || Object.values(objs).some((e: any) => (e.also ?? []).includes(o)));
    check('none of the four is excused by nosourcespec.json any more', listed, []);
}

// ------------------------------------------------------------------ the serpentine helm
console.log('THE SERPENTINE HELM');
{
    const p = fresh();
    p.setLevel(CRAFT, 51);
    H.give(p, 'chisel'); H.give(p, 'serpentine_visage');
    A.useHeld(p, 'chisel', 'serpentine_visage');
    check('refused at 51 Crafting', [H.invCount(p, 'serpentine_visage'), H.invCount(p, 'serpentine_helm_uncharged')], [1, 0]);
    p.setLevel(CRAFT, 52);
    const xp0 = p.stats[CRAFT];
    A.useHeld(p, 'chisel', 'serpentine_visage');
    check('at 52 a visage carves into an uncharged helm',
        [H.invCount(p, 'serpentine_visage'), H.invCount(p, 'serpentine_helm_uncharged')], [0, 1]);
    check('  for 120 Crafting xp', (p.stats[CRAFT] - xp0) / 10, 120);

    H.give(p, 'zulrahs_scales', 500);
    A.useHeld(p, 'zulrahs_scales', 'serpentine_helm_uncharged');
    check('scales charge it and it becomes the charged helm',
        [H.invCount(p, 'serpentine_helm'), H.getVar(p, 'serpentine_helm_charges')], [1, 500]);

    p.setLevel(DEF, 74);
    A.held(p, 'serpentine_helm', 2);
    check('74 Defence cannot wear it', H.invCount(p, 'serpentine_helm'), 1);
    p.setLevel(DEF, 75);
    A.held(p, 'serpentine_helm', 2);
    H.tick(1);
    check('75 Defence can', H.invCount(p, 'serpentine_helm'), 0);

    // Poison and venom both bounce off a charged one.
    A.enqueue(p, '[queue,venom_player]', [0]);
    H.tick(2);
    check('a charged helm is immune to venom', H.getVar(p, 'venom'), 0);
    A.enqueue(p, '[queue,poison_player]', [50]);
    H.tick(2);
    check('  and to poison', H.getVar(p, 'poison'), 0);

    // Ten scales on entering combat, ten more every 90 ticks.
    H.setVar(p, 'serpentine_helm_charges', 100);
    A.runProcProtected(p, '[proc,serpentine_helm_combat_entry]');
    check('entering combat costs ten scales', H.getVar(p, 'serpentine_helm_charges'), 90);
    H.setVar(p, 'barrows_lastcombat', 1000000);
    H.tick(91);
    check('  and ten more after 90 ticks of it', H.getVar(p, 'serpentine_helm_charges'), 80);

    // Run it dry in the hands: it stays on as the uncharged one.
    H.setVar(p, 'serpentine_helm_charges', 5);
    A.runProcProtected(p, '[proc,serpentine_helm_burn]');
    H.tick(1);
    check('running dry leaves the uncharged helm on your head',
        [H.getVar(p, 'serpentine_helm_charges'),
         ObjType.get(p.getInventory(InvType.WORN)!.get(0)!.id).debugname],
        [0, 'serpentine_helm_uncharged']);
    H.despawn(p);
}

// ------------------------------------------------------------------ the trident of the swamp
console.log('THE TRIDENT OF THE SWAMP');
{
    const p = fresh();
    p.setLevel(CRAFT, 58);
    H.give(p, 'chisel'); H.give(p, 'magic_fang'); H.give(p, 'trident_of_the_seas_uncharged');
    A.useHeld(p, 'magic_fang', 'trident_of_the_seas_uncharged');
    check('refused at 58 Crafting', H.invCount(p, 'trident_of_the_swamp_uncharged'), 0);
    p.setLevel(CRAFT, 59);
    A.useHeld(p, 'magic_fang', 'trident_of_the_seas_uncharged');
    check('at 59 the fang goes on',
        [H.invCount(p, 'magic_fang'), H.invCount(p, 'trident_of_the_seas_uncharged'),
         H.invCount(p, 'trident_of_the_swamp_uncharged')], [0, 0, 1]);
    A.useHeld(p, 'chisel', 'trident_of_the_swamp_uncharged');
    check('  and a chisel takes it off again - "a reversible process"',
        [H.invCount(p, 'magic_fang'), H.invCount(p, 'trident_of_the_seas_uncharged')], [1, 1]);
    A.useHeld(p, 'magic_fang', 'trident_of_the_seas_uncharged');

    H.give(p, 'deathrune', 50); H.give(p, 'chaosrune', 50);
    H.give(p, 'firerune', 500); H.give(p, 'zulrahs_scales', 30);
    A.useHeld(p, 'zulrahs_scales', 'trident_of_the_swamp_uncharged');
    check('a charge is a death, a chaos, five fire and one of Zulrah\'s scales',
        [H.getVar(p, 'swamp_trident_charges'), H.invCount(p, 'zulrahs_scales'),
         H.invCount(p, 'deathrune'), H.invCount(p, 'firerune')], [30, 0, 20, 350]);
    check('  and it becomes the charged trident', H.invCount(p, 'trident_of_the_swamp'), 1);

    p.setLevel(MAGIC, 77);
    A.held(p, 'trident_of_the_swamp', 2);
    check('77 Magic cannot wield it', H.invCount(p, 'trident_of_the_swamp'), 1);
    p.setLevel(MAGIC, 78);
    A.held(p, 'trident_of_the_swamp', 2);
    H.tick(1);
    check('78 Magic can', H.invCount(p, 'trident_of_the_swamp'), 0);
    check('  and the engine sees a charged trident in hand',
        H.runProc(p, '[proc,trident_armed]'), [1]);
    check('  with the swamp\'s own max hit offset of 2, not the seas\' 5',
        H.runProc(p, '[proc,trident_maxhit_offset]'), [2]);
    check('  reading the swamp trident\'s charges, not the other one\'s',
        H.runProc(p, '[proc,trident_charges_now]'), [30]);
    A.runProcProtected(p, '[proc,trident_spend_one]');
    check('  and spending one comes off the swamp trident',
        [H.getVar(p, 'swamp_trident_charges'), H.getVar(p, 'trident_charges')], [29, 0]);
    H.despawn(p);
}

console.log(`\n${ok + bad} checks: ${ok} ok, ${bad} FAILED`);
process.exit(bad === 0 ? 0 : 3);
