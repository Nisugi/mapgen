// Room Positioner - calculates room positions based on connections
export class RoomPositioner {
    constructor(connectionAnalyzer) {
        this.connectionAnalyzer = connectionAnalyzer;

        // Direction mappings
        this.directionOffsets = {
            'north': { x: 0, y: -1 },
            'south': { x: 0, y: 1 },
            'east': { x: 1, y: 0 },
            'west': { x: -1, y: 0 },
            'northeast': { x: 1, y: -1 },
            'northwest': { x: -1, y: -1 },
            'southeast': { x: 1, y: 1 },
            'southwest': { x: -1, y: 1 },
            'up': { x: 0, y: -1 },
            'down': { x: 0, y: 1 },
            'out': { x: 1, y: 0 }
        };

        // Directions with true 2D geometry — up/down/out are placement
        // conveniences, not constraints, so validation ignores them.
        this.compassDirections = new Set([
            'north', 'south', 'east', 'west',
            'northeast', 'northwest', 'southeast', 'southwest'
        ]);
    }

    calculateRoomPositionsWithGroups(rooms, roomLookup) {
        const positions = new Map();
        const groups = [];

        // Multiple passes to find connected components
        const unpositioned = new Set(rooms.map(r => r.id));

        while (unpositioned.size > 0) {
            // Find the best starting room for this component
            let nextStart = null;
            let nextStartConnections = 0;

            for (const roomId of unpositioned) {
                const room = roomLookup.get(roomId);
                if (room && room.wayto) {
                    const validConnections = Object.keys(room.wayto).filter(targetId => {
                        const direction = this.connectionAnalyzer.getDirectionForConnection(room, targetId, roomLookup);
                        return direction && roomLookup.has(parseInt(targetId));
                    }).length;

                    if (validConnections > nextStartConnections) {
                        nextStartConnections = validConnections;
                        nextStart = room;
                    }
                }
            }

            if (!nextStart) {
                // No more connected rooms, pick any remaining room
                nextStart = roomLookup.get(Array.from(unpositioned)[0]);
            }

            console.log(`Starting new component with room ${nextStart.id}`);

            const componentPositions = new Map();
            const componentRooms = [];

            // BFS for this connected component. The queue holds room ids only:
            // grid rips shift already-placed rooms, so coordinates must be
            // re-read from componentPositions at processing time.
            const queue = [nextStart.id];
            componentPositions.set(nextStart.id, { x: 0, y: 0 });
            componentRooms.push(nextStart);
            unpositioned.delete(nextStart.id);

            while (queue.length > 0) {
                const roomId = queue.shift();
                const room = roomLookup.get(roomId);

                if (!room || !room.wayto) continue;

                for (const targetId of Object.keys(room.wayto)) {
                    const targetIdNum = parseInt(targetId);
                    const targetRoom = roomLookup.get(targetIdNum);

                    // Skip if target room not in our set or already positioned
                    if (!targetRoom || !unpositioned.has(targetRoom.id)) {
                        continue;
                    }

                    const direction = this.connectionAnalyzer.getDirectionForConnection(room, targetId, roomLookup);
                    if (!direction) continue;

                    const offset = this.directionOffsets[direction];
                    if (!offset) continue;

                    // Re-read parent position — a rip from a previous
                    // placement in this loop may have moved it.
                    const pos = componentPositions.get(roomId);
                    let targetX = pos.x + offset.x;
                    let targetY = pos.y + offset.y;

                    if (this.isPositionOccupied(componentPositions, targetX, targetY)) {
                        // Grid ripping: open a new row/column so the occupant
                        // slides away and the stated direction stays true.
                        this.ripGrid(componentPositions, pos, offset);
                        const freshPos = componentPositions.get(roomId);
                        targetX = freshPos.x + offset.x;
                        targetY = freshPos.y + offset.y;
                    }

                    if (!this.isPositionOccupied(componentPositions, targetX, targetY)) {
                        componentPositions.set(targetRoom.id, { x: targetX, y: targetY });
                        componentRooms.push(targetRoom);
                        unpositioned.delete(targetRoom.id);
                        queue.push(targetRoom.id);
                    }
                }
            }

            const violations = this.validateComponent(componentRooms, componentPositions, roomLookup);
            if (violations.length > 0) {
                console.warn(`Component ${groups.length}: ${violations.length} direction violation(s)`, violations);
            }

            const groupIndex = groups.length;
            groups.push({
                index: groupIndex,
                rooms: componentRooms,
                positions: new Map(componentPositions), // Store original positions
                violations
            });
        }

        console.log(`Positioned ${rooms.length} rooms in ${groups.length} components`);

        return { positions, groups };
    }

    // Shift a half-plane of placed rooms one cell away from the contested
    // target so the cell (parent + offset) becomes free. The parent is never
    // inside the shifted half-plane, so its position is unchanged. Stretched
    // edges are the accepted cost — directions stay true.
    ripGrid(componentPositions, parentPos, offset) {
        const targetX = parentPos.x + offset.x;
        const targetY = parentPos.y + offset.y;

        if (offset.x > 0) {
            for (const pos of componentPositions.values()) {
                if (pos.x >= targetX) pos.x += 1;
            }
        } else if (offset.x < 0) {
            for (const pos of componentPositions.values()) {
                if (pos.x <= targetX) pos.x -= 1;
            }
        } else if (offset.y > 0) {
            for (const pos of componentPositions.values()) {
                if (pos.y >= targetY) pos.y += 1;
            }
        } else if (offset.y < 0) {
            for (const pos of componentPositions.values()) {
                if (pos.y <= targetY) pos.y -= 1;
            }
        }
    }

    // Check every placed compass edge against its stated direction. Stretched
    // edges pass (signs match); wrong-way edges are reported so bad spots are
    // visible instead of silently wrong.
    validateComponent(componentRooms, componentPositions, roomLookup) {
        const violations = [];

        for (const room of componentRooms) {
            if (!room.wayto) continue;
            const pos = componentPositions.get(room.id);
            if (!pos) continue;

            for (const targetId of Object.keys(room.wayto)) {
                const targetPos = componentPositions.get(parseInt(targetId));
                if (!targetPos) continue;

                const direction = this.connectionAnalyzer.getDirectionForConnection(room, targetId, roomLookup);
                if (!direction || !this.compassDirections.has(direction)) continue;

                const expected = this.directionOffsets[direction];
                const actualX = targetPos.x - pos.x;
                const actualY = targetPos.y - pos.y;

                if (Math.sign(actualX) !== Math.sign(expected.x) || Math.sign(actualY) !== Math.sign(expected.y)) {
                    violations.push({
                        from: room.id,
                        to: parseInt(targetId),
                        direction,
                        actual: { x: actualX, y: actualY }
                    });
                }
            }
        }

        return violations;
    }

    isPositionOccupied(positions, x, y) {
        return Array.from(positions.values()).some(pos => pos.x === x && pos.y === y);
    }
}
