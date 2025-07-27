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
                        const direction = this.connectionAnalyzer.getDirectionForConnection(room, targetId);
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
            
            // Create a temporary positions map for this component
            const componentPositions = new Map();
            const componentRooms = [];
            
            // BFS for this connected component
            const queue = [{ room: nextStart, x: 0, y: 0 }];
            componentPositions.set(nextStart.id, { x: 0, y: 0 });
            componentRooms.push(nextStart);
            unpositioned.delete(nextStart.id);
            
            while (queue.length > 0) {
                const { room, x, y } = queue.shift();
                
                // Check all connections from this room
                if (room.wayto) {
                    for (const targetId of Object.keys(room.wayto)) {
                        const targetIdNum = parseInt(targetId);
                        const targetRoom = roomLookup.get(targetIdNum);
                        
                        // Skip if target room not in our set or already positioned
                        if (!targetRoom || !unpositioned.has(targetRoom.id)) {
                            continue;
                        }
                        
                        // Get direction for this connection
                        const direction = this.connectionAnalyzer.getDirectionForConnection(room, targetId);
                        
                        if (direction) {
                            const offset = this.directionOffsets[direction];
                            if (offset) {
                                let newX = x + offset.x;
                                let newY = y + offset.y;
                                
                                // Check for position conflicts within this component
                                let attempts = 0;
                                while (this.isPositionOccupied(componentPositions, newX, newY) && attempts < 8) {
                                    // Try slight offsets to resolve conflicts
                                    switch (attempts) {
                                        case 0: newX += 1; break;
                                        case 1: newX -= 2; break;
                                        case 2: newX += 1; newY += 1; break;
                                        case 3: newY -= 2; break;
                                        case 4: newX += 2; break;
                                        case 5: newX -= 4; break;
                                        case 6: newY += 3; break;
                                        case 7: newX += 2; newY += 2; break;
                                    }
                                    attempts++;
                                }
                                
                                if (!this.isPositionOccupied(componentPositions, newX, newY)) {
                                    componentPositions.set(targetRoom.id, { x: newX, y: newY });
                                    componentRooms.push(targetRoom);
                                    unpositioned.delete(targetRoom.id);
                                    queue.push({ room: targetRoom, x: newX, y: newY });
                                    
                                    console.log(`Positioned room ${targetRoom.id} at (${newX}, ${newY}) via ${direction} from room ${room.id}`);
                                }
                            }
                        }
                    }
                }
            }
            
            // Store group info with component positions
            const groupIndex = groups.length;
            groups.push({
                index: groupIndex,
                rooms: componentRooms,
                positions: new Map(componentPositions) // Store original positions
            });
        }
        
        console.log(`Positioned ${rooms.length} rooms in ${groups.length} components`);
        
        return { positions, groups };
    }

    isPositionOccupied(positions, x, y) {
        return Array.from(positions.values()).some(pos => pos.x === x && pos.y === y);
    }
}