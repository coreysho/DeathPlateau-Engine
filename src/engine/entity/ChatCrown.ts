/**
 * The rank icon a staff member's name carries in chat, as the number the client is sent.
 *
 *   0  no icon      1  silver crown      2  gold crown
 *   4  purple crown (developer)          5  red crown (owner)
 *   6  blue and gold crown (a second owner)
 *   7  grey emblem (veteran - gunmetal, recoloured with the capes 2026-11-11; the only one
 *      here that is not a crown)
 *   8  blue roundel (helper - a rank, but not a staffModLevel one, and carries no powers)
 *
 * staffModLevel on the account: 1 player moderator, 2 moderator, 3 administrator, 4 developer,
 * 5 owner, 6 a second owner with a crown of their own. The client draws 2 and 3 alike as the gold crown, so 3 is folded into 2 here rather than
 * sent. 4 is the developer crown the client added with the XP-mode badges (imageModIcons[5],
 * "@cr6@"), 5 the owner's (imageModIcons[6], "@cr7@"), 6 and above the
 * blue and gold owner's (imageModIcons[7], "@cr8@") - see the client's ChatIcons. An
 * owner of either crown keeps every developer power: every rank check in the engine and content is "at least".
 *
 * This was three separate clamps - Math.min(level, 2) for public chat and for the login packet,
 * and min(level, 3) for private messages - which is why a developer showed the admin crown. All
 * three now ask this, so the icon cannot differ by which way the words were sent.
 *
 * The rare-drop broadcasts, ::yell and the announcements build their icons in content
 * (general/scripts/broadcast.rs2, ~broadcast_name). They used to rebuild the ladder from
 * staffmodlevel, which cannot reach crowns 7 and 8 at all - they are account flags, not staff
 * levels - so a veteran's yell and a veteran's rare drop went out with the XP badge and no emblem
 * while the same player's icon showed over their head and on their public chat. They now read the
 * chatcrown script op (2026-11-13), which is this function, so the icon cannot differ by which way
 * the words were sent.
 *
 * WHO MAY BE SENT CROWN 7 OR 8. The appearance block (Player.chatIcons), the chatcrown op, and
 * private messages. The other two callers pass staffModLevel alone and MUST keep doing so - these
 * are rights checks wearing an icon's clothes:
 *
 *   - World's login packet, because the client stores that byte as Client.staffmodlevel and gates
 *     the "Report abuse" option, the mute option and ::clientdrop / ::lag / ::prefetchmusic on it.
 *     7 passes every one of those checks.
 *   - MessagePublicHandler's chatRights, because the client decides a public line's message type
 *     from it (staff lines are type 1, players' type 2) as well as drawing a fallback icon.
 *
 * And one more that is not a caller but reads the same number off the wire: the friend server's
 * FriendServerRepository.register enrols anything above staffLvl 1 as staff. That is why a private
 * message carries the icon in a SEPARATE `crown` field from `staffLvl` rather than reusing it -
 * sending crown 7 as a staff level would make every veteran staff on the friend server.
 *
 * MessagePrivateEncoder sends crowns 7 and 8 as of 2026-11-13, on the owner's call. It used to pass
 * staffModLevel alone on the argument that a crown in a private message is how a player knows a
 * real moderator is writing to them and an emblem would dilute it; the ranks now show everywhere a
 * name is drawn instead, which is the simpler rule to hold in your head.
 */
export function chatCrown(staffModLevel: number, veteran: boolean = false, helper: boolean = false): number {
    if (staffModLevel >= 6) {
        return 6;
    }
    if (staffModLevel >= 5) {
        return 5;
    }
    if (staffModLevel >= 4) {
        return 4;
    }
    if (staffModLevel >= 2) {
        return 2;
    }
    if (staffModLevel > 0) {
        return 1;
    }
    // STAFF, THEN HELPER, THEN VETERAN, and the order is an argument rather than a convention.
    // A staff crown is the one that carries powers, so it is the one worth seeing. A helper's
    // roundel answers "who can I ask about this, now", which a player can act on. A veteran's
    // emblem says how long somebody has been here, which is ornament. Nobody needs two icons
    // saying who they are, so exactly one is returned.
    if (helper) {
        return 8;
    }
    return veteran ? 7 : 0;
}
