import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

// THE TRADING POST (custom, 2026-09-21). A player-run market with bartering.
//
// A seller LISTS an item - it leaves their inventory and is held here - with an optional buyout
// price. Anybody can then BUY IT NOW at that price, or make an OFFER: coins, items, or both.
// Offers are held here too, so the seller's Accept completes the trade on the spot whether or not
// the buyer is logged in, and there is no way to offer money you do not have. Accepting one offer
// hands every other offer on that listing back to its buyer.
//
// WHY ITS OWN DATABASE, AND WHY SYNCHRONOUS. Player saves are files the login server writes, so an
// offline player cannot be given anything by the game thread - the trade that sells your item while
// you are away has to put the coins somewhere that is not your save. That somewhere is the
// COLLECTION BOX, a table here, which the player empties at any trading post.
//   The rest of the engine's SQL runs in worker threads through Kysely, asynchronously, because a
// tick cannot wait on a Promise. This cannot be asynchronous: "take the coins from the inventory"
// and "record the offer" have to happen in the same tick or not at all, or a second click in
// between spends the same coins twice. node:sqlite's DatabaseSync is a local file with no round
// trip, and each action here is a handful of rows, so it runs inline in the command that asked.
// It is a separate file from db.sqlite so that it works the same under DB_BACKEND=mysql, and so
// nothing else's migrations can lock it.
//   A consequence worth knowing: this is ONE WORLD's market. Two worlds pointed at the same file
// would each think they owned it.
//
// EVERYTHING IS STORED UNNOTED. A listing of 100 noted rune essence and one of 100 unnoted are the
// same listing, a search for either finds both, and the collection box asks how you want it.

export const enum ListingState {
    OPEN = 0,
    SOLD = 1,
    CANCELLED = 2
}

export const enum OfferState {
    PENDING = 0,
    ACCEPTED = 1,
    DECLINED = 2,
    WITHDRAWN = 3,
    LAPSED = 4 // the listing sold to somebody else, or its seller took it down
}

export type Listing = {
    id: number;
    seller: string;
    obj: number;
    count: number;
    buyout: number; // 0 = offers only
    created: number; // unix ms
    state: ListingState;
};

export type Offer = {
    id: number;
    listing: number;
    buyer: string;
    coins: number;
    created: number;
    state: OfferState;
};

export type OfferItem = { obj: number; count: number };

// What the market needs to know about an obj. ObjType in the game, a table in the tests.
export interface TpObjInfo {
    exists(obj: number): boolean;
    name(obj: number): string;
    stackable(obj: number): boolean;
    tradeable(obj: number): boolean;
    uncert(obj: number): number; // the unnoted form, or obj itself
    cert(obj: number): number; // the noted form, or -1 when it has none
}

// A player's inventory, as far as the market touches it. add() and del() return how many actually
// moved, the same as Inventory.add/remove.
export interface TpPocket {
    readonly username: string;
    total(obj: number): number;
    add(obj: number, count: number): number;
    del(obj: number, count: number): number;
}

export type TpHooks = {
    // Deliver a line to a player who is online now. False when they are not, and the market keeps it.
    tell(username: string, text: string): boolean;
    // A player's holdings changed because of the market. The game saves them on the spot, so a crash
    // cannot roll their inventory back to before a trade the market has already recorded.
    changed(username: string): void;
    // Every notice, online or not. Where the Discord relay plugs in.
    notice?(username: string, text: string): void;
    now(): number;
};

export const TP_MAX_LISTINGS = 10; // open listings per seller
export const TP_MAX_OFFERS = 20; // pending offers per buyer, across all listings
export const TP_MAX_OFFER_ITEMS = 12; // distinct objs in one offer - the barter inv's size
const INT_MAX = 0x7fffffff;

export function tpFormat(n: number): string {
    return n.toLocaleString('en-US');
}

// "1 coin", "1,500 coins"
export function tpCoins(n: number): string {
    return n === 1 ? '1 coin' : `${tpFormat(n)} coins`;
}

export default class TradingPost {
    readonly db: DatabaseSync;
    readonly coins: number;
    private readonly objs: TpObjInfo;
    private readonly hooks: TpHooks;

    constructor(file: string, coins: number, objs: TpObjInfo, hooks: TpHooks) {
        if (file !== ':memory:') {
            fs.mkdirSync(path.dirname(file), { recursive: true });
        }
        this.db = new DatabaseSync(file);
        this.coins = coins;
        this.objs = objs;
        this.hooks = hooks;
        this.db.exec('PRAGMA journal_mode = WAL');
        this.db.exec('PRAGMA synchronous = FULL');
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS listing (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                seller  TEXT    NOT NULL,
                obj     INTEGER NOT NULL,
                count   INTEGER NOT NULL,
                buyout  INTEGER NOT NULL,
                created INTEGER NOT NULL,
                state   INTEGER NOT NULL DEFAULT 0,
                closed  INTEGER,
                buyer   TEXT,
                price   TEXT
            );
            CREATE INDEX IF NOT EXISTS listing_open ON listing (state, created);
            CREATE INDEX IF NOT EXISTS listing_seller ON listing (seller, state);

            CREATE TABLE IF NOT EXISTS offer (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                listing INTEGER NOT NULL,
                buyer   TEXT    NOT NULL,
                coins   INTEGER NOT NULL,
                created INTEGER NOT NULL,
                state   INTEGER NOT NULL DEFAULT 0,
                closed  INTEGER
            );
            CREATE INDEX IF NOT EXISTS offer_listing ON offer (listing, state);
            CREATE INDEX IF NOT EXISTS offer_buyer ON offer (buyer, state);

            CREATE TABLE IF NOT EXISTS offer_item (
                offer INTEGER NOT NULL,
                obj   INTEGER NOT NULL,
                count INTEGER NOT NULL,
                PRIMARY KEY (offer, obj)
            );

            -- What a player is owed. One row per obj, so it stacks however many trades it came from.
            CREATE TABLE IF NOT EXISTS collect (
                player TEXT    NOT NULL,
                obj    INTEGER NOT NULL,
                count  INTEGER NOT NULL,
                PRIMARY KEY (player, obj)
            );

            -- Lines for players who were offline when something happened, read out at login.
            CREATE TABLE IF NOT EXISTS notice (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                player  TEXT    NOT NULL,
                text    TEXT    NOT NULL,
                created INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS notice_player ON notice (player);
        `);
    }

    // ---- reads ----

    listing(id: number): Listing | undefined {
        return this.db.prepare('SELECT id, seller, obj, count, buyout, created, state FROM listing WHERE id = ?').get(id) as Listing | undefined;
    }

    offer(id: number): Offer | undefined {
        return this.db.prepare('SELECT id, listing, buyer, coins, created, state FROM offer WHERE id = ?').get(id) as Offer | undefined;
    }

    offerItems(offer: number): OfferItem[] {
        return this.db.prepare('SELECT obj, count FROM offer_item WHERE offer = ? ORDER BY rowid').all(offer) as OfferItem[];
    }

    // Open listings, newest first. query matches anywhere in the item's name; obj matches exactly.
    browse(query: string, obj: number = -1): Listing[] {
        const open = this.db.prepare('SELECT id, seller, obj, count, buyout, created, state FROM listing WHERE state = 0 ORDER BY created DESC, id DESC').all() as Listing[];
        if (obj !== -1) {
            const want = this.objs.uncert(obj);
            return open.filter(l => l.obj === want);
        }
        const q = query.trim().toLowerCase().replaceAll('_', ' ');
        if (q.length === 0) {
            return open;
        }
        return open.filter(l => this.objs.name(l.obj).toLowerCase().includes(q));
    }

    listingsBy(seller: string): Listing[] {
        return this.db.prepare('SELECT id, seller, obj, count, buyout, created, state FROM listing WHERE seller = ? AND state = 0 ORDER BY created, id').all(seller) as Listing[];
    }

    // Pending offers on a listing, best first: most coins, then earliest.
    offersOn(listing: number): Offer[] {
        return this.db.prepare('SELECT id, listing, buyer, coins, created, state FROM offer WHERE listing = ? AND state = 0 ORDER BY coins DESC, created, id').all(listing) as Offer[];
    }

    offersBy(buyer: string): Offer[] {
        return this.db.prepare('SELECT id, listing, buyer, coins, created, state FROM offer WHERE buyer = ? AND state = 0 ORDER BY created, id').all(buyer) as Offer[];
    }

    box(player: string): OfferItem[] {
        return this.db.prepare('SELECT obj, count FROM collect WHERE player = ? ORDER BY rowid').all(player) as OfferItem[];
    }

    boxCount(player: string, obj: number): number {
        const row = this.db.prepare('SELECT count FROM collect WHERE player = ? AND obj = ?').get(player, obj) as { count: number } | undefined;
        return row?.count ?? 0;
    }

    describe(l: Listing): string {
        return l.count === 1 ? this.objs.name(l.obj) : `${tpFormat(l.count)} x ${this.objs.name(l.obj)}`;
    }

    // "12,000 coins + 3 items", "2 items", "500 coins"
    describeOffer(o: Offer): string {
        const items = this.offerItems(o.id);
        const parts: string[] = [];
        if (o.coins > 0) {
            parts.push(`${tpCoins(o.coins)}`);
        }
        if (items.length === 1) {
            const i = items[0];
            parts.push(i.count === 1 ? this.objs.name(i.obj) : `${tpFormat(i.count)} x ${this.objs.name(i.obj)}`);
        } else if (items.length > 1) {
            parts.push(`${items.length} items`);
        }
        return parts.join(' + ');
    }

    // ---- actions ----
    // Each returns '' on success or a sentence to show the player, and changes nothing when it
    // refuses. Every check runs before the first thing moves.

    list(seller: TpPocket, obj: number, count: number, buyout: number): string {
        if (!this.objs.exists(obj)) {
            return 'You cannot list that.';
        }
        const base = this.objs.uncert(obj);
        if (base === this.coins) {
            return 'You cannot list coins.';
        }
        if (!this.objs.tradeable(base)) {
            return 'You cannot trade that item.';
        }
        if (count < 1) {
            return 'You need to list at least one.';
        }
        if (buyout < 0) {
            return 'That is not a price.';
        }
        if (seller.total(obj) < count) {
            return "You don't have that many.";
        }
        if (this.listingsBy(seller.username).length >= TP_MAX_LISTINGS) {
            return `You can only have ${TP_MAX_LISTINGS} items on the trading post at once.`;
        }

        this.atomic(undo => {
            const taken = seller.del(obj, count);
            undo.push(() => seller.add(obj, taken));
            if (taken !== count) {
                throw new Error(`list: took ${taken} of ${count}`);
            }
            this.db.prepare('INSERT INTO listing (seller, obj, count, buyout, created) VALUES (?, ?, ?, ?, ?)').run(seller.username, base, count, buyout, this.hooks.now());
        });
        this.hooks.changed(seller.username);
        return '';
    }

    buyNow(buyer: TpPocket, listingId: number): string {
        const l = this.listing(listingId);
        if (!l || l.state !== ListingState.OPEN) {
            return 'That item is no longer for sale.';
        }
        if (l.seller === buyer.username) {
            return 'That is your own listing.';
        }
        if (l.buyout <= 0) {
            return 'That item has no buyout price - make an offer instead.';
        }
        if (buyer.total(this.coins) < l.buyout) {
            return `You need ${tpCoins(l.buyout)} to buy that.`;
        }

        const others = this.offersOn(l.id);
        this.atomic(undo => {
            const paid = buyer.del(this.coins, l.buyout);
            undo.push(() => buyer.add(this.coins, paid));
            if (paid !== l.buyout) {
                throw new Error(`buyNow: took ${paid} of ${l.buyout}`);
            }
            this.close(l, ListingState.SOLD, buyer.username, `${l.buyout}`);
            this.credit(l.seller, this.coins, l.buyout);
            this.hand(buyer, l.obj, l.count, undo);
            for (const o of others) {
                this.refund(o, OfferState.LAPSED);
            }
        });

        this.hooks.changed(buyer.username);
        this.notify(l.seller, `${this.name(buyer.username)} bought your ${this.describe(l)} for ${tpCoins(l.buyout)}.`);
        for (const o of others) {
            this.notify(o.buyer, `The ${this.describe(l)} you made an offer on has been sold. Your offer is in your collection box.`);
        }
        return '';
    }

    // Coins from the buyer's inventory, items from the barter inv (which empties).
    makeOffer(buyer: TpPocket, listingId: number, coins: number, items: TpPocket, itemList: OfferItem[]): string {
        const l = this.listing(listingId);
        if (!l || l.state !== ListingState.OPEN) {
            return 'That item is no longer for sale.';
        }
        if (l.seller === buyer.username) {
            return 'That is your own listing.';
        }
        if (coins < 0) {
            return 'That is not an amount of coins.';
        }
        const offered = itemList.filter(i => i.count > 0);
        if (coins === 0 && offered.length === 0) {
            return 'Offer some coins, some items, or both.';
        }
        if (offered.length > TP_MAX_OFFER_ITEMS) {
            return `An offer can hold at most ${TP_MAX_OFFER_ITEMS} different items.`;
        }
        if (l.buyout > 0 && coins >= l.buyout && offered.length === 0) {
            return `That is the buyout price or more - use Buy now for ${tpCoins(l.buyout)}.`;
        }
        if (buyer.total(this.coins) < coins) {
            return "You don't have that many coins.";
        }
        for (const i of offered) {
            if (!this.objs.tradeable(this.objs.uncert(i.obj))) {
                return `You cannot trade the ${this.objs.name(i.obj)}.`;
            }
            if (items.total(i.obj) < i.count) {
                return 'Your offer has changed - please try again.';
            }
        }
        if (this.offersOn(l.id).some(o => o.buyer === buyer.username)) {
            return 'You already have an offer on that - withdraw it first to make a new one.';
        }
        if (this.offersBy(buyer.username).length >= TP_MAX_OFFERS) {
            return `You can only have ${TP_MAX_OFFERS} offers open at once.`;
        }

        let offerId = -1;
        this.atomic(undo => {
            if (coins > 0) {
                const paid = buyer.del(this.coins, coins);
                undo.push(() => buyer.add(this.coins, paid));
                if (paid !== coins) {
                    throw new Error(`makeOffer: took ${paid} of ${coins} coins`);
                }
            }
            const res = this.db.prepare('INSERT INTO offer (listing, buyer, coins, created) VALUES (?, ?, ?, ?)').run(l.id, buyer.username, coins, this.hooks.now());
            offerId = Number(res.lastInsertRowid);
            // An obj offered noted and unnoted in one go is one row.
            const merged = new Map<number, number>();
            for (const i of offered) {
                const taken = items.del(i.obj, i.count);
                undo.push(() => items.add(i.obj, taken));
                if (taken !== i.count) {
                    throw new Error(`makeOffer: took ${taken} of ${i.count} ${i.obj}`);
                }
                const base = this.objs.uncert(i.obj);
                merged.set(base, (merged.get(base) ?? 0) + i.count);
            }
            const put = this.db.prepare('INSERT INTO offer_item (offer, obj, count) VALUES (?, ?, ?)');
            for (const [obj, count] of merged) {
                put.run(offerId, obj, count);
            }
        });

        this.hooks.changed(buyer.username);
        const o = this.offer(offerId)!;
        this.notify(l.seller, `${this.name(buyer.username)} offered ${this.describeOffer(o)} for your ${this.describe(l)}.`);
        return '';
    }

    accept(seller: string, offerId: number): string {
        const o = this.offer(offerId);
        const l = o ? this.listing(o.listing) : undefined;
        if (!o || !l || l.seller !== seller) {
            return 'That offer is not yours to accept.';
        }
        if (o.state !== OfferState.PENDING || l.state !== ListingState.OPEN) {
            return 'That offer is no longer open.';
        }

        const items = this.offerItems(o.id);
        const others = this.offersOn(l.id).filter(x => x.id !== o.id);
        this.atomic(() => {
            this.db.prepare('UPDATE offer SET state = ?, closed = ? WHERE id = ?').run(OfferState.ACCEPTED, this.hooks.now(), o.id);
            this.close(l, ListingState.SOLD, o.buyer, this.describeOffer(o));
            // The seller is standing at a post, but the proceeds of a barter can be anything - so they
            // go to the box and the seller collects them, the same as if they were offline.
            if (o.coins > 0) {
                this.credit(l.seller, this.coins, o.coins);
            }
            for (const i of items) {
                this.credit(l.seller, i.obj, i.count);
            }
            this.credit(o.buyer, l.obj, l.count);
            for (const x of others) {
                this.refund(x, OfferState.LAPSED);
            }
        });

        this.notify(o.buyer, `${this.name(l.seller)} accepted your offer for ${this.describe(l)}! Collect it from any trading post.`);
        for (const x of others) {
            this.notify(x.buyer, `The ${this.describe(l)} you made an offer on went to another buyer. Your offer is in your collection box.`);
        }
        return '';
    }

    decline(seller: string, offerId: number): string {
        const o = this.offer(offerId);
        const l = o ? this.listing(o.listing) : undefined;
        if (!o || !l || l.seller !== seller) {
            return 'That offer is not yours to decline.';
        }
        if (o.state !== OfferState.PENDING) {
            return 'That offer is no longer open.';
        }
        this.atomic(() => this.refund(o, OfferState.DECLINED));
        this.notify(o.buyer, `${this.name(l.seller)} declined your offer of ${this.describeOffer(o)} for ${this.describe(l)}. It is in your collection box.`);
        return '';
    }

    // The buyer takes an offer back. They are at a post, so it goes straight into their inventory,
    // and whatever does not fit goes to the box.
    withdraw(buyer: TpPocket, offerId: number): string {
        const o = this.offer(offerId);
        if (!o || o.buyer !== buyer.username) {
            return 'That offer is not yours.';
        }
        if (o.state !== OfferState.PENDING) {
            return 'That offer is no longer open.';
        }
        const items = this.offerItems(o.id);
        this.atomic(undo => {
            this.db.prepare('UPDATE offer SET state = ?, closed = ? WHERE id = ?').run(OfferState.WITHDRAWN, this.hooks.now(), o.id);
            if (o.coins > 0) {
                this.hand(buyer, this.coins, o.coins, undo);
            }
            for (const i of items) {
                this.hand(buyer, i.obj, i.count, undo);
            }
        });
        this.hooks.changed(buyer.username);
        return '';
    }

    // The seller takes a listing down. Their item comes back like a withdrawn offer does, and every
    // offer on it goes back to its buyer.
    cancel(seller: TpPocket, listingId: number): string {
        const l = this.listing(listingId);
        if (!l || l.seller !== seller.username) {
            return 'That listing is not yours.';
        }
        if (l.state !== ListingState.OPEN) {
            return 'That listing has already closed.';
        }
        const others = this.offersOn(l.id);
        this.atomic(undo => {
            this.close(l, ListingState.CANCELLED, null, null);
            this.hand(seller, l.obj, l.count, undo);
            for (const o of others) {
                this.refund(o, OfferState.LAPSED);
            }
        });
        this.hooks.changed(seller.username);
        for (const o of others) {
            this.notify(o.buyer, `${this.name(l.seller)} took their ${this.describe(l)} off the trading post. Your offer is in your collection box.`);
        }
        return '';
    }

    // Take up to count of obj out of the box. noted asks for the noted form where there is one.
    collect(player: TpPocket, obj: number, count: number, noted: boolean): string {
        const have = this.boxCount(player.username, obj);
        if (have <= 0) {
            return 'There is nothing like that in your collection box.';
        }
        const want = Math.min(count, have, INT_MAX);
        let moved = 0;
        this.atomic(undo => {
            const as = noted && this.objs.cert(obj) !== -1 ? this.objs.cert(obj) : obj;
            moved = player.add(as, want);
            undo.push(() => player.del(as, moved));
            if (moved > 0) {
                this.debit(player.username, obj, moved);
            }
        });
        if (moved === 0) {
            return 'You have no room for that.';
        }
        this.hooks.changed(player.username);
        return moved < want ? 'You have run out of room.' : '';
    }

    // Lines saved up while the player was away. Read once; they are deleted as they are read.
    takeNotices(player: string): string[] {
        const rows = this.db.prepare('SELECT id, text FROM notice WHERE player = ? ORDER BY id').all(player) as { id: number; text: string }[];
        if (rows.length > 0) {
            this.db.prepare('DELETE FROM notice WHERE player = ?').run(player);
        }
        return rows.map(r => r.text);
    }

    // ---- internals ----

    // One SQL transaction, plus the inventory moves it made, which SQL cannot roll back: each move
    // pushes its own inverse, and a throw runs them backwards. Inventory changes are in-memory and
    // the checks above have already passed, so in practice the only thing that throws here is the
    // disk.
    private atomic(fn: (undo: (() => void)[]) => void) {
        const undo: (() => void)[] = [];
        this.db.exec('BEGIN IMMEDIATE');
        try {
            fn(undo);
            this.db.exec('COMMIT');
        } catch (err) {
            this.db.exec('ROLLBACK');
            for (let i = undo.length - 1; i >= 0; i--) {
                undo[i]();
            }
            throw err;
        }
    }

    private close(l: Listing, state: ListingState, buyer: string | null, price: string | null) {
        this.db.prepare('UPDATE listing SET state = ?, closed = ?, buyer = ?, price = ? WHERE id = ?').run(state, this.hooks.now(), buyer, price, l.id);
    }

    private refund(o: Offer, state: OfferState) {
        this.db.prepare('UPDATE offer SET state = ?, closed = ? WHERE id = ?').run(state, this.hooks.now(), o.id);
        if (o.coins > 0) {
            this.credit(o.buyer, this.coins, o.coins);
        }
        for (const i of this.offerItems(o.id)) {
            this.credit(o.buyer, i.obj, i.count);
        }
    }

    private credit(player: string, obj: number, count: number) {
        this.db.prepare('INSERT INTO collect (player, obj, count) VALUES (?, ?, ?) ON CONFLICT (player, obj) DO UPDATE SET count = count + excluded.count').run(player, obj, count);
    }

    private debit(player: string, obj: number, count: number) {
        this.db.prepare('UPDATE collect SET count = count - ? WHERE player = ? AND obj = ?').run(count, player, obj);
        this.db.prepare('DELETE FROM collect WHERE player = ? AND obj = ? AND count <= 0').run(player, obj);
    }

    // Straight into the inventory of a player standing at a post: noted when it is several of an
    // unstackable thing that has a note, the rest to the box.
    private hand(p: TpPocket, obj: number, count: number, undo: (() => void)[]) {
        const note = this.objs.cert(obj);
        const as = count > 1 && !this.objs.stackable(obj) && note !== -1 ? note : obj;
        const moved = p.add(as, count);
        undo.push(() => p.del(as, moved));
        if (moved < count) {
            this.credit(p.username, obj, count - moved);
            this.hooks.tell(p.username, 'Some of it did not fit, and is waiting in your collection box.');
        }
    }

    // In game the "Trading post:" is dark blue, so the news stands out among the other game messages;
    // Discord gets the same words without the colour tags.
    private notify(username: string, text: string) {
        const line = `@dbl@Trading post:@bla@ ${text}`;
        this.hooks.notice?.(username, `Trading post: ${text}`);
        if (!this.hooks.tell(username, line)) {
            this.db.prepare('INSERT INTO notice (player, text, created) VALUES (?, ?, ?)').run(username, line, this.hooks.now());
        }
    }

    private name(username: string): string {
        return username.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
}
