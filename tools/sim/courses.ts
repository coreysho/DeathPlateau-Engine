// THE ROOFTOP COURSES, AS ONE TABLE.
//
// Lifted out of rooftops.ts when a second tool needed it. Three things read this now - rooftops.ts
// (the engine-side suite), courseland.ts (which derives where each obstacle should put you) and
// the course cam in javaclient/tools/clienttests (which runs the lap in the real client) - and a
// course that disagrees between them is a course nobody is really checking.
//
// Draynor and Al Kharid keep their own sims as well - each was written before this table existed
// and carries the lesson that made the next one - but their obstacles are listed here too, so
// courseland.ts can ask the same question of all nine courses.
export type Ob = {
    name: string;
    loc: string;
    x: number;
    z: number;
    level: number;
    land: string; // the constant naming where it puts you down
    xp: string; // the constant naming what it pays
    walk?: string; // the constant naming where the walk starts, for a crossing
    /**
     * THE ONES OLD SCHOOL LETS YOU FAIL, and where a failure drops you.
     *
     * "Failing the obstacle will drop the player below, requiring them to start the course over"
     * - the wiki's Falador hand holds page, which is the only one that spells the mechanic out.
     * So a fall is a LANDING, on the street, and it is the one kind of landing nothing in this
     * build has ever checked. `land` names the constant holding it; coursefall.ts derives it.
     *
     * `dmg` is the inclusive damage range. Old School publishes one for four of the eleven - 1-5
     * on Al Kharid's two, 3-8 on Varrock's clothes line and 3-8 on Falador's hand holds - plus
     * 2-5 on a Varrock wall that is not placed in this build. The other seven take 3-8, which is
     * the only range it gives for a mid or high course.
     */
    fail?: { land: string; dmg: [number, number] };
};
export type Course = {
    key: string;
    /** It has a sim of its own, so the shared rooftop suite leaves it alone unless asked by name. */
    ownSim?: boolean;
    title: string;
    level: number;
    lapXp: number;
    start: [number, number, number]; // where a runner begins, on the street
    obstacles: Ob[];
    /**
     * The Agility level at which this course stops being failable, and the (low, high) pair that
     * puts stat_random on that curve. Fitted by scratch arithmetic against the engine's own
     * formula: value(stop) >= 256, value(stop - 1) <= 255, and value(entry) ~= 225, which is the
     * 88% at level 40 the wiki publishes for Canifis' third gap - the only rate it publishes at
     * all. Rellekka and Ardougne open five levels below their stop level, so their curve is too
     * steep to reach 88% and settles at 94%.
     *
     * Al Kharid's and Varrock's stop levels are NOT published; 20 above entry is the shape of the
     * four that are (Canifis +24, Falador +16, Seers' +19, Pollnivneach +15).
     */
    failStop?: number;
    failRoll?: [number, number];
};

export const COURSES: Course[] = [
    {
        key: 'varrock',
        title: 'VARROCK',
        level: 30,
        lapXp: 2317,
        start: [3221, 3416, 0],
        failStop: 50,
        failRoll: [181, 330],
        obstacles: [
            { name: 'rough wall', loc: 'osrsloc_14412', x: 3221, z: 3414, level: 0, land: 'varrock_land_wall', xp: 'varrock_xp_wall' },
            { name: 'clothes line', loc: 'osrsloc_14413', x: 3213, z: 3414, level: 3, land: 'varrock_land_clothesline', xp: 'varrock_xp_clothesline', walk: 'varrock_clothesline_start', fail: { land: 'varrock_fall_clothesline', dmg: [3, 8] } },
            { name: 'gap 1', loc: 'osrsloc_14414', x: 3200, z: 3416, level: 3, land: 'varrock_land_gap1', xp: 'varrock_xp_gap1' },
            { name: 'gap 2', loc: 'osrsloc_14834', x: 3209, z: 3397, level: 3, land: 'varrock_land_gap2', xp: 'varrock_xp_gap2' },
            { name: 'gap 3', loc: 'osrsloc_14835', x: 3233, z: 3402, level: 3, land: 'varrock_land_gap3', xp: 'varrock_xp_gap3' },
            { name: 'ledge', loc: 'osrsloc_14836', x: 3236, z: 3409, level: 3, land: 'varrock_land_ledge', xp: 'varrock_xp_ledge' },
            { name: 'edge', loc: 'osrsloc_14841', x: 3236, z: 3416, level: 3, land: 'varrock_land_edge', xp: 'varrock_xp_edge' }
        ]
    },
    {
        key: 'canifis',
        title: 'CANIFIS',
        level: 40,
        lapXp: 2400,
        start: [3506, 3488, 0],
        failStop: 64,
        failRoll: [177, 299],
        obstacles: [
            { name: 'tall tree', loc: 'osrsloc_14843', x: 3505, z: 3489, level: 0, land: 'canifis_land_tree', xp: 'canifis_xp_tree' },
            { name: 'gap 1', loc: 'osrsloc_14844', x: 3505, z: 3498, level: 3, land: 'canifis_land_gap1', xp: 'canifis_xp_gap1' },
            { name: 'gap 2', loc: 'osrsloc_14845', x: 3496, z: 3504, level: 3, land: 'canifis_land_gap2', xp: 'canifis_xp_gap2' },
            { name: 'gap 3', loc: 'osrsloc_14848', x: 3485, z: 3499, level: 3, land: 'canifis_land_gap3', xp: 'canifis_xp_gap3', fail: { land: 'canifis_fall_gap3', dmg: [3, 8] } },
            { name: 'gap 4', loc: 'osrsloc_14846', x: 3478, z: 3491, level: 3, land: 'canifis_land_gap4', xp: 'canifis_xp_gap4' },
            { name: 'pole-vault', loc: 'osrsloc_14894', x: 3480, z: 3483, level: 3, land: 'canifis_land_vault', xp: 'canifis_xp_vault' },
            { name: 'gap 5', loc: 'osrsloc_14847', x: 3503, z: 3476, level: 3, land: 'canifis_land_gap5', xp: 'canifis_xp_gap5' },
            { name: 'gap 6', loc: 'osrsloc_14897', x: 3510, z: 3483, level: 3, land: 'canifis_land_gap6', xp: 'canifis_xp_gap6' }
        ]
    },
    {
        key: 'falador',
        title: 'FALADOR',
        level: 50,
        lapXp: 5860,
        start: [3036, 3340, 0],
        failStop: 66,
        failRoll: [131, 319],
        obstacles: [
            { name: 'rough wall', loc: 'osrsloc_14898', x: 3036, z: 3341, level: 0, land: 'falador_land_wall', xp: 'falador_xp_wall' },
            { name: 'tightrope 1', loc: 'osrsloc_14899', x: 3040, z: 3343, level: 3, land: 'falador_land_rope1', xp: 'falador_xp_rope1' },
            { name: 'hand holds', loc: 'osrsloc_14901', x: 3050, z: 3350, level: 3, land: 'falador_land_handholds', xp: 'falador_xp_handholds', fail: { land: 'falador_fall_handholds', dmg: [3, 8] } },
            { name: 'gap 1', loc: 'osrsloc_14903', x: 3048, z: 3359, level: 3, land: 'falador_land_gap1', xp: 'falador_xp_gap1' },
            { name: 'gap 2', loc: 'osrsloc_14904', x: 3044, z: 3361, level: 3, land: 'falador_land_gap2', xp: 'falador_xp_gap2' },
            { name: 'tightrope 2', loc: 'osrsloc_14905', x: 3034, z: 3361, level: 3, land: 'falador_land_rope2', xp: 'falador_xp_rope2' },
            { name: 'tightrope 3', loc: 'osrsloc_14911', x: 3026, z: 3353, level: 3, land: 'falador_land_rope3', xp: 'falador_xp_rope3' },
            { name: 'gap 3', loc: 'osrsloc_14919', x: 3016, z: 3352, level: 3, land: 'falador_land_gap3', xp: 'falador_xp_gap3' },
            { name: 'ledge 1', loc: 'osrsloc_14920', x: 3015, z: 3345, level: 3, land: 'falador_land_ledge1', xp: 'falador_xp_ledge1' },
            { name: 'ledge 2', loc: 'osrsloc_14921', x: 3011, z: 3343, level: 3, land: 'falador_land_ledge2', xp: 'falador_xp_ledge2' },
            { name: 'ledge 3', loc: 'osrsloc_14922', x: 3012, z: 3334, level: 3, land: 'falador_land_ledge3', xp: 'falador_xp_ledge3' },
            { name: 'ledge 4', loc: 'osrsloc_14923', x: 3014, z: 3335, level: 3, land: 'falador_land_ledge4', xp: 'falador_xp_ledge4' },
            { name: 'ledge 5', loc: 'osrsloc_14924', x: 3018, z: 3332, level: 3, land: 'falador_land_ledge5', xp: 'falador_xp_ledge5' },
            { name: 'edge', loc: 'osrsloc_14925', x: 3025, z: 3332, level: 3, land: 'falador_land_edge', xp: 'falador_xp_edge' }
        ]
    },
    {
        key: 'seers',
        title: "SEERS' VILLAGE",
        level: 60,
        lapXp: 5700,
        start: [2729, 3490, 0],
        failStop: 79,
        failRoll: [133, 287],
        obstacles: [
            { name: 'wall', loc: 'osrsloc_14927', x: 2729, z: 3489, level: 0, land: 'seers_land_wall', xp: 'seers_xp_wall' },
            { name: 'gap 1', loc: 'osrsloc_14928', x: 2720, z: 3492, level: 3, land: 'seers_land_gap1', xp: 'seers_xp_gap1', fail: { land: 'seers_fall_gap1', dmg: [3, 8] } },
            { name: 'tightrope', loc: 'osrsloc_14932', x: 2710, z: 3489, level: 2, land: 'seers_land_rope', xp: 'seers_xp_rope', fail: { land: 'seers_fall_rope', dmg: [3, 8] } },
            { name: 'gap 2', loc: 'osrsloc_14929', x: 2710, z: 3476, level: 2, land: 'seers_land_gap2', xp: 'seers_xp_gap2' },
            { name: 'gap 3', loc: 'osrsloc_14930', x: 2700, z: 3469, level: 3, land: 'seers_land_gap3', xp: 'seers_xp_gap3' },
            { name: 'edge', loc: 'osrsloc_14931', x: 2703, z: 3461, level: 2, land: 'seers_land_edge', xp: 'seers_xp_edge' }
        ]
    },
    {
        key: 'pollnivneach',
        title: 'POLLNIVNEACH',
        level: 70,
        lapXp: 8900,
        start: [3351, 2961, 0],
        failStop: 85,
        failRoll: [85, 284],
        obstacles: [
            { name: 'basket', loc: 'osrsloc_14935', x: 3351, z: 2962, level: 0, land: 'pollnivneach_land_basket', xp: 'pollnivneach_xp_basket' },
            { name: 'market stall', loc: 'osrsloc_14936', x: 3349, z: 2970, level: 1, land: 'pollnivneach_land_stall', xp: 'pollnivneach_xp_stall', fail: { land: 'pollnivneach_fall_stall', dmg: [3, 8] } },
            { name: 'banner', loc: 'osrsloc_14937', x: 3356, z: 2978, level: 1, land: 'pollnivneach_land_banner', xp: 'pollnivneach_xp_banner' },
            { name: 'gap', loc: 'osrsloc_14938', x: 3363, z: 2976, level: 1, land: 'pollnivneach_land_gap', xp: 'pollnivneach_xp_gap' },
            { name: 'tree 1', loc: 'osrsloc_14939', x: 3367, z: 2977, level: 1, land: 'pollnivneach_land_tree1', xp: 'pollnivneach_xp_tree1' },
            { name: 'rough wall', loc: 'osrsloc_14940', x: 3365, z: 2982, level: 1, land: 'pollnivneach_land_wall', xp: 'pollnivneach_xp_wall' },
            { name: 'monkeybars', loc: 'osrsloc_14941', x: 3358, z: 2985, level: 2, land: 'pollnivneach_land_bars', xp: 'pollnivneach_xp_bars' },
            { name: 'tree 2', loc: 'osrsloc_14944', x: 3359, z: 2996, level: 2, land: 'pollnivneach_land_tree2', xp: 'pollnivneach_xp_tree2' },
            { name: 'drying line', loc: 'osrsloc_14945', x: 3363, z: 3000, level: 2, land: 'pollnivneach_land_line', xp: 'pollnivneach_xp_line' }
        ]
    },
    {
        key: 'rellekka',
        title: 'RELLEKKA',
        level: 80,
        lapXp: 7800,
        start: [2625, 3678, 0],
        failStop: 85,
        failRoll: [14, 296],
        obstacles: [
            { name: 'rough wall', loc: 'osrsloc_14946', x: 2625, z: 3677, level: 0, land: 'rellekka_land_wall', xp: 'rellekka_xp_wall' },
            { name: 'gap 1', loc: 'osrsloc_14947', x: 2621, z: 3669, level: 3, land: 'rellekka_land_gap1', xp: 'rellekka_xp_gap1' },
            { name: 'tightrope 1', loc: 'osrsloc_14987', x: 2623, z: 3658, level: 3, land: 'rellekka_land_rope1', xp: 'rellekka_xp_rope1', fail: { land: 'rellekka_fall_rope1', dmg: [3, 8] } },
            { name: 'gap 2', loc: 'osrsloc_14990', x: 2629, z: 3656, level: 3, land: 'rellekka_land_gap2', xp: 'rellekka_xp_gap2' },
            { name: 'gap 3', loc: 'osrsloc_14991', x: 2643, z: 3654, level: 3, land: 'rellekka_land_gap3', xp: 'rellekka_xp_gap3' },
            { name: 'tightrope 2', loc: 'osrsloc_14992', x: 2647, z: 3663, level: 3, land: 'rellekka_land_rope2', xp: 'rellekka_xp_rope2' },
            { name: 'pile of fish', loc: 'osrsloc_14994', x: 2654, z: 3676, level: 3, land: 'rellekka_land_fish', xp: 'rellekka_xp_fish' }
        ]
    },
    {
        key: 'ardougne',
        title: 'ARDOUGNE',
        level: 90,
        lapXp: 8890,
        start: [2673, 3297, 0],
        failStop: 95,
        failRoll: [0, 266],
        obstacles: [
            { name: 'wooden beams', loc: 'osrsloc_15608', x: 2673, z: 3298, level: 0, land: 'ardougne_land_beams', xp: 'ardougne_xp_beams' },
            { name: 'gap 1', loc: 'osrsloc_15609', x: 2670, z: 3310, level: 3, land: 'ardougne_land_gap1', xp: 'ardougne_xp_gap1', fail: { land: 'ardougne_fall_gap1', dmg: [3, 8] } },
            { name: 'plank', loc: 'osrsloc_26635', x: 2661, z: 3318, level: 3, land: 'ardougne_land_plank', xp: 'ardougne_xp_plank' },
            { name: 'gap 2', loc: 'osrsloc_15610', x: 2653, z: 3317, level: 3, land: 'ardougne_land_gap2', xp: 'ardougne_xp_gap2', fail: { land: 'ardougne_fall_gap2', dmg: [3, 8] } },
            { name: 'gap 3', loc: 'osrsloc_15611', x: 2653, z: 3308, level: 3, land: 'ardougne_land_gap3', xp: 'ardougne_xp_gap3' },
            { name: 'steep roof', loc: 'osrsloc_28912', x: 2654, z: 3300, level: 3, land: 'ardougne_land_roof', xp: 'ardougne_xp_roof' },
            { name: 'gap 4', loc: 'osrsloc_15612', x: 2656, z: 3296, level: 3, land: 'ardougne_land_gap4', xp: 'ardougne_xp_gap4' }
        ]
    },
    {
        key: 'draynor',
        ownSim: true,
        title: 'DRAYNOR VILLAGE',
        level: 10,
        lapXp: 1200,
        start: [3103, 3280, 0],
        obstacles: [
            { name: 'rough wall', loc: 'osrsloc_11404', x: 3103, z: 3279, level: 0, land: 'draynor_land_wall', xp: 'draynor_xp_wall' },
            { name: 'tightrope 1', loc: 'osrsloc_11405', x: 3098, z: 3277, level: 3, land: 'draynor_land_rope1', xp: 'draynor_xp_rope1' },
            { name: 'tightrope 2', loc: 'osrsloc_11406', x: 3092, z: 3276, level: 3, land: 'draynor_land_rope2', xp: 'draynor_xp_rope2' },
            { name: 'narrow wall', loc: 'osrsloc_11430', x: 3089, z: 3264, level: 3, land: 'draynor_land_narrow', xp: 'draynor_xp_narrow' },
            { name: 'wall', loc: 'osrsloc_11630', x: 3088, z: 3256, level: 3, land: 'draynor_land_jumpup', xp: 'draynor_xp_jumpup' },
            { name: 'gap', loc: 'osrsloc_11631', x: 3095, z: 3255, level: 3, land: 'draynor_land_gap', xp: 'draynor_xp_gap' },
            { name: 'crate', loc: 'osrsloc_11632', x: 3102, z: 3261, level: 3, land: 'draynor_land_crate', xp: 'draynor_xp_crate' }
        ]
    },
    {
        key: 'alkharid',
        ownSim: true,
        title: 'AL KHARID',
        level: 20,
        lapXp: 2160,
        start: [3273, 3196, 0],
        failStop: 40,
        failRoll: [196, 345],
        obstacles: [
            { name: 'rough wall', loc: 'osrsloc_11633', x: 3273, z: 3195, level: 0, land: 'alkharid_land_wall', xp: 'alkharid_xp_wall' },
            { name: 'tightrope 1', loc: 'osrsloc_14398', x: 3272, z: 3181, level: 3, land: 'alkharid_land_rope1', xp: 'alkharid_xp_rope1', walk: 'alkharid_rope1_start', fail: { land: 'alkharid_fall_rope1', dmg: [1, 5] } },
            { name: 'cable', loc: 'osrsloc_14402', x: 3269, z: 3166, level: 3, land: 'alkharid_land_cable', xp: 'alkharid_xp_cable' },
            { name: 'zip line', loc: 'osrsloc_14403', x: 3302, z: 3163, level: 3, land: 'alkharid_land_zip', xp: 'alkharid_xp_zip', fail: { land: 'alkharid_fall_zip', dmg: [1, 5] } },
            { name: 'tropical tree', loc: 'osrsloc_14404', x: 3318, z: 3166, level: 1, land: 'alkharid_land_tree', xp: 'alkharid_xp_tree' },
            { name: 'beams', loc: 'osrsloc_11634', x: 3316, z: 3179, level: 2, land: 'alkharid_land_beams', xp: 'alkharid_xp_beams' },
            { name: 'tightrope 2', loc: 'osrsloc_14409', x: 3313, z: 3186, level: 3, land: 'alkharid_land_rope2', xp: 'alkharid_xp_rope2', walk: 'alkharid_rope2_start' },
            { name: 'gap', loc: 'osrsloc_14399', x: 3300, z: 3193, level: 3, land: 'alkharid_land_gap', xp: 'alkharid_xp_gap' }
        ]
    }
];
