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

            this.optimizeComponent(componentRooms, componentPositions, roomLookup);

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

    // Local search: BFS placement order leaves long stretched edges when a
    // room is reached first via a roundabout path. Each room tries cells
    // adjacent to its directional neighbors; a move is accepted only when
    // ALL its compass edges stay sign-correct and its total edge length
    // drops, so quality strictly improves and the loop terminates.
    optimizeComponent(componentRooms, componentPositions, roomLookup) {
        if (componentRooms.length < 3) {
            this.compactComponent(componentPositions);
            return;
        }

        // roomId -> [{otherId, sx, sy}] expected sign of (other - this)
        const adjacency = new Map();
        const addEdge = (id, entry) => {
            if (!adjacency.has(id)) adjacency.set(id, []);
            adjacency.get(id).push(entry);
        };
        for (const room of componentRooms) {
            if (!room.wayto) continue;
            for (const targetId of Object.keys(room.wayto)) {
                const targetIdNum = parseInt(targetId);
                if (!componentPositions.has(targetIdNum)) continue;
                const direction = this.connectionAnalyzer.getDirectionForConnection(room, targetId, roomLookup);
                if (!direction || !this.compassDirections.has(direction)) continue;
                const offset = this.directionOffsets[direction];
                addEdge(room.id, { otherId: targetIdNum, sx: Math.sign(offset.x), sy: Math.sign(offset.y) });
                addEdge(targetIdNum, { otherId: room.id, sx: -Math.sign(offset.x), sy: -Math.sign(offset.y) });
            }
        }

        const occupied = new Map();
        for (const [id, pos] of componentPositions) occupied.set(`${pos.x},${pos.y}`, id);

        let improved = true;
        let passes = 0;
        while (improved && passes < 12) {
            improved = false;
            passes++;

            for (const room of componentRooms) {
                const roomEdges = adjacency.get(room.id);
                if (!roomEdges || roomEdges.length === 0) continue;
                const current = componentPositions.get(room.id);

                let currentCost = 0;
                for (const e of roomEdges) {
                    const other = componentPositions.get(e.otherId);
                    currentCost += Math.max(Math.abs(other.x - current.x), Math.abs(other.y - current.y));
                }

                // candidates: the ideal cell beside each neighbor plus ring 1,
                // and ring 1 around the current spot so rooms can drift
                // stepwise toward distant neighbors across passes
                const candidates = new Set();
                for (const e of roomEdges) {
                    const other = componentPositions.get(e.otherId);
                    const ix = other.x - e.sx, iy = other.y - e.sy;
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            candidates.add(`${ix + dx},${iy + dy}`);
                        }
                    }
                }
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        candidates.add(`${current.x + dx},${current.y + dy}`);
                    }
                }

                let best = null;
                let bestCost = currentCost;
                for (const key of candidates) {
                    if (occupied.has(key)) continue;
                    const comma = key.indexOf(',');
                    const cx = Number(key.slice(0, comma));
                    const cy = Number(key.slice(comma + 1));
                    let cost = 0;
                    let valid = true;
                    for (const e of roomEdges) {
                        const other = componentPositions.get(e.otherId);
                        const dx = other.x - cx, dy = other.y - cy;
                        if (Math.sign(dx) !== e.sx || Math.sign(dy) !== e.sy) { valid = false; break; }
                        cost += Math.max(Math.abs(dx), Math.abs(dy));
                    }
                    if (valid && cost < bestCost) {
                        bestCost = cost;
                        best = { x: cx, y: cy };
                    }
                }

                if (best) {
                    occupied.delete(`${current.x},${current.y}`);
                    occupied.set(`${best.x},${best.y}`, room.id);
                    current.x = best.x;
                    current.y = best.y;
                    improved = true;
                }
            }
        }

        this.compactComponent(componentPositions);
    }

    // Collapse fully-empty rows and columns. Relative order of all rooms is
    // preserved, so every edge keeps its direction signs.
    compactComponent(componentPositions) {
        const positions = [...componentPositions.values()];
        if (positions.length === 0) return;
        const xs = [...new Set(positions.map(p => p.x))].sort((a, b) => a - b);
        const ys = [...new Set(positions.map(p => p.y))].sort((a, b) => a - b);
        const xMap = new Map(xs.map((x, i) => [x, i]));
        const yMap = new Map(ys.map((y, i) => [y, i]));
        for (const pos of positions) {
            pos.x = xMap.get(pos.x);
            pos.y = yMap.get(pos.y);
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
