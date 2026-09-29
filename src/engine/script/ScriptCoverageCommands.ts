import Player from '#/engine/entity/Player.js';
import ScriptCoverage from '#/engine/script/ScriptCoverage.js';

// ::coverage - administrators and up (staffModLevel 3+), as ::bots and ::faults are.
//
//   ::coverage               how many of the build's triggers have ever run in this process
//   ::coverage never [n]     the first n triggers nothing has reached (20 by default)
//   ::coverage never <text>  the ones whose name or file contains <text> - "slayer", "quest_dragon"
//   ::coverage write         the whole never-reached list to a file, which is the to-do list
//   ::coverage clear         start counting again (before testing one thing, to see what it reached)
//
// The count is per process: it starts empty at every reboot and only means "since this world came
// up". That is the honest reading, and it is also the useful one - clear it, do one thing, and
// ::coverage says exactly which triggers that one thing touched.
export default function handleCoverageCommand(player: Player, args: string[]): boolean {
    if (!ScriptCoverage.enabled) {
        player.messageGame('Script coverage is off on this world (NODE_SCRIPT_COVERAGE).');
        return false;
    }

    const sub = args[0];
    const { total, executed } = ScriptCoverage.summary();

    if (sub === 'clear') {
        ScriptCoverage.clear();
        player.messageGame('Coverage cleared. Everything counts from now.');
        return true;
    }

    if (sub === 'write') {
        const file = ScriptCoverage.write();
        player.messageGame(file ? `Wrote ${total - executed} never-reached triggers to ${file}.` : 'Could not write the coverage report - see the server log.');
        return true;
    }

    if (sub === 'never') {
        const never = ScriptCoverage.never();
        const filter = args[1];
        const limit = filter && /^\d+$/.test(filter) ? parseInt(filter) : 20;
        const matching = filter && !/^\d+$/.test(filter) ? never.filter(n => n.toLowerCase().includes(filter.toLowerCase())) : never;
        player.messageGame(`${matching.length} triggers never reached${filter && !/^\d+$/.test(filter) ? ` matching '${filter}'` : ''}:`);
        for (const line of matching.slice(0, Math.min(limit, 40))) {
            player.messageGame('  ' + line);
        }
        if (matching.length > Math.min(limit, 40)) {
            player.messageGame(`  ...and ${matching.length - Math.min(limit, 40)} more - ::coverage write for all of them.`);
        }
        return true;
    }

    player.messageGame(`${executed}/${total} triggers have run since this world came up (${((executed / Math.max(1, total)) * 100).toFixed(1)}%), ${total - executed} never.`);
    player.messageGame('::coverage never [n|text] | ::coverage write | ::coverage clear');
    return true;
}
