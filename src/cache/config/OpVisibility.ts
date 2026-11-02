// custom (2026-11-02) - "is this right-click option hidden?", in ONE place.
//
// FOUND BY tools/sim/opsweep.ts. The content writes this marker both ways - 674 `hidden` and 103
// `Hidden` across the configs - and the two sides of the connection disagreed about which counted:
//
//   client   jagex2/config/LocType.java and friends: equalsIgnoreCase("hidden"), so the client
//            drops BOTH spellings and never draws either option.
//   server   OpLocHandler, OpNpcHandler and OpObjHandler compared === 'hidden', case-sensitive, so
//            for the 103 capitalised ones the server's "bad client: that option is hidden" check
//            did not fire. The option a real client will not even draw was accepted if sent.
//
// Nothing a normal player does reaches it, because a normal client never offers the click. A client
// that sends the packet anyway got the interaction - or, where no trigger claimed it, defaultOp.
// Matching the client is the fix, and having one function to match it in is what stops the two
// drifting apart again.
export function isVisibleOp(label: string | null | undefined): label is string {
    return !!label && label.toLowerCase() !== 'hidden';
}

export function isHiddenOp(label: string | null | undefined): boolean {
    return !isVisibleOp(label);
}
