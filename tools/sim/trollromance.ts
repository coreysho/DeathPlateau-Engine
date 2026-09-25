// Troll Romance, start to finish against the real engine - run with `npx tsx tools/sim/trollromance.ts`.
//
//   start        Ug, then Aga (whose love-life talk could never be reached from the started stage),
//                Arrg, Ug again, Tenzing
//   sled         Dunstan's "Talk about a quest." dialogue from the OSRS transcript; a sled from yew
//                logs and one from maple logs; the wax; "Hello again."; a replacement after the quest
//   rides        both slopes: a real two-tiles-a-tick run in the sled's own animation, the jump and
//                "That was quite a ride!" on the top one, the crash into the rocks by the tunnel and
//                its lines on the bottom one, 25 Agility each; "Nothing interesting happens." at the
//                bottom of a slope
//   leaving      the tunnels and a teleport take the sled off, and lose it with a full pack
//   Arrg         both his melee and his thrown rock land, then he dies and the stage moves on
//   ending       Ug's reward (the gems, 8,000 Agility and 4,000 Strength, the scroll's lines) and the
//                journal at every stage; no Troll Romance loc, npc or obj op is a dead click
import * as H from './harness.ts';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import NpcType from '#/cache/config/NpcType.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import SeqType from '#/cache/config/SeqType.js';
import InvType from '#/cache/config/InvType.js';
import Component from '#/cache/config/Component.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();

let ok = 0, bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const truthy = (what: string, pass: boolean, got: unknown) => {
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}`);
};

// npc animations, which the harness only records for players
const npcAnims: { tick: number; npc: string; seq: string }[] = [];
const origNpcAnim = (Npc.prototype as any).playAnimation;
(Npc.prototype as any).playAnimation = function (seq: number, delay: number) {
    if (seq !== -1) npcAnims.push({ tick: World.currentTick, npc: NpcType.get(this.type).debugname ?? '', seq: SeqType.get(seq)?.debugname ?? String(seq) });
    return origNpcAnim.call(this, seq, delay);
};

const stage = (p: Player) => H.getVar(p, 'troll_love');
const comName = (id: number) => Component.get(id).comName ?? String(id);
const textsSince = (p: Player, from: number) => H.ifaces.slice(from).filter(i => i.who === p.username && i.kind === 'text').map(i => ({ com: comName(i.com), text: i.text ?? '' }));
/** Every line of dialogue (chatnpc/chatplayer/mesbox/objbox) set since `from`, joined. */
const chatSince = (p: Player, from: number) =>
    textsSince(p, from)
        .filter(t => !t.com.startsWith('multi') && !t.com.startsWith('questjournal') && !t.com.startsWith('questlist') && t.text.length > 3)
        .map(t => t.text)
        .join(' ')
        .replace(/\s+/g, ' ');

/** Click through whatever dialogue is open, choosing menu options by (part of) their text. */
function drain(p: Player, picks: string[] = []) {
    const want = [...picks];
    for (let guard = 0; guard < 400; guard++) {
        const s = p.activeScript;
        if (!s || s.execution !== ScriptState.PAUSEBUTTON) {
            if (!s && guard > 2) break;
            H.tick(1);
            continue;
        }
        const open = p.modalChat === -1 ? '' : comName(p.modalChat);
        if (open.startsWith('multi')) {
            const pick = want.shift();
            if (pick === undefined) throw new Error('unexpected menu: ' + menuOptions(p).join(' | '));
            const opts = menuOptions(p);
            const idx = opts.findIndex(o => o.includes(pick));
            if (idx === -1) throw new Error(`no option "${pick}" in: ${opts.join(' | ')}`);
            H.choose(p, `${open}:com_${idx + 1}`);
        } else {
            p.executeScript(s, true, true);
        }
    }
    H.tick(2);
    if (want.length) throw new Error('menus not reached: ' + want.join(','));
}
function menuOptions(p: Player): string[] {
    const open = comName(p.modalChat);
    const n = parseInt(open.replace('multi', ''));
    const out: string[] = [];
    for (let i = 1; i <= n; i++) {
        const id = Component.getId(`${open}:com_${i}`);
        const last = [...H.ifaces].reverse().find(x => x.who === p.username && x.kind === 'text' && x.com === id);
        out.push(last?.text ?? '');
    }
    return out;
}

function talkTo(p: Player, npc: Npc, picks: string[] = []): string {
    const from = H.ifaces.length;
    p.teleport(npc.x + npc.width, npc.z, npc.level);
    H.tick(1);
    H.opNpc(p, npc, 1);
    for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
    drain(p, picks);
    return chatSince(p, from);
}

function journal(p: Player): string {
    const from = H.ifaces.length;
    H.ifButton(p, 'questlist:troll_love');
    H.tick(1);
    return textsSince(p, from)
        .filter(t => t.com.startsWith('questjournal'))
        .map(t => t.text)
        .join('|');
}

function useOn(p: Player, used: string, on: string) {
    const inv = p.getInventory(InvType.INV)!;
    const slot = (name: string) => {
        const id = ObjType.getId(name);
        for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
        throw new Error('not carrying ' + name);
    };
    p.lastUseItem = ObjType.getId(used);
    p.lastUseSlot = slot(used);
    p.lastItem = ObjType.getId(on);
    p.lastSlot = slot(on);
    // OpHeldUHandler: [opheldu,<target>] first, else [opheldu,<used>] with the two swapped
    let script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, p.lastItem, -1);
    if (!script) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, p.lastUseItem, -1);
        [p.lastItem, p.lastUseItem] = [p.lastUseItem, p.lastItem];
        [p.lastSlot, p.lastUseSlot] = [p.lastUseSlot, p.lastSlot];
    }
    if (!script) throw new Error(`no opheldu for ${used} on ${on}`);
    p.executeScript(ScriptRunner.init(script, p), true);
    H.tick(2);
}

const worn = (p: Player, name: string) => {
    const w = p.getInventory(InvType.WORN)!;
    for (let i = 0; i < w.capacity; i++) if (w.get(i)?.id === ObjType.getId(name)) return true;
    return false;
};
const xp = (p: Player, stat: number) => Math.floor(p.stats[stat] / 10);
const abs = (level: number, mx: number, mz: number, lx: number, lz: number) => [mx * 64 + lx, mz * 64 + lz, level];

/** Click a slope and follow the ride: where the rider is each tick and whether it ran. */
function ride(p: Player, x: number, z: number) {
    p.teleport(x, z + 1, 0);
    H.tick(2);
    const path: string[] = [];
    const steps: number[] = [];
    H.opLoc(p, x, z, 'trollromance_piste_walk_barrier_down', 1);
    let lx = p.x, lz = p.z;
    for (let t = 0; t < 60; t++) {
        H.tick(1);
        if (p.x !== lx || p.z !== lz) {
            path.push(`${p.x},${p.z}`);
            steps.push(Math.max(Math.abs(p.x - lx), Math.abs(p.z - lz)));
        }
        lx = p.x;
        lz = p.z;
        if (!p.delayed && !p.activeScript) break;
        if (p.activeScript && p.activeScript.execution === ScriptState.PAUSEBUTTON) break;
    }
    // the first move is the teleport onto the slope, the last the drop past the bottom slope
    const legs = steps.slice(1, -1);
    return { path, legs: legs.length, runs: legs.filter(d => d === 2).length };
}

function fresh(name: string): Player {
    const p = H.makePlayer(name, 2919, 3576);
    H.tick(2);
    H.maxOut(p);
    p.setLevel(PlayerStat.AGILITY, 50);
    H.clearInv(p);
    H.setVar(p, 'death_equiproom', 80);
    H.setVar(p, 'troll_quest', 50);
    return p;
}

// =============================================================================================
console.log('START');
const p = fresh('trollrom');
const ug = H.npcNear('trollromance_ug', 2827, 10064, 1)!;
const aga = H.npcNear('trollromance_aga', 2828, 10104, 1)!;
const arrg = H.npcNear('trollromance_arrg', 2828, 10095, 1)!;
truthy('Ug, Aga and Arrg are in the Stronghold', !!(ug && aga && arrg), [ug?.x, aga?.x, arrg?.x]);
let j = journal(p);
truthy('journal (not started): speak to Ug, the requirements', j.includes('speaking to @dre@Ug') && j.includes('Level 28 Agility'), j.slice(0, 80));

let said = talkTo(p, ug, ['Awww, you poor troll', "Don't worry now"]);
check('Ug: offering help starts the quest', stage(p), 5);
truthy('  "You help Ug? You nice, maybe Ug not eat you!"', said.includes('maybe Ug not eat you'), said.slice(-120));
j = journal(p);
truthy('journal: I should speak to Aga', j.includes('I should speak to @dre@Aga'), j);

said = talkTo(p, aga, ['love life', "I've got to go"]);
check('Aga: her love life - she wants Trollweiss (this talk was unreachable before)', stage(p), 10);
truthy('  "He say he will show he love by bringing me flower Trollweiss."', said.includes('flower Trollweiss'), said.slice(0, 160));
said = talkTo(p, aga, ['what do you think about Ug']);
truthy('Aga again: "Aga can\'t wait for Trollweiss."', said.includes("Aga can't wait for Trollweiss") && said.includes('Who?'), said);
said = talkTo(p, arrg, ['Your girlfriend said']);
truthy('Arrg: "I no know, I just say to make Aga shut up!"', said.includes('make Aga shut up'), said.slice(-120));
check('  Arrg changes nothing', stage(p), 10);
said = talkTo(p, ug);
truthy('Ug again: "need someone who live whole life in mountains"', said.includes('live whole life in mountains'), said.slice(-100));
j = journal(p);
truthy('journal: ask someone about Trollweiss', j.includes('ask someone about @dre@Trollweiss'), j.slice(-120));

const tenzing = H.npcNear('death_sherpa', 2820, 3556, 0)!;
said = talkTo(p, tenzing, ['Trollweiss', 'What would I need']);
check('Tenzing: "Why don\'t you ask Dunstan."', stage(p), 15);
j = journal(p);
truthy('journal: talk to Dunstan about the sled', j.includes('talk to @dre@Dunstan@dbl@ about the sled'), j.slice(-80));

// =============================================================================================
console.log('SLED (yew)');
const dunstan = H.npcNear('death_smithy', 2919, 3574, 0)!;
said = talkTo(p, dunstan, ['Talk about a quest', 'I need a sled!!', 'No.']);
check('Dunstan: "I need a sled!!" - the materials', stage(p), 20);
for (const line of ["Aren't you a bit old for rolling around in the snow?", 'Hahahaha.', 'some of us never grow up', "since you've helped my family out", 'yew or maple logs, a bar of iron and some rope', 'designs ready']) {
    truthy(`  "${line}"`, said.includes(line), '');
}
said = talkTo(p, dunstan, ['Talk about a quest', 'Nothing, thanks.']);
truthy('without the materials: "I can\'t make the sled without all the materials." and his menu', said.includes("can't make the sled without all the materials"), said);
j = journal(p);
truthy('journal: yew or maple logs, an iron bar and rope', j.includes('@dre@yew@dbl@ or @dre@maple logs'), j.slice(-120));
H.give(p, 'yew_logs');
H.give(p, 'iron_bar');
H.give(p, 'rope');
said = talkTo(p, dunstan, ['Talk about a quest', 'Where can I get wax', 'Where can I get swamp tar', 'What else', 'See you!']);
check('with them: a sled', [stage(p), H.invCount(p, 'trollromance_toboggon'), H.invCount(p, 'yew_logs'), H.invCount(p, 'iron_bar'), H.invCount(p, 'rope')], [22, 1, 0, 0, 0]);
for (const line of ['starts making a sled', 'it will need to be waxed', 'like a cake tin', 'look for some bees', "south of Lumbridge", 'cake tin to store the wax in', 'Thank you, come again.']) {
    truthy(`  "${line}"`, said.includes(line), '');
}
said = talkTo(p, dunstan, ['Talk about a quest', 'See you!']);
truthy('before waxing: "Hello again." and See you! at once', said.includes('Hello again.'), said);
said = talkTo(p, dunstan, ['Talk about something else', 'Nothing, thanks.']);
truthy('"Talk about something else." is his usual menu', said.includes('Nothing, thanks.'), said);
j = journal(p);
truthy('journal: gave them to Dunstan, now the wax', j.includes('gave them to Dunstan who made a sled') && j.includes('@dre@wax@dbl@, @dre@swamp tar'), j.slice(-160));

H.give(p, 'bucket_wax');
H.give(p, 'swamp_tar');
H.give(p, 'cake_tin');
useOn(p, 'swamp_tar', 'bucket_wax');
check('swamp tar on the wax: sled wax in the cake tin', [H.invCount(p, 'trollromance_wax'), H.invCount(p, 'bucket_wax'), H.invCount(p, 'cake_tin')], [1, 0, 0]);
useOn(p, 'trollromance_wax', 'trollromance_toboggon');
check('the wax on the sled: a waxed sled, the tin back', [stage(p), H.invCount(p, 'trollromance_toboggon_waxed'), H.invCount(p, 'cake_tin')], [25, 1, 1]);
j = journal(p);
truthy('journal: get the Trollweiss from the plateau', j.includes('get the @dre@Trollweiss'), j.slice(-120));

console.log('SLED (maple)');
const q = fresh('trollmap');
H.setVar(q, 'troll_love', 15);
said = talkTo(q, dunstan, ['Talk about a quest', 'I need a sled!!', 'Yes.']);
truthy('"Yes." (too old for the snow): "So why do you need a sled then?" and on to the materials', stage(q) === 20 && said.includes('So why do you need a sled then?') && said.includes('Let me think...'), said.slice(0, 200));
H.give(q, 'maple_logs');
H.give(q, 'iron_bar');
H.give(q, 'rope');
talkTo(q, dunstan, ['Talk about a quest', 'What else', 'See you']);
check('maple logs make the same sled', [stage(q), H.invCount(q, 'trollromance_toboggon'), H.invCount(q, 'maple_logs')], [22, 1, 0]);
j = journal(q);
truthy('  journal: "yew or maple logs" either way', j.includes('I got some yew or maple logs'), j.slice(-160));

// =============================================================================================
console.log('THE TOP SLOPE');
const agi0 = xp(p, PlayerStat.AGILITY);
p.teleport(2772, 3836, 0);
H.tick(1);
H.opLoc(p, 2772, 3835, 'trollromance_piste_walk_barrier_down', 1);
H.tick(3);
drain(p);
truthy('without the sled worn: "You need to have a waxed sled equipped!"', H.mesgs.some(m => m.who === p.username && m.text === 'You need to have a waxed sled equipped!'), '');
H.opheld(p, 'trollromance_toboggon_waxed', 2);
H.tick(1);
truthy('Ride puts the sled on', worn(p, 'trollromance_toboggon_waxed'), '');
let s0 = H.says.length;
let r = ride(p, 2772, 3835);
console.log('    path', r.path.join(' '));
check('it ends in the clearing, 0_43_59_38_18', [p.x, p.z], abs(0, 43, 59, 38, 18).slice(0, 2));
truthy('every leg of the ride a two-tile run (a real run, not a teleport a tick)', r.legs >= 15 && r.runs === r.legs, { legs: r.legs, runs: r.runs });
check('  said on the way', H.says.slice(s0).filter(s => s.who === p.username).map(s => s.text), ['Here we go!', 'That was quite a ride!']);
check('  25 Agility', xp(p, PlayerStat.AGILITY) - agi0, 25);
truthy('  sounds: start, loop, jump, stop', ['sled_start', 'sled_loop', 'sled_jump', 'sled_stop'].every(n => H.soundsFor(p.username).some(s => s.synth === n)), '');

// the Trollweiss, with no room and with
const [fx, fz] = abs(0, 43, 59, 25, 8);
H.fillInv(p);
p.teleport(fx + 1, fz, 0);
H.tick(1);
let from = H.ifaces.length;
H.opLoc(p, fx, fz, 'trollromance_rareflowers', 2);
H.tick(3);
said = chatSince(p, from);
drain(p);
truthy('Pick with a full pack: "I know it\'s only a flower..."', said.includes("I know it's only a flower"), said);
H.clearInv(p);
H.give(p, 'cake_tin');
H.opLoc(p, fx, fz, 'trollromance_rareflowers', 2);
H.tick(4);
check('Pick: a Trollweiss', [stage(p), H.invCount(p, 'trollromance_rare_flower')], [30, 1]);
j = journal(p);
truthy('journal: give the Trollweiss to Ug', j.includes('give the @dre@Trollweiss@dbl@ to @dre@Ug'), j.slice(-80));

console.log('THE BOTTOM SLOPE');
const [ux, uz] = abs(0, 43, 58, 42, 18);
p.teleport(ux + 1, uz, 0);
H.tick(1);
H.opLoc(p, ux, uz, 'trollromance_piste_walk_barrier_up', 1);
H.tick(3);
truthy('slide at the bottom of a slope: "Nothing interesting happens."', H.mesgs.some(m => m.who === p.username && m.text === 'Nothing interesting happens.'), '');
const agi1 = xp(p, PlayerStat.AGILITY);
s0 = H.says.length;
const a0 = H.anims.length;
from = H.ifaces.length;
const [dx, dz] = abs(0, 43, 58, 33, 59);
r = ride(p, dx, dz);
console.log('    path', r.path.join(' '));
check('it ends in the rocks above the tunnel, 0_43_58_41_13', [p.x, p.z], abs(0, 43, 58, 41, 13).slice(0, 2));
truthy('a two-tile run all the way to the crash', r.legs >= 20 && r.runs === r.legs, { legs: r.legs, runs: r.runs });
check('  down the chute to its end before the crash', r.path.slice(-2, -1), [abs(0, 43, 58, 41, 17).slice(0, 2).join(',')]);
check('  said on the way', H.says.slice(s0).filter(s => s.who === p.username).map(s => s.text), ['Here we go!', "O-oh, this doesn't look good!"]);
const crashAnims = H.anims.slice(a0).filter(a => a.who === p.username).map(a => SeqType.get(a.seq).debugname);
check('  the crash and getting up are seen (the sled pose lets them through)', [crashAnims.includes('trollromance_toboggan_crashing'), crashAnims.includes('trollromance_toboggan_getup'), (p as any).animProtect], [true, true, 1]);
drain(p);
said = chatSince(p, from);
truthy('  "And I thought snow was soft..." / "...softer than the rock I hit."', said.includes('And I thought snow was soft...') && said.includes('softer than the rock I hit'), said);
check('  25 Agility', xp(p, PlayerStat.AGILITY) - agi1, 25);
truthy('  sledcrash sound', H.soundsFor(p.username).some(s => s.synth === 'sledcrash'), '');

console.log('LEAVING WITH THE SLED');
const [tx, tz] = abs(0, 43, 58, 43, 5);
H.fillInv(p);
p.teleport(tx, tz + 2, 0);
H.tick(1);
H.opLoc(p, tx, tz, 'trollromance_piste_exit_tunnel_exit', 1);
H.tick(4);
check('the tunnel out with a full pack: the sled is lost, not worn out of the mountain', [worn(p, 'trollromance_toboggon_waxed'), p.x, p.z], [false, ...abs(0, 43, 158, 47, 22).slice(0, 2)]);
H.clearInv(p);
H.give(p, 'trollromance_rare_flower');
H.give(p, 'trollromance_toboggon_waxed');
p.teleport(2779, 3866, 0);
H.tick(1);
H.opheld(p, 'trollromance_toboggon_waxed', 2);
H.tick(1);
H.opLoc(p, 2779, 3868, 'trollromance_piste_top', 1);
H.tick(6);
check('the tunnel at the top with room: the sled comes off into the pack', [worn(p, 'trollromance_toboggon_waxed'), H.invCount(p, 'trollromance_toboggon_waxed')], [false, 1]);
p.teleport(2779, 3866, 0);
H.tick(1);
H.opheld(p, 'trollromance_toboggon_waxed', 2);
H.tick(1);
const tele = ScriptProvider.getByName('[proc,player_teleport_normal]')!;
p.executeScript(ScriptRunner.init(tele, p, null, [CoordGrid.packCoord(0, 2893, 3678)]), true);
H.tick(6);
check('a teleport with room: lands, sled in the pack', [p.x, p.z, worn(p, 'trollromance_toboggon_waxed'), H.invCount(p, 'trollromance_toboggon_waxed')], [2893, 3678, false, 1]);
p.teleport(2779, 3866, 0);
H.tick(1);
H.opheld(p, 'trollromance_toboggon_waxed', 2);
H.tick(1);
H.fillInv(p);
p.executeScript(ScriptRunner.init(tele, p, null, [CoordGrid.packCoord(0, 2893, 3678)]), true);
H.tick(6);
check('a teleport with a full pack: the sled is lost', [worn(p, 'trollromance_toboggon_waxed'), H.invCount(p, 'trollromance_toboggon_waxed')], [false, 0]);
H.clearInv(p);
H.give(p, 'trollromance_rare_flower');

// =============================================================================================
console.log('ARRG');
said = talkTo(p, ug);
check('Ug takes the Trollweiss: get rid of Arrg', [stage(p), H.invCount(p, 'trollromance_rare_flower')], [35, 0]);
truthy('  "Ug puny, you strong."', said.includes('Ug puny, you strong.'), said.slice(-120));
said = talkTo(p, ug);
truthy('Ug before the fight: "You defeat Arrg yet?"', said.includes('careful planning'), said);
j = journal(p);
truthy('journal: I have to defeat Arrg', j.includes('I have to defeat @dre@Arrg'), j.slice(-60));

// Arrg lands both his attacks: stand in the arena on 99 Hitpoints and 1 Defence and take it.
p.setLevel(PlayerStat.DEFENCE, 1);
p.setLevel(PlayerStat.HITPOINTS, 99);
const n0 = npcAnims.length, h0 = H.hits.length;
talkTo(p, arrg, ['I am here to kill you!']);
const inArena = Math.abs(p.x - 2914) < 20 && Math.abs(p.z - 3611) < 20;
truthy('"let\'s take it outside": off to the arena', inArena, [p.x, p.z, p.level]);
const foe = H.npcNear('trollromance_arrg_attackable', p.x, p.z, 0);
truthy('  Arrg is there', !!foe, foe && [foe.x, foe.z]);
for (let t = 0; t < 120; t++) {
    H.tick(1);
    if (p.levels[PlayerStat.HITPOINTS] < 60) p.levels[PlayerStat.HITPOINTS] = 99;
    // stand still: the auto-retaliate would take the fight to him
    p.clearInteraction?.();
}
const arrgAnims = npcAnims.slice(n0).filter(a => a.npc === 'trollromance_arrg_attackable');
const melee = arrgAnims.filter(a => a.seq === 'troll_attack').map(a => a.tick);
const thrown = arrgAnims.filter(a => a.seq === 'troll_rock_throw').map(a => a.tick);
const myHits = H.hits.slice(h0).filter(h => h.who === p.username);
// a swing lands the tick after its animation, a rock a tick or two later
const landedAfter = (ticks: number[], lo: number, hi: number) => ticks.filter(t => myHits.some(h => h.damage > 0 && h.tick >= t + lo && h.tick <= t + hi)).length;
console.log(`    ${melee.length} swings, ${thrown.length} rocks, ${myHits.length} hits, biggest ${Math.max(...myHits.map(h => h.damage))}`);
truthy('he swings in melee, and it lands', melee.length > 0 && landedAfter(melee, 0, 1) > 0, [melee.length, landedAfter(melee, 0, 1)]);
truthy('he throws rocks, and they land', thrown.length > 0 && landedAfter(thrown, 1, 3) > 0, [thrown.length, landedAfter(thrown, 1, 3)]);
truthy('  the rock is the thrower trolls\' (sound troll_with_rock_attack)', H.soundsFor(p.username).some(s => s.synth === 'troll_with_rock_attack'), '');
truthy('  no hit over his max of 38', myHits.every(h => h.damage <= 38), Math.max(...myHits.map(h => h.damage)));
// and he dies
if (foe) {
    foe.levels[3] = 1;
    H.attackNpc(p, foe);
    for (let t = 0; t < 30 && foe.isActive && stage(p) !== 40; t++) {
        H.tick(1);
        if (!p.target && foe.isActive) H.attackNpc(p, foe);
    }
    H.tick(4);
}
check('Arrg dies: defeated', stage(p), 40);
j = journal(p);
truthy('journal: I should talk to Ug to get my reward', j.includes('I have defeated Arrg') && j.includes('talk to @dre@Ug@dbl@ to get my reward'), j.slice(-80));
said = talkTo(p, arrg);
truthy('Arrg afterwards: "Oh mighty man-warrior, please no hurt Arrg."', said.includes('please no hurt Arrg'), said);

// =============================================================================================
console.log('ENDING');
H.clearInv(p);
const agi2 = xp(p, PlayerStat.AGILITY), str2 = xp(p, PlayerStat.STRENGTH);
from = H.ifaces.length;
said = talkTo(p, ug);
check('Ug: quest complete', stage(p), 45);
truthy('  "Ug go to Aga now."', said.includes('Ug go to Aga now.'), said.slice(-80));
check('  the gems: 1 diamond, 2 rubies, 4 emeralds', [H.invCount(p, 'uncut_diamond'), H.invCount(p, 'uncut_ruby'), H.invCount(p, 'uncut_emerald')], [1, 2, 4]);
check('  8,000 Agility and 4,000 Strength', [xp(p, PlayerStat.AGILITY) - agi2, xp(p, PlayerStat.STRENGTH) - str2], [8000, 4000]);
const scroll = textsSince(p, from).filter(t => t.com.startsWith('inter_238')).map(t => t.text);
check('  the scroll', scroll.filter(t => t.length > 0), ['You have completed the\\nTroll Romance Quest!', '2 Quest Points', '8,000 Agility XP', '4,000 Strength XP', '7 Uncut Gems']);
j = journal(p);
truthy('journal: Ug finally found the courage... QUEST COMPLETE!', j.includes('Ug finally found the courage') && j.includes('QUEST COMPLETE!'), j.slice(-140));
said = talkTo(p, ug);
truthy('Ug afterwards: "I so happy I can\'t stop crying!"', said.includes("can't stop crying"), said.slice(-60));
said = talkTo(p, aga);
truthy('Aga afterwards', said.includes('Aga so in love with Ug'), said);
H.give(p, 'maple_logs');
H.give(p, 'iron_bar');
H.give(p, 'rope');
said = talkTo(p, dunstan, ['Talk about a quest', 'Can you make me another sled?', 'What else', 'See you']);
check('Dunstan after: "our very own sledder!" and another sled', [said.includes('our very own sledder'), H.invCount(p, 'trollromance_toboggon')], [true, 1]);
said = talkTo(p, dunstan, ['Talk about a quest', 'sled wax again', 'What else', 'See you!']);
truthy('  "What do I need for the sled wax again?"', said.includes('You will need some wax and some swamp tar.'), said);

// =============================================================================================
console.log('NO DEAD CLICKS');
const dead: string[] = [];
// trollromance_piste_tunnel_top is in no map square, and trollromance_eat_test (Ug eating, "unused"
// in the OSRS wiki's trivia) is spawned nowhere, so neither can be clicked
const unplaced = ['trollromance_piste_tunnel_top', 'trollromance_eat_test'];
for (const [name, id] of LocType.configNames) {
    if (!/troll_?romance/.test(name) || unplaced.includes(name)) continue;
    const t = LocType.get(id);
    t.op?.forEach((op: string | null, i: number) => {
        if (op && op !== 'hidden' && !ScriptProvider.getByTrigger(ServerTriggerType.OPLOC1 + i, id, t.category) && !ScriptProvider.getByTrigger(ServerTriggerType.APLOC1 + i, id, t.category)) dead.push(`loc ${name} op${i + 1} ${op}`);
    });
}
for (const [name, id] of NpcType.configNames) {
    if (!name.startsWith('trollromance') || unplaced.includes(name)) continue;
    const t = NpcType.get(id);
    t.op?.forEach((op: string | null, i: number) => {
        if (op && op !== 'Attack' && !ScriptProvider.getByTrigger(ServerTriggerType.OPNPC1 + i, id, t.category) && !ScriptProvider.getByTrigger(ServerTriggerType.APNPC1 + i, id, t.category)) dead.push(`npc ${name} op${i + 1} ${op}`);
    });
}
for (const [name, id] of ObjType.configNames) {
    if (!name.startsWith('trollromance')) continue;
    const t = ObjType.get(id);
    t.iop?.forEach((op: string | null, i: number) => {
        if (op && op !== 'Drop' && op !== 'Wield' && op !== 'Wear' && !ScriptProvider.getByTrigger(ServerTriggerType.OPHELD1 + i, id, t.category)) dead.push(`obj ${name} iop${i + 1} ${op}`);
    });
}
check('every Troll Romance loc, npc and obj op has a script', dead, []);

console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
