// THE LOOT TRACKER'S FEED, through the real death queue, the real PvP drop and the real casket.
//
//   npx tsx tools/sim/lootfeed.ts
//
// The client's loot tracker used to guess a kill from an npc vanishing near a fresh pile on the
// floor. The server now tells it (src/engine/entity/LootFeed.ts), so what has to be true is that it
// tells the right player the right thing, once per kill, and nothing else:
//
//   * a kill's drop arrives as ONE line naming the npc, its level and every item, counts merged;
//   * nothing is sent to a player whose client never asked (::lootfeed);
//   * an npc handing something over while alive - not dying - is not loot;
//   * a PvP kill reports what the KILLER was given, under the victim's name;
//   * a clue casket is one event named for its tier, with what the reward inv holds;
//   * a drop too long for one game message is split, every piece under 255, and joins back up.
//
// SIM PLAYERS HAVE NO CLIENT, so World.processClientsOut skips them - and clears their feed, which
// is the rule for a client that has gone. The sim reads the feed itself after each step instead,
// with clear() held off while it does: what is checked is everything up to the send.
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import Environment from '#/util/Environment.js';
import InvType from '#/cache/config/InvType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import Player from '#/engine/entity/Player.js';
import LootFeed, { LOOT_LINE_MAX } from '#/engine/entity/LootFeed.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptPointer from '#/engine/script/ScriptPointer.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ScriptState from '#/engine/script/ScriptState.js';
import { reportDeathDrop } from '#/engine/script/handlers/ObjOps.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';

// ------------------------------------------------------------------ the format, with no world

console.log('THE LINE ITSELF');
{
    const items = new Map<number, number>([
        [536, 1],
        [995, 196]
    ]);
    check('one kill, one line', LootFeed.encode('n', 7, 'Black dragon', 227, items), ['n|7|0|227|Black dragon|536,1;995,196:loot:']);

    const many = new Map<number, number>();
    for (let i = 0; i < 80; i++) many.set(10000 + i, 1000000 + i);
    const lines = LootFeed.encode('e', 9, 'Clue scroll (hard)', 0, many);
    check('a long drop is split', lines.length > 1, true);
    check('every piece fits a game message', lines.every(l => l.length <= LOOT_LINE_MAX), true);
    check(
        'every piece but the last says more is coming',
        lines.map(l => l.split('|')[2]),
        lines.map((_, i) => (i < lines.length - 1 ? '1' : '0'))
    );
    const back = lines.map(l => l.slice(0, -':loot:'.length).split('|').slice(5).join('|')).join(';').split(';');
    check('and the pieces hold every item exactly once', back.length, 80);

    check('a name cannot break the line', LootFeed.safeName('Bad\nname:loot:'), 'Bad name');
}

await H.boot();

// clear() is what the output phase does to a player with no client - which is every sim player -
// so it is held off while this runs and the feed is read here instead.
const realClear = LootFeed.prototype.clear;
LootFeed.prototype.clear = function () {};

function drain(p: Player): string[] {
    const out: string[] = [];
    p.lootFeed.flush(line => out.push(line));
    return out;
}

function hello(p: Player) {
    new ClientCheatHandler().handle(new ClientCheat('lootfeed'), p);
}

/** A kill as a kill happens: the hero is the player, the npc is at no hitpoints, its death queue runs. */
function kill(p: Player, npcName: string): void {
    const npc = H.addNpc(npcName, p.x + 1, p.z);
    H.tick(1);
    npc.heroPoints.addHero(p.hash64, 100);
    npc.applyDamage(npc.levels[3], 0);
    npc.enqueueScript(ServerTriggerType.AI_QUEUE3, 0, 0);
    H.tick(10);
}

function parse(line: string) {
    const body = line.slice(0, -':loot:'.length);
    const head = body.split('|');
    const bar = body.lastIndexOf('|');
    return {
        type: head[0],
        more: head[2],
        level: Number(head[3]),
        name: body.slice(head.slice(0, 4).join('|').length + 1, bar),
        items: body
            .slice(bar + 1)
            .split(';')
            .filter(s => s.length > 0)
            .map(s => {
                const [id, count] = s.split(',').map(Number);
                return { name: ObjType.get(id).debugname, count };
            })
    };
}

console.log('\nAN NPC KILL');
{
    const p = player('lootsim', 3222, 3218);
    H.tick(1);

    kill(p, 'cow');
    check('nothing for a client that never asked', drain(p), []);

    const said = H.mesgs.filter(m => m.who === p.username).length;
    hello(p);
    check('::lootfeed says nothing in the chatbox', H.mesgs.filter(m => m.who === p.username).length - said, 0);
    kill(p, 'cow');
    const lines = drain(p);
    check('one kill, one line', lines.length, 1);
    if (lines.length === 1) {
        const got = parse(lines[0]);
        const cow = NpcType.get(NpcType.getId('cow'));
        check('  an npc', got.type, 'n');
        check('  named as the game names it', got.name, cow.name);
        check('  at its level', got.level, Math.max(0, cow.vislevel));
        check('  with everything a cow drops', got.items.map(i => i.name).sort(), ['bones', 'cow_hide', 'raw_beef']);
    }

    kill(p, 'cow');
    kill(p, 'cow');
    check('two kills, two lines', drain(p).length, 2);

    // Alive, an npc's obj_add is not loot. No content script does that today, so the guard is
    // asked directly, with the state an [ai_timer] on a healthy npc would have.
    const npc = H.addNpc('cow', p.x - 1, p.z);
    H.tick(1);
    drain(p);
    const alive = { self: npc, trigger: ServerTriggerType.AI_TIMER, activePlayer: p } as unknown as ScriptState;
    reportDeathDrop(alive, ObjType.getId('bones'), 1);
    check('an npc that is not dying drops no loot', drain(p), []);
    const dying = { self: npc, trigger: ServerTriggerType.AI_QUEUE3, activePlayer: p } as unknown as ScriptState;
    reportDeathDrop(dying, ObjType.getId('bones'), 1);
    check('the same obj_add from its death queue does', drain(p).length, 1);
    H.despawn(p);
}

console.log('\nA PLAYER KILL');
{
    const was = Environment.NODE_PRODUCTION;
    Environment.NODE_PRODUCTION = true; // map_live: a dev world takes nobody's items
    const killer = player('lootkiller', 3230, 3202);
    const victim = player('lootvictim', 3230, 3200);
    H.tick(1);
    hello(killer);
    hello(victim);
    H.clearInv(victim);
    H.give(victim, 'shark', 5);
    H.equip(victim, { rhand: 'rune_scimitar' });
    H.setVar(victim, 'pk_skull', 1);
    H.tick(1);

    const script = ScriptProvider.getByName('[proc,pvp_death_lose_items]')!;
    const state = ScriptRunner.init(script, victim, killer, []);
    state.pointerAdd(ScriptPointer.ProtectedActivePlayer);
    victim.protect = true;
    ScriptRunner.execute(state);
    victim.protect = false;

    const lines = drain(killer);
    check('the killer is told once', lines.length, 1);
    if (lines.length === 1) {
        const got = parse(lines[0]);
        check('  a player', got.type, 'p');
        check('  by the victim\'s name', got.name, victim.displayName);
        const sharks = got.items.find(i => i.name === 'shark');
        check('  five sharks as one stack of five', sharks?.count, 5);
        check('  and the scimitar', got.items.some(i => i.name === 'rune_scimitar'), true);
    }
    check('the victim is told nothing', drain(victim), []);
    Environment.NODE_PRODUCTION = was;
    H.despawn(killer, victim);
}

console.log('\nA CLUE CASKET');
{
    const p = player('lootclue', 3222, 3218);
    H.tick(1);
    hello(p);
    const inv = InvType.getId('trail_rewardinv');
    p.invAdd(inv, ObjType.getId('coins'), 1234);
    p.invAdd(inv, ObjType.getId('rune_longsword'), 1);
    H.runProc(p, '[proc,trail_complete]', [2], undefined, true);
    const lines = drain(p);
    check('one event', lines.length, 1);
    if (lines.length === 1) {
        const got = parse(lines[0]);
        check('  an event', got.type, 'e');
        check('  named for its tier', got.name, 'Clue scroll (hard)');
        check('  with what the casket paid', got.items.map(i => `${i.name} x${i.count}`).sort(), ['coins x1234', 'rune_longsword x1']);
    }
    H.despawn(p);
}

LootFeed.prototype.clear = realClear;
console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad > 0 ? 1 : 0);
