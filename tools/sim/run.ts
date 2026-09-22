// One scenario per process: the world is stateful (player slots, zones, rsbuf) and reusing it
// across scenarios changes results. Usage: npx tsx tools/simtmp/run.ts <name>
import World from '#/engine/World.js';
import * as H from './harness.js';

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

function gaps(ticks: number[]) {
    const out: number[] = [];
    for (let i = 1; i < ticks.length; i++) out.push(ticks[i] - ticks[i - 1]);
    return out.join(',') || '-';
}

process.exit(0);
