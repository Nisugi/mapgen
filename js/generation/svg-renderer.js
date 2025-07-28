// SVG Renderer - handles SVG generation
export class SVGRenderer {
    constructor() {
        this.connectionAnalyzer = null; // Will be injected if needed
    }

    setConnectionAnalyzer(analyzer) {
        this.connectionAnalyzer = analyzer;
    }

    createSVG(rooms, positions, roomLookup, groups, config) {
        const edgeLength = config.edgeLength || 60;
        const roomSize = config.roomSize || 15;
        const roomShape = config.roomShape || 'square';
        const strokeWidth = config.strokeWidth || 1;
        const connectionWidth = config.connectionWidth || 2;
        
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
        svg += this.renderBackground(width, height, config);
        
        // Draw group labels if enabled
        if (config.showGroupLabels && config.groups) {
            svg += this.renderGroupLabels(config.groups, offsetX, offsetY, edgeLength, positions, config);
        }
        
        // Draw regular connections (but NOT cross-group connections yet)
        if (config.showConnections) {
            svg += this.renderRegularConnections(rooms, positions, roomLookup, offsetX, offsetY, edgeLength, connectionWidth, config);
        }
        
        // Draw custom text boxes if provided
        if (config.customTextBoxes && config.customTextBoxes.length > 0) {
            svg += this.renderCustomTextBoxes(config.customTextBoxes, offsetX, offsetY, edgeLength, config);
        }
        
        // Draw custom labels if provided
        if (config.customLabels && config.customLabels.length > 0) {
            svg += this.renderCustomLabels(config.customLabels, offsetX, offsetY, edgeLength, config);
        }
        
        // Draw rooms
        svg += this.renderRooms(rooms, positions, offsetX, offsetY, edgeLength, roomSize, roomShape, strokeWidth, config);
        
        // Draw cross-group connections LAST (on top of rooms)
        if (config.showConnections) {
            svg += this.renderCrossGroupConnections(rooms, positions, roomLookup, offsetX, offsetY, edgeLength, connectionWidth, config);
        }
        
        svg += '</svg>';
        return svg;
    }

    renderBackground(width, height, config) {
        let svg = '';
        
        if (config.useBackground) {
            if (config.backgroundImage) {
                // Use background image
                svg += `
                    <defs>
                        <pattern id="bgImage" x="0" y="0" width="100%" height="100%" patternUnits="userSpaceOnUse">
                            <image href="${config.backgroundImage}" 
                                   x="0" y="0" 
                                   width="${width}" height="${height}"
                                   preserveAspectRatio="xMidYMid slice"/>
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#bgImage)"/>
                `;
            } else {
                // Use background color
                svg += `<rect width="100%" height="100%" fill="${config.colors.background || '#f8f9fa'}"/>`;
            }
        }
        
        return svg;
    }

    renderGroupLabels(groups, offsetX, offsetY, edgeLength, positions, config) {
        let svg = '';
        
        groups.forEach((group) => {
            if (group.bounds) {
                // Calculate label position - try to find clear space
                const centerX = (group.bounds.minX + group.bounds.width / 2 + offsetX) * edgeLength;
                let labelY = (group.bounds.minY + offsetY) * edgeLength - 20; // Default above
                
                // Apply manual label offset if provided
                let labelOffsetX = 0;
                let labelOffsetY = 0;
                if (config.groupLabelOffsets && config.groupLabelOffsets.has(group.index)) {
                    const labelOffset = config.groupLabelOffsets.get(group.index);
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
                        fill="${config.colors.background}" stroke="${config.colors.connections}" 
                        stroke-width="1" rx="3" ry="3"/>`;
                
                // Draw label text
                svg += `<text x="${labelX}" y="${labelY}" text-anchor="middle" 
                        font-size="12" fill="${config.colors.connections}" 
                        font-family="Arial" font-weight="${config.groupLabelBold?.get(group.index) ? 'bold' : 'normal'}">${label}</text>`;
            }
        });
        
        return svg;
    }

    renderRegularConnections(rooms, positions, roomLookup, offsetX, offsetY, edgeLength, connectionWidth, config) {
        let svg = '<g id="regular-connections">';
        
        // Create a set to track drawn connections (to avoid duplicates)
        const drawnConnections = new Set();
        
        // Draw normal connections (NOT cross-group)
        rooms.forEach(room => {
            const pos = positions.get(room.id);
            if (!pos || !room.wayto) return;
            
            for (const targetId of Object.keys(room.wayto)) {
                const targetIdNum = parseInt(targetId);
                const targetRoom = roomLookup.get(targetIdNum);
                const targetPos = positions.get(targetIdNum);
                if (!targetPos || !targetRoom) continue;
                
                // Skip cross-group connections here
                if (this.connectionAnalyzer && this.connectionAnalyzer.isCrossGroupConnection(room, targetId)) continue;
                
                // Create unique key for this connection
                const connectionKey = [room.id, targetIdNum].sort().join('-');
                if (drawnConnections.has(connectionKey)) continue;
                drawnConnections.add(connectionKey);
                
                const direction = this.connectionAnalyzer ? this.connectionAnalyzer.getDirectionForConnection(room, targetId) : null;
                if (!direction) continue;
                
                const x1 = (pos.x + offsetX) * edgeLength;
                const y1 = (pos.y + offsetY) * edgeLength;
                const x2 = (targetPos.x + offsetX) * edgeLength;
                const y2 = (targetPos.y + offsetY) * edgeLength;
                
                // Determine connection color
                let isVertical = false;
                if (this.connectionAnalyzer) {
                    isVertical = this.connectionAnalyzer.isVerticalConnection(room, targetId) || 
                                 this.connectionAnalyzer.isVerticalConnection(targetRoom, room.id.toString());
                }
                const connectionColor = isVertical ? 
                    (config.colors.verticalConnections || '#999') : 
                    (config.colors.connections || '#666');
                
                svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${connectionColor}" stroke-width="${connectionWidth}"/>`;
                
                if (config.showLabels && this.connectionAnalyzer) {
                    svg += this.renderConnectionLabel(room, targetId, targetRoom, x1, y1, x2, y2, config);
                }
            }
        });
        
        svg += '</g>';
        return svg;
    }

    renderCrossGroupConnections(rooms, positions, roomLookup, offsetX, offsetY, edgeLength, connectionWidth, config) {
        let svg = '<g id="cross-group-connections">';
        
        const crossGroupConnections = [];
        
        // First collect cross-group connections from dirto
        if (this.connectionAnalyzer) {
            rooms.forEach(room => {
                const pos = positions.get(room.id);
                if (!pos || !room.wayto) return;
                
                for (const targetId of Object.keys(room.wayto)) {
                    const targetIdNum = parseInt(targetId);
                    const targetRoom = roomLookup.get(targetIdNum);
                    const targetPos = positions.get(targetIdNum);
                    if (!targetPos || !targetRoom) continue;
                    
                    if (this.connectionAnalyzer.isCrossGroupConnection(room, targetId)) {
                        crossGroupConnections.push({
                            from: { room, pos },
                            to: { room: targetRoom, pos: targetPos }
                        });
                    }
                }
            });
        }
        
        // Draw UI-specified cross-group connections
        if (config.crossGroupConnections) {
            config.crossGroupConnections.forEach(conn => {
                const fromPos = positions.get(conn.fromId);
                const toPos = positions.get(conn.toId);
                if (fromPos && toPos) {
                    const x1 = (fromPos.x + offsetX) * edgeLength;
                    const y1 = (fromPos.y + offsetY) * edgeLength;
                    const x2 = (toPos.x + offsetX) * edgeLength;
                    const y2 = (toPos.y + offsetY) * edgeLength;
                    
                    // Calculate the edge points where the line intersects the room shapes
                    const roomSize = config.roomSize || 15;
                    const roomShape = config.roomShape || 'square';
                    
                    const edgePoints = this.calculateEdgeIntersections(
                        x1, y1, x2, y2, roomSize, roomShape
                    );
                    
                    const dashArray = conn.dashSpacing || '5,5';
                    const color = conn.color || config.colors.connections;
                    
                    // Draw the main connection line
                    svg += `<line x1="${edgePoints.x1}" y1="${edgePoints.y1}" 
                            x2="${edgePoints.x2}" y2="${edgePoints.y2}" 
                            stroke="${color}" stroke-width="${connectionWidth}" 
                            stroke-dasharray="${dashArray}" opacity="0.6"/>`;
                    
                    // Calculate angle for arrow direction
                    const angle = Math.atan2(y2 - y1, x2 - x1);
                    
                    // Draw terminators at the edge points
                    if (conn.showFromTerminal) {
                        svg += this.renderConnectionTerminal(
                            edgePoints.x1, edgePoints.y1, 
                            conn.terminalStyle || 'arrow', 
                            color, connectionWidth,
                            angle // Arrow points in direction of travel (away from source)
                        );
                    }
                    if (conn.showToTerminal) {
                        svg += this.renderConnectionTerminal(
                            edgePoints.x2, edgePoints.y2, 
                            conn.terminalStyle || 'arrow', 
                            color, connectionWidth,
                            angle + Math.PI // Reverse angle - arrow points back toward source (into destination)
                        );
                    }
                }
            });
        }
        
        // Draw dirto cross-group connections
        crossGroupConnections.forEach(({ from, to }) => {
            const x1 = (from.pos.x + offsetX) * edgeLength;
            const y1 = (from.pos.y + offsetY) * edgeLength;
            const x2 = (to.pos.x + offsetX) * edgeLength;
            const y2 = (to.pos.y + offsetY) * edgeLength;
            
            const roomSize = config.roomSize || 15;
            const roomShape = config.roomShape || 'square';
            
            const edgePoints = this.calculateEdgeIntersections(
                x1, y1, x2, y2, roomSize, roomShape
            );
            
            svg += `<line x1="${edgePoints.x1}" y1="${edgePoints.y1}" 
                    x2="${edgePoints.x2}" y2="${edgePoints.y2}" 
                    stroke="${config.colors.connections}" stroke-width="${connectionWidth}" 
                    stroke-dasharray="5,5" opacity="0.6"/>`;
        });
        
        svg += '</g>';
        return svg;
    }

    calculateEdgeIntersections(x1, y1, x2, y2, roomSize, roomShape) {
        // Calculate the angle and distance
        const dx = x2 - x1;
        const dy = y2 - y1;
        const angle = Math.atan2(dy, dx);
        
        let edge1X = x1;
        let edge1Y = y1;
        let edge2X = x2;
        let edge2Y = y2;
        
        if (roomShape === 'circle') {
            // For circles, move along the radius
            edge1X = x1 + Math.cos(angle) * roomSize;
            edge1Y = y1 + Math.sin(angle) * roomSize;
            edge2X = x2 - Math.cos(angle) * roomSize;
            edge2Y = y2 - Math.sin(angle) * roomSize;
        } else {
            // For squares and rectangles, calculate intersection with box edges
            const halfSize = roomSize;
            
            // Calculate intersection for start point
            const edge1 = this.getBoxEdgeIntersection(x1, y1, angle, halfSize, roomShape);
            edge1X = edge1.x;
            edge1Y = edge1.y;
            
            // Calculate intersection for end point (reverse angle)
            const edge2 = this.getBoxEdgeIntersection(x2, y2, angle + Math.PI, halfSize, roomShape);
            edge2X = edge2.x;
            edge2Y = edge2.y;
        }
        
        return { x1: edge1X, y1: edge1Y, x2: edge2X, y2: edge2Y };
    }

    getBoxEdgeIntersection(centerX, centerY, angle, halfSize, roomShape) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        let width = halfSize;
        let height = halfSize;
        
        if (roomShape === 'rectangle') {
            width = halfSize * 1.5;
        }
        
        // Check intersection with each edge
        let t = Infinity;
        
        // Right edge
        if (cos > 0) {
            t = Math.min(t, width / cos);
        }
        // Left edge
        if (cos < 0) {
            t = Math.min(t, -width / cos);
        }
        // Bottom edge
        if (sin > 0) {
            t = Math.min(t, height / sin);
        }
        // Top edge
        if (sin < 0) {
            t = Math.min(t, -height / sin);
        }
        
        return {
            x: centerX + cos * t,
            y: centerY + sin * t
        };
    }

    renderConnectionTerminal(x, y, style, color, width, angle = 0) {
        let svg = '';
        const size = width * 3; // Terminal size based on connection width
        
        // Convert angle to degrees for SVG rotation
        const angleDegrees = angle * 180 / Math.PI;
        
        switch (style) {
            case 'arrow':
                // Arrowhead pointing in the direction of travel
                svg += `<g transform="rotate(${angleDegrees} ${x} ${y})">`;
                // Arrow points forward (to the right in local coordinates)
                svg += `<path d="M ${x} ${y} L ${x-size} ${y-size/2} L ${x-size} ${y+size/2} Z" 
                        fill="${color}"/>`;
                svg += `</g>`;
                break;
                
            case 'dot':
                // Filled circle (no rotation needed)
                svg += `<circle cx="${x}" cy="${y}" r="${size/2}" fill="${color}"/>`;
                break;
                
            case 'square':
                // Filled square (no rotation needed)
                svg += `<rect x="${x-size/2}" y="${y-size/2}" width="${size}" height="${size}" 
                        fill="${color}"/>`;
                break;
                
            case 'diamond':
                // Filled diamond
                svg += `<g transform="rotate(${angleDegrees} ${x} ${y})">`;
                svg += `<path d="M ${x} ${y-size} L ${x+size} ${y} L ${x} ${y+size} L ${x-size} ${y} Z" 
                        fill="${color}"/>`;
                svg += `</g>`;
                break;
                
            case 'cross':
                // X mark
                svg += `<g transform="rotate(${angleDegrees} ${x} ${y})">`;
                svg += `<line x1="${x-size/2}" y1="${y-size/2}" x2="${x+size/2}" y2="${y+size/2}" 
                        stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
                svg += `<line x1="${x-size/2}" y1="${y+size/2}" x2="${x+size/2}" y2="${y-size/2}" 
                        stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
                svg += `</g>`;
                break;
                
            case 'circle':
                // Open circle (no rotation needed)
                svg += `<circle cx="${x}" cy="${y}" r="${size/2}" fill="none" 
                        stroke="${color}" stroke-width="${width}"/>`;
                break;
        }
        
        return svg;
    }

    renderConnections(rooms, positions, roomLookup, offsetX, offsetY, edgeLength, connectionWidth, config) {
        let svg = '';
        svg += this.renderRegularConnections(rooms, positions, roomLookup, offsetX, offsetY, edgeLength, connectionWidth, config);
        // Note: Cross-group connections are now rendered separately in createSVG
        return svg;
    }

    renderConnectionTerminal(x, y, style, color, width) {
        let svg = '';
        const size = width * 3; // Terminal size based on connection width
        
        switch (style) {
            case 'arrow':
                // Arrowhead pointing inward
                svg += `<path d="M ${x-size} ${y-size} L ${x} ${y} L ${x-size} ${y+size}" 
                        fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
                break;
                
            case 'dot':
                // Filled circle
                svg += `<circle cx="${x}" cy="${y}" r="${size/2}" fill="${color}"/>`;
                break;
                
            case 'square':
                // Filled square
                svg += `<rect x="${x-size/2}" y="${y-size/2}" width="${size}" height="${size}" 
                        fill="${color}"/>`;
                break;
                
            case 'diamond':
                // Filled diamond
                svg += `<path d="M ${x} ${y-size} L ${x+size} ${y} L ${x} ${y+size} L ${x-size} ${y} Z" 
                        fill="${color}"/>`;
                break;
                
            case 'cross':
                // X mark
                svg += `<line x1="${x-size/2}" y1="${y-size/2}" x2="${x+size/2}" y2="${y+size/2}" 
                        stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
                svg += `<line x1="${x-size/2}" y1="${y+size/2}" x2="${x+size/2}" y2="${y-size/2}" 
                        stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
                break;
                
            case 'circle':
                // Open circle
                svg += `<circle cx="${x}" cy="${y}" r="${size/2}" fill="none" 
                        stroke="${color}" stroke-width="${width}"/>`;
                break;
        }
        
        return svg;
    }

    renderConnectionLabel(room, targetId, targetRoom, x1, y1, x2, y2, config) {
        let svg = '';
        
        // Get labels from both directions
        const label1 = this.connectionAnalyzer.getConnectionLabel(room, targetId);
        const label2 = targetRoom.wayto && targetRoom.wayto[room.id] ? 
            this.connectionAnalyzer.getConnectionLabel(targetRoom, room.id.toString()) : null;
        
        if (label1 || label2) {
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            
            // Calculate angle for text rotation
            let angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
            
            // Determine if we need to flip the text for readability
            // Text should always read left-to-right in the direction of travel
            let flipText = false;
            let textAnchor = 'middle';
            let dominantBaseline = 'auto';
            
            // If angle is between 90 and 270 degrees, the text would be upside down
            if (angle > 90 || angle < -90) {
                // Don't flip the angle, but we need to position text differently
                flipText = true;
            }
            
            // Font settings
            const fontWeight = config.fonts.labels.bold ? 'bold' : 'normal';
            const fontSize = config.fonts.labels.size || 8;
            const fontColor = config.fonts.labels.color;
            const fontFamily = config.fonts.labels.family;
            
            if (label1 && label2 && label1 !== label2) {
                // Two different labels
                if (flipText) {
                    // When flipped, label2 goes on top (as it's the reverse direction)
                    svg += `<text x="${midX}" y="${midY - 3}" text-anchor="${textAnchor}" font-size="${fontSize}" 
                            fill="${fontColor}" font-family="${fontFamily}" font-weight="${fontWeight}"
                            transform="rotate(${angle} ${midX} ${midY})"
                            text-rendering="optimizeLegibility">${label2}</text>`;
                    svg += `<text x="${midX}" y="${midY + fontSize + 2}" text-anchor="${textAnchor}" font-size="${fontSize}" 
                            fill="${fontColor}" font-family="${fontFamily}" font-weight="${fontWeight}"
                            transform="rotate(${angle} ${midX} ${midY})"
                            text-rendering="optimizeLegibility">${label1}</text>`;
                } else {
                    // Normal orientation - label1 on top
                    svg += `<text x="${midX}" y="${midY - 3}" text-anchor="${textAnchor}" font-size="${fontSize}" 
                            fill="${fontColor}" font-family="${fontFamily}" font-weight="${fontWeight}"
                            transform="rotate(${angle} ${midX} ${midY})"
                            text-rendering="optimizeLegibility">${label1}</text>`;
                    svg += `<text x="${midX}" y="${midY + fontSize + 2}" text-anchor="${textAnchor}" font-size="${fontSize}" 
                            fill="${fontColor}" font-family="${fontFamily}" font-weight="${fontWeight}"
                            transform="rotate(${angle} ${midX} ${midY})"
                            text-rendering="optimizeLegibility">${label2}</text>`;
                }
            } else if (label1 || label2) {
                // Single label - determine which one to show based on direction
                let label;
                
                if (flipText && label2) {
                    // Connection goes right-to-left, prefer label2 (reverse direction)
                    label = label2;
                } else if (!flipText && label1) {
                    // Connection goes left-to-right, prefer label1 (forward direction)
                    label = label1;
                } else {
                    // Use whichever label is available
                    label = label1 || label2;
                }
                
                // Adjust y position based on whether text is above or below line
                const yOffset = flipText ? fontSize + 2 : -3;
                
                svg += `<text x="${midX}" y="${midY + yOffset}" text-anchor="${textAnchor}" font-size="${fontSize}" 
                        fill="${fontColor}" font-family="${fontFamily}" font-weight="${fontWeight}"
                        transform="rotate(${angle} ${midX} ${midY})"
                        text-rendering="optimizeLegibility">${label}</text>`;
            }
        }
        
        return svg;
    }

    renderCustomLabels(labels, offsetX, offsetY, edgeLength, config) {
        let svg = '';
        
        labels.forEach(label => {
            const x = (label.x / config.edgeLength + offsetX) * edgeLength;
            const y = (label.y / config.edgeLength + offsetY) * edgeLength;
            
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
                    dominant-baseline="middle"
                    transform="rotate(${label.rotation || 0} ${x} ${y})">${label.text}</text>`;
        });
        
        return svg;
    }

    renderRooms(rooms, positions, offsetX, offsetY, edgeLength, roomSize, roomShape, strokeWidth, config) {
        let svg = '';
        
        rooms.forEach(room => {
            const pos = positions.get(room.id);
            if (!pos) return;
            
            const x = (pos.x + offsetX) * edgeLength;
            const y = (pos.y + offsetY) * edgeLength;
            
            // Determine room color based on tags
            let color = config.colors.default;
            if (room.tags && config.tagColors) {
                for (const tag of room.tags) {
                    if (config.tagColors.has(tag)) {
                        color = config.tagColors.get(tag);
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
            svg += this.renderRoomText(room, x, y, roomShape, roomSize, config);
        });
        
        return svg;
    }

    renderRoomText(room, x, y, roomShape, roomSize, config) {
        let svg = '';
        
        const fontWeight = config.fonts.rooms.bold ? 'bold' : 'normal';
        const fontSize = config.fonts.rooms.size || 10;
        const fontColor = config.fonts.rooms.color;
        const fontFamily = config.fonts.rooms.family;
        
        if (config.showRoomNames && room.title && room.title[0]) {
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
            
        } else if (config.showRoomIds) {
            // Just show room ID - center text vertically using dominant-baseline
            svg += `<text x="${x}" y="${y}" text-anchor="middle" font-size="${fontSize}" 
                    fill="${fontColor}" font-family="${fontFamily}" font-weight="${fontWeight}"
                    text-rendering="optimizeLegibility" dominant-baseline="middle">${room.id}</text>`;
        }
        
        return svg;
    }

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

    renderCustomTextBoxes(textBoxes, offsetX, offsetY, edgeLength, config) {
        let svg = '<g id="custom-textboxes">';
        
        textBoxes.forEach(textBox => {
            // Text boxes use grid coordinates, same as labels
            const x = textBox.x;
            const y = textBox.y;
            const width = textBox.width;
            const height = textBox.height;
            const padding = textBox.padding || 10;
            
            // Create group for the text box with rotation
            svg += `<g transform="rotate(${textBox.rotation || 0} ${x + width/2} ${y + height/2})" opacity="${textBox.opacity || 1}">`;
            
            // Draw background rectangle
            const strokeDasharray = {
                'solid': '',
                'dashed': 'stroke-dasharray="5,5"',
                'dotted': 'stroke-dasharray="2,3"',
                'double': ''
            };
            
            if (textBox.borderStyle === 'double' && textBox.borderWidth > 0) {
                // Draw double border
                const outerBorderWidth = textBox.borderWidth;
                const innerBorderWidth = Math.max(1, textBox.borderWidth - 2);
                const gap = 2;
                
                // Outer border
                svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" 
                        fill="none" 
                        stroke="${textBox.borderColor}" 
                        stroke-width="${outerBorderWidth}"
                        rx="${textBox.borderRadius || 0}" ry="${textBox.borderRadius || 0}"/>`;
                
                // Inner border
                svg += `<rect x="${x + gap + outerBorderWidth/2}" y="${y + gap + outerBorderWidth/2}" 
                        width="${width - 2*gap - outerBorderWidth}" height="${height - 2*gap - outerBorderWidth}" 
                        fill="${textBox.backgroundColor}" 
                        stroke="${textBox.borderColor}" 
                        stroke-width="${innerBorderWidth}"
                        rx="${Math.max(0, (textBox.borderRadius || 0) - gap)}" 
                        ry="${Math.max(0, (textBox.borderRadius || 0) - gap)}"/>`;
            } else {
                // Single border
                svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" 
                        fill="${textBox.backgroundColor}" 
                        stroke="${textBox.borderColor}" 
                        stroke-width="${textBox.borderWidth}"
                        ${strokeDasharray[textBox.borderStyle] || ''}
                        rx="${textBox.borderRadius || 0}" ry="${textBox.borderRadius || 0}"/>`;
            }
            
            // Create text content
            svg += `<text text-anchor="${this.getTextAnchor(textBox.textAlign)}">`;
            
            let currentY = y + padding;
            const lineHeight = 1.2; // Line height multiplier
            
            // Calculate total text height for vertical alignment
            let totalTextHeight = 0;
            textBox.content.forEach(segment => {
                totalTextHeight += segment.fontSize * lineHeight;
                if (segment.lineBreak) {
                    totalTextHeight += segment.fontSize * 0.5; // Extra space for line breaks
                }
            });
            
            // Adjust starting Y based on vertical alignment
            if (textBox.verticalAlign === 'middle') {
                currentY = y + (height - totalTextHeight) / 2 + padding;
            } else if (textBox.verticalAlign === 'bottom') {
                currentY = y + height - totalTextHeight - padding;
            }
            
            // Render each text segment
            textBox.content.forEach((segment, index) => {
                const fontWeight = segment.bold ? 'bold' : 'normal';
                const fontStyle = segment.italic ? 'italic' : 'normal';
                const fontSize = segment.fontSize || 12;
                
                // Calculate X position based on alignment
                let textX = x + padding;
                if (textBox.textAlign === 'center') {
                    textX = x + width / 2;
                } else if (textBox.textAlign === 'right') {
                    textX = x + width - padding;
                }
                
                currentY += fontSize; // Move to baseline position
                
                svg += `<tspan x="${textX}" y="${currentY}" 
                        font-size="${fontSize}" 
                        font-family="${segment.fontFamily}" 
                        font-weight="${fontWeight}"
                        font-style="${fontStyle}"
                        fill="${segment.fontColor}">${this.escapeXml(segment.text)}</tspan>`;
                
                // Add line break if specified
                if (segment.lineBreak && index < textBox.content.length - 1) {
                    currentY += fontSize * 0.5; // Extra space for line break
                }
            });
            
            svg += '</text>';
            svg += '</g>'; // Close transform group
        });
        
        svg += '</g>'; // Close textboxes group
        return svg;
    }
    
    getTextAnchor(align) {
        switch (align) {
            case 'center': return 'middle';
            case 'right': return 'end';
            case 'justify':
            case 'left':
            default: return 'start';
        }
    }
    
    escapeXml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
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
}