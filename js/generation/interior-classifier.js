// Interior Classifier - decides which components are inside buildings.
//
// Primary signal: the game itself. Indoor rooms print "Obvious exits",
// outdoor rooms print "Obvious paths", and the mapdb stores that string in
// each room's `paths` field (99.5% coverage). A component is an interior
// when its indoor rooms outnumber its outdoor ones.
//
// Fallbacks for rooms without paths data: a literal `out` exit that leaves
// the component (the game's leave-building verb), weatherless rooms
// (climate/terrain "none"), and interiority propagation (a component
// reachable only through interiors is an interior).
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

        // Propagate interiority: rooms behind a second door inside a building
        // form their own component with no `out` exit of their own. If every
        // connection a component has leads into interiors, it is interior too.
        const neighborSets = new Map();
        for (const group of groups) {
            const neighbors = new Set();
            for (const room of group.rooms) {
                for (const targetId of Object.keys(room.wayto ?? {})) {
                    const targetGroup = componentOf.get(parseInt(targetId));
                    if (targetGroup !== undefined && targetGroup !== group.index) {
                        neighbors.add(targetGroup);
                    }
                }
            }
            neighborSets.set(group.index, neighbors);
        }
        let changed = true;
        while (changed) {
            changed = false;
            for (const group of groups) {
                if (interiorGroups.has(group.index)) continue;
                const neighbors = neighborSets.get(group.index);
                if (neighbors.size === 0) continue;
                if ([...neighbors].every(n => interiorGroups.has(n))) {
                    interiorGroups.add(group.index);
                    changed = true;
                }
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

    // "Obvious exits" = indoor, "Obvious paths" = outdoor
    roomSense(room) {
        const paths = room.paths == null ? '' : String(room.paths);
        if (/obvious exits/i.test(paths)) return 'indoor';
        if (/obvious paths/i.test(paths)) return 'outdoor';
        return 'unknown';
    }

    isInteriorComponent(group, componentOf) {
        let indoor = 0, outdoor = 0;
        for (const room of group.rooms) {
            const sense = this.roomSense(room);
            if (sense === 'indoor') indoor++;
            else if (sense === 'outdoor') outdoor++;
        }
        if (indoor !== outdoor && indoor + outdoor > 0) {
            return indoor > outdoor;
        }

        // No usable paths data - fall back to structural signals
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
