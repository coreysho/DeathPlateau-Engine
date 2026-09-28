// The "chatchars" round (2026-09-27), on the real engine - run with `npx tsx tools/sim/chatchars.ts`:
//
//   protocol   chat is its characters now (src/wordenc/ChatText.ts, the client's jagex2.wordenc.ChatText),
//              not 377 WordPack nibbles - so a new ENGINE_REVISION (381) turns an older client away at login
//   public     every character the chatbox lets you type, and mixed case, go through the real
//              MessagePublicHandler, the censor, the real CHAT block renderer (rsbuf) and back out the way
//              the client reads that block, unchanged: "& _ - @ # $ < >", ":D", "PvP", "xD"
//   private    the same through MessagePrivateHandler -> the friend server relay (stubbed: it only carries
//              the string) -> MessagePrivate -> the real MessagePrivateEncoder -> the client's read
//   clan       the same through ClanMessageHandler -> ClanChat.message -> MessageClan -> MessageClanEncoder
//   casing     a line's first letter is capitalised, nothing else is touched; characters outside the set
//              ({ | } ~ and anything above 'z') are dropped; runs of spaces close up
//   markup     "@red@", "@cr2@" and "<col=ff0000>" typed in chat arrive as those characters (the client
//              draws chat with drawString, which prints tags rather than obeying them); in a ::yell,
//              which IS read for tags, every '@' goes out as LITERAL_AT, measured as an '@' by FontType
//   censor     with the censor switched on (it is off on this server by the owner's choice) a filtered
//              word is masked whatever its case, and the rest of the line keeps its case
import * as H from './harness.ts';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';
import FontType from '#/cache/config/FontType.js';
import WordEnc from '#/cache/wordenc/WordEnc.js';
import ClanChat from '#/engine/clan/ClanChat.js';
import ChatText from '#/wordenc/ChatText.js';
import MessagePublic from '#/network/game/client/model/MessagePublic.js';
import MessagePrivateIn from '#/network/game/client/model/MessagePrivate.js';
import ClanMessage from '#/network/game/client/model/ClanMessage.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';
import MessagePublicHandler from '#/network/game/client/handler/MessagePublicHandler.js';
import MessagePrivateHandler from '#/network/game/client/handler/MessagePrivateHandler.js';
import ClanMessageHandler from '#/network/game/client/handler/ClanMessageHandler.js';
import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import MessagePrivate from '#/network/game/server/model/MessagePrivate.js';
import MessageClan from '#/network/game/server/model/MessageClan.js';
import MessagePrivateEncoder from '#/network/game/server/codec/MessagePrivateEncoder.js';
import MessageClanEncoder from '#/network/game/server/codec/MessageClanEncoder.js';
import { PlayerRenderer } from '#/network/rsbuf/renderer.js';
import { Player as RsPlayer, Chat } from '#/network/rsbuf/player.js';
import { Packet as RsPacket } from '#/network/rsbuf/packet.js';
import { PlayerInfoProt } from '#/network/rsbuf/prot.js';

await H.boot();
H.loginOrder();
let ok = 0, bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    pass ? ok++ : bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

// ---- what the client does (jagex2.wordenc.ChatText): format what was typed, one byte a character
const typed = (text: string) => ChatText.encode(ChatText.format(text));

// ---- the server side, captured where it leaves for a client
const outbox: { to: string; msg: MessagePrivate | MessageClan }[] = [];
const origWrite = (Player.prototype as any).write;
(Player.prototype as any).write = function (message: any) {
    if (message instanceof MessagePrivate || message instanceof MessageClan) outbox.push({ to: this.username, msg: message });
    return origWrite.call(this, message);
};
// the friend server only stores the string and relays it (FriendServer PRIVATE_MESSAGE -> World 2265)
(World as any).sendPrivateMessage = (from: Player, target37: bigint, text: string) => {
    const target = [alice, bob].find(p => p.username37 === target37);
    target?.write(new MessagePrivate(from.username37, 1, from.staffModLevel, text));
};

// ---- the client's reads
function clientReadsPublic(p: Player): string {
    // the CHAT block exactly as the renderer writes it for observers, read as Client.java reads mask 0x40
    const rp = new RsPlayer(7);
    rp.masks = PlayerInfoProt.CHAT;
    rp.chat = new Chat(p.chatMessage!.slice(), p.chatColour, p.chatEffect, p.chatRights);
    const pr = new PlayerRenderer();
    pr.computeInfo(rp);
    const out = new RsPacket(300);
    pr.write(out, 7, PlayerInfoProt.CHAT);
    const buf = new Packet(out.data.slice(0, out.pos));
    buf.g2(); // colour << 8 | effect
    buf.g1_alt2(); // rights
    const len = buf.g1_alt1();
    const bytes = new Uint8Array(len);
    buf.gdata_alt2(bytes, 0, len);
    return ChatText.unpack(new Packet(bytes), len);
}
function clientReads(msg: MessagePrivate | MessageClan): string {
    const buf = Packet.alloc(1);
    if (msg instanceof MessagePrivate) new MessagePrivateEncoder().encode(buf, msg);
    else new MessageClanEncoder().encode(buf, msg);
    const psize = buf.pos;
    buf.pos = 0;
    const header = msg instanceof MessagePrivate ? 13 : 21; // Client.java: psize - 13, psize - 21
    buf.pos = header;
    const text = ChatText.unpack(buf, psize - header);
    buf.release();
    return text;
}

const alice = H.makePlayer('alice', 3222, 3222, 1);
const bob = H.makePlayer('bob', 3223, 3222, 2);
H.tick(2);
H.setVar(alice, 'tutorial', 1000);
H.setVar(bob, 'tutorial', 1000);
H.tick(1);

// a clan channel of two, put straight into ClanChat's open channels (no database row)
(ClanChat as any).channels.set('alice', { owner: 'alice', name: 'chatchars', enter: -1, talk: -1, kick: 7, friends: new Set(), ranks: new Map(), members: [alice, bob] });
(alice as any).clanOwner = 'alice';
(bob as any).clanOwner = 'alice';

const pub = new MessagePublicHandler();
const pm = new MessagePrivateHandler();
const clan = new ClanMessageHandler();

type Result = { pub: string; pm: string; clan: string };
function send(text: string, colour = 0, effect = 0): Result {
    const r: Result = { pub: '', pm: '', clan: '' };
    H.tick(1); // socialProtect clears each tick
    if (pub.handle(new MessagePublic(typed(text), colour, effect), alice)) r.pub = clientReadsPublic(alice);
    H.tick(1);
    outbox.length = 0;
    if (pm.handle(new MessagePrivateIn(bob.username37, typed(text)), alice)) {
        const got = outbox.find(o => o.to === 'bob' && o.msg instanceof MessagePrivate);
        r.pm = got ? clientReads(got.msg) : '(not delivered)';
    }
    H.tick(1);
    outbox.length = 0;
    if (clan.handle(new ClanMessage(typed(text)), alice)) {
        const got = outbox.find(o => o.to === 'bob' && o.msg instanceof MessageClan);
        r.clan = got ? clientReads(got.msg) : '(not delivered)';
    }
    return r;
}
const all3 = (text: string): Result => ({ pub: text, pm: text, clan: text });

console.log('PROTOCOL');
check('ENGINE_REVISION is 381 (an older client is told the game has been updated)', Environment.ENGINE_REVISION, 381);

console.log('THE NEW CHARACTERS (public, private and clan)');
check('"& _ - @ # $ < >"', send('& _ - @ # $ < >'), all3('& _ - @ # $ < >'));
check('an email and a tag-like name', send('Mail me: dp_admin@example.com <3 #1 $5 a-b'), all3('Mail me: dp_admin@example.com <3 #1 $5 a-b'));

console.log('EVERY CHARACTER THE CHATBOX LETS YOU TYPE');
{
    const set: string[] = [];
    for (let c = 0x21; c <= 0x7a; c++) set.push(String.fromCharCode(c));
    // 90 characters: two lines under the 80 limit, each starting with a non-letter so nothing is capitalised
    const a = set.slice(0, 45).join('');
    const b = set.slice(45).join('');
    check(`the first half ${JSON.stringify(a)}`, send(a), all3(a));
    check(`the second half ${JSON.stringify(b)}`, send(b), all3(b));
}

console.log('CASE');
check('":D" stays ":D" (377 sent ":d")', send(':D'), all3(':D'));
check('"hello PvP :D" - the first letter capitalised, the rest as typed', send('hello PvP :D'), all3('Hello PvP :D'));
check('"McDonald LOL xD" keeps every capital', send('McDonald LOL xD'), all3('McDonald LOL xD'));
check('"i am OK. no, REALLY" - only the very first letter', send('i am OK. no, REALLY'), all3('I am OK. no, REALLY'));
check('"xD" at the start is a first letter', send('xD'), all3('XD'));

console.log('OUTSIDE THE SET, SPACES, LENGTH');
check('{ | } ~ dropped, runs of spaces closed up', send('a{b|c}d~e    f'), all3('Abcde f'));
{
    const long = 'z'.repeat(120);
    check('a line is cut at 80 characters', Object.values(send(long)).map(s => s.length), [80, 80, 80]);
}
check('an empty line (or only dropped characters) is not sent', send('~~~'), all3(''));

console.log('MARKUP ARRIVES AS CHARACTERS');
{
    const inject = '@red@fake @cr2@crown @whi@ <col=ff0000>red</col> <img=1> @str@x';
    check('colour, crown and <col>/<img> tags in chat reach the other client as typed', send(inject), all3(inject));
    check('a public line with an effect the client has (3, shake) is not thrown away', send('shaking', 0, 3).pub, 'Shaking');
}

console.log('::YELL - A GAME MESSAGE, READ FOR TAGS');
{
    const watcher = H.makePlayer('watcher', 3224, 3222, 3);
    H.tick(2);
    H.clearLogs();
    new ClientCheatHandler().handle(new ClientCheat('yell hi @cr2@ and @red@RED a_b <x>'), alice);
    H.tick(1);
    const line = H.mesgs.find(m => m.who === 'watcher' && m.text.includes('[Yell]'))?.text ?? '';
    const said = line.substring(line.indexOf(': ') + 2);
    check('the yell arrives, case kept, with every "@" as LITERAL_AT', said, 'Hi \u007fcr2\u007f and \u007fred\u007fRED a_b <x>');
    check('  and no "@xxx@" tag survives in what the player typed', /@...@/.test(said), false);
    check('  and LITERAL_AT is measured as wide as "@"', [0, 1, 2].map(f => FontType.get(f).stringWidth('\u007f') === FontType.get(f).stringWidth('@')), [true, true, true]);
    H.despawn(watcher);
}

console.log('THE CENSOR');
{
    // off on this server (the owner's choice, 2026-09-01) - a line goes out as typed
    const was = WordEnc.censor;
    // find a word the Jagex list catches, rather than naming one here
    WordEnc.censor = true;
    const word = ['shit', 'fuck', 'bastard', 'arse'].find(w => WordEnc.filter(w) === '*'.repeat(w.length));
    check('the censor, switched on, has a word to catch', word !== undefined, true);
    if (word) {
        const mixed = word.split('').map((c, i) => (i % 2 ? c.toUpperCase() : c)).join('');
        const r = send(`Look ${mixed} PvP ${word.toUpperCase()} :D`);
        const masked = `Look ${'*'.repeat(word.length)} PvP ${'*'.repeat(word.length)} :D`;
        check(`  "${mixed}" and "${word.toUpperCase()}" are masked, the rest keeps its case`, r, all3(masked));
        WordEnc.censor = false;
        check('  and switched off (as on live) the line goes out as typed', send(`Look ${mixed} PvP`).pub, `Look ${mixed} PvP`);
    }
    WordEnc.censor = was;
}

H.despawn(alice, bob);
console.log(`\n${ok} ok, ${bad} failed`);
process.exit(bad === 0 ? 0 : 1);
