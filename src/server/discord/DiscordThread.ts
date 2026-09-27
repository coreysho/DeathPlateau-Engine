import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import { parentPort } from 'worker_threads';

import { ActionRowBuilder, ApplicationCommandOptionType, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Client, Events, GatewayIntentBits, MessageFlags, RepliableInteraction } from 'discord.js';

import Environment from '#/util/Environment.js';
import { toDisplayName } from '#/util/JString.js';

// THE DISCORD RELAY (custom, 2026-09-21). A bot, in its own worker thread, that sends a player's
// game notices - the trading post's, to begin with - to them as Discord DMs, and, since 2026-09-27,
// lets them answer an offer from there.
//
// LINKING. In game, ::discord asks the world for a one-time code; the world makes one and posts it
// here. The player types /link <code> in the server's Discord, and the Discord account that typed it
// is linked to the game account that asked. The code proves both ends: nobody can link a game
// account they are not logged in to, or a Discord account they are not using. Codes last ten
// minutes and are good once. /unlink, or ::discord unlink in game, undoes it.
//
// WHY A WORKER. discord.js keeps a gateway websocket, heartbeats and reconnects on its own schedule,
// and a DM is an HTTP round trip that can take seconds or be rate-limited. None of that belongs on
// the tick. The world posts {type: 'notify'} and forgets it; this thread owns the bot and the link
// table, and nothing on the game thread ever waits for Discord.
//
// ACTING ON THE MARKET FROM HERE. Accept, Decline and Cancel are real trades, so they are NOT done
// in this thread: the market's database has one writer, the game thread, which is what makes a trade
// atomic (engine/market/TradingPost.ts). This thread only asks - {type: 'tp'} out, {type: 'tp-result'}
// back, matched by a request id - and the answering code is tradingPostDiscord in
// engine/script/handlers/TradingPostOps.ts. It works with the seller offline because the goods are
// already held by the market and the proceeds go to their collection box.
//
// WHO MAY ACT. Only the Discord account linked to the game account that owns the listing, checked
// here against the link table before anything is sent, and checked AGAIN by the market itself on the
// game thread, which knows who owns what. One Discord account can have several game accounts linked,
// so every button carries the account it is for and every command takes an optional account.
//
// AND EVERY ACTION IS CONFIRMED. A button press or a command does not do the thing: it shows what
// would happen and asks. Corey's call, 2026-09-27 - these are irreversible trades being made from a
// phone.
//
// Only runs when DISCORD_TOKEN and DISCORD_GUILD_ID are set - see World.ts.

if (!parentPort) throw new Error('This file must be run as a worker thread.');
const port = parentPort;

const CODE_MINUTES = 10;
const ASK_TIMEOUT_MS = 10_000;

fs.mkdirSync('data/discord', { recursive: true });
const db = new DatabaseSync(`data/discord/${Environment.NODE_PROFILE}.sqlite`);
db.exec('PRAGMA journal_mode = WAL');
db.exec(`
    CREATE TABLE IF NOT EXISTS link (
        username   TEXT PRIMARY KEY,
        discord_id TEXT NOT NULL,
        linked     INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS link_discord ON link (discord_id);
    CREATE TABLE IF NOT EXISTS code (
        code     TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        expires  INTEGER NOT NULL
    );
`);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const ID_OPTION = { name: 'id', description: 'The number in the listing, e.g. 12 for #12', type: ApplicationCommandOptionType.Integer, required: true } as const;
const ACCOUNT_OPTION = { name: 'account', description: 'Which linked game account, if you have more than one', type: ApplicationCommandOptionType.String, required: false } as const;

client.once(Events.ClientReady, async ready => {
    try {
        const guild = await ready.guilds.fetch(Environment.DISCORD_GUILD_ID);
        await guild.commands.set([
            {
                name: 'link',
                description: 'Link your game account, with the code ::discord gave you in game',
                options: [{ name: 'code', description: 'The code from ::discord', type: ApplicationCommandOptionType.String, required: true }]
            },
            { name: 'unlink', description: 'Stop game notifications, and unlink every game account linked to you' },
            { name: 'linked', description: 'Which game accounts are linked to you' },
            { name: 'offers', description: 'Offers waiting on your trading post listings', options: [ACCOUNT_OPTION] },
            { name: 'listings', description: 'What you have up on the trading post', options: [ACCOUNT_OPTION] },
            { name: 'accept', description: 'Accept an offer on one of your listings', options: [ID_OPTION, ACCOUNT_OPTION] },
            { name: 'decline', description: 'Decline an offer on one of your listings', options: [ID_OPTION, ACCOUNT_OPTION] },
            { name: 'cancel', description: 'Take one of your listings down - it goes to your collection box', options: [ID_OPTION, ACCOUNT_OPTION] },
            { name: 'collectbox', description: "What's waiting in your collection box" }
        ]);
        console.log(`Discord relay: logged in as ${ready.user.tag}, commands registered in ${guild.name}`);
    } catch (err) {
        // almost always: the bot has not been invited yet. Say how, with this bot's own invite link.
        console.error(`Discord relay: could not register commands in server ${Environment.DISCORD_GUILD_ID} (${(err as Error).message}).`);
        console.error(`  If the bot is not in that server yet, invite it: https://discord.com/oauth2/authorize?client_id=${ready.application.id}&scope=bot+applications.commands&permissions=0`);
        console.error('  then restart the server.');
    }
});

client.on(Events.InteractionCreate, async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            await command(interaction);
        } else if (interaction.isButton()) {
            await button(interaction);
        }
    } catch (err) {
        console.error('Discord relay:', err);
    }
});

// ---- asking the game thread ----

type TpReply = { text: string; offers?: { id: number; label: string }[]; items?: string[] };
const waiting = new Map<number, (reply: TpReply) => void>();
let nextRequest = 1;

function ask(username: string, action: string, arg = 0): Promise<TpReply> {
    const id = nextRequest++;
    return new Promise<TpReply>(resolve => {
        const timer = setTimeout(() => {
            waiting.delete(id);
            resolve({ text: 'The game server did not answer. Try again, or do it in game.' });
        }, ASK_TIMEOUT_MS);
        waiting.set(id, reply => {
            clearTimeout(timer);
            resolve(reply);
        });
        port.postMessage({ type: 'tp', id, username, action, arg });
    });
}

// An offer's contents, one line each under the summary. "+ 10 items" is all one chatbox line has
// room for; a DM is where the seller decides, so it lists them.
function bullets(items?: string[]): string {
    return items && items.length > 0 ? `\n${items.map(l => `- ${l}`).join('\n')}` : '';
}

// ---- which game account ----

function accounts(discordId: string): string[] {
    return (db.prepare('SELECT username FROM link WHERE discord_id = ? ORDER BY linked').all(discordId) as { username: string }[]).map(r => r.username);
}

function owns(discordId: string, username: string): boolean {
    return db.prepare('SELECT 1 FROM link WHERE discord_id = ? AND username = ?').get(discordId, username) !== undefined;
}

// The account a command is for: the only linked one, or the one named. Returns null and says why
// when there is nothing to act as.
async function accountFor(i: ChatInputCommandInteraction): Promise<string | null> {
    const mine = accounts(i.user.id);
    if (mine.length === 0) {
        await say(i, 'No game account is linked to you. Type ::discord in game to link one.');
        return null;
    }
    const named = i.options.getString('account');
    if (named) {
        const want = named.toLowerCase().replace(/ /g, '_');
        if (!mine.includes(want)) {
            await say(i, `**${toDisplayName(want)}** is not linked to you. Linked: ${mine.map(u => `**${toDisplayName(u)}**`).join(', ')}`);
            return null;
        }
        return want;
    }
    if (mine.length > 1) {
        await say(i, `You have more than one account linked - say which: ${mine.map(u => `**${toDisplayName(u)}**`).join(', ')}`);
        return null;
    }
    return mine[0];
}

// A reply only the person who clicked can see. In a DM everything is private already, and Discord
// rejects the ephemeral flag there, so it is only set in a server.
function say(i: RepliableInteraction, content: string, components: ActionRowBuilder<ButtonBuilder>[] = []) {
    return i.reply({ content, components, flags: i.inGuild() ? MessageFlags.Ephemeral : undefined });
}

// ---- the confirm step ----
//
// The button that asks carries everything the button that acts needs, so nothing is remembered
// between the two clicks: kind, the id, and the account it is for.

// from: the notification this started on, so that answering it can take its buttons away. Empty
// when the action came from a command, which has no message behind it.
function confirmRow(action: string, id: number, username: string, label: string, from = ''): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`tpgo|${action}|${id}|${username}|${from}`)
            .setLabel(label)
            .setStyle(action === 'accept' ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('tpno').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );
}

const WORDING: Record<string, { verb: string; describe: string; warn: string }> = {
    accept: { verb: 'Accept', describe: 'describe-offer', warn: 'This sells the item. It cannot be undone.' },
    decline: { verb: 'Decline', describe: 'describe-offer', warn: 'Their offer goes back to them.' },
    cancel: { verb: 'Take it down', describe: 'describe-listing', warn: 'The item goes to your collection box, and any offers on it go back.' }
};

// Ask before doing. Reached from a button on an offer DM and from /accept, /decline and /cancel.
async function confirm(i: RepliableInteraction, action: string, id: number, username: string, from = '') {
    const words = WORDING[action];
    const what = await ask(username, words.describe, id);
    if (what.text === '') {
        await say(i, action === 'cancel' ? 'That listing is not yours, or has already closed.' : 'That offer is not yours, or is no longer open.');
        return;
    }
    await say(i, `${words.verb} ${what.text}?${bullets(what.items)}\n_${words.warn}_`, [confirmRow(action, id, username, words.verb, from)]);
}

async function button(i: ButtonInteraction) {
    if (i.customId === 'tpno') {
        await i.update({ content: 'Left alone.', components: [] });
        return;
    }
    const [kind, action, idText, username, from] = i.customId.split('|');
    if ((kind !== 'tp' && kind !== 'tpgo') || !WORDING[action] || !username) {
        return;
    }
    // The link table decides, not the message: a button is a URL anyone in the channel could press,
    // and a DM can be forwarded. Unlinking makes every button in every old message inert.
    if (!owns(i.user.id, username)) {
        await say(i, `**${toDisplayName(username)}** is not linked to you.`);
        return;
    }
    const id = Number(idText);
    if (!Number.isInteger(id)) {
        return;
    }
    if (kind === 'tp') {
        // the notification's own id travels with the confirm, so answering it can retire its buttons
        await confirm(i, action, id, username, i.message.id);
        return;
    }
    const reply = await ask(username, action, id);
    await i.update({ content: reply.text, components: [] });
    // The notification that started this keeps live buttons otherwise, and pressing them again
    // would only earn a "no longer open".
    if (from) {
        await i.channel?.messages.edit(from, { components: [] }).catch(() => {});
    }
}

async function command(i: ChatInputCommandInteraction) {
    if (i.commandName === 'link') {
        const code = i.options.getString('code', true).trim().toUpperCase();
        db.prepare('DELETE FROM code WHERE expires < ?').run(Date.now());
        const row = db.prepare('SELECT username FROM code WHERE code = ?').get(code) as { username: string } | undefined;
        if (!row) {
            await say(i, "That code isn't valid - it may have expired. Type ::discord in game for a new one.");
            return;
        }
        db.prepare('DELETE FROM code WHERE code = ?').run(code);
        db.prepare('INSERT INTO link (username, discord_id, linked) VALUES (?, ?, ?) ON CONFLICT (username) DO UPDATE SET discord_id = excluded.discord_id, linked = excluded.linked').run(row.username, i.user.id, Date.now());
        port.postMessage({ type: 'linked', username: row.username, discord: i.user.username });
        await say(i, `Linked to **${toDisplayName(row.username)}**. You'll get trading post alerts here as DMs - make sure DMs from server members are allowed.`);
    } else if (i.commandName === 'unlink') {
        const rows = accounts(i.user.id);
        db.prepare('DELETE FROM link WHERE discord_id = ?').run(i.user.id);
        await say(i, rows.length ? `Unlinked ${rows.map(u => `**${toDisplayName(u)}**`).join(', ')}.` : 'No game account is linked to you.');
    } else if (i.commandName === 'linked') {
        const rows = accounts(i.user.id);
        await say(i, rows.length ? `Linked: ${rows.map(u => `**${toDisplayName(u)}**`).join(', ')}` : 'No game account is linked to you. Type ::discord in game to link one.');
    } else if (i.commandName === 'offers' || i.commandName === 'listings' || i.commandName === 'collectbox') {
        const username = await accountFor(i);
        if (username === null) {
            return;
        }
        const action = i.commandName === 'collectbox' ? 'box' : i.commandName;
        const reply = await ask(username, action);
        const head = { offers: 'Offers on your listings', listings: 'Your listings', collectbox: 'Your collection box' }[i.commandName];
        await say(i, `**${head}** (${toDisplayName(username)})\n${reply.text}${i.commandName === 'offers' && reply.offers?.length ? '\n\nAnswer one with `/accept <id>` or `/decline <id>`.' : ''}`);
    } else if (i.commandName === 'accept' || i.commandName === 'decline' || i.commandName === 'cancel') {
        const username = await accountFor(i);
        if (username === null) {
            return;
        }
        await confirm(i, i.commandName, i.options.getInteger('id', true), username);
    }
}

async function notify(username: string, text: string, offer?: number) {
    const row = db.prepare('SELECT discord_id FROM link WHERE username = ?').get(username) as { discord_id: string } | undefined;
    if (!row || !client.isReady()) {
        return;
    }
    try {
        const user = await client.users.fetch(row.discord_id);
        // any @col@ tag is for the game chatbox, and would show in Discord as text
        let content = `**${toDisplayName(username)}** - ${text.replace(/@[a-z0-9]{3}@/g, '')}`;
        // and what is actually in it, which the summary in that line cannot say
        if (offer !== undefined) {
            content += bullets((await ask(username, 'describe-offer', offer)).items);
        }
        // An offer can be answered from here. Both buttons ask before they do anything.
        const components: ActionRowBuilder<ButtonBuilder>[] = [];
        if (offer !== undefined) {
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`tp|accept|${offer}|${username}`).setLabel('Accept').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`tp|decline|${offer}|${username}`).setLabel('Decline').setStyle(ButtonStyle.Danger)
            );
            components.push(row);
        }
        await user.send({ content, components });
    } catch (err) {
        // DMs closed, or the user left the server. Not worth more than a line.
        console.log(`Discord relay: could not DM ${username}: ${(err as Error).message}`);
    }
}

port.on('message', msg => {
    switch (msg.type) {
        case 'code':
            db.prepare('DELETE FROM code WHERE username = ? OR expires < ?').run(msg.username, Date.now());
            db.prepare('INSERT OR REPLACE INTO code (code, username, expires) VALUES (?, ?, ?)').run(msg.code, msg.username, Date.now() + CODE_MINUTES * 60_000);
            break;
        case 'unlink': {
            const had = db.prepare('DELETE FROM link WHERE username = ?').run(msg.username).changes > 0;
            port.postMessage({ type: 'unlinked', username: msg.username, had });
            break;
        }
        case 'status': {
            const row = db.prepare('SELECT discord_id FROM link WHERE username = ?').get(msg.username);
            port.postMessage({ type: 'status', username: msg.username, linked: row !== undefined });
            break;
        }
        case 'notify':
            void notify(msg.username, msg.text, msg.offer);
            break;
        case 'tp-result': {
            const resolve = waiting.get(msg.id);
            if (resolve) {
                waiting.delete(msg.id);
                resolve({ text: msg.text, offers: msg.offers });
            }
            break;
        }
    }
});

client.login(Environment.DISCORD_TOKEN).catch(err => {
    console.error('Discord relay: login failed - check DISCORD_TOKEN.', err.message);
});
