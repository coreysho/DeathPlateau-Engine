/**
 * Draw a market card without a market - to look at it, or to prove a new webhook works.
 *
 *   npx tsx tools/market/cardpreview.ts out.png --obj 1333 --name "Rune scimitar" \
 *       --count 1 --seller Moaz --buyout 30000 --id 123
 *   npx tsx tools/market/cardpreview.ts out.png --obj 1333 --name "Rune scimitar" --post
 *
 * --post SENDS THE CARD to MARKET_FEED_WEBHOOK, which is read from .env like everything else. The
 * URL is never typed on the command line and never printed: a webhook URL is a password, and a
 * password in your shell history is a password you have given away. It bypasses the queue and the
 * value threshold on purpose - this is "does this URL reach that channel", asked once, not a
 * rehearsal of the feed.
 *
 * MARKET_CARD_ICONS must point at the folder tools/models/ObjIconFiles.java wrote, or the slot
 * comes out empty - which is the same thing the live feed would do, so an empty slot here is
 * telling you the icons are not where the server will look for them.
 */
import fs from 'fs';

import { renderMarketCard } from '#/server/market/MarketCard.js';
import { postCard } from '#/server/market/MarketFeed.js';
import Environment from '#/util/Environment.js';

const args = process.argv.slice(2);
const out = args[0];
const post = args.includes('--post');
if (!out || out.startsWith('--')) {
    console.error('cardpreview: give an output path first');
    process.exit(1);
}

function value(flag: string, fallback: string): string {
    const at = args.indexOf(flag);
    return at !== -1 && at + 1 < args.length ? args[at + 1] : fallback;
}

const png = renderMarketCard({
    id: Number(value('--id', '0')),
    obj: Number(value('--obj', '0')),
    name: value('--name', 'Something'),
    count: Number(value('--count', '1')),
    seller: value('--seller', 'somebody'),
    buyout: Number(value('--buyout', '0'))
});

fs.writeFileSync(out, png);
console.log(`wrote ${out}  (${png.length} bytes)`);

if (post) {
    if (!Environment.MARKET_FEED_WEBHOOK) {
        console.error('cardpreview: --post needs MARKET_FEED_WEBHOOK in .env. Nothing was sent.');
        process.exit(1);
    }
    const res = await postCard(Environment.MARKET_FEED_WEBHOOK, png);
    if (res.ok) {
        console.log(`posted: Discord answered ${res.status}. Look at the channel.`);
    } else {
        // The body often says WHY - a bad URL, a deleted webhook, a rate limit - and none of it
        // contains the URL itself.
        console.error(`posted: Discord answered ${res.status}. ${(await res.text()).slice(0, 300)}`);
        process.exit(1);
    }
}
