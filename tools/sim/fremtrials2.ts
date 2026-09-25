// The Fremennik Trials, second round of playtest reports, against the real engine and the real map.
// Usage: npx tsx tools/sim/fremtrials2.ts
//
//   longhall   the backstage door: the bouncer's refusals before the quest, without a lyre (the
//              acapella song) and after the Bard's trial; in with the enchanted lyre, the
//              performance on the stage, and OUT of the door afterwards (it used to put you back on
//              the stage every time); out after the quest; the bouncer and the hecklers talk
//   sigmund    the whole chain of favours in the wiki's order, every link: a bystander's "no idea"
//              line, the one who has it asking for the next thing, their "afterwards" line, the
//              other option still reaching their own trial, Askeladden's 5,000 coins, then every
//              trade back up the chain (wrong-item line first, then the swap) to Sigmund's vote;
//              losing the goods on the way back; a player part way back under the old version
//   peer       Peer's banking spell sends what you carry and wear to the bank
import * as H from './harness.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import NpcType from '#/cache/config/NpcType.js';
import LocType from '#/cache/config/LocType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToLoc, findPathToEntity } from '#/engine/GameMap.js';

await H.boot();
H.loginOrder();

// the harness only records what players say; the hecklers are npcs
const npcSays: { who: string; text: string }[] = [];
const origNpcSay = (Npc.prototype as any).say;
(Npc.prototype as any).say = function (text: string) {
    npcSays.push({ who: NpcType.get(this.type).debugname ?? '', text });
    return origNpcSay.call(this, text);
};

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

// %viking_bits layout (quest_viking.constant)
const B = { olaf: 2, sigmund: 3, olafAsked: 14, peerRiddle: 24, mLo: 19 };
const bits = (p: Player) => H.getVar(p, 'viking_bits');
const bit = (p: Player, n: number) => (bits(p) >>> n) & 1;
const setBits = (p: Player, ...ns: number[]) => H.setVar(p, 'viking_bits', ns.reduce((v, n) => v | (1 << n), bits(p)));
const step = (p: Player) => (bits(p) >>> B.mLo) & 31;
const setStep = (p: Player, s: number) => H.setVar(p, 'viking_bits', (bits(p) & ~(31 << B.mLo)) | (s << B.mLo));
const at = (p: Player) => [p.x - 2624, p.z - 3648, p.level];

let bucket = 10;
function player(name: string, x: number, z: number, viking = 1): Player {
    const p = H.makePlayer(name, 2624 + x, 3648 + z, bucket++);
    H.tick(1);
    H.clearInv(p);
    H.setVar(p, 'viking', viking);
    H.setVar(p, 'viking_bits', 0);
    H.tick(1);
    return p;
}

/** Click through whatever the player has open: continue on every page, `picks` at menus. */
function drain(p: Player, picks: number[] = [], maxTicks = 60) {
    let idle = 0;
    for (let guard = 0; guard < 400 && idle < maxTicks; guard++) {
        const s = p.activeScript as any;
        if (!s || s.execution !== ScriptState.PAUSEBUTTON) {
            if (!s && !p.delayed && idle > 3 && !p.target && !p.hasWaypoints()) break;
            H.tick(1);
            idle++;
            continue;
        }
        idle = 0;
        const names = (p as any).resumeButtons.map((id: number) => Component.get(id).comName ?? '');
        const open = (p as any).modalChat === -1 ? '' : Component.get((p as any).modalChat).comName ?? '';
        const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
        if (multi) {
            const pick = picks.shift();
            if (pick === undefined) throw new Error('unexpected menu: ' + names.join(','));
            H.choose(p, `${multi.split(':')[0]}:com_${pick}`);
        } else {
            p.executeScript(s, true, true);
        }
    }
    H.tick(1);
    return picks.length; // menus that never came up
}

/** Talk to the nearest npc of this type, from a tile next to it. Returns the text shown. */
function talk(p: Player, npcName: string, picks: number[] = []): string {
    const npc = H.npcNear(npcName, p.x, p.z, p.level) ?? [0, 1, 2, 3].map(l => H.npcNear(npcName, p.x, p.z, l)).find(n => n);
    if (!npc) throw new Error('no npc ' + npcName);
    const from = H.ifaces.length;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, 1);
        for (let t = 0; t < 12 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    const left = drain(p, picks);
    if (left) throw new Error(`${npcName}: ${left} menu pick(s) unused`);
    return text(p, from);
}

const text = (p: Player, from: number) => H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text').map(i => i.text ?? '').join(' | ').replace(/\|/g, ' ').replace(/\s+/g, ' ');
const said = (p: Player, s: string) => H.mesgs.some(m => m.who === p.username && m.text.includes(s));
const has = (t: string, s: string) => t.includes(s);

function clickLoc(p: Player, x: number, z: number, locName: string, op: number, picks: number[] = []) {
    const from = H.ifaces.length;
    H.tick(4); // a door that has just been used is swapped out for a moment
    H.opLoc(p, 2624 + x, 3648 + z, locName, op);
    drain(p, picks);
    return text(p, from);
}

function slotOf(p: Player, objName: string) {
    const id = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
    throw new Error('not carrying ' + objName);
}

/** OpLocUHandler: use an item on a loc (local coords in m41_57 unless absolute), with a real route. */
function useOnLoc(p: Player, x: number, z: number, locName: string, objName: string) {
    const id = LocType.getId(locName);
    const [ax, az] = x < 1000 ? [2624 + x, 3648 + z] : [x, z];
    const loc = World.getLoc(ax, az, p.level, id);
    if (!loc) throw new Error(`no ${locName} at ${x},${z},${p.level}`);
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(id).forceapproach));
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as any).opcalled = true;
    drain(p);
}

/** OpNpcUHandler. */
function useOnNpc(p: Player, npcName: string, objName: string) {
    const npc = H.npcNear(npcName, p.x, p.z, p.level)!;
    p.teleport(npc.x + 1, npc.z, npc.level);
    H.tick(1);
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(objName);
    p.lastUseSlot = slotOf(p, objName);
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
    (p as any).opcalled = true;
    drain(p);
}

/** OpHeldUHandler: `used` picked with Use, clicked on `target`; the target's trigger first. */
function useHeld(p: Player, usedName: string, targetName: string) {
    const target = ObjType.getId(targetName);
    const used = ObjType.getId(usedName);
    p.lastItem = target;
    p.lastSlot = slotOf(p, targetName);
    p.lastUseItem = used;
    p.lastUseSlot = slotOf(p, usedName);
    p.clearPendingAction();
    let script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, target, -1);
    if (!script) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, used, -1);
        [p.lastItem, p.lastUseItem] = [p.lastUseItem, p.lastItem];
        [p.lastSlot, p.lastUseSlot] = [p.lastUseSlot, p.lastSlot];
    }
    if (!script) {
        p.messageGame('Nothing interesting happens.');
        return;
    }
    p.executeScript(ScriptRunner.init(script, p), true);
    drain(p);
}

// =====================================================================================
console.log('LONGHALL  the backstage door, the bouncer, the performance');
{
    const DOOR: [number, number] = [43, 35];
    const OUTSIDE = [43, 35, 0];
    const INSIDE = [42, 35, 0];

    // before the quest
    const n = player('frem_door_new', 44, 35, 0);
    let t = clickLoc(n, ...DOOR, 'viking_bard_backstage_door', 1);
    check('before the quest: the bouncer turns you away', [has(t, 'Talent only, backstage'), at(n)], [true, OUTSIDE]);
    t = talk(n, 'viking_longhall_bouncer');
    check('  and says the same when talked to (Talk-to was a dead click)', has(t, 'Talent only, backstage'), true);
    H.despawn(n);

    // on the quest, no lyre: the acapella bard
    const a = player('frem_door_acapella', 44, 35);
    setBits(a, B.olafAsked);
    t = clickLoc(a, ...DOOR, 'viking_bard_backstage_door', 1, [3]);
    check('no lyre: "an acapella bard?", a song, "a pile of tosh", still outside', [has(t, 'acapella'), has(t, 'My old man'), has(t, 'pile of tosh'), at(a)], [true, true, true, OUTSIDE]);
    H.despawn(a);

    // the performer
    const p = player('frem_door_bard', 44, 35);
    setBits(p, B.olafAsked);
    H.give(p, 'viking_enchanted_strung_lyre');
    H.give(p, 'viking_enchanted_strung_lyre');
    t = talk(p, 'viking_longhall_bouncer');
    check('talking to the bouncer with the lyre: "Go on through the door"', has(t, 'Go on through the door'), true);
    p.teleport(2624 + 44, 3648 + 35, 0);
    H.tick(1);
    t = clickLoc(p, ...DOOR, 'viking_bard_backstage_door', 1);
    check('with the enchanted lyre: waved through and INSIDE the door, backstage', [has(t, 'good to go through'), at(p)], [true, INSIDE]);
    // walk out onto the stage
    H.walkTo(p, 2624 + 36, 3648 + 36);
    for (let i = 0; i < 20 && (p.x !== 2624 + 36 || p.z !== 3648 + 36); i++) H.tick(1);
    check('  and walks from backstage onto the stage', at(p), [36, 36, 0]);
    H.clearLogs();
    H.opheld(p, 'viking_enchanted_strung_lyre', 1);
    const from = H.ifaces.length;
    drain(p);
    const sung = H.says.filter(s => s.who === p.username).map(s => s.text);
    check('the performance: four sung lines, the default verse with the name', [sung.length, sung[0].endsWith(' is my name,'), sung[3]], [4, true, "I'll just go ahead and play."]);
    check('  the hecklers heckle', npcSays.filter(s => s.who.startsWith('viking_heckler')).length, 4);
    check("  Olaf: \"That was awesome!\", the Bard's trial done, the vote", [has(text(p, from), 'That was awesome'), said(p, "completed the Bard's Trial"), bit(p, B.olaf)], [true, true, 1]);
    check('  both enchanted lyres lose the blessing', [H.invCount(p, 'viking_enchanted_strung_lyre'), H.invCount(p, 'viking_strung_lyre')], [0, 2]);

    // THE BUG: back out through the door from the stage
    clickLoc(p, ...DOOR, 'viking_bard_backstage_door', 1);
    check('after playing: the door lets you OUT (it used to put you back on the stage)', at(p), OUTSIDE);
    t = clickLoc(p, ...DOOR, 'viking_bard_backstage_door', 1);
    check('  and after the trial the bouncer will not let you back in', [has(t, 'I saw your performance'), at(p)], [true, OUTSIDE]);

    // anyone left inside can always get out - before the performance, and after the quest
    const b = player('frem_door_before', 40, 35);
    setBits(b, B.olafAsked);
    clickLoc(b, ...DOOR, 'viking_bard_backstage_door', 1);
    check('inside before performing, no lyre at all: out', at(b), OUTSIDE);
    const c = player('frem_door_done', 33, 36, 10);
    clickLoc(c, ...DOOR, 'viking_bard_backstage_door', 1);
    check('inside after the quest: out', at(c), OUTSIDE);
    t = clickLoc(c, ...DOOR, 'viking_bard_backstage_door', 1);
    check('  and after the quest the bouncer keeps you out', [has(t, 'Talent only'), at(c)], [true, OUTSIDE]);
    t = talk(c, 'viking_heckler');
    check('a heckler talks (Talk-to was a dead click)', has(t, "waiting for the show"), true);
    H.despawn(p, b, c);
}

// =====================================================================================
console.log("SIGMUND  the chain of favours, every link");
{
    // link -> npc; 0 is Sigmund
    const L = ['viking_sigmund', 'viking_sailor', 'viking_olaf', 'viking_clothing_shopkeeper', 'viking_brundt', 'viking_sigli',
        'viking_weapons_salesman', 'viking_fisherman1', 'viking_hallifred', 'viking_peer', 'viking_thorvald', 'viking_reveller_3',
        'viking_longhall_barkeep', 'viking_askelapen'];
    const WHO = ['Sigmund', 'Sailor', 'Olaf', 'Yrsa', 'Brundt', 'Sigli', 'Skulgrimen', 'Fisherman', 'Swensen', 'Peer', 'Thorvald', 'Manni', 'Thora', 'Askeladden'];
    // a phrase from each link's first answer, from its "afterwards" line, and the item it gives
    const FIRST = ['', 'mysterious flower', 'sturdy boots to replace', 'reduce the sales tax', 'Speak to Sigli then', 'a new string for my hunting bow',
        'You get me that fish', 'secret map of the best fishing spots', 'no less than a weather forecast', 'I require a bodyguard',
        "Champions' Token to you", 'give you my champions token', 'NEVER EVER EVER', ''];
    const AFTER = ['', 'that terrible bard Olaf', 'I would not trouble you', 'Only the Chieftain', 'pay more attention', 'If I knew I would not have asked',
        "There's another one?", 'rip off navigator', 'from the Seer perhaps', 'simply have asked them myself', 'persuade one of the revellers',
        'the longhall barkeep has it', 'Knowing the little runt', ''];
    const GIVES = ['', 'viking_rare_flower', 'viking_song', 'viking_new_boots', 'viking_promissary_note', 'viking_map_to_hunting_grounds', 'viking_bowstring',
        'viking_unique_fish', 'viking_another_map', 'viking_weather_forecast', 'viking_promissary_note3', 'viking_champion_token',
        'viking_legendary_cocktail', 'viking_promissary_note2'];
    const menu = (link: number, then: number[] = []) => [1, ...then]; // "Ask about the Merchant's trial" is always the first option

    const p = player('frem_sigmund', 17, 30);
    let t = talk(p, 'viking_sailor');
    check('before Sigmund sets the task, the sailor just answers the council question (no menu)', [has(t, "just a sailor"), step(p)], [true, 0]);
    t = talk(p, 'viking_sigmund', [2]);
    check('Sigmund, "No": no task', [has(t, 'I simply require a flower'), step(p)], [true, 0]);
    t = talk(p, 'viking_sigmund', [1]);
    check('Sigmund, "Yes": the flower task (step 1)', [has(t, 'insular clan'), step(p)], [true, 1]);
    t = talk(p, 'viking_sigmund');
    check('  Sigmund again: ask around the other Fremennik', has(t, 'ask around the other Fremennik'), true);

    const noIdea: string[] = [];
    const firsts: string[] = [];
    const afters: string[] = [];
    for (let link = 1; link <= 12; link++) {
        // somebody further down the chain has no idea yet
        const by = link === 12 ? 1 : link + 1;
        t = talk(p, L[by], menu(by));
        noIdea.push(`${link}:${t.includes("I don't suppose you have any idea") && step(p) === link ? 'ok' : t.slice(0, 90)}`);
        t = talk(p, L[link], menu(link));
        firsts.push(`${WHO[link]}:${has(t, FIRST[link]) && step(p) === link + 1 ? 'ok' : `step ${step(p)} ${t.slice(0, 120)}`}`);
        t = talk(p, L[link], menu(link));
        afters.push(`${WHO[link]}:${has(t, AFTER[link]) && step(p) === link + 1 ? 'ok' : t.slice(0, 120)}`);
    }
    check('a bystander asked at each step has no idea and moves nothing', noIdea, noIdea.map(s => s.split(':')[0] + ':ok'));
    check('each link, asked in the wiki order, answers and names what they want', firsts, firsts.map(s => s.split(':')[0] + ':ok'));
    check('each link asked again gives their "afterwards" line', afters, afters.map(s => s.split(':')[0] + ':ok'));
    // hints on the way: Manni and Sigli point the right way when asked about somebody else's item
    t = talk(p, 'viking_sigli', menu(5));
    check('Sigli asked about the promise: "Did you even ASK Askeladden?"', has(t, 'Did you even ASK Askeladden'), true);
    // the other option still reaches their own trials
    t = talk(p, 'viking_peer', [2, 1]);
    check('Peer, "Ask about becoming a Fremennik": his own trial (the riddle)', has(t, 'walk in my front door') || has(t, 'My first is'), true);
    t = talk(p, 'viking_brundt', [2]);
    check('Brundt, "Ask about becoming a Fremennik": his vote count', has(t, 'How am I doing'), true);

    // Askeladden
    t = talk(p, 'viking_askelapen', menu(13, [1]));
    check('Askeladden with no money: "Trying to scam me"', [has(t, 'Trying to scam me'), step(p), H.invCount(p, 'viking_promissary_note2')], [true, 13, 0]);
    t = talk(p, 'viking_askelapen', menu(13, [2]));
    check('Askeladden, "No": the bank of Askeladden', [has(t, 'bank of Askeladden'), step(p)], [true, 13]);
    H.give(p, 'coins', 6000);
    t = talk(p, 'viking_askelapen', menu(13, [1]));
    check('Askeladden paid 5,000: the promissory note, step 14', [has(t, 'Done, and done'), H.invCount(p, 'coins'), H.invCount(p, 'viking_promissary_note2'), step(p)], [true, 1000, 1, 14]);
    t = talk(p, 'viking_askelapen', menu(13));
    check('  Askeladden afterwards: the note is worthless', has(t, "isn't worth the paper"), true);

    // back up the chain
    const trades: string[] = [];
    const wrongs: string[] = [];
    const afterTrades: string[] = [];
    for (let link = 12; link >= 1; link--) {
        const held = GIVES[link + 1];
        const wrongBy = link === 1 ? 2 : link - 1; // somebody who has not been traded with yet (or, for the sailor, already has)
        t = talk(p, L[wrongBy], menu(wrongBy));
        wrongs.push(`${WHO[wrongBy]}:${H.invCount(p, held) === 1 && step(p) === 26 - link ? 'ok' : `step ${step(p)} ${t.slice(0, 90)}`}`);
        t = talk(p, L[link], menu(link));
        const inv = [held, GIVES[link]].map(o => H.invCount(p, o));
        trades.push(`${WHO[link]}:${inv[0] === 0 && inv[1] === 1 && step(p) === 27 - link ? 'ok' : `step ${step(p)} inv ${inv} ${t.slice(0, 120)}`}`);
        t = talk(p, L[link], menu(link));
        afterTrades.push(`${WHO[link]}:${step(p) === 27 - link && H.invCount(p, GIVES[link]) === 1 ? 'ok' : t.slice(0, 90)}`);
    }
    check('on the way back, the wrong person keeps your item and the chain where it was', wrongs, wrongs.map(s => s.split(':')[0] + ':ok'));
    check('each trade takes exactly what they want and gives exactly their item', trades, trades.map(s => s.split(':')[0] + ':ok'));
    check('and talking to them again after changes nothing', afterTrades, afterTrades.map(s => s.split(':')[0] + ':ok'));
    t = talk(p, 'viking_sigmund');
    check("Sigmund takes the flower: his vote, step 27", [has(t, 'Incredible!'), H.invCount(p, 'viking_rare_flower'), step(p), bit(p, B.sigmund)], [true, 0, 27, 1]);
    t = talk(p, 'viking_sigmund');
    check('  Sigmund afterwards', has(t, 'real boon to the Fremennik'), true);
    t = talk(p, 'viking_sailor', menu(1));
    check('  the sailor after it all: it was for Thora', has(t, "It's Thora"), true);
    H.despawn(p);

    // losing the goods
    const q = player('frem_sigmund_lost', 17, 30);
    setStep(q, 18); // Peer has traded: should be holding the weather forecast
    t = talk(q, 'viking_hallifred', menu(8));
    check('lost the forecast: Swensen will not trade', [has(t, "It isn't for me"), step(q)], [true, 18]);
    t = talk(q, 'viking_sigmund');
    check('  Sigmund: "start again at the beginning" - back to Askeladden (step 13)', [has(t, 'start again at the beginning'), step(q)], [true, 13]);
    setStep(q, 14);
    t = talk(q, 'viking_askelapen', menu(13));
    check('  Askeladden, note lost: "speak to the merchant"', has(t, 'speak to the merchant'), true);
    H.give(q, 'viking_weather_forecast');
    setStep(q, 18);
    H.despawn(q);

    // part way back under the old version, holding the old item
    const o = player('frem_sigmund_old', 38, 25);
    setStep(o, 14);
    H.give(o, 'viking_promissary_note'); // the old Askeladden handed out the fiscal statement
    t = talk(o, 'viking_longhall_barkeep', menu(12));
    check('old version, step 14 with the fiscal statement: Thora still makes the cocktail', [H.invCount(o, 'viking_legendary_cocktail'), H.invCount(o, 'viking_promissary_note'), step(o)], [1, 0, 15]);
    H.clearInv(o);
    setStep(o, 16); // the old Manni took the cocktail and gave nothing
    t = talk(o, 'viking_thorvald', menu(10));
    check('old version, step 16 empty-handed: Thorvald trades (the token is made good)', [H.invCount(o, 'viking_promissary_note3'), step(o)], [1, 17]);
    H.despawn(o);
}

// =====================================================================================
console.log("PEER  the banking spell");
{
    const p = player('frem_peer_bank', 10, 21);
    setBits(p, B.peerRiddle);
    H.give(p, 'lobster', 3);
    H.equip(p, { rhand: 'bronze_sword', torso: 'bronze_platebody' });
    const bankInv = () => p.getInventory(InvType.getId('bank'))!;
    let t = talk(p, 'viking_peer', [2]);
    check('"No thanks": nothing moved', [has(t, 'Nobody touches my stuff'), H.invCount(p, 'lobster')], [true, 3]);
    t = talk(p, 'viking_peer', [1]);
    const worn = p.getInventory(InvType.WORN)!;
    let wornCount = 0;
    for (let i = 0; i < worn.capacity; i++) if (worn.get(i)) wornCount++;
    check('"Yes": pack and worn items go to the bank', [has(t, 'The task is done'), H.invCount(p, 'lobster'), wornCount, bankInv().getItemCount(ObjType.getId('lobster')), bankInv().getItemCount(ObjType.getId('bronze_sword'))], [true, 0, 0, 3, 1]);
    t = talk(p, 'viking_peer');
    check('  empty-handed: "enter by one door of your house, and leave by the other"', has(t, 'leave by the other'), true);
    H.despawn(p);
}


// =====================================================================================
console.log('JOURNEY  Brundt, then Manni, Sigli and Peer the whole way through, then Brundt again');
{
    const j = player('frem_journey', 35, 23, 0);
    let t = talk(j, 'viking_brundt', [1]);
    check('Brundt starts the quest', H.getVar(j, 'viking'), 1);

    // Manni: lose, cheat, win
    t = talk(j, 'viking_reveller_3', [1]);
    check('Manni: the first contest is lost', bit(j, 12), 1);
    H.give(j, 'coins', 250);
    t = talk(j, 'poison_salesman', [1, 1]);
    check("  the Poison Salesman in Seers' sells the low alcohol keg for 250", [H.invCount(j, 'viking_low_alcahol_beerkeg'), H.invCount(j, 'coins')], [1, 0]);
    H.give(j, 'beer');
    useOnNpc(j, 'vt_council_workmen', 'beer');
    check('  a beer to the council workman: the strange object', H.invCount(j, 'viking_firecracker'), 1);
    H.give(j, 'tinderbox');
    useHeld(j, 'tinderbox', 'viking_firecracker');
    check('  lit with a tinderbox', H.invCount(j, 'viking_firecracker_lit'), 1);
    j.teleport(2624 + 40, 3648 + 26, 0);
    clickLoc(j, 39, 26, 'viking_pipe_end_longhall', 1);
    check('  into the longhall pipe', bit(j, 13), 1);
    j.teleport(2624 + 36, 3648 + 25, 0);
    clickLoc(j, 36, 26, 'viking_keg', 1);
    t = talk(j, 'viking_reveller_3');
    check("  the rematch: Manni's vote", [bit(j, 0), H.invCount(j, 'viking_beerkeg'), H.invCount(j, 'viking_low_alcahol_beerkeg')], [1, 0, 0]);

    // Sigli: the talisman, the butterfly, the Draugen
    H.clearInv(j);
    t = talk(j, 'viking_sigli', [1]);
    check("Sigli: the hunters' talisman", H.invCount(j, 'viking_draugen_talisman_uncharged'), 1);
    const spots = [[41, 56, 14, 38], [41, 56, 23, 28], [41, 56, 26, 45], [41, 56, 39, 44], [42, 56, 12, 21], [42, 56, 13, 40], [42, 56, 28, 28], [42, 56, 43, 25]];
    const hunt = (label: string) => {
        H.opheld(j, 'viking_draugen_talisman_uncharged', 1);
        drain(j);
        const [mx, mz, lx, lz] = spots[(bits(j) >>> 8) & 7];
        const [sx, sz] = [mx * 64 + lx, mz * 64 + lz];
        check(`  ${label}: Locate starts a hunt, a butterfly on the moors`, !!H.npcNear('viking_draugen_safe', sx, sz, 0), true);
        j.teleport(sx + 1, sz, 0);
        H.tick(1);
        H.opheld(j, 'viking_draugen_talisman_uncharged', 1);
        drain(j);
        const dr = H.npcNear('viking_draugen', sx, sz, 0);
        check(`  ${label}: Locate on the spot, the Draugen rises`, !!dr, true);
        H.maxOut(j);
        for (let i = 0; i < 400 && dr && dr.isActive && (dr as any).levels[3] > 0; i++) {
            j.levels[3] = 99;
            if (i % 5 === 0 && !(j as any).target) H.attackNpc(j, dr);
            H.tick(1);
        }
        drain(j);
        check(`  ${label}: killed, the talisman is charged`, [H.invCount(j, 'viking_draugen_talisman'), bit(j, 7)], [1, 1]);
    };
    hunt('first hunt');
    // lose it after the kill: Sigli used to ask for it forever
    H.clearInv(j);
    t = talk(j, 'viking_sigli');
    check('  charged talisman lost: Sigli gives another and the hunt is on again (was a dead end)', [has(t, 'amateurish mistake'), H.invCount(j, 'viking_draugen_talisman_uncharged'), bit(j, 7)], [true, 1, 0]);
    hunt('second hunt');
    t = talk(j, 'viking_sigli');
    check("  brought back: Sigli's vote", [bit(j, 1), H.invCount(j, 'viking_draugen_talisman')], [1, 0]);

    // Peer: the banking spell, then the house from front door to back
    H.give(j, 'lobster', 2);
    H.equip(j, { rhand: 'bronze_sword' });
    setBits(j, B.peerRiddle); // the riddle is random multiple choice; the answer is not a link to walk
    t = talk(j, 'viking_peer', [1]);
    check('Peer banks your things', [has(t, 'The task is done'), H.invCount(j, 'lobster')], [true, 0]);
    j.teleport(2624 + 7, 3648 + 20, 0);
    H.tick(1);
    clickLoc(j, 7, 19, 'viking_seers_door1', 1);
    check('  in the front door, empty-handed', at(j), [7, 18, 0]);
    clickLoc(j, 7, 15, 'viking_seer_up_ladder', 1);
    check('  up the west ladder (plane 2)', at(j), [7, 14, 2]);
    clickLoc(j, 5, 12, 'viking_cupboardhigh', 1);
    clickLoc(j, 5, 12, 'viking_cupboardopen_high', 2);
    clickLoc(j, 9, 12, 'viking_seerboxes_1', 1);
    check('  the bucket (5) from the cupboard, the jug (3) from the boxes', [H.invCount(j, 'viking_bucket_empty'), H.invCount(j, 'viking_jug_empty')], [1, 1]);
    // 5 into 3 leaves 2; empty the 3; the 2 across; fill the 5; top up the 3 from it: 4 left
    useOnLoc(j, 5, 13, 'viking_seers_tap', 'viking_bucket_empty');
    useHeld(j, 'viking_bucket_5', 'viking_jug_empty');
    useOnLoc(j, 5, 14, 'viking_seers_drain', 'viking_jug_3');
    useHeld(j, 'viking_bucket_2', 'viking_jug_empty');
    useOnLoc(j, 5, 13, 'viking_seers_tap', 'viking_bucket_empty');
    useHeld(j, 'viking_bucket_5', 'viking_jug_2');
    check('  the 5/3 pour leaves exactly 4 in the bucket', H.invCount(j, 'viking_bucket_4'), 1);
    useOnLoc(j, 8, 17, 'viking_seer_chest_closed_scales', 'viking_bucket_4');
    check('  4 on the balance: the airtight vase', H.invCount(j, 'viking_airtight_vase'), 1);
    clickLoc(j, 10, 17, 'viking_seer_bookcase', 1);
    clickLoc(j, 14, 13, 'viking_seercrate', 1); // its twin at (14,12) is boxed into the corner
    clickLoc(j, 13, 12, 'viking_seercrate_2', 1);
    useOnLoc(j, 5, 15, 'viking_seer_range', 'viking_red_herring');
    useHeld(j, 'viking_red_splat', 'viking_uncoloured_wooden_coin');
    check('  the red herring cooked to goop, the wooden disk painted: two red disks', [H.invCount(j, 'viking_red_wooden_coin'), H.invCount(j, 'viking_dummy_coin')], [1, 1]);
    useOnLoc(j, 5, 13, 'viking_seers_tap', 'viking_bucket_4');
    useHeld(j, 'viking_bucket_5', 'viking_airtight_vase');
    check('  water in the vase', H.invCount(j, 'viking_airtight_vase_water'), 1);
    clickLoc(j, 12, 15, 'viking_seer_trapdoor_closed', 1);
    clickLoc(j, 12, 15, 'viking_seer_trapdoor_open', 1);
    check('  down the east trapdoor into the east room', at(j), [12, 14, 0]);
    useOnLoc(j, 10, 15, 'viking_seers_mural', 'viking_red_wooden_coin');
    check('  both red disks on the mural: the lid', H.invCount(j, 'viking_vase_lid'), 1);
    clickLoc(j, 12, 15, 'viking_seer_down_ladder', 1);
    check('  back up the east ladder', at(j), [12, 14, 2]);
    useHeld(j, 'viking_vase_lid', 'viking_airtight_vase_water');
    useOnLoc(j, 14, 17, 'viking_small_table_frozen', 'viking_airtight_vase_with_lid_water');
    H.opheld(j, 'viking_airtight_vase_with_lid_frozen', 1);
    drain(j);
    check('  sealed, frozen, split: the key in the ice', H.invCount(j, 'viking_key_in_ice'), 1);
    useOnLoc(j, 5, 15, 'viking_seer_range', 'viking_key_in_ice');
    check('  thawed on the range: the key', H.invCount(j, 'viking_key'), 1);
    if (!World.getLoc(2624 + 12, 3648 + 15, 2, LocType.getId('viking_seer_trapdoor_open'))) clickLoc(j, 12, 15, 'viking_seer_trapdoor_closed', 1);
    clickLoc(j, 12, 15, 'viking_seer_trapdoor_open', 1);
    clickLoc(j, 12, 19, 'viking_seers_door2', 1);
    check("  out of the far door: Peer's vote, the house's things left behind", [bit(j, 5), at(j), H.invCount(j, 'viking_key')], [1, [12, 20, 0], 0]);

    // the other four are walked in fremtrials.ts (Swensen, Thorvald) and above (Olaf, Sigmund)
    setBits(j, 2, 3, 4, 27);
    t = talk(j, 'viking_brundt');
    check('all seven votes: Brundt ends the quest', H.getVar(j, 'viking'), 10);
    H.despawn(j);
}
console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
