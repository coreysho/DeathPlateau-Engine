// Family Crest gauntlets: every kind can be had. Drives the real Dimintheis, Caleb, Avan and
// Johnathon dialogues end to end. Usage: npx tsx tools/sim/crest.ts
import * as H from './harness.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const COMPLETE = 11;
const BIT = { cooking: 7, goldsmith: 8, chaos: 9 };
const GAUNTLETS = ['steel_gauntlets', 'gauntlets_of_cooking', 'gauntlets_of_goldsmithing', 'gauntlets_of_chaos'];

let bucket = 1;
function player(name: string, stage: number, bits: number) {
    const p = H.makePlayer(name, 3222, 3222, bucket++);
    H.tick(1);
    H.maxOut(p);
    H.clearInv(p);
    H.setVar(p, 'crestquest', stage);
    H.setVar(p, 'crest_spells_levers_gauntlets', bits);
    return p;
}
const held = (p: any) => GAUNTLETS.map(g => H.invCount(p, g));
const coins = (p: any) => H.invCount(p, 'coins');

/** Talk to an npc and click through: continue on every page, and take `picks` in order at menus. */
function talk(p: any, npcName: string, picks: number[], show = true): string[] {
    // Johnathon lies upstairs in the Jolly Boar Inn, so look on every floor
    const npc = [0, 1, 2, 3].map(l => H.npcNear(npcName, p.x, p.z, l)).find(n => n)!;
    if (!npc) throw new Error('no npc ' + npcName);
    const from = H.ifaces.length;
    let started = false;
    // Stand next to the npc and click Talk-to. A wandering npc can leave the chosen tile behind a
    // counter or wall, so try each side until the dialogue opens.
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, 1);
        for (let t = 0; t < 12 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    for (let guard = 0; guard < 200; guard++) {
        const s = p.activeScript;
        if (!s || s.execution !== ScriptState.PAUSEBUTTON) {
            if (started && !s) break;
            H.tick(1);
            continue;
        }
        started = true;
        // A menu is the multiN chat interface; any other chat page is a click-to-continue.
        const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
        const open = p.modalChat === -1 ? '' : Component.get(p.modalChat).comName ?? '';
        const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
        if (multi) {
            const pick = picks.shift();
            if (pick === undefined) throw new Error('unexpected menu: ' + names.join(','));
            H.choose(p, `${multi.split(':')[0]}:com_${pick}`);
        } else {
            // ResumePauseButtonHandler: the continue click
            p.executeScript(s, true, true);
        }
    }
    H.tick(1);
    const text = H.ifaces
        .slice(from)
        .filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1)
        .map(i => i.text!);
    if (show) console.log('       ' + text.join(' | '));
    if (picks.length) throw new Error('menus not reached: ' + picks.join(','));
    return text;
}

console.log('FAMILY CREST GAUNTLETS  one of each kind, a fee after the first, and replacements');

// --- the full run: free first imbue, then the other two for 25,000 each ------------------------
const a = player('crestall', COMPLETE, 0);
H.give(a, 'steel_gauntlets');
H.give(a, 'coins', 100000);
console.log('Caleb, first imbue (free):');
talk(a, 'caleb_fitzharmon', [1]);
check('cooking gauntlets for the steel, no coins taken', [held(a), coins(a)], [[0, 1, 0, 0], 100000]);
check('  cooking bit set', (H.getVar(a, 'crest_spells_levers_gauntlets') >> BIT.cooking) & 1, 1);

console.log('Johnathon, no plain pair on me:');
talk(a, 'johnathon_fitzharmon', []);
check('nothing changes', [held(a), coins(a)], [[0, 1, 0, 0], 100000]);

console.log('Dimintheis, a fresh plain pair:');
talk(a, 'dimintheis', [1]);
check('a plain pair given', held(a), [1, 1, 0, 0]);

console.log('Caleb again, who already made my cooking pair:');
talk(a, 'caleb_fitzharmon', []);
check('Caleb keeps his hands off the plain pair', [held(a), coins(a)], [[1, 1, 0, 0], 100000]);

console.log('Avan, paid imbue:');
talk(a, 'avan', [1]);
check('goldsmith gauntlets, 25,000 coins taken', [held(a), coins(a)], [[0, 1, 1, 0], 75000]);

console.log('Dimintheis, another plain pair, then Johnathon, paid imbue:');
talk(a, 'dimintheis', [1]);
talk(a, 'johnathon_fitzharmon', [1]);
check('chaos gauntlets, another 25,000 taken', [held(a), coins(a)], [[0, 1, 1, 1], 50000]);
check('  all three bits set', (H.getVar(a, 'crest_spells_levers_gauntlets') >> 7) & 7, 7);

console.log('Dimintheis, with all three kinds owned:');
talk(a, 'dimintheis', []);
check('no plain pair offered (nothing left to imbue)', held(a), [0, 1, 1, 1]);

console.log('Lose the cooking and chaos gauntlets, then Dimintheis:');
H.clearInv(a);
H.give(a, 'gauntlets_of_goldsmithing');
talk(a, 'dimintheis', [1, 1]);
check('both lost kinds returned, free', [held(a), coins(a)], [[0, 1, 1, 1], 0]);

console.log('Worn and banked pairs count as owned:');
H.clearInv(a);
H.equip(a, { hands: 'gauntlets_of_cooking' });
H.give(a, 'gauntlets_of_chaos');
H.give(a, 'gauntlets_of_goldsmithing');
talk(a, 'dimintheis', []);
check('no duplicate cooking pair while wearing one', held(a), [0, 0, 1, 1]);
H.despawn(a);

// --- short of coins, and saying no ----------------------------------------------------------
const b = player('crestpoor', COMPLETE, 1 << BIT.chaos);
H.give(b, 'steel_gauntlets');
H.give(b, 'coins', 24999);
console.log('Caleb, paid imbue with 24,999 coins:');
talk(b, 'caleb_fitzharmon', [1]);
check('refused, nothing taken', [held(b), coins(b)], [[1, 0, 0, 0], 24999]);
check('  cooking bit still clear', (H.getVar(b, 'crest_spells_levers_gauntlets') >> BIT.cooking) & 1, 0);
console.log('Avan, turning down the fee:');
talk(b, 'avan', [2]);
check('declined, nothing taken', [held(b), coins(b)], [[1, 0, 0, 0], 24999]);
console.log('Johnathon, who already imbued a pair:');
talk(b, 'johnathon_fitzharmon', []);
check('no second chaos pair', [held(b), coins(b)], [[1, 0, 0, 0], 24999]);
console.log('Johnathon, having lost his pair:');
H.clearInv(b);
talk(b, 'johnathon_fitzharmon', []);
console.log('Dimintheis with a full pack:');
H.fillInv(b);
talk(b, 'dimintheis', []);
check('no room, nothing given', H.invCount(b, 'gauntlets_of_chaos'), 0);
H.despawn(b);

// --- a quest-complete player who first imbued before this change keeps their first kind ------
const c = player('crestold', COMPLETE, 0);
console.log('Dimintheis, lost the quest reward before any imbue:');
talk(c, 'dimintheis', [1]);
check('steel gauntlets back', held(c), [1, 0, 0, 0]);
console.log('Avan declines on the free imbue:');
talk(c, 'avan', [2]);
check('kept the steel', held(c), [1, 0, 0, 0]);
H.despawn(c);

// --- quest not complete ----------------------------------------------------------------------
const d = player('crestnew', 10, 0);
H.give(d, 'steel_gauntlets');
H.give(d, 'coins', 100000);
// Stage 10: Johnathon cured, the crest not yet whole. Each takes the option that leaves quietly.
const leave: Record<string, number[]> = { caleb_fitzharmon: [1], avan: [1], johnathon_fitzharmon: [3], dimintheis: [] };
for (const who of Object.keys(leave)) {
    console.log(`${who}, quest not complete:`);
    talk(d, who, leave[who]);
    p_close(d);
    check(`  ${who}: no gauntlets, no coins`, [held(d), coins(d)], [[1, 0, 0, 0], 100000]);
}
function p_close(p: any) {
    p.closeModal();
    if (p.activeScript) p.activeScript = null;
    H.tick(1);
}

console.log(`CREST GAUNTLETS  ${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
