import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';

import {
    ActionRowBuilder,
    ApplicationCommandOptionType,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChannelType,
    ChatInputCommandInteraction,
    Client,
    DiscordAPIError,
    EmbedBuilder,
    Events,
    GatewayIntentBits,
    Interaction,
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    ModalSubmitInteraction,
    PermissionFlagsBits,
    PermissionsBitField,
    RepliableInteraction,
    RESTJSONErrorCodes,
    TextChannel,
    TextInputBuilder,
    TextInputStyle,
    ThreadAutoArchiveDuration,
    ThreadChannel
} from 'discord.js';

import { INBOX_SCHEMA, TICKET_DB_PATH } from '#/server/tickets/TicketInbox.js';
import Environment from '#/util/Environment.js';
import { toDisplayName } from '#/util/JString.js';

// THE TICKET BOT (custom, 2026-09-27). Support tickets and bug reports for the server's Discord.
//
// A SEPARATE BOT. Its own Discord application and token (TICKET_BOT_TOKEN), and its own process -
// `npm run tickets` - not a worker of the world like the trading post's relay
// (server/discord/DiscordThread.ts). Support has to work while the game is down or restarting,
// which is when people need it most, so it cannot live inside the game server.
//
// HOW A TICKET LOOKS. An admin runs /ticketsetup in a text channel. The bot posts a panel there with
// two buttons, "Get support" and "Report a bug"; each opens a short form. Submitting it opens a
// PRIVATE THREAD under that channel, which only the player and staff can see - bug reports too,
// Corey's call, so an exploit is never posted where other players can read it. The player is added
// to the thread and can put screenshots there. Private threads need no Manage Channels, and a closed
// one is locked and archived rather than left in the channel list.
//
// STAFF. Everyone with the staff role set in /ticketsetup, or with Manage Threads (who can see every
// private thread anyway). A private thread does not notify anyone who is not in it, so each new
// ticket is ALSO posted to a staff log channel, pinging the staff role, with a Claim button that adds
// whoever presses it to the thread. That message is kept up to date: open, claimed, closed.
//
// FROM THE GAME. ::bug <what happened> files a bug report with the player's position and world on it
// (network/game/client/handler/ClientCheatHandler.ts). It comes through the inbox table in this
// bot's sqlite file - see server/tickets/TicketInbox.ts - which this process drains every few
// seconds. If the player has linked Discord through the relay (::discord), this bot reads the
// relay's link table and adds them to the thread; otherwise staff answer them in game.
//
// Only runs when TICKET_BOT_TOKEN and a guild id are set.

const MAX_OPEN = 3;
const INBOX_POLL_MS = 5_000;
const INBOX_MAX_ATTEMPTS = 5;

const COLOUR = { support: 0x5865f2, bug: 0xed4245, closed: 0x747f8d };
const NOUN = { support: 'support ticket', bug: 'bug report' };

// What the bot needs, in the panel channel (it makes the threads there) and in the staff log.
const PANEL_PERMISSIONS = {
    ViewChannel: PermissionFlagsBits.ViewChannel,
    SendMessages: PermissionFlagsBits.SendMessages,
    EmbedLinks: PermissionFlagsBits.EmbedLinks,
    ReadMessageHistory: PermissionFlagsBits.ReadMessageHistory,
    CreatePrivateThreads: PermissionFlagsBits.CreatePrivateThreads,
    SendMessagesInThreads: PermissionFlagsBits.SendMessagesInThreads,
    ManageThreads: PermissionFlagsBits.ManageThreads
};
const LOG_PERMISSIONS = {
    ViewChannel: PermissionFlagsBits.ViewChannel,
    SendMessages: PermissionFlagsBits.SendMessages,
    EmbedLinks: PermissionFlagsBits.EmbedLinks
};

type Kind = 'support' | 'bug';

type Ticket = {
    id: number;
    kind: Kind;
    source: 'discord' | 'game';
    opener_id: string | null;
    username: string | null;
    subject: string;
    thread_id: string | null;
    log_channel_id: string | null;
    log_message_id: string | null;
    status: 'open' | 'closed';
    claimed_by: string | null;
    created: number;
    closed: number | null;
    closed_by: string | null;
    close_reason: string | null;
};

const token = Environment.TICKET_BOT_TOKEN;
const guildId = Environment.TICKET_GUILD_ID || Environment.DISCORD_GUILD_ID;
if (!token || !guildId) {
    console.error('Ticket bot: set TICKET_BOT_TOKEN and TICKET_GUILD_ID (or DISCORD_GUILD_ID) in .env.');
    process.exit(1);
}

// ---- storage ----

fs.mkdirSync('data/tickets', { recursive: true });
const db = new DatabaseSync(TICKET_DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA busy_timeout = 5000');
db.exec(INBOX_SCHEMA);
db.exec(`
    CREATE TABLE IF NOT EXISTS ticket (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        kind           TEXT NOT NULL,
        source         TEXT NOT NULL,
        opener_id      TEXT,
        username       TEXT,
        subject        TEXT NOT NULL,
        thread_id      TEXT,
        log_channel_id TEXT,
        log_message_id TEXT,
        status         TEXT NOT NULL DEFAULT 'open',
        claimed_by     TEXT,
        created        INTEGER NOT NULL,
        closed         INTEGER,
        closed_by      TEXT,
        close_reason   TEXT
    );
    CREATE INDEX IF NOT EXISTS ticket_thread ON ticket (thread_id);
    CREATE INDEX IF NOT EXISTS ticket_opener ON ticket (opener_id, status);
    CREATE TABLE IF NOT EXISTS config (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
`);

function config(key: 'panel_channel' | 'log_channel' | 'staff_role'): string | null {
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
}

function setConfig(key: string, value: string) {
    db.prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(key, value);
}

function ticket(id: number): Ticket | undefined {
    return db.prepare('SELECT * FROM ticket WHERE id = ?').get(id) as Ticket | undefined;
}

function ticketInThread(threadId: string | null): Ticket | undefined {
    return threadId ? (db.prepare('SELECT * FROM ticket WHERE thread_id = ?').get(threadId) as Ticket | undefined) : undefined;
}

function openTicketsOf(discordId: string): Ticket[] {
    return db.prepare("SELECT * FROM ticket WHERE opener_id = ? AND status = 'open' ORDER BY id").all(discordId) as Ticket[];
}

// ---- the relay's links, read only ----
//
// Who is who in game comes from the trading post relay's link table (::discord, /link), when that
// relay runs on this machine. Read, never written: the relay owns it.

const LINK_DB_PATH = `data/discord/${Environment.NODE_PROFILE}.sqlite`;
let linkDb: DatabaseSync | null = null;

function links(): DatabaseSync | null {
    if (!linkDb && fs.existsSync(LINK_DB_PATH)) {
        try {
            linkDb = new DatabaseSync(LINK_DB_PATH);
            linkDb.exec('PRAGMA busy_timeout = 2000');
        } catch {
            linkDb = null;
        }
    }
    return linkDb;
}

function linkedAccounts(discordId: string): string[] {
    try {
        return ((links()?.prepare('SELECT username FROM link WHERE discord_id = ? ORDER BY linked').all(discordId) ?? []) as { username: string }[]).map(r => r.username);
    } catch {
        return [];
    }
}

function linkedDiscord(username: string): string | null {
    try {
        const row = links()?.prepare('SELECT discord_id FROM link WHERE username = ?').get(username) as { discord_id: string } | undefined;
        return row?.discord_id ?? null;
    } catch {
        return null;
    }
}

// ---- small helpers ----

const number = (id: number) => `#${String(id).padStart(4, '0')}`;
const threadUrl = (threadId: string) => `https://discord.com/channels/${guildId}/${threadId}`;
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

// A reply only the person who caused it can see. Every slow path here defers with an ephemeral
// deferReply (never deferUpdate), so a deferred interaction's first word replaces its "thinking...",
// and anything after that is a follow-up.
function say(i: RepliableInteraction, content: string) {
    if (i.replied) {
        return i.followUp({ content, flags: MessageFlags.Ephemeral });
    }
    if (i.deferred) {
        return i.editReply(content);
    }
    return i.reply({ content, flags: MessageFlags.Ephemeral });
}

function isStaff(i: Interaction): boolean {
    if (i.memberPermissions?.has(PermissionFlagsBits.ManageThreads)) {
        return true;
    }
    const role = config('staff_role');
    if (!role || !i.member) {
        return false;
    }
    const roles = i.member.roles;
    return Array.isArray(roles) ? roles.includes(role) : roles.cache.has(role);
}

async function textChannel(id: string | null): Promise<TextChannel | null> {
    if (!id) {
        return null;
    }
    const channel = await client.channels.fetch(id).catch(() => null);
    return channel?.type === ChannelType.GuildText ? channel : null;
}

// The ticket's thread, or null if it has been deleted - in which case the ticket is closed, so it
// stops counting against the player's open tickets.
async function threadOf(t: Ticket): Promise<ThreadChannel | null> {
    if (!t.thread_id) {
        return null;
    }
    try {
        const channel = await client.channels.fetch(t.thread_id);
        if (channel?.isThread()) {
            return channel;
        }
    } catch (err) {
        // only Discord saying it is gone closes the ticket - not a network blip or a lost permission
        if (!(err instanceof DiscordAPIError) || err.code !== RESTJSONErrorCodes.UnknownChannel) {
            throw err;
        }
    }
    markClosed(t.id, null, 'The thread was deleted.');
    return null;
}

function markClosed(id: number, by: string | null, reason: string | null) {
    db.prepare("UPDATE ticket SET status = 'closed', closed = ?, closed_by = ?, close_reason = ? WHERE id = ? AND status = 'open'").run(Date.now(), by, reason, id);
}

function missing(channel: TextChannel, wanted: Record<string, bigint>): string[] {
    const me = channel.guild.members.me;
    const have = me ? channel.permissionsFor(me) : null;
    return Object.entries(wanted)
        .filter(([, bit]) => !have?.has(bit))
        .map(([name]) => name);
}

// ---- the staff log ----
//
// One message per ticket in the log channel, rebuilt from the row whenever the ticket changes.

function logMessage(t: Ticket) {
    const staffRole = config('staff_role');
    let status = 'Open - not claimed yet';
    if (t.status === 'closed') {
        status = `Closed${t.closed_by ? ` by <@${t.closed_by}>` : ''}${t.close_reason ? ` - ${clip(t.close_reason, 200)}` : ''}`;
    } else if (t.claimed_by) {
        status = `Open - claimed by <@${t.claimed_by}>`;
    }
    const embed = new EmbedBuilder()
        .setColor(t.status === 'closed' ? COLOUR.closed : COLOUR[t.kind])
        .setTitle(clip(`${number(t.id)} · ${t.subject}`, 256))
        .addFields(
            { name: 'Type', value: t.source === 'game' ? `${NOUN[t.kind]}, from ::bug in game` : NOUN[t.kind], inline: true },
            { name: 'Opened by', value: t.opener_id ? `<@${t.opener_id}>` : 'Not on Discord', inline: true },
            { name: 'Game account', value: t.username ? toDisplayName(t.username) : 'Not given', inline: true },
            { name: 'Status', value: status }
        )
        .setTimestamp(t.created);
    if (t.thread_id) {
        embed.setURL(threadUrl(t.thread_id));
    }

    const row = new ActionRowBuilder<ButtonBuilder>();
    if (t.status === 'open') {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`tk|claim|${t.id}`)
                .setLabel(t.claimed_by ? 'Join' : 'Claim')
                .setStyle(ButtonStyle.Primary)
        );
    }
    if (t.thread_id) {
        row.addComponents(new ButtonBuilder().setLabel('Open thread').setStyle(ButtonStyle.Link).setURL(threadUrl(t.thread_id)));
    }
    return {
        content: `${t.status === 'open' && !t.claimed_by && staffRole ? `<@&${staffRole}> ` : ''}New ${NOUN[t.kind]} ${number(t.id)}`,
        embeds: [embed],
        components: row.components.length ? [row] : [],
        allowedMentions: { roles: staffRole ? [staffRole] : [] }
    };
}

async function postLog(t: Ticket) {
    const channel = await textChannel(config('log_channel'));
    if (!channel) {
        return;
    }
    const message = await channel.send(logMessage(t));
    db.prepare('UPDATE ticket SET log_channel_id = ?, log_message_id = ? WHERE id = ?').run(channel.id, message.id, t.id);
}

async function updateLog(id: number) {
    const t = ticket(id);
    if (!t?.log_channel_id || !t.log_message_id) {
        return;
    }
    try {
        const channel = await textChannel(t.log_channel_id);
        const message = await channel?.messages.fetch(t.log_message_id);
        // an edit never pings, so the role mention only ever fired once, on the new ticket
        await message?.edit({ ...logMessage(t), allowedMentions: { parse: [] } });
    } catch (err) {
        console.log(`Ticket bot: could not update the log for ${number(id)}: ${(err as Error).message}`);
    }
}

// ---- opening ----

class NotSetUp extends Error {}

type Opening = {
    kind: Kind;
    source: 'discord' | 'game';
    openerId: string | null;
    username: string | null;
    subject: string;
    embed: EmbedBuilder;
};

async function openTicket(o: Opening): Promise<{ id: number; thread: ThreadChannel }> {
    const panel = await textChannel(config('panel_channel'));
    if (!panel) {
        throw new NotSetUp();
    }

    const id = Number(db.prepare('INSERT INTO ticket (kind, source, opener_id, username, subject, created) VALUES (?, ?, ?, ?, ?, ?)').run(o.kind, o.source, o.openerId, o.username, o.subject, Date.now()).lastInsertRowid);

    let thread: ThreadChannel;
    try {
        thread = await panel.threads.create({
            name: clip(`${o.kind}-${String(id).padStart(4, '0')} ${o.subject}`, 100),
            type: ChannelType.PrivateThread,
            invitable: false,
            autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
            reason: `${NOUN[o.kind]} ${number(id)}`
        });
    } catch (err) {
        // no thread, no ticket - do not leave a row that counts against them
        db.prepare('DELETE FROM ticket WHERE id = ?').run(id);
        throw err;
    }
    db.prepare('UPDATE ticket SET thread_id = ? WHERE id = ?').run(thread.id, id);

    if (o.openerId) {
        await thread.members.add(o.openerId).catch(err => console.log(`Ticket bot: could not add ${o.openerId} to ${number(id)}: ${err.message}`));
    }

    let welcome: string;
    if (o.source === 'game' && !o.openerId) {
        welcome = "Filed in game with ::bug. The player's Discord is not linked, so they cannot see this thread - answer them in game.";
    } else if (o.kind === 'bug') {
        welcome = `Thanks for the report, <@${o.openerId}>. Screenshots or a short clip help a lot - drop them here. Only you and the staff can see this thread.`;
    } else {
        welcome = `Thanks, <@${o.openerId}> - a member of staff will be with you here. Add anything that helps: screenshots, times, names. Only you and the staff can see this thread.`;
    }
    // From here on the ticket exists, so nothing throws: an in-game report that threw would be filed
    // again on the next pass, as a second thread.
    await thread
        .send({
            content: welcome,
            embeds: [o.embed.setColor(COLOUR[o.kind]).setTitle(clip(`${number(id)} · ${o.subject}`, 256))],
            components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`tk|close|${id}`).setLabel('Close ticket').setStyle(ButtonStyle.Secondary))],
            allowedMentions: { users: o.openerId ? [o.openerId] : [] }
        })
        .catch(err => console.log(`Ticket bot: could not post the details of ${number(id)}: ${err.message}`));

    await postLog(ticket(id)!).catch(err => console.log(`Ticket bot: could not post ${number(id)} to the staff log: ${err.message}`));
    return { id, thread };
}

// ---- the forms ----

function input(id: string, label: string, style: TextInputStyle, max: number, options: { required?: boolean; placeholder?: string; value?: string; description?: string } = {}): LabelBuilder {
    const field = new TextInputBuilder()
        .setCustomId(id)
        .setStyle(style)
        .setMaxLength(max)
        .setRequired(options.required ?? true);
    if (options.placeholder) {
        field.setPlaceholder(options.placeholder);
    }
    if (options.value) {
        field.setValue(options.value);
    }
    const label_ = new LabelBuilder().setLabel(label).setTextInputComponent(field);
    if (options.description) {
        label_.setDescription(options.description);
    }
    return label_;
}

function form(kind: Kind, discordId: string): ModalBuilder {
    // their game name, filled in for them when they have exactly one account linked
    const linked = linkedAccounts(discordId);
    const account = input('account', 'Your in-game name', TextInputStyle.Short, 12, {
        required: false,
        value: linked.length === 1 ? toDisplayName(linked[0]) : undefined
    });

    if (kind === 'support') {
        return new ModalBuilder()
            .setCustomId('tkm|support')
            .setTitle('Get support')
            .addLabelComponents(
                input('subject', 'What do you need help with?', TextInputStyle.Short, 80, { placeholder: 'e.g. Lost items after a disconnect' }),
                input('details', 'Tell us more', TextInputStyle.Paragraph, 1500, { description: 'What happened, when, and anything you have already tried.' }),
                account
            );
    }
    return new ModalBuilder()
        .setCustomId('tkm|bug')
        .setTitle('Report a bug')
        .addLabelComponents(
            input('subject', 'What is wrong, in a line?', TextInputStyle.Short, 80, { placeholder: "e.g. The Lumbridge cook won't talk to me" }),
            input('where', 'Where in the game?', TextInputStyle.Short, 100, { placeholder: 'An area, NPC, item, quest or interface' }),
            input('what', 'What happened, and what should have?', TextInputStyle.Paragraph, 1500),
            input('steps', 'How can we make it happen again?', TextInputStyle.Paragraph, 1000, { required: false, placeholder: '1. Talk to the cook  2. ...' }),
            account
        );
}

async function openFromForm(i: ModalSubmitInteraction, kind: Kind) {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    if (!(await roomForAnother(i))) {
        return;
    }

    const value = (id: string) => i.fields.getTextInputValue(id).trim();
    const subject = value('subject');
    const account = value('account');
    const username = account ? account.toLowerCase().replace(/ /g, '_') : null;

    const embed = new EmbedBuilder().setAuthor({ name: i.user.username, iconURL: i.user.displayAvatarURL() });
    if (kind === 'support') {
        embed.setDescription(value('details'));
    } else {
        embed.setDescription(value('what')).addFields({ name: 'Where', value: value('where') });
        const steps = value('steps');
        if (steps) {
            embed.addFields({ name: 'To make it happen again', value: steps });
        }
    }
    // A name they typed is only a claim. Say whether it is one of theirs.
    if (username) {
        const verified = linkedAccounts(i.user.id).includes(username);
        embed.addFields({ name: 'Game account', value: `${toDisplayName(username)}${verified ? ' (linked to this Discord)' : ' (as they typed it - not linked)'}` });
    }

    try {
        const { id, thread } = await openTicket({ kind, source: 'discord', openerId: i.user.id, username, subject, embed });
        await i.editReply(`Your ${NOUN[kind]} ${number(id)} is open: ${thread.url}`);
    } catch (err) {
        if (err instanceof NotSetUp) {
            await i.editReply('Tickets are not set up yet - ask an admin to run /ticketsetup.');
            return;
        }
        throw err;
    }
}

// At most MAX_OPEN open tickets each. Checked when the button is pressed, so nobody writes out a
// long form only to have it refused, and again when the form comes back.
async function roomForAnother(i: RepliableInteraction): Promise<boolean> {
    const open = openTicketsOf(i.user.id);
    const live: Ticket[] = [];
    for (const t of open) {
        if (await threadOf(t)) {
            live.push(t);
        }
    }
    if (live.length < MAX_OPEN) {
        return true;
    }
    await say(i, `You already have ${live.length} tickets open - please carry on in one of those, or close one first:\n${live.map(t => `${number(t.id)} ${threadUrl(t.thread_id!)}`).join('\n')}`);
    return false;
}

// ---- in-game reports ----

type InboxRow = { id: number; username: string; text: string; x: number; z: number; level: number; world: number; created: number };
let draining = false;

async function drainInbox() {
    if (draining || !client.isReady() || !config('panel_channel')) {
        return;
    }
    draining = true;
    try {
        const rows = db.prepare('SELECT * FROM inbox WHERE ticket IS NULL AND attempts < ? ORDER BY id LIMIT 10').all(INBOX_MAX_ATTEMPTS) as InboxRow[];
        for (const r of rows) {
            try {
                const openerId = linkedDiscord(r.username);
                const mx = r.x >> 6;
                const mz = r.z >> 6;
                const embed = new EmbedBuilder()
                    .setDescription(r.text)
                    .addFields(
                        { name: 'Game account', value: toDisplayName(r.username), inline: true },
                        { name: 'World', value: String(r.world), inline: true },
                        { name: 'When', value: `<t:${Math.floor(r.created / 1000)}:f>`, inline: true },
                        { name: 'Where they stood', value: `x ${r.x}, z ${r.z}, level ${r.level} (map square m${mx}_${mz})\n\`::tele ${r.level},${mx},${mz},${r.x & 63},${r.z & 63}\`` }
                    );
                const { id } = await openTicket({ kind: 'bug', source: 'game', openerId, username: r.username, subject: clip(r.text, 80), embed });
                db.prepare('UPDATE inbox SET ticket = ? WHERE id = ?').run(id, r.id);
            } catch (err) {
                db.prepare('UPDATE inbox SET attempts = attempts + 1 WHERE id = ?').run(r.id);
                console.error(`Ticket bot: could not file in-game report ${r.id} from ${r.username}:`, (err as Error).message);
            }
        }
    } finally {
        draining = false;
    }
}

// ---- closing and reopening ----

async function closeTicket(i: RepliableInteraction, t: Ticket, reason: string | null) {
    if (t.status === 'closed') {
        await say(i, `${number(t.id)} is already closed.`);
        return;
    }
    const thread = await threadOf(t);
    markClosed(t.id, i.user.id, reason);
    if (thread) {
        if (thread.archived) {
            await thread.setArchived(false);
        }
        await thread.send({
            content: t.opener_id && t.opener_id !== i.user.id ? `<@${t.opener_id}>` : undefined,
            embeds: [new EmbedBuilder().setColor(COLOUR.closed).setDescription(`Closed by <@${i.user.id}>.${reason ? `\n> ${reason}` : ''}\nThanks - if you need more help, open a new ticket.`)],
            components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`tk|reopen|${t.id}`).setLabel('Reopen (staff)').setStyle(ButtonStyle.Secondary))],
            allowedMentions: { users: t.opener_id ? [t.opener_id] : [] }
        });
    }
    await say(i, `Closed ${number(t.id)}.`);
    await updateLog(t.id);
    // Locked AND archived: a locked thread can only be reopened by staff, so a closed ticket does
    // not quietly come back to life the next time the player types in it.
    if (thread) {
        await thread.setLocked(true, 'Ticket closed');
        await thread.setArchived(true, 'Ticket closed');
    }
}

async function reopenTicket(i: ButtonInteraction, t: Ticket) {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const thread = await threadOf(t);
    if (!thread) {
        await say(i, 'That thread has been deleted - it cannot be reopened.');
        await updateLog(t.id);
        return;
    }
    await thread.setArchived(false, 'Ticket reopened');
    await thread.setLocked(false, 'Ticket reopened');
    db.prepare("UPDATE ticket SET status = 'open', closed = NULL, closed_by = NULL, close_reason = NULL WHERE id = ?").run(t.id);
    // the Reopen button has done its job
    await i.message.edit({ components: [] }).catch(() => {});
    await thread.send({ content: `Reopened by <@${i.user.id}>.`, allowedMentions: { parse: [] } });
    await say(i, `Reopened ${number(t.id)}.`);
    await updateLog(t.id);
}

// ---- interactions ----

async function button(i: ButtonInteraction) {
    const [, action, arg] = i.customId.split('|');

    if (action === 'open') {
        const kind = arg as Kind;
        if (kind !== 'support' && kind !== 'bug') {
            return;
        }
        if (!(await roomForAnother(i))) {
            return;
        }
        await i.showModal(form(kind, i.user.id));
        return;
    }

    const t = ticket(Number(arg));
    if (!t) {
        await say(i, 'That ticket no longer exists.');
        return;
    }

    if (action === 'claim') {
        if (!isStaff(i)) {
            await say(i, 'Only staff can claim tickets.');
            return;
        }
        if (t.status === 'closed') {
            await say(i, `${number(t.id)} is closed.`);
            return;
        }
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        const thread = await threadOf(t);
        if (!thread) {
            await i.editReply('That thread has been deleted.');
            await updateLog(t.id);
            return;
        }
        if (thread.archived) {
            await thread.setArchived(false);
        }
        await thread.members.add(i.user.id);
        if (t.claimed_by) {
            await i.editReply(`Added you to ${thread.url} - <@${t.claimed_by}> has it claimed.`);
            return;
        }
        db.prepare('UPDATE ticket SET claimed_by = ? WHERE id = ?').run(i.user.id, t.id);
        await thread.send({ content: `<@${i.user.id}> from the staff is looking at this now.`, allowedMentions: { parse: [] } });
        await i.editReply(`Claimed: ${thread.url}`);
        await updateLog(t.id);
    } else if (action === 'close') {
        if (i.user.id !== t.opener_id && !isStaff(i)) {
            await say(i, 'Only the person who opened this ticket, or staff, can close it.');
            return;
        }
        if (t.status === 'closed') {
            await say(i, `${number(t.id)} is already closed.`);
            return;
        }
        // The form is the "are you sure": dismissing it leaves the ticket open.
        await i.showModal(
            new ModalBuilder()
                .setCustomId(`tkm|close|${t.id}`)
                .setTitle(`Close ticket ${number(t.id)}?`)
                .addLabelComponents(input('reason', 'Reason (optional)', TextInputStyle.Paragraph, 300, { required: false, placeholder: 'e.g. Fixed in the next update' }))
        );
    } else if (action === 'reopen') {
        if (!isStaff(i)) {
            await say(i, 'Only staff can reopen a ticket - please open a new one instead.');
            return;
        }
        if (t.status === 'open') {
            await say(i, `${number(t.id)} is already open.`);
            return;
        }
        await reopenTicket(i, t);
    }
}

async function modal(i: ModalSubmitInteraction) {
    const [, action, arg] = i.customId.split('|');
    if (action === 'support' || action === 'bug') {
        await openFromForm(i, action);
    } else if (action === 'close') {
        const t = ticket(Number(arg));
        if (!t) {
            await say(i, 'That ticket no longer exists.');
            return;
        }
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        await closeTicket(i, t, i.fields.getTextInputValue('reason').trim() || null);
    }
}

async function command(i: ChatInputCommandInteraction) {
    if (i.commandName === 'ticketsetup') {
        await setup(i);
        return;
    }
    if (i.commandName !== 'ticket') {
        return;
    }

    const sub = i.options.getSubcommand();
    if (sub === 'list') {
        if (!isStaff(i)) {
            await say(i, 'Only staff can list tickets.');
            return;
        }
        const open = db.prepare("SELECT * FROM ticket WHERE status = 'open' ORDER BY id LIMIT 25").all() as Ticket[];
        const lines = open.map(t => `**${number(t.id)}** ${t.kind} · ${clip(t.subject, 60)} · ${t.thread_id ? threadUrl(t.thread_id) : 'no thread'} · ${t.claimed_by ? `<@${t.claimed_by}>` : 'unclaimed'}`);
        await i.reply({ content: lines.length ? `**Open tickets**\n${lines.join('\n')}` : 'No open tickets.', flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
        return;
    }

    // close and add work on the ticket whose thread they are typed in
    const t = ticketInThread(i.channelId);
    if (!t) {
        await say(i, 'Use this inside a ticket thread.');
        return;
    }

    if (sub === 'close') {
        if (i.user.id !== t.opener_id && !isStaff(i)) {
            await say(i, 'Only the person who opened this ticket, or staff, can close it.');
            return;
        }
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        await closeTicket(i, t, i.options.getString('reason')?.trim() || null);
    } else if (sub === 'add') {
        if (!isStaff(i)) {
            await say(i, 'Only staff can add people to a ticket.');
            return;
        }
        const user = i.options.getUser('user', true);
        const thread = await threadOf(t);
        if (!thread) {
            await say(i, 'That thread has been deleted.');
            return;
        }
        await thread.members.add(user.id);
        await i.reply({ content: `Added <@${user.id}> to this ticket.`, allowedMentions: { parse: [] } });
    }
}

async function setup(i: ChatInputCommandInteraction) {
    const panel = i.channel;
    if (!panel || panel.type !== ChannelType.GuildText) {
        await say(i, 'Run /ticketsetup in the text channel the panel should go in. Tickets are made as private threads under it.');
        return;
    }
    const role = i.options.getRole('staff_role', true);
    const logOption = i.options.getChannel('staff_log', true);
    const log = await textChannel(logOption.id);
    if (!log) {
        await say(i, 'The staff log has to be a text channel.');
        return;
    }

    const problems: string[] = [];
    const panelMissing = missing(panel, PANEL_PERMISSIONS);
    if (panelMissing.length) {
        problems.push(`In ${panel}, I am missing: ${panelMissing.join(', ')}`);
    }
    const logMissing = missing(log, LOG_PERMISSIONS);
    if (logMissing.length) {
        problems.push(`In ${log}, I am missing: ${logMissing.join(', ')}`);
    }
    if (problems.length) {
        await say(i, `Not set up - give me these permissions and run it again:\n${problems.join('\n')}`);
        return;
    }

    setConfig('panel_channel', panel.id);
    setConfig('log_channel', log.id);
    setConfig('staff_role', role.id);

    await panel.send({
        embeds: [
            new EmbedBuilder()
                .setColor(COLOUR.support)
                .setTitle('Support & bug reports')
                .setDescription(
                    [
                        '**Get support** - a private conversation with the staff: account problems, lost items, reporting a player, or anything else.',
                        '',
                        '**Report a bug** - something in the game is not working as it should. Tell us where, and what happened.',
                        '',
                        'Only you and the staff can see your ticket.',
                        'In game, you can also type `::bug` followed by what went wrong.'
                    ].join('\n')
                )
        ],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('tk|open|support').setLabel('Get support').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('tk|open|bug').setLabel('Report a bug').setStyle(ButtonStyle.Danger)
            )
        ]
    });

    const notes: string[] = [];
    // A role only pings if it is mentionable, or the bot may mention anyone.
    const me = i.guild?.members.me;
    if (!role.mentionable && !(me && log.permissionsFor(me)?.has(PermissionFlagsBits.MentionEveryone))) {
        notes.push(`<@&${role.id}> is not mentionable, so new tickets will not ping it. Make it mentionable, or give me "Mention @everyone, @here, and All Roles" in ${log}.`);
    }
    await say(i, [`Done. Tickets open as private threads here, and are announced in ${log} for <@&${role.id}>.`, ...notes].join('\n'));
}

// ---- the bot ----

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async ready => {
    try {
        const guild = await ready.guilds.fetch(guildId);
        await guild.commands.set([
            {
                name: 'ticketsetup',
                description: 'Post the ticket panel in this channel',
                defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
                options: [
                    { name: 'staff_role', description: 'Who handles tickets', type: ApplicationCommandOptionType.Role, required: true },
                    { name: 'staff_log', description: 'Where new tickets are announced to staff', type: ApplicationCommandOptionType.Channel, channelTypes: [ChannelType.GuildText], required: true }
                ]
            },
            {
                name: 'ticket',
                description: 'Support tickets and bug reports',
                options: [
                    {
                        name: 'close',
                        description: 'Close this ticket',
                        type: ApplicationCommandOptionType.Subcommand,
                        options: [{ name: 'reason', description: 'Why - shown in the ticket', type: ApplicationCommandOptionType.String, maxLength: 300 }]
                    },
                    {
                        name: 'add',
                        description: 'Staff: add someone to this ticket',
                        type: ApplicationCommandOptionType.Subcommand,
                        options: [{ name: 'user', description: 'Who to add', type: ApplicationCommandOptionType.User, required: true }]
                    },
                    { name: 'list', description: 'Staff: every open ticket', type: ApplicationCommandOptionType.Subcommand }
                ]
            }
        ]);
        console.log(`Ticket bot: logged in as ${ready.user.tag}, commands registered in ${guild.name}.`);
        if (!config('panel_channel')) {
            console.log('Ticket bot: not set up yet - run /ticketsetup in the channel the panel should go in.');
        }
    } catch (err) {
        // almost always: the bot has not been invited yet. Say how, with this bot's own invite link.
        const permissions = new PermissionsBitField([...Object.values(PANEL_PERMISSIONS), ...Object.values(LOG_PERMISSIONS)]).bitfield;
        console.error(`Ticket bot: could not register commands in server ${guildId} (${(err as Error).message}).`);
        console.error(`  If the bot is not in that server yet, invite it: https://discord.com/oauth2/authorize?client_id=${ready.application.id}&scope=bot+applications.commands&permissions=${permissions}`);
        console.error('  then restart the ticket bot.');
    }
    setInterval(() => void drainInbox(), INBOX_POLL_MS);
});

client.on(Events.InteractionCreate, async i => {
    try {
        if (i.isChatInputCommand()) {
            await command(i);
        } else if (i.isButton() && i.customId.startsWith('tk|')) {
            await button(i);
        } else if (i.isModalSubmit() && i.customId.startsWith('tkm|')) {
            await modal(i);
        }
    } catch (err) {
        console.error('Ticket bot:', err);
        if (i.isRepliable()) {
            await say(i, 'Something went wrong. Please try again, or tell a member of staff.').catch(() => {});
        }
    }
});

// A ticket thread deleted by hand is a closed ticket.
client.on(Events.ThreadDelete, thread => {
    const t = ticketInThread(thread.id);
    if (t) {
        markClosed(t.id, null, 'The thread was deleted.');
        void updateLog(t.id);
    }
});

function shutdown() {
    void client.destroy().finally(() => {
        db.close();
        linkDb?.close();
        process.exit(0);
    });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

client.login(token).catch(err => {
    console.error('Ticket bot: login failed - check TICKET_BOT_TOKEN.', err.message);
    process.exit(1);
});
