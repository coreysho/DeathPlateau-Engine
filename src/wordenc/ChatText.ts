import Packet from '#/io/Packet.js';

// custom (2026-09-27) - player chat on the wire: public chat, private messages and clan chat.
//
// WHY NOT WordPack. The 377 packer squeezes a line into nibbles over a fixed table of 61 characters
// and is full - a byte can name index 60 and no further - so it has no room for '_', '<' or '>', and
// no capitals at all: it lower-cases the line and capitalises each sentence, which is why ":D"
// arrived as ":d". A line is now its characters, one byte each, after the packet's own length.
// The client's jagex2.wordenc.ChatText is the other half - keep the two the same, it is the protocol
// (and a change to it means a new ENGINE_REVISION, as 381 was for this one).
//
// THE CHARACTERS are the ones the chatbox lets you type: space to 'z' in ASCII - letters of both
// cases, digits and ! " # $ % & ' ( ) * + , - . / : ; < = > ? @ [ \ ] ^ _ `. Anything else is
// dropped. Not '|' (a line break in a game message), '~' (the debugproc prefix) or '{' '}'.
//
// CASE is kept as typed; only a leading lower-case letter is capitalised ("hello" reads "Hello", as
// in 2006). ":D", "PvP" and "xD" further in are left alone. The censor (WordEnc.filter) reads a
// lower-cased copy and masks by position, so it does not undo this.
export default class ChatText {
    static readonly MAX_LENGTH = 80;

    // Drawn as '@' by the client's fonts (PixFont) and measured as '@' by FontType, but no tag reader
    // looks for it. Player text going into a line that IS read for tags (a ::yell is a game message)
    // has its '@' swapped for this, so "@cr2@" prints as typed instead of the gold crown.
    static readonly LITERAL_AT = '\u007f';

    static allowed(char: string): boolean {
        return char >= ' ' && char <= 'z';
    }

    /** Characters outside the set dropped, runs of spaces made one, trimmed, cut to 80, a leading letter capitalised. */
    static format(typed: string): string {
        let out = '';
        for (const char of typed) {
            if (!this.allowed(char)) {
                continue;
            }
            if (char === ' ' && (out.length === 0 || out.endsWith(' '))) {
                continue;
            }
            out += char;
        }
        out = out.trim();
        if (out.length > this.MAX_LENGTH) {
            out = out.substring(0, this.MAX_LENGTH).trim();
        }
        if (out.length > 0 && out[0] >= 'a' && out[0] <= 'z') {
            out = out[0].toUpperCase() + out.substring(1);
        }
        return out;
    }

    /** A line from a client: the packet's bytes as characters, then format. */
    static decode(bytes: Uint8Array): string {
        let text = '';
        for (let i = 0; i < bytes.length && i < this.MAX_LENGTH * 2; i++) {
            text += String.fromCharCode(bytes[i]);
        }
        return this.format(text);
    }

    /** Write a line (already formatted and filtered) as one byte per character. */
    static pack(buf: Packet, text: string): void {
        for (let i = 0; i < text.length && i < this.MAX_LENGTH; i++) {
            const char = text.charAt(i);
            if (this.allowed(char)) {
                buf.p1(char.charCodeAt(0));
            }
        }
    }

    /** The bytes pack would write - what goes into the public chat block. */
    static encode(text: string): Uint8Array {
        const buf = Packet.alloc(0);
        this.pack(buf, text);
        const out = new Uint8Array(buf.pos);
        buf.pos = 0;
        buf.gdata(out, 0, out.length);
        buf.release();
        return out;
    }

    /** What a client reads back: the bytes as characters, anything outside the set dropped. */
    static unpack(buf: Packet, length: number): string {
        let text = '';
        for (let i = 0; i < length; i++) {
            const char = String.fromCharCode(buf.g1());
            if (this.allowed(char)) {
                text += char;
            }
        }
        return text;
    }

    /** Player text for a line read for tags: every '@' becomes LITERAL_AT, so none of it is a tag. */
    static literal(text: string): string {
        return text.replaceAll('@', this.LITERAL_AT);
    }
}
