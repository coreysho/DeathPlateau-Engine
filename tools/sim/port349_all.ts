// The ten PlagueCityRS 349 ports together: what no single port's sim covers. Every quest's
// migration runs from one [login,_] (a fresh player comes out with all eight bits set and nothing
// else touched), Mort Myre's swamp decay now that its map squares call it, and Diango, whose
// greeting came from one port and whose yo-yo menu came from another, and the music tab's LOOP
// button, which had no handler until 349's looping came over.
// Usage: npx tsx tools/sim/port349_all.ts
import * as H from './harness.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';

const errors: string[] = [];
const origErr = console.error;
console.error = (...a: unknown[]) => {
    const s = a.map(String).join(' ');
    if (/script error/i.test(s)) errors.push(s);
    origErr(...a);
};

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
let bucket = 1;

function drive(p: Player, picks: number[] = [], guardTicks = 3): string[] {
    const from = H.ifaces.length;
    let idle = 0;
    for (let guard = 0; guard < 800 && idle < guardTicks; guard++) {
        const s = p.activeScript;
        if (!s || s.execution !== ScriptState.PAUSEBUTTON) {
            // a queued script waits while a main modal is up (the quest scroll), so that counts as idle
            if (!s && !p.delayed && ([...p.queue.all()].length === 0 || p.modalMain !== -1) && !p.target) idle++;
            else idle = 0;
            H.tick(1);
            continue;
        }
        idle = 0;
        const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
        const open = p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? '');
        const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
        if (open === 'multiobj2') {
            const pick = picks.shift();
            if (pick === undefined) throw new Error('unexpected menu: ' + open);
            H.choose(p, `multiobj2:obj${pick}`);
        } else if (multi) {
            const pick = picks.shift();
            if (pick === undefined) throw new Error('unexpected menu: ' + open);
            H.choose(p, `${multi.split(':')[0]}:com_${pick}`);
        } else {
            p.executeScript(s, true, true);
        }
    }
    if (picks.length) throw new Error('menus not reached: ' + picks.join(','));
    return H.ifaces
        .slice(from)
        .filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1)
        .map(i => i.text!);
}
function npcAny(name: string, x: number, z: number, level: number): Npc | null {
    return [level, 0, 1, 2, 3].map(l => H.npcNear(name, x, z, l)).find(n => n) ?? null;
}
function settle(p: Player) {
    for (let t = 0; t < 30 && (p.delayed || p.activeScript); t++) H.tick(1);
}
function talk(p: Player, npcName: string, picks: number[] = [], op = 1): string[] {
    const npc = npcAny(npcName, p.x, p.z, p.level);
    if (!npc) throw new Error('no npc ' + npcName);
    settle(p);
    for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, -1],
        [2, 0],
        [0, 2],
        [-2, 0],
        [0, -2],
        [3, 0],
        [0, 3]
    ]) {
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, op);
        for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    return drive(p, picks);
}
function timerOf(p: Player, name: string) {
    const s = ScriptProvider.getByName(name);
    if (!s) throw new Error('no script ' + name);
    return p.timers.get(s.id);
}

// ============================================================================================
console.log('LOGIN  every ported quest migrates once');
const QUESTS = ['mm', 'tbwt', 'routequest', 'mortton', 'eadgar', 'horror', 'regicide', 'viking'];
// horrorquest is a varbit (on deephorror); the rest are varps
const QUEST_VARPS = ['mm_main', 'tbwt_main', 'routequest', 'morttonquest', 'eadgar_quest', 'horrorquest', 'regicide_quest', 'viking'];
{
    const p = H.makePlayer('fresh', 3222, 3222, bucket++);
    H.tick(1);
    drive(p);
    check(
        'a fresh player: all eight quests marked migrated',
        QUESTS.map(q => H.getVarBit(p, 'port349_' + q)),
        QUESTS.map(() => 1)
    );
    check(
        '  and every quest is still not started',
        QUEST_VARPS.map(v => (v === 'horrorquest' ? H.getVarBit(p, v) : H.getVar(p, v))),
        QUEST_VARPS.map(() => 0)
    );
    check('  no script errors at login', errors, []);
}

// ============================================================================================
console.log('MORT MYRE  swamp decay');
{
    const e0 = errors.length;
    const p = H.makePlayer('swamp', 3420, 3420, bucket++); // 0_53_53, well away from Filliman's camp
    H.tick(1);
    drive(p);
    H.maxOut(p);
    H.clearInv(p);
    // a sim player is not a NetworkPlayer, which is what fires [mapzone] on movement
    p.triggerMapzone(p.x, p.z);
    H.tick(1);
    check('walking into the swamp starts the decay timer', [H.getVar(p, 'mortmyre'), !!timerOf(p, '[timer,swamp_decay]')], [1, true]);
    const h0 = H.hits.length;
    H.tick(205);
    const hurt = H.hits.slice(h0).filter(h => h.who === p.username);
    check('200 ticks in, the swamp decays you for 1-3', hurt.length === 1 && hurt[0].damage >= 1 && hurt[0].damage <= 3, true);
    H.give(p, 'silver_sickle_blessed');
    const h1 = H.hits.length;
    H.tick(205);
    check('a blessed sickle keeps it off', H.hits.slice(h1).filter(h => h.who === p.username).length, 0);
    p.teleport(3222, 3222, 0);
    H.tick(205);
    check('leaving the swamp ends it', [H.getVar(p, 'mortmyre'), !!timerOf(p, '[timer,swamp_decay]')], [0, false]);
    check('  no script errors', errors.slice(e0), []);
}

// ============================================================================================
console.log('DRAYNOR  Diango');
{
    const e0 = errors.length;
    const p = H.makePlayer('diango', 3082, 3250, bucket++);
    H.tick(1);
    drive(p);
    // talk() collects from when it starts driving, after the first line is already up, so read
    // everything this player was shown from before the click
    const i0 = H.ifaces.length;
    talk(p, 'aprilfoolshorsesalesman', [2]);
    const said = H.ifaces
        .slice(i0)
        .filter(i => i.who === p.username && i.kind === 'text' && i.text)
        .map(i => i.text!);
    check('his sourced greeting, then the horseys', [said.some(t => /Howdy there partner/.test(t)), said.some(t => /Hi Diango/.test(t)), said.some(t => /toy horseys/.test(t))], [true, true, true]);
    H.setVar(p, 'xmas_yoyo_unlocked', 1);
    const said2 = talk(p, 'aprilfoolshorsesalesman', [3]);
    check('with a yo-yo from Santa he offers it back, and gives it', [said2.some(t => /yo-yo back/.test(t)), H.invCount(p, 'xmas_yoyo')], [true, 1]);
    check('  no script errors', errors.slice(e0), []);
}

// ============================================================================================
console.log('MUSIC  the LOOP button');
{
    const e0 = errors.length;
    const p = H.makePlayer('looper', 3222, 3222, bucket++);
    H.tick(1);
    drive(p);
    H.setVar(p, 'musicplay', 1);
    // Lumbridge's own music trigger, as walking in would fire it
    p.triggerMapzone(p.x, p.z);
    H.tick(1);
    const song = H.getVar(p, 'currentsong');
    const len = H.getVar(p, 'musiclength');
    check('a song playing knows its length from the cache', [song >= 0, len > 0], [true, true]);
    const m0 = H.mesgs.length;
    H.ifButton(p, 'music:com_251');
    H.tick(1);
    check('LOOP on', [H.getVar(p, 'musicloop'), H.mesgs.slice(m0).some(m => m.who === p.username && /looping now enabled/.test(m.text))], [1, true]);
    // make the song have ended: the timer starts it again
    H.setVar(p, 'musicstart', 0);
    H.setVar(p, 'musiclength', 1);
    H.tick(3);
    check('the song ending starts it again', [H.getVar(p, 'currentsong'), H.getVar(p, 'musicstart') > 1, H.getVar(p, 'musiclength')], [song, true, len]);
    H.ifButton(p, 'music:com_251');
    H.tick(1);
    H.setVar(p, 'musicstart', 0);
    H.setVar(p, 'musiclength', 1);
    H.tick(3);
    check('LOOP off: an ended song stays ended', [H.getVar(p, 'musicloop'), H.getVar(p, 'musicstart')], [0, 0]);
    check('  no script errors', errors.slice(e0), []);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
