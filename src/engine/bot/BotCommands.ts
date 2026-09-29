import BotManager from '#/engine/bot/BotManager.js';
import { BOT_KITS, type BotKind } from '#/engine/bot/BotKits.js';
import { findings } from '#/engine/bot/BotFuzzWatch.js';
import BotPlayer from '#/engine/bot/BotPlayer.js';
import Player from '#/engine/entity/Player.js';
import Environment from '#/util/Environment.js';

// ::bots and ::bot - administrators and up (staffModLevel 3+), as the dev world's other tools are.
//
//   ::bots                         every bot: kind, kit, level, hitpoints, wilderness level, what it is doing
//   ::bots on | off                keep the configured bots in the world / take them all out and stop
//   ::bot spawn <roamer|pker> [kit] [count]
//                                  extra bots (they respawn until despawned). In the Wilderness they
//                                  arrive where you stand; anywhere else, at a hotspot for their kit
//   ::bot despawn <name|all>       out now, no respawn (an automatic one is replaced after a while)
//   ::bot goto <name>              teleport to a bot
//   ::bot info <name>              one bot, and what it last heard and did
//   ::bot kits                     the kit ids
//   ::bot fuzz [count] [seed=N] [here]
//                                  fuzzing bots (BotFuzzer.ts): they wander and click everything in
//                                  reach, and the watchers say when something is wrong. Development
//                                  worlds only - it refuses anywhere else, and says why
//   ::bot fuzz findings | clear | off
export default function handleBotCommand(player: Player, cmd: string, args: string[]): boolean {
    if (!Environment.NODE_BOTS || !BotManager.running) {
        player.messageGame('Bots are off on this world (NODE_BOTS).');
        return false;
    }

    if (cmd === 'bots') {
        const sub = args[0];
        if (sub === 'off') {
            BotManager.paused = true;
            const n = BotManager.despawnAll();
            player.messageGame(`Bots paused: ${n} taken out. ::bots on to bring them back.`);
            return true;
        }
        if (sub === 'on') {
            BotManager.paused = false;
            player.messageGame('Bots on: filling up to the configured counts.');
            return true;
        }
        const all = BotManager.all();
        player.messageGame(`${all.length} bots (${BotManager.pendingRespawns()} respawning)${BotManager.paused ? ', PAUSED' : ''}:`);
        for (const s of all) {
            player.messageGame(BotManager.describe(s));
        }
        return true;
    }

    const sub = args.shift();
    if (sub === 'kits') {
        for (const kit of BOT_KITS) {
            player.messageGame(`${kit.id}: ${kit.kinds.join('/')}`);
        }
        return true;
    }

    // custom (2026-09-29) - the fuzzers (BotFuzzer.ts). `at` is where you are standing, which is the
    // whole point: point them at the content you are working on.
    if (sub === 'fuzz') {
        const what = args[0];
        if (what === 'off' || what === 'stop') {
            player.messageGame(`${BotManager.stopFuzzers()} fuzzers taken out.`);
            return true;
        }
        if (what === 'findings') {
            const all = findings.all();
            if (!all.length) {
                player.messageGame('No fuzz findings. (Script errors are under ::faults.)');
                return true;
            }
            player.messageGame(`${all.length} fuzz finding${all.length === 1 ? '' : 's'}:`);
            for (const f of all.slice(0, 10)) {
                player.messageGame(`  ${f.sig} [${f.kind}] x${f.count} ${f.detail}`);
                player.messageGame(`     seed ${f.seed}, ${f.bot}: ${f.trail.slice(-4).join(' -> ')}`);
            }
            return true;
        }
        if (what === 'clear') {
            player.messageGame(`Cleared ${findings.clear()} fuzz findings.`);
            return true;
        }
        let count = 4;
        let seed = 0;
        let here = false;
        for (const arg of args) {
            if (arg === 'here') here = true;
            else if (/^seed=\d+$/.test(arg)) seed = parseInt(arg.slice(5));
            else if (/^\d+$/.test(arg)) count = Math.min(20, Math.max(1, parseInt(arg)));
        }
        const why = BotManager.startFuzzers(count, seed, here ? { x: player.x, z: player.z, level: player.level } : undefined);
        if (why) {
            player.messageGame(why);
            return false;
        }
        player.messageGame(`${count} fuzzers started, seed ${BotManager.fuzzSeed}. ::bot fuzz findings | ::faults | ::bot fuzz off`);
        return true;
    }

    if (sub === 'spawn') {
        const kind = args[0] as BotKind;
        if (kind !== 'roamer' && kind !== 'pker') {
            player.messageGame('Usage: ::bot spawn <roamer|pker> [kit] [count]');
            return false;
        }
        let kitId: string | undefined;
        let count = 1;
        for (const arg of args.slice(1)) {
            if (/^\d+$/.test(arg)) count = Math.min(10, Math.max(1, parseInt(arg)));
            else kitId = arg;
        }
        const at = player.isInWilderness() ? { x: player.x, z: player.z, level: player.level } : undefined;
        for (let i = 0; i < count; i++) {
            const result = BotManager.spawn(kind, { kitId, at, manual: true });
            if (typeof result === 'string') {
                player.messageGame(`Could not spawn: ${result}`);
                return false;
            }
            player.messageGame(`Spawned ${result.displayName} (${BotManager.stateOf(result)?.kit.id}).`);
        }
        return true;
    }

    if (sub === 'despawn') {
        const name = args.join(' ');
        if (name === 'all') {
            const n = BotManager.despawnAll();
            player.messageGame(`${n} bots taken out (the configured ones come back unless ::bots off).`);
            return true;
        }
        const bot = BotManager.find(name);
        if (!bot) {
            player.messageGame(`No bot called '${name}'.`);
            return false;
        }
        BotManager.despawn(bot);
        player.messageGame(`${bot.displayName} taken out.`);
        return true;
    }

    if (sub === 'goto' || sub === 'info') {
        const name = args.join(' ');
        const bot: BotPlayer | undefined = BotManager.find(name);
        if (!bot || bot.slot === -1) {
            player.messageGame(`No bot called '${name}' in the world.`);
            return false;
        }
        if (sub === 'goto') {
            player.closeModal();
            player.clearInteraction();
            player.unsetMapFlag();
            player.teleJump(bot.x, bot.z, bot.level);
            return true;
        }
        const s = BotManager.stateOf(bot);
        if (s) {
            player.messageGame(BotManager.describe(s));
            player.messageGame(`at ${bot.x},${bot.z} spot:${s.hotspot.name} last:${s.lastAction}`);
        }
        for (const m of bot.messages.slice(-4)) {
            player.messageGame(`  heard: ${m.text}`);
        }
        return true;
    }

    player.messageGame('::bots [on|off] | ::bot spawn <roamer|pker> [kit] [count] | ::bot despawn <name|all> | ::bot goto <name> | ::bot info <name> | ::bot kits');
    player.messageGame('::bot fuzz [count] [seed=N] [here] | ::bot fuzz findings | ::bot fuzz clear | ::bot fuzz off');
    return false;
}
