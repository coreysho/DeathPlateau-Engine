import Player from '#/engine/entity/Player.js';
import ScriptFaults from '#/engine/script/ScriptFaults.js';
import Environment from '#/util/Environment.js';

// ::faults - administrators and up (staffModLevel 3+), as ::bots is.
//
//   ::faults                 the worst script faults: signature, count, where it threw
//   ::faults <sig>           one fault in full: the message and every frame of its backtrace
//   ::faults clear           forget them all (and empty the file), so the next run starts clean
//
// The signature is the short hex the reporter hashes out of the message and the backtrace, so the
// same bug is one line however often it fires. See engine/script/ScriptFaults.ts for why any of
// this exists.
export default function handleFaultsCommand(player: Player, args: string[]): boolean {
    if (!ScriptFaults.enabled) {
        player.messageGame('The script fault reporter is off on this world (NODE_SCRIPT_FAULTS).');
        return false;
    }

    const sub = args[0];

    if (sub === 'clear') {
        const n = ScriptFaults.clear();
        player.messageGame(`Cleared ${n} script fault${n === 1 ? '' : 's'}.`);
        return true;
    }

    if (sub) {
        const fault = ScriptFaults.get(sub);
        if (!fault) {
            player.messageGame(`No fault with signature '${sub}'. ::faults for the list.`);
            return false;
        }
        const where = fault.npc ? `npc ${fault.npc}` : fault.player ? `player ${fault.player}` : 'no self';
        player.messageGame(`${fault.sig}: x${fault.count}, ticks ${fault.firstTick}-${fault.lastTick}, first on ${where}${fault.coord ? ` @ ${fault.coord}` : ''}`);
        player.messageGame(`script error: ${fault.message}`);
        player.messageGame('stack backtrace:');
        for (let i = 0; i < fault.frames.length; i++) {
            const f = fault.frames[i];
            player.messageGame(`    ${i + 1}: ${f.trigger} - ${f.file}:${f.line}`);
        }
        return true;
    }

    const top = ScriptFaults.top(12);
    if (top.length === 0) {
        player.messageGame('No script faults recorded. (Writing to ' + Environment.NODE_SCRIPT_FAULTS_FILE + '.)');
        return true;
    }
    player.messageGame(`${ScriptFaults.size()} distinct script fault${ScriptFaults.size() === 1 ? '' : 's'}, worst first - ::faults <sig> for the backtrace:`);
    for (const fault of top) {
        // The deepest frame is the trigger the engine actually fired, which is the useful one to see
        // in a list: it says what a player was DOING when the content gave up.
        const origin = fault.frames[fault.frames.length - 1];
        const top1 = fault.frames[0];
        player.messageGame(`  ${fault.sig} x${fault.count} ${fault.message}`);
        player.messageGame(`     ${top1.file}:${top1.line} via ${origin.trigger}${fault.npc ? ` (${fault.npc})` : ''}`);
    }
    return true;
}
