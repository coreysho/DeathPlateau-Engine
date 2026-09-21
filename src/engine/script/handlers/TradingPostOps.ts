import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import Player from '#/engine/entity/Player.js';
import TradingPost, { Listing, ListingState, OfferState, TpObjInfo, TpPocket } from '#/engine/market/TradingPost.js';
import { ScriptOpcode } from '#/engine/script/ScriptOpcode.js';
import { ProtectedActivePlayer } from '#/engine/script/ScriptPointer.js';
import { CommandHandlers } from '#/engine/script/ScriptRunner.js';
import ScriptState from '#/engine/script/ScriptState.js';
import { check, InvTypeValid, ObjTypeValid } from '#/engine/script/ScriptValidators.js';
import World from '#/engine/World.js';
import Environment from '#/util/Environment.js';
import { toDisplayName } from '#/util/JString.js';
import { printInfo } from '#/util/Logger.js';

// The script side of engine/market/TradingPost.ts. The market knows about usernames, objs and
// counts; this is where those become a Player, their invs, and the windows content draws.
//
// VIEWS. A window of listings is an inv the content transmits: tp_browse and friends write one obj
// per slot into it, and remember - per player - which listing each slot stands for, so that a click
// on slot 7 can be turned back into a listing with tp_slot. The collection box is the same, slot to
// obj. Nothing about a view is saved; it lasts until the next fill.

const INT_MAX = 0x7fffffff;

const objs: TpObjInfo = {
    exists: o => o >= 0 && o < ObjType.count,
    name: o => ObjType.get(o).name ?? ObjType.get(o).debugname ?? 'null',
    stackable: o => ObjType.get(o).stackable,
    tradeable: o => ObjType.get(o).tradeable && ObjType.get(o).dummyitem === 0,
    uncert: o => {
        const t = ObjType.get(o);
        return t.certtemplate >= 0 && t.certlink >= 0 ? t.certlink : o;
    },
    cert: o => {
        const t = ObjType.get(o);
        return t.certtemplate === -1 && t.certlink >= 0 ? t.certlink : -1;
    }
};

let market: TradingPost | null = null;

export function tradingPost(): TradingPost {
    if (!market) {
        const file = `data/tradingpost/${Environment.NODE_PROFILE}.sqlite`;
        market = new TradingPost(file, ObjType.getId('coins'), objs, {
            tell: (username, text) => {
                const player = World.getPlayerByUsername(username);
                if (!player) {
                    return false;
                }
                player.messageGame(text);
                return true;
            },
            changed: username => {
                const player = World.getPlayerByUsername(username);
                if (player) {
                    World.autosavePlayer(player);
                }
            },
            now: () => Date.now()
        });
        printInfo(`Trading post open: ${file}`);
    }
    return market;
}

// search is what the last tp_browse / tp_browse_obj asked for, so tp_repage can turn its pages.
type View = { listings: number[]; box: number[]; search: { query: string; obj: number } };
const views = new Map<string, View>();

function view(player: Player): View {
    let v = views.get(player.username);
    if (!v) {
        v = { listings: [], box: [], search: { query: '', obj: -1 } };
        views.set(player.username, v);
    }
    return v;
}

// An inv the script is about to change on the player's behalf. Same rule as inv_add and inv_del:
// a protected inv needs protected access.
function ownInv(state: ScriptState, inv: number): number {
    const invType: InvType = check(inv, InvTypeValid);
    if (!state.pointerGet(ProtectedActivePlayer[state.intOperand]) && invType.protect && invType.scope !== InvType.SCOPE_SHARED) {
        throw new Error(`$inv requires protected access: ${invType.debugname}`);
    }
    if (invType.scope === InvType.SCOPE_SHARED) {
        throw new Error(`the trading post will not touch a shared inv: ${invType.debugname}`);
    }
    return invType.id;
}

function pocket(player: Player, inv: number): TpPocket {
    return {
        username: player.username,
        total: obj => player.invTotal(inv, obj),
        add: (obj, count) => player.invAdd(inv, obj, count),
        del: (obj, count) => player.invDel(inv, obj, count)
    };
}

// Lay a list of (obj, count) into a display inv one per slot, in order, whatever the inv's stacking.
function fill(player: Player, inv: number, rows: { obj: number; count: number }[]) {
    player.invClear(inv);
    const size = player.invSize(inv);
    for (let i = 0; i < rows.length && i < size; i++) {
        player.invSet(inv, rows[i].obj, Math.min(rows[i].count, INT_MAX), i);
    }
}

function showListings(state: ScriptState, inv: number, listings: Listing[], page: number): number {
    const player = state.activePlayer;
    const size = player.invSize(inv);
    const shown = listings.slice(Math.max(0, page) * size, Math.max(0, page) * size + size);
    fill(player, inv, shown);
    view(player).listings = shown.map(l => l.id);
    return listings.length;
}

function openListing(id: number): Listing | undefined {
    const l = tradingPost().listing(id);
    return l && l.state === ListingState.OPEN ? l : undefined;
}

const TradingPostOps: CommandHandlers = {
    // tp_browse(inv $inv, string $query, int $page)(int): open listings whose name contains $query
    // ("" for all), newest first, one page of them into $inv. Returns how many match in all.
    [ScriptOpcode.TP_BROWSE]: state => {
        const query = state.popString();
        const [inv, page] = state.popInts(2);
        view(state.activePlayer).search = { query, obj: -1 };
        state.pushInt(showListings(state, check(inv, InvTypeValid).id, tradingPost().browse(query), page));
    },

    // tp_browse_obj(inv $inv, obj $obj, int $page)(int): the same, for one obj, noted or not.
    [ScriptOpcode.TP_BROWSE_OBJ]: state => {
        const [inv, obj, page] = state.popInts(3);
        check(obj, ObjTypeValid);
        view(state.activePlayer).search = { query: '', obj };
        state.pushInt(showListings(state, check(inv, InvTypeValid).id, tradingPost().browse('', obj), page));
    },

    // tp_repage(inv $inv, int $page)(int): the last search again, at another page.
    [ScriptOpcode.TP_REPAGE]: state => {
        const [inv, page] = state.popInts(2);
        const { query, obj } = view(state.activePlayer).search;
        state.pushInt(showListings(state, check(inv, InvTypeValid).id, tradingPost().browse(query, obj), page));
    },

    // tp_query()(string): what the last search was for, as a player would read it - '' for everything.
    [ScriptOpcode.TP_QUERY]: state => {
        const { query, obj } = view(state.activePlayer).search;
        state.pushString(obj !== -1 ? objs.name(objs.uncert(obj)) : query.trim().replaceAll('_', ' '));
    },

    // tp_mine(inv $inv)(int): the active player's own open listings.
    [ScriptOpcode.TP_MINE]: state => {
        const inv = check(state.popInt(), InvTypeValid).id;
        state.pushInt(showListings(state, inv, tradingPost().listingsBy(state.activePlayer.username), 0));
    },

    // tp_myoffers(inv $inv)(int): the listings the active player has an offer open on.
    [ScriptOpcode.TP_MYOFFERS]: state => {
        const inv = check(state.popInt(), InvTypeValid).id;
        const tp = tradingPost();
        const listings = tp
            .offersBy(state.activePlayer.username)
            .map(o => tp.listing(o.listing))
            .filter((l): l is Listing => l !== undefined);
        state.pushInt(showListings(state, inv, listings, 0));
    },

    // tp_slot(int $slot)(int): the listing a slot of the last listing view stands for, or -1.
    [ScriptOpcode.TP_SLOT]: state => {
        const slot = state.popInt();
        state.pushInt(view(state.activePlayer).listings[slot] ?? -1);
    },

    [ScriptOpcode.TP_LISTING_OBJ]: state => {
        state.pushInt(tradingPost().listing(state.popInt())?.obj ?? -1);
    },

    [ScriptOpcode.TP_LISTING_COUNT]: state => {
        state.pushInt(Math.min(tradingPost().listing(state.popInt())?.count ?? 0, INT_MAX));
    },

    // 0 when the listing takes offers only.
    [ScriptOpcode.TP_LISTING_BUYOUT]: state => {
        state.pushInt(tradingPost().listing(state.popInt())?.buyout ?? 0);
    },

    [ScriptOpcode.TP_LISTING_SELLER]: state => {
        const l = tradingPost().listing(state.popInt());
        state.pushString(l ? toDisplayName(l.seller) : '');
    },

    [ScriptOpcode.TP_LISTING_OPEN]: state => {
        state.pushInt(openListing(state.popInt()) ? 1 : 0);
    },

    [ScriptOpcode.TP_LISTING_MINE]: state => {
        const l = tradingPost().listing(state.popInt());
        state.pushInt(l && l.seller === state.activePlayer.username ? 1 : 0);
    },

    // How many offers are waiting on it.
    [ScriptOpcode.TP_LISTING_OFFERS]: state => {
        const l = openListing(state.popInt());
        state.pushInt(l ? tradingPost().offersOn(l.id).length : 0);
    },

    // tp_listing_myoffer(int $listing)(int): the active player's open offer on it, or -1.
    [ScriptOpcode.TP_LISTING_MYOFFER]: state => {
        const id = state.popInt();
        const o = tradingPost()
            .offersOn(id)
            .find(o => o.buyer === state.activePlayer.username);
        state.pushInt(o?.id ?? -1);
    },

    // tp_offer(int $listing, int $n)(int): the $n'th best open offer on a listing, or -1.
    [ScriptOpcode.TP_OFFER]: state => {
        const [id, n] = state.popInts(2);
        state.pushInt(tradingPost().offersOn(id)[n]?.id ?? -1);
    },

    [ScriptOpcode.TP_OFFER_BUYER]: state => {
        const o = tradingPost().offer(state.popInt());
        state.pushString(o ? toDisplayName(o.buyer) : '');
    },

    [ScriptOpcode.TP_OFFER_COINS]: state => {
        state.pushInt(tradingPost().offer(state.popInt())?.coins ?? 0);
    },

    // "12,000 coins + 3 items"
    [ScriptOpcode.TP_OFFER_TEXT]: state => {
        const tp = tradingPost();
        const o = tp.offer(state.popInt());
        state.pushString(o ? tp.describeOffer(o) : '');
    },

    // tp_offer_show(int $offer, inv $inv)(int): the items in an offer, into a display inv, coins
    // first. Only for the offer's buyer or the listing's seller. Returns how many slots it used.
    [ScriptOpcode.TP_OFFER_SHOW]: state => {
        const [id, inv] = state.popInts(2);
        const invId = check(inv, InvTypeValid).id;
        const player = state.activePlayer;
        const tp = tradingPost();
        const o = tp.offer(id);
        const l = o ? tp.listing(o.listing) : undefined;
        if (!o || !l || o.state !== OfferState.PENDING || (o.buyer !== player.username && l.seller !== player.username)) {
            fill(player, invId, []);
            state.pushInt(0);
            return;
        }
        const rows = tp.offerItems(o.id);
        if (o.coins > 0) {
            rows.unshift({ obj: tp.coins, count: o.coins });
        }
        fill(player, invId, rows);
        state.pushInt(rows.length);
    },

    // tp_list(inv $inv, obj $obj, int $count, int $buyout)(string)
    [ScriptOpcode.TP_LIST]: state => {
        const [inv, obj, count, buyout] = state.popInts(4);
        check(obj, ObjTypeValid);
        const player = state.activePlayer;
        state.pushString(tradingPost().list(pocket(player, ownInv(state, inv)), obj, count, buyout));
    },

    // tp_buynow(int $listing, inv $inv)(string)
    [ScriptOpcode.TP_BUYNOW]: state => {
        const [id, inv] = state.popInts(2);
        state.pushString(tradingPost().buyNow(pocket(state.activePlayer, ownInv(state, inv)), id));
    },

    // tp_makeoffer(int $listing, int $coins, inv $inv, inv $barter)(string): coins out of $inv, and
    // everything in $barter as the items. $barter is emptied when the offer is made.
    [ScriptOpcode.TP_MAKEOFFER]: state => {
        const [id, coins, inv, barter] = state.popInts(4);
        const player = state.activePlayer;
        const barterInv = ownInv(state, barter);
        const counted = new Map<number, number>();
        for (const item of player.getInventory(barterInv)!.itemsFiltered) {
            counted.set(item.id, (counted.get(item.id) ?? 0) + item.count);
        }
        const items = [...counted].map(([obj, count]) => ({ obj, count }));
        state.pushString(tradingPost().makeOffer(pocket(player, ownInv(state, inv)), id, coins, pocket(player, barterInv), items));
    },

    // tp_accept(int $offer)(string)
    [ScriptOpcode.TP_ACCEPT]: state => {
        const id = state.popInt();
        state.pushString(tradingPost().accept(state.activePlayer.username, id));
    },

    // tp_decline(int $offer)(string)
    [ScriptOpcode.TP_DECLINE]: state => {
        const id = state.popInt();
        state.pushString(tradingPost().decline(state.activePlayer.username, id));
    },

    // tp_withdraw(int $offer, inv $inv)(string)
    [ScriptOpcode.TP_WITHDRAW]: state => {
        const [id, inv] = state.popInts(2);
        state.pushString(tradingPost().withdraw(pocket(state.activePlayer, ownInv(state, inv)), id));
    },

    // tp_cancel(int $listing, inv $inv)(string)
    [ScriptOpcode.TP_CANCEL]: state => {
        const [id, inv] = state.popInts(2);
        state.pushString(tradingPost().cancel(pocket(state.activePlayer, ownInv(state, inv)), id));
    },

    // tp_box(inv $inv)(int): the collection box into a display inv. Returns how many kinds of thing
    // are in it.
    [ScriptOpcode.TP_BOX]: state => {
        const inv = check(state.popInt(), InvTypeValid).id;
        const player = state.activePlayer;
        const rows = tradingPost().box(player.username);
        fill(player, inv, rows);
        view(player).box = rows.slice(0, player.invSize(inv)).map(r => r.obj);
        state.pushInt(rows.length);
    },

    // tp_collect(inv $inv, int $slot, int $count, boolean $noted)(string): take from the collection
    // box - the thing in $slot of the last tp_box view - into $inv.
    [ScriptOpcode.TP_COLLECT]: state => {
        const [inv, slot, count, noted] = state.popInts(4);
        const player = state.activePlayer;
        const obj = view(player).box[slot];
        if (obj === undefined) {
            state.pushString('There is nothing there.');
            return;
        }
        state.pushString(tradingPost().collect(pocket(player, ownInv(state, inv)), obj, count, noted === 1));
    },

    // tp_login()(int): read out what happened while the player was away. Returns how many kinds of
    // thing are waiting in their collection box.
    [ScriptOpcode.TP_LOGIN]: state => {
        const player = state.activePlayer;
        views.delete(player.username);
        const tp = tradingPost();
        for (const line of tp.takeNotices(player.username)) {
            player.messageGame(line);
        }
        state.pushInt(tp.box(player.username).length);
    }
};

export default TradingPostOps;
