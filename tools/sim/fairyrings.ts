// The fairy ring network, driven through the real triggers: the locs, the dial, the gate.
//
// WHY A SIM AND NOT A LOOK AT THE CACHE. Every part of this feature is the kind that reads
// correct and behaves wrong. A loc can be named and still not clickable; a dial can turn and
// store the wrong letter; a code table can be right and the teleport land a tile inside a wall.
// So nothing here inspects a config: it clicks the ring, presses the arrows the way a player
// would, reads the letters off the panel the server actually sent, and asks where the player
// ended up.
//
// THE CASE THAT MATTERS MOST is the gate, and it is checked twice on purpose. A ring refuses
// without Fairytale Part I - but [if_button] is reachable by anything that can send a component
// id, so the ENTER button checks the quest again. A test that only clicked rings would pass a
// network any client could teleport around for free.
//
// Usage: npx tsx tools/sim/fairyrings.ts
import * as H from './harness.ts';
import Component from '#/cache/config/Component.js';
import type Player from '#/engine/entity/Player.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';

const VarpId = (name: string) => {
    const id = VarPlayerType.getId(name);
    if (id === -1) throw new Error('no such varp: ' + name);
    return id;
};

await H.boot();
H.loginOrder();

let ok = 0,
    bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) ok++;
    else bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const FAIRY_COMPLETE = 100; // ^fairy_complete, quest_fairy.constant

// the rings as the map places them: loc name, centre tile, and the code that reaches it
const RINGS = [
    { loc: '64_fairy_mushroom_ring', x: 2412, z: 4434, code: 'BKS', where: 'Zanaris' },
    { loc: '1_fairy_mushroom_ring', x: 2319, z: 3619, code: 'AKQ', where: 'Piscatoris' },
    { loc: '6_fairy_mushroom_ring', x: 2644, z: 3495, code: 'ALS', where: "McGrubor's Wood" },
    { loc: '27_fairy_mushroom_ring', x: 3129, z: 3496, code: 'DKR', where: 'Edgeville' },
    { loc: '37_fairy_mushroom_ring', x: 3082, z: 3206, code: 'AIQ', where: 'Port Sarim' },
    { loc: '47_fairy_mushroom_ring', x: 2705, z: 3576, code: 'CJR', where: 'Sinclair Mansion' }
];

// the order each dial turns in, which is NOT alphabetical
const DIALS = ['ADCB', 'ILKJ', 'PSRQ'];

const comId = (name: string) => {
    const id = Component.getId(`fairy_rings:${name}`);
    if (id === -1) throw new Error('no such component: fairy_rings:' + name);
    return id;
};
const LETTER = [comId('letter1'), comId('letter2'), comId('letter3')];
const PANEL = Component.getId('fairy_rings');

// IS THE PANEL OPEN, asked of the server rather than of the wire. if_openmain sets modalMain and
// defers IfOpenMain to the output flush, which a socketless sim player never performs - so a test
// watching for that message reads "closed" on a panel that is open, and worse, reads the same for
// a panel that correctly refused to open. modalMain cannot be wrong about it either way.
const panelOpen = (pl: Player) => pl.modalMain === PANEL;

/** Anything the server put on a text component for this player, mesboxes included. */
const textSeen = (pl: Player) =>
    H.ifaces
        .filter(f => f.who === pl.username && f.kind === 'text' && f.text)
        .map(f => f.text!)
        .join(' ');

/** What the panel is currently showing on dial n, as the server last set it. */
function shown(p: Player, n: number): string {
    const t = [...H.ifaces].reverse().find(f => f.who === p.username && f.kind === 'text' && f.com === LETTER[n]);
    return t?.text ?? '';
}

function settle(ticks = 20) {
    for (let t = 0; t < ticks; t++) H.tick(1);
}

/** Click a ring the way a client does, and let the walk-and-run finish. */
function useRing(p: Player, ring: { loc: string; x: number; z: number }) {
    H.opLoc(p, ring.x, ring.z, ring.loc, 1);
    settle();
}

/** Turn the dials to a code by pressing the arrows, as a player must. */
function dialTo(p: Player, code: string) {
    for (let n = 0; n < 3; n++) {
        const want = DIALS[n].indexOf(code[n]);
        if (want === -1) throw new Error(`dial ${n + 1} has no letter ${code[n]}`);
        // press right until the panel reads the letter we want; four presses is a full turn, so
        // five without arriving means the dial is not wrapping and the test should say so
        let presses = 0;
        while (shown(p, n) !== code[n]) {
            H.ifButton(p, `fairy_rings:right${n + 1}`);
            settle();
            if (++presses > 4) throw new Error(`dial ${n + 1} will not reach ${code[n]} (stuck on ${shown(p, n)})`);
        }
    }
}

const at = (p: Player) => `${p.x},${p.z}`;

// ---------------------------------------------------------------- the rings are really there
console.log('\nthe rings this map actually has');
for (const r of RINGS) {
    const near = H.locsNear(r.loc, r.x, r.z);
    const hit = near.find(l => l.x === r.x && l.z === r.z);
    check(`${r.where} has a ring at ${r.x},${r.z}`, hit !== undefined, true);
}

// ---------------------------------------------------------------- every ring opens the dial
//
// ALL SIX, CLICKED, and not because six assertions are better than one. Everything else in this
// file dials from Zanaris, so deleting another ring's trigger entirely left every other check
// green: the ring was still placed, still named, and no test ever touched it. The script claims
// every ring dials; this is the only thing that holds it to that.
console.log('\nevery ring opens the dial, not just the hub');
for (const r of RINGS) {
    const u = H.makePlayer(`fr_use_${r.code.toLowerCase()}`, r.x, r.z + 2);
    H.loginOrder(u);
    H.setVarBit(u, 'fairy_farmers_quest', FAIRY_COMPLETE);
    H.clearLogs();
    useRing(u, r);
    check(`the ${r.where} ring opens the dial`, panelOpen(u), true);
}

// ---------------------------------------------------------------- the gate
console.log('\nbefore Fairytale Part I');
const nobody = H.makePlayer('fr_locked', 2412, 4440);
H.loginOrder(nobody);
H.setVarBit(nobody, 'fairy_farmers_quest', 0);
H.clearLogs();
useRing(nobody, RINGS[0]);
check('the ring does not open the dial', panelOpen(nobody), false);
// NOT H.mesgs: ~mesbox is a chat interface with text set on it and p_pausebutton, not
// messageGame, so the words arrive as if_settext and the message log stays empty.
check('and it says something about fairies', /fairies|mushrooms/i.test(textSeen(nobody)), true);

// AND THE BUTTON DIRECTLY, which is the way round the ring: a client can send a component id
// without ever touching a mushroom.
//
// A PLAYER OF ITS OWN, and this is the whole reason the check is worth anything. Reusing `nobody`
// made it pass for the wrong reason: the ring had left it suspended in the mesbox's p_pausebutton,
// so the ENTER press never executed and the test read "did not teleport" on a press that never
// happened. Removing the gate from the button survived that version of the test.
const bypass = H.makePlayer('fr_bypass', 2412, 4440);
H.loginOrder(bypass);
H.setVarBit(bypass, 'fairy_farmers_quest', 0);
// 41 is DKR in the varp's own encoding, dial1 + dial2 * 4 + dial3 * 16. Spelled out rather than
// written as a bare number because getting this wrong is what made this very check hollow once:
// 26 looked like DKR, decoded to CKS, went nowhere, and hid a missing quest gate.
H.setVar(bypass, 'fairy_ring_dial', 1 + 2 * 4 + 2 * 16); // D K R
const bypassFrom = at(bypass);
H.ifButton(bypass, 'fairy_rings:enter_box');
settle();
check('pressing ENTER without the quest teleports nobody', at(bypass), bypassFrom);
check('...and that player is not somewhere suspended, which would make the check hollow', bypass.activeScript === null, true);

// ---------------------------------------------------------------- the encoding
//
// A GUARD, not a formality. The varp and the code table have to agree about which dial is in
// which bits; when they did not, every code still worked through the arrows and only a direct
// varp write revealed it. This pins the encoding from the outside: dial the code by hand, then
// read the varp and check it is the number the constant file claims.
console.log('\nthe varp and the code table agree');
const enc = H.makePlayer('fr_enc', 2412, 4440);
H.loginOrder(enc);
H.setVarBit(enc, 'fairy_farmers_quest', FAIRY_COMPLETE);
H.setVar(enc, 'fairy_ring_dial', 0);
H.clearLogs();
useRing(enc, RINGS[0]);
dialTo(enc, 'DKR');
check('dialling DKR by hand stores 41', enc.getVar(VarpId('fairy_ring_dial')), 1 + 2 * 4 + 2 * 16);

// ---------------------------------------------------------------- the dial
console.log('\nthe dial, turned by hand');
const p = H.makePlayer('fr_dialer', 2412, 4440);
H.loginOrder(p);
H.setVarBit(p, 'fairy_farmers_quest', FAIRY_COMPLETE);
H.setVar(p, 'fairy_ring_dial', 0);
H.clearLogs();
useRing(p, RINGS[0]);
check('the ring opens the dial once the quest is done', panelOpen(p), true);
check('and it opens reading the stored code', [shown(p, 0), shown(p, 1), shown(p, 2)], ['A', 'I', 'P']);

// one full turn of each dial, in the order a ring turns
for (let n = 0; n < 3; n++) {
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
        seen.push(shown(p, n));
        H.ifButton(p, `fairy_rings:right${n + 1}`);
        settle();
    }
    check(`dial ${n + 1} turns ${DIALS[n]} and wraps`, seen.join(''), DIALS[n] + DIALS[n][0]);
}

// and back the other way
H.setVar(p, 'fairy_ring_dial', 0);
H.clearLogs();
useRing(p, RINGS[0]);
H.ifButton(p, 'fairy_rings:left1');
settle();
check('a left turn from A goes to B, not D', shown(p, 0), 'B');

// ---------------------------------------------------------------- every code, from every ring
console.log('\nevery code, dialled from Zanaris');
for (const r of RINGS) {
    const t = H.makePlayer(`fr_${r.code.toLowerCase()}`, 2412, 4440);
    H.loginOrder(t);
    H.setVarBit(t, 'fairy_farmers_quest', FAIRY_COMPLETE);
    H.setVar(t, 'fairy_ring_dial', 0);
    H.clearLogs();
    useRing(t, RINGS[0]);
    dialTo(t, r.code);
    check(`${r.code} reads ${r.code} on the panel`, [shown(t, 0), shown(t, 1), shown(t, 2)].join(''), r.code);
    H.ifButton(t, 'fairy_rings:enter_box');
    settle();
    check(`${r.code} lands at ${r.where}`, at(t), `${r.x},${r.z}`);
}

// ---------------------------------------------------------------- a code that goes nowhere
console.log('\na code with nothing at the other end');
const lost = H.makePlayer('fr_lost', 2412, 4440);
H.loginOrder(lost);
H.setVarBit(lost, 'fairy_farmers_quest', FAIRY_COMPLETE);
H.setVar(lost, 'fairy_ring_dial', 0);
H.clearLogs();
useRing(lost, RINGS[0]);
dialTo(lost, 'DLQ'); // north of Nardah in RuneScape; no ring on this map
const stood = at(lost);
H.clearLogs();
H.ifButton(lost, 'fairy_rings:enter_box');
settle();
check('DLQ does not move anybody', at(lost), stood);
check(
    'and the ring says so',
    /nothing happens/i.test(
        H.mesgs
            .filter(m => m.who === lost.username)
            .map(m => m.text)
            .join(' ')
    ),
    true
);

// ---------------------------------------------------------------- the code is remembered
console.log('\nand the dial remembers');
const mem = H.makePlayer('fr_mem', 2412, 4440);
H.loginOrder(mem);
H.setVarBit(mem, 'fairy_farmers_quest', FAIRY_COMPLETE);
H.setVar(mem, 'fairy_ring_dial', 0);
H.clearLogs();
useRing(mem, RINGS[0]);
dialTo(mem, 'DKR');
H.clearLogs();
useRing(mem, RINGS[0]); // open it again
check('reopening shows the code last dialled', [shown(mem, 0), shown(mem, 1), shown(mem, 2)].join(''), 'DKR');

// ---------------------------------------------------------------- the old route still works
//
// TWO PLAYERS, because the ring by Fairy Nuff behaves differently either side of the quest and
// only one of those paths reaches the choice. The first version of this test used the unquested
// player alone - which takes the early branch and steps straight out - so deleting the choice
// entirely in favour of the dial went unnoticed. The quested player is the one that proves the
// swamp is still on offer once a player COULD dial instead.
console.log('\nand the swamp step that was already there');

const swamp = H.makePlayer('fr_swamp', 2452, 4476);
H.loginOrder(swamp);
H.setVarBit(swamp, 'fairy_farmers_quest', 0); // it never needed the quest
H.clearLogs();
H.opLoc(swamp, 2452, 4473, 'fairy_mushroom_ring', 1);
settle();
check('without the quest it steps straight out to the swamp', at(swamp), '3201,3169');

const both = H.makePlayer('fr_both', 2452, 4476);
H.loginOrder(both);
H.setVarBit(both, 'fairy_farmers_quest', FAIRY_COMPLETE);
H.clearLogs();
H.opLoc(both, 2452, 4473, 'fairy_mushroom_ring', 1);
settle();
check('with the quest it offers a choice instead of picking for you', both.resumeButtons.length, 2);
check('and the swamp is still the second option', H.choose(both, 'multi2:com_2'), true);
settle();
check('...which still goes to the swamp', at(both), '3201,3169');

const dialer2 = H.makePlayer('fr_both2', 2452, 4476);
H.loginOrder(dialer2);
H.setVarBit(dialer2, 'fairy_farmers_quest', FAIRY_COMPLETE);
H.clearLogs();
H.opLoc(dialer2, 2452, 4473, 'fairy_mushroom_ring', 1);
settle();
H.choose(dialer2, 'multi2:com_1');
settle();
check('and the first option opens the dial', panelOpen(dialer2), true);

console.log(`\n${ok} ok, ${bad} failed`);
process.exit(bad > 0 ? 1 : 0);
