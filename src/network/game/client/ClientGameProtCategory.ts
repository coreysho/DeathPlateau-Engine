export default class ClientGameProtCategory {
    // todo: measure how many events we should expect to receive from the client
    // osrs has this as 50/10 but we know that's not true in rs2
    // todo: determine which packets belong in which category for this era
    static readonly CLIENT_EVENT = new ClientGameProtCategory(0, 20);
    // Old School's 10, not rs2's 5: a PvP switch is several equips, a prayer and an attack clicked
    // inside one tick, and at 5 the rest of it spilled into the next tick, so a switch landed in
    // two halves. Every click still runs in the order it was made.
    static readonly USER_EVENT = new ClientGameProtCategory(1, 10);
    // flood restricted events
    static readonly RESTRICTED_EVENT = new ClientGameProtCategory(2, 2);

    // packet decoding limit per tick, exceeding this ends decoding and picks up where it left off on the next tick
    constructor(
        readonly id: number,
        readonly limit: number
    ) {}
}
