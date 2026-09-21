import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import { parentPort } from 'worker_threads';

import { ApplicationCommandOptionType, ChatInputCommandInteraction, Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';

import Environment from '#/util/Environment.js';
import { toDisplayName } from '#/util/JString.js';

// THE DISCORD RELAY (custom, 2026-09-21). A bot, in its own worker thread, that sends a player's
// game notices - the trading post's, to begin with - to them as Discord DMs.
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
// Only runs when DISCORD_TOKEN and DISCORD_GUILD_ID are set - see World.ts.

if (!parentPort) throw new Error('This file must be run as a worker thread.');
const port = parentPort;

const CODE_MINUTES = 10;

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
            { name: 'linked', description: 'Which game accounts are linked to you' }
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
    if (!interaction.isChatInputCommand()) {
        return;
    }
    try {
        await command(interaction);
    } catch (err) {
        console.error('Discord relay:', err);
    }
});

async function command(i: ChatInputCommandInteraction) {
    const reply = (content: string) => i.reply({ content, flags: MessageFlags.Ephemeral });

    if (i.commandName === 'link') {
        const code = i.options.getString('code', true).trim().toUpperCase();
        db.prepare('DELETE FROM code WHERE expires < ?').run(Date.now());
        const row = db.prepare('SELECT username FROM code WHERE code = ?').get(code) as { username: string } | undefined;
        if (!row) {
            await reply("That code isn't valid - it may have expired. Type ::discord in game for a new one.");
            return;
        }
        db.prepare('DELETE FROM code WHERE code = ?').run(code);
        db.prepare('INSERT INTO link (username, discord_id, linked) VALUES (?, ?, ?) ON CONFLICT (username) DO UPDATE SET discord_id = excluded.discord_id, linked = excluded.linked').run(row.username, i.user.id, Date.now());
        port.postMessage({ type: 'linked', username: row.username, discord: i.user.username });
        await reply(`Linked to **${toDisplayName(row.username)}**. You'll get trading post alerts here as DMs - make sure DMs from server members are allowed.`);
    } else if (i.commandName === 'unlink') {
        const rows = db.prepare('SELECT username FROM link WHERE discord_id = ?').all(i.user.id) as { username: string }[];
        db.prepare('DELETE FROM link WHERE discord_id = ?').run(i.user.id);
        await reply(rows.length ? `Unlinked ${rows.map(r => `**${toDisplayName(r.username)}**`).join(', ')}.` : 'No game account is linked to you.');
    } else if (i.commandName === 'linked') {
        const rows = db.prepare('SELECT username FROM link WHERE discord_id = ?').all(i.user.id) as { username: string }[];
        await reply(rows.length ? `Linked: ${rows.map(r => `**${toDisplayName(r.username)}**`).join(', ')}` : 'No game account is linked to you. Type ::discord in game to link one.');
    }
}

async function notify(username: string, text: string) {
    const row = db.prepare('SELECT discord_id FROM link WHERE username = ?').get(username) as { discord_id: string } | undefined;
    if (!row || !client.isReady()) {
        return;
    }
    try {
        const user = await client.users.fetch(row.discord_id);
        // any @col@ tag is for the game chatbox, and would show in Discord as text
        await user.send(`**${toDisplayName(username)}** - ${text.replace(/@[a-z0-9]{3}@/g, '')}`);
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
            void notify(msg.username, msg.text);
            break;
    }
});

client.login(Environment.DISCORD_TOKEN).catch(err => {
    console.error('Discord relay: login failed - check DISCORD_TOKEN.', err.message);
});
