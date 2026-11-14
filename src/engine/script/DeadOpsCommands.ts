import Player from '#/engine/entity/Player.js';
import DeadOps from '#/engine/script/DeadOps.js';

// ::deadops - administrators and up (staffModLevel 3+), as ::coverage and ::faults are.
//
//   ::deadops              how many options have answered "Nothing interesting happens." since boot
//   ::deadops list [n]     the worst n, by how often somebody has clicked them (20 by default)
//   ::deadops list <text>  the ones whose trigger or target contains <text> - "oploc", "fairy"
//   ::deadops write        the whole list to a file, which is the to-do list
//   ::deadops clear        start again (before testing one thing, to see what IT found)
//
// This is the other half of ::coverage, and the more actionable half. ::coverage says which triggers
// nothing has reached, which includes a great deal of content that is written and simply has not
// been played. This says which clicks reached nothing - an option in the cache that no script
// answers - and every one of those is a player right-clicking something and being told nothing
// happens.
//
// It fills up from three directions at once: a fuzz run (::bot fuzz), any sim in tools/sim, and a
// human playing on the dev world. Per process, like coverage, and honest about it.
//
// For the whole list without playing at all: npx tsx tools/sim/opsweep.ts, which cross-references
// every option in the cache against the script table and needs no running world.
export default function handleDeadOpsCommand(player: Player, args: string[]): boolean {
    if (!DeadOps.enabled) {
        player.messageGame('Dead-op collection is off on this world (NODE_DEAD_OPS).');
        return false;
    }

    const sub = args[0];

    if (sub === 'clear') {
        player.messageGame(`${DeadOps.clear()} cleared. Everything counts from now.`);
        return true;
    }

    if (sub === 'write') {
        const file = DeadOps.flush();
        player.messageGame(file ? `Wrote ${DeadOps.size()} unanswered options to ${file}.` : 'Could not write the report - see the server log.');
        return true;
    }

    if (sub === 'list') {
        const all = DeadOps.all();
        const filter = args[1];
        const numeric = filter && /^\d+$/.test(filter);
        const limit = numeric ? parseInt(filter) : 20;
        const matching = filter && !numeric ? all.filter(r => `${r.trigger},${r.target}`.toLowerCase().includes(filter.toLowerCase())) : all;
        player.messageGame(`${matching.length} unanswered option${matching.length === 1 ? '' : 's'}${filter && !numeric ? ` matching '${filter}'` : ''}:`);
        for (const row of matching.slice(0, Math.min(limit, 40))) {
            player.messageGame(`  x${row.count} [${row.trigger},${row.target}] ${row.kind === 'filler' ? '(a trigger ran and said nothing)' : ''} first at ${row.where}`);
        }
        if (matching.length > Math.min(limit, 40)) {
            player.messageGame(`  ...and ${matching.length - Math.min(limit, 40)} more - ::deadops write for all of them.`);
        }
        return true;
    }

    const all = DeadOps.all();
    const noTrigger = all.filter(r => r.kind === 'notrigger').length;
    player.messageGame(`${all.length} options have answered with nothing since this world came up: ${noTrigger} with no trigger at all, ${all.length - noTrigger} where a trigger ran and still had nothing to say.`);
    player.messageGame('::deadops list [n|text] | ::deadops write | ::deadops clear');
    return true;
}
