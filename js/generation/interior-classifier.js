// Interior Classifier - decides which components are inside buildings.
//
// The game's own "leave this building" verb is the primary signal: a
// component is an interior when any of its rooms has a literal `out` exit
// (shops, halls, lockers, festival wagons). Weatherless rooms
// (climate/terrain "none") back this up for interiors that never use `out`.
// Classification is per component: cardinal edges never cross a doorway, so
// a shop's entry and its back rooms arrive as one unit.
export class InteriorClassifier {
    classify(groups, roomLookup) {
        const componentOf = new Map();
        groups.forEach(g => g.rooms.forEach(r => componentOf.set(r.id, g.index)));

        const interiorGroups = new Set();
        for (const group of groups) {
            if (this.isInteriorComponent(group, componentOf)) {
                interiorGroups.add(group.index);
            }
        }

        // Entrances: edges from an outdoor room into an interior component.
        const entrances = new Map();      // interior groupIndex -> [{outdoorRoomId, interiorRoomId}]
        const entranceRoomIds = new Set(); // outdoor rooms that host a doorway
        for (const group of groups) {
            if (interiorGroups.has(group.index)) continue;
            for (const room of group.rooms) {
                for (const targetId of Object.keys(room.wayto ?? {})) {
                    const targetIdNum = parseInt(targetId);
                    const targetGroup = componentOf.get(targetIdNum);
                    if (targetGroup === undefined || !interiorGroups.has(targetGroup)) continue;
                    if (!entrances.has(targetGroup)) entrances.set(targetGroup, []);
                    entrances.get(targetGroup).push({ outdoorRoomId: room.id, interiorRoomId: targetIdNum });
                    entranceRoomIds.add(room.id);
                }
            }
        }

        return { interiorGroups, entrances, entranceRoomIds };
    }

    isInteriorComponent(group, componentOf) {
        let weatherless = 0;
        for (const room of group.rooms) {
            for (const [targetId, way] of Object.entries(room.wayto ?? {})) {
                if (typeof way !== 'string' || way.toLowerCase().trim() !== 'out') continue;
                // `out` is only a doorway when it LEAVES this component. An
                // `out` that stays inside means the component contains its
                // own outdoors (e.g. grottos off a beach) - not a building.
                if (componentOf.get(parseInt(targetId)) !== group.index) {
                    return true;
                }
            }
            if ((room.climate ?? '') === 'none' && (room.terrain ?? '') === 'none') {
                weatherless++;
            }
        }
        return weatherless > 0 && weatherless === group.rooms.length;
    }

    // "[Hamehela's Magic Shoppe]" / "[Manor House, Foyer]" -> building name
    buildingName(group) {
        const counts = new Map();
        for (const room of group.rooms) {
            const title = room.title?.[0] ?? '';
            const match = title.match(/^\[([^,\]]+)/);
            if (match) {
                const name = match[1].trim();
                counts.set(name, (counts.get(name) ?? 0) + 1);
            }
        }
        let best = null, bestCount = 0;
        for (const [name, count] of counts) {
            if (count > bestCount) { best = name; bestCount = count; }
        }
        return best;
    }
}
