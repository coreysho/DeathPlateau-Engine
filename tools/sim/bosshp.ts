// The health bar over a big boss, drawn the way the client draws it.
//
//   npx tsx tools/sim/bosshp.ts
//
// Client.java reads the bar's current and max with g1 - ONE BYTE EACH - and fills
// `current * 30 / max` pixels of thirty. Any npc with more than 255 hitpoints therefore wrapped on
// the wire: Zulrah's 500 went out as 244 and its current health as `hp & 255`, so the bar drained
// to empty as the snake was taken from 500 down to 256 and then sprang back to FULL the instant it
// crossed 255. Twice reported as "I drop it to zero, it heals to full and carries on", and both
// times the fight was right and the bar was lying.
//
// World.ts now scales the pair into a byte before handing it to rsbuf. This asserts the bar that
// results only ever goes down, for every npc in the game big enough to have been affected - and
// asserts the old arithmetic fails the same test, so the guard cannot quietly stop testing anything.
import * as H from './harness.ts';
import NpcType from '#/cache/config/NpcType.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';

await H.boot();
const HP = NpcStat.HITPOINTS;
let ok = 0, fail = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const good = JSON.stringify(got) === JSON.stringify(want);
    console.log(`  ${good ? 'ok  ' : 'FAIL'} ${what}${good ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
    good ? ok++ : fail++;
};

/** What World.ts sends now. */
function scaled(hp: number, hpMax: number): [number, number] {
    const barMax = hpMax > 255 ? 255 : hpMax;
    const barHp = hpMax > 255 ? Math.min(barMax, Math.ceil((hp * 255) / hpMax)) : hp;
    return [barHp, barMax];
}
/** What it used to send: the raw numbers, truncated to a byte by the protocol. */
const raw = (hp: number, hpMax: number): [number, number] => [hp & 0xff, hpMax & 0xff];

/** Client.java: `int var24 = field1143 * 30 / field1144; if (var24 > 30) var24 = 30;` */
function pixels([barHp, barMax]: [number, number]): number {
    if (barMax === 0) return 0;
    return Math.min(30, Math.trunc((barHp * 30) / barMax));
}

/** Walk an npc from full to dead and report how the bar behaved. */
function walk(hpMax: number, encode: (hp: number, hpMax: number) => [number, number]) {
    let prev = Infinity, rises = 0, worstRise = 0, emptyWhileAlive = 0;
    for (let hp = hpMax; hp >= 0; hp--) {
        const px = pixels(encode(hp, hpMax));
        if (px > prev) { rises++; worstRise = Math.max(worstRise, px - prev); }
        if (hp > 0 && px === 0) emptyWhileAlive++;
        prev = px;
    }
    return { rises, worstRise, emptyWhileAlive };
}

// Every npc big enough to have been hit by this.
const big: { name: string; hp: number }[] = [];
for (let id = 0; id < NpcType.count; id++) {
    const t = NpcType.get(id);
    if (!t || !t.debugname) continue;
    const hp = t.stats?.[HP] ?? 0;
    if (hp > 255) big.push({ name: t.debugname, hp });
}
big.sort((a, b) => b.hp - a.hp);
console.log(`NPCS WITH MORE THAN 255 HITPOINTS - every one of these had a lying health bar (${big.length})`);
for (const b of big) console.log(`  ${b.name.padEnd(28)} ${b.hp}`);

console.log('\nTHE BAR ONLY EVER GOES DOWN');
for (const b of big) {
    const r = walk(b.hp, scaled);
    check(`${b.name} (${b.hp} hp): the bar never refills on its own`, r.rises, 0);
}

console.log('\nAND THE OLD ARITHMETIC FAILS THE SAME TEST');
{
    // Zulrah is the one it was reported on, so it is the one spelled out.
    const z = NpcType.get(NpcType.getId('zulrah')).stats[HP];
    check('zulrah still has 500 hitpoints', z, 500);
    const before = walk(z, raw);
    check('  the old bar sprang back up as it crossed a multiple of 256', before.rises > 0, true);
    check('  and it sprang all the way to full', before.worstRise, 30);
    check('  500 went out as 244', raw(500, 500)[1], 244);
    check('  and at 256 hitpoints the bar read completely empty', pixels(raw(256, 500)), 0);
    check('  while at 255 - one hitpoint LOWER - it read full', pixels(raw(255, 500)), 30);
    const after = walk(z, scaled);
    check('  scaled, the same walk never rises', after.rises, 0);
    check('  half health draws half a bar', pixels(scaled(250, 500)), 15);
    check('  full health draws a full bar', pixels(scaled(500, 500)), 30);
    check('  and dead draws nothing', pixels(scaled(0, 500)), 0);
}

console.log('\nSMALL NPCS ARE UNTOUCHED');
{
    const g = NpcType.get(NpcType.getId('goblin')).stats[HP];
    check('a goblin is under 255, so its numbers go out unchanged', scaled(g, g), [g, g]);
    check('  and its bar is full at full health', pixels(scaled(g, g)), 30);
    check('  and empty at none', pixels(scaled(0, g)), 0);
}

console.log(`\n${ok + fail} checks: ${ok} ok, ${fail} FAILED`);
process.exit(0);
