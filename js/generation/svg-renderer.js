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
        
        // Draw connections
        if (config.showConnections) {
            svg += this.renderConnections(rooms, positions, roomLookup, offsetX, offsetY, edgeLength, connectionWidth, config);
        }
        
        // Draw custom labels if provided
        if (config.customLabels && config.customLabels.length > 0) {
            svg += this.renderCustomLabels(config.customLabels, offsetX, offsetY, edgeLength, config);
        }
        
        // Draw rooms
        svg += this.renderRooms(rooms, positions, offsetX, offsetY, edgeLength, roomSize, roomShape, strokeWidth, config);
        
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
                        font-family="Arial" font-weight="bold">${label}</text>`;
            }
        });
        
        return svg;
    }

    renderConnections(rooms, positions, roomLookup, offsetX, offsetY, edgeLength, connectionWidth, config) {
        let svg = '';
        
        // Create a set to track drawn connections (to avoid duplicates)
        const drawnConnections = new Set();
        const crossGroupConnections = [];
        
        // Initialize connection analyzer if not set
        if (!this.connectionAnalyzer) {
            // Import it here to avoid circular dependency
            import('../generation/connection-analyzer.js').then(module => {
                this.connectionAnalyzer = new module.ConnectionAnalyzer();
            });
            return svg; // Skip connections for now
        }
        
        // First pass: collect cross-group connections
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
        
        // Draw cross-group connections first (under everything else)
        if (config.crossGroupConnections || crossGroupConnections.length > 0) {
            svg += `<g id="cross-group-connections">`;
            
            // From UI-specified connections
            if (config.crossGroupConnections) {
                config.crossGroupConnections.forEach(conn => {
                    const fromPos = positions.get(conn.fromId);
                    const toPos = positions.get(conn.toId);
                    if (fromPos && toPos) {
                        const x1 = (fromPos.x + offsetX) * edgeLength;
                        const y1 = (fromPos.y + offsetY) * edgeLength;
                        const x2 = (toPos.x + offsetX) * edgeLength;
                        const y2 = (toPos.y + offsetY) * edgeLength;
                        
                        const dashArray = conn.dashSpacing || '5,5';
                        const color = conn.color || config.colors.connections;
                        
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
                        stroke="${config.colors.connections}" stroke-width="${connectionWidth}" 
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
                if (this.connectionAnalyzer.isCrossGroupConnection(room, targetId)) continue;
                
                // Create unique key for this connection
                const connectionKey = [room.id, targetIdNum].sort().join('-');
                if (drawnConnections.has(connectionKey)) continue;
                drawnConnections.add(connectionKey);
                
                const direction = this.connectionAnalyzer.getDirectionForConnection(room, targetId);
                if (!direction) continue;
                
                const x1 = (pos.x + offsetX) * edgeLength;
                const y1 = (pos.y + offsetY) * edgeLength;
                const x2 = (targetPos.x + offsetX) * edgeLength;
                const y2 = (targetPos.y + offsetY) * edgeLength;
                
                // Determine connection color
                const isVertical = this.connectionAnalyzer.isVerticalConnection(room, targetId) || 
                                 this.connectionAnalyzer.isVerticalConnection(targetRoom, room.id.toString());
                const connectionColor = isVertical ? 
                    (config.colors.verticalConnections || '#999') : 
                    (config.colors.connections || '#666');
                
                svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${connectionColor}" stroke-width="${connectionWidth}"/>`;
                
                if (config.showLabels) {
                    svg += this.renderConnectionLabel(room, targetId, targetRoom, x1, y1, x2, y2, config);
                }
            }
        });
        
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
            const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
            const adjustedAngle = (angle > 90 || angle < -90) ? angle + 180 : angle;
            
            // Font settings
            const fontWeight = config.fonts.labels.bold ? 'bold' : 'normal';
            const fontSize = config.fonts.labels.size || 8;
            const fontColor = config.fonts.labels.color;
            const fontFamily = config.fonts.labels.family;
            
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
                    dominant-baseline="middle">${label.text}</text>`;
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