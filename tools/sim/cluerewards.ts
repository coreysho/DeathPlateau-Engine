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

// ---------------------------------------------------------------- and the log knows about them
// A reward that is not on a collection log page is one the log quietly ignores:
// ~collection_log_casket walks the whole reward inv and calls ~collection_log_add on every slot,
// and add() looks the item up in the log's own list and RETURNS if it is not there. So a table
// entry missing from its page is silent - no error, no warning, just an item that never registers.
// 456 of them were in exactly that state until this check went in.
console.log('\nEVERY REWARD IS ON A COLLECTION LOG PAGE');
{
    const dbrow = readFileSync('../content/scripts/collection_log/configs/collection_log.dbrow', 'utf8');
    const pageItems = (key: string) => {
        const block = dbrow.split(/\[collection_log_/).find(b => b.startsWith(key + ']')) ?? '';
        return new Set((block.match(/^data=items,(\S+)$/gm) ?? []).map(l => l.split(',')[1]));
    };
    for (const [tier, proc, page] of [['easy', 'trail_clue_easy_rare', 'clue_easy'],
                                      ['medium', 'trail_clue_medium_rare', 'clue_medium'],
                                      ['hard', 'trail_clue_hard_rare', 'clue_hard'],
                                      ['hard', 'trail_clue_master_rare', 'clue_elite_master']] as [string, string, string][]) {
        const want = entriesOf(`${DIR}/${tier}/trail_clue_${tier}_reward.rs2`, proc);
        const have = pageItems(page);
        const missing = want.filter(n => !have.has(n));
        check(`  ${page.padEnd(18)} lists all ${want.length}`, missing.length ? missing.join(' ') : 'yes', 'yes');
    }

    // THE GOD PAGES ARE NOT IN ANY TIER'S TABLE, which is why the four lines above never covered
    // them: ~trail_clue_god_page rolls them ahead of all three tiers rather than sitting inside one.
    // They belong on the shared page and nowhere else, as they do in Old School - and for a while
    // they were rollable here and on no page at all, so a player could hold every one of them and
    // the window would never say so. Twelve, not Old School's twenty-four: the Armadyl, Bandos and
    // Ancient books came years after this era.
    const PAGES = (readFileSync('../content/scripts/minigames/game_trail/configs/trail_god_pages.enum', 'utf8')
        .match(/^val=\d+,(\S+)$/gm) ?? []).map(l => l.split(',')[1]);
    check('  the era has twelve god pages', PAGES.length, 12);
    const sharedHas = pageItems('clue_shared');
    const noPage = PAGES.filter(n => !sharedHas.has(n));
    check('  clue_shared         lists all 12 god pages', noPage.length ? noPage.join(' ') : 'yes', 'yes');
    for (const page of ['clue_easy', 'clue_medium', 'clue_hard', 'clue_elite_master']) {
        const dupes = PAGES.filter(n => pageItems(page).has(n));
        check(`  and ${page.padEnd(18)} does not repeat them`, dupes.length ? dupes.join(' ') : 'yes', 'yes');
    }
}

// And the round trip on the real engine: roll a casket and the log fills.
console.log('\nOPENING A CASKET RECORDS WHAT WAS IN IT');
{
    const q: any = player('cluelog', 3200, 3200);
    H.clearInv(q);
    const LOG = InvType.getId('collection_log');
    const count = () => {
        const inv = q.getInventory(LOG)!;
        let n = 0;
        for (let s = 0; s < inv.capacity; s++) if (inv.get(s)) n++;
        return n;
    };
    const had = count();
    const inv = q.getInventory(REWARD)!;
    for (let s = 0; s < inv.capacity; s++) inv.delete(s);
    // IN THAT ORDER. casket_before SNAPSHOTS the reward inv so that what is already in it - loot
    // from a casket the player had no room for - is not logged twice; ~trail_prepare_rewardinv
    // calls it before any rolling. Running it after the roll makes the snapshot equal to the loot
    // and the delta zero, and nothing is recorded at all.
    A.runProcProtected(q, '[proc,collection_log_casket_before]');
    A.runProcProtected(q, '[proc,trail_clue_hard_rare]');
    A.runProcProtected(q, '[proc,collection_log_casket]', [0, 'hard']);
    check('  the log gained what the casket rolled', count() > had, true);
    H.despawn(q);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
