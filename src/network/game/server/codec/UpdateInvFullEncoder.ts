import Component from '#/cache/config/Component.js';
import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import UpdateInvFull from '#/network/game/server/model/UpdateInvFull.js';

export default class UpdateInvFullEncoder extends ServerGameMessageEncoder<UpdateInvFull> {
    prot = ServerGameProt.UPDATE_INV_FULL;

    // The number of slots to actually put on the wire: one past the last slot that holds
    // something, rather than the whole component every time.
    //
    // This is safe because the client's UPDATE_INV_FULL handler already zeroes the rest -
    // "for (var112 = var109; var112 < var108.invSlotObjId.length; var112++) invSlotObjId[var112] = 0"
    // - so a short transmit clears the tail instead of leaving stale icons behind. A slot the
    // engine holds as a placeholder is an Item with count 0, not a null, so it counts as
    // occupied and its id still reaches the client.
    //
    // It matters because of the buffer this is written into. ClientSocket.out is one fixed Packet
    // and Packet.p1 goes through DataView.setUint8, which THROWS past the end rather than
    // wrapping, so an inv that encodes larger than the buffer is a hard error in the writer.
    // At up to 7 bytes a slot (id, the 255 marker, a 4-byte count) a 5000-byte buffer held 713
    // slots, which is why the bank could not simply be made bigger. Trimming makes the cost of
    // opening a bank proportional to what is in it - an empty 1410-slot bank went from 4234
    // bytes to 4 - and the buffer was raised to 30000 for the case that is genuinely full.
    private static size(message: UpdateInvFull): number {
        const { component, inv } = message;

        const comType = Component.get(component);
        const capacity = Math.min(inv.capacity, comType.width * comType.height);

        for (let slot = capacity - 1; slot >= 0; slot--) {
            if (inv.get(slot)) {
                return slot + 1;
            }
        }
        return 0;
    }

    encode(buf: Packet, message: UpdateInvFull): void {
        const { component, inv } = message;

        const size = UpdateInvFullEncoder.size(message);

        buf.p2(component);
        buf.p2(size);
        for (let slot = 0; slot < size; slot++) {
            const obj = inv.get(slot);

            if (obj) {
                buf.p2_alt3(obj.id + 1);

                if (obj.count >= 255) {
                    buf.p1_alt2(255);
                    buf.p4_alt1(obj.count);
                } else {
                    buf.p1_alt2(obj.count);
                }
            } else {
                buf.p2_alt3(0);
                buf.p1_alt2(0);
            }
        }
    }

    test(message: UpdateInvFull): number {
        const { inv } = message;

        const size = UpdateInvFullEncoder.size(message);

        // 4, not 3: encode() writes p2(component) and p2(size) before the first slot. Nothing
        // calls test() on this encoder today - it is not on ServerGameMessageEncoder and only
        // rsbuf's renderer ever sizes a Packet from a test() - but a one-byte-short answer is
        // exactly the sort of thing that bites whoever wires it up later.
        let length: number = 0;
        length += 4;
        for (let slot = 0; slot < size; slot++) {
            const obj = inv.get(slot);
            if (obj) {
                length += 2;

                if (obj.count >= 255) {
                    length += 5;
                } else {
                    length += 1;
                }
            } else {
                length += 3;
            }
        }
        return length;
    }
}
