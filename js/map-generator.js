class MapGenerator {
    constructor() {
        this.config = {
            gridSize: 50,
            colors: {
                default: '#ffffff',
                water: '#8cc6ff',
                exit: '#ff6b6b',
                shop: '#90EE90'
            },
            showRoomIds: true,
            showLabels: true,
            showConnections: true
        };
        
        // Cardinal directions we recognize
        this.cardinalDirections = new Set([
            'north', 'south', 'east', 'west',
            'northeast', 'northwest', 'southeast', 'southwest',
            'up', 'down', 'out'
        ]);
    }

    generateMap(rooms, config = {}) {
        console.log('Generating map for', rooms.length, 'rooms');
        
        // Merge config
        this.config = { ...this.config, ...config };
        
        // Step 1: Build room lookup
        const roomLookup = new Map();
        rooms.forEach(room => roomLookup.set(room.id, room));
        
        // Step 2: Position rooms based on connections
        const positions = this.calculateRoomPositions(rooms, roomLookup);
        
        // Step 3: Generate SVG
        const svg = this.createSVG(rooms, positions, roomLookup);
        
        return svg;
    }

    getDirectionForConnection(room, targetId) {
        // First check wayto for cardinal directions
        if (room.wayto && room.wayto[targetId]) {
            const waytoCommand = room.wayto[targetId].toLowerCase().trim();
            
            // Check if it's a direct cardinal direction
            if (this.cardinalDirections.has(waytoCommand)) {
                return waytoCommand;
            }
            
            // Check if it contains a cardinal direction (like "go north")
            for (const direction of this.cardinalDirections) {
                if (waytoCommand.includes(direction)) {
                    return direction;
                }
            }
        }
        
        // Fallback to dirto if available
        if (room.dirto && room.dirto[targetId]) {
            const dirtoDirection = room.dirto[targetId].toLowerCase().trim();
            if (dirtoDirection !== 'none' && this.cardinalDirections.has(dirtoDirection)) {
                return dirtoDirection;
            }
        }
        
        // No direction found
        return null;
    }

    calculateRoomPositions(rooms, roomLookup) {
        const positions = new Map();
        const visited = new Set();
        
        // Find the best starting room (one with the most connections)
        let startRoom = rooms[0];
        let maxConnections = 0;
        
        rooms.forEach(room => {
            if (room.wayto) {
                const validConnections = Object.keys(room.wayto).filter(targetId => {
                    const direction = this.getDirectionForConnection(room, targetId);
                    return direction && roomLookup.has(parseInt(targetId));
                }).length;
                
                if (validConnections > maxConnections) {
                    maxConnections = validConnections;
                    startRoom = room;
                }
            }
        });
        
        console.log(`Starting with room ${startRoom.id} (${maxConnections} connections)`);
        
        // Direction mappings
        const directionOffsets = {
            'north': { x: 0, y: -1 },
            'south': { x: 0, y: 1 },
            'east': { x: 1, y: 0 },
            'west': { x: -1, y: 0 },
            'northeast': { x: 1, y: -1 },
            'northwest': { x: -1, y: -1 },
            'southeast': { x: 1, y: 1 },
            'southwest': { x: -1, y: 1 },
            'up': { x: 0, y: -2 },
            'down': { x: 0, y: 2 },
            'out': { x: 2, y: 0 }
        };
        
        // Multiple passes to find connected components
        const unpositioned = new Set(rooms.map(r => r.id));
        
        while (unpositioned.size > 0) {
            // Find the next starting room (either unvisited with most connections, or any unvisited)
            let nextStart = null;
            let nextStartConnections = 0;
            
            for (const roomId of unpositioned) {
                const room = roomLookup.get(roomId);
                if (room && room.wayto) {
                    const validConnections = Object.keys(room.wayto).filter(targetId => {
                        const direction = this.getDirectionForConnection(room, targetId);
                        return direction && unpositioned.has(parseInt(targetId));
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
            
            // Find a good position for this component
            let startX = 0, startY = 0;
            if (positions.size > 0) {
                // Position new components away from existing ones
                const existingCoords = Array.from(positions.values());
                const maxX = Math.max(...existingCoords.map(p => p.x));
                startX = maxX + 5; // Leave some space
            }
            
            console.log(`Starting new component with room ${nextStart.id} at (${startX}, ${startY})`);
            
            // BFS for this connected component
            const queue = [{ room: nextStart, x: startX, y: startY }];
            positions.set(nextStart.id, { x: startX, y: startY });
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
                        const direction = this.getDirectionForConnection(room, targetId);
                        
                        if (direction) {
                            const offset = directionOffsets[direction];
                            if (offset) {
                                let newX = x + offset.x;
                                let newY = y + offset.y;
                                
                                // Check for position conflicts and resolve them
                                let attempts = 0;
                                while (this.isPositionOccupied(positions, newX, newY) && attempts < 8) {
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
                                
                                if (!this.isPositionOccupied(positions, newX, newY)) {
                                    positions.set(targetRoom.id, { x: newX, y: newY });
                                    unpositioned.delete(targetRoom.id);
                                    queue.push({ room: targetRoom, x: newX, y: newY });
                                    
                                    console.log(`Positioned room ${targetRoom.id} at (${newX}, ${newY}) via ${direction} from room ${room.id}`);
                                } else {
                                    console.log(`Could not resolve position conflict for room ${targetRoom.id}`);
                                }
                            }
                        }
                    }
                }
            }
        }
        
        console.log(`Positioned ${positions.size} rooms in connected components`);
        
        // Handle any remaining unpositioned rooms (should be rare now)
        if (unpositioned.size > 0) {
            console.log(`Positioning ${unpositioned.size} remaining unconnected rooms`);
            const existingCoords = Array.from(positions.values());
            const maxY = existingCoords.length > 0 ? Math.max(...existingCoords.map(p => p.y)) : 0;
            
            let gridX = 0, gridY = maxY + 3;
            for (const roomId of unpositioned) {
                positions.set(roomId, { x: gridX, y: gridY });
                gridX++;
                if (gridX > 5) {
                    gridX = 0;
                    gridY++;
                }
            }
        }
        
        return positions;
    }

    isPositionOccupied(positions, x, y) {
        return Array.from(positions.values()).some(pos => pos.x === x && pos.y === y);
    }

    createSVG(rooms, positions, roomLookup) {
        const gridSize = this.config.gridSize;
        const roomRadius = gridSize * 0.3;
        
        // Calculate bounds
        const coords = Array.from(positions.values());
        const minX = Math.min(...coords.map(p => p.x));
        const maxX = Math.max(...coords.map(p => p.x));
        const minY = Math.min(...coords.map(p => p.y));
        const maxY = Math.max(...coords.map(p => p.y));
        
        const width = (maxX - minX + 2) * gridSize;
        const height = (maxY - minY + 2) * gridSize;
        const offsetX = -minX + 1;
        const offsetY = -minY + 1;
        
        console.log(`SVG bounds: ${width}x${height}, offset: (${offsetX}, ${offsetY})`);
        
        // Start SVG
        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
        svg += `<rect width="100%" height="100%" fill="#f8f9fa"/>`;
        
        // Draw connections first (so they appear behind rooms)
        if (this.config.showConnections) {
            rooms.forEach(room => {
                const pos = positions.get(room.id);
                if (!pos || !room.wayto) return;
                
                for (const targetId of Object.keys(room.wayto)) {
                    const targetIdNum = parseInt(targetId);
                    const targetPos = positions.get(targetIdNum);
                    if (!targetPos) continue;
                    
                    // Only draw if we have a cardinal direction
                    const direction = this.getDirectionForConnection(room, targetId);
                    if (!direction) continue;
                    
                    const x1 = (pos.x + offsetX) * gridSize;
                    const y1 = (pos.y + offsetY) * gridSize;
                    const x2 = (targetPos.x + offsetX) * gridSize;
                    const y2 = (targetPos.y + offsetY) * gridSize;
                    
                    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#666" stroke-width="2"/>`;
                    
                    // Add direction label
                    if (this.config.showLabels) {
                        const midX = (x1 + x2) / 2;
                        const midY = (y1 + y2) / 2;
                        const label = room.wayto[targetId];
                        
                        svg += `<text x="${midX}" y="${midY - 5}" text-anchor="middle" font-size="8" fill="#444" font-family="Arial">${label}</text>`;
                    }
                }
            });
        }
        
        // Draw rooms
        rooms.forEach(room => {
            const pos = positions.get(room.id);
            if (!pos) return;
            
            const x = (pos.x + offsetX) * gridSize;
            const y = (pos.y + offsetY) * gridSize;
            
            // Determine room color
            let color = this.config.colors.default;
            if (room.tags) {
                if (room.tags.includes('exit')) color = this.config.colors.exit;
                else if (room.tags.some(tag => tag.includes('shop') || tag.includes('bank'))) color = this.config.colors.shop;
                else if (room.tags.includes('sea') || room.tags.includes('water')) color = this.config.colors.water;
            }
            
            // Draw room circle
            svg += `<circle cx="${x}" cy="${y}" r="${roomRadius}" fill="${color}" stroke="#333" stroke-width="1"/>`;
            
            // Add room ID
            if (this.config.showRoomIds) {
                svg += `<text x="${x}" y="${y + 3}" text-anchor="middle" font-size="10" fill="#000" font-family="Arial">${room.id}</text>`;
            }
        });
        
        svg += '</svg>';
        return svg;
    }
}