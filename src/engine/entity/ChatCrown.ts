/**
 * The rank icon a staff member's name carries in chat, as the number the client is sent.
 *
 *   0  no icon      1  silver crown      2  gold crown      4  purple crown (developer)
 *
 * staffModLevel runs 0-4+ on the account: 1 player moderator, 2 moderator, 3 administrator, 4
 * developer. The client draws 2 and 3 alike as the gold crown, so 3 is folded into 2 here rather
 * than sent; 4 and above is the developer crown the client added with the XP-mode badges (it is
 * imageModIcons[5], "@cr6@" - see the client's ChatIcons).
 *
 * This was three separate clamps - Math.min(level, 2) for public chat and for the login packet,
 * and min(level, 3) for private messages - which is why a developer showed the admin crown. All
 * three now ask this, so the icon cannot differ by which way the words were sent.
 *
 * The rare-drop broadcasts and ::yell build their icons in content (general/scripts/broadcast.rs2,
 * ~broadcast_name) from the same thresholds.
 */
export function chatCrown(staffModLevel: number): number {
    if (staffModLevel >= 4) {
        return 4;
    }
    if (staffModLevel >= 2) {
        return 2;
    }
    return staffModLevel > 0 ? 1 : 0;
}
