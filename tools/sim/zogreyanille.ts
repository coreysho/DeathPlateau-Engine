// INCRIMINATING SITHIK INTS - the middle act of Zogre Flesh Eaters.
//
// The quest used to do this in four sentences: show Zavistic Rarve a prism and a dead man's
// backpack, and he hands you a potion that turns a man into an ogre. The cache kept seven bits on
// the zombie_ogre varp for the investigation that is supposed to happen in between, and nothing
// read one of them:
//
//   thzfe_innkeepermugshown, thzfe_innkeeperportraitshown, thzfe_shownnecrobook,
//   thzfe_shownhambook, thzfe_showntankard, thzfe_shownsignedportrait, thzfe_prismsold
//
// - along with sithiks_drawers, sithiks_cupboard and sithiks_wardrobe, three locs with Search in
// the bedroom that no script had ever opened, and zogre_cup_of_tea_sithix, "Looks like an innocent
// cup of tea", placed on no map square.
//
//   npx tsx tools/sim/zogreyanille.ts
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import NpcType from '#/cache/config/NpcType.js';
import VarBitType from '#/cache/config/VarBitType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToEntity, findPathToLoc } from '#/engine/GameMap.js';

await H.boot();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const vb = (p: Player, n: string) => H.getVarBit(p, n);

function settle(p: Player, picks: number[] = [], max = 200) {
    let idle = 0;
    for (let g = 0; g < max; g++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            idle = 0;
            const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
            const open = p.modalChat === -1 ? '' : Component.get(p.modalChat).comName ?? '';
            const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
            if (multi) {
                const pick = picks.shift();
                if (pick === undefined) throw new Error('unexpected menu: ' + names.join(','));
                const byName = names.find((n: string) => n === `${open}:com_${pick}`);
                H.choose(p, byName ?? names[pick]);
                continue;
            }
            p.executeScript(s, true, true);
            continue;
        }
        H.tick(1);
        if (!p.activeScript && !p.target && !p.delayed && p.queue.head() === null) {
            if (++idle >= 3) break;
        } else idle = 0;
    }
    if (picks.length) throw new Error('menus not reached: ' + picks.join(','));
    p.closeModal();
}

// the bedroom, off the map: the bed shell at 2591,3103 plane 1 and the three searchable locs
// around it, and the tea goes on the floor between the bed and the drawers
const BED: [number, number] = [2591, 3103];
// forceapproach 13 on all three: one side each, and it is the side the probe found
const FURNITURE: [string, number, number][] = [
    ['sithiks_drawers', 2593, 3103],
    ['sithiks_cupboard', 2593, 3104],
    ['sithiks_wardrobe', 2590, 3103]
];
const STAND: Record<string, [number, number]> = {
    sithiks_drawers: [2592, 3103],
    sithiks_cupboard: [2592, 3105],
    sithiks_wardrobe: [2590, 3104],
    zogre_sithik_bed_entity: [2592, 3104]
};
const TEA: [number, number] = [2592, 3103];

const p: any = H.makePlayer('zogreyan', BED[0] + 1, BED[1] + 1);
H.tick(1);
p.teleport(BED[0] + 1, BED[1] + 1, 1);
H.tick(1);
H.maxOut(p);
H.clearInv(p);
H.tick(2);
p.closeModal();

const heard = (fn: () => void): string => {
    const mark = H.mesgs.length;
    const faces = H.ifaces.length;
    fn();
    return H.ifaces.slice(faces).filter(i => i.kind === 'text' && i.text).map(i => i.text!)
        .concat(H.mesgs.slice(mark).map(m => m.text)).join(' ');
};
function slotOf(objName: string) {
    const id = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
    throw new Error('not carrying ' + objName);
}
const locAt = (name: string, x: number, z: number, lvl = 1) => {
    const loc = World.getLoc(x, z, lvl, LocType.getId(name));
    if (!loc) throw new Error(`no ${name} at ${x},${z}`);
    return loc;
};
const opLoc = (name: string, x: number, z: number, picks: number[] = []): string =>
    heard(() => {
        const loc = locAt(name, x, z);
        const [sx, sz] = STAND[name];
        p.teleport(sx, sz, 1);
        H.tick(1);
        p.clearPendingAction();
        p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length,
            loc.angle, loc.shape, LocType.get(loc.type).forceapproach));
        p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOC1);
        settle(p, picks);
    });
const useOnLoc = (obj: string, name: string, x: number, z: number, picks: number[] = []): string =>
    heard(() => {
        const loc = locAt(name, x, z);
        const [sx, sz] = STAND[name];
        p.teleport(sx, sz, 1);
        H.tick(1);
        p.clearPendingAction();
        p.lastUseItem = ObjType.getId(obj);
        p.lastUseSlot = slotOf(obj);
        p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length,
            loc.angle, loc.shape, LocType.get(loc.type).forceapproach));
        p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
        settle(p, picks);
    });
const npcNamed = (name: string): Npc => {
    const id = NpcType.getId(name);
    for (const n of World.npcs) if (n && n.isActive && n.type === id) return n as Npc;
    throw new Error(name + ' is not spawned');
};
const talkTo = (npc: Npc, picks: number[] = []): string =>
    heard(() => {
        p.teleport(npc.x + 1, npc.z, npc.level);
        H.tick(1);
        p.clearPendingAction();
        p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
        p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPC1);
        settle(p, picks);
    });
const useOnNpc = (obj: string, npc: Npc, picks: number[] = []): string =>
    heard(() => {
        p.teleport(npc.x + 1, npc.z, npc.level);
        H.tick(1);
        p.clearPendingAction();
        p.lastUseItem = ObjType.getId(obj);
        p.lastUseSlot = slotOf(obj);
        p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
        p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
        settle(p, picks);
    });

// ------------------------------------------------------------------ what was in the room
console.log('');
console.log('THREE LOCS IN HIS BEDROOM THAT NOTHING HAD EVER OPENED');
for (const [name, x, z] of FURNITURE) {
    const t = LocType.get(locAt(name, x, z).type);
    check(`${name} (${t.name}) is there, with Search`, (t.op ?? [])[0], 'Search');
}
H.setVarBit(p, 'zogre', 4);            // ^zogre_in_tomb: not told to prove anything yet
let said = opLoc('sithiks_drawers', 2593, 3103);
check('and they stay shut until Rarve has asked for proof',
    [H.invCount(p, 'papyrus'), said.includes('no business')], [0, true]);

H.setVarBit(p, 'zogre', 6);            // ^zogre_found_evidence
opLoc('sithiks_drawers', 2593, 3103);
check('the drawers: papyrus and charcoal',
    [H.invCount(p, 'papyrus'), H.invCount(p, 'charcoal')], [1, 1]);
opLoc('sithiks_drawers', 2593, 3103);
check('  and more papyrus, which the guide says you will need',
    [H.invCount(p, 'papyrus'), H.invCount(p, 'charcoal')], [2, 1]);
opLoc('sithiks_cupboard', 2593, 3104);
check('the cupboard: the book on portraiture, and the one underneath it',
    [H.invCount(p, 'zogre_portrait_book'), H.invCount(p, 'zogre_necrobook')], [1, 1]);
opLoc('sithiks_wardrobe', 2590, 3103);
check('the wardrobe, behind the coats: Humans Against Monsters', H.invCount(p, 'zogre_hambook'), 1);
said = opLoc('sithiks_wardrobe', 2590, 3103);
check('  and nothing else behind them', [H.invCount(p, 'zogre_hambook'), said.includes('Nothing else')], [1, true]);

// ------------------------------------------------------------------ showing him
console.log('');
console.log('MAKING HIM DENY THEM');
said = useOnLoc('zogre_necrobook', 'zogre_sithik_bed_entity', BED[0], BED[1]);
check('the necromancy book: that is not mine',
    [vb(p, 'thzfe_shownnecrobook'), said.includes('not mine')], [1, true]);
said = useOnLoc('zogre_hambook', 'zogre_sithik_bed_entity', BED[0], BED[1]);
check("the book of 'h.a.m': a man may read what he likes",
    [vb(p, 'thzfe_shownhambook'), said.includes('read what he likes')], [1, true]);
said = useOnLoc('zogre_portrait_book', 'zogre_sithik_bed_entity', BED[0], BED[1]);
check('and his own book on portraiture is the only honest thing in the room',
    said.includes('only honest thing'), true);

console.log('');
console.log('DRAWING HIM');
H.give(p, 'papyrus', 20);
const charcoal = slotOf('charcoal');
p.invDel(InvType.INV, ObjType.getId('charcoal'), 1, charcoal);
H.tick(1);
said = useOnLoc('papyrus', 'zogre_sithik_bed_entity', BED[0], BED[1]);
check('paper and nothing to draw with', said.includes('nothing to draw with'), true);
H.give(p, 'charcoal', 1);
// twenty sittings at a high Crafting level: both portraits exist, and the good one is the common
// one, which is what "20+ Crafting speeds it up" means
let good = 0;
let bad = 0;
for (let i = 0; i < 20; i++) {
    useOnLoc('papyrus', 'zogre_sithik_bed_entity', BED[0], BED[1]);
    if (H.invCount(p, 'zogre_sithik_portrait_good') > 0) {
        good++;
        break;
    }
    const n = H.invCount(p, 'zogre_sithik_portrait_bad');
    if (n > bad) {
        bad = n;
        p.invDel(InvType.INV, ObjType.getId('zogre_sithik_portrait_bad'), n, slotOf('zogre_sithik_portrait_bad'));
        H.tick(1);
        bad = 0;
    }
}
check('a sitting produces a portrait, and at 99 Crafting it is usually the good one', good, 1);
said = useOnLoc('zogre_sithik_portrait_good', 'zogre_sithik_bed_entity', BED[0], BED[1], [1]);
check('and he would rather it was honest than true', said.includes('Nobody has drawn me honestly'), true);

// ------------------------------------------------------------------ the innkeeper
console.log('');
console.log('THE INNKEEPER, WHO HAS BEEN SERVING HIM FOR A YEAR');
p.teleport(2556, 3081, 0);
H.tick(1);
const bartender = npcNamed('dragon_bartender');
H.give(p, 'zogre_dragon_tankard', 1);
said = useOnNpc('zogre_sithik_portrait_good', bartender);
check('he will not sign a drawing of a man nobody has asked him about',
    [vb(p, 'thzfe_innkeeperportraitshown'), said.includes('not been asked about')], [0, true]);
said = useOnNpc('zogre_dragon_tankard', bartender);
check('the tankard is one of his, and he names the man who took it',
    [vb(p, 'thzfe_innkeepermugshown'), said.includes('one of mine')], [1, true]);
if (vb(p, 'thzfe_innkeepermugshown') === 0) console.log('       heard: ' + JSON.stringify(said.slice(0, 300)));
said = useOnNpc('zogre_sithik_portrait_good', bartender);
check('then he signs the portrait',
    [H.invCount(p, 'zogre_sithik_portrait_signed'), H.invCount(p, 'zogre_sithik_portrait_good'),
        vb(p, 'thzfe_innkeeperportraitshown')], [1, 0, 1]);

// ------------------------------------------------------------------ Rarve
console.log('');
console.log('AND THE CASE, IN FRONT OF THE GUILD MASTER');
const rarve = npcNamed('zogre_human_zavistic_rarve');
// twenty sheets of papyrus later the inventory is full, and H.give drops what will not fit
H.clearInv(p);
H.tick(1);
for (const o of ['zogre_black_prism', 'zogre_brentle_vahn_backpack', 'zogre_necrobook',
                 'zogre_hambook', 'zogre_dragon_tankard', 'zogre_sithik_portrait_signed']) H.give(p, o, 1);
H.tick(1);
// the first time he sees the prism he has nothing else to go on: the four are set aside for it
const CASE = ['zogre_necrobook', 'zogre_hambook', 'zogre_dragon_tankard', 'zogre_sithik_portrait_signed'];
for (const o of CASE) p.invDel(InvType.INV, ObjType.getId(o), 1, slotOf(o));
H.tick(1);
said = talkTo(rarve);
check('a prism and a dead man is not a case: he asks for four things',
    [vb(p, 'thzfe_prismsold'), said.includes('guild master, not a mob'),
        H.invCount(p, 'zogre_ogre_trans_potion')], [1, true, 0]);
if (vb(p, 'thzfe_prismsold') === 0) console.log('       heard: ' + JSON.stringify(said.slice(0, 300)));
said = talkTo(rarve);
check('  and he will list what is still missing', said.includes('Four things'), true);
for (const o of CASE) H.give(p, o, 1);
H.tick(1);
const signed = H.invCount(p, 'zogre_sithik_portrait_signed');
said = talkTo(rarve);
check('with all four he hands over the strange potion',
    [H.invCount(p, 'zogre_ogre_trans_potion'), vb(p, 'thzfe_showntankard'),
        vb(p, 'thzfe_shownsignedportrait'), H.getVarBit(p, 'zogre'), signed], [1, 1, 1, 8, 1]);

// ------------------------------------------------------------------ the tea
console.log('');
console.log('THE CUP OF TEA HE HAS BEEN LETTING GO COLD');
p.teleport(BED[0] + 1, BED[1] + 1, 1);
H.tick(2);
const teaObj = () => World.getObj(TEA[0], TEA[1], 1, ObjType.getId('zogre_cup_of_tea_sithix'), p.hash64) ?? World.getObj(TEA[0], TEA[1], 1, ObjType.getId('zogre_cup_of_tea_sithix'), -1n);
check('the cup is on the floor of his bedroom now', teaObj() !== null, true);
said = useOnLoc('zogre_ogre_trans_potion', 'zogre_sithik_bed_entity', BED[0], BED[1]);
check('he will not drink it out of your hand',
    [H.invCount(p, 'zogre_ogre_trans_potion'), said.includes('cup of tea on the drawers')], [1, true]);
// NOT settle() here: the drink is on a hundred-tick queue and settle would sit through it, which
// is the one thing this step is about - he does not turn into an ogre while you are in the room.
said = heard(() => {
    p.teleport(TEA[0], TEA[1] + 1, 1);
    H.tick(1);
    const obj = teaObj()!;
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId('zogre_ogre_trans_potion');
    p.lastUseSlot = slotOf('zogre_ogre_trans_potion');
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, obj.x, obj.z, p.width, 1, 1));
    p.setInteraction(Interaction.ENGINE, obj, ServerTriggerType.APOBJU);
    H.tick(10);
    p.closeModal();
});
check('the potion goes into the tea',
    [H.invCount(p, 'zogre_ogre_trans_potion'), H.getVarBit(p, 'zogre'), said.includes('does not change colour')],
    [0, 9, true]);
check('  and Sithik is still a man while you are standing over it',
    [H.getVarBit(p, 'thzfe_sithik_transformed'), H.queued(p, '[queue,zogre_tea_drunk]').length], [0, 1]);
H.tick(110);                              // ^zogre_tea_wait, and he is alone
check('he drinks it when you are not watching',
    [H.getVarBit(p, 'thzfe_sithik_transformed'), teaObj()], [1, null]);

console.log('');
console.log('WHAT HE KNOWS');
said = opLoc('zogre_sithik_bed_entity', BED[0], BED[1]);
check('he confesses, and teaches the two things he knows: brutal arrows and the balm',
    [H.getVarBit(p, 'zogre'), vb(p, 'thzfe_makebrutalarrow'), vb(p, 'thzfe_makecuredisease'),
        vb(p, 'thzfe_makecompozogrebow')], [10, 1, 1, 0]);

console.log('');
console.log(`${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
