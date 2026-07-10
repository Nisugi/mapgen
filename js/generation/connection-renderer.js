
// Connection Renderer - handles all connection rendering
export class ConnectionRenderer {
    constructor() {
        this.connectionAnalyzer = null;
    }

    setConnectionAnalyzer(analyzer) {
        this.connectionAnalyzer = analyzer;
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
                
                const direction = this.connectionAnalyzer ? this.connectionAnalyzer.getDirectionForConnection(room, targetId, roomLookup) : null;
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

    // Dashed connectors for edges with no derivable direction ("go door",
    // "climb ladder", scripts). These prove adjacency but not geometry, so
    // they render as dashed labeled lines - within or across groups.
    renderConnectorConnections(rooms, positions, roomLookup, offsetX, offsetY, edgeLength, connectionWidth, config) {
        let svg = '<g id="connector-connections">';

        const maxCells = config.connectorMaxCells ?? 30; // skip portal-length spaghetti
        const drawnConnections = new Set();

        rooms.forEach(room => {
            const pos = positions.get(room.id);
            if (!pos || !room.wayto) return;

            for (const targetId of Object.keys(room.wayto)) {
                const targetIdNum = parseInt(targetId);
                const targetRoom = roomLookup.get(targetIdNum);
                const targetPos = positions.get(targetIdNum);
                if (!targetPos || !targetRoom) continue;

                // Cross-group dirto edges are drawn by the cross-group pass
                if (this.connectionAnalyzer && this.connectionAnalyzer.isCrossGroupConnection(room, targetId)) continue;

                const connectionKey = [room.id, targetIdNum].sort().join('-');
                if (drawnConnections.has(connectionKey)) continue;

                // Directional edges are drawn by renderRegularConnections
                const direction = this.connectionAnalyzer ? this.connectionAnalyzer.getDirectionForConnection(room, targetId, roomLookup) : null;
                if (direction) continue;
                drawnConnections.add(connectionKey);

                const cellDist = Math.max(Math.abs(pos.x - targetPos.x), Math.abs(pos.y - targetPos.y));
                if (cellDist > maxCells) continue;

                const x1 = (pos.x + offsetX) * edgeLength;
                const y1 = (pos.y + offsetY) * edgeLength;
                const x2 = (targetPos.x + offsetX) * edgeLength;
                const y2 = (targetPos.y + offsetY) * edgeLength;

                const roomSize = config.roomSize || 15;
                const roomShape = config.roomShape || 'square';
                const edgePoints = this.calculateEdgeIntersections(x1, y1, x2, y2, roomSize, roomShape);

                svg += `<line x1="${edgePoints.x1}" y1="${edgePoints.y1}" x2="${edgePoints.x2}" y2="${edgePoints.y2}" ` +
                    `stroke="${config.colors.connections || '#666'}" stroke-width="${connectionWidth}" ` +
                    `stroke-dasharray="4,3" opacity="0.7"/>`;

                if (config.showLabels && this.connectionAnalyzer) {
                    svg += this.renderConnectionLabel(room, targetId, targetRoom, x1, y1, x2, y2, config);
                }
            }
        });

        svg += '</g>';
        return svg;
    }

    renderCrossGroupConnectionLines(rooms, positions, roomLookup, offsetX, offsetY, edgeLength, connectionWidth, config) {
        let svg = '<g id="cross-group-connection-lines">';
        
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
        
        // Draw UI-specified cross-group connection lines (without terminals)
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
                    
                    // Draw ONLY the line
                    svg += `<line x1="${edgePoints.x1}" y1="${edgePoints.y1}" 
                            x2="${edgePoints.x2}" y2="${edgePoints.y2}" 
                            stroke="${color}" stroke-width="${connectionWidth}" 
                            stroke-dasharray="${dashArray}" opacity="0.6"/>`;
                }
            });
        }
        
        // Draw dirto cross-group connection lines
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

    renderCrossGroupConnectionTerminals(rooms, positions, roomLookup, offsetX, offsetY, edgeLength, connectionWidth, config) {
        let svg = '<g id="cross-group-connection-terminals">';
        
        // Draw only terminals for UI-specified cross-group connections
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
                    
                    const color = conn.color || config.colors.connections;
                    
                    // Calculate angle for arrow direction
                    const angle = Math.atan2(y2 - y1, x2 - x1);
                    
                    // Draw ONLY terminals
                    if (conn.fromTerminal?.show) {
                        svg += this.renderConnectionTerminal(
                            edgePoints.x1, edgePoints.y1, 
                            conn.fromTerminal?.style || 'dot',
                            color, connectionWidth,
                            angle // Arrow points in direction of travel (away from source)
                        );
                    }
                    if (conn.toTerminal?.show) {
                        svg += this.renderConnectionTerminal(
                            edgePoints.x2, edgePoints.y2, 
                            conn.toTerminal?.style || 'dot', 
                            color, connectionWidth,
                            angle + Math.PI // Reverse angle - arrow points back toward source (into destination)
                        );
                    }
                }
            });
        }
        
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
}