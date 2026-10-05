// Every clue reward table, rolled until it has nothing left to show.
//
// 423 items were imported on 2026-10-04 and wired into the three rare tables; the elite and master
// uniques, which have no trail of their own in a 2006 build, hang off the hard table's rare roll.
// A switch_int table is exactly the kind of thing that compiles and packs with an entry nobody can
// ever reach - an off-by-one in the random() bound hides the last case, and nothing complains.
// So this rolls each table thousands of times and fails unless EVERY entry has come out.
//
//   npx tsx tools/sim/cluerewards.ts
import { readFileSync } from 'fs';

import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player } from './a1lib.ts';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';

await H.boot();

const REWARD = InvType.getId('trail_rewardinv');

/** What the table is supposed to hand out, read off the script rather than copied here. */
function entriesOf(path: string, proc: string): string[] {
    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    const at = lines.findIndex(l => l.trim() === `[proc,${proc}]`);
    if (at < 0) throw new Error('no ' + proc);
    const out: string[] = [];
    for (let i = at + 1; i < lines.length; i++) {
        if (/^\[(proc|label),/.test(lines[i])) break;
        const m = /inv_add\(trail_rewardinv,\s*([a-z0-9_]+)/.exec(lines[i]);
        if (m) out.push(m[1]);
    }
    return out;
}

/** Roll a table and return every obj it ever produced. */
function roll(p: any, proc: string, times: number): Set<string> {
    const seen = new Set<string>();
    for (let i = 0; i < times; i++) {
        const inv = p.getInventory(REWARD)!;
        for (let s = 0; s < inv.capacity; s++) inv.delete(s);
        A.runProcProtected(p, `[proc,${proc}]`);
        for (let s = 0; s < inv.capacity; s++) {
            const o = inv.get(s);
            if (o) seen.add(ObjType.get(o.id).debugname ?? String(o.id));
        }
    }
    return seen;
}

const p: any = player('clue', 3200, 3200);
const DIR = '../content/scripts/minigames/game_trail/scripts';

for (const [tier, proc] of [['easy', 'trail_clue_easy_rare'], ['medium', 'trail_clue_medium_rare'],
                            ['hard', 'trail_clue_hard_rare'], ['hard', 'trail_clue_master_rare']] as [string, string][]) {
    const path = `${DIR}/${tier}/trail_clue_${tier}_reward.rs2`;
    const want = entriesOf(path, proc);
    console.log(`\n${proc.toUpperCase()} - ${want.length} entries`);

    // Every name in the table has to BE something. A typo here packs fine and throws at the
    // moment a player opens the casket, which is the worst place to find out.
    const unknown = want.filter(n => ObjType.getId(n) === -1);
    check('  every entry names a real item', unknown.length ? unknown.join(' ') : 'yes', 'yes');

    // The hard table spends one roll in eight on the elite/master table, so it needs more throws
    // to show all of its own; 400 per entry is comfortably past coupon-collector for both.
    const seen = roll(p, proc, want.length * 400);
    const missing = want.filter(n => !seen.has(n));
    check('  and every one of them can actually come out', missing.length ? missing.join(' ') : 'yes', 'yes');
}

// ---------------------------------------------------------------- the rate the comment claims
console.log('\nTHE ELITE AND MASTER TABLE IS REACHED ONE RARE ROLL IN EIGHT');
{
    const master = new Set(entriesOf(`${DIR}/hard/trail_clue_hard_reward.rs2`, 'trail_clue_master_rare'));
    let hits = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
        const inv = p.getInventory(REWARD)!;
        for (let s = 0; s < inv.capacity; s++) inv.delete(s);
        A.runProcProtected(p, '[proc,trail_clue_hard_rare]');
        const o = inv.get(0);
        if (o && master.has(ObjType.get(o.id).debugname ?? '')) hits++;
    }
    const rate = hits / N;
    check(`  ${(rate * 100).toFixed(1)}% of rare rolls (want 12.5%)`, Math.abs(rate - 0.125) < 0.02, true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
