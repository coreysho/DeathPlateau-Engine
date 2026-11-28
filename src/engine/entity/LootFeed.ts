// custom (2026-11-28) - what a player's loot tracker is told about their kills.
//
// THE CLIENT CANNOT SEE A KILL. It has no death event, no damage and no idea who killed what, so
// its loot tracker used to work a kill out from an npc vanishing near a fresh pile on the floor -
// and was wrong whenever somebody else's kill was beside yours, whenever a second drop landed on a
// tile already holding the same item, and whenever coins merged into a stack. The server knows all
// of it at the moment it rolls the drop, so it says so: one hidden game message per kill, which the
// client swallows before the chatbox sees it (DeathPlateau-Client, LootMessage.java).
//
//   type | kill | more | level | name | id,count;id,count;... :loot:
//   n|4821|0|83|Black dragon|536,1;1747,1;995,196:loot:
//
// type is n (an npc's drop), p (a player's, when you killed them) or e (an event: a clue casket, the
// Barrows chest). kill numbers one kill so a drop too long for one message - a game message is a
// var-byte string, 255 bytes at most - can be split and joined again: more is 1 on every piece but
// the last.
//
// ONLY TO A CLIENT THAT ASKED (::lootfeed, sent by the client at login). An older client would print
// the line into the chatbox, and a client that cannot update while it is open is exactly the one
// still running when the server is.
//
// BATCHED PER KILL, SENT AT THE END OF THE TICK. A death script adds its items one obj_add at a
// time, and a kill's bones, coins and herb are one kill with three items - so they are collected
// against the thing that died and sent together in processClientsOut, after every script of the
// tick has run.

/** Where loot came from: n, p or e, as the line spells it. */
export type LootKind = 'n' | 'p' | 'e';

type Batch = {
    kind: LootKind;
    name: string;
    level: number;
    items: Map<number, number>;
};

/** The longest a game message may be: MESSAGE_GAME is a var-byte string. */
export const LOOT_LINE_MAX = 250;

/** How many kills one player may have waiting in a tick before the rest are not reported. */
const MAX_BATCHES = 64;

/** Kinds of item one kill may carry - far more than any table rolls, and a bound on a bad script. */
const MAX_ITEMS = 256;

let nextKill = 1;

export default class LootFeed {
    /** Set by ::lootfeed. Nothing is collected for a client that never asked. */
    enabled = false;

    private readonly batches: Map<object, Batch> = new Map();

    /**
     * One item from one source. `source` is the thing that died - the Npc, the Player, or for an
     * event any object standing for that one event - and items from the same source in the same
     * tick are one kill.
     */
    add(source: object, kind: LootKind, name: string, level: number, obj: number, count: number): void {
        if (!this.enabled || count <= 0 || obj < 0) {
            return;
        }
        let batch = this.batches.get(source);
        if (!batch) {
            if (this.batches.size >= MAX_BATCHES) {
                return;
            }
            batch = { kind, name, level, items: new Map() };
            this.batches.set(source, batch);
        }
        const had = batch.items.get(obj);
        if (had === undefined && batch.items.size >= MAX_ITEMS) {
            return;
        }
        batch.items.set(obj, Math.min(0x7fffffff, (had ?? 0) + count));
    }

    /** Everything collected this tick, as lines, and forgotten. */
    flush(send: (line: string) => void): void {
        if (this.batches.size === 0) {
            return;
        }
        for (const batch of this.batches.values()) {
            for (const line of LootFeed.encode(batch.kind, nextKill, batch.name, batch.level, batch.items)) {
                send(line);
            }
            nextKill = nextKill >= 0x3fffffff ? 1 : nextKill + 1;
        }
        this.batches.clear();
    }

    /** Drops anything collected without sending it - a logout mid-tick. */
    clear(): void {
        this.batches.clear();
    }

    /**
     * One kill as one or more lines, each within LOOT_LINE_MAX. Exported for the test.
     *
     * The name is made safe for the format and the font: printable ASCII only, and no line breaks
     * or the suffix itself, so nothing a content author names an npc can break the line apart.
     */
    static encode(kind: LootKind, kill: number, name: string, level: number, items: Map<number, number>): string[] {
        const safe = LootFeed.safeName(name);
        const head = (more: boolean) => `${kind}|${kill}|${more ? 1 : 0}|${Math.max(0, level | 0)}|${safe}|`;
        const suffix = ':loot:';
        const room = LOOT_LINE_MAX - head(false).length - suffix.length;

        const parts: string[] = [];
        for (const [obj, count] of items) {
            parts.push(`${obj},${count}`);
        }

        const pieces: string[] = [];
        let current = '';
        for (const part of parts) {
            const joined = current.length === 0 ? part : `${current};${part}`;
            if (joined.length > room && current.length > 0) {
                pieces.push(current);
                current = part;
            } else {
                current = joined;
            }
        }
        pieces.push(current);

        return pieces.map((piece, i) => head(i < pieces.length - 1) + piece + suffix);
    }

    static safeName(name: string): string {
        let out = '';
        for (const c of name ?? '') {
            const code = c.charCodeAt(0);
            out += code >= 0x20 && code <= 0x7e ? c : ' ';
        }
        out = out.replaceAll(':loot:', ' ').trim();
        return out.length > 60 ? out.slice(0, 60) : out;
    }
}
