import { randomUUID } from 'crypto';

import { NetworkPlayer } from '#/engine/entity/NetworkPlayer.js';
import Isaac from '#/io/Isaac.js';
import Packet from '#/io/Packet.js';


export default abstract class ClientSocket {
    uuid = randomUUID();
    remoteAddress = 'unknown';
    totalBytesRead = 0;
    totalBytesWritten = 0;

    state = 0;
    player: NetworkPlayer | null = null;
    encryptor: Isaac | null = null;
    decryptor: Isaac | null = null;

    in = Packet.alloc(65535); // node won't let us read from the socket as a stream so we buffer it ourselves
    // alloc(2) is 30000 bytes, not alloc(1)'s 5000. One server message is encoded into this
    // buffer and sent, and Packet's writes go through DataView, which THROWS past the end instead
    // of wrapping - so the largest single message the server can ever send has to fit. That used
    // to be an inv update, at up to 7 bytes a slot: 5000 bytes held 713 slots and the 1410-slot
    // bank needs 9873 in the worst case. The client's inbound buffer was raised to match.
    out = Packet.alloc(2);

    opcode = -1; // current opcode being read
    waiting = 0; // bytes to wait for (if any)

    buffer(data: Buffer) {
        if (data.length + this.in.pos > this.in.length) {
            this.close();
            return;
        }

        this.in.pdata(data, 0, data.length);
    }

    // available bytes we can read
    get available() {
        return this.in.pos;
    }

    // remaining bytes we can buffer
    get remaining() {
        return this.in.length - this.in.pos;
    }

    read(dest: Uint8Array, offset: number, length: number) {
        if (this.available < length) {
            return false;
        }

        // copy data to dest
        dest.set(this.in.data.subarray(0, length), offset);
        this.in.pos -= length;

        // shift buffer to the next read
        this.in.data.set(this.in.data.subarray(length), 0);

        return true;
    }

    abstract send(src: Uint8Array): void;
    abstract close(): void;
    abstract terminate(): void;
}
