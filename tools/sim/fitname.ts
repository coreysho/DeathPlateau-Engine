import { toBase37 } from '#/util/JString.js';

/**
 * The username the world will actually give an account to, for a label that cannot have one.
 *
 * toBase37 reads the first TWELVE CHARACTERS of the string - NOT the first twelve letters and
 * digits. Anything that is not a letter or a digit still holds its place and counts as zero, and a
 * trailing zero is then divided away. So an underscore in the first twelve characters costs a slot
 * ("orn1333_11207" and "orn1333_11206" are one account, while "orn133311207" and "orn133311206"
 * are two), and "ab", "ab_" and "ab__" are all the same account as well.
 *
 * Every sim in this directory builds usernames out of whatever it is iterating over, and the
 * difference between two cases is usually at the end of the name: "spec_dragon_sword" and
 * "spec_dragon_warhammer", "wear_imbued_ancient_cape_guthix" and the Saradomin one, twenty-two
 * weapons whose names agree for the first twelve characters. The world refuses the duplicate login
 * and says nothing, so the sim carries on holding a Player that was never in it - which mmaggro
 * reported as an Ape Atoll monkey that would not attack a human standing beside it, with distance
 * 1, line of sight both ways, and p.isActive false. Twenty-three sims had it.
 *
 * So a label that collides is given a short name that keeps the head and the tail of it - the two
 * ends that carry the difference - and spends the twelfth character on a counter if even that is
 * taken. A label that fits keeps itself, so a name only ever changes because it had to, and the
 * change is printed the first time it is used rather than happening quietly.
 */
const taken = new Map<string, string>();
const fitted = new Map<string, string>();
export function fitName(label: string): string {
    const already = fitted.get(label);
    if (already !== undefined) return already;

    const alnum = label.replace(/[^a-zA-Z0-9]/g, '');
    const tries = [label];
    if (alnum !== label && alnum.length <= 12) tries.push(alnum);
    const stem = alnum.slice(0, 6) + alnum.slice(-5);
    for (const c of '0123456789abcdefghijklmnopqrstuvwxyz') tries.push(stem + c);

    for (const name of tries) {
        const key = String(toBase37(name));
        const owner = taken.get(key);
        if (owner !== undefined && owner !== label) continue;
        taken.set(key, label);
        fitted.set(label, name);
        if (name !== label) console.log(`  (logs in as "${name}", which is ${label})`);
        return name;
    }
    throw new Error(`no username left for "${label}": every short form of it is already an account here`);
}
