import fs from 'fs';
import path from 'path';

import Environment from '#/util/Environment.js';
import { printInfo, printWarning } from '#/util/Logger.js';

// custom (2026-11-02) - every interaction that answered "Nothing interesting happens."
//
// WHY THIS EXISTS. Player.defaultOp is the one place the engine ends up when a click reached a real
// target and no trigger claimed it. On a development world it already prints the exact thing a
// content author needs - `No trigger for [oploc1,some_gate]` - and then says "Nothing interesting
// happens." and throws it away. Nobody was reading it. The fuzzer has been clicking its way through
// Lumbridge for weeks being told, in writing, which ops are not implemented, and the message went
// into a bot's 16-entry message ring and fell off the end.
//
// So this collects them, the same way ScriptFaults collects script errors: deduped by trigger and
// target, counted, with the first player and tick that reached it, written out as JSONL. Every sim
// in tools/sim, the fuzzer, and a human playing on a dev world all feed the same file.
//
// WHAT A ROW MEANS. A row is NOT automatically a bug. Some options are meant to be inert, and some
// are only live in a state the clicker was not in. What a row IS, is an option the cache offers a
// player that the content did not answer - which is exactly the list that cannot be written by hand
// and exactly the list people have been finding one click at a time.
//
// Two kinds, and the difference matters:
//   notrigger   no [oploc1,x] and no [aploc1,x] exists, for the type or its category, for an option
//               the cache LABELLED. Always wrong: the client drew "Search" and nothing answers it.
//   combo       the same, for a use-on or cast-on - [opheldu,x], [opnpcu,x], [opnpct,x]. Kept apart
//               because having no handler is the NORMAL case here and not a bug by itself. Nothing
//               labelled "cast Water Blast at a banker" and nothing should happen when you do; the
//               first run of this reported [opnpct,banker1] 210 times at the top of the list.
//               Where it IS worth reading is the other direction: no [opheldu,swordfish] at all
//               means a swordfish cannot be used on anything in the game, which is the kind of row
//               the hand-run opheldu audit was looking for.
//   filler      a trigger DID exist and the content still fell through to ~displaymessage(^dm_default)
//               or said the same words itself. Dead for this state - a missing recipe, a missing
//               branch, a quest stage nobody wrote. Recorded by the fuzz watcher, not from here.
//
// COST. One string build and a Map.get per defaultOp when enabled, nothing at all when not. It is
// off unless NODE_DEAD_OPS is set, exactly like the fault reporter.

export type DeadOp = {
    sig: string;
    /**
     * 'notrigger'  a LABELLED option - the cache advertised "Search" on this loc and no script
     *              claims it. Always wrong: the player is offered something that does nothing.
     * 'combo'      a use-on or cast-on whose subject has no handler at all. Informational, not a
     *              bug on its own - see the note on COMBINATION triggers below.
     * 'filler'     a trigger existed, ran, and still said nothing. From a watcher, not from here.
     */
    kind: 'notrigger' | 'combo' | 'filler';
    /** The trigger the click would have needed, lowercased: `oploc1`, `opheldu`, `apnpct`. */
    trigger: string;
    /** The debugname of the loc, npc, obj, item or spell component it was aimed at. */
    target: string;
    /** Where it happened the first time, so it can be walked to. */
    where: string;
    who: string;
    tick: number;
    count: number;
};

/**
 * The triggers where having no handler is the NORMAL case: using one thing on another, or casting
 * at something. Nothing advertises "cast Water Blast at a banker" and nothing should happen when
 * you do, so those are not bugs. A numbered op is different - the cache gave it a label, which
 * means a client drew it, which means a player was offered it.
 */
const COMBINATION_TRIGGER = /^(op|ap)(held|loc|npc|obj|player)(u|t)$/;

/** Which bucket a trigger name belongs in. The fuzz watcher asks, to know whether to raise it. */
export function kindFor(trigger: string): 'notrigger' | 'combo' {
    return COMBINATION_TRIGGER.test(trigger) ? 'combo' : 'notrigger';
}

function key(kind: string, trigger: string, target: string): string {
    return `${kind}|${trigger}|${target}`;
}

class DeadOpsTracker {
    enabled = false;

    private readonly found: Map<string, DeadOp> = new Map();
    private file = '';
    /** Dirty since the last write: the file is rewritten whole, so it is not rewritten per click. */
    private dirty = false;

    init(): void {
        this.enabled = Environment.NODE_DEAD_OPS;
        this.file = Environment.NODE_DEAD_OPS_FILE;
        if (this.enabled) {
            printInfo(`dead ops: on - unanswered interactions to ${this.file}`);
        }
    }

    /** Turn it on from a process with no env var: a sim, or the fuzzer. */
    enableForTesting(file: string = Environment.NODE_DEAD_OPS_FILE): void {
        this.enabled = true;
        this.file = file;
    }

    /**
     * THE HOT PATH, such as it is - called from Player.defaultOp, which only runs when a click found
     * nothing to do. The boolean first so a world with this off pays one read.
     *
     * The kind is worked out HERE rather than by the caller, and that is deliberate: there are two
     * callers (defaultOp and the fuzz watcher) and the first version let each decide. The watcher
     * was taught the difference and defaultOp was not, so every row in the file came out labelled
     * 'notrigger' - including 210 of `[opnpct,banker1]`, a bot casting spells at a bank teller - and
     * the report's "every one of these is a bug" heading was wrong about most of its list.
     */
    record(trigger: string, target: string, who: string, x: number, z: number, level: number): void {
        if (!this.enabled) {
            return;
        }
        try {
            const kind = kindFor(trigger);
            const sig = key(kind, trigger, target);
            const existing = this.found.get(sig);
            if (existing) {
                existing.count++;
                this.dirty = true;
                return;
            }
            this.found.set(sig, { sig, kind, trigger, target, where: `${x},${z},${level}`, who, tick: 0, count: 1 });
            this.dirty = true;
        } catch {
            // A reporter that breaks the world it reports on is worse than no reporter.
        }
    }

    /**
     * A trigger that DID run and still said nothing. There is no trigger name to record - the
     * content said it, not the engine - so what identifies it is the action the player took.
     */
    recordFiller(what: string, who: string, x: number, z: number, level: number): void {
        if (!this.enabled) {
            return;
        }
        try {
            const sig = key('filler', 'content', what);
            const existing = this.found.get(sig);
            if (existing) {
                existing.count++;
                this.dirty = true;
                return;
            }
            this.found.set(sig, { sig, kind: 'filler', trigger: 'content', target: what, where: `${x},${z},${level}`, who, tick: 0, count: 1 });
            this.dirty = true;
        } catch {
            // as above
        }
    }

    /** Which bucket a trigger name belongs in, for a caller deciding whether to raise it. */
    kindFor(trigger: string): 'notrigger' | 'combo' {
        return kindFor(trigger);
    }

    all(): DeadOp[] {
        return [...this.found.values()].sort((a, b) => b.count - a.count || a.trigger.localeCompare(b.trigger) || a.target.localeCompare(b.target));
    }

    size(): number {
        return this.found.size;
    }

    clear(): number {
        const n = this.found.size;
        this.found.clear();
        this.dirty = true;
        this.flush();
        return n;
    }

    /** Written on demand and at the end of a run, not per click: the file is rewritten whole. */
    flush(file: string = this.file): string {
        if (!file || (!this.dirty && fs.existsSync(file))) {
            return file;
        }
        try {
            const dir = path.dirname(file);
            if (dir && !fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const out = this.all().map(f => JSON.stringify(f));
            fs.writeFileSync(file, out.join('\n') + (out.length ? '\n' : ''), 'utf8');
            this.dirty = false;
            return file;
        } catch (err) {
            printWarning(`dead ops: could not write the report - ${String((err as { message?: unknown })?.message ?? err)}`);
            return '';
        }
    }
}

export default new DeadOpsTracker();
