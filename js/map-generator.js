class MapGenerator {
    constructor() {
        this.config = {
            colors: {
                default: '#ffffff',
                background: '#f8f9fa',
                connections: '#666666'
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

    // Calculate bounding box for a set of positions
    getBoundingBox(positions) {
        if (positions.size === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }
        
        const coords = Array.from(positions.values());
        const minX = Math.min(...coords.map(p => p.x));
        const maxX = Math.max(...coords.map(p => p.x));
        const minY = Math.min(...coords.map(p => p.y));
        const maxY = Math.max(...coords.map(p => p.y));
        
        return {
            minX,
            maxX,
            minY,
            maxY,
            width: maxX - minX + 1,
            height: maxY - minY + 1
        };
    }

    calculateRoomPositions(rooms, roomLookup) {
        const positions = new Map();
        const visited = new Set();
        
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
            'up': { x: 0, y: -1 },
            'down': { x: 0, y: 1 },
            'out': { x: 1, y: 0 }
        };
        
        // Track all component bounding boxes
        const componentBounds = [];
        
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
                        const direction = this.getDirectionForConnection(room, targetId);
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
            
            // Position this component at origin first
            let startX = 0, startY = 0;
            
            console.log(`Starting new component with room ${nextStart.id}`);
            
            // Create a temporary positions map for this component
            const componentPositions = new Map();
            
            // BFS for this connected component
            const queue = [{ room: nextStart, x: startX, y: startY }];
            componentPositions.set(nextStart.id, { x: startX, y: startY });
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
                                    unpositioned.delete(targetRoom.id);
                                    queue.push({ room: targetRoom, x: newX, y: newY });
                                    
                                    console.log(`Positioned room ${targetRoom.id} at (${newX}, ${newY}) via ${direction} from room ${room.id}`);
                                }
                            }
                        }
                    }
                }
            }
            
            // Get bounding box for this component
            const bounds = this.getBoundingBox(componentPositions);
            
            // Find a good position for this component that doesn't overlap with previous ones
            if (componentBounds.length > 0) {
                // Position new component to the right of all previous components with padding
                const rightmostX = Math.max(...componentBounds.map(b => b.maxX));
                const padding = 3; // Space between components
                
                // Offset all positions in this component
                const offsetX = rightmostX + padding - bounds.minX;
                const offsetY = -bounds.minY; // Align tops
                
                for (const [roomId, pos] of componentPositions) {
                    positions.set(roomId, {
                        x: pos.x + offsetX,
                        y: pos.y + offsetY
                    });
                }
                
                // Update bounds for tracking
                bounds.minX += offsetX;
                bounds.maxX += offsetX;
                bounds.minY += offsetY;
                bounds.maxY += offsetY;
            } else {
                // First component, just copy positions
                for (const [roomId, pos] of componentPositions) {
                    positions.set(roomId, pos);
                }
            }
            
            componentBounds.push(bounds);
            console.log(`Component ${componentBounds.length} bounds:`, bounds);
        }
        
        console.log(`Positioned ${positions.size} rooms in ${componentBounds.length} components`);
        
        return positions;
    }

    isPositionOccupied(positions, x, y) {
        return Array.from(positions.values()).some(pos => pos.x === x && pos.y === y);
    }

    createSVG(rooms, positions, roomLookup) {
        const edgeLength = this.config.edgeLength || 80;
        const roomSize = this.config.roomSize || 15;
        const roomShape = this.config.roomShape || 'circle';
        
        // Calculate bounds with padding
        const coords = Array.from(positions.values());
        const minX = Math.min(...coords.map(p => p.x));
        const maxX = Math.max(...coords.map(p => p.x));
        const minY = Math.min(...coords.map(p => p.y));
        const maxY = Math.max(...coords.map(p => p.y));
        
        const padding = 2; // Grid units of padding
        const width = (maxX - minX + 2 * padding) * edgeLength;
        const height = (maxY - minY + 2 * padding) * edgeLength;
        const offsetX = -minX + padding;
        const offsetY = -minY + padding;
        
        // Start SVG
        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
        svg += `<rect width="100%" height="100%" fill="${this.config.colors.background || '#f8f9fa'}"/>`;
        
        // Draw connections
        if (this.config.showConnections) {
            rooms.forEach(room => {
                const pos = positions.get(room.id);
                if (!pos || !room.wayto) return;
                
                for (const targetId of Object.keys(room.wayto)) {
                    const targetIdNum = parseInt(targetId);
                    const targetPos = positions.get(targetIdNum);
                    if (!targetPos) continue;
                    
                    const direction = this.getDirectionForConnection(room, targetId);
                    if (!direction) continue;
                    
                    const x1 = (pos.x + offsetX) * edgeLength;
                    const y1 = (pos.y + offsetY) * edgeLength;
                    const x2 = (targetPos.x + offsetX) * edgeLength;
                    const y2 = (targetPos.y + offsetY) * edgeLength;
                    
                    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${this.config.colors.connections || '#666'}" stroke-width="2"/>`;
                    
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
            
            const x = (pos.x + offsetX) * edgeLength;
            const y = (pos.y + offsetY) * edgeLength;
            
            // Determine room color based on tags
            let color = this.config.colors.default;
            if (room.tags && this.config.tagColors) {
                for (const tag of room.tags) {
                    if (this.config.tagColors.has(tag)) {
                        color = this.config.tagColors.get(tag);
                        break; // Use first matching tag
                    }
                }
            }
            
            // Draw room shape
            if (roomShape === 'circle') {
                svg += `<circle cx="${x}" cy="${y}" r="${roomSize}" fill="${color}" stroke="#333" stroke-width="1"/>`;
            } else if (roomShape === 'square') {
                const half = roomSize;
                svg += `<rect x="${x - half}" y="${y - half}" width="${roomSize * 2}" height="${roomSize * 2}" fill="${color}" stroke="#333" stroke-width="1"/>`;
            } else if (roomShape === 'rectangle') {
                const width = roomSize * 1.5;
                const height = roomSize;
                svg += `<rect x="${x - width}" y="${y - height}" width="${width * 2}" height="${height * 2}" fill="${color}" stroke="#333" stroke-width="1"/>`;
            }
            
            // Add room ID
            if (this.config.showRoomIds) {
                svg += `<text x="${x}" y="${y + 3}" text-anchor="middle" font-size="10" fill="#000" font-family="Arial">${room.id}</text>`;
            }
        });
        
        svg += '</svg>';
        return svg;
    }
}