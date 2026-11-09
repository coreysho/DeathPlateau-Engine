/**
 * The market feed, against a webhook that is not Discord.
 *
 *   npx tsx tools/market/feedtest.ts
 *
 * WHY A LOCAL SERVER rather than a mocked fetch. What this needs to prove is that the thing
 * Discord receives is right - a multipart body with a payload_json part and a real PNG beside it -
 * and a mock of fetch proves only that fetch was called. A socket that reads the bytes back is the
 * cheapest way to look at what actually went out.
 *
 * Environment reads process.env when it is first imported, so the server is started and the
 * variables are set BEFORE MarketFeed is imported. That is what the dynamic import is for.
 */
import http from 'http';
import { AddressInfo } from 'net';

const received: { type: string; body: Buffer }[] = [];
const at: number[] = [];

const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
        received.push({ type: req.headers['content-type'] ?? '', body: Buffer.concat(chunks) });
        at.push(Date.now());
        res.writeHead(204);
        res.end();
    });
});

await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const port = (server.address() as AddressInfo).port;

const EVERY = 600;
process.env.MARKET_FEED_WEBHOOK = `http://127.0.0.1:${port}/hook`;
process.env.MARKET_FEED_MIN = '50000';
process.env.MARKET_FEED_EVERY = String(EVERY);
process.env.MARKET_CARD_ICONS = process.env.MARKET_CARD_ICONS ?? 'C:/DeathPlateauWeb/public/icons';

const { MarketFeed } = await import('#/server/market/MarketFeed.js');

let ok = 0;
let bad = 0;
function check(what: string, got: unknown, want: unknown): void {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    console.log(`  ${pass ? 'ok  ' : 'FAIL'}   ${what}: ${JSON.stringify(got)}${pass ? '' : ` (wanted ${JSON.stringify(want)})`}`);
    pass ? ok++ : bad++;
}

MarketFeed.init();
check('the feed is on', MarketFeed.enabled, true);

console.log('\nFOUR LISTINGS, ONE OF THEM TOO CHEAP');
MarketFeed.post({ id: 1, obj: 1333, name: 'Rune scimitar', count: 1, seller: 'Moaz', buyout: 30000, value: 30000 });
MarketFeed.post({ id: 2, obj: 1333, name: 'Rune scimitar', count: 1, seller: 'Corey', buyout: 90000, value: 90000 });
MarketFeed.post({ id: 3, obj: 3140, name: 'Dragon chainbody', count: 1, seller: 'Thalia', buyout: 2400000, value: 2400000 });
MarketFeed.post({ id: 4, obj: 892, name: 'Rune arrow', count: 1000, seller: 'Nyx', buyout: 0, value: 400000 });

// Long enough for three cards at EVERY apart, plus slack.
await new Promise(r => setTimeout(r, EVERY * 4 + 1500));

check('the cheap one was never sent', received.length, 3);
check('every post was multipart', received.every(r => r.type.startsWith('multipart/form-data')), true);
check('every post carried a payload_json part', received.every(r => r.body.includes('name="payload_json"')), true);
check('every post carried listing.png', received.every(r => r.body.includes('filename="listing.png"')), true);
check(
    'every attachment is a real PNG',
    received.every(r => r.body.includes(Buffer.from([0x89, 0x50, 0x4e, 0x47]))),
    true
);
check(
    'the embed is the server red',
    received.every(r => r.body.includes(String(0xb83228))),
    true
);
check('every embed points at its attachment', received.filter(r => r.body.includes('attachment://listing.png')).length, 3);

// The throttle: the gaps between posts, not the total, because the first goes out after one gap too.
const gaps = at.slice(1).map((t, i) => t - at[i]);
check(
    `each card waited at least ${EVERY}ms (gaps ${gaps.join(', ')})`,
    gaps.every(g => g >= EVERY - 100),
    true
);

// The card itself, read back out of the multipart - it should be the size the renderer writes.
const png = received[0].body;
const start = png.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
const w = png.readUInt32BE(start + 16);
const h = png.readUInt32BE(start + 20);
check('the card is 1080x344', [w, h], [1080, 344]);

server.close();
console.log(`\n${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
