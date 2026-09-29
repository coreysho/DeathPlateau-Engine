import fs from 'fs';
import path from 'path';

import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';
import NpcType from '#/cache/config/NpcType.js';
import type ScriptState from '#/engine/script/ScriptState.js';
import World from '#/engine/World.js';
import Environment from '#/util/Environment.js';
import { printInfo, printWarning } from '#/util/Logger.js';

// custom (2026-09-29) - the script fault reporter.
//
// WHY THIS EXISTS. A RuneScript error aborts the WHOLE trigger stack, not just the line that threw.
// On 2026-09-28 `~check_progress_task` threw ".npc_findhero Attempt to access null active_npc" on
// the first line of [proc,npc_death] - which is gosub'd before the drop table - so every monster
// that died down that path silently lost its drop, its death animation, its kill counts and its
// npc_del. Nothing in the game said so. It was found only because the owner happened to read
// journalctl by hand, and by then it had been live for an unknown number of days.
//
// So: every fault the engine already prints also goes through here, is reduced to a stable
// signature (so a bug that fires a thousand times is one report with a count), and is written
// somewhere a person or a script can read later - a JSONL file, and optionally a Discord webhook.
//
// TWO RULES THIS MODULE KEEPS, because a watchdog that hurts the thing it watches is worse than no
// watchdog at all:
//   1. OFF unless NODE_SCRIPT_FAULTS is set, and when off `record()` does nothing beyond reading one
//      boolean - it does not build a backtrace, allocate, hash or touch the disk.
//   2. It never throws. Every body below is wrapped, and a failure inside the reporter disables it
//      rather than propagating into ScriptRunner's own catch block.

/** One frame of a RuneScript backtrace, as the engine already prints it. */
export type FaultFrame = {
    /** The trigger or proc name, e.g. `[proc,npc_death]`. */
    trigger: string;
    /** The .rs2 file it lives in. */
    file: string;
    line: number;
};

export type Fault = {
    /** Stable across runs: the message and every frame's trigger/file:line, hashed. */
    sig: string;
    message: string;
    frames: FaultFrame[];
    /** What was running the script: a player's trigger stack, an npc's, or neither (loc/obj/none). */
    kind: 'player' | 'npc' | 'world';
    firstTick: number;
    lastTick: number;
    /** Wall clock of the first sighting, so a JSONL line still makes sense after a restart. */
    firstSeen: string;
    lastSeen: string;
    count: number;
    /** The npc's debugname, for an npc fault - the single most useful field when triaging one. */
    npc?: string;
    /** The player's name, for a player fault. */
    player?: string;
    /** `x,z,level` of whoever was running it, so a reader can go and stand there. */
    coord?: string;
};

// A bug that fires every tick must not turn into a bug that fills the disk, so the table is capped
// and the file is rewritten from it rather than appended to. 500 distinct signatures is far more
// than a healthy build has and small enough to rewrite in a millisecond.
const MAX_SIGNATURES = 500;
// The file is authoritative, so it is rewritten whenever the table changes - but at most this often,
// or a script erroring every tick would mean a disk write every tick.
const FLUSH_INTERVAL_MS = 5000;
// Discord: a hard ceiling on messages, whatever happens. A fresh build with ten new faults must not
// turn into ten webhook posts a second.
const WEBHOOK_PER_MINUTE = 4;
const WEBHOOK_WINDOW_MS = 60_000;

function fnv1a(text: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        // the FNV-1a 32-bit prime, as shifts, so it stays in int32 instead of losing bits to floats
        hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
    }
    return hash >>> 0;
}

class ScriptFaultReporter {
    /**
     * The hot-path gate. Read once at boot from NODE_SCRIPT_FAULTS: the live world leaves it unset
     * and pays one boolean read per script error for the privilege.
     */
    enabled: boolean = false;

    private readonly faults: Map<string, Fault> = new Map();
    private file: string = '';
    private dirty: boolean = false;
    private lastFlush: number = 0;
    /** Set once the reporter has hurt itself; it then stays quiet for the rest of the run. */
    private broken: boolean = false;

    private webhook: string = '';
    /** Signatures already announced. A recurrence is a count, not another message. */
    private readonly announced: Set<string> = new Set();
    private webhookTimes: number[] = [];

    /**
     * Called from app.ts (and from a sim that wants the reporter). Safe to call twice; safe to call
     * with the feature off, in which case it returns having done nothing.
     */
    init(): void {
        try {
            this.enabled = Environment.NODE_SCRIPT_FAULTS;
            if (!this.enabled) {
                return;
            }
            this.file = Environment.NODE_SCRIPT_FAULTS_FILE;
            this.webhook = Environment.NODE_SCRIPT_FAULTS_WEBHOOK;
            this.load();
            // The URL is a secret (anyone holding it can post to the channel), so it is never printed
            // - not here, not in an error, not in the JSONL file. Only whether there is one.
            printInfo(`script faults: on -> ${this.file}${this.webhook ? ' (+ Discord webhook)' : ''}, ${this.faults.size} known`);
        } catch (err) {
            this.giveUp(err);
        }
    }

    /**
     * Record one script error. THE ONLY THING ON THE HOT PATH IS THE FIRST LINE - everything after
     * it runs only on a world that asked for the reporter.
     *
     * `state` is the aborting ScriptState, exactly as ScriptRunner's catch block has it: `state.pc`
     * still points at the opcode that threw and `state.debugFrames` still holds the gosub stack, so
     * the backtrace here is the same one the engine prints to the console.
     */
    record(state: ScriptState, err: unknown): void {
        if (!this.enabled || this.broken) {
            return;
        }
        try {
            const message = String((err as { message?: unknown })?.message ?? err);
            const frames = this.backtrace(state);

            // The signature deliberately leaves out WHICH npc or player hit it and where. The same
            // bug on a skeleton in Edgeville and on a guard in Varrock is one bug.
            let key = message;
            for (const f of frames) {
                key += '\n' + f.trigger + ' ' + f.file + ':' + f.line;
            }
            const sig = fnv1a(key).toString(16).padStart(8, '0');

            const now = World.currentTick;
            const self = state.self;
            const existing = this.faults.get(sig);
            if (existing) {
                existing.count++;
                existing.lastTick = now;
                existing.lastSeen = new Date().toISOString();
                this.dirty = true;
                this.maybeFlush();
                return;
            }
            if (this.faults.size >= MAX_SIGNATURES) {
                // Something is generating unbounded distinct signatures (a message with a number in
                // it, most likely). Stop growing rather than eat the heap; the count on the existing
                // entries still tells the story.
                return;
            }

            const stamp = new Date().toISOString();
            const fault: Fault = {
                sig,
                message,
                frames,
                kind: self instanceof Player ? 'player' : self instanceof Npc ? 'npc' : 'world',
                firstTick: now,
                lastTick: now,
                firstSeen: stamp,
                lastSeen: stamp,
                count: 1
            };
            if (self instanceof Npc) {
                fault.npc = NpcType.get(self.type)?.debugname ?? String(self.type);
                fault.coord = `${self.x},${self.z},${self.level}`;
            } else if (self instanceof Player) {
                fault.player = self.username;
                fault.coord = `${self.x},${self.z},${self.level}`;
            }
            this.faults.set(sig, fault);
            this.dirty = true;
            this.flush(); // a NEW fault is worth a disk write now, not in five seconds
            this.announce(fault);
        } catch (err2) {
            this.giveUp(err2);
        }
    }

    /**
     * The backtrace ScriptRunner prints, as data. Frame 1 is where it threw; the rest walk the gosub
     * stack outwards, so the last frame is the trigger the engine originally fired.
     */
    private backtrace(state: ScriptState): FaultFrame[] {
        const frames: FaultFrame[] = [{ trigger: state.script.name ?? '?', file: state.script.fileName ?? '?', line: state.script.lineNumber(state.pc) }];
        for (let i = state.debugFp - 1; i >= 0; i--) {
            const frame = state.debugFrames[i];
            if (!frame || !frame.script) {
                continue;
            }
            frames.push({ trigger: frame.script.name ?? '?', file: frame.script.fileName ?? '?', line: frame.script.lineNumber(frame.pc) });
        }
        return frames;
    }

    // ---------------------------------------------------------------- the file

    /**
     * Seed the table from the file, so counts survive a restart and a fault fixed weeks ago does not
     * come back as "new" (and re-post to Discord) the first time the server is bounced.
     */
    private load(): void {
        if (!fs.existsSync(this.file)) {
            return;
        }
        const text = fs.readFileSync(this.file, 'utf8');
        for (const line of text.split('\n')) {
            if (!line.trim()) {
                continue;
            }
            try {
                const fault = JSON.parse(line) as Fault;
                if (fault && typeof fault.sig === 'string' && Array.isArray(fault.frames)) {
                    this.faults.set(fault.sig, fault);
                    this.announced.add(fault.sig); // it has been reported once; it is not news again
                }
            } catch {
                // a half-written line from a kill -9 mid-rewrite: skip it, keep the rest
            }
        }
    }

    private maybeFlush(): void {
        if (this.dirty && Date.now() - this.lastFlush >= FLUSH_INTERVAL_MS) {
            this.flush();
        }
    }

    /** Rewrite the whole file from the table: one JSON object per line, newest fault last. */
    flush(): void {
        if (!this.enabled || this.broken || !this.dirty || !this.file) {
            return;
        }
        try {
            const dir = path.dirname(this.file);
            if (dir && !fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const out = [...this.faults.values()].sort((a, b) => a.firstTick - b.firstTick).map(f => JSON.stringify(f));
            // Through a temp file, so a crash mid-write leaves the previous report intact rather than
            // half a line of JSON where the whole history used to be.
            const tmp = this.file + '.tmp';
            fs.writeFileSync(tmp, out.join('\n') + (out.length ? '\n' : ''), 'utf8');
            fs.renameSync(tmp, this.file);
            this.dirty = false;
            this.lastFlush = Date.now();
        } catch (err) {
            this.giveUp(err);
        }
    }

    // ---------------------------------------------------------------- Discord

    /** A new signature, once, rate limited. Failures are swallowed: this is a nicety, not a duty. */
    private announce(fault: Fault): void {
        if (!this.webhook || this.announced.has(fault.sig)) {
            return;
        }
        const now = Date.now();
        this.webhookTimes = this.webhookTimes.filter(t => now - t < WEBHOOK_WINDOW_MS);
        if (this.webhookTimes.length >= WEBHOOK_PER_MINUTE) {
            // Deliberately NOT queued for later. A burst means something is badly wrong, and the
            // JSONL file has all of it; spraying the channel would only make it harder to read.
            return;
        }
        this.webhookTimes.push(now);
        this.announced.add(fault.sig);

        const where = fault.npc ? ` on ${fault.npc}` : fault.player ? ` on ${fault.player}` : '';
        const lines = [`**script error** \`${fault.sig}\`${where}${fault.coord ? ` @ ${fault.coord}` : ''}`, '```', fault.message, ...fault.frames.map((f, i) => `  ${i + 1}: ${f.trigger} - ${f.file}:${f.line}`), '```'];
        let content = lines.join('\n');
        if (content.length > 1900) {
            content = content.slice(0, 1890) + '\n...```';
        }

        // Fire and forget. No await anywhere near the game loop, and the URL never reaches a log line
        // - a rejected fetch's message can contain the URL it was given, so the catch ignores it.
        void fetch(this.webhook, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ content })
        }).catch(() => {
            printWarning('script faults: the Discord webhook post failed (URL withheld).');
        });
    }

    // ---------------------------------------------------------------- readers

    /** The faults, worst first: most occurrences, then most recent. */
    top(limit = 10): Fault[] {
        return [...this.faults.values()].sort((a, b) => b.count - a.count || b.lastTick - a.lastTick).slice(0, limit);
    }

    get(sig: string): Fault | undefined {
        return this.faults.get(sig);
    }

    size(): number {
        return this.faults.size;
    }

    /** Forget everything, including the file, and let a recurrence announce itself again. */
    clear(): number {
        const n = this.faults.size;
        this.faults.clear();
        this.announced.clear();
        this.dirty = true;
        this.flush();
        return n;
    }

    /**
     * Turn the reporter on from inside a process that has no env var - a sim. Same code path as
     * init(), but it does not read the file, so a sim starts from a clean table every run.
     */
    enableForTesting(file: string): void {
        this.enabled = true;
        this.broken = false;
        this.file = file;
        this.webhook = '';
        this.faults.clear();
        this.announced.clear();
    }

    private giveUp(err: unknown): void {
        this.broken = true;
        printWarning(`script faults: the reporter itself failed and is now off - ${String((err as { message?: unknown })?.message ?? err)}`);
    }
}

export default new ScriptFaultReporter();
