/**
 * The trading post's rules, run against the real TradingPost class and a real (in-memory) SQLite.
 *
 * WHAT IS BEING CHECKED is that nothing is ever created or destroyed. Every scenario ends by adding
 * up every coin and every item - in pockets, in open listings, in pending offers, in collection
 * boxes - and comparing with what the scenario started with. A market's bugs are dupes and voids,
 * and both show up here as a total that moved, whatever the code path.
 *
 * The inventories are fakes with a fixed number of slots and the same stacking rule as Inventory
 * (stackable or noted stacks; anything else takes a slot each), so "did not fit" is exercised.
 *
 *   npx tsx tools/tradingpostcheck.ts
 */
import TradingPost, { TpObjInfo, TpPocket, TP_MAX_LISTINGS } from '#/engine/market/TradingPost.js';

// ---- objs: coins, a stackable, an unstackable with a note, an unstackable without, an untradeable
const COINS = 995,
    RUNE_ESS = 1436,
    RUNE_ESS_NOTE = 1437,
    PLATEBODY = 1127,
    PLATEBODY_NOTE = 1128,
    CAPE = 1052,
    QUEST = 9999;
const OBJS: Record<number, { name: string; stack?: boolean; trade?: boolean; cert?: number; uncert?: number }> = {
    [COINS]: { name: 'Coins', stack: true },
    [RUNE_ESS]: { name: 'Rune essence', cert: RUNE_ESS_NOTE },
    [RUNE_ESS_NOTE]: { name: 'Rune essence', stack: true, uncert: RUNE_ESS },
    [PLATEBODY]: { name: 'Rune platebody', cert: PLATEBODY_NOTE },
    [PLATEBODY_NOTE]: { name: 'Rune platebody', stack: true, uncert: PLATEBODY },
    [CAPE]: { name: 'Cape of legends' },
    [QUEST]: { name: 'Quest thing', trade: false }
};
const info: TpObjInfo = {
    exists: o => o in OBJS,
    name: o => OBJS[o].name,
    stackable: o => OBJS[o].stack === true,
    tradeable: o => OBJS[o].trade !== false,
    uncert: o => OBJS[o].uncert ?? o,
    cert: o => OBJS[o].cert ?? -1
};

class Pocket implements TpPocket {
    slots: ({ obj: number; count: number } | null)[];
    constructor(
        readonly username: string,
        size = 28
    ) {
        this.slots = new Array(size).fill(null);
    }
    total(obj: number) {
        return this.slots.reduce((n, s) => n + (s && s.obj === obj ? s.count : 0), 0);
    }
    add(obj: number, count: number) {
        if (info.stackable(obj)) {
            let s = this.slots.find(s => s?.obj === obj);
            if (!s) {
                const i = this.slots.indexOf(null);
                if (i === -1) return 0;
                s = this.slots[i] = { obj, count: 0 };
            }
            s.count += count;
            return count;
        }
        let done = 0;
        for (let i = 0; i < this.slots.length && done < count; i++) {
            if (!this.slots[i]) {
                this.slots[i] = { obj, count: 1 };
                done++;
            }
        }
        return done;
    }
    del(obj: number, count: number) {
        let done = 0;
        for (let i = 0; i < this.slots.length && done < count; i++) {
            const s = this.slots[i];
            if (!s || s.obj !== obj) continue;
            const take = Math.min(s.count, count - done);
            s.count -= take;
            done += take;
            if (s.count === 0) this.slots[i] = null;
        }
        return done;
    }
}

let fails = 0;
function check(ok: boolean, what: string) {
    console.log((ok ? '  ok   ' : '  FAIL ') + what);
    if (!ok) fails++;
}

type World = { tp: TradingPost; online: Set<string>; told: Map<string, string[]>; saved: string[]; pockets: Pocket[] };

function world(...pockets: Pocket[]): World {
    const online = new Set(pockets.map(p => p.username));
    const told = new Map<string, string[]>();
    const saved: string[] = [];
    let clock = 1_000_000;
    const tp = new TradingPost(':memory:', COINS, info, {
        tell: (u, t) => {
            if (!online.has(u)) return false;
            told.set(u, [...(told.get(u) ?? []), t]);
            return true;
        },
        changed: u => saved.push(u),
        now: () => clock++
    });
    return { tp, online, told, saved, pockets };
}

// Everything that exists, by unnoted obj.
function census(w: World): Map<number, number> {
    const all = new Map<number, number>();
    const put = (obj: number, n: number) => {
        const b = info.uncert(obj);
        all.set(b, (all.get(b) ?? 0) + n);
    };
    for (const p of w.pockets) for (const s of p.slots) if (s) put(s.obj, s.count);
    const db = w.tp.db;
    for (const r of db.prepare('SELECT obj, count FROM listing WHERE state = 0').all() as { obj: number; count: number }[]) put(r.obj, r.count);
    for (const r of db.prepare('SELECT coins FROM offer WHERE state = 0').all() as { coins: number }[]) put(COINS, r.coins);
    for (const r of db.prepare('SELECT i.obj, i.count FROM offer_item i JOIN offer o ON o.id = i.offer WHERE o.state = 0').all() as { obj: number; count: number }[]) put(r.obj, r.count);
    for (const r of db.prepare('SELECT obj, count FROM collect').all() as { obj: number; count: number }[]) put(r.obj, r.count);
    for (const [k, v] of [...all]) if (v === 0) all.delete(k);
    return all;
}
const same = (a: Map<number, number>, b: Map<number, number>) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
function conserved(w: World, before: Map<number, number>, what: string) {
    const after = census(w);
    check(same(before, after), `${what}: nothing created or destroyed ${same(before, after) ? '' : JSON.stringify([...before]) + ' -> ' + JSON.stringify([...after])}`);
}
const lastListing = (w: World) => (w.tp.db.prepare('SELECT max(id) AS id FROM listing').get() as { id: number }).id;
const lastOffer = (w: World) => (w.tp.db.prepare('SELECT max(id) AS id FROM offer').get() as { id: number }).id;

console.log('listing');
{
    const alice = new Pocket('alice');
    alice.add(RUNE_ESS_NOTE, 500);
    alice.add(QUEST, 1);
    alice.add(COINS, 100);
    const w = world(alice);
    const t0 = census(w);
    check(w.tp.list(alice, QUEST, 1, 0) !== '', 'an untradeable item is refused');
    check(w.tp.list(alice, COINS, 50, 0) !== '', 'coins are refused');
    check(w.tp.list(alice, RUNE_ESS_NOTE, 501, 0) !== '', 'more than you hold is refused');
    check(w.tp.list(alice, RUNE_ESS_NOTE, 0, 0) !== '', 'zero is refused');
    check(alice.total(RUNE_ESS_NOTE) === 500, 'a refusal takes nothing');
    check(w.tp.list(alice, RUNE_ESS_NOTE, 200, 1000) === '', 'noted essence lists');
    check(alice.total(RUNE_ESS_NOTE) === 300, 'and leaves the inventory');
    check(w.tp.listing(lastListing(w))!.obj === RUNE_ESS, 'and is stored unnoted');
    check(w.saved.includes('alice'), 'and the seller is saved on the spot');
    check(w.tp.browse('', RUNE_ESS_NOTE).length === 1 && w.tp.browse('', RUNE_ESS).length === 1, 'a search by either form finds it');
    check(w.tp.browse('rune ess').length === 1 && w.tp.browse('rune_ess').length === 1 && w.tp.browse('platebody').length === 0, 'a search by name finds it, underscores or spaces');
    for (let i = 1; i < TP_MAX_LISTINGS; i++) w.tp.list(alice, RUNE_ESS_NOTE, 1, 0);
    check(w.tp.list(alice, RUNE_ESS_NOTE, 1, 0) !== '', `the ${TP_MAX_LISTINGS + 1}th listing is refused`);
    conserved(w, t0, 'listing');
}

console.log('buy now');
{
    const alice = new Pocket('alice'),
        bob = new Pocket('bob'),
        carol = new Pocket('carol'),
        poor = new Pocket('poor');
    poor.add(COINS, 10);
    alice.add(PLATEBODY, 1);
    alice.add(PLATEBODY, 1);
    alice.add(PLATEBODY, 1);
    bob.add(COINS, 100_000);
    carol.add(COINS, 50_000);
    carol.add(CAPE, 1);
    const w = world(alice, bob, carol, poor);
    const t0 = census(w);
    check(w.tp.list(alice, PLATEBODY, 3, 90_000) === '', 'three unnoted platebodies list as one lot');
    const id = lastListing(w);
    check(alice.total(PLATEBODY) === 0, 'all three leave the inventory');
    check(w.tp.buyNow(alice, id) !== '', 'you cannot buy your own');
    check(w.tp.makeOffer(carol, id, 40_000, carol, [{ obj: CAPE, count: 1 }]) === '', 'carol offers coins and a cape');
    check(carol.total(COINS) === 10_000 && carol.total(CAPE) === 0, 'and both are held');
    check(w.tp.makeOffer(bob, id, 90_000, bob, []) !== '', 'offering the buyout in coins points at Buy now instead');
    check(w.tp.buyNow(poor, id) !== '', 'buy now without the coins is refused');
    check(w.tp.buyNow(bob, id) === '', 'bob buys it now');
    check(bob.total(COINS) === 10_000, 'bob pays the buyout');
    check(bob.total(PLATEBODY_NOTE) === 3, 'and gets three platebodies, noted, in one slot');
    check(w.tp.boxCount('alice', COINS) === 90_000, "the coins wait in alice's box");
    check(w.tp.boxCount('carol', COINS) === 40_000 && w.tp.boxCount('carol', CAPE) === 1, "carol's offer went back to her box, all of it");
    check(
        (w.told.get('alice') ?? []).some(t => t.includes('Bob bought your 3 x Rune platebody')),
        'alice is told, by name'
    );
    check(
        (w.told.get('carol') ?? []).some(t => t.includes('has been sold')),
        'carol is told'
    );
    check(w.tp.buyNow(bob, id) !== '', 'it cannot be bought twice');
    check(w.tp.accept('alice', lastOffer(w)) !== '', "carol's lapsed offer cannot then be accepted");
    conserved(w, t0, 'buy now');
    check(w.tp.collect(alice, COINS, 2_000_000, false) === '' && alice.total(COINS) === 90_000, 'alice collects her coins');
    check(w.tp.box('alice').length === 0, 'and the box row is gone');
    conserved(w, t0, 'after collecting');
}

console.log('barter, accept, decline, withdraw');
{
    const alice = new Pocket('alice'),
        bob = new Pocket('bob'),
        carol = new Pocket('carol'),
        dave = new Pocket('dave');
    alice.add(CAPE, 1);
    bob.add(COINS, 5_000);
    bob.add(RUNE_ESS_NOTE, 1_000);
    carol.add(COINS, 20_000);
    dave.add(COINS, 7_000);
    const w = world(alice, bob, carol, dave);
    w.online.delete('bob'); // bob logs off after offering
    const t0 = census(w);
    check(w.tp.list(alice, CAPE, 1, 0) === '', 'a cape lists with no buyout - offers only');
    const id = lastListing(w);
    check(w.tp.buyNow(carol, id) !== '', 'and cannot be bought now');
    check(
        w.tp.makeOffer(bob, id, 0, bob, [
            { obj: RUNE_ESS_NOTE, count: 1_000 },
            { obj: COINS, count: 0 }
        ]) === '',
        'bob offers a thousand essence and no coins'
    );
    const bobOffer = lastOffer(w);
    check(w.tp.makeOffer(bob, id, 10, bob, []) !== '', 'bob cannot stack a second offer on the same listing');
    check(w.tp.makeOffer(carol, id, 20_001, carol, []) !== '', 'carol cannot offer more coins than she has');
    check(w.tp.makeOffer(carol, id, 15_000, carol, []) === '', 'carol offers 15,000');
    const carolOffer = lastOffer(w);
    check(w.tp.makeOffer(dave, id, 7_000, dave, []) === '', 'dave offers 7,000');
    const daveOffer = lastOffer(w);
    check(
        w.tp
            .offersOn(id)
            .map(o => o.buyer)
            .join() === 'carol,dave,bob',
        'offers list best first'
    );
    check(w.tp.describeOffer(w.tp.offer(bobOffer)!) === '1,000 x Rune essence', 'an item offer describes itself');
    check(w.tp.accept('carol', bobOffer) !== '', 'only the seller can accept');
    check(w.tp.decline('alice', daveOffer) === '', 'alice declines dave');
    check(w.tp.boxCount('dave', COINS) === 7_000, "dave's coins go to his box");
    check(w.tp.withdraw(carol, carolOffer) === '' && carol.total(COINS) === 20_000, 'carol withdraws, straight into her inventory');
    check(w.tp.withdraw(carol, carolOffer) !== '', 'and cannot withdraw it twice');
    check(w.tp.accept('alice', bobOffer) === '', 'alice accepts the essence');
    check(w.tp.boxCount('alice', RUNE_ESS) === 1_000, "the essence waits in alice's box, unnoted");
    check(w.tp.boxCount('bob', CAPE) === 1, "the cape waits in bob's box");
    check(!(w.told.get('bob') ?? []).length, 'bob, offline, was told nothing live');
    check(
        w.tp.takeNotices('bob').some(t => t.includes('accepted your offer')),
        'the news waits for his login'
    );
    check(w.tp.takeNotices('bob').length === 0, 'and is only read out once');
    conserved(w, t0, 'barter');

    check(w.tp.collect(alice, RUNE_ESS, 1_000, false) === 'You have run out of room.' && alice.total(RUNE_ESS) === 28, 'collecting 1,000 unnoted essence fills 28 slots');
    check(w.tp.boxCount('alice', RUNE_ESS) === 972, 'and leaves the rest in the box');
    check(w.tp.collect(alice, RUNE_ESS, 1_000, true) === 'You have no room for that.', 'with no free slot even the noted form is refused');
    alice.del(RUNE_ESS, 28); // she banks them
    t0.set(RUNE_ESS, t0.get(RUNE_ESS)! - 28);
    check(w.tp.collect(alice, RUNE_ESS, 1_000, true) === '' && alice.total(RUNE_ESS_NOTE) === 972, 'the rest comes out noted');
    conserved(w, t0, 'collecting');
}

console.log('cancelling');
{
    const alice = new Pocket('alice', 1),
        bob = new Pocket('bob');
    alice.add(COINS, 1);
    bob.add(COINS, 1_000);
    const w = world(alice, bob);
    // alice's inventory is one slot, full of coins, when her listing comes back
    w.tp.db.prepare('INSERT INTO listing (seller, obj, count, buyout, created) VALUES (?, ?, ?, ?, ?)').run('alice', PLATEBODY, 2, 0, 1);
    const t0 = census(w);
    const id = lastListing(w);
    check(w.tp.makeOffer(bob, id, 500, bob, []) === '', 'bob offers');
    check(w.tp.cancel(bob, id) !== '', 'bob cannot cancel it');
    check(w.tp.cancel(alice, id) === '', 'alice cancels');
    check(w.tp.boxCount('alice', PLATEBODY) === 2, 'a listing that does not fit goes to the box');
    check(w.tp.boxCount('bob', COINS) === 500, "bob's offer goes back to his box");
    check(w.tp.cancel(alice, id) !== '', 'it cannot be cancelled twice');
    conserved(w, t0, 'cancelling');
}

console.log('a failed write moves nothing');
{
    const alice = new Pocket('alice'),
        bob = new Pocket('bob');
    alice.add(CAPE, 1);
    bob.add(COINS, 1_000);
    const w = world(alice, bob);
    w.tp.list(alice, CAPE, 1, 900);
    const id = lastListing(w);
    const t0 = census(w);
    w.tp.db.exec("CREATE TRIGGER boom BEFORE UPDATE ON listing BEGIN SELECT RAISE(ABORT, 'disk'); END");
    let threw = false;
    try {
        w.tp.buyNow(bob, id);
    } catch {
        threw = true;
    }
    check(threw, 'a write that fails throws');
    check(bob.total(COINS) === 1_000 && bob.total(CAPE) === 0, "and bob's inventory is as it was");
    check(w.tp.listing(id)!.state === 0, 'and the listing is still open');
    conserved(w, t0, 'a failed write');
}

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
