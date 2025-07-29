// Room Renderer - handles room shapes and text rendering
export class RoomRenderer {
    constructor() {
        // No dependencies
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