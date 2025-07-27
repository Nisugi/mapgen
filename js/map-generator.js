class MapGenerator {
    constructor() {
        this.config = {
            colors: {
                default: '#ffffff',
                background: '#f8f9fa',
                connections: '#666666',
                verticalConnections: '#999999'
            },
            showRoomIds: true,
            showRoomNames: false,
            showLabels: true,
            showConnections: true,
            edgeLength: 60,
            roomShape: 'square',
            roomSize: 15,
            strokeWidth: 1,
            connectionWidth: 2,
            fonts: {
                labels: {
                    size: 8,
                    color: '#444',
                    family: 'Arial',
                    bold: false
                },
                rooms: {
                    size: 10,
                    color: '#000',
                    family: 'Arial', 
                    bold: false
                }
            }
        };
        
        // Cardinal directions we recognize
        this.cardinalDirections = new Set([
            'north', 'south', 'east', 'west',
            'northeast', 'northwest', 'southeast', 'southwest',
            'up', 'down', 'out'
        ]);
    }

    generateMap(rooms, config = {}) {
        const result = this.generateMapWithGroups(rooms, config);
        return result.svg;
    }

    generateMapWithGroups(rooms, config = {}) {
        console.log('Generating map for', rooms.length, 'rooms');
        
        // Merge config
        this.config = { ...this.config, ...config };
        
        // Step 1: Build room lookup
        const roomLookup = new Map();
        rooms.forEach(room => roomLookup.set(room.id, room));
        
        // Step 2: Position rooms based on connections and get group info
        const positionResult = this.calculateRoomPositionsWithGroups(rooms, roomLookup);
        const positions = positionResult.positions;
        const groups = positionResult.groups;
        
        // Step 3: Generate SVG
        const svg = this.createSVG(rooms, positions, roomLookup);
        
        return { svg, groups };
    }

    // Calculate room bounding box based on shape and size
    getRoomBounds(x, y, roomShape, roomSize) {
        let left, top, right, bottom, width, height;
        
        switch (roomShape) {
            case 'circle':
                left = x - roomSize;
                top = y - roomSize;
                right = x + roomSize;
                bottom = y + roomSize;
                width = roomSize * 2;
                height = roomSize * 2;
                break;
                
            case 'rectangle':
                width = roomSize * 1.5;
                height = roomSize;
                left = x - width;
                top = y - height;
                right = x + width;
                bottom = y + height;
                width = width * 2;
                height = height * 2;
                break;
                
            case 'square':
            default:
                left = x - roomSize;
                top = y - roomSize;
                right = x + roomSize;
                bottom = y + roomSize;
                width = roomSize * 2;
                height = roomSize * 2;
                break;
        }
        
        return { left, top, right, bottom, width, height };
    }

    getDirectionForConnection(room, targetId) {
        // First check dirto for overrides (also check "dir" for legacy compatibility)
        if (room.dirto && room.dirto[targetId]) {
            const dirtoDirection = room.dirto[targetId].toLowerCase().trim();
            // Check for cross-group connection
            if (dirtoDirection === 'cross-group') {
                return null; // Don't use for positioning
            }
            if (dirtoDirection !== 'none' && dirtoDirection !== 'skip' && this.cardinalDirections.has(dirtoDirection)) {
                return dirtoDirection;
            }
        } else if (room.dir && room.dir[targetId]) {
            // Check legacy "dir" field
            const dirDirection = room.dir[targetId].toLowerCase().trim();
            if (dirDirection !== 'none' && dirtoDirection !== 'skip' && this.cardinalDirections.has(dirDirection)) {
                return dirDirection;
            }
        }
        
        // Then check wayto for cardinal directions or simple commands
        if (room.wayto && room.wayto[targetId]) {
            const waytoCommand = room.wayto[targetId].toLowerCase().trim();
            
            // Skip stringprocs (commands starting with ;e) unless there's a dirto
            if (waytoCommand.startsWith(';e')) {
                // Only use stringprocs if there's a corresponding dirto
                if (room.dirto && room.dirto[targetId]) {
                    const dirtoDirection = room.dirto[targetId].toLowerCase().trim();
                    if (dirtoDirection !== 'none' && dirtoDirection !== 'skip' && this.cardinalDirections.has(dirtoDirection)) {
                        return dirtoDirection;
                    }
                }
                return null; // Ignore stringprocs without dirto
            }
            
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
        
        // No direction found
        return null;
    }

    getConnectionLabel(room, targetId) {
        if (!room.wayto || !room.wayto[targetId]) {
            return null;
        }
        
        const wayto = room.wayto[targetId].trim();
        const waytoLower = wayto.toLowerCase();
        
        // Handle script commands starting with ";e" FIRST
        if (wayto.startsWith(';e')) {
            // Only show labels for stringprocs if there's a dirto (meaning it's mappable)
            if (room.dirto && room.dirto[targetId]) {
                // Try to extract meaningful movement from stringproc
                // Look for 'go <something>' or 'move <something>' patterns
                const goMovePattern = /(?:fput\s*['"]|multifput\s*['"]|^|\s)(?:go|move)\s+([^'";\s]+)/i;
                const match = wayto.match(goMovePattern);
                if (match) {
                    const movement = match[1].trim();
                    // Don't show if it's just a cardinal direction
                    if (!this.cardinalDirections.has(movement.toLowerCase())) {
                        return movement;
                    }
                }
                
                // Look for other movement patterns in fput commands
                const fputPattern = /fput\s*['"]([^'"]+)['"]/i;
                const fputMatch = wayto.match(fputPattern);
                if (fputMatch) {
                    const command = fputMatch[1].trim();
                    
                    // Extract go/move commands
                    const commandGoMatch = command.match(/^(?:go|move)\s+(.+)$/i);
                    if (commandGoMatch) {
                        const target = commandGoMatch[1].trim();
                        if (!this.cardinalDirections.has(target.toLowerCase())) {
                            return target;
                        }
                    }
                    
                    // Skip cardinal directions and common script commands
                    if (!this.cardinalDirections.has(command.toLowerCase()) && 
                        !command.includes('empty_hands') && 
                        !command.includes('fill_hands') &&
                        !command.includes('waitrt') &&
                        !command.includes('stand') &&
                        !command.includes('speak') &&
                        !command.includes('ask') &&
                        !command.includes('pull') &&
                        !command.includes('push') &&
                        !command.includes('search') &&
                        !command.includes('look') &&
                        command.length < 20) { // Avoid very long commands
                        return command;
                    }
                }
                
                // For very short stringprocs that might be meaningful
                if (wayto.length < 50) {
                    // Look for simple patterns like "go arch" in multifput
                    const multifputPattern = /multifput[^'"]+'([^'",]+)/i;
                    const multifputMatch = wayto.match(multifputPattern);
                    if (multifputMatch) {
                        const command = multifputMatch[1].trim();
                        const commandGoMatch = command.match(/^(?:go|move)\s+(.+)$/i);
                        if (commandGoMatch) {
                            return commandGoMatch[1].trim();
                        }
                    }
                }
            }
            return null; // Don't show labels for most stringprocs
        }
        
        // Don't show labels for cardinal directions
        if (this.cardinalDirections.has(waytoLower)) {
            // Unless there's a dirto that differs
            if (room.dirto && room.dirto[targetId]) {
                const dirto = room.dirto[targetId].toLowerCase().trim();
                if (dirto !== waytoLower && this.cardinalDirections.has(dirto)) {
                    return wayto; // Show the actual movement direction
                }
            }
            return null;
        }
        
        // Handle "go/climb/move something" patterns
        const actionPattern = /^(go|climb|move)\s+(.+)$/i;
        const match = wayto.match(actionPattern);
        if (match) {
            return match[2]; // Return the "something" part
        }
        
        // For other non-cardinal wayto commands, show them as-is (up to reasonable length)
        if (wayto.length <= 20) {
            return wayto;
        }
        
        return null;
    }

    isVerticalConnection(room, targetId) {
        // Check dirto first
        if (room.dirto && room.dirto[targetId]) {
            const dirto = room.dirto[targetId].toLowerCase().trim();
            if (dirto === 'up' || dirto === 'down') {
                return true;
            }
        }
        
        // Check wayto
        if (room.wayto && room.wayto[targetId]) {
            const wayto = room.wayto[targetId].toLowerCase().trim();
            if (wayto === 'up' || wayto === 'down') {
                return true;
            }
        }
        
        return false;
    }

    isCrossGroupConnection(room, targetId) {
        if (room.dirto && room.dirto[targetId]) {
            return room.dirto[targetId].toLowerCase().trim() === 'cross-group';
        }
        return false;
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
        const result = this.calculateRoomPositionsWithGroups(rooms, roomLookup);
        return result.positions;
    }

    calculateRoomPositionsWithGroups(rooms, roomLookup) {
        const positions = new Map();
        const groups = [];
        
        // Direction mappings - reduced offsets for up/down/out
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
        
        // Now apply offsets to all groups
        const finalPositions = this.applyGroupOffsets(groups);
        
        console.log(`Positioned ${finalPositions.size} rooms in ${groups.length} components`);
        
        return { positions: finalPositions, groups };
    }

    applyGroupOffsets(groups) {
        const positions = new Map();
        
        // First pass: calculate base positions if not already done
        if (!groups[0].baseOffset) {
            let currentX = 0;
            groups.forEach((group, groupIndex) => {
                const bounds = this.getBoundingBox(group.positions);
                
                if (groupIndex === 0) {
                    // First group starts at origin
                    group.baseOffset = { x: -bounds.minX, y: -bounds.minY };
                } else {
                    // Subsequent groups positioned to the right
                    const prevGroup = groups[groupIndex - 1];
                    const prevBounds = this.getBoundingBox(prevGroup.positions);
                    const prevTotalX = prevGroup.baseOffset.x + prevBounds.maxX;
                    
                    group.baseOffset = {
                        x: prevTotalX + 3 - bounds.minX, // 3 units padding
                        y: -bounds.minY // Align tops
                    };
                }
            });
        }
        
        // Second pass: apply base + manual offsets
        groups.forEach((group, groupIndex) => {
            // Get manual offset if provided
            let manualOffsetX = 0;
            let manualOffsetY = 0;
            
            if (this.config.groupOffsets && this.config.groupOffsets.has(groupIndex)) {
                const manualOffset = this.config.groupOffsets.get(groupIndex);
                manualOffsetX = manualOffset.x || 0;
                manualOffsetY = manualOffset.y || 0;
            }
            
            // Apply total offset to all positions in this group
            const totalOffsetX = group.baseOffset.x + manualOffsetX;
            const totalOffsetY = group.baseOffset.y + manualOffsetY;
            
            for (const [roomId, pos] of group.positions) {
                positions.set(roomId, {
                    x: pos.x + totalOffsetX,
                    y: pos.y + totalOffsetY
                });
            }
            
            // Update bounds for rendering
            const bounds = this.getBoundingBox(group.positions);
            group.bounds = {
                minX: bounds.minX + totalOffsetX,
                maxX: bounds.maxX + totalOffsetX,
                minY: bounds.minY + totalOffsetY,
                maxY: bounds.maxY + totalOffsetY,
                width: bounds.width,
                height: bounds.height
            };
        });
        
        return positions;
    }

    isPositionOccupied(positions, x, y) {
        return Array.from(positions.values()).some(pos => pos.x === x && pos.y === y);
    }

    wrapText(text, maxWidth, fontSize) {
        // Simple text wrapping - only break at spaces
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        // Approximate character width (very rough)
        const charWidth = fontSize * 0.6;
        const maxChars = Math.floor(maxWidth / charWidth);
        
        words.forEach(word => {
            if ((currentLine + ' ' + word).trim().length <= maxChars) {
                currentLine = (currentLine + ' ' + word).trim();
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        });
        
        if (currentLine) lines.push(currentLine);
        return lines;
    }

    createSVG(rooms, positions, roomLookup) {
        const edgeLength = this.config.edgeLength || 60;
        const roomSize = this.config.roomSize || 15;
        const roomShape = this.config.roomShape || 'square';
        const strokeWidth = this.config.strokeWidth || 1;
        const connectionWidth = this.config.connectionWidth || 2;
        
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
        
        // Add background
        if (this.config.useBackground) {
            if (this.config.backgroundImage) {
                // Use background image
                svg += `
                    <defs>
                        <pattern id="bgImage" x="0" y="0" width="100%" height="100%" patternUnits="userSpaceOnUse">
                            <image href="${this.config.backgroundImage}" 
                                   x="0" y="0" 
                                   width="${width}" height="${height}"
                                   preserveAspectRatio="xMidYMid slice"/>
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#bgImage)"/>
                `;
            } else {
                // Use background color
                svg += `<rect width="100%" height="100%" fill="${this.config.colors.background || '#f8f9fa'}"/>`;
            }
        }
        // If useBackground is false, no background rect is added (transparent)
        
        // Draw group labels if enabled
        if (this.config.showGroupLabels && this.config.groups) {
            this.config.groups.forEach((group) => {
                if (group.bounds) {
                    // Calculate label position - try to find clear space
                    const centerX = (group.bounds.minX + group.bounds.width / 2 + offsetX) * edgeLength;
                    let labelY = (group.bounds.minY + offsetY) * edgeLength - 20; // Default above
                    
                    // Apply manual label offset if provided
                    let labelOffsetX = 0;
                    let labelOffsetY = 0;
                    if (this.config.groupLabelOffsets && this.config.groupLabelOffsets.has(group.index)) {
                        const labelOffset = this.config.groupLabelOffsets.get(group.index);
                        labelOffsetX = labelOffset.x || 0;
                        labelOffsetY = labelOffset.y || 0;
                    }
                    
                    // Check if there's a room at the top center - if so, move label to the side
                    const topCenterGridX = Math.round(group.bounds.minX + group.bounds.width / 2);
                    const topGridY = group.bounds.minY;
                    const hasRoomAbove = Array.from(positions.values()).some(pos => 
                        pos.x === topCenterGridX && pos.y === topGridY
                    );
                    
                    let labelX = centerX;
                    if (hasRoomAbove) {
                        // Try to position to the left or right of the group
                        labelX = (group.bounds.minX + offsetX - 0.5) * edgeLength;
                        labelY = (group.bounds.minY + group.bounds.height / 2 + offsetY) * edgeLength;
                    }
                    
                    // Apply manual offsets
                    labelX += labelOffsetX;
                    labelY += labelOffsetY;
                    
                    const label = group.name || `Group ${group.index + 1}`;
                    
                    // Draw background for label
                    const textWidth = label.length * 7 + 20; // Approximate text width
                    svg += `<rect x="${labelX - textWidth/2}" y="${labelY - 15}" width="${textWidth}" height="20" 
                            fill="${this.config.colors.background}" stroke="${this.config.colors.connections}" 
                            stroke-width="1" rx="3" ry="3"/>`;
                    
                    // Draw label text
                    svg += `<text x="${labelX}" y="${labelY}" text-anchor="middle" 
                            font-size="12" fill="${this.config.colors.connections}" 
                            font-family="Arial" font-weight="bold">${label}</text>`;
                }
            });
        }
        
        // Create a set to track drawn connections (to avoid duplicates)
        const drawnConnections = new Set();
        const crossGroupConnections = [];
        
        // Draw connections
        if (this.config.showConnections) {
            // First pass: collect cross-group connections
            rooms.forEach(room => {
                const pos = positions.get(room.id);
                if (!pos || !room.wayto) return;
                
                for (const targetId of Object.keys(room.wayto)) {
                    const targetIdNum = parseInt(targetId);
                    const targetRoom = roomLookup.get(targetIdNum);
                    const targetPos = positions.get(targetIdNum);
                    if (!targetPos || !targetRoom) continue;
                    
                    if (this.isCrossGroupConnection(room, targetId)) {
                        crossGroupConnections.push({
                            from: { room, pos },
                            to: { room: targetRoom, pos: targetPos }
                        });
                    }
                }
            });
            
            // Draw cross-group connections first (under everything else)
            if (this.config.crossGroupConnections || crossGroupConnections.length > 0) {
                svg += `<g id="cross-group-connections">`;
                
                // From UI-specified connections
                if (this.config.crossGroupConnections) {
                    this.config.crossGroupConnections.forEach(conn => {
                        const fromPos = positions.get(conn.fromId);
                        const toPos = positions.get(conn.toId);
                        if (fromPos && toPos) {
                            const x1 = (fromPos.x + offsetX) * edgeLength;
                            const y1 = (fromPos.y + offsetY) * edgeLength;
                            const x2 = (toPos.x + offsetX) * edgeLength;
                            const y2 = (toPos.y + offsetY) * edgeLength;
                            
                            const dashArray = conn.dashSpacing || '5,5';
                            const color = conn.color || this.config.colors.connections;
                            
                            svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                                    stroke="${color}" stroke-width="${connectionWidth}" 
                                    stroke-dasharray="${dashArray}" opacity="0.6"/>`;
                        }
                    });
                }
                
                // From dirto cross-group connections
                crossGroupConnections.forEach(({ from, to }) => {
                    const x1 = (from.pos.x + offsetX) * edgeLength;
                    const y1 = (from.pos.y + offsetY) * edgeLength;
                    const x2 = (to.pos.x + offsetX) * edgeLength;
                    const y2 = (to.pos.y + offsetY) * edgeLength;
                    
                    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                            stroke="${this.config.colors.connections}" stroke-width="${connectionWidth}" 
                            stroke-dasharray="5,5" opacity="0.6"/>`;
                });
                
                svg += `</g>`;
            }
            
            // Draw normal connections
            rooms.forEach(room => {
                const pos = positions.get(room.id);
                if (!pos || !room.wayto) return;
                
                for (const targetId of Object.keys(room.wayto)) {
                    const targetIdNum = parseInt(targetId);
                    const targetRoom = roomLookup.get(targetIdNum);
                    const targetPos = positions.get(targetIdNum);
                    if (!targetPos || !targetRoom) continue;
                    
                    // Skip cross-group connections here
                    if (this.isCrossGroupConnection(room, targetId)) continue;
                    
                    // Create unique key for this connection
                    const connectionKey = [room.id, targetIdNum].sort().join('-');
                    if (drawnConnections.has(connectionKey)) continue;
                    drawnConnections.add(connectionKey);
                    
                    const direction = this.getDirectionForConnection(room, targetId);
                    if (!direction) continue;
                    
                    const x1 = (pos.x + offsetX) * edgeLength;
                    const y1 = (pos.y + offsetY) * edgeLength;
                    const x2 = (targetPos.x + offsetX) * edgeLength;
                    const y2 = (targetPos.y + offsetY) * edgeLength;
                    
                    // Determine connection color
                    const isVertical = this.isVerticalConnection(room, targetId) || 
                                     this.isVerticalConnection(targetRoom, room.id.toString());
                    const connectionColor = isVertical ? 
                        (this.config.colors.verticalConnections || '#999') : 
                        (this.config.colors.connections || '#666');
                    
                    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${connectionColor}" stroke-width="${connectionWidth}"/>`;
                    
                    if (this.config.showLabels) {
                        // Get labels from both directions
                        const label1 = this.getConnectionLabel(room, targetId);
                        const label2 = targetRoom.wayto && targetRoom.wayto[room.id] ? 
                            this.getConnectionLabel(targetRoom, room.id.toString()) : null;
                        
                        if (label1 || label2) {
                            const midX = (x1 + x2) / 2;
                            const midY = (y1 + y2) / 2;
                            
                            // Calculate angle for text rotation
                            const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
                            const adjustedAngle = (angle > 90 || angle < -90) ? angle + 180 : angle;
                            
                            // Font settings
                            const fontWeight = this.config.fonts.labels.bold ? 'bold' : 'normal';
                            const fontSize = this.config.fonts.labels.size || 8;
                            const fontColor = this.config.fonts.labels.color;
                            const fontFamily = this.config.fonts.labels.family;
                            
                            if (label1 && label2 && label1 !== label2) {
                                // Two different labels - one above, one below
                                svg += `<text x="${midX}" y="${midY - 3}" text-anchor="middle" font-size="${fontSize}" 
                                        fill="${fontColor}" font-family="${fontFamily}" font-weight="${fontWeight}"
                                        transform="rotate(${adjustedAngle} ${midX} ${midY})"
                                        text-rendering="optimizeLegibility">${label1}</text>`;
                                svg += `<text x="${midX}" y="${midY + fontSize + 2}" text-anchor="middle" font-size="${fontSize}" 
                                        fill="${fontColor}" font-family="${fontFamily}" font-weight="${fontWeight}"
                                        transform="rotate(${adjustedAngle} ${midX} ${midY})"
                                        text-rendering="optimizeLegibility">${label2}</text>`;
                            } else if (label1 || label2) {
                                // Single label
                                const label = label1 || label2;
                                svg += `<text x="${midX}" y="${midY - 3}" text-anchor="middle" font-size="${fontSize}" 
                                        fill="${fontColor}" font-family="${fontFamily}" font-weight="${fontWeight}"
                                        transform="rotate(${adjustedAngle} ${midX} ${midY})"
                                        text-rendering="optimizeLegibility">${label}</text>`;
                            }
                        }
                    }
                }
            });
        }
        
        // Draw custom labels if provided
        if (this.config.customLabels && this.config.customLabels.length > 0) {
            this.config.customLabels.forEach(label => {
                const x = (label.x / this.config.edgeLength + offsetX) * edgeLength;
                const y = (label.y / this.config.edgeLength + offsetY) * edgeLength;
                
                const fontWeight = label.bold ? 'bold' : 'normal';
                
                if (label.background) {
                    // Estimate text width for background
                    const textWidth = label.text.length * label.fontSize * 0.6 + 10;
                    const textHeight = label.fontSize + 6;
                    
                    svg += `<rect x="${x - textWidth/2}" y="${y - textHeight/2}" 
                            width="${textWidth}" height="${textHeight}" 
                            fill="${label.backgroundColor}" 
                            stroke="${label.borderColor}" 
                            stroke-width="${label.borderWidth}" 
                            rx="2" ry="2"/>`;
                }
                
                svg += `<text x="${x}" y="${y}" text-anchor="middle" 
                        font-size="${label.fontSize}" fill="${label.fontColor}" 
                        font-family="${label.fontFamily}" font-weight="${fontWeight}"
                        dominant-baseline="middle">${label.text}</text>`;
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
            
            // Draw room shape using the getRoomBounds method for consistency
            const bounds = this.getRoomBounds(x, y, roomShape, roomSize);
            
            if (roomShape === 'circle') {
                svg += `<circle cx="${x}" cy="${y}" r="${roomSize}" fill="${color}" stroke="#333" stroke-width="${strokeWidth}"/>`;
            } else if (roomShape === 'square') {
                svg += `<rect x="${bounds.left}" y="${bounds.top}" width="${bounds.width}" height="${bounds.height}" 
                        fill="${color}" stroke="#333" stroke-width="${strokeWidth}"/>`;
            } else if (roomShape === 'rectangle') {
                svg += `<rect x="${bounds.left}" y="${bounds.top}" width="${bounds.width}" height="${bounds.height}" 
                        fill="${color}" stroke="#333" stroke-width="${strokeWidth}"/>`;
            }
            
            // Add room text
            const fontWeight = this.config.fonts.rooms.bold ? 'bold' : 'normal';
            const fontSize = this.config.fonts.rooms.size || 10;
            const fontColor = this.config.fonts.rooms.color;
            const fontFamily = this.config.fonts.rooms.family;
            
            if (this.config.showRoomNames && room.title && room.title[0]) {
                // Extract room name from title (usually in brackets)
                const titleMatch = room.title[0].match(/\[([^\]]+)\]/);
                let roomName = titleMatch ? titleMatch[1] : room.title[0];
                
                // If there's a comma, use the part after it
                if (roomName.includes(',')) {
                    const parts = roomName.split(',').map(s => s.trim());
                    roomName = parts[parts.length - 1]; // Use the last part
                }
                
                // Wrap text to fit in room
                const maxWidth = roomShape === 'rectangle' ? roomSize * 3 : roomSize * 2;
                const lines = this.wrapText(roomName, maxWidth, fontSize);
                
                // Draw each line
                const lineHeight = fontSize * 1.2;
                const startY = y - ((lines.length - 1) * lineHeight / 2);
                
                lines.forEach((line, index) => {
                    svg += `<text x="${x}" y="${startY + index * lineHeight}" text-anchor="middle" 
                            font-size="${fontSize}" fill="${fontColor}" font-family="${fontFamily}" 
                            font-weight="${fontWeight}" text-rendering="optimizeLegibility">${line}</text>`;
                });
                
            } else if (this.config.showRoomIds) {
                // Just show room ID - center text vertically using dominant-baseline
                svg += `<text x="${x}" y="${y}" text-anchor="middle" font-size="${fontSize}" 
                        fill="${fontColor}" font-family="${fontFamily}" font-weight="${fontWeight}"
                        text-rendering="optimizeLegibility" dominant-baseline="middle">${room.id}</text>`;
            }
        });
        
        svg += '</svg>';
        return svg;
    }
}