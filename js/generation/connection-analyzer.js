// Connection Analyzer - analyzes room connections and directions
export class ConnectionAnalyzer {
    constructor() {
        // Cardinal directions we recognize
        this.cardinalDirections = new Set([
            'north', 'south', 'east', 'west',
            'northeast', 'northwest', 'southeast', 'southwest',
            'up', 'down', 'out'
        ]);
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
}