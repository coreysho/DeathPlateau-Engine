// EVERY DBROW IN THE FILE STILL DECODES.
//
// dbrow.dat is one stream with no per-record seek: each row is read where the last one stopped, so
// a single row that writes more bytes than its header claims silently turns every row after it into
// an empty record. That is not hypothetical - a LIST column's value count was written with one byte,
// the collection log's Clues tab has 516 items, and 516 was written as 4. Rows 680 onwards decoded
// to nothing, which took the combat style tables (ids 1290+) with them: db_getfieldcount returned 0,
// player_combat_stat clamped %com_mode to -1, and every melee swing threw "combat style of -1".
//
// So this walks the file the way the engine does and insists the last row ends exactly at the last
// byte. Nothing smaller catches it - the build reports success either way.
//
//   npx tsx tools/sim/dbrows.ts
import { readFileSync } from 'fs';

import * as H from './harness.ts';
import { check, R } from './a1lib.ts';
import Packet from '#/io/Packet.js';
import DbRowType from '#/cache/config/DbRowType.js';
import DbTableType from '#/cache/config/DbTableType.js';

await H.boot();

// ---------------------------------------------------------------- the stream lines up end to end
const idx = readFileSync('data/pack/server/dbrow.idx');
const n = idx.readUInt16BE(0);
const starts = [2];
for (let i = 0; i < n; i++) starts.push(starts[i] + idx.readUInt16BE(2 + i * 2));

const dat = Packet.load('data/pack/server/dbrow.dat');
const count = dat.g2();
check('  the index and the data agree on how many rows there are', count, n);

let desync = '';
for (let id = 0; id < count && !desync; id++) {
    if (dat.pos !== starts[id]) desync = `row ${id}: the reader is at ${dat.pos}, the index says ${starts[id]}`;
    else (new (DbRowType as any)(id)).decodeType(dat);
}
check('  every row begins where the one before it ended', desync || 'yes', 'yes');
check('  and the last row ends at the last byte', dat.pos, dat.data.length);

// ---------------------------------------------------------------- which means the rows are there
check('  every row in pack/dbrow.pack came back with its name', DbRowType.count, n);
let unnamed = 0;
for (let i = 0; i < DbRowType.count; i++) if (!DbRowType.get(i)?.debugname) unnamed++;
check('  none of them decoded to an empty record', unnamed, 0);

// The two the corruption actually cost us, by name rather than by id.
console.log('\nTHE ROWS THE ONE-BYTE COUNT TOOK OUT');
const styleTable = DbTableType.getId('combat_style_table');
for (const name of ['weapon_unarmed_table', 'weapon_2h_sword_table', 'weapon_bow_table', 'weapon_staff_table', 'weapon_salamander_table']) {
    const row: any = DbRowType.getByName(name);
    check(`  ${name.padEnd(24)} is in combat_style_table`, row?.tableId, styleTable);
}
// The row that broke it, counted against its own source rather than a number written here - the
// tab grows every time a clue reward is added, and what matters is that the cache holds as many as
// the spec asked for and that it is still well past the 255 a single byte could carry.
const src = readFileSync('../content/scripts/collection_log/configs/collection_log.dbrow', 'utf8');
const want = (/\[collection_log_tab_1\]([\s\S]*?)(?=\r?\n\[|$)/.exec(src)?.[1].match(/^data=items,/gm) ?? []).length;
const clues: any = DbRowType.getByName('collection_log_tab_1');
const got = clues?.columnValues[DbTableType.get(clues.tableId).columnNames.indexOf('items')]?.length;
check(`  the collection log Clues tab kept all ${want} of its items`, got, want);
check('  which is more than one byte could ever have carried', got > 255, true);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
