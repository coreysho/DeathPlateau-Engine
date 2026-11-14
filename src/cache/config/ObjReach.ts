import fs from 'fs';
import path from 'path';

import Environment from '#/util/Environment.js';

/**
 * CAN A PLAYER EVER HOLD THIS OBJ? Answered one way only, and that is the useful way.
 *
 * If an obj's debugname appears nowhere under the content sources then nothing can hand it out: no
 * script adds it, no drop or reward table lists it, no shop stocks it, nothing degrades or uncerts
 * into it. That is conclusive. Being named proves nothing in return - a mention in a comment counts
 * - so every caller phrases its result as "nobody can hold one" rather than "unobtainable".
 *
 * AN OBJ CONFIG DECLARING ITS OWN NAME IS NOT A WAY TO GET IT, so `[name]` header lines in .obj
 * files are skipped. The key=value lines are kept, because param=fixed and certlink are exactly how
 * a degraded or certed obj is reached from one that is obtainable.
 *
 * WHY THIS IS SHARED RATHER THAN COPIED. It began inside tools/sim/opsweep.ts, where it took that
 * report's obj section from 391 lines to the ~53 worth reading. Then BotPersona needed the same
 * question for the opposite purpose - which objs to put in a fuzzing bot's backpack - and two
 * copies of a rule like this drift. The same mistake was made with FILLER_LINES and corrected the
 * same way.
 *
 * COST. One walk of content/scripts, cached for the process. Only callers that ask pay it, which
 * means a running game server never does.
 */
let named: Set<string> | null = null;

export function namesAppearingInContent(): Set<string> {
    if (named) {
        return named;
    }
    const seen = new Set<string>();
    const header = /^\s*\[[a-zA-Z0-9_]+\]\s*$/;
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(full);
                continue;
            }
            let text: string;
            try {
                text = fs.readFileSync(full, 'ascii');
            } catch {
                continue;
            }
            const declaresObjs = e.name.endsWith('.obj');
            for (const line of text.split(/\r?\n/)) {
                if (declaresObjs && header.test(line)) {
                    continue;
                }
                for (const token of line.match(/[A-Za-z0-9_]+/g) ?? []) {
                    seen.add(token);
                }
            }
        }
    };
    walk(path.join(Environment.BUILD_SRC_DIR, 'scripts'));
    named = seen;
    return named;
}

/** False only when nothing in content names it, which is the conclusive direction. */
export function somebodyCanHold(debugname: string | null | undefined): boolean {
    if (!debugname) {
        return false;
    }
    return namesAppearingInContent().has(debugname);
}

/**
 * THE SAME QUESTION FOR AN NPC THE MAP NEVER PLACES, which is a different question from the obj one
 * and needed its own walk.
 *
 * opsweep files a dead option on an unplaced npc under "nobody can reach them today", and for
 * scenery that is right. For an npc it can be badly wrong: an npc is also reachable by `npc_add`,
 * and the whole point of some of them is that no map square places one. Twenty-one woodcutting Ents
 * sat in that bucket looking handled while the woodcutting anti-macro event spawned them at every
 * ordinary tree in the game and the player could not chop a single one.
 *
 * So this asks the narrower question: does any .rs2 name it? Scripts are what spawn npcs, and
 * unlike .obj and .npc configs a script never declares an npc merely by existing. Same one-way
 * rule as above: absence is conclusive, presence proves nothing.
 */
let inScripts: Set<string> | null = null;
let spawnLines: Set<string> | null = null;

function walkScripts(): void {
    const seen = new Set<string>();
    const spawned = new Set<string>();
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(full);
                continue;
            }
            if (!e.name.endsWith('.rs2')) {
                continue;
            }
            let text: string;
            try {
                text = fs.readFileSync(full, 'ascii');
            } catch {
                continue;
            }
            for (const line of text.split(/\r?\n/)) {
                const spawns = line.includes('npc_add') || line.includes('npc_changetype');
                for (const token of line.match(/[A-Za-z0-9_]+/g) ?? []) {
                    seen.add(token);
                    if (spawns) {
                        spawned.add(token);
                    }
                }
            }
        }
    };
    walk(path.join(Environment.BUILD_SRC_DIR, 'scripts'));
    inScripts = seen;
    spawnLines = spawned;
}

export function namesAppearingInScripts(): Set<string> {
    if (!inScripts) {
        walkScripts();
    }
    return inScripts!;
}

/**
 * The stronger half of the same evidence: names sitting on a line that calls `npc_add` or
 * `npc_changetype`. Not a narrower REPLACEMENT for namesAppearingInScripts - an npc can be spawned
 * through a constant, an enum or a dbrow whose name differs, so a miss here is not conclusive and
 * must never be used to file a line back under "unreachable". It is only ever used to put the
 * demonstrably-spawned lines at the top of a list.
 */
export function namesSpawnedInScripts(): Set<string> {
    if (!spawnLines) {
        walkScripts();
    }
    return spawnLines!;
}

/** False only when no script names it, which is the conclusive direction. */
export function scriptCanSpawn(debugname: string | null | undefined): boolean {
    if (!debugname) {
        return false;
    }
    return namesAppearingInScripts().has(debugname);
}
