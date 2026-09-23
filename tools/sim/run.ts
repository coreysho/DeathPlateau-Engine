// One scenario per process: the world is stateful (player slots, zones, rsbuf) and reusing it
// across scenarios changes results. Usage: npx tsx tools/simtmp/run.ts <name>
import World from '#/engine/World.js';
import * as H from './harness.js';
import fs from 'fs';
import ObjType from '#/cache/config/ObjType.js';
import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';
import ExamineNpcHandler from '#/network/game/client/handler/ExamineNpcHandler.js';
import ExamineNpc from '#/network/game/client/model/ExamineNpc.js';
import InvType from '#/cache/config/InvType.js';
import DbRowType from '#/cache/config/DbRowType.js';

const MULTI: [number, number] = [3210, 3910];
const SINGLE: [number, number] = [3100, 3700];
const rel = (t: number, t0: number) => 't' + String(t - t0).padStart(2, '0');

await H.boot();
H.loginOrder();

function kit(p: any, rhand: string | null = 'abyssal_whip') {
    H.maxOut(p);
    if (rhand) H.equip(p, { rhand });
    H.runProc(p, '[proc,player_combat_stat]');
}
function dump(names: string[], t0: number) {
    for (const n of names) {
        console.log(
            `  ${n.padEnd(8)} took:`,
            H.hitsFor(n)
                .map(h => `${rel(h.tick, t0)}:${h.damage}`)
                .join(' ') || '(nothing)'
        );
    }
}

const which = process.argv[2];

if (which === 'baseline') {
    const a = H.makePlayer('atk', SINGLE[0], SINGLE[1], 1);
    const b = H.makePlayer('def', SINGLE[0] + 1, SINGLE[1], 2);
    H.tick(1);
    kit(a);
    kit(b);
    H.clearLogs();
    const t0 = World.currentTick;
    H.attack(a, b);
    H.tick(17);
    console.log('BASELINE  whip vs whip, singles');
    dump(['def', 'atk'], t0);
}

if (which === 'style') {
    const a = H.makePlayer('atk', SINGLE[0], SINGLE[1], 1);
    const b = H.makePlayer('def', SINGLE[0] + 1, SINGLE[1], 2);
    H.tick(1);
    kit(a);
    kit(b);
    // Auto-retaliate OFF on the defender. With it on, the defender hits back, the attacker
    // auto-retaliates in turn, and the fight carries on by retaliation even when the style click
    // has dropped the attacker's own target - which hides the bug rather than fixing it.
    H.setVar(b, 'option_nodef', 1);
    H.clearLogs();
    const t0 = World.currentTick;
    H.attack(a, b);
    H.tick(5);
    // The real path: a click on the combat tab, dispatched exactly as IfButtonHandler does it.
    console.log('  before click: target =', (a as any).target?.username ?? '(none)', ' com_mode =', H.getVar(a, 'com_mode'));
    H.ifButton(a, 'combat_whip:whip1');
    console.log('  after  click: target =', (a as any).target?.username ?? '(none)', ' com_mode =', H.getVar(a, 'com_mode'));
    H.tick(14);
    console.log('STYLE SWITCH  attacker clicks a different combat style on t05');
    dump(['def'], t0);
    console.log('  after the switch?', H.hitsFor('def').some(h => h.tick - t0 > 5) ? 'still attacking' : 'STOPPED');
    console.log('  messages:', H.mesgs.map(m => `${m.who}:${m.text}`).join(' | ') || '(none)');
}

if (which === 'eat') {
    const a = H.makePlayer('atk', SINGLE[0], SINGLE[1], 1);
    const b = H.makePlayer('def', SINGLE[0] + 1, SINGLE[1], 2);
    H.tick(1);
    kit(a);
    kit(b);
    H.give(b, 'shark', 10);
    b.setLevel(3, 40);
    H.clearLogs();
    const t0 = World.currentTick;
    H.attack(a, b);
    H.tick(3);
    const hpBefore = b.levels[3];
    H.opheld(b, 'shark', 1);
    H.tick(14);
    console.log('EATING  defender eats a shark on t03 while being whipped');
    dump(['def'], t0);
    console.log('  hp', hpBefore, '->', b.levels[3], '(shark heals 20)');
    console.log('  gaps between hits:', gaps(H.hitsFor('def').map(h => h.tick)));
}

if (which === 'drinkmove') {
    // A prayer potion, not a shark: every combat potion in consume_messages.dbrow carries
    // message_delay (super attack, super strength, prayer, ranging, antipoison, antifire...),
    // and message_delay is what used to be spent on p_delay. Plain food has none, which is why
    // eating a shark never showed the bug and drinking in a fight always did.
    const b = H.makePlayer('drinker', SINGLE[0], SINGLE[1], 1);
    H.tick(1);
    kit(b);
    H.give(b, '4doseprayerrestore', 5);
    b.setLevel(5, 1);
    H.clearLogs();
    const t0 = World.currentTick;
    const drank = H.opheld(b, '4doseprayerrestore', 1);
    const z0 = b.z;
    const trail: string[] = [];
    let refused = 0;
    for (let i = 0; i < 8; i++) {
        if (!H.walkTo(b, b.x, z0 + 6)) refused++;
        H.tick(1);
        trail.push(`${rel(World.currentTick, t0)}:z=${b.z}${b.delayed ? '*' : ''}`);
    }
    console.log('DRINK AND MOVE  drink a prayer potion, then click to walk north every tick');
    console.log('  drank?', drank, ' (* = engine had the player delayed that tick)');
    console.log(' ', trail.join(' '));
    console.log('  moved', b.z - z0, 'tiles in 8 ticks;', refused, 'of 8 walk clicks were thrown away');
    console.log('  prayer', b.levels[5]);
}

if (which === 'drink') {
    const a = H.makePlayer('atk', SINGLE[0], SINGLE[1], 1);
    const b = H.makePlayer('def', SINGLE[0] + 1, SINGLE[1], 2);
    H.tick(1);
    kit(a);
    kit(b);
    H.give(b, '4doseprayerrestore', 5);
    b.setLevel(5, 1);
    H.clearLogs();
    const t0 = World.currentTick;
    H.attack(a, b);
    H.tick(3);
    H.opheld(b, '4doseprayerrestore', 1);
    H.tick(16);
    console.log('DRINKING UNDER ATTACK  defender drinks a prayer potion on t03');
    dump(['def'], t0);
    console.log("  gaps between the attacker's hits:", gaps(H.hitsFor('def').map(h => h.tick)), '(a whip is 4)');
}

if (which === 'eatmove') {
    // out of combat: eat, then click to walk on the very next tick
    const b = H.makePlayer('eater', SINGLE[0], SINGLE[1], 1);
    H.tick(1);
    kit(b);
    H.give(b, 'shark', 10);
    b.setLevel(3, 40);
    H.clearLogs();
    const t0 = World.currentTick;
    H.opheld(b, 'shark', 1);
    const z0 = b.z;
    const trail: string[] = [];
    for (let i = 0; i < 8; i++) {
        H.walkTo(b, b.x, z0 + 6);
        H.tick(1);
        trail.push(`${rel(World.currentTick, t0)}:z=${b.z}${b.delayed ? '(delayed)' : ''}`);
    }
    console.log('EATING AND MOVING  eat a shark, then walk north every tick');
    console.log(' ', trail.join(' '));
    console.log('  moved', b.z - z0, 'tiles in 8 ticks');
}

if (which === 'stack') {
    // mage BEFORE the victim in the loop, meleer AFTER it: the order the bug needs
    const mage = H.makePlayer('mage', MULTI[0] - 4, MULTI[1], 1); // bucket 1
    const vic = H.makePlayer('vic', MULTI[0], MULTI[1], 2); // bucket 2
    const mele = H.makePlayer('mele', MULTI[0] + 1, MULTI[1], 3); // bucket 3
    H.tick(1);
    kit(mele);
    kit(vic);
    kit(mage, 'fire_battlestaff');
    for (const r of ['deathrune', 'bloodrune', 'airrune', 'chaosrune', 'earthrune', 'waterrune', 'firerune']) H.give(mage, r, 5000);
    H.setVarBit(mage, 'autocast_spell', 11);
    H.setVarBit(mage, 'autocast_set', 1);
    H.runProc(mage, '[proc,player_combat_stat]');
    H.clearLogs();
    const t0 = World.currentTick;
    H.attack(mele, vic);
    H.attack(mage, vic);
    H.tick(26);
    console.log('STACKING  mage and meleer on one target, multi');
    console.log('  loop order:', [...World.playerLoop.all()].map(p => p.username).join(' -> '));
    dump(['vic'], t0);
    const byTick = new Map<number, number>();
    for (const h of H.hitsFor('vic')) byTick.set(h.tick, (byTick.get(h.tick) ?? 0) + 1);
    console.log(
        '  ticks with two splats:',
        [...byTick.entries()]
            .filter(([, n]) => n > 1)
            .map(([t]) => rel(t, t0))
            .join(' ') || '(none)'
    );
}

if (which === 'stack2') {
    // The cleanest form of the question: TWO IDENTICAL MELEERS, same weapon, same speed, told to
    // attack on the same tick. Every hit of theirs is due on exactly the same tick as the other's.
    // One is placed in a loop bucket BEFORE the victim and one AFTER, which is the arrangement the
    // ordering bug needs - and which two real players' IP addresses decide for you.
    const m1 = H.makePlayer('early', MULTI[0] - 1, MULTI[1], 1); // bucket 1
    const vic = H.makePlayer('vic', MULTI[0], MULTI[1], 2); // bucket 2
    const m2 = H.makePlayer('late', MULTI[0] + 1, MULTI[1], 3); // bucket 3
    H.tick(1);
    kit(m1);
    kit(m2);
    kit(vic);
    vic.setLevel(3, 99);
    H.clearLogs();
    const t0 = World.currentTick;
    H.attack(m1, vic);
    H.attack(m2, vic);
    H.tick(21);
    console.log('STACKING (two identical whips, told to attack on the same tick)');
    console.log('  loop order:', [...World.playerLoop.all()].map(p => p.username).join(' -> '));
    const hs = H.hitsFor('vic');
    console.log('  victim took:', hs.map(h => `${rel(h.tick, t0)}:${h.damage}`).join(' '));
    const byTick = new Map<number, number>();
    for (const h of hs) byTick.set(h.tick, (byTick.get(h.tick) ?? 0) + 1);
    console.log(
        '  splats per tick:',
        [...byTick.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([t, n]) => `${rel(t, t0)}x${n}`)
            .join(' ')
    );
    console.log('  stacked ticks:', [...byTick.values()].filter(n => n > 1).length, 'of', byTick.size);
}

if (which === 'stack3') {
    // Same fight, but BOTH attackers placed before the victim in the loop.
    const m1 = H.makePlayer('e1', MULTI[0] - 1, MULTI[1], 1);
    const m2 = H.makePlayer('e2', MULTI[0] + 1, MULTI[1], 2);
    const vic = H.makePlayer('vic', MULTI[0], MULTI[1], 3);
    H.tick(1);
    kit(m1);
    kit(m2);
    kit(vic);
    vic.setLevel(3, 99);
    H.clearLogs();
    const t0 = World.currentTick;
    H.attack(m1, vic);
    H.attack(m2, vic);
    H.tick(21);
    console.log('STACKING (same fight, both attackers ahead of the victim in the loop)');
    console.log('  loop order:', [...World.playerLoop.all()].map(p => p.username).join(' -> '));
    const hs = H.hitsFor('vic');
    console.log('  victim took:', hs.map(h => `${rel(h.tick, t0)}:${h.damage}`).join(' '));
    const byTick = new Map<number, number>();
    for (const h of hs) byTick.set(h.tick, (byTick.get(h.tick) ?? 0) + 1);
    console.log(
        '  splats per tick:',
        [...byTick.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([t, n]) => `${rel(t, t0)}x${n}`)
            .join(' ')
    );
    console.log('  stacked ticks:', [...byTick.values()].filter(n => n > 1).length, 'of', byTick.size);
}

if (which === 'stack4') {
    // Both attackers AFTER the victim in the loop.
    const vic = H.makePlayer('vic', MULTI[0], MULTI[1], 1);
    const m1 = H.makePlayer('l1', MULTI[0] - 1, MULTI[1], 2);
    const m2 = H.makePlayer('l2', MULTI[0] + 1, MULTI[1], 3);
    H.tick(1);
    kit(m1);
    kit(m2);
    kit(vic);
    vic.setLevel(3, 99);
    H.clearLogs();
    const t0 = World.currentTick;
    H.attack(m1, vic);
    H.attack(m2, vic);
    H.tick(21);
    console.log('STACKING (both attackers behind the victim in the loop)');
    console.log('  loop order:', [...World.playerLoop.all()].map(p => p.username).join(' -> '));
    const byTick = new Map<number, number>();
    for (const h of H.hitsFor('vic')) byTick.set(h.tick, (byTick.get(h.tick) ?? 0) + 1);
    console.log(
        '  splats per tick:',
        [...byTick.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([t, n]) => `${rel(t, t0)}x${n}`)
            .join(' ')
    );
    console.log('  stacked ticks:', [...byTick.values()].filter(n => n > 1).length, 'of', byTick.size);
}

if (which.startsWith('pets')) {
    // Drop a pet, change floor, then walk - does it come with you and keep following?
    // One pet per process: the follower slot and the npc list carry over between drops otherwise.
    // Lumbridge castle, ground floor and the floor above it.
    const item = which.includes(':') ? which.split(':')[1] : 'bosspet_kbd_item';
    const GROUND: [number, number] = [3208, 3218];
    const p = H.makePlayer('owner', GROUND[0], GROUND[1], 1);
    H.tick(1);
    kit(p);
    H.clearLogs();
    H.give(p, item, 1);
    H.opheld(p, item, 5); // Drop puts the pet down
    H.tick(2);
    const pet = H.followerOf(p);
    console.log(`PETS  ${item}`);
    if (!pet) {
        console.log('   no follower after the drop. messages:', H.mesgs.map(m => m.text).join(' | ') || '(none)');
    } else {
        console.log(`   put down on L${pet.level} at ${Math.max(Math.abs(pet.x - p.x), Math.abs(pet.z - p.z))} tiles`);
        p.teleport(GROUND[0], GROUND[1], 1); // up the stairs
        H.tick(6);
        const mode = (pet as unknown as { targetOp: number }).targetOp;
        console.log(`   after changing floor: pet on L${pet.level}, player on L${p.level}, mode=${mode}${mode === 4 ? ' (playerfollow)' : ' (NOT following)'}`);
        for (let i = 0; i < 8; i++) {
            H.walkTo(p, p.x + 1, p.z);
            H.tick(1);
        }
        console.log(`   after walking 8 tiles: gap = ${Math.max(Math.abs(pet.x - p.x), Math.abs(pet.z - p.z))} tiles`);
        p.teleport(3290, 3180, 0); // and a long teleport on the same floor
        H.tick(4);
        console.log(`   after teleporting away: gap = ${Math.max(Math.abs(pet.x - p.x), Math.abs(pet.z - p.z))} tiles, pet on L${pet.level}`);
    }
}

if (which === 'ranges') {
    // Can you actually cook on every loc in the game that calls itself a range?
    const p = H.makePlayer('cook', SINGLE[0], SINGLE[1], 1);
    H.tick(1);
    kit(p);
    const names = ['range', 'loc_2729', 'loc_2730', 'loc_2731', 'rimmington_poor_range', 'ahoy_range', 'elf_village_range', 'fairy_range', 'loc_14919', 'carnilleanrange', 'newbierange', 'viking_seer_range'];
    console.log('RANGES  category and whether a cooking trigger would fire');
    for (const name of names) {
        const info = H.locCookInfo(name);
        console.log(`   ${name.padEnd(24)} category=${(info.category ?? 'NONE').padEnd(13)} cooks=${info.cooks}${info.ownHandler ? '  (own [oplocu] handler)' : ''}`);
    }
}

if (which === 'clues') {
    // Read every clue scroll in the game and report any that do not put readable text on screen.
    // if_openmain does not write a packet - it sets Player.modalMain and lets processClientsOut
    // send it - so the check is the modal id plus the text lines the script actually set.
    const p = H.makePlayer('clue', SINGLE[0], SINGLE[1], 1);
    H.tick(1);
    kit(p);
    const names = H.objNamesByParam('trail_desc');
    console.log(`CLUE SCROLLS  reading all ${names.length} objs that carry a trail_desc`);
    const broken: string[] = [];
    const modals = new Set<number>();
    let widest = 0;
    for (const name of names) {
        H.clearLogs();
        p.closeModal();
        try {
            H.give(p, name, 1);
            H.opheld(p, name, 1);
        } catch (e) {
            broken.push(`${name}: ${(e as Error).message}`);
            continue;
        }
        const modal = (p as unknown as { modalMain: number }).modalMain;
        const lines = H.ifaces.filter(i => i.kind === 'text' && (i.text ?? '').length > 0);
        const debug = H.mesgs.filter(m => m.text.includes('TRAIL DEBUG')).map(m => m.text);
        if (modal === -1 || lines.length === 0 || debug.length) {
            broken.push(`${name}: modal=${modal} lines=${lines.length} ${debug.join(' ')}`);
        }
        modals.add(modal);
        for (const l of lines) widest = Math.max(widest, l.text!.length);
        H.clearInv(p);
    }
    console.log(`  clues that fail to display: ${broken.length} of ${names.length}`);
    for (const b of broken) console.log('   ' + b);
    console.log('  interfaces used:', [...modals].join(', '), '(6965 = trail_cluelong, 6988 = trail_clue)');
    console.log('  longest line:', widest, 'characters');
}

if (which === 'hitdelay') {
    // How many ticks pass between the cast and the hitsplat, at every range the trident reaches.
    // The cast tick is read off the attacker's own animation rather than assumed, so the attack
    // cooldown between casts cannot skew it, and a splash simply contributes no pair.
    console.log('HIT DELAY  ticks from cast animation to hitsplat, trident of the seas');
    for (let range = 1; range <= 7; range++) {
        const a = H.makePlayer('a' + range, MULTI[0], MULTI[1] + range, 1);
        const b = H.makePlayer('b' + range, MULTI[0] + range, MULTI[1] + range, 2);
        H.tick(1);
        kit(a, 'trident_of_the_seas');
        kit(b);
        H.setVar(a, 'trident_charges', 2500);
        H.setVar(b, 'option_nodef', 1); // hold still, do not close the gap
        H.runProc(a, '[proc,player_combat_stat]');
        // Make every cast connect. What is being measured is the flight, not the accuracy roll, and
        // a splash contributes no cast/splat pair - without this a row can come back blank.
        H.setVar(a, 'com_magicattack', 100000);
        H.setVar(b, 'com_magicdef', 0);
        H.clearLogs();
        H.attack(a, b);
        // keep the attack going - a one-sided fight ends the interaction, and a single cast that
        // splashes would leave the row blank.
        for (let i = 0; i < 80; i++) {
            H.tick(1);
            b.setLevel(3, 99);
            if (!(a as unknown as { target: unknown }).target) H.attack(a, b);
        }
        const casts = H.anims.filter(x => x.who === a.username).map(x => x.tick);
        const splats = H.hitsFor(b.username).map(h => h.tick);
        // pair each splat with the most recent cast before it
        const deltas = new Set<number>();
        for (const s of splats) {
            const cast = casts.filter(c => c <= s).pop();
            if (cast !== undefined) deltas.add(s - cast);
        }
        const moved = a.x !== MULTI[0];
        console.log(`   ${range} tile${range === 1 ? ' ' : 's'} apart  ->  ${[...deltas].sort((x, y) => x - y).join(' or ') || '(no hits)'} ticks` + `   [${casts.length} casts, ${splats.length} hits${moved ? ', attacker moved - ignore' : ''}]`);
        H.despawn(a, b);
        H.tick(1);
    }
}

if (which === 'tridentsound') {
    const a = H.makePlayer('trid', SINGLE[0], SINGLE[1], 1);
    const b = H.makePlayer('tvic', SINGLE[0] + 6, SINGLE[1], 2);
    H.tick(1);
    kit(a, 'trident_of_the_seas');
    kit(b);
    H.setVar(a, 'trident_charges', 2500);
    H.runProc(a, '[proc,player_combat_stat]');
    H.clearLogs();
    const t0 = World.currentTick;
    H.attack(a, b);
    H.tick(20);
    // Sample lengths measured by running the client's own jagex2.sound.Wave decoder over the
    // .synth files, at the loop count the content passes to sound_synth.
    const LEN: Record<string, number> = { waterwave_cast_and_fire: 1320, waterwave_hit: 1349, spellfail: 1100 };
    console.log('TRIDENT AUDIO  5 casts at 6 tiles - the sounds the TRIDENT itself asks for');
    // Only the trident's own three; the rest are the defender punching back.
    const mine = H.soundsFor('trid').filter(s => s.synth in LEN);
    const spans = mine
        .map(s => {
            const start = (s.tick - t0) * 600 + s.delay * 20; // world ms; delay is in 20ms client frames
            return { name: s.synth, start, end: start + LEN[s.synth] };
        })
        .sort((x, y) => x.start - y.start);
    let overlaps = 0;
    for (let i = 1; i < spans.length; i++) {
        const clash = spans[i].start < spans[i - 1].end;
        if (clash) overlaps++;
        console.log(`   ${String(spans[i - 1].start).padStart(5)}-${String(spans[i - 1].end).padStart(5)}ms  ${spans[i - 1].name}${clash ? `   <-- overlapped by the next (${spans[i].start}ms)` : ''}`);
    }
    if (spans.length) {
        const l = spans[spans.length - 1];
        console.log(`   ${String(l.start).padStart(5)}-${String(l.end).padStart(5)}ms  ${l.name}`);
    }
    console.log('  casts:', 2500 - H.getVar(a, 'trident_charges'), ' trident sounds:', mine.length, ' OVERLAPPING PAIRS:', overlaps);
}

if (which === 'trident') {
    const a = H.makePlayer('trid', SINGLE[0], SINGLE[1], 1);
    const b = H.makePlayer('tvic', SINGLE[0] + 6, SINGLE[1], 2);
    H.tick(1);
    kit(a, 'trident_of_the_seas');
    kit(b);
    H.setVar(a, 'trident_charges', 2500);
    H.runProc(a, '[proc,player_combat_stat]');
    H.clearLogs();
    const t0 = World.currentTick;
    H.attack(a, b);
    H.tick(22);
    console.log('TRIDENT IN PVP  charged trident, target 6 tiles east');
    dump(['tvic'], t0);
    console.log('  attacker x:', SINGLE[0], '->', a.x, a.x === SINGLE[0] ? '(cast from range)' : '(walked into melee)');
    console.log('  charges:', H.getVar(a, 'trident_charges'), 'of 2500');
    console.log('  gaps:', gaps(H.hitsFor('tvic').map(h => h.tick)));
}

if (which.startsWith('barrows')) {
    // ONE BROTHER PER PROCESS. Fighting them back to back in one world leaves %lastcombat and
    // %aggressive_npc set from the previous fight, and the content's own "I'm already under attack"
    // rule then refuses the next one - a real singles rule, but not what is being measured here.
    const only = which.includes(':') ? which.split(':')[1] : 'barrows_ahrim';
    const p = H.makePlayer('digger', 3557, 9703, 1);
    p.teleport(3557, 9703, 3);
    H.tick(1);
    kit(p);
    p.setLevel(3, 99);
    // Exactly what ~barrows_search does when you open a sarcophagus: he is added on your tile,
    // told who woke him, and put into his attack mode.
    const npc = H.addNpcAt(only, p.x, p.z, 3);
    H.setNpcVar(npc, 'npc_aggressive_player', p.uid);
    H.setVar(p, 'aggressive_npc', npc.uid);
    if (H.hasScript('[proc,barrows_brother_engage]')) {
        H.runNpcProc(npc, '[proc,barrows_brother_engage]', p);
    } else {
        H.setNpcMode(npc, 'OPPLAYER2', p); // what ~barrows_search did for all six before the fix
    }
    H.clearLogs();
    const t0 = World.currentTick;
    H.tick(28);
    console.log(`BARROWS ${only}: woken on the player's tile, 28 ticks`);
    console.log(
        '   player took:',
        H.hitsFor('digger')
            .map(h => `${rel(h.tick, t0)}:${h.damage}`)
            .join(' ') || '(NOTHING - he never attacked)'
    );
    console.log('   npc ended in mode', (npc as any).targetOp, '(8=opplayer2, 13=applayer2, 1=wander)');
}

if (which === 'broadcast') {
    // What another player's chatbox actually receives: the real content procs, World.broadcastMes,
    // and the server's own line wrapping - so the output is exactly the strings the client draws.
    H.makePlayer('watcher', SINGLE[0], SINGLE[1], 1); // on the world only to receive the lines
    const cast: [string, number, number][] = [
        ['corey', 5, 1], // owner, Realism
        ['dev', 4, 10], // developer, 10x
        ['zezima', 0, 10], // no rank, 10x
        ['mod ash', 2, 5], // moderator, 5x
        ['newbie', 1, 0] // player moderator, never chose a mode
    ];
    const ps = cast.map(([n], i) => H.makePlayer(n, SINGLE[0] + 2 + i, SINGLE[1], 2 + i));
    const [corey, dev, zezima, modash, newbie] = ps;
    H.tick(2);
    cast.forEach(([, staff, rate], i) => {
        ps[i].staffModLevel = staff;
        H.setVar(ps[i], 'xp_rate', rate);
    });
    H.clearLogs();
    // ::broadcast is production-only in the engine, so the announcement is driven through its proc
    H.runProc(corey, '[proc,broadcast_staff]', ['Server update in 10 minutes - bank your items!']);
    H.runProc(corey, '[proc,broadcast_drop]', [ObjType.getId('abyssal_whip')]);
    H.runProc(dev, '[proc,broadcast_drop]', [ObjType.getId('trident_of_the_seas_full')]);
    H.runProc(zezima, '[proc,broadcast_drop]', [ObjType.getId('dragon_pickaxe')]);
    H.runProc(modash, '[proc,broadcast_pet]', [ObjType.getId('bosspet_kraken_item')]);
    H.runProc(newbie, '[proc,broadcast_news]', ['Fire cape!', 'defeated TzTok-Jad and claimed a @dre@Fire cape@bla@.']);
    const cheat = new ClientCheatHandler();
    cheat.handle(new ClientCheat('yell anyone up for barrows?'), corey);
    cheat.handle(new ClientCheat('yell @cr2@@red@i am totally an admin'), zezima);
    cheat.handle(new ClientCheat('yell selling full rune, dragon scimitar, 400 sharks - pm me or meet at edge bank'), modash);
    const lines = H.mesgs.filter(m => m.who === 'watcher').map(m => m.text);
    for (const l of lines) console.log('  ' + l);
    const out = process.argv[3];
    if (out) fs.writeFileSync(out, JSON.stringify(lines, null, 1));
}

if (which === 'examine') {
    // Examine through the real packet handler: what the player's chatbox receives for monsters with
    // and without an elemental weakness, and for one with no desc= of its own.
    const p = H.makePlayer('looker', 3222, 3222, 1);
    H.tick(2);
    const names = ['graardor', 'king_dragon', 'chaoselemental', 'kreearra', 'man', 'cave_kraken'];
    const npcs = names.map((n, i) => H.addNpcAt(n, 3223 + (i % 3) * 2, 3224 + Math.floor(i / 3) * 2, 0));
    H.tick(1);
    // ExamineNpcHandler.examine is everything past the visibility gate; the gate itself needs a
    // connected client's npc view, which a sim player never builds - so here it always refuses,
    // which is at least the right answer for an npc the player cannot see.
    for (let i = 0; i < npcs.length; i++) {
        H.mesgs.length = 0;
        ExamineNpcHandler.examine(p, npcs[i]);
        H.tick(1);
        console.log(`  ${names[i].padEnd(15)} ${H.mesgs.map(m => m.text).join('  |  ')}`);
    }
    const unseen = new ExamineNpcHandler().handle(new ExamineNpc(npcs[0].nid), p);
    console.log('  not in view    ' + (unseen ? 'ANSWERED - should not be' : 'refused'));
}

if (which === 'vengeance' || which.startsWith('vengeance:')) {
    // VENGEANCE (content skill_magic/scripts/lunar/vengeance.rs2). Every case makes its own players,
    // so the cases do not see each other's %lastcombat; `vengeance:<case>` runs one on its own.
    //
    // Two ways a hit gets in. A REAL one is a fight - H.attack, the engine's own interaction, the
    // content's own rolls. An INJECTED one is ~.pvp_damage called straight from the attacker with
    // a chosen number: the same proc every pvp attack ends in, so everything from "the hit is queued
    // on the defender" onward is the real path, and the rules can be checked against exact numbers.
    const only = which.includes(':') ? which.split(':')[1] : null;
    const R = { ok: 0, bad: 0 };
    const check = (what: string, got: unknown, want: unknown) => {
        const pass = JSON.stringify(got) === JSON.stringify(want);
        if (pass) R.ok++;
        else R.bad++;
        console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
    };
    const note = (s: string) => console.log('       ' + s);
    const vkit = (p: any, rhand: string | null = 'abyssal_whip') => {
        kit(p, rhand);
        for (const r of ['astralrune', 'deathrune', 'earthrune']) H.give(p, r, 1000);
    };
    const veng = (p: any) => H.getVar(p, 'vengeance');
    const inject = (atk: any, def: any, damage: number, delay = 0) => H.runProc(atk, '[proc,.pvp_damage]', [delay, damage], def);
    const dmg = (name: string) => H.hitsFor(name).map(h => h.damage);
    const taste = (name: string) => H.saysFor(name).filter(s => s.text === 'Taste vengeance!').length;
    let x = MULTI[0] - 20;
    const pair = (a: string, b: string) => {
        x += 4;
        const pa = H.makePlayer(a, x, MULTI[1] + 6, 1);
        const pb = H.makePlayer(b, x + 1, MULTI[1] + 6, 2);
        H.tick(1);
        vkit(pa);
        vkit(pb);
        return [pa, pb];
    };
    const cases: Record<string, () => void> = {
        rules: () => {
            console.log('RULES  injected hits of chosen size on a vengeanced defender');
            const [a, b] = pair('ra', 'rb');
            for (const [hit, want] of [
                [0, []],
                [1, [1]],
                [4, [3]],
                [80, [60]],
                [81, [60]]
            ] as [number, number[]][]) {
                a.setLevel(3, 99);
                b.setLevel(3, 99);
                H.setVar(b, 'vengeance', 1);
                H.clearLogs();
                inject(a, b, hit);
                H.tick(3);
                check(`a hit of ${hit} rebounds`, dmg('ra'), want);
                check(`  ...and the effect is ${hit ? 'used up' : 'still on'}`, veng(b), hit ? 0 : 1);
                check(`  ..."Taste vengeance!" said`, taste('rb'), hit ? 1 : 0);
            }
            H.despawn(a, b);
        },

        melee: () => {
            console.log('MELEE  a real whip fight; the defender is vengeanced and does not hit back');
            const [a, b] = pair('ma', 'mb');
            H.setVar(b, 'option_nodef', 1);
            b.setLevel(1, 1); // Defence 1, so a whip lands soon
            H.ifButton(b, 'lunar_magic:vengeance');
            check('the cast put vengeance on', veng(b), 1);
            H.clearLogs();
            const t0 = World.currentTick;
            H.attack(a, b);
            let landed = -1;
            for (let i = 0; i < 40 && landed < 0; i++) {
                H.tick(1);
                const h = H.hitsFor('mb').find(h => h.damage > 0);
                if (h) landed = h.tick;
            }
            H.tick(2);
            const first = H.hitsFor('mb').find(h => h.damage > 0)!;
            const zeros = H.hitsFor('mb').filter(h => h.tick < first.tick && h.damage === 0).length;
            note(`defender took ${H.hitsFor('mb').map(h => `${rel(h.tick, t0)}:${h.damage}`).join(' ')}`);
            note(`attacker took ${H.hitsFor('ma').map(h => `${rel(h.tick, t0)}:${h.damage}`).join(' ') || '(nothing)'}`);
            check(`the first hit that did damage (${first.damage}) rebounds 75%`, dmg('ma'), [Math.max(1, Math.floor((first.damage * 3) / 4))]);
            check('  ...on the tick it landed', H.hitsFor('ma').map(h => h.tick - first.tick), [0]);
            check(`  ...and the ${zeros} miss(es) before it did not use it up`, taste('mb'), 1);
            check('  ...and it is used up', veng(b), 0);
            H.despawn(a, b);
        },

        sametick: () => {
            // The stack scenario's fight - a fire bolt and a whip on one target in multi, the mage
            // ahead of the victim in the player loop and the meleer behind it, which is the
            // arrangement that used to split a stack across two ticks. Vengeance is put back on at
            // the start of EVERY tick, so every tick that lands damage is a chance to rebound twice.
            console.log('SAME TICK  two hits due on one tick, from either side of the victim in the player loop');
            {
                const p1 = H.makePlayer('sfirst', MULTI[0] - 1, MULTI[1] + 3, 1); // bucket 1, ahead of the victim
                const v = H.makePlayer('svict', MULTI[0], MULTI[1] + 3, 2);
                const p2 = H.makePlayer('slast', MULTI[0] + 1, MULTI[1] + 3, 3); // bucket 3, behind it
                H.tick(1);
                for (const p of [p1, v, p2]) vkit(p);
                H.setVar(v, 'vengeance', 1);
                H.clearLogs();
                inject(p1, v, 20, 1);
                inject(p2, v, 40, 1);
                H.tick(3);
                const landed = H.hitsFor('svict');
                check('both hits landed on one tick', [landed.map(h => h.damage), new Set(landed.map(h => h.tick)).size], [[20, 40], 1]);
                check('one "Taste vengeance!"', taste('svict'), 1);
                check('one rebound, 75% of the first hit, to the one who dealt it', [dmg('sfirst'), dmg('slast')], [[15], []]);
                H.despawn(p1, v, p2);
            }
            console.log('SAME TICK  magic and melee landing together, vengeance re-armed every tick');
            const mage = H.makePlayer('smage', MULTI[0] - 4, MULTI[1], 1);
            const vic = H.makePlayer('svic', MULTI[0], MULTI[1], 2);
            const mele = H.makePlayer('smele', MULTI[0] + 1, MULTI[1], 3);
            H.tick(1);
            vkit(mele);
            vkit(vic);
            vkit(mage, 'fire_battlestaff');
            for (const r of ['deathrune', 'bloodrune', 'airrune', 'chaosrune', 'earthrune', 'waterrune', 'firerune']) H.give(mage, r, 5000);
            H.setVarBit(mage, 'autocast_spell', 11);
            H.setVarBit(mage, 'autocast_set', 1);
            H.runProc(mage, '[proc,player_combat_stat]');
            H.setVar(vic, 'option_nodef', 1);
            vic.setLevel(1, 1);
            H.clearLogs();
            const t0 = World.currentTick;
            H.attack(mele, vic);
            H.attack(mage, vic);
            let stacked = 0;
            let stackedOk = 0;
            for (let i = 0; i < 120; i++) {
                // everyone topped up, or the rebounds wear the attackers down and get capped at what
                // they have left - correct, but not what this is counting
                for (const p of [vic, mage, mele]) p.setLevel(3, 99);
                H.setVar(vic, 'vengeance', 1);
                H.tick(1);
            }
            H.tick(2);
            // Every tick that did damage should say "Taste vengeance!" once and send back one rebound,
            // 75% of the first damaging splat that tick. A rebound lands on the tick of the hit or the
            // next: it is queued on the attacker from inside the victim's queue, and an attacker who
            // sits ahead of the victim in the player loop has already had both of the tick's queue
            // passes by then - which is exactly how the ring of recoil lands too.
            // only the ticks vengeance was armed for: the loop's 120, not the two after it
            const ticks = [...new Set(H.hitsFor('svic').filter(h => h.damage > 0 && h.tick - t0 < 120).map(h => h.tick))].sort((p, q) => p - q);
            const rebounds = [...H.hitsFor('smage'), ...H.hitsFor('smele')].filter(h => h.tick - t0 < 120).sort((p, q) => p.tick - q.tick);
            const latency: Record<string, number> = {};
            let wrong = 0;
            ticks.forEach((t, n) => {
                const landed = H.hitsFor('svic').filter(h => h.tick === t);
                const hurt = landed.filter(h => h.damage > 0);
                const said = H.saysFor('svic').filter(s => s.tick === t && s.text === 'Taste vengeance!').length;
                const back = rebounds[n];
                const want = Math.max(1, Math.floor((hurt[0].damage * 3) / 4));
                const ok = said === 1 && back && back.damage === want && back.tick - t <= 1;
                if (back) latency[`${back.who} +${back.tick - t}`] = (latency[`${back.who} +${back.tick - t}`] ?? 0) + 1;
                if (!ok) {
                    wrong++;
                    note(`${rel(t, t0)}  MISMATCH splats ${landed.map(h => h.damage).join('+')} said x${said} rebound ${back ? `${back.who}:${back.damage}@${rel(back.tick, t0)}` : 'none'} want ${want}`);
                }
                if (landed.length > 1) {
                    stacked++;
                    if (ok) stackedOk++;
                    note(`${rel(t, t0)}  two splats ${landed.map(h => h.damage).join('+')} -> "Taste vengeance!" x${said}, rebound ${back ? `${back.who}:${back.damage} at +${back.tick - t}` : 'none'}`);
                }
            });
            note(`rebound latency, by who it landed on: ${JSON.stringify(latency)}`);
            check(`${ticks.length} ticks did damage; each said it once and rebounded 75% of its first hit`, wrong, 0);
            check('  ...and no rebound beyond those', rebounds.length, ticks.length);
            check('  ...and every stacked tick among them rebounded exactly once', stackedOk, stacked);
            note(`(${stacked} stacked tick(s) this run - the deterministic check above always makes one)`);
            H.despawn(mage, vic, mele);
        },

        recoil: () => {
            // Both wear a ring of recoil and both have vengeance on: the worst case for a loop. One
            // injected 40 from a to b must come back to a as a 30 and a 5 and then stop - a's own
            // vengeance and recoil must not answer them, and nothing must answer those.
            console.log('RECOIL  vengeance and a ring of recoil on both players, one hit of 40');
            const [a, b] = pair('ca', 'cb');
            for (const p of [a, b]) {
                H.equip(p, { ring: 'ring_of_recoil' });
                H.setVar(p, 'vengeance', 1);
            }
            H.setVar(b, 'pk_predator1', a.uid); // what ~pvp_attack sets: recoil rebounds onto it
            H.clearLogs();
            inject(a, b, 40);
            H.tick(6);
            check('b took', dmg('cb'), [40]);
            check('a took the vengeance 30 and the recoil 5, and nothing else', dmg('ca').sort((p, q) => p - q), [5, 30]);
            check("a's vengeance, untouched by either rebound", veng(a), 1);
            check("b's vengeance, used up", veng(b), 0);
            check('who said "Taste vengeance!"', [taste('ca'), taste('cb')], [0, 1]);
            H.despawn(a, b);
        },

        cooldown: () => {
            console.log('COOLDOWN  30 seconds, one for both spells, on the caster');
            const [c, d] = pair('kc', 'kd');
            const e = H.makePlayer('ke', x + 2, MULTI[1] + 6, 3);
            H.tick(1);
            vkit(e);
            const t0 = World.currentTick;
            const cast = (p: any) => {
                H.mesgs.length = 0;
                H.ifButton(p, 'lunar_magic:vengeance');
                return H.mesgs.filter(m => m.who === p.username).map(m => m.text);
            };
            check('cast: on, and 4 astral, 2 death and 10 earth spent', [cast(c), veng(c), H.invCount(c, 'astralrune'), H.invCount(c, 'deathrune'), H.invCount(c, 'earthrune')], [[], 1, 996, 998, 990]);
            check('cast again at once', cast(c), ['You can only cast vengeance spells every 30 seconds.']);
            check('  ...costs nothing', H.invCount(c, 'astralrune'), 996);
            inject(d, c, 10);
            H.tick(2);
            check('a hit uses it up', veng(c), 0);
            H.tick(t0 + 49 - World.currentTick);
            check(`t+${World.currentTick - t0}: still cooling down`, cast(c), ['You can only cast vengeance spells every 30 seconds.']);
            H.tick(1);
            check(`t+${World.currentTick - t0}: cast`, [cast(c), veng(c)], [[], 1]);
            check('on again while it is on', (H.tick(50), cast(c)), ['You already have the power of vengeance.']);

            // Vengeance Other: d on e. It is d's cooldown that starts, not e's.
            H.mesgs.length = 0;
            H.castOnPlayer(d, e, 'lunar_magic:vengeance_other');
            H.tick(2);
            check('Vengeance Other puts it on the target', veng(e), 1);
            check('  ...and tells them', H.mesgs.filter(m => m.who === 'ke').map(m => m.text), ['You have the power of vengeance!']);
            check('  ...3 astral, 2 death, 10 earth from the caster', [H.invCount(d, 'astralrune'), H.invCount(d, 'deathrune'), H.invCount(d, 'earthrune')], [997, 998, 990]);
            check("  ...the caster's own Vengeance now waits", cast(d), ['You can only cast vengeance spells every 30 seconds.']);
            check("  ...and the target's cooldown is not started", H.getVar(e, 'vengeance_cooldown') <= World.currentTick, true);
            // Accept Aid off
            H.setVar(c, 'option_aid', 2);
            H.setVar(c, 'vengeance', 0);
            H.tick(50);
            H.mesgs.length = 0;
            H.castOnPlayer(d, c, 'lunar_magic:vengeance_other');
            H.tick(2);
            check('on a player with Accept Aid off', [veng(c), H.mesgs.filter(m => m.who === 'kd').map(m => m.text)], [0, ['Kc is not accepting aid.']]);
            H.despawn(c, d, e);
        },

        npc: () => {
            console.log('NPC  a black demon attacks a vengeanced player, who does not hit back');
            x += 4;
            const p = H.makePlayer('np', x, MULTI[1] + 6, 1);
            H.tick(1);
            vkit(p);
            p.setLevel(1, 1);
            H.setVar(p, 'option_nodef', 1);
            H.ifButton(p, 'lunar_magic:vengeance');
            const npc = H.addNpcAt('black_demon', x + 1, MULTI[1] + 6, 0);
            H.setNpcVar(npc, 'npc_aggressive_player', p.uid);
            H.setVar(p, 'aggressive_npc', npc.uid);
            H.setNpcMode(npc, 'OPPLAYER2', p);
            H.clearLogs();
            const t0 = World.currentTick;
            let first: any = null;
            for (let i = 0; i < 60 && !first; i++) {
                p.setLevel(3, 99);
                H.tick(1);
                first = H.hitsFor('np').find(h => h.damage > 0) ?? null;
            }
            H.tick(3);
            note(`player took ${H.hitsFor('np').map(h => `${rel(h.tick, t0)}:${h.damage}`).join(' ')}`);
            note(`demon took  ${H.npcHitsFor('black_demon').map(h => `${rel(h.tick, t0)}:${h.damage}`).join(' ') || '(nothing)'}`);
            check('the demon landed a hit', first !== null, true);
            if (first) {
                check(`its first damaging hit (${first.damage}) rebounds 75% onto it`, H.npcHitsFor('black_demon').map(h => h.damage), [Math.max(1, Math.floor((first.damage * 3) / 4))]);
                check('  ..."Taste vengeance!"', taste('np'), 1);
                check('  ...used up', veng(p), 0);
            }
            H.despawn(p);
        },

        kill: () => {
            // The hit that kills. b has 5 hitpoints and takes an injected 20: the splat is 5, so the
            // rebound is 75% of 5 = 3, and it still lands although b is dead - death clears b's own
            // queues, and the rebound is on a's.
            console.log('KILL  vengeance on the hit that kills');
            const [a, b] = pair('ka', 'kb');
            b.setLevel(3, 5);
            H.setVar(b, 'vengeance', 1);
            H.clearLogs();
            inject(a, b, 20);
            H.tick(4);
            check('b took 5 of the 20, and is dead', [dmg('kb'), b.levels[3]], [[5], 0]);
            check('a took the rebound of what b actually lost', dmg('ka'), [3]);
            check('  ..."Taste vengeance!"', taste('kb'), 1);
            H.despawn(a, b);

            // both die: a is on 2 when it comes back
            const [c, d] = pair('kc2', 'kd2');
            d.setLevel(3, 5);
            c.setLevel(3, 2);
            H.setVar(d, 'vengeance', 1);
            H.clearLogs();
            inject(c, d, 20);
            H.tick(4);
            check('both at 0 - the killer dies of the rebound', [c.levels[3], d.levels[3]], [0, 0]);
            check('  ...a rebound of 2, not 3: never more than the killer has', dmg('kc2'), [2]);
            H.despawn(c, d);
        }
    };
    for (const [name, run] of Object.entries(cases)) {
        if (only && only !== name) continue;
        run();
        H.tick(2);
    }
    console.log(`VENGEANCE  ${R.ok} ok, ${R.bad} failed`);
}

if (which === 'lunar') {
    // Lunar Isle end to end, through the real triggers: Lokar's Travel on the Rellekka pier, the
    // landing, the walk to the Astral altar (the engine's own pathing over 474's map), the prayer
    // that gives the book, and the boat home. Magic 64 first, which the altar must refuse.
    console.log('LUNAR ISLE  Rellekka -> Lokar -> Lunar Isle -> the Astral altar -> Rellekka');
    const at = (p: any) => `${p.x},${p.z},${p.level}`;
    const p = H.makePlayer('moonie', 2628, 3700, 1);
    H.tick(1);
    H.maxOut(p);
    p.setLevel(6, 64);
    const rellekka = H.npcNear('lokar_searunner', p.x, p.z);
    console.log('  Lokar on the Rellekka pier:', rellekka ? `${rellekka.x},${rellekka.z}` : 'MISSING');
    H.opNpc(p, rellekka!, 3);
    H.tick(10);
    console.log('  after Travel:', at(p), '(want 2113,3892,0)');
    p.closeModal();
    H.tick(1);
    const island = H.npcNear('lokar_searunner', p.x, p.z);
    console.log('  Lokar on the Lunar pier:', island ? `${island.x},${island.z}` : 'MISSING');
    H.clearLogs();
    H.opLoc(p, 2157, 3863, 'astral_altar', 2);
    let t = 0;
    for (; t < 60 && !H.ifaces.length && H.getVar(p, 'lunar_unlocked') !== 1; t++) H.tick(1);
    H.tick(2);
    console.log(`  Magic 64, pray: reached ${at(p)} after ${t} ticks; unlocked=${H.getVar(p, 'lunar_unlocked')} spellbook=${H.getVar(p, 'spellbook')} (want -1 or 0, and 0)`);
    p.closeModal();
    p.setLevel(6, 65);
    H.tick(1);
    H.opLoc(p, 2157, 3863, 'astral_altar', 2);
    for (t = 0; t < 20 && H.getVar(p, 'lunar_unlocked') !== 1; t++) H.tick(1);
    H.tick(1);
    console.log(`  Magic 65, pray: unlocked=${H.getVar(p, 'lunar_unlocked')} spellbook=${H.getVar(p, 'spellbook')} (want 1 and 2)`);
    p.closeModal();
    H.tick(1);
    // and home: the walk back to Lokar is the engine's too
    H.opNpc(p, island!, 3);
    for (t = 0; t < 90 && p.z > 3800; t++) H.tick(1);
    H.tick(2);
    console.log('  after Travel home:', at(p), '(want 2628,3700,0)');
}

if (which === 'lunarspells' || which.startsWith('lunarspells:')) {
    // Every Lunar spell cast through the same entry point a click uses (the button, or Cast on a
    // player, npc, held obj or loc), with what it did to the caster, the target and the world.
    // Vengeance has a scenario of its own. `lunarspells:<case>` runs one.
    const only = which.includes(':') ? which.split(':')[1] : null;
    const R = { ok: 0, bad: 0 };
    const check = (what: string, got: unknown, want: unknown) => {
        const pass = JSON.stringify(got) === JSON.stringify(want);
        if (pass) R.ok++;
        else R.bad++;
        console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
    };
    const RUNES = ['astralrune', 'earthrune', 'waterrune', 'firerune', 'airrune', 'lawrune', 'cosmicrune', 'naturerune', 'deathrune', 'bodyrune', 'mindrune', 'bloodrune'];
    let x = 3200;
    const Z = 3200; // Lumbridge's field, well clear of anything
    // Each player its own login bucket: loginOrder keys the player loop by the bucket, so two players
    // in one bucket are one entry and the first is never processed (Monster Examine's caster was).
    let bucket = 1;
    const mage = (name: string, dx = 0) => {
        const p = H.makePlayer(name, x + dx, Z, bucket++);
        return p;
    };
    const ready = (...ps: any[]) => {
        H.tick(1);
        for (const p of ps) {
            H.maxOut(p);
            H.clearInv(p);
            for (const r of RUNES) H.give(p, r, 5000);
            H.setVar(p, 'spellbook', 2);
        }
    };
    const said = (p: any) => H.mesgs.filter(m => m.who === p.username).map(m => m.text);
    const near = (p: any, cx: number, cz: number) => Math.max(Math.abs(p.x - cx), Math.abs(p.z - cz)) <= 3;
    const fresh = () => {
        x += 6;
        H.clearLogs();
    };
    const cases: Record<string, () => void> = {
        teleports: () => {
            console.log('TELEPORTS  the eight, each from Lumbridge');
            const dests: [string, number, number][] = [['moonclan', 2113, 3915], ['ourania', 2468, 3246], ['waterbirth', 2546, 3755], ['barbarian', 2543, 3568],
                ['khazard', 2636, 3167], ['fishing_guild', 2611, 3393], ['catherby', 2804, 3433], ['ice_plateau', 2972, 3873]];
            for (const [d, cx, cz] of dests) {
                fresh();
                const p = mage('tp_' + d.slice(0, 6));
                ready(p);
                const before = H.invCount(p, 'astralrune');
                H.ifButton(p, `lunar_magic:${d}_teleport`);
                H.tick(5);
                check(`${d}: lands at ${cx},${cz}, astrals spent`, [near(p, cx, cz), H.invCount(p, 'astralrune') < before], [true, true]);
                H.despawn(p);
            }
        },
        telegroup: () => {
            console.log('TELE GROUP  Catherby; a friend beside the caster with Accept Aid on, one with it off');
            fresh();
            const c = mage('tgc');
            const f = mage('tgf', 1);
            const n = mage('tgn', -1);
            ready(c, f, n);
            H.setVar(n, 'option_aid', 2);
            H.ifButton(c, 'lunar_magic:tele_group_catherby');
            H.tick(4);
            check('the caster is in Catherby', near(c, 2804, 3433), true);
            check('the friend was offered it (an open teleother offer)', H.getVar(f, 'teleother_expires') > World.currentTick, true);
            check('the one with Accept Aid off was not', H.getVar(n, 'teleother_expires') > World.currentTick, false);
            H.ifButton(f, 'teleother:accept');
            H.tick(5);
            check('the friend accepted and followed', near(f, 2804, 3433), true);
            check('the other stayed', near(n, x - 1, Z), true);
            H.despawn(c, f, n);
        },
        skilling: () => {
            console.log('SKILLING  Bake Pie, Superglass Make, String Jewellery, Humidify, Plank Make, Magic Imbue');
            fresh();
            const p = mage('skill');
            ready(p);
            H.give(p, 'uncooked_apple_pie', 2);
            const cook0 = p.stats[7];
            H.ifButton(p, 'lunar_magic:bake_pie');
            H.tick(10);
            check('Bake Pie: two apple pies baked', [H.invCount(p, 'uncooked_apple_pie'), H.invCount(p, 'apple_pie')], [0, 2]);
            check('  ...with Cooking xp', p.stats[7] > cook0, true);
            H.give(p, 'bucket_sand', 4);
            H.give(p, 'soda_ash', 4);
            H.ifButton(p, 'lunar_magic:superglass_make');
            // four, not three: a click from here lands between ticks, so its p_delay(2) ends a tick
            // later than the same click would in game
            H.tick(4);
            check('Superglass Make: sand and ash gone, 4+ molten glass', [H.invCount(p, 'bucket_sand'), H.invCount(p, 'soda_ash'), H.invCount(p, 'molten_glass') >= 4], [0, 0, true]);
            H.clearInv(p);
            for (const r of RUNES) H.give(p, r, 5000);
            H.give(p, 'unstrung_gold_amulet', 2);
            H.ifButton(p, 'lunar_magic:string_jewellery');
            H.tick(10);
            check('String Jewellery: two amulets strung', [H.invCount(p, 'unstrung_gold_amulet'), H.invCount(p, 'strung_gold_amulet')], [0, 2]);
            H.give(p, 'bucket_empty', 2);
            H.give(p, 'jug_empty', 1);
            H.ifButton(p, 'lunar_magic:humidify');
            H.tick(5); // its p_delay(3), Old School's four-tick cast, plus the between-ticks click
            check('Humidify: buckets and jug filled', [H.invCount(p, 'bucket_water'), H.invCount(p, 'jug_water'), H.invCount(p, 'bucket_empty')], [2, 1, 0]);
            H.give(p, 'oak_logs', 2);
            H.give(p, 'coins', 1000);
            H.castOnHeld(p, 'oak_logs', 'lunar_magic:plank_make');
            H.tick(4);
            check('Plank Make: one oak log -> plank for 175 coins', [H.invCount(p, 'oak_logs'), H.invCount(p, 'oak_plank'), H.invCount(p, 'coins')], [1, 1, 825]);
            H.mesgs.length = 0;
            H.castOnHeld(p, 'bucket_water', 'lunar_magic:plank_make');
            H.tick(1);
            check('  ...on a bucket, it says so', said(p).length > 0, true);
            H.ifButton(p, 'lunar_magic:magic_imbue');
            H.tick(1);
            check('Magic Imbue: charged', H.getVar(p, 'magic_imbue_until') > World.currentTick, true);
            H.despawn(p);
        },
        support: () => {
            console.log('SUPPORT  cures, heals, Energy Transfer, Pot Share, Dream');
            fresh();
            const c = mage('supc');
            const t = mage('supt', 1);
            ready(c, t);
            H.setVar(c, 'poison', 30);
            H.ifButton(c, 'lunar_magic:cure_me');
            H.tick(2);
            check('Cure Me: not poisoned any more', H.getVar(c, 'poison') <= 0, true);
            H.setVar(t, 'poison', 30);
            H.castOnPlayer(c, t, 'lunar_magic:cure_other');
            H.tick(3);
            check('Cure Other: target cured', H.getVar(t, 'poison') <= 0, true);
            H.setVar(c, 'poison', 30);
            H.setVar(t, 'poison', 30);
            H.ifButton(c, 'lunar_magic:cure_group');
            H.tick(3);
            check('Cure Group: both cured', [H.getVar(c, 'poison') <= 0, H.getVar(t, 'poison') <= 0], [true, true]);
            t.levels[3] = 40;
            const c0 = c.levels[3];
            H.castOnPlayer(c, t, 'lunar_magic:heal_other');
            H.tick(3);
            check(`Heal Other: target 40 -> ${t.levels[3]}, caster ${c0} -> ${c.levels[3]}`, [t.levels[3] > 40, c.levels[3] < c0, 40 + (c0 - c.levels[3]) === t.levels[3]], [true, true, true]);
            c.levels[3] = 99;
            t.levels[3] = 30;
            H.ifButton(c, 'lunar_magic:heal_group');
            H.tick(3);
            check(`Heal Group: target 30 -> ${t.levels[3]}, caster 99 -> ${c.levels[3]}`, [t.levels[3] > 30, c.levels[3] < 99], [true, true]);
            c.levels[3] = 99;
            (t as any).runenergy = 0;
            H.setVar(t, 'sa_energy', 0);
            H.castOnPlayer(c, t, 'lunar_magic:energy_transfer');
            H.tick(3);
            check(`Energy Transfer: target run ${(t as any).runenergy}, spec ${H.getVar(t, 'sa_energy')}; caster hp ${c.levels[3]}`, [(t as any).runenergy > 0, H.getVar(t, 'sa_energy') > 0, c.levels[3]], [true, true, 89]);
            c.levels[0] = 90; // attack drained a little: a boost will show
            t.levels[0] = 90;
            H.give(c, '4dose2attack', 1);
            H.castOnHeld(c, '4dose2attack', 'lunar_magic:boost_potion_share');
            H.tick(3);
            check(`Boost Potion Share (super attack): caster attack ${c.levels[0]}, target ${t.levels[0]}`, [c.levels[0] > 90, t.levels[0] > 90], [true, true]);
            c.levels[3] = 50;
            H.ifButton(c, 'lunar_magic:dream');
            H.tick(60);
            check(`Dream: hitpoints 50 -> ${c.levels[3]} in 60 ticks`, c.levels[3] > 50, true);
            H.despawn(c, t);
        },
        insight: () => {
            console.log('INSIGHT  Monster Examine and Stat Spy');
            fresh();
            const c = mage('insc');
            const t = mage('inst', 1);
            ready(c, t);
            const demon = H.addNpcAt('black_demon', x, Z + 3, 0);
            H.tick(1);
            H.mesgs.length = 0;
            H.ifaces.length = 0;
            H.castOnNpc(c, demon, 'lunar_magic:monster_examine');
            H.tick(4);
            // the monster_examine side panel, filled in with if_settext - nothing in the chatbox
            const lines = H.ifaces.filter(i => i.who === 'insc' && i.kind === 'text').map(i => i.text ?? '');
            console.log('       ' + lines.join('  |  '));
            check('Monster Examine: a panel with its level, and no chat', [(c as any).modalSide !== -1, lines.some(s => s.startsWith('Combat level')), said(c).length], [true, true, 0]);
            H.mesgs.length = 0;
            H.castOnPlayer(c, t, 'lunar_magic:stat_spy');
            H.tick(4);
            check('Stat Spy: a panel open for the caster, and the target told', [(c as any).containsModalInterface(), said(t).length > 0], [true, true]);
            H.despawn(c, t);
        },
        contact: () => {
            console.log('NPC CONTACT and SPELLBOOK SWAP');
            fresh();
            const p = mage('cont');
            ready(p);
            const a0 = H.invCount(p, 'astralrune');
            H.ifButton(p, 'lunar_magic:npc_contact');
            H.tick(1);
            check('NPC Contact: the Choose a character window, and no astral yet', [(p as any).containsModalInterface(), a0 - H.invCount(p, 'astralrune')], [true, 0]);
            H.ifButton(p, 'npc_contact:turael');
            H.tick(2);
            const heard = H.ifaces.filter(i => i.who === 'cont' && i.kind === 'text').map(i => i.text).filter(s => s && s.length > 8);
            console.log('       Turael: ' + heard.slice(-2).join(' / '));
            check('NPC Contact: Turael answered, and one astral went', [heard.length > 0, a0 - H.invCount(p, 'astralrune')], [true, 1]);
            p.closeModal();
            H.tick(1);
            H.ifButton(p, 'lunar_magic:spellbook_swap');
            H.choose(p, 'multi2:com_1'); // the normal book (Desert Treasure not done: two options)
            H.tick(1);
            check('Spellbook Swap: on the normal book', H.getVar(p, 'spellbook'), 0);
            H.ifButton(p, 'magic:varrock_teleport');
            H.tick(5);
            check('  ...one spell (Varrock Teleport) and back to Lunar', [near(p, 3213, 3424), H.getVar(p, 'spellbook')], [true, 2]);
            H.despawn(p);
        },
        hunter: () => {
            console.log('HUNTER KIT  the spell gives the box, and the box opens');
            fresh();
            const p = mage('hunt');
            ready(p);
            H.ifButton(p, 'lunar_magic:hunter_kit');
            H.tick(4);
            check('a hunter kit', H.invCount(p, 'hunter_kit'), 1);
            H.opheld(p, 'hunter_kit', 1);
            H.tick(1);
            check('opened: the gear that exists so far', ['hunter_kit', 'noose_wand', 'hunter_bird_snare', 'teasing_stick', 'torch_unlit', 'hunter_box_trap'].map(o => H.invCount(p, o)), [0, 1, 1, 1, 1, 1]);
            H.despawn(p);
        },
        farming: () => {
            console.log('FARMING  Cure Plant and Fertile Soil cast on something that is not a patch');
            fresh();
            const p = mage('farm');
            ready(p);
            p.teleport(2150, 3863, 0);
            H.tick(1);
            H.mesgs.length = 0;
            H.castOnLoc(p, 2157, 3863, 'astral_altar', 'lunar_magic:fertile_soil');
            H.tick(12);
            const words = H.saysFor('farm').map(s => s.text);
            check('Fertile Soil on an altar says so, overhead as in Old School', words, ["Um... I don't want to fertilize that!"]);
            H.despawn(p);
        }
    };
    for (const [name, run] of Object.entries(cases)) {
        if (only && only !== name) continue;
        run();
        H.tick(2);
    }
    console.log(`LUNAR SPELLS  ${R.ok} ok, ${R.bad} failed`);
}

if (which === 'comborunes') {
    // Combination runes (content skill_magic/scripts/magic.rs2): a mist rune is an air rune AND a
    // water rune, both at once, the way the spellbook buttons already count it. Teleports go
    // through the real click (IfButtonHandler); combat spells and alchemy, which need a target,
    // call the procs the cast calls. Every case is a fresh player with only the runes it lists.
    let fails = 0;
    let n = 0;
    const check = (ok: boolean, what: string) => {
        n++;
        if (!ok) fails++;
        console.log(`  ${String(n).padStart(2)} ${ok ? 'ok  ' : 'FAIL'} ${what}`);
    };
    const POUCH = InvType.getId('rune_pouch_store');
    let ip = 1;
    const caster = (name: string, inv: Record<string, number>, opts: { pouch?: Record<string, number>; staff?: string } = {}) => {
        // Draynor: out of the wilderness, and far enough from Lumbridge and Falador to see the teleport
        const p = H.makePlayer(name, 3093, 3244, ip++);
        H.tick(1);
        H.maxOut(p);
        H.clearInv(p);
        for (const [obj, count] of Object.entries(inv)) H.give(p, obj, count);
        if (opts.pouch) {
            H.give(p, 'rune_pouch', 1);
            for (const [obj, count] of Object.entries(opts.pouch)) p.invAdd(POUCH, ObjType.getId(obj), count);
        }
        if (opts.staff) H.equip(p, { rhand: opts.staff });
        return p;
    };
    const pouchCount = (p: any, obj: string) => p.invTotal(POUCH, ObjType.getId(obj));
    const has = (p: any, want: Record<string, number>) =>
        Object.entries(want).every(([obj, count]) => H.invCount(p, obj) === count);
    const held = (p: any, objs: string[]) => objs.map(o => `${o}=${H.invCount(p, o)}`).join(' ');
    const said = (p: any) => H.mesgs.filter(m => m.who === p.username).map(m => m.text);
    const row = (name: string) => {
        const id = DbRowType.getId(name);
        if (id === -1) throw new Error('no such dbrow: ' + name);
        return id;
    };
    const canCast = (p: any, spell: string) => H.runProc(p, '[proc,check_spell_requirements]', [row(spell)])[0] === 1;
    const pay = (p: any, spell: string) => H.runProc(p, '[proc,delete_spell_runes]', [row(spell)]);
    const teleport = (p: any, com: string) => {
        const x0 = p.x;
        const z0 = p.z;
        H.ifButton(p, com);
        H.tick(8);
        return Math.abs(p.x - x0) + Math.abs(p.z - z0) > 20;
    };

    console.log('COMBINATION RUNES');
    console.log('Wind Strike (1 air, 1 mind) with only a combination rune carrying air');
    for (const combo of ['mistrune', 'dustrune', 'smokerune']) {
        const p = caster('ws_' + combo.slice(0, 4), { [combo]: 1, mindrune: 1 });
        check(canCast(p, 'magic_combat_wind_strike'), `one ${combo} is enough air`);
        pay(p, 'magic_combat_wind_strike');
        check(has(p, { [combo]: 0, mindrune: 0 }), `and it is what the cast spends`);
    }
    {
        const p = caster('ws_mud', { mudrune: 5, mindrune: 1 });
        check(!canCast(p, 'magic_combat_wind_strike'), 'a mud rune (water + earth) is no air at all');
    }

    console.log('Falador Teleport (3 air, 1 water, 1 law), clicked');
    {
        const p = caster('fal_mist', { mistrune: 3, lawrune: 1 });
        const went = teleport(p, 'magic:falador_teleport');
        check(went, 'three mist runes pay 3 air AND 1 water: the teleport goes');
        check(has(p, { mistrune: 0, lawrune: 0 }), 'spending the three mist and the law: ' + held(p, ['mistrune', 'lawrune']));
    }
    {
        const p = caster('fal_plain', { airrune: 3, waterrune: 1, mistrune: 5, lawrune: 1 });
        check(teleport(p, 'magic:falador_teleport'), 'plain runes and mist runes: the teleport goes');
        check(has(p, { airrune: 0, waterrune: 0, mistrune: 5 }), 'plain runes first, the mist untouched: ' + held(p, ['airrune', 'waterrune', 'mistrune']));
    }
    {
        const p = caster('fal_half', { airrune: 3, mistrune: 5, lawrune: 1 });
        check(teleport(p, 'magic:falador_teleport'), 'no water rune, but a mist rune is one: the teleport goes');
        check(has(p, { airrune: 1, mistrune: 4 }), 'one mist for the water pays an air too, so one air is kept: ' + held(p, ['airrune', 'mistrune']));
    }
    {
        const p = caster('fal_pair', { smokerune: 3, mistrune: 1, lawrune: 1 });
        check(teleport(p, 'magic:falador_teleport'), 'smoke and mist runes only: the teleport goes');
        check(has(p, { mistrune: 0, smokerune: 1 }), 'the mist pays air and water, two smoke the other air: ' + held(p, ['mistrune', 'smokerune']));
    }
    {
        const p = caster('fal_short', { mistrune: 2, lawrune: 1 });
        H.clearLogs();
        check(!teleport(p, 'magic:falador_teleport'), 'two mist runes are 2 air, not 3: no teleport');
        check(said(p).includes('You do not have enough Air Runes to cast this spell.'), 'and the message names air: ' + JSON.stringify(said(p)));
        check(has(p, { mistrune: 2, lawrune: 1 }), 'and nothing is spent');
    }
    {
        const p = caster('fal_pouch', { lawrune: 1 }, { pouch: { mistrune: 3 } });
        check(teleport(p, 'magic:falador_teleport'), 'three mist runes in the rune pouch: the teleport goes');
        check(pouchCount(p, 'mistrune') === 0 && H.invCount(p, 'rune_pouch') === 1, 'spent out of the pouch: ' + pouchCount(p, 'mistrune') + ' left');
    }
    {
        const p = caster('fal_mix', { mistrune: 1, lawrune: 1 }, { pouch: { airrune: 2 } });
        check(teleport(p, 'magic:falador_teleport'), 'one loose mist and two air in the pouch: the teleport goes');
        check(H.invCount(p, 'mistrune') === 0 && pouchCount(p, 'airrune') === 0, 'both spent');
    }
    {
        const p = caster('fal_staff', { mistrune: 1, lawrune: 1 }, { staff: 'staff_of_air' });
        check(teleport(p, 'magic:falador_teleport'), 'staff of air and one mist rune: the teleport goes');
        check(has(p, { mistrune: 0 }), 'the staff pays the air, the mist the water');
    }
    {
        const p = caster('fal_steam', { steamrune: 1, airrune: 3, lawrune: 1 }, { staff: 'staff_of_air' });
        check(teleport(p, 'magic:falador_teleport'), 'staff of air, three air and a steam rune: the teleport goes');
        check(has(p, { airrune: 3, steamrune: 0 }), 'the air runes are kept, the steam pays the water: ' + held(p, ['airrune', 'steamrune']));
    }

    console.log('Lumbridge Teleport (3 air, 1 earth, 1 law), clicked');
    {
        const p = caster('lum_dust', { dustrune: 3, earthrune: 1, lawrune: 1 });
        check(teleport(p, 'magic:lumbridge_teleport'), 'three dust runes and an earth rune: the teleport goes');
        check(has(p, { dustrune: 0, earthrune: 1 }), 'the dust pays the earth as well, so the earth rune is kept: ' + held(p, ['dustrune', 'earthrune']));
    }

    console.log('Smoke Rush (1 air, 1 fire, 2 chaos, 2 death in the rune4 column)');
    {
        const p = caster('rush', { smokerune: 1, chaosrune: 2, deathrune: 2 });
        check(canCast(p, 'magic_combat_smoke_rush'), 'one smoke rune is the air and the fire');
        pay(p, 'magic_combat_smoke_rush');
        check(has(p, { smokerune: 0, chaosrune: 0, deathrune: 0 }), 'and the cast spends one smoke, two chaos and two death');
    }

    console.log('High Level Alchemy (1 nature, 5 fire) on a rune the cast pays with');
    const alchable = (p: any, obj: string) => H.runProc(p, '[proc,is_alchable]', [ObjType.getId(obj), row('magic_spell_high_alch')])[0] === 1;
    {
        const p = caster('alch_lava5', { naturerune: 1, lavarune: 5 });
        check(canCast(p, 'magic_spell_high_alch'), 'five lava runes are the five fire');
        check(!alchable(p, 'lavarune'), 'so alching one of them is refused: none would be left to alch');
        const q = caster('alch_lava6', { naturerune: 1, lavarune: 6 });
        check(alchable(q, 'lavarune'), 'with a sixth, it is allowed');
        const r = caster('alch_fire', { naturerune: 1, firerune: 5, lavarune: 10 });
        check(!alchable(r, 'firerune'), 'five fire runes pay the fire first, so alching a fire rune is refused');
        check(alchable(r, 'lavarune'), '...and alching a lava rune the cast does not touch is allowed');
        const s = caster('alch_nat', { naturerune: 2, firerune: 5 });
        check(alchable(s, 'naturerune'), 'two nature runes: alch one, pay with the other');
        const t = caster('alch_nat1', { naturerune: 1, firerune: 5 }, { pouch: { naturerune: 5 } });
        check(!alchable(t, 'naturerune'), 'the last loose nature rune pays the cast before the pouch does, so it cannot be alched too');
    }
    {
        // and the real click, on the spell and then the rune
        const p = caster('alch_click6', { naturerune: 1, lavarune: 6 });
        H.castOnHeld(p, 'lavarune', 'magic:highlvl_alchemy');
        H.tick(6);
        check(has(p, { naturerune: 0, lavarune: 0 }) && H.invCount(p, 'coins') > 0,
            'cast on the sixth lava rune: five pay the fire, one is alched: ' + held(p, ['naturerune', 'lavarune', 'coins']));
        const q = caster('alch_click5', { naturerune: 1, lavarune: 5 });
        H.clearLogs();
        H.castOnHeld(q, 'lavarune', 'magic:highlvl_alchemy');
        H.tick(6);
        check(has(q, { naturerune: 1, lavarune: 5, coins: 0 }), 'cast on one of five: refused, nothing spent and no coins: ' + held(q, ['naturerune', 'lavarune', 'coins']));
        check(said(q).includes('You do not have enough Lava Runes to cast this spell.'), 'and the message says why: ' + JSON.stringify(said(q)));
    }

    console.log(`${n - fails}/${n} ok${fails ? `, ${fails} FAILED` : ''}`);
}

function gaps(ticks: number[]) {
    const out: number[] = [];
    for (let i = 1; i < ticks.length; i++) out.push(ticks[i] - ticks[i - 1]);
    return out.join(',') || '-';
}

process.exit(0);
