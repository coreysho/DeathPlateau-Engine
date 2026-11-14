import { CoordGrid } from '#/engine/CoordGrid.js';
import Zone from '#/engine/zone/Zone.js';
import ZoneGrid from '#/engine/zone/ZoneGrid.js';

export default class ZoneMap {
    static zoneIndex(x: number, z: number, level: number): number {
        return ((x >> 3) & 0x7ff) | (((z >> 3) & 0x7ff) << 11) | ((level & 0x3) << 22);
    }

    static unpackIndex(index: number): CoordGrid {
        const x: number = (index & 0x7ff) << 3;
        const z: number = ((index >> 11) & 0x7ff) << 3;
        const level: number = index >> 22;
        return { x, z, level };
    }

    private readonly zones: Map<number, Zone>;
    private readonly grids: Map<number, ZoneGrid>;

    constructor() {
        this.zones = new Map();
        this.grids = new Map();
    }

    zone(x: number, z: number, level: number): Zone {
        const zoneIndex: number = ZoneMap.zoneIndex(x, z, level);
        let zone: Zone | undefined = this.zones.get(zoneIndex);
        if (typeof zone == 'undefined') {
            zone = new Zone(zoneIndex);
            this.zones.set(zoneIndex, zone);
        }
        return zone;
    }

    zoneByIndex(index: number): Zone {
        let zone: Zone | undefined = this.zones.get(index);
        if (typeof zone == 'undefined') {
            zone = new Zone(index);
            this.zones.set(index, zone);
        }
        return zone;
    }

    grid(level: number): ZoneGrid {
        let grid: ZoneGrid | undefined = this.grids.get(level);
        if (typeof grid == 'undefined') {
            grid = new ZoneGrid();
            this.grids.set(level, grid);
        }
        return grid;
    }

    zoneCount(): number {
        return this.zones.size;
    }

    /**
     * custom (2026-11-02) - the zones that EXIST, without making any. zone() and zoneByIndex()
     * allocate on a miss, which is right for the game and wrong for anything that wants to walk the
     * map: asking for all 16.7 million zone indices to see what is in them builds 16.7 million Zone
     * objects and runs the process out of memory (tools/sim/opsweep.ts did exactly that). A whole-map
     * audit wants the few hundred thousand that the map load actually created.
     */
    existingZones(): IterableIterator<Zone> {
        return this.zones.values();
    }

    locCount(): number {
        let total: number = 0;
        for (const zone of this.zones.values()) {
            total += zone.totalLocs;
        }
        return total;
    }

    objCount(): number {
        let total: number = 0;
        for (const zone of this.zones.values()) {
            total += zone.totalObjs;
        }
        return total;
    }
}
