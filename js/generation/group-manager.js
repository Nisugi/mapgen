// Group Manager - manages group positioning and offsets
export class GroupManager {
    constructor() {
        // No dependencies
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

    applyGroupOffsets(groups, config, groupPixelModes = new Map()) {
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
            const isPixelMode = groupPixelModes.get(groupIndex) || false;
            let manualOffsetX = 0;
            let manualOffsetY = 0;
            
            if (config.groupOffsets && config.groupOffsets.has(groupIndex)) {
                const manualOffset = config.groupOffsets.get(groupIndex);
                if (isPixelMode) {
                    // Pixel mode: use offset directly as pixels, convert to grid units
                    manualOffsetX = (manualOffset.x || 0) / (config.edgeLength || 60);
                    manualOffsetY = (manualOffset.y || 0) / (config.edgeLength || 60);
                } else {
                    // Grid mode: use offset as grid cells
                    manualOffsetX = manualOffset.x || 0;
                    manualOffsetY = manualOffset.y || 0;
                }
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
}