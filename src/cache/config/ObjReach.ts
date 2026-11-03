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
