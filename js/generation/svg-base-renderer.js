// SVG Base Renderer - handles core SVG creation and background
export class SVGBaseRenderer {
    constructor() {
        // No dependencies
    }

    createSVGContainer(rooms, positions, config) {
        // Calculate bounds with padding
        const coords = Array.from(positions.values());
        const minX = Math.min(...coords.map(p => p.x));
        const maxX = Math.max(...coords.map(p => p.x));
        const minY = Math.min(...coords.map(p => p.y));
        const maxY = Math.max(...coords.map(p => p.y));
        
        const padding = 2; // Grid units of padding
        const edgeLength = config.edgeLength || 60;
        const width = (maxX - minX + 2 * padding) * edgeLength;
        const height = (maxY - minY + 2 * padding) * edgeLength;
        const offsetX = -minX + padding;
        const offsetY = -minY + padding;
        
        return {
            width,
            height,
            offsetX,
            offsetY,
            edgeLength,
            svgStart: `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`,
            svgEnd: '</svg>'
        };
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
        
        if (!config.showGroupLabels || !groups) return svg;
        
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

    // Utility methods
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

    getTextAnchor(align) {
        switch (align) {
            case 'center': return 'middle';
            case 'right': return 'end';
            case 'justify':
            case 'left':
            default: return 'start';
        }
    }
}