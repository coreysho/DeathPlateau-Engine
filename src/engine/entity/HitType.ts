// The hitsplat sprite index the client draws (content sprites/hitmarks.png, tools/genhitmarks.py).
// 0-4 are 377's own; Old School kept that numbering and carried on, so VENOM and HEAL are Old School's
// 5 and 6. MAX_HIT is Old School's 43 (DAMAGE_MAX_ME), given the next free slot here.
export const enum HitType {
    BLOCK,
    DAMAGE,
    POISON,
    DISEASE_BLOCKED,
    DISEASE,
    VENOM,
    HEAL,
    MAX_HIT
}

// What a client from before hitsplats 5-7 is sent instead (see ClientSocket.legacyHitmarks): venom
// was drawn as poison and a max hit as ordinary damage, which is what it goes on seeing.
export function legacyHitType(type: number): number {
    switch (type) {
        case HitType.VENOM:
            return HitType.POISON;
        case HitType.HEAL:
        case HitType.MAX_HIT:
            return HitType.DAMAGE;
        default:
            return type;
    }
}
