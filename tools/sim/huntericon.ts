// Aleck's Hunter Emporium has a minimap icon.
// Usage: npx tsx tools/sim/huntericon.ts   (exit code is the verdict)
//
// WHAT THIS IS FOR, and what it cannot see. A map icon is three numbers that have to agree: the
// slot on content/sprites/mapfunction.png, the mapfunction= on the loc, and the count Client.java
// loops over when it loads them. This file owns the middle one and the placement; the sprite and
// the loop belong to the client, and javaclient/tools/clienttests/run_mapicontest.py owns those.
//
// THE PLACEMENT IS READ OUT OF THE jm2, NOT OUT OF THE WORLD, and that is not laziness. An icon
// loc has no ops, so LocType.active is false, so GameMap never puts it in a zone - the server
// genuinely does not know it exists, and locsNamed answers [] for the trading post's icon too.
// What can go wrong is the three-way agreement between the name, the packed id in pack/loc.pack
// and the number written into the map, and reading the map line back is what tests that. An icon
// loc is invisible - model minigame_start_icon, forcedecor - so a wrong id or a missing line looks
// from the minimap exactly like a missing sprite: no icon, no error, nothing to walk up to.
import fs from 'fs';
import Environment from '#/util/Environment.js';
import * as H from './harness.ts';
import { check, R, player, locsNamed } from './a1lib.ts';
import LocType from '#/cache/config/LocType.js';

await H.boot();

// Aleck's counter, so the zone is loaded: a zone is not allocated until somebody has been there,
// and a lookup over an unvisited zone answers "nothing is placed" for everything.
player('huntericon', 2567, 3083);
H.tick(2);

// ---------------------------------------------------------------------------------------------
console.log('== the loc carries the icon');
{
    const id = LocType.getId('hunter_emporium_icon');
    check('hunter_emporium_icon exists', id !== -1, true);
    const l = LocType.get(id);
    check('mapfunction 71', l.mapfunction, 71);
    check('ground decoration, so the client reads it', l.forcedecor, true);
    // 70 is the trading post's. Sharing a slot would put a Grand Exchange icon on Yanille.
    const post = LocType.get(LocType.getId('trading_post_icon')).mapfunction;
    check("and not the trading post's slot", l.mapfunction !== post, true);
}

// ---------------------------------------------------------------------------------------------
console.log('== the packed id and the map line agree');
{
    const src = Environment.BUILD_SRC_DIR;
    const pack = fs.readFileSync(`${src}/pack/loc.pack`, 'ascii').split(/\r?\n/);
    const row = pack.find(l => l.endsWith('=hunter_emporium_icon'));
    check('it has a packed id', row !== undefined, true);
    const packed = Number(row!.split('=')[0]);
    check('and the engine loaded it under that id', LocType.getId('hunter_emporium_icon'), packed);
    check('no second row claims the id', pack.filter(l => l.startsWith(`${packed}=`)).length, 1);

    // m40_48 is the Yanille square: locals are absolute minus 2560,3072.
    const jm2 = fs.readFileSync(`${src}/maps/m40_48.jm2`, 'ascii').split(/\r?\n/);
    const locs = jm2.slice(jm2.indexOf('==== LOC ===='), jm2.indexOf('==== NPC ===='));
    const mine = locs.filter(l => l.split(':')[1]?.trim().split(/\s+/)[0] === String(packed));
    console.log('    map lines:', JSON.stringify(mine));
    check('placed exactly once', mine.length, 1);
    // local 6,10 is 2566,3082 - the floor just inside the door, where OSRS puts loc 19751.
    check('on the tile OSRS puts it on', mine[0], `0 6 10: ${packed} 22 2`);
}

// ---------------------------------------------------------------------------------------------
console.log('== the shop it marks is really there');
{
    check('Aleck', H.npcNear('aleck', 2567, 3083) !== null, true);
    check('Leon', H.npcNear('leon', 2565, 3084, 0) !== null, true);
    check('and the counter', locsNamed('hunter_emporium_counter', 2560, 3072, 2623, 3135, [0]).length > 0, true);
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
