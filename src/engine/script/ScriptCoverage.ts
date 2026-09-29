import fs from 'fs';
import path from 'path';

import type ScriptFile from '#/engine/script/ScriptFile.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import Environment from '#/util/Environment.js';
import { printInfo, printWarning } from '#/util/Logger.js';

// custom (2026-09-29) - which of the build's triggers have ever actually run.
//
// WHY. "Here are 400 triggers no test and no player has ever reached" is a to-do list, and it is a
// list nobody can write by hand: a trigger is reached through a loc's op, an npc's ai queue, a
// button on an interface, a timer - there is no way to read it off the source. The only honest
// answer comes from running the engine and watching.
//
// It is also what steers the fuzzer. Left alone a fuzzer re-tests Lumbridge all night, because
// Lumbridge is where the density is; told which triggers nothing has ever run, it goes looking for
// the content nobody has touched instead (BotFuzzer.preferUncovered).
//
// COST. A Set.add of a small integer per script execution, behind the same kind of off-by-default
// flag the fault reporter uses. With NODE_SCRIPT_COVERAGE unset this is one boolean read.

class ScriptCoverageTracker {
    /** Read at boot from NODE_SCRIPT_COVERAGE; the fuzzer also turns it on for itself. */
    enabled = false;

    private readonly seen: Set<number> = new Set();
    /** The trigger scripts in this build, worked out once on first use. */
    private triggerIds: number[] | null = null;

    init(): void {
        this.enabled = Environment.NODE_SCRIPT_COVERAGE;
        if (this.enabled) {
            printInfo(`script coverage: on - ${this.triggers().length} triggers in this build`);
        }
    }

    /** Turn it on from a process with no env var: a sim, or the fuzzer. */
    enable(): void {
        this.enabled = true;
    }

    /**
     * THE HOT PATH. Called from ScriptRunner.execute for every script the engine runs, including
     * every resume of a paused one - hence the boolean first and nothing else when it is off.
     */
    mark(script: ScriptFile): void {
        if (!this.enabled) {
            return;
        }
        this.seen.add(script.id);
    }

    /** Has anything ever run this script? Used by the fuzzer to prefer what nothing has reached. */
    covered(script: ScriptFile | undefined): boolean {
        return script === undefined || this.seen.has(script.id);
    }

    /**
     * How many distinct scripts have run at all, procs included - O(1), unlike executed(), which
     * walks the trigger list. The fuzzer reads it every tick to tell whether it is still finding
     * anything new, so it has to be free.
     */
    seenCount(): number {
        return this.seen.size;
    }

    executed(): number {
        let n = 0;
        for (const id of this.triggers()) {
            if (this.seen.has(id)) {
                n++;
            }
        }
        return n;
    }

    /**
     * Every script the engine could fire on its own. A lookup key alone is not enough: the compiler
     * gives one to [proc,...] and [label,...] too, and those are not triggers - a proc nothing calls
     * is dead code, which the compiler can already see. What is worth counting is the [oploc1,...],
     * [opheld2,...], [ai_queue3,...] and the rest: content a PLAYER reaches, or does not.
     * [debugproc,...] is left in deliberately - a staff command nothing has ever run is still a
     * staff command nobody has tested.
     */
    private triggers(): number[] {
        if (this.triggerIds) {
            return this.triggerIds;
        }
        const ids: number[] = [];
        for (let id = 0; id < ScriptProvider.count; id++) {
            const script = ScriptProvider.get(id);
            if (!script || script.info.lookupKey === 0xffffffff) {
                continue;
            }
            if (script.name.startsWith('[proc,') || script.name.startsWith('[label,')) {
                continue;
            }
            ids.push(id);
        }
        this.triggerIds = ids;
        return ids;
    }

    summary(): { total: number; executed: number } {
        return { total: this.triggers().length, executed: this.executed() };
    }

    /** The triggers nothing has ever run, as `name - file`, sorted so a diff between runs is readable. */
    never(): string[] {
        const out: string[] = [];
        for (const id of this.triggers()) {
            if (this.seen.has(id)) {
                continue;
            }
            const script = ScriptProvider.get(id);
            if (script) {
                out.push(`${script.name} - ${script.fileName}`);
            }
        }
        return out.sort();
    }

    /** The triggers that HAVE run, for the same reason: a diff between two runs says what a change reached. */
    reached(): string[] {
        const out: string[] = [];
        for (const id of this.triggers()) {
            if (!this.seen.has(id)) {
                continue;
            }
            const script = ScriptProvider.get(id);
            if (script) {
                out.push(`${script.name} - ${script.fileName}`);
            }
        }
        return out.sort();
    }

    clear(): void {
        this.seen.clear();
    }

    /**
     * The report, as a plain text file: the numbers, then every trigger nothing reached. Written on
     * demand (::coverage write, or a sim), never on a timer - it is a few hundred kilobytes.
     */
    write(file: string = Environment.NODE_SCRIPT_COVERAGE_FILE): string {
        try {
            const dir = path.dirname(file);
            if (dir && !fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const { total, executed } = this.summary();
            const never = this.never();
            const lines = [`# script trigger coverage, ${new Date().toISOString()}`, `# ${executed}/${total} triggers have run (${((executed / Math.max(1, total)) * 100).toFixed(1)}%)`, `# ${never.length} below have never run in this process`, '', ...never];
            fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
            return file;
        } catch (err) {
            printWarning(`script coverage: could not write the report - ${String((err as { message?: unknown })?.message ?? err)}`);
            return '';
        }
    }
}

export default new ScriptCoverageTracker();
