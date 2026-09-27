// Server-side bots (src/engine/bot) on the real engine - run with `npx tsx tools/sim/bots.ts`.
//
//   off by default     no NODE_BOTS, no manager, no bots, and the staff commands say so
//   roamers            travel the wilderness (not leashed to a hotspot, not past their bracket's depth),
//                      running, and kill monsters suited to their level (xp gained)
//   pkers              attack a real player inside the wilderness level range, and not one outside it;
//                      another bot too (botsAttackBots, on by default), which fights back
//   casters            keep casting through a fight: re-freeze, damage spells, a hybrid's melee rush and
//                      back into its casting set - high hybrid, max Ahrim's, max tribrid (Ahrim's/Verac's)
//   max                combat 126 in full Barrows sets; their drop is coins and food, never Barrows
//   running            the run orb back on once the energy has come back
//   a fight            the bot eats, prays, runs when the food is gone; its death leaves bones and the
//                      small drop, never its kit; it comes back later with the kit regenerated
//   bookkeeping        never saved or announced to the friend server; not in the online count
//   staff commands     ::bots / ::bot, administrators (staffModLevel 3) and up only
import fs from 'fs';
import * as H from './harness.ts';
import World from '#/engine/World.js';
import Environment from '#/util/Environment.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import NpcType from '#/cache/config/NpcType.js';
import BotManager from '#/engine/bot/BotManager.js';
import BotPlayer from '#/engine/bot/BotPlayer.js';
import { DEFAULT_BOT_CONFIG } from '#/engine/bot/BotConfig.js';
import { getVarp, wildernessLevel } from '#/engine/bot/BotBrain.js';
import { isMapBlocked } from '#/engine/GameMap.js';
import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';
import Player from '#/engine/entity/Player.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';

let ok = 0,
    bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) ok++;
    else bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const bots = () => [...World.playerLoop.all()].filter(p => p.isBot) as BotPlayer[];
const cheatHandler = new ClientCheatHandler();
const cheat = (p: Player, text: string) => {
    H.clearLogs();
    cheatHandler.handle(new ClientCheat(text), p);
    return H.mesgs.filter(m => m.who === p.username).map(m => m.text);
};
const open = (x: number, z: number) => {
    for (let r = 0; r < 6; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (!isMapBlocked(x + dx, z + dz, 0)) return { x: x + dx, z: z + dz };
    return { x, z };
};
const setStats = (p: Player, levels: Partial<Record<PlayerStat, number>>) => {
    for (const [stat, level] of Object.entries(levels)) p.setLevel(Number(stat), level as number);
    p.combatLevel = p.getCombatLevel();
};
const wornName = (p: Player, slot: number) => {
    const o = p.getInventory(InvType.WORN)!.get(slot);
    return o ? ObjType.get(o.id).debugname : null;
};
const count = (p: Player, name: string) => p.invTotal(InvType.INV, ObjType.getId(name));

// Everything the world tells the login and friend servers, so "never saved" is something checked.
const posted: { thread: string; msg: any }[] = [];

console.log('OFF BY DEFAULT');
check('NODE_BOTS defaults to false', Environment.NODE_BOTS, false);
await H.boot();
for (const thread of ['loginThread', 'friendThread']) {
    const w = (World as any)[thread];
    const orig = w.postMessage.bind(w);
    w.postMessage = (msg: any) => {
        posted.push({ thread, msg });
        return orig(msg);
    };
}
check('a world that did not ask has no bot manager', World.bots, null);
const staff = H.makePlayer('botstaff', 3222, 3218);
const mod = H.makePlayer('botmod', 3224, 3218);
H.tick(2);
staff.staffModLevel = 3;
mod.staffModLevel = 2;
check('  ::bots says they are off', cheat(staff, 'bots'), ['Bots are off on this world (NODE_BOTS).']);
H.tick(20);
check('  and there are none', bots().length, 0);

console.log('ROAMERS');
(Environment as any).NODE_BOTS = true;
const cfg = structuredClone(DEFAULT_BOT_CONFIG);
cfg.roamers = { low: 1, mid: 1, high: 1, max: 0 };
cfg.pkers = { low: 0, mid: 0, high: 0, max: 0 };
cfg.spawnIntervalTicks = 1;
cfg.respawnTicks = [10, 12];
cfg.mistakeChance = 0;
BotManager.start(cfg);
H.tick(20);
const roamers = bots();
check('three roamers came in', roamers.length, 3);
check(
    '  each named "Bot <name>" (12 characters at most)',
    roamers.every(b => /^Bot [A-Z]/.test(b.displayName) && b.username.length <= 12),
    true
);
check(
    '  each in the wilderness',
    roamers.every(b => wildernessLevel(b, b.x, b.z, 0) >= 1),
    true
);
check(
    '  each wearing its kit',
    roamers.every(b => wornName(b, 3) !== null),
    true
);
const xp = (b: Player) => b.stats[PlayerStat.ATTACK] + b.stats[PlayerStat.STRENGTH] + b.stats[PlayerStat.DEFENCE] + b.stats[PlayerStat.RANGED];
const start = new Map(roamers.map(b => [b, { x: b.x, z: b.z, xp: xp(b) }]));
const furthest = new Map<BotPlayer, number>();
const deepest = new Map<BotPlayer, number>();
let ran = false;
for (let t = 0; t < 700; t++) {
    H.tick(1);
    for (const b of roamers) {
        if (!b.isActive) continue;
        const s0 = start.get(b)!;
        furthest.set(b, Math.max(furthest.get(b) ?? 0, Math.max(Math.abs(b.x - s0.x), Math.abs(b.z - s0.z))));
        deepest.set(b, Math.max(deepest.get(b) ?? 0, wildernessLevel(b, b.x, b.z, 0)));
        if (b.run === 1 && b.hasWaypoints()) ran = true;
    }
}
console.log('    furthest from where each started:', roamers.map(b => `${b.displayName} ${furthest.get(b)} tiles, down to level ${deepest.get(b)} (${BotManager.stateOf(b)?.kit.bracket ?? 'gone'})`).join('; '));
check(
    '  they travel, not leashed to their hotspot (one went 30+ tiles)',
    [...furthest.values()].some(n => n >= 30),
    true
);
check(
    "  never past their bracket's depth (low 15, mid 30)",
    roamers.every(b => {
        const br = BotManager.stateOf(b)?.kit.bracket;
        return br === undefined || (deepest.get(b) ?? 0) <= cfg.depth[br] + 1;
    }),
    true
);
check('  and run', ran, true);
check(
    '  and fought monsters for experience',
    roamers.some(b => xp(b) > start.get(b)!.xp),
    true
);
check(
    '  kills counted',
    BotManager.all().some(s => s.kills > 0),
    true
);
console.log(
    '   ',
    BotManager.all()
        .map(s => BotManager.describe(s))
        .join('\n    ')
);

console.log('ONLINE COUNT');
const humans = [...World.playerLoop.all()].filter(p => !p.isBot).length;
check('bots are not players online', World.getHumanPlayerCount(), humans);
check('  though they are in the world', World.getTotalPlayers() > humans, true);
check("  the content's playercount agrees (scale_by_playercount(4000) = 4000 - online)", H.runProc(staff, '[proc,scale_by_playercount]', [4000])[0], 4000 - humans);

console.log('PKERS');
BotManager.config.roamers = { low: 0, mid: 0, high: 0, max: 0 }; // quiet from here on
BotManager.despawnAll();
H.tick(25);
check('despawned: none left', bots().length, 0);
// a level-20 spot (the Graveyard of Shadows), and a combat-85 victim for a combat-85 PKer
const g = open(3160, 3668);
const victim = H.makePlayer('botvictim', g.x, g.z);
H.tick(2);
setStats(victim, { [PlayerStat.ATTACK]: 70, [PlayerStat.STRENGTH]: 70, [PlayerStat.DEFENCE]: 70, [PlayerStat.HITPOINTS]: 70, [PlayerStat.PRAYER]: 43 });
H.equip(victim, { rhand: 'rune_scimitar', torso: 'rune_platebody', legs: 'rune_platelegs' });
check('victim at wilderness level', wildernessLevel(victim, victim.x, victim.z, 0), 19);
const pker = BotManager.spawn('pker', { kitId: 'mid-main-melee', at: { x: g.x + 4, z: g.z, level: 0 }, manual: true }) as BotPlayer;
H.clearLogs();
let engaged = -1;
for (let t = 0; t < 40 && engaged === -1; t++) {
    H.tick(1);
    if (H.hitsFor('botvictim').length) engaged = t;
}
check(`a PKer in range attacks a real player (cb ${pker.combatLevel} vs ${victim.combatLevel}, level 19)`, engaged !== -1, true);
console.log(`    first hit on the victim ${engaged} ticks after the bot appeared`);
BotManager.despawn(pker);
H.despawn(victim);
H.tick(5);

// out of range: a combat-40 player at level 3 is 45 levels below a combat-85 PKer
const d = open(3094, 3540);
const low = H.makePlayer('botlow', d.x, d.z);
H.tick(2);
setStats(low, { [PlayerStat.ATTACK]: 30, [PlayerStat.STRENGTH]: 30, [PlayerStat.DEFENCE]: 30, [PlayerStat.HITPOINTS]: 35 });
const pker2 = BotManager.spawn('pker', { kitId: 'mid-main-melee', at: { x: d.x + 3, z: d.z, level: 0 }, manual: true }) as BotPlayer;
// and another bot next to it, out of range too (combat 78 at level 3) - bots travel, so what is checked
// is that neither ever picks a target it could not attack where it stood
const other = BotManager.spawn('pker', { kitId: 'mid-tank', at: { x: d.x + 3, z: d.z + 2, level: 0 }, manual: true }) as BotPlayer;
H.clearLogs();
let pickedLow = false,
    pickedOutOfRange = false;
for (let t = 0; t < 60; t++) {
    H.tick(1);
    for (const b of [pker2, other]) {
        const tgt = BotManager.stateOf(b)?.pvpTarget;
        if (!tgt) continue;
        if (tgt === low) pickedLow = true;
        const wl = Math.min(wildernessLevel(b, b.x, b.z, 0), wildernessLevel(b, tgt.x, tgt.z, 0));
        if (Math.abs(b.combatLevel - tgt.combatLevel) > wl) pickedOutOfRange = true;
    }
}
check(`a PKer does not attack out of range (cb ${pker2.combatLevel} vs ${low.combatLevel} at level ${wildernessLevel(low, low.x, low.z, 0)})`, H.hitsFor('botlow').length, 0);
check('  nor pick them as a target', pickedLow, false);
check('  nor any bot it could not attack where it stood', pickedOutOfRange, false);
BotManager.despawn(pker2);
BotManager.despawn(other);
H.despawn(low);
H.tick(5);

console.log('BOT AGAINST BOT');
{
    // level 19, away from any monster (a monster on the roamer is "already under attack" in single-way
    // combat): a combat-85 PKer and a combat-78 roamer are inside each other's range
    const quiet = () => {
        for (let x = 2960; x < 3380; x += 6) {
            if (isMapBlocked(x, 3668, 0) || isMapBlocked(x + 4, 3668, 0)) continue;
            let monsters = false;
            for (let zx = (x - 20) >> 3; zx <= (x + 20) >> 3 && !monsters; zx++)
                for (let zz = (3668 - 20) >> 3; zz <= (3668 + 20) >> 3 && !monsters; zz++) for (const n of World.gameMap.getZone(zx << 3, zz << 3, 0).getAllNpcsSafe()) if (NpcType.get(n.type).op?.includes('Attack')) monsters = true;
            if (!monsters) return { x, z: 3668 };
        }
        return open(3160, 3668);
    };
    const b = quiet();
    console.log(`    at ${b.x},${b.z}`);
    const hunter = BotManager.spawn('pker', { kitId: 'mid-main-melee', at: { x: b.x, z: b.z, level: 0 }, manual: true }) as BotPlayer;
    const prey = BotManager.spawn('roamer', { kitId: 'mid-tank', at: { x: b.x + 4, z: b.z, level: 0 }, manual: true }) as BotPlayer;
    H.clearLogs();
    let hunted = false,
        foughtBack = false;
    for (let t = 0; t < 120; t++) {
        H.tick(1);
        if (BotManager.stateOf(hunter)?.pvpTarget === prey) hunted = true;
        if (getVarp(hunter, 'pk_predator1') === prey.uid) foughtBack = true; // the roamer's hits landed on the hunter
        // neither is under test for its food here
        for (const x of [hunter, prey]) if (x.levels[PlayerStat.HITPOINTS] < 30) x.levels[PlayerStat.HITPOINTS] = x.baseLevels[PlayerStat.HITPOINTS];
    }
    check(`a PKer goes for another bot in range (botsAttackBots is on by default): ${hunter.displayName} -> ${prey.displayName}`, hunted, true);
    check('  and hits it', H.hitsFor(prey.username).length > 0, true);
    if (process.env.BOTDEBUG)
        console.log(
            '    roamer:',
            BotManager.describe(BotManager.stateOf(prey)!),
            BotManager.stateOf(prey)?.lastAction,
            prey.messages
                .slice(-6)
                .map(m => m.text)
                .join(' / '),
            'hunter:',
            hunter.messages
                .slice(-4)
                .map(m => m.text)
                .join(' / ')
        );
    check('  and the roamer fights back', foughtBack, true);
    BotManager.despawn(hunter);
    BotManager.despawn(prey);
    H.tick(5);

    BotManager.config.botsAttackBots = false;
    const h2 = BotManager.spawn('pker', { kitId: 'mid-main-melee', at: { x: b.x, z: b.z, level: 0 }, manual: true }) as BotPlayer;
    const p2 = BotManager.spawn('roamer', { kitId: 'mid-tank', at: { x: b.x + 4, z: b.z, level: 0 }, manual: true }) as BotPlayer;
    let left = true;
    for (let t = 0; t < 60; t++) {
        H.tick(1);
        if (BotManager.stateOf(h2)?.pvpTarget === p2 || getVarp(p2, 'pk_predator1') === h2.uid) left = false;
    }
    check('  with botsAttackBots false it leaves bots alone', left, true);
    BotManager.despawn(h2);
    BotManager.despawn(p2);
    BotManager.config.botsAttackBots = true;
    H.tick(5);
}

console.log('MAGES');
const MAXED = { [PlayerStat.ATTACK]: 99, [PlayerStat.STRENGTH]: 99, [PlayerStat.DEFENCE]: 99, [PlayerStat.HITPOINTS]: 99, [PlayerStat.PRAYER]: 99 };
for (const [kitId, stats, meleeWeapon, magicWeapon] of [
    ['high-hybrid', { [PlayerStat.ATTACK]: 80, [PlayerStat.STRENGTH]: 80, [PlayerStat.DEFENCE]: 80, [PlayerStat.HITPOINTS]: 80, [PlayerStat.PRAYER]: 43 }, 'dragon_scimitar', 'staff_of_zaros'],
    ['mid-mage', { [PlayerStat.ATTACK]: 50, [PlayerStat.STRENGTH]: 50, [PlayerStat.DEFENCE]: 50, [PlayerStat.HITPOINTS]: 50, [PlayerStat.PRAYER]: 20 }, null, null],
    ['max-ahrim', MAXED, null, null],
    ['max-tribrid', MAXED, 'barrows_verac_weapon', 'barrows_ahrim_weapon']
] as const) {
    const m = open(3160, 3668);
    const markName = 'mk' + kitId.replaceAll('-', '').slice(0, 10); // a fresh name each time: a removed player's name is held while its save flushes
    const target = H.makePlayer(markName, m.x, m.z);
    H.tick(2);
    setStats(target, stats);
    const mage = BotManager.spawn('pker', { kitId, at: { x: m.x + 5, z: m.z, level: 0 }, manual: true }) as BotPlayer;
    H.clearLogs();
    let meleeSwitch = false,
        backToMagic = false,
        castAfterRush = false,
        casts = 0;
    const freezes = new Set<number>();
    H.tick(2);
    let runes = mage.invTotal(InvType.INV, ObjType.getId('deathrune'));
    for (let t = 0; t < 300; t++) {
        H.tick(1);
        const frozenUntil = getVarp(target, 'frozen');
        if (frozenUntil > World.currentTick) freezes.add(frozenUntil);
        // (Barrows pieces wear down into barrows_..._100 and so on as they are used)
        if (meleeWeapon && wornName(mage, 3)?.startsWith(meleeWeapon)) meleeSwitch = true;
        if (meleeSwitch && magicWeapon && wornName(mage, 3)?.startsWith(magicWeapon)) backToMagic = true;
        const now = mage.invTotal(InvType.INV, ObjType.getId('deathrune'));
        if (now < runes) {
            casts++;
            if (meleeSwitch) castAfterRush = true;
        }
        runes = now;
        if (target.levels[PlayerStat.HITPOINTS] < 45) target.levels[PlayerStat.HITPOINTS] = stats[PlayerStat.HITPOINTS]; // the target is not under test
    }
    if (process.env.BOTDEBUG)
        console.log(
            '   ',
            kitId,
            BotManager.stateOf(mage)?.phase,
            BotManager.stateOf(mage)?.lastAction,
            mage.messages
                .slice(-5)
                .map(m => m.text)
                .join(' / '),
            [0, 4, 7, 3].map(s => wornName(mage, s)).join(',')
        );
    const runesUsed = casts > 0;
    const frozen = freezes.size > 0;
    console.log(`    ${kitId}: ${casts} casts, ${freezes.size} separate freezes in 300 ticks`);
    if (process.env.BOTDEBUG) console.log('   ', kitId, mage.messages.map(m => m.text).join(' / '), BotManager.stateOf(mage)?.lastAction, mage.tabs[6]);
    check(`${kitId} (cb ${mage.combatLevel} vs ${target.combatLevel}) casts on a player: runes spent`, runesUsed, true);
    check('  and freezes them', frozen, true);
    check(
        '  and it hurts',
        H.hitsFor(markName).some(h => h.damage > 0),
        true
    );
    check('  keeps casting through the fight (5+ casts)', casts >= 5, true);
    check('  and freezes again once the last one and its immunity are over', freezes.size >= 2, true);
    if (meleeWeapon) {
        check('  rushes a frozen target in its melee set', meleeSwitch, true);
        check('  goes back to its casting set afterwards', backToMagic, true);
        check('  and casts again after the rush', castAfterRush, true);
    }
    BotManager.despawn(mage);
    H.despawn(target);
    H.tick(5);
}

console.log('MAX');
for (const kitId of ['max-dharok', 'max-verac', 'max-guthan', 'max-torag', 'max-karil', 'max-ahrim', 'max-tribrid']) {
    const spot = open(2960, 3890); // the Ice Plateau, level 47
    const m = BotManager.spawn('pker', { kitId, at: { x: spot.x, z: spot.z, level: 0 }, manual: true }) as BotPlayer;
    H.tick(2);
    const brother = kitId === 'max-tribrid' ? 'ahrim' : kitId.slice(4);
    const set = [0, 4, 7, 3].map(slot => wornName(m, slot));
    check(`${kitId}: combat ${m.combatLevel}, full ${brother}'s`, [m.combatLevel, set], [126, [`barrows_${brother}_head`, `barrows_${brother}_body`, `barrows_${brother}_legs`, `barrows_${brother}_weapon`]]);
    if (kitId === 'max-dharok') check("  Dharok's lets its hitpoints run down before it eats (below 45%)", (BotManager.stateOf(m)?.eatBelow ?? 99) < 45, true);
    // its drop, straight from the manager: max coins and food, never a Barrows piece
    const state = BotManager.stateOf(m)!;
    (BotManager as any).applyDeathDrop(state);
    const carried: string[] = [];
    for (const inv of [InvType.INV, InvType.WORN]) {
        const c = m.getInventory(inv)!;
        for (let i = 0; i < c.capacity; i++) {
            const o = c.get(i);
            if (o) carried.push(ObjType.get(o.id).debugname!);
        }
    }
    const coins = count(m, 'coins');
    check('  its death drop: max coins, no Barrows', [carried.some(n => n.startsWith('barrows_')), coins >= 8000 && coins <= 20000], [false, true]);
    BotManager.despawn(m);
    H.tick(3);
}
{
    // Karil's: the crossbow and its bolt racks, against a max-level player at level 47
    const spot = open(2960, 3890);
    const mark = H.makePlayer('karmark', spot.x, spot.z);
    H.tick(2);
    setStats(mark, { [PlayerStat.ATTACK]: 99, [PlayerStat.STRENGTH]: 99, [PlayerStat.DEFENCE]: 99, [PlayerStat.HITPOINTS]: 99, [PlayerStat.PRAYER]: 99 });
    const k = BotManager.spawn('pker', { kitId: 'max-karil', at: { x: spot.x + 5, z: spot.z, level: 0 }, manual: true }) as BotPlayer;
    H.clearLogs();
    for (let t = 0; t < 80; t++) {
        H.tick(1);
        if (mark.levels[PlayerStat.HITPOINTS] < 50) mark.levels[PlayerStat.HITPOINTS] = 99;
    }
    const racks = k.getInventory(InvType.WORN)!.get(13)?.count ?? 0;
    check('max-karil shoots a player with its bolt racks', [H.hitsFor('karmark').some(h => h.damage > 0), racks < 300], [true, true]);
    BotManager.despawn(k);
    H.despawn(mark);
    H.tick(3);
}

console.log('RUNNING');
{
    const spot = open(3094, 3540);
    const r = BotManager.spawn('roamer', { kitId: 'low-main-melee', at: { x: spot.x, z: spot.z, level: 0 }, manual: true }) as BotPlayer;
    H.tick(3);
    check('a bot starts with its run on', r.run, 1);
    // spent: the engine turns run off at 0, as it does for anyone
    r.runenergy = 0;
    H.tick(1);
    check('  out of energy, it walks', r.run, 0);
    r.runenergy = 6000; // got its breath back
    let back = -1;
    for (let t = 0; t < 40 && back === -1; t++) {
        H.tick(1);
        if (r.run === 1) back = t;
    }
    check('  and turns run back on itself once it has energy again', back !== -1, true);
    BotManager.despawn(r);
    H.tick(3);
}

console.log('A FIGHT');
const k = open(3160, 3672);
const killer = H.makePlayer('botkiller', k.x, k.z);
H.tick(2);
// combat 92 against the bots' 85: inside level 19's range (a maxed 126 would not be)
setStats(killer, { [PlayerStat.ATTACK]: 85, [PlayerStat.STRENGTH]: 85, [PlayerStat.DEFENCE]: 70, [PlayerStat.HITPOINTS]: 80 });
H.equip(killer, { rhand: 'abyssal_whip', torso: 'rune_platebody', legs: 'rune_platelegs', hat: 'rune_full_helm', lhand: 'rune_kiteshield' });
// the killer is not under test: kept alive, running, and after the bot
const hunt = (prey: Player) => {
    if (!killer.target && prey.isActive && !killer.delayed) H.attack(killer, prey);
    if (killer.levels[PlayerStat.HITPOINTS] < 40) killer.levels[PlayerStat.HITPOINTS] = 80;
    killer.run = 1;
    killer.runenergy = 10000;
};
const trace = (t: number, prey: BotPlayer) => {
    if (process.env.BOTDEBUG && t % 10 === 0)
        console.log(
            `    t${t} bot hp${prey.levels[3]} food${count(prey, 'swordfish')} ${BotManager.stateOf(prey)?.phase} at ${prey.x},${prey.z} | killer at ${killer.x},${killer.z} ktgt=${killer.target ? ((killer.target as any).username ?? 'x') : '-'} kd=${killer.delayed} | ${H.mesgs
                .filter(m => m.who === 'botkiller')
                .slice(-2)
                .map(m => m.text)
                .join(' / ')} | bot: ${prey.messages
                .slice(-2)
                .map(m => m.text)
                .join(' / ')} last=${BotManager.stateOf(prey)?.lastAction} hitsOnBot=${JSON.stringify(
                H.hitsFor(prey.username)
                    .slice(-6)
                    .map(h => h.damage)
            )} anims=${H.anims.filter(a => a.who === 'botkiller').length}`
        );
};
{
    const prey = BotManager.spawn('pker', { kitId: 'mid-main-melee', at: { x: k.x + 2, z: k.z, level: 0 }, manual: true }) as BotPlayer;
    H.tick(2);
    const food0 = count(prey, 'swordfish');
    let prayed = false,
        ate = false,
        fought = false,
        fled = false;
    H.clearLogs();
    for (let t = 0; t < 1500 && !fled && prey.isActive; t++) {
        hunt(prey);
        H.tick(1);
        trace(t, prey);
        if (getVarp(prey, 'prayer14') === 1) prayed = true;
        if (count(prey, 'swordfish') < food0) ate = true;
        if (BotManager.stateOf(prey)?.phase === 'leaving') fled = true;
    }
    fought = H.hitsFor('botkiller').length > 0;
    check('the bot fought back', fought, true);
    check('  prayed against melee', prayed, true);
    check('  ate', ate, true);
    check('  and ran once its food was gone', fled, true);
    BotManager.despawn(prey);
    H.tick(5);
}

console.log('DEATH');
const doomed = BotManager.spawn('pker', { kitId: 'mid-main-melee', at: { x: k.x + 1, z: k.z, level: 0 }, manual: true }) as BotPlayer;
H.tick(3);
const doomedName = doomed.username;
// into the fight first (so running for it is a real escape attempt, not a stroll), then nothing left
for (let t = 0; t < 30 && getVarp(doomed, 'lastcombat') + 8 <= World.currentTick; t++) {
    hunt(doomed);
    H.tick(1);
}
doomed.invDel(InvType.INV, ObjType.getId('swordfish'), 28);
doomed.levels[PlayerStat.HITPOINTS] = 4;
doomed.levels[PlayerStat.PRAYER] = 0;
let deathTile: { x: number; z: number } | null = null;
for (let t = 0; t < 300 && !deathTile; t++) {
    hunt(doomed);
    doomed.runenergy = 0; // spent: it can only walk, and the killer runs it down
    H.tick(1);
    trace(t, doomed);
    if (getVarp(doomed, 'death') === 1) deathTile = { x: doomed.x, z: doomed.z };
}
check('a bot dies', deathTile !== null, true);
H.tick(8);
const dropped: string[] = [];
const receivers: string[] = [];
if (deathTile) {
    for (let zx = (deathTile.x - 2) >> 3; zx <= (deathTile.x + 2) >> 3; zx++)
        for (let zz = (deathTile.z - 2) >> 3; zz <= (deathTile.z + 2) >> 3; zz++)
            for (const obj of World.gameMap.getZone(zx << 3, zz << 3, 0).getAllObjsSafe()) {
                // what the death left, not the map's own ground spawns
                if (Math.abs(obj.x - deathTile.x) <= 2 && Math.abs(obj.z - deathTile.z) <= 2 && obj.lifecycle === EntityLifeCycle.DESPAWN) {
                    dropped.push(ObjType.get(obj.type).debugname + (obj.count > 1 ? ' x' + obj.count : ''));
                    receivers.push(obj.receiver64 === killer.hash64 ? 'killer' : obj.receiver64 === -1n ? 'everyone' : String(obj.receiver64));
                }
            }
}
console.log('    its drop:', dropped.join(', '), '- for', receivers.join(', '));
check(
    '  bones in the drop',
    dropped.some(n => n.startsWith('bones')),
    true
);
check(
    '  coins in the drop',
    dropped.some(n => n.startsWith('coins')),
    true
);
const kit = ['rune_full_helm', 'rune_platebody', 'rune_platelegs', 'rune_kiteshield', 'dragon_scimitar', 'amulet_of_glory', 'death_climbingboots', 'red_cape', 'dragon_dagger_p++'];
check(
    '  none of its kit',
    dropped.filter(n => kit.includes(n.split(' ')[0])),
    []
);
check('  three things at most (bones, coins, sometimes one cheap piece)', dropped.length <= 3, true);
check("  all of it the killer's to pick up first", receivers.length > 0 && receivers.every(r => r === 'killer'), true);

console.log('RESPAWN');
let back: BotPlayer | undefined;
for (let t = 0; t < 150 && !back; t++) {
    H.tick(1);
    back = bots().find(b => b.username === doomedName && b !== doomed);
}
check('it came back', back !== undefined, true);
if (back) {
    H.tick(2);
    check('  with its kit regenerated', [wornName(back, 3), wornName(back, 4), count(back, 'swordfish'), back.levels[PlayerStat.HITPOINTS]], ['dragon_scimitar', 'rune_platebody', 10, 70]);
    check('  in the wilderness', wildernessLevel(back, back.x, back.z, 0) >= 1, true);
}

console.log('NEVER SAVED');
const botMentions = posted.filter(p => JSON.stringify(p.msg, (_k, v) => (typeof v === 'bigint' ? String(v) : v)).includes('bot_'));
check(
    'nothing about a bot went to the login or friend server (saves, logins, logouts)',
    botMentions.map(p => p.msg.type),
    []
);
check(
    '  no save queued for one on logout',
    [...World.logoutRequests.keys()].filter(u => u.startsWith('bot_')),
    []
);

const saves = `data/players/${Environment.NODE_PROFILE}`;
check('  and no save file for one', fs.existsSync(saves) ? fs.readdirSync(saves).filter(f => f.startsWith('bot_')) : [], []);

console.log('STAFF COMMANDS');
check('::bots is for administrators: a moderator gets nothing', cheat(mod, 'bots'), []);
const list = cheat(staff, 'bots');
check('  ::bots lists them', list[0]?.includes('bots') && list.length === bots().length + 1, true);
const spawned = cheat(staff, 'bot spawn roamer low-tank');
check('  ::bot spawn', /^Spawned Bot /.test(spawned[0] ?? ''), true);
H.tick(3);
const name = spawned[0]?.match(/^Spawned (Bot \S+)/)?.[1] ?? '';
check(
    '  it is in the world',
    bots().some(b => b.displayName === name),
    true
);
check('  ::bot despawn', cheat(staff, 'bot despawn ' + name.slice(4)), [`${name} taken out.`]);
H.tick(3);
check(
    '  and it is gone',
    bots().some(b => b.displayName === name),
    false
);
check('  ::bots off takes every bot out', cheat(staff, 'bots off')[0]?.startsWith('Bots paused'), true);
H.tick(25);
check('  none left', bots().length, 0);

console.log(`BOTS  ${ok} ok, ${bad} failed`);
process.exit(bad ? 1 : 0);
